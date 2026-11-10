#!/usr/bin/env bash
# Behaviour test of deploy/vps/rebuild-db.sh (guards G1 to G3 and G6, the C-2 stale files archive, the pass-2 gate), of the S-3 intake/ClamAV
# check (lib.sh pp_intake_av_problem) and of the verify allowlist pass-through of deploy/vps/migration/slot.sh etl (C-5).
# Plain bash with stub `docker` (and `hostname`) on PATH: no Docker daemon, no database, nothing on a real host is touched. Runs on Linux
# (flock, GNU coreutils); on Windows run it in the test container:
#   docker compose -p pp-ops -f deploy/test/compose.be-test.yaml run --rm --entrypoint bash runner /src/deploy/test/test-rebuild-db.sh
#   docker compose -p pp-ops -f deploy/test/compose.be-test.yaml down -v
# See docs/ops/be-tests-linux.md and docs/ops/r1-uat-deploy.md (section 8).
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
vps="$(cd "$here/../vps" && pwd)"
for c in flock sha256sum curl; do command -v "$c" >/dev/null || { echo "missing: $c" >&2; exit 2; }; done
w="$(mktemp -d)"; trap 'rm -rf "$w"' EXIT
mkdir -p "$w/env" "$w/bin" "$w/state" "$w/backup" "$w/out" "$w/dump" "$w/fx"
chmod 700 "$w/out"
DOCKER_LOG="$w/docker.log"; export DOCKER_LOG
SHA=0123456789abcdef0123456789abcdef01234567

# stub docker: logs every call; `compose ... ps -q db` answers a container id; clamav is running only with STUB_CLAMAV=1;
# `compose ... exec ... pg_restore --list` prints two TABLE DATA lines; every other psql answers STUB_PSQL (default 0).
cat >"$w/bin/docker" <<'STUB'
#!/bin/sh
echo "docker $*" >>"$DOCKER_LOG"
case "$1" in
  compose)
    all=" $* "
    case "$all" in
      *" ps -q --status running clamav "*) [ "${STUB_CLAMAV:-0}" = 1 ] && echo cid-clam; exit 0 ;;
      *" ps -q db "*|*" ps -aq api "*) echo cid-db; exit 0 ;;
      *" ps "*) exit 0 ;;
      *pg_restore*--list*) cat >/dev/null; printf '1; 1259 1 TABLE DATA public users x\n2; 1259 2 TABLE DATA public schools x\n'; exit 0 ;;
      *" exec "*) [ -t 0 ] || cat >/dev/null; echo "${STUB_PSQL:-0}"; exit 0 ;;
      *" run "*) exit 0 ;;
    esac
    exit 0 ;;
  volume) exit 0 ;;
  *) exit 0 ;;
esac
STUB
chmod +x "$w/bin/docker"

pass=0; fail=0
ok()  { pass=$((pass + 1)); echo "ok   $1"; }
bad() { fail=$((fail + 1)); echo "FAIL $1"; [ -z "${2:-}" ] || sed 's/^/     /' "$2" | tail -8; }

