#!/usr/bin/env bash
# Production migration slot on the VPS, 29-30 Oct (MIG08-PREP). Runbook: docs/ops/production-migration-slot.md.
# The cutover plan (docs/ops/v2-cutover-plan.md, half AM) owns WHAT runs WHEN; this script is HOW it runs on this host.
#
#   deploy/vps/migration/slot.sh throwaway-up                         B0: the throwaway staging cluster
#   deploy/vps/migration/slot.sh load --from DIR                      B4: staging:load of a RAW dump into it
#   deploy/vps/migration/slot.sh load --from DIR --synthetic-scratch  A4 Track S ONLY: a SYNTHETIC fixture on a scratch host
#                                                                     (PP_SCRATCH_HOST=yes and PP_OFFSITE_KIND=none in the prod.env FILE,
#                                                                     the host name typed in a terminal; leaves a SYNTHETIC marker that
#                                                                     copy, etl --apply and gonogo read until the next throwaway-up)
#   deploy/vps/migration/slot.sh copy                                 B5: staging_cloud + archive_cloud -> target
#   deploy/vps/migration/slot.sh throwaway-down                       B5: destroy the cluster and its data dir
#   deploy/vps/migration/slot.sh wipe-dump DIR [FILE.gpg] [--missing-ok]  after a good load: delete the raw dump copies
#                                                                     (a missing path exits 3; --missing-ok: STOP block only)
#   deploy/vps/migration/slot.sh etl COMMAND [ARGS...]                B6-B8, C5, C6: staging:profile / migrate:* in the
#                                                                     migrate image, production guards set per run
#   deploy/vps/migration/slot.sh gonogo                               A5, B0, B9: evidence lines for the go/no-go (infra part)
#
# This is the PRODUCTION path for REAL (not anonymised) data. It is separate from deploy/rehearsal/rehearsal-db.sh
# (AZ-30), which stays limited to attested anonymised or synthetic dumps and NODE_ENV=development. Here:
#   - `load` refuses a dump that is NOT marked raw (manifest "raw": true from dump:cloud), or is marked anonymised or
#     synthetic, or carries a large_integers note (integers >= 2^53 would not survive JSON.parse);
#   - staging:load runs with NODE_ENV=development and PP_ALLOW_STAGING_RESET=1 against the THROWAWAY cluster only
#     (its database name ends in _staging; the loader refuses production by design);
#   - every migrate:* runs with NODE_ENV=production and PP_MIGRATE_TARGET_DB=<the production database>, as the
#     migration role pp_etl (--env-from-file etl.env, cutover plan P3), with PP_GIT_SHA=<release sha> and
#     --out-dir on the mounted reports folder; PP_ALLOW_MIGRATE_APPLY=1 is added only when --apply is on the command
#     line (always for migrate:archive-minimise and migrate:rollback, whose dry-runs need it too),
#     PP_ALLOW_MIGRATE_ROLLBACK=1 only for migrate:rollback. Nothing is set permanently in api.env;
#   - --files-dir HOST_DIR is mounted read-only at /files; with --apply the api uploads volume is mounted too and
#     FILE_STORAGE_DIR is set (cutover plan P5);
#   - copy and the target reads run as the stage-only role pp_stager over the db container's socket; copy runs
#     deploy/vps/db-roles.sh apply before the drop and after the restore.
# The throwaway cluster: a postgres container on the compose network, data dir PP_STAGE_DIR/pgdata (an encrypted
# volume), archive_mode=off, wal_level=minimal, no backups, no replicas, never reached by the API. It exists only
# between throwaway-up and throwaway-down.
# Reports of migrate:* land in PP_MIGRATION_OUT (mode 700, owner uid 1000 = node in the image, outside the repo).
# Every command holds the shared lock (PP_LOCK_FILE), so no backup, deploy or drill runs in between.
set -Eeuo pipefail
umask 077
export PP_SCRIPT=migration-slot
# shellcheck source-path=SCRIPTDIR
# shellcheck source=../lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

usage() { sed -n '2,34p' "${BASH_SOURCE[0]}"; }
cmd="${1:-}"; [ $# -eq 0 ] || shift
case "$cmd" in -h|--help|help|'') usage; exit 0 ;; esac

