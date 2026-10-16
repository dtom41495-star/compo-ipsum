-- Vie associative : le suivi des futur·es bénévoles, du premier contact à l'adhésion.
-- Utilisé par l'onglet « Candidats » de l'appli Bénévoles (js/50-vie-asso-candidats.js)
-- et par la fonction tally-candidature (supabase/functions/tally-candidature), qui range ici les réponses au formulaire Tally.
-- À lancer une fois ; sans danger si relancé.

create table if not exists public.candidats (
  id uuid primary key default gen_random_uuid(),
  prenom text not null default '',
  nom text not null default '',
  email text,
  telephone text,
  -- contact → appel → formulaire_envoye → formulaire_recu → compte_cree → essai → adherent (ou sans_suite à tout moment)
  etape text not null default 'contact'
    check (etape in ('contact','appel','formulaire_envoye','formulaire_recu','compte_cree','essai','adherent','sans_suite')),
  -- Date d'arrivée à chaque étape, par exemple {"appel": "2026-10-16T…"} : sert aux relances et à l'historique de la carte
  dates jsonb not null default '{}'::jsonb,
  etape_changee_le timestamptz not null default now(),
  source text not null default '',                    -- comment la personne nous a connus
  commission_id uuid references public.commissions(id) on delete set null,
  redaction_id uuid references public.redactions(id) on delete set null,
  suivi_par uuid references public.membres(id) on delete set null,
  notes text not null default '',
  -- Réponses au formulaire Tally, telles quelles : [{"question": "…", "reponse": "…"}]
  tally_reponses jsonb,
  tally_submission_id text unique,                    -- Tally renvoie le même envoi en cas d'échec : on ne le range qu'une fois
  tally_recu_le timestamptz,
  membre_id uuid references public.membres(id) on delete set null,  -- le compte Compo, une fois créé
  essai_fin date,                                     -- fin de la période d'essai (deux semaines par défaut)
  adhesion_payee_le date,
  created_at timestamptz not null default now(),
  cree_par uuid default auth.uid()
);

create index if not exists candidats_etape_idx on public.candidats (etape);
create index if not exists candidats_email_idx on public.candidats (lower(email));

-- Données personnelles de gens qui ne sont pas (encore) dans l'asso : seuls la vie associative et les admins les voient.
alter table public.candidats enable row level security;
drop policy if exists candidats_vie_asso on public.candidats;
create policy candidats_vie_asso on public.candidats for all to authenticated
  using (public.est_vie_asso() or public.est_admin())
  with check (public.est_vie_asso() or public.est_admin());

-- RGPD : une candidature qui n'a pas abouti s'efface d'elle-même au bout de six mois sans mouvement.
-- Les personnes devenues membres (compte créé, essai, adhérent) restent : leur fiche Compo prend le relais.
create or replace function public.candidats_purger()
returns integer language sql security definer set search_path = public as $$
  with suppr as (
    delete from public.candidats
    where etape in ('contact','appel','formulaire_envoye','formulaire_recu','sans_suite')
      and etape_changee_le < now() - interval '6 months'
    returning 1
  )
  select count(*)::integer from suppr;
$$;
revoke all on function public.candidats_purger() from public, anon, authenticated;

select cron.unschedule('candidats-purge-rgpd') where exists (select 1 from cron.job where jobname = 'candidats-purge-rgpd');
select cron.schedule('candidats-purge-rgpd', '20 3 * * *', $$ select public.candidats_purger() $$);
