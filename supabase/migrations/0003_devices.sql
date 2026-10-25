-- Appareils de confiance. Le site web sur ordinateur ne lit pas les cartes : le Coffre s'y ouvre avec l'accord du
-- téléphone (application), carte posée et Face ID. Le téléphone scelle les clés ouvertes vers la clé publique de
-- l'ordinateur : elles ne font que transiter ici, chiffrées, et le serveur ne peut jamais les ouvrir.

create table public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 80),
  pk text not null check (length(pk) between 40 and 64), -- clé publique X25519 de l'ordinateur (base64)
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days', -- à revalider (code QR + carte) tous les 90 jours
  last_used_at timestamptz
);
create index on public.trusted_devices (user_id);

-- Une demande vit quelques minutes : appairage (code QR) ou ouverture (notification sur le téléphone).
create table public.device_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('pairing', 'open')),
  device_id uuid references public.trusted_devices on delete cascade,
  name text not null check (length(name) between 1 and 80),
  pk text not null check (length(pk) between 40 and 64),
  code smallint not null check (code between 10 and 99), -- affiché sur l'ordinateur, à retrouver sur le téléphone
  choices smallint[] not null, -- le bon nombre et deux leurres, mélangés
  status text not null default 'pending' check (status in ('pending', 'approved', 'refused', 'used')),
  sealed text check (length(sealed) < 4000), -- clés scellées vers l'ordinateur, effacées dès qu'il les a reprises
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index on public.device_requests (user_id, created_at);