stage_dir="$(pp_cfg PP_STAGE_DIR /srv/pretasiplus/stage)"
out_dir="$(pp_cfg PP_MIGRATION_OUT /srv/pretasiplus/migration-out)"
stage_name="$(pp_cfg PP_STAGE_CONTAINER pp-stage-throwaway)"
stage_image="$(pp_cfg PP_STAGE_IMAGE postgres:16-alpine)"
target_db="$(pp_env_value "$PP_ENV_DIR/db.env" POSTGRES_DB)"
[[ "$target_db" =~ ^[a-z][a-z0-9_]{0,40}$ ]] || pp_die "POSTGRES_DB in $PP_ENV_DIR/db.env must be lowercase letters, digits and _ (got an unusable name)" 2
staging_db="${target_db}_staging"
[[ "$stage_name" =~ ^[a-z][a-z0-9-]{0,40}$ ]] || pp_die "PP_STAGE_CONTAINER: lowercase letters, digits and -" 2
pp_assert_outside_repo "$stage_dir"
pp_assert_outside_repo "$out_dir"

# The compose network the api and db share (<project>_default), read from the running db container.
compose_network() {
  local cid nets n
  cid="$(pp_compose ps -q db | head -n1)"
  [ -n "$cid" ] || pp_die "the db service is not running"
  nets="$(docker inspect --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$cid")"
  for n in $nets; do case "$n" in *_default) printf '%s' "$n"; return 0 ;; esac; done
  pp_die "no *_default network on the db container (networks: $nets)"
}

stage_running() { [ "$(docker inspect --format '{{.State.Running}}' "$stage_name" 2>/dev/null || true)" = true ]; }
stage_pw_file() { printf '%s/stage.pw' "$stage_dir"; }

# stage_psql SQL -> scalar from the throwaway staging database
stage_psql() {
  docker exec -i "$stage_name" sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -At -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' sh "$1"
}
# target_psql SQL -> scalar from the production database, as the stage-only role pp_stager (cutover plan P3): no
# password, local socket of the db container only; it owns staging_cloud/archive_cloud and cannot read public.
target_psql() {
  # shellcheck disable=SC2016  # expands inside the container
  pp_db_exec sh -c 'exec psql -X -At -v ON_ERROR_STOP=1 -U "$1" -d "$POSTGRES_DB" -c "$2"' sh "$PP_DB_ROLE_STAGE" "$1"
}

schema_tables() { # schema_tables psql_fn -> "staging_cloud:N archive_cloud:M"
  "$1" "select string_agg(s || ':' || coalesce(n, 0), ' ' order by s) from (values ('archive_cloud'), ('staging_cloud')) v(s) left join (select table_schema, count(*) n from information_schema.tables where table_schema in ('staging_cloud', 'archive_cloud') group by 1) t on t.table_schema = v.s"
}

# check_out_dir -> the reports folder exists, mode 700, owned by the migrate image's user (uid PP_MIGRATE_UID, 1000).
check_out_dir() {
  local want got
  want="$(pp_cfg PP_MIGRATE_UID 1000)"
  [[ "$want" =~ ^[0-9]+$ ]] || pp_die "PP_MIGRATE_UID must be a numeric uid" 3
  want="$want:700"
  [ -d "$out_dir" ] && got="$(stat -c %u:%a "$out_dir" 2>/dev/null)" || got=missing
  [ "$got" = "$want" ] || pp_die "PP_MIGRATION_OUT $out_dir is $got, needs owner:mode $want: sudo install -d -o ${want%:*} -g ${want%:*} -m 700 $out_dir" 3
}

# migrate_run ENV_ARGS... -- COMMAND...: the migrate image, on the compose network, with the reports volume.
RUN_EXTRA=()   # extra `compose run` arguments of the current command (mounts), set by cmd_etl
migrate_run() {
  local envs=()
  while [ "$1" != -- ]; do envs+=(-e "$1"); shift; done
  shift
  # The folder is made once by the runbook (section 1) for the migrate image's user, not for ppdeploy: ppdeploy may
  # have any uid, so it only checks it here (chmod on a folder it does not own would fail under set -e).
  check_out_dir
  # migrate:* connect as the migration role pp_etl (etl.env), not as the schema owner of migrate.env (P3, DB-ROLES
  # #227). A `compose run --env-from-file` value overrides the service's env_file (api.env, migrate.env).
  [ -r "$PP_ENV_DIR/etl.env" ] || pp_die "$PP_ENV_DIR/etl.env is missing: sudo deploy/vps/db-roles.sh secrets, then deploy/vps/db-roles.sh apply" 3
  pp_compose run --rm --no-deps -T --env-from-file "$PP_ENV_DIR/etl.env" -v "$out_dir:/app/apps/api/.migration-out" \
    ${RUN_EXTRA[@]+"${RUN_EXTRA[@]}"} "${envs[@]}" migrate "$@"
}

