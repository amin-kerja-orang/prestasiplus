#!/usr/bin/env bash
# Full-demo API walkthrough (not UI), 23 Oct demo. Calls the demo API routes persona by persona against one base URL.
# It never loads the SPA. Runbook: docs/ops/demo-cloudflare-supabase.md, section 7.1 "API walkthrough (not UI)".
#
# Run it on the demo project only, after the smoke test (scripts/demo-smoke.sh, Render then Pages) passes, and never at
# the same time as UAT, e2e or the smoke test (it logs in six times and shares the per-address rate limits).
#
#   read -rsp 'Demo password: ' DEMO_PASSWORD; echo
#   BASE_URL=https://<project>.pages.dev DEMO_PASSWORD="$DEMO_PASSWORD" bash scripts/demo-walkthrough.sh
#   unset DEMO_PASSWORD
#
# Needs bash >= 4, curl and jq. Git Bash on Windows ships bash 5 and curl but no jq: install it with
# `winget install jqlang.jq` (or put jq.exe from https://jqlang.org/download/ on PATH). macOS: `brew install bash jq`
# and run with the Homebrew bash (/bin/bash on macOS is 3.2). Debian/Ubuntu: `sudo apt-get install jq`.
#
# Personas (ids can be overridden):
#   STUDENT_ID       pelajar@demo.test        TEACHER_ID   guru@demo.test        PARENT_ID  ibubapa@demo.test
#   SCHOOL_ADMIN_ID  adminsekolah@demo.test   ADMIN_ID     admin@demo.test       (all in docs/AKAUN-DEMO.md)
#   MULTI_ID         guruadmin@demo.test (teacher + school admin; seeded by apps/api/prisma/seed/core/identity.ts)
#   FOSTER_STUDENT_EMAIL  pelajar2@demo.test  (the pupil named in the Keluarga Angkat application)
# Passwords: DEMO_PASSWORD for every persona, or a per-persona override STUDENT_PASSWORD, TEACHER_PASSWORD,
# PARENT_PASSWORD, SCHOOL_ADMIN_PASSWORD, ADMIN_PASSWORD, MULTI_PASSWORD. The script un-exports them at start, so no
# child process inherits them; each login hands the one password to jq only (env of that one command), jq pipes the
# body to curl on stdin (never argv). Passwords, cookies and CSRF tokens are never printed; the temp folder holding the
# cookie jars is deleted on exit.
#
# WRITES (off by default). Writes run only with CONFIRM_WRITES=1; the script then prints the target BASE_URL and waits
# 5 s (Ctrl-C to stop) before the first request. They are what a demo persona does in the demo: start, answer and
# submit one practice session; a battle quick match against the bot, then forfeit; a Papan Bijak quick match, then
# cancel; one Keluarga Angkat application as the parent; a teacher <-> school admin role switch. Each run with writes
# leaves one pending Keluarga Angkat row, one finished practice session and a battle record: run it once per demo
# database refresh and use the read-only default for rehearsals.
#
# STRICT (on by default). A module whose first route answers 404 NOT_FOUND is a FAIL "module not deployed". Exempt:
# STRICT_EXEMPT (default "ai intake-workflow": BE-36 #86 and BE-38 #85, unmerged on 21 Oct; set STRICT_EXEMPT="" once
# both are merged). An exempt module that answers 404 is a SKIP. A bare 404 without the API's NOT_FOUND envelope (for
# example a static-host 404) is always a FAIL. A non-JSON answer on /api (an HTML page from a misrouted proxy) is a FAIL
# "HTML on /api". STRICT=0 turns the not-deployed FAILs into SKIPs.
#
# BUILD_SHA: the commit the API under test was built from (the API does not report it). Default: HEAD of this checkout,
# which is right only when the deployed API was built from the same commit. Printed with the result.
#
# Exit code: 0 = GO (no FAIL, no SKIP other than the exempt modules). 1 = at least one FAIL. 3 = no FAIL but checks
# were SKIPPED ("N modules SKIPPED - not a go"; includes a read-only run). 2 = setup error.
set -uo pipefail

if [[ -z "${BASH_VERSINFO:-}" || "${BASH_VERSINFO[0]}" -lt 4 ]]; then
  echo "bash >= 4 is required (this is ${BASH_VERSION:-not bash}). macOS: brew install bash, then run it with that bash." >&2
  exit 2
