#!/usr/bin/env bash
# Behaviour test of `slot.sh load --synthetic-scratch` (A4 Track S) with stubs (no Docker, no database): proves the
# production path is unchanged and that the override refuses everything except a synthetic fixture on a host marked
# scratch, with no off-site backup and the host name typed in a terminal. Each case stops before any load: the stub
# `docker` reports no throwaway cluster, so a case that passes every gate ends with exit 3 "not running".
#   deploy/vps/migration/test-scratch-override.sh
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command -v script >/dev/null || { echo "missing: script (util-linux)" >&2; exit 2; }
w="$(mktemp -d)"; trap 'rm -rf "$w"' EXIT
mkdir -p "$w/env" "$w/bin" "$w/stage" "$w/out" "$w/fx"
printf 'POSTGRES_DB=pp_test\n' >"$w/env/db.env"
printf '#!/bin/sh\n[ "$1" = inspect ] && { echo false; exit 0; }\nexit 1\n' >"$w/bin/docker"
printf '#!/bin/sh\necho scratch1\n' >"$w/bin/hostname"
chmod +x "$w/bin/docker" "$w/bin/hostname"
pass=0; fail=0
manifest() { printf '{"format": "pp-staging-dump/1", %s}\n' "$1" >"$w/fx/manifest.json"; }
prod() { printf '%s\n' "$@" >"$w/env/prod.env"; }
# run EXPECTED_EXIT EXPECTED_TEXT TTY_INPUT|-notty ARGS...
run() {
  local want="$1" text="$2" input="$3"; shift 3
  local cmd rc=0 log="$w/log"
  cmd="env -u PP_SCRATCH_HOST -u PP_OFFSITE_KIND PATH=$w/bin:$PATH PP_ENV_DIR=$w/env PP_STAGE_DIR=$w/stage PP_MIGRATION_OUT=$w/out bash $here/slot.sh $*"
  if [ "$input" = -notty ]; then $cmd </dev/null >"$log" 2>&1 || rc=$?
  else printf '%s\n' "$input" | script -qec "$cmd" /dev/null >"$log" 2>&1 || rc=$?; fi
  if [ "$rc" = "$want" ] && grep -q -- "$text" "$log"; then pass=$((pass + 1)); echo "ok   exit $rc: $text"
  else fail=$((fail + 1)); echo "FAIL want exit $want + '$text', got exit $rc:"; sed 's/^/     /' "$log"; fi
}
SCR=(PP_SCRATCH_HOST=yes PP_OFFSITE_KIND=none)
manifest '"synthetic": true'; prod "${SCR[@]}"
run 2 'the dump is not marked raw' -notty load --from "$w/fx"                               # production path: unchanged
manifest '"raw": true'; prod
run 3 'throwaway cluster is not running' -notty load --from "$w/fx"                           # production path: raw still passes
manifest '"synthetic": true'
prod;                    run 2 'not marked scratch' scratch1 load --from "$w/fx" --synthetic-scratch
prod PP_SCRATCH_HOST=yes PP_OFFSITE_KIND=s3; run 2 'no off-site backup' scratch1 load --from "$w/fx" --synthetic-scratch
prod "${SCR[@]}";        run 2 'needs the typed host name' -notty load --from "$w/fx" --synthetic-scratch
prod "${SCR[@]}";        run 2 'confirmation did not match' prod-host load --from "$w/fx" --synthetic-scratch
manifest '"raw": true';  run 2 'loads only a fixtures:generate dump' scratch1 load --from "$w/fx" --synthetic-scratch
manifest '"synthetic": true, "anonymised": true'; run 2 'refuses a raw or anonymised dump' scratch1 load --from "$w/fx" --synthetic-scratch
manifest '"synthetic": true, "raw": true';         run 2 'refuses a raw or anonymised dump' scratch1 load --from "$w/fx" --synthetic-scratch
manifest '"synthetic": true'; run 3 'SCRATCH OVERRIDE ACTIVE on scratch1' scratch1 load --from "$w/fx" --synthetic-scratch
echo "passed $pass, failed $fail"
[ "$fail" = 0 ]