cmd_throwaway_up() {
  pp_lock "$(pp_cfg PP_LOCK_WAIT 1800)"
  ! stage_running || pp_die "the throwaway cluster $stage_name is already running; run throwaway-down first (it is created empty for every load)" 3
  docker rm -f "$stage_name" >/dev/null 2>&1 || true
  [ ! -e "$stage_dir/pgdata" ] || pp_die "$stage_dir/pgdata exists from an earlier run: run throwaway-down first" 3
  # A new, empty cluster is about to be made: only now does the marker of an earlier synthetic load stop applying.
  rm -f "$(synthetic_marker)"
  mkdir -p "$stage_dir/pgdata"
  chmod 700 "$stage_dir"
  head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n' >"$(stage_pw_file)"
  chmod 600 "$(stage_pw_file)"
  local net
  net="$(compose_network)"
  # The password goes in through a file in the container's env, never on the command line (visible in ps).
  printf 'POSTGRES_DB=%s\nPOSTGRES_USER=pp_stage\nPOSTGRES_PASSWORD=%s\n' "$staging_db" "$(cat "$(stage_pw_file)")" >"$stage_dir/stage.env"
  chmod 600 "$stage_dir/stage.env"
  docker run -d --name "$stage_name" --network "$net" --env-file "$stage_dir/stage.env" \
    --label pp.role=stage-throwaway --restart no --security-opt no-new-privileges:true \
    --memory "$(pp_cfg PP_STAGE_MEM 2g)" --cpus "$(pp_cfg PP_STAGE_CPUS 1)" \
    -v "$stage_dir/pgdata:/var/lib/postgresql/data" \
    "$stage_image" postgres -c archive_mode=off -c wal_level=minimal -c max_wal_senders=0 -c fsync=on >/dev/null
  rm -f "$stage_dir/stage.env"
  pp_log "waiting for the throwaway cluster to accept connections"
  for _ in $(seq 1 60); do
    if docker exec "$stage_name" pg_isready -q -U pp_stage -d "$staging_db" 2>/dev/null; then
      pp_log "THROWAWAY UP: container $stage_name, database $staging_db, network $net, archive_mode=off, data dir $stage_dir/pgdata"
      return 0
    fi
    sleep 2
  done
  pp_die "the throwaway cluster did not become ready within 2 minutes (docker logs $stage_name)"
}

manifest_check() { # manifest_check DIR [synthetic]: a raw pp-staging-dump/1 from dump:cloud; with "synthetic", a fixture only
  local d="$1" m="$1/manifest.json" mode="${2:-raw}"
  [ -f "$m" ] || pp_die "$d has no manifest.json (expected a pp-staging-dump/1 directory from dump:cloud)" 2
  grep -Eq '"format"[[:space:]]*:[[:space:]]*"pp-staging-dump/1"' "$m" || pp_die "manifest.json is not format pp-staging-dump/1" 2
  if [ "$mode" = synthetic ]; then
    # The scratch override loads fixtures:generate output and nothing else: never a raw or an anonymised (real-derived) dump.
    # Parsed as JSON (top level only, duplicate keys refused), not grepped: "raw": "true", a nested "synthetic" or
    # "synthetic": true, "synthetic": false must not pass.
    command -v python3 >/dev/null || pp_die "--synthetic-scratch needs python3 to read manifest.json" 3
    local verdict
    verdict="$(python3 -I -c '
import json, sys
def pairs(kv):
    keys = [k for k, _ in kv]
    if len(keys) != len(set(keys)): raise ValueError("duplicate key")
    return dict(kv)
try:
    m = json.load(open(sys.argv[1], encoding="utf-8"), object_pairs_hook=pairs)
except Exception:
    print("unreadable"); sys.exit(0)
if not isinstance(m, dict) or m.get("synthetic") is not True: print("not-synthetic")
elif "raw" in m and m.get("raw") is not False or "anonymised" in m and m.get("anonymised") is not False: print("real")
elif "large_integers" in m: print("large")
else: print("ok")
' "$m")"
    case "$verdict" in
      ok) ;;
      not-synthetic) pp_die "--synthetic-scratch loads only a fixtures:generate dump (top-level \"synthetic\": true)" 2 ;;
      real) pp_die "--synthetic-scratch refuses a raw or anonymised dump: only synthetic fixtures" 2 ;;
      large) pp_die "the manifest lists large_integers: stop and ask half AM (cutover plan, N1)" 2 ;;
      *) pp_die "--synthetic-scratch: manifest.json is not valid JSON or has a duplicate key" 2 ;;
    esac
    if find "$d" -maxdepth 1 -name '*.partial' | grep -q .; then pp_die "$d still holds .partial files" 2; fi
    return 0
  fi
  grep -Eq '"raw"[[:space:]]*:[[:space:]]*true' "$m" || pp_die "the dump is not marked raw (\"raw\": true). Production loads only the dump:cloud output; anonymised and synthetic dumps belong to deploy/rehearsal/rehearsal-db.sh" 2
  if grep -Eq '"(anonymised|synthetic)"[[:space:]]*:[[:space:]]*true' "$m"; then
    pp_die "the dump is marked anonymised or synthetic: never loaded on the production path" 2
  fi
  if grep -Eq '"large_integers"[[:space:]]*:' "$m"; then
    pp_die "the manifest lists large_integers (values >= 2^53 would be changed by JSON.parse): stop and ask half AM (cutover plan, N1)" 2
  fi
  if find "$d" -maxdepth 1 -name '*.partial' | grep -q .; then pp_die "$d still holds .partial files: the export did not finish" 2; fi
}

