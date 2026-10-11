-- Signalements enrichis : type (js, reseau, permission, base, serveur, requete), détails (méthode, adresse sans paramètres,
-- statut HTTP, code d'erreur de la base) et nombre d'occurrences. À lancer une fois ; sans danger si relancé.
-- Sans ce SQL, les signalements marchent quand même : le type est alors glissé au début du message.
alter table public.bug_reports add column if not exists type        text not null default 'js';
alter table public.bug_reports add column if not exists details     jsonb;
alter table public.bug_reports add column if not exists occurrences integer not null default 1;
create index if not exists bug_reports_type on public.bug_reports (type, created_at desc);
