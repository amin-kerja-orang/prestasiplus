#!/usr/bin/env bash
# Shared helpers for deploy/vps/*.sh. Sourced, never executed. No secrets are read into variables except where a
# check needs a value to validate it (length, equality); nothing secret is printed.
#
# Configuration order for every PP_* setting: process environment, then prod.env, then the default given by the caller.

PP_VPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PP_REPO="$(cd "$PP_VPS_DIR/../.." && pwd)"
PP_ENV_DIR="${PP_ENV_DIR:-/etc/pretasiplus}"
export PP_ENV_DIR
PP_PROD_ENV="${PP_PROD_ENV:-$PP_ENV_DIR/prod.env}"

# Least-privilege database roles (cutover plan P3; deploy/vps/db-roles.sh, runbook section 3.1). Fixed names.
PP_DB_ROLE_OWNER=pp_owner    # schema owner: the one-shot migrate service (migrate.env)
PP_DB_ROLE_APP=pp_app        # the API (api.env)
PP_DB_ROLE_ETL=pp_etl        # migrate:* through slot.sh etl (etl.env)
PP_DB_ROLE_STAGE=pp_stager   # stage-only: slot.sh copy and the section 7 drops (no password, local socket only)
export PP_DB_ROLE_OWNER PP_DB_ROLE_APP PP_DB_ROLE_ETL PP_DB_ROLE_STAGE

