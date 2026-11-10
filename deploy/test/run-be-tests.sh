#!/usr/bin/env bash
# Runs inside the `runner` container of compose.be-test.yaml. Args are passed to vitest (default: whole suite).
set -euo pipefail

# sync_tree SRC DEST: incremental copy of the working tree into the volume.
#   - changed or new files: only files newer than DEST/.sync-stamp (a full copy when the stamp is missing or PP_BETEST_FULL_SYNC=1);
#   - deleted files: files in DEST that are no longer in SRC are removed (same excludes; node_modules and .git are never touched);
#   - the stamp is replaced only after a successful sync. It is dated at the START of the sync minus a 60 s skew margin, so a file
#     edited while the sync runs (or on a host with a slightly different clock) is copied again by the next run.
# No rsync in the node image: find + tar + comm only.
sync_tree() {
  local src="$1" dst="$2" t0=$SECONDS mode=incremental copied=0 deleted=0 stamp="$2/.sync-stamp" tmp="${PP_BETEST_TMP:-/tmp/be-sync}"
  mkdir -p "$tmp"
  # The excludes of the old full copy, as find prune tests (node_modules anywhere, dist* at the top, apps/api/dist, .migration-out anywhere).
  local prune=(-path ./.git -o -name node_modules -o -path './dist*' -o -path '*/apps/api/dist' -o -name .migration-out
    -o -path './test-results*' -o -path ./.playwright-mcp -o -path ./.claude -o -path ./e2e -o -path ./.sync-stamp)
  if [ ! -f "$stamp" ] || [ "${PP_BETEST_FULL_SYNC:-}" = 1 ]; then mode=full; fi
  rm -f "$tmp/stamp.new"; touch -d '-60 seconds' "$tmp/stamp.new"
  if [ "$mode" = full ]; then
    (cd "$src" && find . \( "${prune[@]}" \) -prune -o \( -type f -o -type l \) -print0) >"$tmp/copy.list"
  else
    (cd "$src" && find . \( "${prune[@]}" \) -prune -o \( -type f -o -type l \) -newer "$stamp" -print0) >"$tmp/copy.list"
  fi
  copied="$(tr -cd '\0' <"$tmp/copy.list" | wc -c)"
  if [ "$copied" -gt 0 ]; then
    # tar exits 1 for "file changed as we read it" (someone edits the tree meanwhile); that is a warning here, 2 is a real error.
    local rc_r=0 rc_w=0 ps=()
    set +e
    tar -C "$src" --null -T "$tmp/copy.list" -cf - | tar -C "$dst" -xf -
    ps=("${PIPESTATUS[@]}"); rc_r="${ps[0]}"; rc_w="${ps[1]}"
    set -e
    [ "$rc_r" -le 1 ] && [ "$rc_w" -le 1 ] || { echo "[be-test] sync failed (tar exit $rc_r/$rc_w)"; return 2; }
  fi
  # Deletions: in DEST but not in SRC. NUL-delimited lists, so a directory or file name with a newline cannot forge a second entry (such as ../f) and make
  # the delete reach outside DEST (every name comes from find inside DEST, so it is always below DEST).
  (cd "$src" && find . \( "${prune[@]}" \) -prune -o \( -type f -o -type l \) -print0) | LC_ALL=C sort -z >"$tmp/src.names"
  (cd "$dst" && find . \( "${prune[@]}" \) -prune -o \( -type f -o -type l \) -print0) | LC_ALL=C sort -z >"$tmp/dst.names"
  if [ ! -s "$tmp/src.names" ]; then echo "[be-test] sync failed: no files found in $src (mount missing?); nothing deleted"; return 1; fi
  LC_ALL=C comm -z -13 "$tmp/src.names" "$tmp/dst.names" >"$tmp/del.names"
  deleted="$(tr -cd '\0' <"$tmp/del.names" | wc -c)"
  if [ "$deleted" -gt 0 ]; then (cd "$dst" && xargs -0 rm -f -- <"$tmp/del.names"); fi
  mv -f "$tmp/stamp.new" "$stamp"
  echo "[be-test] sync /src -> /work ($mode; node_modules, dist*, .git, e2e output excluded): $copied copied, $deleted deleted, $((SECONDS - t0)) s"
}

# assert_work_mount DIR: the sync target must be a real mounted volume, never / or a plain folder of the container (a wrong mount would let the
# deletion pass remove files from the image).
assert_work_mount() {
  local d; d="$(readlink -f "$1")"
  [ "$d" != / ] && [ -n "$d" ] || { echo "[be-test] refusing: $1 resolves to /"; return 1; }
  mountpoint -q "$d" || { echo "[be-test] refusing: $1 is not a mountpoint (the work volume is not mounted)"; return 1; }
}

# Tests source the function only (PP_BETEST_SOURCE_ONLY=1); the real run continues below.
if [ "${PP_BETEST_SOURCE_ONLY:-}" = 1 ]; then return 0 2>/dev/null || exit 0; fi

assert_work_mount /work
sync_tree /src /work
cd /work
# Specs that run `git check-ignore` or look for a .git ancestor need a repository (the real .git is not copied).
[ -d .git ] || { git init -q . && git config user.email t@t && git config user.name t; }
# Reinstall only when the lockfile changed (the volume keeps node_modules between runs).
if ! cmp -s package-lock.json node_modules/.lock-hash 2>/dev/null; then
  echo "[be-test] npm ci"
  npm ci --no-audit --no-fund
  cp package-lock.json node_modules/.lock-hash
fi
cd apps/api
npx prisma generate >/dev/null
echo "[be-test] vitest $*"
exec npx vitest run "$@"
