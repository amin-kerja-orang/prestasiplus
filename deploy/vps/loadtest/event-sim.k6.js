// k6 "event" simulation for the PrestasiPlus API through the edge: about 400 pupils arrive at random times over a ramp,
// each does Latih Tubi practice, a Bijak SPM exam attempt, or plain browsing, then leaves over a ramp-down.
// Guide: deploy/vps/loadtest/README.md, section "Event simulation (400 pupils)". Accounts: seed-test-pupils.cjs.
//
//   k6 run -e BASE_URL=https://app.example.my -e LT_CONFIRM_TARGET=app.example.my -e LT_I_UNDERSTAND_THIS_WRITES_DATA=yes \
//          -e LT_ACCOUNTS_FILE=/path/lt-accounts.json -e LT_PASSWORD_FILE=/path/lt-pass \
//          -e LT_SUMMARY_JSON=/path/summary.json deploy/vps/loadtest/event-sim.k6.js
//
// One virtual user (VU) = one pupil with its own account. Each VU waits a random time inside the ramp, logs in once,
// repeats (weighted random behaviour, then an idle pause) until it is its turn to leave inside the ramp-down, and finishes
// the activity it is in. NEVER point it at production without the LEAD's say-so: it writes data (sessions, answers, attempts).
// It never calls an AI endpoint (the helper `call` refuses such a path), because those cost money.
//
// Environment (names only; no value is stored in the repo):
//   BASE_URL                         required, https://host (no trailing slash)
//   LT_CONFIRM_TARGET                required, must equal the host of BASE_URL
//   LT_I_UNDERSTAND_THIS_WRITES_DATA required, must be `yes`
//   LT_ACCOUNTS_FILE                 JSON file, either ["lt-pupil-0001", ...] (identifiers only, then LT_PASSWORD_FILE is required)
//                                    or [{"identifier":"...","password":"..."}] (the older format of pupil-load.k6.js)
//   LT_PASSWORD_FILE                 file with ONE line: the password of every identifier. Read with open() in the init context, so the
//                                    password is never in the process list or in `-e` arguments. Keep it outside the repo, mode 600.
//   (or LT_IDENTIFIER_PREFIX + LT_IDENTIFIER_COUNT + LT_PASSWORD, only for throw-away accounts)
//   LT_PUPILS (400)  LT_RAMP (5m)  LT_HOLD (15m)  LT_RAMPDOWN (3m)      durations like 90s, 5m, 1h
//   LT_W_PRACTICE (60)  LT_W_BIJAK (20)  LT_W_BROWSE (20)             weights of the behaviours (any positive numbers)
//   LT_THINK_MIN_S (10)  LT_THINK_MAX_S (40)                          think time before each practice answer
//   LT_PRACTICE_COUNTS (5,10)                                         question counts to pick from (5, 10, 15 or 20 are always accepted)
//   LT_SAVE_INTERVAL_S (10)  LT_SAVES (6)                             Bijak autosave pace
//   LT_IDLE_MIN_S (5)  LT_IDLE_MAX_S (20)                             pause between two behaviours
//   LT_SUMMARY_JSON                                                    path of the compact JSON summary (default ./event-sim-summary.json)
//   LT_P95_<KIND>_MS                                                   threshold overrides, see THRESHOLDS below
//   LT_MAX_ERROR_RATE (0.01)
//
// Endpoints used (all in the contract; no AI): POST /api/auth/login, GET /api/session, /api/dashboard, /api/me/notifications,
// /api/practice/subjects, /api/spm/latih-tubi, /api/spm/latih-tubi/{code}, POST /api/practice/sessions, POST .../{id}/check-answer,
// POST .../{id}/submit, GET /api/practice/sessions?modes=latih_tubi, GET /api/bijak/papers, POST /api/bijak/attempts,
// GET /api/bijak/attempts/{id}, PUT .../answers, POST .../submit, GET .../result.
import http from 'k6/http'
import { check, fail, sleep } from 'k6'
import { Counter } from 'k6/metrics'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/+$/, '')
const num = (name, def) => (__ENV[name] !== undefined && __ENV[name] !== '' ? Number(__ENV[name]) : def)

function seconds(text, def) {
  const m = /^(\d+(?:\.\d+)?)\s*(s|m|h)?$/.exec(String(text === undefined || text === '' ? def : text).trim())
  if (!m) throw new Error(`bad duration "${text}" (use 90s, 5m, 1h)`)
  return Math.round(Number(m[1]) * { s: 1, m: 60, h: 3600 }[m[2] || 's'])
}