# The scratch marker is read from the prod.env FILE only, never from the process environment (pp_cfg prefers the
# environment, so `PP_SCRATCH_HOST=yes slot.sh ...` on production must not count). Residual risk, by design: the path
# variables (PP_PROD_ENV, PP_ENV_DIR, PP_STAGE_DIR) are still taken from the environment, so an operator who points them
# at another file or folder on purpose can defeat the gate; the night card never sets them, and gonogo prints the file
# it read.
scratch_host() { [ "$(pp_env_value "$PP_PROD_ENV" PP_SCRATCH_HOST)" = yes ]; }
synthetic_marker() { printf '%s/SYNTHETIC-LOADED' "$stage_dir"; }
synthetic_loaded() { [ -e "$(synthetic_marker)" ]; }
# The TARGET database keeps a synthetic copy after the throwaway stage is reloaded or rebuilt, so it has its own marker:
# set by a copy from a synthetic stage, cleared only by a copy that replaced the target's schemas from a raw stage.
target_marker() { printf '%s/SYNTHETIC-IN-TARGET' "$stage_dir"; }
target_synthetic() { [ -e "$(target_marker)" ]; }

scratch_gate() { # A4 Track S only: refuse anything that could be the production host
  scratch_host || pp_die "--synthetic-scratch: this host is not marked scratch (PP_SCRATCH_HOST=yes in the prod.env file; never on production)" 2
  local offsite; offsite="$(pp_env_value "$PP_PROD_ENV" PP_OFFSITE_KIND)"
  [ "${offsite:-none}" = none ] || pp_die "--synthetic-scratch: PP_OFFSITE_KIND in prod.env is not none; a scratch host has no off-site backup (A4 P-11)" 2
  local host answer; host="$(hostname -s)"
  [ -t 0 ] || pp_die "--synthetic-scratch needs the typed host name (run it in a terminal)" 2
  printf 'SCRATCH OVERRIDE: load a SYNTHETIC fixture into %s on host %s. Type the host name to confirm: ' "$staging_db" "$host" >&2
  read -r answer || pp_die "no confirmation was typed; nothing was loaded" 2
  [ "$answer" = "$host" ] || pp_die "confirmation did not match; nothing was loaded" 2
  pp_warn "SCRATCH OVERRIDE ACTIVE on $host: synthetic fixture, NOT the production path (A4 Track S)"
}

refuse_synthetic_unless_scratch() { # refuse_synthetic_unless_scratch WHAT [target]: target also checks the target's marker
  ! synthetic_loaded || scratch_host || pp_die "$1: the stage holds a SYNTHETIC fixture ($(synthetic_marker)) and this host is not marked scratch; never on production" 3
  [ "${2:-}" = target ] || return 0
  ! target_synthetic || scratch_host || pp_die "$1: the target holds a SYNTHETIC copy ($(target_marker)) and this host is not marked scratch; never on production" 3
}

