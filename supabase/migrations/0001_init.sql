-- Schéma initial. Hébergement : projet Supabase en région UE, sur une offre certifiée HDS (à confirmer avec l'hébergeur).
-- Deux mondes :
--   * l'Espace (profils, proches, cartes, procédures…) : en clair, lisible par l'éditeur ;
--   * le Coffre (vaults, vault_items, envelopes, bucket "coffre") : uniquement du chiffré, illisible pour l'éditeur.
-- Les règles d'ouverture reprennent src/lib/rules.ts : à modifier aux deux endroits.

create extension if not exists pgcrypto;

-- ---------- Espace ----------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  birth_date date not null,
  birth_city text,
  birth_country text,
  address text,
  situation text,
  is_business_owner boolean not null default false,
  kyc text not null default 'a_faire' check (kyc in ('a_faire', 'en_cours', 'verifie')),
  kyc_ref text, -- référence du dossier dans le système KYC du groupe
  assistant_voice boolean not null default true,
  billing_status text not null default 'a_jour' check (billing_status in ('a_jour', 'impaye', 'efface')),
  billing_since timestamptz, -- début de l'impayé : relances pendant le délai de grâce, puis effacement
  reminder_consent boolean not null default false, -- accord pour enregistrer type et date des échéances
  created_at timestamptz not null default now()
);

-- Lancement en deux temps : tant que launched = false (phase découverte), aucun document ne peut être stocké.
create table public.app_settings (
  id boolean primary key default true check (id), -- une seule ligne
  launched boolean not null default false,
  planned_launch date,
  post_death_access interval not null default interval '6 months', -- 4, 6 ou 12 mois : à décider
  grace_period interval not null default interval '30 days' -- délai de grâce : à décider
);
insert into public.app_settings default values;

create table public.people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  user_id uuid references auth.users on delete set null, -- rempli quand le proche crée son propre compte
  first_name text not null,
  last_name text not null,
  relation text not null,
  email text,
  phone text,
  manages_me boolean not null default false, -- enfant qui gère le compte du parent (procuration)
  created_at timestamptz not null default now()
);
create index on public.people (owner_id);
create index on public.people (user_id);

create table public.guarantors (
  owner_id uuid not null references public.profiles on delete cascade,
  person_id uuid not null references public.people on delete cascade,
  role text not null,
  primary key (owner_id, person_id)
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  holder_person_id uuid references public.people on delete set null, -- null = carte du titulaire
  printed_name text not null,
  status text not null default 'commandee' check (status in ('commandee', 'en_route', 'recue', 'active', 'perdue')),
  extra boolean not null default false,
  chip_public_key text, -- clé publique de la puce (Tangem), pour reconnaître la carte
  wrapped_vmk jsonb, -- cartes du titulaire : clé du Coffre chiffrée par carte + code
  box_pk text, -- cartes des proches : clé publique vers laquelle les enveloppes sont scellées
  salt text,
  ordered_at timestamptz not null default now(),
  activated_at timestamptz
);
create index on public.cards (owner_id);

-- Droits : par bénéficiaire, valables pour les 2 cartes de son pack (le secret, lui, est dans les enveloppes, par carte).
-- now = Urgence (tout de suite, à tout moment), coup_dur, deces, jamais.
create table public.rights (
  person_id uuid not null references public.people on delete cascade,
  subsection_id text not null,
  moment text not null check (moment in ('now', 'coup_dur', 'deces', 'jamais')),
  primary key (person_id, subsection_id)
);

create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('coup_dur', 'deces')),
  source text not null check (source in ('garant', 'insee', 'beneficiaire')),
  declared_by text not null,
  declared_by_user uuid references auth.users,
  declared_at timestamptz not null default now(),
  needs_verification boolean not null,
  verified_at timestamptz,
  verified_by uuid references auth.users,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  ends_at timestamptz,
  closed_at timestamptz,
  finalized_at timestamptz,
  alerted_at timestamptz, -- alerte envoyée au titulaire à l'ouverture du délai
  last_call_at timestamptz, -- dernière alerte, 24 h avant la fin du délai
  erased_at timestamptz, -- décès : Coffre effacé à la fin de la période d'accès des bénéficiaires
  end_warned_at timestamptz, -- bénéficiaires prévenus de la fin prochaine de l'accès
  note text,
  match jsonb,
  -- Concordance du décès : acte fourni par un bénéficiaire (fichier dans le bucket privé "verification"), identité vérifiée par l'équipe.
  acte_path text,
  acte_by uuid references public.people,
  acte_id_checked boolean not null default false,
  -- Pas de notaire par défaut : un décès ne peut être confirmé qu'avec l'acte et l'identité du bénéficiaire vérifiée.
  constraint death_needs_certificate check (kind <> 'deces' or verified_at is null or (acte_path is not null and acte_id_checked))
);
create index on public.procedures (owner_id);

