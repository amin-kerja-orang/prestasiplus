#!/usr/bin/env bash
# Demo deploy, run sheet #170 end to end (docs/ops/demo-deploy-22oct-run-sheet.md, docs/ops/demo-deploy-23oct.md).
# The GitHub workflows .github/workflows/deploy-demo.yml and rollback-demo.yml are thin wrappers around this script;
# it can also run locally. Setup and usage: docs/ops/deploy-demo-workflow.md.
#
#   scripts/deploy-demo.sh deploy     # run sheet steps 1-10 (mode reset = Path A, mode redeploy = no DB reset)
#   scripts/deploy-demo.sh rollback   # run sheet step 11 rollback block (#112 section 6)
#
# deploy runs in three phases (PP_PHASE, default all). The workflow runs them as separate steps:
#   build   checkout, npm ci, SPA build, wrangler install   NO secrets in the environment (lifecycle scripts run here)
#   backup  read-only target checks, pg_dump, GPG encrypt   DB + read-only Render/Cloudflare checks
#   apply   reset, migrate, seed, lockdown, secrets, deploy, smoke/walkthrough (after the encrypted dump is uploaded)
#
# Every check has the run sheet's expected value. Any mismatch prints `NO-GO: <step>: <reason>` and exits 1.
# Exit codes: 0 = GO (or, for a stub run, "STUB RUN COMPLETE"), 1 = NO-GO, 2 = usage/input error.
#
# Inputs (environment only; secrets are never taken from argv and never printed):
#   BACKEND_SHA, FRONTEND_SHA   40-hex commits (deploy)
#   PP_MODE                     reset | redeploy (deploy; default reset)
#   DEMO_REF                    Supabase project ref of prestasiplus-demo (pp_gate checks the pooler user against it)
#   PGURL                       session pooler URL WITHOUT password: postgresql://postgres.<ref>@<host>:5432/postgres
#   PGPASSWORD                  Supabase DB password                                                   (secret)
#   SUPABASE_CA_FILE            path to the Supabase CA certificate (sslmode=verify-full)
#   DEMO_PASSWORD               demo persona password (the seed hashes it; smoke/walkthrough log in)   (secret)
#   BACKUP_GPG_PUBLIC_KEY       ASCII-armoured public key; the pre-deploy dump is encrypted to it (required)
#   KEEP_EDGE_SECRET            1 = keep the current EDGE_PROXY_SECRET on both sides (default: a fresh random one)
#   RENDER_API_KEY, RENDER_SERVICE_ID, RENDER_URL                                                   (key: secret)
#   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, PAGES_PROJECT, PAGES_URL, PAGES_BRANCH (default main) (token: secret)
#   Rollback only: ROLLBACK_RENDER_SHA (default adcaad0c...), ROLLBACK_RENDER_BRANCH (default be/demo-deploy-2),
#                  ROLLBACK_PAGES_DEPLOYMENT_ID (default: the id the deploy run recorded, else the previous successful
#                  production deployment), RESTORE_DB (1/0), ROLLBACK_DUMP_GPG (encrypted dump),
#                  BACKUP_GPG_PRIVATE_KEY, BACKUP_GPG_PASSPHRASE
#   Local options:  PP_WORK_DIR (default: a new temp dir; required for split phases), PP_NO_FETCH=1 (use the refs
#                   already in the clone), PP_SKIP_NPM_CI=1 (reuse node_modules in an existing PP_WORK_DIR)
#   Test switch:    PP_DEPLOY_STUB=1 stubs every Render/Cloudflare call (nothing leaves the machine). Only allowed
#                   outside GitHub Actions and only against a loopback PGURL; PP_LOCAL_SSLQ (e.g. sslmode=disable)
#                   is accepted only then. PP_STUB_BASE_URL (optional) points health/smoke/walkthrough at a local edge.
set -Eeuo pipefail
umask 077

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd -P)

CMD="${1:-}"
STEP=init
STUB="${PP_DEPLOY_STUB:-0}"
WRANGLER_VERSION='4.148.0'
RENDER_API='https://api.render.com/v1'
CF_API='https://api.cloudflare.com/client/v4'
ROLLBACK_SHA_DEFAULT='adcaad0ce444bab734d43a3939e511fd7d8493fb'
SPA_SYNC_BASE='23c98226'
BE_BRANCH='feature/v2-backend'
FE_BRANCH='be/integration-frontend'
# Run sheet expected values (#170 steps 6 and 10). Changing one is a run sheet change: re-rehearse first.
EXPECT_COUNTS_TAIL='197 | 51 | 18 | 0 | 4 | 15 | 34 | 15 | 5 | @Q@ | 3 | 10 | 71 | 4'
EXPECT_SEED_LINE='seed: profile=poc, 25 module(s)'
EXPECT_SMOKE='Result: 29 passed, 0 failed'
EXPECT_WALK_RO=': 102 passed, 0 failed, 5 skipped'
EXPECT_WALK_RW=': 116 passed, 0 failed, 0 skipped'
SECRET_VARS=(PGPASSWORD PGURL DATABASE_URL DEMO_PASSWORD RENDER_API_KEY CLOUDFLARE_API_TOKEN BACKUP_GPG_PRIVATE_KEY BACKUP_GPG_PASSPHRASE SEED_DEMO_PASSWORD_HASH)

# ------------------------------------------------------------------------------------------------ helpers
log() { printf '%s\n' "$*"; }
hdr() { STEP="$1"; printf '\n== %s ==\n' "$1"; }
nogo() { printf 'NO-GO: %s: %s\n' "$STEP" "$*"; summary "**NO-GO: ${STEP}**: $*"; exit 1; }
on_err() { local rc=$?; [ "$BASH_SUBSHELL" = 0 ] || exit "$rc"; printf 'NO-GO: %s: command failed (exit %s, line %s)\n' "$STEP" "$rc" "${BASH_LINENO[0]}"; summary "**NO-GO: ${STEP}** (exit $rc)"; exit 1; }
trap on_err ERR
usage_err() { printf 'deploy-demo: %s\n' "$*" >&2; exit 2; }
in_actions() { [ "${GITHUB_ACTIONS:-}" = true ]; }
# Masks a value in the Actions log. Outside Actions it prints nothing (printing the command would leak the value).
mask() { if in_actions && [ -n "${1:-}" ]; then printf '::add-mask::%s\n' "$1"; fi; }
summary() { if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then printf '%s\n' "$*" >>"$GITHUB_STEP_SUMMARY"; fi; }
gh_output() { if [ -n "${GITHUB_OUTPUT:-}" ]; then printf '%s=%s\n' "$1" "$2" >>"$GITHUB_OUTPUT"; fi; }
need() { local v; for v in "$@"; do [ -n "${!v:-}" ] || usage_err "set $v"; done; }
is_sha() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }
expect_eq() { [ "$1" = "$2" ] || nogo "$3: got '$1', expected '$2'"; log "OK  $3 = $2"; }
psqlq() { psql "$PGURL?$SSLQ" -X -v ON_ERROR_STOP=1 -At "$@"; }
# Runs a child with only the secrets it needs: every name in SECRET_VARS is removed except the ones listed before `--`.
with_only() {
  local keep=() args=() v k
  while [ "$1" != -- ]; do keep+=("$1"); shift; done; shift
  for v in "${SECRET_VARS[@]}"; do
    k=0; for x in "${keep[@]+"${keep[@]}"}"; do [ "$x" = "$v" ] && k=1; done
    [ "$k" = 1 ] || args+=(-u "$v")
  done
  env "${args[@]}" "$@"
}

