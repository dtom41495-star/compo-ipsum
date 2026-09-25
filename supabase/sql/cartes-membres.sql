-- Envoi automatique des cartes de membre (fonction envoyer-cartes-membres)
-- À exécuter une fois dans Supabase > SQL Editor, APRÈS avoir déployé la fonction.

-- 1. Ce qui a été envoyé la dernière fois à chaque membre (pour savoir si sa carte a changé)
alter table membres add column if not exists carte_contenu_envoye text;
alter table membres add column if not exists carte_envoyee_le timestamptz;

-- 2. Extensions nécessaires (souvent déjà actives : sans effet dans ce cas)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 3. Tâche planifiée : le 1er et le 15 de chaque mois à 9 h (heure de Paris en hiver,
--    10 h en été), soit environ toutes les deux semaines.
--    Remplacer COLLER_ICI_LA_CLE_SERVICE_ROLE par la clé « service_role » :
--    Supabase > Project Settings > API > service_role (secret, ne jamais la partager).
select cron.schedule(
  'envoyer-cartes-membres',
  '0 8 1,15 * *',
  $$
  select net.http_post(
    url := 'https://ctmekufqaxdelgfyjwly.supabase.co/functions/v1/envoyer-cartes-membres',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer COLLER_ICI_LA_CLE_SERVICE_ROLE'),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

-- Pour vérifier que la tâche existe :      select * from cron.job;
-- Pour voir les derniers passages :        select * from cron.job_run_details order by start_time desc limit 5;
-- Pour arrêter l'envoi automatique :       select cron.unschedule('envoyer-cartes-membres');
