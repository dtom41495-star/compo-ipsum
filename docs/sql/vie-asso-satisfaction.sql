-- Vie associative : les réponses au sondage de satisfaction du recrutement (formulaire Tally).
-- Rangées par la fonction tally-satisfaction (supabase/functions/tally-satisfaction), affichées dans Bénévoles > Candidats
-- (js/50-vie-asso-candidats.js). Mêmes accès que les candidats : la vie associative et les admins.
-- À lancer une fois ; sans danger si relancé.

create table if not exists public.satisfaction_recrutement (
  id uuid primary key default gen_random_uuid(),
  -- Tally renvoie le même envoi en cas d'échec : on ne le range qu'une fois
  tally_submission_id text unique,
  recu_le timestamptz not null default now(),
  -- Les réponses telles quelles : [{"question": "…", "reponse": "…", "type": "RATING", "valeur": 4}]
  -- « valeur » n'existe que pour les notes et les échelles (nombre), pour calculer moyennes et répartition
  reponses jsonb not null default '[]'::jsonb,
  -- Si le sondage demande l'adresse et qu'elle correspond à une fiche candidat
  email text,
  candidat_id uuid references public.candidats(id) on delete set null
);

create index if not exists satisfaction_recrutement_recu_idx on public.satisfaction_recrutement (recu_le desc);

alter table public.satisfaction_recrutement enable row level security;
drop policy if exists satisfaction_vie_asso on public.satisfaction_recrutement;
create policy satisfaction_vie_asso on public.satisfaction_recrutement for all to authenticated
  using (public.est_vie_asso() or public.est_admin())
  with check (public.est_vie_asso() or public.est_admin());

-- Accès à l'API (Supabase ne les donne plus tout seul aux nouvelles tables à partir du 30 octobre 2026)
revoke all on public.satisfaction_recrutement from anon;
grant select, insert, update, delete on public.satisfaction_recrutement to authenticated;
grant select, insert, update, delete on public.satisfaction_recrutement to service_role;
