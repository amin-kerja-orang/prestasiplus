#!/usr/bin/env bash
# Production migration slot on the VPS, 29-30 Oct (MIG08-PREP). Runbook: docs/ops/production-migration-slot.md.
# The cutover plan (docs/ops/v2-cutover-plan.md, half AM) owns WHAT runs WHEN; this script is HOW it runs on this host.
#
#   deploy/vps/migration/slot.sh throwaway-up                         A4 / B0: the throwaway staging cluster
#   deploy/vps/migration/slot.sh load --from DIR                      A5 / B4: staging:load of a RAW dump into it
#   deploy/vps/migration/slot.sh copy                                 A5 / B5: staging_cloud + archive_cloud -> target
#   deploy/vps/migration/slot.sh throwaway-down                       A5 / B5: destroy the cluster and its data dir
#   deploy/vps/migration/slot.sh wipe-dump DIR [FILE.gpg]             after a good load: delete the raw dump copies
#   deploy/vps/migration/slot.sh etl COMMAND [ARGS...]                A6-A11, B6-B8: staging:profile / migrate:* in the
#                                                                     migrate image, production guards set per run
#   deploy/vps/migration/slot.sh gonogo                               evidence lines for the go/no-go (infra part)
#
# This is the PRODUCTION path for REAL (not anonymised) data. It is separate from deploy/rehearsal/rehearsal-db.sh
# (AZ-30), which stays limited to attested anonymised or synthetic dumps and NODE_ENV=development. Here:
#   - `load` refuses a dump that is NOT marked raw (manifest "raw": true from dump:cloud), or is marked anonymised or
#     synthetic, or carries a large_integers note (integers >= 2^53 would not survive JSON.parse);
#   - staging:load runs with NODE_ENV=development and PP_ALLOW_STAGING_RESET=1 against the THROWAWAY cluster only
#     (its database name ends in _staging; the loader refuses production by design);
#   - every migrate:* runs with NODE_ENV=production and PP_MIGRATE_TARGET_DB=<the production database>;
#     PP_ALLOW_MIGRATE_APPLY=1 is added only when --apply is on the command line, PP_ALLOW_MIGRATE_ROLLBACK=1 only for
#     migrate:rollback. Nothing is set permanently in api.env.
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

usage() { sed -n '2,32p' "${BASH_SOURCE[0]}"; }
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
# target_psql SQL -> scalar from the production database
target_psql() {
  # shellcheck disable=SC2016  # expands inside the container
  pp_db_exec sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -At -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' sh "$1"
}

schema_tables() { # schema_tables psql_fn -> "staging_cloud:N archive_cloud:M"
  "$1" "select string_agg(s || ':' || coalesce(n, 0), ' ' order by s) from (values ('archive_cloud'), ('staging_cloud')) v(s) left join (select table_schema, count(*) n from information_schema.tables where table_schema in ('staging_cloud', 'archive_cloud') group by 1) t on t.table_schema = v.s"
}

# migrate_run ENV_ARGS... -- COMMAND...: the migrate image, on the compose network, with the reports volume.
migrate_run() {
  local envs=()
  while [ "$1" != -- ]; do envs+=(-e "$1"); shift; done
  shift
  mkdir -p "$out_dir"
  chmod 700 "$out_dir"
  pp_compose run --rm --no-deps -T -v "$out_dir:/app/apps/api/.migration-out" "${envs[@]}" migrate "$@"
}

