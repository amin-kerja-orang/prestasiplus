#!/usr/bin/env bash
# Point-in-time recovery (WAL archiving + base backups) for the production database (MIG08-PREP).
# Runbook: docs/ops/production-migration-slot.md (section 4).
#
#   deploy/vps/migration/pitr.sh status
#   deploy/vps/migration/pitr.sh base [--label NAME]
#   deploy/vps/migration/pitr.sh restore-test --target-time "YYYY-MM-DD HH:MM:SS+00" [--base STAMP]
#   deploy/vps/migration/pitr.sh cleanup --keep-from STAMP [--yes]
#
# How it works. compose.prod.yaml starts Postgres with archive_mode=$PP_PG_ARCHIVE_MODE (on in production) and an
# archive_command that gzips every finished WAL segment into /walarchive/wal (the host folder PP_WAL_ARCHIVE_DIR,
# owner uid 70 = postgres in the alpine image, mode 700, on the encrypted backup volume). A base backup
# (pg_basebackup -Ft -z, WAL from the archive) goes to /walarchive/base/<STAMP>/. A base backup plus every archived
# segment after it can be replayed to any moment after the base backup finished.
#
# status        archive_mode, archive_timeout, pg_stat_archiver (archived count, last segment and time, failures),
#               archive size, base backups, and restore-point.sh raw-check (raw .cloud data still on the host).
# base          a new base backup (label NAME, default "base"). Needs archive_mode=on. Holds the shared lock.
# restore-test  proves the archive: extracts a base backup (newest, or STAMP) into a SCRATCH container (never the
#               production data dir), replays WAL up to --target-time, promotes, prints the number of applied Prisma
#               migrations and public tables, and destroys the scratch container and its folder. A real PITR restore of
#               production is a LEAD decision and follows the same steps by hand (runbook section 4).
# cleanup       deletes every base backup older than STAMP and every archived WAL segment older than that base backup
#               needs (pg_archivecleanup). Used at the migration clean-up (cutover plan section 7: WAL that held the
#               raw staging_cloud copy, due 6 Nov 2026) and for routine retention. Asks for the database name.
# shellcheck disable=SC2016  # file-wide: every single-quoted script runs INSIDE a container, where $1 and $POSTGRES_* expand
set -Eeuo pipefail
umask 077
export PP_SCRIPT=pitr
# shellcheck source-path=SCRIPTDIR
# shellcheck source=../lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

usage() { sed -n '2,27p' "${BASH_SOURCE[0]}"; }
cmd="${1:-}"; [ $# -eq 0 ] || shift
label=base; target=""; base=""; keep=""; yes=0
while [ $# -gt 0 ]; do
  case "$1" in
    --label) label="${2:?--label needs a value}"; shift 2 ;;
    --target-time) target="${2:?--target-time needs a value}"; shift 2 ;;
    --base) base="${2:?--base needs a value}"; shift 2 ;;
    --keep-from) keep="${2:?--keep-from needs a value}"; shift 2 ;;
    --yes) yes=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) pp_die "unknown argument: $1" 2 ;;
  esac
done
[[ "$label" =~ ^[a-z][a-z0-9_]{0,30}$ ]] || pp_die "--label: lowercase letters, digits and _" 2
# A STAMP names a folder under /walarchive/base: only the exact shape, so "../x" can never pass the test -d checks.
for v in "$base" "$keep"; do
  [ -z "$v" ] || [[ "$v" =~ ^20[0-9]{6}T[0-9]{6}Z$ ]] || pp_die "--base / --keep-from must be a STAMP like 20261030T010000Z" 2
done
wal_dir="$(pp_cfg PP_WAL_ARCHIVE_DIR /var/backups/pretasiplus/wal)"
pp_assert_outside_repo "$wal_dir"

psql_target() {
  # shellcheck disable=SC2016  # expands inside the container
  pp_db_exec sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -At -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' sh "$1"
}
# The archive folder belongs to uid 70 (postgres in the container) with mode 700, so it is read and changed through
# the db container, which mounts it at /walarchive. walsh SCRIPT [ARGS...] runs SCRIPT there as postgres.
walsh() { local c="$1"; shift; pp_compose exec -T -u postgres db sh -c "$c" sh "$@"; }
bases() { walsh 'ls -1 /walarchive/base 2>/dev/null | grep -E "^20[0-9]{6}T[0-9]{6}Z$" | LC_ALL=C sort' || true; }

