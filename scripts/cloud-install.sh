#!/usr/bin/env bash
# Setup for Claude Code on the web / cloud sessions (Linux VM). No-op everywhere else.
# Idempotent: safe to run on every session start (startup and resume).
#
# SECRETS: nothing secret lives here. The DB role below is a throwaway local TEST default for the
# session VM only. Real secrets (AI keys, SESSION_SECRET, E2E_DEMO_PASSWORD, ...) come from the
# cloud environment's variable / network-secret settings, never from the repo.
#
# Env overrides (all optional):
#   PP_TEST_DB_USER  (default pp_test)   PP_TEST_DB_PASS (default pp_test_local)
#   PP_TEST_DB_NAME  (default postgres)  PP_TEST_DB_HOST (default 127.0.0.1)  PP_TEST_DB_PORT (default 5432)
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  echo "[cloud-install] CLAUDE_CODE_REMOTE is not 'true'; not a cloud session, doing nothing."
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT" || exit 1

DB_USER="${PP_TEST_DB_USER:-pp_test}"
DB_PASS="${PP_TEST_DB_PASS:-pp_test_local}"
DB_NAME="${PP_TEST_DB_NAME:-postgres}"
DB_HOST="${PP_TEST_DB_HOST:-127.0.0.1}"
DB_PORT="${PP_TEST_DB_PORT:-5432}"

# Run a command as root: directly if root, else passwordless sudo, else plain (may fail).
as_root() {
  if [ "$(id -u)" = "0" ]; then "$@"
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then sudo -n "$@"
  else "$@"; fi
}

# Run psql as the postgres OS user (peer auth), against the local socket.
psql_admin() {
  if [ "$(id -u)" = "0" ] && command -v runuser >/dev/null 2>&1; then
    runuser -u postgres -- psql -v ON_ERROR_STOP=1 -X -q "$@"
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo -n -u postgres psql -v ON_ERROR_STOP=1 -X -q "$@"
  else
    psql -v ON_ERROR_STOP=1 -X -q -U postgres "$@"
  fi
}

echo "[cloud-install] 1/5 npm ci"
if [ -f node_modules/.package-lock.json ] && [ node_modules/.package-lock.json -nt package-lock.json ]; then
  echo "[cloud-install] node_modules is newer than package-lock.json; skipping npm ci."
else
  npm ci
fi

echo "[cloud-install] 2/5 start PostgreSQL"
if ! pg_isready -q -h "$DB_HOST" -p "$DB_PORT" 2>/dev/null; then
  if ! as_root service postgresql start; then
    echo "[cloud-install] 'service postgresql start' failed; trying pg_ctlcluster."
    ver="$(ls /etc/postgresql 2>/dev/null | sort -V | tail -n1)"
    [ -n "$ver" ] || { echo "[cloud-install] no PostgreSQL cluster found under /etc/postgresql" >&2; exit 1; }
    as_root pg_ctlcluster "$ver" main start
  fi
  for _ in $(seq 1 30); do
    pg_isready -q -h "$DB_HOST" -p "$DB_PORT" 2>/dev/null && break
    sleep 1
  done
fi
pg_isready -h "$DB_HOST" -p "$DB_PORT" || { echo "[cloud-install] PostgreSQL did not become ready" >&2; exit 1; }

echo "[cloud-install] 3/5 ensure test role '$DB_USER' and database '$DB_NAME'"
# SUPERUSER: global-setup.ts runs CREATE/DROP DATABASE (template + per-file clones) and the first
# migration runs CREATE EXTENSION pgcrypto. Local throwaway VM only.
role_exists="$(psql_admin -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'")"
if [ "$role_exists" != "1" ]; then
  psql_admin -c "CREATE ROLE \"$DB_USER\" LOGIN SUPERUSER PASSWORD '$DB_PASS'"
else
  psql_admin -c "ALTER ROLE \"$DB_USER\" LOGIN SUPERUSER PASSWORD '$DB_PASS'"
fi
db_exists="$(psql_admin -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'")"
if [ "$db_exists" != "1" ]; then
  psql_admin -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\""
fi

echo "[cloud-install] 4/5 export TEST_DATABASE_URL"
# Admin URL (any database on the server; global-setup swaps the db name per template/worker).
TEST_DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
export TEST_DATABASE_URL
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  # Persist for the whole session; replace any earlier line so re-runs do not pile up.
  if [ -f "$CLAUDE_ENV_FILE" ]; then
    grep -v '^export TEST_DATABASE_URL=' "$CLAUDE_ENV_FILE" > "$CLAUDE_ENV_FILE.tmp" || true
    mv "$CLAUDE_ENV_FILE.tmp" "$CLAUDE_ENV_FILE"
  fi
  echo "export TEST_DATABASE_URL='${TEST_DATABASE_URL}'" >> "$CLAUDE_ENV_FILE"
  echo "[cloud-install] wrote TEST_DATABASE_URL to CLAUDE_ENV_FILE."
else
  echo "[cloud-install] CLAUDE_ENV_FILE not set; run this in your shell:"
  echo "export TEST_DATABASE_URL='${TEST_DATABASE_URL}'"
fi

echo "[cloud-install] 5/5 prisma generate (@pp/api)"
npm run db:generate -w @pp/api

echo "[cloud-install] done."
