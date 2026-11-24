
-- Ajouté le 24 novembre 2026 (appliqué) : date à laquelle l'organisateur a été prévenu que son annonce est en ligne (Compo, « Agenda du site »)
alter table public.agenda_public add column if not exists prevenu_le timestamptz;

-- Ajouté le 24 novembre 2026 (appliqué) : pour l'instant, seul l'admin voit et traite les propositions (avant : admin, vie associative, chefs de rédaction).
-- Pour rouvrir plus tard : remplacer par  using (est_admin() or est_vie_asso() or _est_un_chef()) with check (idem).
drop policy if exists agenda_public_equipe on public.agenda_public;
create policy agenda_public_equipe on public.agenda_public for all to authenticated using (est_admin()) with check (est_admin());
