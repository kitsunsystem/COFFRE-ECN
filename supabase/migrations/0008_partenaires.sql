-- Programme partenaires et statistiques (document « Spécifications techniques & devis partenaire », novembre 2026).
--
-- 1. Un membre candidate ; l'équipe valide ou refuse. Un partenaire validé reçoit un code (lien de parrainage).
-- 2. Chaque partenaire répartit ses 25 % entre ses ventes directes (N1) et celles de ses filleuls (N2 = 25 - N1).
--    Une vente ne coûte jamais plus de 25 % : le parrain du vendeur prend d'abord son taux N2, le vendeur direct
--    reçoit son taux N1 dans la limite du reste. Seule la première vente d'un client est commissionnée.
-- 3. Retraits sur demande (virement SEPA ou crypto) : l'IBAN ou l'adresse n'est gardé que le temps du retrait.
-- 4. Statistiques de fréquentation anonymes : des compteurs par jour et des sessions sans nom, jamais une personne.

alter table public.staff drop constraint staff_role_check;
alter table public.staff add constraint staff_role_check check (role in ('admin', 'verification', 'conciergerie', 'logistique', 'finance'));

create table public.partners (
  user_id uuid primary key references public.profiles on delete cascade,
  status text not null default 'candidat' check (status in ('candidat', 'actif', 'refuse')),
  motivation text check (length(motivation) <= 2000),
  code text unique,
  n1 smallint not null default 25 check (n1 between 0 and 25), -- la part N2 est 25 - n1
  applied_at timestamptz not null default now(),
  decided_at timestamptz
);

-- Le partenaire dont le lien a amené ce membre : posé une seule fois, par set_referrer.
alter table public.profiles add column referred_by uuid references public.partners on delete set null;

create table public.partner_clicks (
  partner_id uuid not null references public.partners on delete cascade,
  day date not null default current_date,
  clicks integer not null default 0,
  primary key (partner_id, day)
);

-- Sans lien vers le profil du client : l'historique reste si le client supprime son compte.
create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners on delete cascade,
  customer uuid not null,
  level smallint not null check (level in (1, 2)),
  rate smallint not null check (rate between 0 and 25),
  sale_ref text not null,
  sale_cents integer not null check (sale_cents >= 0),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  unique (sale_ref, level)
);
create index on public.commissions (partner_id);
create index on public.commissions (customer);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'EUR',
  method text not null check (method in ('sepa', 'crypto')),
  destination text check (length(destination) <= 120), -- IBAN ou adresse : effacé à la clôture
  status text not null default 'demande' check (status in ('demande', 'validation', 'traitement', 'reussi', 'refuse')),
  reference text check (length(reference) <= 200), -- référence du virement ou de la transaction
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.payouts (partner_id);

create table public.telemetry_daily (
  day date not null default current_date,
  metric text not null check (metric in ('coffre_ouvert', 'coffre_secondes', 'carte_ok', 'carte_echec')),
  value bigint not null default 0,
  primary key (day, metric)
);
create table public.telemetry_presence (
  session uuid primary key, -- tiré au hasard par onglet : aucun lien avec la personne
  seen timestamptz not null default now()
);

-- ---------- Candidature et validation ----------

create or replace function public.apply_partner(why text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid()) then raise exception 'profil manquant'; end if;
  insert into partners (user_id, motivation) values (auth.uid(), left(why, 2000))
  on conflict (user_id) do update set motivation = excluded.motivation, status = 'candidat', applied_at = now(), decided_at = null
    where partners.status = 'refuse'; -- un membre refusé peut candidater de nouveau
  perform audit(auth.uid(), 'partenaire.candidature', '{}');
end $$;

create or replace function public.staff_partner_decision(partner uuid, ok boolean)
returns text language plpgsql security definer set search_path = public as $$
declare c text; pr profiles;
begin
  if not is_staff('admin') then raise exception 'interdit'; end if;
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)); -- code public, pas un secret
    exit when not exists (select 1 from partners where code = c);
  end loop;
  update partners set status = case when ok then 'actif' else 'refuse' end, code = case when ok then coalesce(code, c) else code end, decided_at = now()
   where user_id = partner and status = 'candidat'
   returning code into c;
  if not found then raise exception 'candidature inconnue'; end if;
  select * into pr from profiles where id = partner;
  perform enqueue_email(pr.email, pr.first_name, case when ok then 'partenaire-valide' else 'partenaire-refuse' end, case when ok then jsonb_build_object('code', c) else '{}' end);
  perform audit(partner, 'admin.partenaire', jsonb_build_object('ok', ok));
  return c;
end $$;