fi
BASE_URL="${BASE_URL:-}"
BASE_URL="${BASE_URL%/}"
if [[ -z "$BASE_URL" ]]; then echo "Set BASE_URL (e.g. https://<project>.pages.dev)" >&2; exit 2; fi
command -v curl >/dev/null || { echo "curl is required" >&2; exit 2; }
command -v jq >/dev/null || { echo "jq is required: winget install jqlang.jq (Windows), brew install jq (macOS), apt-get install jq (Linux)" >&2; exit 2; }
STUDENT_ID="${STUDENT_ID:-pelajar@demo.test}"
TEACHER_ID="${TEACHER_ID:-guru@demo.test}"
PARENT_ID="${PARENT_ID:-ibubapa@demo.test}"
SCHOOL_ADMIN_ID="${SCHOOL_ADMIN_ID:-adminsekolah@demo.test}"
ADMIN_ID="${ADMIN_ID:-admin@demo.test}"
MULTI_ID="${MULTI_ID:-guruadmin@demo.test}"
FOSTER_STUDENT_EMAIL="${FOSTER_STUDENT_EMAIL:-pelajar2@demo.test}"
STRICT="${STRICT:-1}"
STRICT_EXEMPT="${STRICT_EXEMPT-ai intake-workflow}"
if [[ "${CONFIRM_WRITES:-0}" == 1 && "${WRITES:-1}" != 0 ]]; then WRITES=1
else
  [[ "${WRITES:-0}" == 1 ]] && echo "WRITES=1 alone is ignored: writes need CONFIRM_WRITES=1 (demo project only)." >&2
  WRITES=0
fi
BUILD_SHA="${BUILD_SHA:-$(git -C "$(dirname "$0")" rev-parse --short=8 HEAD 2>/dev/null || echo unknown)}"
for v in STUDENT TEACHER PARENT SCHOOL_ADMIN ADMIN MULTI; do
  p="${v}_PASSWORD"
  if [[ -z "${!p:-}" && -z "${DEMO_PASSWORD:-}" ]]; then echo "Set DEMO_PASSWORD (see docs/AKAUN-DEMO.md) or $p" >&2; exit 2; fi
done
# Keep the passwords as shell variables only: child processes (curl, awk, ...) do not inherit them.
export -n DEMO_PASSWORD STUDENT_PASSWORD TEACHER_PASSWORD PARENT_PASSWORD SCHOOL_ADMIN_PASSWORD ADMIN_PASSWORD MULTI_PASSWORD 2>/dev/null

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ROWS="$TMP/rows.tsv"
: >"$ROWS"
declare -A MOD # module -> live | down
PERSONA=""
NOT_JSON="HTML on /api (the answer is not JSON: check the /api proxy)"

row() { # row <PASS|FAIL|SKIP> <module> <check> [detail]
  printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$PERSONA" "$2" "$3" "${4:-}" >>"$ROWS"
  printf '  %-4s  %-14s %-16s %s%s\n' "$1" "$PERSONA" "$2" "$3" "${4:+  ($4)}"
}

# jqv <name> <jq filter> : value from $TMP/<name>.body ("" on missing/invalid JSON)
jqv() { jq -r "$2 // empty" "$TMP/$1.body" 2>/dev/null | head -c 2000; }
# jqt <name> <jq filter> : succeeds when the filter is true on the body
jqt() { [[ "$(jq -r "$2" "$TMP/$1.body" 2>/dev/null)" == true ]]; }
# notjson <name> : succeeds when the body is non-empty and not JSON (an HTML page on /api)
notjson() { [[ -s "$TMP/$1.body" ]] && ! jq -e . "$TMP/$1.body" >/dev/null 2>&1; }

# backoff <http code> <header file> : on 429 sleeps Retry-After (at most 65 s) and succeeds, so the caller retries.
# Login allows 5 a minute per address and the API 300 requests a minute; each request is retried up to 3 times.
backoff() {
  [[ "$1" == 429 ]] || return 1
  local s; s="$(tr -d '\r' <"$2" 2>/dev/null | awk -F': *' 'tolower($1)=="retry-after"{print $2}' | head -1)"
  [[ "$s" =~ ^[0-9]+$ ]] || s=30; (( s > 65 )) && s=65; (( s < 1 )) && s=1
  printf '        (HTTP 429, waiting %s s for the rate limit)\n' "$s" >&2
  sleep "$s"
}
RETRIES=3

