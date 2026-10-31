#!/usr/bin/env bash
# Local http-mode dry-run of the Bijak go/no-go (slug e2e-bijak). Not for CI; gated by the LEAD.
#
#   BIJAK_DRYRUN_GO=1 scripts/bijak-http-dryrun.sh [--dry-run] [--api-ref <ref>] [--keep]
#
# What it does (one Postgres, one compose project `pp-s3-dryrun`):
#   1. reuses the repo's BE-32 stack: compose.yaml + compose.http.yaml (frontend built with
#      VITE_API_MODE=http, nginx same-origin /api, api, migrate + demo seed + e2e seed,
#      BIJAK_POC_QUESTIONS=false, db);
#   2. builds the API + migrate images from --api-ref (default origin/feature/v2-backend) and the
#      frontend from THIS checkout. If the ref is already an ancestor of HEAD, one context is used;
#      otherwise a detached worktree of the ref is the build context of api + migrate only;
#   3. waits for /healthz and /api/health, picks BIJAK_PAPER_ID (the bank demo paper, same query as
#      .github/workflows/e2e-http.yml; aborts if it is not found), then runs `npm run smoke:bijak` and the
#      @bijak e2e (workers=1).
# Options:  --dry-run   print every command; execute only git fetch/rev-parse/merge-base and docker ps
#           --api-ref   git ref of the API (default origin/feature/v2-backend)
#           --keep      leave the stack, env files and API worktree up (you must tear down yourself)
# Gate:     BIJAK_DRYRUN_GO=1 is required (the LEAD's GO; a Docker slot is serialised).
# Env (required to run, never stored in a file; the seed's documented demo accounts apply):
#   BIJAK_STUDENT_USER/PASS  BIJAK_GURU_USER/PASS  BIJAK_ADMIN_SEKOLAH_USER/PASS
# Env (optional): BIJAK_ADMIN_PUSAT_USER/PASS (objective c spec; skips itself when unset),
#   DRYRUN_PORT (default 5196), BIJAK_SCHOOL_ID, BIJAK_PAPER_ID (when unset it is looked up in the stack's db:
#   the published `pilihan` paper titled BANK_PAPER_TITLE below; the PoC papers are not playable).
# Safety:   unique project name, unique image tags, never `docker system prune`, never touches other
#           projects. Refuses at >= 3 running Postgres containers or a taken port. Creates .env.api and
#           .env.db (git-ignored, random secrets) only if absent, and removes them again on teardown.

set -u

PROJECT="pp-s3-dryrun"
PORT="${DRYRUN_PORT:-5196}"
ORIGIN="http://localhost:${PORT}"
export FRONTEND_PORT="$PORT"   # compose.yaml publishes ${FRONTEND_PORT:-5192}:8080
API_REF="origin/feature/v2-backend"
DRY=0; KEEP=0
SCRATCH="${DRYRUN_SCRATCH:-C:/Users/hp/AppData/Local/Temp/claude/d--Dev-Projects-pretasiplus-app/559b8b90-cc47-4575-a8ad-7270f55cb100/scratchpad/s3-dryrun}"
IMG_FE="pretasiplus-frontend:s3dryrun"
IMG_API="pretasiplus-api:s3dryrun"
IMG_MIG="pretasiplus-api-migrate:s3dryrun"
# The demo seed's bank paper (apps/api/prisma/seed/poc/bijak-sittings.ts BANK_PAPER_TITLE), as in e2e-http.yml.
BANK_PAPER_TITLE="Latihan Demo Matematik Bank Soalan (Contoh)"

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --keep) KEEP=1 ;;
    --api-ref) shift; [ $# -gt 0 ] || { echo "--api-ref needs a value" >&2; exit 2; }; API_REF="$1" ;;
    -h|--help) sed -n '2,27p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1 (see --help)" >&2; exit 2 ;;
  esac
  shift
done

say()  { echo "== $*"; }
plan() { echo "  + $*"; }
die()  { echo "ABORT: $*" >&2; exit 1; }
# run: print the command; execute it unless --dry-run
run()  { plan "$*"; if [ "$DRY" -eq 0 ]; then "$@"; fi; }

# ---------- gate ----------
if [ "${BIJAK_DRYRUN_GO:-}" != "1" ]; then
  echo "REFUSED: BIJAK_DRYRUN_GO=1 is not set." >&2
  echo "This script builds images and starts Docker (api + 1 Postgres + nginx). A Docker slot is" >&2
  echo "serialised by the LEAD session; run it only after the LEAD gives the GO, then set BIJAK_DRYRUN_GO=1." >&2
  exit 3
