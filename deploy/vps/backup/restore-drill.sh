#!/usr/bin/env bash
# Restore drill with evidence (AZ-09; BE-33 AC7 evidence format). Runbook: docs/ops/production-vps.md (section 9)
#
#   deploy/vps/backup/restore-drill.sh [--operator "<name>"] [--no-quiesce] [--evidence-dir DIR]
#
# What it does (the restore and the row-count comparison are done by scripts/db-restore-check.mjs, which this
# wraps; nothing is duplicated):
#   1. stops the api (the only writer: requests, job worker, sweeper) so the database is idle
#      (--no-quiesce skips this: only for a database nobody writes to, e.g. a rehearsal; on a live database
#      the comparison can report false mismatches)
#   2. takes a FRESH dump (backup.sh --tag drill --no-offsite --no-files)
#   3. node scripts/db-restore-check.mjs --file <that dump> --container <db container>: checks the sha256, restores
#      into the throw-away database <db>_restorecheck, compares the exact row count of every public table with the
#      live database, drops the throw-away database
#   4. starts the api again (also when a step failed)
#   5. writes the evidence file and prints it
# Needs Node 22 on the host (scripts/db-restore-check.mjs). The main database is only read; the script itself
# refuses any restore target that does not end in _restorecheck.
#
# Evidence file: <PP_BACKUP_DIR>/drill-evidence/restore-drill-<UTC stamp>.txt, fixed format "PP-RESTORE-DRILL-EVIDENCE v1".
set -Eeuo pipefail
umask 077
export PP_SCRIPT=restore-drill
# shellcheck source-path=SCRIPTDIR
# shellcheck source=../lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

operator="${PP_OPERATOR:-}"
quiesce=1
evidence_dir=""
while [ $# -gt 0 ]; do
  case "$1" in
    --operator) operator="${2:?--operator needs a value}"; shift 2 ;;
    --no-quiesce) quiesce=0; shift ;;
    --evidence-dir) evidence_dir="${2:?--evidence-dir needs a value}"; shift 2 ;;
    -h|--help) sed -n '2,24p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) pp_die "unknown argument: $1" 2 ;;
  esac
done
[ -n "$operator" ] || operator="OPERATOR-NAME-TO-FILL-IN"

command -v node >/dev/null || pp_die "node (22) is required on the host for scripts/db-restore-check.mjs"
backup_dir="$(pp_cfg PP_BACKUP_DIR /var/backups/pretasiplus)"
pp_assert_outside_repo "$backup_dir"
evidence_dir="${evidence_dir:-$backup_dir/drill-evidence}"
mkdir -p "$evidence_dir"
chmod 700 "$evidence_dir"

db_container="$(pp_compose ps -q db | head -n1)"
[ -n "$db_container" ] || pp_die "the db service is not running"

started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
evidence="$evidence_dir/restore-drill-$stamp.txt"
log="$(mktemp)"
t0=$SECONDS
quiesced="none"
result=FAIL
reason="not finished"
dump_name="-"; dump_sha="-"; dump_size="-"
tables="-"; migrations="-"; rows="-"; cmp="NOT RUN"

api_stopped=0
on_exit() {
  local rc=$?
  if [ "$api_stopped" = 1 ]; then
    pp_log "starting the api again"
    pp_compose start api >/dev/null || pp_alert "RESTORE DRILL: the api could NOT be started again. Start it by hand: docker compose start api"
  fi
  # shellcheck disable=SC2016  # the variables must expand inside the container
  pgv="$(pp_db_exec sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d postgres -At -c "show server_version"' 2>/dev/null | tr -d '\r' || true)"
  {
    echo "PP-RESTORE-DRILL-EVIDENCE v1"
    echo "timestamp_utc: $started"
    echo "dump_file: $dump_name"
    echo "dump_sha256: $dump_sha"
    echo "dump_size_bytes: $dump_size"
    echo "postgres_version: ${pgv:-unknown}"
    echo "tables_restored: $tables"
    echo "prisma_migrations_rows: $migrations"
    echo "rows_restored: $rows"
    echo "row_count_comparison: $cmp"
    echo "duration_seconds: $((SECONDS - t0))"
    echo "writers_quiesced: $quiesced"
    echo "result: $result"
    [ "$result" = PASS ] || echo "failure_reason: $reason"
    echo "operator: $operator"
  } >"$evidence"
  ln -sf "$(basename "$evidence")" "$evidence_dir/latest.txt"
  echo "---- evidence: $evidence ----"
  cat "$evidence"
  rm -f "$log"
  if [ "$result" != PASS ]; then
    # Fixed text only: the webhook is a third party; the reason (already filtered) stays in the evidence file.
    pp_alert "RESTORE DRILL FAILED. Details in the evidence file on the server: $evidence"
    exit "$([ "$rc" -ne 0 ] && echo "$rc" || echo 1)"
  fi
  exit 0
}
trap on_exit EXIT

# A leftover throw-away database from an earlier aborted run would make the check refuse; remove only that name.
# shellcheck disable=SC2016  # the variables must expand inside the container
pp_db_exec sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c "drop database if exists \"${POSTGRES_DB}_restorecheck\" with (force)"' >/dev/null

if [ "$quiesce" = 1 ]; then
  pp_log "stopping the api so the database is idle (users see an error page until it starts again)"
  pp_compose stop api >/dev/null
  api_stopped=1
  quiesced="api stopped for the duration of the drill"
else
  quiesced="NO (row-count mismatches can be false alarms if the database was written to)"
fi

# Fresh dump, no off-site copy, no uploads archive: this is a database drill.
if ! out="$("$PP_VPS_DIR/backup/backup.sh" --tag drill --no-offsite --no-files)"; then
  reason="the fresh backup failed (see the backup log)"
  exit 1
fi
dump_path="$(sed -n 's/^BACKUP_FILE=//p' <<<"$out")"
[ -f "$dump_path" ] || { reason="backup.sh did not produce a dump"; exit 1; }
dump_name="$(basename "$dump_path")"
dump_sha="$(sed -n 's/^BACKUP_SHA256=//p' <<<"$out")"
dump_size="$(sed -n 's/^BACKUP_SIZE=//p' <<<"$out")"

pp_log "restoring $dump_name into the throw-away database"
check_rc=0
node "$PP_REPO/scripts/db-restore-check.mjs" --file "$dump_path" --container "$db_container" >"$log" 2>&1 || check_rc=$?
# Never echo row data: pg_restore errors can carry DETAIL / CONTEXT / "Key (...)" lines with values.
grep -vE 'DETAIL|CONTEXT|Key \(' "$log"

tables="$(sed -n 's/^public tables: //p' "$log" | head -n1)"
migrations="$(sed -n 's/^_prisma_migrations rows: //p' "$log" | head -n1)"
line="$(sed -n 's/^row-count comparison: //p' "$log" | head -n1)"
rows="$(sed -n 's/.*, \([0-9][0-9]*\) rows restored.*/\1/p' <<<"$line")"
tables="${tables:--}"; migrations="${migrations:--}"; rows="${rows:--}"
if [ "$check_rc" = 0 ] && grep -q '^ROW-COUNT COMPARISON PASSED' "$log" && grep -q '^RESTORE CHECK PASSED' "$log"; then
  cmp="PASS ($line)"
  result=PASS
  reason=""
else
  if [ -n "$line" ]; then cmp="FAIL ($line)"; fi
  reason="restore check failed (exit $check_rc): $(grep -E '^(ERROR|  )' "$log" | grep -vE 'DETAIL|CONTEXT|Key \(' | head -n 5 | tr '\n' ' ' | cut -c1-300)"
  exit 1
fi
