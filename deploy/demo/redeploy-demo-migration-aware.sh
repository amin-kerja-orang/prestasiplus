#!/usr/bin/env bash
# Migration-aware redeploy of the cloud demo (Render API + Cloudflare Pages SPA + Supabase DB).
# Run sheet: docs/ops/demo-redeploy-migration-aware.md. Background: docs/ops/demo-deploy-23oct.md (#112),
# docs/ops/demo-cloudflare-supabase.md, docs/ops/demo-reseed.md, docs/ops/db-backup.md.
#
# Why this script exists
#   scripts/deploy-demo.sh (PP_MODE=redeploy) assumes code-only: its rollback is "Render back to the old commit,
#   Pages back to the previous deployment, database untouched". That promise dies the moment a migration is applied:
#   code rolls back, a schema does not. This script is the path for a redeploy that DOES carry new migrations.
#   It takes a database snapshot FIRST and its rollback restores that snapshot, so the five-minute rollback holds.
#
#   deploy/demo/redeploy-demo-migration-aware.sh plan      # read-only: tips, new merge commits, migration plan
#   deploy/demo/redeploy-demo-migration-aware.sh run       # snapshot -> migrate -> API -> SPA -> smoke (auto rollback)
#   deploy/demo/redeploy-demo-migration-aware.sh run --no-snapshot   # forward-only; rollback is NOT possible
#   deploy/demo/redeploy-demo-migration-aware.sh rollback  # manual rollback (code, and the snapshot if there is one)
#
# Exit codes: 0 = done, 1 = NO-GO (something failed; the NEXT block says what to do), 2 = usage/input error,
#             3 = nothing to do (no new migration: use the plain redeploy).
#
# AI sessions never run this against the cloud. It is written and rehearsed locally (PP_DEMO_STUB=1 against a
# throwaway Postgres); the LEAD runs it against Render/Supabase/Cloudflare.
#
# Inputs (environment only; secrets never come from argv and are never printed)
#   PP_RUNNING_BACKEND_SHA   the commit Render serves now (40-hex; default: the backend the demo runs today)
#   PP_RUNNING_BRANCH        the branch Render serves now (default feature/v2-backend) - the rollback target
#   BACKEND_SHA              API commit to deploy    (default: the tip of BE_BRANCH, read at run time)
#   FRONTEND_SHA             SPA commit to build     (default: the tip of FE_BRANCH, read at run time)
#   DEMO_REF                 Supabase project ref of the demo project (the gate checks the pooler user against it)
#   PGURL                    session pooler URL WITHOUT password and WITHOUT query string
#   PGPASSWORD               Supabase DB password                              (secret; silent prompt if unset)
#   DEMO_PASSWORD            demo persona password                             (secret; silent prompt if unset)
#   SUPABASE_CA_FILE         Supabase CA certificate (sslmode=verify-full)
#   SNAPSHOT_DIR             where the snapshot goes (default ~/pp-demo-snapshots; refused inside the repo)
#   RENDER_API_KEY, RENDER_SERVICE_ID, RENDER_URL                              (key: secret)
#   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, PAGES_PROJECT, PAGES_URL, PAGES_BRANCH (default main)
#   KEEP_EDGE_SECRET         1 (default) keeps EDGE_PROXY_SECRET on both sides; 0 rotates it (see the run sheet)
#
# Expected results - env-overridable, never hard-coded counts (the totals move as PRs merge):
#   PP_EXPECT_SMOKE          default 'Result: 29 passed, 0 failed'
#   PP_EXPECT_WALK_RO        default ': 102 passed, 0 failed, 5 skipped'
#   PP_EXPECT_WALK_RO_EXIT   default 3  (a read-only walkthrough ends with blocking SKIPs: normal)
#   PP_EXPECT_MIGRATIONS / PP_EXPECT_NEWEST  default: counted from the tree at BACKEND_SHA at run time
#
# Snapshot verification:
#   PP_SNAPSHOT_VERIFY       inventory (default) | restore
#     inventory: header, object list, exactly one `SCHEMA - public`, nothing outside public, and every non-empty
#                public base table in the live DB present as TABLE DATA in the dump.
#     restore:   inventory, plus a real pg_restore into a THROWAWAY Postgres (PP_VERIFY_PG_URL, loopback only)
#                and an exact per-table row-count comparison with the live DB. The strongest proof; use it.
#   PP_VERIFY_PG_URL         postgresql://user@127.0.0.1:PORT/<name>_snapcheck of the throwaway server
#
# Escape hatches (each one prints why it was needed):
#   PP_ACCEPT_DRIFT=1        the DB's pending set differs from the git delta: proceed anyway
#   PP_ACCEPT_DOWNTIME=1     a pending migration is not backward compatible with the running API: accept the window
#   PP_ASSUME_YES=1          skip the typed GO confirm of the DEFAULT path (never the --no-snapshot one)
#
# Local rehearsal:
#   PP_DEMO_STUB=1           stub every Render/Cloudflare call; loopback PGURL only; nothing leaves the machine
#   PP_LOCAL_SSLQ            e.g. sslmode=disable (accepted only with PP_DEMO_STUB=1)
#   PP_NO_FETCH=1            use the refs already in the clone
#   PP_SKIP_NPM_CI=1 / PP_SKIP_SPA_BUILD=1   reuse an existing PP_WORK_DIR / skip the SPA build
#   PP_WORK_DIR              work dir (default: a fresh mktemp -d)
set -Eeuo pipefail
umask 077

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd -P)

BE_BRANCH="${PP_BE_BRANCH:-feature/v2-backend}"
FE_BRANCH="${PP_FE_BRANCH:-be/integration-frontend}"
RUNNING_SHA="${PP_RUNNING_BACKEND_SHA:-6d0330a9aa8dbb309e7c98b0436f01aba7fe0809}"
RUNNING_BRANCH="${PP_RUNNING_BRANCH:-feature/v2-backend}"
RENDER_API='https://api.render.com/v1'
CF_API='https://api.cloudflare.com/client/v4'
WRANGLER_VERSION='4.148.0'
STUB="${PP_DEMO_STUB:-0}"
SNAPSHOT_MODE=snapshot            # snapshot | none  (--no-snapshot)
STEP=init
SNAPSHOT=''                       # set once the dump exists
PAGES_PREV=''                     # Pages production deployment before this run (the rollback target)
PENDING=''                        # migrations the live database still needs
COMPAT=''                         # additive | breaking
MIGRATED=0                        # 1 once a migration has been applied
API_DEPLOYED=0
SPA_DEPLOYED=0

EXPECT_SMOKE="${PP_EXPECT_SMOKE:-Result: 29 passed, 0 failed}"
EXPECT_WALK_RO="${PP_EXPECT_WALK_RO:-: 102 passed, 0 failed, 5 skipped}"
EXPECT_WALK_RO_EXIT="${PP_EXPECT_WALK_RO_EXIT:-3}"
EXPECT_MIGRATIONS=''
EXPECT_NEWEST=''
SECRET_VARS=(PGPASSWORD PGURL DATABASE_URL DEMO_PASSWORD RENDER_API_KEY CLOUDFLARE_API_TOKEN SEED_DEMO_PASSWORD_HASH PP_VERIFY_PG_URL)

# ------------------------------------------------------------------------------------------------ output
log()  { printf '%s\n' "$*"; }
hdr()  { STEP="$1"; printf '\n== %s ==\n' "$1"; }
ok()   { printf 'OK   %s\n' "$*"; }
bad()  { printf 'BAD  %s\n' "$*"; }
NEXT='Nothing has been changed yet. Re-run when the inputs are ready.'
NEXT_AT=''                        # the step that set NEXT, so a stale hint is never printed after a failure
next() { NEXT="$*"; NEXT_AT="$STEP"; }
# What the operator must do after a failure in the CURRENT step, when that step set no hint of its own.
next_from_state() {
  if [ "$MIGRATED" = 0 ] && [ "$API_DEPLOYED" = 0 ] && [ "$SPA_DEPLOYED" = 0 ]; then
    next "Nothing was changed. Fix the problem named above and re-run."
  elif [ -n "$SNAPSHOT" ]; then
    next "The demo is part way through a redeploy. Roll it back now: ROLLBACK_SNAPSHOT=$SNAPSHOT $0 rollback"
  else
    next "The demo is part way through a FORWARD-ONLY redeploy and there is no snapshot. Code can go back with '$0 rollback' (RESTORE_DB=0); the schema cannot. Agree the next step with the LEAD before anybody uses the demo."
  fi
}
summary() { [ -z "${GITHUB_STEP_SUMMARY:-}" ] || printf '%s\n' "$*" >>"$GITHUB_STEP_SUMMARY"; }
in_actions() { [ "${GITHUB_ACTIONS:-}" = true ]; }
mask() { if in_actions && [ -n "${1:-}" ]; then printf '::add-mask::%s\n' "$1"; fi; }
usage_err() { printf 'redeploy-demo-migration-aware: %s\n' "$*" >&2; RC_SEEN=2; exit 2; }

