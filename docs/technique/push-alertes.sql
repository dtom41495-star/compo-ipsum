-- Alertes « nouvel article » (notifications web) : voir docs/technique/push-*.ts et le dépôt du site (assets/alertes.js, sw.js).
-- NON APPLIQUÉ en production : à relire et à valider par Tom.
--  - push_cle      : la paire de clés VAPID du site (créée au premier appel par la fonction « push-abonnement » ; la clé privée ne sort jamais de la base) ;
--  - push_abonnes  : un abonnement par navigateur (adresse du service de notification + clés de chiffrement + éditions choisies) ; ni nom ni email ;
--  - push_envoyes  : les articles déjà annoncés (pour ne jamais notifier deux fois) ;
--  - aucune règle d'accès : seules les fonctions serveur (service_role) lisent et écrivent ces tables ;
--  - tâche automatique toutes les 15 minutes : fonction « push-articles » (elle ne publie rien entre 22 h et 7 h).
-- Retour en arrière : select cron.unschedule('push-articles'); drop table public.push_envoyes, public.push_abonnes, public.push_cle;

create table if not exists public.push_cle (
  id int primary key default 1 check (id = 1),
  publique text not null,
  privee jsonb not null
);
create table if not exists public.push_abonnes (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique check (char_length(endpoint) <= 700 and endpoint ~ '^https://'),
  p256dh text not null check (char_length(p256dh) <= 120),
  auth text not null check (char_length(auth) <= 60),
  editions text[] not null default array['tarn', 'haute-garonne', 'national']
    check (editions <@ array['tarn', 'haute-garonne', 'national']),
  ip_h text,                                  -- empreinte de l'IP (limite des abonnements), jamais l'IP
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  dernier_envoi timestamptz,
  echecs int not null default 0
);
create index if not exists push_abonnes_editions on public.push_abonnes using gin (editions);
create index if not exists push_abonnes_ip on public.push_abonnes (ip_h, cree_le);
create table if not exists public.push_envoyes (
  slug text primary key,
  edition text,
  envoye_le timestamptz not null default now(),
  nb_envoyes int not null default 0
);
alter table public.push_cle enable row level security;
alter table public.push_abonnes enable row level security;
alter table public.push_envoyes enable row level security;
-- (volontairement aucune policy : ni lecture ni écriture hors service_role)

select cron.schedule('push-articles', '*/15 * * * *', $$ select public._appel_fonction('push-articles', 60000) $$);
