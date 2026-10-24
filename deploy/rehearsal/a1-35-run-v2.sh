#!/usr/bin/env bash
# A1.35 - run v2 against the migrated rehearsal database (chain: a1-20 dump sitting, a1-30 load and
# migrate, >>> a1-35 <<<, a1-40 rollback probes and restore). Run sheet: docs/ops/rehearsal-a1-24oct.md.
# What it proves and what it does not: docs/ops/a1-35-notes.md.
#
# In order:
#   1. boots the v2 API against the rehearsal target database and waits for /api/health to say db: up
#   2. picks ONE migrated, active student account (joined through etl_id_map, legacy_source = 'cloud')
#      and writes a random password onto it IN THE REHEARSAL DATABASE ONLY
#   3. logs in through the real POST /api/auth/login (body {identifier, password}) and checks the cookie
#   4. makes one authenticated read (GET /api/me)
#   5. stops only the API it started and shreds its log, its helpers and its credential file
#
# Writing to the database is safe because a1-40 begins by restoring the `after_full` snapshot.
#
# NOTHING SECRET IS EVER PRINTED: not the generated password, not an identifier, not a user id, not
# the database URL. Secrets stay in a child environment or in a 0600 file under the rehearsal state
# directory, and this script shreds them before it exits.
#
# Usage: deploy/rehearsal/a1-35-run-v2.sh [--port N] [--hash legacy|argon2] [--keep-log]
# Exit:  0 ok, 1 failed, 2 usage or pre-flight.
set -euo pipefail
umask 077

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd -P)
RDB="$SCRIPT_DIR/rehearsal-db.sh"
TSX="$REPO_ROOT/node_modules/.bin/tsx"
MAIN="$REPO_ROOT/apps/api/dist/main.js"

PORT=${PP_A135_PORT:-3099}
HASH_KIND=${PP_A135_HASH:-legacy}
BOOT_TIMEOUT=${PP_A135_BOOT_TIMEOUT:-120}
KEEP_LOG=0

die() { printf 'a1-35: error: %s\n' "$*" >&2; exit "${DIE_CODE:-1}"; }
info() { printf '%s\n' "$*"; }
# One aggregate line per step, same shape as the `step` helper of the run sheet (section 5).
mark() { printf 'STEP %s seconds=%s\n' "$1" "$2"; }

# `shred` is coreutils and is NOT on a stock macOS: fall back to gshred, then to an overwrite by hand.
shred_path() {
  [ -e "$1" ] || return 0
  if command -v shred >/dev/null 2>&1; then shred -u -n 3 "$1" 2>/dev/null && return 0; fi
  if command -v gshred >/dev/null 2>&1; then gshred -u -n 3 "$1" 2>/dev/null && return 0; fi
  dd if=/dev/urandom "of=$1" bs=4096 count=4 conv=notrunc 2>/dev/null || true
  rm -P "$1" 2>/dev/null || rm -f "$1" 2>/dev/null || true
}
shred_dir() {
  [ -d "$1" ] || return 0
  local f
  while IFS= read -r f; do [ -n "$f" ] && shred_path "$f"; done <<EOF
$(find "$1" -type f 2>/dev/null)
EOF
  rm -rf "$1" 2>/dev/null || true
}

while [ $# -gt 0 ]; do
  case "$1" in
    --port) [ $# -ge 2 ] || DIE_CODE=2 die "--port needs a value"; PORT=$2; shift ;;
    --hash) [ $# -ge 2 ] || DIE_CODE=2 die "--hash needs legacy or argon2"; HASH_KIND=$2; shift ;;
    --keep-log) KEEP_LOG=1 ;;
    -h | --help) sed -n '2,21p' "$0"; exit 0 ;;
    *) DIE_CODE=2 die "unknown argument: $1 (try: --help)" ;;
  esac
  shift
done
[[ $PORT =~ ^[0-9]{2,5}$ ]] || DIE_CODE=2 die "--port must be a port number"
case "$HASH_KIND" in legacy | argon2) ;; *) DIE_CODE=2 die "--hash must be legacy or argon2" ;; esac

