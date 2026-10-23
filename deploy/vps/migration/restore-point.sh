#!/usr/bin/env bash
# Named restore points for the 29-30 Oct production migration slot (MIG08-PREP). Runbook:
# docs/ops/production-migration-slot.md (section 3) and the cutover plan docs/ops/v2-cutover-plan.md (A4, A12, 6.3).
#
#   deploy/vps/migration/restore-point.sh take NAME [--operator "<name>"]
#   deploy/vps/migration/restore-point.sh list
#   deploy/vps/migration/restore-point.sh verify NAME [--expect-migrations N|repo]
#   deploy/vps/migration/restore-point.sh restore NAME [--yes]
#   deploy/vps/migration/restore-point.sh purge-raw --after post_drop [--yes]
#   deploy/vps/migration/restore-point.sh raw-check
#
# NAME is one of: pre_etl (A4, before any .cloud data reaches the server), pre_delta (A12, the verified T-1 state),
# post_switch (rollback after the switch: v2 writes stopped, kept for analysis), post_drop (after
# `drop schema staging_cloud`, the clean point the raw-data copies are deleted against).
#
# take    pg_dump -Fc of the WHOLE database (staging_cloud included: a restore of pre_delta must give the delta its
#         input back), streamed into <PP_BACKUP_DIR>/restore-points/<name>-<UTC>.dump, header and table-of-contents
#         checked, sha256 sidecar written, then one custody line appended to restore-points/custody.tsv:
#         created_utc, name, file, sha256, bytes, raw_data (yes when staging_cloud existed at dump time), wal_lsn, operator.
#         Restore points are NEVER copied off-site and are not touched by backup.sh retention.
# list    the custody file.
# verify  sha256 check plus pg_restore --list (table data present) of the newest point with that name.
# restore STOPS api and frontend, drops and recreates the database, pg_restore --exit-on-error of the newest point with
#         that name, then starts nothing: the operator checks counts and runs rollback.sh / deploy as the cutover plan
#         says. It asks the operator to type the database name (the LEAD's confirmation) unless --yes.
# purge-raw  deletes every restore point marked raw_data=yes that is OLDER than the newest verified post_drop point,
#         and records the deletion in custody.tsv (cutover plan section 7, due 6 Nov 2026). Asks for the database name.
# raw-check  raw .cloud data retention (no automatic expiry, so this is the reminder): lists the copies that may
#         still hold raw data: kept raw_data=yes restore points, schema staging_cloud in the production database, and
#         PITR base backups older than the newest post_drop point (their archived WAL replays the raw copy; all base
#         backups when there is no post_drop yet). Before PP_RAW_PURGE_BY (default 2026-11-06, cutover plan section 7)
#         it reports and exits 0; from that day on every remaining copy is a WARN line and it exits 1. backup.sh runs it
#         every night and alerts on exit 1; slot.sh gonogo and pitr.sh status print it.
#
# Every step holds the shared lock (PP_LOCK_FILE). Output: names, sizes, hashes and counts only, never row data.
set -Eeuo pipefail
umask 077
export PP_SCRIPT=restore-point
# shellcheck source-path=SCRIPTDIR
# shellcheck source=../lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

usage() { sed -n '2,35p' "${BASH_SOURCE[0]}"; }
cmd="${1:-}"; [ $# -eq 0 ] || shift
name=""; operator="${PP_OPERATOR:-}"; yes=0; after=""; expect=""
case "$cmd" in
  take|verify|restore) name="${1:-}"; [ $# -eq 0 ] || shift ;;
  list|purge-raw|raw-check) ;;
  -h|--help|help|'') usage; exit 0 ;;
  *) pp_die "unknown command: $cmd (take | list | verify | restore | purge-raw | raw-check)" 2 ;;
esac
while [ $# -gt 0 ]; do
  case "$1" in
    --operator) operator="${2:?--operator needs a value}"; shift 2 ;;
    --yes) yes=1; shift ;;
    --after) after="${2:?--after needs a value}"; shift 2 ;;
    --expect-migrations) expect="${2:?--expect-migrations needs N or repo}"; shift 2 ;;
    *) pp_die "unknown argument: $1" 2 ;;
  esac
done
case "$cmd" in
  take|verify|restore)
    case "$name" in pre_etl|pre_delta|post_switch|post_drop) ;; *) pp_die "NAME must be pre_etl, pre_delta, post_switch or post_drop" 2 ;; esac ;;
