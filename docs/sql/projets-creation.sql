-- Projets : la personne qui crée un projet le voit tout de suite, même s'il est réservé à « certaines personnes ».
-- La règle de lecture passait seulement par projet_visible(), qui regarde l'état d'avant l'enregistrement : un projet
-- en cours de création n'y existe pas encore, et la base refusait de le renvoyer (erreur 403 à la création).
-- Compo ne demande plus la ligne en retour (js/16-projets.js), donc ce fichier n'est pas indispensable ; il rend la règle
-- juste pour toute autre façon de créer un projet. À lancer une fois ; sans danger si relancé.
drop policy if exists projets_visibilite on public.projets;
create policy projets_visibilite on public.projets as restrictive for select to authenticated
  using (cree_par::text = auth.uid()::text or public.projet_visible(id::text));
