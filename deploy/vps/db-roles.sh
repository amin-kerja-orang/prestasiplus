#!/usr/bin/env bash
# Least-privilege PostgreSQL roles for production (cutover plan P3, LEAD decision 23 Oct on #220).
# Runbook: docs/ops/production-vps.md section 3.1. SQL: deploy/vps/db-roles/{apply,check}.sql.
#
#   sudo deploy/vps/db-roles.sh secrets [--rotate app,owner,etl]   (root) passwords into the env files
#   deploy/vps/db-roles.sh apply                                   (deploy user) create / repair roles and grants
#   deploy/vps/db-roles.sh check                                   (deploy user) prove them; P3 evidence lines
#
# Roles (fixed names; none is a superuser, none has CREATEDB / CREATEROLE / REPLICATION / BYPASSRLS):
#   pp_owner   schema owner, DDL. Used only by the one-shot `migrate` service: DATABASE_URL in migrate.env
#   pp_app     the API: DML on the tables, no DDL, nothing on staging_cloud / archive_cloud: DATABASE_URL in api.env
#   pp_etl     the migration role of migrate:* (slot.sh etl): DATABASE_URL in etl.env
#   pp_stager  the stage-only role (slot.sh copy, section 7 drops); no password, local socket in the db container only
# The bootstrap POSTGRES_USER of db.env stays the cluster superuser. Only these scripts use it, always inside the db
# container: db-roles.sh, backup/backup.sh, backup/restore-drill.sh, and a manual restore (runbook section 8).
#
# secrets  generates a 64-hex-character password for each role whose env file does not already hold a valid URL for
#          it (or that is named in --rotate) and writes DATABASE_URL into api.env (pp_app), migrate.env (pp_owner) and
#          etl.env (pp_etl): owner root, group PP_DEPLOY_GROUP, mode 640. Nothing secret is printed or put on a
#          command line. After it, `apply` makes the database match (deploy.sh runs apply on every deploy).
# apply    idempotent: runs db-roles/apply.sql as the bootstrap superuser, then sets the three passwords from the env
#          files with statement logging off. Also hands objects the superuser created (an earlier migrate as the
#          superuser, a restore) to pp_owner, and a staging copy made by another role to pp_stager.
# check    runs db-roles/check.sql (every probe is executed AS the role and rolled back) plus a real network login
#          with each env-file password. Prints PASS/FAIL lines, exit 1 on any FAIL.
set -Eeuo pipefail
umask 077
export PP_SCRIPT=db-roles
# shellcheck source-path=SCRIPTDIR
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

usage() { sed -n '2,25p' "${BASH_SOURCE[0]}"; }
cmd="${1:-}"; [ $# -eq 0 ] || shift
case "$cmd" in -h|--help|help|'') usage; exit 0 ;; esac

sql_dir="$PP_VPS_DIR/db-roles"
db_env="$PP_ENV_DIR/db.env"

# role_of KIND / file_of KIND
role_of() { case "$1" in app) echo "$PP_DB_ROLE_APP" ;; owner) echo "$PP_DB_ROLE_OWNER" ;; etl) echo "$PP_DB_ROLE_ETL" ;; esac; }
file_of() { case "$1" in app) echo "$PP_ENV_DIR/api.env" ;; owner) echo "$PP_ENV_DIR/migrate.env" ;; etl) echo "$PP_ENV_DIR/etl.env" ;; esac; }

target_db() {
  local d
  d="$(pp_env_value "$db_env" POSTGRES_DB)"
  [[ "$d" =~ ^[a-z][a-z0-9_]{0,40}$ ]] || pp_die "POSTGRES_DB in $db_env must be lowercase letters, digits and _" 2
  printf '%s' "$d"
}

