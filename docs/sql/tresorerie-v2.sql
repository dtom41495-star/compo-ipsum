-- ===== TRÉSORERIE V2 =====
-- Remplace l'ancienne trésorerie (tables tresorerie_transactions et tresorerie_budget, abandonnées) par :
--   tres_categories   catégories fixes (recettes et dépenses)
--   tres_ecritures    le journal : une écriture = un montant signé (recette > 0, dépense < 0), une catégorie, une pièce possible
--   tres_budget       budget prévisionnel par exercice et par catégorie (le réalisé se calcule depuis les écritures)
--   tres_notes_frais  notes de frais déposées par les bénévoles (ou saisies par le trésorier) : soumise > validée > remboursée
--   tres_journal      historique : qui a saisi, modifié, validé, remboursé quoi
-- Accès : trésorier et admins (fonction 'tresorier' ou role 'admin'). Un bénévole ne voit et ne dépose que ses propres notes de frais.
-- Pièces justificatives : bucket privé 'tresorerie-pieces' (dossier = identifiant de la personne qui dépose).
-- Adhésions : membres.adhesion_echeance (14 jours à partir de la première connexion, ou de l'étape « essai » du suivi des candidatures),
-- membres.adhesion_exemptee (les comptes qui existaient à la mise en place n'ont pas de décompte).

create or replace function public.peut_gerer_tresorerie() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.membres where id = auth.uid() and (role = 'admin' or 'tresorier' = any(fonction)));
$$;

create table if not exists public.tres_categories (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  sens text not null check (sens in ('recette', 'depense')),
  ordre int not null default 0,
  systeme text,                      -- 'adhesions' : une écriture de cette catégorie liée à un membre solde son adhésion
  created_at timestamptz not null default now()
);

create table if not exists public.tres_ecritures (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  libelle text not null,
  montant numeric(12,2) not null check (montant <> 0),
  categorie_id uuid references public.tres_categories(id),
  moyen text,
  membre_id uuid references public.membres(id) on delete set null,
  note_frais_id uuid,
  piece text,
  rapproche boolean not null default false,
  rapproche_le date,
  source text not null default 'manuel',      -- manuel, import_banque, import_helloasso, note_frais
  import_ref text,                             -- empreinte d'une ligne importée : évite les doublons
  remarques text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists tres_ecritures_import_ref on public.tres_ecritures (import_ref) where import_ref is not null;
create index if not exists tres_ecritures_date on public.tres_ecritures (date desc);

create table if not exists public.tres_budget (
  id uuid primary key default gen_random_uuid(),
  exercice int not null,
  categorie_id uuid not null references public.tres_categories(id) on delete cascade,
  montant numeric(12,2) not null default 0,
  notes text,
  unique (exercice, categorie_id)
);

create table if not exists public.tres_notes_frais (
  id uuid primary key default gen_random_uuid(),
  membre_id uuid not null references public.membres(id) on delete cascade,
  objet text not null,
  montant numeric(10,2) not null check (montant > 0),
  date_depense date not null default current_date,
  redaction_id uuid,
  categorie_id uuid references public.tres_categories(id),
  piece text,
  statut text not null default 'soumise' check (statut in ('soumise', 'validee', 'refusee', 'remboursee')),
  motif text,
  saisi_par uuid default auth.uid(),
  valide_par uuid,
  valide_le timestamptz,
  rembourse_le date,
  ecriture_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists tres_notes_frais_statut on public.tres_notes_frais (statut, created_at desc);

create table if not exists public.tres_journal (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  par uuid default auth.uid(),
  objet text not null,
  objet_id uuid,
  action text not null,
  details jsonb
);

-- Historique automatique
create or replace function public.tres_journaliser() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  insert into public.tres_journal (objet, objet_id, action, details)
  values (tg_table_name, r.id, lower(tg_op),
    case when tg_op = 'UPDATE' and tg_table_name = 'tres_notes_frais' then jsonb_build_object('statut', new.statut, 'avant', old.statut, 'montant', new.montant, 'objet', new.objet)
         when tg_table_name = 'tres_ecritures' then jsonb_build_object('libelle', r.libelle, 'montant', r.montant, 'date', r.date)
         when tg_table_name = 'tres_notes_frais' then jsonb_build_object('statut', r.statut, 'montant', r.montant, 'objet', r.objet)
         else jsonb_build_object('exercice', r.exercice, 'montant', r.montant) end);
  return r;
end $$;
drop trigger if exists tres_ecritures_journal on public.tres_ecritures;
create trigger tres_ecritures_journal after insert or update or delete on public.tres_ecritures for each row execute function public.tres_journaliser();
drop trigger if exists tres_notes_journal on public.tres_notes_frais;
create trigger tres_notes_journal after insert or update or delete on public.tres_notes_frais for each row execute function public.tres_journaliser();
drop trigger if exists tres_budget_journal on public.tres_budget;
create trigger tres_budget_journal after insert or update or delete on public.tres_budget for each row execute function public.tres_journaliser();

create or replace function public.tres_maj_date() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists tres_ecritures_maj on public.tres_ecritures;
create trigger tres_ecritures_maj before update on public.tres_ecritures for each row execute function public.tres_maj_date();

-- Une adhésion enregistrée (catégorie « adhesions » + membre) solde l'échéance du membre
create or replace function public.tres_adhesion_payee() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.membre_id is not null and new.montant > 0 and exists (select 1 from public.tres_categories c where c.id = new.categorie_id and c.systeme = 'adhesions') then
    update public.membres set adhesion_echeance = null where id = new.membre_id;
  end if;
  return new;
end $$;
drop trigger if exists tres_adhesion_payee_t on public.tres_ecritures;
create trigger tres_adhesion_payee_t after insert or update of categorie_id, membre_id on public.tres_ecritures for each row execute function public.tres_adhesion_payee();

-- Droits et règles d'accès
alter table public.tres_categories enable row level security;
alter table public.tres_ecritures enable row level security;
alter table public.tres_budget enable row level security;
alter table public.tres_notes_frais enable row level security;
alter table public.tres_journal enable row level security;
revoke all on public.tres_categories, public.tres_ecritures, public.tres_budget, public.tres_notes_frais, public.tres_journal from anon;
grant select, insert, update, delete on public.tres_categories, public.tres_ecritures, public.tres_budget, public.tres_notes_frais to authenticated;
grant select on public.tres_journal to authenticated;
grant all on public.tres_categories, public.tres_ecritures, public.tres_budget, public.tres_notes_frais, public.tres_journal to service_role;

create policy tres_cat_lecture on public.tres_categories for select to authenticated using (true);
create policy tres_cat_gestion on public.tres_categories for all to authenticated using (public.peut_gerer_tresorerie()) with check (public.peut_gerer_tresorerie());
create policy tres_ecr_gestion on public.tres_ecritures for all to authenticated using (public.peut_gerer_tresorerie()) with check (public.peut_gerer_tresorerie());
create policy tres_bud_gestion on public.tres_budget for all to authenticated using (public.peut_gerer_tresorerie()) with check (public.peut_gerer_tresorerie());
create policy tres_jrn_lecture on public.tres_journal for select to authenticated using (public.peut_gerer_tresorerie());
-- Notes de frais : chacun voit et dépose les siennes ; le trésorier et les admins gèrent tout
create policy tres_nf_lecture on public.tres_notes_frais for select to authenticated using (membre_id = (select auth.uid()) or public.peut_gerer_tresorerie());
create policy tres_nf_depot on public.tres_notes_frais for insert to authenticated with check (
  public.peut_gerer_tresorerie() or (membre_id = (select auth.uid()) and statut = 'soumise' and ecriture_id is null and valide_par is null));
create policy tres_nf_gestion on public.tres_notes_frais for update to authenticated using (public.peut_gerer_tresorerie()) with check (public.peut_gerer_tresorerie());
create policy tres_nf_retrait on public.tres_notes_frais for delete to authenticated using (public.peut_gerer_tresorerie() or (membre_id = (select auth.uid()) and statut = 'soumise'));

-- ===== Ajouts appliqués ensuite (même ordre que les migrations Supabase) =====

-- Budget par postes libres (comme l'ancienne appli) : un poste peut être rattaché à une catégorie (réalisé automatique)
-- ou à des écritures choisies à la main (ecriture_ids)
alter table public.tres_budget drop constraint if exists tres_budget_exercice_categorie_id_key;
alter table public.tres_budget alter column categorie_id drop not null;
alter table public.tres_budget add column if not exists poste text not null default '';
alter table public.tres_budget add column if not exists sens text not null default 'depense' check (sens in ('recette', 'depense'));
alter table public.tres_budget add column if not exists ecriture_ids uuid[] not null default '{}';
alter table public.tres_budget add column if not exists ordre int not null default 0;

-- Adhésions : 14 jours à partir de la première connexion (comptes sans candidature) ou de l'étape « essai » (candidats).
-- Les comptes déjà existants à la mise en place sont exemptés.
alter table public.membres add column if not exists premiere_connexion timestamptz;
alter table public.membres add column if not exists adhesion_echeance date;
alter table public.membres add column if not exists adhesion_exemptee boolean not null default false;
update public.membres set adhesion_exemptee = true, premiere_connexion = coalesce(derniere_connexion, created_at) where adhesion_exemptee = false;

create or replace function public.membres_premiere_connexion() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.premiere_connexion is null and new.derniere_connexion is not null then
    new.premiere_connexion := new.derniere_connexion;
    if not new.adhesion_exemptee and new.adhesion_echeance is null
       and not exists (select 1 from public.candidats c where c.membre_id = new.id) then
      new.adhesion_echeance := (new.derniere_connexion at time zone 'Europe/Paris')::date + 14;
    end if;
  end if;
  return new;
end $$;
create trigger membres_premiere_connexion_t before update of derniere_connexion on public.membres for each row execute function public.membres_premiere_connexion();

-- Catégories de départ
insert into public.tres_categories (nom, sens, ordre, systeme) values
  ('Adhésions', 'recette', 1, 'adhesions'), ('Dons', 'recette', 2, null), ('Subventions', 'recette', 3, null),
  ('Ventes et prestations', 'recette', 4, null), ('Autres recettes', 'recette', 9, null),
  ('Hébergement et site', 'depense', 11, null), ('Banque', 'depense', 12, null), ('Communication', 'depense', 13, null),
  ('Matériel', 'depense', 14, null), ('Déplacements', 'depense', 15, null), ('Événements', 'depense', 16, null),
  ('Assurance', 'depense', 17, null), ('Autres dépenses', 'depense', 19, null)
on conflict (nom) do nothing;

-- Pièces justificatives (bucket privé ; dossier = identifiant de la personne qui dépose)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tresorerie-pieces', 'tresorerie-pieces', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy tres_pieces_lecture on storage.objects for select to authenticated
  using (bucket_id = 'tresorerie-pieces' and (public.peut_gerer_tresorerie() or (storage.foldername(name))[1] = (select auth.uid())::text));
create policy tres_pieces_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'tresorerie-pieces' and (public.peut_gerer_tresorerie() or (storage.foldername(name))[1] = (select auth.uid())::text));
create policy tres_pieces_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'tresorerie-pieces' and (public.peut_gerer_tresorerie() or (storage.foldername(name))[1] = (select auth.uid())::text));

-- ===== Exercices et comptes (l'exercice va de juin à juin, pas de janvier à décembre) =====
create table if not exists public.tres_exercices (
  id uuid primary key default gen_random_uuid(), nom text not null, debut date not null, fin date not null,
  cloture boolean not null default false, solde_ouverture numeric(12,2) not null default 0, created_at timestamptz not null default now(),
  constraint tres_exercices_dates check (fin > debut), unique (debut));
create table if not exists public.tres_comptes (
  id uuid primary key default gen_random_uuid(), nom text not null unique,
  type text not null default 'courant' check (type in ('courant', 'epargne', 'caisse')),
  solde_ouverture numeric(12,2) not null default 0, ordre int not null default 0, actif boolean not null default true);
alter table public.tres_ecritures add column if not exists compte_id uuid references public.tres_comptes(id);
alter table public.tres_ecritures add column if not exists virement_ref uuid;     -- relie les deux côtés d'un virement interne
alter table public.tres_budget add column if not exists exercice_id uuid references public.tres_exercices(id);
alter table public.tres_categories drop constraint if exists tres_categories_sens_check;
alter table public.tres_categories add constraint tres_categories_sens_check check (sens in ('recette', 'depense', 'neutre'));
alter table public.tres_exercices enable row level security;
alter table public.tres_comptes enable row level security;
revoke all on public.tres_exercices, public.tres_comptes from anon;
grant select, insert, update, delete on public.tres_exercices, public.tres_comptes to authenticated;
grant all on public.tres_exercices, public.tres_comptes to service_role;
create policy tres_exo_lecture on public.tres_exercices for select to authenticated using (public.peut_gerer_tresorerie());
create policy tres_exo_gestion on public.tres_exercices for all to authenticated using (public.peut_gerer_tresorerie()) with check (public.peut_gerer_tresorerie());
create policy tres_cpt_lecture on public.tres_comptes for select to authenticated using (public.peut_gerer_tresorerie());
create policy tres_cpt_gestion on public.tres_comptes for all to authenticated using (public.peut_gerer_tresorerie()) with check (public.peut_gerer_tresorerie());
insert into public.tres_comptes (nom, type, ordre) values ('Compte courant Crédit Mutuel', 'courant', 1), ('Livret A', 'epargne', 2) on conflict (nom) do nothing;
insert into public.tres_exercices (nom, debut, fin, cloture, solde_ouverture) values
  ('Exercice février – juin 2026', '2026-02-21', '2026-06-17', true, 0),
  ('Exercice juin 2026 – juin 2027', '2026-06-18', '2027-06-17', false, 234.61) on conflict (debut) do nothing;
insert into public.tres_categories (nom, sens, ordre, systeme) values ('Virement interne', 'neutre', 20, 'transfert') on conflict (nom) do nothing;

-- Le journal lit les champs par to_jsonb : une même fonction sert les trois tables
create or replace function public.tres_journaliser() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare r record; j jsonb;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  j := to_jsonb(r);
  insert into public.tres_journal (objet, objet_id, action, details)
  values (tg_table_name, (j->>'id')::uuid, lower(tg_op),
    jsonb_strip_nulls(jsonb_build_object('libelle', j->'libelle', 'objet', j->'objet', 'poste', j->'poste', 'montant', j->'montant', 'date', j->'date',
      'statut', j->'statut', 'avant', case when tg_op = 'UPDATE' then to_jsonb(old)->'statut' else null end)));
  return r;
end $$;

-- Reprise de l'historique : tableurs « exercice février – juin 2026 » (clôturé, solde 234,61 €) et « exercice juin 2026 – 2027 » (solde au 5 octobre : 450,35 € + Livret A 30 €).
-- 54 écritures, source 'import_excel', import_ref 'excel:ex1:n' / 'excel:ex2:n' (déjà appliquées : ne pas relancer).
