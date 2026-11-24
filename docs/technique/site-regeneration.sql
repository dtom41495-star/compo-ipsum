-- Régénération du site à la demande (chantier « Indépendance », étape 2 bis).
-- Quand un article du site est mis en ligne, corrigé ou retiré dans Compo, la base note « le site est à régénérer ».
-- Une tâche planifiée passe chaque minute : s'il y a une note, elle appelle la fonction `site-regenerer`, qui demande à
-- GitHub de relancer le workflow « Site statique ». Une correction enregistrée dix fois de suite ne donne donc qu'UNE
-- génération par minute au plus.
-- À appliquer APRÈS le déploiement de la fonction `site-regenerer` et l'ajout du secret GITHUB_DISPATCH_TOKEN (voir
-- docs/technique/site-regeneration.md). Sans ces deux choses, la tâche planifiée échouerait chaque minute (rien de grave,
-- mais inutile).

create table if not exists public.site_regeneration (
  id int primary key default 1 check (id = 1),
  a_faire boolean not null default false,
  demande_le timestamptz,
  lance_le timestamptz
);
insert into public.site_regeneration (id) values (1) on conflict do nothing;
alter table public.site_regeneration enable row level security;   -- aucune règle : seules les fonctions ci-dessous (SECURITY DEFINER) y touchent
revoke all on public.site_regeneration from anon, authenticated;

-- Note « à régénérer »
create or replace function public.site_marquer_a_regenerer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.site_regeneration set a_faire = true, demande_le = now() where id = 1;
  return null;
end $$;

-- Article de Compo : seulement ce qui change ce que le site affiche (pas l'enregistrement automatique du brouillon)
drop trigger if exists articles_site_regenerer on public.articles;
create trigger articles_site_regenerer after update on public.articles
  for each row
  when ((old.site_en_ligne or new.site_en_ligne) and (
        old.site_en_ligne is distinct from new.site_en_ligne or old.statut is distinct from new.statut
        or old.site_slug is distinct from new.site_slug or old.titre is distinct from new.titre
        or old.chapeau is distinct from new.chapeau or old.corps is distinct from new.corps
        or old.auteur is distinct from new.auteur or old.cosignataires is distinct from new.cosignataires
        or old.rubrique is distinct from new.rubrique or old.tags is distinct from new.tags
        or old.image is distinct from new.image or old.image_legende is distinct from new.image_legende
        or old.redaction_id is distinct from new.redaction_id or old.publie_le is distinct from new.publie_le))
  execute function public.site_marquer_a_regenerer();

-- Anciens articles Substack importés (retrait, correction)
drop trigger if exists site_articles_site_regenerer on public.site_articles;
create trigger site_articles_site_regenerer after insert or update on public.site_articles
  for each statement execute function public.site_marquer_a_regenerer();

-- Appelée chaque minute. Elle efface la note AVANT d'appeler : une modification arrivée pendant l'appel en remet une.
-- Si l'appel échoue, la fonction `site-regenerer` remet la note (nouvel essai à la minute suivante).
create or replace function public.site_regenerer_si_besoin() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare faire boolean;
begin
  update public.site_regeneration set a_faire = false, lance_le = now() where id = 1 and a_faire returning true into faire;
  if faire then perform public._appel_fonction('site-regenerer', 20000); end if;
end $$;
revoke all on function public.site_regenerer_si_besoin() from public, anon, authenticated;

select cron.schedule('site-regenerer-1min', '* * * * *', 'select public.site_regenerer_si_besoin()');
