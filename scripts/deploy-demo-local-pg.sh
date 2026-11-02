#!/usr/bin/env bash
# Local Supabase-like Postgres for testing scripts/deploy-demo.sh (docs/ops/deploy-demo-workflow.md, "Local test").
# Mirrors run sheet #170 section 13: a non-superuser `postgres` owner, `pgcrypto` in `extensions`, the roles anon,
# authenticated and service_role with Supabase-style default grants, and a pooler-style login `postgres.<ref>`
# that acts as `postgres`. Loopback only, throw-away password, never a real database.
#
#   scripts/deploy-demo-local-pg.sh up      # init + start the cluster and load a small "current demo" DB
#   scripts/deploy-demo-local-pg.sh down    # stop it (only the cluster this script started)
#   scripts/deploy-demo-local-pg.sh env     # print the exports for deploy-demo.sh (stub mode)
set -euo pipefail
umask 077
DIR="${PP_TEST_PG_DIR:-/var/tmp/pp-deploywf-pg}"
PORT="${PP_TEST_PG_PORT:-55439}"
REF="${PP_TEST_REF:-localdemo}"
PW='local-throwaway-not-a-secret'
BIN="${PP_TEST_PG_BIN:-$(find /usr/lib/postgresql -mindepth 2 -maxdepth 2 -name bin -type d 2>/dev/null | sort -V | tail -1)}"
asuser() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
sql() { PGPASSWORD="$PW" psql -X -v ON_ERROR_STOP=1 -q -h 127.0.0.1 -p "$PORT" -U supa -d postgres; }

case "${1:-}" in
  up)
    if [ ! -f "$DIR/PG_VERSION" ]; then
      mkdir -p "$DIR"; [ "$(id -u)" = 0 ] && chown postgres "$DIR"
      printf '%s\n' "$PW" >"$DIR.pw"; [ "$(id -u)" = 0 ] && chown postgres "$DIR.pw"
      asuser "$BIN/initdb" -D "$DIR" -U supa --pwfile="$DIR.pw" -A scram-sha-256 >/dev/null
      rm -f "$DIR.pw"
    fi
    asuser "$BIN/pg_ctl" -D "$DIR" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" -l "$DIR.log" -w start >/dev/null
    sql <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='postgres') THEN CREATE ROLE postgres LOGIN NOSUPERUSER CREATEROLE; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='postgres.$REF') THEN CREATE ROLE "postgres.$REF" LOGIN PASSWORD '$PW' IN ROLE postgres; END IF;
END \$\$;
ALTER ROLE "postgres.$REF" SET role = 'postgres';
ALTER DATABASE postgres OWNER TO postgres;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
SQL
    # A small "current demo" database (so the pre-deploy dump has TABLE DATA), owned by postgres.
    PGPASSWORD="$PW" psql -X -v ON_ERROR_STOP=1 -q -h 127.0.0.1 -p "$PORT" -U "postgres.$REF" -d postgres <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS public.users (id serial primary key, email text, password_hash text);
INSERT INTO public.users (email, password_hash) SELECT 'pelajar@demo.test', 'x' WHERE NOT EXISTS (SELECT 1 FROM public.users);
SQL
    echo "local Supabase-like Postgres up on 127.0.0.1:$PORT (ref $REF)"
    ;;
  down) asuser "$BIN/pg_ctl" -D "$DIR" -m fast -w stop >/dev/null && echo stopped ;;
  env)
    cat <<EOF
export PP_DEPLOY_STUB=1 PP_LOCAL_SSLQ=sslmode=disable DEMO_REF=$REF
export PGURL=postgresql://postgres.$REF@127.0.0.1:$PORT/postgres PGPASSWORD=$PW
EOF
    ;;
  *) echo "usage: $0 up|down|env" >&2; exit 2 ;;
esac
