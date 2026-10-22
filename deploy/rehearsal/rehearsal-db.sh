#!/usr/bin/env bash
# Production-like rehearsal database for the .cloud -> v2 migration (MIG-07, AZ-30).
# Full recipe: docs/ops/rehearsal-db.md. Run `deploy/rehearsal/rehearsal-db.sh help` for the usage.
#
# Two modes (PP_REHEARSAL_MODE):
#   docker (default)  Postgres 16 container from deploy/rehearsal/compose.rehearsal.yaml (project pp-rehearsal,
#                     own volume, loopback port PP_REHEARSAL_PORT) and the migrate image (own tag).
#   host              Any Postgres 16 you already have, reached with PP_REHEARSAL_ADMIN_URL.
# Either way the client tools (psql, pg_dump, pg_restore, version 16) run on this host.
#
# No secret is ever written to the repo, printed, or put on a command line: passwords travel in PG* environment
# variables and in a 0600 state file outside the repo. The anonymised dump must live outside the repo too.
# shellcheck disable=SC2030,SC2031  # variables are exported inside subshells on purpose (child-only environment)
set -euo pipefail
umask 077

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd -P)
COMPOSE_FILE="$SCRIPT_DIR/compose.rehearsal.yaml"
MIGRATIONS_DIR="$REPO_ROOT/apps/api/prisma/migrations"
MARK='pp-rehearsal:v1'          # database/role comment: the tool only ever drops what carries this marker

die() { printf 'rehearsal-db: error: %s\n' "$*" >&2; exit "${DIE_CODE:-1}"; }
info() { printf '%s\n' "$*"; }
plan() { printf '[dry-run] %s\n' "$*"; }

# ---------------------------------------------------------------- arguments
DRY=0 YES=0 DUMPMODE=0 KEEP_VOLUME=0 WITH_SOURCE=0 NO_SHA=0 SHA_HEX='' ATTEST=0
POS=() CMD=()
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --yes) YES=1 ;;
    --dump) DUMPMODE=1 ;;
    --keep-volume) KEEP_VOLUME=1 ;;
    --with-source) WITH_SOURCE=1 ;;
    --no-sha-check) NO_SHA=1 ;;
    --attest-anonymised) ATTEST=1 ;;
    --sha256) [ $# -ge 2 ] || DIE_CODE=2 die "--sha256 needs a 64-character hex value"; SHA_HEX=$2; shift ;;
    -h | --help) POS=(help) ; break ;;
    --) shift; CMD=("$@"); break ;;
    -*) DIE_CODE=2 die "unknown option: $1 (try: help)" ;;
    *) POS+=("$1") ;;
  esac
  shift
done
SUB=${POS[0]:-help}
ARG1=${POS[1]:-}

usage() {
  cat <<'EOF'
Usage: rehearsal-db.sh <command> [args] [--dry-run] [--yes]

  up                     start the database (docker mode), create the databases and the read-only role,
                         apply ALL migrations, verify applied == folder count
  load-dump <path> [--sha256 <hex> | --no-sha-check] [--attest-anonymised]
                         accept the anonymised dump (outside the repo): pg_restore -Fc file or directory
                         into <db>_source with the read-only role, or a pp-staging-dump/1 directory
                         into <db>_staging; REQUIRED: the .sha256 sidecar (or --sha256 <hex>) and an anonymisation
                         attestation (manifest "anonymised": true, a <dump>.anonymised file, or --attest-anonymised);
                         a PII scan (IC numbers, non-example e-mail) must pass
  stage                  staging:load from <db>_source (pg route), then copy staging_cloud + archive_cloud
                         into the target database (where migrate:* reads them)
  snapshot <name>        freeze the target (template database copy; --dump for a pg_dump -Fc file)
  restore-snapshot <name>  roll the target back to the snapshot and compare row counts (needs --yes)
  exec <target|staging> [--with-source] -- <command...>
                         run a command (e.g. npm run migrate:core ...) with DATABASE_URL (and
                         CLOUD_SOURCE_URL with --with-source) set, from the repo root
  status                 settings, databases, migrations, snapshots, timings (no secrets)
  reset                  drop every rehearsal database and snapshot, then up again (needs --yes)
  down                   remove everything incl. the volume and the state dir (needs --yes);
                         docker mode with --keep-volume only stops the container
  help

Options: --dry-run (print the plan, change nothing), --yes (confirm a destructive step),
         --dump (snapshot as a dump file), --keep-volume (down),
         --sha256 <hex> / --no-sha-check (load-dump without a sidecar; the second skips the integrity check),
         --attest-anonymised (load-dump: you confirm the dump was made by the anonymiser).
Env (see docs/ops/rehearsal-db.md): PP_REHEARSAL_MODE=docker|host, PP_REHEARSAL_ADMIN_URL (host mode),
  PP_REHEARSAL_DB, PP_REHEARSAL_PORT, PP_REHEARSAL_ENV_FILE, PP_REHEARSAL_STATE_DIR,
  PP_REHEARSAL_MIGRATE=prisma|psql, PP_REHEARSAL_SOURCE_SCHEMA, PP_REHEARSAL_RESTORE_JOBS,
  PP_REHEARSAL_ALLOW_EMAIL_DOMAINS (extra e-mail domains the PII scan accepts, e.g. for a synthetic fixture),
  PP_REHEARSAL_ALLOW_SUPERUSER=1 (host mode: acknowledge a throwaway server).
EOF
}