fi

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || die "cannot cd to repo"
[ -f compose.yaml ] && [ -f compose.http.yaml ] || die "compose.yaml / compose.http.yaml not found in $REPO"

# ---------- read-only resolution ----------
say "git fetch origin (read-only) and ref resolution"
git fetch origin || die "git fetch origin failed"
API_SHA="$(git rev-parse --verify "${API_REF}^{commit}" 2>/dev/null)" || die "cannot resolve --api-ref '$API_REF'"
HEAD_SHA="$(git rev-parse HEAD)"
if git merge-base --is-ancestor "$API_SHA" HEAD; then
  SPLIT=0
  echo "api ref $API_REF ($API_SHA) is an ancestor of HEAD ($HEAD_SHA): one build context (this checkout)"
else
  SPLIT=1
  echo "api ref $API_REF ($API_SHA) is NOT in HEAD ($HEAD_SHA, behind by $(git rev-list --count HEAD.."$API_SHA") commit(s)):"
  echo "  api + migrate images are built from a detached worktree of the ref; the frontend from this checkout"
fi
API_WT="$(cd "$REPO/.." && pwd)/pp-s3-dryrun-api"

# ---------- preflight (docker ps is read-only) ----------
say "preflight"
docker info >/dev/null 2>&1 || die "Docker is not running (docker info failed)"
PG_COUNT="$(docker ps --format '{{.Image}} {{.Names}}' | grep -ci 'postgres')"
echo "running Postgres containers: $PG_COUNT (limit: refuse at 3 or more)"
[ "$PG_COUNT" -lt 3 ] || die "$PG_COUNT Postgres containers already running (be:verify resource cap is 3)"
if docker ps -a --filter "label=com.docker.compose.project=${PROJECT}" --format '{{.Names}}' | grep -q .; then
  die "compose project ${PROJECT} already has containers; tear it down first: docker compose -p ${PROJECT} down -v"
fi
if (exec 3<>"/dev/tcp/127.0.0.1/${PORT}") 2>/dev/null; then
  die "port ${PORT} is already in use (set DRYRUN_PORT to a free port)"
fi
echo "port ${PORT}: free"
if [ -e "$REPO/.env.api" ] || [ -e "$REPO/.env.db" ]; then
  die ".env.api or .env.db already exists in $REPO; move it aside (this script creates and later removes its own)"
fi
if [ "$SPLIT" -eq 1 ] && [ -e "$API_WT" ]; then
  die "$API_WT already exists; remove it with: git worktree remove --force '$API_WT'"
fi

# ---------- required env ----------
MISSING=""
for v in BIJAK_STUDENT_USER BIJAK_STUDENT_PASS BIJAK_GURU_USER BIJAK_GURU_PASS \
         BIJAK_ADMIN_SEKOLAH_USER BIJAK_ADMIN_SEKOLAH_PASS; do
  [ -n "${!v:-}" ] || MISSING="$MISSING $v"
done
if [ -n "$MISSING" ]; then
  if [ "$DRY" -eq 1 ]; then echo "NOTE (dry-run): missing env, a real run would refuse:$MISSING"
  else die "missing env:$MISSING (demo accounts: see apps/api/prisma/seed/core/identity.ts; never stored in a file)"; fi
fi

# ---------- plan ----------
COMPOSE_FILES=(-f compose.yaml -f compose.http.yaml)
OVERRIDE="$SCRATCH/compose.s3-dryrun.yaml"
COMPOSE_FILES+=(-f "$OVERRIDE")
DC=(docker compose -p "$PROJECT" "${COMPOSE_FILES[@]}")
CREATED_ENV=0; CREATED_WT=0; STACK_STARTED=0
SMOKE_RC="-"; E2E_RC="-"
JSON_OUT="$SCRATCH/e2e-report.json"

say "plan"
echo "stack    : compose.yaml + compose.http.yaml (BE-32) + generated override ($OVERRIDE)"
echo "project  : $PROJECT   origin: $ORIGIN   images: $IMG_FE $IMG_API $IMG_MIG"
echo "services : frontend(nginx :8080 -> host $PORT), api, migrate(+demo seed), db (1 Postgres)"

