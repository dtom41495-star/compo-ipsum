-- Co-écriture d'un article (labo/coedition/?article=<id>, js/49-coecriture.js)
--
-- Jamais par défaut : l'auteur·rice d'un article enregistré et encore en brouillon invite un membre, de n'importe
-- quelle rédaction. Une fois l'invitation acceptée, l'invité·e est co-signataire et peut modifier le titre, le chapô
-- et le texte, tant que l'article est en brouillon (plus rien dès l'envoi au SR ; de nouveau s'il est renvoyé).
-- Les droits de l'invité·e viennent de l'invitation, pas de sa rédaction : rien ne change dans ses rédactions,
-- et il ou elle ne peut ni changer le statut, ni envoyer au SR, ni supprimer, ni inviter à son tour.
-- Tout passe par les fonctions ci-dessous : aucune règle n'ouvre la table des articles aux invités.
--
-- À lancer une fois ; sans danger si relancé (le relancer après une mise à jour de ce fichier).

-- Co-signature : noms des co-auteur·rices acceptés, tenus à jour par les fonctions (affichés après l'auteur·rice)
alter table public.articles add column if not exists cosignataires text;

create table if not exists public.articles_coauteurs (
  article_id  text not null,
  membre_id   uuid not null,
  invite_par  uuid not null,
  statut      text not null default 'en_attente' check (statut in ('en_attente', 'accepte', 'refuse', 'retire')),
  cree_le     timestamptz not null default now(),
  repondu_le  timestamptz,
  primary key (article_id, membre_id)
);
create index if not exists articles_coauteurs_membre on public.articles_coauteurs (membre_id);

-- Où en est le texte partagé : état Yjs, « génération » (change quand l'article a été modifié en dehors de la
-- co-écriture : on repart alors de l'article) et date de l'article qui correspond à cet état.
create table if not exists public.articles_coecriture (
  article_id     text primary key,
  etat           text not null,
  generation     bigint not null,
  article_maj_le timestamptz,
  maj_le         timestamptz not null default now(),
  maj_par        uuid
);

-- L'auteur·rice ou un·e co-auteur·rice accepté·e
create or replace function public.coecriture_participant(p_article text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.articles a where a.id::text = p_article and a.auteur_id = auth.uid())
      or exists (select 1 from public.articles_coauteurs c where c.article_id = p_article and c.membre_id = auth.uid() and c.statut = 'accepte');
$$;

-- Invité·e (en attente ou accepté·e) : sert à écarter cette personne de la relecture de l'article
create or replace function public.coecriture_est_coauteur(p_article text, p_membre uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.articles_coauteurs c
                 where c.article_id = p_article and c.membre_id = p_membre and c.statut in ('en_attente', 'accepte'));
$$;

-- Recalcule la co-signature. Si l'article change de date à cette occasion, l'état partagé suit, pour que la
-- co-écriture en cours ne croie pas l'article modifié ailleurs.
create or replace function public.coecriture_maj_signature(p_article text) returns void
language plpgsql security definer set search_path = public as $$
declare v_avant timestamptz; v_apres timestamptz;
begin
  select updated_at into v_avant from public.articles where id::text = p_article for update;
  update public.articles set cosignataires = (
    select string_agg(trim(coalesce(m.prenom, '') || ' ' || coalesce(m.nom, '')), ', ' order by c.repondu_le, c.cree_le)
    from public.articles_coauteurs c join public.membres m on m.id = c.membre_id
    where c.article_id = p_article and c.statut = 'accepte'
  ) where id::text = p_article
  returning updated_at into v_apres;
  if v_apres is distinct from v_avant then
    update public.articles_coecriture set article_maj_le = v_apres
    where article_id = p_article and article_maj_le is not distinct from v_avant;
  end if;
end $$;
revoke execute on function public.coecriture_maj_signature(text) from public, anon, authenticated;

-- Étape de co-écriture dans l'historique de l'article (invitation, acceptation, refus, retrait, départ).
-- Ne bloque jamais l'action elle-même : si la ligne ne peut pas être notée, on passe.
create or replace function public.coecriture_historique(p_article text, p_action text, p_coauteur uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_id public.articles.id%type; v_qui text; v_co text;
begin
  select id into v_id from public.articles where id::text = p_article;
  select trim(coalesce(prenom, '') || ' ' || coalesce(nom, '')) into v_qui from public.membres where id = auth.uid();
  select trim(coalesce(prenom, '') || ' ' || coalesce(nom, '')) into v_co from public.membres where id = p_coauteur;
  insert into public.historique (article_id, action, auteur, details)
  values (v_id, p_action, coalesce(v_qui, ''), jsonb_build_object('coauteur', v_co, 'coauteur_id', p_coauteur));
exception when others then
  raise warning 'Historique de co-écriture non noté : %', sqlerrm;
end $$;
revoke execute on function public.coecriture_historique(text, text, uuid) from public, anon, authenticated;

create or replace function public.coecriture_inviter(p_article text, p_membre uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select id, auteur_id, statut into a from public.articles where id::text = p_article;
  if not found then raise exception 'Article introuvable'; end if;
  if a.auteur_id is distinct from auth.uid() then raise exception 'Seul·e l''auteur·rice de l''article peut inviter'; end if;
  if coalesce(a.statut, 'brouillon') <> 'brouillon' then raise exception 'L''article n''est plus en écriture'; end if;
  if p_membre = a.auteur_id then raise exception 'Tu ne peux pas t''inviter toi-même'; end if;
  if not exists (select 1 from public.membres where id = p_membre) then raise exception 'Membre introuvable'; end if;
  insert into public.articles_coauteurs (article_id, membre_id, invite_par)
  values (p_article, p_membre, auth.uid())
  on conflict (article_id, membre_id) do update
    set statut = 'en_attente', invite_par = excluded.invite_par, cree_le = now(), repondu_le = null
    where public.articles_coauteurs.statut in ('refuse', 'retire');
  perform public.coecriture_historique(p_article, 'coecriture_invitation', p_membre);
end $$;

create or replace function public.coecriture_repondre(p_article text, p_accepte boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.articles_coauteurs
     set statut = case when p_accepte then 'accepte' else 'refuse' end, repondu_le = now()
   where article_id = p_article and membre_id = auth.uid() and statut = 'en_attente';
  if not found then raise exception 'Pas d''invitation en attente pour cet article'; end if;
  if p_accepte then perform public.coecriture_maj_signature(p_article); end if;
  perform public.coecriture_historique(p_article, case when p_accepte then 'coecriture_acceptee' else 'coecriture_refusee' end, auth.uid());
end $$;

-- L'auteur·rice retire un·e invité·e, ou l'invité·e se retire (quitter)
create or replace function public.coecriture_retirer(p_article text, p_membre uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_avant text;
begin
  if not (p_membre = auth.uid() or public.est_admin()
          or exists (select 1 from public.articles a where a.id::text = p_article and a.auteur_id = auth.uid())) then
    raise exception 'Seul·e l''auteur·rice peut retirer un·e co-auteur·rice';
  end if;
  select statut into v_avant from public.articles_coauteurs where article_id = p_article and membre_id = p_membre;
  update public.articles_coauteurs set statut = 'retire', repondu_le = now()
   where article_id = p_article and membre_id = p_membre and statut in ('en_attente', 'accepte');
  if not found then return; end if;
  perform public.coecriture_maj_signature(p_article);
  perform public.coecriture_historique(p_article,
    case when p_membre = auth.uid() then 'coecriture_depart' when v_avant = 'en_attente' then 'coecriture_annulation' else 'coecriture_retrait' end,
    p_membre);
end $$;

-- Enregistre le texte écrit à plusieurs dans l'article. Refusé si l'article n'est plus en brouillon (« ferme ») ou s'il a
-- été modifié en dehors de la co-écriture depuis que cet état a été pris (« modifie_ailleurs ») : la page repart alors
-- de la version de l'article, plutôt que d'écraser ce que quelqu'un d'autre y a fait.
create or replace function public.coecriture_enregistrer(
  p_article text, p_generation bigint, p_base timestamptz,
  p_titre text, p_chapeau text, p_corps text, p_etat text
) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare a record; v_gen bigint; v_etat_maj timestamptz; v_base timestamptz; v_maj timestamptz;
begin
  if not public.coecriture_participant(p_article) then raise exception 'Tu ne fais pas partie de la co-écriture de cet article'; end if;
  select id, statut, updated_at into a from public.articles where id::text = p_article for update;
  if not found then raise exception 'Article introuvable'; end if;
  if coalesce(a.statut, 'brouillon') <> 'brouillon' then raise exception 'ferme'; end if;
  select generation, article_maj_le into v_gen, v_etat_maj from public.articles_coecriture where article_id = p_article;
  -- Même génération : la référence est la date enregistrée avec l'état ; sinon, celle de l'article dont la page est partie
  v_base := case when v_gen = p_generation then v_etat_maj else p_base end;
  if a.updated_at is distinct from v_base then raise exception 'modifie_ailleurs'; end if;
  update public.articles set titre = coalesce(p_titre, ''), chapeau = coalesce(p_chapeau, ''), corps = coalesce(p_corps, ''), updated_at = now()
   where id = a.id returning updated_at into v_maj;
  insert into public.articles_coecriture (article_id, etat, generation, article_maj_le, maj_le, maj_par)
  values (p_article, p_etat, p_generation, v_maj, now(), auth.uid())
  on conflict (article_id) do update set etat = excluded.etat, generation = excluded.generation,
    article_maj_le = excluded.article_maj_le, maj_le = now(), maj_par = auth.uid();
  return v_maj;
end $$;

grant execute on function public.coecriture_inviter(text, uuid), public.coecriture_repondre(text, boolean),
  public.coecriture_retirer(text, uuid), public.coecriture_enregistrer(text, bigint, timestamptz, text, text, text, text),
  public.coecriture_participant(text), public.coecriture_est_coauteur(text, uuid) to authenticated;

-- Lecture seulement : les écritures passent par les fonctions
alter table public.articles_coauteurs enable row level security;
drop policy if exists coauteurs_lecture on public.articles_coauteurs;
create policy coauteurs_lecture on public.articles_coauteurs for select to authenticated
  using (membre_id = auth.uid() or invite_par = auth.uid() or public.coecriture_participant(article_id) or public.est_admin());

alter table public.articles_coecriture enable row level security;
drop policy if exists coecriture_lecture on public.articles_coecriture;
create policy coecriture_lecture on public.articles_coecriture for select to authenticated
  using (public.coecriture_participant(article_id));

-- Canal temps réel privé « coecriture:<article>:<génération> » : réservé aux participant·es
drop policy if exists coecriture_canal_lire on realtime.messages;
create policy coecriture_canal_lire on realtime.messages for select to authenticated
  using (realtime.topic() like 'coecriture:%' and public.coecriture_participant(split_part(realtime.topic(), ':', 2)));
drop policy if exists coecriture_canal_ecrire on realtime.messages;
create policy coecriture_canal_ecrire on realtime.messages for insert to authenticated
  with check (realtime.topic() like 'coecriture:%' and public.coecriture_participant(split_part(realtime.topic(), ':', 2)));

-- Un·e co-auteur·rice ne prend pas son propre article dans la file du SR (même règle que pour l'auteur·rice)
drop policy if exists "SR prend dans la file" on public.articles;
create policy "SR prend dans la file" on public.articles for update to authenticated
  using (statut = 'en-relecture' and correcteur_id is null and public.peut_relire(redaction_id)
         and not public.coecriture_est_coauteur(id::text, auth.uid()))
  with check (correcteur_id = auth.uid());