-- Échéances saisies dans l'Espace, avec l'accord de la personne : type de document et date de fin, jamais le contenu du Coffre.
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  label text not null,
  date date not null,
  sent_30 boolean not null default false,
  sent_7 boolean not null default false
);

create table public.checklist (
  owner_id uuid not null references public.profiles on delete cascade,
  key text not null,
  done boolean not null default true,
  primary key (owner_id, key)
);

create table public.concierge_cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  kind text not null,
  partner text not null,
  status text not null default 'demande' check (status in ('demande', 'mandat_signe', 'en_cours', 'termine')),
  mandate_name text,
  mandate_signed_at timestamptz,
  message text,
  created_at timestamptz not null default now()
);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_address text not null,
  template text not null,
  provider_id text,
  sent_at timestamptz not null default now()
);

create table public.staff (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('admin', 'verification', 'conciergerie'))
);

-- ---------- Coffre (chiffré uniquement) ----------

create table public.vaults (
  owner_id uuid primary key references public.profiles on delete cascade,
  salt text not null,
  ssk jsonb not null -- clés de sous-rubriques, chiffrées par la clé du Coffre
);

create table public.vault_items (
  id uuid primary key,
  owner_id uuid not null references public.profiles on delete cascade,
  subsection_id text not null,
  data jsonb not null, -- { n, c } chiffré
  file_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create index on public.vault_items (owner_id, subsection_id);

create table public.envelopes (
  card_id uuid not null references public.cards on delete cascade,
  owner_id uuid not null references public.profiles on delete cascade,
  subsection_id text not null,
  moment text not null check (moment in ('now', 'coup_dur', 'deces')),
  sealed text not null, -- clé de sous-rubrique scellée vers la carte du proche
  primary key (card_id, subsection_id)
);

create table public.concierge_shares (
  case_id uuid not null references public.concierge_cases on delete cascade,
  item_id uuid not null,
  sealed text not null, -- scellé vers la clé de la conciergerie
  primary key (case_id, item_id)
);

-- ---------- Règles d'ouverture (miroir de src/lib/rules.ts) ----------

create or replace function public.procedure_status(p public.procedures, at timestamptz default now())
returns text language sql stable as $$
  select case
    when p.cancelled_at is not null then 'annulee'
    when p.rejected_at is not null then 'rejetee'
    when p.closed_at is not null then 'cloturee'
    when p.needs_verification and p.verified_at is null then 'verification'
    when p.ends_at is null or at < p.ends_at then 'delai'
    when p.kind = 'coup_dur' then 'active'
    else 'terminee'
  end
$$;

create or replace function public.is_released(owner uuid, moment text)
returns boolean language sql stable security definer set search_path = public as $$
  select case moment
    when 'now' then true
    when 'jamais' then false
    when 'deces' then exists (select 1 from procedures p where p.owner_id = owner and p.kind = 'deces' and procedure_status(p) = 'terminee')
    else exists (
      select 1 from procedures p where p.owner_id = owner
        and ((p.kind = 'deces' and procedure_status(p) = 'terminee') or (p.kind = 'coup_dur' and procedure_status(p) = 'active'))
    )
  end
$$;

create or replace function public.is_staff(r text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff s where s.user_id = auth.uid() and (r is null or s.role = r or s.role = 'admin'))
$$;

-- Le compte « géré » : un enfant avec procuration agit comme le titulaire.
create or replace function public.acts_for(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select owner = auth.uid() or exists (select 1 from people p where p.owner_id = owner and p.user_id = auth.uid() and p.manages_me)
$$;

create or replace function public.is_guarantor_of(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from guarantors g join people p on p.id = g.person_id where g.owner_id = owner and p.user_id = auth.uid())
$$;

create or replace function public.my_card(card uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cards c join people p on p.id = c.holder_person_id where c.id = card and p.user_id = auth.uid() and c.status = 'active')
$$;

-- Un garant déclare ; il ne peut ni vérifier, ni raccourcir le délai.
-- Fin de l'accès des bénéficiaires après un décès (miroir de accessEnd dans src/lib/rules.ts).
create or replace function public.access_end(p public.procedures)
returns timestamptz language sql stable as $$
  select case when p.kind = 'deces' and p.ends_at is not null then p.ends_at + (select post_death_access from app_settings) end
$$;

-- Fin du délai de grâce d'un impayé (miroir de graceEnd), lisible comme une colonne calculée de profiles.
create or replace function public.grace_end(p public.profiles)
returns timestamptz language sql stable as $$
  select p.billing_since + (select grace_period from app_settings)
$$;

create or replace function public.is_launched()
returns boolean language sql stable security definer set search_path = public as $$
  select launched from app_settings
$$;

-- Un bénéficiaire (porteur d'une carte active) déclare un décès avec l'acte ; l'équipe vérifie ensuite la concordance.
create or replace function public.declare_death_with_certificate(owner uuid, certificate_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare id uuid; ben people;
begin
  select p.* into ben from people p join cards c on c.holder_person_id = p.id
   where p.owner_id = owner and p.user_id = auth.uid() and c.status = 'active' limit 1;
  if ben.id is null then raise exception 'not a beneficiary'; end if;
  -- Une correspondance INSEE en attente reçoit l'acte ; sinon une nouvelle procédure est ouverte.
  update procedures set acte_path = certificate_path, acte_by = ben.id
   where procedures.owner_id = owner and kind = 'deces' and procedure_status(procedures) = 'verification' and acte_path is null
  returning procedures.id into id;
  if id is null then
    insert into procedures (owner_id, kind, source, declared_by, declared_by_user, needs_verification, acte_path, acte_by)
    values (owner, 'deces', 'beneficiaire', ben.first_name || ' ' || ben.last_name, auth.uid(), true, certificate_path, ben.id)
    returning procedures.id into id;
  end if;
  return id;
end $$;

create or replace function public.declare_procedure(owner uuid, kind text, note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare id uuid;
begin
  if not is_guarantor_of(owner) then raise exception 'not a guarantor'; end if;
  insert into procedures (owner_id, kind, source, declared_by, declared_by_user, needs_verification, ends_at, note)
  select owner, kind, 'garant', p.first_name || ' ' || p.last_name, auth.uid(), kind = 'deces',
         case when kind = 'coup_dur' then now() + interval '48 hours' end, note
  from people p where p.owner_id = owner and p.user_id = auth.uid() limit 1
  returning procedures.id into id;
  return id;
end $$;

-- Annuler ou clore ne peut que fermer des accès : sans risque, même fait par un enfant mandaté.
create or replace function public.cancel_procedure(proc uuid)
returns void language sql security definer set search_path = public as $$
  update procedures set cancelled_at = now() where id = proc and acts_for(owner_id) and procedure_status(procedures) in ('verification', 'delai')
$$;

create or replace function public.close_procedure(proc uuid)
returns void language sql security definer set search_path = public as $$
  update procedures set closed_at = now() where id = proc and acts_for(owner_id) and kind = 'coup_dur' and procedure_status(procedures) = 'active'
$$;

-- ---------- RLS ----------

alter table public.profiles enable row level security;
alter table public.people enable row level security;
alter table public.guarantors enable row level security;
alter table public.cards enable row level security;
alter table public.rights enable row level security;
alter table public.procedures enable row level security;
alter table public.reminders enable row level security;
alter table public.checklist enable row level security;
alter table public.concierge_cases enable row level security;
alter table public.email_log enable row level security;
alter table public.staff enable row level security;
alter table public.vaults enable row level security;
alter table public.vault_items enable row level security;
alter table public.envelopes enable row level security;
alter table public.concierge_shares enable row level security;
alter table public.app_settings enable row level security;
create policy read on public.app_settings for select using (true);
create policy admin on public.app_settings for update using (is_staff('admin'));

-- Espace : le titulaire (ou l'enfant mandaté) gère tout ; l'équipe lit.
create policy own on public.profiles for all using (acts_for(id)) with check (acts_for(id));
create policy staff_read on public.profiles for select using (is_staff());
create policy own on public.people for all using (acts_for(owner_id)) with check (acts_for(owner_id));
create policy me on public.people for select using (user_id = auth.uid());
create policy own on public.guarantors for all using (acts_for(owner_id)) with check (acts_for(owner_id));
create policy own on public.cards for all using (acts_for(owner_id)) with check (acts_for(owner_id));
create policy holder on public.cards for select using (my_card(id));
create policy own on public.rights for all using (acts_for((select owner_id from people where id = person_id)));
create policy own_read on public.procedures for select using (acts_for(owner_id) or is_guarantor_of(owner_id));
-- Pas d'UPDATE direct pour le titulaire : il annule ou clôt via cancel_procedure / close_procedure, rien d'autre.
create policy staff on public.procedures for all using (is_staff('verification'));
create policy own on public.reminders for all using (acts_for(owner_id)) with check (acts_for(owner_id));
create policy own on public.checklist for all using (acts_for(owner_id)) with check (acts_for(owner_id));
create policy own on public.concierge_cases for all using (acts_for(owner_id)) with check (acts_for(owner_id));
create policy staff on public.concierge_cases for all using (is_staff('conciergerie'));
create policy staff on public.email_log for select using (is_staff());
create policy self on public.staff for select using (user_id = auth.uid());

-- Coffre : le titulaire seul écrit. Aucune politique pour l'équipe : l'éditeur ne lit pas le Coffre.
create policy own on public.vaults for all using (acts_for(owner_id)) with check (acts_for(owner_id));
-- Phase découverte : aucun document ne peut être écrit tant que app_settings.launched est faux (lecture et suppression restent permises).
create policy own_read on public.vault_items for select using (acts_for(owner_id));
create policy own_delete on public.vault_items for delete using (acts_for(owner_id));
create policy own_write on public.vault_items for insert with check (acts_for(owner_id) and is_launched());
create policy own_update on public.vault_items for update using (acts_for(owner_id)) with check (acts_for(owner_id) and is_launched());
create policy own on public.envelopes for all using (acts_for(owner_id)) with check (acts_for(owner_id));
-- Un proche ne reçoit ses enveloppes, et les éléments qu'elles ouvrent, qu'au moment prévu.
create policy holder on public.envelopes for select using (my_card(card_id) and is_released(owner_id, moment));
create policy holder on public.vault_items for select using (
  exists (select 1 from envelopes e where e.owner_id = vault_items.owner_id and e.subsection_id = vault_items.subsection_id
          and my_card(e.card_id) and is_released(e.owner_id, e.moment))
);
create policy own on public.concierge_shares for all using (acts_for((select owner_id from concierge_cases where id = case_id)));
create policy staff on public.concierge_shares for select using (is_staff('conciergerie'));

-- Fichiers chiffrés : bucket privé "coffre", chemin = <owner_id>/<subsection_id>/<file_id>.
insert into storage.buckets (id, name, public) values ('coffre', 'coffre', false) on conflict do nothing;
create policy coffre_own on storage.objects for all using (bucket_id = 'coffre' and acts_for(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'coffre' and acts_for(((storage.foldername(name))[1])::uuid) and is_launched());

-- Actes de décès déposés par les bénéficiaires : bucket privé "verification", lu seulement par l'équipe de vérification.
insert into storage.buckets (id, name, public) values ('verification', 'verification', false) on conflict do nothing;
create policy verification_upload on storage.objects for insert with check (bucket_id = 'verification' and auth.uid() is not null);
create policy verification_staff on storage.objects for select using (bucket_id = 'verification' and is_staff('verification'));
create policy coffre_holder on storage.objects for select using (
  bucket_id = 'coffre' and exists (
    select 1 from envelopes e where e.owner_id = ((storage.foldername(name))[1])::uuid and e.subsection_id = (storage.foldername(name))[2]
      and my_card(e.card_id) and is_released(e.owner_id, e.moment)
  )
);