esac
[ -n "$operator" ] || operator="OPERATOR-NAME-TO-FILL-IN"
operator="${operator//[$'\t\r\n']/ }"   # one custody line per point

backup_dir="$(pp_cfg PP_BACKUP_DIR /var/backups/pretasiplus)"
pp_assert_outside_repo "$backup_dir"
rp_dir="$backup_dir/restore-points"
custody="$rp_dir/custody.tsv"

ensure_dir() {
  mkdir -p "$rp_dir"
  chmod 700 "$rp_dir"
  [ -f "$custody" ] || printf 'created_utc\tname\tfile\tsha256\tbytes\traw_data\twal_lsn\toperator\tstatus\n' >"$custody"
  chmod 600 "$custody"
}

# psql_target SQL -> one scalar from the production database, run inside the db container with its own POSTGRES_*.
psql_target() {
  # shellcheck disable=SC2016  # expands inside the container
  pp_db_exec sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -At -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' sh "$1"
}

# newest NAME -> path of the newest dump of that name that custody does not mark deleted (empty when none)
newest() {
  [ -f "$custody" ] || return 0
  awk -F'\t' -v n="$1" 'NR > 1 && $2 == n && $9 != "deleted" { f = $3 } END { if (f != "") print f }' "$custody"
}

confirm_db() { # confirm_db WHAT: the operator types the database name (the LEAD's confirmation)
  local db answer
  db="$(pp_env_value "$PP_ENV_DIR/db.env" POSTGRES_DB)"
  [ -n "$db" ] || pp_die "POSTGRES_DB not found in $PP_ENV_DIR/db.env"
  [ "$yes" = 1 ] && return 0
  [ -t 0 ] || pp_die "$1 needs the typed confirmation (run it in a terminal) or --yes after the LEAD's written go" 2
  printf '%s on database %s. Type the database name to confirm: ' "$1" "$db" >&2
  read -r answer
  [ "$answer" = "$db" ] || pp_die "confirmation did not match; nothing was changed" 2
}

check_dump() { # check_dump FILE: header + table of contents
  local f="$1" magic toc
  magic="$(head -c 5 "$f" | tr -d '\0')"
  [ "$magic" = PGDMP ] || pp_die "$(basename "$f") is not a PostgreSQL custom-format dump"
  toc="$(pp_db_exec pg_restore --list <"$f" | grep -c ' TABLE DATA ' || true)"
  [ "$toc" -gt 0 ] || pp_die "pg_restore --list shows no table data in $(basename "$f")"
  printf '%s' "$toc"
}

# migrations_in_dump FILE -> applied Prisma migrations inside the dump (finished, not rolled back). Cutover plan A5:
# a point with fewer migrations than the release fails the migration check on restore.
migrations_in_dump() {
  pp_db_exec pg_restore --data-only -t _prisma_migrations -f - <"$1" \
    | awk -F'\t' '/^COPY / { c = 1; next } /^\\\.$/ { c = 0 } c && $3 != "\\N" && $6 == "\\N" { n++ } END { print n + 0 }'
}

cmd_take() {
  ensure_dir
  pp_lock "$(pp_cfg PP_LOCK_WAIT 1800)"
  local stamp file partial raw lsn size sha toc t0=$SECONDS
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  file="$rp_dir/$name-$stamp.dump"
  partial="$file.partial"
  trap 'rm -f "$partial"' EXIT
  raw="$(psql_target "select case when exists (select 1 from information_schema.schemata where schema_name = 'staging_cloud') then 'yes' else 'no' end")"
  if [ "$name" = pre_etl ] && [ "$raw" = yes ]; then
    pp_die "pre_etl must hold no .cloud data, but schema staging_cloud exists: this is not the state before A5" 3
  fi
  if [ "$name" = post_drop ] && [ "$raw" = yes ]; then
    pp_die "post_drop is taken AFTER 'drop schema staging_cloud cascade'; staging_cloud still exists" 3
  fi
  # A PITR anchor: the WAL position of the point; with archiving on, the current segment is closed so it is archived.
  lsn="$(psql_target "select pg_current_wal_lsn()")"
  if [ "$(psql_target "show archive_mode")" != off ]; then psql_target "select pg_switch_wal()" >/dev/null; fi
  pp_log "restore point $name: dumping (raw_data=$raw, wal_lsn=$lsn)"
  # shellcheck disable=SC2016  # expands inside the container
  pp_db_exec sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner' >"$partial"
  toc="$(check_dump "$partial")"
  mv "$partial" "$file"
  trap - EXIT
  sha="$(sha256sum "$file" | cut -d' ' -f1)"
  size="$(stat -c %s "$file")"
  printf '%s  %s\n' "$sha" "$(basename "$file")" >"$file.sha256"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$name" "$file" "$sha" "$size" "$raw" "$lsn" "$operator" kept >>"$custody"
  pp_log "RESTORE POINT TAKEN: $name file=$(basename "$file") bytes=$size sha256=$sha tables_with_data=$toc raw_data=$raw wal_lsn=$lsn duration_s=$((SECONDS - t0))"
  [ "$raw" = no ] || pp_log "raw .cloud data inside: on the deletion list of the cutover plan section 7 (purge-raw after post_drop, by 6 Nov 2026)"
}