# req <name> <method> <path> [body] : writes $TMP/<name>.body, echoes the HTTP status. Uses $JAR and $CSRF.
req() {
  local name="$1" method="$2" path="$3" body="${4:-}" code try
  local args=(-sS -o "$TMP/$name.body" -D "$TMP/$name.head" -w '%{http_code}' -X "$method" -b "$JAR" -c "$JAR" --max-time 120 -H 'accept: application/json')
  if [[ "$method" != GET ]]; then
    args+=(-H "Origin: $BASE_URL")
    [[ -n "${CSRF:-}" ]] && args+=(-H "x-csrf-token: $CSRF")
  fi
  [[ -n "$body" ]] && args+=(-H 'content-type: application/json' --data-binary @-)
  for (( try = 0; try <= RETRIES; try++ )); do
    if [[ -n "$body" ]]; then code="$(printf '%s' "$body" | curl "${args[@]}" "$BASE_URL$path" 2>/dev/null)" || code=000
    else code="$(curl "${args[@]}" "$BASE_URL$path" 2>/dev/null)" || code=000; fi
    if (( try < RETRIES )) && backoff "$code" "$TMP/$name.head"; then continue; fi; break
  done
  echo "$code"
}

# login <persona label> <identifier> <password variable> : new cookie jar; sets CSRF; records PASS/FAIL. 1 on failure.
login() {
  PERSONA="$1"
  local id="$2" pwvar="$3" code try
  JAR="$TMP/$1.jar"; : >"$JAR"; CSRF=""
  [[ "${LOGIN_GAP:-0}" =~ ^[0-9]+$ && "${LOGIN_GAP:-0}" -gt 0 ]] && sleep "$LOGIN_GAP"
  for (( try = 0; try <= RETRIES; try++ )); do
    # The password exists only in the environment of this one jq; jq writes the body to curl's stdin.
    code="$(PW="${!pwvar:-${DEMO_PASSWORD:-}}" ID="$id" jq -nc '{identifier: env.ID, password: env.PW, remember: false}' |
      curl -sS -o "$TMP/login.body" -D "$TMP/login.head" -w '%{http_code}' -X POST -b "$JAR" -c "$JAR" --max-time 120 \
        -H 'accept: application/json' -H 'content-type: application/json' -H "Origin: $BASE_URL" --data-binary @- \
        "$BASE_URL/api/auth/login" 2>/dev/null)" || code=000
    if (( try < RETRIES )) && backoff "$code" "$TMP/login.head"; then continue; fi; break
  done
  if notjson login; then row FAIL auth "POST /api/auth/login as $id" "HTTP $code, $NOT_JSON"; return 1; fi
  CSRF="$(jqv login '.data.csrf')"
  if [[ "$code" == 200 && -n "$CSRF" ]]; then row PASS auth "POST /api/auth/login as $id" "role $(jqv login '.data.active.role')"; return 0; fi
  row FAIL auth "POST /api/auth/login as $id" "HTTP $code $(jqv login '.error.code')"
  return 1
}

logout() {
  local code; code="$(req logout POST /api/auth/logout)"
  if [[ "$code" == 200 || "$code" == 204 ]]; then row PASS auth "POST /api/auth/logout"; else row FAIL auth "POST /api/auth/logout" "HTTP $code"; fi
}

exempt() { [[ " $STRICT_EXEMPT " == *" $1 "* ]]; }

