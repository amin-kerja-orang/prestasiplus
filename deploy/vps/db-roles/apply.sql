-- Least-privilege PostgreSQL roles for production (cutover plan P3). Run by deploy/vps/db-roles.sh apply.
-- Runbook: docs/ops/production-vps.md section 3.1. Tested by apps/api/test/ops/db-roles.spec.ts.
--
-- Run it connected to the APPLICATION database as the bootstrap superuser (POSTGRES_USER of db.env), after setting:
--   SET pp.role_owner = '...'; SET pp.role_app = '...'; SET pp.role_etl = '...'; SET pp.role_stage = '...';
-- It is idempotent: every run brings the roles, ownership and grants back to the state below. No password is set
-- here (db-roles.sh sets them afterwards from the env files, with statement logging off).
--
--   owner  schema owner: owns the database, schema public and every object in it. Used ONLY by the one-shot
--          `migrate` service (prisma migrate deploy, the reference seed). The only role with DDL in public.
--   app    the API: CONNECT, USAGE on public, SELECT/INSERT/UPDATE/DELETE on all tables, USAGE/SELECT/UPDATE on all
--          sequences, and the same on every table or sequence the owner creates later (default privileges).
--          No DDL, no TEMP, nothing on staging_cloud or archive_cloud.
--   etl    the migration role of `migrate:*` (slot.sh etl): the app grants plus TEMP (the ETL upsert uses temporary
--          tables); USAGE and SELECT on staging_cloud and archive_cloud, UPDATE on archive_cloud
--          (migrate:archive-minimise). No DDL in public.
--   stage  the stage-only role (slot.sh copy, the section 7 drops): CONNECT and CREATE on the database, so it can
--          create staging_cloud and archive_cloud and, as their owner, drop them. Nothing on public. No password:
--          it can only connect over the db container's local socket (docker exec), never over the network.
-- None of them is a superuser or has CREATEDB, CREATEROLE, REPLICATION or BYPASSRLS, and none is a member of any role.
DO $apply$
DECLARE
  o    text := coalesce(current_setting('pp.role_owner', true), '');
  a    text := coalesce(current_setting('pp.role_app', true), '');
  e    text := coalesce(current_setting('pp.role_etl', true), '');
  s    text := coalesce(current_setting('pp.role_stage', true), '');
  boot text := current_user;
  db   text := current_database();
  n    text;
  sch  text;
  r    record;
