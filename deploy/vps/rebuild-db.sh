#!/usr/bin/env bash
# GUARDED rebuild of the UAT database from empty, filled from a staged V2 (.cloud) dump (R1, decision KP-2, T-A4).
# Runbook: docs/ops/r1-uat-deploy.md (the cutover runsheet) and docs/ops/runbook.md.
#
#   deploy/vps/rebuild-db.sh --rebuild-db --dump-dir DIR [--files-dir DIR] [options]     rebuild (DESTROYS the database)
#   deploy/vps/rebuild-db.sh --rebuild-db --dump-dir DIR --dry-run                      guards + plan only, changes nothing
#   deploy/vps/rebuild-db.sh --rebuild-db --restore-backup FILE                         ROLLBACK: restore the pre-rebuild dump
#
# Options: --files-dir DIR   V2 storage export with SHA256SUMS (copied into the api files volume by migrate:all --apply, the
#                            MigrationFiles path); --as-of YYYY-MM-DD (default: today in Kuala Lumpur, kept for both ETL passes);
#          --tag TAG         image tag (default: git short sha, 12 characters); --allow-dirty (preflight);
#          --skip LIST       comma list of hook steps to skip: structured,papers,link-questions,repairs,sql-checks;
#          --approve LIST    comma list of repairs that need the PO's approval and may now write: flag-stimulus,trim-duplicate-stem;
#          --pause-after-plan  wait for ENTER after the rajah plan is written (PO review of the plan before it is applied);
#          --verify-soft     HOOK: a failing full migrate:verify (run after questions/structured/papers) is recorded as a failed check
#                            (exit 4) instead of stopping the run. Only while verify has no expectations for the new loaders;
#          --keep-staging    do not drop staging_cloud (raw .cloud copy, personal data) at the end;
#          --terbit          after the papers apply, run `migrate:terbit --apply` (node dist/migrate-terbit.js from the migrate image, API stopped:
#                            publishes the V2-published papers through the real gate with the audited legacy override);
#          --files-archive keep|archive|wipe   what happens to the old api files volume before the ETL copies V2 files
#                            (default archive: tar.gz + sha256 into the backup dir, then the volume is emptied).
#
# GUARDS (all must hold, nothing is changed before the last one; every check is repeated by the code that drops the database):
#   G1 --rebuild-db on the command line.
#   G2 PP_ALLOW_DB_REBUILD=yes in the prod.env FILE (not the process environment). Production never carries it.
#   G3 PP_DOMAIN (read from the prod.env FILE only, an inherited PP_DOMAIN is ignored and unset; lower-cased and trimmed) is not on the deny
#      list (prestasiplus.cloud, www., admin., prestasiplus.my, the example host, PP_REBUILD_DENY_DOMAINS in the file), is a plain host name
#      (no port), is not below prestasiplus.cloud / prestasiplus.my (only uat.prestasiplus.cloud, and only when PP_REBUILD_ALLOWED_DOMAIN is exactly that),
#      equals PP_REBUILD_ALLOWED_DOMAIN, and the database name equals PP_REBUILD_ALLOWED_DB (both allowlist keys: prod.env FILE only, unset = refused); the database
#      name is not postgres, a template, a V2/production name (prestasiplus_prod, prestasiplus_production, prestasiplus_cloud,
#      prestasiplus_live, prestasi_plus, pios_my) or listed in PP_REBUILD_DENY_DBS (file).
#   G4 typed confirmation of the exact database name AND the exact domain, in a terminal (a pipe is accepted only on a host
#      that has PP_SCRATCH_HOST=yes in the prod.env file: a rehearsal machine, never UAT).
#   G5 full deploy preflight (deploy.sh --dry-run: env files, placeholders, fail-closed seed guard, certificate, compose).
#   G6 the dump directory is a raw pp-staging-dump/1 with a manifest; an "anonymised" or "synthetic" manifest is refused (an anonymised
#      dump gives every account the known password Demo1234); the files directory (if given) has SHA256SUMS.
#   G7 a FRESH pre-rebuild backup exists, is not older than PP_REBUILD_BACKUP_MAX_AGE_S (600), its sha256 matches,
#      `pg_restore --list` reads it and shows table data. Otherwise the run stops BEFORE api is stopped.
# The ETL and the API never run at the same time: api is stopped before the database is dropped and started again only
# after the last ETL / repair step. One lock (PP_LOCK_FILE) is held for the whole run.
#
# Steps (each one is timed; STEP-TIME lines and a summary go to the log in the state dir; the first failure stops the run):
#   1 images   2 backup + verification   3 stop api   4 (files) archive and empty the old volume   5 drop + create database
#   6 roles (before migrate)   7 migrate (0001..HEAD)   8 roles again + check   9 reference seed (includes the curriculum)
#   10 stage the V2 dump (throwaway cluster -> staging_cloud / archive_cloud in the target)
#   11 ETL pass 1: migrate:all --apply (+files), questions plan / dry-run / apply, structured, papers, link-questions
#   12 migrate:verify   13 ETL pass 2: the same, and it must change 0 rows   14 post-ETL repairs and checks
#   15 drop staging_cloud   16 start api, frontend, edge + health checks   17 record the release
#
# ROLLBACK: --restore-backup FILE (the file written by step 2, path in the log and in $PP_STATE_DIR/rebuild-backup.path):
# verifies it again, stops api, drops and recreates the database, pg_restore, roles apply + check, restores the files
# archive when step 4 of THE SAME RUN made one (run id sidecars; a stale archive from another run is refused before anything is dropped), starts the PREVIOUS release (rebuild-prev.tag), health checks. Writes made after the backup
# are lost. Needs the same guards G1 to G4.
#
# NOTE: the deploy user is in the docker group (root-equivalent). Run from the checkout of the release commit, as that user.
set -Eeuo pipefail
umask 077
export PP_SCRIPT=rebuild-db
# G3: the domain comes from the prod.env file only; an inherited PP_DOMAIN must not reach this script, deploy.sh or docker compose.
unset PP_DOMAIN
# shellcheck source-path=SCRIPTDIR
# shellcheck source=lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

rebuild=0; dump_dir=""; files_dir=""; asof=""; tag=""; allow_dirty=0; dry=0; restore_file=""
skip=""; approve=""; verify_soft=0; pause_plan=0; keep_staging=0; terbit=0; files_policy=archive
while [ $# -gt 0 ]; do
  case "$1" in
    --rebuild-db) rebuild=1; shift ;;
    --dump-dir) dump_dir="${2:?--dump-dir needs a directory}"; shift 2 ;;
    --files-dir) files_dir="${2:?--files-dir needs a directory}"; shift 2 ;;
    --as-of) asof="${2:?--as-of needs YYYY-MM-DD}"; shift 2 ;;
    --tag) tag="${2:?--tag needs a value}"; shift 2 ;;
    --allow-dirty) allow_dirty=1; shift ;;
    --dry-run) dry=1; shift ;;
    --restore-backup) restore_file="${2:?--restore-backup needs the dump file}"; shift 2 ;;
    --skip) skip=",${2:?--skip needs a comma list},"; shift 2 ;;
    --approve) approve=",${2:?--approve needs a comma list},"; shift 2 ;;
    --pause-after-plan) pause_plan=1; shift ;;
    --verify-soft) verify_soft=1; shift ;;
    --keep-staging) keep_staging=1; shift ;;
    --terbit) terbit=1; shift ;;
    --files-archive) files_policy="${2:?--files-archive needs keep|archive|wipe}"; shift 2 ;;
    -h|--help) sed -n '2,54p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) pp_die "unknown argument: $1" 2 ;;
  esac
done
case "$files_policy" in keep|archive|wipe) ;; *) pp_die "--files-archive takes keep, archive or wipe" 2 ;; esac