# check <module> <method> <path> <expected codes, e.g. 200 or 200|201> [jq assertion] [body] [name]
# Module state: the first answer of a module decides whether it is deployed. A 404 NOT_FOUND then marks it "down":
# FAIL (STRICT=1, module not exempt) or SKIP, and every later check of that module is reported the same way.
# Sets LAST to the result name for follow-up reads.
check() {
  local module="$1" method="$2" path="$3" expect="$4" assert="${5:-}" body="${6:-}" name="${7:-r$RANDOM}"
  local label="$method $path" code err
  LAST="$name"
  if [[ "${MOD[$module]:-}" == down ]]; then
    if [[ "$STRICT" == 1 ]] && ! exempt "$module"; then row FAIL "$module" "$label" "module not deployed (STRICT=1)"
    else row SKIP "$module" "$label" "not deployed"; fi
    return 1
  fi
  code="$(req "$name" "$method" "$path" "$body")"
  if notjson "$name"; then row FAIL "$module" "$label" "HTTP $code, $NOT_JSON"; return 1; fi
  err="$(jqv "$name" '.error.code? // empty')"
  if [[ "$code" == 404 && "$err" == NOT_FOUND && -z "${MOD[$module]:-}" ]]; then
    MOD[$module]=down
    if [[ "$STRICT" == 1 ]] && ! exempt "$module"; then row FAIL "$module" "$label" "HTTP 404: module not deployed (STRICT=1)"
    else row SKIP "$module" "$label" "skipped: not deployed (404)"; fi
    return 1
  fi
  [[ "$code" != 404 ]] && MOD[$module]="${MOD[$module]:-live}"
  if [[ "|$expect|" != *"|$code|"* ]]; then row FAIL "$module" "$label" "HTTP $code${err:+ $err}, expected $expect"; return 1; fi
  if [[ -n "$assert" ]] && ! jqt "$name" "$assert"; then row FAIL "$module" "$label" "HTTP $code but the body fails: $assert"; return 1; fi
  row PASS "$module" "$label" "HTTP $code"
  return 0
}

skipw() { row SKIP "$1" "$2" "WRITES off (set CONFIRM_WRITES=1)"; }
uuid() { cat /proc/sys/kernel/random/uuid 2>/dev/null || od -An -N16 -tx1 /dev/urandom | tr -d ' \n' | sed -E 's/(.{8})(.{4}).(.{3}).(.{3})(.{12})/\1-\2-4\3-a\4-\5/'; }
# Leaderboard rows of any shape: podium + rows (gamification), or a plain list.
LB_ROWS='[(.data.podium // [])[], (.data.rows // [])[]]'

echo "API walkthrough (not UI) against $BASE_URL"
echo "   build $BUILD_SHA, STRICT=$STRICT (exempt: ${STRICT_EXEMPT:-none}), WRITES=$WRITES"
if [[ "$WRITES" == 1 ]]; then
  echo "   WRITES ON: demo rows will be written to $BASE_URL (demo project only). Ctrl-C within 5 s to stop."
  sleep "${CONFIRM_DELAY:-5}"
else
  echo "   read-only run (writes need CONFIRM_WRITES=1); a read-only run is never a go"
fi
echo "   (the first /api call can take up to ~60 s while a sleeping API host wakes up)"

# ------------------------------------------------------------------------------------------------ 0. platform
PERSONA=anon; JAR="$TMP/anon.jar"; : >"$JAR"; CSRF=""
check core GET /api/health 200 '.data.status == "ok" and .data.db == "up"'
check core GET /api/session 401

