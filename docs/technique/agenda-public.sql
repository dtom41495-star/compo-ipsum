
-- Ajouté le 24 novembre 2026 (appliqué) : date à laquelle l'organisateur a été prévenu que son annonce est en ligne (Compo, « Agenda du site »)
alter table public.agenda_public add column if not exists prevenu_le timestamptz;
