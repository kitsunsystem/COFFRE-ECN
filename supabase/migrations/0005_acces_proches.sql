-- Accès des proches depuis leur téléphone, et cartes des bénéficiaires envoyées au décès (retours du client, 28/10/2026).
--
-- 1. Plus besoin de cartes pour l'urgence ou un coup dur (hospitalisation, banque, procuration…). Dans l'application,
--    le téléphone du proche crée sa propre clé, protégée par Face ID et un code à 6 chiffres. Le proche demande l'accès ;
--    le titulaire reçoit un e-mail et accepte (ou refuse) depuis son Coffre ouvert, qui scelle vers cette clé ce qu'il
--    lui a attribué. Le serveur ne reçoit que la clé publique : il ne peut rien ouvrir.
--    Un téléphone de proche est rangé comme une carte sans puce (kind = 'telephone') : mêmes enveloppes, mêmes moments
--    d'ouverture, même retrait. Un seul téléphone par proche : accepter le nouveau retire l'ancien.
-- 2. Le pack de 2 cartes d'un bénéficiaire est commandé (et payé) à sa désignation mais gardé en réserve : rangées des
--    années, des cartes se perdent, et une puce dure 10 à 15 ans. Il part quand l'équipe confirme le décès (pas au
--    premier signalement INSEE : un homonyme recevrait des cartes) et arrive pendant le délai d'annulation. Le
--    bénéficiaire donne son adresse à ce moment-là, puis active ses cartes avec son téléphone validé : chaque carte
--    garde la clé du téléphone, chiffrée par la carte et son code.

alter table public.cards drop constraint cards_status_check;
alter table public.cards add constraint cards_status_check
  check (status in ('reservee', 'demandee', 'commandee', 'en_route', 'recue', 'active', 'perdue'));
alter table public.cards drop constraint cards_kind_check;
alter table public.cards add constraint cards_kind_check check (kind in ('fido', 'tangem', 'demo', 'telephone'));
alter table public.cards add column phone_id uuid references public.cards on delete set null; -- carte d'un pack : le téléphone dont elle garde la clé
alter table public.cards add column ship_to text check (length(ship_to) <= 400); -- pack : adresse du bénéficiaire, effacée à l'envoi

-- Seules les cartes du titulaire partent à son adresse ; un téléphone ou un pack réservé n'en ont pas besoin.
create or replace function public.cards_need_address()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.holder_person_id is null and new.status = 'commandee' and coalesce(trim((select address from profiles where id = new.owner_id)), '') = '' then
    raise exception 'adresse de livraison manquante';
  end if;
  return new;
end $$;

create or replace function public.order_pack(person uuid)
returns setof public.cards language plpgsql security definer set search_path = public as $$
declare p people; s app_settings := settings();
begin
  select * into p from people where id = person and owner_id = auth.uid();
  if p.id is null then raise exception 'proche inconnu'; end if;
  if exists (select 1 from cards where holder_person_id = p.id and kind is distinct from 'telephone' and status <> 'perdue') then raise exception 'pack déjà commandé'; end if;
  perform enqueue_email(p.email, p.first_name, 'invitation-porteur', jsonb_build_object('ownerName', owner_name(p.owner_id)));
  perform audit(p.owner_id, 'cartes.pack', jsonb_build_object('person', p.id));
  return query insert into cards (owner_id, holder_person_id, printed_name, extra, status)
    select p.owner_id, p.id, p.first_name || ' ' || p.last_name, true, 'reservee' from generate_series(1, s.pack_cards) returning *;
end $$;

-- ---------- Le téléphone d'un proche ----------

-- Le bénéficiaire, depuis l'application : la clé publique de son téléphone attend l'accord du titulaire (une demande à la fois).
create or replace function public.request_access(person uuid, pk text)
returns public.cards language plpgsql security definer set search_path = public as $$
declare p people; o profiles; r cards;
begin
  select * into p from people where id = person and user_id = auth.uid();
  if p.id is null then raise exception 'proche inconnu'; end if;
  if not exists (select 1 from cards where holder_person_id = p.id and kind is distinct from 'telephone' and status <> 'perdue') then raise exception 'pas bénéficiaire'; end if;
  if length(coalesce(pk, '')) not between 40 and 64 then raise exception 'clé invalide'; end if;
  if (select count(*) from audit_log a where a.owner_id = p.owner_id and a.action = 'acces.demande' and a.detail ->> 'person' = p.id::text and a.at > now() - interval '1 day') >= 5 then
    raise exception 'trop de demandes';
  end if;
  delete from cards where holder_person_id = p.id and kind = 'telephone' and status = 'demandee';
  insert into cards (owner_id, holder_person_id, printed_name, kind, status, box_pk)
    values (p.owner_id, p.id, p.first_name || ' ' || p.last_name, 'telephone', 'demandee', pk) returning * into r;
  select * into o from profiles where id = p.owner_id;
  perform enqueue_email(o.email, o.first_name, 'demande-acces', jsonb_build_object('name', r.printed_name, 'date', now()));
  perform audit(p.owner_id, 'acces.demande', jsonb_build_object('card', r.id, 'person', p.id));
  return r;