# ------------------------------------------------------------------------------------------------ 1. student
echo "1. Student ($STUDENT_ID)"
STUDENT_UID=""
if login student "$STUDENT_ID" STUDENT_PASSWORD; then
  check core GET /api/session 200 '.data.active.role == "student"' "" s-session
  STUDENT_UID="$(jqv s-session '.data.user.id')"
  check dashboard GET /api/dashboard 200 '.data.wallet != null and .data.streak != null'
  check dashboard GET /api/me/gamification-summary 200
  check dashboard GET /api/me/notifications 200 '(.data | type) == "array"'
  # Practice (BE-12 / BE-29 reads)
  check practice GET /api/practice/subjects 200 '(.data | length) > 0' "" s-subjects
  check practice GET '/api/practice/sessions?modes=random,chapter,revision' 200 '(.data | type) == "array"'
  check practice GET /api/practice/progress 200 '.data.answered != null'
  check practice GET /api/practice/history 200
  check practice GET /api/practice/revision 200
  check practice GET /api/practice/mastery 200
  if [[ "$WRITES" == 1 ]]; then
    # Start a session on the subject with the most approved questions (idempotent per clientUuid), answer the first
    # question with its first option (both ids come from the start answer), submit.
    SUBJ="$(jqv s-subjects '[.data[] | select((.approvedCount // 0) > 0)] | max_by(.approvedCount) | .code')"
    if [[ -z "$SUBJ" ]]; then row FAIL practice "POST /api/practice/sessions" "no subject with approvedCount > 0 in GET /api/practice/subjects"
    else
      START="$(jq -nc --arg s "$SUBJ" --arg u "$(uuid)" '{mode:"random", subjectCode:$s, count:5, clientUuid:$u}')"
      if check practice POST /api/practice/sessions '200|201' '(.data.sessionId | length) > 0 and (.data.questions | length) > 0' "$START" s-start; then
        SID="$(jqv s-start '.data.sessionId')"
        CHECK="$(jq -c '.data.questions[0] | {questionId: (.id | tostring), selectedOptionId: (.options[0].id // 0)}' "$TMP/s-start.body" 2>/dev/null)"
        check practice POST "/api/practice/sessions/$SID/check-answer" '200|201' '.data.isCorrect != null' "$CHECK"
        check practice POST "/api/practice/sessions/$SID/submit" '200|201' '.data.results.total > 0' '{"timeSpent":60}'
      fi
    fi
  else skipw practice "POST /api/practice/sessions"; fi
  # SPM hub (BE-41)
  check spm GET /api/spm/overview 200 '.data.stats != null and .data.modules != null'
  check spm GET /api/spm/databank 200 '(.data | length) > 0'
  check spm GET /api/spm/latih-tubi 200
  check spm GET /api/spm/tracking-a 200
  check spm GET /api/spm/subjektif 200
  check spm GET /api/spm-targets 200 '(.data.subjects | length) > 0'
  check spm GET /api/spm-mocks 200
  check spm GET /api/duta/recommendations 200
  check bijak GET /api/bijak/papers 200 '(.data | length) > 0'
  # Leaderboard + children's-names rule: a student sees a full name and userId only on their own row.
  check leaderboard GET /api/gamification/leaderboard 200 "$LB_ROWS | length > 0" "" s-lb
  if [[ -f "$TMP/s-lb.body" && -n "$STUDENT_UID" ]]; then
    if jqt s-lb "$LB_ROWS | all(.userId == null or .userId == \"$STUDENT_UID\")"; then row PASS leaderboard "children's-names rule (student)" "other pupils masked, userId null"
    else row FAIL leaderboard "children's-names rule (student)" "another pupil's userId/full name is visible"; fi
  fi
  check leaderboard GET /api/leaderboard 200
  # Gamification + shop
  check gamification GET /api/gamification/wallet 200 '.data.currentSyiling != null'
  check gamification GET /api/gamification/challenges 200
  check gamification GET /api/gamification/achievements 200 '.data.total > 0'
  check gamification GET /api/gamification/convert 200 '.data.rate != null'
  check shop GET '/api/hadiah-digital/items?cat=all' 200 '(.data | type) == "array"'
  check shop GET /api/hadiah-digital/redemptions 200
  check shop GET /api/gamification/mystery-boxes 200 '(.data.boxes | length) > 0'
  check shop GET /api/cabutan 200
  # Games hub / Papan Bijak (BE-45) and battle (BE-44)
  check games GET /api/games/hub 200 '.data.chips != null'
  check games GET /api/games/papan-bijak/lobby 200 '.data.autoGrade != null'
  if [[ -f "$TMP/$LAST.body" ]] && jq -e '.data.top10' "$TMP/$LAST.body" >/dev/null 2>&1; then
    if jqt "$LAST" "[.data.top10[]] | all(.userId == null or .userId == \"$STUDENT_UID\")"; then row PASS games "children's-names rule (Papan Bijak board)"
    else row FAIL games "children's-names rule (Papan Bijak board)" "another pupil's userId is visible"; fi
  fi
  check games GET /api/games/jutawan 200
  check games GET /api/games/roda-nasib 200 '(.data.segments | length) > 0'
  check games GET /api/games/pertandingan 200
  check games GET /api/leagues 200
  if [[ "$WRITES" == 1 && "${MOD[games]:-}" == live ]]; then
    # The API lists no Papan Bijak subjects; these are the contract's GAMES_PAPAN_BIJAK_SUBJECTS. Try each until one
    # is accepted (PAPAN_SUBJECT forces one).
    PB_OK=""; PB_LAST=""
    for subj in ${PAPAN_SUBJECT:-MATEMATIK BAHASA_MELAYU BAHASA_INGGERIS SAINS}; do
      code="$(req s-pb POST /api/papan-bijak/quick-match "{\"subject\":\"$subj\",\"match_mode\":\"same_grade\"}")"
      PB_LAST="HTTP $code $(jqv s-pb '.error.code // .message')"
      if [[ "$code" == 200 ]] && jqt s-pb '.status == "searching" or .status == "matched"'; then PB_OK="$subj"; break; fi
    done
    if [[ -n "$PB_OK" ]]; then
      row PASS games "POST /api/papan-bijak/quick-match" "subject $PB_OK"
      check games GET /api/papan-bijak/quick-match/poll 200 '.status != null'
      check games POST /api/papan-bijak/quick-match/cancel 200 '.status == "cancelled" or .status == "matched"' '{}'
    else row FAIL games "POST /api/papan-bijak/quick-match" "no subject accepted (last: $PB_LAST)"; fi
  elif [[ "$WRITES" != 1 ]]; then skipw games "POST /api/papan-bijak/quick-match"; fi
  check battle GET /api/battle/lobby 200 '(.data.subjects | length) > 0' "" s-lobby
  check battle GET /api/battle/history 200
  check battle GET /api/battle/invitations 200
  check battle GET '/api/battle/standings/students?period=weekly' 200
  if [[ -f "$TMP/$LAST.body" ]]; then
    if jqt "$LAST" "[.data | if type == \"array\" then .[] elif type == \"object\" then ((.rows // [])[], (.podium // [])[]) else empty end] | map(objects) | all((.userId // null) == null or .userId == \"$STUDENT_UID\")"; then row PASS battle "children's-names rule (battle standings)"
    else row FAIL battle "children's-names rule (battle standings)" "another pupil's userId is visible"; fi
  fi
  check battle GET '/api/battle/standings/schools?period=weekly' 200
  check battle GET /api/tournament/active 200
  if [[ "$WRITES" == 1 && "${MOD[battle]:-}" == live ]]; then
    # Quick match against the bot: the bot matches on the 3rd poll (BATTLE_RULES.matchOnPoll), then forfeit to tidy up.
    # The pool needs 10 eligible questions at the pupil's level; try each lobby subject until one has them.
    QUEUE=""; sid=""
    for sid in $(jqv s-lobby '[.data.subjects[].id] | join(" ")'); do
      [[ "$sid" =~ ^[0-9]+$ ]] || continue
      code="$(req s-qm POST /api/battle/quick-match "{\"question_type\":\"biasa\",\"subject_id\":\"$sid\",\"open_to_all\":true}")"
      if [[ "$code" == 200 ]]; then QUEUE="$(jqv s-qm '.queue_id')"; break; fi
    done
    if [[ "$QUEUE" =~ ^[0-9]+$ ]]; then
      row PASS battle "POST /api/battle/quick-match" "queue $QUEUE, subject $sid"
      BATTLE=""
      for _ in 1 2 3 4 5; do
        sleep 1
        req s-poll GET "/api/battle/poll-match/$QUEUE" >/dev/null
        [[ "$(jqv s-poll '.status')" == matched ]] && { BATTLE="$(jqv s-poll '.battle_uuid')"; break; }
      done
      if [[ "$BATTLE" =~ ^[A-Za-z0-9-]+$ ]]; then
        row PASS battle "GET /api/battle/poll-match/<queue>" "matched with the bot"
        check battle GET "/api/battle/arena/$BATTLE" 200
        check battle POST "/api/battle/forfeit/$BATTLE" '200|201|204' '' '{}'
      else row FAIL battle "GET /api/battle/poll-match/<queue>" "no match after 5 polls (last: $(jqv s-poll '.status'))"; fi
    else
      row FAIL battle "POST /api/battle/quick-match" "HTTP 422 for every lobby subject: no subject has 10 eligible questions at the pupil's level"
    fi
  elif [[ "$WRITES" != 1 ]]; then skipw battle "POST /api/battle/quick-match"; fi
  # Guards: a student cannot open admin routes.
  check command-center GET /api/admin/command-center/live-data 403
  check intake-dashboard GET /api/intake/dashboard 403
  logout