api_env="$PP_ENV_DIR/api.env"; db_env="$PP_ENV_DIR/db.env"
state_dir="$(pp_cfg PP_STATE_DIR /var/lib/pretasiplus-deploy)"
backup_dir="$(pp_cfg PP_BACKUP_DIR /var/backups/pretasiplus)"
out_dir="$(pp_cfg PP_MIGRATION_OUT /srv/pretasiplus/migration-out)"
stage_image="$(pp_cfg PP_STAGE_IMAGE postgres:16-alpine)"
domain="$(pp_norm_domain "$(pp_env_value "$PP_PROD_ENV" PP_DOMAIN)")"
db="$(pp_env_value "$db_env" POSTGRES_DB)"
max_backup_age="$(pp_cfg PP_REBUILD_BACKUP_MAX_AGE_S 600)"

# ---------------------------------------------------------------------------------------------------------------
# logging and timing
# ---------------------------------------------------------------------------------------------------------------
mkdir -p "$state_dir"
run_id="$(date -u +%Y%m%dT%H%M%SZ)"
logfile="$state_dir/rebuild-$run_id.log"
if [ "$dry" = 0 ]; then
  exec > >(tee -a "$logfile") 2>&1
  pp_log "log: $logfile"
fi
STEP_NAMES=(); STEP_SECS=(); CURRENT_STEP="start"; DB_DROPPED=0; API_STOPPED=0; BACKUP_OK=0; BACKUP_FILE=""; RUN_T0=$SECONDS
run_step() { # run_step NUMBER NAME FUNCTION [ARGS]: timed; a failing function stops the whole run (ERR trap)
  local n="$1" name="$2" t0=$SECONDS d; shift 2
  CURRENT_STEP="$n $name"
  pp_log "==== STEP $n: $name ===="
  "$@"
  d=$((SECONDS - t0)); STEP_NAMES+=("$n $name"); STEP_SECS+=("$d")
  pp_log "STEP-TIME $n $name: ${d}s"
}
sub_time() { # sub_time LABEL COMMAND...: a timed sub-step inside a step (ETL commands)
  local label="$1" t0=$SECONDS rc=0; shift
  "$@" || rc=$?
  pp_log "SUB-TIME $label: $((SECONDS - t0))s exit=$rc"
  return "$rc"
}
summary() {
  local i
  pp_log "---- SUMMARY (total $((SECONDS - RUN_T0))s) ----"
  for i in "${!STEP_NAMES[@]}"; do printf '%s [%s]   %-52s %6ss\n' "$(date -u +%H:%M:%S)" "$PP_SCRIPT" "${STEP_NAMES[$i]}" "${STEP_SECS[$i]}"; done
}
is_skipped() { [[ "$skip" == *",$1,"* ]]; }
approved() { [[ "$approve" == *",$1,"* ]]; }

# ---------------------------------------------------------------------------------------------------------------
# failure handler: say exactly what state things are in and how to go back
# ---------------------------------------------------------------------------------------------------------------
ARMED=0; REPORTED=0
on_err() { report_failure "$?" "$BASH_COMMAND"; }
on_exit() { # pp_die (an exit without the ERR trap) after the first change must still tell the operator where things stand
  local rc=$?
  if [ "$rc" != 0 ] && [ "$ARMED" = 1 ] && [ "$REPORTED" = 0 ]; then report_failure "$rc" "(stopped by a check)"; fi
}
report_failure() {
  local rc="$1" cmd="$2"
  trap - ERR EXIT
  REPORTED=1
  pp_log "REBUILD FAILED in step '$CURRENT_STEP' (exit $rc; command: $cmd)" >&2
  if [ "$DB_DROPPED" = 0 ]; then
    pp_log "The database was NOT dropped: its data is unchanged." >&2
    [ "$API_STOPPED" = 0 ] || pp_log "api is stopped: start it again with: docker compose -f compose.yaml -f deploy/vps/compose.prod.yaml --env-file $PP_PROD_ENV up -d --wait --no-deps api" >&2
  else
    pp_log "The database HAS BEEN dropped and is partly rebuilt; api stays STOPPED. Fix the cause and run the rebuild again (it starts from empty), or go back:" >&2
    pp_log "  deploy/vps/rebuild-db.sh --rebuild-db --restore-backup ${BACKUP_FILE:-<the pre-rebuild dump, see $state_dir/rebuild-backup.path>}" >&2
  fi
  pp_alert "UAT DB REBUILD FAILED in step $CURRENT_STEP (exit $rc)."
  summary >&2 || true
  exit "$rc"
}

# ---------------------------------------------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------------------------------------------
is_scratch_host() { [ "$(pp_env_value "$PP_PROD_ENV" PP_SCRATCH_HOST)" = yes ]; }   # file only, like slot.sh

# su_psql DB [psql args]: psql as the bootstrap superuser inside the db container (script on stdin unless -c / -f).
su_psql() {
  local d="$1"; shift
  # shellcheck disable=SC2016  # expands inside the container
  pp_db_exec sh -c 'd="$1"; shift; PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$d" "$@"' sh "$d" "$@"
}
su_scalar() { su_psql "$1" -At -c "$2" </dev/null; }

deny_list() { # deny_list KEY: DENY_ITEMS = the comma list KEY from the prod.env FILE, lower-cased (the shell environment never counts); never globbed
  local v; v="$(pp_env_value "$PP_PROD_ENV" "$1")"; v="${v,,}"; v="${v//,/ }"
  DENY_ITEMS=(); read -r -a DENY_ITEMS <<<"$v" || true
}

assert_target_db() { # the one place that decides which database may be dropped
  [[ "$db" =~ ^[a-z][a-z0-9_]{0,40}$ ]] || pp_die "POSTGRES_DB in $db_env is not a plain lowercase name" 2
  case "$db" in postgres|template0|template1|prestasiplus_prod|prestasiplus_production|prestasiplus_cloud|prestasiplus_live|prestasi_plus|pios_my)
    pp_die "refusing to touch the database '$db' (system or production name, G3)" 2 ;; esac
  local x
  deny_list PP_REBUILD_DENY_DBS
  for x in ${DENY_ITEMS[@]+"${DENY_ITEMS[@]}"}; do [ "$db" != "$x" ] || pp_die "refusing to touch the database '$db' (PP_REBUILD_DENY_DBS, G3)" 2; done
  [ "$(pp_env_value "$PP_PROD_ENV" PP_ALLOW_DB_REBUILD)" = yes ] || pp_die "refused: PP_ALLOW_DB_REBUILD=yes is not in $PP_PROD_ENV (G2)" 3
  # A persisted verify waiver in prod.env is refused by slot.sh at step 12, after the drop: refuse it here, before anything changes (X-3, O-3).
  for x in PP_VERIFY_ACCEPT_REJECTS PP_VERIFY_ACCEPT_REJECTS_FILE; do
    [ -z "$(pp_env_value "$PP_PROD_ENV" "$x")" ] || pp_die "refused: $x is set in $PP_PROD_ENV; the verify allowlist is a one-run waiver for the shell, never a persisted setting. Remove it from the file (G3)" 2
  done
  # Deny list (the exact production names, then every host below the production domains, then anything with a port or other odd character).
  case "$domain" in prestasiplus.cloud|www.prestasiplus.cloud|admin.prestasiplus.cloud|prestasiplus.my|www.prestasiplus.my|app.example.my|'')
    pp_die "refused: PP_DOMAIN '$domain' is on the deny list or unset (G3)" 3 ;; esac
  [[ "$domain" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] || pp_die "refused: PP_DOMAIN '$domain' is not a plain host name (a ':' port or any other character is refused) (G3)" 3
  deny_list PP_REBUILD_DENY_DOMAINS
  for x in ${DENY_ITEMS[@]+"${DENY_ITEMS[@]}"}; do [ "$domain" != "$(pp_norm_domain "$x")" ] || pp_die "refused: PP_DOMAIN '$domain' is in PP_REBUILD_DENY_DOMAINS (G3)" 3; done
  # Positive allowlist, from the prod.env FILE only; unset = refused (fails closed). Both must equal the target. UAT (uat.prestasiplus.cloud) sits
  # below a production domain, so the wildcard deny below lets it through ONLY when PP_REBUILD_ALLOWED_DOMAIN is exactly that name and equals PP_DOMAIN.
  local a_db a_dom
  a_db="$(pp_env_value "$PP_PROD_ENV" PP_REBUILD_ALLOWED_DB)"
  a_dom="$(pp_norm_domain "$(pp_env_value "$PP_PROD_ENV" PP_REBUILD_ALLOWED_DOMAIN)")"
  [ -n "$a_db" ] && [ -n "$a_dom" ] || pp_die "refused: PP_REBUILD_ALLOWED_DB and PP_REBUILD_ALLOWED_DOMAIN are not both set in $PP_PROD_ENV (the allowlist fails closed, G3)" 3
  case "$domain" in
    *.prestasiplus.cloud|*.prestasiplus.my)
      [ "$domain" = uat.prestasiplus.cloud ] && [ "$a_dom" = uat.prestasiplus.cloud ] \
        || pp_die "refused: PP_DOMAIN '$domain' is below a production domain; only uat.prestasiplus.cloud may be rebuilt, and only with PP_REBUILD_ALLOWED_DOMAIN=uat.prestasiplus.cloud (G3)" 3 ;;
  esac
  [ "$db" = "$a_db" ] || pp_die "refused: database '$db' is not PP_REBUILD_ALLOWED_DB ('$a_db') in $PP_PROD_ENV (G3)" 3
  [ "$domain" = "$a_dom" ] || pp_die "refused: PP_DOMAIN '$domain' is not PP_REBUILD_ALLOWED_DOMAIN ('$a_dom') in $PP_PROD_ENV (G3)" 3
}