end $$;

-- Le titulaire accepte, Coffre ouvert : le téléphone reçoit les enveloppes de ce qui est déjà attribué à ce proche, et
-- son ancien téléphone, s'il y en avait un, n'ouvre plus rien.
create or replace function public.approve_access(card uuid, envs jsonb)
returns public.cards language plpgsql security definer set search_path = public as $$
declare r cards; p people;
begin
  update cards set status = 'active', activated_at = now()
   where id = card and kind = 'telephone' and status = 'demandee' and acts_for(owner_id) returning * into r;
  if r.id is null then raise exception 'demande inconnue'; end if;
  delete from cards where holder_person_id = r.holder_person_id and kind = 'telephone' and id <> r.id;
  insert into envelopes (card_id, owner_id, subsection_id, moment, sealed)
    select r.id, r.owner_id, e ->> 'subsection_id', e ->> 'moment', e ->> 'sealed' from jsonb_array_elements(coalesce(envs, '[]')) e;
  select * into p from people where id = r.holder_person_id;
  perform enqueue_email(p.email, p.first_name, 'acces-valide', jsonb_build_object('ownerName', owner_name(r.owner_id)));
  perform audit(r.owner_id, 'acces.accepte', jsonb_build_object('card', r.id, 'person', p.id));
  return r;
end $$;