const PUPILS = num('LT_PUPILS', 400)
const RAMP_S = seconds(__ENV.LT_RAMP, '5m')
const HOLD_S = seconds(__ENV.LT_HOLD, '15m')
const DOWN_S = seconds(__ENV.LT_RAMPDOWN, '3m')
const TOTAL_S = RAMP_S + HOLD_S + DOWN_S
const W = { practice: num('LT_W_PRACTICE', 60), bijak: num('LT_W_BIJAK', 20), browse: num('LT_W_BROWSE', 20) }
const THINK_MIN = num('LT_THINK_MIN_S', 10)
const THINK_MAX = Math.max(THINK_MIN, num('LT_THINK_MAX_S', 40))
const IDLE_MIN = num('LT_IDLE_MIN_S', 5)
const IDLE_MAX = Math.max(IDLE_MIN, num('LT_IDLE_MAX_S', 20))
const SAVE_INTERVAL_S = num('LT_SAVE_INTERVAL_S', 10)
const SAVES = num('LT_SAVES', 6)
const PRACTICE_COUNTS = (__ENV.LT_PRACTICE_COUNTS || '5,10').split(',').map((x) => Number(x.trim())).filter((x) => x > 0)
const SUMMARY_PATH = __ENV.LT_SUMMARY_JSON || 'event-sim-summary.json'

const KINDS = ['login', 'read', 'practice_start', 'practice_check', 'practice_submit', 'bijak_start', 'autosave', 'bijak_submit']
const THRESHOLDS_MS = {
  login: 3000, // argon2id verify is CPU heavy and only 2 run at once in the API process
  read: 500,
  practice_start: 1500,
  practice_check: 500,
  practice_submit: 1500,
  bijak_start: 1500,
  autosave: 400,
  bijak_submit: 2000,
}

const throttled = new Counter('throttled_429')
const server5xx = new Counter('server_5xx')
const noQuestions = new Counter('practice_no_questions') // 422 on start: that subject has too few questions; expected, not a fault
const trialExhausted = new Counter('trial_402') // 402: the test school is not subscribed (seed problem), every pupil is capped at 50 questions
const iterPractice = new Counter('iterations_practice')
const iterBijak = new Counter('iterations_bijak')
const iterBrowse = new Counter('iterations_browse')

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }))

const thresholds = {
  http_req_failed: [`rate<${num('LT_MAX_ERROR_RATE', 0.01)}`],
  throttled_429: ['count==0'], // a 429 means a rate limit was hit, not the capacity of the server
  checks: ['rate>0.99'],
}
for (const k of KINDS) {
  thresholds[`http_req_duration{kind:${k}}`] = [`p(95)<${num(`LT_P95_${k.toUpperCase()}_MS`, THRESHOLDS_MS[k])}`]
  // Always-true thresholds: they only make k6 keep the per-kind request count and error rate for the summary.
  thresholds[`http_reqs{kind:${k}}`] = ['count>=0']
  thresholds[`http_req_failed{kind:${k}}`] = ['rate>=0']
}

export const options = {
  scenarios: {
    pupils: {
      // One VU per pupil for the whole run. The arrival and the leaving time are random and chosen inside default().
      executor: 'constant-vus',
      vus: PUPILS,
      duration: `${TOTAL_S}s`,
      gracefulStop: '5m',
    },
  },
  thresholds,
  // A real browser keeps its session cookie between page loads; k6 would clear the jar at every iteration.
  noCookiesReset: true,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
}

const readOne = (path) => open(path).trim() // one line; surrounding whitespace and the trailing newline are not part of the password

const accounts = new SharedArray('accounts', () => {
  const pw = __ENV.LT_PASSWORD_FILE ? readOne(__ENV.LT_PASSWORD_FILE) : __ENV.LT_PASSWORD || ''
  if (__ENV.LT_ACCOUNTS_FILE) {
    const raw = JSON.parse(open(__ENV.LT_ACCOUNTS_FILE))
    return raw.map((a) => (typeof a === 'string' ? { identifier: a, password: pw } : { identifier: a.identifier, password: a.password || pw }))
  }
  const n = num('LT_IDENTIFIER_COUNT', 0)
  if (__ENV.LT_IDENTIFIER_PREFIX && pw && n > 0) {
    const out = []
    for (let i = 1; i <= n; i++) out.push({ identifier: `${__ENV.LT_IDENTIFIER_PREFIX}${i}`, password: pw })
    return out
  }
  return []
})