# password_of KIND -> the password of that role's DATABASE_URL, after checking the URL names the right role, host and
# database. Dies (without printing the value) when anything is off.
password_of() {
  local kind="$1" f role url db
  f="$(file_of "$kind")"; role="$(role_of "$kind")"; db="$(target_db)"
  [ -r "$f" ] || pp_die "$f is missing or unreadable: run 'sudo deploy/vps/db-roles.sh secrets' first" 3
  url="$(pp_env_value "$f" DATABASE_URL)"
  pp_parse_db_url "$url" || pp_die "DATABASE_URL in $f is not postgresql://USER:PASSWORD@db:5432/DBNAME" 3
  [ "$PP_URL_USER" = "$role" ] || pp_die "DATABASE_URL in $f must use the role $role (run 'sudo deploy/vps/db-roles.sh secrets')" 3
  [ "$PP_URL_HOST" = db ] || pp_die "DATABASE_URL host in $f must be 'db'" 3
  [ "$PP_URL_DB" = "$db" ] || pp_die "DATABASE_URL database in $f differs from POSTGRES_DB" 3
  # The password is pasted into SQL and into a URL: URL-unreserved characters only (the generated ones are hex).
  [[ "$PP_URL_PASSWORD" =~ ^[A-Za-z0-9._~-]{32,128}$ ]] \
    || pp_die "the $role password in $f must be 32-128 characters from A-Z a-z 0-9 . _ ~ - (rotate it: sudo deploy/vps/db-roles.sh secrets --rotate $kind)" 3
  printf '%s' "$PP_URL_PASSWORD"
}

# Settings every SQL session of this script starts with. Logging off: the password statements must never reach
# the server log (a failed statement is logged with its text unless log_min_error_statement is panic).
session_header() {
  printf "SET log_statement = 'none';\nSET log_min_duration_statement = -1;\nSET log_min_error_statement = 'panic';\n"
  printf "SET password_encryption = 'scram-sha-256';\nSET client_min_messages = 'warning';\n"
  printf "SET pp.role_owner = '%s';\nSET pp.role_app = '%s';\nSET pp.role_etl = '%s';\nSET pp.role_stage = '%s';\n" \
    "$PP_DB_ROLE_OWNER" "$PP_DB_ROLE_APP" "$PP_DB_ROLE_ETL" "$PP_DB_ROLE_STAGE"
}

# superuser_psql PSQL_ARGS... : psql as the bootstrap superuser in the db container, script on stdin.
superuser_psql() {
  # shellcheck disable=SC2016  # expands inside the container
  pp_db_exec sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@" -f -' sh "$@"
}

require_db() {
  [ -n "$(pp_compose ps -q db 2>/dev/null || true)" ] || pp_die "the db service is not running (deploy.sh starts it)" 3
  local boot
  boot="$(pp_env_value "$db_env" POSTGRES_USER)"
  case " $PP_DB_ROLE_OWNER $PP_DB_ROLE_APP $PP_DB_ROLE_ETL $PP_DB_ROLE_STAGE " in
    *" $boot "*) pp_die "POSTGRES_USER in $db_env must not be one of the application role names" 2 ;;
  esac
}

