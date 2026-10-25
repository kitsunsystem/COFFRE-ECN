-- Schéma de production. Hébergement : Supabase en région UE, sur une infrastructure certifiée HDS (Supabase auto-hébergé
-- chez OVHcloud HDS, voir deploy/README.md). Deux mondes :
--   * l'Espace (profils, proches, cartes, procédures…) : en clair, lisible par l'équipe ;
--   * le Coffre (vaults, vault_items, envelopes, bucket "coffre") : uniquement du chiffré, illisible pour l'équipe.
-- Les règles d'ouverture reprennent src/lib/rules.ts : à modifier aux deux endroits.
-- Principe : le client ne fait que des lectures et des écritures simples sur SES données ; tout ce qui a une
-- conséquence (cartes, procédures, mandat, facturation, KYC) passe par une fonction qui vérifie les règles.

create extension if not exists pgcrypto;

-- ---------- Réglages (une seule ligne) ----------

create table public.app_settings (
  id boolean primary key default true check (id),
  -- Lancement en deux temps : tant que launched = false (phase découverte), aucun document ne peut être stocké.
  launched boolean not null default false,
  planned_launch date,
  coup_dur_delay interval not null default interval '48 hours', -- à décider
  death_delay interval not null default interval '15 days', -- délai d'annulation après vérification : à décider
  post_death_access interval not null default interval '180 days', -- 4, 6 ou 12 mois : à décider
  grace_period interval not null default interval '30 days', -- impayé : à décider
  owner_cards integer not null default 3,
  pack_cards integer not null default 2,
  concierge_public_key text -- clé publique de la conciergerie partenaire (les éléments confiés sont scellés vers elle)
);
insert into public.app_settings default values;

-- ---------- Espace ----------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  first_name text not null check (length(first_name) between 1 and 80),
  last_name text not null check (length(last_name) between 1 and 80),
  email text not null,
  phone text check (length(phone) <= 30),
  birth_date date not null check (birth_date > date '1900-01-01' and birth_date < current_date),
  birth_city text check (length(birth_city) <= 120),
  birth_country text check (length(birth_country) <= 80),
  address text check (length(address) <= 400),
  situation text check (length(situation) <= 40),
  is_business_owner boolean not null default false,
  kyc text not null default 'a_faire' check (kyc in ('a_faire', 'en_cours', 'verifie', 'refuse')),
  kyc_ref text, -- référence du dossier dans le système KYC du groupe
  kyc_doc_path text, -- vérification manuelle : pièce d'identité déposée dans le bucket privé "kyc"
  assistant_voice boolean not null default true,
  reminder_consent boolean not null default false, -- accord pour enregistrer type et date des échéances
  billing_status text not null default 'a_jour' check (billing_status in ('a_jour', 'impaye', 'efface')),
  billing_since timestamptz, -- début de l'impayé : relances pendant le délai de grâce, puis effacement
  stripe_customer_id text unique,
  subscription_status text,
  created_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  user_id uuid references auth.users on delete set null, -- rempli quand le proche se connecte avec l'adresse indiquée
  first_name text not null check (length(first_name) between 1 and 80),
  last_name text not null check (length(last_name) between 1 and 80),
  relation text not null check (length(relation) <= 40),
  email text check (email is null or email = '' or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (length(phone) <= 30),
  manages_me boolean not null default false, -- enfant qui gère le compte du parent (procuration vérifiée par l'équipe)
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);
create index on public.people (owner_id);
create index on public.people (user_id);
create index on public.people (lower(email));

create table public.guarantors (
  owner_id uuid not null references public.profiles on delete cascade,
  person_id uuid not null,
  role text not null check (length(role) between 1 and 400),
  primary key (owner_id, person_id),
  foreign key (person_id, owner_id) references public.people (id, owner_id) on delete cascade
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  holder_person_id uuid, -- null = carte du titulaire
  printed_name text not null,
  status text not null default 'commandee' check (status in ('commandee', 'en_route', 'recue', 'active', 'perdue')),
  extra boolean not null default false, -- au-delà des cartes incluses (payant)
  kind text check (kind in ('fido', 'tangem', 'demo')), -- technologie de la carte, connue à l'activation
  chip_id text unique, -- identifiant de la puce (identifiant FIDO2 ou clé publique Tangem) : une carte physique, un seul usage
  wrapped_vmk jsonb, -- cartes du titulaire : clé du Coffre chiffrée par la carte (+ code)
  box_pk text, -- cartes des proches : clé publique vers laquelle les enveloppes sont scellées
  salt text,
  ordered_at timestamptz not null default now(),
  shipped_at timestamptz,
  activated_at timestamptz,
  lost_at timestamptz,
  -- Retirer un proche supprime ses cartes et leurs enveloppes : elles n'ouvrent plus rien, tout de suite.
  foreign key (holder_person_id, owner_id) references public.people (id, owner_id) on delete cascade
);
create index on public.cards (owner_id);
create index on public.cards (holder_person_id);

-- Droits : par bénéficiaire, valables pour les 2 cartes de son pack (le secret, lui, est dans les enveloppes, par carte).
-- now = Urgence (tout de suite, à tout moment), coup_dur, deces, jamais. « À effacer » (prive) n'est jamais attribuable.
create table public.rights (
  person_id uuid not null,
  owner_id uuid not null references public.profiles on delete cascade,
  subsection_id text not null check (subsection_id ~ '^[a-z-]{2,40}$' and subsection_id <> 'prive'),
  moment text not null check (moment in ('now', 'coup_dur', 'deces', 'jamais')),
  primary key (person_id, subsection_id),
  foreign key (person_id, owner_id) references public.people (id, owner_id) on delete cascade
);
create index on public.rights (owner_id);

create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('coup_dur', 'deces')),
  source text not null check (source in ('garant', 'insee', 'beneficiaire')),
  declared_by text not null,
  declared_by_user uuid references auth.users on delete set null,
  declared_at timestamptz not null default now(),
  needs_verification boolean not null,
  verified_at timestamptz,
  verified_by uuid references auth.users on delete set null,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  ends_at timestamptz,
  closed_at timestamptz,
  finalized_at timestamptz,
  alerted_at timestamptz, -- alerte envoyée au titulaire à l'ouverture du délai
  last_call_at timestamptz, -- dernière alerte, 24 h avant la fin du délai
  erased_at timestamptz, -- décès : Coffre effacé à la fin de la période d'accès des bénéficiaires
  end_warned_at timestamptz, -- bénéficiaires prévenus de la fin prochaine de l'accès
  note text check (length(note) <= 1000),
  match jsonb,
  -- Concordance du décès : acte fourni par un bénéficiaire (bucket privé "verification"), identité vérifiée par l'équipe.
  acte_path text,
  acte_id_path text, -- pièce d'identité du bénéficiaire qui dépose l'acte
  acte_by uuid references public.people on delete set null,
  acte_at timestamptz,
  acte_id_checked boolean not null default false,
  -- Pas de notaire par défaut : un décès ne peut être confirmé qu'avec l'acte et l'identité du bénéficiaire vérifiée.
  constraint death_needs_certificate check (kind <> 'deces' or verified_at is null or (acte_path is not null and acte_id_checked))
);
create index on public.procedures (owner_id);

