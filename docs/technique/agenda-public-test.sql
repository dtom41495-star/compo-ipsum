-- TEST de l'agenda public : à coller dans l'éditeur SQL de Supabase puis « Run ». Tout s'annule à la fin (message d'erreur « RESULTAT… » = c'est normal).
-- Il ne crée rien de durable. Copier-coller le message affiché à Claude.
do $outer$
declare r1 jsonb; r2 jsonb; r3 jsonb; r4 jsonb; r5 jsonb; id1 uuid; slug1 text; n_site int; n_anon int; n_site_anon int; v_err text;
begin
create table if not exists public.agenda_public (
  id uuid primary key default gen_random_uuid(),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'accepte', 'refuse')),
  edition text not null check (edition in ('tarn', 'haute-garonne')),
  titre text not null check (char_length(titre) between 3 and 120),
  categorie text not null check (categorie in ('concert', 'sport', 'culture', 'marche_fete', 'reunion_publique', 'autre')),
  description text check (description is null or char_length(description) <= 2000),
  date_debut timestamptz not null,
  date_fin timestamptz,
  lieu text not null check (char_length(lieu) between 2 and 160),
  commune text not null check (char_length(commune) between 2 and 80),
  lien text check (lien is null or (char_length(lien) <= 300 and lien ~* '^https?://')),
  photo text,
  organisateur_nom text not null check (char_length(organisateur_nom) between 2 and 120),
  organisateur_email text not null check (char_length(organisateur_email) <= 254 and organisateur_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  slug text unique,
  sujet_id text,
  note_equipe text,
  traite_par uuid,
  traite_le timestamptz,
  ip_h text,
  cree_le timestamptz not null default now(),
  check (date_fin is null or date_fin >= date_debut)
);
create index if not exists agenda_public_statut_date on public.agenda_public (statut, date_debut);
create index if not exists agenda_public_ip on public.agenda_public (ip_h, cree_le);
create index if not exists agenda_public_email on public.agenda_public (lower(organisateur_email), cree_le);

alter table public.agenda_public enable row level security;

drop policy if exists agenda_public_equipe on public.agenda_public;
create policy agenda_public_equipe on public.agenda_public for all to authenticated
  using (est_admin() or est_vie_asso() or _est_un_chef())
  with check (est_admin() or est_vie_asso() or _est_un_chef());


create or replace function public.agenda_public_acceptation() returns trigger language plpgsql set search_path = public as $$
begin
  if new.statut is distinct from old.statut then
    new.traite_le := now();
    if auth.uid() is not null then new.traite_par := auth.uid(); end if;
  end if;
  if new.statut = 'accepte' and new.slug is null then
    new.slug := left(public.site_slugifier(new.titre), 60) || '-' || to_char(new.date_debut at time zone 'Europe/Paris', 'YYYYMMDD') || '-' || substr(new.id::text, 1, 4);
  end if;
  return new;
end $$;
drop trigger if exists agenda_public_acceptation on public.agenda_public;
create trigger agenda_public_acceptation before update on public.agenda_public for each row execute function public.agenda_public_acceptation();


create or replace function public.site_agenda() returns table (
  slug text, edition text, titre text, categorie text, description text, date_debut timestamptz, date_fin timestamptz,
  lieu text, commune text, lien text, photo text
) language sql stable security definer set search_path = public as $$
  select slug, edition, titre, categorie, description, date_debut, date_fin, lieu, commune, lien, photo
  from public.agenda_public
  where statut = 'accepte' and slug is not null and coalesce(date_fin, date_debut + interval '3 hours') >= now()
  order by date_debut asc
  limit 500;
$$;
grant execute on function public.site_agenda() to anon, authenticated;



create or replace function public.agenda_proposer(
  p_edition text, p_titre text, p_categorie text, p_description text, p_debut timestamptz, p_fin timestamptz,
  p_lieu text, p_commune text, p_lien text, p_photo text, p_nom text, p_email text, p_ip_h text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_debut < now() - interval '1 hour' or p_debut > now() + interval '6 months' then return jsonb_build_object('statut', 'date'); end if;
  if (select count(*) from public.agenda_public where ip_h = p_ip_h and cree_le > now() - interval '1 hour') >= 3 then return jsonb_build_object('statut', 'limite'); end if;
  if (select count(*) from public.agenda_public where lower(organisateur_email) = lower(p_email) and cree_le > now() - interval '1 day') >= 2 then return jsonb_build_object('statut', 'limite'); end if;
  if (select count(*) from public.agenda_public where statut = 'en_attente') >= 200 then return jsonb_build_object('statut', 'limite'); end if;
  insert into public.agenda_public (edition, titre, categorie, description, date_debut, date_fin, lieu, commune, lien, photo, organisateur_nom, organisateur_email, ip_h)
  values (p_edition, trim(p_titre), p_categorie, nullif(trim(p_description), ''), p_debut, p_fin, trim(p_lieu), trim(p_commune), nullif(trim(p_lien), ''), p_photo, trim(p_nom), trim(p_email), p_ip_h)
  returning id into v_id;
  return jsonb_build_object('statut', 'ok', 'id', v_id);
end $$;
revoke all on function public.agenda_proposer(text,text,text,text,timestamptz,timestamptz,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.agenda_proposer(text,text,text,text,timestamptz,timestamptz,text,text,text,text,text,text,text) to service_role;



perform cron.schedule('agenda-public-purge', '50 3 * * *', $c$ select public._appel_fonction('agenda-public-purger', 60000) $c$);

  r1 := public.agenda_proposer('tarn','Concert de test','concert','Une description',now()+interval '10 days',null,'Salle des fetes','Albi',null,null,'Test Orga','orga@example.org','iph1');
  id1 := (r1->>'id')::uuid;
  r2 := public.agenda_proposer('tarn','Autre','sport',null,now()+interval '11 days',null,'Stade','Castres',null,null,'Test Orga','orga2@example.org','iph1');
  r3 := public.agenda_proposer('tarn','Encore','sport',null,now()+interval '12 days',null,'Stade','Castres',null,null,'Test Orga','orga3@example.org','iph1');
  r4 := public.agenda_proposer('tarn','Quatrieme','sport',null,now()+interval '12 days',null,'Stade','Castres',null,null,'Test Orga','orga4@example.org','iph1');
  r5 := public.agenda_proposer('tarn','Trop loin','sport',null,now()+interval '2 years',null,'Stade','Castres',null,null,'Test Orga','orga5@example.org','iph9');
  update public.agenda_public set statut='accepte' where id=id1;
  select slug into slug1 from public.agenda_public where id=id1;
  select count(*) into n_site from public.site_agenda();
  set local role anon;
  select count(*) into n_anon from public.agenda_public;
  select count(*) into n_site_anon from public.site_agenda();
  begin
    perform public.agenda_proposer('tarn','x','sport',null,now(),null,'x','x',null,null,'x','x@x.org','i');
  exception when others then v_err := sqlerrm; end;
  reset role;
  raise exception 'RESULTAT (rien n''est conserve) : envoi1=% envoi2=% envoi3=% envoi4(limite attendue)=% envoi5(date trop lointaine)=% slug=% visibles_sur_le_site=% lignes_lues_par_le_public(0 attendu)=% site_agenda_public=% appel_direct_public_refuse=%', r1->>'statut', r2->>'statut', r3->>'statut', r4->>'statut', r5->>'statut', slug1, n_site, n_anon, n_site_anon, v_err;
end $outer$;
