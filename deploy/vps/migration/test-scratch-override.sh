#!/usr/bin/env bash
# Behaviour test of `slot.sh load --synthetic-scratch` (A4 Track S) with stubs (no Docker, no database). Proves:
#   - the production path is unchanged (a synthetic dump is still refused; a raw one still passes its checks);
#   - the override refuses everything except a top-level "synthetic": true fixture on a host whose prod.env FILE says
#     PP_SCRATCH_HOST=yes and PP_OFFSITE_KIND=none, with the host name typed in a terminal; variables set in the process
#     environment never count;
#   - a synthetic load leaves a marker: copy and etl --apply refuse it on a host that is not marked scratch, gonogo
#     prints the NO-GO lines and ends "gonogo: NO-GO" with exit 3, and the next throwaway-up clears it.
# The stub `docker` reports the throwaway cluster as running only when STUB_RUNNING=1.
#   deploy/vps/migration/test-scratch-override.sh
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for c in script python3 flock; do command -v "$c" >/dev/null || { echo "missing: $c" >&2; exit 2; }; done
w="$(mktemp -d)"; trap 'rm -rf "$w"' EXIT
mkdir -p "$w/env" "$w/bin" "$w/stage" "$w/out" "$w/fx" "$w/backup"
printf 'POSTGRES_DB=pp_test\n' >"$w/env/db.env"
# dummy role URLs (test-only values, not secrets) so db-roles.sh apply gets past its checks against the stub db
for r in app:api owner:migrate etl:etl; do
  printf 'DATABASE_URL=postgresql://pp_%s:test-only-%s-pw-000000000000000000@db:5432/pp_test\n' "${r%%:*}" "${r%%:*}" >"$w/env/${r#*:}.env"
done
printf 'x\n' >"$w/stage/stage.pw"
cat >"$w/bin/docker" <<'STUB'
#!/bin/sh
case "$1" in
  inspect) [ "${STUB_RUNNING:-0}" = 1 ] && echo true || echo false; exit 0 ;;
  exec) echo "archive_cloud:38 staging_cloud:89"; exit 0 ;;
  compose) for a in "$@"; do [ "$a" = staging:load ] && [ "${STUB_FAIL_LOAD:-0}" = 1 ] && exit 1; done
    # STUB_TARGET=ok|short: the target db service runs and its psql answers with the expected schema counts (ok, the
    # copy passes) or with fewer tables (short, the copy fails after the drop). Piped input (pg_dump, the db-roles SQL)
    # is read first, so the writer never gets SIGPIPE (exit 141).
    { [ -n "${STUB_TARGET:-}" ] || case "$*" in *pg_restore*) true ;; *) false ;; esac; } && { [ -t 0 ] || cat >/dev/null; }
    case "${STUB_TARGET:-}:$*" in
      ok:*" ps "*|short:*" ps "*) echo db1 ;;
      ok:*psql*) echo "archive_cloud:38 staging_cloud:89" ;;
      short:*psql*) echo "archive_cloud:38 staging_cloud:88" ;;
    esac; exit 0 ;;
  *) exit 0 ;;