confirm_typed() { # G4: the exact database name, then the exact domain
  local a1="" a2="" action="$1"
  if [ ! -t 0 ] && ! is_scratch_host; then pp_die "refused: the typed confirmation needs a terminal (a pipe is accepted only on a PP_SCRATCH_HOST=yes rehearsal host) (G4)" 3; fi
  printf '%s database "%s" on %s. All data in it is lost.\nType the DATABASE NAME to confirm: ' "$action" "$db" "$domain" >&2
  read -r a1 || pp_die "no confirmation typed; nothing was changed" 3
  [ "$a1" = "$db" ] || pp_die "database name not confirmed; nothing was changed" 3
  printf 'Type the DOMAIN to confirm: ' >&2
  read -r a2 || pp_die "no confirmation typed; nothing was changed" 3
  [ "$a2" = "$domain" ] || pp_die "domain not confirmed; nothing was changed" 3
  exec </dev/null   # nothing below may read the rest of a pipe
}

apifiles_volume() { # the api uploads volume of this compose project, exactly one
  local cid proj vols
  cid="$(pp_compose ps -q db 2>/dev/null | head -n1 || true)"
  [ -n "$cid" ] || { pp_compose ps -aq api >/dev/null 2>&1; cid="$(pp_compose ps -aq api | head -n1 || true)"; }
  proj="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$cid" 2>/dev/null || true)"
  vols="$(docker volume ls -q --filter label=com.docker.compose.volume=apifiles ${proj:+--filter label=com.docker.compose.project=$proj})"
  [ -n "$vols" ] && [ "$(wc -l <<<"$vols")" = 1 ] || pp_die "cannot find the api uploads volume (compose volume apifiles) exactly once"
  printf '%s' "$vols"
}

today_myt() { TZ=Asia/Kuala_Lumpur date +%F; }

# stage counts the release expects after `slot.sh copy` (tables of each schema in the generated DDL; PP_STAGE_EXPECT overrides)
expected_stage_counts() {
  local f="$PP_REPO/apps/api/src/migration/ddl/staging_cloud.sql" a s
  if [ -n "$(pp_cfg PP_STAGE_EXPECT '')" ]; then pp_cfg PP_STAGE_EXPECT ''; return 0; fi
  [ -r "$f" ] || pp_die "cannot read $f to derive the expected stage table counts (set PP_STAGE_EXPECT='archive_cloud:N staging_cloud:M')" 3
  a="$(grep -c '^create table "archive_cloud"\.' "$f" || true)"; s="$(grep -c '^create table "staging_cloud"\.' "$f" || true)"
  [ "${a:-0}" -gt 0 ] && [ "${s:-0}" -gt 0 ] || pp_die "no tables found in $f" 3
  printf 'archive_cloud:%s staging_cloud:%s' "$a" "$s"
}

# verify_dump FILE: G7 on any dump file (sha256 sidecar, table of contents, table data)
verify_dump() {
  local f="$1" base dir toc n
  [ -s "$f" ] || pp_die "dump $f is missing or empty" 3
  base="$(basename "$f")"; dir="$(dirname "$f")"
  [ -s "$f.sha256" ] || pp_die "no sha256 file next to $base" 3
  (cd "$dir" && sha256sum -c "$base.sha256" >/dev/null) || pp_die "sha256 of $base does not match its .sha256 file" 3
  toc="$(mktemp)"
  if ! pp_db_exec pg_restore --list <"$f" >"$toc"; then rm -f "$toc"; pp_die "pg_restore --list cannot read $base" 3; fi
  n="$(grep -c ' TABLE DATA ' "$toc" || true)"; rm -f "$toc"
  [ "${n:-0}" -gt 0 ] || pp_die "pg_restore --list shows no table data in $base" 3
  pp_log "dump verified: $base ($(stat -c %s "$f") bytes, sha256 ok, pg_restore --list ok, $n tables with data)"
}

check_dump_dir() { # G6
  local m="$dump_dir/manifest.json"
  [ -d "$dump_dir" ] || pp_die "--dump-dir $dump_dir is not a directory" 2
  pp_assert_outside_repo "$dump_dir"
  [ -f "$m" ] || pp_die "$dump_dir has no manifest.json (expected a pp-staging-dump/1 directory from dump:cloud)" 2
  grep -Eq '"format"[[:space:]]*:[[:space:]]*"pp-staging-dump/1"' "$m" || pp_die "manifest.json is not format pp-staging-dump/1" 2
  grep -Eq '"raw"[[:space:]]*:[[:space:]]*true' "$m" || pp_die "the dump is not marked raw (\"raw\": true): the rebuild loads the dump:cloud --raw output" 2
  # G6: any anonymised / synthetic flag that is not a plain false refuses the dump (anonymised accounts all get the known password Demo1234).
  if grep -Eo '"(anonymised|synthetic)"[[:space:]]*:[[:space:]]*[^,}[:space:]]*' "$m" | grep -Evq ':[[:space:]]*false$'; then
    pp_die "the dump is marked anonymised or synthetic: never loaded here (an anonymised dump gives every account the known password Demo1234)" 2
  fi
  if grep -Eq '"large_integers"[[:space:]]*:' "$m"; then pp_die "the manifest lists large_integers: stop and ask the migration owner" 2; fi
  if find "$dump_dir" -maxdepth 1 -name '*.partial' | grep -q .; then pp_die "$dump_dir still holds .partial files: the export did not finish" 2; fi
  pp_log "dump directory ok: manifest pp-staging-dump/1, raw, no .partial files"
  if [ -n "$files_dir" ]; then
    [ -d "$files_dir" ] || pp_die "--files-dir $files_dir is not a directory" 2
    pp_assert_outside_repo "$files_dir"
    [ -f "$files_dir/SHA256SUMS" ] || pp_die "--files-dir $files_dir has no SHA256SUMS manifest (paths relative to the folder)" 2
    pp_log "files directory ok: SHA256SUMS present ($(wc -l <"$files_dir/SHA256SUMS") lines)"
  fi
}