cmd_load() {
  local from="" synthetic=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --from) from="${2:?--from needs a directory}"; shift 2 ;;
      --synthetic-scratch) synthetic=1; shift ;;
      *) pp_die "unknown argument: $1" 2 ;;
    esac
  done
  { [ -n "$from" ] && [ -d "$from" ]; } || pp_die "load --from DIR: the extracted raw dump directory" 2
  from="$(readlink -f "$from")"
  pp_assert_outside_repo "$from"
  if [ "$synthetic" = 1 ]; then manifest_check "$from" synthetic; else manifest_check "$from"; fi
  stage_running || pp_die "the throwaway cluster is not running: throwaway-up first" 3
  if [ "$synthetic" = 1 ]; then
    scratch_gate
    manifest_check "$from" synthetic   # again: the directory could have changed while the prompt waited
  fi
  pp_lock "$(pp_cfg PP_LOCK_WAIT 1800)"
  # Under the lock, so a raw load that held it cannot clear the marker of the synthetic load that waited for it.
  [ "$synthetic" = 0 ] || : >"$(synthetic_marker)"
  local url t0=$SECONDS
  url="postgresql://pp_stage:$(cat "$(stage_pw_file)")@$stage_name:5432/$staging_db"
  pp_log "staging:load --from <raw dump> into $staging_db on $stage_name (NODE_ENV=development, PP_ALLOW_STAGING_RESET=1)"
  # DATABASE_URL carries the throwaway password; it goes through an env file of the run, not the command line.
  local envf; envf="$(mktemp "$stage_dir/.load.XXXXXX")"
  printf 'DATABASE_URL=%s\n' "$url" >"$envf"
  # shellcheck disable=SC2064
  trap "rm -f '$envf'" EXIT
  # CLOUD_SOURCE_URL must not be set (the loader takes --from OR a source URL); api.env does not carry it.
  pp_compose run --rm --no-deps -T --user "$(id -u):$(id -g)" --env-from-file "$envf" -v "$from:/dump:ro" \
    -e NODE_ENV=development -e PP_ALLOW_STAGING_RESET=1 \
    migrate npm run staging:load -w @pp/api -- --from /dump
  rm -f "$envf"; trap - EXIT
  # A raw load that SUCCEEDED replaced the stage, so an earlier synthetic marker no longer applies (a failed one keeps it).
  [ "$synthetic" = 1 ] || rm -f "$(synthetic_marker)"
  pp_log "LOAD DONE: $(schema_tables stage_psql) in $staging_db, duration_s=$((SECONDS - t0))$([ "$synthetic" = 0 ] || echo ' (SYNTHETIC, scratch override)')"
}

cmd_copy() {
  stage_running || pp_die "the throwaway cluster is not running" 3
  refuse_synthetic_unless_scratch copy
  pp_lock "$(pp_cfg PP_LOCK_WAIT 1800)"
  local a b t0=$SECONDS
  a="$(schema_tables stage_psql)"
  case "$a" in *staging_cloud:0*) pp_die "staging_cloud is empty in $staging_db: run load first" 3 ;; esac
  pp_log "replacing staging_cloud and archive_cloud in the target with the copy from $staging_db"
  if synthetic_loaded; then : >"$(target_marker)"; fi   # set first: a copy that stops half way still counts as synthetic
  "$PP_VPS_DIR/db-roles.sh" apply   # an older copy made by another role becomes pp_stager's, so it can drop it
  target_psql "drop schema if exists staging_cloud cascade" >/dev/null
  target_psql "drop schema if exists archive_cloud cascade" >/dev/null
  # shellcheck disable=SC2016  # both commands expand inside their containers
  docker exec -i "$stage_name" sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -n staging_cloud -n archive_cloud' \
    | pp_db_exec sh -c 'exec pg_restore -U "$1" -d "$POSTGRES_DB" --no-owner --no-acl --exit-on-error' sh "$PP_DB_ROLE_STAGE"
  "$PP_VPS_DIR/db-roles.sh" apply   # pp_etl: SELECT on both schemas comes from default privileges, UPDATE on archive_cloud from here
  b="$(schema_tables target_psql)"
  [ "$a" = "$b" ] || pp_die "STAGE COPY FAILED: $a in $staging_db, $b in the target"
  # Cutover plan 4.6 B5: a count other than 89/38 (staging/archive) is a STOP. PP_STAGE_EXPECT is the LEAD-approved override.
  local want; want="$(pp_cfg PP_STAGE_EXPECT 'archive_cloud:38 staging_cloud:89')"
  [ "$b" = "$want" ] || pp_die "STAGE COPY COUNTS DIFFER: $b (expected $want): STOP and report to the half-AM operator" 4
  synthetic_loaded || rm -f "$(target_marker)"   # the target's schemas now come from a raw stage
  pp_log "STAGE COPY PASSED: $b, duration_s=$((SECONDS - t0))"
}

cmd_throwaway_down() {
  pp_lock "$(pp_cfg PP_LOCK_WAIT 1800)"
  docker rm -f -v "$stage_name" >/dev/null 2>&1 || true
  if [ -d "$stage_dir/pgdata" ]; then
    # The data dir belongs to the container's postgres uid; remove it through a container (no sudo on the host).
    docker run --rm -v "$stage_dir:/stage" --entrypoint sh "$stage_image" -c 'rm -rf /stage/pgdata' \
      || pp_die "could not remove $stage_dir/pgdata; remove it by hand (sudo rm -rf) and report it"
  fi
  rm -f "$(stage_pw_file)" "$stage_dir/stage.env"
  [ ! -e "$stage_dir/pgdata" ] || pp_die "$stage_dir/pgdata still exists"
  pp_log "THROWAWAY DESTROYED: container $stage_name and $stage_dir/pgdata removed"
}