create or replace function public.set_partner_split(level1 integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if level1 is null or level1 not between 0 and 25 then raise exception 'répartition invalide'; end if;
  update partners set n1 = level1 where user_id = auth.uid() and status = 'actif';
  if not found then raise exception 'pas partenaire'; end if;
end $$;

-- ---------- Parrainage ----------

-- Un clic sur un lien (même sans compte). Un code inconnu ne fait rien.
create or replace function public.ref_click(ref_code text)
returns void language sql security definer set search_path = public as $$
  insert into partner_clicks (partner_id, clicks) select user_id, 1 from partners where code = upper(ref_code) and status = 'actif'
  on conflict (partner_id, day) do update set clicks = partner_clicks.clicks + 1;
$$;

-- À l'inscription : une seule fois, jamais soi-même, jamais après un premier paiement.
create or replace function public.set_referrer(ref_code text)
returns void language plpgsql security definer set search_path = public as $$
declare p uuid;
begin
  select user_id into p from partners where code = upper(ref_code) and status = 'actif';
  if p is null or p = auth.uid() then return; end if;
  update profiles set referred_by = p where id = auth.uid() and referred_by is null
    and not exists (select 1 from commissions where customer = auth.uid());
end $$;

-- Appelée par le webhook de paiement (rôle service) à chaque paiement réussi ; renvoie le taux total versé.
create or replace function public.record_sale(buyer uuid, sale text, cents integer, cur text default 'EUR')
returns integer language plpgsql security definer set search_path = public as $$
declare d partners; s partners; r1 integer := 0; r2 integer := 0;
begin
  if cents is null or cents <= 0 or exists (select 1 from commissions where customer = buyer) then return 0; end if; -- première vente seulement
  select pa.* into d from profiles pr join partners pa on pa.user_id = pr.referred_by where pr.id = buyer and pa.status = 'actif';
  if d.user_id is null then return 0; end if;
  select pa.* into s from profiles pr join partners pa on pa.user_id = pr.referred_by
   where pr.id = d.user_id and pa.status = 'actif' and pa.user_id <> buyer;
  if s.user_id is not null then r2 := 25 - s.n1; end if;
  r1 := least(d.n1, 25 - r2);
  insert into commissions (partner_id, customer, level, rate, sale_ref, sale_cents, amount_cents, currency)
  select d.user_id, buyer, 1, r1, sale, cents, cents * r1 / 100, cur where r1 > 0
  union all
  select s.user_id, buyer, 2, r2, sale, cents, cents * r2 / 100, cur where r2 > 0
  on conflict (sale_ref, level) do nothing;
  return r1 + r2;
end $$;

create or replace function public.partner_balance(p uuid)
returns integer language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(amount_cents) from commissions where partner_id = p), 0)
        - coalesce((select sum(amount_cents) from payouts where partner_id = p and status <> 'refuse'), 0))::integer
$$;

-- Le tableau de bord du partenaire : des totaux, jamais l'identité de ses clients.
create or replace function public.partner_dashboard()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'clicks', coalesce((select sum(clicks) from partner_clicks where partner_id = auth.uid()), 0),
    'signups', (select count(*) from profiles where referred_by = auth.uid()),
    'n1_sales', (select count(*) from commissions where partner_id = auth.uid() and level = 1),
    'n2_sales', (select count(*) from commissions where partner_id = auth.uid() and level = 2),
    'volume_cents', coalesce((select sum(sale_cents) from commissions where partner_id = auth.uid()), 0),
    'earned_cents', coalesce((select sum(amount_cents) from commissions where partner_id = auth.uid()), 0),
    'balance_cents', partner_balance(auth.uid()),
    'months', coalesce((select jsonb_agg(jsonb_build_object('month', m, 'cents', c) order by m) from (
      select to_char(created_at, 'YYYY-MM') m, sum(amount_cents) c from commissions where partner_id = auth.uid() group by 1) x), '[]'),
    'team', coalesce((select jsonb_agg(jsonb_build_object('name', pr.first_name || ' ' || left(pr.last_name, 1) || '.',
      'sales', (select count(*) from commissions c where c.partner_id = pa.user_id and c.level = 1)))
      from partners pa join profiles pr on pr.id = pa.user_id where pa.status = 'actif' and pr.referred_by = auth.uid()), '[]')
  )
$$;

-- ---------- Retraits ----------

create or replace function public.request_payout(cents integer, pay_method text, dest text)
returns uuid language plpgsql security definer set search_path = public as $$
declare id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('payout:' || auth.uid()::text)); -- deux demandes simultanées ne dépassent pas le solde
  if not exists (select 1 from partners where user_id = auth.uid() and status = 'actif') then raise exception 'pas partenaire'; end if;
  if pay_method not in ('sepa', 'crypto') then raise exception 'moyen de retrait invalide'; end if;
  if length(coalesce(trim(dest), '')) < 8 then raise exception 'IBAN ou adresse invalide'; end if;
  if cents is null or cents <= 0 or cents > partner_balance(auth.uid()) then raise exception 'solde insuffisant'; end if;
  if exists (select 1 from payouts where partner_id = auth.uid() and status in ('demande', 'validation', 'traitement')) then
    raise exception 'un retrait est déjà en cours';
  end if;
  insert into payouts (partner_id, amount_cents, method, destination) values (auth.uid(), cents, pay_method, left(trim(dest), 120))
  returning payouts.id into id;
  perform audit(auth.uid(), 'partenaire.retrait', jsonb_build_object('payout', id, 'cents', cents, 'method', pay_method));
  return id;
