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
#   mig07-rehearse.sh clean     delete this script's own step logs and timings (*.log, *.timings.tsv in MIG07_LOG_DIR),
#                               then remove the log dir if it is empty. Touches nothing else: the rehearsal databases,
#                               snapshots and the rest of the state dir belong to rehearsal-db.sh; tear those down with
#                               `deploy/rehearsal/rehearsal-db.sh down --yes` (run `clean` first if the log dir is under
#                               the state dir, because `down` removes the state dir). Logs of a real-data pass can carry
#                               row values from reject/error output: run `clean` within the 7-day retention window.
#
# Environment (names only; no secret is read or printed here):
#   PP_REHEARSAL_MODE=host, PP_REHEARSAL_ADMIN_URL, PP_REHEARSAL_STATE_DIR, PP_REHEARSAL_MIGRATE   as rehearsal-db.md
#   MIG07_DUMP          pp-staging-dump/1 directory (outside the repo, with its .sha256 sidecar)
#   MIG07_DELTA_DUMP    the second dump (delta phase)
#   MIG07_LOG_DIR       where the step logs and timings.tsv go (outside the repo; default: $PP_REHEARSAL_STATE_DIR/mig07-logs)
#   MIG07_TAG           log file prefix, only A-Z a-z 0-9 _ . : - (default: the phase name)
#   MIG07_CONTENT_OWNER v2 admin user id for --content-owner (default: the lowest v2 user with role admin)
#   MIG07_AS_OF         YYYY-MM-DD given as --as-of (and --core-as-of for activity) on every ETL call; set it for the delta
#                       phase to the day of the first load (a different value rewrites rows)
#   MIG07_EXTRA_STAGES  extra npm scripts to run after activity, e.g. "migrate:verify" (dry-run/apply flags are NOT added)
# The target database (PP_REHEARSAL_DB, default pp_rehearsal) must be named pp_rehearsal*: a name outside that is refused
# (exit 2) before anything runs.
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
  [[ $db == pp_rehearsal* ]] || { echo "refusing: target database '$db' is not named pp_rehearsal* (PP_REHEARSAL_DB)" >&2; exit 2; }
}

# clean: delete only this script's own files in the log dir (never recursive, never outside it), then rmdir if empty.
clean_logs() {
  local dir=$LOG_DIR state=${PP_REHEARSAL_STATE_DIR:?}
  case "$dir" in /*) ;; *) echo "refusing to clean: log dir must be an absolute path" >&2; exit 2 ;; esac
  dir=${dir%/}; state=${state%/}
  if [ -z "$dir" ] || [ "$dir" = / ] || [ -z "$state" ] || [ "$dir" = "$state" ] || [ "$dir" = "${HOME:-/nonexistent}" ]; then
    echo "refusing to clean: log dir '$dir' is empty, the root, the state dir or the home dir" >&2; exit 2
  fi
  if [ ! -d "$dir" ] || [ -L "$dir" ]; then echo "nothing to clean: $dir is not a directory"; return 0; fi
  find "$dir" -maxdepth 1 -type f \( -name '*.log' -o -name '*.timings.tsv' \) -delete
  rmdir "$dir" 2>/dev/null || echo "kept $dir (it holds other files)"
  echo "cleaned: removed this script's logs from $dir"
}
if [ "$PHASE" = clean ]; then clean_logs; exit 0; fi

case "$PHASE" in
  full | rollback | delta) require_rehearsal_db ;;
  *) echo "unknown phase: $PHASE (full | rollback | delta | clean | help)" >&2; exit 2 ;;
esac
mkdir -p "$LOG_DIR"
TSV="$LOG_DIR/$TAG.timings.tsv"
: >"$TSV"

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
  target_psql "select u.id from users u join user_roles r on r.user_id = u.id where r.role::text = 'admin' order by u.id limit 1"
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
