-- Données de l'Espace réduites au strict nécessaire, et e-mails dans la langue de chacun.
-- Ce que le service n'utilise pas n'est plus demandé (situation familiale, téléphone des proches). Ce qui ne sert qu'un
-- temps est effacé après usage : l'adresse postale dès l'envoi des cartes, les pièces justificatives une fois vérifiées
-- et les e-mails envoyés après 30 jours (fonction « relances », chaque jour).
-- Restent lisibles, parce que le service en a besoin : nom, prénom, e-mail et téléphone du titulaire (comptes, e-mails,
-- conciergerie), date et lieu de naissance (veille du fichier des décès), noms et e-mails des proches (invitations).

alter table public.profiles drop column situation;
alter table public.people drop column phone;

alter table public.profiles add column lang text not null default 'fr' check (lang in ('fr', 'en', 'es', 'ca'));
alter table public.outbox add column lang text not null default 'fr' check (lang in ('fr', 'en', 'es', 'ca'));
grant insert (lang), update (lang) on public.profiles to authenticated;

-- Langue d'un e-mail : celle du destinataire s'il a un compte, sinon celle du titulaire qui l'a désigné.
create or replace function public.outbox_lang()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.lang := coalesce(
    (select lang from profiles where lower(email) = lower(new.to_email) limit 1),
    (select o.lang from people p join profiles o on o.id = p.owner_id where lower(p.email) = lower(new.to_email) limit 1),
    new.lang);
  return new;
end $$;
create trigger outbox_lang before insert on public.outbox for each row execute function public.outbox_lang();

-- Les dates partent en ISO : chaque e-mail les écrit dans la langue de son lecteur.
create or replace function public.procedures_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare o profiles;
begin
  select * into o from profiles where id = new.owner_id;
  if new.kind = 'coup_dur' and new.ends_at is not null then
    perform enqueue_email(o.email, o.first_name, 'coup-dur-declare', jsonb_build_object('declaredBy', new.declared_by, 'endsAt', new.ends_at));
    new.alerted_at := now();
  end if;
  return new;
end $$;

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
  perform audit(p.owner_id, 'verification.deces_confirme', jsonb_build_object('procedure', proc));
end $$;

-- L'adresse postale ne sert qu'à l'envoi : demandée à la commande, effacée dès que plus aucune carte n'attend d'expédition.
create or replace function public.cards_need_address()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim((select address from profiles where id = new.owner_id)), '') = '' then raise exception 'adresse de livraison manquante'; end if;
  return new;
end $$;
create trigger cards_need_address before insert on public.cards for each row execute function public.cards_need_address();

create or replace function public.staff_card_status(card uuid, new_status text)
returns void language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  if not is_staff('logistique') then raise exception 'interdit'; end if;
  if new_status not in ('en_route', 'recue') then raise exception 'statut invalide'; end if;
  update cards set status = new_status, shipped_at = case when new_status = 'en_route' then now() else shipped_at end
   where id = card and status in ('commandee', 'en_route') returning owner_id into o;
  update profiles set address = null where id = o and not exists (select 1 from cards c where c.owner_id = o and c.status = 'commandee');
end $$;

-- L'acte de décès peut être effacé à la fin de la procédure (accès terminé, annulation) sans casser la règle de vérification.
alter table public.procedures drop constraint death_needs_certificate;
alter table public.procedures add constraint death_needs_certificate
  check (kind <> 'deces' or verified_at is null or (acte_id_checked and (acte_path is not null or erased_at is not null or cancelled_at is not null)));

revoke execute on function public.outbox_lang, public.cards_need_address from public, anon, authenticated;
