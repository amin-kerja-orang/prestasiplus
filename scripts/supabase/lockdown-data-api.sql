-- Supabase lockdown for the PrestasiPlus demo database (run ONCE, after the migrations, in the
-- Supabase SQL editor or with psql as the `postgres` role). Idempotent: safe to re-run.
--
-- Why: Supabase exposes the `public` schema through its Data API (PostgREST/GraphQL) to anyone who
-- holds the PUBLIC anon key, and by default grants the API roles `anon` and `authenticated` full
-- rights on every new table in `public`. Our tables have no Row Level Security, so without this
-- step student data would be readable (and writable) through the Data API.
--
-- `service_role` is included as defence in depth: the app never uses the service_role key.
--
-- Effect on the app: none. The NestJS API connects as `postgres` (session pooler user
-- `postgres.<project-ref>`), owns every table and keeps all of its rights. Only the Data API roles
-- lose access. Do this IN ADDITION to switching the Data API off in the dashboard (runbook step 3).

BEGIN;

-- 1. Existing objects (tables, views, sequences, functions created by the migrations).
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, service_role;

-- 2. Objects that later migrations create (they run as `postgres`): no automatic grants any more.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;

-- 3. The API roles cannot even resolve names in `public` any more.
REVOKE USAGE ON SCHEMA public FROM anon, authenticated, service_role;

COMMIT;

-- Verify (both must hold):
--   SELECT count(*) AS leaked_grants FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'service_role');      -- expect 0
--   SELECT has_table_privilege('anon', 'public.users', 'SELECT') AS anon_reads_users;   -- expect false
--   SELECT extname FROM pg_extension WHERE extname = 'pg_graphql';  -- if listed, GraphQL is installed: switch
--   it off in the dashboard as well (it serves only what the revokes above still allow, i.e. nothing).
-- (has_schema_privilege('anon','public','USAGE') may stay true through the built-in PUBLIC grant on the
-- schema; that is harmless once no table, sequence or function grant is left.)