cmd_wipe_dump() {
  local d="" g="" missing_ok=0 a gone=0
  for a in "$@"; do
    case "$a" in
      --missing-ok) missing_ok=1 ;;
      -*) pp_die "wipe-dump: unknown option $a" 2 ;;
      *) if [ -z "$d" ]; then d="$a"; elif [ -z "$g" ]; then g="$a"; else pp_die "wipe-dump DIR [FILE.gpg] [--missing-ok]" 2; fi ;;
    esac
  done
  [ -n "$d" ] || pp_die "wipe-dump DIR [FILE.gpg] [--missing-ok]" 2
  pp_assert_outside_repo "$d"
  [ -z "$g" ] || pp_assert_outside_repo "$g"
  # Deleting something that is not there is not a deletion: without --missing-ok (the STOP block of the night card)
  # a wrong path must not print DUMP COPIES DELETED.
  if [ "$missing_ok" = 0 ]; then
    [ -d "$d" ] || pp_die "wipe-dump: $d does not exist: nothing was deleted (wrong path? use --missing-ok only in the STOP block)" 3
    [ -z "$g" ] || [ -f "$g" ] || pp_die "wipe-dump: $g does not exist: nothing was deleted (wrong path? use --missing-ok only in the STOP block)" 3
  fi
  [ -d "$d" ] || [ -f "$g" ] || gone=1
  if [ -d "$d" ]; then
    [ -f "$d/manifest.json" ] || pp_die "$d has no manifest.json: refusing to delete a directory that is not a dump" 2
    # Overwrite then delete (as dump:wipe does). On SSDs and copy-on-write disks only the encrypted volume truly
    # protects the data; this still removes every readable copy.
    find "$d" -type f -exec shred -u -n 1 -z {} + 2>/dev/null || find "$d" -type f -delete
    rm -rf -- "$d"
  fi
  if [ -n "$g" ] && [ -f "$g" ]; then shred -u -n 1 -z "$g" 2>/dev/null || rm -f -- "$g"; fi
  { [ ! -e "$d" ] && { [ -z "$g" ] || [ ! -e "$g" ]; }; } || pp_die "something was not deleted"
  if [ "$gone" = 1 ]; then pp_log "DUMP COPIES NOT PRESENT (nothing to delete; --missing-ok): $(basename "$d")${g:+ and $(basename "$g")}"; return 0; fi
  pp_log "DUMP COPIES DELETED: $(basename "$d")${g:+ and $(basename "$g")} (record it in the custody list, runbook 0 rule 4)"
}