# Pooler user in PGURL without ever printing a password that may have been pasted into it (#112 1.0).
url_user() { local r="${PGURL#postgresql://}"; r="${r#postgres://}"; r="${r%%@*}"; printf '%s' "${r%%:*}"; }
# 't' when public.users exists, 'f' when not; a query error is a failure (never read as "no table").
has_users() { psqlq -c "select to_regclass('public.users') is not null"; }

# #112 section 1.0 checks: pooler user = postgres.<DEMO_REF>, DB answers, no account outside
# @demo.test/@example.test (skipped only when public.users does not exist), and $DUMP is a readable dump.
pp_gate() {
  local ref n d u
  ref=$(url_user)
  [ -n "${DEMO_REF:-}" ] && [ "$ref" = "postgres.$DEMO_REF" ] || { echo "STOP: PGURL user '$ref' is not postgres.<DEMO_REF>"; return 1; }
  psqlq -c "select current_database(), current_user" >/dev/null || { echo "STOP: cannot connect"; return 1; }
  u=$(has_users) || { echo "STOP: cannot read the catalog"; return 1; }
  if [ "$u" = t ]; then
    n=$(psqlq -c "select count(*) from users where email is not null and lower(email) not like '%@demo.test' and lower(email) not like '%@example.test'") || { echo "STOP: cannot count accounts"; return 1; }
    [ "$n" = 0 ] || { echo "STOP: $n account(s) outside @demo.test/@example.test"; return 1; }
  elif [ "$u" != f ]; then echo "STOP: unexpected catalog answer"; return 1; fi
  d=$(pg_restore -l "$DUMP" 2>/dev/null | grep -c 'TABLE DATA' || true)
  [ "${d:-0}" -gt 0 ] || { echo "STOP: no readable dump at $DUMP"; return 1; }
  echo "GATE OK: postgres.$DEMO_REF, dump $(basename "$DUMP") ($d tables with data)"
}
gate() { pp_gate || nogo "pp_gate refused"; }

COUNTS_SQL="SELECT (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),(SELECT max(migration_name) FROM _prisma_migrations),(SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'),(SELECT count(*) FROM users),(SELECT count(*) FROM users WHERE lower(email) LIKE '%@demo.test'),(SELECT count(*) FROM users WHERE password_hash IS NULL),(SELECT count(*) FROM schools),(SELECT count(*) FROM classrooms),(SELECT count(*) FROM enrolments),(SELECT count(*) FROM exam_attempts),(SELECT count(*) FROM papers),(SELECT count(*) FROM questions),(SELECT count(*) FROM pksk_packages),(SELECT count(*) FROM marketplace_products),(SELECT count(*) FROM battles),(SELECT count(*) FROM practice_sessions)"
GRANTS_SQL="select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role')"

# Lockdown + the two lockdown checks (run sheet step 6 / step 11 "after the restore").
lockdown_and_check() {
  log "Data API grants before lockdown: $(psqlq -c "$GRANTS_SQL")"
  psqlq -q -f "$1" >/dev/null
  expect_eq "$(psqlq -c "$GRANTS_SQL")" 0 "Data API grants after lockdown"
  expect_eq "$(psqlq -c "select has_table_privilege('anon','public.users','SELECT')")" f "anon SELECT on public.users"
}

# ------------------------------------------------------------------------------------------------ setup
setup_work() {
  case "$STUB" in 0 | 1) ;; *) usage_err "PP_DEPLOY_STUB must be 0 or 1" ;; esac
  if [ "$STUB" = 1 ]; then
    in_actions && usage_err "PP_DEPLOY_STUB is for local tests only; it is refused inside GitHub Actions"
    log "STUB MODE: every Render/Cloudflare call is stubbed; nothing leaves this machine."
  fi
  for t in git node npm jq curl openssl gpg; do command -v "$t" >/dev/null || usage_err "$t is required"; done
  WORK="${PP_WORK_DIR:-$(mktemp -d)}"; mkdir -p "$WORK/private" "$WORK/out"; chmod 700 "$WORK" "$WORK/private"
  log "work dir: $WORK"
}

