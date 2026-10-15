-- Labo : co-écriture en temps réel (labo/coedition/)
-- Une ligne par salon : l'état Yjs complet (pour reprendre le texte là où on l'a laissé) et le markdown
-- recalculé (pour le lire sans Yjs). Ce n'est PAS la table des articles : rien n'y est publié.
-- Sans cette table, le prototype marche quand même, mais le texte est perdu quand tout le monde est parti.

create table if not exists public.coedition_labo (
  salon    text primary key,
  etat     text not null,                        -- état Yjs encodé en base64
  markdown text,
  maj_le   timestamptz not null default now(),
  maj_par  uuid default auth.uid()
);

alter table public.coedition_labo enable row level security;

-- Prototype : tout membre connecté lit et écrit tous les salons. À restreindre si l'essai devient une vraie fonction
-- (par exemple : les membres de la rédaction de l'article seulement).
drop policy if exists "coedition_labo membres connectés" on public.coedition_labo;
create policy "coedition_labo membres connectés" on public.coedition_labo
  for all to authenticated using (true) with check (true);

-- Temps réel : le prototype utilise un canal « broadcast » public (coedition:<salon>), qui ne passe pas par cette table.
-- Si, dans Supabase > Realtime > Settings, l'option « Allow public access » est désactivée, la page affiche
-- « Connexion impossible » : il faudrait alors passer à un canal privé, avec une règle RLS sur realtime.messages.
