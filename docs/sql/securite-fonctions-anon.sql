-- Appliqué le 2026-10-24 (migration « securite_retirer_acces_anon_fonctions_definer »).
-- Les fonctions SECURITY DEFINER du schéma public ne sont plus appelables par les visiteurs non connectés (rôle anon).
-- Exceptions : est_admin() et en_maintenance(), évaluées par les règles d'accès « maintenance_* » ouvertes à anon.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname not in ('est_admin','en_maintenance')
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;