-- Échéances saisies dans l'Espace, avec l'accord de la personne : type de document et date de fin, jamais le contenu du Coffre.
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  label text not null check (length(label) between 1 and 120),
  date date not null,
  sent_30 boolean not null default false,
  sent_7 boolean not null default false
);
create index on public.reminders (owner_id);

create table public.checklist (
  owner_id uuid not null references public.profiles on delete cascade,
  key text not null check (length(key) <= 200),
  done boolean not null default true,
  primary key (owner_id, key)
);

create table public.concierge_cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  kind text not null check (length(kind) <= 120),
  partner text not null,
  status text not null default 'demande' check (status in ('demande', 'mandat_signe', 'en_cours', 'termine')),
  mandate_name text,
  mandate_signed_at timestamptz,
  message text check (length(message) <= 2000),
  created_at timestamptz not null default now()
);
create index on public.concierge_cases (owner_id);

-- File d'attente des e-mails : alimentée par les triggers et les fonctions, vidée par la fonction "mailer" (Brevo).
-- Jamais lisible par les utilisateurs ; jamais de contenu du Coffre dedans.
create table public.outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  to_name text,
  template text not null,
  data jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'error')),
  attempts integer not null default 0,
  last_error text,
  provider_id text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz
);
create index on public.outbox (status, created_at);

create table public.staff (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('admin', 'verification', 'conciergerie', 'logistique'))
);

-- Journal des actions sensibles (append-only) : déclarations, vérifications, cartes, actions de l'équipe.
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid default auth.uid(),
  owner_id uuid,
  action text not null,
  detail jsonb not null default '{}'
);
create index on public.audit_log (owner_id, at);

-- ---------- Coffre (chiffré uniquement) ----------

create table public.vaults (
  owner_id uuid primary key references public.profiles on delete cascade,
  salt text not null,
  ssk jsonb not null -- clés de sous-rubriques, chiffrées par la clé du Coffre
);

create table public.vault_items (
  id uuid primary key,
  owner_id uuid not null references public.profiles on delete cascade,
  subsection_id text not null check (subsection_id ~ '^[a-z-]{2,40}$'),
  data jsonb not null check (data ? 'n' and data ? 'c' and length(data ->> 'c') < 2000000), -- { n, c } chiffré
  file_ids text[] not null default '{}' check (cardinality(file_ids) <= 20),
  updated_at timestamptz not null default now()
);
create index on public.vault_items (owner_id, subsection_id);

create table public.envelopes (
  card_id uuid not null references public.cards on delete cascade,
  owner_id uuid not null references public.profiles on delete cascade,
  subsection_id text not null check (subsection_id <> 'prive'),
  moment text not null check (moment in ('now', 'coup_dur', 'deces')),
  sealed text not null check (length(sealed) < 1000), -- clé de sous-rubrique scellée vers la carte du proche
  primary key (card_id, subsection_id)
);
create index on public.envelopes (owner_id);