# mkprod KEY=VAL...: the prod.env FILE (the only place the scripts may read PP_DOMAIN, PP_ALLOW_DB_REBUILD, PP_SCRATCH_HOST from)
mkprod() {
  {
    printf '%s\n' "PP_DOMAIN=uat.example.test" "PP_ALLOW_DB_REBUILD=yes" "PP_SCRATCH_HOST=yes" "PP_STATE_DIR=$w/state" "PP_BACKUP_DIR=$w/backup" \
      "PP_MIGRATION_OUT=$w/out" "PP_RELEASE_SHA=$SHA" "PP_STAGE_EXPECT=archive_cloud:1 staging_cloud:1" "PP_REBUILD_MIN_FREE_GB=0" \
      "PP_LOCK_FILE=$w/lock" "PP_STAGE_DIR=$w/stage" "PP_MIGRATE_UID=$(id -u)"
    [ $# -eq 0 ] || printf '%s\n' "$@"
  } >"$w/env/prod.env"
}
# deliberately overriding keys: a later line of prod.env wins (pp_env_value takes the last one)
mkdb() { printf 'POSTGRES_DB=%s\n' "${1:-pp_uat}" >"$w/env/db.env"; }
mkmanifest() { printf '%s\n' "$1" >"$w/dump/manifest.json"; }
RAW='{"format": "pp-staging-dump/1", "raw": true}'
printf 'x\n' >"$w/env/api.env"; printf 'x\n' >"$w/env/etl.env"

# rb EXPECTED_EXIT TEXT [INPUT] -- ARGS...: rebuild-db.sh with the fixture env; EXTRA_ENV adds "K=V ..." to the process environment
rb() {
  local want="$1" text="$2" input="" rc=0 log="$w/log"
  shift 2
  if [ "$1" != -- ]; then input="$1"; shift; fi
  shift
  : >"$DOCKER_LOG"
  # shellcheck disable=SC2086
  if [ -n "$input" ]; then
    printf '%b' "$input" | env ${EXTRA_ENV:-} PATH="$w/bin:$PATH" PP_ENV_DIR="$w/env" PP_REBUILD_SKIP_PREFLIGHT=1 bash "$vps/rebuild-db.sh" "$@" >"$log" 2>&1 || rc=$?
  else
    env ${EXTRA_ENV:-} PATH="$w/bin:$PATH" PP_ENV_DIR="$w/env" PP_REBUILD_SKIP_PREFLIGHT=1 bash "$vps/rebuild-db.sh" "$@" </dev/null >"$log" 2>&1 || rc=$?
  fi
  [ "$want" != - ] || return 0   # no assertion: the caller inspects the log
  if [ "$rc" = "$want" ] && grep -qF -- "$text" "$log"; then ok "exit $rc: $text"; else bad "want exit $want + '$text', got exit $rc" "$log"; fi
}
dry=(--rebuild-db --dump-dir "$w/dump" --dry-run --tag t1)

echo "-- G1: --rebuild-db is required"
mkprod; mkdb; mkmanifest "$RAW"
rb 2 'pass --rebuild-db (G1)' -- --dump-dir "$w/dump" --dry-run
rb 2 'pass --rebuild-db (G1)' -- --restore-backup "$w/none"

echo "-- baseline: a clean dry run passes every guard and changes nothing"
rb 0 'DRY-RUN: all checks passed' -- "${dry[@]}"

echo "-- G2: PP_ALLOW_DB_REBUILD=yes must be in the prod.env FILE"
mkprod "PP_ALLOW_DB_REBUILD=no"; rb 3 'PP_ALLOW_DB_REBUILD=yes is not in' -- "${dry[@]}"
mkprod; EXTRA_ENV="PP_ALLOW_DB_REBUILD=yes"; sed -i '/PP_ALLOW_DB_REBUILD/d' "$w/env/prod.env"
rb 3 'PP_ALLOW_DB_REBUILD=yes is not in' -- "${dry[@]}"; EXTRA_ENV=""

echo "-- G3: domain deny list is case-insensitive, trimmed, and the environment cannot override the file"
for d in prestasiplus.cloud PRESTASIPLUS.CLOUD 'Www.PrestasiPlus.Cloud' 'prestasiplus.cloud.' '  prestasiplus.cloud  ' admin.prestasiplus.cloud PrestasiPlus.My; do
  mkprod; printf 'PP_DOMAIN=%s\n' "$d" >>"$w/env/prod.env"
  rb 3 'is on the deny list or unset (G3)' -- "${dry[@]}"
done
mkprod; printf 'PP_DOMAIN=prestasiplus.cloud\n' >>"$w/env/prod.env"
EXTRA_ENV="PP_DOMAIN=uat.example.test" rb 3 'is on the deny list or unset (G3)' -- "${dry[@]}"   # a harmless env value cannot unlock the file's production domain
mkprod; EXTRA_ENV="PP_DOMAIN=PRESTASIPLUS.CLOUD" rb 0 'domain                        : uat.example.test' -- "${dry[@]}"  # the env value is ignored: the file decides
mkprod "PP_REBUILD_DENY_DOMAINS=Other.Example.Test,uat.example.test"; rb 3 'PP_REBUILD_DENY_DOMAINS' -- "${dry[@]}"
mkprod; sed -i '/^PP_DOMAIN=/d' "$w/env/prod.env"; rb 3 'deny list or unset (G3)' -- "${dry[@]}"
echo "-- G3: database names"
mkprod
for n in prestasiplus_prod prestasi_plus pios_my postgres template1; do mkdb "$n"; rb 2 "refusing to touch the database '$n'" -- "${dry[@]}"; done
mkprod "PP_REBUILD_DENY_DBS=pp_uat"; mkdb pp_uat; rb 2 'PP_REBUILD_DENY_DBS' -- "${dry[@]}"
mkprod; mkdb pp_uat

echo "-- G6: a dump manifest that is anonymised or synthetic is refused (anonymised accounts all get the password Demo1234)"
for m in '{"format": "pp-staging-dump/1", "raw": true, "anonymised": true}' '{"format": "pp-staging-dump/1", "raw": true, "anonymised": "true"}' \
         '{"format": "pp-staging-dump/1", "raw": true, "synthetic": true}' '{"format": "pp-staging-dump/1", "raw": true, "anonymised": 1}' \
         '{"format":"pp-staging-dump/1","raw":true,"source":"cloud","anonymised":true,"tables":{}}'; do
  mkmanifest "$m"; rb 2 'marked anonymised or synthetic' -- "${dry[@]}"
done
mkmanifest '{"format": "pp-staging-dump/1", "raw": true, "anonymised": false}'; rb 0 'DRY-RUN: all checks passed' -- "${dry[@]}"
mkmanifest '{"format": "pp-staging-dump/1"}'; rb 2 'not marked raw' -- "${dry[@]}"
mkmanifest "$RAW"; : >"$w/dump/users.ndjson.partial"; rb 2 '.partial files' -- "${dry[@]}"; rm -f "$w/dump/users.ndjson.partial"

echo "-- C-2: a files archive from another run is refused by the restore, before anything is dropped"
dumpf="$w/backup/pp-backup-1-pre-rebuild.dump"; printf 'dump\n' >"$dumpf"; (cd "$w/backup" && sha256sum "$(basename "$dumpf")" >"$dumpf.sha256")
arch="$w/backup/pp-files-1-pre-rebuild.tar.gz"; printf 'tar\n' >"$arch"; (cd "$w/backup" && sha256sum "$(basename "$arch")" >"$arch.sha256")
printf '%s\n' "$dumpf" >"$w/state/rebuild-backup.path"
restore() { rb "$1" "$2" 'pp_uat\nuat.example.test\n' -- --rebuild-db --restore-backup "$dumpf" --tag t1; }
# archive of run A, backup of run B
printf '%s\n' "$arch" >"$w/state/rebuild-files-archive.path"; printf 'RUN_A\n' >"$w/state/rebuild-files-archive.run"; printf 'RUN_B\n' >"$w/state/rebuild-backup.run"
restore 3 'does not belong to the same run as the restore dump'
if grep -qE 'drop database| stop api' "$DOCKER_LOG"; then bad 'stale archive: something was dropped or stopped before the refusal'; else ok 'stale archive: nothing dropped, api not stopped'; fi
# an old-format archive path (no run sidecar at all)
rm -f "$w/state/rebuild-files-archive.run"; restore 3 'does not belong to the same run as the restore dump'
# same run id but rebuild-backup.path names another dump
printf 'RUN_B\n' >"$w/state/rebuild-files-archive.run"; printf '%s\n' "$w/backup/other.dump" >"$w/state/rebuild-backup.path"
restore 3 'does not belong to the same run as the restore dump'
# same run, same dump: the guard passes (the run then goes on to stop the api; what fails later in the stub world is not the subject)
printf '%s\n' "$dumpf" >"$w/state/rebuild-backup.path"
restore - ''
if grep -q 'does not belong' "$w/log"; then bad 'matching run: the archive was refused'; else ok 'matching run and dump: the archive is accepted by the guard'; fi
if grep -q ' stop api' "$DOCKER_LOG"; then ok 'matching run: the restore went on to stop the api'; else bad 'matching run: the restore did not proceed' "$w/log"; fi
# no archive recorded: the restore warns instead of refusing
rm -f "$w/state/rebuild-files-archive.path" "$w/state/rebuild-files-archive.run"
restore - ''
if grep -q 'does not belong' "$w/log"; then bad 'no archive: refused'; else ok 'no archive recorded: nothing to refuse'; fi

echo "-- C-2: every rebuild run removes an archive path left by an earlier run"
printf '%s\n' "$arch" >"$w/state/rebuild-files-archive.path"; printf 'RUN_OLD\n' >"$w/state/rebuild-files-archive.run"
# a real run (typed confirmation on the scratch host) reaches the removal before step 1; the stubbed backup then fails, which is fine here
rb - '' "pp_uat\nuat.example.test\n" -- --rebuild-db --dump-dir "$w/dump" --tag t1
if [ ! -e "$w/state/rebuild-files-archive.path" ] && [ ! -e "$w/state/rebuild-files-archive.run" ]; then ok 'a new run (keep or wipe policy) leaves no stale archive path'; else bad 'the stale archive path survived a new run' "$w/log"; fi

echo "-- pass-2 gate: the second ETL pass must change 0 rows (step_etl2)"
# source the part of rebuild-db.sh before its main section (functions and defaults), then call step_etl2 with stubbed data access
# (the harness sits next to a copy of lib.sh: the script sources lib.sh from its own folder)
mkdir -p "$w/h"; cp "$vps/lib.sh" "$w/h/lib.sh"
harness="$w/h/harness.sh"
{
  echo 'set -Eeuo pipefail'
  echo "set -- --rebuild-db --dump-dir $w/dump --dry-run --tag t1"
  sed -n '1,/^# main$/p' "$vps/rebuild-db.sh" | sed '1d'
  cat <<'H'
etl_pass() { :; }
su_scalar() { case "$2" in *"max(id)"*) echo 5 ;; *"sum("*) echo "${STUB_CHANGED:-0}" ;; *) echo 3 ;; esac; }
su_psql() { echo "5 papers inserted=1 updated=0"; }
( step_etl2 )
H
} >"$harness"
for ch in 0 3; do
  rc=0; env STUB_CHANGED=$ch PATH="$w/bin:$PATH" PP_ENV_DIR="$w/env" bash "$harness" >"$w/log" 2>&1 || rc=$?
  if [ "$ch" = 0 ]; then { [ "$rc" = 0 ] && grep -q 'rows inserted or updated: 0' "$w/log" && ok 'pass 2 with 0 changed rows passes'; } || bad "pass 2 with 0 changed rows: exit $rc" "$w/log"
  else { [ "$rc" = 3 ] && grep -q 'the second ETL pass changed 3 rows' "$w/log" && ok 'pass 2 that changed rows stops the run (exit 3)'; } || bad "pass 2 with 3 changed rows: exit $rc" "$w/log"; fi
