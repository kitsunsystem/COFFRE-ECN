-- Planification des fonctions (extensions pg_cron + pg_net, à activer dans le tableau de bord Supabase).
-- Remplacer <PROJECT_REF> et <SERVICE_ROLE_KEY> avant d'exécuter, ou stocker la clé dans Vault.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('procedures-tick', '*/15 * * * *', $$
  select net.http_post('https://<PROJECT_REF>.supabase.co/functions/v1/procedures-tick', '{}'::jsonb, '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'Content-Type', 'application/json'))
$$);

select cron.schedule('relances', '0 9 * * *', $$
  select net.http_post('https://<PROJECT_REF>.supabase.co/functions/v1/relances', '{}'::jsonb, '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'Content-Type', 'application/json'))
$$);

-- Le fichier INSEE mensuel paraît en début de mois : veille le 5 à 6 h.
select cron.schedule('insee-watch', '0 6 5 * *', $$
  select net.http_post('https://<PROJECT_REF>.supabase.co/functions/v1/insee-watch', '{}'::jsonb, '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'Content-Type', 'application/json'))
$$);
