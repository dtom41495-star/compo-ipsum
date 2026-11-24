-- Inscriptions publiques (inscription.html → fonction agenda-inscription-externe) : doublons, places, fréquence.
--  - une seule inscription par événement et par adresse email (insensible à la casse) ;
--  - le contrôle « complet », le contrôle des doublons et la limite de fréquence (30 inscriptions par heure et par événement) et l'insertion se font
--    ensemble, sous verrou par événement : deux inscriptions simultanées ne dépassent plus le nombre de places ;
--  - la fonction n'est appelable que par le serveur (service_role), jamais depuis un navigateur.
-- Retour en arrière : drop function public.agenda_inscrire_externe(uuid, text, text, text);
--                     drop index if exists public.agenda_inscriptions_externes_evt_email;

create unique index if not exists agenda_inscriptions_externes_evt_email
  on public.agenda_inscriptions_externes (evenement_id, lower(email));

create or replace function public.agenda_inscrire_externe(p_evenement uuid, p_nom text, p_email text, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int; v_membres int; v_externes int; v_recentes int;
begin
  perform pg_advisory_xact_lock(hashtext('inscr_ext_' || p_evenement::text));
  select places_max into v_max from public.agenda_evenements where id = p_evenement;

  select count(*) into v_recentes from public.agenda_inscriptions_externes
    where evenement_id = p_evenement and created_at > now() - interval '1 hour';
  if v_recentes >= 30 then return jsonb_build_object('statut', 'limite'); end if;

  if exists (select 1 from public.agenda_inscriptions_externes where evenement_id = p_evenement and lower(email) = lower(p_email)) then
    return jsonb_build_object('statut', 'doublon');
  end if;

  if v_max is not null then
    select count(*) into v_membres from public.agenda_inscriptions where evenement_id = p_evenement and statut <> 'refuse';
    select count(*) into v_externes from public.agenda_inscriptions_externes where evenement_id = p_evenement;
    if v_membres + v_externes >= v_max then return jsonb_build_object('statut', 'complet'); end if;
  end if;

  insert into public.agenda_inscriptions_externes (evenement_id, nom, email, message) values (p_evenement, p_nom, p_email, p_message);
  return jsonb_build_object('statut', 'ok', 'recentes', v_recentes + 1);
end;
$$;

revoke all on function public.agenda_inscrire_externe(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.agenda_inscrire_externe(uuid, text, text, text) to service_role;
