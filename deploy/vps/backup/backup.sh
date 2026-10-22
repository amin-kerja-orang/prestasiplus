#!/usr/bin/env bash
# Nightly / pre-deploy backup of the production stack (AZ-09). Runbook: docs/ops/production-vps.md (section 9)
#
#   deploy/vps/backup/backup.sh [--tag daily|pre-deploy|drill] [--no-offsite] [--no-files]
#
# 1. pg_dump -Fc of the database, run INSIDE the db container with the container's own POSTGRES_* variables
#    (the same command as scripts/db-backup.mjs; the file names are compatible, so scripts/db-restore-check.mjs
#    reads these files). Streamed to a .partial file, header-checked, renamed, sha256 sidecar written.
# 2. pg_restore --list of the finished file (the table of contents must be readable).
# 3. The uploads volume (apifiles) as pp-files-<ts>.tar.gz + sha256 (PP_BACKUP_FILES: true = every run, weekly = only
#    on PP_BACKUP_WEEKLY_DAY (default), false = never; pre-deploy and drill runs never archive uploads).
# 4. Retention: daily dumps keep the newest PP_BACKUP_KEEP_DAILY, pre-deploy and drill dumps the newest
#    PP_BACKUP_KEEP_AUX, uploads archives the newest PP_BACKUP_KEEP_FILES; the dump of the weekday
#    PP_BACKUP_WEEKLY_DAY is also copied to weekly/ and the newest PP_BACKUP_KEEP_WEEKLY are kept there.
# 5. Off-site copy (offsite.sh) unless --no-offsite.
# 6. Dead man's switch: PP_HEALTHCHECK_PING_URL gets /start, then success or /fail.
# Exit status is non-zero on any failure; the systemd unit raises an alert for that.
set -euo pipefail
umask 077
export PP_SCRIPT=backup
# shellcheck source-path=SCRIPTDIR
# shellcheck source=../lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

tag=daily
offsite=1
files="$(pp_cfg PP_BACKUP_FILES weekly)"   # true = every run | weekly = on PP_BACKUP_WEEKLY_DAY only | false
while [ $# -gt 0 ]; do
  case "$1" in
    --tag) tag="${2:?--tag needs a value}"; shift 2 ;;
    --no-offsite) offsite=0; shift ;;
    --no-files) files=false; shift ;;
    -h|--help) sed -n '2,19p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) pp_die "unknown argument: $1" 2 ;;
  esac
done
case "$tag" in daily|pre-deploy|drill) ;; *) pp_die "--tag must be daily, pre-deploy or drill" 2 ;; esac

dir="$(pp_cfg PP_BACKUP_DIR /var/backups/pretasiplus)"
keep_daily="$(pp_cfg PP_BACKUP_KEEP_DAILY 7)"
keep_weekly="$(pp_cfg PP_BACKUP_KEEP_WEEKLY 4)"
keep_aux="$(pp_cfg PP_BACKUP_KEEP_AUX 5)"      # pre-deploy and drill dumps
keep_files="$(pp_cfg PP_BACKUP_KEEP_FILES 2)"  # uploads archives
weekly_day="$(pp_cfg PP_BACKUP_WEEKLY_DAY 7)"
ping_url="$(pp_cfg PP_HEALTHCHECK_PING_URL '')"
for n in "$keep_daily" "$keep_weekly" "$keep_aux" "$keep_files" "$weekly_day"; do
  case "$n" in ''|*[!0-9]*) pp_die "retention values must be integers" 2 ;; esac
done
[ "$keep_daily" -ge 1 ] || pp_die "PP_BACKUP_KEEP_DAILY must be at least 1" 2

pp_assert_outside_repo "$dir"
mkdir -p "$dir/weekly"
chmod 700 "$dir" "$dir/weekly"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
suffix=""
[ "$tag" = daily ] || suffix="-$tag"
name="pp-backup-${stamp}${suffix}.dump"
final="$dir/$name"
partial="$final.partial"
files_name="pp-files-${stamp}${suffix}.tar.gz"
finished=0
on_exit() {
  local rc=$?
  rm -f "$partial" "$dir/$files_name.partial"
  if [ "$finished" != 1 ] && [ "$rc" = 75 ]; then
    # pp_lock gave up: another operation (deploy, rollback, drill, certificate job) held the lock all along.
    pp_alert "BACKUP SKIPPED (tag $tag): the lock was busy for PP_LOCK_WAIT seconds (another operation running). No dump was taken this time."
    pp_ping "$ping_url" fail
  elif [ "$finished" != 1 ]; then
    pp_alert "BACKUP FAILED (tag $tag, exit $rc). See the journal / backup log. No new dump was kept."
    pp_ping "$ping_url" fail
  fi
  exit "$rc"
}
trap on_exit EXIT

# One operation at a time (deploy, rollback, drill, certificate jobs share the lock). deploy.sh and restore-drill.sh
# start this script while holding it (PP_LOCK_HELD=1), so they do not wait for themselves. A timer run waits.
pp_lock "$(pp_cfg PP_LOCK_WAIT 1800)"

pp_ping "$ping_url" start
pp_log "backup start: tag=$tag dir=$dir"