teardown() {
  rc=$?
  trap - EXIT INT TERM
  if [ "$KEEP" -eq 1 ]; then
    say "--keep: leaving everything up. Tear down with:"
    echo "  docker compose -p $PROJECT -f compose.yaml -f compose.http.yaml -f '$OVERRIDE' down -v"
    [ "$CREATED_WT" -eq 1 ] && echo "  git worktree remove --force '$API_WT'"
    echo "  rm .env.api .env.db   (in $REPO)"
    exit "$rc"
  fi
  say "teardown"
  if [ "$STACK_STARTED" -eq 1 ] || [ "$CREATED_ENV" -eq 1 ]; then
    "${DC[@]}" down -v --remove-orphans
    docker rmi "$IMG_FE" "$IMG_API" "$IMG_MIG" >/dev/null 2>&1
  fi
  [ "$CREATED_ENV" -eq 1 ] && rm -f "$REPO/.env.api" "$REPO/.env.db"
  [ "$CREATED_WT" -eq 1 ] && git -C "$REPO" worktree remove --force "$API_WT"
  exit "$rc"
}

# ---------- build the stack ----------
say "prepare"
if [ "$DRY" -eq 1 ]; then
  plan "mkdir -p '$SCRATCH'"
  plan "write $OVERRIDE (image tags $IMG_FE/$IMG_API/$IMG_MIG; host port ${PORT} via FRONTEND_PORT$([ "$SPLIT" -eq 1 ] && echo "; api+migrate build context = $API_WT"))"
  plan "write $REPO/.env.api and .env.db (random secrets from openssl/node; removed on teardown)"
  [ "$SPLIT" -eq 1 ] && plan "git worktree add --detach '$API_WT' $API_SHA"
else
  trap teardown EXIT INT TERM
  mkdir -p "$SCRATCH" || die "cannot create $SCRATCH"

  rand() { openssl rand -hex 24 2>/dev/null || node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))"; }
  DBPW="$(rand)"; SESS="$(rand)"; ICK="$(rand)"
  [ -n "$DBPW" ] && [ -n "$SESS" ] && [ -n "$ICK" ] || die "could not generate random secrets"
  umask 077
  printf 'POSTGRES_DB=prestasiplus\nPOSTGRES_USER=pp\nPOSTGRES_PASSWORD=%s\n' "$DBPW" > "$REPO/.env.db"
  printf 'DATABASE_URL=postgresql://pp:%s@db:5432/prestasiplus\nSESSION_SECRET=%s\nIC_HASH_KEY=%s\nPUBLIC_BASE_URL=%s\nPUBLIC_ORIGINS=%s\n' \
    "$DBPW" "$SESS" "$ICK" "$ORIGIN" "$ORIGIN" > "$REPO/.env.api"
  CREATED_ENV=1

  if [ "$SPLIT" -eq 1 ]; then
    git worktree add --detach "$API_WT" "$API_SHA" || die "git worktree add failed"
    CREATED_WT=1
    API_CTX="$(cygpath -m "$API_WT" 2>/dev/null || echo "$API_WT")"
  fi
  {
    echo "services:"
    echo "  frontend:"
    echo "    image: $IMG_FE"
    echo "  api:"
    echo "    image: $IMG_API"
    [ "$SPLIT" -eq 1 ] && printf '    build:\n      context: "%s"\n' "$API_CTX"
    echo "  migrate:"
    echo "    image: $IMG_MIG"
    [ "$SPLIT" -eq 1 ] && printf '    build:\n      context: "%s"\n' "$API_CTX"
  } > "$OVERRIDE"
  "${DC[@]}" config -q || die "compose config is invalid (override: $OVERRIDE)"
fi

# ---------- up ----------
say "stack up (builds 3 images; first run is slow)"
plan "${DC[*]} up -d --build --wait"
if [ "$DRY" -eq 0 ]; then
  STACK_STARTED=1
  "${DC[@]}" up -d --build --wait || { "${DC[@]}" logs --tail 60 migrate api 2>&1 | tail -n 120; die "stack failed to come up"; }
fi

say "wait for health"
plan "curl -fsS $ORIGIN/healthz ; curl -fsS $ORIGIN/api/health   (up to 90 s)"
if [ "$DRY" -eq 0 ]; then
  ok=0
  for _ in $(seq 1 45); do
    if curl -fsS "$ORIGIN/healthz" >/dev/null 2>&1 && curl -fsS "$ORIGIN/api/health" >/dev/null 2>&1; then ok=1; break; fi
    sleep 2
  done
  [ "$ok" -eq 1 ] || { "${DC[@]}" logs --tail 60 api 2>&1 | tail -n 80; die "health did not turn green at $ORIGIN"; }
  echo "health ok: $(curl -fsS "$ORIGIN/api/health")"