# ------------------------------------------------------------------------------------------------------------
cmd_secrets() {
  local rotate="" kind f role db url pw group tmp state query
  while [ $# -gt 0 ]; do
    case "$1" in
      --rotate) rotate=",${2:?--rotate needs app, owner and/or etl},"; shift 2 ;;
      *) pp_die "unknown argument: $1" 2 ;;
    esac
  done
  for kind in ${rotate//,/ }; do case "$kind" in app|owner|etl) ;; *) pp_die "--rotate takes app, owner, etl (comma list)" 2 ;; esac; done
  [ -w "$PP_ENV_DIR" ] || pp_die "secrets writes into $PP_ENV_DIR (files root:$(pp_cfg PP_DEPLOY_GROUP ppdeploy) 640): run it with sudo" 3
  command -v openssl >/dev/null || pp_die "openssl is required" 3
  [ -r "$db_env" ] || pp_die "$db_env is missing" 3
  db="$(target_db)"
  group="$(pp_cfg PP_DEPLOY_GROUP ppdeploy)"
  for kind in app owner etl; do
    f="$(file_of "$kind")"; role="$(role_of "$kind")"
    [ "$kind" != app ] || [ -r "$f" ] || pp_die "$f is missing: install api.env first (runbook section 4)" 3
    url="$(pp_env_value "$f" DATABASE_URL)"
    if [[ "$rotate" != *",$kind,"* ]] && pp_parse_db_url "$url" && [ "$PP_URL_USER" = "$role" ] && [ "$PP_URL_HOST" = db ] \
       && [ "$PP_URL_DB" = "$db" ] && [[ "$PP_URL_PASSWORD" =~ ^[A-Za-z0-9._~-]{32,128}$ ]]; then
      pp_log "$(basename "$f"): DATABASE_URL for $role kept"
      continue
    fi
    # Keep connection parameters of the current URL (for example ?connection_limit=...); only user and password change.
    query=""
    if pp_parse_db_url "$url"; then query="$PP_URL_QUERY"; fi
    [[ "$query" =~ ^(\?[A-Za-z0-9_.~=\&%-]*)?$ ]] || pp_die "the query string of DATABASE_URL in $f has unexpected characters: fix it by hand first" 3
    [ -z "$query" ] || pp_log "$(basename "$f"): keeping the connection parameters of the current DATABASE_URL"
    pw="$(openssl rand -hex 32)"
    tmp="$(mktemp "$PP_ENV_DIR/.$(basename "$f").XXXXXX")"
    # Replace the first DATABASE_URL line in place, drop any later one, append when there is none. The URL reaches
    # awk through the environment, never through the command line.
    if [ -e "$f" ]; then
      PP_NEW_URL="postgresql://$role:$pw@db:5432/$db$query" awk '
        /^DATABASE_URL=/ { if (!done) { print "DATABASE_URL=" ENVIRON["PP_NEW_URL"]; done = 1 } next }
        { print }
        END { if (!done) print "DATABASE_URL=" ENVIRON["PP_NEW_URL"] }' "$f" >"$tmp"
      state="new password"
    else
      {
        printf '# DATABASE_URL of the %s role (written by deploy/vps/db-roles.sh secrets; runbook section 3.1). Never in git.\n' "$role"
        PP_NEW_URL="postgresql://$role:$pw@db:5432/$db" awk 'BEGIN { print "DATABASE_URL=" ENVIRON["PP_NEW_URL"] }'
      } >"$tmp"
      state="created"
    fi
    unset pw
    chmod 640 "$tmp"
    if [ "$(id -u)" = 0 ]; then chown "root:$group" "$tmp"; fi
    mv -f "$tmp" "$f"
    pp_log "$(basename "$f"): DATABASE_URL for $role written ($state)"
  done
  pp_log "next: deploy/vps/db-roles.sh apply (as the deploy user; deploy.sh also runs it), then recreate the api if its password changed"
}