# ---------------------------------------------------------------- config
# Read KEY=VALUE lines of an env file into the environment without executing it; real environment wins.
load_env_file() {
  local file=$1 line k v
  [ -f "$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%%#*}
    line=${line#"${line%%[![:space:]]*}"}
    line=${line%"${line##*[![:space:]]}"}
    [[ $line =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    k=${BASH_REMATCH[1]} v=${BASH_REMATCH[2]}
    v=${v#\"} v=${v%\"} v=${v#\'} v=${v%\'}
    if [ -z "${!k+x}" ]; then export "$k=$v"; fi
  done <"$file"
}

MODE=${PP_REHEARSAL_MODE:-docker}
ENV_FILE=${PP_REHEARSAL_ENV_FILE:-$SCRIPT_DIR/.env.rehearsal}
[ "$MODE" = docker ] && load_env_file "$ENV_FILE"

DB=${PP_REHEARSAL_DB:-pp_rehearsal}
PORT=${PP_REHEARSAL_PORT:-55433}
READER=${PP_REHEARSAL_READER_ROLE:-pp_staging_reader}
SOURCE_SCHEMA=${PP_REHEARSAL_SOURCE_SCHEMA:-public}
JOBS=${PP_REHEARSAL_RESTORE_JOBS:-2}
STAGING_DB="${DB}_staging"
SOURCE_DB="${DB}_source"

valid_ident() { [[ $1 =~ ^[a-z][a-z0-9_]{0,38}$ ]]; }
for v in "$DB" "$READER" "$SOURCE_SCHEMA"; do
  valid_ident "$v" || DIE_CODE=2 die "invalid name '$v': use lowercase letters, digits and _ (max 39 chars), starting with a letter"
done
case "$DB" in postgres | template0 | template1) DIE_CODE=2 die "PP_REHEARSAL_DB must not be a system database" ;; esac
[[ $PORT =~ ^[0-9]{2,5}$ ]] || DIE_CODE=2 die "PP_REHEARSAL_PORT must be a port number"
[[ $JOBS =~ ^[1-9][0-9]?$ ]] || DIE_CODE=2 die "PP_REHEARSAL_RESTORE_JOBS must be a small positive integer"
case "$MODE" in docker | host) ;; *) DIE_CODE=2 die "PP_REHEARSAL_MODE must be docker or host" ;; esac
MIGRATE_VIA=${PP_REHEARSAL_MIGRATE:-$([ "$MODE" = docker ] && echo prisma || echo psql)}
case "$MIGRATE_VIA" in prisma | psql) ;; *) DIE_CODE=2 die "PP_REHEARSAL_MIGRATE must be prisma or psql" ;; esac

