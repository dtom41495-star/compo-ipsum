-- Veille : qui peut modifier quoi. Avant, tout membre connecté pouvait ajouter, modifier ou supprimer
-- les sources et les articles directement dans la base (l'appli ne montrait le bouton qu'aux admins et rédac chefs).
-- Après : tout le monde lit ; les sources se gèrent par les admins et les rédac chefs ;
-- les articles ne sont écrits que par la fonction veille-recuperer-flux (clé service, qui passe outre ces règles).
-- À lancer une fois ; sans danger si relancé.

drop policy if exists veille_flux_membres on public.veille_flux;
drop policy if exists veille_flux_lecture on public.veille_flux;
drop policy if exists veille_flux_gestion on public.veille_flux;
create policy veille_flux_lecture on public.veille_flux for select to authenticated using (true);
create policy veille_flux_gestion on public.veille_flux for all to authenticated
  using (public.est_admin() or exists (select 1 from public.membres_redactions where membre_id = auth.uid() and role_redac = 'redac_chef'))
  with check (public.est_admin() or exists (select 1 from public.membres_redactions where membre_id = auth.uid() and role_redac = 'redac_chef'));

drop policy if exists veille_articles_membres on public.veille_articles;
drop policy if exists veille_articles_lecture on public.veille_articles;
create policy veille_articles_lecture on public.veille_articles for select to authenticated using (true);
