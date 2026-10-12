-- Articles dont le NOM d'auteur ne correspond pas au compte qui les a écrits (auteur_id).
-- Cas connu : une correctrice corrige l'article de quelqu'un, puis commence le sien : son article partait avec le nom
-- de l'autre personne (corrigé dans l'appli ; ceci retrouve les articles déjà touchés). Lecture seule.
select a.id            as article_id,
       a.titre,
       a.statut,
       a.auteur        as nom_affiche,
       trim(coalesce(m.prenom,'') || ' ' || coalesce(m.nom,'')) as vrai_auteur,
       a.created_at,
       a.publie_le
from public.articles a
join public.membres m on m.id::text = a.auteur_id::text
where lower(trim(coalesce(a.auteur,''))) <> lower(trim(coalesce(m.prenom,'') || ' ' || coalesce(m.nom,'')))
order by a.created_at desc;

-- Pour corriger un article (remplacer l'identifiant) : le nom d'auteur reprend celui du compte
-- update public.articles a
--    set auteur = trim(coalesce(m.prenom,'') || ' ' || coalesce(m.nom,''))
--   from public.membres m
--  where m.id::text = a.auteur_id::text and a.id = '<article_id>';
--
-- Attention : un article déjà PUBLIÉ garde l'ancien nom sur Substack / la newsletter ; à corriger là-bas aussi.
-- Autre piège : le texte du nouvel article pouvait aussi reprendre le corps de l'article corrigé juste avant : vérifier le contenu.