cmd_etl() {
  local c="${1:-}"; [ $# -eq 0 ] || shift
  case "$c" in
    staging:profile|migrate:all|migrate:delta|migrate:verify|migrate:rollback|migrate:questions|migrate:link-questions|migrate:export-question-reports|migrate:archive-minimise) ;;
    *) pp_die "etl COMMAND: staging:profile | migrate:all | migrate:delta | migrate:verify | migrate:rollback | migrate:questions | migrate:link-questions | migrate:export-question-reports | migrate:archive-minimise (standalone migrate:core / migrate:activity take no source lock: use migrate:all / migrate:delta)" 2 ;;
  esac
  local a apply=0 envs=(NODE_ENV=production "PP_MIGRATE_TARGET_DB=$target_db") argv=() files_host="" files_seen=0 out_given=0 i=0
  local args=("$@")
  # --files-dir names a HOST folder; the container sees it as /files (read-only). --apply is spotted for the gates.
  while [ "$i" -lt "$#" ]; do
    a="${args[$i]}"
    case "$a" in
      --apply) apply=1; argv+=("$a") ;;
      --files-dir=*) files_seen=1; files_host="${a#--files-dir=}"; argv+=(--files-dir=/files) ;;
      --files-dir) files_seen=1; i=$((i + 1)); files_host="${args[$i]:-}"; argv+=(--files-dir /files) ;;
      --out-dir|--out-dir=*) out_given=1; argv+=("$a") ;;
      *) argv+=("$a") ;;
    esac
    i=$((i + 1))
  done
  # The rollback and the archive minimisation need the apply gate in every mode (their dry-run too: the code calls
  # assertApplyAllowed for both). The rollback also needs its own switch (cutover plan 6.3).
  [ "$apply" = 0 ] || refuse_synthetic_unless_scratch "etl $c --apply" target
  case "$c" in
    migrate:rollback) envs+=(PP_ALLOW_MIGRATE_ROLLBACK=1 PP_ALLOW_MIGRATE_APPLY=1) ;;
    migrate:archive-minimise) envs+=(PP_ALLOW_MIGRATE_APPLY=1) ;;
    *) [ "$apply" = 0 ] || envs+=(PP_ALLOW_MIGRATE_APPLY=1) ;;
  esac
  # Only the loads read staging_cloud; link-questions, archive-minimise and rollback must still run after the drop.
  case "$c" in
    migrate:all|migrate:delta)
      if [ "$apply" = 1 ]; then
        [ "$(target_psql "select count(*) from information_schema.schemata where schema_name = 'staging_cloud'")" = 1 ] \
          || pp_die "no staging_cloud in the target: run copy first" 3
      fi ;;
  esac
  [ "$c" != staging:profile ] || envs=(NODE_ENV=production)
  # The reports go to the mounted folder. The default of migrate:* is <repo root>/.migration-out = /app/.migration-out,
  # on the read-only root file system and not on the volume; staging:profile uses ./.migration-out of apps/api.
  if [ "$out_given" = 0 ] && [ "$c" != staging:profile ]; then argv+=(--out-dir /app/apps/api/.migration-out); fi
  RUN_EXTRA=()
  if [ "$files_seen" = 1 ]; then
    [ -n "$files_host" ] || pp_die "--files-dir needs a directory" 2
    [ -d "$files_host" ] || pp_die "--files-dir $files_host is not a directory on this host" 2
    files_host="$(readlink -f "$files_host")"
    pp_assert_outside_repo "$files_host"
    # The container user (PP_MIGRATE_UID) must be able to read the export; ppdeploy's umask makes it 700 by default.
    docker run --rm --user "$(pp_cfg PP_MIGRATE_UID 1000)" -v "$files_host:/files:ro" --entrypoint sh "$stage_image" -c 'test -r /files/SHA256SUMS' \
      || pp_die "uid $(pp_cfg PP_MIGRATE_UID 1000) cannot read $files_host/SHA256SUMS: sudo setfacl -R -m u:$(pp_cfg PP_MIGRATE_UID 1000):rX $files_host" 3
    RUN_EXTRA+=(-v "$files_host:/files:ro")
    if [ "$apply" = 1 ]; then
      # An apply copies the files into the v2 file storage = the volume of the api (cutover plan P5, FILE_STORAGE_DIR).
      local vol; vol="$(docker volume ls -q --filter label=com.docker.compose.volume=apifiles)"
      [ -n "$vol" ] && [ "$(wc -l <<<"$vol")" = 1 ] || pp_die "cannot find the api uploads volume (compose volume apifiles) exactly once: $(wc -l <<<"$vol") found" 3
      RUN_EXTRA+=(-v "$vol:/var/lib/pretasiplus/files")
      envs+=(FILE_STORAGE_DIR=/var/lib/pretasiplus/files)
    fi
  fi
  # P3 (F7): the migration role pp_etl comes from etl.env in migrate_run (DB-ROLES #227), so there is no optional file here.
  # #123 records etl_runs.git_sha; the image has no .git, so the release sha is passed explicitly (F14).
  if [ "$c" != staging:profile ]; then
    local sha; sha="$(pp_cfg PP_RELEASE_SHA "$(git -C "$PP_REPO" rev-parse HEAD 2>/dev/null || true)")"
    if [[ "$sha" =~ ^[0-9a-f]{40}$ ]]; then envs+=("PP_GIT_SHA=$sha")
    else
      case "$c" in
        migrate:all|migrate:delta) pp_die "cannot determine the release sha (set PP_RELEASE_SHA to the 40-character sha): etl_runs.git_sha would be NULL" 3 ;;
        *) pp_warn "no release sha (PP_RELEASE_SHA / git): PP_GIT_SHA not passed" ;;
      esac
    fi
  fi
  pp_lock "$(pp_cfg PP_LOCK_WAIT 1800)"
  local t0=$SECONDS rc=0
  pp_log "etl: $c ${argv[*]} (env: ${envs[*]})"
  migrate_run "${envs[@]}" -- npm run "$c" -w @pp/api -- ${argv[@]+"${argv[@]}"} || rc=$?
  pp_log "ETL STEP $c exit=$rc duration_s=$((SECONDS - t0)) (reports in $out_dir)"
  return "$rc"
}