cmd_throwaway_up() {
  pp_lock "$(pp_cfg PP_LOCK_WAIT 1800)"
  ! stage_running || pp_die "the throwaway cluster $stage_name is already running; run throwaway-down first (it is created empty for every load)" 3
  docker rm -f "$stage_name" >/dev/null 2>&1 || true
  [ ! -e "$stage_dir/pgdata" ] || pp_die "$stage_dir/pgdata exists from an earlier run: run throwaway-down first" 3
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

manifest_check() { # manifest_check DIR: a raw pp-staging-dump/1 from dump:cloud, nothing else
  local d="$1" m="$1/manifest.json"
  [ -f "$m" ] || pp_die "$d has no manifest.json (expected a pp-staging-dump/1 directory from dump:cloud)" 2
  grep -Eq '"format"[[:space:]]*:[[:space:]]*"pp-staging-dump/1"' "$m" || pp_die "manifest.json is not format pp-staging-dump/1" 2
  grep -Eq '"raw"[[:space:]]*:[[:space:]]*true' "$m" || pp_die "the dump is not marked raw (\"raw\": true). Production loads only the dump:cloud output; anonymised and synthetic dumps belong to deploy/rehearsal/rehearsal-db.sh" 2
  if grep -Eq '"(anonymised|synthetic)"[[:space:]]*:[[:space:]]*true' "$m"; then
    pp_die "the dump is marked anonymised or synthetic: never loaded on the production path" 2
  fi
  if grep -Eq '"large_integers"[[:space:]]*:' "$m"; then
    pp_die "the manifest lists large_integers (values >= 2^53 would be changed by JSON.parse): stop and ask half AM (cutover plan, N1)" 2
  fi
  if find "$d" -maxdepth 1 -name '*.partial' | grep -q .; then pp_die "$d still holds .partial files: the export did not finish" 2; fi
}

cmd_load() {
  local from=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --from) from="${2:?--from needs a directory}"; shift 2 ;;
      *) pp_die "unknown argument: $1" 2 ;;
    esac
  done
  { [ -n "$from" ] && [ -d "$from" ]; } || pp_die "load --from DIR: the extracted raw dump directory" 2
  from="$(readlink -f "$from")"
  pp_assert_outside_repo "$from"
  manifest_check "$from"
  stage_running || pp_die "the throwaway cluster is not running: throwaway-up first" 3
  pp_lock "$(pp_cfg PP_LOCK_WAIT 1800)"
  local url t0=$SECONDS
  url="postgresql://pp_stage:$(cat "$(stage_pw_file)")@$stage_name:5432/$staging_db"
  pp_log "staging:load --from <raw dump> into $staging_db on $stage_name (NODE_ENV=development, PP_ALLOW_STAGING_RESET=1)"
  # DATABASE_URL carries the throwaway password; it goes through an env file of the run, not the command line.
  local envf; envf="$(mktemp "$stage_dir/.load.XXXXXX")"
  printf 'DATABASE_URL=%s\n' "$url" >"$envf"
  # shellcheck disable=SC2064
  trap "rm -f '$envf'" EXIT
  # CLOUD_SOURCE_URL must not be set (the loader takes --from OR a source URL); api.env does not carry it.
  pp_compose run --rm --no-deps -T --env-from-file "$envf" -v "$from:/dump:ro" \
    -e NODE_ENV=development -e PP_ALLOW_STAGING_RESET=1 \
    migrate npm run staging:load -w @pp/api -- --from /dump
  rm -f "$envf"; trap - EXIT
  pp_log "LOAD DONE: $(schema_tables stage_psql) in $staging_db, duration_s=$((SECONDS - t0))"
}

cmd_copy() {
  stage_running || pp_die "the throwaway cluster is not running" 3
  pp_lock "$(pp_cfg PP_LOCK_WAIT 1800)"
  local a b t0=$SECONDS
  a="$(schema_tables stage_psql)"
  case "$a" in *staging_cloud:0*) pp_die "staging_cloud is empty in $staging_db: run load first" 3 ;; esac
  pp_log "replacing staging_cloud and archive_cloud in the target with the copy from $staging_db"
  target_psql "drop schema if exists staging_cloud cascade" >/dev/null
  target_psql "drop schema if exists archive_cloud cascade" >/dev/null
  # shellcheck disable=SC2016  # both commands expand inside their containers
  docker exec -i "$stage_name" sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -n staging_cloud -n archive_cloud' \
    | pp_db_exec sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl --exit-on-error'
  b="$(schema_tables target_psql)"
  [ "$a" = "$b" ] || pp_die "STAGE COPY FAILED: $a in $staging_db, $b in the target"
  pp_log "STAGE COPY PASSED: $b (the cutover plan expects staging_cloud:83 and archive_cloud:35), duration_s=$((SECONDS - t0))"
  case "$b" in "archive_cloud:35 staging_cloud:83") ;; *) pp_warn "table counts differ from 83/35: report them to the half-AM operator before the next step" ;; esac
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
  local d="${1:-}" g="${2:-}"
  [ -n "$d" ] || pp_die "wipe-dump DIR [FILE.gpg]" 2
  pp_assert_outside_repo "$d"
  [ -z "$g" ] || pp_assert_outside_repo "$g"
  if [ -d "$d" ]; then
    [ -f "$d/manifest.json" ] || pp_die "$d has no manifest.json: refusing to delete a directory that is not a dump" 2
    # Overwrite then delete (as dump:wipe does). On SSDs and copy-on-write disks only the encrypted volume truly
    # protects the data; this still removes every readable copy.
    find "$d" -type f -exec shred -u -n 1 -z {} + 2>/dev/null || find "$d" -type f -delete
    rm -rf -- "$d"
  fi
  if [ -n "$g" ] && [ -f "$g" ]; then shred -u -n 1 -z "$g" 2>/dev/null || rm -f -- "$g"; fi
  { [ ! -e "$d" ] && { [ -z "$g" ] || [ ! -e "$g" ]; }; } || pp_die "something was not deleted"
  pp_log "DUMP COPIES DELETED: $(basename "$d")${g:+ and $(basename "$g")} (record it in the custody list, runbook 0 rule 4)"
}

