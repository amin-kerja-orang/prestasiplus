#!/usr/bin/env bash
# Migrate-then-deploy for the production VPS (AZ-09). Runbook: docs/ops/production-vps.md (section 7)
#
#   deploy/vps/deploy.sh [--dry-run] [--yes] [--skip-backup] [--allow-dirty] [--tag IMAGE_TAG]
#
# NOTE: the deploy user is in the docker group, which is root-equivalent on this host: treat its SSH key like root's.
#
# Run it on the VPS from the checkout of the RELEASE commit (the LEAD tags it; no merges after the tag), as the
# deploy user. It needs the explicit confirmation of the user (type the domain) unless --yes is given; the LEAD
# gives that confirmation, not this script. --dry-run changes nothing: it runs every read-only check for real
# (env files, placeholders, the fail-closed seed guard, `docker compose config -q`), then prints each step.
#
# Order (a failed step stops the run; there is NO automatic rollback because migrations are forward-only):
#   1 preflight   2 pre-deploy backup   3 build or pull images tagged with the git sha   4 db up
#   5 migrate (one-shot, `prisma migrate deploy` only, never a seed)   6 api + frontend up (wait healthy)
#   7 edge (re)created   8 health checks through the edge: /api/health, /api/ready, /, /api/metrics (404), http->https
#   9 record current and previous image tag for rollback.sh
#
# Reference data (the school_packages catalogue and SPM subject configs) is NOT part of a deploy. Load it once,
# explicitly: `deploy/vps/deploy.sh --seed-reference` (runs `be:db:seed` with ALLOW_DEMO_SEED=false; production loads
# reference modules only and skips every demo module).
set -Eeuo pipefail
umask 077
export PP_SCRIPT=deploy
# shellcheck source-path=SCRIPTDIR
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

dry=0; yes=0; skip_backup=0; allow_dirty=0; tag=""; seed_reference=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) dry=1; shift ;;
    --yes) yes=1; shift ;;
    --skip-backup) skip_backup=1; shift ;;
    --allow-dirty) allow_dirty=1; shift ;;
    --tag) tag="${2:?--tag needs a value}"; shift 2 ;;
    --seed-reference) seed_reference=1; shift ;;
    -h|--help) sed -n '2,19p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) pp_die "unknown argument: $1" 2 ;;
  esac
done

api_env="$PP_ENV_DIR/api.env"
db_env="$PP_ENV_DIR/db.env"
state_dir="$(pp_cfg PP_STATE_DIR /var/lib/pretasiplus-deploy)"
domain="$(pp_cfg PP_DOMAIN '')"
errors=(); warnings=()
err()  { errors+=("$*"); }
warn() { warnings+=("$*"); }

show() { # printable form of a command (pp_compose expands to the real docker compose command line)
  if [ "$1" = pp_compose ]; then
    shift
    local prof; prof="$(pp_cfg PP_PROFILES '')"
    printf 'docker compose -f compose.yaml -f deploy/vps/compose.prod.yaml --env-file %s%s %s' "$PP_PROD_ENV" "${prof:+ (profiles: $prof)}" "$*"
  else
    printf '%s' "$*"
  fi
}
run() { # run CMD...: print, and execute unless --dry-run
  if [ "$dry" = 1 ]; then pp_log "DRY-RUN would run: $(show "$@")"; else pp_log "run: $(show "$@")"; "$@"; fi
}
step() { pp_log "---- $* ----"; }

is_true() { case "${1,,}" in true|1) return 0 ;; *) return 1 ;; esac; }
urldecode() { local s="${1//+/ }"; printf '%b' "${s//%/\\x}"; }

