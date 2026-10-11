-- Plusieurs communiqués par sujet.
-- briefing.cp_id reste le communiqué « principal » ; cette table liste TOUS les communiqués d'un sujet (principal compris).
-- Lecture : tout membre connecté. Ajout / retrait : admin, rédac chef de la rédaction du sujet, ou personne qui a réservé le sujet.
-- À lancer une fois ; sans danger si relancé.
create table if not exists public.briefing_communiques (
  briefing_id   text not null,
  communique_id text not null,
  ajoute_par    text,
  created_at    timestamptz not null default now(),
  primary key (briefing_id, communique_id)
);
create index if not exists briefing_communiques_cp on public.briefing_communiques (communique_id);

-- Reprise de l'existant : chaque communiqué principal déjà lié à un sujet
insert into public.briefing_communiques (briefing_id, communique_id)
select id::text, cp_id::text from public.briefing where cp_id is not null
on conflict do nothing;

alter table public.briefing_communiques enable row level security;

drop policy if exists bc_lecture on public.briefing_communiques;
create policy bc_lecture on public.briefing_communiques for select to authenticated using (true);

-- Qui peut modifier la liste d'un sujet
create or replace function public.peut_gerer_sujet(p_briefing text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.est_admin()
    or exists (
      select 1 from public.briefing b
      where b.id::text = p_briefing
        and (
          exists (select 1 from public.membres_redactions mr
                  where mr.membre_id = auth.uid() and mr.redaction_id::text = b.redaction_id::text and mr.role_redac = 'redac_chef')
          or (b.statut = 'en_cours' and exists (select 1 from public.membres m
                  where m.id = auth.uid() and lower(trim(coalesce(m.prenom,'')||' '||coalesce(m.nom,''))) = lower(trim(coalesce(b.responsable,'')))))
        )
    );
$$;

drop policy if exists bc_ajout on public.briefing_communiques;
create policy bc_ajout on public.briefing_communiques for insert to authenticated with check (public.peut_gerer_sujet(briefing_id));
drop policy if exists bc_retrait on public.briefing_communiques;
create policy bc_retrait on public.briefing_communiques for delete to authenticated using (public.peut_gerer_sujet(briefing_id));