# ---------------------------------------------------------------------------------------------------------------
# checks that change nothing
# ---------------------------------------------------------------------------------------------------------------
preflight() {
  local c v free_kb
  for c in docker curl sha256sum flock; do command -v "$c" >/dev/null || pp_die "missing command: $c" 3; done
  assert_target_db
  [ "$(pp_cfg PP_JOBS_WORKER_ENABLED true)" = true ] || pp_die "PP_JOBS_WORKER_ENABLED must be true" 3
  v="$(pp_cfg PP_RELEASE_SHA "$(git -C "$PP_REPO" rev-parse HEAD 2>/dev/null || true)")"
  [[ "$v" =~ ^[0-9a-f]{40}$ ]] || pp_die "PP_RELEASE_SHA (40 hex characters) is not set in $PP_PROD_ENV and git gives none: migrate:all would refuse to run" 3
  [ -n "$tag" ] || tag="$(git -C "$PP_REPO" rev-parse --short=12 HEAD 2>/dev/null || true)"
  [[ "$tag" =~ ^[A-Za-z0-9_.-]{1,64}$ ]] || pp_die "cannot determine the image tag; pass --tag" 2
  export PP_IMAGE_TAG="$tag"
  [[ -n "$asof" ]] || asof="$(today_myt)"
  [[ "$asof" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || pp_die "--as-of must be YYYY-MM-DD" 2
  check_dump_dir
  pp_assert_outside_repo "$backup_dir"
  free_kb="$(df -Pk "$backup_dir" | awk 'NR==2{print $4}')"
  [ "${free_kb:-0}" -ge $(( $(pp_cfg PP_REBUILD_MIN_FREE_GB 5) * 1048576 )) ] || pp_die "less than $(pp_cfg PP_REBUILD_MIN_FREE_GB 5) GB free in $backup_dir" 3
  # G5: the real deploy preflight, read-only. A rehearsal host (PP_SCRATCH_HOST=yes in the file) may skip it with PP_REBUILD_SKIP_PREFLIGHT=1 in the shell.
  if [ "${PP_REBUILD_SKIP_PREFLIGHT:-0}" = 1 ] && is_scratch_host; then
    pp_warn "G5 deploy preflight SKIPPED (PP_REBUILD_SKIP_PREFLIGHT=1 on a PP_SCRATCH_HOST=yes rehearsal host)"
  else
    local pf=(--dry-run --tag "$tag"); [ "$allow_dirty" = 0 ] || pf+=(--allow-dirty)
    "$PP_VPS_DIR/deploy.sh" "${pf[@]}" >/dev/null \
      || pp_die "G5: deploy.sh --dry-run (the preflight) failed; run it by hand to see why. Nothing was changed." 3
    pp_log "G5 deploy preflight passed"
  fi
  [ -n "$(pp_compose ps -q db 2>/dev/null || true)" ] || pp_die "the db service is not running: this is a REBUILD of an existing stack (first installs use deploy.sh)" 3
  pp_log "preflight ok: database '$db' on $domain, tag $tag, as-of $asof, release sha $v"
}

print_plan() {
  cat <<EOF
PLAN (nothing is changed by --dry-run):
  database to drop and recreate : $db
  domain                        : $domain
  image tag                     : $tag     (running now: $(pp_running_tag || true))
  staged V2 dump                : $dump_dir
  V2 files                      : ${files_dir:-none (--files-dir not given: banners and images are NOT copied)}
  old files volume              : $files_policy
  ETL as-of date                : $asof     expected stage tables: $(expected_stage_counts)
  skipped hook steps            : ${skip:-none}      approved repairs: ${approve:-none}
  backups / state / reports     : $backup_dir  $state_dir  $out_dir
EOF
}

# ---------------------------------------------------------------------------------------------------------------
# steps
# ---------------------------------------------------------------------------------------------------------------
step_images() {
  local missing=0 img
  # the images this tag needs, from the rendered config
  while IFS= read -r img; do
    case "$img" in *pretasiplus-api:*|*pretasiplus-api-migrate:*|*pretasiplus-frontend:*) docker image inspect "$img" >/dev/null 2>&1 || missing=1 ;; esac
  done < <(pp_compose config --images)
  if [ "$missing" = 0 ]; then pp_log "images for tag $tag are already on this host: not rebuilt (build them BEFORE the downtime: runsheet U4)"; return 0; fi
  # Overwriting the images of the release that is running would destroy the rollback target.
  [ "$(pp_running_tag)" != "$tag" ] || pp_die "tag $tag is the release that is running; building would overwrite its images (use a new --tag)" 3
  if [ "$(pp_cfg PP_BUILD_MODE local)" = pull ]; then pp_compose pull api migrate frontend; else pp_compose build api migrate frontend; fi
}

step_backup() {
  local out file sha sha_file age now mtime
  out="$(mktemp)"
  "$PP_VPS_DIR/backup/backup.sh" --tag pre-rebuild --no-files | tee "$out"
  file="$(sed -n 's/^BACKUP_FILE=//p' "$out" | tail -n1)"; sha="$(sed -n 's/^BACKUP_SHA256=//p' "$out" | tail -n1)"; rm -f "$out"
  [ -n "$file" ] || pp_die "backup.sh did not report BACKUP_FILE; the rebuild stops here" 3
  verify_dump "$file"
  sha_file="$(sha256sum "$file" | cut -d' ' -f1)"
  [ "$sha_file" = "$sha" ] || pp_die "sha256 of the dump differs from the one backup.sh reported" 3
  now="$(date +%s)"; mtime="$(stat -c %Y "$file")"; age=$((now - mtime))
  [ "$age" -le "$max_backup_age" ] || pp_die "the pre-rebuild dump is $age s old (limit $max_backup_age s)" 3
  BACKUP_FILE="$file"; BACKUP_OK=1
  printf '%s\n' "$run_id" >"$state_dir/rebuild-backup.run"
  printf '%s\n' "$file" >"$state_dir/rebuild-backup.path"
  pp_log "G7 fresh backup verified: $file (sha256 $sha, ${age}s old). ROLLBACK DUMP = this file."
  pp_log "database before the rebuild: $(su_scalar "$db" "select (select count(*) from information_schema.tables where table_schema='public') || ' tables, ' || coalesce((select count(*) from _prisma_migrations where finished_at is not null)::text, '?') || ' migrations, users ' || coalesce((select count(*)::text from users), '-')" 2>/dev/null || echo 'n/a')"
  # remember the release that is running now: the rollback starts it again
  local running; running="$(pp_running_tag)"; [ -n "$running" ] || running="$(cat "$state_dir/current.tag" 2>/dev/null || true)"
  printf '%s\n' "$running" >"$state_dir/rebuild-prev.tag"
  pp_log "release running now (the rollback target): ${running:-unknown}"
}

step_stop_api() {
  [ "$BACKUP_OK" = 1 ] || pp_die "refusing to stop the api: no verified backup (G7)" 3
  API_STOPPED=1
  pp_compose stop api   # the api is the jobs worker too (JOBS_WORKER_ENABLED): one container, one stop
  [ -z "$(pp_compose ps -q --status running api 2>/dev/null || true)" ] || pp_die "the api container is still running" 3
  pp_log "api (and its jobs worker) stopped; db stays up. Open sessions: $(su_scalar postgres "select count(*) from pg_stat_activity where datname='$db' and pid <> pg_backend_pid()")"
}

step_files_prepare() {
  local vol ts f
  if [ -z "$files_dir" ]; then pp_warn "no --files-dir: the old files volume is left as it is"; return 0; fi
  vol="$(apifiles_volume)"
  case "$files_policy" in
    keep) pp_warn "--files-archive keep: the old files stay in the volume next to the V2 files"; return 0 ;;
    archive)
      ts="$(date -u +%Y%m%dT%H%M%SZ)"; f="$backup_dir/pp-files-$ts-pre-rebuild.tar.gz"
      docker run --rm -v "$vol:/f:ro" --entrypoint tar "$stage_image" -C /f -czf - . >"$f.partial"
      mv "$f.partial" "$f"
      printf '%s  %s\n' "$(sha256sum "$f" | cut -d' ' -f1)" "$(basename "$f")" >"$f.sha256"
      # the run id sidecar first, the .path file last: a restore accepts the archive only for the same run as the backup (C-2)
      printf '%s\n' "$run_id" >"$state_dir/rebuild-files-archive.run"
      printf '%s\n' "$f" >"$state_dir/rebuild-files-archive.path"
      pp_log "old uploads archived: $f ($(stat -c %s "$f") bytes)" ;;
    wipe) pp_warn "--files-archive wipe: the old files are NOT archived" ;;
  esac
  docker run --rm -v "$vol:/f" --entrypoint sh "$stage_image" -c 'find /f -mindepth 1 -delete'
  pp_log "files volume emptied: $(docker run --rm -v "$vol:/f:ro" --entrypoint sh "$stage_image" -c 'find /f -type f | wc -l') files left"
}

