-- Appliqué le 2026-10-24 (migration « briefing_valide_le ») : date de validation d'un sujet proposé par un membre.
-- Posée par osSujetValiderProposition (js/10-calendrier.js), lue par js/67-sujet-valide.js (carte « Ton sujet est validé »).
alter table public.briefing add column if not exists valide_le timestamptz;