cmd_verify() {
  local f toc
  f="$(newest "$name")"
  { [ -n "$f" ] && [ -f "$f" ]; } || pp_die "no restore point named $name in $custody"
  (cd "$(dirname "$f")" && sha256sum -c --quiet "$(basename "$f").sha256") || pp_die "sha256 mismatch for $(basename "$f")"
  toc="$(check_dump "$f")"
  local mig want
  mig="$(migrations_in_dump "$f")"
  if [ -n "$expect" ]; then
    want="$expect"
    [ "$expect" != repo ] || want="$(find "$PP_REPO/apps/api/prisma/migrations" -mindepth 1 -maxdepth 1 -type d | wc -l)"
    [[ "$want" =~ ^[0-9]+$ ]] || pp_die "--expect-migrations needs a number or repo" 2
    [ "$mig" = "$want" ] || pp_die "MIGRATION CHECK FAILED: $name holds $mig applied migrations, the release has $want: take the point again after the final schema migrations" 3
  fi
  pp_log "RESTORE POINT OK: $name file=$(basename "$f") sha256 matches, $toc tables with data, migrations=$mig${expect:+ (equals the release: $want)}"
}

cmd_restore() {
  local f
  f="$(newest "$name")"
  { [ -n "$f" ] && [ -f "$f" ]; } || pp_die "no restore point named $name in $custody"
  (cd "$(dirname "$f")" && sha256sum -c --quiet "$(basename "$f").sha256") || pp_die "sha256 mismatch for $(basename "$f"); refusing to restore it"
  check_dump "$f" >/dev/null
  confirm_db "RESTORE of $name ($(basename "$f")): every write after it is lost"
  pp_lock 0
  local t0=$SECONDS
  pp_log "stopping api and frontend (the edge keeps answering 502 for /api)"
  pp_compose stop api frontend
  # shellcheck disable=SC2016  # expands inside the container
  pp_db_exec sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d postgres -c "drop database \"$POSTGRES_DB\" with (force)" -c "create database \"$POSTGRES_DB\""'
  # shellcheck disable=SC2016  # expands inside the container
  pp_db_exec sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' <"$f"
  pp_log "RESTORED: $name ($(basename "$f")) in $((SECONDS - t0)) s. api and frontend stay stopped: check the counts, then follow the cutover plan section 6.3 (rollback.sh / deploy.sh)."
}

cmd_list() {
  [ -f "$custody" ] || { pp_log "no restore points yet ($custody)"; return 0; }
  cat "$custody"
}