fi

# ------------------------------------------------------------------------------------------------ 2. teacher
echo "2. Teacher ($TEACHER_ID)"
if login teacher "$TEACHER_ID" TEACHER_PASSWORD; then
  check dashboard GET /api/guru/dashboard 200 '.data.stats != null'
  check classes GET /api/guru/classes 200 '(.data | length) > 0' "" t-classes
  CLASS_ID="$(jqv t-classes '.data[0].id')"
  check classes GET /api/guru/students 200 '(.data | length) > 0' "" t-students
  check performance GET /api/performance/classes 200 '(.data | length) > 0'
  check cikgu GET /api/cikgu/rph 200
  check command-center GET /api/guru/command-center/live-data 200 '((.data // .) | .totalStudentsRaw) != null'
  [[ "$CLASS_ID" =~ ^[0-9]+$ ]] && check command-center GET "/api/command-center/classroom/$CLASS_ID" 200 '.data.class != null'
  check leaderboard GET /api/gamification/leaderboard 200 "$LB_ROWS | length > 0" "" t-lb
  if [[ -f "$TMP/t-lb.body" && -f "$TMP/t-students.body" ]]; then
    MINE="$(jq -c '[.data[].id]' "$TMP/t-students.body" 2>/dev/null || echo '[]')"
    if jqt t-lb "$MINE as \$m | $LB_ROWS | all(.userId == null or (.userId as \$u | \$m | index(\$u)) != null)"; then
      row PASS leaderboard "children's-names rule (teacher)" "only own pupils unmasked"
    else row FAIL leaderboard "children's-names rule (teacher)" "a pupil outside the teacher's classes is unmasked"; fi
  fi
  check games GET /api/games/hub 200
  check battle GET /api/battle/lobby 200
  check intake-dashboard GET /api/intake/dashboard 403
  logout