cmd_status() {
  pp_log "archive_mode=$(psql_target 'show archive_mode') archive_timeout=$(psql_target 'show archive_timeout') wal_level=$(psql_target 'show wal_level')"
  pp_log "archiver: $(psql_target "select 'archived ' || archived_count || ', last ' || coalesce(last_archived_wal, '-') || ' at ' || coalesce(to_char(last_archived_time at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'), 'never') || ' UTC, failed ' || failed_count || coalesce(', last failure ' || to_char(last_failed_time at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') || ' UTC', '') from pg_stat_archiver")"
  pp_log "archive on disk: $(walsh 'du -sh /walarchive/wal 2>/dev/null | cut -f1; ls -1 /walarchive/wal 2>/dev/null | grep -c "\.gz$"' | tr '\n' ' ')(size, segments); base backups: $(bases | tr '\n' ' ')"
  # Raw .cloud data retention (security review M1): the archive keeps the slot's WAL until cleanup.
  "$PP_VPS_DIR/migration/restore-point.sh" raw-check || true
}

cmd_base() {
  [ "$(psql_target 'show archive_mode')" != off ] || pp_die "archive_mode is off: set PP_PG_ARCHIVE_MODE=on in prod.env and redeploy (a db restart) first" 3
  pp_lock "$(pp_cfg PP_LOCK_WAIT 1800)"
  local stamp t0=$SECONDS
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  # Inside the container the archive is /walarchive. -X none: the WAL comes from the archive (checked by restore-test).
  # shellcheck disable=SC2016  # expands inside the container
  walsh 'mkdir -p "/walarchive/base/$1" && PGPASSWORD="$POSTGRES_PASSWORD" exec pg_basebackup -h 127.0.0.1 -U "$POSTGRES_USER" -D "/walarchive/base/$1" -Ft -z -X none -c fast --label "pp-$2-$1"' "$stamp" "$label"
  psql_target "select pg_switch_wal()" >/dev/null   # close the segment the backup ends in, so it is archived now
  pp_log "BASE BACKUP DONE: $stamp (label pp-$label-$stamp), $(walsh 'du -sh "/walarchive/base/$1" | cut -f1' "$stamp"), duration_s=$((SECONDS - t0))"
}

