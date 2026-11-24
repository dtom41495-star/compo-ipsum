-- Sécurité des articles : trois trous fermés (novembre 2026)
--  1. Un SR « global » (membres.role = 'correcteur') pouvait modifier et voir à relire les articles de TOUTES les rédactions :
--     il faut en plus qu'il soit lié à la rédaction de l'article (membres_redactions). L'admin garde tout.
--  2. Un membre bloqué (role « interdit » ou actif = false) gardait la lecture et l'écriture tant que son jeton de connexion
--     (jusqu'à 1 h) n'avait pas expiré : une règle restrictive le coupe sur tous les accès aux articles.
--  3. Tout membre connecté pouvait créer un article avec l'auteur et la rédaction de son choix : la création exige
--     auteur = soi-même et une rédaction dont on est membre (ou sans rédaction). L'admin peut tout créer.

create or replace function public.membre_actif() returns boolean
  language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.membres where id = auth.uid() and actif is not false and role <> 'interdit');
$$;

create or replace function public.est_lie_redac(redac uuid) returns boolean
  language sql stable security definer set search_path to 'public' as $$
  select redac is not null and exists (select 1 from public.membres_redactions where membre_id = auth.uid() and redaction_id = redac);
$$;

create or replace function public.peut_relire(redac uuid) returns boolean
  language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from membres m where m.id = auth.uid() and m.role = 'admin')
      or exists (select 1 from membres m where m.id = auth.uid() and m.role = 'correcteur' and public.est_lie_redac(redac))
      or exists (select 1 from membres_redactions l where l.membre_id = auth.uid() and l.redaction_id = redac
                 and (l.role_redac = 'correcteur' or (l.role_redac = 'redac_chef' and l.aussi_sr)));
$$;

-- 2. Membre bloqué : plus rien sur les articles (lecture, création, modification, suppression)
drop policy if exists "membre_actif_articles" on public.articles;
create policy "membre_actif_articles" on public.articles as restrictive for all to authenticated
  using ((select public.membre_actif())) with check ((select public.membre_actif()));

-- 3. Création : soi-même comme auteur, dans une de ses rédactions
drop policy if exists "Creer article" on public.articles;
create policy "Creer article" on public.articles for insert to authenticated
  with check (
    (select public.est_admin())
    or (auteur_id = auth.uid() and (redaction_id is null or (select public.est_lie_redac(redaction_id))))
  );

-- 1. Modification : l'auteur, l'admin, ou un SR global lié à la rédaction de l'article
drop policy if exists "Modifier article" on public.articles;
create policy "Modifier article" on public.articles for update to authenticated
  using (
    auteur_id = auth.uid()
    or (select public.est_admin())
    or (exists (select 1 from public.membres m where m.id = auth.uid() and m.role = 'correcteur') and (select public.est_lie_redac(redaction_id)))
  );