setup_targets() {
  # Steps after the build phase use the PATH recorded before any repository code ran (see the workflow).
  if [ -n "${PP_TRUSTED_PATH:-}" ]; then PATH="$PP_TRUSTED_PATH"; export PATH; hash -r; fi
  need DEMO_REF PGURL PGPASSWORD
  mask "$PGPASSWORD"
  for t in psql pg_dump pg_restore; do command -v "$t" >/dev/null || usage_err "$t is required"; done
  [[ "$DEMO_REF" =~ ^[a-z0-9]{3,40}$ ]] || usage_err "DEMO_REF must be a lowercase project ref"
  [[ "$PGURL" == postgresql://* || "$PGURL" == postgres://* ]] || usage_err "PGURL must start with postgresql://"
  [[ "$PGURL" != *\?* ]] || usage_err "PGURL must have no query string (the script adds the TLS options)"
  local auth="${PGURL#*://}"; auth="${auth%%@*}"
  [[ "$auth" != *:* ]] || usage_err "PGURL must not contain a password (use PGPASSWORD)"
  if [ "$STUB" = 1 ]; then
    local host="${PGURL#*@}"; host="${host%%[:/]*}"
    case "$host" in localhost | 127.0.0.1 | '[::1]') ;; *) usage_err "stub runs only against a loopback database (got a non-local host)" ;; esac
  fi
  if [ -n "${PP_LOCAL_SSLQ:-}" ]; then
    [ "$STUB" = 1 ] || usage_err "PP_LOCAL_SSLQ is accepted only with PP_DEPLOY_STUB=1"
    SSLQ="$PP_LOCAL_SSLQ"
  else
    need SUPABASE_CA_FILE
    [ -s "$SUPABASE_CA_FILE" ] || usage_err "SUPABASE_CA_FILE is missing or empty"
    SSLQ="sslmode=verify-full&sslrootcert=$SUPABASE_CA_FILE"
  fi
  export SSLQ PGPASSWORD
  RENDER_URL="${RENDER_URL:-}"; RENDER_URL="${RENDER_URL%/}"; PAGES_URL="${PAGES_URL:-}"; PAGES_URL="${PAGES_URL%/}"; PAGES_BRANCH="${PAGES_BRANCH:-main}"
  if [ "$STUB" = 0 ]; then
    need RENDER_API_KEY RENDER_SERVICE_ID RENDER_URL CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID PAGES_PROJECT PAGES_URL
    mask "$RENDER_API_KEY"; mask "$CLOUDFLARE_API_TOKEN"
    [[ "$RENDER_URL" == https://* && "$PAGES_URL" == https://* ]] || usage_err "RENDER_URL and PAGES_URL must be https:// URLs"
    [[ "$RENDER_SERVICE_ID" =~ ^srv-[a-z0-9]+$ ]] || usage_err "RENDER_SERVICE_ID must look like srv-..."
    [[ "$PAGES_PROJECT" =~ ^[a-z0-9-]+$ && "$CLOUDFLARE_ACCOUNT_ID" =~ ^[a-f0-9]{32}$ ]] || usage_err "PAGES_PROJECT / CLOUDFLARE_ACCOUNT_ID look wrong"
    printf 'Authorization: Bearer %s\n' "$RENDER_API_KEY" >"$WORK/private/render.h"
    printf 'Authorization: Bearer %s\n' "$CLOUDFLARE_API_TOKEN" >"$WORK/private/cf.h"
  fi
}

save_state() {
  { printf 'EXP_MIG=%s\nEXP_NEWEST=%s\nEXP_Q=%s\n' "$EXP_MIG" "$EXP_NEWEST" "$EXP_Q"
    printf 'STATE_BE=%s\nSTATE_FE=%s\n' "$BACKEND_SHA" "$FRONTEND_SHA"
    [ -n "${DUMP:-}" ] && printf 'DUMP=%s\n' "$DUMP"
    [ -n "${PAGES_PREV:-}" ] && printf 'PAGES_PREV=%s\n' "$PAGES_PREV"
    true; } >"$WORK/state.env"
}
load_state() {
  [ -f "$WORK/state.env" ] || nogo "no state from the earlier phase in $WORK (run PP_PHASE=build first)"
  # Read as data, never sourced: only NAME=value lines with plain characters are accepted.
  local line k v
  while IFS= read -r line; do
    [[ "$line" =~ ^(EXP_MIG|EXP_NEWEST|EXP_Q|STATE_BE|STATE_FE|DUMP|PAGES_PREV)=([A-Za-z0-9._/:@+-]*)$ ]] || nogo "unexpected line in $WORK/state.env"
    k="${BASH_REMATCH[1]}"; v="${BASH_REMATCH[2]}"; printf -v "$k" '%s' "$v"
  done <"$WORK/state.env"
  [ "$STATE_BE" = "$BACKEND_SHA" ] && [ "$STATE_FE" = "$FRONTEND_SHA" ] || nogo "the earlier phase ran for other SHAs"
  BE_DIR="$WORK/be"; SPA_DIR="$WORK/spa"
  expect_eq "$(git -C "$BE_DIR" rev-parse HEAD)" "$BACKEND_SHA" "checkout be"
  expect_eq "$(git -C "$SPA_DIR" rev-parse HEAD)" "$FRONTEND_SHA" "checkout spa"
}

# Postgres client must be at least the server's major (Supabase runs 17; run sheet step 2 asks for 17 tools).
check_pg_client() {
  local srv cli
  srv=$(psqlq -c "show server_version_num"); srv=$((srv / 10000))
  cli=$(pg_dump --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')
  [ "$cli" -ge "$srv" ] || nogo "pg_dump $cli is older than the server ($srv); install the Postgres $srv client"
  log "OK  pg_dump $cli >= server $srv"
}

# ------------------------------------------------------------------------------------------------ Render / Cloudflare
render() { # method path [body-file]
  local args=(-sS --fail-with-body --max-time 60 -H @"$WORK/private/render.h" -H 'Accept: application/json' -X "$1")
  [ -n "${3:-}" ] && args+=(-H 'Content-Type: application/json' --data-binary @"$3")
  curl "${args[@]}" "$RENDER_API$2"
}
cf() { # method path [body-file]
  local args=(-sS --fail-with-body --max-time 60 -H @"$WORK/private/cf.h" -X "$1")
  [ -n "${3:-}" ] && args+=(-H 'Content-Type: application/json' --data-binary @"$3")
  curl "${args[@]}" "$CF_API$2"
}
# wrangler from the build phase's install (installed without secrets); at run time it sees only the Cloudflare token.
wrangler() {
  [ -x "$WORK/wrangler/node_modules/.bin/wrangler" ] || nogo "wrangler is not installed in $WORK/wrangler (build phase)"
  (cd "$WORK/wrangler" && export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID WRANGLER_SEND_METRICS=false && with_only CLOUDFLARE_API_TOKEN -- ./node_modules/.bin/wrangler "$@")
}
# Successful production deployments of the Pages project, newest first: "id commit_hash" per line.
pages_prod_deployments() {
  cf GET "/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PAGES_PROJECT/deployments?env=production" \
    | jq -r '.result[] | select(.latest_stage.status == "success") | "\(.id) \(.deployment_trigger.metadata.commit_hash // "-")"'
}

# Read-only checks of both targets before anything changes: run sheet step 8 table, Render auto-deploy off,
# Pages production branch = PAGES_BRANCH, and the current Pages production deployment (the rollback target).
targets_check() {
  hdr "targets (step 8 table, read-only)"
  if [ "$STUB" = 1 ]; then log "STUB render: GET service + env-vars; STUB pages: GET project + deployments"; PAGES_PREV=stub-deployment; return; fi
  local svc env bad=0 k v n
  svc=$(render GET "/services/$RENDER_SERVICE_ID") || nogo "cannot read the Render service"
  [ "$(jq -r '.autoDeploy' <<<"$svc")" = no ] || nogo "Render auto-deploy is on: turn it off (Settings -> Auto-Deploy: No), so only this workflow deploys"
  log "OK  Render auto-deploy = no"
  env=$(render GET "/services/$RENDER_SERVICE_ID/env-vars?limit=100" | jq -c '[.[].envVar | {key, value}]') || nogo "cannot read the Render environment"
  n=$(jq 'length' <<<"$env"); [ "$n" -lt 100 ] || nogo "100+ Render env vars: pagination not supported here"
  getv() { jq -r --arg k "$1" '(map(select(.key == $k))[0].value) // "<unset>"' <<<"$env"; }
  for kv in BIJAK_POC_QUESTIONS=true AI_PROVIDER=mock NODE_ENV=production COOKIE_SECURE=true TRUST_PROXY_HOPS=2 ALLOW_DEMO_SEED=false LOG_LEVEL=info; do
    k="${kv%%=*}"; v="${kv#*=}"
    if [ "$(getv "$k")" = "$v" ]; then log "OK  $k = $v"; else log "BAD $k must be $v"; bad=1; fi
  done
  local must_set=(DATABASE_URL SESSION_SECRET IC_HASH_KEY PUBLIC_ORIGINS PUBLIC_BASE_URL FILE_STORAGE_DIR)
  [ "${KEEP_EDGE_SECRET:-0}" = 1 ] && must_set+=(EDGE_PROXY_SECRET)
  for k in "${must_set[@]}"; do
    if [ "$(getv "$k")" != '<unset>' ]; then log "OK  $k is set"; else log "BAD $k must be set"; bad=1; fi
  done
  for k in AI_MODEL AI_API_KEY AI_MONTHLY_BUDGET_SEN AI_PRICE_TABLE_JSON MAIL_LOG_RESET_LINKS MARKETPLACE_PLATFORM_WHATSAPP PORT COOKIE_DOMAIN; do
    if [ "$(getv "$k")" = '<unset>' ]; then log "OK  $k is unset"; else log "BAD $k must be unset"; bad=1; fi
  done
  # Prefix rules of the table (INTAKE_* covers INTAKE_TEACHER_ENABLED).
  local unexpected
  unexpected=$(jq -r '.[].key | select(test("^(AI_BASE_URL|JOBS_|OCR_|INTAKE_|THROTTLE_|METRICS_)") or test("_TIMEOUT_MS$"))' <<<"$env")
  if [ -n "$unexpected" ]; then log "BAD must be unset: $(tr '\n' ' ' <<<"$unexpected")"; bad=1; else log "OK  AI_BASE_URL*, JOBS_*, OCR_*, INTAKE_*, THROTTLE_*, METRICS_*, *_TIMEOUT_MS unset"; fi
  [ "$bad" = 0 ] || nogo "the Render environment does not match the run sheet step 8 table (names above)"

  local proj
  proj=$(cf GET "/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PAGES_PROJECT") || nogo "cannot read the Pages project"
  expect_eq "$(jq -r '.result.production_branch' <<<"$proj")" "$PAGES_BRANCH" "Pages production branch (PAGES_BRANCH)"
  PAGES_PREV=$(pages_prod_deployments | head -1 | cut -d' ' -f1) || true
  [ -n "$PAGES_PREV" ] || nogo "no successful Pages production deployment to roll back to"
  log "OK  current Pages production deployment (rollback target): $PAGES_PREV"
}

render_set_env() { # key value (the value travels through env V into a 0600 file, never argv)
  local f="$WORK/private/env.json"
  V="$2" jq -n '{value: env.V}' >"$f"
  render PUT "/services/$RENDER_SERVICE_ID/env-vars/$1" "$f" >/dev/null || { rm -f "$f"; nogo "Render: cannot set $1"; }
  rm -f "$f"; log "OK  Render $1 set"
}

render_deploy() { # sha branch
  local sha="$1" branch="$2" f="$WORK/private/body.json" resp id status commit i before
  hdr "render-deploy ($branch @ ${sha:0:8})"
  if [ "$STUB" = 1 ]; then log "STUB render: PATCH branch=$branch; POST deploy commitId=$sha; poll until live"; return; fi
  if [ "$(render GET "/services/$RENDER_SERVICE_ID" | jq -r '.branch')" != "$branch" ]; then
    jq -n --arg b "$branch" '{branch: $b}' >"$f"
    render PATCH "/services/$RENDER_SERVICE_ID" "$f" >/dev/null || nogo "Render: cannot set the branch to $branch"
    log "OK  Render branch = $branch"
  fi
  before=$(render GET "/services/$RENDER_SERVICE_ID/deploys?limit=20" | jq -r '[.[].deploy.id] | join(" ")') || nogo "Render: cannot list deploys"
  jq -n --arg c "$sha" '{commitId: $c, clearCache: "do_not_clear"}' >"$f"
  resp=$(render POST "/services/$RENDER_SERVICE_ID/deploys" "$f") || nogo "Render: deploy request refused"
  id=$(jq -r '.id // empty' <<<"$resp" 2>/dev/null || true)
  for i in $(seq 1 120); do # 120 x 15 s = 30 min
    if [ -z "$id" ]; then # queued (no body): take only a deploy of this commit that did not exist before the POST
      id=$(render GET "/services/$RENDER_SERVICE_ID/deploys?limit=5" | jq -r --arg c "$sha" --arg b " $before " \
        '[.[].deploy | select(.commit.id == $c) | select(($b | contains(" " + .id + " ")) | not)][0].id // empty') || true
    fi
    if [ -n "$id" ]; then
      resp=$(render GET "/services/$RENDER_SERVICE_ID/deploys/$id") || nogo "Render: cannot read deploy $id"
      status=$(jq -r '.status' <<<"$resp"); commit=$(jq -r '.commit.id // empty' <<<"$resp")
      [ -z "$commit" ] || [ "$commit" = "$sha" ] || nogo "Render deploy $id is commit $commit, expected $sha"
      case "$status" in
        live) log "OK  Render deploy $id live at $sha"; return ;;
        build_failed | update_failed | pre_deploy_failed | canceled | deactivated) nogo "Render deploy $id ended as $status" ;;
      esac
      [ $((i % 4)) = 1 ] && log "... Render deploy $id: $status"
    fi
    sleep 15
  done
  nogo "Render deploy did not become live within 30 min"
}

health_db_up() { # label base-url
  local i body
  for i in $(seq 1 24); do # up to 6 min: a sleeping Render instance can take ~60 s to wake
    body=$(curl -sS --max-time 70 "$2/api/health" 2>/dev/null || true)
    if jq -e '.data.status == "ok" and .data.db == "up"' >/dev/null 2>&1 <<<"$body"; then log "OK  $1 /api/health: db up"; return; fi
    sleep 15
  done
  nogo "$1 /api/health did not show status ok + db up"
}

# ------------------------------------------------------------------------------------------------ deploy: build phase
step_checkout() {
  hdr "checkout (step 1)"
  if [ "${PP_NO_FETCH:-0}" != 1 ]; then
    git -C "$REPO_ROOT" fetch -q origin "+refs/heads/$BE_BRANCH:refs/remotes/origin/$BE_BRANCH" "+refs/heads/$FE_BRANCH:refs/remotes/origin/$FE_BRANCH"
  fi
  git -C "$REPO_ROOT" merge-base --is-ancestor "$BACKEND_SHA" "origin/$BE_BRANCH" || nogo "BACKEND_SHA is not on $BE_BRANCH"
  git -C "$REPO_ROOT" merge-base --is-ancestor "$FRONTEND_SHA" "origin/$FE_BRANCH" || nogo "FRONTEND_SHA is not on $FE_BRANCH"
  log "SHAs OK"
  git -C "$REPO_ROOT" merge-base --is-ancestor "$SPA_SYNC_BASE" "$FRONTEND_SHA" || nogo "SPA branch is not synced ($SPA_SYNC_BASE is not an ancestor of FRONTEND_SHA)"
  log "SPA branch is synced"
  EXP_MIG=$(git -C "$REPO_ROOT" ls-tree --name-only "$BACKEND_SHA" apps/api/prisma/migrations/ | grep -c '/00')
  EXP_NEWEST=$(git -C "$REPO_ROOT" ls-tree --name-only "$BACKEND_SHA" apps/api/prisma/migrations/ | grep '/00' | tail -1 | xargs basename)
  EXP_Q=$(git -C "$REPO_ROOT" cat-file -e "$BACKEND_SHA:apps/api/prisma/seed/questions/pool-content-primary.ts" 2>/dev/null && echo 1271 || echo 503)
  log "expect $EXP_MIG migrations, newest $EXP_NEWEST, questions $EXP_Q"
  BE_DIR="$WORK/be"; SPA_DIR="$WORK/spa"
  git -C "$REPO_ROOT" worktree prune
  for pair in "$BE_DIR:$BACKEND_SHA" "$SPA_DIR:$FRONTEND_SHA"; do
    local dir="${pair%%:*}" sha="${pair#*:}"
    if [ ! -e "$dir/.git" ]; then git -C "$REPO_ROOT" worktree add -q --detach "$dir" "$sha"; fi
    expect_eq "$(git -C "$dir" rev-parse HEAD)" "$sha" "checkout $(basename "$dir")"
  done
  if [ "${PP_SKIP_NPM_CI:-0}" != 1 ]; then (cd "$BE_DIR" && with_only -- npm ci --ignore-scripts --no-audit --no-fund); fi
  (cd "$BE_DIR" && with_only -- npm run -s db:generate -w @pp/api >/dev/null)
  summary "- step 1 checkout: SHAs OK, SPA synced; expect $EXP_MIG migrations ($EXP_NEWEST), $EXP_Q questions"
}

step_spa_build() {
  hdr "spa-build (step 7, before any DB change)"
  if [ "${PP_SKIP_NPM_CI:-0}" != 1 ]; then (cd "$SPA_DIR" && with_only -- npm ci --ignore-scripts --no-audit --no-fund); fi
  rm -rf "$SPA_DIR/dist"
  (cd "$SPA_DIR" && VITE_API_MODE=http with_only -- npx --no-install vite build --mode demo)
  local out
  out=$(cd "$SPA_DIR" && with_only -- node scripts/check-demo-bundle.mjs dist 2>&1) || { log "$out"; nogo "check-demo-bundle failed"; }
  log "$out"; grep -q 'check-demo-bundle: OK' <<<"$out" || nogo "check-demo-bundle did not print OK"
  cp "$SPA_DIR/deploy/pages-direct/_worker.js" "$SPA_DIR/dist/"
  [ -f "$SPA_DIR/dist/index.html" ] && [ -f "$SPA_DIR/dist/_worker.js" ] || nogo "dist/index.html or dist/_worker.js missing"
  git -C "$SPA_DIR" diff --quiet "$BACKEND_SHA" -- deploy/pages-direct/_worker.js scripts/demo-smoke.sh scripts/demo-walkthrough.sh \
    || nogo "the worker or the demo scripts on FRONTEND_SHA differ from BACKEND_SHA"
  log "worker + demo scripts = deploy commit"
  summary "- step 7 SPA: check-demo-bundle OK, worker + demo scripts = deploy commit"
}

step_wrangler_install() {
  hdr "wrangler-install"
  if [ "$STUB" = 1 ]; then log "STUB: wrangler not installed"; return; fi
  mkdir -p "$WORK/wrangler"
  (cd "$WORK/wrangler" && printf '{"private":true}\n' >package.json && with_only -- npm install --ignore-scripts --no-audit --no-fund --save-exact "wrangler@$WRANGLER_VERSION" >/dev/null)
  log "OK  $(cd "$WORK/wrangler" && ./node_modules/.bin/wrangler --version 2>/dev/null | tail -1)"
}

# ------------------------------------------------------------------------------------------------ deploy: backup phase
step_target_and_backup() {
  hdr "db-target (step 2)"
  expect_eq "$(url_user)" "postgres.$DEMO_REF" "pooler user"
  expect_eq "$(psqlq -c "select 'psql: OK'")" 'psql: OK' "connection"
  check_pg_client
  local u; u=$(has_users)
  if [ "$u" = t ]; then
    expect_eq "$(psqlq -c "select count(*) from users where email is not null and lower(email) not like '%@demo.test' and lower(email) not like '%@example.test'")" 0 "non-demo accounts"
    log "migrations before: $(psqlq -c "select count(*), max(migration_name) from _prisma_migrations where finished_at is not null and rolled_back_at is null" 2>/dev/null || echo 'n/a')"
  else
    expect_eq "$u" f "public.users lookup"
    log "public.users does not exist (empty database)"
  fi

  hdr "backup (step 2)"
  [ -n "${BACKUP_GPG_PUBLIC_KEY:-}" ] || nogo "BACKUP_GPG_PUBLIC_KEY is not configured: refusing to continue without an encrypted rollback dump"
  DUMP="$WORK/private/demo-before-$(date -u +%Y%m%d-%H%M%S).dump"
  pg_dump "$PGURL?$SSLQ" -n public -Fc -f "$DUMP"
  local td sp
  td=$(pg_restore -l "$DUMP" | grep -c 'TABLE DATA' || true)
  [ "${td:-0}" -gt 0 ] || nogo "the dump has no TABLE DATA entries"
  log "OK  dump TABLE DATA entries: $td"
  sp=$(pg_restore -l "$DUMP" | grep -c 'SCHEMA - public' || true)
  expect_eq "$sp" 1 "dump SCHEMA - public"
  gate

  hdr "backup-encrypt"
  local gh fprs out keyids enc sha
  gh=$(mktemp -d); chmod 700 "$gh"
  printf '%s\n' "$BACKUP_GPG_PUBLIC_KEY" | GNUPGHOME="$gh" gpg --batch --quiet --import 2>/dev/null || nogo "BACKUP_GPG_PUBLIC_KEY does not import"
  fprs=$(GNUPGHOME="$gh" gpg --batch --with-colons --list-keys | awk -F: '$1=="pub"{p=1;next} p&&$1=="fpr"{print $10;p=0}')
  [ "$(wc -l <<<"$fprs")" = 1 ] && [ -n "$fprs" ] || nogo "BACKUP_GPG_PUBLIC_KEY must hold exactly one public key"
  keyids=$(GNUPGHOME="$gh" gpg --batch --with-colons --list-keys | awk -F: '$1=="pub"||$1=="sub"{print $5}')
  out="$WORK/out/$(basename "$DUMP").gpg"
  GNUPGHOME="$gh" gpg --batch --yes --trust-model always --recipient "$fprs" --output "$out" --encrypt "$DUMP"
  # The ciphertext must be addressed to this key (a key that cannot be found later means no usable rollback).
  enc=$({ GNUPGHOME="$gh" gpg --batch --list-packets "$out" 2>/dev/null || true; } | sed -nE 's/.*pubkey enc packet: .*keyid ([0-9A-F]{16}).*/\1/p' | head -1)
  rm -rf "$gh"
  { [ -s "$out" ] && [ -n "$enc" ] && grep -qx "$enc" <<<"$keyids"; } || nogo "the encrypted dump is not addressed to BACKUP_GPG_PUBLIC_KEY"
  sha=$(sha256sum "$out" | cut -d' ' -f1)
  log "OK  encrypted to key $fprs (subkey $enc): $(basename "$out") sha256 $sha"
  [ -z "${PAGES_PREV:-}" ] || printf '%s\n' "$PAGES_PREV" >"$WORK/out/pages-previous-deployment.txt"
  gh_output backup_dir "$WORK/out"; gh_output backup_ready true
  summary "- step 2 backup: $td tables with data, encrypted to $fprs: \`$(basename "$out")\` sha256 \`$sha\`"
  [ -z "${PAGES_PREV:-}" ] || summary "- Pages rollback target (production deployment before this run): \`$PAGES_PREV\`"
}

# ------------------------------------------------------------------------------------------------ deploy: apply phase
step_reset() {
  hdr "reset (step 3, Path A)"
  gate
  psqlq -q -c "SET client_min_messages = warning; BEGIN; DROP SCHEMA public CASCADE; CREATE SCHEMA public; COMMIT;" >/dev/null
  expect_eq "$(psqlq -c "select count(*) from information_schema.tables where table_schema = 'public'")" 0 "tables in public after reset"
  # Close the Data API window at once (step 6 runs the lockdown again after the migrations and the seed).
  psqlq -q -f "$BE_DIR/scripts/supabase/lockdown-data-api.sql" >/dev/null
  log "OK  lockdown applied to the empty public schema"
}

step_migrate() {
  hdr "migrate (step 4)"
  local out
  export DATABASE_URL="$PGURL?$SSLQ"
  out=$(cd "$BE_DIR" && with_only PGPASSWORD DATABASE_URL -- node scripts/demo-db-delta.mjs --dry-run 2>&1) || { log "$out"; nogo "delta dry run failed"; }
  log "$out"
  if [ "$PP_MODE" = reset ]; then grep -q "Dry run: $EXP_MIG migration(s) would be applied" <<<"$out" || nogo "dry run does not say $EXP_MIG migration(s) would be applied"; fi
  out=$(cd "$BE_DIR" && with_only PGPASSWORD DATABASE_URL -- node scripts/demo-db-delta.mjs 2>&1) || { log "$out"; nogo "delta apply failed"; }
  log "$out"
  if [ "$PP_MODE" = reset ]; then grep -q "Done: $EXP_MIG migration(s) applied" <<<"$out" || nogo "apply did not say Done: $EXP_MIG migration(s) applied"; fi
  out=$(cd "$BE_DIR" && with_only PGPASSWORD DATABASE_URL -- node scripts/demo-db-delta.mjs 2>&1) || { log "$out"; nogo "delta re-check failed"; }
  grep -q 'Up to date: no migration to apply.' <<<"$out" || { log "$out"; nogo "a third run is not 'Up to date'"; }
  log "OK  Up to date: no migration to apply."
}

step_seed() {
  hdr "seed (step 5)"
  local out
  SEED_DEMO_PASSWORD_HASH=$(cd "$BE_DIR/apps/api" && with_only DEMO_PASSWORD -- node -e "require('@node-rs/argon2').hash(process.env.DEMO_PASSWORD,{memoryCost:19456,timeCost:2,parallelism:1}).then(h=>process.stdout.write(h))")
  [[ "$SEED_DEMO_PASSWORD_HASH" == \$argon2id\$* ]] || nogo "the demo password hash is not argon2id"
  mask "$SEED_DEMO_PASSWORD_HASH"
  export SEED_DEMO_PASSWORD_HASH
  out=$(cd "$BE_DIR" && NODE_ENV=production ALLOW_DEMO_SEED=true BIJAK_POC_QUESTIONS=true with_only PGPASSWORD DATABASE_URL SEED_DEMO_PASSWORD_HASH -- npm run -s be:db:seed -- --profile=poc 2>&1) || { log "$out"; nogo "seed failed"; }
  unset SEED_DEMO_PASSWORD_HASH
  log "$out"
  grep -qF "$EXPECT_SEED_LINE" <<<"$out" || nogo "seed did not print '$EXPECT_SEED_LINE'"
}

step_lockdown_counts() {
  unset DATABASE_URL
  hdr "lockdown-counts (step 6)"
  lockdown_and_check "$BE_DIR/scripts/supabase/lockdown-data-api.sql"
  local got expect
  got=$(psqlq -F ' | ' -c "$COUNTS_SQL")
  expect="$EXP_MIG | $EXP_NEWEST | ${EXPECT_COUNTS_TAIL/@Q@/$EXP_Q}"
  log "expect: $expect"; log "got:    $got"
  if [ "$PP_MODE" = reset ]; then
    [ "$got" = "$expect" ] || nogo "the counts line differs from the expect line"
  else
    # redeploy keeps the demo data (writes since the last reset change the row counts): only the migration fields must match.
    [ "$(cut -d'|' -f1-2 <<<"$got")" = "$(cut -d'|' -f1-2 <<<"$expect")" ] || nogo "migrations count/newest differ from the expect line"
  fi
  log "OK  counts"
  summary "- step 6 counts: \`$got\`; grants 0; anon SELECT f"
}

step_edge_and_env() {
  hdr "edge-secret + render-env (step 8)"
  if [ "${KEEP_EDGE_SECRET:-0}" = 1 ]; then
    log "KEEP_EDGE_SECRET=1: EDGE_PROXY_SECRET is left as it is on both sides"
  else
    local edge; edge=$(openssl rand -hex 32); mask "$edge"
    if [ "$STUB" = 1 ]; then
      log "STUB pages: wrangler pages secret put EDGE_PROXY_SECRET (fresh 64-hex value, not printed)"
      log "STUB render: PUT env-vars/EDGE_PROXY_SECRET (same value)"
    else
      printf '%s' "$edge" | wrangler pages secret put EDGE_PROXY_SECRET --project-name "$PAGES_PROJECT" >/dev/null || nogo "wrangler pages secret put failed"
      log "OK  Pages EDGE_PROXY_SECRET set (new value, not printed)"
      render_set_env EDGE_PROXY_SECRET "$edge"
    fi
    unset edge
  fi
  if [ "$STUB" = 1 ]; then log "STUB render: PUT env-vars/CLIENT_IP_HEADER=x-pp-client-ip"; else render_set_env CLIENT_IP_HEADER x-pp-client-ip; fi
}

base_url() { if [ "$STUB" = 1 ]; then printf '%s' "${PP_STUB_BASE_URL%/}"; else printf '%s' "$PAGES_URL"; fi; }

step_deploy_targets() {
  render_deploy "$BACKEND_SHA" "$BE_BRANCH"
  hdr "render-health (step 9.3)"
  if [ "$STUB" = 1 ]; then log "STUB render: health skipped"; else health_db_up Render "$RENDER_URL"; fi
  hdr "pages-deploy (step 9.4)"
  if [ "$STUB" = 1 ]; then
    log "STUB pages: wrangler pages deploy $SPA_DIR/dist --branch $PAGES_BRANCH --commit-hash $FRONTEND_SHA"
  else
    wrangler pages deploy "$SPA_DIR/dist" --project-name "$PAGES_PROJECT" --branch "$PAGES_BRANCH" \
      --commit-hash "$FRONTEND_SHA" --commit-message "deploy-demo ${FRONTEND_SHA:0:8} / api ${BACKEND_SHA:0:8}" --commit-dirty=true \
      || nogo "wrangler pages deploy failed"
    # The upload must be the deployment production now serves (a preview upload would leave the old SPA live).
    local top i
    for i in $(seq 1 12); do
      top=$(pages_prod_deployments | head -1) || true
      [ "${top#* }" = "$FRONTEND_SHA" ] && break
      sleep 10
    done
    [ "${top#* }" = "$FRONTEND_SHA" ] || nogo "the newest successful production deployment is not FRONTEND_SHA (got '${top:-none}')"
    log "OK  Pages production deployment ${top%% *} = $FRONTEND_SHA"
    summary "- Pages production deployment \`${top%% *}\` at ${FRONTEND_SHA:0:8}"
  fi
  hdr "pages-health (step 9.5)"
  if [ "$STUB" = 1 ] && [ -z "${PP_STUB_BASE_URL:-}" ]; then log "STUB pages: health skipped"; else health_db_up Pages "$(base_url)"; fi
}

run_check() { # name expected-substring expected-exit -- command...  (the command sees only DEMO_PASSWORD)
  local name="$1" want="$2" want_rc="$3" out rc=0; shift 4
  hdr "$name (step 10)"
  out=$(with_only DEMO_PASSWORD -- "$@" 2>&1) || rc=$?
  log "$out"
  grep -qF "$want" <<<"$out" || nogo "expected '$want' (exit $want_rc), got exit $rc: $(grep -E 'Result|passed' <<<"$out" | tail -1)"
  [ "$rc" = "$want_rc" ] || nogo "expected exit $want_rc, got $rc"
  if [ "$want_rc" = 0 ] && [[ "$name" == walkthrough-* ]]; then grep -q '^GO: no FAIL' <<<"$out" || nogo "the walkthrough did not print GO"; fi
  log "OK  $want (exit $rc)"
  summary "- $name: $want (exit $rc)"
}

step_smoke_walkthrough() {
  if [ "$STUB" = 1 ] && [ -z "${PP_STUB_BASE_URL:-}" ]; then
    hdr "smoke + walkthrough (step 10)"; log "STUB: skipped (no PP_STUB_BASE_URL)"; return
  fi
  local b; b=$(base_url)
  run_check smoke "$EXPECT_SMOKE" 0 -- env BASE_URL="$b" bash "$BE_DIR/scripts/demo-smoke.sh"
  run_check walkthrough-read-only "$EXPECT_WALK_RO" 3 -- env BASE_URL="$b" BUILD_SHA="${BACKEND_SHA:0:8}" STRICT_EXEMPT="" bash "$BE_DIR/scripts/demo-walkthrough.sh"
  if [ "$PP_MODE" = reset ]; then
    # CONFIRM_DELAY=0: the 5 s "Ctrl-C to stop" pause is for a person at a terminal; the target was checked above.
    run_check walkthrough-writes "$EXPECT_WALK_RW" 0 -- env BASE_URL="$b" BUILD_SHA="${BACKEND_SHA:0:8}" STRICT_EXEMPT="" CONFIRM_WRITES=1 CONFIRM_DELAY=0 bash "$BE_DIR/scripts/demo-walkthrough.sh"
  else
    log "redeploy: the write walkthrough runs once per DB refresh (reset mode) only"
  fi
}

cmd_deploy() {
  need BACKEND_SHA FRONTEND_SHA
  is_sha "$BACKEND_SHA" || usage_err "BACKEND_SHA must be a full 40-hex commit"
  is_sha "$FRONTEND_SHA" || usage_err "FRONTEND_SHA must be a full 40-hex commit"
  PP_MODE="${PP_MODE:-reset}"; PHASE="${PP_PHASE:-all}"
  case "$PP_MODE" in reset | redeploy) ;; *) usage_err "PP_MODE must be reset or redeploy" ;; esac
  case "$PHASE" in all | build | backup | apply) ;; *) usage_err "PP_PHASE must be all, build, backup or apply" ;; esac
  [ "$PHASE" = all ] || [ -n "${PP_WORK_DIR:-}" ] || usage_err "split phases need PP_WORK_DIR"
  setup_work

  if [ "$PHASE" = all ] || [ "$PHASE" = build ]; then
    summary "### deploy-demo ($PP_MODE): api ${BACKEND_SHA:0:8}, spa ${FRONTEND_SHA:0:8}"
    summary "- tooling: \`$(git -C "$REPO_ROOT" rev-parse HEAD)\`, deploy-demo.sh sha256 \`$(sha256sum "$SCRIPT_DIR/deploy-demo.sh" | cut -d' ' -f1)\`"
    step_checkout
    step_spa_build              # a build failure stops the run before the DB is touched
    step_wrangler_install
    save_state
  fi
  if [ "$PHASE" = all ] || [ "$PHASE" = backup ]; then
    load_state
    setup_targets
    targets_check               # read-only; before anything changes
    step_target_and_backup
    save_state
  fi
  if [ "$PHASE" = all ] || [ "$PHASE" = apply ]; then
    need DEMO_PASSWORD
    mask "$DEMO_PASSWORD"
    load_state
    [ -n "${DUMP:-}" ] && [ -s "$DUMP" ] && [ -s "$WORK/out/$(basename "$DUMP").gpg" ] || nogo "no encrypted backup from the backup phase"
    setup_targets
    if [ "$PP_MODE" = reset ]; then step_reset; fi
    step_migrate
    if [ "$PP_MODE" = reset ]; then step_seed; fi
    step_lockdown_counts
    step_edge_and_env
    step_deploy_targets
    step_smoke_walkthrough
    STEP=finished
    if [ "$STUB" = 1 ]; then
      log ""; log "STUB RUN COMPLETE ($PP_MODE): DB, seed, counts, build and gate path passed; Render/Cloudflare were stubbed. Not a GO."
      return
    fi
    log ""; log "GO ($PP_MODE): api $BACKEND_SHA, spa $FRONTEND_SHA. Next: the browser go/no-go (run sheet step 11) and the two-network login check."
    summary "**GO ($PP_MODE)**. Next: run sheet step 11 in the browser, two-network login check, Render log has no ClientIp warning."
  else
    log ""; log "PHASE $PHASE OK"
  fi
}

