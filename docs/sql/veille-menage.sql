-- Veille : ménage automatique, pour que les articles récupérés ne remplissent pas la base.
-- Chaque nuit, les articles de plus de 60 jours sont effacés (un sujet créé depuis un article garde son lien).
-- Ordre de grandeur : une source qui publie 40 articles par jour fait environ 2 000 lignes de ~0,5 Ko sur 60 jours, soit 1 Mo.
-- À lancer une fois ; sans danger si relancé.

create or replace function public.veille_menage()
returns integer language sql security definer set search_path = public as $$
  with suppr as (
    delete from public.veille_articles
    where coalesce(date_publication, created_at) < now() - interval '60 days'
    returning 1
  )
  select count(*)::integer from suppr;
$$;
revoke all on function public.veille_menage() from public, anon, authenticated;

select cron.unschedule('veille-menage') where exists (select 1 from cron.job where jobname = 'veille-menage');
select cron.schedule('veille-menage', '40 3 * * *', $$ select public.veille_menage() $$);
