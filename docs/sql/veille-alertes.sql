-- Veille : alertes personnelles. Chaque bénévole choisit ses mots-clés (une commune, une asso, un nom…) ;
-- personne d'autre ne les voit. Un article qui contient l'un d'eux est signalé dans sa Veille, et si
-- « prevenir » est coché, la fonction veille-recuperer-flux lui envoie un récapitulatif (Chat ou email, son canal),
-- au plus toutes les 5 heures (dernier_envoi) et seulement pendant les horaires de ses rédactions.
-- À lancer une fois ; sans danger si relancé.

create table if not exists public.veille_alertes (
  membre_id uuid primary key default auth.uid() references public.membres(id) on delete cascade,
  mots text[] not null default '{}',
  prevenir boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.veille_alertes add column if not exists dernier_envoi timestamptz;

alter table public.veille_alertes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'veille_alertes' and policyname = 'veille_alertes_perso') then
    create policy veille_alertes_perso on public.veille_alertes for all to authenticated
      using (membre_id = auth.uid()) with check (membre_id = auth.uid());
  end if;
  -- Comme toutes les tables : pas d'écriture pendant une maintenance (cf. maintenance.sql)
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'veille_alertes' and policyname = 'maintenance_ajout') then
    create policy maintenance_ajout on public.veille_alertes as restrictive for insert to anon, authenticated
      with check ((select public.en_maintenance()) is not true or (select public.est_admin()));
    create policy maintenance_modif on public.veille_alertes as restrictive for update to anon, authenticated
      using ((select public.en_maintenance()) is not true or (select public.est_admin()));
    create policy maintenance_suppr on public.veille_alertes as restrictive for delete to anon, authenticated
      using ((select public.en_maintenance()) is not true or (select public.est_admin()));
  end if;
end $$;