# Every exit goes through this: the operator always learns the state and the next action.
RC_SEEN=''
on_exit() {
  local rc="${RC_SEEN:-$?}"
  printf '\n-------------------------------------------------------------------------------\n'
  printf 'STATE    step=%s  migrated=%s  api_deployed=%s  spa_deployed=%s\n' "$STEP" "$MIGRATED" "$API_DEPLOYED" "$SPA_DEPLOYED"
  if [ -n "$SNAPSHOT" ]; then printf 'SNAPSHOT %s\n' "$SNAPSHOT"
  elif [ "$SNAPSHOT_MODE" = none ]; then printf 'SNAPSHOT none (--no-snapshot): a database rollback is NOT possible\n'
  else printf 'SNAPSHOT none yet\n'; fi
  printf 'EXIT     %s\nNEXT     %s\n' "$rc" "$NEXT"
  printf -- '-------------------------------------------------------------------------------\n'
}
trap on_exit EXIT
nogo() {
  RC_SEEN=1
  [ "$NEXT_AT" = "$STEP" ] || next_from_state
  printf 'NO-GO: %s: %s\n' "$STEP" "$*"; summary "**NO-GO: $STEP**: $*"; exit 1
}
on_err() {
  local rc=$?
  [ "$BASH_SUBSHELL" = 0 ] || exit "$rc"
  RC_SEEN=1
  [ "$NEXT_AT" = "$STEP" ] || next_from_state
  printf 'NO-GO: %s: command failed (exit %s, line %s)\n' "$STEP" "$rc" "${BASH_LINENO[0]}"; exit 1
}
trap on_err ERR

# ------------------------------------------------------------------------------------------------ small helpers
need() { local v; for v in "$@"; do [ -n "${!v:-}" ] || usage_err "set $v"; done; }
is_sha() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }
expect_eq() { [ "$1" = "$2" ] || nogo "$3: got '$1', expected '$2'"; ok "$3 = $2"; }
n_lines() { if [ -n "$1" ]; then grep -c . <<<"$1"; else echo 0; fi; }   # non-empty lines of a newline list
indent()  { printf '%s\n' "${1:-(none)}" | sed 's/^/  /'; }
psqlq() { psql "$PGURL?$SSLQ" -X -v ON_ERROR_STOP=1 -At "$@"; }

# Runs a child with only the secrets named before `--`.
with_only() {
  local keep=() args=() v x k
  while [ "$1" != -- ]; do keep+=("$1"); shift; done; shift
  for v in "${SECRET_VARS[@]}"; do
    k=0; for x in "${keep[@]+"${keep[@]}"}"; do [ "$x" = "$v" ] && k=1; done
    [ "$k" = 1 ] || args+=(-u "$v")
  done
  env "${args[@]}" "$@"
}

# Reads a secret from the terminal, never from argv, never echoed.
ask_secret() { # var-name prompt
  local v="$1" p="$2" val
  if [ -n "${!v:-}" ]; then mask "${!v}"; return; fi
  [ -t 0 ] || usage_err "$v is not set and there is no terminal to ask on"
  read -rsp "$p" val </dev/tty; printf '\n'
  [ -n "$val" ] || usage_err "$v must not be empty"
  printf -v "$v" '%s' "$val"; export "${v?}"; mask "$val"; unset val
}

# A typed confirmation, from the terminal only.
confirm_word() { # word prompt
  local want="$1" got
  [ -t 0 ] || usage_err "this run needs a typed confirmation and there is no terminal (refusing)"
  read -rp "$2" got </dev/tty
  if [ "$got" != "$want" ]; then
    RC_SEEN=2; log "not confirmed (expected '$want')"
    next "Nothing was changed. Re-run and type $want when you mean it."
    exit 2
  fi
}

# ------------------------------------------------------------------------------------------------ setup
setup_work() {
  case "$STUB" in 0 | 1) ;; *) usage_err "PP_DEMO_STUB must be 0 or 1" ;; esac
  if [ "$STUB" = 1 ]; then
    ! in_actions || usage_err "PP_DEMO_STUB is for local rehearsals only; it is refused inside GitHub Actions"
    log "STUB MODE: every Render/Cloudflare call is stubbed; nothing leaves this machine."
  fi
  local t
  for t in git node npm jq curl psql pg_dump pg_restore sha256sum; do
    command -v "$t" >/dev/null || usage_err "$t is required"
  done
  WORK="${PP_WORK_DIR:-$(mktemp -d)}"
  mkdir -p "$WORK/private" "$WORK/out"; chmod 700 "$WORK" "$WORK/private"
  log "work dir: $WORK"
}

