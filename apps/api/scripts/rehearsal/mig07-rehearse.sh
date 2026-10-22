#!/usr/bin/env bash
# MIG-07 rehearsal driver: runs the steps of docs/ops/rehearsal-db.md sections 4, 6 and 7 through
# deploy/rehearsal/rehearsal-db.sh with a timing and WAL record per step, and writes one log per step.
# It adds nothing to the environment: it only calls rehearsal-db.sh and the npm ETL scripts.
#
#   mig07-rehearse.sh full      up, reference seeds, load-dump, stage, snapshot pre_etl, core dry-run + apply,
#                               activity dry-run + apply, status          (needs MIG07_DUMP)
#   mig07-rehearse.sh rollback  restore-snapshot pre_etl, then core and activity dry-runs again
#   mig07-rehearse.sh delta     snapshot after_full, load-dump (delta), stage, core + activity
#                               dry-run and apply, twice (second pass = idempotency)   (needs MIG07_DELTA_DUMP)
#   mig07-rehearse.sh night     the go-live sitting, rehearsed alone (needs MIG07_DUMP and MIG07_AS_OF): reference seeds, no-user
#                               check, load-dump, stage, snapshot pre_etl (after the schema migrations), `migrate:all` dry-run,
#                               `migrate:all --apply`, `migrate:verify` (must exit 0). It never rolls back by itself: on a
#                               failed step it stops with the step name and the operator decides. Start it on a database that
#                               has been through `up` and has no pre_etl snapshot (after a rollback: `rehearsal-db.sh reset --yes`).
#                               If MIG07_CONTENT_OWNER is unset it first finds the content owner by a scout core apply on the
#                               staged data and restores pre_etl (the owner does not exist before the load).
#   mig07-rehearse.sh night-rollback
#                               restore-snapshot pre_etl --yes, then confirm: `ROLLBACK VERIFIED` in the restore log and every
#                               migrated table counted at 0 again. `migrate:verify` is NOT the check here (it exits 1 on an
#                               empty target).
#   mig07-rehearse.sh archive   optional, after `night`: Q9 export (migrate:export-question-reports), then
#                               `migrate:archive-minimise` dry-run and --apply with the AM-09 guards (PP_ALLOW_MIGRATE_APPLY,
#                               PP_MIGRATE_TARGET_DB, --confirm, --export-summary). The export CSVs hold reporter free text:
#                               they are deleted again at the end of the phase (the summary file stays).
#   mig07-rehearse.sh clean     delete this script's own step logs and timings (*.log, *.timings.tsv in MIG07_LOG_DIR),
#                               then remove the log dir if it is empty. Touches nothing else: the rehearsal databases,
#                               snapshots and the rest of the state dir belong to rehearsal-db.sh; tear those down with
#                               `deploy/rehearsal/rehearsal-db.sh down --yes` (run `clean` first if the log dir is under
#                               the state dir, because `down` removes the state dir). Logs of a real-data pass can carry
#                               row values from reject/error output: run `clean` within the 7-day retention window.
#
# Environment (names only; no secret is read or printed here):
#   PP_REHEARSAL_MODE=host, PP_REHEARSAL_ADMIN_URL, PP_REHEARSAL_STATE_DIR, PP_REHEARSAL_MIGRATE   as rehearsal-db.md
#   MIG07_DUMP          pp-staging-dump/1 directory (outside the repo, with its .sha256 sidecar or an inside SHA256SUMS,
#                       as rehearsal-db.sh load-dump expects; `night` checks both before it starts)
#   MIG07_DELTA_DUMP    the second dump (delta phase)
#   MIG07_LOG_DIR       where the step logs and timings.tsv go (outside the repo; default: $PP_REHEARSAL_STATE_DIR/mig07-logs)
#   MIG07_TAG           log file prefix, only A-Z a-z 0-9 _ . : - (default: the phase name)
#   MIG07_CONTENT_OWNER v2 admin user id for --content-owner (default: the lowest active v2 user with role admin, found after
#                       the core apply; `night`: a v2 user id, "none" = no --content-owner (content rows without an owner are
#                       rejected), or unset = scout, see `night`)
#   MIG07_AS_OF         YYYY-MM-DD given as --as-of (and --core-as-of for activity) on every ETL call (required by `night`); set it for the delta
#                       phase to the day of the first load (a different value rewrites rows)
#   MIG07_FILES_DIR     (night) export directory with SHA256SUMS, given to migrate:all as --files-dir; needs MIG07_STORAGE_DIR,
#                       the absolute path of the v2 file storage (exported as FILE_STORAGE_DIR), a different directory
#   MIG07_EXPORT_OUT    (archive) --out-dir of the export; must contain a ".migration-out" path component (default: the repo's)
#   MIG07_EXTRA_STAGES  extra npm scripts to run after activity, e.g. "migrate:verify" (dry-run/apply flags are NOT added)
# The target database (PP_REHEARSAL_DB, default pp_rehearsal) must be `pp_rehearsal` or `pp_rehearsal_<a-z0-9>`: a name outside
# that is refused (exit 2) before anything runs. `clean` only works on a log dir under PP_REHEARSAL_STATE_DIR or named mig07-logs.
# Exit code: non-zero as soon as one step fails. On failure only the step name, the exit code and the log path are printed.
set -euo pipefail
umask 077

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
RDB="$SCRIPT_DIR/../../../../deploy/rehearsal/rehearsal-db.sh" # AZ-30 script (half AZ), used as is
PHASE=${1:-}
usage() { awk 'NR > 1 { if (/^#/) print; else exit }' "${BASH_SOURCE[0]}"; }
[ -n "$PHASE" ] || { usage; exit 2; }
case "$PHASE" in help | -h | --help) usage; exit 0 ;; esac
: "${PP_REHEARSAL_STATE_DIR:?set PP_REHEARSAL_STATE_DIR (outside the repo)}"
LOG_DIR=${MIG07_LOG_DIR:-$PP_REHEARSAL_STATE_DIR/mig07-logs}
TAG=${MIG07_TAG:-$PHASE}
[[ $TAG =~ ^[A-Za-z0-9_.:-]+$ ]] || { echo "MIG07_TAG must match ^[A-Za-z0-9_.:-]+\$ (got an invalid value)" >&2; exit 2; }

