-- Mode maintenance : Compo se ferme à tout le monde sauf aux admins, le temps de modifier la base ou l'appli.
-- Interrupteur : appli Admin > Maintenance (js/51-maintenance.js). Les personnes connectées voient d'abord un préavis,
-- puis un écran « Compo est en maintenance » ; la page se recharge toute seule à la réouverture.
-- En plus de l'écran, la base refuse toute écriture (ajout, modification, suppression) des non-admins pendant la maintenance.
-- Les fonctions du serveur (clé service : emails, tâches planifiées) et l'éditeur SQL de Supabase ne sont pas bloqués.
-- À lancer une fois ; sans danger si relancé. À relancer après la création de nouvelles tables, pour qu'elles soient bloquées aussi.

create table if not exists public.maintenance (
  id boolean primary key default true check (id),     -- une seule ligne
  active boolean not null default false,
  debut timestamptz,                                  -- fermeture effective (préavis avant)
  message text not null default '',
  activee_par uuid references public.membres(id) on delete set null,
  activee_le timestamptz
);
insert into public.maintenance (id) values (true) on conflict (id) do nothing;

alter table public.maintenance enable row level security;
drop policy if exists maintenance_lecture on public.maintenance;
create policy maintenance_lecture on public.maintenance for select to anon, authenticated using (true);
drop policy if exists maintenance_admin on public.maintenance;
create policy maintenance_admin on public.maintenance for update to authenticated
  using (public.est_admin()) with check (public.est_admin());

create or replace function public.en_maintenance()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select active and (debut is null or debut <= now()) from public.maintenance where id), false);
$$;

-- Sur chaque table : une règle « restrictive » qui s'ajoute aux règles existantes sans les changer.
-- Hors maintenance, elle laisse tout passer ; pendant, seuls les admins écrivent.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and rowsecurity loop
    execute format('drop policy if exists maintenance_ajout on public.%I', t.tablename);
    execute format('drop policy if exists maintenance_modif on public.%I', t.tablename);
    execute format('drop policy if exists maintenance_suppr on public.%I', t.tablename);
    execute format('create policy maintenance_ajout on public.%I as restrictive for insert to anon, authenticated
      with check ((select public.en_maintenance()) is not true or (select public.est_admin()))', t.tablename);
    execute format('create policy maintenance_modif on public.%I as restrictive for update to anon, authenticated
      using ((select public.en_maintenance()) is not true or (select public.est_admin()))', t.tablename);
    execute format('create policy maintenance_suppr on public.%I as restrictive for delete to anon, authenticated
      using ((select public.en_maintenance()) is not true or (select public.est_admin()))', t.tablename);
  end loop;
end $$;