# ------------------------------------------------------------------------------------------------------------
preflight() {
  local f k v c cfg_err
  for c in docker git curl sha256sum; do command -v "$c" >/dev/null || err "missing command: $c"; done
  if command -v docker >/dev/null; then
    v="$(docker compose version --short 2>/dev/null || true)"; v="${v#v}"
    if [ -z "$v" ]; then err "docker compose plugin not found"
    else
      IFS=. read -r maj min _ <<<"$v"
      if [ "${maj:-0}" -lt 2 ] || { [ "${maj:-0}" -eq 2 ] && [ "${min:-0}" -lt 24 ]; }; then err "docker compose $v is too old (need 2.24+ for !reset / !override)"; fi
    fi
  fi

  for f in "$PP_PROD_ENV" "$api_env" "$db_env"; do
    if [ ! -r "$f" ]; then err "env file missing or unreadable: $f"; continue; fi
    case "$(stat -c %a "$f")" in *[1-7]) err "$f is readable by everyone (mode $(stat -c %a "$f")); chmod 640 and chgrp to the deploy group, or 600" ;; esac
  done
  [ ${#errors[@]} -eq 0 ] || return 0   # nothing below makes sense without the files

  # Placeholders: any uncommented line that still carries an example value. Names only are printed, never values.
  for f in "$PP_PROD_ENV" "$api_env" "$db_env"; do
    while IFS= read -r line; do
      case "$line" in ''|'#'*) continue ;; esac
      k="${line%%=*}"
      if grep -Eqi 'change-?me|replace-?me|USER:PASSWORD|/DBNAME|app\.example\.my|ops@example\.my|NAME-TO-FILL|<[a-z][^>]*>' <<<"${line#*=}"; then
        err "placeholder value for $k in $f"
      fi
    done <"$f"
  done

  # Fail-closed seed guard. The API itself accepts 'true' / '1' (env.schema.ts) and compose.prod.yaml forces both
  # flags to false, so these can never be active in production; a file that asks for them is a mistake, refuse it.
  for f in "$PP_PROD_ENV" "$api_env" "$db_env"; do
    for k in ALLOW_DEMO_SEED BIJAK_POC_QUESTIONS MAIL_LOG_RESET_LINKS; do
      v="$(pp_env_value "$f" "$k")"
      if is_true "$v"; then err "$k=$v in $f: refused (demo seed / PoC questions / reset-link logging never run in production)"; fi
    done
  done
  for k in ALLOW_DEMO_SEED BIJAK_POC_QUESTIONS; do
    if is_true "${!k:-}"; then err "$k=${!k} in the shell environment: refused"; fi
  done
  v="$(pp_env_value "$api_env" COOKIE_SECURE)"; [ "${v,,}" != false ] || warn "COOKIE_SECURE=false in api.env is ignored (compose.prod.yaml forces true)"
  v="$(pp_env_value "$api_env" NODE_ENV)"; [ -z "$v" ] || [ "$v" = production ] || warn "NODE_ENV=$v in api.env is ignored (forced to production)"
  v="$(pp_env_value "$api_env" TRUST_PROXY_HOPS)"; [ -z "$v" ] || [ "$v" = 1 ] || warn "TRUST_PROXY_HOPS=$v in api.env is ignored (forced to 1: the edge is the only proxy)"

  # Required values (mirrors loadEnv in env.schema.ts, with the stricter team policy of 32 characters).
  local ss ic dburl pguser pgdb pgpw
  ss="$(pp_env_value "$api_env" SESSION_SECRET)"
  ic="$(pp_env_value "$api_env" IC_HASH_KEY)"
  [ "${#ss}" -ge 32 ] || err "SESSION_SECRET must be at least 32 characters (openssl rand -hex 32)"
  [ "${#ic}" -ge 32 ] || err "IC_HASH_KEY must be at least 32 characters (openssl rand -hex 32)"
  [ -z "$ss" ] || [ "$ss" != "$ic" ] || err "IC_HASH_KEY must differ from SESSION_SECRET"
  dburl="$(pp_env_value "$api_env" DATABASE_URL)"
  pguser="$(pp_env_value "$db_env" POSTGRES_USER)"; pgdb="$(pp_env_value "$db_env" POSTGRES_DB)"; pgpw="$(pp_env_value "$db_env" POSTGRES_PASSWORD)"
  [ "${#pgpw}" -ge 24 ] || err "POSTGRES_PASSWORD must be at least 24 characters"
  if [[ "$dburl" =~ ^postgres(ql)?://([^:@/]+):([^@]+)@([^:/]+)(:[0-9]+)?/([^?]+)(\?.*)?$ ]]; then
    [ "${BASH_REMATCH[4]}" = db ] || err "DATABASE_URL host must be 'db' (the compose service)"
    [ "${BASH_REMATCH[2]}" = "$pguser" ] || err "DATABASE_URL user differs from POSTGRES_USER in db.env"
    [ "${BASH_REMATCH[6]}" = "$pgdb" ] || err "DATABASE_URL database differs from POSTGRES_DB in db.env"
    [ "$(urldecode "${BASH_REMATCH[3]}")" = "$pgpw" ] || err "DATABASE_URL password differs from POSTGRES_PASSWORD in db.env"
  else
    err "DATABASE_URL must look like postgresql://USER:PASSWORD@db:5432/DBNAME"
  fi
  v="$(pp_env_value "$api_env" MARKETPLACE_PLATFORM_WHATSAPP)"
  if [[ ! "$v" =~ ^[0-9]{9,15}$ ]] || [ "$v" = 60000000000 ]; then err "MARKETPLACE_PLATFORM_WHATSAPP must be the real wa.me number (digits, country code first), not the dev default"; fi
  v="$(pp_env_value "$api_env" PUBLIC_BASE_URL)"
  [ -z "$v" ] || [ "$v" = "https://$domain" ] || warn "PUBLIC_BASE_URL in api.env ($v) is ignored; compose.prod.yaml sets https://$domain"

  # Graceful stop must outlast the API's own drain.
  local grace_ms grace_s
  grace_ms="$(pp_env_value "$api_env" SHUTDOWN_GRACE_MS)"; grace_ms="${grace_ms:-25000}"
  grace_s="$(pp_cfg PP_API_STOP_GRACE 35s)"; grace_s="${grace_s%s}"
  if [[ "$grace_s" =~ ^[0-9]+$ ]] && [[ "$grace_ms" =~ ^[0-9]+$ ]]; then
    [ "$grace_s" -ge $((grace_ms / 1000 + 5)) ] || err "PP_API_STOP_GRACE (${grace_s}s) must be at least SHUTDOWN_GRACE_MS/1000 + 5"
  else
    err "PP_API_STOP_GRACE must look like 35s and SHUTDOWN_GRACE_MS must be an integer"
  fi

  # Domain and certificate.
  if [ -z "$domain" ] || [ "$domain" = app.example.my ]; then err "PP_DOMAIN is not set to the real host name"
  else
    [ -f "$(pp_cfg PP_LE_DIR /srv/pretasiplus/letsencrypt)/live/$domain/fullchain.pem" ] \
      || err "no certificate for $domain under PP_LE_DIR: run deploy/vps/tls/init-cert.sh first"
  fi
  case "$(pp_cfg PP_CSP_MODE report-only)" in report-only|enforce|off) ;; *) err "PP_CSP_MODE must be report-only, enforce or off" ;; esac
  if [ "$(pp_cfg PP_OFFSITE_KIND none)" = none ]; then warn "PP_OFFSITE_KIND=none: backups stay on this server only"
  elif [ -z "$(pp_cfg PP_BACKUP_GPG_RECIPIENT '')" ] && [ "$(pp_cfg PP_OFFSITE_ALLOW_PLAINTEXT false)" != true ]; then
    err "off-site copies are enabled but PP_BACKUP_GPG_RECIPIENT is empty: set the public key (private key stays off the server), or PP_OFFSITE_ALLOW_PLAINTEXT=true as a recorded LEAD decision"
  fi
  [ -n "$(pp_cfg PP_HEALTHCHECK_PING_URL '')" ] || warn "PP_HEALTHCHECK_PING_URL is empty: a silent backup failure would not be noticed"

  # Compose renders with the production overlay.
  if command -v docker >/dev/null && [ ${#errors[@]} -eq 0 ]; then
    cfg_err="$(mktemp)"
    PP_IMAGE_TAG="$tag" pp_compose config -q 2>"$cfg_err" \
      || err "docker compose config failed: $(head -c 300 "$cfg_err")"
    rm -f "$cfg_err"
  fi

  # Source tree.
  if [ "$allow_dirty" = 0 ] && [ -n "$(git -C "$PP_REPO" status --porcelain --untracked-files=no)" ]; then
    err "the checkout has uncommitted changes (deploy a clean release commit, or pass --allow-dirty)"
  fi
  return 0
}

# ------------------------------------------------------------------------------------------------------------
# ------------------------------------------------------------------------------------------------------------
if [ -z "$tag" ]; then tag="$(git -C "$PP_REPO" rev-parse --short=12 HEAD)"; fi
[[ "$tag" =~ ^[A-Za-z0-9_.-]{1,64}$ ]] || pp_die "--tag may only contain letters, digits, _ . -" 2
export PP_IMAGE_TAG="$tag"

step "1/9 preflight (tag $tag, domain ${domain:-?}, env dir $PP_ENV_DIR)"
preflight
for w in "${warnings[@]}"; do pp_warn "$w"; done
if [ ${#errors[@]} -gt 0 ]; then
  for e in "${errors[@]}"; do pp_log "PREFLIGHT FAILED: $e" >&2; done
  pp_die "preflight found ${#errors[@]} problem(s); nothing was changed" 1
fi
pp_log "preflight passed"

prev=""; [ -r "$state_dir/current.tag" ] && prev="$(cat "$state_dir/current.tag")"
pp_log "current release: ${prev:-none (first install)}; new release: $tag"
[ "$prev" != "$tag" ] || pp_warn "the new tag equals the current one; this redeploys the same images"

if [ "$dry" = 0 ] && [ "$yes" = 0 ]; then
  printf 'This changes PRODUCTION (%s): release %s%s.\nType the domain to confirm: ' "$domain" "$tag" "$([ "$seed_reference" = 1 ] && echo " (reference seed only)" || echo " with database migrations")" >&2
  read -r answer
  [ "$answer" = "$domain" ] || pp_die "not confirmed; nothing was changed"
fi

if [ "$seed_reference" = 1 ]; then
  step "reference seed (explicit, reference modules only)"
  run pp_compose run --rm --no-deps -e ALLOW_DEMO_SEED=false -e BIJAK_POC_QUESTIONS=false migrate npm run be:db:seed
  pp_log "reference seed finished: the output must list only reference modules and 'demo modules skipped'"
  exit 0
fi

on_fail() {
  local rc=$?
  pp_log "DEPLOY FAILED at: ${BASH_COMMAND} (exit $rc)" >&2
  pp_log "Nothing is rolled back automatically. If the failure happened before 'migrate', the old release is still running." >&2
  pp_log "If it happened after 'migrate': images -> deploy/vps/rollback.sh ${prev:---previous}; schema -> forward-only, restore the pre-deploy dump only with the LEAD's confirmation (runbook section 8)." >&2
  pp_alert "DEPLOY FAILED for release $tag (exit $rc). Previous release: ${prev:-none}."
  exit "$rc"
}
[ "$dry" = 1 ] || trap on_fail ERR

step "2/9 pre-deploy backup"
if [ "$skip_backup" = 1 ]; then pp_warn "--skip-backup: NO backup before migrating"
elif [ -z "$(pp_compose ps -q db 2>/dev/null || true)" ]; then pp_log "db is not running: first install, nothing to back up"
else run "$PP_VPS_DIR/backup/backup.sh" --tag pre-deploy --no-files; fi

step "3/9 images (PP_BUILD_MODE=$(pp_cfg PP_BUILD_MODE local)) tagged $tag"
if [ "$(pp_cfg PP_BUILD_MODE local)" = pull ]; then
  run pp_compose pull api migrate frontend
else
  run pp_compose build api migrate frontend
fi

step "4/9 database"
run pp_compose up -d --wait --no-deps db

step "5/9 migrate (prisma migrate deploy only)"
run pp_compose run --rm --no-deps migrate

step "6/9 api and frontend"
run pp_compose up -d --wait --no-deps api frontend

step "7/9 edge (recreated so the rendered nginx config and the certificate are current)"
run pp_compose up -d --wait --no-deps --force-recreate edge

step "8/9 health checks through the edge"
if [ "$dry" = 1 ]; then
  pp_log "DRY-RUN would check via 127.0.0.1 with the real host name: GET https://$domain/api/health (200), /api/ready (200 ready), / (200), /api/metrics (404), http://$domain/x (301)"
else
  pp_health_checks || pp_die "health checks failed; see the logs: docker compose logs --since 10m api edge"
fi

step "9/9 record the release"
if [ "$dry" = 1 ]; then
  pp_log "DRY-RUN would write $state_dir/previous.tag='${prev}' current.tag='$tag' and append to history.log"
else
  mkdir -p "$state_dir"
  [ -z "$prev" ] || [ "$prev" = "$tag" ] || printf '%s\n' "$prev" >"$state_dir/previous.tag"
  printf '%s\n' "$tag" >"$state_dir/current.tag"
  printf '%s deploy tag=%s previous=%s sha=%s user=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$tag" "${prev:-none}" \
    "$(git -C "$PP_REPO" rev-parse HEAD)" "$(id -un)" >>"$state_dir/history.log"
fi
pp_log "deploy complete: $tag. Roll back the images with: deploy/vps/rollback.sh ${prev:---previous}"