# ---------------------------------------------------------------- pre-flight
[ -x "$RDB" ] || DIE_CODE=2 die "missing $RDB"
command -v node >/dev/null 2>&1 || DIE_CODE=2 die "node is not on PATH"
[ -x "$TSX" ] || DIE_CODE=2 die "node_modules/.bin/tsx is missing: run 'npm ci' at the repo root first"
# The server is started from the BUILT bundle, never with `npm run dev -w @pp/api`: `dev` is a watcher
# (vite --watch plus `node --watch`), it runs `prisma generate` first, it waits 4 s before the server
# exists at all, and it leaves a process tree this script could not stop precisely.
[ -f "$MAIN" ] || DIE_CODE=2 die "apps/api/dist/main.js is missing: run 'npm run build -w @pp/api' first"
# Refuse to start when something already listens there: this script must only ever stop what it started.
node -e 'const n=require("net"),s=n.createServer();s.once("error",()=>process.exit(1));s.listen(Number(process.argv[1]),"127.0.0.1",()=>s.close(()=>process.exit(0)))' "$PORT" \
  || DIE_CODE=2 die "port $PORT is already in use; pass --port with a free one"

# Private run directory (0700) beside the rehearsal state: log, pid, credentials. Shredded at the end.
STATE_BASE=${PP_REHEARSAL_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/pp-rehearsal}
RUN_DIR="$STATE_BASE/a1-35.$$"
mkdir -p "$RUN_DIR" && chmod 700 "$RUN_DIR"
LOG="$RUN_DIR/api.log"
PIDFILE="$RUN_DIR/api.pid"
CREDS="$RUN_DIR/account.json"
STORAGE="$RUN_DIR/files"
mkdir -p "$STORAGE"
# The node helpers must resolve `pg` and the repository's own modules, and `pick.ts` must be compiled
# with the API's tsconfig (experimentalDecorators), so they live under the git-ignored
# apps/api/.migration-out/. Shredded with everything else.
HELP_DIR="$REPO_ROOT/apps/api/.migration-out/a1-35.$$"
mkdir -p "$HELP_DIR" && chmod 700 "$HELP_DIR"

