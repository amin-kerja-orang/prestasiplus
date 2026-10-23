-- Proof of the least-privilege roles (cutover plan P3). Run by deploy/vps/db-roles.sh check (and after every
-- migrate in deploy.sh); tested by apps/api/test/ops/db-roles.spec.ts. Read-only: every probe runs in a
-- subtransaction that is always rolled back, so a probe that is (wrongly) allowed changes nothing.
--
-- Run it connected to the APPLICATION database as the bootstrap superuser, with the pp.role_* settings of apply.sql.
-- It defines pg_temp.pp_db_roles_check() and the caller selects from it. One row per probe:
--   result  PASS or FAIL;  role  owner | app | etl | stage;  probe  what was tried;  detail  the server's answer
-- Denials are proven by actually running the statement as the role (SET ROLE), not only by catalogue lookups.
-- Names, privileges and error texts only: no row data and no password is ever selected.
CREATE OR REPLACE FUNCTION pg_temp.pp_db_roles_check()
RETURNS TABLE (result text, role text, probe text, detail text)
LANGUAGE plpgsql AS $check$
DECLARE
  names  jsonb := jsonb_build_object(
    'owner', coalesce(current_setting('pp.role_owner', true), ''), 'app', coalesce(current_setting('pp.role_app', true), ''),
    'etl', coalesce(current_setting('pp.role_etl', true), ''), 'stage', coalesce(current_setting('pp.role_stage', true), ''));
  t      text;   -- an application table (users when it exists)
  k      text;
  n      text;
  v      text;
  stg    text;   -- a table in staging_cloud, when the schema exists
  arc    text;   -- a table in archive_cloud, when the schema exists
  -- probe list: role key, label, statement, expected outcome (allowed | denied)
  probes text[][];
  i      int;
  outcome text;
