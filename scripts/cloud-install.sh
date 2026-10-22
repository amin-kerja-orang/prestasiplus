#!/usr/bin/env bash
# Setup for Claude Code on the web / cloud sessions (Linux VM). No-op everywhere else.
# Idempotent: safe to run on every session start (startup and resume). Safe to run piped to bash
# (`git show origin/feature/v2-backend:scripts/cloud-install.sh | bash`): the repo root comes from
# $CLAUDE_PROJECT_DIR, not from this file's location.
#
# What it does (cloud VM has PostgreSQL 16 binaries but NO cluster under /etc/postgresql):
#   1. refuse any non-local DB host (before touching anything)
#   2. npm ci (skipped when node_modules is newer than package-lock.json)
#   3. start a throwaway cluster at /var/tmp/pp-pg/data (initdb on first use, port 55432, trust auth
#      on loopback); an already running server on that host/port is left alone
#   4. write an offline Prisma schema-engine stub (Prisma engines cannot be downloaded in the cloud)
#   5. export TEST_DATABASE_URL + the two PRISMA_* variables into $CLAUDE_ENV_FILE (no duplicates)
#   6. npm run db:generate -w @pp/api
#
# SECRETS: none here. The cluster is a throwaway local TEST database in the session VM, reachable
# only on loopback with trust auth, so the URL has no password. Real secrets (AI keys,
# SESSION_SECRET, E2E_DEMO_PASSWORD, ...) come from the cloud environment's variable / network-secret
# settings, never from the repo.
#
# Env overrides (all optional):
#   PP_TEST_DB_USER (default test)   PP_TEST_DB_NAME (default postgres)
#   PP_TEST_DB_HOST (default 127.0.0.1; ONLY 127.0.0.1 or localhost accepted)
#   PP_TEST_DB_PORT (default 55432)
#   TEST_DATABASE_URL: if already set it must point at 127.0.0.1/localhost (else the script exits
#   non-zero); it is then used as is (its port is the one that is started/checked) and is not
#   rewritten into $CLAUDE_ENV_FILE. A URL with a query string (?...) or fragment (#...) is refused.
set -euo pipefail