step_drop_create() {
  # last gate: repeat G2/G3, and the backup must still be the verified one
  assert_target_db
  [ "$BACKUP_OK" = 1 ] && [ -s "$BACKUP_FILE" ] || pp_die "refusing to drop: no verified backup (G7)" 3
  [ -n "$(pp_compose ps -q db)" ] || pp_die "db is not running" 3
  DB_DROPPED=1   # from here a failure means the data is gone (rollback = the dump)
  su_psql postgres -c "drop database if exists \"$db\" with (force)" -c "create database \"$db\"" </dev/null
  pp_log "database $db dropped and created empty"
}

step_roles_before() { "$PP_VPS_DIR/db-roles.sh" apply; }

step_migrate() {
  local want applied
  pp_compose run --rm --no-deps -T migrate
  applied="$(su_scalar "$db" "select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null")"
  pp_log "migrations applied: $applied; unfinished: $(su_scalar "$db" "select count(*) from _prisma_migrations where finished_at is null and rolled_back_at is null")"
  if [ -d "$PP_REPO/apps/api/prisma/migrations" ]; then
    want="$(find "$PP_REPO/apps/api/prisma/migrations" -mindepth 1 -maxdepth 1 -type d | wc -l)"
    [ "$applied" = "$want" ] || pp_die "applied migrations ($applied) differ from the folders in the release ($want)" 3
  else pp_warn "no prisma/migrations folder in the checkout: the applied count was not compared"; fi
  [ "$(su_scalar "$db" "select count(*) from _prisma_migrations where finished_at is null and rolled_back_at is null")" = 0 ] || pp_die "unfinished migrations exist" 3
}

step_roles_after() { "$PP_VPS_DIR/db-roles.sh" apply; "$PP_VPS_DIR/db-roles.sh" check; }

step_seed() {
  pp_compose run --rm --no-deps -T -e ALLOW_DEMO_SEED=false -e BIJAK_POC_QUESTIONS=false migrate npm run be:db:seed
  pp_log "reference data: $(su_scalar "$db" "select 'levels '||(select count(*) from education_levels)||', subjects '||(select count(*) from subjects)||', chapters '||(select count(*) from chapters)||' (inactive '||(select count(*) from chapters where not is_active)||'), curriculum_nodes '||(select count(*) from curriculum_nodes)||', packages '||(select count(*) from school_packages)||', spm_subject_configs '||(select count(*) from spm_subject_configs)||', users '||(select count(*) from users)")"
  [ "$(su_scalar "$db" "select count(*) from education_levels")" -gt 0 ] || pp_die "the reference seed did not load the curriculum" 3
  [ "$(su_scalar "$db" "select count(*) from users")" = 0 ] || pp_die "users exist after the reference seed: not an empty rebuild" 3
}

SLOT="$PP_VPS_DIR/migration/slot.sh"
step_stage() {
  local expect
  expect="$(expected_stage_counts)"
  "$SLOT" throwaway-up
  "$SLOT" load --from "$dump_dir"
  PP_STAGE_EXPECT="$expect" "$SLOT" copy
  "$SLOT" throwaway-down
  pp_log "staged: $(su_psql "$db" -At -c "select string_agg(table_schema||':'||n, ' ' order by table_schema) from (select table_schema, count(*) n from information_schema.tables where table_schema in ('staging_cloud','archive_cloud') group by 1) t" </dev/null)"
}

# etl LABEL COMMAND [ARGS...]: one `slot.sh etl` call, timed, output kept in the step log; a non-zero exit stops the run.
ETL_LOG=""
etl() {
  local label="$1" t0=$SECONDS rc rcf; shift
  rcf="$(mktemp)"
  # the group always exits 0 and leaves the real exit status in the file: no ERR trap inside the pipeline
  { "$SLOT" etl "$@" || echo "$?" >"$rcf"; } 2>&1 | tee -a "$ETL_LOG"
  rc="$(cat "$rcf")"; rc="${rc:-0}"; rm -f "$rcf"
  pp_log "SUB-TIME $label: $((SECONDS - t0))s exit=$rc"
  return "$rc"
}

# one full ETL pass. PASS is 1 or 2; the as-of date is the same in both (the input hashes must match).
etl_pass() {
  local pass="$1" plan_file fa=()
  ETL_LOG="$state_dir/rebuild-$run_id-etl$pass.log"
  [ -z "$files_dir" ] || fa=("--files-dir=$files_dir")
  etl "p$pass migrate:all --apply" migrate:all --apply --as-of="$asof" ${fa[@]+"${fa[@]}"}
  # QLOAD: plan (read-only), then dry-run and apply bound to that plan file (refuses when the staged data changed)
  etl "p$pass migrate:questions --plan" migrate:questions --plan --as-of="$asof" --core-as-of="$asof"
  plan_file="$(sed -n 's/^plan: //p' "$ETL_LOG" | tail -n1)"
  [ -n "$plan_file" ] || pp_die "migrate:questions --plan did not print the plan file" 3
  if [ "$pause_plan" = 1 ] && [ "$pass" = 1 ]; then
    pp_log "PLAN WRITTEN: $plan_file (in $out_dir). Review it with the PO, then press ENTER to apply (Ctrl-C leaves the database empty of questions)."
    read -r _ </dev/tty || pp_die "--pause-after-plan needs a terminal" 3
  fi
  # --files-dir runs the picture pass (copies question/stimulus images, releases held groups); not valid with --plan.
  etl "p$pass migrate:questions --dry-run" migrate:questions --dry-run --as-of="$asof" --core-as-of="$asof" --plan-file="$plan_file" ${fa[@]+"${fa[@]}"}
  etl "p$pass migrate:questions --apply" migrate:questions --apply --as-of="$asof" --core-as-of="$asof" --plan-file="$plan_file" ${fa[@]+"${fa[@]}"}
  # HOOK (T-B9-6/7): structured, subjective and canonical-only questions. Entry point exists in the tree; skip with --skip structured.
  # --files-dir: these steps create questions held for their picture AFTER the pass of migrate:questions, so the run ends with the picture pass again (repair mode).
  if is_skipped structured; then pp_warn "HOOK structured skipped (--skip structured)"; else
    etl "p$pass migrate:structured --dry-run" migrate:structured --dry-run --as-of="$asof" --core-as-of="$asof" ${fa[@]+"${fa[@]}"}
    etl "p$pass migrate:structured --apply" migrate:structured --apply --as-of="$asof" --core-as-of="$asof" ${fa[@]+"${fa[@]}"}
  fi
  # HOOK (T-B10): SPM sets, blueprints, papers. --terbit publishes the V2-published papers through the real publish gate.
  if is_skipped papers; then pp_warn "HOOK papers skipped (--skip papers)"; else
    # --files-dir: Kertas Subjektif page images (and FILE_STORAGE_DIR, which the API config needs in production).
    etl "p$pass migrate:papers --dry-run" migrate:papers --dry-run --as-of="$asof" --core-as-of="$asof" ${fa[@]+"${fa[@]}"}
    etl "p$pass migrate:papers --apply" migrate:papers --apply --as-of="$asof" --core-as-of="$asof" ${fa[@]+"${fa[@]}"}
    # Terbit pass (design 10.5/10.5a): its own command, built with the API (decorator metadata), run with node. Same ETL window, API stopped.
    if [ "$terbit" = 1 ]; then etl "p$pass migrate:terbit --apply" migrate:terbit --apply; fi
  fi
  # MIG-09 backfill: link migrated answers to bank questions (reads archive_cloud only)
  if is_skipped link-questions; then pp_warn "HOOK link-questions skipped (--skip link-questions)"; else
    etl "p$pass migrate:link-questions --apply" migrate:link-questions --apply
  fi
}