-- Jetons de notification des téléphones (application iOS / Android).
create table public.push_tokens (
  token text primary key check (length(token) between 10 and 4096),
  user_id uuid not null references auth.users on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index on public.push_tokens (user_id);

-- Le bon nombre et deux leurres, dans le désordre : celui qui n'a pas l'ordinateur sous les yeux ne peut que deviner.
create or replace function public.number_choices(c smallint)
returns smallint[] language sql volatile as $$
  select array_agg(n order by random()) from (
    select c as n
    union all
    (select x::smallint from generate_series(10, 99) x where x <> c order by random() limit 2)
  ) t
$$;

-- L'ordinateur demande : appairage (sa clé publique, aussi montrée dans le code QR) ou ouverture (appareil déjà approuvé,
-- dont la clé enregistrée est reprise telle quelle : une demande ne peut pas viser une autre clé).
create or replace function public.request_device(req_kind text, device_pk text default null, device_name text default null, device uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d trusted_devices; r device_requests; c smallint := 10 + floor(random() * 90)::int;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  delete from device_requests where user_id = auth.uid() and created_at < now() - interval '1 day';
  if (select count(*) from device_requests where user_id = auth.uid() and created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'trop de demandes';
  end if;
  if req_kind = 'pairing' then
    if device_pk is null or coalesce(device_name, '') = '' then raise exception 'appareil incomplet'; end if;
    insert into device_requests (user_id, kind, name, pk, code, choices, expires_at)
      values (auth.uid(), 'pairing', left(device_name, 80), device_pk, c, number_choices(c), now() + interval '5 minutes') returning * into r;
  elsif req_kind = 'open' then
    select * into d from trusted_devices t where t.id = device and t.user_id = auth.uid() and t.expires_at > now();
    if d.id is null then raise exception 'appareil inconnu ou à revalider'; end if;
    insert into device_requests (user_id, kind, device_id, name, pk, code, choices, expires_at)
      values (auth.uid(), 'open', d.id, d.name, d.pk, c, number_choices(c), now() + interval '3 minutes') returning * into r;
  else
    raise exception 'demande invalide';
  end if;
  return jsonb_build_object('id', r.id, 'code', r.code, 'expires_at', r.expires_at);
end $$;

-- Ce que le téléphone affiche : jamais le bon nombre, seulement les trois choix.
create or replace function public.device_request_json(r public.device_requests)
returns jsonb language sql stable as $$
  select jsonb_build_object('id', r.id, 'kind', r.kind, 'device_id', r.device_id, 'name', r.name, 'pk', r.pk, 'choices', r.choices,
    'status', r.status, 'created_at', r.created_at, 'expires_at', r.expires_at)
$$;

create or replace function public.device_request(req uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select device_request_json(r) from device_requests r where r.id = req and r.user_id = auth.uid()
$$;

create or replace function public.pending_device_requests()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select device_request_json(r) from device_requests r
   where r.user_id = auth.uid() and r.status = 'pending' and r.expires_at > now() order by r.created_at desc
$$;

-- Le téléphone approuve : bon nombre choisi (un seul essai), demande encore valable. Il dépose les clés scellées.
-- Mauvais nombre : la demande est refusée et rien n'est déposé (retour null, pour que le refus soit bien enregistré).
create or replace function public.approve_device_request(req uuid, choice smallint, payload text)
returns uuid language plpgsql security definer set search_path = public as $$
declare r device_requests; d uuid;
begin
  select * into r from device_requests where id = req and user_id = auth.uid() for update;
  if r.id is null or r.status <> 'pending' or r.expires_at < now() then raise exception 'demande expirée'; end if;
  if choice is distinct from r.code then
    update device_requests set status = 'refused' where id = r.id;
    perform audit(r.user_id, 'appareil.mauvais_nombre', jsonb_build_object('request', r.id, 'name', r.name));
    return null;
  end if;
  if r.kind = 'pairing' then
    -- Revalidation au bout de 90 jours : la même clé repart pour 90 jours.
    delete from trusted_devices where user_id = r.user_id and pk = r.pk;
    insert into trusted_devices (user_id, name, pk) values (r.user_id, r.name, r.pk) returning id into d;
    perform enqueue_email((select email from auth.users where id = r.user_id), (select first_name from profiles where id = r.user_id), 'nouvel-appareil',
      jsonb_build_object('name', r.name, 'date', to_char(now() at time zone 'Europe/Paris', 'DD/MM/YYYY à HH24:MI')));
  else
    select id into d from trusted_devices where id = r.device_id and expires_at > now();
    if d is null then raise exception 'appareil à revalider'; end if;
  end if;
  update device_requests set status = 'approved', sealed = payload, device_id = d where id = r.id;
  perform audit(r.user_id, 'appareil.' || r.kind, jsonb_build_object('device', d, 'name', r.name));
  return d;
end $$;

create or replace function public.refuse_device_request(req uuid)
returns void language sql security definer set search_path = public as $$
  update device_requests set status = 'refused' where id = req and user_id = auth.uid() and status = 'pending'
$$;

-- L'ordinateur reprend les clés scellées une seule fois : elles sont aussitôt effacées du serveur.
create or replace function public.take_device_request(req uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r device_requests;
begin
  select * into r from device_requests where id = req and user_id = auth.uid() for update;
  if r.id is null then raise exception 'demande inconnue'; end if;
  if r.status = 'approved' then
    update device_requests set status = 'used', sealed = null where id = r.id;
    update trusted_devices set last_used_at = now() where id = r.device_id;
  end if;
  return jsonb_build_object('status', case when r.status = 'pending' and r.expires_at < now() then 'expired' else r.status end,
    'sealed', r.sealed, 'device_id', r.device_id);
end $$;

-- Un téléphone qui change de compte reprend son jeton : il ne reçoit plus les demandes de l'ancien.
create or replace function public.register_push(push_token text, push_platform text)
returns void language sql security definer set search_path = public as $$
  insert into push_tokens (token, user_id, platform) values (push_token, auth.uid(), push_platform)
  on conflict (token) do update set user_id = auth.uid(), platform = excluded.platform, updated_at = now()
$$;

create or replace function public.unregister_push(push_token text)
returns void language sql security definer set search_path = public as $$
  delete from push_tokens where token = push_token and user_id = auth.uid()
$$;

-- ---------- Droits ----------
-- Les privilèges par défaut de Supabase ouvrent toute nouvelle table et fonction : on referme, puis on ouvre le strict nécessaire.

revoke all on public.trusted_devices, public.device_requests, public.push_tokens from anon, authenticated;
revoke execute on function public.number_choices, public.request_device, public.device_request_json, public.device_request, public.pending_device_requests,
  public.approve_device_request, public.refuse_device_request, public.take_device_request, public.register_push, public.unregister_push from public, anon, authenticated;

grant select, delete on public.trusted_devices to authenticated;
grant execute on function public.request_device, public.device_request, public.pending_device_requests, public.approve_device_request,
  public.refuse_device_request, public.take_device_request, public.register_push, public.unregister_push to authenticated;

alter table public.trusted_devices enable row level security;
alter table public.device_requests enable row level security;
alter table public.push_tokens enable row level security;

create policy own on public.trusted_devices for select using (user_id = auth.uid());
create policy own_delete on public.trusted_devices for delete using (user_id = auth.uid());
