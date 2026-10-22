#!/usr/bin/env bash
# Roll the application images back to an earlier release (AZ-09). Runbook: docs/ops/production-vps.md (section 8)
#
#   deploy/vps/rollback.sh [--dry-run] [--yes] [--checkout] [TAG | --previous]
#
# - TAG / --previous: the image tag to run again (default --previous: $PP_STATE_DIR/previous.tag, written by deploy.sh;
#   after a deploy that failed half-way, --previous means the last release deploy.sh recorded as complete).
#   The "already running" check compares with the api image that is really running, not with the recorded tag.
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

# Everything runs inside main() and the file ends with `main "$@"; exit $?`: bash reads a script as it executes,
# and --checkout runs `git checkout`, which can rewrite this very file. The whole function is parsed before it runs.
main() {
dry=0; yes=0; checkout=0; tag=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) dry=1; shift ;;
    --yes) yes=1; shift ;;
    --checkout) checkout=1; shift ;;
    --previous) tag=""; shift ;;
    -h|--help) sed -n '2,18p' "${BASH_SOURCE[0]}"; exit 0 ;;
    -*) pp_die "unknown argument: $1" 2 ;;
    *) tag="$1"; shift ;;
  esac
done

state_dir="$(pp_cfg PP_STATE_DIR /var/lib/pretasiplus-deploy)"
domain="$(pp_cfg PP_DOMAIN '')"
[ "$dry" = 1 ] || pp_lock 0
# rec = the last release that deploy.sh recorded as complete; cur = what is really running. They differ after a
# deploy that failed after it had started the new containers (deploy.sh writes current.tag only at the very end).
rec=""; [ -r "$state_dir/current.tag" ] && rec="$(cat "$state_dir/current.tag")"
cur="$(pp_running_tag)"
if [ -z "$cur" ] && [ -r "$state_dir/deploying.tag" ]; then cur="$(cat "$state_dir/deploying.tag")"; fi   # docker could not tell
[ -n "$cur" ] || cur="$rec"
failed_deploy=0
if [ -n "$rec" ] && [ -n "$cur" ] && [ "$cur" != "$rec" ]; then
  failed_deploy=1
  pp_warn "running release $cur differs from the last recorded release $rec: a deploy did not finish"
fi
if [ -z "$tag" ]; then
  if [ "$failed_deploy" = 1 ]; then
    tag="$rec"   # --previous after a failed deploy means the release that was live before it
  else
    [ -r "$state_dir/previous.tag" ] || pp_die "no previous release recorded in $state_dir; pass a TAG"
    tag="$(cat "$state_dir/previous.tag")"
  fi
fi
[[ "$tag" =~ ^[A-Za-z0-9_.-]{1,64}$ ]] || pp_die "bad tag: $tag" 2
[ "$tag" != "$cur" ] || pp_die "$tag is already the release that is running"
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
  if ! pp_health_checks; then
    pp_alert "ROLLBACK to $tag: health checks FAILED after the rollback. Read: docker compose logs --since 10m api edge"
    pp_die "health checks failed after the rollback; read: docker compose logs --since 10m api edge"
  fi
  mkdir -p "$state_dir"
  # previous.tag keeps pointing at the release before the live one; after a failed deploy the failed release is not
  # worth keeping as "previous" (the last good previous.tag stays).
  if [ "$failed_deploy" = 0 ] && [ -n "$cur" ]; then printf '%s\n' "$cur" >"$state_dir/previous.tag"; fi
  rm -f "$state_dir/deploying.tag"
  printf '%s\n' "$tag" >"$state_dir/current.tag"
  printf '%s rollback tag=%s from=%s user=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$tag" "${cur:-unknown}" "$(id -un)" >>"$state_dir/history.log"
  pp_alert "ROLLBACK done: production now runs $tag (was ${cur:-unknown})."
fi
pp_log "rollback finished. Check the database state: is a migration of the rolled-back release applied? (runbook section 8)"
}
main "$@"
exit $?