# The whole script lives in main() and is only called on the last line, so bash has parsed the
# entire file before anything runs; children therefore cannot swallow the rest of a piped script
# (and they get </dev/null anyway).
main() {
  if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
    echo "[cloud-install] CLAUDE_CODE_REMOTE is not 'true'; not a cloud session, doing nothing."
    return 0
  fi

  die() { echo "[cloud-install] ERROR: $*" >&2; exit 1; }

  is_local_host() {
    case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
      127.0.0.1|localhost) return 0 ;;
      *) return 1 ;;
    esac
  }

  # Run a command as root: directly if root, else passwordless sudo, else plain (may fail).
  as_root() {
    if [ "$(id -u)" = "0" ]; then "$@" </dev/null
    elif command -v sudo >/dev/null 2>&1 && sudo -n true </dev/null 2>/dev/null; then sudo -n "$@" </dev/null
    else "$@" </dev/null; fi
  }

  # Run a command as the postgres OS user (the server must not run as root).
  as_postgres() {
    if [ "$(id -u)" = "0" ] && command -v runuser >/dev/null 2>&1; then runuser -u postgres -- "$@" </dev/null
    elif command -v sudo >/dev/null 2>&1 && sudo -n true </dev/null 2>/dev/null; then sudo -n -u postgres "$@" </dev/null
    else "$@" </dev/null; fi
  }

  # Replace any earlier line for NAME so re-runs never pile up. The env file is rewritten in place
  # (cat >), never replaced by mv, so its mode and owner survive; a new file is created 0600.
  persist_export() {
    local name="$1" value="$2" tmp
    if [ -f "$CLAUDE_ENV_FILE" ]; then
      tmp="$(umask 077; mktemp "${CLAUDE_ENV_FILE}.XXXXXX")"
      grep -v "^export ${name}=" "$CLAUDE_ENV_FILE" > "$tmp" || true
      cat "$tmp" > "$CLAUDE_ENV_FILE"
      rm -f "$tmp"
    fi
    ( umask 077; echo "export ${name}='${value}'" >> "$CLAUDE_ENV_FILE" )
  }

  local DB_USER="${PP_TEST_DB_USER:-test}"
  local DB_NAME="${PP_TEST_DB_NAME:-postgres}"
  local DB_HOST="${PP_TEST_DB_HOST:-127.0.0.1}"
  local DB_PORT="${PP_TEST_DB_PORT:-55432}"

  # ---- validate overrides (nothing has been touched yet; a pre-set URL is never printed) ----
  is_local_host "$DB_HOST" || die "PP_TEST_DB_HOST must be 127.0.0.1 or localhost (refusing a non-local database host)."
  case "$DB_USER$DB_NAME" in *[!A-Za-z0-9_]*|"") die "PP_TEST_DB_USER / PP_TEST_DB_NAME may only contain letters, digits and underscore." ;; esac
  case "$DB_PORT" in *[!0-9]*|"") die "PP_TEST_DB_PORT must be a number." ;; esac

  local PRESET_URL=0
  if [ -n "${TEST_DATABASE_URL:-}" ]; then
    PRESET_URL=1
    local rest auth hostport host port
    case "$TEST_DATABASE_URL" in
      postgresql://*) rest="${TEST_DATABASE_URL#postgresql://}" ;;
      postgres://*)   rest="${TEST_DATABASE_URL#postgres://}" ;;
      *) die "TEST_DATABASE_URL must start with postgresql:// or postgres:// (refusing to guess its host)." ;;
    esac
    # libpq percent-decodes query keywords and takes userinfo/host only up to the first '/', so a
    # query string or fragment could hide a host override. Refuse both anywhere in the URL.
    case "$TEST_DATABASE_URL" in
      *\?*|*\#*) die "TEST_DATABASE_URL must not contain a query string (?) or fragment (#)." ;;
    esac
    case "$TEST_DATABASE_URL" in
      *[[:space:]\\]*) die "TEST_DATABASE_URL contains whitespace or a backslash." ;;
    esac
    auth="${rest%%/*}"
    case "$auth" in
      *@*@*) die "TEST_DATABASE_URL has more than one '@' in its authority." ;;
    esac
    hostport="${auth##*@}"
    host="${hostport%%:*}"
    port=""
    case "$hostport" in *:*) port="${hostport#*:}" ;; esac
    is_local_host "$host" || die "TEST_DATABASE_URL points at a non-local host; only 127.0.0.1 or localhost is allowed."
    case "$port" in *[!0-9]*) die "TEST_DATABASE_URL has a non-numeric port." ;; esac
    DB_HOST="$host"
    DB_PORT="${port:-5432}"
  fi

  local ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)}"
  cd "$ROOT" || exit 1

  local PG_BIN="/usr/lib/postgresql/16/bin"
  local PG_ROOT="/var/tmp/pp-pg"
  local PG_DATA="$PG_ROOT/data"
  local PG_LOG="$PG_ROOT/log"
  local STUB_DIR="$HOME/stub"

  # Offline Prisma: engines cannot be downloaded in the cloud. Set before npm ci / db:generate.
  export PRISMA_SCHEMA_ENGINE_BINARY="$STUB_DIR/schema-engine"
  export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

  echo "[cloud-install] 1/5 npm ci"
  if [ -f node_modules/.package-lock.json ] && [ node_modules/.package-lock.json -nt package-lock.json ]; then
    echo "[cloud-install] node_modules is newer than package-lock.json; skipping npm ci."
  else
    npm ci </dev/null
  fi

  echo "[cloud-install] 2/5 PostgreSQL on ${DB_HOST}:${DB_PORT}"
  # Detection only asks the port, so it works for clusters started without the hardening options below.
  if pg_isready -q -h "$DB_HOST" -p "$DB_PORT" </dev/null 2>/dev/null; then
    echo "[cloud-install] server already accepting connections; leaving it running untouched."
  else
    [ -x "$PG_BIN/initdb" ] || die "no server on ${DB_HOST}:${DB_PORT} and $PG_BIN/initdb is missing; install PostgreSQL 16 or start a local server yourself."
    as_root mkdir -p "$PG_ROOT"
    as_root chown postgres "$PG_ROOT"
    as_postgres test -f "$PG_DATA/PG_VERSION" || as_postgres "$PG_BIN/initdb" -D "$PG_DATA" -U "$DB_USER" --auth=trust >/dev/null
    # Only reached when nothing answers on the port; a postmaster.pid left over from a stopped VM
    # would block the start, but never delete it while the server process is alive.
    if ! as_postgres "$PG_BIN/pg_ctl" -D "$PG_DATA" status >/dev/null 2>&1; then
      as_postgres rm -f "$PG_DATA/postmaster.pid"
    fi
    # trust auth is only safe because the server listens on loopback only and the socket is private.
    # The socket dir is $PG_ROOT (owned by postgres), not /tmp, which may be unwritable after a restart.
    as_postgres "$PG_BIN/pg_ctl" -D "$PG_DATA" -l "$PG_LOG" \
      -o "-p $DB_PORT -k $PG_ROOT -c listen_addresses=127.0.0.1 -c unix_socket_permissions=0700 -c fsync=off -c synchronous_commit=off -c full_page_writes=off -c max_connections=300 -c timezone=UTC" \
      start -w
  fi
  pg_isready -h "$DB_HOST" -p "$DB_PORT" </dev/null || die "PostgreSQL did not become ready."

  echo "[cloud-install] 3/5 check access and database '$DB_NAME'"
  command -v psql >/dev/null 2>&1 || die "psql not found."
  local admin_url="postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/postgres"
  [ "$PRESET_URL" = "1" ] && admin_url="$TEST_DATABASE_URL"
  psql "$admin_url" -X -q -tAc 'select 1' </dev/null >/dev/null || die "cannot connect to the test database server (role '$DB_USER' needs LOGIN + superuser; tests run CREATE/DROP DATABASE and CREATE EXTENSION pgcrypto)."
  if [ "$PRESET_URL" != "1" ] && [ "$DB_NAME" != "postgres" ]; then
    if [ "$(psql "$admin_url" -X -q -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" </dev/null)" != "1" ]; then
      psql "$admin_url" -X -q -c "CREATE DATABASE \"$DB_NAME\"" </dev/null
    fi
  fi

  echo "[cloud-install] 4/5 Prisma schema-engine stub + env exports"
  mkdir -p "$STUB_DIR"
  if [ ! -x "$PRISMA_SCHEMA_ENGINE_BINARY" ]; then
    printf '#!/bin/sh\necho "schema-engine stub (offline)" >&2\nexit 1\n' > "$PRISMA_SCHEMA_ENGINE_BINARY"
    chmod +x "$PRISMA_SCHEMA_ENGINE_BINARY"
  fi

  if [ "$PRESET_URL" != "1" ]; then
    TEST_DATABASE_URL="postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    export TEST_DATABASE_URL
  fi
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    [ "$PRESET_URL" = "1" ] || persist_export TEST_DATABASE_URL "$TEST_DATABASE_URL"
    persist_export PRISMA_SCHEMA_ENGINE_BINARY "$PRISMA_SCHEMA_ENGINE_BINARY"
    persist_export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING "$PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING"
    echo "[cloud-install] wrote exports to CLAUDE_ENV_FILE."
  else
    echo "[cloud-install] CLAUDE_ENV_FILE not set; run this in your shell:"
    [ "$PRESET_URL" = "1" ] || echo "export TEST_DATABASE_URL='${TEST_DATABASE_URL}'"
    echo "export PRISMA_SCHEMA_ENGINE_BINARY='${PRISMA_SCHEMA_ENGINE_BINARY}'"
    echo "export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING='${PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING}'"
  fi

  echo "[cloud-install] 5/5 prisma generate (@pp/api)"
  npm run db:generate -w @pp/api </dev/null

  echo "[cloud-install] done."
}

main "$@"