BEGIN
  IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'apply.sql must run as the bootstrap superuser (POSTGRES_USER), not as %', current_user;
  END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(ARRAY[o, a, e, s, boot]) x) <> 5 OR '' IN (o, a, e, s) THEN
    RAISE EXCEPTION 'the four role names must be set, different from each other and from the bootstrap role';
  END IF;

  -- ---- roles: create, force the attributes, strip every membership in both directions ----
  FOREACH n IN ARRAY ARRAY[o, a, e, s] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = n) THEN
      EXECUTE format('CREATE ROLE %I', n);
    END IF;
    EXECUTE format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT', n);
    FOR r IN
      SELECT g.rolname AS grp, m.rolname AS mem, gr.rolname AS grantor
      FROM pg_auth_members am
      JOIN pg_roles g ON g.oid = am.roleid
      JOIN pg_roles m ON m.oid = am.member
      JOIN pg_roles gr ON gr.oid = am.grantor
      WHERE g.rolname = n OR m.rolname = n
    LOOP
      EXECUTE format('REVOKE %I FROM %I GRANTED BY %I', r.grp, r.mem, r.grantor);
    END LOOP;
  END LOOP;
  EXECUTE format('ALTER ROLE %I PASSWORD NULL', s);   -- local socket only

  -- ---- database ----
  EXECUTE format('ALTER DATABASE %I OWNER TO %I', db, o);
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC, %I, %I, %I', db, a, e, s);
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I, %I, %I', db, a, e, s);
  EXECUTE format('GRANT TEMPORARY ON DATABASE %I TO %I', db, e);
  EXECUTE format('GRANT CREATE ON DATABASE %I TO %I', db, s);

  -- ---- schema public ----
  EXECUTE format('REVOKE ALL ON SCHEMA public FROM PUBLIC, %I, %I, %I', a, e, s);
  EXECUTE format('GRANT USAGE, CREATE ON SCHEMA public TO %I', o);
  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I, %I', a, e);

  -- ---- objects in public created by the bootstrap role (an earlier migrate as superuser, or a restore) -> owner ----
  -- Extension members (pgcrypto functions) stay with the extension. Partitions are their own rows; identity and
  -- serial sequences follow their table, so the sequence loop only sees the standalone ones.
  FOR r IN
    SELECT c.oid::regclass AS obj, c.relkind
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relowner = boot::regrole AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('ALTER %s %s OWNER TO %I',
      CASE r.relkind WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' WHEN 'f' THEN 'FOREIGN TABLE' ELSE 'TABLE' END, r.obj, o);
  END LOOP;
  FOR r IN
    SELECT c.oid::regclass AS obj
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relowner = boot::regrole AND c.relkind = 'S'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype IN ('e', 'a', 'i'))
  LOOP
    EXECUTE format('ALTER SEQUENCE %s OWNER TO %I', r.obj, o);
  END LOOP;
  FOR r IN
    SELECT t.oid::regtype AS obj, t.typtype
    FROM pg_type t
    WHERE t.typnamespace = 'public'::regnamespace AND t.typowner = boot::regrole AND t.typtype IN ('e', 'd')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('ALTER %s %s OWNER TO %I', CASE r.typtype WHEN 'd' THEN 'DOMAIN' ELSE 'TYPE' END, r.obj, o);
  END LOOP;
  FOR r IN
    SELECT p.oid::regprocedure AS obj
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proowner = boot::regrole
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('ALTER ROUTINE %s OWNER TO %I', r.obj, o);
  END LOOP;

  -- ---- grants in public: exact state (revoke, then grant) ----
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, %I, %I, %I', a, e, s);
  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, %I, %I, %I', a, e, s);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I, %I', a, e);
  EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO %I, %I', a, e);
  -- Tables and sequences of later migrations (created by the owner role) get the same grants automatically.
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I, %I', o, a, e);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I, %I', o, a, e);

  -- ---- stage schemas ----
  -- What the stage role creates (pg_restore --no-acl in slot.sh copy) is readable by the migration role at once, and
  -- by nobody else. Default privileges are per creating role, so the app role never gets anything here.
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I GRANT USAGE ON SCHEMAS TO %I', s, e);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I GRANT SELECT ON TABLES TO %I', s, e);
  FOREACH sch IN ARRAY ARRAY['staging_cloud', 'archive_cloud'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = sch);
    -- A copy made by another role (an older slot.sh ran as the superuser): hand it to the stage role so the
    -- section 7 drop works without the superuser.
    EXECUTE format('ALTER SCHEMA %I OWNER TO %I', sch, s);
    FOR r IN
      SELECT c.oid::regclass AS obj, c.relkind
      FROM pg_class c
      WHERE c.relnamespace = sch::regnamespace AND c.relowner <> s::regrole AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype IN ('e', 'a', 'i'))
    LOOP
      EXECUTE format('ALTER %s %s OWNER TO %I',
        CASE r.relkind WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' WHEN 'S' THEN 'SEQUENCE' ELSE 'TABLE' END, r.obj, s);
    END LOOP;
    EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC, %I, %I', sch, a, e);
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', sch, e);
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM PUBLIC, %I, %I', sch, a, e);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM PUBLIC, %I, %I', sch, a, e);
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO %I', sch, e);
    IF sch = 'archive_cloud' THEN
      EXECUTE format('GRANT UPDATE ON ALL TABLES IN SCHEMA %I TO %I', sch, e);
    END IF;
  END LOOP;
END
$apply$;