# ------------------------------------------------------------------------------------------------------------
cmd_apply() {
  [ $# -eq 0 ] || pp_die "apply takes no arguments" 2
  require_db
  local pw_app pw_owner pw_etl
  pw_app="$(password_of app)"; pw_owner="$(password_of owner)"; pw_etl="$(password_of etl)"
  [ "$pw_app" != "$pw_owner" ] && [ "$pw_app" != "$pw_etl" ] && [ "$pw_owner" != "$pw_etl" ] \
    || pp_die "the three role passwords must differ (sudo deploy/vps/db-roles.sh secrets --rotate ...)" 3
  pp_lock "$(pp_cfg PP_LOCK_WAIT 1800)"
  pp_log "applying roles $PP_DB_ROLE_OWNER, $PP_DB_ROLE_APP, $PP_DB_ROLE_ETL, $PP_DB_ROLE_STAGE to $(target_db)"
  {
    session_header
    cat "$sql_dir/apply.sql"
    printf "ALTER ROLE %s PASSWORD '%s';\n" "$PP_DB_ROLE_APP" "$pw_app" "$PP_DB_ROLE_OWNER" "$pw_owner" "$PP_DB_ROLE_ETL" "$pw_etl"
  } | superuser_psql -q -1 2> >(sed -E "s/PASSWORD '[^']*'/PASSWORD '***'/g" >&2) >/dev/null
  pp_log "DB ROLES APPLIED (run 'deploy/vps/db-roles.sh check' for the evidence)"
}

# ------------------------------------------------------------------------------------------------------------
cmd_check() {
  [ $# -eq 0 ] || pp_die "check takes no arguments" 2
  require_db
  local out fails=0 total=0 line kind role pw got
  out="$({
    session_header
    cat "$sql_dir/check.sql"
    echo "SELECT result || ' | ' || role || ' | ' || probe || ' | ' || detail FROM pg_temp.pp_db_roles_check();"
  } | superuser_psql -q -At)"
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    total=$((total + 1))
    case "$line" in PASS*) ;; *) fails=$((fails + 1)) ;; esac
    printf '%s\n' "$line"
  done <<<"$out"

  # Real logins over the network with the env-file passwords (proves files and database agree). The password goes
  # to psql on stdin, never on a command line or into the container's environment. The host is the compose service
  # name `db`, NOT 127.0.0.1: the official image trusts loopback (initdb default), so a loopback login would accept any
  # password; the container's network address hits the `host all all all scram-sha-256` rule the api uses too.
  local net_host
  net_host="$(pp_cfg PP_DB_ROLES_NET_HOST db)"
  for kind in app owner etl; do
    role="$(role_of "$kind")"; pw="$(password_of "$kind")"
    # shellcheck disable=SC2016  # expands inside the container
    got="$(printf '%s\n' "$pw" | pp_db_exec sh -c 'IFS= read -r PGPASSWORD; export PGPASSWORD; exec psql -X -At -h "$2" -U "$1" -d "$POSTGRES_DB" -c "select current_user || chr(32) || rolsuper from pg_roles where rolname = current_user"' sh "$role" "$net_host" 2>&1 || true)"
    total=$((total + 1))
    if [ "$got" = "$role false" ]; then echo "PASS | $kind | network login as $role with $(basename "$(file_of "$kind")") | logged in, not a superuser"
    else fails=$((fails + 1)); echo "FAIL | $kind | network login as $role with $(basename "$(file_of "$kind")") | $(head -n1 <<<"$got" | cut -c1-200)"; fi
  done
  # A fresh API session cannot create temporary tables either (no TEMP on the database).
  pw="$(password_of app)"
  # shellcheck disable=SC2016  # expands inside the container
  got="$(printf '%s\n' "$pw" | pp_db_exec sh -c 'IFS= read -r PGPASSWORD; export PGPASSWORD; exec psql -X -At -h "$2" -U "$1" -d "$POSTGRES_DB" -c "create temp table pp_role_probe (i int)"' sh "$PP_DB_ROLE_APP" "$net_host" 2>&1 || true)"
  total=$((total + 1))
  case "$got" in
    *"permission denied to create temporary tables"*) echo "PASS | app | CREATE TEMP TABLE in a fresh $PP_DB_ROLE_APP session -> expect denied | denied: $(grep -o 'permission denied to create temporary tables in database "[^"]*"' <<<"$got" | head -n1)" ;;
    *) fails=$((fails + 1)); echo "FAIL | app | CREATE TEMP TABLE in a fresh $PP_DB_ROLE_APP session -> expect denied | $(head -n1 <<<"$got" | cut -c1-200)" ;;
  esac
  unset pw
  # The stage role has no password: the network refuses it, the local socket in the db container accepts it.
  # shellcheck disable=SC2016
  got="$(pp_db_exec sh -c 'PGPASSWORD=not-the-password psql -X -At -h "$2" -U "$1" -d "$POSTGRES_DB" -c "select 1"' sh "$PP_DB_ROLE_STAGE" "$net_host" 2>&1 || true)"
  total=$((total + 1))
  case "$got" in
    *"password authentication failed"*) echo "PASS | stage | network login as $PP_DB_ROLE_STAGE | refused (no password)" ;;
    *) fails=$((fails + 1)); echo "FAIL | stage | network login as $PP_DB_ROLE_STAGE | expected a refusal, got: $(head -n1 <<<"$got" | cut -c1-200)" ;;
  esac
  # shellcheck disable=SC2016
  got="$(pp_db_exec sh -c 'exec psql -X -At -U "$1" -d "$POSTGRES_DB" -c "select current_user"' sh "$PP_DB_ROLE_STAGE" 2>&1 || true)"
  total=$((total + 1))
  if [ "$got" = "$PP_DB_ROLE_STAGE" ]; then echo "PASS | stage | local socket login as $PP_DB_ROLE_STAGE (slot.sh copy) | logged in"
  else fails=$((fails + 1)); echo "FAIL | stage | local socket login as $PP_DB_ROLE_STAGE (slot.sh copy) | $(head -n1 <<<"$got" | cut -c1-200)"; fi

  if [ "$fails" -gt 0 ]; then pp_die "DB ROLES CHECK FAILED: $fails of $total probes (run 'deploy/vps/db-roles.sh apply', then check again)" 1; fi
  pp_log "DB ROLES CHECK PASSED: $total probes"
}

case "$cmd" in
  secrets) cmd_secrets "$@" ;;
  apply) cmd_apply "$@" ;;
  check) cmd_check "$@" ;;
  *) pp_die "unknown command: $cmd (secrets | apply | check)" 2 ;;
esac