cmd_restore_test() {
  [ -n "$target" ] || pp_die "--target-time is required, for example \"2026-10-29 10:00:00+00\"" 2
  [[ "$target" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}\ [0-9]{2}:[0-9]{2}:[0-9]{2}(\+00|Z)?$ ]] || pp_die "--target-time must look like 2026-10-29 10:00:00+00 (UTC)" 2
  [ -n "$base" ] || base="$(bases | tail -n1)"
  { [ -n "$base" ] && walsh 'test -f "/walarchive/base/$1/base.tar.gz"' "$base"; } || pp_die "no base backup ${base:-found} in $wal_dir/base"
  local name="pp-pitr-test" scratch img t0=$SECONDS
  img="$(pp_cfg PP_STAGE_IMAGE postgres:16-alpine)"
  scratch="$(mktemp -d "$(pp_cfg PP_STAGE_DIR /srv/pretasiplus/stage)/pitr-test.XXXXXX")"
  docker rm -f "$name" >/dev/null 2>&1 || true
  # A failed extract or start must not leave the scratch copy (production data) on disk.
  # shellcheck disable=SC2064  # expand now: the trap must remove exactly this run's folder
  trap "docker rm -f '$name' >/dev/null 2>&1 || true; docker run --rm -v '$scratch:/scratch' --entrypoint sh '$img' -c 'rm -rf /scratch/data' >/dev/null 2>&1 || true; rmdir '$scratch' 2>/dev/null || true" EXIT
  # Extract, add the recovery settings, start: all inside a throw-away container that only READS the archive.
  # shellcheck disable=SC2016  # expands inside the container
  docker run --rm -v "$scratch:/scratch" -v "$wal_dir:/walarchive:ro" --entrypoint sh "$img" -c '
    set -e
    mkdir -p /scratch/data && tar -xzf "/walarchive/base/$1/base.tar.gz" -C /scratch/data
    touch /scratch/data/recovery.signal
    { echo "restore_command = '"'"'gunzip -c /walarchive/wal/%f.gz > %p'"'"'"
      echo "recovery_target_time = '"'"'$2'"'"'"
      echo "recovery_target_action = '"'"'promote'"'"'"
      echo "archive_mode = off"; } >> /scratch/data/postgresql.auto.conf
    chown -R 70:70 /scratch/data && chmod 700 /scratch/data' sh "$base" "$target"
  local dbu dbn
  dbu="$(pp_env_value "$PP_ENV_DIR/db.env" POSTGRES_USER)"; dbn="$(pp_env_value "$PP_ENV_DIR/db.env" POSTGRES_DB)"
  # No network, archive read-only, the copied pg_hba keeps local-socket trust from initdb: no password is needed.
  docker run -d --name "$name" --network none -e PGUSER="$dbu" -e PGDATABASE="$dbn" -e PGHOST=/var/run/postgresql \
    -v "$scratch/data:/var/lib/postgresql/data" -v "$wal_dir:/walarchive:ro" "$img" postgres >/dev/null
  local state="" out=""
  for _ in $(seq 1 120); do
    state="$(docker exec "$name" psql -X -At -c 'select pg_is_in_recovery()' 2>/dev/null || true)"
    [ "$state" = f ] && break
    sleep 2
  done
  if [ "$state" = f ]; then
    out="$(docker exec "$name" psql -X -At -c "select (select count(*) from information_schema.tables where table_schema = 'public') || ' public tables, ' || (select count(*) from public._prisma_migrations where finished_at is not null) || ' applied migrations'" 2>/dev/null || true)"
  fi
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker run --rm -v "$scratch:/scratch" --entrypoint sh "$img" -c 'rm -rf /scratch/data' >/dev/null 2>&1 || true
  rmdir "$scratch" 2>/dev/null || true
  trap - EXIT
  [ "$state" = f ] || pp_die "PITR TEST FAILED: the scratch server did not finish recovery to $target (base $base)"
  pp_log "PITR TEST PASSED: base $base replayed to $target and promoted in $((SECONDS - t0)) s; ${out:-no database listed}"
}

cmd_cleanup() {
  { [ -n "$keep" ] && walsh 'test -d "/walarchive/base/$1"' "$keep"; } || pp_die "--keep-from STAMP: an existing base backup (see status)" 2
  local db answer b backupfile n=0
  db="$(pp_env_value "$PP_ENV_DIR/db.env" POSTGRES_DB)"
  if [ "$yes" != 1 ]; then
    [ -t 0 ] || pp_die "cleanup needs the typed confirmation or --yes after the LEAD's written go" 2
    printf 'Delete every base backup before %s and the WAL it does not need, on database %s. Type the database name: ' "$keep" "$db" >&2
    read -r answer; [ "$answer" = "$db" ] || pp_die "confirmation did not match; nothing was deleted" 2
  fi
  pp_lock "$(pp_cfg PP_LOCK_WAIT 1800)"
  # The .backup history file that pg_basebackup left in the archive names the oldest segment this base needs.
  # shellcheck disable=SC2016  # expands inside the container
  backupfile="$(walsh 'for f in /walarchive/wal/*.backup.gz; do [ -e "$f" ] || continue; gunzip -c "$f" | grep -q "^LABEL: pp-[a-z0-9_]*-$1\$" && basename "$f" .gz; done' "$keep" | head -n1)"
  [ -n "$backupfile" ] || pp_die "no WAL history file for base $keep in the archive: refusing to guess which WAL is still needed" 3
  walsh 'pg_archivecleanup -x .gz /walarchive/wal "$1"' "$backupfile"
  for b in $(bases); do
    if [[ "$b" < "$keep" ]]; then
      walsh 'rm -rf "/walarchive/base/$1"' "$b"
      n=$((n + 1)); pp_log "deleted base backup $b"
    fi
  done
  pp_log "CLEANUP DONE: $n base backup(s) deleted, WAL before $backupfile removed (date $(date -u +%Y-%m-%d))"
}

case "$cmd" in
  status) cmd_status ;;
  base) cmd_base ;;
  restore-test) cmd_restore_test ;;
  cleanup) cmd_cleanup ;;
  -h|--help|help|'') usage ;;
  *) pp_die "unknown command: $cmd (status | base | restore-test | cleanup)" 2 ;;
esac