setup_db() {
  need DEMO_REF PGURL
  ask_secret PGPASSWORD 'Supabase DB password (vault): '
  [[ "$DEMO_REF" =~ ^[a-z0-9]{3,40}$ ]] || usage_err "DEMO_REF must be a lowercase project ref"
  [[ "$PGURL" == postgresql://* || "$PGURL" == postgres://* ]] || usage_err "PGURL must start with postgresql://"
  [[ "$PGURL" != *\?* ]] || usage_err "PGURL must carry no query string (this script adds the TLS options)"
  local auth="${PGURL#*://}"; auth="${auth%%@*}"
  [[ "$auth" != *:* ]] || usage_err "PGURL must carry no password (use PGPASSWORD)"
  if [ "$STUB" = 1 ]; then
    local host="${PGURL#*@}"; host="${host%%[:/]*}"
    case "$host" in localhost | 127.0.0.1 | '[::1]') ;; *) usage_err "a stub run is only allowed against a loopback database" ;; esac
  fi
  if [ -n "${PP_LOCAL_SSLQ:-}" ]; then
    [ "$STUB" = 1 ] || usage_err "PP_LOCAL_SSLQ is accepted only with PP_DEMO_STUB=1"
    SSLQ="$PP_LOCAL_SSLQ"
  else
    need SUPABASE_CA_FILE
    [ -s "$SUPABASE_CA_FILE" ] || usage_err "SUPABASE_CA_FILE is missing or empty"
    SSLQ="sslmode=verify-full&sslrootcert=$SUPABASE_CA_FILE"
  fi
  export SSLQ PGPASSWORD
  expect_eq "$(psqlq -c "select 'psql: OK'")" 'psql: OK' "database connection"
  # The dump must be written by a client at least as new as the server (Supabase runs 17).
  local srv cli
  srv=$(psqlq -c "show server_version_num"); srv=$((srv / 10000))
  cli=$(pg_dump --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')
  [ "$cli" -ge "$srv" ] || nogo "pg_dump $cli is older than the server ($srv): install the Postgres $srv client tools"
  ok "pg_dump $cli >= server $srv"
}

setup_cloud() {
  RENDER_URL="${RENDER_URL:-}"; RENDER_URL="${RENDER_URL%/}"
  PAGES_URL="${PAGES_URL:-}";   PAGES_URL="${PAGES_URL%/}"
  PAGES_BRANCH="${PAGES_BRANCH:-main}"
  KEEP_EDGE_SECRET="${KEEP_EDGE_SECRET:-1}"
  case "$KEEP_EDGE_SECRET" in 0 | 1) ;; *) usage_err "KEEP_EDGE_SECRET must be 0 or 1" ;; esac
  [ "$STUB" = 0 ] || return 0
  need RENDER_API_KEY RENDER_SERVICE_ID RENDER_URL CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID PAGES_PROJECT PAGES_URL
  mask "$RENDER_API_KEY"; mask "$CLOUDFLARE_API_TOKEN"
  [[ "$RENDER_URL" == https://* && "$PAGES_URL" == https://* ]] || usage_err "RENDER_URL and PAGES_URL must be https:// URLs"
  [[ "$RENDER_SERVICE_ID" =~ ^srv-[a-z0-9]+$ ]] || usage_err "RENDER_SERVICE_ID must look like srv-..."
  [[ "$PAGES_PROJECT" =~ ^[a-z0-9-]+$ ]] || usage_err "PAGES_PROJECT looks wrong"
  [[ "$CLOUDFLARE_ACCOUNT_ID" =~ ^[a-f0-9]{32}$ ]] || usage_err "CLOUDFLARE_ACCOUNT_ID looks wrong"
  printf 'Authorization: Bearer %s\n' "$RENDER_API_KEY" >"$WORK/private/render.h"
  printf 'Authorization: Bearer %s\n' "$CLOUDFLARE_API_TOKEN" >"$WORK/private/cf.h"
  chmod 600 "$WORK/private/render.h" "$WORK/private/cf.h"
}

# The smoke and the walkthrough log in as the demo personas, so the password is asked for BEFORE anything is
# written: a bad one must not be discovered after the database has been migrated.
setup_demo_password() {
  if [ "$STUB" = 1 ] && [ -z "${PP_STUB_BASE_URL:-}" ]; then
    log "STUB without PP_STUB_BASE_URL: the smoke and the walkthrough are skipped, so DEMO_PASSWORD is not needed."
    return 0
  fi
  ask_secret DEMO_PASSWORD 'Demo password (vault): '
  [ "$DEMO_PASSWORD" != 'Demo1234' ] \
    || usage_err "DEMO_PASSWORD is the published dev password: the demo must not use it (docs/ops/demo-reseed.md). Nothing was changed."
  ok "demo password accepted (not printed, not in argv)"
}

# ------------------------------------------------------------------------------------------------ target gate (#112 1.0)
url_user() { local r="${PGURL#postgresql://}"; r="${r#postgres://}"; r="${r%%@*}"; printf '%s' "${r%%:*}"; }
has_users() { psqlq -c "select to_regclass('public.users') is not null"; }
GRANTS_SQL="select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role')"

# The pooler user is postgres.<DEMO_REF>, the DB answers, it holds no account outside @demo.test/@example.test,
# and - once a snapshot exists - $SNAPSHOT is a readable dump. Never prints a password.
pp_gate() {
  local ref n u d
  ref=$(url_user)
  [ "$ref" = "postgres.$DEMO_REF" ] || { echo "STOP: PGURL user '$ref' is not postgres.$DEMO_REF"; return 1; }
  psqlq -c "select current_database(), current_user" >/dev/null || { echo "STOP: cannot connect"; return 1; }
  u=$(has_users) || { echo "STOP: cannot read the catalog"; return 1; }
  if [ "$u" = t ]; then
    n=$(psqlq -c "select count(*) from users where email is not null and lower(email) not like '%@demo.test' and lower(email) not like '%@example.test'") \
      || { echo "STOP: cannot count accounts"; return 1; }
    [ "$n" = 0 ] || { echo "STOP: $n account(s) outside @demo.test/@example.test: this is not the demo database"; return 1; }
  elif [ "$u" != f ]; then echo "STOP: unexpected catalog answer"; return 1; fi
  if [ -n "$SNAPSHOT" ]; then
    d=$(pg_restore -l "$SNAPSHOT" 2>/dev/null | grep -c 'TABLE DATA' || true)
    [ "${d:-0}" -gt 0 ] || { echo "STOP: no readable snapshot at $SNAPSHOT"; return 1; }
    echo "GATE OK: postgres.$DEMO_REF, snapshot $(basename "$SNAPSHOT") ($d tables with data)"
  else
    echo "GATE OK: postgres.$DEMO_REF, no snapshot (forward-only)"
  fi
}
gate() { pp_gate || nogo "pp_gate refused"; }

lockdown_and_check() { # path to lockdown-data-api.sql
  log "Data API grants before lockdown: $(psqlq -c "$GRANTS_SQL")"
  psqlq -q -f "$1" >/dev/null
  expect_eq "$(psqlq -c "$GRANTS_SQL")" 0 "Data API grants after lockdown"
  expect_eq "$(psqlq -c "select has_table_privilege('anon','public.users','SELECT')")" f "anon SELECT on public.users"
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
wrangler() {
  [ -x "$WORK/wrangler/node_modules/.bin/wrangler" ] || nogo "wrangler is not installed in $WORK/wrangler"
  (cd "$WORK/wrangler" && export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID WRANGLER_SEND_METRICS=false \
     && with_only CLOUDFLARE_API_TOKEN -- ./node_modules/.bin/wrangler "$@")
}
pages_prod_deployments() {
  cf GET "/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PAGES_PROJECT/deployments?env=production" \
    | jq -r '.result[] | select(.latest_stage.status == "success") | "\(.id) \(.deployment_trigger.metadata.commit_hash // "-")"'
}
render_deploy() { # sha branch
  local sha="$1" branch="$2" f="$WORK/private/body.json" resp id status commit i before fails
  hdr "render-deploy ($branch @ ${sha:0:8})"
  if [ "$STUB" = 1 ]; then log "STUB render: PATCH branch=$branch; POST deploy commitId=$sha; poll until live"; return; fi
  if [ "$(render GET "/services/$RENDER_SERVICE_ID" | jq -r '.branch')" != "$branch" ]; then
    jq -n --arg b "$branch" '{branch: $b}' >"$f"
    render PATCH "/services/$RENDER_SERVICE_ID" "$f" >/dev/null || nogo "Render: cannot set the branch to $branch"
    ok "Render branch = $branch"
  fi
  before=$(render GET "/services/$RENDER_SERVICE_ID/deploys?limit=20" | jq -r '[.[].deploy.id] | join(" ")') || nogo "Render: cannot list deploys"
  jq -n --arg c "$sha" '{commitId: $c, clearCache: "do_not_clear"}' >"$f"
  resp=$(render POST "/services/$RENDER_SERVICE_ID/deploys" "$f") || nogo "Render: deploy request refused"
  id=$(jq -r '.id // empty' <<<"$resp" 2>/dev/null || true)
  fails=0
  for i in $(seq 1 120); do   # 120 x 15 s = 30 min
    if [ -z "$id" ]; then
      id=$(render GET "/services/$RENDER_SERVICE_ID/deploys?limit=5" | jq -r --arg c "$sha" --arg b " $before " \
        '[.[].deploy | select(.commit.id == $c) | select(($b | contains(" " + .id + " ")) | not)][0].id // empty') || true
    fi
    if [ -n "$id" ]; then
      if ! resp=$(render GET "/services/$RENDER_SERVICE_ID/deploys/$id"); then
        fails=$((fails + 1)); [ "$fails" -lt 5 ] || nogo "Render: cannot read deploy $id (5 attempts in a row)"
        log "...  Render: read of deploy $id failed ($fails/5), retrying"; sleep 15; continue
      fi
      fails=0
      status=$(jq -r '.status' <<<"$resp"); commit=$(jq -r '.commit.id // empty' <<<"$resp")
      [ -z "$commit" ] || [ "$commit" = "$sha" ] || nogo "Render deploy $id is commit $commit, expected $sha"
      case "$status" in
        live) ok "Render deploy $id live at ${sha:0:8}"; return ;;
        build_failed | update_failed | pre_deploy_failed | canceled | deactivated) nogo "Render deploy $id ended as $status" ;;
      esac
      [ $((i % 4)) = 1 ] && log "...  Render deploy $id: $status"
    fi
    sleep 15
  done
  nogo "the Render deploy did not become live within 30 min"
}
health_db_up() { # label base-url
  local i body
  for i in $(seq 1 24); do   # up to 6 min: a sleeping Render instance can take ~60 s to wake
    body=$(curl -sS --max-time 70 "$2/api/health" 2>/dev/null || true)
    if jq -e '.data.status == "ok" and .data.db == "up"' >/dev/null 2>&1 <<<"$body"; then ok "$1 /api/health: db up"; return 0; fi
    sleep 15
  done
  return 1
}

# ------------------------------------------------------------------------------------------------ 1. tips, read at run time
migs_at() { git -C "$REPO_ROOT" ls-tree --name-only "$1" apps/api/prisma/migrations/ | sed -n 's#.*/\(00[0-9][0-9]_[^/]*\)$#\1#p' | sort; }