done

echo "-- S-3: INTAKE_TEACHER_ENABLED on while ClamAV is not live is refused (lib.sh pp_intake_av_problem, deploy preflight G5)"
av() { # av EXPECTED_RC TEXT [runtime] : api.env content is in $w/env/api.env, profiles in prod.env
  local want="$1" text="$2" mode="${3:-}" out rc=0
  out="$(env PATH="$w/bin:$PATH" PP_ENV_DIR="$w/env" bash -c ". '$vps/lib.sh'; pp_intake_av_problem $mode" 2>&1)" || rc=$?
  if [ "$rc" = "$want" ] && [[ "$out" == *"$text"* ]]; then ok "intake-av rc $rc: ${text:-(silent)}"; else bad "intake-av want rc $want + '$text', got rc $rc: $out"; fi
}
mkprod
printf 'SESSION=x\n' >"$w/env/api.env";                                av 0 ''
printf 'INTAKE_TEACHER_ENABLED=false\n' >"$w/env/api.env";             av 0 ''
printf 'INTAKE_TEACHER_ENABLED=true\n' >"$w/env/api.env";              av 1 'clamav compose profile is not in PP_PROFILES'
printf 'INTAKE_TEACHER_ENABLED=TRUE\n' >"$w/env/api.env";              av 1 'would not be virus-scanned'
mkprod "PP_PROFILES=monitoring,clamav";                                av 1 'CLAMAV_HOST is not set'
printf 'INTAKE_TEACHER_ENABLED=true\nCLAMAV_HOST=clamav\n' >"$w/env/api.env"; av 0 ''
STUB_CLAMAV=0 av 1 'clamav container is not running' runtime
STUB_CLAMAV=1 av 0 '' runtime
# the marker: configuration complete but the build has no scan code (marker absent) must fail; present must pass
printf 'x\n' >"$w/schema-no-marker.ts"; printf 'CLAMAV_SCAN_ENABLED: z.enum([]),\n' >"$w/schema-marker.ts"
PP_AV_SCHEMA_FILE="$w/schema-no-marker.ts" av 1 'no upload scan code'
PP_AV_SCHEMA_FILE="$w/missing.ts" av 1 'no upload scan code'
PP_AV_SCHEMA_FILE="$w/schema-marker.ts" av 0 ''
grep -q 'CLAMAV_SCAN_ENABLED' "$vps/../../apps/api/src/common/config/env.schema.ts" && ok 'the real env schema declares the CLAMAV_SCAN_ENABLED marker' || bad 'env.schema.ts lacks the CLAMAV_SCAN_ENABLED marker'
grep -q 'pp_intake_av_problem' "$vps/deploy.sh" && ok 'deploy.sh preflight (G5) calls pp_intake_av_problem' || bad 'deploy.sh preflight does not call pp_intake_av_problem'
grep -q 'intake_av_check' "$vps/rebuild-db.sh" && ok 'rebuild-db.sh step 14 runs intake_av_check' || bad 'rebuild-db.sh step 14 does not run intake_av_check'
mkprod; printf 'x\n' >"$w/env/api.env"

