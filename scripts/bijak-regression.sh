#!/usr/bin/env bash
# One-command @bijak e2e regression (mock, scope-ON build) against an integration ref.
#
#   scripts/bijak-regression.sh [options] [<ref> [<worktree-dir>]]
#
# Defaults: ref=origin/be/integration-frontend  dir=D:/Dev Projects/pp-int-regression
# Options:  --reuse            reuse an existing worktree dir (re-checkout ref, skip npm ci if lockfile unchanged)
#           --project=<name>   Playwright project passthrough (mobile|tablet|desktop), repeatable
#           --dry-run          print the plan; run nothing except git fetch / rev-parse / read-only diffs
#           -h, --help
# Env:      BIJAK_PORT (default 4834)   TESTS_REF (default origin/be/e2e-bijak, source of the spec overlay)
# Never removes the worktree, never rm -rf, never creates junctions, only stops the preview it started.

set -u

DEFAULT_REF="origin/be/integration-frontend"
DEFAULT_DIR="D:/Dev Projects/pp-int-regression"
TESTS_REF="${TESTS_REF:-origin/be/e2e-bijak}"
PORT="${BIJAK_PORT:-4834}"
OVERLAY_PATHS=(e2e/bijak playwright.bijak.config.mjs e2e/m06-spm/bijak-spm.spec.ts)
HELPER_PATHS=(e2e/fixtures e2e/support)

REUSE=0; DRY=0; PROJECTS=(); POS=()
for a in "$@"; do
  case "$a" in
    --reuse) REUSE=1 ;;
    --dry-run) DRY=1 ;;
    --project=*) PROJECTS+=("$a") ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    --*) echo "Unknown option: $a (see --help)" >&2; exit 2 ;;
    *) POS+=("$a") ;;
  esac
done
[ "${#POS[@]}" -le 2 ] || { echo "Too many arguments (see --help)" >&2; exit 2; }
REF="${POS[0]:-$DEFAULT_REF}"
DIR="${POS[1]:-$DEFAULT_DIR}"

die() { echo "ABORT: $*" >&2; exit 1; }
say() { echo "== $*"; }
plan() { echo "  + $*"; }

REPO="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel 2>/dev/null)" || die "run this from inside the repo"

# ---------- fetch + resolve (allowed in dry-run) ----------
say "git fetch origin"
git -C "$REPO" fetch origin || die "git fetch origin failed"
SHA="$(git -C "$REPO" rev-parse --verify "${REF}^{commit}" 2>/dev/null)" || die "cannot resolve ref '$REF' (not pushed yet?)"
TESTS_SHA="$(git -C "$REPO" rev-parse --verify "${TESTS_REF}^{commit}" 2>/dev/null)" || die "cannot resolve tests ref '$TESTS_REF'"
echo "ref   : $REF -> $SHA"
echo "tests : $TESTS_REF -> $TESTS_SHA"
echo "dir   : $DIR   port: $PORT   reuse: $REUSE   dry-run: $DRY"

# ---------- safety pre-checks (read-only) ----------
is_listening() { netstat -ano 2>/dev/null | tr -d '\r' | grep -E "[:.]$1[[:space:]].*LISTENING" >/dev/null; }
port_pid() { netstat -ano 2>/dev/null | tr -d '\r' | grep -E "[:.]$1[[:space:]].*LISTENING" | awk '{print $NF}' | head -1; }
is_link() { # junction or symlink
  [ -L "$1" ] && return 0
  local w; w="$(cygpath -w "$1" 2>/dev/null || echo "$1")"
  powershell -NoProfile -Command "if ((Get-Item -LiteralPath '$w' -Force).Attributes -band 0x400) { exit 0 } else { exit 1 }" >/dev/null 2>&1
}

is_listening "$PORT" && die "port $PORT is already listening; choose another with BIJAK_PORT=<port> (not killing anything)"

if [ -e "$DIR" ]; then
  [ "$REUSE" = 1 ] || die "'$DIR' already exists; pass --reuse to reuse it, or pick another dir"
  [ -e "$DIR/.git" ] || die "--reuse: '$DIR' is not a git worktree (no .git)"
  git -C "$DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "--reuse: '$DIR' is not a git worktree"
  if [ -e "$DIR/node_modules" ] && is_link "$DIR/node_modules"; then
    die "'$DIR/node_modules' is a junction/symlink (would damage the main tree on removal). Unlink it first: cmd //c rmdir \"$(cygpath -w "$DIR/node_modules")\" (no /s), then re-run"
  fi
else
  if [ "$REUSE" = 1 ]; then echo "note: --reuse given but '$DIR' does not exist; it will be created"; fi