fi

# ------------------------------------------------------------------------------------------------ 3. parent
echo "3. Parent ($PARENT_ID)"
if login parent "$PARENT_ID" PARENT_PASSWORD; then
  check core GET /api/me 200 '.data.roles | index("parent") != null'
  check dashboard GET /api/dashboard 200
  check parents GET /api/me/parent-links 200 '(.data | type) == "array"'
  check dashboard GET /api/me/notifications 200
  check leaderboard GET /api/gamification/leaderboard 200 "" "" p-lb
  if [[ -f "$TMP/p-lb.body" ]]; then
    if jqt p-lb "$LB_ROWS | all(.userId == null)"; then row PASS leaderboard "children's-names rule (parent)" "every pupil masked"
    else row FAIL leaderboard "children's-names rule (parent)" "a pupil's userId is visible to a parent"; fi
  fi
  if [[ "$WRITES" == 1 ]]; then
    FOSTER="$(jq -nc --arg e "$FOSTER_STUDENT_EMAIL" '{studentEmail:$e, studentCategory:"B40", familyIncomeRange:"RM1,000 - RM2,500", reason:"Permohonan contoh semasa walkthrough demo."}')"
    check foster POST /api/mohon-keluarga-angkat 201 '(.data.id | length) > 0' "$FOSTER"
  else skipw foster "POST /api/mohon-keluarga-angkat"; fi
  logout
fi

# ------------------------------------------------------------------------------------------------ 4. school admin
echo "4. School admin ($SCHOOL_ADMIN_ID)"
if login school-admin "$SCHOOL_ADMIN_ID" SCHOOL_ADMIN_PASSWORD; then
  check school-admin GET /api/admin-sekolah/dashboard 200 '.data.school.id != null' "" sa-dash
  SCHOOL_ID="$(jqv sa-dash '.data.school.id')"
  check school-admin GET /api/admin-sekolah/guru 200 '(.data | length) > 0'
  check school-admin GET /api/admin-sekolah/pelajar 200 '(.data | length) > 0'
  check school-admin GET /api/admin-sekolah/kelas 200
  check command-center GET /api/admin/command-center/live-data 200 '.data.scope == "school"'
  check command-center GET '/api/command-center/daily-activity?period=7' 200 '.data.logins != null'
  [[ "$SCHOOL_ID" =~ ^[0-9]+$ ]] && check command-center GET "/api/command-center/school/$SCHOOL_ID" 200 '.data.cards != null'
  check command-center GET /api/admin/server-status 403
  check leaderboard GET /api/gamification/leaderboard 200 "$LB_ROWS | length > 0"
  logout