step_tips() {
  hdr "tips (1)"
  if [ "${PP_NO_FETCH:-0}" != 1 ]; then
    git -C "$REPO_ROOT" fetch -q origin "+refs/heads/$BE_BRANCH:refs/remotes/origin/$BE_BRANCH" \
                                        "+refs/heads/$FE_BRANCH:refs/remotes/origin/$FE_BRANCH" \
      || nogo "cannot fetch $BE_BRANCH / $FE_BRANCH"
  fi
  is_sha "$RUNNING_SHA" || usage_err "PP_RUNNING_BACKEND_SHA must be a full 40-hex commit"
  git -C "$REPO_ROOT" cat-file -e "$RUNNING_SHA^{commit}" 2>/dev/null || nogo "the running commit ${RUNNING_SHA:0:8} is not in this clone"
  BACKEND_SHA="${BACKEND_SHA:-$(git -C "$REPO_ROOT" rev-parse "origin/$BE_BRANCH")}"
  FRONTEND_SHA="${FRONTEND_SHA:-$(git -C "$REPO_ROOT" rev-parse "origin/$FE_BRANCH")}"
  is_sha "$BACKEND_SHA"  || usage_err "BACKEND_SHA must be a full 40-hex commit"
  is_sha "$FRONTEND_SHA" || usage_err "FRONTEND_SHA must be a full 40-hex commit"
  git -C "$REPO_ROOT" merge-base --is-ancestor "$BACKEND_SHA"  "origin/$BE_BRANCH" || nogo "BACKEND_SHA is not on $BE_BRANCH"
  git -C "$REPO_ROOT" merge-base --is-ancestor "$FRONTEND_SHA" "origin/$FE_BRANCH" || nogo "FRONTEND_SHA is not on $FE_BRANCH"
  git -C "$REPO_ROOT" merge-base --is-ancestor "$RUNNING_SHA"  "$BACKEND_SHA" \
    || nogo "the running commit ${RUNNING_SHA:0:8} is not an ancestor of BACKEND_SHA: this is not a forward redeploy"
  # Contract direction. An SPA built from an OLDER backend than the API it talks to is the state the demo has
  # always run in: it simply does not use the new endpoints. An SPA built from a NEWER backend is the dangerous
  # one - it can call endpoints the deployed API does not have - so that is the only refusal here.
  local spa_be lag
  spa_be=$(git -C "$REPO_ROOT" merge-base "$FRONTEND_SHA" "origin/$BE_BRANCH")   # newest backend commit the SPA carries
  if ! git -C "$REPO_ROOT" merge-base --is-ancestor "$spa_be" "$BACKEND_SHA"; then
    nogo "the SPA at ${FRONTEND_SHA:0:8} is built from a backend NEWER than BACKEND_SHA (${spa_be:0:8}): it can call endpoints the deployed API does not have. Deploy a newer API, or an older SPA."
  fi
  lag=$(git -C "$REPO_ROOT" rev-list --count "$spa_be..$BACKEND_SHA")
  if [ "$lag" = 0 ]; then
    ok "the SPA carries the API commit exactly"
  else
    log "NOTE the SPA is built from backend ${spa_be:0:8}, $lag commit(s) behind the API being deployed:"
    log "     backend-only changes in those commits have no UI in this demo. That is the safe direction, but if"
    log "     the demo is meant to SHOW them, wait for the $FE_BRANCH sync PR and re-run."
  fi
  NEW_MERGES=$(git -C "$REPO_ROOT" rev-list --count --merges "$RUNNING_SHA..$BACKEND_SHA")
  NEW_COMMITS=$(git -C "$REPO_ROOT" rev-list --count "$RUNNING_SHA..$BACKEND_SHA")
  log "running API   ${RUNNING_SHA:0:8} on $RUNNING_BRANCH"
  log "deploy API    ${BACKEND_SHA:0:8} (tip of $BE_BRANCH, read now)"
  log "deploy SPA    ${FRONTEND_SHA:0:8} (tip of $FE_BRANCH, read now)"
  log "new since the running API: $NEW_MERGES merge commit(s), $NEW_COMMITS commit(s) in total"
  summary "### redeploy (migration-aware): api ${BACKEND_SHA:0:8}, spa ${FRONTEND_SHA:0:8}, $NEW_MERGES new merge commit(s)"
  next "Read the migration plan below, then run: $0 run"
}

# ------------------------------------------------------------------------------------------------ 2. which migrations are new
# Comment-stripped SQL of one migration (a `--` inside a string literal would be stripped too; the migrations in
# this repo carry none, and the classifier's findings are printed for the operator to read before confirming).
# Read from the COMMIT being deployed, not the working tree: the operator's checkout may sit anywhere.
mig_sql() { git -C "$REPO_ROOT" show "$BACKEND_SHA:apps/api/prisma/migrations/$1/migration.sql" | sed -E 's@/\*.*\*/@@g; s@--.*$@@'; }

# Statements an API built for the OLD schema cannot survive. Additive DDL (ADD COLUMN nullable, CREATE INDEX,
# CREATE TABLE, ADD CONSTRAINT CHECK on a nullable column) keeps the old API working, so the schema may go first.
BREAKING_RE='DROP[[:space:]]+(TABLE|COLUMN|SCHEMA|VIEW|MATERIALIZED|SEQUENCE|TYPE)|RENAME[[:space:]]+(TO|COLUMN|CONSTRAINT)|ALTER[[:space:]]+COLUMN[[:space:]]+.*[[:space:]]TYPE[[:space:]]|SET[[:space:]]+NOT[[:space:]]+NULL|DROP[[:space:]]+(DEFAULT|CONSTRAINT|INDEX)|TRUNCATE|DELETE[[:space:]]+FROM|^[[:space:]]*UPDATE[[:space:]]'
REVIEW_RE='ADD[[:space:]]+CONSTRAINT|ADD[[:space:]]+COLUMN[^,;]*NOT[[:space:]]+NULL|^[[:space:]]*INSERT[[:space:]]'

step_migration_plan() {
  hdr "migration-plan (2)"
  local git_new db_pending applied name
  git_new=$(comm -13 <(migs_at "$RUNNING_SHA") <(migs_at "$BACKEND_SHA"))
  EXPECT_MIGRATIONS="${PP_EXPECT_MIGRATIONS:-$(migs_at "$BACKEND_SHA" | wc -l | tr -d ' ')}"
  EXPECT_NEWEST="${PP_EXPECT_NEWEST:-$(migs_at "$BACKEND_SHA" | tail -1)}"
  log "migrations at ${RUNNING_SHA:0:8}: $(migs_at "$RUNNING_SHA" | wc -l | tr -d ' ')   at ${BACKEND_SHA:0:8}: $EXPECT_MIGRATIONS (newest $EXPECT_NEWEST)"
  if [ -z "$git_new" ]; then
    log "new in the tree since the running API: none"
    RC_SEEN=3
    next "No new migration: this is a plain code redeploy. Use scripts/deploy-demo.sh with PP_MODE=redeploy (its code-only rollback still holds). Nothing was changed."
    log ""; log "NOTHING TO DO: no migration is new since ${RUNNING_SHA:0:8}."
    exit 3
  fi
  log "new in the tree since the running API:"; indent "$git_new"

  # The live database is the authority on what the running API actually applied.
  applied=$(psqlq -c "select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null order by migration_name" 2>/dev/null || true)
  if [ -z "$applied" ]; then
    nogo "_prisma_migrations is empty or unreadable: this is not a migrated demo database (a full reset is the Path A run sheet, not this script)"
  fi
  db_pending=$(comm -13 <(printf '%s\n' "$applied" | sort) <(migs_at "$BACKEND_SHA"))
  log "pending according to the live database:"; indent "$db_pending"
  if [ -z "$db_pending" ]; then
    RC_SEEN=3
    next "The database already has every migration of ${BACKEND_SHA:0:8}: this is a plain code redeploy. Use scripts/deploy-demo.sh with PP_MODE=redeploy. Nothing was changed."
    log ""; log "NOTHING TO DO: the database is already at $EXPECT_NEWEST."
    exit 3
  fi
  if [ "$git_new" != "$db_pending" ]; then
    bad "the git delta and the database's pending set differ: the demo may not be running ${RUNNING_SHA:0:8}"
    [ "${PP_ACCEPT_DRIFT:-0}" = 1 ] || nogo "set PP_RUNNING_BACKEND_SHA to the commit Render really serves, or re-run with PP_ACCEPT_DRIFT=1 to go by the database"
    log "PP_ACCEPT_DRIFT=1: going by the database's pending set"
  fi
  PENDING="$db_pending"

  # Can the RUNNING API survive the new schema? If yes, migrating first is safe and there is no window at all.
  hdr "compatibility (2)"
  local breaking='' review='' hits
  while IFS= read -r name; do
    [ -n "$name" ] || continue
    hits=$(mig_sql "$name" | grep -inE "$BREAKING_RE" || true)
    if [ -n "$hits" ]; then breaking+="$name:
$hits
"; fi
    hits=$(mig_sql "$name" | grep -inE "$REVIEW_RE" || true)
    if [ -n "$hits" ]; then review+="$name:
$hits
"; fi
  done <<<"$PENDING"
  if [ -n "$review" ]; then
    log "REVIEW (additive, but read these before you confirm):"; printf '%s' "$review" | sed 's/^/  /'
  fi
  if [ -n "$breaking" ]; then
    bad "a pending migration is NOT backward compatible with the running API:"; printf '%s' "$breaking" | sed 's/^/  /'
    log ""
    log "There is no deploy order that keeps the demo up through such a change: the old API cannot read the new"
    log "schema and the new API cannot read the old one. The demo is down from the migration until the SPA upload."
    if [ "${PP_ACCEPT_DOWNTIME:-0}" != 1 ]; then
      next "Take the demo out of use (tell the presenters, nobody logs in), then re-run with PP_ACCEPT_DOWNTIME=1. Nothing was changed."
      nogo "refusing to migrate a backward-incompatible change without PP_ACCEPT_DOWNTIME=1"
    fi
    log "PP_ACCEPT_DOWNTIME=1: the operator has accepted the window."
    COMPAT=breaking
  else
    ok "every pending migration is additive: the running API keeps working on the new schema (no window)"
    COMPAT=additive
  fi
  log ""
  log "PLAN: apply $(n_lines "$PENDING") migration(s) -> deploy API ${BACKEND_SHA:0:8} -> deploy SPA ${FRONTEND_SHA:0:8} -> smoke + read-only walkthrough"
  summary "- pending migrations: \`$(tr '\n' ' ' <<<"$PENDING")\` ($COMPAT)"
}

