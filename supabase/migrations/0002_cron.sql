-- Planification des fonctions Edge (pg_cron + pg_net). L'adresse du projet et la clé de service sont lues dans Vault :
-- à créer une fois, après le déploiement (voir deploy/README.md) :
--   select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.call_function(fn text)
returns bigint language sql security definer set search_path = public as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/' || fn,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    )
  )
$$;
revoke execute on function public.call_function from public, anon, authenticated;

-- E-mails en attente : toutes les minutes.
select cron.schedule('mailer', '* * * * *', $$ select public.call_function('mailer') $$);
-- Délais des procédures (alertes, ouverture, fin de l'accès après un décès) : toutes les 15 minutes.
select cron.schedule('procedures-tick', '*/15 * * * *', $$ select public.call_function('procedures-tick') $$);
-- Échéances, « tout est-il à jour ? », contrôle des cartes, impayés : chaque jour à 9 h (UTC).
select cron.schedule('relances', '0 9 * * *', $$ select public.call_function('relances') $$);
-- Le fichier INSEE mensuel paraît en début de mois : veille le 5 à 6 h.
select cron.schedule('insee-watch', '0 6 5 * *', $$ select public.call_function('insee-watch') $$);