create or replace function public.refuse_access(card uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  delete from cards where id = card and kind = 'telephone' and status = 'demandee' and acts_for(owner_id) returning owner_id into o;
  if o is null then raise exception 'demande inconnue'; end if;
  perform audit(o, 'acces.refuse', jsonb_build_object('card', card));
end $$;

-- Le titulaire retire un téléphone ou une carte ; un bénéficiaire, seulement l'une de ses cartes (son téléphone se
-- remplace quand le titulaire accepte le nouveau). Un pack encore en réserve ne se perd pas.
create or replace function public.declare_card_lost(card uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r cards;
begin
  update cards set status = 'perdue', wrapped_vmk = null, box_pk = null, lost_at = now()
   where id = card and status not in ('perdue', 'reservee')
     and (acts_for(owner_id) or (holds_card(id) and kind is distinct from 'telephone')) returning * into r;
  if r.id is null then raise exception 'carte inconnue'; end if;
  delete from envelopes where card_id = r.id;
  perform audit(r.owner_id, 'carte.perdue', jsonb_build_object('card', r.id));
end $$;

-- ---------- Le pack, au décès ----------

-- Décès confirmé : les packs réservés partent maintenant, ils arrivent pendant le délai d'annulation.
create or replace function public.staff_confirm_death(proc uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p procedures; o profiles; s app_settings := settings();
begin
  if not is_staff('verification') then raise exception 'interdit'; end if;
  update procedures set verified_at = now(), verified_by = auth.uid(), ends_at = now() + s.death_delay, alerted_at = now()
   where id = proc and kind = 'deces' and procedure_status(procedures) = 'verification' and acte_path is not null and acte_id_checked
   returning * into p;
  if p.id is null then raise exception 'concordance incomplète'; end if;
  select * into o from profiles where id = p.owner_id;
  perform enqueue_email(o.email, o.first_name, 'deces-delai', jsonb_build_object('endsAt', p.ends_at));
  update cards set status = 'commandee' where owner_id = p.owner_id and status = 'reservee';
  perform enqueue_email(b.email, b.first_name, 'cartes-beneficiaire', jsonb_build_object('ownerName', o.first_name || ' ' || o.last_name))
     from (select distinct pe.email, pe.first_name from people pe join cards c on c.holder_person_id = pe.id
            where c.owner_id = p.owner_id and c.status = 'commandee') b;
  perform audit(p.owner_id, 'verification.deces_confirme', jsonb_build_object('procedure', proc));
end $$;

-- Le bénéficiaire indique où recevoir ses cartes ; l'adresse est effacée dès l'envoi.
create or replace function public.set_pack_address(person uuid, address text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(address, ''))) not between 6 and 400 then raise exception 'adresse invalide'; end if;
  update cards c set ship_to = trim(address) from people p
   where p.id = person and p.user_id = auth.uid() and c.holder_person_id = p.id and c.status = 'commandee';
  if not found then raise exception 'aucune carte à envoyer'; end if;
end $$;

create or replace function public.staff_card_status(card uuid, new_status text)
returns void language plpgsql security definer set search_path = public as $$
declare c cards;
begin
  if not is_staff('logistique') then raise exception 'interdit'; end if;
  if new_status not in ('en_route', 'recue') then raise exception 'statut invalide'; end if;
  select * into c from cards where id = card and status in ('commandee', 'en_route') and kind is distinct from 'telephone';
  if c.id is null then return; end if;
  if new_status = 'en_route' and c.holder_person_id is not null and c.ship_to is null then raise exception 'adresse de livraison manquante'; end if;
  update cards set status = new_status, shipped_at = case when new_status = 'en_route' then now() else shipped_at end,
    ship_to = case when new_status = 'en_route' then null else ship_to end
   where id = c.id;
  update profiles set address = null where id = c.owner_id
    and not exists (select 1 from cards x where x.owner_id = c.owner_id and x.holder_person_id is null and x.status = 'commandee');
end $$;

-- Au décès, le bénéficiaire active ses cartes depuis son téléphone validé : chacune garde la clé du téléphone, chiffrée
-- par la carte et son code. Téléphone perdu ou changé, ses cartes ouvrent toujours sa part.
create or replace function public.activate_pack_card(card uuid, card_kind text, chip text, wrapped jsonb, card_salt text, phone uuid)
returns public.cards language plpgsql security definer set search_path = public as $$
declare r cards;
begin
  update cards c set status = 'active', kind = card_kind, chip_id = chip, wrapped_vmk = wrapped, salt = card_salt, phone_id = phone, activated_at = now()
   where c.id = card and c.holder_person_id is not null and c.kind is distinct from 'telephone' and holds_card(c.id)
     and c.status in ('commandee', 'en_route', 'recue') and card_kind in ('fido', 'tangem', 'demo')
     and exists (select 1 from cards t where t.id = phone and t.holder_person_id = c.holder_person_id and t.kind = 'telephone' and t.status = 'active')
   returning * into r;
  if r.id is null then raise exception 'carte non activable'; end if;
  perform audit(r.owner_id, 'carte.activation', jsonb_build_object('card', r.id, 'kind', card_kind, 'holder', r.holder_person_id));
  return r;
end $$;

-- Les packs ne s'activent plus du vivant du titulaire.
drop function public.activate_holder_card(uuid, text, text, text, text);

-- Le proche reçoit aussi ce qu'il faut pour ouvrir avec ses cartes (la clé du téléphone, chiffrée) et son adresse d'envoi.
create or replace function public.my_trusts()
returns table (owner_id uuid, owner_name text, person_id uuid, guarantor_role text, cards jsonb, procedures jsonb)
language sql stable security definer set search_path = public as $$
  select p.owner_id, owner_name(p.owner_id), p.id,
    (select g.role from guarantors g where g.person_id = p.id),
    coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'printed_name', c.printed_name, 'status', c.status, 'kind', c.kind,
      'chip_id', c.chip_id, 'box_pk', c.box_pk, 'salt', c.salt, 'wrapped_vmk', c.wrapped_vmk, 'phone_id', c.phone_id, 'ship_to', c.ship_to,
      'ordered_at', c.ordered_at, 'activated_at', c.activated_at) order by c.ordered_at)
      from cards c where c.holder_person_id = p.id), '[]'),
    coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'source', r.source, 'declared_by', r.declared_by,
      'declared_at', r.declared_at, 'needs_verification', r.needs_verification, 'verified_at', r.verified_at, 'rejected_at', r.rejected_at,
      'cancelled_at', r.cancelled_at, 'ends_at', r.ends_at, 'closed_at', r.closed_at, 'finalized_at', r.finalized_at, 'erased_at', r.erased_at,
      'acte', r.acte_path is not null, 'acte_by_me', r.acte_by = p.id, 'access_end', access_end(r)) order by r.declared_at desc)
      from procedures r where r.owner_id = p.owner_id and (exists (select 1 from guarantors g where g.person_id = p.id)
        or exists (select 1 from cards c where c.holder_person_id = p.id and c.status <> 'perdue'))), '[]')
  from people p
  where p.user_id = auth.uid()
$$;

revoke execute on function public.request_access, public.approve_access, public.refuse_access, public.set_pack_address, public.activate_pack_card
  from public, anon, authenticated;
grant execute on function public.request_access, public.approve_access, public.refuse_access, public.set_pack_address, public.activate_pack_card
  to authenticated;