# ------------------------------------------------------------------------------------------------ 3. snapshot, verified first
# Exact row count of every public base table, "name|n" per line (read-only; the demo DB is small).
COUNTS_PER_TABLE_SQL="select c.relname || '|' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by c.relname"

dump_table_data() { # names of the tables that have a TABLE DATA entry in a dump
  pg_restore -l "$1" | awk '{for (i = 2; i < NF; i++) if ($i == "DATA" && $(i-1) == "TABLE" && $(i+1) == "public") print $(i+2)}' | sort -u
}

step_snapshot() {
  hdr "snapshot (3)"
  local dir="${SNAPSHOT_DIR:-$HOME/pp-demo-snapshots}" real
  mkdir -p "$dir"; chmod 700 "$dir"
  real=$(cd "$dir" && pwd -P)
  case "$real/" in "$REPO_ROOT"/*)
    next "Set SNAPSHOT_DIR to a folder outside the repository (default ~/pp-demo-snapshots) and re-run. Nothing was changed."
    nogo "SNAPSHOT_DIR is inside the repository ($real): choose a folder outside it (no-dumps.yml, db-backup.md)" ;;
  esac
  gate
  SNAPSHOT="$real/demo-before-$(date -u +%Y%m%dT%H%M%SZ).dump"
  pg_dump "$PGURL?$SSLQ" -n public -Fc -f "$SNAPSHOT" || { SNAPSHOT=''; nogo "pg_dump failed: nothing was changed"; }
  chmod 600 "$SNAPSHOT"
  (cd "$real" && sha256sum "$(basename "$SNAPSHOT")" >"$(basename "$SNAPSHOT").sha256")
  chmod 600 "$SNAPSHOT.sha256"
  log "snapshot: $SNAPSHOT"
  log "sha256:   $(cut -d' ' -f1 <"$SNAPSHOT.sha256")"
  next "A snapshot is at $SNAPSHOT. Nothing else has been changed. Keep it until after the demo."

  hdr "snapshot-verify (3)"
  [ "$(head -c 5 "$SNAPSHOT")" = 'PGDMP' ] || nogo "the snapshot has no PGDMP header"
  ok "PGDMP header"
  local td sp outside
  td=$(pg_restore -l "$SNAPSHOT" | grep -c 'TABLE DATA' || true)
  [ "${td:-0}" -gt 0 ] || nogo "the snapshot has no TABLE DATA entries"
  ok "TABLE DATA entries: $td"
  sp=$(pg_restore -l "$SNAPSHOT" | grep -c 'SCHEMA - public' || true)
  expect_eq "$sp" 1 "snapshot SCHEMA - public"
  outside=$(pg_restore -l "$SNAPSHOT" | grep -vE '^;|^$' | grep -cvE ' public ' || true)
  expect_eq "$outside" 0 "objects outside schema public"

  # Every non-empty table in the live DB must be in the snapshot: a dump that silently skipped one is not a rollback.
  local live_counts in_dump missing='' line t n
  live_counts=$(psqlq -c "$COUNTS_PER_TABLE_SQL")
  in_dump=$(dump_table_data "$SNAPSHOT")
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    t="${line%%|*}"; n="${line##*|}"
    [ "$n" = 0 ] && continue
    grep -qx -- "$t" <<<"$in_dump" || missing+=" $t"
  done <<<"$live_counts"
  [ -z "$missing" ] || nogo "the snapshot has no data for non-empty table(s):$missing"
  ok "every non-empty public table ($(awk -F'|' '$2 != 0' <<<"$live_counts" | wc -l | tr -d ' ') of $(n_lines "$live_counts")) is in the snapshot"

  case "${PP_SNAPSHOT_VERIFY:-inventory}" in
    inventory)
      log "PP_SNAPSHOT_VERIFY=inventory: the snapshot was NOT restored anywhere. For the strongest proof set"
      log "PP_SNAPSHOT_VERIFY=restore with PP_VERIFY_PG_URL pointing at a throwaway Postgres (see the run sheet)."
      ;;
    restore) verify_by_restore "$live_counts" ;;
    *) usage_err "PP_SNAPSHOT_VERIFY must be inventory or restore" ;;
  esac
  next "A verified snapshot is at $SNAPSHOT. Nothing else has been changed. Keep it until after the demo."
  summary "- snapshot: \`$(basename "$SNAPSHOT")\` sha256 \`$(cut -d' ' -f1 <"$SNAPSHOT.sha256")\`, $td tables with data, verify=${PP_SNAPSHOT_VERIFY:-inventory}"
}

# Restores the snapshot into a throwaway Postgres and compares every table's exact row count with the live DB.
verify_by_restore() { # live-counts
  local live="$1" host db got difference
  need PP_VERIFY_PG_URL
  host="${PP_VERIFY_PG_URL#*://}"; host="${host#*@}"; db="${host#*/}"; db="${db%%\?*}"; host="${host%%[:/]*}"
  case "$host" in localhost | 127.0.0.1 | '[::1]') ;; *) usage_err "PP_VERIFY_PG_URL must be a loopback server (got '$host'): never restore a demo dump to a remote host" ;; esac
  case "$db" in *_snapcheck) ;; *) usage_err "the PP_VERIFY_PG_URL database name must end in _snapcheck (got '$db'): a guard against restoring over something real" ;; esac
  log "restoring the snapshot into the throwaway database '$db' on $host"
  psql "$PP_VERIFY_PG_URL" -X -v ON_ERROR_STOP=1 -At -q -c "DROP SCHEMA IF EXISTS public CASCADE" >/dev/null \
    || nogo "cannot reset the throwaway database"
  pg_restore --no-owner --no-privileges --exit-on-error -d "$PP_VERIFY_PG_URL" "$SNAPSHOT" \
    || nogo "pg_restore of the snapshot into the throwaway database failed: this snapshot is NOT a usable rollback"
  got=$(psql "$PP_VERIFY_PG_URL" -X -v ON_ERROR_STOP=1 -At -c "$COUNTS_PER_TABLE_SQL")
  difference=$(diff <(printf '%s\n' "$live" | sort) <(printf '%s\n' "$got" | sort) || true)
  if [ -n "$difference" ]; then
    log "$difference"
    nogo "the restored copy differs from the live database (< live, > restored): keep the demo idle while the snapshot is taken"
  fi
  ok "restore proof: $(n_lines "$got") tables, every row count identical to the live database"
  psql "$PP_VERIFY_PG_URL" -X -At -q -c "DROP SCHEMA IF EXISTS public CASCADE" >/dev/null 2>&1 || true
}