step_etl1() { etl_pass 1; }
step_verify() {
  ETL_LOG="$state_dir/rebuild-$run_id-verify.log"
  if [ "$verify_soft" = 1 ]; then
    etl "migrate:verify (soft)" migrate:verify || { CHECK_FAILS+=("migrate:verify (full, after all loaders) failed; see $ETL_LOG"); pp_warn "migrate:verify failed: recorded, run continues (--verify-soft)"; }
  else
    etl "migrate:verify" migrate:verify
  fi
}

step_etl2() {
  local base changed
  base="$(su_scalar "$db" "select coalesce(max(id),0) from etl_runs")"
  etl_pass 2
  # Idempotency gate: the second pass must insert and update NOTHING (counters of every apply run after the first pass).
  changed="$(su_scalar "$db" "select coalesce(sum(coalesce((e.value->>'inserted')::bigint,0) + coalesce((e.value->>'updated')::bigint,0)),0) from etl_runs r cross join lateral jsonb_each(r.counters) e where r.id > $base and r.mode='apply' and r.status='succeeded' and jsonb_typeof(e.value)='object' and e.key <> 'notes'")"
  pp_log "second pass: $(su_scalar "$db" "select count(*) from etl_runs where id > $base and mode='apply' and status='succeeded'") apply runs, rows inserted or updated: $changed"
  if [ "$changed" != 0 ]; then
    su_psql "$db" -At -c "select r.id||' '||r.entity_set::text||' '||e.key||' inserted='||(e.value->>'inserted')||' updated='||(e.value->>'updated') from etl_runs r cross join lateral jsonb_each(r.counters) e where r.id > $base and r.mode='apply' and jsonb_typeof(e.value)='object' and e.key <> 'notes' and (coalesce((e.value->>'inserted')::bigint,0)+coalesce((e.value->>'updated')::bigint,0)) > 0 order by 1 limit 40" </dev/null || true
    pp_die "the second ETL pass changed $changed rows: the load is not idempotent (stop; see the lines above)" 3
  fi
}

# ---- post-ETL repairs and checks (docs/ops/r1-uat-rebuild-prep.md section 5). FAILs are recorded, they do not stop the run:
# the failures are decisions for the PO (go / no-go) and are listed at the end; the exit status is then 4.
CHECK_FAILS=()
PENDING_PO=()   # open items for the PO that are NOT failed checks (KP-12: the support contact stays empty until Central Admin fills it in)
uat_op() { # uat_op LABEL SCRIPT-FILE-OR-ALIAS ARGS...  (runs in the migrate image as the schema owner; reports go to $out_dir/uat-ops)
  local label="$1" what="$2" rc=0; shift 2
  local cmd=(npm run "$what" -w @pp/api --)
  case "$what" in *.ts) cmd=(npm exec -w @pp/api -- tsx "scripts/uat-ops/$what") ;; esac
  sub_time "$label" pp_compose run --rm --no-deps -T -v "$out_dir:/app/.evidence" migrate "${cmd[@]}" "$@" || rc=$?
  if [ "$rc" != 0 ]; then CHECK_FAILS+=("$label (exit $rc)"); pp_warn "CHECK/REPAIR FAILED: $label (exit $rc)"; fi
  return 0
}

# support_contact_check: u-op-16 in database mode. Exit 0 with a "PENDING PO ITEM" line = open PO item (listed at the end, not a failed check).
support_contact_check() {
  local out rcf rc label="support-contact"
  out="$(mktemp)"; rcf="$(mktemp)"
  # the group always exits 0 and leaves the real exit status in the file (as etl() does): no ERR trap inside the pipeline
  { sub_time "$label" pp_compose run --rm --no-deps -T -v "$out_dir:/app/.evidence" migrate npm run uat:support-contact -w @pp/api -- || echo "$?" >"$rcf"; } 2>&1 | tee "$out"
  rc="$(cat "$rcf")"; rc="${rc:-0}"; rm -f "$rcf"
  if [ "$rc" != 0 ]; then CHECK_FAILS+=("$label (exit $rc)"); pp_warn "CHECK FAILED: $label (exit $rc)"
  elif grep -q 'PENDING PO ITEM' "$out"; then PENDING_PO+=("support contact (e-mail, WhatsApp, hours) is empty: Central Admin fills it in at Tetapan > Hubungi Sokongan (KP-12)"); pp_log "PENDING PO ITEM: $label (not a failed check)"; fi
  rm -f "$out"
  return 0
}

# intake_av_check: INTAKE_TEACHER_ENABLED on while ClamAV is not live is a failed check (S-3). Reads api.env and the clamav container.
intake_av_check() {
  local msg rc=0
  msg="$(pp_intake_av_problem runtime)" || rc=$?
  if [ "$rc" != 0 ]; then CHECK_FAILS+=("intake-av: $msg"); pp_warn "CHECK FAILED: intake-av: $msg"; else pp_log "intake-av: ok (teacher intake is off, or configured with scan code present)"; fi
  return 0
}

