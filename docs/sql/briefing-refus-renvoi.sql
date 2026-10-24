-- Appliqué le 2026-10-24 (migration « briefing_refus_renvoi ») : un sujet refusé n'est plus supprimé.
-- statut = 'refuse' (invisible des listes d'équipe) ; l'auteur·rice peut le préciser et le renvoyer (statut repasse à 'propose').
alter table public.briefing
  add column if not exists raison_refus text,    -- raison donnée au refus (facultative)
  add column if not exists refuse_le timestamptz, -- date du dernier refus
  add column if not exists precisions text,       -- réponse de l'auteur·rice quand il renvoie son sujet
  add column if not exists renvoye_le timestamptz; -- date du dernier renvoi
