-- La commune d'un article du site vient aussi de Compo (appliquée sur la base de production le 24 novembre 2026, avec l'accord de Tom).
-- Compo détecte la commune de chaque article publié (fonction `articles-localiser`, table `articles_lieux`, source « auto » ou « manuel »).
-- `site_publications()` l'ajoute désormais aux étiquettes de l'article, sans doublon si l'auteur a déjà mis l'étiquette de la ville :
-- plus besoin de penser à étiqueter la ville pour que l'article apparaisse dans « Près de chez vous » et sur la page de sa commune.
-- Corriger la ville à la main dans Compo (source « manuel ») corrige donc aussi le site.
create or replace function public.site_slugifier(t text) returns text language sql immutable set search_path = public as $f$
  select trim(both '-' from regexp_replace(translate(lower(t), 'àâäáéèêëíîïóôöúùûüçñ', 'aaaaeeeeiiiooouuuucn'), '[^a-z0-9]+', '-', 'g'))
$f$;
-- puis site_publications() : voir la définition en base (partie « etiquettes » : étiquettes de l'auteur || commune de articles_lieux si absente).
