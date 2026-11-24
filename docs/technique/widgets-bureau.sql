-- Widgets du bureau : la sélection et la place des widgets de chaque membre, enregistrées dans la base (et non dans le navigateur).
-- Une ligne par widget choisi : (membre, identifiant du widget, colonne, ligne et largeur dans la grille du bureau, réglages).
-- La grille a 2 colonnes et 8 lignes au plus ; un widget occupe 1 ou 2 colonnes. Le catalogue des widgets est dans le code de Compo
-- (js/94-widgets-bureau.js). Une ligne spéciale « _perso » marque un bureau déjà personnalisé : sans elle, le membre voit la
-- sélection par défaut (même s'il n'a encore rien enregistré) ; avec elle, seules ses lignes comptent, y compris un bureau vide.
-- Chacun ne lit et ne modifie que ses propres lignes.
-- Retour en arrière : drop table public.widgets_bureau;

create table if not exists public.widgets_bureau (
  membre_id uuid not null default auth.uid() references public.membres(id) on delete cascade,
  widget text not null check (widget ~ '^[a-z_][a-z0-9_-]{0,40}$'),
  col smallint not null default 1 check (col between 1 and 2),
  ligne smallint not null default 1 check (ligne between 1 and 8),
  largeur smallint not null default 1 check (largeur between 1 and 2),
  reglages jsonb not null default '{}'::jsonb,
  maj timestamptz not null default now(),
  primary key (membre_id, widget)
);

alter table public.widgets_bureau enable row level security;
revoke all on public.widgets_bureau from anon;
grant select, insert, update, delete on public.widgets_bureau to authenticated;

create policy widgets_bureau_lire on public.widgets_bureau for select to authenticated using (membre_id = auth.uid());
create policy widgets_bureau_ajouter on public.widgets_bureau for insert to authenticated with check (membre_id = auth.uid());
create policy widgets_bureau_modifier on public.widgets_bureau for update to authenticated using (membre_id = auth.uid()) with check (membre_id = auth.uid());
create policy widgets_bureau_supprimer on public.widgets_bureau for delete to authenticated using (membre_id = auth.uid());