cmd_etl() {
  local c="${1:-}"; [ $# -eq 0 ] || shift
  case "$c" in
    staging:profile|migrate:all|migrate:delta|migrate:verify|migrate:rollback|migrate:link-questions|migrate:export-question-reports) ;;
    *) pp_die "etl COMMAND: staging:profile | migrate:all | migrate:delta | migrate:verify | migrate:rollback | migrate:link-questions | migrate:export-question-reports (standalone migrate:core / migrate:activity take no source lock: use migrate:all / migrate:delta)" 2 ;;
  esac
  local a apply=0 envs=(NODE_ENV=production "PP_MIGRATE_TARGET_DB=$target_db")
  for a in "$@"; do [ "$a" != --apply ] || apply=1; done
  # The rollback needs both gates in every environment (cutover plan 6.3), its dry-run included.
  if [ "$c" = migrate:rollback ]; then envs+=(PP_ALLOW_MIGRATE_ROLLBACK=1 PP_ALLOW_MIGRATE_APPLY=1)
  elif [ "$apply" = 1 ]; then envs+=(PP_ALLOW_MIGRATE_APPLY=1); fi
  if [ "$apply" = 1 ] || [ "$c" = migrate:rollback ]; then
    [ "$(target_psql "select count(*) from information_schema.schemata where schema_name = 'staging_cloud'")" = 1 ] \
      || [ "$c" = migrate:rollback ] || pp_die "no staging_cloud in the target: run copy first" 3
  fi
  [ "$c" != staging:profile ] || envs=(NODE_ENV=production)
  pp_lock "$(pp_cfg PP_LOCK_WAIT 1800)"
  local t0=$SECONDS rc=0
  pp_log "etl: $c $* (env: ${envs[*]})"
  migrate_run "${envs[@]}" -- npm run "$c" -w @pp/api -- "$@" || rc=$?
  pp_log "ETL STEP $c exit=$rc duration_s=$((SECONDS - t0)) (reports in $out_dir)"
  return "$rc"
}

cmd_gonogo() {
  local f age lsn arch failed last ready disk pct
  pp_log "GO/NO-GO EVIDENCE (infrastructure part, cutover plan section 5; counts and names only)"
  for f in pre_etl pre_delta; do
    if "$PP_VPS_DIR/migration/restore-point.sh" verify "$f" >/dev/null 2>&1; then echo "criterion 8: restore point $f present, sha256 ok"
    else echo "criterion 8: restore point $f MISSING or damaged  -> NO-GO"; fi
  done
  arch="$(target_psql "show archive_mode")"
  if [ "$arch" = off ]; then echo "criterion 8: PITR off (archive_mode=off): restore points only  -> needs the LEAD's written waiver"
  else
    failed="$(target_psql "select failed_count from pg_stat_archiver")"
    last="$(target_psql "select coalesce(to_char(last_archived_time at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), 'never') from pg_stat_archiver")"
    lsn="$(target_psql "select coalesce(last_archived_wal, '-') from pg_stat_archiver")"
    echo "criterion 8: PITR on, last archived WAL $lsn at $last, failed_count $failed$([ "$failed" = 0 ] || echo '  -> check the archive before go')"
  fi
  echo "stage: $(schema_tables target_psql) in the target (expected archive_cloud:35 staging_cloud:83 while the slot runs)"
  f="$(find "$(pp_cfg PP_BACKUP_DIR /var/backups/pretasiplus)" -maxdepth 1 -name 'pp-backup-*.dump' -printf '%T@ %f\n' 2>/dev/null | sort -rn | head -n1)"
  if [ -n "$f" ]; then age=$(( ($(date +%s) - ${f%%.*}) / 3600 )); echo "backup: newest dump ${f#* } is ${age} h old"; else echo "backup: NO dump found  -> NO-GO"; fi
  pct="$(df -P "$(pp_cfg PP_BACKUP_DIR /var/backups/pretasiplus)" | awk 'NR == 2 { gsub("%", "", $5); print $5 }')"
  disk=$((100 - pct)); echo "disk: ${disk}% free on the backup volume$([ "$disk" -gt 30 ] || echo '  -> NO-GO (needs > 30%)')"
  ready="$(_pp_curl_edge 443 https /api/ready -o /dev/null -w '%{http_code}' 2>/dev/null || true)"; ready="${ready:-000}"
  echo "api: /api/ready through the edge -> $ready"
  if stage_running; then echo "throwaway: $stage_name is STILL RUNNING  -> destroy it after the copy (throwaway-down)"; else echo "throwaway: none running"; fi
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