urldecode() { # percent-decoding only: backslashes and other characters stay literal
  local s=$1 out='' ch
  while [[ $s =~ ^([^%]*)%([0-9A-Fa-f]{2})(.*)$ ]]; do
    [ "${BASH_REMATCH[2]}" != 00 ] || DIE_CODE=2 die "a %00 (NUL byte) in a connection URL is not allowed"
    printf -v ch '%b' "\\x${BASH_REMATCH[2]}"
    out+="${BASH_REMATCH[1]}${ch}"
    s=${BASH_REMATCH[3]}
  done
  printf '%s' "$out$s"
}
urlenc() {
  local s=$1 out='' c i
  for ((i = 0; i < ${#s}; i++)); do
    c=${s:i:1}
    case $c in [a-zA-Z0-9.~_-]) out+=$c ;; *) out+=$(printf '%%%02X' "'$c") ;; esac
  done
  printf '%s' "$out"
}

# Fills PGHOST/PGPORT/PGUSER/PGPASSWORD/PGSSLMODE (libpq env: nothing secret on any command line) and ADMIN_DB.
ADMIN_DB=postgres
setup_connection() {
  if [ "$MODE" = docker ]; then
    [ -f "$ENV_FILE" ] || die "missing $ENV_FILE (copy deploy/rehearsal/.env.rehearsal.example and set a password)"
    if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_PASSWORD:-}" ]; then die "POSTGRES_USER / POSTGRES_PASSWORD missing in $ENV_FILE"; fi
    case "$POSTGRES_PASSWORD" in change-me*) die "set a real POSTGRES_PASSWORD in $ENV_FILE (openssl rand -hex 24)" ;; esac
    [[ $POSTGRES_PASSWORD =~ ^[A-Za-z0-9]+$ ]] || die "POSTGRES_PASSWORD must be letters and digits only (it is used inside a URL)"
    export PGHOST=127.0.0.1 PGPORT=$PORT PGUSER=$POSTGRES_USER PGPASSWORD=$POSTGRES_PASSWORD
    return 0
  fi
  local url=${PP_REHEARSAL_ADMIN_URL:-} rest query path userinfo hostport user pass host port
  [ -n "$url" ] || die "host mode needs PP_REHEARSAL_ADMIN_URL (postgresql://ROLE@HOST:PORT/postgres; the role needs CREATEDB and CREATEROLE)"
  [[ $url =~ ^postgres(ql)?://(.*)$ ]] || die "PP_REHEARSAL_ADMIN_URL must start with postgresql://"
  rest=${BASH_REMATCH[2]} query='' path='' userinfo=''
  if [[ $rest == *\?* ]]; then query=${rest#*\?}; rest=${rest%%\?*}; fi
  if [[ $rest == */* ]]; then path=${rest#*/}; rest=${rest%%/*}; fi
  hostport=$rest
  if [[ $rest == *@* ]]; then userinfo=${rest%@*}; hostport=${rest##*@}; fi
  user=${userinfo%%:*} pass=''
  if [[ $userinfo == *:* ]]; then pass=${userinfo#*:}; fi
  port=5432
  if [[ $hostport == \[* ]]; then          # IPv6 literal: [::1]:5432
    host=${hostport#\[} host=${host%%\]*}
    [[ $hostport == *\]:* ]] && port=${hostport##*\]:}
  else
    host=${hostport%%:*}
    if [[ $hostport == *:* ]]; then port=${hostport##*:}; fi
  fi
  if [ -z "$host" ] || [ -z "$user" ]; then die "PP_REHEARSAL_ADMIN_URL needs a host and a role"; fi
  [[ $host == /* ]] && die "socket hosts are not supported; use a TCP host"
  export PGHOST=$host PGPORT=$port PGUSER
  PGUSER=$(urldecode "$user")
  if [ -n "$pass" ]; then PGPASSWORD=$(urldecode "$pass"); export PGPASSWORD; fi
  [ -n "$path" ] && ADMIN_DB=$path
  local q
  for q in ${query//&/ }; do
    case "$q" in sslmode=*) export PGSSLMODE=${q#sslmode=} ;; esac
  done
  case "$host" in
    127.0.0.1 | localhost | ::1) ;;
    *) case "${PGSSLMODE:-}" in require | verify-full | verify-ca) ;; *) die "a non-loopback host needs ?sslmode=require (better verify-full) in PP_REHEARSAL_ADMIN_URL" ;; esac ;;
  esac
}

# URL for a child process (node). Passwords are percent-encoded; sslmode is carried over.
make_url() {
  local user=$1 pass=$2 db=$3 u
  u="postgresql://$(urlenc "$user")"
  [ -n "$pass" ] && u+=":$(urlenc "$pass")"
  if [[ $PGHOST == *:* ]]; then u+="@[${PGHOST}]:${PGPORT}/${db}"; else u+="@${PGHOST}:${PGPORT}/${db}"; fi
  [ -n "${PGSSLMODE:-}" ] && u+="?sslmode=${PGSSLMODE}"
  printf '%s' "$u"
}

# ---------------------------------------------------------------- state dir (outside the repo, 0700)
realpath_loose() { # realpath of the nearest existing directory + the rest (file name or missing tail)
  local p=$1 tail=''
  while { [ ! -e "$p" ] || [ ! -d "$p" ]; } && [ "$p" != / ]; do tail="/$(basename "$p")$tail"; p=$(dirname "$p"); done
  printf '%s%s' "$(cd "$p" && pwd -P)" "$tail"
}
inside_repo() { local r; r=$(realpath_loose "$1"); [ "$r" = "$REPO_ROOT" ] || [[ $r == "$REPO_ROOT"/* ]]; }

STATE=''
init_state() {
  local base=${PP_REHEARSAL_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/pp-rehearsal}
  inside_repo "$base" && die "the state directory must be outside the repository: $base"
  STATE="$base/${PGHOST}-${PGPORT}-${DB}"
  if ((DRY)); then return 0; fi
  mkdir -p "$STATE/snapshots"
  chmod 700 "$base" "$STATE" "$STATE/snapshots" 2>/dev/null || true
}
state_get() { if [ -f "$STATE/$1" ]; then sed -n "s/^$2=//p" "$STATE/$1" | head -n1; fi; }
rand_hex() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
ensure_secrets() {
  [ -f "$STATE/secrets.env" ] && return 0
  printf 'READER_PASSWORD=%s\nIC_HASH_KEY=%s\n' "$(rand_hex 24)" "$(rand_hex 32)" >"$STATE/secrets.env"
  chmod 600 "$STATE/secrets.env"
}
need_secrets() { [ -f "$STATE/secrets.env" ] || die "no $STATE/secrets.env: run 'up' first (it creates the reader password and the IC hash key)"; }
timing() { # timing <step> <seconds>
  info "[time] $1: ${2}s"
  ((DRY)) || printf '%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$1" "$2" >>"$STATE/timings.log"
}

# ---------------------------------------------------------------- helpers
need_tools() {
  local t
  for t in "$@"; do command -v "$t" >/dev/null 2>&1 || die "missing tool: $t"; done
}
psql_db() { local d=$1; shift; psql -X -q -v ON_ERROR_STOP=1 -d "$d" "$@"; }
dbq() { psql_db "$1" -Atc "$2"; }                 # query returning a scalar / rows
db_exists() { [ "$(dbq "$ADMIN_DB" "select 1 from pg_database where datname='$1'")" = 1 ]; }
db_marked() { [ "$(dbq "$ADMIN_DB" "select shobj_description(oid,'pg_database') from pg_database where datname='$1'")" = "$MARK" ]; }
assert_ours() { db_exists "$1" && ! db_marked "$1" && die "database '$1' exists but was not created by this tool; refusing to touch it"; return 0; }
create_db() {
  if db_exists "$1"; then
    db_marked "$1" || die "database '$1' exists but was not created by this tool; refusing to use it"
    return 0
  fi
  psql_db "$ADMIN_DB" -c "create database \"$1\" encoding 'UTF8' template template0"
  psql_db "$ADMIN_DB" -c "comment on database \"$1\" is '$MARK'"
}
drop_db() { # drop_db <name>: only a marked database; connections are terminated (WITH FORCE)
  db_exists "$1" || return 0
  db_marked "$1" || die "database '$1' was not created by this tool; refusing to drop it"
  psql_db "$ADMIN_DB" -c "drop database \"$1\" with (force)"
}
snap_prefix() { printf '%s__snap_' "$DB"; }
snap_dbs() { dbq "$ADMIN_DB" "select datname from pg_database where starts_with(datname, '$(snap_prefix)') order by 1"; }
folder_migrations() { find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | LC_ALL=C sort; }
table_counts() { # exact row count of every public base table, "schema.table<TAB>count"
  psql_db "$1" -At -F $'\t' -c "select table_schema||'.'||table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1"
}
dc() {
  local args=(compose -p pp-rehearsal)     # always explicit: COMPOSE_PROJECT_NAME can never point this at the base stack
  [ -f "$ENV_FILE" ] && args+=(--env-file "$ENV_FILE")
  PP_REHEARSAL_DB=$DB PP_REHEARSAL_PORT=$PORT docker "${args[@]}" -f "$COMPOSE_FILE" "$@"
}
require_server() {
  psql_db "$ADMIN_DB" -Atc 'select 1' >/dev/null 2>&1 || die "cannot connect to ${PGHOST}:${PGPORT} as ${PGUSER} (is it up? try: up)"
  local v
  v=$(dbq "$ADMIN_DB" 'show server_version_num')
  if [ "$v" -lt 160000 ] || [ "$v" -ge 170000 ]; then info "warning: server_version_num is ${v}; production is 16"; fi
}

verify_migrations() { # verify_migrations <db>: applied == folder, same names
  local folder applied missing
  folder=$(folder_migrations | wc -l | tr -d ' ')
  applied=$(dbq "$1" "select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null")
  missing=$(diff <(folder_migrations) <(dbq "$1" "select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null order by migration_name" | LC_ALL=C sort) || true)
  if [ "$folder" != "$applied" ] || [ -n "$missing" ]; then
    printf '%s\n' "$missing" >&2
    die "MIGRATION CHECK FAILED: ${applied} applied, ${folder} in apps/api/prisma/migrations"
  fi
  info "MIGRATION CHECK PASSED: ${applied} of ${folder} migrations applied in '$1'"
}

# Prisma-compatible bookkeeping: the table DDL Prisma creates, checksum = sha256 (hex) of migration.sql.
apply_migrations_psql() {
  local db=$1 dir name sum n=0
  psql_db "$db" <<'SQL'
create table if not exists _prisma_migrations (
  id                  varchar(36) primary key not null,
  checksum            varchar(64) not null,
  finished_at         timestamptz,
  migration_name      varchar(255) not null,
  logs                text,
  rolled_back_at      timestamptz,
  started_at          timestamptz not null default now(),
  applied_steps_count integer not null default 0
);
SQL
  while IFS= read -r name; do
    dir="$MIGRATIONS_DIR/$name"
    [ -f "$dir/migration.sql" ] || die "no migration.sql in $name"
    if [ "$(dbq "$db" "select count(*) from _prisma_migrations where migration_name='$name'")" != 0 ]; then
      continue    # already recorded (a failed row needs a manual fix, as with prisma migrate)
    fi
    sum=$(sha256sum "$dir/migration.sql" | cut -d' ' -f1)
    # -1: the migration and its bookkeeping row commit together or not at all.
    psql_db "$db" -1 -f "$dir/migration.sql" -c "insert into _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count) values (gen_random_uuid()::text, '$sum', now(), '$name', 1)" >/dev/null
    n=$((n + 1))
  done < <(folder_migrations)
  info "psql path: applied $n new migration(s)"
}

# ---------------------------------------------------------------- commands
cmd_up() {
  need_tools psql
  if ((DRY)); then
    if [ "$MODE" = docker ]; then plan "docker compose -p pp-rehearsal up -d --wait db (127.0.0.1:${PORT})"; else plan "host mode: use the Postgres behind PP_REHEARSAL_ADMIN_URL (nothing is started)"; fi
    plan "create marked databases $DB and $STAGING_DB; create read-only role $READER (password in the state dir)"
    plan "apply migrations via $MIGRATE_VIA, then verify applied == $(folder_migrations | wc -l | tr -d ' ') folders"
    return 0
  fi
  local t0=$SECONDS
  if [ "$MODE" = docker ]; then
    need_tools docker
    dc up -d --wait db
  fi
  require_server
  local priv
  priv=$(dbq "$ADMIN_DB" "select rolsuper or (rolcreatedb and rolcreaterole) from pg_roles where rolname = current_user")
  [ "$priv" = t ] || die "role $PGUSER needs CREATEDB and CREATEROLE"
  if [ "$MODE" = host ] && [ "$(dbq "$ADMIN_DB" "select rolsuper from pg_roles where rolname = current_user")" = t ] && [ "${PP_REHEARSAL_ALLOW_SUPERUSER:-}" != 1 ]; then
    die "host mode must not use a superuser role (it can read files and run programs on the server, and the restored dump holds personal data). Use a dedicated server and a role with only CREATEDB and CREATEROLE; set PP_REHEARSAL_ALLOW_SUPERUSER=1 only for a throwaway local server."
  fi
  ensure_secrets
  local pw
  pw=$(state_get secrets.env READER_PASSWORD)
  psql_db "$ADMIN_DB" <<SQL
do \$\$
begin
  if not exists (select from pg_roles where rolname = '$READER') then
    create role "$READER" login password '$pw' nosuperuser nocreatedb nocreaterole noinherit;
    comment on role "$READER" is '$MARK';
  elsif coalesce((select shobj_description(oid, 'pg_authid') from pg_roles where rolname = '$READER'), '') <> '$MARK' then
    raise exception 'role $READER exists but was not created by this tool';
  else
    alter role "$READER" password '$pw';
  end if;
end \$\$;
SQL
  create_db "$DB"
  create_db "$STAGING_DB"
  info "databases ready: $DB, $STAGING_DB; read-only role: $READER"
  local t1=$SECONDS
  if [ "$MIGRATE_VIA" = prisma ]; then
    if [ "$MODE" = docker ]; then
      dc build migrate
      dc run --rm migrate
    else
      need_tools npm
      (cd "$REPO_ROOT" && DATABASE_URL=$(make_url "$PGUSER" "${PGPASSWORD:-}" "$DB") NODE_ENV=production npm run be:db:migrate)
    fi
  else
    apply_migrations_psql "$DB"
  fi
  timing "migrate (all schema migrations, $MIGRATE_VIA)" $((SECONDS - t1))
  verify_migrations "$DB"
  timing "up" $((SECONDS - t0))
}

# Least privilege read-only role on the restored source, as in docs/architecture/v2-migration-runbook.md section 3.
harden_source() {
  psql_db "$SOURCE_DB" <<SQL
revoke create on schema public from public;
revoke all on database "$SOURCE_DB" from public;
grant connect on database "$SOURCE_DB" to "$READER";
grant usage on schema "$SOURCE_SCHEMA" to "$READER";
grant select on all tables in schema "$SOURCE_SCHEMA" to "$READER";
-- EXECUTE on functions is granted to PUBLIC by default; the loader refuses SECURITY DEFINER ones.
do \$\$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where p.prosecdef and n.nspname not in ('pg_catalog', 'information_schema') loop
    execute format('revoke execute on function %s from public', f.sig);
  end loop;
end \$\$;
SQL
  local writes
  writes=$(dbq "$SOURCE_DB" "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r','v','m','p','f') and n.nspname not in ('pg_catalog','information_schema') and has_table_privilege('$READER', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE')")
  [ "$writes" = 0 ] || die "the read-only role can write to $writes relation(s); refusing to continue"
  info "read-only role check: $READER has no write privilege on any relation of $SOURCE_DB"
}

sha_check() { # sha_check <file|dir>: a missing checksum is an error unless --sha256 <hex> or --no-sha-check
  local p=$1 want='' got='' how=''
  if [ "$NO_SHA" = 1 ]; then
    info "WARNING: --no-sha-check: the dump's integrity is NOT verified"
    return 0
  fi
  if [ -n "$SHA_HEX" ]; then
    [[ $SHA_HEX =~ ^[0-9a-fA-F]{64}$ ]] || DIE_CODE=2 die "--sha256 must be 64 hex characters"
    want=${SHA_HEX,,} how='--sha256'
  elif [ -f "$p" ] && [ -f "$p.sha256" ]; then
    want=$(awk '{print $1; exit}' "$p.sha256") how='sidecar'
  elif [ -d "$p" ] && [ -f "$p/SHA256SUMS" ]; then
    (cd "$p" && sha256sum --quiet -c SHA256SUMS) || die "SHA256SUMS check failed in $p"
    info "SHA256SUMS: OK"
    return 0
  elif [ -d "$p" ] && [ -f "$p.sha256" ]; then
    want=$(awk '{print $1; exit}' "$p.sha256") how='directory sidecar'
  else
    die "no checksum for $(basename "$p"): expected $(basename "$p").sha256 next to it (or SHA256SUMS inside a directory). Ask the lead for the hash and pass --sha256 <hex>, or --no-sha-check to skip the check on purpose."
  fi
  if [ -f "$p" ]; then
    got=$(sha256sum "$p" | cut -d' ' -f1)
  else
    got=$( (cd "$p" && find . -type f ! -name SHA256SUMS -print0 | LC_ALL=C sort -z | xargs -0 sha256sum) | sha256sum | cut -d' ' -f1)
  fi
  [ "$want" = "$got" ] || die "SHA256 MISMATCH for $(basename "$p"): do not load it, ask the lead for a new copy"
  info "sha256 ($how): OK"
}

# The dump must be declared anonymised: a manifest with "anonymised": true (what the anonymiser writes) or
# "synthetic": true, a sidecar <dump>.anonymised, or --attest-anonymised.
attest_check() { # attest_check <path> <kind>
  local p=$1 kind=$2
  if [ "$kind" = ndjson ] && grep -Eq '"(anonymised|synthetic)"[[:space:]]*:[[:space:]]*true' "$p/manifest.json"; then
    info "attestation: manifest is marked anonymised/synthetic"
  elif [ -s "$p.anonymised" ]; then
    info "attestation: sidecar $(basename "$p").anonymised"
  elif ((ATTEST)); then
    info "attestation: --attest-anonymised given (you confirm the dump came out of the anonymiser)"
  else
    die "no anonymisation attestation for $(basename "$p"). A pp-staging-dump/1 directory made by the anonymiser carries \"anonymised\": true. For a pg_dump the lead creates a non-empty $(basename "$p").anonymised file, or you pass --attest-anonymised to confirm it. Never load raw data."
  fi
}

# Fail-closed pattern scan of the restored source (the anonymiser's ndjson scan cannot read a pg restore):
# 12-digit IC numbers with a valid date, and e-mail outside example.test (+ PP_REHEARSAL_ALLOW_EMAIL_DOMAINS).
# Prints counts only. On a hit the source database is dropped.
pii_scan_source() {
  local extra=${PP_REHEARSAL_ALLOW_EMAIL_DOMAINS:-} bad_ic bad_mail
  [[ -z $extra || $extra =~ ^[a-z0-9.,-]+$ ]] || DIE_CODE=2 die "PP_REHEARSAL_ALLOW_EMAIL_DOMAINS: lowercase domains separated by commas"
  if [ "$(dbq "$SOURCE_DB" "select to_regclass('\"$SOURCE_SCHEMA\".users') is not null")" != t ]; then
    drop_db "$SOURCE_DB"
    die "PII SCAN FAILED: no $SOURCE_SCHEMA.users table in the restore, so it cannot be checked (source dropped)"
  fi
  bad_ic=$(dbq "$SOURCE_DB" "select count(*) from \"$SOURCE_SCHEMA\".users where regexp_replace(coalesce(ic,''), '[ -]', '', 'g') ~ '^[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[0-9]{6}\$'")
  bad_mail=$(dbq "$SOURCE_DB" "select count(*) from \"$SOURCE_SCHEMA\".users where coalesce(email,'') <> '' and split_part(lower(email), '@', 2) <> all (string_to_array('example.test${extra:+,$extra}', ','))")
  if [ "$bad_ic" != 0 ] || [ "$bad_mail" != 0 ]; then
    drop_db "$SOURCE_DB"
    die "PII SCAN FAILED in users: ${bad_ic} real-looking IC number(s), ${bad_mail} e-mail(s) outside the allowed domains. The source database was dropped. Tell the lead; do not retry with the same dump."
  fi
  info "PII scan (users.ic, users.email): clean"
}

cmd_load_dump() {
  local path=$ARG1 kind
  [ -n "$path" ] || DIE_CODE=2 die "usage: load-dump <path to the anonymised dump>"
  [ -e "$path" ] || die "no such path: $path"
  path=$(realpath -e -- "$path") || die "cannot resolve $path"     # symlinks resolved: a link into the repo is caught below
  if inside_repo "$path"; then die "refusing a dump inside the repository ($path). Personal data of minors stays outside the repo; move it first."; fi
  if [ -d "$path" ] && [ -f "$path/manifest.json" ]; then
    grep -q '"format"[[:space:]]*:[[:space:]]*"pp-staging-dump/1"' "$path/manifest.json" || die "manifest.json is not format pp-staging-dump/1"
    kind=ndjson
  elif [ -d "$path" ] && [ -f "$path/toc.dat" ]; then
    kind=pgdir
  elif [ -f "$path" ] && [ "$(head -c 5 "$path")" = PGDMP ]; then
    kind=pgfile
  else
    die "not a recognised dump: expected a pg_dump -Fc file, a pg_dump -Fd directory, or a pp-staging-dump/1 directory (plain .sql is not supported; ask the lead for -Fc)"
  fi
  info "dump kind: $kind"
  sha_check "$path"
  attest_check "$path" "$kind"
  if ((DRY)); then
    plan "check sha256 sidecar; $([ "$kind" = ndjson ] && echo "staging:load --from <dir> into $STAGING_DB (PP_ALLOW_STAGING_RESET=1)" || echo "recreate $SOURCE_DB, pg_restore --no-owner --no-acl -j $JOBS, grant SELECT only to $READER, check it cannot write")"
    return 0
  fi
  need_tools psql
  require_server
  assert_ours "$DB"
  db_exists "$DB" || die "run 'up' first"
  need_secrets
  local t0=$SECONDS
  if [ "$kind" = ndjson ]; then
    need_tools npm
    [ -d "$REPO_ROOT/node_modules" ] || die "run npm ci in $REPO_ROOT first (staging:load needs it)"
    # Reuse the anonymiser's own pattern scan (e-mail, phone, 12-digit IC) before anything is loaded.
    local extra='' d
    d=${PP_REHEARSAL_ALLOW_EMAIL_DOMAINS:-}
    if grep -q '"synthetic"[[:space:]]*:[[:space:]]*true' "$path/manifest.json"; then extra=contoh.invalid; fi
    [ -n "$d" ] && extra=${extra:+$extra,}$d
    (unset CLOUD_SOURCE_URL PP_STAGING_DB_ALLOWLIST; export NODE_ENV=development; cd "$REPO_ROOT" \
      && npm run anonymise:scan -w @pp/api -- --dir "$path" ${extra:+--allow-email-domains "$extra"}) || die "PII SCAN FAILED: the dump holds personal-looking data. Nothing was loaded; tell the lead."
    # Secrets stay in the child's environment (exported in a subshell), never in argv.
    (unset CLOUD_SOURCE_URL PP_STAGING_DB_ALLOWLIST
      DATABASE_URL=$(make_url "$PGUSER" "${PGPASSWORD:-}" "$STAGING_DB"); export DATABASE_URL
      export PP_ALLOW_STAGING_RESET=1 NODE_ENV=development
      cd "$REPO_ROOT" && npm run staging:load -w @pp/api -- --from "$path")
    echo ndjson >"$STATE/route"
  else
    need_tools pg_restore
    drop_db "$SOURCE_DB"
    create_db "$SOURCE_DB"
    # --no-owner/--no-acl: the dump's roles do not exist here; everything is owned by the admin role.
    pg_restore --no-owner --no-acl --exit-on-error -j "$JOBS" -d "$SOURCE_DB" "$path"
    harden_source
    pii_scan_source
    info "tables in $SOURCE_DB.$SOURCE_SCHEMA: $(dbq "$SOURCE_DB" "select count(*) from information_schema.tables where table_schema = '$SOURCE_SCHEMA' and table_type = 'BASE TABLE'")"
    echo pg >"$STATE/route"
  fi
  timing "load-dump ($kind)" $((SECONDS - t0))
}

cmd_stage() {
  local route
  if ((DRY)); then
    plan "pg route: staging:load from $SOURCE_DB (CLOUD_SOURCE_URL = read-only role) into $STAGING_DB; ndjson route: already loaded"
    plan "copy schemas staging_cloud and archive_cloud from $STAGING_DB into $DB (pg_dump | pg_restore) and compare table counts"
    return 0
  fi
  need_tools psql pg_dump pg_restore
  require_server
  assert_ours "$DB"
  need_secrets
  route=$(cat "$STATE/route" 2>/dev/null || true)
  [ -n "$route" ] || die "no dump loaded yet: run load-dump first"
  local t0=$SECONDS
  if [ "$route" = pg ]; then
    need_tools npm
    [ -d "$REPO_ROOT/node_modules" ] || die "run npm ci in $REPO_ROOT first"
    (unset PP_STAGING_DB_ALLOWLIST
      DATABASE_URL=$(make_url "$PGUSER" "${PGPASSWORD:-}" "$STAGING_DB"); export DATABASE_URL
      CLOUD_SOURCE_URL=$(make_url "$READER" "$(state_get secrets.env READER_PASSWORD)" "$SOURCE_DB"); export CLOUD_SOURCE_URL
      export PP_ALLOW_STAGING_RESET=1 NODE_ENV=development
      cd "$REPO_ROOT" && npm run staging:load -w @pp/api -- --source cloud --source-schema "$SOURCE_SCHEMA")
    timing "staging:load (pg route)" $((SECONDS - t0))
  fi
  local t1=$SECONDS
  psql_db "$DB" -c 'drop schema if exists staging_cloud cascade' -c 'drop schema if exists archive_cloud cascade'
  pg_dump -Fc -n staging_cloud -n archive_cloud -d "$STAGING_DB" | pg_restore --no-owner --no-acl --exit-on-error -d "$DB"
  local a b
  a=$(dbq "$STAGING_DB" "select count(*) from information_schema.tables where table_schema in ('staging_cloud','archive_cloud')")
  b=$(dbq "$DB" "select count(*) from information_schema.tables where table_schema in ('staging_cloud','archive_cloud')")
  if [ "$a" != "$b" ] || [ "$a" = 0 ]; then die "STAGE COPY FAILED: $a tables in $STAGING_DB, $b in $DB"; fi
  info "STAGE COPY PASSED: $b tables (staging_cloud + archive_cloud) now in $DB"
  timing "stage-copy" $((SECONDS - t1))
}

valid_snap() { [[ $1 =~ ^[a-z0-9_]{1,24}$ ]] || DIE_CODE=2 die "snapshot name: lowercase letters, digits, _ (max 24)"; [ $((${#DB} + ${#1} + 7)) -le 63 ] || DIE_CODE=2 die "snapshot name too long for this database name"; }

cmd_snapshot() {
  local name=$ARG1
  [ -n "$name" ] || DIE_CODE=2 die "usage: snapshot <name>"
  valid_snap "$name"
  local snapdb
  snapdb="$(snap_prefix)$name"
  if ((DRY)); then
    if ((DUMPMODE)); then plan "pg_dump -Fc $DB -> \$STATE/snapshots/$name.dump (+ .sha256, row counts)"; else plan "create database $snapdb template $DB (no sessions on $DB allowed) + row counts"; fi
    return 0
  fi
  need_tools psql pg_dump
  require_server
  assert_ours "$DB"
  db_exists "$DB" || die "run 'up' first"
  # One name, one snapshot: the template and the dump forms share the counts file, so they must not collide.
  if [ -e "$STATE/snapshots/$name.counts" ] || [ -e "$STATE/snapshots/$name.dump" ] || db_exists "$snapdb"; then
    die "a snapshot named '$name' already exists (template or dump form); use another name"
  fi
  local t0=$SECONDS
  table_counts "$DB" >"$STATE/snapshots/$name.counts.tmp"
  if ((DUMPMODE)); then
    if ! pg_dump -Fc -Z 1 -d "$DB" -f "$STATE/snapshots/$name.dump"; then
      # a partial dump would block this name for good: remove it and the counts before failing
      rm -f "$STATE/snapshots/$name.dump" "$STATE/snapshots/$name.counts.tmp"
      die "pg_dump of $DB failed; no snapshot '$name' was kept"
    fi
    (cd "$STATE/snapshots" && sha256sum "$name.dump" >"$name.dump.sha256")
    info "snapshot '$name' written as a dump ($(du -h "$STATE/snapshots/$name.dump" | cut -f1))"
  else
    db_exists "$snapdb" && die "snapshot '$name' exists (use another name)"
    local others
    others=$(dbq "$ADMIN_DB" "select count(*) from pg_stat_activity where datname = '$DB' and pid <> pg_backend_pid()")
    [ "$others" = 0 ] || die "$others other session(s) are connected to $DB; a template copy needs none. Stop the API/ETL and retry, or use --dump."
    if ! psql_db "$ADMIN_DB" -c "create database \"$snapdb\" template \"$DB\"" -c "comment on database \"$snapdb\" is '$MARK'"; then
      rm -f "$STATE/snapshots/$name.counts.tmp"
      die "template copy $snapdb failed; no snapshot '$name' was kept (if $snapdb exists without the marker comment, drop it by hand)"
    fi
    info "snapshot '$name' created as database $snapdb"
  fi
  mv "$STATE/snapshots/$name.counts.tmp" "$STATE/snapshots/$name.counts"
  info "recorded row counts of $(wc -l <"$STATE/snapshots/$name.counts" | tr -d ' ') tables"
  timing "snapshot $name" $((SECONDS - t0))
}

cmd_restore_snapshot() {
  local name=$ARG1 snapdb
  [ -n "$name" ] || DIE_CODE=2 die "usage: restore-snapshot <name>"
  valid_snap "$name"
  snapdb="$(snap_prefix)$name"
  if ((DRY)); then
    plan "(needs --yes) record row counts of $DB, drop $DB (connections terminated), recreate from snapshot '$name', compare row counts with the snapshot"
    return 0
  fi
  ((YES)) || die "restore-snapshot replaces the target database $DB: add --yes"
  need_tools psql pg_restore
  require_server
  assert_ours "$DB"
  [ -f "$STATE/snapshots/$name.counts" ] || die "no snapshot '$name' recorded in $STATE/snapshots"
  local t0=$SECONDS
  table_counts "$DB" >"$STATE/snapshots/$name.before-restore.counts" 2>/dev/null || true
  if [ -f "$STATE/snapshots/$name.dump" ]; then
    (cd "$STATE/snapshots" && sha256sum --quiet -c "$name.dump.sha256") || die "snapshot dump checksum failed"
    drop_db "$DB"
    create_db "$DB"
    pg_restore --no-owner --no-acl --exit-on-error -j "$JOBS" -d "$DB" "$STATE/snapshots/$name.dump"
  else
    db_exists "$snapdb" || die "snapshot database $snapdb is missing"
    drop_db "$DB"
    psql_db "$ADMIN_DB" -c "create database \"$DB\" template \"$snapdb\"" -c "comment on database \"$DB\" is '$MARK'"
  fi
  table_counts "$DB" >"$STATE/snapshots/$name.after-restore.counts"
  if diff -q "$STATE/snapshots/$name.counts" "$STATE/snapshots/$name.after-restore.counts" >/dev/null; then
    local changed
    changed=$(diff <(cut -f1,2 "$STATE/snapshots/$name.before-restore.counts") "$STATE/snapshots/$name.counts" | grep -c '^>' || true)
    info "ROLLBACK VERIFIED: every table of $DB has the snapshot's row count again ($changed table(s) differed before the rollback)"
  else
    diff "$STATE/snapshots/$name.counts" "$STATE/snapshots/$name.after-restore.counts" >&2 || true
    die "ROLLBACK CHECK FAILED: row counts differ from the snapshot"
  fi
  verify_migrations "$DB"
  timing "restore-snapshot $name" $((SECONDS - t0))
}

cmd_exec() {
  local scope=$ARG1 url
  [ "${#CMD[@]}" -gt 0 ] || DIE_CODE=2 die "usage: exec <target|staging> [--with-source] -- <command...>"
  case "$scope" in target) url_db=$DB ;; staging) url_db=$STAGING_DB ;; *) DIE_CODE=2 die "scope must be target or staging" ;; esac
  if ((DRY)); then plan "cd $REPO_ROOT && DATABASE_URL=<$url_db> $( ((WITH_SOURCE)) && echo "CLOUD_SOURCE_URL=<$SOURCE_DB as $READER> ")${CMD[*]}"; return 0; fi
  need_tools psql
  require_server
  assert_ours "$url_db"
  db_exists "$url_db" || die "database $url_db does not exist (run up)"
  if ((WITH_SOURCE)) || [ -z "${IC_HASH_KEY:-}" ]; then need_secrets; fi
  url=$(make_url "$PGUSER" "${PGPASSWORD:-}" "$url_db")
  # Secrets go into the child's environment only (never argv, so not visible in ps).
  (
    export DATABASE_URL=$url
    # Nothing leaks in from the caller's shell: no stray source URL, no staging allow-list. The ETL only needs
    # NODE_ENV to be something other than production (it refuses anonymised data there), so force development.
    unset CLOUD_SOURCE_URL PP_STAGING_DB_ALLOWLIST
    export NODE_ENV=development
    if ((WITH_SOURCE)); then
      CLOUD_SOURCE_URL=$(make_url "$READER" "$(state_get secrets.env READER_PASSWORD)" "$SOURCE_DB")
      export CLOUD_SOURCE_URL
    fi
    # The same key for the full run and every delta run (hash columns must stay comparable).
    if [ -z "${IC_HASH_KEY:-}" ]; then IC_HASH_KEY=$(state_get secrets.env IC_HASH_KEY); export IC_HASH_KEY; fi
    cd "$REPO_ROOT"
    exec "${CMD[@]}"
  )
}

cmd_status() {
  need_tools psql
  if ((DRY)); then plan "show settings, databases, migrations, snapshots, timings"; return 0; fi
  info "mode: $MODE   host: ${PGHOST}:${PGPORT}   admin role: ${PGUSER}   target: $DB"
  require_server
  info "server: $(dbq "$ADMIN_DB" 'select version()' | cut -c1-70)"
  info "--- settings"
  psql_db "$ADMIN_DB" -At -F ' = ' -c "select name, setting||coalesce(unit,'') from pg_settings where name in ('shared_buffers','work_mem','maintenance_work_mem','max_connections','TimeZone','fsync','synchronous_commit','full_page_writes','wal_level','max_wal_size','log_min_duration_statement') order by 1" | sed 's/^/  /'
  if [ "$(dbq "$ADMIN_DB" "select count(*) from pg_settings where (name in ('fsync','synchronous_commit','full_page_writes') and setting = 'off')")" != 0 ]; then
    info "  WARNING: fsync / synchronous_commit / full_page_writes is off here: write timings are NOT production-like"
  fi
  info "--- databases"
  local d
  for d in "$DB" "$STAGING_DB" "$SOURCE_DB"; do
    if db_exists "$d"; then
      info "  $d: $(dbq "$ADMIN_DB" "select pg_size_pretty(pg_database_size('$d'))")$(db_marked "$d" && echo ', marked' || echo ', NOT created by this tool')"
    else
      info "  $d: absent"
    fi
  done
  if db_exists "$DB"; then
    info "--- migrations in $DB"
    if [ "$(dbq "$DB" "select to_regclass('_prisma_migrations') is not null")" = t ]; then
      info "  applied: $(dbq "$DB" "select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null") of $(folder_migrations | wc -l | tr -d ' ') in the folder"
    else
      info "  _prisma_migrations does not exist (not migrated)"
    fi
    info "  public tables: $(dbq "$DB" "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")   staging_cloud tables: $(dbq "$DB" "select count(*) from information_schema.tables where table_schema='staging_cloud'")"
  fi
  info "--- snapshots"
  { snap_dbs | sed "s/^$(snap_prefix)/  database: /"; find "$STATE/snapshots" -name '*.dump' -printf '  dump: %f\n' 2>/dev/null; } || true
  info "--- route: $(cat "$STATE/route" 2>/dev/null || echo 'no dump loaded')"
  if [ -f "$STATE/timings.log" ]; then info "--- timings (UTC, step, seconds)"; sed 's/^/  /' "$STATE/timings.log"; fi
}

cmd_reset() {
  if ((DRY)); then plan "(needs --yes) drop $DB, $STAGING_DB, $SOURCE_DB and all snapshots, delete snapshot files and the route, then run up"; return 0; fi
  ((YES)) || die "reset destroys every rehearsal database (incl. restored dump data): add --yes"
  need_tools psql
  [ "$MODE" = docker ] && { need_tools docker; dc up -d --wait db; }
  require_server
  local s
  for s in $(snap_dbs); do drop_db "$s"; done
  drop_db "$DB"; drop_db "$STAGING_DB"; drop_db "$SOURCE_DB"
  rm -rf "${STATE:?}/snapshots" "$STATE/route"
  mkdir -p "$STATE/snapshots"
  info "all rehearsal databases dropped; rebuilding"
  cmd_up
}

cmd_down() {
  if ((DRY)); then
    if [ "$MODE" = docker ] && ((KEEP_VOLUME)); then
      plan "(needs --yes) docker compose -p pp-rehearsal down --remove-orphans: stop the container; the data volume AND the state dir are kept"
    elif [ "$MODE" = docker ]; then
      plan "(needs --yes) docker compose -p pp-rehearsal down --volumes --remove-orphans; delete the state dir"
    else
      plan "(needs --yes) drop $DB, $STAGING_DB, $SOURCE_DB, snapshots and role $READER; delete the state dir"
    fi
    return 0
  fi
  ((YES)) || die "down removes the rehearsal data: add --yes"
  if [ "$MODE" = docker ]; then
    need_tools docker
    if ((KEEP_VOLUME)); then dc down --remove-orphans; info "container stopped; the data volume is kept"; return 0; fi
    dc down --volumes --remove-orphans
  else
    need_tools psql
    require_server
    local s
    for s in $(snap_dbs); do drop_db "$s"; done
    drop_db "$DB"; drop_db "$STAGING_DB"; drop_db "$SOURCE_DB"
    if [ "$(dbq "$ADMIN_DB" "select shobj_description(oid,'pg_authid') from pg_roles where rolname='$READER'")" = "$MARK" ]; then
      psql_db "$ADMIN_DB" -c "drop role \"$READER\""
    fi
  fi
  rm -rf "${STATE:?}"
  info "rehearsal environment removed. Still to do by hand: delete the dump, the key file and WAL/backups (docs/ops/rehearsal-db.md section 9)."
}

# ---------------------------------------------------------------- dispatch
case "$SUB" in
  help) usage; exit 0 ;;
  up | load-dump | stage | snapshot | restore-snapshot | exec | status | reset | down) ;;
  *) DIE_CODE=2 die "unknown command: $SUB (try: help)" ;;
esac

if ((DRY)) && [ "$MODE" = docker ] && [ ! -f "$ENV_FILE" ]; then
  PGHOST=127.0.0.1 PGPORT=$PORT PGUSER=${POSTGRES_USER:-pp_rehearsal_admin}   # dry-run needs no credentials
  info "note: $ENV_FILE does not exist yet (needed for a real run)"
elif ((DRY)) && [ "$MODE" = host ] && [ -z "${PP_REHEARSAL_ADMIN_URL:-}" ]; then
  PGHOST=host-not-set PGPORT=0 PGUSER=admin
  info "note: PP_REHEARSAL_ADMIN_URL is not set (needed for a real run)"
else
  setup_connection
fi
init_state

case "$SUB" in
  up) cmd_up ;;
  load-dump) cmd_load_dump ;;
  stage) cmd_stage ;;
  snapshot) cmd_snapshot ;;
  restore-snapshot) cmd_restore_snapshot ;;
  exec) cmd_exec ;;
  status) cmd_status ;;
  reset) cmd_reset ;;
  down) cmd_down ;;
esac
