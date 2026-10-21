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

pp_log()  { printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${PP_SCRIPT:-pp}" "$*"; }
pp_warn() { pp_log "WARN: $*" >&2; }
pp_die()  { pp_log "ERROR: $1" >&2; exit "${2:-1}"; }

# pp_env_value FILE KEY -> last value of KEY in an env file (compose rules: no export, quotes stripped, an unquoted
# value ends at " #"). Prints nothing when absent. Never evaluates the file.
pp_env_value() {
  local file="$1" key="$2" line val=""
  [ -r "$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      "$key="*) val="${line#"$key="}" ;;
    esac
  done <"$file"
  case "$val" in
    \"*\") val="${val#\"}"; val="${val%\"}" ;;
    \'*\') val="${val#\'}"; val="${val%\'}" ;;
    *) val="${val%%[[:space:]]#*}"; val="${val%"${val##*[![:space:]]}"}" ;;
  esac
  printf '%s' "$val"
}

# pp_cfg KEY DEFAULT -> environment, else prod.env, else DEFAULT
pp_cfg() {
  local key="$1" def="${2:-}" v
  v="${!key:-}"
  [ -n "$v" ] || v="$(pp_env_value "$PP_PROD_ENV" "$key")"
  [ -n "$v" ] || v="$def"
  printf '%s' "$v"
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

# pp_ping URL [suffix]: healthchecks.io-style ping (suffix: start | fail | empty). Never fails the caller.
pp_ping() {
  local url="$1" suffix="${2:-}"
  [ -n "$url" ] || return 0
  command -v curl >/dev/null || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "${url%/}${suffix:+/$suffix}" 2>/dev/null || pp_warn "ping failed ($suffix)"
  return 0
}

# pp_alert MESSAGE: journal/stderr always; webhook when PP_ALERT_WEBHOOK_URL is set. Never fails the caller.
pp_alert() {
  local msg="$1" url
  pp_warn "ALERT: $msg"
  url="$(pp_cfg PP_ALERT_WEBHOOK_URL '')"
  [ -n "$url" ] || return 0
  command -v curl >/dev/null || return 0
  curl -fsS -m 10 --retry 2 -o /dev/null -H 'Content-Type: text/plain; charset=utf-8' \
    --data-binary "[$(pp_cfg PP_DOMAIN host)] $msg" "$url" 2>/dev/null || pp_warn "alert webhook failed"
  return 0
}

# ---- health checks through the edge (used by deploy.sh and rollback.sh) ----
# _pp_curl_edge PORT SCHEME PATH [curl args]: talk to THIS server's edge with the real host name
_pp_curl_edge() {
  local domain; domain="$(pp_cfg PP_DOMAIN '')"
  local port="$1" scheme="$2" path="$3"; shift 3
  curl -sS -m 15 --resolve "$domain:$port:127.0.0.1" "$@" "$scheme://$domain$path"
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
  code="$(_pp_curl_edge 443 https / -o /dev/null -w '%{http_code}')"; [ "$code" = 200 ] || { pp_warn "/ -> $code"; return 1; }
  code="$(_pp_curl_edge 443 https /api/metrics -o /dev/null -w '%{http_code}')"; [ "$code" = 404 ] || { pp_warn "/api/metrics -> $code (must be 404 at the edge)"; return 1; }
  code="$(_pp_curl_edge 80 http /x -o /dev/null -w '%{http_code}')"; [ "$code" = 301 ] || { pp_warn "http -> $code (must redirect 301)"; return 1; }
  pp_log "health checks passed: /api/health 200, /api/ready ready, / 200, /api/metrics 404, http redirects"
}
