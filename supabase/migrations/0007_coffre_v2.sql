-- Coffre, version 2 (fiche développeur du client d'octobre 2026, et son message du 31/10/2026).
--
-- 1. Coup dur : plus de signalement d'un garant suivi d'un délai. Un proche fait une demande d'ouverture depuis son
--    compte : motif, justificatif (ex. bulletin d'hospitalisation), photo de sa pièce d'identité et de son visage.
--    L'IA donne un avis sur le justificatif, une personne de l'équipe vérifie tout, puis la partie « Coup dur » s'ouvre
--    pour CE proche seulement, pendant une durée limitée. Le titulaire est alerté et peut tout fermer à tout moment.
--    Le serveur ne libère que des enveloppes scellées pour le téléphone du proche : il ne peut toujours rien lire.
-- 2. Décès : la photo du visage s'ajoute à la pièce d'identité du bénéficiaire qui dépose l'acte.
-- 3. Les invitations ne partent plus d'office : le titulaire envoie lui-même un message préparé. Un bénéficiaire a
--    forcément un compte, donc une adresse e-mail.
-- 4. Paiement : Paddle remplace Stripe (identifiant client neutre).

-- Le délai de 48 h d'un coup dur devient la durée pendant laquelle il reste ouvert au proche : à décider.
alter table public.app_settings rename column coup_dur_delay to coup_dur_access;
alter table public.app_settings alter column coup_dur_access set default interval '30 days';
update public.app_settings set coup_dur_access = interval '30 days' where id;
alter table public.procedures add column selfie_path text; -- photo du visage, avec la pièce d'identité
-- Coup dur : acte_path = justificatif, acte_id_path = pièce d'identité, acte_by = le proche qui demande, note = motif.
alter table public.procedures drop constraint procedures_source_check;
alter table public.procedures add constraint procedures_source_check check (source in ('garant', 'insee', 'beneficiaire', 'proche'));

-- Un coup dur ouvert se referme seul au bout de la durée prévue.
create or replace function public.procedure_status(p public.procedures, at timestamptz default now())
returns text language sql stable as $$
  select case
    when p.cancelled_at is not null then 'annulee'
    when p.rejected_at is not null then 'rejetee'
    when p.closed_at is not null then 'cloturee'
    when p.needs_verification and p.verified_at is null then 'verification'
    when p.ends_at is null or at < p.ends_at then 'delai'
    when p.kind = 'coup_dur' and at >= p.ends_at + (select coup_dur_access from app_settings) then 'cloturee'
    when p.kind = 'coup_dur' then 'active'
    else 'terminee'
  end
$$;

-- Ce qu'un téléphone de proche (ou une carte qui en garde la clé) peut ouvrir : « Coup dur » seulement pour le proche
-- dont la demande a été validée, le temps prévu ; après un décès, tout ce qui était prévu.
create or replace function public.is_open(card uuid, owner uuid, moment text)
returns boolean language sql stable security definer set search_path = public as $$
  select is_released(owner, case moment when 'coup_dur' then 'deces' else moment end)
    or (moment = 'coup_dur' and exists (
      select 1 from procedures p join cards c on c.holder_person_id = p.acte_by
       where c.id = card and p.owner_id = owner and p.kind = 'coup_dur' and p.erased_at is null and procedure_status(p) = 'active'))
$$;

drop policy holder on public.envelopes;
create policy holder on public.envelopes for select using (my_card(card_id) and is_open(card_id, owner_id, moment));
drop policy holder on public.vault_items;
create policy holder on public.vault_items for select using (
  subsection_id <> 'prive' and exists (
    select 1 from envelopes e where e.owner_id = vault_items.owner_id and e.subsection_id = vault_items.subsection_id
      and my_card(e.card_id) and is_open(e.card_id, e.owner_id, e.moment))
);
drop policy coffre_holder on storage.objects;
create policy coffre_holder on storage.objects for select using (
  bucket_id = 'coffre' and (storage.foldername(name))[2] <> 'prive' and exists (
    select 1 from envelopes e where e.owner_id = path_owner(name) and e.subsection_id = (storage.foldername(name))[2]
      and my_card(e.card_id) and is_open(e.card_id, e.owner_id, e.moment))
);

-- ---------- Coup dur : la demande d'ouverture ----------

-- Un proche, depuis son compte, avec ses justificatifs déposés dans son propre dossier.
create or replace function public.request_coup_dur(owner uuid, motif text, proof_path text, id_path text, face_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me people; id uuid;
begin
  select * into me from people p where p.owner_id = owner and p.user_id = auth.uid() limit 1;
  if me.id is null then raise exception 'proche inconnu'; end if;
  if motif not in ('hospitalisation', 'coma', 'incapacite') then raise exception 'motif invalide'; end if;
  -- Rien à ouvrir sans un accès validé par le titulaire et une partie prévue pour un coup dur : pas de documents de santé pour rien.
  if not exists (select 1 from cards c where c.holder_person_id = me.id and c.kind = 'telephone' and c.status = 'active') then
    raise exception 'accès pas encore validé par le titulaire';
  end if;
  if not exists (select 1 from rights r where r.owner_id = owner and r.person_id = me.id and r.moment = 'coup_dur') then
    raise exception 'rien n''est prévu pour vous en cas de coup dur';
  end if;
  if split_part(proof_path, '/', 1) <> auth.uid()::text or split_part(id_path, '/', 1) <> auth.uid()::text or split_part(face_path, '/', 1) <> auth.uid()::text then
    raise exception 'chemin invalide';
  end if;
  if exists (select 1 from procedures p where p.owner_id = owner and p.kind = 'coup_dur' and p.acte_by = me.id and procedure_status(p) in ('verification', 'active')) then
    raise exception 'demande déjà en cours';
  end if;
  insert into procedures (owner_id, kind, source, declared_by, declared_by_user, needs_verification, note, acte_path, acte_id_path, selfie_path, acte_by, acte_at)
  values (owner, 'coup_dur', 'proche', me.first_name || ' ' || me.last_name, auth.uid(), true, motif, proof_path, id_path, face_path, me.id, now())
  returning procedures.id into id;
  perform audit(owner, 'procedure.demande_coup_dur', jsonb_build_object('procedure', id, 'by', me.id, 'motif', motif));
  return id;
end $$;

-- Le titulaire est prévenu dès la demande : il peut la refuser, ou fermer l'accès plus tard.
create or replace function public.procedures_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare o profiles;
begin
  select * into o from profiles where id = new.owner_id;
  if new.kind = 'coup_dur' then
    perform enqueue_email(o.email, o.first_name, 'coup-dur-declare', jsonb_build_object('declaredBy', new.declared_by, 'motif', coalesce(new.note, '')));
    new.alerted_at := now();
  end if;
  return new;
end $$;

-- L'équipe ouvre, une fois le justificatif et l'identité du proche vérifiés (l'avis de l'IA ne décide jamais).
create or replace function public.staff_open_coup_dur(proc uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p procedures; o profiles; who people; s app_settings := settings();
begin
  if not is_staff('verification') then raise exception 'interdit'; end if;
  update procedures set verified_at = now(), verified_by = auth.uid(), ends_at = now(), finalized_at = now()
   where id = proc and kind = 'coup_dur' and procedure_status(procedures) = 'verification' and acte_path is not null and acte_id_checked
   returning * into p;
  if p.id is null then raise exception 'vérification incomplète'; end if;
  select * into o from profiles where id = p.owner_id;
  select * into who from people where id = p.acte_by;
  perform enqueue_email(o.email, o.first_name, 'coup-dur-ouvert', jsonb_build_object('declaredBy', p.declared_by, 'until', now() + s.coup_dur_access));
  perform enqueue_email(who.email, who.first_name, 'coup-dur-acces', jsonb_build_object('ownerName', o.first_name || ' ' || o.last_name, 'until', now() + s.coup_dur_access));
  perform audit(p.owner_id, 'verification.coup_dur_ouvert', jsonb_build_object('procedure', proc));
end $$;

-- Un garant ne signale plus qu'un décès : le coup dur passe par la demande d'un proche.
create or replace function public.declare_procedure(owner uuid, proc_kind text, proc_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare id uuid; g people;
begin
  select p.* into g from people p join guarantors gu on gu.person_id = p.id where p.owner_id = owner and p.user_id = auth.uid() limit 1;
  if g.id is null then raise exception 'pas garant'; end if;
  if proc_kind is distinct from 'deces' then raise exception 'type invalide'; end if;
  if exists (select 1 from procedures p where p.owner_id = owner and p.kind = 'deces' and procedure_status(p) in ('verification', 'delai')) then
    raise exception 'déjà signalé';
  end if;
  insert into procedures (owner_id, kind, source, declared_by, declared_by_user, needs_verification, note)
  values (owner, 'deces', 'garant', g.first_name || ' ' || g.last_name, auth.uid(), true, left(proc_note, 1000))
  returning procedures.id into id;
  perform audit(owner, 'procedure.declaration', jsonb_build_object('procedure', id, 'kind', proc_kind));
  return id;
end $$;

-- Une demande de coup dur ne regarde que le titulaire, le proche qui l'a faite et l'équipe : les autres proches ne la voient pas.
drop policy own_read on public.procedures;
create policy own_read on public.procedures for select using (
  acts_for(owner_id) or ((is_guarantor_of(owner_id) or is_beneficiary_of(owner_id))
    and (kind = 'deces' or acte_by in (select id from people where user_id = auth.uid())))
);
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
      from procedures r where r.owner_id = p.owner_id and (r.kind = 'deces' or r.acte_by = p.id)
        and (exists (select 1 from guarantors g where g.person_id = p.id)
          or exists (select 1 from cards c where c.holder_person_id = p.id and c.status <> 'perdue'))), '[]')
  from people p
  where p.user_id = auth.uid()
$$;

-- Le proche est prévenu quand son accès se ferme : refus du titulaire ou de l'équipe, ou fermeture par le titulaire.
create or replace function public.coup_dur_closed()
returns trigger language plpgsql security definer set search_path = public as $$
declare who people;
begin
  select * into who from people where id = new.acte_by;
  if coalesce(who.email, '') <> '' then
    perform enqueue_email(who.email, who.first_name, 'coup-dur-ferme', jsonb_build_object('ownerName', owner_name(new.owner_id)));
  end if;
  return new;
end $$;
create trigger coup_dur_closed after update on public.procedures for each row
  when (new.kind = 'coup_dur' and new.acte_by is not null and ((old.cancelled_at is null and new.cancelled_at is not null)
    or (old.closed_at is null and new.closed_at is not null) or (old.rejected_at is null and new.rejected_at is not null)))
  execute function public.coup_dur_closed();
revoke execute on function public.coup_dur_closed from public, anon, authenticated;

-- ---------- Décès : la photo du visage avec la pièce d'identité ----------

drop function public.declare_death_with_certificate(uuid, text, text);
create or replace function public.declare_death_with_certificate(owner uuid, certificate_path text, id_path text, face_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare id uuid; ben people;
begin
  select p.* into ben from people p join cards c on c.holder_person_id = p.id
   where p.owner_id = owner and p.user_id = auth.uid() and c.status <> 'perdue' limit 1;
  if ben.id is null then raise exception 'pas bénéficiaire'; end if;
  if split_part(certificate_path, '/', 1) <> auth.uid()::text or split_part(id_path, '/', 1) <> auth.uid()::text or split_part(face_path, '/', 1) <> auth.uid()::text then
    raise exception 'chemin invalide';
  end if;
  update procedures set acte_path = certificate_path, acte_id_path = id_path, selfie_path = face_path, acte_by = ben.id, acte_at = now()
   where procedures.owner_id = owner and kind = 'deces' and procedure_status(procedures) = 'verification' and acte_path is null
  returning procedures.id into id;
  if id is null then
    if exists (select 1 from procedures p where p.owner_id = owner and p.kind = 'deces' and procedure_status(p) in ('verification', 'delai', 'terminee') and p.erased_at is null) then
      raise exception 'procédure déjà en cours';
    end if;
    insert into procedures (owner_id, kind, source, declared_by, declared_by_user, needs_verification, acte_path, acte_id_path, selfie_path, acte_by, acte_at)
    values (owner, 'deces', 'beneficiaire', ben.first_name || ' ' || ben.last_name, auth.uid(), true, certificate_path, id_path, face_path, ben.id, now())
    returning procedures.id into id;
  end if;
  perform audit(owner, 'procedure.acte', jsonb_build_object('procedure', id, 'by', ben.id));
  return id;
end $$;

-- ---------- Invitations : envoyées par le titulaire lui-même ----------

drop trigger guarantors_invite on public.guarantors;
drop function public.guarantors_invite();

create or replace function public.order_pack(person uuid)
returns setof public.cards language plpgsql security definer set search_path = public as $$
declare p people; s app_settings := settings();
begin
  select * into p from people where id = person and owner_id = auth.uid();
  if p.id is null then raise exception 'proche inconnu'; end if;
  if coalesce(p.email, '') = '' then raise exception 'adresse e-mail manquante'; end if;
  if exists (select 1 from cards where holder_person_id = p.id and kind is distinct from 'telephone' and status <> 'perdue') then raise exception 'pack déjà commandé'; end if;
  perform audit(p.owner_id, 'cartes.pack', jsonb_build_object('person', p.id));
  return query insert into cards (owner_id, holder_person_id, printed_name, extra, status)
    select p.owner_id, p.id, p.first_name || ' ' || p.last_name, true, 'reservee' from generate_series(1, s.pack_cards) returning *;
end $$;

-- ---------- Paiement : Paddle ----------

alter table public.profiles rename column stripe_customer_id to billing_customer_id;

create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.email := coalesce((select email from auth.users where id = new.id), new.email);
    if auth.uid() is not null then
      new.kyc := 'a_faire'; new.kyc_ref := null; new.billing_status := 'a_jour'; new.billing_since := null;
      new.billing_customer_id := null; new.subscription_status := null;
    end if;
  end if;
  return new;
end $$;

-- Pré-lancement : la date de lancement annoncée aux abonnés (reportée, elle s'affiche partout et ouvre le droit au remboursement).
create or replace function public.staff_set_planned_launch(d date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff('admin') then raise exception 'interdit'; end if;
  update app_settings set planned_launch = d where id;
  perform audit(null, 'admin.date_lancement', jsonb_build_object('date', d));
end $$;

revoke execute on function public.staff_set_planned_launch from public, anon, authenticated;
grant execute on function public.staff_set_planned_launch to authenticated;
revoke execute on function public.is_open, public.request_coup_dur, public.staff_open_coup_dur, public.declare_death_with_certificate from public, anon, authenticated;
grant execute on function public.is_open, public.request_coup_dur, public.staff_open_coup_dur, public.declare_death_with_certificate to authenticated;