create table public.concierge_shares (
  case_id uuid not null references public.concierge_cases on delete cascade,
  item_id uuid not null,
  sealed text not null check (length(sealed) < 2000000), -- scellé vers la clé de la conciergerie
  primary key (case_id, item_id)
);

-- ---------- Règles d'ouverture (miroir de src/lib/rules.ts) ----------

create or replace function public.settings()
returns public.app_settings language sql stable security definer set search_path = public as $$
  select * from app_settings limit 1
$$;

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
    when 'deces' then exists (select 1 from procedures p where p.owner_id = owner and p.kind = 'deces' and p.erased_at is null and procedure_status(p) = 'terminee')
    else exists (
      select 1 from procedures p where p.owner_id = owner and p.erased_at is null
        and ((p.kind = 'deces' and procedure_status(p) = 'terminee') or (p.kind = 'coup_dur' and procedure_status(p) = 'active'))
    )
  end
$$;

create or replace function public.is_staff(r text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff s where s.user_id = auth.uid() and (r is null or s.role = r or s.role = 'admin'))
$$;

-- Le compte « géré » : un enfant avec procuration (vérifiée par l'équipe) agit comme le titulaire.
create or replace function public.acts_for(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select owner = auth.uid() or exists (select 1 from people p where p.owner_id = owner and p.user_id = auth.uid() and p.manages_me)
$$;

create or replace function public.is_guarantor_of(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from guarantors g join people p on p.id = g.person_id where g.owner_id = owner and p.user_id = auth.uid())
$$;

create or replace function public.is_beneficiary_of(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cards c join people p on p.id = c.holder_person_id where c.owner_id = owner and p.user_id = auth.uid() and c.status <> 'perdue')
$$;

-- Carte d'un proche appartenant à l'utilisateur connecté (toutes, pour l'activation) et carte active (pour ouvrir).
create or replace function public.holds_card(card uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cards c join people p on p.id = c.holder_person_id where c.id = card and p.user_id = auth.uid())
$$;

create or replace function public.my_card(card uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cards c join people p on p.id = c.holder_person_id where c.id = card and p.user_id = auth.uid() and c.status = 'active')
$$;

create or replace function public.access_end(p public.procedures)
returns timestamptz language sql stable as $$
  select case when p.kind = 'deces' and p.ends_at is not null then p.ends_at + (select post_death_access from app_settings) end
$$;

create or replace function public.grace_end(p public.profiles)
returns timestamptz language sql stable as $$
  select p.billing_since + (select grace_period from app_settings)
$$;

create or replace function public.is_launched()
returns boolean language sql stable security definer set search_path = public as $$
  select launched from app_settings
$$;

-- Premier dossier d'un chemin de fichier, en uuid (null si ce n'en est pas un) : les politiques ne doivent jamais planter.
create or replace function public.path_owner(name text)
returns uuid language plpgsql immutable as $$
begin
  return (storage.foldername(name))[1]::uuid;
exception when others then
  return null;
end $$;

-- ---------- E-mails et journal ----------

create or replace function public.enqueue_email(to_email text, to_name text, template text, data jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into outbox (to_email, to_name, template, data) select to_email, to_name, template, data where coalesce(to_email, '') <> ''
$$;

create or replace function public.audit(owner uuid, action text, detail jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into audit_log (owner_id, action, detail) values (owner, action, detail)
$$;

create or replace function public.owner_name(owner uuid)
returns text language sql stable security definer set search_path = public as $$
  select first_name || ' ' || last_name from profiles where id = owner
$$;

-- Le mailer prend les e-mails par lots, sans doublon même si deux exécutions se chevauchent.
create or replace function public.claim_outbox(n integer default 50)
returns setof public.outbox language sql security definer set search_path = public as $$
  update outbox set status = 'sending', attempts = attempts + 1, claimed_at = now()
   where id in (
     select id from outbox
      where status = 'pending' or (status = 'error' and attempts < 5) or (status = 'sending' and claimed_at < now() - interval '10 minutes')
      order by created_at limit n for update skip locked
   )
  returning *
$$;
revoke execute on function public.claim_outbox from public, anon, authenticated;

-- ---------- Profil ----------

-- L'adresse e-mail vient toujours du compte vérifié ; KYC et facturation ne se règlent jamais depuis l'application.
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.email := coalesce((select email from auth.users where id = new.id), new.email);
    if auth.uid() is not null then
      new.kyc := 'a_faire'; new.kyc_ref := null; new.billing_status := 'a_jour'; new.billing_since := null;
      new.stripe_customer_id := null; new.subscription_status := null;
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before insert on public.profiles for each row execute function public.profiles_guard();

create or replace function public.profiles_welcome()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform enqueue_email(new.email, new.first_name, 'bienvenue', jsonb_build_object('firstName', new.first_name));
  return new;
end $$;
create trigger profiles_welcome after insert on public.profiles for each row execute function public.profiles_welcome();

-- Changement d'adresse confirmé dans Supabase Auth : le profil suit.
create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then update profiles set email = new.email where id = new.id; end if;
  return new;
end $$;
create trigger sync_profile_email after update of email on auth.users for each row execute function public.sync_profile_email();

-- Vérification d'identité manuelle (en attendant le système KYC du groupe) : la pièce va dans le bucket privé "kyc".
create or replace function public.submit_kyc(doc_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if split_part(doc_path, '/', 1) <> auth.uid()::text then raise exception 'chemin invalide'; end if;
  update profiles set kyc_doc_path = doc_path, kyc = 'en_cours' where id = auth.uid() and kyc in ('a_faire', 'refuse');
end $$;

-- ---------- Proches ----------

-- Si l'adresse d'un proche change, le lien avec un compte est rompu : c'est l'adresse choisie par le titulaire qui fait foi.
create or replace function public.people_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and lower(coalesce(new.email, '')) is distinct from lower(coalesce(old.email, '')) then new.user_id := null; end if;
  if tg_op = 'INSERT' and auth.uid() is not null then new.user_id := null; new.manages_me := false; end if;
  return new;
end $$;
create trigger people_guard before insert or update on public.people for each row execute function public.people_guard();

-- À la connexion d'un proche : ses fiches (désignées par l'adresse qu'il vient de vérifier) sont rattachées à son compte.
create or replace function public.claim_invitations()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update people set user_id = auth.uid()
   where user_id is null and email <> '' and owner_id <> auth.uid()
     and lower(email) = (select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null);
  get diagnostics n = row_count;
  return n;
end $$;

-- Ce que l'utilisateur connecté est pour les autres : garant, bénéficiaire (avec ses cartes).
create or replace function public.my_trusts()
returns table (owner_id uuid, owner_name text, person_id uuid, guarantor_role text, cards jsonb, procedures jsonb)
language sql stable security definer set search_path = public as $$
  select p.owner_id, owner_name(p.owner_id), p.id,
    (select g.role from guarantors g where g.person_id = p.id),
    coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'printed_name', c.printed_name, 'status', c.status, 'kind', c.kind,
      'chip_id', c.chip_id, 'box_pk', c.box_pk, 'salt', c.salt, 'ordered_at', c.ordered_at, 'activated_at', c.activated_at) order by c.ordered_at)
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

-- ---------- Cartes : commandes, activation, perte ----------

create or replace function public.order_owner_cards()
returns setof public.cards language plpgsql security definer set search_path = public as $$
declare o profiles; s app_settings := settings();
begin
  select * into o from profiles where id = auth.uid();
  if o.id is null then raise exception 'profil manquant'; end if;
  if exists (select 1 from cards where owner_id = o.id and holder_person_id is null) then raise exception 'cartes déjà commandées'; end if;
  perform enqueue_email(o.email, o.first_name, 'cartes-commandees', jsonb_build_object('count', s.owner_cards::text));
  perform audit(o.id, 'cartes.commande', jsonb_build_object('count', s.owner_cards));
  return query insert into cards (owner_id, printed_name)
    select o.id, o.first_name || ' ' || o.last_name from generate_series(1, s.owner_cards) returning *;
end $$;

create or replace function public.order_pack(person uuid)
returns setof public.cards language plpgsql security definer set search_path = public as $$
declare p people; s app_settings := settings();
begin
  select * into p from people where id = person and owner_id = auth.uid();
  if p.id is null then raise exception 'proche inconnu'; end if;
  if exists (select 1 from cards where holder_person_id = p.id and status <> 'perdue') then raise exception 'pack déjà commandé'; end if;
  perform enqueue_email(p.email, p.first_name, 'invitation-porteur', jsonb_build_object('ownerName', owner_name(p.owner_id)));
  perform audit(p.owner_id, 'cartes.pack', jsonb_build_object('person', p.id));
  return query insert into cards (owner_id, holder_person_id, printed_name, extra)
    select p.owner_id, p.id, p.first_name || ' ' || p.last_name, true from generate_series(1, s.pack_cards) returning *;
end $$;

-- Remplacement d'une carte perdue, du vivant du titulaire uniquement.
create or replace function public.order_replacement(lost uuid)
returns public.cards language plpgsql security definer set search_path = public as $$
declare c cards; r cards;
begin
  select * into c from cards where id = lost and owner_id = auth.uid() and status = 'perdue';
  if c.id is null then raise exception 'carte inconnue ou encore active'; end if;
  if c.holder_person_id is not null and not exists (select 1 from people where id = c.holder_person_id) then raise exception 'proche retiré'; end if;
  insert into cards (owner_id, holder_person_id, printed_name, extra) values (c.owner_id, c.holder_person_id, c.printed_name, true) returning * into r;
  perform audit(c.owner_id, 'carte.remplacement', jsonb_build_object('lost', c.id, 'new', r.id));
  return r;
end $$;

create or replace function public.activate_owner_card(card uuid, card_kind text, chip text, vmk jsonb)
returns public.cards language plpgsql security definer set search_path = public as $$
declare r cards;
begin
  update cards set status = 'active', kind = card_kind, chip_id = chip, wrapped_vmk = vmk, activated_at = now()
   where id = card and acts_for(owner_id) and holder_person_id is null and status in ('commandee', 'en_route', 'recue')
   returning * into r;
  if r.id is null then raise exception 'carte non activable'; end if;
  perform audit(r.owner_id, 'carte.activation', jsonb_build_object('card', r.id, 'kind', card_kind));
  return r;
end $$;

-- Le pack d'un bénéficiaire s'active avec lui : depuis le téléphone du titulaire ou depuis son propre compte.
create or replace function public.activate_holder_card(card uuid, card_kind text, chip text, pk text, card_salt text)
returns public.cards language plpgsql security definer set search_path = public as $$
declare r cards;
begin
  update cards set status = 'active', kind = card_kind, chip_id = chip, box_pk = pk, salt = card_salt, activated_at = now()
   where id = card and holder_person_id is not null and (acts_for(owner_id) or holds_card(id)) and status in ('commandee', 'en_route', 'recue')
   returning * into r;
  if r.id is null then raise exception 'carte non activable'; end if;
  perform audit(r.owner_id, 'carte.activation', jsonb_build_object('card', r.id, 'kind', card_kind, 'holder', r.holder_person_id));
  return r;
end $$;

-- Une carte perdue n'ouvre plus rien, tout de suite : ses enveloppes sont détruites.
create or replace function public.declare_card_lost(card uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r cards;
begin
  update cards set status = 'perdue', wrapped_vmk = null, box_pk = null, lost_at = now()
   where id = card and (acts_for(owner_id) or holds_card(id)) and status <> 'perdue' returning * into r;
  if r.id is null then raise exception 'carte inconnue'; end if;
  delete from envelopes where card_id = r.id;
  perform audit(r.owner_id, 'carte.perdue', jsonb_build_object('card', r.id));
end $$;

-- Logistique : expédition et réception des cartes.
create or replace function public.staff_card_status(card uuid, new_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff('logistique') then raise exception 'interdit'; end if;
  if new_status not in ('en_route', 'recue') then raise exception 'statut invalide'; end if;
  update cards set status = new_status, shipped_at = case when new_status = 'en_route' then now() else shipped_at end
   where id = card and status in ('commandee', 'en_route');
end $$;

-- ---------- Garants : e-mail d'invitation ----------

create or replace function public.guarantors_invite()
returns trigger language plpgsql security definer set search_path = public as $$
declare p people;
begin
  select * into p from people where id = new.person_id;
  perform enqueue_email(p.email, p.first_name, 'invitation-garant', jsonb_build_object('ownerName', owner_name(new.owner_id), 'role', new.role));
  return new;
end $$;
create trigger guarantors_invite after insert on public.guarantors for each row execute function public.guarantors_invite();

-- ---------- Procédures ----------

-- Un garant déclare ; il ne peut ni vérifier, ni raccourcir le délai.
create or replace function public.declare_procedure(owner uuid, proc_kind text, proc_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare id uuid; g people; s app_settings := settings();
begin
  select p.* into g from people p join guarantors gu on gu.person_id = p.id where p.owner_id = owner and p.user_id = auth.uid() limit 1;
  if g.id is null then raise exception 'pas garant'; end if;
  if proc_kind not in ('coup_dur', 'deces') then raise exception 'type invalide'; end if;
  if exists (select 1 from procedures p where p.owner_id = owner and p.kind = proc_kind and procedure_status(p) in ('verification', 'delai', 'active')) then
    raise exception 'déjà signalé';
  end if;
  insert into procedures (owner_id, kind, source, declared_by, declared_by_user, needs_verification, ends_at, note)
  values (owner, proc_kind, 'garant', g.first_name || ' ' || g.last_name, auth.uid(), proc_kind = 'deces',
          case when proc_kind = 'coup_dur' then now() + s.coup_dur_delay end, left(proc_note, 1000))
  returning procedures.id into id;
  perform audit(owner, 'procedure.declaration', jsonb_build_object('procedure', id, 'kind', proc_kind));
  return id;
end $$;

-- Un bénéficiaire (porteur d'une carte) déclare un décès avec l'acte et sa pièce d'identité ; l'équipe vérifie la concordance.
create or replace function public.declare_death_with_certificate(owner uuid, certificate_path text, id_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare id uuid; ben people;
begin
  select p.* into ben from people p join cards c on c.holder_person_id = p.id
   where p.owner_id = owner and p.user_id = auth.uid() and c.status <> 'perdue' limit 1;
  if ben.id is null then raise exception 'pas bénéficiaire'; end if;
  if split_part(certificate_path, '/', 1) <> auth.uid()::text or split_part(id_path, '/', 1) <> auth.uid()::text then raise exception 'chemin invalide'; end if;
  -- Une correspondance INSEE (ou un signalement de garant) en attente reçoit l'acte ; sinon une nouvelle procédure est ouverte.
  update procedures set acte_path = certificate_path, acte_id_path = id_path, acte_by = ben.id, acte_at = now()
   where procedures.owner_id = owner and kind = 'deces' and procedure_status(procedures) = 'verification' and acte_path is null
  returning procedures.id into id;
  if id is null then
    if exists (select 1 from procedures p where p.owner_id = owner and p.kind = 'deces' and procedure_status(p) in ('verification', 'delai', 'terminee') and p.erased_at is null) then
      raise exception 'procédure déjà en cours';
    end if;
    insert into procedures (owner_id, kind, source, declared_by, declared_by_user, needs_verification, acte_path, acte_id_path, acte_by, acte_at)
    values (owner, 'deces', 'beneficiaire', ben.first_name || ' ' || ben.last_name, auth.uid(), true, certificate_path, id_path, ben.id, now())
    returning procedures.id into id;
  end if;
  perform audit(owner, 'procedure.acte', jsonb_build_object('procedure', id, 'by', ben.id));
  return id;
end $$;

-- Annuler ou clore ne peut que fermer des accès : sans risque, même fait par un enfant mandaté.
create or replace function public.cancel_procedure(proc uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  update procedures set cancelled_at = now() where id = proc and acts_for(owner_id) and procedure_status(procedures) in ('verification', 'delai')
  returning owner_id into o;
  if o is null then raise exception 'procédure non annulable'; end if;
  perform audit(o, 'procedure.annulation', jsonb_build_object('procedure', proc));
end $$;

create or replace function public.close_procedure(proc uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  update procedures set closed_at = now() where id = proc and acts_for(owner_id) and kind = 'coup_dur' and procedure_status(procedures) = 'active'
  returning owner_id into o;
  if o is null then raise exception 'procédure non clôturable'; end if;
  perform audit(o, 'procedure.cloture', jsonb_build_object('procedure', proc));
end $$;

-- Coup dur déclaré : le titulaire est prévenu tout de suite (puis par procedures-tick, 24 h avant la fin).
create or replace function public.procedures_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare o profiles;
begin
  select * into o from profiles where id = new.owner_id;
  if new.kind = 'coup_dur' and new.ends_at is not null then
    perform enqueue_email(o.email, o.first_name, 'coup-dur-declare', jsonb_build_object('declaredBy', new.declared_by,
      'endsAt', to_char(new.ends_at at time zone 'Europe/Paris', 'DD/MM/YYYY à HH24:MI')));
    new.alerted_at := now();
  end if;
  return new;
end $$;
create trigger procedures_notify before insert on public.procedures for each row execute function public.procedures_notify();

-- ---------- Équipe de vérification ----------

create or replace function public.staff_check_identity(proc uuid, ok boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff('verification') then raise exception 'interdit'; end if;
  update procedures set acte_id_checked = ok where id = proc and acte_path is not null and procedure_status(procedures) = 'verification';
  perform audit((select owner_id from procedures where id = proc), 'verification.identite', jsonb_build_object('procedure', proc, 'ok', ok));
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
  perform enqueue_email(o.email, o.first_name, 'deces-delai', jsonb_build_object('endsAt', to_char(p.ends_at at time zone 'Europe/Paris', 'DD/MM/YYYY à HH24:MI')));
  perform audit(p.owner_id, 'verification.deces_confirme', jsonb_build_object('procedure', proc));
end $$;

create or replace function public.staff_reject_procedure(proc uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff('verification') then raise exception 'interdit'; end if;
  update procedures set rejected_at = now() where id = proc and procedure_status(procedures) = 'verification';
  perform audit((select owner_id from procedures where id = proc), 'verification.rejet', jsonb_build_object('procedure', proc));
end $$;

create or replace function public.staff_set_kyc(owner uuid, status text, ref text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff('verification') then raise exception 'interdit'; end if;
  if status not in ('verifie', 'refuse') then raise exception 'statut invalide'; end if;
  update profiles set kyc = status, kyc_ref = coalesce(ref, kyc_ref) where id = owner;
  perform audit(owner, 'verification.kyc', jsonb_build_object('status', status));
end $$;

create or replace function public.staff_set_launched(on_off boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff('admin') then raise exception 'interdit'; end if;
  update app_settings set launched = on_off where id; -- Supabase refuses an UPDATE without WHERE
  perform audit(null, 'admin.lancement', jsonb_build_object('launched', on_off));
end $$;

-- ---------- Conciergerie ----------

create or replace function public.sign_mandate(case_id uuid, signer text)
returns void language plpgsql security definer set search_path = public as $$
declare o profiles;
begin
  select pr.* into o from concierge_cases c join profiles pr on pr.id = c.owner_id where c.id = case_id and acts_for(c.owner_id);
  if o.id is null then raise exception 'demande inconnue'; end if;
  if lower(trim(signer)) <> lower(o.first_name || ' ' || o.last_name) then raise exception 'signature invalide'; end if;
  update concierge_cases set status = 'mandat_signe', mandate_name = trim(signer), mandate_signed_at = now() where id = case_id and status = 'demande';
  perform audit(o.id, 'conciergerie.mandat', jsonb_build_object('case', case_id));
end $$;

create or replace function public.staff_concierge_status(case_id uuid, new_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff('conciergerie') then raise exception 'interdit'; end if;
  if new_status not in ('en_cours', 'termine') then raise exception 'statut invalide'; end if;
  update concierge_cases set status = new_status where id = case_id and status in ('mandat_signe', 'en_cours');
end $$;

-- ---------- Coffre : rotation atomique d'une clé de sous-rubrique ----------

-- Quand quelqu'un perd un accès : nouvelle clé, éléments re-chiffrés et enveloppes refaites, tout ou rien.
create or replace function public.rotate_subsection(sub text, wrapped jsonb, items jsonb, envs jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare o uuid := auth.uid();
begin
  if not exists (select 1 from vaults where owner_id = o) then raise exception 'pas de Coffre'; end if;
  update vaults set ssk = jsonb_set(ssk, array[sub], wrapped) where owner_id = o;
  update vault_items v set data = i -> 'data', updated_at = now()
    from jsonb_array_elements(items) i where v.id = (i ->> 'id')::uuid and v.owner_id = o and v.subsection_id = sub;
  delete from envelopes where owner_id = o and subsection_id = sub;
  insert into envelopes (card_id, owner_id, subsection_id, moment, sealed)
    select (e ->> 'card_id')::uuid, o, sub, e ->> 'moment', e ->> 'sealed' from jsonb_array_elements(envs) e;
end $$;

-- Les enveloppes ne visent que des cartes actives de bénéficiaires du titulaire.
create or replace function public.envelopes_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from cards where id = new.card_id and owner_id = new.owner_id and holder_person_id is not null and status = 'active') then
    raise exception 'carte invalide';
  end if;
  return new;
end $$;
create trigger envelopes_guard before insert or update on public.envelopes for each row execute function public.envelopes_guard();

create or replace function public.reminders_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not (select reminder_consent from profiles where id = new.owner_id) then raise exception 'accord requis'; end if;
  return new;
end $$;
create trigger reminders_guard before insert on public.reminders for each row execute function public.reminders_guard();

-- ---------- Droits d'accès aux tables ----------
-- Tout est fermé par défaut ; on ouvre colonne par colonne ce que l'application peut écrire elle-même.

revoke all on all tables in schema public from anon, authenticated;
-- Supabase grants every new function to anon and authenticated by default: everything is revoked, then granted one by one.
revoke all on all functions in schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select on public.app_settings to anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, first_name, last_name, phone, birth_date, birth_city, birth_country, address, situation, is_business_owner, assistant_voice, reminder_consent)
  on public.profiles to authenticated;
grant update (phone, address, situation, is_business_owner, assistant_voice, reminder_consent) on public.profiles to authenticated;
grant select, delete on public.people to authenticated;
grant insert (id, owner_id, first_name, last_name, relation, email, phone) on public.people to authenticated;
grant update (first_name, last_name, relation, email, phone) on public.people to authenticated;
-- Upserts need UPDATE on every column they write: rows stay pinned to the owner by RLS and the composite foreign keys.
grant select, insert, update, delete on public.guarantors to authenticated;
grant select on public.cards to authenticated;
grant select, insert, update, delete on public.rights to authenticated;
grant select on public.procedures to authenticated;
grant select, insert, delete on public.reminders to authenticated;
grant update (label, date) on public.reminders to authenticated;
grant select, insert, update, delete on public.checklist to authenticated;
grant select on public.concierge_cases to authenticated;
grant insert (id, owner_id, kind, partner, message) on public.concierge_cases to authenticated;
grant select on public.staff to authenticated;
grant select on public.audit_log to authenticated;
grant select, insert on public.vaults to authenticated;
grant update (salt, ssk) on public.vaults to authenticated;
grant select, insert, update, delete on public.vault_items to authenticated;
grant select, insert, update, delete on public.envelopes to authenticated;
grant select, insert, delete on public.concierge_shares to authenticated;

grant execute on function public.settings, public.procedure_status, public.is_released, public.is_staff, public.acts_for, public.is_guarantor_of,
  public.is_beneficiary_of, public.holds_card, public.my_card, public.access_end, public.grace_end, public.is_launched,
  public.submit_kyc, public.claim_invitations, public.my_trusts, public.order_owner_cards, public.order_pack, public.order_replacement,
  public.activate_owner_card, public.activate_holder_card, public.declare_card_lost, public.staff_card_status, public.path_owner,
  public.declare_procedure, public.declare_death_with_certificate, public.cancel_procedure, public.close_procedure,
  public.staff_check_identity, public.staff_confirm_death, public.staff_reject_procedure, public.staff_set_kyc, public.staff_set_launched,
  public.sign_mandate, public.staff_concierge_status, public.rotate_subsection
  to authenticated;
-- Réservées au serveur (triggers et fonctions Edge, rôle service) : jamais appelables depuis l'application.
revoke execute on function public.enqueue_email, public.audit, public.owner_name from authenticated;

-- ---------- RLS ----------

alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.people enable row level security;
alter table public.guarantors enable row level security;
alter table public.cards enable row level security;
alter table public.rights enable row level security;
alter table public.procedures enable row level security;
alter table public.reminders enable row level security;
alter table public.checklist enable row level security;
alter table public.concierge_cases enable row level security;
alter table public.outbox enable row level security;
alter table public.staff enable row level security;
alter table public.audit_log enable row level security;
alter table public.vaults enable row level security;
alter table public.vault_items enable row level security;
alter table public.envelopes enable row level security;
alter table public.concierge_shares enable row level security;

create policy read on public.app_settings for select using (true);

-- Espace : le titulaire (ou l'enfant mandaté) gère ses données ; l'équipe lit.
create policy own on public.profiles for all using (acts_for(id)) with check (id = auth.uid());
create policy staff_read on public.profiles for select using (is_staff());
create policy own on public.people for all using (acts_for(owner_id)) with check (acts_for(owner_id));
create policy me on public.people for select using (user_id = auth.uid());
create policy staff_read on public.people for select using (is_staff());
create policy own on public.guarantors for all using (acts_for(owner_id)) with check (acts_for(owner_id));
create policy own on public.cards for select using (acts_for(owner_id));
create policy holder on public.cards for select using (holds_card(id));
create policy staff_read on public.cards for select using (is_staff());
create policy own on public.rights for all using (acts_for(owner_id)) with check (acts_for(owner_id));
create policy own_read on public.procedures for select using (acts_for(owner_id) or is_guarantor_of(owner_id) or is_beneficiary_of(owner_id));
create policy staff_read on public.procedures for select using (is_staff('verification'));
create policy own on public.reminders for all using (acts_for(owner_id)) with check (acts_for(owner_id));
create policy own on public.checklist for all using (acts_for(owner_id)) with check (acts_for(owner_id));
create policy own on public.concierge_cases for select using (acts_for(owner_id));
create policy own_insert on public.concierge_cases for insert with check (acts_for(owner_id));
create policy staff_read on public.concierge_cases for select using (is_staff('conciergerie'));
create policy self on public.staff for select using (user_id = auth.uid());
create policy staff_read on public.audit_log for select using (is_staff());
create policy own_read on public.audit_log for select using (owner_id is not null and acts_for(owner_id));

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
  subsection_id <> 'prive' and exists (
    select 1 from envelopes e where e.owner_id = vault_items.owner_id and e.subsection_id = vault_items.subsection_id
      and my_card(e.card_id) and is_released(e.owner_id, e.moment))
);
create policy own on public.concierge_shares for all
  using (acts_for((select owner_id from concierge_cases where id = case_id)))
  with check (exists (select 1 from concierge_cases c where c.id = case_id and acts_for(c.owner_id) and c.status in ('mandat_signe', 'en_cours')));
create policy staff_read on public.concierge_shares for select using (is_staff('conciergerie'));

-- ---------- Fichiers ----------

-- Fichiers chiffrés : bucket privé "coffre", chemin = <owner_id>/<subsection_id>/<file_id>.
insert into storage.buckets (id, name, public, file_size_limit) values ('coffre', 'coffre', false, 31457280) on conflict do nothing;
create policy coffre_own_read on storage.objects for select using (bucket_id = 'coffre' and acts_for(path_owner(name)));
create policy coffre_own_delete on storage.objects for delete using (bucket_id = 'coffre' and acts_for(path_owner(name)));
create policy coffre_own_write on storage.objects for insert
  with check (bucket_id = 'coffre' and acts_for(path_owner(name)) and is_launched());
create policy coffre_own_update on storage.objects for update using (bucket_id = 'coffre' and acts_for(path_owner(name)))
  with check (bucket_id = 'coffre' and acts_for(path_owner(name)) and is_launched());
create policy coffre_holder on storage.objects for select using (
  bucket_id = 'coffre' and (storage.foldername(name))[2] <> 'prive' and exists (
    select 1 from envelopes e where e.owner_id = path_owner(name) and e.subsection_id = (storage.foldername(name))[2]
      and my_card(e.card_id) and is_released(e.owner_id, e.moment))
);

-- Actes de décès et pièces d'identité des bénéficiaires : bucket privé "verification", chemin = <uid>/<fichier>,
-- déposés par leur auteur, lus seulement par l'équipe de vérification.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('verification', 'verification', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'])
  on conflict do nothing;
create policy verification_upload on storage.objects for insert
  with check (bucket_id = 'verification' and (storage.foldername(name))[1] = auth.uid()::text);
create policy verification_staff on storage.objects for select using (bucket_id = 'verification' and is_staff('verification'));

-- Vérification d'identité manuelle du titulaire : bucket privé "kyc", même principe.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('kyc', 'kyc', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'])
  on conflict do nothing;
create policy kyc_upload on storage.objects for insert with check (bucket_id = 'kyc' and (storage.foldername(name))[1] = auth.uid()::text);
create policy kyc_staff on storage.objects for select using (bucket_id = 'kyc' and is_staff('verification'));
