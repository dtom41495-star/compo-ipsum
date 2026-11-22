-- Verrou du texte d'un article validé ou en ligne (chantier Indépendance / sécurité, novembre 2026)
-- Problème : un auteur pouvait modifier titre, chapô et texte de son article « Bon à publier » ou « En ligne » sans repasser par le SR ;
-- le site lit directement la table articles (fonction site_publications), la modification était en ligne aussitôt.
-- Règle : quand l'article est valide, valide_central ou publie, le titre, le chapô et le corps ne changent plus, sauf pour
--   - un admin ;
--   - le responsable de la rédaction (ou de la rédaction centrale), mais pas sur son propre texte ;
--   - la mise en ligne elle-même (site_publier, qui réécrit les adresses d'images : indicateur compo.site_publier) ;
--   - une fonction serveur ou une tâche planifiée (aucun utilisateur connecté : auth.uid() est nul).
-- Les autres champs (vues, adresse, note…) ne sont pas concernés. Un texte renvoyé en correction (statut libre) se modifie comme avant.
-- Testé le 22 novembre 2026 dans une transaction annulée (9 cas : auteur refusé, membre étranger 0 ligne, responsable accepté,
-- admin accepté, hors texte accepté, serveur accepté, indicateur de mise en ligne accepté, responsable auteur de son texte refusé,
-- auteur après renvoi en brouillon accepté).
-- Retour en arrière : drop trigger articles_fige_texte on public.articles; drop function public.articles_fige_texte();

create or replace function public.articles_fige_texte() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then return new; end if;
  if old.statut not in ('valide','valide_central','publie') then return new; end if;
  if new.titre is not distinct from old.titre and new.chapeau is not distinct from old.chapeau and new.corps is not distinct from old.corps then return new; end if;
  if public.est_admin() then return new; end if;
  if coalesce(current_setting('compo.site_publier', true), '') = 'oui' then return new; end if;
  if (public.est_chef_de(old.redaction_id::text) or public.est_chef_centrale()) and old.auteur_id is distinct from auth.uid() then return new; end if;
  raise exception 'texte_fige: ce texte est validé ou en ligne ; il ne se modifie plus. Demande à un responsable ou à un admin, ou renvoie-le en correction.';
end $$;

create trigger articles_fige_texte before update of titre, chapeau, corps on public.articles
  for each row execute function public.articles_fige_texte();