forward_only_warning() {
  hdr "forward-only (--no-snapshot)"
  log "*******************************************************************************"
  log "*  --no-snapshot: NO database snapshot will be taken."
  log "*"
  log "*  $(tr '\n' ' ' <<<"$PENDING" | cut -c1-68)"
  log "*  will be applied to the demo database and CANNOT be undone by this script."
  log "*  Code rolls back; a schema does not. After this run:"
  log "*    - rollback means Render + Pages back to the old build ONLY;"
  log "*    - the database stays at $EXPECT_NEWEST;"
  log "*    - the old API in front of the new schema is only safe while every applied"
  log "*      migration is additive (this run: $COMPAT);"
  log "*    - the only way back to the old schema is a Supabase backup you took"
  log "*      yourself, or the Path A full reset (docs/ops/demo-deploy-23oct.md 2)."
  log "*******************************************************************************"
  next "Nothing was changed. Drop --no-snapshot to take a snapshot first, or re-run and type NO-SNAPSHOT."
  confirm_word 'NO-SNAPSHOT' 'Type NO-SNAPSHOT to apply the migrations with no rollback path: '
  log "forward-only confirmed by the operator."
  next "The migrations are about to be applied with no snapshot. If this run stops, read the STATE line."
}

# ------------------------------------------------------------------------------------------------ build (before any DB change)
step_checkout_build() {
  hdr "checkout + spa-build (before anything is written)"
  BE_DIR="$WORK/be"; SPA_DIR="$WORK/spa"
  git -C "$REPO_ROOT" worktree prune
  local pair dir sha
  for pair in "$BE_DIR:$BACKEND_SHA" "$SPA_DIR:$FRONTEND_SHA"; do
    dir="${pair%%:*}"; sha="${pair#*:}"
    [ -e "$dir/.git" ] || git -C "$REPO_ROOT" worktree add -q --detach "$dir" "$sha"
    expect_eq "$(git -C "$dir" rev-parse HEAD)" "$sha" "checkout $(basename "$dir")"
  done
  # npm ci only: this path never seeds, so the generated Prisma client is not needed. scripts/demo-db-delta.mjs
  # uses plain `pg`; scripts/demo-smoke.sh and scripts/demo-walkthrough.sh are curl + jq.
  if [ "${PP_SKIP_NPM_CI:-0}" != 1 ]; then (cd "$BE_DIR" && with_only -- npm ci --ignore-scripts --no-audit --no-fund); fi
  [ -d "$BE_DIR/node_modules/pg" ] || nogo "$BE_DIR/node_modules/pg is missing: scripts/demo-db-delta.mjs cannot run"
  if [ "${PP_SKIP_SPA_BUILD:-0}" = 1 ]; then log "PP_SKIP_SPA_BUILD=1: the SPA is not built (rehearsal only)"; return; fi
  if [ "${PP_SKIP_NPM_CI:-0}" != 1 ]; then (cd "$SPA_DIR" && with_only -- npm ci --ignore-scripts --no-audit --no-fund); fi
  rm -rf "$SPA_DIR/dist"
  (cd "$SPA_DIR" && VITE_API_MODE=http with_only -- npx --no-install vite build --mode demo)
  local out
  out=$(cd "$SPA_DIR" && with_only -- node scripts/check-demo-bundle.mjs dist 2>&1) || { log "$out"; nogo "check-demo-bundle failed"; }
  grep -q 'check-demo-bundle: OK' <<<"$out" || { log "$out"; nogo "check-demo-bundle did not print OK"; }
  log "$out"
  cp "$SPA_DIR/deploy/pages-direct/_worker.js" "$SPA_DIR/dist/"
  if [ ! -f "$SPA_DIR/dist/index.html" ] || [ ! -f "$SPA_DIR/dist/_worker.js" ]; then nogo "dist/index.html or dist/_worker.js is missing"; fi
  git -C "$SPA_DIR" diff --quiet "$BACKEND_SHA" -- deploy/pages-direct/_worker.js scripts/demo-smoke.sh scripts/demo-walkthrough.sh \
    || nogo "the worker or the demo scripts on FRONTEND_SHA differ from BACKEND_SHA"
  ok "worker + demo scripts = the API commit"
}

step_wrangler_install() {
  hdr "wrangler-install"
  if [ "$STUB" = 1 ]; then log "STUB: wrangler not installed"; return; fi
  mkdir -p "$WORK/wrangler"
  (cd "$WORK/wrangler" && printf '{"private":true}\n' >package.json \
     && with_only -- npm install --ignore-scripts --no-audit --no-fund --save-exact "wrangler@$WRANGLER_VERSION" >/dev/null)
  ok "$(cd "$WORK/wrangler" && ./node_modules/.bin/wrangler --version 2>/dev/null | tail -1)"
}

# Read-only look at both targets, and the Pages deployment this run will roll back to.
targets_check() {
  hdr "targets (read-only)"
  if [ "$STUB" = 1 ]; then log "STUB render/pages: GET service + deployments"; PAGES_PREV=stub-deployment; return; fi
  local svc proj live_branch
  svc=$(render GET "/services/$RENDER_SERVICE_ID") || nogo "cannot read the Render service"
  [ "$(jq -r '.autoDeploy' <<<"$svc")" = no ] || nogo "Render auto-deploy is on: switch it off so only this run deploys"
  ok "Render auto-deploy = no"
  live_branch=$(jq -r '.branch' <<<"$svc")
  log "Render branch now: $live_branch (rollback target: $RUNNING_BRANCH @ ${RUNNING_SHA:0:8})"
  [ "$(render GET "/services/$RENDER_SERVICE_ID/env-vars?limit=100" | jq '[.[].envVar | select(.key == "BIJAK_POC_QUESTIONS" and .value == "true")] | length')" = 1 ] \
    || nogo "Render BIJAK_POC_QUESTIONS must be true (else the PoC papers have no questions)"
  ok "Render BIJAK_POC_QUESTIONS = true"
  proj=$(cf GET "/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PAGES_PROJECT") || nogo "cannot read the Pages project"
  expect_eq "$(jq -r '.result.production_branch' <<<"$proj")" "$PAGES_BRANCH" "Pages production branch"
  PAGES_PREV=$(pages_prod_deployments | head -1 | cut -d' ' -f1) || true
  [ -n "$PAGES_PREV" ] || nogo "no successful Pages production deployment to roll back to"
  ok "Pages rollback target: $PAGES_PREV"
  printf '%s\n' "$PAGES_PREV" >"$WORK/out/pages-previous-deployment.txt"
}

# ------------------------------------------------------------------------------------------------ 4. apply, in a safe order
step_migrate() {
  hdr "migrate (4)"
  gate
  local out n
  n=$(n_lines "$PENDING")
  export DATABASE_URL="$PGURL?$SSLQ"
  out=$(cd "$BE_DIR" && with_only PGPASSWORD DATABASE_URL -- node scripts/demo-db-delta.mjs --dry-run 2>&1) || { log "$out"; nogo "the delta dry run failed"; }
  log "$out"
  grep -q "Dry run: $n migration(s) would be applied" <<<"$out" \
    || nogo "the dry run does not say $n migration(s) would be applied: the plan and the database disagree"
  out=$(cd "$BE_DIR" && with_only PGPASSWORD DATABASE_URL -- node scripts/demo-db-delta.mjs 2>&1) || {
    MIGRATED=1
    log "$out"
    next "Applying the migrations failed part way. One migration is one transaction, so the database sits at the last committed one. Roll back now: $0 rollback (with ROLLBACK_SNAPSHOT=$SNAPSHOT)"
    nogo "applying the migrations failed"
  }
  MIGRATED=1
  next "The migrations are applied; the API is NOT redeployed yet. Finish with another run, or roll back: $0 rollback (ROLLBACK_SNAPSHOT=$SNAPSHOT)"
  log "$out"
  grep -q "Done: $n migration(s) applied" <<<"$out" || nogo "the apply did not say Done: $n migration(s) applied"
  out=$(cd "$BE_DIR" && with_only PGPASSWORD DATABASE_URL -- node scripts/demo-db-delta.mjs 2>&1) || { log "$out"; nogo "the delta re-check failed"; }
  grep -q 'Up to date: no migration to apply.' <<<"$out" || { log "$out"; nogo "a third run is not 'Up to date'"; }
  ok "Up to date: no migration to apply"
  unset DATABASE_URL
  expect_eq "$(psqlq -c "select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null")" "$EXPECT_MIGRATIONS" "applied migrations"
  expect_eq "$(psqlq -c "select max(migration_name) from _prisma_migrations")" "$EXPECT_NEWEST" "newest migration"
  # A migration can create a table, and Supabase's default grants would expose it through the Data API.
  lockdown_and_check "$BE_DIR/scripts/supabase/lockdown-data-api.sql"
  summary "- migrated to $EXPECT_NEWEST ($EXPECT_MIGRATIONS applied), Data API grants 0"
}

