-- Pauses des rédactions (vacances) : pendant une pause, les semaines concernées ne comptent pas pour les séries,
-- les relances et rappels ne partent pas, les notifications de rédaction attendent la reprise.
-- redaction_id vide = pause générale (toutes les rédactions), réservée aux admins.
-- Les pauses passées sont conservées : elles servent à rendre neutres les semaines déjà écoulées.
create table if not exists public.pauses_redaction (
  id uuid primary key default gen_random_uuid(),
  redaction_id uuid references public.redactions(id) on delete cascade,
  debut date not null,
  fin date not null,
  cree_par uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint pauses_redaction_dates check (fin >= debut)
);
create index if not exists pauses_redaction_fin_idx on public.pauses_redaction (fin);

alter table public.pauses_redaction enable row level security;
revoke all on public.pauses_redaction from anon;
grant select, insert, update, delete on public.pauses_redaction to authenticated;
grant all on public.pauses_redaction to service_role;

create policy pauses_redaction_lecture on public.pauses_redaction for select to authenticated using (true);

-- Un admin gère toutes les pauses ; un rédac chef, celles de sa rédaction
create policy pauses_redaction_ajout on public.pauses_redaction for insert to authenticated with check (
  (select est_admin())
  or (redaction_id is not null and exists (select 1 from public.membres_redactions mr
        where mr.membre_id = (select auth.uid()) and mr.redaction_id = pauses_redaction.redaction_id and mr.role_redac = 'redac_chef'))
);
create policy pauses_redaction_modif on public.pauses_redaction for update to authenticated using (
  (select est_admin())
  or (redaction_id is not null and exists (select 1 from public.membres_redactions mr
        where mr.membre_id = (select auth.uid()) and mr.redaction_id = pauses_redaction.redaction_id and mr.role_redac = 'redac_chef'))
);
create policy pauses_redaction_suppr on public.pauses_redaction for delete to authenticated using (
  (select est_admin())
  or (redaction_id is not null and exists (select 1 from public.membres_redactions mr
        where mr.membre_id = (select auth.uid()) and mr.redaction_id = pauses_redaction.redaction_id and mr.role_redac = 'redac_chef'))
);