fi

# ------------------------------------------------------------------------------------------------ 5. multi-role switch
echo "5. Role switch ($MULTI_ID: teacher <-> school admin)"
if login multi-role "$MULTI_ID" MULTI_PASSWORD; then
  FIRST="$(jqv login '.data.active.role')"
  OTHER=school_admin; [[ "$FIRST" == school_admin ]] && OTHER=teacher
  if [[ "$WRITES" == 1 ]]; then
    if check core POST /api/session/role 200 ".data.active.role == \"$OTHER\"" "{\"role\":\"$OTHER\"}" m-switch; then
      CSRF="$(jqv m-switch '.data.csrf')"
      check core POST /api/session/role 200 ".data.active.role == \"$FIRST\"" "{\"role\":\"$FIRST\"}" m-back && CSRF="$(jqv m-back '.data.csrf')"
    fi
  else skipw core "POST /api/session/role"; fi
  logout
fi

# ------------------------------------------------------------------------------------------------ 6. super admin
echo "6. Admin Pusat ($ADMIN_ID)"
if login admin "$ADMIN_ID" ADMIN_PASSWORD; then
  check admin GET /api/admin/users 200 '(.data | length) > 0'
  check admin GET /api/admin/schools 200 '(.data | length) > 0'
  check admin GET /api/admin/gamification/overview 200
  check command-center GET /api/admin/command-center/live-data 200 '.data.scope == "platform"'
  check command-center GET '/api/command-center/daily-activity?period=7' 200
  check command-center GET /api/admin/server-status 200 '.data.cpuPct != null'
  check leaderboard GET /api/gamification/leaderboard 200 "" "" a-lb
  if [[ -f "$TMP/a-lb.body" ]]; then
    if jqt a-lb "$LB_ROWS | all(.userId != null)"; then row PASS leaderboard "children's-names rule (admin)" "admin sees every name"
    else row FAIL leaderboard "children's-names rule (admin)" "admin got a masked row"; fi
  fi
  check games GET /api/admin/games 200 '.data.stats != null'
  check battle GET /api/tournaments 200
  check intake-dashboard GET "/api/intake/dashboard?month=$(date +%Y-%m)" 200 '.data.submissions != null'
  check intake GET /api/intake/batches 200
  # BE-36 AI status (#86) and BE-38 intake workflow (#85): exempt from STRICT while unmerged (STRICT_EXEMPT).
  check ai GET /api/ai/status 200
  check ai GET /api/ai/usage 200
  check intake-workflow GET /api/intake/items 200
  logout
fi

# ------------------------------------------------------------------------------------------------ result table
echo
pass="$(grep -c '^PASS' "$ROWS")"; fail="$(grep -c '^FAIL' "$ROWS")"; skip="$(grep -c '^SKIP' "$ROWS")"
# SKIP rows that block a go: every SKIP except the not-deployed rows of an exempt module.
blocking=0; declare -A SKIPMOD=()
while IFS=$'\t' read -r res _ module _ detail; do
  [[ "$res" == SKIP ]] || continue
  if exempt "$module" && [[ "$detail" == *"not deployed"* ]]; then continue; fi
  blocking=$((blocking + 1)); SKIPMOD[$module]=1
done <"$ROWS"
echo "| Result | Persona | Module | Check | Detail |"
echo "|---|---|---|---|---|"
awk -F'\t' '{ printf "| %s | %s | %s | %s | %s |\n", $1, $2, $3, $4, $5 }' "$ROWS"
echo
echo "Result at build $BUILD_SHA ($BASE_URL, STRICT=$STRICT, WRITES=$WRITES): $pass passed, $fail failed, $skip skipped"
if (( fail > 0 )); then echo "NOT A GO: $fail checks FAILED"; exit 1; fi
if (( blocking > 0 )); then echo "${#SKIPMOD[@]} modules SKIPPED — not a go ($blocking checks: ${!SKIPMOD[*]})"; exit 3; fi
echo "GO: no FAIL, no blocking SKIP"
exit 0
