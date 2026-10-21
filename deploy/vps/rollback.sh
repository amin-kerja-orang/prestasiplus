#!/usr/bin/env bash
# Roll the application images back to an earlier release (AZ-09). Runbook: docs/ops/production-vps.md (section 8)
#
#   deploy/vps/rollback.sh [--dry-run] [--yes] [--checkout] [TAG | --previous]
#
# - TAG / --previous: the image tag to run again (default --previous: $PP_STATE_DIR/previous.tag, written by deploy.sh).
#   The images must still be on this server (deploy.sh never prunes) or be pullable (PP_BUILD_MODE=pull).
# - Restarts api and frontend on that tag. It does NOT run `migrate` and does NOT touch the database.
# - MIGRATIONS ARE FORWARD-ONLY. If the bad release applied a migration, the older code runs on the newer schema.
#   That works when the migration was additive (the API's /api/ready only demands that every migration it ships is
#   applied). If it was not safe, the database must be restored from the pre-deploy dump: runbook section 8,
#   which needs the LEAD's confirmation and loses every write made after that dump.
# - --checkout: also `git checkout --detach` the commit that history.log records for TAG, so the compose and nginx
#   files match the old release (the edge config comes from the checkout, not from an image).
set -Eeuo pipefail
umask 077
export PP_SCRIPT=rollback
# shellcheck source-path=SCRIPTDIR
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

dry=0; yes=0; checkout=0; tag=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) dry=1; shift ;;
    --yes) yes=1; shift ;;
    --checkout) checkout=1; shift ;;
    --previous) tag=""; shift ;;
    -h|--help) sed -n '2,16p' "${BASH_SOURCE[0]}"; exit 0 ;;
    -*) pp_die "unknown argument: $1" 2 ;;
    *) tag="$1"; shift ;;
  esac
done

state_dir="$(pp_cfg PP_STATE_DIR /var/lib/pretasiplus-deploy)"
domain="$(pp_cfg PP_DOMAIN '')"
cur=""; [ -r "$state_dir/current.tag" ] && cur="$(cat "$state_dir/current.tag")"
if [ -z "$tag" ]; then
  [ -r "$state_dir/previous.tag" ] || pp_die "no previous release recorded in $state_dir; pass a TAG"
  tag="$(cat "$state_dir/previous.tag")"
fi
[[ "$tag" =~ ^[A-Za-z0-9_.-]{1,64}$ ]] || pp_die "bad tag: $tag" 2
[ "$tag" != "$cur" ] || pp_die "$tag is already the current release"
[ -n "$domain" ] || pp_die "PP_DOMAIN is not set in $PP_PROD_ENV"
export PP_IMAGE_TAG="$tag"

run() {
  if [ "$dry" = 1 ]; then pp_log "DRY-RUN would run: $*"; else pp_log "run: $*"; "$@"; fi
}

prefix="$(pp_cfg PP_IMAGE_PREFIX '')"
if [ "$(pp_cfg PP_BUILD_MODE local)" != pull ]; then
  for img in pretasiplus-api pretasiplus-frontend; do
    docker image inspect "${prefix}${img}:${tag}" >/dev/null 2>&1 \
      || pp_die "image ${prefix}${img}:${tag} is not on this server (it was pruned?). Rebuild it: git checkout the release commit and run deploy.sh --tag $tag"
  done
fi
pp_log "rolling back: current=${cur:-unknown} -> $tag"
pp_compose config -q

if [ "$dry" = 0 ] && [ "$yes" = 0 ]; then
  printf 'This rolls PRODUCTION (%s) back to release %s. The database is NOT restored.\nType the domain to confirm: ' "$domain" "$tag" >&2
  read -r answer
  [ "$answer" = "$domain" ] || pp_die "not confirmed; nothing was changed"
fi

if [ "$checkout" = 1 ]; then
  sha="$(sed -n "s/.* deploy tag=$tag .* sha=\\([0-9a-f]\\{40\\}\\) .*/\\1/p" "$state_dir/history.log" 2>/dev/null | tail -n1)"
  [ -n "$sha" ] || pp_die "no commit recorded for $tag in $state_dir/history.log"
  run git -C "$PP_REPO" checkout --detach "$sha"
fi

if [ "$(pp_cfg PP_BUILD_MODE local)" = pull ]; then run pp_compose pull api frontend; fi
run pp_compose up -d --wait --no-deps api frontend
run pp_compose up -d --wait --no-deps --force-recreate edge
if [ "$dry" = 1 ]; then
  pp_log "DRY-RUN would run the edge health checks (/api/health, /api/ready, /, /api/metrics 404, http redirect)"
else
  pp_health_checks || pp_die "health checks failed after the rollback; read: docker compose logs --since 10m api edge"
  mkdir -p "$state_dir"
  [ -z "$cur" ] || printf '%s\n' "$cur" >"$state_dir/previous.tag"
  printf '%s\n' "$tag" >"$state_dir/current.tag"
  printf '%s rollback tag=%s from=%s user=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$tag" "${cur:-unknown}" "$(id -un)" >>"$state_dir/history.log"
  pp_alert "ROLLBACK done: production now runs $tag (was ${cur:-unknown})."
fi
pp_log "rollback finished. Check the database state: is a migration of the rolled-back release applied? (runbook section 8)"