esac
STUB
# STUB_SWAP=1: the manifest is swapped for a raw one while the prompt waits (hostname is called just before it)
cat >"$w/bin/hostname" <<STUB
#!/bin/sh
[ "\${STUB_SWAP:-0}" = 1 ] && printf '%s\\n' '{"format": "pp-staging-dump/1", "raw": true}' >"$w/fx/manifest.json"
echo scratch1
STUB
chmod +x "$w/bin/docker" "$w/bin/hostname"
pass=0; fail=0
manifest() { printf '%s\n' "$1" >"$w/fx/manifest.json"; }
prod() { printf '%s\n' "$@" >"$w/env/prod.env"; }
SYN='{"format": "pp-staging-dump/1", "synthetic": true}'
RAW='{"format": "pp-staging-dump/1", "raw": true}'
# run EXPECTED_EXIT EXPECTED_TEXT TTY_INPUT|-notty|-eof ARGS...   (EXTRA_ENV may add "KEY=VAL ..." to the command's env)
run() {
  local want="$1" text="$2" input="$3"; shift 3
  local cmd rc=0 log="$w/log"
  cmd="env -u PP_SCRATCH_HOST -u PP_OFFSITE_KIND ${EXTRA_ENV:-} PATH=$w/bin:$PATH PP_ENV_DIR=$w/env PP_STAGE_DIR=$w/stage PP_MIGRATION_OUT=$w/out PP_LOCK_FILE=$w/lock PP_BACKUP_DIR=$w/backup bash $here/slot.sh $*"
  if [ "$input" = -notty ]; then $cmd </dev/null >"$log" 2>&1 || rc=$?
  elif [ "$input" = -eof ]; then timeout 20 script -qec "$cmd" /dev/null </dev/null >"$log" 2>&1 || rc=$?
  else printf '%s\n' "$input" | script -qec "$cmd" /dev/null >"$log" 2>&1 || rc=$?; fi
  if [ "$rc" = "$want" ] && grep -qF -- "$text" "$log"; then pass=$((pass + 1)); echo "ok   exit $rc: $text"
  else fail=$((fail + 1)); echo "FAIL want exit $want + '$text', got exit $rc:"; sed 's/^/     /' "$log" | tail -8; fi
}
marker() { [ -e "$w/stage/SYNTHETIC-LOADED" ]; }
check() { if eval "$1"; then pass=$((pass + 1)); echo "ok   $2"; else fail=$((fail + 1)); echo "FAIL $2"; fi; }
SCR=(PP_SCRATCH_HOST=yes PP_OFFSITE_KIND=none)

echo "-- production path (no flag): unchanged"
manifest "$SYN"; prod "${SCR[@]}"
run 2 'the dump is not marked raw' -notty load --from "$w/fx"
manifest "$RAW"; prod
run 3 'throwaway cluster is not running' -notty load --from "$w/fx"

echo "-- host gates read the prod.env FILE only"
export STUB_RUNNING=1
manifest "$SYN"
prod;                                   run 2 'not marked scratch' scratch1 load --from "$w/fx" --synthetic-scratch
EXTRA_ENV="PP_SCRATCH_HOST=yes PP_OFFSITE_KIND=none" run 2 'not marked scratch' scratch1 load --from "$w/fx" --synthetic-scratch
prod PP_SCRATCH_HOST=yes PP_OFFSITE_KIND=s3; run 2 'no off-site backup' scratch1 load --from "$w/fx" --synthetic-scratch
EXTRA_ENV="PP_OFFSITE_KIND=none" run 2 'no off-site backup' scratch1 load --from "$w/fx" --synthetic-scratch

echo "-- stage_running is checked before the prompt"
prod "${SCR[@]}"; STUB_RUNNING=0 run 3 'throwaway cluster is not running' scratch1 load --from "$w/fx" --synthetic-scratch

echo "-- typed confirmation"
run 2 'needs the typed host name' -notty load --from "$w/fx" --synthetic-scratch
run 2 'confirmation did not match' prod-host load --from "$w/fx" --synthetic-scratch
# EOF at the prompt (N2): script(1) passes an empty stdin, so read gets end-of-file
run 2 'no confirmation was typed' -eof load --from "$w/fx" --synthetic-scratch
# the manifest changes while the prompt waits (N1): the re-check after the prompt refuses it
STUB_SWAP=1 run 2 'top-level' scratch1 load --from "$w/fx" --synthetic-scratch
check '! marker' 'no marker after a refused re-check'
manifest "$SYN"