export function setup() {
  if (!BASE_URL) fail('BASE_URL is required')
  if (__ENV.LT_I_UNDERSTAND_THIS_WRITES_DATA !== 'yes') fail('set LT_I_UNDERSTAND_THIS_WRITES_DATA=yes: this test logs in many accounts and writes practice sessions, answers and exam attempts')
  const host = (BASE_URL.match(/^https?:\/\/([^/:]+)/) || [])[1]
  if (!host || __ENV.LT_CONFIRM_TARGET !== host) fail(`LT_CONFIRM_TARGET must equal the host of BASE_URL (${host}). Set it only for an environment the LEAD approved for load tests.`)
  if (accounts.length === 0) fail('no accounts: set LT_ACCOUNTS_FILE (+ LT_PASSWORD_FILE), or LT_IDENTIFIER_PREFIX + LT_IDENTIFIER_COUNT + LT_PASSWORD_FILE')
  if (accounts.some((a) => !a.password)) fail('accounts without a password: set LT_PASSWORD_FILE (one line) for an identifiers-only accounts file')
  if (accounts.length < PUPILS) fail(`only ${accounts.length} accounts for ${PUPILS} pupils: the per-user limits would bite differently than in real life. Seed more, or lower LT_PUPILS.`)
  if (W.practice + W.bijak + W.browse <= 0) fail('the behaviour weights are all zero')
  if (PRACTICE_COUNTS.length === 0) fail('LT_PRACTICE_COUNTS is empty')
  console.log(`event-sim: ${PUPILS} pupils, arrive over ${RAMP_S}s, hold ${HOLD_S}s, leave over ${DOWN_S}s (total ${TOTAL_S}s), weights practice/bijak/browse = ${W.practice}/${W.bijak}/${W.browse}`)
}

// ---- per-VU state (a VU keeps its cookie jar between iterations) ----
let csrf = ''
let loggedIn = false
let arrivedAt // seconds after the scenario start when this pupil shows up
let leavesAt // seconds after the scenario start when this pupil stops starting new activities
let lastLoginAttempt = -1e9
let loginFailures = 0

// Never call anything that costs money. Checked on every request.
const FORBIDDEN_PATH = /\/(ai|ai-[a-z0-9-]*|explain[a-z0-9-]*|extract[a-z0-9-]*|extraction)(\/|\?|$)/i

function call(method, path, kind, body, opts) {
  if (FORBIDDEN_PATH.test(path)) throw new Error(`refusing to call a path that looks like an AI endpoint: ${path}`)
  const params = { tags: { kind }, headers: { accept: 'application/json', 'user-agent': 'pp-event-sim/1' } }
  if (opts && opts.expected) params.responseCallback = http.expectedStatuses(...opts.expected)
  if (method !== 'GET') params.headers['x-csrf-token'] = csrf
  let res
  if (body !== undefined) {
    params.headers['content-type'] = 'application/json'
    res = http.request(method, `${BASE_URL}${path}`, JSON.stringify(body), params)
  } else {
    res = http.request(method, `${BASE_URL}${path}`, null, params)
  }
  if (res.status === 429) throttled.add(1, { kind })
  if (res.status >= 500) server5xx.add(1, { kind })
  return res
}

function json(res, pick) {
  try {
    return pick(res.json())
  } catch {
    return undefined
  }
}

const rand = (min, max) => min + Math.random() * (max - min)
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)]
const elapsedS = () => (Date.now() - exec.scenario.startTime) / 1000
const pause = (min, max) => sleep(rand(min, max))

function login() {
  // One login per pupil; a retry after a failure waits at least 15 s (the login throttle is 5 per minute per account and address).
  if (elapsedS() - lastLoginAttempt < 15) {
    sleep(15)
  }
  lastLoginAttempt = elapsedS()
  const acc = accounts[(exec.vu.idInTest - 1) % accounts.length]
  const res = call('POST', '/api/auth/login', 'login', { identifier: acc.identifier, password: acc.password, remember: false })
  const ok = check(res, { 'login 200': (r) => r.status === 200 })
  csrf = (ok && json(res, (b) => b.data.csrf)) || ''
  loggedIn = ok && csrf !== ''
  loginFailures = loggedIn ? 0 : loginFailures + 1
}

function ok200(res, name) {
  const passed = check(res, { [`${name} 200`]: (r) => r.status === 200 })
  if (res.status === 401) loggedIn = false
  return passed
}

// ---- behaviour: browsing ----
function browse() {
  const session = call('GET', '/api/session', 'read')
  if (!ok200(session, 'session')) return false
  csrf = json(session, (b) => b.data.csrf) || csrf
  ok200(call('GET', '/api/dashboard', 'read'), 'dashboard')
  ok200(call('GET', '/api/me/notifications', 'read'), 'notifications')
  return true
}

