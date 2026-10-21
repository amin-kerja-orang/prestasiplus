#!/usr/bin/env bash
# Smoke test of the demo deploy (Cloudflare Pages + /api proxy Function + API + Postgres).
# Runbook: docs/ops/demo-cloudflare-supabase.md, step 7. Needs bash, curl and node (Git Bash on Windows is fine).
#
#   BASE_URL=https://<project>.pages.dev DEMO_PASSWORD='<demo password>' bash scripts/demo-smoke.sh
#
# DEMO_PASSWORD is the published demo password of the seeded demo accounts (docs/AKAUN-DEMO.md). It is
# read from the environment only and never printed. Cookies and CSRF tokens are kept in a temp folder
# that is deleted on exit, and never printed either.
#
# Optional: STUDENT_ID (default pelajar@demo.test), ADMIN_ID (default admin@demo.test),
#           PAPER_ID (default: the first paper of the list), EXPECT_SECURE (default 1 for https BASE_URL).
# Exit code 0 = every check passed. Re-runnable: it starts a fresh attempt (restart) each time.
set -euo pipefail

BASE_URL="${BASE_URL:-}"
BASE_URL="${BASE_URL%/}"
STUDENT_ID="${STUDENT_ID:-pelajar@demo.test}"
ADMIN_ID="${ADMIN_ID:-admin@demo.test}"
if [[ -z "$BASE_URL" ]]; then echo "Set BASE_URL (e.g. https://<project>.pages.dev)" >&2; exit 2; fi
if [[ -z "${DEMO_PASSWORD:-}" ]]; then echo "Set DEMO_PASSWORD (see docs/AKAUN-DEMO.md)" >&2; exit 2; fi
case "$BASE_URL" in https://*) EXPECT_SECURE="${EXPECT_SECURE:-1}" ;; *) EXPECT_SECURE="${EXPECT_SECURE:-0}" ;; esac

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0
ok() { PASS=$((PASS + 1)); printf '  PASS  %s\n' "$1"; }
ko() { FAIL=$((FAIL + 1)); printf '  FAIL  %s\n' "$1"; }

# json <file> <js expression on d> : prints the value (empty when missing). No jq needed.
json() {
  node -e 'const fs=require("fs");let d;try{d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"))}catch{process.exit(0)}
const v=(new Function("d","try{return ("+process.argv[2]+")}catch{return undefined}"))(d);
if(v!==undefined&&v!==null)process.stdout.write(typeof v==="string"?v:JSON.stringify(v))' "$1" "$2"
}

# req <name> <method> <path> [body] : writes $TMP/<name>.body and .head, echoes the HTTP status.
# Uses the cookie jar $JAR and the CSRF token $CSRF (sent on every non-GET request).
req() {
  local name="$1" method="$2" path="$3" body="${4:-}"
  local args=(-sS -o "$TMP/$name.body" -D "$TMP/$name.head" -w '%{http_code}' -X "$method"
    -b "$JAR" -c "$JAR" --max-time 120 -H 'accept: application/json')
  if [[ "$method" != GET && -n "${CSRF:-}" ]]; then args+=(-H "x-csrf-token: $CSRF"); fi
  if [[ -n "$body" ]]; then
    # The body goes through stdin, not argv, so a login password never shows in the process list.
    args+=(-H 'content-type: application/json' --data-binary @-)
    printf '%s' "$body" | curl "${args[@]}" "$BASE_URL$path" || echo 000
    return
  fi
  curl "${args[@]}" "$BASE_URL$path" || echo 000
}

login() { # login <identifier> : sets LOGIN_CODE and CSRF (not run in a subshell, so the globals stick)
  local id="$1" body
  : >"$JAR"
  CSRF=""
  body="$(ID="$id" node -e 'process.stdout.write(JSON.stringify({identifier:process.env.ID,password:process.env.DEMO_PASSWORD,remember:false}))')"
  LOGIN_CODE="$(req login POST /api/auth/login "$body")"
  CSRF="$(json "$TMP/login.body" 'd.data.csrf')"
}

echo "Demo smoke against $BASE_URL"

echo "1. Static site and proxy"
code="$(curl -sS -o "$TMP/index.html" -w '%{http_code}' --max-time 60 "$BASE_URL/")" || code=000
[[ "$code" == 200 ]] && grep -qi '<div id="app"' "$TMP/index.html" && ok "GET / serves the SPA" || ko "GET / serves the SPA (HTTP $code)"
code="$(curl -sS -o "$TMP/deep.html" -w '%{http_code}' --max-time 60 "$BASE_URL/login")" || code=000
[[ "$code" == 200 ]] && grep -qi '<div id="app"' "$TMP/deep.html" && ok "deep link /login falls back to index.html" || ko "deep link /login (HTTP $code)"
JAR="$TMP/anon.jar"; : >"$JAR"; CSRF=""
echo "   (the first /api call can take up to ~60 s while a sleeping API host wakes up)"
code="$(req health GET /api/health)"
[[ "$code" == 200 && "$(json "$TMP/health.body" 'd.data.status')" == ok && "$(json "$TMP/health.body" 'd.data.db')" == up ]] \
  && ok "GET /api/health: status ok, db up" || ko "GET /api/health (HTTP $code)"