echo "-- strict manifest (JSON, top level, no duplicate keys)"
manifest "$RAW"; run 2 'top-level' scratch1 load --from "$w/fx" --synthetic-scratch
for m in \
  '{"format": "pp-staging-dump/1", "synthetic": true, "anonymised": true}' \
  '{"format": "pp-staging-dump/1", "synthetic": true, "raw": "true"}' \
  '{"format": "pp-staging-dump/1", "synthetic": true, "raw": 1}' \
  '{"format": "pp-staging-dump/1", "synthetic": true, "anonymised": "true"}'; do
  manifest "$m"; run 2 'refuses a raw or anonymised dump' scratch1 load --from "$w/fx" --synthetic-scratch
done
manifest '{"format": "pp-staging-dump/1", "tables": {"synthetic": true}}'; run 2 'top-level' scratch1 load --from "$w/fx" --synthetic-scratch
manifest '{"format": "pp-staging-dump/1", "synthetic": "true"}';           run 2 'top-level' scratch1 load --from "$w/fx" --synthetic-scratch
manifest '{"format": "pp-staging-dump/1", "synthetic": true, "synthetic": false}'; run 2 'duplicate key' scratch1 load --from "$w/fx" --synthetic-scratch
manifest '{"format": "pp-staging-dump/1", "synthetic": true, "large_integers": {}}'; run 2 'large_integers' scratch1 load --from "$w/fx" --synthetic-scratch
manifest "$SYN"; : >"$w/fx/users.ndjson.partial"; run 2 '.partial files' scratch1 load --from "$w/fx" --synthetic-scratch; rm -f "$w/fx/users.ndjson.partial"

echo "-- a good synthetic load: WARN, tagged LOAD DONE, marker"
manifest "$SYN"; rm -f "$w/stage/SYNTHETIC-LOADED"
run 0 'SCRATCH OVERRIDE ACTIVE on scratch1' scratch1 load --from "$w/fx" --synthetic-scratch
check 'grep -qF "(SYNTHETIC, scratch override)" "$w/log"' 'LOAD DONE is tagged SYNTHETIC'
check marker 'the SYNTHETIC-LOADED marker is written'

echo "-- the marker: copy / etl --apply / gonogo"
prod; run 3 'the stage holds a SYNTHETIC fixture' -notty copy
run 3 'the stage holds a SYNTHETIC fixture' -notty etl migrate:all --apply --as-of=2026-10-29
EXTRA_ENV="PP_SCRATCH_HOST=yes" run 3 'the stage holds a SYNTHETIC fixture' -notty copy
run 3 'stage data: SYNTHETIC fixture loaded' -notty gonogo
check 'grep -qF "gonogo: NO-GO (scratch host or synthetic stage data)" "$w/log"' 'gonogo ends NO-GO on synthetic stage data'
prod "${SCR[@]}"; EXTRA_ENV="PP_SCRATCH_HOST=no" run 3 'host: PP_SCRATCH_HOST=yes in' -notty gonogo
echo "-- the marker on a marked scratch host: copy and etl --apply are ALLOWED (A4 Track S)"
run_absent() { # run_absent TEXT ARGS...: the refusal TEXT must not appear (the stubbed run may stop later for other reasons)
  local text="$1"; shift; run_any "$@"; if grep -qF -- "$text" "$w/log"; then fail=$((fail + 1)); echo "FAIL refused: $*"; sed 's/^/     /' "$w/log" | tail -4; else pass=$((pass + 1)); echo "ok   not refused: $*"; fi; }