// ---- behaviour: Latih Tubi practice ----
function practice() {
  if (!browse()) return
  pause(2, 6)
  const list = call('GET', '/api/spm/latih-tubi', 'read')
  if (!ok200(list, 'latih-tubi list')) return
  const cards = json(list, (b) => b.data.teras.concat(b.data.elektif).filter((c) => c.total > 0)) || []
  if (cards.length === 0) return
  let started
  // A subject with too few questions answers 422: try another one, at most three times.
  for (let attempt = 0; attempt < 3 && !started; attempt++) {
    const card = pickOne(cards)
    ok200(call('GET', `/api/spm/latih-tubi/${encodeURIComponent(card.code)}`, 'read'), 'latih-tubi config')
    pause(2, 6)
    const count = pickOne(PRACTICE_COUNTS)
    const res = call('POST', '/api/practice/sessions', 'practice_start', { mode: 'latih_tubi', subjectCode: card.code, count }, { expected: [201, 422] })
    if (res.status === 422) {
      noQuestions.add(1)
      continue
    }
    if (res.status === 402) trialExhausted.add(1)
    if (!check(res, { 'practice start 201': (r) => r.status === 201 })) return
    started = json(res, (b) => ({ id: b.data.sessionId, questions: b.data.questions }))
  }
  if (!started || !started.id) return
  let spent = 0
  for (const q of started.questions) {
    if (!q.options || q.options.length === 0) continue
    const think = rand(THINK_MIN, THINK_MAX)
    sleep(think)
    spent += think
    const choice = pickOne(q.options).id // an answer picked at random from what the API served
    check(call('POST', `/api/practice/sessions/${started.id}/check-answer`, 'practice_check', { questionId: q.id, selectedOptionId: choice }), {
      'check-answer 200': (r) => r.status === 200,
    })
  }
  check(call('POST', `/api/practice/sessions/${started.id}/submit`, 'practice_submit', { timeSpent: Math.round(spent) }), {
    'practice submit 200': (r) => r.status === 200,
  })
  // The result screen shows the submit response; the history list is the next thing a pupil opens.
  ok200(call('GET', '/api/practice/sessions?modes=latih_tubi&pageSize=5', 'read'), 'practice history')
}

// ---- behaviour: Bijak SPM exam attempt ----
function bijak() {
  if (!browse()) return
  pause(2, 6)
  const papers = call('GET', '/api/bijak/papers', 'read')
  if (!ok200(papers, 'papers')) return
  const ids = json(papers, (b) => b.data.map((p) => p.id)) || []
  if (ids.length === 0) return
  const start = call('POST', '/api/bijak/attempts', 'bijak_start', { paperId: pickOne(ids), mode: 'exam', restart: true })
  if (!check(start, { 'start attempt 200/201': (r) => r.status === 200 || r.status === 201 })) return
  const attemptId = json(start, (b) => b.data.attemptId)
  if (!attemptId) return
  const view = call('GET', `/api/bijak/attempts/${attemptId}`, 'read')
  ok200(view, 'attempt view')
  const q = json(view, (b) => {
    const mcq = b.data.questions.find((x) => x.mcq)
    return { id: mcq.id, options: mcq.mcq.options.map((o) => o.id) }
  })
  if (q) {
    for (let i = 1; i <= SAVES; i++) {
      sleep(Math.max(1, SAVE_INTERVAL_S * rand(0.7, 1.3)))
      const change = { partId: q.id, answer: { choice: pickOne(q.options) }, rev: i, savedAt: new Date().toISOString() }
      check(call('PUT', `/api/bijak/attempts/${attemptId}/answers`, 'autosave', { changes: [change] }), { 'autosave 200': (r) => r.status === 200 })
    }
  }
  check(call('POST', `/api/bijak/attempts/${attemptId}/submit`, 'bijak_submit', { idempotencyKey: `${attemptId}-hantar`, changes: [] }), {
    'bijak submit 200': (r) => r.status === 200,
  })
  ok200(call('GET', `/api/bijak/attempts/${attemptId}/result`, 'read'), 'bijak result')
}

function chooseBehaviour() {
  const total = W.practice + W.bijak + W.browse
  let r = Math.random() * total
  if ((r -= W.practice) < 0) return 'practice'
  if ((r -= W.bijak) < 0) return 'bijak'
  return 'browse'
}