step_edge_and_env() {
  hdr "render-env"
  if [ "$KEEP_EDGE_SECRET" = 1 ]; then
    log "KEEP_EDGE_SECRET=1: EDGE_PROXY_SECRET and CLIENT_IP_HEADER are left as they are on both sides."
    log "A refresh does not need a new edge secret, and rotating it opens a gap in which the old worker sends no"
    log "secret and every user shares one login-throttle bucket. Set KEEP_EDGE_SECRET=0 only when the secret must"
    log "change; the run sheet says what else to do then."
    return
  fi
  local edge f; edge=$(openssl rand -hex 32); mask "$edge"
  if [ "$STUB" = 1 ]; then
    log "STUB pages: wrangler pages secret put EDGE_PROXY_SECRET (fresh value, not printed)"
    log "STUB render: PUT env-vars/EDGE_PROXY_SECRET (same value)"
  else
    printf '%s' "$edge" | wrangler pages secret put EDGE_PROXY_SECRET --project-name "$PAGES_PROJECT" >/dev/null \
      || nogo "wrangler pages secret put failed"
    ok "Pages EDGE_PROXY_SECRET set (not printed)"
    f="$WORK/private/env.json"
    V="$edge" jq -n '{value: env.V}' >"$f"; chmod 600 "$f"
    render PUT "/services/$RENDER_SERVICE_ID/env-vars/EDGE_PROXY_SECRET" "$f" >/dev/null || { rm -f "$f"; nogo "Render: cannot set EDGE_PROXY_SECRET"; }
    rm -f "$f"; ok "Render EDGE_PROXY_SECRET set (not printed)"
  fi
  unset edge
}

# Order: schema, then API, then SPA.
#   - the schema goes first ONLY because every pending migration was proven additive, so the running (old) API
#     keeps reading the database while the new one builds. No API is ever live against a schema it cannot read.
#   - the API goes before the SPA because the new SPA may call endpoints only the new API has, while the old SPA
#     in front of the new API is the pair that was already running, minus the new screens.
step_deploy() {
  render_deploy "$BACKEND_SHA" "$BE_BRANCH"
  API_DEPLOYED=1
  next "The API is live at ${BACKEND_SHA:0:8} but the SPA is still the old build. Finish the run, or roll back: $0 rollback"
  hdr "render-health"
  if [ "$STUB" = 1 ]; then log "STUB: health skipped"
  else health_db_up Render "$RENDER_URL" || nogo "the new API does not report db up: roll back"; fi

  hdr "pages-deploy"
  if [ "$STUB" = 1 ]; then
    log "STUB pages: wrangler pages deploy $SPA_DIR/dist --branch $PAGES_BRANCH --commit-hash $FRONTEND_SHA"
  else
    local top i
    wrangler pages deploy "$SPA_DIR/dist" --project-name "$PAGES_PROJECT" --branch "$PAGES_BRANCH" \
      --commit-hash "$FRONTEND_SHA" --commit-message "redeploy-migration-aware ${FRONTEND_SHA:0:8} / api ${BACKEND_SHA:0:8}" \
      --commit-dirty=true || nogo "wrangler pages deploy failed"
    for i in $(seq 1 12); do
      top=$(pages_prod_deployments | head -1) || true
      [ "${top#* }" = "$FRONTEND_SHA" ] && break
      sleep 10
    done
    [ "${top#* }" = "$FRONTEND_SHA" ] || nogo "the newest successful production deployment is not FRONTEND_SHA (got '${top:-none}')"
    ok "Pages production deployment ${top%% *} = ${FRONTEND_SHA:0:8}"
  fi
  SPA_DEPLOYED=1
  next "API and SPA are live. The smoke and the walkthrough decide go/no-go; on a failure this run rolls back by itself."
}

# ------------------------------------------------------------------------------------------------ 5. smoke + walkthrough
base_url() { if [ "$STUB" = 1 ]; then printf '%s' "${PP_STUB_BASE_URL:-}"; else printf '%s' "$PAGES_URL"; fi; }

CHECK_FAIL=''
run_check() { # name expected-substring expected-exit -- command...
  local name="$1" want="$2" want_rc="$3" out rc=0; shift 4
  hdr "$name (5)"
  out=$(with_only DEMO_PASSWORD -- "$@" 2>&1) || rc=$?
  log "$out"
  grep -qF "$want" <<<"$out" || { CHECK_FAIL="$name: expected '$want', got exit $rc"; return 1; }
  [ "$rc" = "$want_rc" ] || { CHECK_FAIL="$name: expected exit $want_rc, got $rc"; return 1; }
  ok "$name: $want (exit $rc)"
  summary "- $name: $want (exit $rc)"
}

step_verify() {
  if [ "$STUB" = 1 ] && [ -z "${PP_STUB_BASE_URL:-}" ]; then
    hdr "smoke + walkthrough (5)"; log "STUB: skipped (no PP_STUB_BASE_URL)"; return
  fi
  local b; b=$(base_url)
  CHECK_FAIL=''
  run_check smoke "$EXPECT_SMOKE" 0 -- env BASE_URL="$b" bash "$BE_DIR/scripts/demo-smoke.sh" \
    || auto_rollback "$CHECK_FAIL"
  run_check walkthrough-read-only "$EXPECT_WALK_RO" "$EXPECT_WALK_RO_EXIT" -- \
    env BASE_URL="$b" BUILD_SHA="${BACKEND_SHA:0:8}" STRICT_EXEMPT="" bash "$BE_DIR/scripts/demo-walkthrough.sh" \
    || auto_rollback "$CHECK_FAIL"
}

# ------------------------------------------------------------------------------------------------ rollback
# Code first, database last. The other order would put the NEW API in front of the OLD schema, which it cannot
# read; the old API in front of the new (additive) schema is the state the demo was already running in.
pages_rollback() { # [deployment-id]
  hdr "rollback: pages"
  if [ "$STUB" = 1 ]; then log "STUB pages: POST deployments/<previous>/rollback"; return; fi
  local dep="${1:-}" live
  [ -n "$dep" ] || dep=$(pages_prod_deployments | sed -n 2p | cut -d' ' -f1) || true
  [[ "$dep" =~ ^[A-Za-z0-9-]+$ ]] || nogo "no previous Pages deployment to roll back to (set ROLLBACK_PAGES_DEPLOYMENT_ID)"
  live=$(pages_prod_deployments | head -1 | cut -d' ' -f1) || true
  if [ "$live" = "$dep" ]; then ok "Pages deployment $dep is already live: nothing to roll back"; return; fi
  cf POST "/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PAGES_PROJECT/deployments/$dep/rollback" \
    | jq -e '.success == true' >/dev/null || nogo "the Pages rollback to $dep was refused"
  ok "Pages rolled back to $dep"
}