run_any() { local cmd; cmd="env -u PP_SCRATCH_HOST -u PP_OFFSITE_KIND PATH=$w/bin:$PATH PP_ENV_DIR=$w/env PP_STAGE_DIR=$w/stage PP_MIGRATION_OUT=$w/out PP_LOCK_FILE=$w/lock PP_BACKUP_DIR=$w/backup bash $here/slot.sh $*"; $cmd </dev/null >"$w/log" 2>&1 || true; }
run_absent 'the stage holds a SYNTHETIC fixture' copy
run_absent 'the stage holds a SYNTHETIC fixture' etl migrate:all --apply --as-of=2026-10-29
echo "-- D1: the marker survives a refused throwaway-up and a failed raw load"
: >"$w/stage/SYNTHETIC-LOADED"; prod
run 3 'already running' -notty throwaway-up
check marker 'throwaway-up refused (cluster running): marker kept'
manifest "$RAW"; STUB_FAIL_LOAD=1 run 1 '' -notty load --from "$w/fx"
check marker 'a failed raw load keeps the marker'
run 3 'the stage holds a SYNTHETIC fixture' -notty copy
manifest "$RAW"; run 0 'LOAD DONE' -notty load --from "$w/fx"
check '! marker' 'a raw load clears the marker'
# throwaway-up clears the marker first, then stops at the (stubbed) missing db service
: >"$w/stage/SYNTHETIC-LOADED"; STUB_RUNNING=0 run 1 'the db service is not running' -notty throwaway-up
check '! marker' 'throwaway-up clears the marker'
prod; rm -f "$w/stage/SYNTHETIC-LOADED" "$w/stage/SYNTHETIC-IN-TARGET"; run 0 'gonogo: complete' -notty gonogo
check 'grep -qF "host: not marked scratch" "$w/log"' 'gonogo on a normal host: no NO-GO line'

echo "-- Codex P2 (a): the stage marker is written only under the lock"
prod "${SCR[@]}"; manifest "$SYN"; rm -f "$w/stage/SYNTHETIC-LOADED"
flock "$w/lock" sleep 4 & holder=$!; sleep 0.5
EXTRA_ENV="PP_LOCK_WAIT=1" run 75 'holds' scratch1 load --from "$w/fx" --synthetic-scratch
wait "$holder" 2>/dev/null || true
check '! marker' 'a synthetic load that never got the lock leaves no marker'

echo "-- Codex P2 (b): the target keeps its own marker until a raw copy replaces it"
tmarker() { [ -e "$w/stage/SYNTHETIC-IN-TARGET" ]; }
prod "${SCR[@]}"; manifest "$SYN"; rm -f "$w/stage/SYNTHETIC-LOADED" "$w/stage/SYNTHETIC-IN-TARGET"
run 0 'SCRATCH OVERRIDE ACTIVE on scratch1' scratch1 load --from "$w/fx" --synthetic-scratch
run_any copy
check tmarker 'a copy from a synthetic stage marks the target'
manifest "$RAW"; run 0 'LOAD DONE' -notty load --from "$w/fx"
check '! marker' 'the raw load clears the stage marker'
check tmarker 'the raw load keeps the target marker (the target still holds the synthetic copy)'
rm -rf "$w/stage/pgdata"; STUB_RUNNING=0 run 1 'the db service is not running' -notty throwaway-up
check tmarker 'throwaway-up keeps the target marker'
export STUB_RUNNING=1
prod; run 3 'the target holds a SYNTHETIC copy' -notty etl migrate:all --apply --as-of=2026-10-29
run 3 'target data: SYNTHETIC copy in the target' -notty gonogo
check 'grep -qF "gonogo: NO-GO" "$w/log"' 'gonogo ends NO-GO on a synthetic target'
run_absent 'the target holds a SYNTHETIC copy' copy
prod "${SCR[@]}"; run_absent 'the target holds a SYNTHETIC copy' etl migrate:all --apply --as-of=2026-10-29
echo "-- the target marker after a copy from a raw stage"
manifest "$RAW"; run 0 'LOAD DONE' -notty load --from "$w/fx"
EXTRA_ENV="STUB_TARGET=short" run 1 'STAGE COPY FAILED' -notty copy
check tmarker 'a raw copy that fails after the drop keeps the target marker'
EXTRA_ENV="STUB_TARGET=ok" run 0 'STAGE COPY PASSED' -notty copy
check '! tmarker' 'a raw copy that passes clears the target marker'
rm -f "$w/stage/SYNTHETIC-IN-TARGET"

echo "passed $pass, failed $fail"
[ "$fail" = 0 ]