grep -qi '^cache-control: .*no-store' "$TMP/health.head" && ok "/api answers are not cached (no-store)" || ko "/api cache-control no-store missing"
grep -qi '^x-request-id: ' "$TMP/health.head" && ok "X-Request-Id comes back through the proxy" || ko "X-Request-Id missing"
code="$(req anon-session GET /api/session)"
[[ "$code" == 401 ]] && ok "GET /api/session without a cookie: 401" || ko "anonymous /api/session expected 401, got $code"

echo "2. Student login, CSRF and session cookie"
JAR="$TMP/student.jar"
login "$STUDENT_ID"; code="$LOGIN_CODE"
[[ "$code" == 200 && -n "$CSRF" ]] && ok "POST /api/auth/login as $STUDENT_ID" || ko "student login (HTTP $code)"
cookie="$(grep -i '^set-cookie: pp_session=' "$TMP/login.head" || true)"
if [[ -n "$cookie" ]] && grep -qi 'httponly' <<<"$cookie" && grep -qi 'samesite=lax' <<<"$cookie"; then
  ok "pp_session is HttpOnly; SameSite=Lax"
else ko "pp_session cookie flags (HttpOnly, SameSite=Lax)"; fi
if [[ "$EXPECT_SECURE" == 1 ]]; then
  grep -qi 'secure' <<<"$cookie" && ok "pp_session is Secure" || ko "pp_session is not Secure (COOKIE_SECURE=true on the API?)"
fi
grep -qi 'domain=' <<<"$cookie" && ko "pp_session carries a Domain (COOKIE_DOMAIN must be empty)" || ok "pp_session is host-only (no Domain)"
code="$(req session GET /api/session)"
[[ "$code" == 200 && "$(json "$TMP/session.body" 'd.data.active.role')" == student ]] && ok "GET /api/session: active role student" || ko "student session (HTTP $code)"
CSRF="$(json "$TMP/session.body" 'd.data.csrf')"
saved="$CSRF"; CSRF="wrong-token"
code="$(req csrf-bad POST /api/bijak/attempts '{"paperId":"1","mode":"latihan"}')"
CSRF="$saved"
[[ "$code" == 403 ]] && ok "a mutation with a wrong CSRF token is refused (403)" || ko "wrong CSRF token expected 403, got $code"

echo "3. Bijak SPM: papers, start, autosave, submit, result"
code="$(req papers GET /api/bijak/papers)"
n="$(json "$TMP/papers.body" 'd.data.length')"
[[ "$code" == 200 && "${n:-0}" -gt 0 ]] && ok "GET /api/bijak/papers: $n paper(s)" || ko "paper list (HTTP $code, ${n:-0} papers; BIJAK_POC_QUESTIONS=true and the demo seed?)"
PAPER_ID="${PAPER_ID:-$(json "$TMP/papers.body" 'd.data[0].id')}"
code="$(req start POST /api/bijak/attempts "{\"paperId\":\"$PAPER_ID\",\"mode\":\"exam\",\"restart\":true}")"
ATT="$(json "$TMP/start.body" 'd.data.attemptId')"
[[ ( "$code" == 201 || "$code" == 200 ) && -n "$ATT" ]] && ok "POST /api/bijak/attempts (paper $PAPER_ID, exam)" || ko "start attempt (HTTP $code)"
code="$(req view GET "/api/bijak/attempts/$ATT")"
QID="$(json "$TMP/view.body" 'd.data.questions.find(q=>q.mcq).id')"
OPT="$(json "$TMP/view.body" 'd.data.questions.find(q=>q.mcq).mcq.options[0].id')"
# Ids from the server are used in later requests and expressions: accept plain tokens only.
[[ "$QID" =~ ^[A-Za-z0-9_.-]+$ && "$OPT" =~ ^[A-Za-z0-9_.-]+$ && "$ATT" =~ ^[A-Za-z0-9_-]+$ ]] || { QID=""; OPT=""; }
[[ "$code" == 200 && -n "$QID" ]] && ok "GET /api/bijak/attempts/<id>: question view" || ko "attempt view (HTTP $code)"
NOW="$(node -e 'process.stdout.write(new Date().toISOString())')"
change="{\"partId\":\"$QID\",\"answer\":{\"choice\":\"$OPT\"},\"rev\":1,\"savedAt\":\"$NOW\"}"
code="$(req save PUT "/api/bijak/attempts/$ATT/answers" "{\"changes\":[$change]}")"
[[ "$code" == 200 ]] && ok "PUT /api/bijak/attempts/<id>/answers (autosave)" || ko "autosave (HTTP $code)"
code="$(req view2 GET "/api/bijak/attempts/$ATT")"
[[ "$(json "$TMP/view2.body" "d.data.attempt.answers['$QID'] ? 'yes' : ''")" == yes ]] && ok "the autosaved answer is stored on the server" || ko "autosaved answer not found on reload"
code="$(req submit POST "/api/bijak/attempts/$ATT/submit" "{\"idempotencyKey\":\"$ATT-hantar\",\"changes\":[]}")"
[[ "$code" == 200 ]] && ok "POST /api/bijak/attempts/<id>/submit" || ko "submit (HTTP $code)"
code="$(req result GET "/api/bijak/attempts/$ATT/result")"
[[ "$code" == 200 ]] && ok "GET /api/bijak/attempts/<id>/result" || ko "result (HTTP $code)"
code="$(req history GET /api/bijak/history)"
[[ "$code" == 200 ]] && ok "GET /api/bijak/history" || ko "history (HTTP $code)"
code="$(req logout POST /api/auth/logout)"
[[ "$code" == 200 || "$code" == 204 ]] && ok "POST /api/auth/logout" || ko "logout (HTTP $code)"