# ---- 1. dump ----
# Credentials come from the container environment; nothing secret is interpolated here.
# Schemas left out of every routine dump (PP_BACKUP_EXCLUDE_SCHEMAS, default staging_cloud): the raw .cloud copy that
# exists only during the migration slot must not spread into nightly, weekly and off-site copies (cutover plan
# section 7). The named restore points of deploy/vps/migration/restore-point.sh keep it on purpose, locally only.
excl="$(pp_cfg PP_BACKUP_EXCLUDE_SCHEMAS staging_cloud)"
[[ "$excl" =~ ^([a-z_][a-z0-9_]*(,[a-z_][a-z0-9_]*)*)?$|^-$ ]] || pp_die "PP_BACKUP_EXCLUDE_SCHEMAS: comma-separated lowercase schema names, or - for none" 2
[ "$excl" != - ] || excl=""
# shellcheck disable=SC2016  # the variables must expand INSIDE the container
pp_db_exec sh -c 'set -f; IFS=,; x=""; for s in $1; do x="$x --exclude-schema=$s"; done; unset IFS
  PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner $x' sh "$excl" \
  >"$partial"
size="$(stat -c %s "$partial")"
magic="$(head -c 5 "$partial" | tr -d '\0')"
if [ "$size" -lt 100 ] || [ "$magic" != "PGDMP" ]; then
  pp_die "output is not a PostgreSQL custom-format dump (size $size); discarded"
fi

# ---- 2. the table of contents must be readable ----
toc="$(pp_db_exec pg_restore --list <"$partial" | grep -c ' TABLE DATA ' || true)"
[ "$toc" -gt 0 ] || pp_die "pg_restore --list shows no table data; the dump is empty or damaged"

mv "$partial" "$final"
sha="$(sha256sum "$final" | cut -d' ' -f1)"
printf '%s  %s\n' "$sha" "$name" >"$final.sha256"
pp_log "dump ok: $name  $size bytes  sha256 $sha  ($toc tables with data; schemas left out: ${excl:-none})"

# ---- 3. uploads ----
produced=("$final" "$final.sha256")
[ "$tag" = daily ] || files=false
if [ "$files" = weekly ]; then
  if [ "$(date -u +%u)" = "$weekly_day" ]; then files=true; else files=false; fi
fi
if [ "$files" = true ]; then
  pp_compose exec -T api tar -C /var/lib/pretasiplus/files -czf - . >"$dir/$files_name.partial"
  mv "$dir/$files_name.partial" "$dir/$files_name"
  fsha="$(sha256sum "$dir/$files_name" | cut -d' ' -f1)"
  printf '%s  %s\n' "$fsha" "$files_name" >"$dir/$files_name.sha256"
  pp_log "uploads archive ok: $files_name  $(stat -c %s "$dir/$files_name") bytes"
  produced+=("$dir/$files_name" "$dir/$files_name.sha256")
fi

# ---- 4. retention ----
# prune DIR GLOB KEEP: delete all but the newest KEEP files matching GLOB (+ their .sha256). Names are generated
# by this script (timestamps), so sorting by name equals sorting by time.
prune() {
  local d="$1" glob="$2" n="$3" f i=0
  while IFS= read -r f; do
    i=$((i + 1))
    if [ "$i" -gt "$n" ]; then
      rm -f -- "$f" "$f.sha256"
      pp_log "retention: removed $(basename "$f")"
    fi
  done < <(find "$d" -maxdepth 1 -type f -name "$glob" ! -name '*.sha256' ! -name '*.partial' | sort -r)
}
if [ "$tag" = daily ]; then
  # Daily set = names without a tag suffix: pp-backup-<ts>Z.dump
  prune "$dir" 'pp-backup-????????T??????Z.dump' "$keep_daily"
  prune "$dir" 'pp-files-????????T??????Z.tar.gz' "$keep_files"
  if [ "$(date -u +%u)" = "$weekly_day" ]; then
    cp -p -- "$final" "$final.sha256" "$dir/weekly/"
    pp_log "weekly copy kept: $name"
  fi
  prune "$dir/weekly" 'pp-backup-*.dump' "$keep_weekly"
else
  prune "$dir" "pp-backup-*-$tag.dump" "$keep_aux"
  prune "$dir" "pp-files-*-$tag.tar.gz" "$keep_aux"
fi

# Erasure rule: nothing older than PP_BACKUP_MAX_AGE_DAYS (default 35) stays on this server. Runs only after a
# successful new backup, so a failing job can never age out the last good copy.
max_age="$(pp_cfg PP_BACKUP_MAX_AGE_DAYS 35)"
case "$max_age" in ''|*[!0-9]*) pp_die "PP_BACKUP_MAX_AGE_DAYS must be an integer" 2 ;; esac
if [ "$max_age" -gt 0 ]; then
  while IFS= read -r old; do
    rm -f -- "$old" "$old.sha256"
    pp_log "retention (max age ${max_age} d): removed $(basename "$old")"
  done < <(find "$dir" "$dir/weekly" -maxdepth 1 -type f \( -name 'pp-backup-*.dump' -o -name 'pp-files-*.tar.gz' \) -mtime "+$max_age")
fi

# ---- 5. off-site ----
if [ "$offsite" = 1 ]; then
  "$PP_VPS_DIR/backup/offsite.sh" "${produced[@]}"
else
  pp_log "off-site copy skipped (--no-offsite)"
fi

finished=1
pp_ping "$ping_url"
pp_log "backup done: $name"
printf 'BACKUP_FILE=%s\nBACKUP_SHA256=%s\nBACKUP_SIZE=%s\n' "$final" "$sha" "$size"