pp_log()  { printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${PP_SCRIPT:-pp}" "$*"; }
pp_warn() { pp_log "WARN: $*" >&2; }
pp_die()  { pp_log "ERROR: $1" >&2; exit "${2:-1}"; }

# pp_env_value FILE KEY -> last value of KEY in an env file (compose rules: no export, quotes stripped, an unquoted
# value ends at " #", see below). Prints nothing when absent. Never evaluates the file.
pp_env_value() {
  local file="$1" key="$2" line val=""
  [ -r "$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      "$key="*) val="${line#"$key="}" ;;
    esac
  done <"$file"
  # Compose rules: a quoted value ends at the closing quote (anything after it, such as ' # comment', is dropped);
  # an unquoted value ends at ' #' and loses trailing blanks.
  val="${val#"${val%%[![:space:]]*}"}"
  case "$val" in
    \"*) val="${val#\"}"; val="${val%%\"*}" ;;
    \'*) val="${val#\'}"; val="${val%%\'*}" ;;
    *) val="${val%%[[:space:]]#*}"; val="${val%"${val##*[![:space:]]}"}" ;;
  esac
  printf '%s' "$val"
}

# pp_urldecode TEXT -> percent-decoded TEXT ('+' stays a literal plus, as in a URL userinfo)
pp_urldecode() {
  local s="$1" out="" h
  while [ -n "$s" ]; do
    if [[ "$s" =~ ^%([0-9A-Fa-f]{2})(.*)$ ]]; then printf -v h '%b' "\\x${BASH_REMATCH[1]}"; out+="$h"; s="${BASH_REMATCH[2]}"
    else out+="${s:0:1}"; s="${s:1}"; fi
  done
  printf '%s' "$out"
}

# pp_parse_db_url URL -> sets PP_URL_USER, PP_URL_PASSWORD (decoded), PP_URL_HOST, PP_URL_DB, PP_URL_QUERY ('' or
# '?...'); fails on another shape.
# Never prints anything.
# shellcheck disable=SC2034  # output variables, read by the callers
pp_parse_db_url() {
  PP_URL_USER=""; PP_URL_PASSWORD=""; PP_URL_HOST=""; PP_URL_DB=""; PP_URL_QUERY=""
  [[ "$1" =~ ^postgres(ql)?://([^:@/]+):([^@]+)@([^:/]+)(:[0-9]+)?/([^?]+)(\?.*)?$ ]] || return 1
  PP_URL_USER="${BASH_REMATCH[2]}"; PP_URL_HOST="${BASH_REMATCH[4]}"; PP_URL_DB="${BASH_REMATCH[6]}"; PP_URL_QUERY="${BASH_REMATCH[7]}"
  PP_URL_PASSWORD="$(pp_urldecode "${BASH_REMATCH[3]}")"
}

# pp_cfg KEY DEFAULT -> environment, else prod.env, else DEFAULT.
# PP_DOMAIN is the exception: it is read from the prod.env FILE only (an inherited PP_DOMAIN in the shell must never decide which host a
# destructive script believes it is on: the G3 deny list of rebuild-db.sh).
pp_cfg() {
  local key="$1" def="${2:-}" v=""
  [ "$key" = PP_DOMAIN ] || v="${!key:-}"
  [ -n "$v" ] || v="$(pp_env_value "$PP_PROD_ENV" "$key")"
  [ -n "$v" ] || v="$def"
  printf '%s' "$v"
}

# pp_norm_domain TEXT -> the host name lower-cased, trimmed, without any trailing dots (a deny list must not be dodged by case or blanks)
pp_norm_domain() {
  local d="${1,,}"
  d="${d#"${d%%[![:space:]]*}"}"; d="${d%"${d##*[![:space:]]}"}"
  while [[ "$d" == *. ]]; do d="${d%.}"; done
  printf '%s' "$d"
}

# pp_intake_flag_off: returns 0 when INTAKE_TEACHER_ENABLED in api.env is unset or false.
pp_intake_flag_off() {
  local v; v="$(pp_env_value "$PP_ENV_DIR/api.env" INTAKE_TEACHER_ENABLED)"; v="${v,,}"
  case "$v" in ''|false|0|no|off) return 0 ;; esac
  return 1
}

# pp_intake_av_problem [runtime]: prints the reason (and returns 1) when INTAKE_TEACHER_ENABLED is on in api.env while upload scanning is not in place.
# Teacher DOCX/XLSX/PDF uploads are accepted only after a clean ClamAV scan (backlog #78, AZ-35), so the flag is safe only when ALL hold: the code
# being deployed contains the scan (marker CLAMAV_SCAN_ENABLED declared in the API env schema, read from the checked-out source, so no running API
# is needed), compose profile clamav in PP_PROFILES, CLAMAV_HOST set in api.env, and with "runtime" the clamav container running. Configuration
# alone is never enough (the marker is a static check; after the start pp_health_checks also requires /api/ready scanner "ok"). Nothing printed and
# return 0 when the flag is off or all of that holds. PP_AV_SCHEMA_FILE overrides the marker file, honoured ONLY when PP_SCRATCH_HOST=yes (test harness).
pp_intake_av_problem() {
  local mode="${1:-}" api_env="$PP_ENV_DIR/api.env" v profs schema
  v="$(pp_env_value "$api_env" INTAKE_TEACHER_ENABLED)"; v="${v,,}"
  case "$v" in ''|false|0|no|off) return 0 ;; esac
  schema="$PP_REPO/apps/api/src/common/config/env.schema.ts"
  [ "$(pp_env_value "$PP_PROD_ENV" PP_SCRATCH_HOST)" != yes ] || schema="${PP_AV_SCHEMA_FILE:-$schema}"   # the prod.env FILE only, like is_scratch_host
  if ! grep -q 'CLAMAV_SCAN_ENABLED' "$schema" 2>/dev/null; then
    printf 'INTAKE_TEACHER_ENABLED=%s in %s but this build has no upload scan code (CLAMAV_SCAN_ENABLED is not in the API env schema): uploads would not be virus-scanned (set it to false, or deploy a build with the scanner)' "$v" "$api_env"; return 1
  fi
  profs=",$(pp_cfg PP_PROFILES ''),"
  if [[ "$profs" != *,clamav,* ]]; then
    printf 'INTAKE_TEACHER_ENABLED=%s in %s but the clamav compose profile is not in PP_PROFILES: teacher DOCX/XLSX uploads would not be virus-scanned (set it to false, or run ClamAV first)' "$v" "$api_env"; return 1
  fi
  if [ -z "$(pp_env_value "$api_env" CLAMAV_HOST)" ]; then
    printf 'INTAKE_TEACHER_ENABLED=%s in %s but CLAMAV_HOST is not set there: uploads would not be virus-scanned' "$v" "$api_env"; return 1
  fi
  if [ "$mode" = runtime ] && [ -z "$(pp_compose ps -q --status running clamav 2>/dev/null || true)" ]; then
    printf 'INTAKE_TEACHER_ENABLED=%s but the clamav container is not running: uploads are not virus-scanned' "$v"; return 1
  fi
  return 0
}

# pp_image_has_scanner IMAGE: the api image carries the upload scan code (the CLAMAV_SCAN_ENABLED marker in its bundled dist/main.js).
# Unreadable or unknown = no (fail closed).
pp_image_has_scanner() {
  docker run --rm --no-deps --entrypoint sh "$1" -c 'grep -q CLAMAV_SCAN_ENABLED /app/apps/api/dist/main.js' >/dev/null 2>&1
}

# pp_compose ARGS... -> docker compose with the production overlay, prod.env and the configured profiles.
pp_compose() {
  local args=() p profiles
  profiles="$(pp_cfg PP_PROFILES '')"
  IFS=',' read -ra _pp_profiles <<<"$profiles"
  for p in "${_pp_profiles[@]}"; do
    [ -n "$p" ] && args+=(--profile "$p")
  done
  docker compose --project-directory "$PP_REPO" \
    -f "$PP_REPO/compose.yaml" -f "$PP_REPO/deploy/vps/compose.prod.yaml" \
    --env-file "$PP_PROD_ENV" "${args[@]}" "$@"
}

# pp_db_exec CMD... -> run a command inside the running db container (no TTY, stdin passes through).
pp_db_exec() { pp_compose exec -T db "$@"; }

# pp_assert_outside_repo PATH -> refuse a backup path inside the checkout (same rule as scripts/lib/db-ops.mjs).
pp_assert_outside_repo() {
  local p repo
  p="$(readlink -m "$1")"
  repo="$(readlink -f "$PP_REPO")"
  case "$p/" in
    "$repo"/*) pp_die "refusing a path inside the repository: $1 (backups hold personal data of minors)" 3 ;;
  esac
}

# _pp_cfg_quote TEXT -> TEXT escaped for a double-quoted curl config value
_pp_cfg_quote() {
  local t="$1"
  t="${t//\\/\\\\}"; t="${t//\"/\\\"}"; t="${t//$'\n'/\\n}"
  printf '%s' "$t"
}

# pp_ping URL [suffix]: healthchecks.io-style ping (suffix: start | fail | empty). Never fails the caller.
# The URL is a secret (it identifies the check): it goes to curl on stdin (--config -), never on the command line,
# so it is not visible in the process list.
pp_ping() {
  local url="$1" suffix="${2:-}"
  [ -n "$url" ] || return 0
  command -v curl >/dev/null || return 0
  printf 'url = "%s"\n' "$(_pp_cfg_quote "${url%/}${suffix:+/$suffix}")" \
    | curl -fsS -m 10 --retry 3 -o /dev/null --config - 2>/dev/null || pp_warn "ping failed ($suffix)"
  return 0
}

# pp_alert MESSAGE: journal/stderr always; webhook when PP_ALERT_WEBHOOK_URL is set (URL and text via stdin config).
# Callers pass fixed text only: the webhook is a third party. Never fails the caller.
pp_alert() {
  local msg="$1" url
  pp_warn "ALERT: $msg"
  url="$(pp_cfg PP_ALERT_WEBHOOK_URL '')"
  [ -n "$url" ] || return 0
  command -v curl >/dev/null || return 0
  printf 'url = "%s"\nheader = "Content-Type: text/plain; charset=utf-8"\ndata-binary = "%s"\n' \
    "$(_pp_cfg_quote "$url")" "$(_pp_cfg_quote "[$(pp_cfg PP_DOMAIN host)] $msg")" \
    | curl -fsS -m 10 --retry 2 -o /dev/null --config - 2>/dev/null || pp_warn "alert webhook failed"
  return 0
}

# pp_lock [WAIT_SECONDS]: one shared lock for every script that changes or reads a consistent state of the stack
# (backup, deploy, rollback, restore drill, certificate issue/renew). PP_LOCK_FILE (default /var/lock/pretasiplus.lock;
# /run/lock is world-writable on Debian and Ubuntu). A script that holds the lock exports PP_LOCK_HELD=1, so the
# scripts it starts itself (deploy -> backup) do not wait for their parent. WAIT_SECONDS 0 (default) fails at once.
pp_lock() {
  local wait="${1:-0}" f
  [ "${PP_LOCK_HELD:-}" != 1 ] || return 0
  f="$(pp_cfg PP_LOCK_FILE /var/lock/pretasiplus.lock)"
  command -v flock >/dev/null || pp_die "flock is required (util-linux)" 3
  exec 9>>"$f" || pp_die "cannot open the lock file $f (set PP_LOCK_FILE to a path the deploy user can write; run the scripts as the deploy user, not root)" 3
  # Run as root (sudo init-cert.sh, a manual sudo backup) under umask 077, the file would be root:root 0600 and the
  # deploy user's timers would die on it until the next reboot: hand it to the deploy group (PP_DEPLOY_GROUP).
  if [ "$(id -u)" = 0 ]; then
    if ! { chgrp "$(pp_cfg PP_DEPLOY_GROUP ppdeploy)" "$f" 2>/dev/null && chmod 0660 "$f" 2>/dev/null; }; then
      pp_warn "could not hand $f to group $(pp_cfg PP_DEPLOY_GROUP ppdeploy); the deploy user may be locked out of it"
    fi
  fi
  flock -w "$wait" 9 || pp_die "another PrestasiPlus operation (backup, deploy, rollback, restore drill or certificate job) holds $f; wait for it to finish" 75
  export PP_LOCK_HELD=1
}

# pp_running_tag: image tag of the api container that is actually running (empty when none). The recorded
# current.tag is only written at the end of a successful deploy, so after a failed deploy the two differ.
pp_running_tag() {
  local cid img
  cid="$(pp_compose ps -q api 2>/dev/null | head -n1 || true)"
  [ -n "$cid" ] || return 0
  img="$(docker inspect --format '{{.Config.Image}}' "$cid" 2>/dev/null || true)"
  case "${img##*/}" in *:*) printf '%s' "${img##*:}" ;; esac
  return 0
}

# pp_cert_pem DOMAIN: the live certificate chain as PEM on stdout. certbot keeps live/ and archive/ root-only, so the
# deploy user may not read them: fall back to reading the file through the running edge container (no sudo needed).
pp_cert_pem() {
  local d="$1" le f
  le="$(pp_cfg PP_LE_DIR /srv/pretasiplus/letsencrypt)"
  f="$le/live/$d/fullchain.pem"
  if [ -r "$f" ]; then cat "$f"; return 0; fi
  pp_compose exec -T edge cat "/etc/letsencrypt/live/$d/fullchain.pem" 2>/dev/null
}

# pp_cert_is_selfsigned PEM_TEXT: success when issuer and subject are the same (the init-cert.sh placeholder or any
# other self-signed certificate; a Let's Encrypt certificate always has a different issuer).
pp_cert_is_selfsigned() {
  local i s
  i="$(openssl x509 -noout -issuer -nameopt RFC2253 <<<"$1" 2>/dev/null)" || return 1
  s="$(openssl x509 -noout -subject -nameopt RFC2253 <<<"$1" 2>/dev/null)" || return 1
  [ "${i#issuer=}" = "${s#subject=}" ]
}

# ---- health checks through the edge (used by deploy.sh and rollback.sh) ----
# _pp_curl_edge PORT SCHEME PATH [curl args]: talk to THIS server's edge with the real host name
_pp_curl_edge() {
  local domain; domain="$(pp_cfg PP_DOMAIN '')"
  local port="$1" scheme="$2" path="$3"; shift 3
  local bind; bind="$(pp_cfg PP_HTTP_BIND 0.0.0.0)"
  [ "$bind" != 0.0.0.0 ] || bind=127.0.0.1
  curl -sS -m 15 --resolve "$domain:$port:$bind" "$@" "$scheme://$domain$path"
}

pp_health_checks() {
  local code body
  pp_log "waiting for /api/ready through the edge (up to 2 minutes)"
  for _ in $(seq 1 24); do
    code="$(_pp_curl_edge 443 https /api/ready -o /dev/null -w '%{http_code}' || true)"
    [ "$code" = 200 ] && break
    sleep 5
  done
  [ "${code:-}" = 200 ] || return 1
  code="$(_pp_curl_edge 443 https /api/health -o /dev/null -w '%{http_code}')"; [ "$code" = 200 ] || { pp_warn "/api/health -> $code"; return 1; }
  body="$(_pp_curl_edge 443 https /api/ready)"; grep -q '"status":"ready"' <<<"$body" || { pp_warn "/api/ready body is not ready"; return 1; }
  # Upload scan proof (#78): with teacher intake on, the running API must report scanner ok (clamd answers PING). clamd needs a few minutes to
  # load signatures after its first start, so wait up to 6 minutes.
  if ! pp_intake_flag_off; then
    pp_log "INTAKE_TEACHER_ENABLED is on: waiting for /api/ready scanner ok (up to 6 minutes)"
    for _ in $(seq 1 72); do
      body="$(_pp_curl_edge 443 https /api/ready || true)"
      grep -q '"scanner":"ok"' <<<"$body" && break
      sleep 5
    done
    grep -q '"scanner":"ok"' <<<"$body" || { pp_warn "INTAKE_TEACHER_ENABLED is on but /api/ready does not report scanner ok (clamav not answering)"; return 1; }
  fi
  code="$(_pp_curl_edge 443 https / -o /dev/null -w '%{http_code}')"; [ "$code" = 200 ] || { pp_warn "/ -> $code"; return 1; }
  code="$(_pp_curl_edge 443 https /api/metrics -o /dev/null -w '%{http_code}')"; [ "$code" = 404 ] || { pp_warn "/api/metrics -> $code (must be 404 at the edge)"; return 1; }
  code="$(_pp_curl_edge 80 http /x -o /dev/null -w '%{http_code}')"; [ "$code" = 301 ] || { pp_warn "http -> $code (must redirect 301)"; return 1; }
  pp_log "health checks passed: /api/health 200, /api/ready ready, / 200, /api/metrics 404, http redirects"
}