BEGIN
  PERFORM set_config('client_min_messages', 'warning', true);   -- no "drop cascades to" notices from the probes
  SELECT format('public.%I', c.relname) INTO t FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND c.relname <> '_prisma_migrations'
     AND EXISTS (SELECT 1 FROM pg_attribute at WHERE at.attrelid = c.oid AND at.attname = 'id' AND NOT at.attisdropped)
   ORDER BY (c.relname = 'users') DESC, c.relname LIMIT 1;
  SELECT format('staging_cloud.%I', c.relname) INTO stg FROM pg_class c
   WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'staging_cloud') AND c.relkind IN ('r', 'p') ORDER BY 1 LIMIT 1;
  SELECT format('archive_cloud.%I', c.relname) INTO arc FROM pg_class c
   WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'archive_cloud') AND c.relkind IN ('r', 'p') ORDER BY 1 LIMIT 1;

  -- ---- role attributes and memberships ----
  FOR k IN SELECT jsonb_object_keys(names) LOOP
    n := names ->> k;
    SELECT CASE WHEN r.rolname IS NULL THEN 'role missing'
                ELSE format('super=%s createdb=%s createrole=%s replication=%s bypassrls=%s login=%s memberships=%s',
                            r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls, r.rolcanlogin,
                            (SELECT count(*) FROM pg_auth_members am WHERE am.member = r.oid OR am.roleid = r.oid)) END
      INTO v FROM (SELECT 1) one LEFT JOIN pg_roles r ON r.rolname = n;
    RETURN QUERY SELECT CASE WHEN v = 'super=f createdb=f createrole=f replication=f bypassrls=f login=t memberships=0'
                             THEN 'PASS' ELSE 'FAIL' END, k, 'attributes ' || n, v;
  END LOOP;

  -- ---- privilege coverage over EVERY table and sequence in public (catalogue) ----
  FOREACH k IN ARRAY ARRAY['app', 'etl'] LOOP
    n := names ->> k;
    -- has_table_privilege with a list is true when ANY is held: test each privilege on its own.
    SELECT count(*) FILTER (WHERE NOT (has_table_privilege(n, c.oid, 'SELECT') AND has_table_privilege(n, c.oid, 'INSERT')
                                   AND has_table_privilege(n, c.oid, 'UPDATE') AND has_table_privilege(n, c.oid, 'DELETE'))) || ' of ' || count(*)
      INTO v FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p');
    RETURN QUERY SELECT CASE WHEN v LIKE '0 of %' AND v <> '0 of 0' THEN 'PASS' ELSE 'FAIL' END, k,
      'read/write on every public table', 'tables missing SELECT/INSERT/UPDATE/DELETE: ' || v;
    SELECT count(*) FILTER (WHERE NOT (has_sequence_privilege(n, c.oid, 'USAGE') AND has_sequence_privilege(n, c.oid, 'SELECT')
                                   AND has_sequence_privilege(n, c.oid, 'UPDATE'))) || ' of ' || count(*)
      INTO v FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'S';
    RETURN QUERY SELECT CASE WHEN v LIKE '0 of %' THEN 'PASS' ELSE 'FAIL' END, k,
      'usage/select/update on every public sequence', 'sequences missing a privilege: ' || v;
  END LOOP;
  SELECT count(*) || ' of ' || (SELECT count(*) FROM pg_class c2 WHERE c2.relnamespace = 'public'::regnamespace AND c2.relkind IN ('r', 'p', 'S'))
    INTO v FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'S') AND c.relowner <> (names ->> 'owner')::regrole;
  RETURN QUERY SELECT CASE WHEN v LIKE '0 of %' THEN 'PASS' ELSE 'FAIL' END, 'owner', 'owns every public table and sequence',
    'objects owned by another role: ' || v;
  SELECT pg_get_userbyid(d.datdba) INTO v FROM pg_database d WHERE d.datname = current_database();
  RETURN QUERY SELECT CASE WHEN v = names ->> 'owner' THEN 'PASS' ELSE 'FAIL' END, 'owner', 'owns the database', 'owner: ' || v;
  -- What the stage role creates must never become visible to the app role (default privileges).
  SELECT count(*)::text INTO v FROM pg_default_acl da, aclexplode(da.defaclacl) x
   WHERE x.grantee = (names ->> 'app')::regrole AND da.defaclrole <> (names ->> 'owner')::regrole;
  RETURN QUERY SELECT CASE WHEN v = '0' THEN 'PASS' ELSE 'FAIL' END, 'app', 'no default privileges from roles other than the owner',
    'entries: ' || v;

  -- ---- live probes: the statement is run as the role ----
  probes := ARRAY[
    ['app',   'SELECT on ' || t,                     format('SELECT 1 FROM %s LIMIT 1', t),                       'allowed'],
    ['app',   'INSERT/UPDATE/DELETE on ' || t,       format('INSERT INTO %1$s (id) OVERRIDING SYSTEM VALUE SELECT id FROM %1$s WHERE false; UPDATE %1$s SET id = DEFAULT WHERE false; DELETE FROM %1$s WHERE false', t), 'allowed'],
    ['app',   'CREATE TABLE in public',              'CREATE TABLE public.pp_role_probe (i int)',                   'denied'],
    ['app',   'DROP TABLE ' || t,                    format('DROP TABLE %s', t),                                    'denied'],
    ['app',   'ALTER TABLE ' || t,                   format('ALTER TABLE %s ADD COLUMN pp_role_probe int', t),      'denied'],
    ['app',   'TRUNCATE ' || t,                      format('TRUNCATE %s', t),                                      'denied'],
    ['app',   'CREATE SCHEMA',                       'CREATE SCHEMA pp_role_probe',                                 'denied'],
    ['app',   'CREATE TEMP TABLE',                   'CREATE TEMP TABLE pp_role_probe (i int)',                     'denied'],
    ['etl',   'INSERT/UPDATE/DELETE on ' || t,       format('INSERT INTO %1$s (id) OVERRIDING SYSTEM VALUE SELECT id FROM %1$s WHERE false; UPDATE %1$s SET id = DEFAULT WHERE false; DELETE FROM %1$s WHERE false', t), 'allowed'],
    ['etl',   'CREATE TEMP TABLE',                   'CREATE TEMP TABLE pp_role_probe (i int)',                     'allowed'],
    ['etl',   'CREATE TABLE in public',              'CREATE TABLE public.pp_role_probe (i int)',                   'denied'],
    ['etl',   'DROP TABLE ' || t,                    format('DROP TABLE %s', t),                                    'denied'],
    ['etl',   'CREATE SCHEMA',                       'CREATE SCHEMA pp_role_probe',                                 'denied'],
    ['stage', 'SELECT on ' || t,                     format('SELECT 1 FROM %s LIMIT 1', t),                         'denied'],
    ['stage', 'INSERT on ' || t,                     format('INSERT INTO %1$s (id) OVERRIDING SYSTEM VALUE SELECT id FROM %1$s WHERE false', t),  'denied'],
    ['stage', 'CREATE TABLE in public',              'CREATE TABLE public.pp_role_probe (i int)',                   'denied'],
    ['stage', 'CREATE SCHEMA (staging copy)',        'CREATE SCHEMA pp_role_probe',                                 'allowed'],
    ['owner', 'CREATE TABLE in public (migrations)', 'CREATE TABLE public.pp_role_probe (i int)',                   'allowed']
  ];
  IF stg IS NOT NULL THEN
    probes := probes || ARRAY[
      ['app',   'SELECT on ' || stg,                 format('SELECT 1 FROM %s LIMIT 1', stg),                       'denied'],
      ['etl',   'SELECT on ' || stg,                 format('SELECT 1 FROM %s LIMIT 1', stg),                       'allowed'],
      ['stage', 'DROP SCHEMA staging_cloud',         'DROP SCHEMA staging_cloud CASCADE',                           'allowed']];
  ELSE
    SELECT count(*)::text INTO v FROM pg_default_acl da, aclexplode(da.defaclacl) x
     WHERE da.defaclrole = (names ->> 'stage')::regrole AND x.grantee = (names ->> 'etl')::regrole;
    RETURN QUERY SELECT CASE WHEN v = '2' THEN 'PASS' ELSE 'FAIL' END, 'etl',
      'staging_cloud absent: default privileges from the stage role', 'entries for schemas and tables (expect 2): ' || v;
  END IF;
  IF arc IS NOT NULL THEN
    SELECT count(*) FILTER (WHERE NOT has_table_privilege(names ->> 'etl', c.oid, 'UPDATE')) || ' of ' || count(*)
      INTO v FROM pg_class c WHERE c.relnamespace = 'archive_cloud'::regnamespace AND c.relkind IN ('r', 'p');
    RETURN QUERY SELECT CASE WHEN v LIKE '0 of %' THEN 'PASS' ELSE 'FAIL' END, 'etl',
      'UPDATE on every archive_cloud table (migrate:archive-minimise)', 'tables missing UPDATE: ' || v;
    probes := probes || ARRAY[
      ['app',   'SELECT on ' || arc,                 format('SELECT 1 FROM %s LIMIT 1', arc),                       'denied'],
      ['etl',   'SELECT on ' || arc,                 format('SELECT 1 FROM %s LIMIT 1', arc),                       'allowed'],
      ['stage', 'DROP SCHEMA archive_cloud',         'DROP SCHEMA archive_cloud CASCADE',                           'allowed']];
  END IF;

  FOR i IN 1 .. array_length(probes, 1) LOOP
    BEGIN
      PERFORM set_config('role', names ->> probes[i][1], true);
      EXECUTE probes[i][3];
      RAISE EXCEPTION 'pp-probe-allowed';
    EXCEPTION
      WHEN insufficient_privilege THEN outcome := 'denied: ' || SQLERRM;
      WHEN raise_exception THEN outcome := CASE WHEN SQLERRM = 'pp-probe-allowed' THEN 'allowed' ELSE 'error: ' || SQLERRM END;
      WHEN OTHERS THEN outcome := 'error: ' || SQLSTATE || ' ' || SQLERRM;
    END;
    RETURN QUERY SELECT CASE WHEN split_part(outcome, ':', 1) = probes[i][4] THEN 'PASS' ELSE 'FAIL' END,
      probes[i][1], probes[i][2] || ' -> expect ' || probes[i][4], outcome;
  END LOOP;
END
$check$;