db_restore() { # snapshot file
  hdr "rollback: database"
  local f="$1"
  [ -s "$f" ] || nogo "no snapshot at $f: the database cannot be rolled back"
  SNAPSHOT="$f"
  [ "$(head -c 5 "$f")" = 'PGDMP' ] || nogo "$f has no PGDMP header"
  expect_eq "$(pg_restore -l "$f" | grep -c 'SCHEMA - public' || true)" 1 "snapshot SCHEMA - public"
  expect_eq "$(pg_restore -l "$f" | grep -vE '^;|^$' | grep -cvE ' public ' || true)" 0 "objects outside schema public"
  if [ -f "$f.sha256" ]; then
    if (cd "$(dirname "$f")" && sha256sum -c --status "$(basename "$f").sha256"); then
      ok "snapshot sha256 matches the value written when it was taken"
    else
      nogo "the snapshot checksum does not match: do not restore it"
    fi
  fi
  gate
  psqlq -q -c "SET client_min_messages = warning; BEGIN; DROP SCHEMA public CASCADE; COMMIT;" >/dev/null
  gate
  pg_restore --no-owner --no-privileges --exit-on-error -d "$PGURL?$SSLQ" "$f" \
    || nogo "pg_restore failed: the database is half restored. Re-run '$0 rollback' with the same snapshot; if that fails too, use the Path A full reset (docs/ops/demo-deploy-23oct.md section 2)"
  MIGRATED=0
  lockdown_and_check "$REPO_ROOT/scripts/supabase/lockdown-data-api.sql"
  expect_eq "$(psqlq -c "select max(migration_name) from _prisma_migrations")" "$(migs_at "$RUNNING_SHA" | tail -1)" "newest migration after the restore"
  ok "database restored from $(basename "$f")"
}

do_rollback() { # restore:0|1  [pages-deployment-id]
  local restore="$1" dep="${2:-}"
  pages_rollback "$dep"
  render_deploy "$RUNNING_SHA" "$RUNNING_BRANCH"
  API_DEPLOYED=0; SPA_DEPLOYED=0
  if [ "$restore" = 1 ]; then
    db_restore "$SNAPSHOT"
  else
    log ""
    log "The database was NOT restored."
    if [ "$SNAPSHOT_MODE" = none ]; then
      log "This run was started with --no-snapshot, so there is no snapshot to restore. The schema stays at"
      log "$EXPECT_NEWEST while the API is back at ${RUNNING_SHA:0:8}. That pair is only safe while every applied"
      log "migration is additive (this run: ${COMPAT:-unknown})."
    else
      log "Nothing had been migrated yet, so there is nothing to undo."
    fi
  fi
  hdr "rollback: health"
  if [ "$STUB" = 1 ]; then log "STUB: health skipped"
  else
    health_db_up Render "$RENDER_URL" || log "BAD  Render /api/health is not db up yet: check the Render log"
    health_db_up Pages  "$PAGES_URL"  || log "BAD  Pages /api/health is not db up yet: check the worker and API_ORIGIN"
  fi
}

auto_rollback() { # reason
  RC_SEEN=1
  hdr "auto-rollback"
  bad "$1"
  local restore=0
  if [ -n "$SNAPSHOT" ] && [ "$MIGRATED" = 1 ]; then restore=1; fi
  log "rolling back by itself: Pages -> the previous deployment, Render -> ${RUNNING_SHA:0:8} ($RUNNING_BRANCH), database -> $([ "$restore" = 1 ] && echo 'the snapshot' || echo 'left as it is')"
  summary "**AUTO-ROLLBACK**: $1"
  do_rollback "$restore" "$PAGES_PREV"
  STEP=rolled-back
  if [ "$restore" = 1 ]; then
    next "Rolled back completely (code and database). Read the failure above, fix it, then run '$0 plan' again. Keep the snapshot $SNAPSHOT until the next successful run."
  else
    next "Code is rolled back; the database is NOT. Read the failure above. The schema is at $EXPECT_NEWEST and the API at ${RUNNING_SHA:0:8}; agree with the LEAD whether to go forward again or to restore a Supabase backup."
  fi
  log ""; log "ROLLED BACK: $1"
  exit 1
}

# ------------------------------------------------------------------------------------------------ commands
cmd_plan() {
  setup_work
  setup_db
  step_tips
  step_migration_plan
  log ""
  log "PLAN ONLY: nothing was changed."
  next "Run '$0 run' to take a snapshot and apply the plan above. Add --no-snapshot only if the LEAD accepts a forward-only run."
}

cmd_run() {
  setup_work
  setup_db
  setup_cloud
  setup_demo_password
  step_tips
  step_migration_plan
  targets_check
  step_checkout_build
  step_wrangler_install
  if [ "$SNAPSHOT_MODE" = none ]; then
    forward_only_warning
  else
    step_snapshot
    if [ "${PP_ASSUME_YES:-0}" = 1 ]; then
      log "PP_ASSUME_YES=1: the typed GO confirm is skipped (the snapshot is verified and the rollback path holds)."
    else
      confirm_word 'GO' "Type GO to apply $(n_lines "$PENDING") migration(s) and redeploy: "
    fi
  fi
  step_migrate
  step_edge_and_env
  step_deploy
  step_verify
  STEP=finished
  if [ "$STUB" = 1 ]; then
    log ""; log "STUB RUN COMPLETE: plan, snapshot, migrate, order and gate path passed; Render/Cloudflare were stubbed. Not a GO."
    next "A stub run proves the local half only. The cloud run is the LEAD's: see docs/ops/demo-redeploy-migration-aware.md."
    return
  fi
  log ""
  log "GO: api $BACKEND_SHA, spa $FRONTEND_SHA, database at $EXPECT_NEWEST."
  summary "**GO**: api ${BACKEND_SHA:0:8}, spa ${FRONTEND_SHA:0:8}, db $EXPECT_NEWEST"
  if [ -n "$SNAPSHOT" ]; then
    next "Done. Keep the snapshot $SNAPSHOT until after the demo: it is the only database rollback. Then do the browser go/no-go of docs/ops/demo-deploy-23oct.md section 5, the two-network login check, and check the Render log shows no ClientIp warning. Rotate the DB password after the demo (section 7)."
  else
    next "Done, forward-only: there is NO database rollback. Then do the browser go/no-go of docs/ops/demo-deploy-23oct.md section 5, the two-network login check, and check the Render log shows no ClientIp warning. Rotate the DB password after the demo (section 7)."
  fi
}

cmd_rollback() {
  setup_work
  setup_db
  setup_cloud
  step_tips
  local restore="${RESTORE_DB:-}"
  SNAPSHOT="${ROLLBACK_SNAPSHOT:-}"
  if [ -z "$restore" ]; then if [ -n "$SNAPSHOT" ]; then restore=1; else restore=0; fi; fi
  case "$restore" in 0 | 1) ;; *) usage_err "RESTORE_DB must be 0 or 1" ;; esac
  EXPECT_NEWEST="${PP_EXPECT_NEWEST:-$(migs_at "$BACKEND_SHA" | tail -1)}"
  if [ "$restore" = 1 ]; then
    [ -n "$SNAPSHOT" ] || usage_err "set ROLLBACK_SNAPSHOT to the snapshot file (the deploy run printed its path), or RESTORE_DB=0"
    log ""
    log "This restores the demo database from $(basename "$SNAPSHOT"). Everything written since the snapshot is lost."
    confirm_word 'RESTORE' 'Type RESTORE to roll back the code AND the database: '
  else
    log ""
    log "RESTORE_DB=0: code only. The schema stays where it is; a schema does not roll back with the code."
    confirm_word 'CODE-ONLY' 'Type CODE-ONLY to roll back the code and leave the database as it is: '
  fi
  MIGRATED="$restore"
  do_rollback "$restore" "${ROLLBACK_PAGES_DEPLOYMENT_ID:-}"
  STEP=rolled-back
  log ""; log "ROLLBACK DONE: render ${RUNNING_SHA:0:8} ($RUNNING_BRANCH), database restored=$restore"
  summary "**ROLLBACK DONE** (database restored=$restore)"
  next "Check the demo in the browser. If the database was not restored, agree the next step with the LEAD before anybody uses the demo."
}

CMD="${1:-}"; shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --no-snapshot) SNAPSHOT_MODE=none ;;
    --snapshot) SNAPSHOT_MODE=snapshot ;;
    -h | --help) sed -n '2,62p' "${BASH_SOURCE[0]}"; RC_SEEN=0; next "No command was run."; exit 0 ;;
    *) usage_err "unexpected argument '$1'" ;;
  esac
  shift
done
[ "$SNAPSHOT_MODE" = snapshot ] || [ "$CMD" = run ] || usage_err "--no-snapshot applies to 'run' only"

case "$CMD" in
  plan) cmd_plan ;;
  run) cmd_run ;;
  rollback) cmd_rollback ;;
  *) usage_err "usage: $0 plan | run [--no-snapshot] | rollback   (see --help)" ;;
esac