fi

# ---------- step 1: worktree (ALONE) ----------
say "worktree"
if [ -e "$DIR" ]; then
  plan "git -C \"$DIR\" checkout --detach $SHA"
  if [ "$DRY" = 0 ]; then
    git -C "$DIR" checkout --detach "$SHA" || die "checkout failed (overlay changes in the way? inspect '$DIR' manually)"
  fi
else
  plan "git -C \"$REPO\" worktree add --detach \"$DIR\" $SHA"
  if [ "$DRY" = 0 ]; then
    git -C "$REPO" worktree add --detach "$DIR" "$SHA"
    rc=$?
    [ "$rc" = 0 ] || die "git worktree add failed (rc=$rc); nothing else was run"
    [ -e "$DIR/.git" ] || die "worktree add reported success but '$DIR/.git' is missing; nothing else was run"
  fi
fi

# ---------- step 2: npm ci ----------
say "dependencies"
LOCK_SHA_FILE="$DIR/node_modules/.bijak-lock.sha"
if [ "$DRY" = 1 ]; then
  plan "(cd \"$DIR\" && npm ci --no-audit --no-fund)   # ~2 min; skipped with --reuse if node_modules exists and package-lock.json hash matches"
else
  LOCK_NOW="$(sha256sum "$DIR/package-lock.json" | awk '{print $1}')"
  if [ "$REUSE" = 1 ] && [ -d "$DIR/node_modules" ] && [ -f "$LOCK_SHA_FILE" ] && [ "$(cat "$LOCK_SHA_FILE")" = "$LOCK_NOW" ]; then
    echo "package-lock.json unchanged; skipping npm ci"
  else
    echo "running npm ci (about 2 minutes)"
    (cd "$DIR" && npm ci --no-audit --no-fund) || die "npm ci failed"
    echo "$LOCK_NOW" > "$LOCK_SHA_FILE"
  fi
  if is_link "$DIR/node_modules"; then die "'$DIR/node_modules' is a junction/symlink after install; aborting"; fi
fi

# ---------- step 3: test overlay ----------
say "test overlay (from $TESTS_REF)"
OVERLAID=()
for p in "${OVERLAY_PATHS[@]}"; do
  if ! git -C "$REPO" diff --quiet "$SHA" "$TESTS_SHA" -- "$p" 2>/dev/null; then
    while IFS= read -r f; do
      if [ -n "$f" ]; then OVERLAID+=("$f"); fi
    done < <(git -C "$REPO" diff --name-only --diff-filter=AM "$SHA" "$TESTS_SHA" -- "$p")
  fi
done
if [ "${#OVERLAID[@]}" = 0 ]; then
  echo "no overlay needed: branch already has identical @bijak specs/config"
else
  echo "files to overlay:"; printf '    %s\n' "${OVERLAID[@]}"
  plan "git -C \"$DIR\" checkout $TESTS_SHA -- ${OVERLAID[*]}"
  if [ "$DRY" = 0 ]; then
    git -C "$DIR" checkout "$TESTS_SHA" -- "${OVERLAID[@]}" || die "overlay checkout failed"
  fi
fi
echo "helper check (not overlaid; the branch own versions are used):"
HELPER_DIFF="$(git -C "$REPO" diff --stat "$SHA" "$TESTS_SHA" -- "${HELPER_PATHS[@]}" 2>/dev/null)"
if [ -z "$HELPER_DIFF" ]; then
  echo "    e2e/fixtures + e2e/support identical to $TESTS_REF"
else
  echo "WARNING: e2e/fixtures or e2e/support DIFFER from $TESTS_REF; specs may import helpers missing on this branch:"
  echo "$HELPER_DIFF" | sed 's/^/    /'
fi
MISSING_HELPERS=""
for sym in expectNoHorizontalScroll isDesktopShell isMobileWidth viewportWidth provisional; do
  git -C "$REPO" grep -q -E "export (async )?(function|const) $sym\b" "$SHA" -- e2e/support >/dev/null 2>&1 || MISSING_HELPERS="$MISSING_HELPERS $sym"
done
git -C "$REPO" grep -q -E "export (async )?(function|const) reloadApp\b" "$SHA" -- e2e/fixtures >/dev/null 2>&1 || MISSING_HELPERS="$MISSING_HELPERS reloadApp"
if [ -n "$MISSING_HELPERS" ]; then echo "WARNING: helpers not found on $REF:$MISSING_HELPERS (specs may fail to compile)"; fi

