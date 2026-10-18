-- Veille : relevé des sources toutes les 30 minutes, en pause la nuit (rien d'utile à chercher).
-- pg_cron compte en heure UTC : de 4 h à 20 h 30 UTC, soit 6 h à 22 h 30 à Paris l'été, 5 h à 21 h 30 l'hiver.
-- Le premier relevé du matin rattrape les articles parus pendant la nuit.
-- À lancer une fois ; sans danger si relancé (même nom : la tâche est remplacée).

select cron.schedule('veille-recuperer-flux-30min', '*/30 4-20 * * *',
  $$ select public._appel_fonction('veille-recuperer-flux', 5000, 'cle_service') $$);
