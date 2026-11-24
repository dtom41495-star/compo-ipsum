-- Chiffre public de la page « À propos » du site (ipsummedia.fr/a-propos) : le nombre de bénévoles actifs, en direct.
-- Appliquée sur la base de production le 24 novembre 2026. Ne renvoie qu'un nombre : aucun nom, aucune autre donnée.
-- Le site l'appelle avec la clé publique : POST /rest/v1/rpc/site_chiffres. S'il ne répond pas, le chiffre reste caché.
-- Pour ajouter un autre chiffre public plus tard (par exemple le nombre d'articles), l'ajouter dans jsonb_build_object ci-dessous
-- et le lire dans assets/a-propos.js du dépôt du site.
create or replace function public.site_chiffres() returns jsonb
language sql stable security definer set search_path = public as $f$
  select jsonb_build_object('benevoles', (select count(*) from public.membres where actif))
$f$;
revoke all on function public.site_chiffres() from public;
grant execute on function public.site_chiffres() to anon, authenticated;