# intake_env_check: the intake worker's environment, checked inside the API image (compose run, the api service: same image, same
# api.env, same forced environment as the running API; api is stopped during the ETL so this starts a throwaway container). Plain sh:
# the runtime image has no npm or tsx. Never prints AI_API_KEY. Mirrors scripts/uat-ops/u-op-02-intake-env-check.ts (kept for manual runs).
intake_env_check() {
  local rc=0
  # shellcheck disable=SC2016  # expands inside the container
  sub_time "intake-env (api image)" pp_compose run --rm --no-deps -T --entrypoint sh api -c '
f=0
ok() { echo "PASS $1"; }
no() { echo "FAIL $1"; f=1; }
if [ "${JOBS_WORKER_ENABLED:-}" = true ]; then ok "JOBS_WORKER_ENABLED=true"; else no "JOBS_WORKER_ENABLED is [${JOBS_WORKER_ENABLED:-}], expected true (PP_JOBS_WORKER_ENABLED in prod.env)"; fi
eng="$(printf %s "${OCR_ENGINE:-}" | tr A-Z a-z)"
if [ "$eng" = tesseract ]; then ok "OCR_ENGINE=tesseract"; else no "OCR_ENGINE is [${OCR_ENGINE:-}], expected tesseract"; fi
d="${OCR_LANG_DIR:-}"
case "$d" in
  /*) if [ -d "$d" ]; then
        ok "OCR_LANG_DIR=$d"
        for l in msa eng; do if [ -r "$d/$l.traineddata" ]; then ok "$l.traineddata readable"; else no "$l.traineddata missing or unreadable in $d"; fi; done
      else no "OCR_LANG_DIR is not a folder in the api image: $d"; fi ;;
  *) no "OCR_LANG_DIR is not set or not absolute (expected /opt/tessdata)" ;;
esac
ai="$(printf %s "${AI_PROVIDER:-}" | tr A-Z a-z)"
if [ -z "$ai" ]; then ok "AI_PROVIDER unset (default mock + OCR_ENGINE=tesseract selects the real segmenter, no external call)"; else no "AI_PROVIDER=$ai is set: remove it from api.env (no external AI on UAT, D112)"; fi
case "$(printf %s "${INTAKE_TEACHER_ENABLED:-}" | tr A-Z a-z)" in
  ""|false) ok "INTAKE_TEACHER_ENABLED is off" ;;
  *) if [ -n "${CLAMAV_HOST:-}" ]; then ok "INTAKE_TEACHER_ENABLED is on and CLAMAV_HOST is set (the clamav container is checked on the host)"; else no "INTAKE_TEACHER_ENABLED is on but CLAMAV_HOST is empty: teacher DOCX/XLSX uploads are not virus-scanned (S-3)"; fi ;;
esac
if [ -z "${AI_API_KEY:-}" ]; then ok "AI_API_KEY is empty"; else no "AI_API_KEY is set (value not shown): no external AI provider on UAT"; fi
exit $f' || rc=$?
  if [ "$rc" != 0 ]; then CHECK_FAILS+=("intake-env (api image) (exit $rc)"); pp_warn "CHECK FAILED: intake-env (api image) (exit $rc)"; fi
  return 0
}

# sql_rows_check LABEL FILE: a read-only SELECT of apps/api/scripts/uat-ops (rows 'id | description | value | expected | ok'); FAIL rows are recorded.
sql_rows_check() {
  local label="$1" f="$PP_REPO/apps/api/scripts/uat-ops/$2" out rc=0 n
  [ -r "$f" ] || { CHECK_FAILS+=("$label: $2 not found in the checkout"); pp_warn "$f not found in the checkout"; return 0; }
  out="$(mktemp)"
  su_psql "$db" -At <"$f" >"$out" || rc=$?
  cat "$out"
  n="$(awk -F'|' '$NF ~ /FAIL/{c++} END{print c+0}' "$out")"
  rm -f "$out"
  pp_log "$label: exit=$rc, FAIL rows: $n"
  if [ "$rc" != 0 ] || [ "$n" != 0 ]; then CHECK_FAILS+=("$label ($n FAIL rows, exit $rc)"); fi
  return 0
}

step_repairs() {
  if is_skipped repairs; then pp_warn "HOOK repairs skipped (--skip repairs)"; return 0; fi
  # 1 verify already ran (step 12). 2 DSKP counts after the seed: 'belum dimuatkan' means run dskp:load (idempotent)
  uat_op "dskp-dry-run" uat:dskp-dry-run
  # 3 difficulty level from TP where NULL (idempotent)
  uat_op "difficulty-level-backfill --apply" uat:difficulty-level-backfill --apply
  # 4 trim-duplicate-stem BEFORE the stimulus flags (the runbook order of the T-B1 rehearsal: the trim empties the repeated prompt,
  #   the flag script then clears the flag). The loader no longer writes a leaf prompt that repeats the stem, so this is a
  #   CONDITIONAL CHECK: the dry-run is read-only and must report 0 candidates; a non-zero count needs --approve trim-duplicate-stem
  if approved trim-duplicate-stem; then uat_op "trim-duplicate-stem --apply" trim-duplicate-stem.ts --apply
  else uat_op "trim-duplicate-stem (dry-run, conditional check; PENDING PO APPROVAL if candidates > 0)" trim-duplicate-stem.ts; fi
  # 5 stimulus flags: the dry-run report is for the PO; the write needs --approve flag-stimulus
  if approved flag-stimulus; then uat_op "flag-stimulus --apply" uat:flag-stimulus --apply
  else uat_op "flag-stimulus (dry-run; PENDING PO APPROVAL)" uat:flag-stimulus; fi
  # 6 challenge metrics (needs migration 0232, in HEAD)
  uat_op "challenge-metrics --apply" uat:challenge-metrics --apply
  # 7 past Bijak sittings into practice_answers; the legacy-mode run is separate and runs alone
  uat_op "backfill-bijak-answers --apply" uat:backfill-bijak-answers --apply
  uat_op "backfill-bijak-answers --legacy-mode --apply" uat:backfill-bijak-answers --legacy-mode --apply
  # 8 read-only verification (each prints PASS / FAIL lines and exits 1 on a failed check)
  uat_op "regroup-report" uat:regroup-report
  uat_op "bulk-chapter-dry-run" uat:bulk-chapter-dry-run
  uat_op "check-levels" uat:check-levels
  uat_op "chapters-t1-t3" uat:chapters-t1-t3
  uat_op "uji-leftovers" uat:uji-leftovers
  # support-contact reads support_config (V2 has no such values to migrate). PO decision KP-12: empty values are a PENDING PO ITEM (Central Admin
  # fills them in at Tetapan > Hubungi Sokongan), not a failed check; a broken table or endpoint still fails (exit 1 or 2).
  support_contact_check
  # S-3: teacher DOCX/XLSX uploads are not virus-scanned; INTAKE_TEACHER_ENABLED must be off unless ClamAV is live (also in the G5 preflight)
  intake_av_check
  # intake-env runs in the API image with the API's own env (the migrate image has no tessdata and no JOBS_WORKER_ENABLED)
  intake_env_check
  # Terbit check: only when --terbit ran; the old `terbit-papers` (HTTP pool preview, needs a running API and admin login) is a manual tool
  if [ "$terbit" = 1 ] && ! is_skipped papers; then sql_rows_check "terbit-published (read-only)" terbit-published.sql
  else pp_log "terbit-published: SKIPPED, the Terbit pass did not run (no --terbit, or --skip papers): V2-published papers stay draft until migrate:terbit --apply"; fi
  # SQL integrity checks: empty result = clean
  if is_skipped sql-checks; then pp_warn "HOOK sql-checks skipped"; else
    local f
    for f in group-integrity paper-group-integrity tag-integrity tracking-sibling-duplicates; do
      if [ -r "$PP_REPO/apps/api/scripts/uat-ops/$f.sql" ]; then
        pp_log "---- $f.sql ----"
        su_psql "$db" <"$PP_REPO/apps/api/scripts/uat-ops/$f.sql" || { CHECK_FAILS+=("$f.sql failed to run"); pp_warn "$f.sql failed to run"; }
      else pp_warn "$f.sql not found in the checkout"; fi
    done
    smoke_readonly
  fi
}

# smoke-readonly.sql (cutover plan 4.5, go/no-go criterion 9): one read-only SELECT, rows 'id | description | value | expected | ok'.
# 'FAIL' rows are recorded as failed checks; 'info' rows are for the operator to compare with the verify report.
smoke_readonly() {
  local f="$PP_REPO/docs/ops/sql/smoke-readonly.sql" out rc=0 n
  [ -r "$f" ] || { pp_warn "$f not found in the checkout: smoke-readonly skipped"; return 0; }
  out="$(mktemp)"
  su_psql "$db" -At <"$f" >"$out" || rc=$?
  cat "$out"
  n="$(awk -F'|' '$NF=="FAIL"{c++} END{print c+0}' "$out")"
  rm -f "$out"
  pp_log "smoke-readonly.sql: exit=$rc, FAIL rows: $n"
  if [ "$rc" != 0 ] || [ "$n" != 0 ]; then CHECK_FAILS+=("smoke-readonly.sql ($n FAIL rows, exit $rc)"); fi
}

step_drop_staging() {
  if [ "$keep_staging" = 1 ]; then pp_warn "--keep-staging: staging_cloud (raw .cloud personal data) stays in the database; PP_RAW_PURGE_BY applies"; return 0; fi
  # pp_stager owns the schema (copy made it), so the drop needs no superuser
  # shellcheck disable=SC2016  # expands inside the container
  pp_db_exec sh -c 'exec psql -X -v ON_ERROR_STOP=1 -U "$1" -d "$POSTGRES_DB" -c "drop schema if exists staging_cloud cascade"' sh "$PP_DB_ROLE_STAGE" </dev/null
  pp_log "staging_cloud dropped (archive_cloud stays: question snapshots and references). Delete the raw dump directory with: slot.sh wipe-dump $dump_dir"
}

step_start() {
  pp_compose up -d --wait --no-deps api frontend
  pp_compose up -d --wait --no-deps --force-recreate edge
  pp_health_checks || pp_die "health checks through the edge failed (docker compose logs --since 10m api edge)" 3
}

step_record() {
  local prev="" cur=""
  prev="$(cat "$state_dir/rebuild-prev.tag" 2>/dev/null || true)"; cur="$(cat "$state_dir/current.tag" 2>/dev/null || true)"
  [ -z "$prev" ] || [ "$prev" = "$tag" ] || printf '%s\n' "$prev" >"$state_dir/previous.tag"
  printf '%s\n' "$tag" >"$state_dir/current.tag"
  printf '%s rebuild-db tag=%s previous=%s sha=%s user=%s database=%s dump=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$tag" "${prev:-none}" \
    "$(git -C "$PP_REPO" rev-parse HEAD 2>/dev/null || echo unknown)" "$(id -un)" "$db" "$BACKUP_FILE" >>"$state_dir/history.log"
  pp_log "release recorded: current=$tag previous=${prev:-none} (was ${cur:-none})"
}

# ---------------------------------------------------------------------------------------------------------------
# rollback: restore the pre-rebuild dump
# ---------------------------------------------------------------------------------------------------------------
# files_archive_for_restore: sets FILES_ARCHIVE to the archive this restore may unpack, or '' when none. Refuses (before anything is dropped)
# an archive that does not belong to the same run as the restore dump: the run id sidecars and rebuild-backup.path must agree (C-2).
FILES_ARCHIVE=""
files_archive_for_restore() {
  local fa fa_run bk_run bk_path
  fa="$(cat "$state_dir/rebuild-files-archive.path" 2>/dev/null || true)"
  FILES_ARCHIVE=""
  [ -n "$fa" ] || return 0
  fa_run="$(cat "$state_dir/rebuild-files-archive.run" 2>/dev/null || true)"
  bk_run="$(cat "$state_dir/rebuild-backup.run" 2>/dev/null || true)"
  bk_path="$(cat "$state_dir/rebuild-backup.path" 2>/dev/null || true)"
  if [ -z "$fa_run" ] || [ -z "$bk_run" ] || [ "$fa_run" != "$bk_run" ] || [ -z "$bk_path" ] || [ "$(readlink -m "$bk_path")" != "$(readlink -m "$restore_file")" ]; then
    pp_die "refused: the files archive $fa (run '${fa_run:-unknown}') does not belong to the same run as the restore dump $restore_file (backup run '${bk_run:-unknown}', recorded dump '${bk_path:-none}'). Nothing was changed. Restore the dump the same run wrote, or delete $state_dir/rebuild-files-archive.path to restore the database only" 3
  fi
  [ -s "$fa" ] || pp_die "the files archive $fa recorded for this run is missing or empty" 3
  (cd "$(dirname "$fa")" && sha256sum -c "$(basename "$fa").sha256" >/dev/null) || pp_die "sha256 of the files archive does not match" 3
  FILES_ARCHIVE="$fa"
}

step_restore() {
  local f="$restore_file"
  verify_dump "$f"
  files_archive_for_restore
  BACKUP_FILE="$f"; BACKUP_OK=1
  API_STOPPED=1; pp_compose stop api
  DB_DROPPED=1
  su_psql postgres -c "drop database if exists \"$db\" with (force)" -c "create database \"$db\"" </dev/null
  # shellcheck disable=SC2016  # expands inside the container
  pp_db_exec sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' <"$f"
  "$PP_VPS_DIR/db-roles.sh" apply
  "$PP_VPS_DIR/db-roles.sh" check
  pp_log "restored: $(su_scalar "$db" "select (select count(*) from information_schema.tables where table_schema='public') || ' tables, ' || (select count(*) from _prisma_migrations where finished_at is not null) || ' migrations, users ' || coalesce((select count(*)::text from users), '-')")"
  local fa="$FILES_ARCHIVE"
  if [ -n "$fa" ]; then
    local vol; vol="$(apifiles_volume)"
    docker run --rm -v "$vol:/f" --entrypoint sh "$stage_image" -c 'find /f -mindepth 1 -delete'
    docker run --rm -i -v "$vol:/f" --entrypoint tar "$stage_image" -C /f -xzf - <"$fa"
    pp_log "old uploads restored from $fa"
  else pp_warn "no files archive recorded: the files volume was not touched by the restore"; fi
}

step_restart_previous() {
  local prev; prev="$(cat "$state_dir/rebuild-prev.tag" 2>/dev/null || true)"
  [ -n "$prev" ] || pp_die "no previous release recorded in $state_dir/rebuild-prev.tag: start one by hand (rollback.sh TAG)" 3
  export PP_IMAGE_TAG="$prev"
  pp_compose up -d --wait --no-deps api frontend
  pp_compose up -d --wait --no-deps --force-recreate edge
  pp_health_checks || pp_die "health checks failed after the restore" 3
  printf '%s\n' "$prev" >"$state_dir/current.tag"
  pp_log "previous release $prev is running on the restored database"
}

# ---------------------------------------------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------------------------------------------
[ "$rebuild" = 1 ] || pp_die "refused: this script destroys the database; pass --rebuild-db (G1). See --help." 2
trap on_err ERR
trap on_exit EXIT

if [ -n "$restore_file" ]; then
  [ "$dry" = 0 ] || pp_die "--dry-run does not apply to --restore-backup" 2
  assert_target_db
  [ -f "$restore_file" ] || pp_die "--restore-backup: $restore_file is not a file" 2
  pp_assert_outside_repo "$restore_file"
  [ -n "$tag" ] || tag="restore"
  confirm_typed "RESTORE (drop and recreate, then pg_restore the dump into)"
  pp_lock 0
  ARMED=1
  run_step R1 "restore the dump (drop, create, pg_restore, roles)" step_restore
  run_step R2 "start the previous release and health checks" step_restart_previous
  summary
  pp_log "ROLLBACK COMPLETE: database restored from $restore_file"
  exit 0
fi

[ -n "$dump_dir" ] || pp_die "--dump-dir is required (the staged raw dump directory)" 2
run_step 0 "guards and preflight (changes nothing)" preflight
if [ "$dry" = 1 ]; then
  print_plan
  pp_log "DRY-RUN: all checks passed, nothing was changed. Without --dry-run the typed confirmation (G4) comes next."
  exit 0
fi
print_plan
confirm_typed "REBUILD (drop, recreate and refill from the V2 dump)"
pp_lock 0
mkdir -p "$state_dir"
# C-2: an archive path left by an earlier run (archive, then a later keep or wipe run) must never be unpacked by this run's restore.
rm -f "$state_dir/rebuild-files-archive.path" "$state_dir/rebuild-files-archive.run"
ARMED=1

run_step 1 "images for tag $tag" step_images
run_step 2 "fresh backup and verification (G7)" step_backup
run_step 3 "stop api and the jobs worker" step_stop_api
run_step 4 "old files volume ($files_policy)" step_files_prepare
run_step 5 "drop and create the database" step_drop_create
run_step 6 "db roles apply (before migrate)" step_roles_before
run_step 7 "prisma migrate deploy (0001..HEAD from empty)" step_migrate
run_step 8 "db roles apply + check (after migrate)" step_roles_after
run_step 9 "reference seed (production mode, curriculum included)" step_seed
run_step 10 "stage the V2 dump (throwaway cluster, copy)" step_stage
run_step 11 "ETL pass 1" step_etl1
run_step 12 "migrate:verify" step_verify
run_step 13 "ETL pass 2 (must change 0 rows)" step_etl2
run_step 14 "post-ETL repairs and checks" step_repairs
run_step 15 "drop staging_cloud" step_drop_staging
run_step 16 "start api, frontend, edge; health checks" step_start
run_step 17 "record the release" step_record
summary
ARMED=0   # the run is over: exit 4 below is a verdict, not a crash
if [ ${#CHECK_FAILS[@]} -gt 0 ]; then
  pp_log "REBUILD COMPLETE WITH ${#CHECK_FAILS[@]} FAILED CHECK(S) OR REPAIR(S): the PO decides go / no-go:" >&2
  printf '  - %s\n' "${CHECK_FAILS[@]}" >&2
  [ ${#PENDING_PO[@]} -eq 0 ] || { pp_log "PENDING PO ITEM(S), not failed checks:" >&2; printf '  - %s\n' "${PENDING_PO[@]}" >&2; }
  exit 4
fi
[ ${#PENDING_PO[@]} -eq 0 ] || { pp_log "PENDING PO ITEM(S), not failed checks:"; printf '  - %s\n' "${PENDING_PO[@]}"; }
pp_log "REBUILD COMPLETE: $db rebuilt from empty and filled from $dump_dir. Rollback dump: $BACKUP_FILE"