export default function () {
  if (arrivedAt === undefined) {
    // Random arrival inside the ramp; random departure inside the ramp-down.
    arrivedAt = rand(0, RAMP_S)
    leavesAt = RAMP_S + HOLD_S + rand(0, DOWN_S)
    sleep(arrivedAt)
  }
  if (elapsedS() >= leavesAt) {
    // This pupil has left: keep the VU idle until the scenario ends (one long sleep, no iterations are counted as work).
    sleep(Math.max(1, TOTAL_S - elapsedS()))
    return
  }
  if (!loggedIn) {
    if (loginFailures >= 3) {
      // Three failed logins in a row (wrong password, account missing, throttled): stop this pupil instead of hammering the login limiter.
      sleep(Math.max(1, TOTAL_S - elapsedS()))
      return
    }
    login()
    if (!loggedIn) return
  }
  const what = chooseBehaviour()
  if (what === 'practice') {
    iterPractice.add(1)
    practice()
  } else if (what === 'bijak') {
    iterBijak.add(1)
    bijak()
  } else {
    iterBrowse.add(1)
    browse()
  }
  pause(IDLE_MIN, IDLE_MAX)
}

// ---- summary: compact JSON for the report, plus a short text table on stdout ----
const val = (data, name, stat) => {
  const m = data.metrics[name]
  if (!m) return null
  // k6 0.x-2.x keep the numbers in `values`; read a flat key as a fallback in case a version flattens them.
  if (m.values && m.values[stat] !== undefined) return m.values[stat]
  return m[stat] !== undefined && typeof m[stat] === 'number' ? m[stat] : null
}
const round = (x) => (x === null ? null : Math.round(x * 10) / 10)

export function handleSummary(data) {
  const kinds = {}
  for (const k of KINDS) {
    const name = `http_req_duration{kind:${k}}`
    const count = val(data, `http_reqs{kind:${k}}`, 'count')
    const errRate = val(data, `http_req_failed{kind:${k}}`, 'rate')
    kinds[k] = { requests: count === null ? 0 : count, error_rate: errRate === null ? null : Math.round(errRate * 10000) / 10000, p50_ms: round(val(data, name, 'med')), p95_ms: round(val(data, name, 'p(95)')), p99_ms: round(val(data, name, 'p(99)')), max_ms: round(val(data, name, 'max')) }
  }
  const failed = val(data, 'http_req_failed', 'rate')
  const cnt = (n) => {
    const v = val(data, n, 'count')
    return v === null ? 0 : v
  }
  const thresholdsFailed = []
  for (const [name, m] of Object.entries(data.metrics)) {
    if (m.thresholds) for (const [expr, t] of Object.entries(m.thresholds)) if (t && t.ok === false) thresholdsFailed.push(`${name}: ${expr}`)
  }
  const summary = {
    pupils: PUPILS,
    plan: { ramp_s: RAMP_S, hold_s: HOLD_S, rampdown_s: DOWN_S, weights: W },
    duration_s: data.state && data.state.testRunDurationMs ? Math.round(data.state.testRunDurationMs / 1000) : null,
    http_requests: cnt('http_reqs'),
    error_rate: failed === null ? null : Math.round(failed * 10000) / 10000,
    throttled_429: cnt('throttled_429'),
    server_5xx: cnt('server_5xx'),
    trial_402: cnt('trial_402'),
    practice_no_questions_422: cnt('practice_no_questions'),
    iterations_by_behaviour: { practice: cnt('iterations_practice'), bijak: cnt('iterations_bijak'), browse: cnt('iterations_browse') },
    checks_pass_rate: val(data, 'checks', 'rate') === null ? null : Math.round(val(data, 'checks', 'rate') * 10000) / 10000,
    by_kind: kinds,
    thresholds_failed: thresholdsFailed,
  }
  const lines = [`event-sim summary (${summary.pupils} pupils, ${summary.http_requests} requests, error rate ${summary.error_rate}, 429: ${summary.throttled_429}, 5xx: ${summary.server_5xx})`]
  lines.push('kind                 requests   p50 ms   p95 ms   p99 ms')
  for (const k of KINDS) {
    const r = kinds[k]
    lines.push(`${k.padEnd(20)} ${String(r.requests).padStart(8)} ${String(r.p50_ms).padStart(8)} ${String(r.p95_ms).padStart(8)} ${String(r.p99_ms).padStart(8)}`)
  }
  lines.push(`iterations: practice ${summary.iterations_by_behaviour.practice}, bijak ${summary.iterations_by_behaviour.bijak}, browse ${summary.iterations_by_behaviour.browse}`)
  if (summary.trial_402 > 0) lines.push(`WARNING: ${summary.trial_402} responses were 402 trial exhausted: the test school has no live subscription.`)
  lines.push(thresholdsFailed.length ? `THRESHOLDS FAILED: ${thresholdsFailed.join('; ')}` : 'all thresholds passed')
  return { [SUMMARY_PATH]: JSON.stringify(summary, null, 2), stdout: `${lines.join('\n')}\n` }
}