# ------------------------------------------------------------------------------------------------ rollback (#112 6)
cmd_rollback() {
  setup_work
  setup_targets
  local sha="${ROLLBACK_RENDER_SHA:-$ROLLBACK_SHA_DEFAULT}" branch="${ROLLBACK_RENDER_BRANCH:-be/demo-deploy-2}" restore="${RESTORE_DB:-1}"
  is_sha "$sha" || usage_err "ROLLBACK_RENDER_SHA must be a full 40-hex commit"
  [[ "$branch" =~ ^[A-Za-z0-9._/-]+$ ]] || usage_err "ROLLBACK_RENDER_BRANCH has unexpected characters"
  case "$restore" in 0 | 1) ;; *) usage_err "RESTORE_DB must be 0 or 1" ;; esac
  summary "### rollback-demo: render ${sha:0:8} ($branch), restore_db=$restore"

  if [ "$restore" = 1 ]; then # decrypt and gate first: a bad dump stops the rollback before anything changes
    hdr "restore-prepare"
    need ROLLBACK_DUMP_GPG BACKUP_GPG_PRIVATE_KEY
    [ -s "$ROLLBACK_DUMP_GPG" ] || nogo "no encrypted dump at ROLLBACK_DUMP_GPG"
    log "dump: $(basename "$ROLLBACK_DUMP_GPG") sha256 $(sha256sum "$ROLLBACK_DUMP_GPG" | cut -d' ' -f1) (compare with the deploy run summary)"
    local gh; gh=$(mktemp -d); chmod 700 "$gh"
    printf '%s\n' "$BACKUP_GPG_PRIVATE_KEY" | GNUPGHOME="$gh" gpg --batch --quiet --import 2>/dev/null || nogo "BACKUP_GPG_PRIVATE_KEY does not import"
    DUMP="$WORK/private/restore.dump"
    if [ -n "${BACKUP_GPG_PASSPHRASE:-}" ]; then
      printf '%s' "$BACKUP_GPG_PASSPHRASE" | GNUPGHOME="$gh" gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --output "$DUMP" --decrypt "$ROLLBACK_DUMP_GPG" 2>/dev/null || nogo "cannot decrypt the dump"
    else
      GNUPGHOME="$gh" gpg --batch --yes --output "$DUMP" --decrypt "$ROLLBACK_DUMP_GPG" 2>/dev/null || nogo "cannot decrypt the dump"
    fi
    rm -rf "$gh"
    expect_eq "$(pg_restore -l "$DUMP" | grep -c 'SCHEMA - public' || true)" 1 "dump SCHEMA - public"
    # Only the public schema, as pg_dump -n public wrote it.
    [ "$(pg_restore -l "$DUMP" | grep -vE '^;|^$' | grep -cvE ' public ' || true)" = 0 ] || nogo "the dump holds objects outside schema public"
    check_pg_client
    gate
  fi

  hdr "pages-rollback"
  if [ "$STUB" = 1 ]; then log "STUB pages: POST deployments/<previous>/rollback"; else
    local dep="${ROLLBACK_PAGES_DEPLOYMENT_ID:-}"
    [ -n "$dep" ] || dep=$(pages_prod_deployments | sed -n 2p | cut -d' ' -f1) || true
    [[ "$dep" =~ ^[A-Za-z0-9-]+$ ]] || nogo "no previous Pages deployment found (set pages_deployment_id)"
    local live; live=$(pages_prod_deployments | head -1 | cut -d' ' -f1) || true
    if [ "$live" = "$dep" ]; then
      log "OK  Pages deployment $dep is already live (the deploy never reached pages-deploy): nothing to roll back"
    else
    cf POST "/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PAGES_PROJECT/deployments/$dep/rollback" | jq -e '.success == true' >/dev/null || nogo "Pages rollback to $dep refused"
    log "OK  Pages rolled back to deployment $dep"; summary "- Pages rolled back to \`$dep\`"
    fi
  fi

  hdr "render-env (#112 6: remove CLIENT_IP_HEADER with the edge rollback)"
  if [ "$STUB" = 1 ]; then log "STUB render: DELETE env-vars/CLIENT_IP_HEADER"; else
    render DELETE "/services/$RENDER_SERVICE_ID/env-vars/CLIENT_IP_HEADER" >/dev/null 2>&1 || true
    [ "$(render GET "/services/$RENDER_SERVICE_ID/env-vars?limit=100" | jq '[.[].envVar | select(.key == "CLIENT_IP_HEADER")] | length')" = 0 ] \
      || nogo "CLIENT_IP_HEADER is still set on Render"
    log "OK  Render CLIENT_IP_HEADER removed (EDGE_PROXY_SECRET stays, #112 6)"
  fi

  render_deploy "$sha" "$branch"

  if [ "$restore" = 1 ]; then
    hdr "db-restore (#112 6: only together with the API rollback)"
    gate
    psqlq -q -c "SET client_min_messages = warning; BEGIN; DROP SCHEMA public CASCADE; COMMIT;" >/dev/null   # do NOT re-create public: the dump does
    gate
    pg_restore --no-owner --no-privileges --exit-on-error -d "$PGURL?$SSLQ" "$DUMP" || nogo "pg_restore failed: the DB is in a half state; re-run the rollback"
    lockdown_and_check "$REPO_ROOT/scripts/supabase/lockdown-data-api.sql"
    log "counts after restore: $(psqlq -F ' | ' -c "$COUNTS_SQL" 2>/dev/null || echo 'n/a')"
    rm -f "$DUMP"
  else
    log "RESTORE_DB=0: database left as it is"
  fi

  hdr "rollback-health"
  if [ "$STUB" = 1 ]; then log "STUB: health skipped"; else health_db_up Render "$RENDER_URL"; health_db_up Pages "$PAGES_URL"; fi
  STEP=finished
  log ""; log "ROLLBACK DONE: render ${sha:0:8} ($branch), restore_db=$restore$([ "$STUB" = 1 ] && echo ' (STUB: targets not called)')"
  summary "**ROLLBACK DONE**"
}

case "$CMD" in
  deploy) cmd_deploy ;;
  rollback) cmd_rollback ;;
  *) usage_err "usage: scripts/deploy-demo.sh deploy|rollback (see the header for the environment)" ;;
esac
