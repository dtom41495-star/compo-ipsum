-- Veille : qui peut modifier quoi. Avant, tout membre connecté pouvait ajouter, modifier ou supprimer
-- les sources et les articles directement dans la base (l'appli ne montrait le bouton qu'aux admins et rédac chefs).
-- Après : tout le monde lit ; les sources se gèrent par les admins et les rédac chefs ;
-- les articles ne sont écrits que par la fonction veille-recuperer-flux (clé service, qui passe outre ces règles),
-- et seuls les admins peuvent en supprimer.
-- Appliqué le 18/10/2026 en modifiant les règles existantes (alter policy) plutôt qu'en les supprimant.

alter policy veille_flux_membres on public.veille_flux to authenticated
  using (public.est_admin() or exists (select 1 from public.membres_redactions where membre_id = auth.uid() and role_redac = 'redac_chef'))
  with check (public.est_admin() or exists (select 1 from public.membres_redactions where membre_id = auth.uid() and role_redac = 'redac_chef'));
create policy veille_flux_lecture on public.veille_flux for select to authenticated using (true);

alter policy veille_articles_membres on public.veille_articles to authenticated
  using (public.est_admin()) with check (false);
create policy veille_articles_lecture on public.veille_articles for select to authenticated using (true);
