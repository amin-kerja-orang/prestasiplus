#!/usr/bin/env bash
# Fixture test of the incremental source sync of deploy/test/run-be-tests.sh (sync_tree, assert_work_mount). Plain bash on a tiny tree, no
# Docker daemon needed beyond the container it runs in (GNU find, tar, comm, mountpoint: node:22.22.2-bookworm has them):
#   docker run --rm -v "$PWD:/src:ro" --entrypoint bash node:22.22.2-bookworm /src/deploy/test/test-run-be-sync.sh
# Covers: first full copy, nothing re-copied when unchanged, incremental copy, deletion, forced full sync, missing stamp, refusal when the source
# is empty, a crafted file name (newline plus ../) that must not delete outside the target, and the mountpoint guard. See docs/ops/be-tests-linux.md.
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
base="$(mktemp -d)"; trap 'rm -rf "$base"' EXIT
export PP_BETEST_TMP="$base/tmp" PP_BETEST_SOURCE_ONLY=1 PP_BETEST_ALLOW_UNMOUNTED=1   # the fixture dirs are not mountpoints
# shellcheck source=run-be-tests.sh
. "$here/run-be-tests.sh"
set +e   # the sourced script sets -e; the checks below expect failures
pass=0; fail=0
ok()  { pass=$((pass + 1)); echo "ok   $1"; }
bad() { fail=$((fail + 1)); echo "FAIL $1"; }
check() { if eval "$2"; then ok "$1"; else bad "$1"; fi; }

S="$base/src"; D="$base/work"; O="$base/out"
mkdir -p "$S/a/b" "$S/node_modules/x" "$S/e2e" "$S/apps/api/dist" "$D/node_modules" "$D/.git" "$O"
echo 1 >"$S/a/one"; echo 2 >"$S/a/b/two"; echo n >"$S/node_modules/x/n"; echo e >"$S/e2e/e"; echo d >"$S/apps/api/dist/d"; echo g >"$S/dist-x"
echo keep >"$D/node_modules/keep"; echo h >"$D/.git/HEAD"
find "$S" -type f -exec touch -d '-1 day' {} +   # old files: only the 60 s skew margin could make them look new
run() { sync_tree "$S" "$D" 2>&1 | tee "$base/out.log" | sed 's/^/     /'; }

echo "-- first full copy"
run
check 'full mode, 2 files copied, none deleted' 'grep -q "(full; .*2 copied, 0 deleted" "$base/out.log"'
check 'copied files are in the target' '[ -f "$D/a/one" ] && [ -f "$D/a/b/two" ]'
check 'excluded paths were not copied' '[ ! -e "$D/node_modules/x" ] && [ ! -e "$D/e2e" ] && [ ! -e "$D/apps/api/dist" ] && [ ! -e "$D/dist-x" ]'
check 'node_modules and .git of the target are untouched' '[ -f "$D/node_modules/keep" ] && [ -f "$D/.git/HEAD" ]'
check 'the stamp exists' '[ -f "$D/.sync-stamp" ]'

echo "-- nothing changed"
run
check 'incremental mode, 0 copied, 0 deleted' 'grep -q "(incremental; .*0 copied, 0 deleted" "$base/out.log"'

echo "-- incremental: one file changed, one added"
echo changed >"$S/a/one"; echo 3 >"$S/a/three"
run
check 'incremental mode, 2 copied' 'grep -q "(incremental; .*2 copied, 0 deleted" "$base/out.log"'
check 'content updated and new file present' '[ "$(cat "$D/a/one")" = changed ] && [ -f "$D/a/three" ]'

echo "-- deletion"
rm "$S/a/b/two"
run
check '1 deleted' 'grep -q "1 deleted" "$base/out.log"'
check 'the file is gone from the target, the others stay' '[ ! -e "$D/a/b/two" ] && [ -f "$D/a/one" ] && [ -f "$D/a/three" ]'
check 'node_modules and .git still untouched' '[ -f "$D/node_modules/keep" ] && [ -f "$D/.git/HEAD" ]'

echo "-- forced full sync (a stray file in the target is removed too)"
echo x >"$D/a/stray"
PP_BETEST_FULL_SYNC=1 run
check 'full mode' 'grep -q "(full; " "$base/out.log"'
check 'all source files copied again, the stray file deleted' 'grep -q "2 copied, 1 deleted" "$base/out.log" && [ ! -e "$D/a/stray" ]'

echo "-- missing stamp means a full copy"
rm "$D/.sync-stamp"
run
check 'full mode again' 'grep -q "(full; " "$base/out.log"'

echo "-- empty source: refused, nothing deleted, stamp kept"
mkdir "$base/empty"; before="$(cat "$D/a/one")"
sync_tree "$base/empty" "$D" >"$base/out.log" 2>&1; rc=$?
check 'refused (rc 1) with the mount-missing message' '[ "$rc" = 1 ] && grep -q "no files found" "$base/out.log"'
check 'the target still has its files' '[ "$(cat "$D/a/one")" = "$before" ] && [ -f "$D/a/three" ]'

echo "-- crafted names: a directory named \"q<newline>..\" must not make the delete reach outside the target"
# A path ./q<NL>../f prints as two lines, ./q and ../f, in a line-delimited list: ../f would then be a forged entry that names $base/f.
echo precious >"$base/f"
mkdir -p "$D/$(printf 'q\n..')"; printf x >"$D/$(printf 'q\n..')/f"
run
check 'the file outside the target survived' '[ -f "$base/f" ] && [ "$(cat "$base/f")" = precious ]'
check 'the crafted file was deleted from the target' '[ -z "$(find "$D" -name f -path "*q*" -type f -print -quit)" ]'
check 'the sync still reports the deletion' 'grep -q "1 deleted" "$base/out.log"'

echo "-- assert_work_mount"
assert_work_mount / >/dev/null 2>&1; check 'refuses /' '[ $? != 0 ]'
assert_work_mount "$base/work" >/dev/null 2>&1; check 'refuses a plain folder that is not a mountpoint' '[ $? != 0 ]'
assert_work_mount /proc >/dev/null 2>&1; check 'accepts a mountpoint' '[ $? = 0 ]'
echo "-- sync_tree itself refuses an unmounted target (PP_BETEST_ALLOW_UNMOUNTED unset)"
mkdir -p "$base/plain-work"
PP_BETEST_ALLOW_UNMOUNTED= sync_tree "$S" "$base/plain-work" >"$base/out.log" 2>&1; rc=$?
check 'refused and nothing was copied' '[ "$rc" != 0 ] && grep -q "not a mountpoint" "$base/out.log" && [ ! -e "$base/plain-work/a" ] && [ ! -e "$base/plain-work/.sync-stamp" ]'

echo; echo "passed $pass, failed $fail"
[ "$fail" = 0 ]