end $$;

-- Demandé → validation financière → traitement (virement ou transaction) → réussi ; refusable avant la fin.
create or replace function public.staff_payout_status(payout uuid, new_status text, ref text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p payouts; pr profiles;
begin
  if not is_staff('finance') then raise exception 'interdit'; end if;
  update payouts set status = new_status, reference = coalesce(left(ref, 200), reference), updated_at = now(),
    destination = case when new_status in ('reussi', 'refuse') then null else destination end
   where id = payout and ((status = 'demande' and new_status in ('validation', 'refuse'))
     or (status = 'validation' and new_status in ('traitement', 'refuse'))
     or (status = 'traitement' and new_status in ('reussi', 'refuse')))
   returning * into p;
  if p.id is null then raise exception 'étape invalide'; end if;
  if new_status in ('reussi', 'refuse') then
    select * into pr from profiles where id = p.partner_id;
    perform enqueue_email(pr.email, pr.first_name, 'retrait-' || new_status, jsonb_build_object('amount', to_char(p.amount_cents / 100.0, 'FM999999990.00'), 'currency', p.currency));
  end if;
  perform audit(p.partner_id, 'finance.retrait', jsonb_build_object('payout', payout, 'status', new_status));
end $$;

-- ---------- Statistiques anonymes ----------

create or replace function public.track(metric_name text, amount integer default 1)
returns void language sql security definer set search_path = public as $$
  insert into telemetry_daily (metric, value) select metric_name, least(greatest(coalesce(amount, 0), 0), 86400)
   where metric_name in ('coffre_ouvert', 'coffre_secondes', 'carte_ok', 'carte_echec')
  on conflict (day, metric) do update set value = telemetry_daily.value + excluded.value;
$$;

create or replace function public.ping(session_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into telemetry_presence (session) values (session_id) on conflict (session) do update set seen = now();
$$;

create or replace function public.staff_metrics()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare since date := current_date - 30;
begin
  if not is_staff('admin') then raise exception 'interdit'; end if;
  return jsonb_build_object(
    'active_sessions', (select count(*) from telemetry_presence where seen > now() - interval '5 minutes'),
    'openings', coalesce((select sum(value) from telemetry_daily where metric = 'coffre_ouvert' and day > since), 0),
    'seconds', coalesce((select sum(value) from telemetry_daily where metric = 'coffre_secondes' and day > since), 0),
    'card_ok', coalesce((select sum(value) from telemetry_daily where metric = 'carte_ok' and day > since), 0),
    'card_fail', coalesce((select sum(value) from telemetry_daily where metric = 'carte_echec' and day > since), 0),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'openings', value) order by day) from telemetry_daily where metric = 'coffre_ouvert' and day > since), '[]'),
    'owners', (select count(*) from profiles),
    'with_guarantors', (select count(distinct owner_id) from guarantors),
    'with_beneficiaries', (select count(distinct owner_id) from cards where holder_person_id is not null and kind is distinct from 'telephone'),
    'coup_dur', (select count(*) from procedures where kind = 'coup_dur' and declared_at > now() - interval '30 days'),
    'deces', (select count(*) from procedures where kind = 'deces' and declared_at > now() - interval '30 days'),
    'partners', (select count(*) from partners where status = 'actif'),
    'candidates', (select count(*) from partners where status = 'candidat'),
    'commissions_cents', coalesce((select sum(amount_cents) from commissions), 0),
    'payouts_pending', (select count(*) from payouts where status in ('demande', 'validation', 'traitement'))
  );
end $$;

-- ---------- Droits ----------

alter table public.partners enable row level security;
alter table public.partner_clicks enable row level security;
alter table public.commissions enable row level security;
alter table public.payouts enable row level security;
alter table public.telemetry_daily enable row level security;
alter table public.telemetry_presence enable row level security;

create policy own_read on public.partners for select using (user_id = auth.uid() or is_staff('finance'));
create policy staff_read on public.partner_clicks for select using (is_staff('admin'));
create policy staff_read on public.commissions for select using (is_staff('finance'));
create policy own_read on public.payouts for select using (partner_id = auth.uid() or is_staff('finance'));
create policy staff_read on public.telemetry_daily for select using (is_staff('admin'));
create policy staff_read on public.telemetry_presence for select using (is_staff('admin'));
grant select on public.partners, public.partner_clicks, public.commissions, public.payouts, public.telemetry_daily, public.telemetry_presence to authenticated;

revoke execute on function public.apply_partner, public.staff_partner_decision, public.set_partner_split, public.ref_click, public.set_referrer,
  public.record_sale, public.partner_balance, public.partner_dashboard, public.request_payout, public.staff_payout_status, public.track,
  public.ping, public.staff_metrics from public, anon, authenticated;
grant execute on function public.apply_partner, public.staff_partner_decision, public.set_partner_split, public.set_referrer,
  public.partner_dashboard, public.request_payout, public.staff_payout_status, public.track, public.ping, public.staff_metrics to authenticated;
grant execute on function public.ref_click to anon, authenticated;