cmd_purge_raw() {
  [ "$after" = post_drop ] || pp_die "purge-raw needs --after post_drop (the clean point must exist first)" 2
  local anchor anchor_ts tmp n=0
  anchor="$(newest post_drop)"
  { [ -n "$anchor" ] && [ -f "$anchor" ]; } || pp_die "no post_drop restore point: take it after 'drop schema staging_cloud cascade' first" 3
  name=post_drop; cmd_verify
  [ "$(psql_target "select count(*) from information_schema.schemata where schema_name = 'staging_cloud'")" = 0 ] \
    || pp_die "staging_cloud still exists in the database; drop it first (cutover plan section 7)" 3
  anchor_ts="$(awk -F'\t' -v f="$anchor" '$3 == f { print $1 }' "$custody")"
  confirm_db "PURGE of every raw-data restore point older than post_drop ($anchor_ts)"
  pp_lock "$(pp_cfg PP_LOCK_WAIT 1800)"
  tmp="$(mktemp "$rp_dir/.custody.XXXXXX")"
  while IFS=$'\t' read -r created rname file sha bytes raw lsn op status; do
    if [ "$created" != created_utc ] && [ "$raw" = yes ] && [ "$status" != deleted ] && [[ "$created" < "$anchor_ts" ]]; then
      # Only a dump inside restore-points/ is deleted (custody.tsv is a text file a hand edit could change).
      case "$(readlink -m "$file")" in
        "$(readlink -m "$rp_dir")"/*.dump)
          rm -f -- "$file" "$file.sha256"
          status=deleted
          n=$((n + 1))
          pp_log "deleted raw-data restore point $rname ($(basename "$file"))" ;;
        *) pp_warn "custody names $file, outside $rp_dir: NOT deleted, left as $status; check custody.tsv by hand" ;;
      esac
    fi
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$created" "$rname" "$file" "$sha" "$bytes" "$raw" "$lsn" "$op" "$status" >>"$tmp"
  done <"$custody"
  mv "$tmp" "$custody"
  chmod 600 "$custody"
  pp_log "PURGE DONE: $n raw-data restore point(s) deleted; custody.tsv records them as deleted (date: $(date -u +%Y-%m-%d))"
}

cmd_raw_check() {
  local by today overdue=0 n=0 anchor="" stamp b schema bases_out raw_ever=0
  by="$(pp_cfg PP_RAW_PURGE_BY 2026-11-06)"
  [[ "$by" =~ ^20[0-9]{2}-[0-9]{2}-[0-9]{2}$ ]] || pp_die "PP_RAW_PURGE_BY must be YYYY-MM-DD" 2
  today="$(date -u +%Y-%m-%d)"
  [[ "$today" < "$by" ]] || overdue=1
  found() { # found TEXT: one copy that may still hold raw .cloud data
    n=$((n + 1))
    if [ "$overdue" = 1 ]; then pp_warn "RAW RETENTION OVERDUE (purge by $by): $1"; else pp_log "raw copy (purge by $by): $1"; fi
  }
  if [ -f "$custody" ]; then
    while IFS=$'\t' read -r created rname file _ _ raw _ _ status; do
      [ "$created" != created_utc ] && [ "$raw" = yes ] && [ "$status" != deleted ] && found "restore point $rname ($(basename "$file"))"
    done <"$custody"
    anchor="$(awk -F'\t' 'NR > 1 && $2 == "post_drop" && $9 != "deleted" { t = $1 } END { print t }' "$custody")"
    ! awk -F'\t' 'NR > 1 && $6 == "yes" { f = 1 } END { exit !f }' "$custody" || raw_ever=1
  fi
  schema="$(psql_target "select count(*) from information_schema.schemata where schema_name = 'staging_cloud'" 2>/dev/null || echo '?')"
  case "$schema" in 0) ;; 1) raw_ever=1; found "schema staging_cloud in the production database (drop it, cutover plan section 7)" ;; *) pp_warn "could not check schema staging_cloud (db down?)" ;; esac
  # PITR: a base backup older than the clean point needs WAL from the slot, so the archive still holds the raw copy.
  stamp="${anchor//[-:]/}"
  # Only once raw data has been on this host (a raw restore point was ever taken, or staging_cloud exists): routine
  # base backups from before the slot hold no .cloud data.
  # shellcheck disable=SC2016  # expands inside the container
  if [ "$raw_ever" = 1 ] && bases_out="$(pp_compose exec -T -u postgres db sh -c 'ls -1 /walarchive/base 2>/dev/null | grep -E "^20[0-9]{6}T[0-9]{6}Z$"' 2>/dev/null)"; then
    for b in $bases_out; do
      if [ -z "$stamp" ] || [[ "$b" < "$stamp" ]]; then
        found "PITR base backup $b and the archived WAL after it (pitr.sh cleanup --keep-from <a base taken after post_drop>)"
      fi
    done
  fi
  if [ "$n" = 0 ]; then pp_log "RAW CHECK OK: no copy of raw .cloud data found (restore points, staging_cloud, PITR base backups)"; return 0; fi
  if [ "$overdue" = 1 ]; then pp_log "RAW CHECK OVERDUE: $n copy(ies) past $by"; return 1; fi
  pp_log "RAW CHECK: $n copy(ies), due by $by"
}

case "$cmd" in
  take) cmd_take ;;
  list) cmd_list ;;
  verify) cmd_verify ;;
  restore) cmd_restore ;;
  purge-raw) cmd_purge_raw ;;
  raw-check) cmd_raw_check ;;
esac