echo "4. Admin Pusat"
JAR="$TMP/admin.jar"
login "$ADMIN_ID"; code="$LOGIN_CODE"
[[ "$code" == 200 && -n "$CSRF" ]] && ok "POST /api/auth/login as $ADMIN_ID" || ko "admin login (HTTP $code)"
code="$(req a-papers GET /api/bijak/papers)"
[[ "$code" == 403 ]] && ok "admin outside Mod Pelajar: Bijak papers 403 (student-only API)" || ko "admin papers outside Mod Pelajar expected 403, got $code"
code="$(req a-builder GET /api/admin/papers)"
[[ "$code" == 200 ]] && ok "GET /api/admin/papers (Pembina Kertas list, BE-39)" || ko "admin paper builder list (HTTP $code)"
code="$(req a-mode POST /api/session/mode '{"mode":"mod_pelajar"}')"
[[ "$code" == 200 ]] && ok "POST /api/session/mode (Mod Pelajar)" || ko "enter Mod Pelajar (HTTP $code)"
CSRF="$(json "$TMP/a-mode.body" 'd.data.csrf')"; CSRF="${CSRF:-$(json "$TMP/login.body" 'd.data.csrf')}"
code="$(req a-papers2 GET /api/bijak/papers)"
n="$(json "$TMP/a-papers2.body" 'd.data.length')"
[[ "$code" == 200 && "${n:-0}" -gt 0 ]] && ok "admin in Mod Pelajar lists $n Bijak paper(s)" || ko "admin papers in Mod Pelajar (HTTP $code)"
code="$(req a-exit DELETE /api/session/mode)"
[[ "$code" == 200 ]] && ok "DELETE /api/session/mode" || ko "exit Mod Pelajar (HTTP $code)"
CSRF="$(json "$TMP/a-exit.body" 'd.data.csrf')"
code="$(req a-logout POST /api/auth/logout)"
[[ "$code" == 200 || "$code" == 204 ]] && ok "POST /api/auth/logout" || ko "admin logout (HTTP $code)"

echo "5. Client address seen by the API (TRUST_PROXY_HOPS)"
# The login pair throttle allows THROTTLE_LOGIN_PER_MINUTE (5) attempts per identifier and client address.
# Each attempt below spoofs a different X-Forwarded-For. The Function overwrites that header with the real
# client address, so the 6th attempt must get 429. If all get 401, the API trusts one hop too many and a
# client can choose its own address. (Too FEW hops shows up differently: every user shares one bucket; see
# the runbook for the two-network check.) Uses a random identifier that does not exist; about 10 s.
JAR="$TMP/spoof.jar"; : >"$JAR"; CSRF=""
SPOOF_ID="smoke-$(node -e 'process.stdout.write(require("crypto").randomBytes(4).toString("hex"))')@demo.test"
codes=""
for i in 1 2 3 4 5 6; do
  c="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 60 -H "x-forwarded-for: 203.0.113.$i" \
    -H 'content-type: application/json' --data-binary "{\"identifier\":\"$SPOOF_ID\",\"password\":\"not-the-password\",\"remember\":false}" \
    "$BASE_URL/api/auth/login")" || c=000
  codes="$codes $c"
done
[[ "$codes" == *429 ]] && ok "spoofed X-Forwarded-For is ignored (6th attempt 429:$codes)" || ko "spoofed X-Forwarded-For changed the throttle key (codes:$codes)"

echo
echo "Result: $PASS passed, $FAIL failed"
[[ "$FAIL" == 0 ]]