echo "-- slot.sh etl: verify allowlist pass-through, apply refuses without staging_cloud"
printf '# comment\nquestions|INVALID_VALUE|options\n' >"$w/accept.txt"
slot() { # slot EXPECTED_EXIT TEXT ARGS...
  local want="$1" text="$2" rc=0; shift 2
  : >"$DOCKER_LOG"
  # shellcheck disable=SC2086
  env ${EXTRA_ENV:-} PATH="$w/bin:$PATH" PP_ENV_DIR="$w/env" bash "$vps/migration/slot.sh" "$@" </dev/null >"$w/log" 2>&1 || rc=$?
  if [ "$rc" = "$want" ] && grep -qF -- "$text" "$w/log"; then ok "slot.sh exit $rc: $text"; else bad "slot.sh want exit $want + '$text', got exit $rc" "$w/log"; fi
}
mkprod; mkdb pp_uat
slot 0 'ETL STEP migrate:verify exit=0' etl migrate:verify
if grep -q 'PP_VERIFY_ACCEPT_REJECTS' "$DOCKER_LOG"; then bad 'verify without an allowlist got the variable anyway'; else ok 'no allowlist configured: nothing passed to the container'; fi
EXTRA_ENV="PP_VERIFY_ACCEPT_REJECTS=exam_questions|INVALID_VALUE|stem"
slot 0 'ETL STEP migrate:verify exit=0' etl migrate:verify
if grep -qF -e '-e PP_VERIFY_ACCEPT_REJECTS=exam_questions|INVALID_VALUE|stem' "$DOCKER_LOG"; then ok 'PP_VERIFY_ACCEPT_REJECTS reaches the migrate container'; else bad 'PP_VERIFY_ACCEPT_REJECTS not passed' "$DOCKER_LOG"; fi
EXTRA_ENV="PP_VERIFY_ACCEPT_REJECTS_FILE=$w/accept.txt"
slot 0 'ETL STEP migrate:verify exit=0' etl migrate:verify
if grep -qF -e "-v $w/accept.txt:/accept-rejects.txt:ro" "$DOCKER_LOG" && grep -qF -e '-e PP_VERIFY_ACCEPT_REJECTS_FILE=/accept-rejects.txt' "$DOCKER_LOG"; then ok 'PP_VERIFY_ACCEPT_REJECTS_FILE is mounted read-only and named'; else bad 'allowlist file not mounted' "$DOCKER_LOG"; fi
EXTRA_ENV="PP_VERIFY_ACCEPT_REJECTS_FILE=$w/missing.txt"; slot 2 'is not a file' etl migrate:verify
EXTRA_ENV="PP_VERIFY_ACCEPT_REJECTS=a|b|c"
slot 0 'ETL STEP migrate:questions exit=0' etl migrate:questions --plan
if grep -q 'PP_VERIFY_ACCEPT_REJECTS' "$DOCKER_LOG"; then bad 'the allowlist leaked into another command'; else ok 'the allowlist is passed to migrate:verify only'; fi
EXTRA_ENV=""
STUB_PSQL=0 slot 3 'no staging_cloud in the target' etl migrate:all --apply --as-of=2026-11-10
slot 2 'etl COMMAND' etl migrate:nothing

echo
echo "passed $pass, failed $fail"
[ "$fail" = 0 ]