fi

# ---------- paper id (same lookup as .github/workflows/e2e-http.yml) ----------
say "pick BIJAK_PAPER_ID (bank demo paper)"
if [ -n "${BIJAK_PAPER_ID:-}" ]; then
  echo "BIJAK_PAPER_ID=${BIJAK_PAPER_ID} (from the environment, not looked up)"
else
  PAPER_SQL="select id from papers where kind = 'pilihan' and status = 'published' and title = '${BANK_PAPER_TITLE}' order by id limit 1;"
  plan "${DC[*]} exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tA' <<< \"$PAPER_SQL\""
  if [ "$DRY" -eq 0 ]; then
    # shellcheck disable=SC2016  # $POSTGRES_USER / $POSTGRES_DB expand inside the db container, not here
    PAPER_ID="$("${DC[@]}" exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA' <<< "$PAPER_SQL")" \
      || die "paper lookup failed (psql in the db service)"
    PAPER_ID="$(printf '%s' "$PAPER_ID" | tr -d '[:space:]')"
    [ -n "$PAPER_ID" ] || die "bank demo paper '${BANK_PAPER_TITLE}' not found (the demo seed did not create it)"
    export BIJAK_PAPER_ID="$PAPER_ID"
    echo "BIJAK_PAPER_ID=${BIJAK_PAPER_ID}"
  fi
fi

# ---------- tests ----------
say "1/2 smoke: npm run smoke:bijak"
plan "BASE_URL=$ORIGIN npm run smoke:bijak"
if [ "$DRY" -eq 0 ]; then
  BASE_URL="$ORIGIN" npm run smoke:bijak; SMOKE_RC=$?
fi

say "2/2 e2e: playwright @bijak (mobile, tablet, desktop; workers=1)"
plan "BIJAK_API_BASE=$ORIGIN PLAYWRIGHT_JSON_OUTPUT_NAME=$JSON_OUT npx playwright test -c playwright.bijak.config.mjs --grep @bijak --workers=1 --reporter=list,json"
if [ "$DRY" -eq 0 ]; then
  BIJAK_API_BASE="$ORIGIN" PLAYWRIGHT_JSON_OUTPUT_NAME="$JSON_OUT" \
    npx playwright test -c playwright.bijak.config.mjs --grep @bijak --workers=1 --reporter=list,json
  E2E_RC=$?
fi

# ---------- summary ----------
say "summary"
if [ "$DRY" -eq 1 ]; then
  echo "dry-run: nothing executed or started (only git fetch/rev-parse/merge-base and docker ps/info ran)"
  echo "teardown (real run, unless --keep): docker compose -p $PROJECT -f compose.yaml -f compose.http.yaml -f <override> down -v"
  exit 0
fi
echo "api    : $API_REF @ $API_SHA   frontend: $HEAD_SHA"
echo "smoke  : $([ "$SMOKE_RC" = 0 ] && echo PASS || echo "FAIL (exit $SMOKE_RC)")"
if [ -f "$JSON_OUT" ]; then
  node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); const by = {};
    const walk = (s) => { for (const sp of s.specs || []) for (const t of sp.tests || []) {
      const p = t.projectName; by[p] ??= { passed: 0, failed: 0, skipped: 0 };
      const st = t.status; if (st === "expected") by[p].passed++; else if (st === "skipped") by[p].skipped++; else by[p].failed++; }
      for (const c of s.suites || []) walk(c); };
    for (const s of r.suites || []) walk(s);
    for (const [p, v] of Object.entries(by)) console.log("e2e " + p.padEnd(8) + ": " + v.passed + " passed, " + v.failed + " failed, " + v.skipped + " skipped");
  ' "$JSON_OUT" || echo "e2e   : could not parse $JSON_OUT"
fi
echo "e2e    : $([ "$E2E_RC" = 0 ] && echo PASS || echo "FAIL (exit $E2E_RC)")"
echo "note   : skipped tests mean missing optional env (e.g. BIJAK_ADMIN_PUSAT_*) - check the list output above"
if [ "$SMOKE_RC" = 0 ] && [ "$E2E_RC" = 0 ]; then exit 0; fi
exit 1
