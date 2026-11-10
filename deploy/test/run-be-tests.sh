#!/usr/bin/env bash
# Runs inside the `runner` container of compose.be-test.yaml. Args are passed to vitest (default: whole suite).
set -euo pipefail
echo "[be-test] sync /src -> /work (excluding node_modules, dist*, .git, e2e output)"
# tar exits 1 for "file changed as we read it" (someone edits the tree meanwhile); that is a warning here, 2 is a real error.
rc=0
tar -C /src --exclude=./node_modules --exclude='*/node_modules' --exclude=./.git --exclude='./dist*' --exclude='apps/api/dist' \
  --exclude='.migration-out' --exclude='./test-results*' --exclude=./.playwright-mcp --exclude=./.claude --exclude=./e2e \
  -cf - . | tar -C /work -xf - || rc=$?
[ "$rc" -le 1 ] || { echo "[be-test] sync failed (tar exit $rc)"; exit "$rc"; }
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