# ---------- step 4: build + serve + test ----------
PREVIEW_PID=""
cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  if [ -n "$PREVIEW_PID" ]; then
    echo "== stopping preview started by this script (pid $PREVIEW_PID)"
    taskkill //PID "$PREVIEW_PID" //F >/dev/null 2>&1 || kill "$PREVIEW_PID" 2>/dev/null
  fi
  exit "$rc"
}
trap cleanup EXIT INT TERM

PW_RC=0
JSON_OUT="bijak-regression.json"
say "build scope-ON bundle (dist-e2e-bijak), serve, test"
if [ "$DRY" = 1 ]; then
  plan "(cd \"$DIR\" && VITE_PROTOTYPE_SCOPE=on npx vite build --mode e2e --outDir dist-e2e-bijak)"
  plan "(cd \"$DIR\" && VITE_PROTOTYPE_SCOPE=on nohup npx vite preview --mode e2e --outDir dist-e2e-bijak --port $PORT --strictPort > bijak-preview.log 2>&1 &)"
  plan "wait up to 60 s for http://localhost:$PORT/ ; PID = owner of port $PORT via netstat"
  plan "(cd \"$DIR\" && E2E_BOOT_TIMEOUT_MS=60000 BIJAK_PORT=$PORT BIJAK_REUSE=1 PLAYWRIGHT_JSON_OUTPUT_NAME=$JSON_OUT npx playwright test -c playwright.bijak.config.mjs --grep @bijak --workers=2 --reporter=list,json ${PROJECTS[*]:-})"
  plan "on exit: taskkill //PID <recorded preview pid> //F (only that PID)"
  say "dry-run complete; nothing was created or executed"
else
  (cd "$DIR" && VITE_PROTOTYPE_SCOPE=on npx vite build --mode e2e --outDir dist-e2e-bijak) || die "vite build failed"

  if is_listening "$PORT"; then die "port $PORT became busy before preview start"; fi
  (cd "$DIR" && VITE_PROTOTYPE_SCOPE=on nohup npx vite preview --mode e2e --outDir dist-e2e-bijak --port "$PORT" --strictPort > bijak-preview.log 2>&1 &)
  up=0
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null "http://localhost:$PORT/"; then up=1; break; fi
    sleep 1
  done
  # the port was free before we started, so its owner now is the preview we launched
  PREVIEW_PID="$(port_pid "$PORT")"
  if [ "$up" != 1 ]; then tail -20 "$DIR/bijak-preview.log"; die "preview did not respond on $PORT within 60 s"; fi
  echo "preview up on :$PORT (pid ${PREVIEW_PID:-unknown})"

  say "playwright @bijak"
  (cd "$DIR" && E2E_BOOT_TIMEOUT_MS=60000 BIJAK_PORT="$PORT" BIJAK_REUSE=1 PLAYWRIGHT_JSON_OUTPUT_NAME="$JSON_OUT" \
    npx playwright test -c playwright.bijak.config.mjs --grep @bijak --workers=2 --reporter=list,json "${PROJECTS[@]}")
  PW_RC=$?
fi

# ---------- summary ----------
say "SUMMARY"
echo "ref     : $REF ($SHA)"
echo "overlaid: ${OVERLAID[*]:-none}"
if [ "$DRY" = 0 ]; then
  if [ -f "$DIR/$JSON_OUT" ]; then
    node -e '
      const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s={};
      const walk=x=>{(x.specs||[]).forEach(sp=>sp.tests.forEach(t=>{const p=t.projectName||"?";s[p]=s[p]||{pass:0,fail:0,skip:0,flaky:0};
        const k={expected:"pass",unexpected:"fail",skipped:"skip",flaky:"flaky"}[t.status]||"fail";s[p][k]++}));(x.suites||[]).forEach(walk)};
      (r.suites||[]).forEach(walk);
      for(const [p,v] of Object.entries(s))console.log("  "+p.padEnd(8)+" pass="+v.pass+" fail="+v.fail+" skip="+v.skip+" flaky="+v.flaky);
    ' "$DIR/$JSON_OUT" || echo "  (could not parse $JSON_OUT)"
  else
    echo "  no JSON report found at $DIR/$JSON_OUT"
  fi
  echo "playwright exit code: $PW_RC"
fi
echo
echo "Manual cleanup (NOT run by this script):"
echo "  1. only if '$DIR/node_modules' is a junction:  cmd //c rmdir \"$(cygpath -w "$DIR/node_modules" 2>/dev/null || echo "$DIR/node_modules")\"   (no /s)"
echo "  2. git -C \"$REPO\" worktree remove --force \"$DIR\""
exit "$PW_RC"