# Stricter than rehearsal-db.sh, which defaults to pp_rehearsal, refuses only system databases and drops only what carries
# its comment marker `pp-rehearsal:v1`: this earlier check means PP_ALLOW_MIGRATE_APPLY=1 is never set for another database.
require_rehearsal_db() {
  local db=${PP_REHEARSAL_DB:-pp_rehearsal}
  [[ $db =~ ^pp_rehearsal(_[a-z0-9]+)?$ ]] || { echo "refusing: target database '$db' does not match ^pp_rehearsal(_[a-z0-9]+)?\$ (PP_REHEARSAL_DB)" >&2; exit 2; }
}

# clean: delete only this script's own files in the log dir (never recursive, never outside it), then rmdir if empty.
clean_logs() {
  local dir=$LOG_DIR state=${PP_REHEARSAL_STATE_DIR:?}
  case "$dir" in /*) ;; *) echo "refusing to clean: log dir must be an absolute path" >&2; exit 2 ;; esac
  dir=${dir%/}; state=${state%/}
  if [ -z "$dir" ] || [ "$dir" = / ] || [ -z "$state" ] || [ "$dir" = "$state" ] || [ "$dir" = "${HOME:-/nonexistent}" ]; then
    echo "refusing to clean: log dir '$dir' is empty, the root, the state dir or the home dir" >&2; exit 2
  fi
  case "$dir" in */../* | */..) echo "refusing to clean: log dir must not contain '..'" >&2; exit 2 ;; esac
  if [[ $dir != "$state"/* && $(basename "$dir") != mig07-logs ]]; then
    echo "refusing to clean: log dir must be under PP_REHEARSAL_STATE_DIR or be named mig07-logs" >&2; exit 2
  fi
  if [ ! -d "$dir" ] || [ -L "$dir" ]; then echo "nothing to clean: $dir is not a directory"; return 0; fi
  find "$dir" -maxdepth 1 -type f \( -name '*.log' -o -name '*.timings.tsv' \) -delete
  rmdir "$dir" 2>/dev/null || echo "kept $dir (it holds other files)"
  echo "cleaned: removed this script's logs from $dir"
}
if [ "$PHASE" = clean ]; then clean_logs; exit 0; fi

case "$PHASE" in
  full | rollback | delta | night | night-rollback | archive) require_rehearsal_db ;;
  *) echo "unknown phase: $PHASE (full | rollback | delta | night | night-rollback | archive | clean | help)" >&2; exit 2 ;;
esac
TSV="$LOG_DIR/$TAG.timings.tsv"

target_psql() { "$RDB" exec target -- bash -c 'psql "$DATABASE_URL" -Atq -c "$1"' _ "$1"; }

# step <name> <command...>: run, log to $LOG_DIR/$TAG.<name>.log, record seconds and WAL bytes written.
step() {
  local name=$1; shift
  local log="$LOG_DIR/$TAG.$name.log" lsn0 lsn1 t0 t1 rc=0 wal=-
  lsn0=$(target_psql 'select pg_current_wal_lsn()' 2>/dev/null || true)
  t0=$(date +%s.%N)
  "$@" >"$log" 2>&1 || rc=$?
  t1=$(date +%s.%N)
  lsn1=$(target_psql 'select pg_current_wal_lsn()' 2>/dev/null || true)
  if [ -n "$lsn0" ] && [ -n "$lsn1" ]; then
    wal=$(target_psql "select pg_wal_lsn_diff('$lsn1','$lsn0')::bigint" 2>/dev/null || echo -)
  fi
  printf '%s\t%s\t%s\t%s\n' "$name" "$(awk -v a="$t1" -v b="$t0" 'BEGIN { printf "%.1f", a - b }')" "$wal" "$rc" | tee -a "$TSV"
  # Only the name, the code and the path: a log of a real-data pass can hold row values, so it is never echoed here.
  [ "$rc" = 0 ] || { echo "step $name failed (exit $rc), log: $log" >&2; exit "$rc"; }
}

etl() { # etl <stage> <dry-run|apply> [extra flags]
  local stage=$1 mode=$2; shift 2
  if [ -n "${MIG07_AS_OF:-}" ]; then
    set -- "--as-of=$MIG07_AS_OF" "$@"
    [ "$stage" = migrate:activity ] && set -- "--core-as-of=$MIG07_AS_OF" "$@"
  fi
  if [ "$mode" = apply ]; then
    require_rehearsal_db
    PP_ALLOW_MIGRATE_APPLY=1 "$RDB" exec target -- npm run "$stage" -w @pp/api -- --apply "$@"
  else
    "$RDB" exec target -- npm run "$stage" -w @pp/api -- --dry-run "$@"
  fi
}

# The reference seeds the ETL expects on the target before migrate:core: the school_packages catalogue (migrate:core reads it
# for school subscriptions) and the other `kind: 'reference'` modules. They run in `NODE_ENV=production` on purpose: the seed
# runner then loads reference modules only and skips every demo module (demo accounts, demo curriculum, tiers), so no demo
# user can reach the target. `rehearsal-db.sh exec` forces NODE_ENV=development, hence the `env` override. The profile name is
# not `poc`. Curriculum (a demo-kind seed that cannot be selected alone) is not seeded: migrate:core loads the levels, subjects
# and chapters of the dump itself. Tier rows are not seeded by any seed (BE-11); migrate:activity rejects tiers without a v2 match.
seed_reference() {
  "$RDB" exec target -- env NODE_ENV=production npm run db:seed -w @pp/api -- --profile=migration
}

# After seed_reference the target must hold no user at all (so no demo account): the reference modules create none, and the
# demo accounts use @demo.test / @example.test addresses or no address (roster pupils). Prints a count, never a row.
assert_no_users() {
  local n
  n=$(target_psql 'select count(*) from users' 2>/dev/null || true)
  [[ $n =~ ^[0-9]+$ ]] || { echo "cannot count users on the target after seed-reference" >&2; exit 1; }
  [ "$n" -eq 0 ] || { echo "seed-reference left $n user(s) on the target (demo accounts?); expected 0" >&2; exit 1; }
  echo "assert: 0 users on the target after seed-reference"
}

content_owner() {
  if [ -n "${MIG07_CONTENT_OWNER:-}" ]; then printf '%s' "$MIG07_CONTENT_OWNER"; return; fi
  target_psql "select u.id from users u join user_roles r on r.user_id = u.id where r.role::text = 'admin' and u.is_active and not u.is_suspended order by u.id limit 1"
}

run_stages() { # run_stages <prefix>: core then activity, dry-run then apply
  local p=$1 owner
  step "$p-core-dry-run" etl migrate:core dry-run
  step "$p-core-apply" etl migrate:core apply
  owner=$(content_owner)
  [ -n "$owner" ] || { echo "no v2 admin user to use as --content-owner" >&2; exit 1; }
  step "$p-activity-dry-run" etl migrate:activity dry-run --content-owner "$owner"
  step "$p-activity-apply" etl migrate:activity apply --content-owner "$owner"
  local s
  for s in ${MIG07_EXTRA_STAGES:-}; do step "$p-$s" "$RDB" exec target -- npm run "$s" -w @pp/api; done
}

# ---- night / night-rollback / archive helpers
# The refusals below happen before any step runs (exit 2), so a wrong setting never costs a seed or a load.
check_dump() { # MIG07_DUMP: a directory, with its .sha256 sidecar or an inside SHA256SUMS (what rehearsal-db.sh load-dump checks)
  local d=${MIG07_DUMP:?set MIG07_DUMP}
  d=${d%/}
  [ -d "$d" ] || { echo "MIG07_DUMP must be a pp-staging-dump/1 directory" >&2; exit 2; }
  [ -f "$d.sha256" ] || [ -f "$d/SHA256SUMS" ] || { echo "MIG07_DUMP has no checksum: expected <dump>.sha256 next to it or SHA256SUMS inside it" >&2; exit 2; }
  [ -f "$d/manifest.json" ] || { echo "MIG07_DUMP has no manifest.json (not a pp-staging-dump/1 directory)" >&2; exit 2; }
}

check_night_env() {
  check_dump
  [[ ${MIG07_AS_OF:-} =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "night needs MIG07_AS_OF=YYYY-MM-DD (the sitting's date; the same on every call)" >&2; exit 2; }
  [[ ${MIG07_CONTENT_OWNER:-0} =~ ^([0-9]{1,18}|none)$ ]] || { echo "MIG07_CONTENT_OWNER must be a v2 user id (digits), none, or unset" >&2; exit 2; }
  if [ -n "${MIG07_FILES_DIR:-}" ]; then
    [[ $MIG07_FILES_DIR == /* && ${MIG07_STORAGE_DIR:-} == /* ]] || { echo "MIG07_FILES_DIR needs MIG07_STORAGE_DIR; both absolute paths" >&2; exit 2; }
    [ -d "$MIG07_FILES_DIR" ] || { echo "MIG07_FILES_DIR is not a directory" >&2; exit 2; }
  fi
}

# The snapshot name is fixed (pre_etl): the go-live rollback restores it. rehearsal-db.sh refuses a second snapshot of the same
# name, so a second `night` needs `rehearsal-db.sh reset --yes` first. Checked here so it is not found after the load and stage.
assert_no_pre_etl() {
  local out
  out=$("$RDB" status 2>/dev/null) || { echo "cannot read the rehearsal status (is the database up?)" >&2; exit 2; } # no `grep -q` on a pipe: pipefail + SIGPIPE
  if grep -qx '  database: pre_etl' <<<"$out"; then
    echo "a pre_etl snapshot already exists: run rehearsal-db.sh reset --yes (it also runs up) before a new night" >&2; exit 2
  fi
}

# migrate:all <dry-run|apply> with the flags of the AM-09 header. Output goes to the step log only.
NIGHT_OWNER=''
all_run() {
  local mode=$1; shift
  local -a flags=("--as-of=$MIG07_AS_OF") envs=(env)
  [ -z "$NIGHT_OWNER" ] || flags+=("--content-owner=$NIGHT_OWNER")
  if [ -n "${MIG07_FILES_DIR:-}" ]; then flags+=("--files-dir=$MIG07_FILES_DIR"); envs+=("FILE_STORAGE_DIR=$MIG07_STORAGE_DIR"); fi
  if [ "$mode" = apply ]; then require_rehearsal_db; envs+=(PP_ALLOW_MIGRATE_APPLY=1); fi
  "$RDB" exec target -- "${envs[@]}" npm run migrate:all -w @pp/api -- "--$mode" "${flags[@]}"
}

# The content owner must be an active v2 admin, and none exists before the load. Unset MIG07_CONTENT_OWNER: run core on the staged
# data, read the lowest active admin id (a surrogate id), and restore pre_etl. Ids are assigned in a fixed order, so the real run
# gets the same id for the same dump; a different dump can give another id.
find_owner() {
  case "${MIG07_CONTENT_OWNER:-}" in
    none) NIGHT_OWNER=''; echo "content owner: none (no --content-owner)"; return ;;
    [0-9]*) NIGHT_OWNER=$MIG07_CONTENT_OWNER; echo "content owner: id $NIGHT_OWNER (given)"; return ;;
  esac
  step scout-core-dry-run etl migrate:core dry-run
  step scout-core-apply etl migrate:core apply
  NIGHT_OWNER=$(content_owner)
  [[ $NIGHT_OWNER =~ ^[0-9]{1,18}$ ]] || { echo "scout found no active admin after the core apply: set MIG07_CONTENT_OWNER or none" >&2; exit 1; }
  echo "content owner: id $NIGHT_OWNER (scout; a surrogate id)"
  step scout-restore "$RDB" restore-snapshot pre_etl --yes
}

# After a pre_etl restore every table the ETL fills must hold 0 rows again. Prints table = count, never a value.
MIGRATED_TABLES=(users etl_id_map schools classrooms enrolments parent_links practice_sessions practice_answers coin_ledger wallets referral_codes)
rollback_empty_check() {
  local sql='' t line bad=0 seen=0
  for t in "${MIGRATED_TABLES[@]}"; do sql+="${sql:+ union all }select '$t', count(*) from public.$t"; done
  while IFS='|' read -r t line; do
    [ -n "$t" ] || continue
    echo "count $t = $line"
    seen=$((seen + 1))
    [ "$line" = 0 ] || bad=1
  done < <(target_psql "$sql")
  [ "$seen" -eq "${#MIGRATED_TABLES[@]}" ] || { echo "ROLLBACK CHECK FAILED: counted $seen of ${#MIGRATED_TABLES[@]} tables" >&2; return 1; }
  [ "$bad" = 0 ] || { echo "ROLLBACK CHECK FAILED: a migrated table is not empty after the restore" >&2; return 1; }
}

# Q9 export, then the minimise dry-run and apply. The export summary is the proof the minimise needs.
export_summary_path() { # export_summary_path <export log>
  local f
  f=$(sed -n 's/^summary: //p' "$1" | tail -1)
  [[ $(basename "$f") =~ ^question-reports-open-.+\.summary\.json$ && -f $f ]] || { echo "no export summary file named in $1" >&2; return 1; }
  printf '%s' "$f"
}
minimise() { # minimise <dry-run|apply> <summary>
  local mode=$1 summary=$2 db=${PP_REHEARSAL_DB:-pp_rehearsal}
  [ "$mode" != apply ] || require_rehearsal_db
  PP_ALLOW_MIGRATE_APPLY=1 PP_MIGRATE_TARGET_DB=$db "$RDB" exec target -- npm run migrate:archive-minimise -w @pp/api -- \
    "--$mode" "--confirm=$db" "--export-summary=$summary"
}
delete_export_csv() { # only the CSV files the export log names, only inside a .migration-out folder
  local log=$1 f n=0
  while IFS= read -r f; do
    if [[ $f == */.migration-out/* && $(basename "$f") =~ ^question-(reports|submissions)-open-.+\.csv$ && -f $f && ! -L $f ]]; then rm -f -- "$f"; n=$((n + 1)); fi
  done < <(sed -n -e 's/^reports csv: //p' -e 's/^submissions csv (metadata only): //p' "$log")
  echo "export CSV files deleted: $n"
}

# `night` refuses a wrong setting or an existing pre_etl before it touches this tag's log files and timings.
if [ "$PHASE" = night ]; then check_night_env; assert_no_pre_etl; fi
mkdir -p "$LOG_DIR"
: >"$TSV"

case "$PHASE" in
  full)
    : "${MIG07_DUMP:?set MIG07_DUMP}"
    step up "$RDB" up
    step seed-reference seed_reference
    assert_no_users
    step load-dump "$RDB" load-dump "$MIG07_DUMP"
    step stage "$RDB" stage
    step snapshot-pre_etl "$RDB" snapshot pre_etl
    run_stages full
    step status "$RDB" status
    ;;
  night)
    step seed-reference seed_reference
    assert_no_users
    step load-dump "$RDB" load-dump "${MIG07_DUMP%/}"
    step stage "$RDB" stage
    step snapshot-pre_etl "$RDB" snapshot pre_etl
    find_owner
    step all-dry-run all_run dry-run
    step all-apply all_run apply
    step verify "$RDB" exec target -- npm run migrate:verify -w @pp/api
    step status "$RDB" status
    echo "night: verify exit 0. Go/no-go is the operator's. To roll back: mig07-rehearse.sh night-rollback"
    ;;
  night-rollback)
    step restore-snapshot "$RDB" restore-snapshot pre_etl --yes
    grep -q 'ROLLBACK VERIFIED' "$LOG_DIR/$TAG.restore-snapshot.log" || { echo "ROLLBACK NOT CONFIRMED: no 'ROLLBACK VERIFIED' in $LOG_DIR/$TAG.restore-snapshot.log" >&2; exit 1; }
    echo "ROLLBACK VERIFIED (restore-snapshot row counts equal pre_etl)"
    rollback_empty_check || exit 1
    echo "migrated tables empty: ok"
    ;;
  archive)
    export_args=()
    [ -z "${MIG07_EXPORT_OUT:-}" ] || export_args=(--out-dir "$MIG07_EXPORT_OUT")
    step export "$RDB" exec target -- npm run migrate:export-question-reports -w @pp/api -- ${export_args[@]+"${export_args[@]}"}
    summary=$(export_summary_path "$LOG_DIR/$TAG.export.log") || exit 1
    step minimise-dry-run minimise dry-run "$summary"
    step minimise-apply minimise apply "$summary"
    delete_export_csv "$LOG_DIR/$TAG.export.log"
    ;;
  rollback)
    step restore-snapshot "$RDB" restore-snapshot pre_etl --yes
    step core-dry-run-after-rollback etl migrate:core dry-run
    # must be refused with exit 2 (no migrated users after the rollback); any other code fails the phase; the log is the evidence
    arc=0
    "$RDB" exec target -- npm run migrate:activity -w @pp/api -- --dry-run >"$LOG_DIR/$TAG.activity-dry-run-after-rollback.log" 2>&1 || arc=$?
    [ "$arc" -eq 2 ] || { echo "activity dry-run after rollback: exit $arc, expected 2 (preflight finds no migrated users), log: $LOG_DIR/$TAG.activity-dry-run-after-rollback.log" >&2; exit 1; }
    echo "activity dry-run after rollback: exit 2 (expected: preflight finds no migrated users)"
    ;;
  delta)
    : "${MIG07_DELTA_DUMP:?set MIG07_DELTA_DUMP}"
    step snapshot-after_full "$RDB" snapshot after_full
    step load-dump "$RDB" load-dump "$MIG07_DELTA_DUMP"
    step stage "$RDB" stage
    run_stages delta1
    run_stages delta2
    ;;
esac
echo "done: $PHASE (timings: $TSV)"