API_PID=''
cleanup() {
  local rc=$? i=0
  # Stop ONLY the API this script started, by the pid the wrapper recorded. Never a pattern kill.
  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    kill -TERM "$API_PID" 2>/dev/null || true
    while [ $i -lt 100 ] && kill -0 "$API_PID" 2>/dev/null; do sleep 0.1; i=$((i + 1)); done
    if kill -0 "$API_PID" 2>/dev/null; then kill -KILL "$API_PID" 2>/dev/null || true; fi
    info 'api: stopped (only the process this script started)'
  fi
  shred_dir "$HELP_DIR"
  if [ "$KEEP_LOG" = 1 ]; then
    shred_path "$CREDS"
    info "api log kept at $LOG (0600, outside the repo): delete it at the close-out"
  else
    shred_dir "$RUN_DIR"
  fi
  exit $rc
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------- 1. boot the API
# The API runs THROUGH `rehearsal-db.sh exec target`, which supplies DATABASE_URL and the SAME
# IC_HASH_KEY the ETL used (it is kept in the rehearsal state dir). Booting with a different
# IC_HASH_KEY would leave every migrated ic_hash unmatchable by the reset-by-IC flow.
# `exec` forces NODE_ENV=development, so the inner `env` restores production - exactly what the run
# sheet already does for the seed (A1.3).
# COOKIE_SECURE=false: the rehearsal speaks plain http on loopback and a Secure cookie would not be
# sent back by any normal client (production serves https and keeps the default, true).
# The API binds 0.0.0.0 (apps/api/src/main.ts): run this on a machine that is not on an untrusted network.
t0=$SECONDS
PP_A135_SESSION_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')
export PP_A135_SESSION_SECRET
"$RDB" exec target -- env \
  NODE_ENV=production \
  PORT="$PORT" \
  LOG_LEVEL=warn \
  COOKIE_SECURE=false \
  REGISTRATION_OPEN=false \
  JOBS_WORKER_ENABLED=false \
  FILE_STORAGE_DIR="$STORAGE" \
  bash -c 'SESSION_SECRET=$PP_A135_SESSION_SECRET node "$0" & echo $! >"$1"; wait' "$MAIN" "$PIDFILE" \
  >"$LOG" 2>&1 &

i=0
while [ $i -lt 150 ] && [ ! -s "$PIDFILE" ]; do sleep 0.1; i=$((i + 1)); done
[ -s "$PIDFILE" ] || die "the API process did not start (see $LOG)"
API_PID=$(cat "$PIDFILE")

# ---------------------------------------------------------------- 2. /api/health reports db: up
HEALTH_OK=0
i=0
while [ $i -lt $((BOOT_TIMEOUT * 5)) ]; do
  kill -0 "$API_PID" 2>/dev/null || die "the API exited during boot (see $LOG)"
  if node -e '
    const r = await fetch(`http://127.0.0.1:${process.argv[1]}/api/health`).catch(() => null)
    if (!r || r.status !== 200) process.exit(1)
    const b = await r.json().catch(() => null)
    process.exit(b?.data?.status === "ok" && b?.data?.db === "up" ? 0 : 1)
  ' "$PORT" 2>/dev/null; then HEALTH_OK=1; break; fi
  sleep 0.2
  i=$((i + 1))
done
[ "$HEALTH_OK" = 1 ] || die "/api/health did not report db: up within ${BOOT_TIMEOUT}s (see $LOG)"
info 'health: GET /api/health -> status ok, db up'
mark boot $((SECONDS - t0))

# ---------------------------------------------------------------- 3. pick an account, write a password
# Runs inside `rehearsal-db.sh exec target`, so the database URL never leaves the child environment.
# tsx is used because the hash comes from the repository's OWN legacy bcrypt implementation
# (apps/api/src/modules/auth/legacy-bcrypt.ts): the API workspace has no bcrypt npm package at all.
t1=$SECONDS
cat >"$HELP_DIR/pick.ts" <<'TS_EOF'
/** Picks one migrated, active student account and writes a random password onto it. Fixed lines only. */
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { Client } from 'pg'

import { ARGON2_OPTIONS } from '../../src/modules/auth/argon2-params'
import { bcryptHashWithSalt } from '../../src/modules/auth/legacy-bcrypt'

const B64 = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const credsPath = process.env.PP_A135_CREDS as string
const kind = process.env.PP_A135_HASH === 'argon2' ? 'argon2' : 'legacy'

const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
// Active, not suspended, NOT must_reset_password (such an account logs in but is then locked into the
// password-change flow and every other read answers 403), with an e-mail (a username can repeat across
// schools and would then need schoolId), a student role, and an etl_id_map row for legacy_source 'cloud'.
const WHERE = `from users u
     join user_roles r on r.user_id = u.id and r.role = 'student'
     join etl_id_map m on m.entity = 'users' and m.legacy_source = 'cloud' and m.new_id = u.id::text
    where u.is_active and not u.is_suspended and not u.must_reset_password
      and u.email is not null and u.password_hash is not null`
const eligible = Number((await client.query<{ n: string }>(`select count(*) as n ${WHERE}`)).rows[0]?.n ?? 0)
// One random row out of the whole eligible set (tablesample would skip the join; order by random()
// over ~15k rows costs milliseconds and keeps the pick honest across repeated runs).
const { rows } = await client.query<{ id: string; email: string; password_hash: string | null }>(
  `select u.id, u.email, u.password_hash ${WHERE} order by random() limit 1`,
)
if (rows.length === 0) {
  console.error('no migrated, active student account with an e-mail was found')
  process.exit(1)
}
const picked = rows[0] as { id: string; email: string; password_hash: string | null }
const carried = picked.password_hash
const carriedKind =
  carried === null ? 'none' : /^\$2[abxy]\$/.test(carried) ? 'legacy-bcrypt' : carried.startsWith('$argon2') ? 'argon2id' : 'other'

// 24 random bytes, base64url: far above any policy minimum, and never printed.
const password = randomBytes(24).toString('base64url')
let hash: string
if (kind === 'argon2') {
  const { hash: argon2 } = await import('@node-rs/argon2')
  hash = await argon2(password, ARGON2_OPTIONS)
} else {
  // Cost 10 is the Laravel default the .cloud hashes carry, so the login takes the same code path
  // (LegacyBcryptPool) and roughly the same CPU as a carried-over hash would.
  const salt = Array.from(randomBytes(22), (b) => B64[b % 64]).join('')
  hash = bcryptHashWithSalt(password, salt, 10, '2y')
}
await client.query('update users set password_hash = $1, updated_at = now() where id = $2', [hash, picked.id])
writeFileSync(credsPath, JSON.stringify({ identifier: picked.email, password, userId: String(picked.id) }), { mode: 0o600 })
await client.end()
console.log(
  `account: 1 picked at random out of ${eligible} eligible migrated student accounts; its carried-over hash was ${carriedKind}; ` +
    `written hash: ${kind === 'argon2' ? 'argon2id' : 'legacy bcrypt $2y$10 (overwrites the carried-over hash)'}`,
)
TS_EOF
"$RDB" exec target -- env PP_A135_CREDS="$CREDS" PP_A135_HASH="$HASH_KIND" \
  "$TSX" --tsconfig "$REPO_ROOT/apps/api/tsconfig.json" "$HELP_DIR/pick.ts" || die "could not prepare a migrated account"
[ -s "$CREDS" ] || die "the account file was not written"
mark pick $((SECONDS - t1))

# ---------------------------------------------------------------- 4. real login, 5. one authenticated read
t2=$SECONDS
cat >"$HELP_DIR/login.mjs" <<'JS_EOF'
/** POST /api/auth/login (body {identifier, password}), then ONE authenticated read: GET /api/me. */
import { readFileSync } from 'node:fs'

const base = `http://127.0.0.1:${process.argv[2]}/api`
const creds = JSON.parse(readFileSync(process.env.PP_A135_CREDS, 'utf8'))

const t0 = Date.now()
const res = await fetch(`${base}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: creds.identifier, password: creds.password, remember: false }),
  redirect: 'manual',
})
const loginMs = Date.now() - t0
const body = await res.json().catch(() => null)
// Error codes are a fixed enum: never free text, never the identifier.
if (res.status !== 200) {
  console.error(`login failed: http ${res.status} code=${body?.error?.code ?? 'unknown'}`)
  process.exit(1)
}
const session = (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('pp_session='))
if (!session) {
  console.error('login returned 200 but set no pp_session cookie')
  process.exit(1)
}
const a = session.toLowerCase()
const flags = [
  a.includes('httponly') ? 'HttpOnly' : 'NO-HttpOnly',
  /samesite=lax/.test(a) ? 'SameSite=Lax' : 'SameSite=?',
  a.includes('secure') ? 'Secure' : 'not-Secure (COOKIE_SECURE=false, loopback http)',
].join(' ')
console.log(`login: http 200 in ${loginMs} ms; pp_session cookie set (${flags})`)

const cookie = session.split(';')[0]
const t1 = Date.now()
const me = await fetch(`${base}/me`, { headers: { cookie } })
const meMs = Date.now() - t1
const meBody = await me.json().catch(() => null)
if (me.status !== 200) {
  console.error(`authenticated read failed: GET /api/me http ${me.status} code=${meBody?.error?.code ?? 'unknown'}`)
  process.exit(1)
}
if (String(meBody?.data?.id ?? '') !== String(creds.userId)) {
  console.error('authenticated read answered for a different account than the one that logged in')
  process.exit(1)
}
console.log(
  `read: GET /api/me http 200 in ${meMs} ms; same migrated account; active role ${meBody.data.role}; ` +
    `roles ${meBody.data.roles.join(',')}; school ${meBody.data.schoolId === null ? 'none' : 'set'}`,
)
JS_EOF
PP_A135_CREDS="$CREDS" node "$HELP_DIR/login.mjs" "$PORT" || die "the login or the authenticated read failed"
mark login $((SECONDS - t2))

# ---------------------------------------------------------------- 6. was the legacy hash rehashed?
if [ "$HASH_KIND" = legacy ]; then
  cat >"$HELP_DIR/rehash.mjs" <<'JS_EOF'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
const creds = JSON.parse(readFileSync(process.env.PP_A135_CREDS, 'utf8'))
const c = new Client({ connectionString: process.env.DATABASE_URL })
await c.connect()
const h = (await c.query('select password_hash from users where id = $1', [creds.userId])).rows[0]?.password_hash ?? ''
await c.end()
const what = h.startsWith('$argon2')
  ? 'argon2id - the legacy hash was replaced on the first successful login, as designed'
  : /^\$2[abxy]\$/.test(h)
    ? 'STILL legacy bcrypt - the rehash on login did not happen'
    : 'unknown'
console.log(`rehash: the stored hash is now ${what}`)
JS_EOF
  "$RDB" exec target -- env PP_A135_CREDS="$CREDS" node "$HELP_DIR/rehash.mjs" || die "the rehash check failed"
fi

mark total $((SECONDS - t0))
info 'a1-35: PASSED (v2 booted on the migrated data, a migrated account logged in, one authenticated read succeeded)'