cmd_gonogo() {
  local f age lsn arch failed last ready disk pct
  pp_log "GO/NO-GO EVIDENCE (infrastructure part, cutover plan section 5; counts and names only)"
  local scratch_nogo=0
  if scratch_host; then echo "host: PP_SCRATCH_HOST=yes in $PP_PROD_ENV (A4 scratch host)  -> NO-GO on production"; scratch_nogo=1
  else echo "host: not marked scratch ($PP_PROD_ENV)"; fi
  if synthetic_loaded; then echo "stage data: SYNTHETIC fixture loaded (scratch override)  -> NO-GO on production"; scratch_nogo=1; fi
  if target_synthetic; then echo "target data: SYNTHETIC copy in the target (scratch override)  -> NO-GO on production"; scratch_nogo=1; fi
  # Cutover plan A5 / criterion 8: each point must hold as many applied migrations as the release has folders.
  for f in pre_etl pre_delta; do
    if "$PP_VPS_DIR/migration/restore-point.sh" verify "$f" --expect-migrations repo >/dev/null 2>&1; then
      echo "criterion 8: restore point $f present, sha256 ok, migrations equal the release"
    else echo "criterion 8: restore point $f MISSING, damaged or older than the release migrations  -> NO-GO"; fi
  done
  arch="$(target_psql "show archive_mode")"
  if [ "$arch" = off ]; then echo "criterion 8: PITR off (archive_mode=off): restore points only  -> NO-GO at night (a written waiver of the LEAD is possible in daylight only)"
  else
    failed="$(target_psql "select failed_count from pg_stat_archiver")"
    last="$(target_psql "select coalesce(to_char(last_archived_time at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), 'never') from pg_stat_archiver")"
    lsn="$(target_psql "select coalesce(last_archived_wal, '-') from pg_stat_archiver")"
    echo "criterion 8: PITR on, last archived WAL $lsn at $last, failed_count $failed$([ "$failed" = 0 ] || echo '  -> check the archive before go')"
  fi
  echo "stage: $(schema_tables target_psql) in the target (expected archive_cloud:38 staging_cloud:89 while the slot runs)"
  f="$(find "$(pp_cfg PP_BACKUP_DIR /var/backups/pretasiplus)" -maxdepth 1 -name 'pp-backup-*.dump' -printf '%T@ %f\n' 2>/dev/null | sort -rn | head -n1)"
  if [ -n "$f" ]; then age=$(( ($(date +%s) - ${f%%.*}) / 3600 )); echo "backup: newest dump ${f#* } is ${age} h old$([ "$age" -le 24 ] || echo '  -> NO-GO (older than 24 h)')"; else echo "backup: NO dump found  -> NO-GO"; fi
  pct="$(df -P "$(pp_cfg PP_BACKUP_DIR /var/backups/pretasiplus)" | awk 'NR == 2 { gsub("%", "", $5); print $5 }')"
  disk=$((100 - pct)); echo "disk: ${disk}% free on the backup volume$([ "$disk" -gt 30 ] || echo '  -> NO-GO (needs > 30%)')"
  # Cutover plan 3.1 / B0: free space on the receiving folder must be at least 5 x the dump size (compare by hand).
  pct="$(df -P -BG "$stage_dir" 2>/dev/null | awk 'NR == 2 { gsub("G", "", $4); print $4 }' || true)"
  echo "stage disk: ${pct:-?} GiB free on $stage_dir (needs at least 5 x the dump size)"
  ready="$(_pp_curl_edge 443 https /api/ready -o /dev/null -w '%{http_code}' 2>/dev/null || true)"; ready="${ready:-000}"
  echo "api: /api/ready through the edge -> $ready"
  if stage_running; then echo "throwaway: $stage_name is STILL RUNNING  -> destroy it after the copy (throwaway-down)"; else echo "throwaway: none running"; fi
  # Not a go/no-go criterion: where the raw copy lives and when it must be gone (cutover plan section 7).
  echo "raw data: $("$PP_VPS_DIR/migration/restore-point.sh" raw-check 2>&1 | tail -n1 | sed 's/^[^]]*] //')"
  if [ -d "$out_dir" ] && [ "$(stat -c %u:%a "$out_dir" 2>/dev/null)" = "$(pp_cfg PP_MIGRATE_UID 1000):700" ]; then
    echo "reports: $out_dir ready (owner uid $(pp_cfg PP_MIGRATE_UID 1000), mode 700)"
  else echo "reports: $out_dir missing or wrong owner/mode  -> NO-GO (runbook section 1)"; fi
  # Last line: a gonogo that stopped half way (db down, set -e) never prints it, so a short output cannot pass as clean.
  if [ "$scratch_nogo" = 1 ]; then echo "gonogo: NO-GO (scratch host or synthetic stage data)"; exit 3; fi
  echo "gonogo: complete (every check above ran)"
}

case "$cmd" in
  throwaway-up) cmd_throwaway_up ;;
  load) cmd_load "$@" ;;
  copy) cmd_copy ;;
  throwaway-down) cmd_throwaway_down ;;
  wipe-dump) cmd_wipe_dump "$@" ;;
  etl) cmd_etl "$@" ;;
  gonogo) cmd_gonogo ;;
  *) pp_die "unknown command: $cmd (see --help)" 2 ;;
esac
