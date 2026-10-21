// k6 load test for the PrestasiPlus API through the edge (AZ-09). Guide: deploy/vps/loadtest/README.md
//
//   k6 run -e BASE_URL=https://staging.example.my -e LT_CONFIRM_TARGET=staging.example.my \
//          -e LT_I_UNDERSTAND_THIS_WRITES_DATA=yes -e LT_ACCOUNTS_FILE=/path/outside/repo/accounts.json -e VUS=100 -e DURATION=10m deploy/vps/loadtest/pupil-load.k6.js
//
// One virtual user = one pupil who logs in once and then repeats: dashboard reads, and (EXAM_RATIO of the
// iterations) a Bijak exam attempt with an autosave every LT_SAVE_INTERVAL_S seconds, then submit and result.
// NEVER point it at production without the LEAD's say-so. It writes data (attempts) and needs accounts that exist.
//
// Environment (names only; no value is stored in the repo):
//   BASE_URL                 required, https://host (no trailing slash)
//   LT_CONFIRM_TARGET        required, must equal the host of BASE_URL (a deliberate act, see the README)
//   LT_I_UNDERSTAND_THIS_WRITES_DATA   required, must be `yes`: the run logs in many accounts and writes attempts
//   LT_ACCOUNTS_FILE         PREFERRED. JSON file [{"identifier":"...","password":"..."}], mode 600, kept OUTSIDE the repo; or
//   LT_IDENTIFIER_PREFIX + LT_IDENTIFIER_COUNT + LT_PASSWORD   (one shared password; `-e` values show in the process list
//   and shell history, so use this only for throw-away staging accounts)
//   VUS (50)  DURATION (5m)  RAMP (1m)
//   LT_EXAM_RATIO (0.3)      share of iterations that run an exam attempt
//   LT_SAVE_INTERVAL_S (10)  seconds between autosaves; LT_SAVES (6) autosaves per attempt
//   LT_THINK_S (8)           mean think time between page loads
//   LT_P95_READ_MS (500) LT_P95_SAVE_MS (400) LT_P95_LOGIN_MS (3000) LT_MAX_ERROR_RATE (0.005)
//
// Endpoints used (all exist in the contract; same calls as scripts/demo-smoke.sh):
//   POST /api/auth/login, GET /api/session, GET /api/dashboard, GET /api/me/notifications, GET /api/bijak/papers,
//   POST /api/bijak/attempts, GET /api/bijak/attempts/:id, PUT /api/bijak/attempts/:id/answers,
//   POST /api/bijak/attempts/:id/submit, GET /api/bijak/attempts/:id/result
import http from 'k6/http'
import { check, fail, sleep } from 'k6'
import { Counter } from 'k6/metrics'
import { SharedArray } from 'k6/data'

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/+$/, '')
const num = (name, def) => (__ENV[name] !== undefined && __ENV[name] !== '' ? Number(__ENV[name]) : def)

const VUS = num('VUS', 50)
const DURATION = __ENV.DURATION || '5m'
const RAMP = __ENV.RAMP || '1m'
const EXAM_RATIO = num('LT_EXAM_RATIO', 0.3)
const SAVE_INTERVAL_S = num('LT_SAVE_INTERVAL_S', 10)
const SAVES = num('LT_SAVES', 6)
const THINK_S = num('LT_THINK_S', 8)

const throttled = new Counter('throttled_429')

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }))

export const options = {
  scenarios: {
    pupils: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP, target: VUS },
        { duration: DURATION, target: VUS },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '60s',
    },
  },
  thresholds: {
    // Tied to the sizing table in docs/ops/production-vps.md (section 13): p95 of reads and of the autosave, error rate,
    // and zero throttled requests (a 429 means the test hit a rate limit, not the capacity of the server).
    'http_req_duration{kind:read}': [`p(95)<${num('LT_P95_READ_MS', 500)}`],
    'http_req_duration{kind:autosave}': [`p(95)<${num('LT_P95_SAVE_MS', 400)}`],
    'http_req_duration{kind:login}': [`p(95)<${num('LT_P95_LOGIN_MS', 3000)}`],
    http_req_failed: [`rate<${num('LT_MAX_ERROR_RATE', 0.005)}`],
    throttled_429: ['count==0'],
    checks: ['rate>0.99'],
  },
}

const accounts = new SharedArray('accounts', () => {
  if (__ENV.LT_ACCOUNTS_FILE) return JSON.parse(open(__ENV.LT_ACCOUNTS_FILE))
  const n = num('LT_IDENTIFIER_COUNT', 0)
  if (__ENV.LT_IDENTIFIER_PREFIX && __ENV.LT_PASSWORD && n > 0) {
    const out = []
    for (let i = 1; i <= n; i++) out.push({ identifier: `${__ENV.LT_IDENTIFIER_PREFIX}${i}`, password: __ENV.LT_PASSWORD })
    return out
  }
  return []
})

export function setup() {
  if (!BASE_URL) fail('BASE_URL is required')
  if (__ENV.LT_I_UNDERSTAND_THIS_WRITES_DATA !== 'yes') fail('set LT_I_UNDERSTAND_THIS_WRITES_DATA=yes: this test logs in many accounts and writes exam attempts')
  const host = (BASE_URL.match(/^https?:\/\/([^/:]+)/) || [])[1]
  if (!host || __ENV.LT_CONFIRM_TARGET !== host) {
    fail(`LT_CONFIRM_TARGET must equal the host of BASE_URL (${host}). Set it only for an environment the LEAD approved for load tests.`)
  }
  if (accounts.length === 0) fail('no accounts: set LT_ACCOUNTS_FILE, or LT_IDENTIFIER_PREFIX + LT_IDENTIFIER_COUNT + LT_PASSWORD')
  if (accounts.length < VUS) console.warn(`only ${accounts.length} accounts for ${VUS} VUs: accounts are reused, so the per-user throttles bite harder than in real life`)
}

// ---- per-VU state (a VU keeps its cookie jar between iterations) ----
let csrf = ''
let loggedIn = false

function call(method, path, kind, body) {
  const params = { tags: { kind }, headers: { accept: 'application/json' } }
  if (method !== 'GET') params.headers['x-csrf-token'] = csrf
  let res
  if (body !== undefined) {
    params.headers['content-type'] = 'application/json'
    res = http.request(method, `${BASE_URL}${path}`, JSON.stringify(body), params)
  } else {
    res = http.request(method, `${BASE_URL}${path}`, null, params)
  }
  if (res.status === 429) throttled.add(1)
  return res
}

function json(res, pick) {
  try {
    return pick(res.json())
  } catch (e) {
    return undefined
  }
}

function login() {
  const acc = accounts[(__VU - 1) % accounts.length]
  const res = call('POST', '/api/auth/login', 'login', { identifier: acc.identifier, password: acc.password, remember: false })
  const ok = check(res, { 'login 200': (r) => r.status === 200 })
  csrf = (ok && json(res, (b) => b.data.csrf)) || ''
  loggedIn = ok && csrf !== ''
}

function think(mean) {
  sleep(Math.max(0.5, mean * (0.5 + Math.random())))
}

function browse() {
  const session = call('GET', '/api/session', 'read')
  check(session, { 'session 200': (r) => r.status === 200 })
  if (session.status === 401) {
    loggedIn = false
    return undefined
  }
  csrf = json(session, (b) => b.data.csrf) || csrf
  check(call('GET', '/api/dashboard', 'read'), { 'dashboard 200': (r) => r.status === 200 })
  check(call('GET', '/api/me/notifications', 'read'), { 'notifications 200': (r) => r.status === 200 })
  const papers = call('GET', '/api/bijak/papers', 'read')
  check(papers, { 'papers 200': (r) => r.status === 200 })
  return json(papers, (b) => (b.data.length > 0 ? b.data[0].id : undefined))
}

function exam(paperId) {
  const start = call('POST', '/api/bijak/attempts', 'write', { paperId, mode: 'exam', restart: true })
  if (!check(start, { 'start attempt 200/201': (r) => r.status === 200 || r.status === 201 })) return
  const attemptId = json(start, (b) => b.data.attemptId)
  if (!attemptId) return
  const view = call('GET', `/api/bijak/attempts/${attemptId}`, 'read')
  check(view, { 'attempt view 200': (r) => r.status === 200 })
  const q = json(view, (b) => {
    const mcq = b.data.questions.find((x) => x.mcq)
    return { id: mcq.id, option: mcq.mcq.options[0].id }
  })
  if (q) {
    for (let i = 1; i <= SAVES; i++) {
      sleep(Math.max(1, SAVE_INTERVAL_S * (0.7 + Math.random() * 0.6)))
      const change = { partId: q.id, answer: { choice: q.option }, rev: i, savedAt: new Date().toISOString() }
      check(call('PUT', `/api/bijak/attempts/${attemptId}/answers`, 'autosave', { changes: [change] }), {
        'autosave 200': (r) => r.status === 200,
      })
    }
  }
  check(call('POST', `/api/bijak/attempts/${attemptId}/submit`, 'write', { idempotencyKey: `${attemptId}-hantar`, changes: [] }), {
    'submit 200': (r) => r.status === 200,
  })
  check(call('GET', `/api/bijak/attempts/${attemptId}/result`, 'read'), { 'result 200': (r) => r.status === 200 })
}

export default function () {
  if (!loggedIn) {
    login()
    if (!loggedIn) {
      sleep(10)
      return
    }
  }
  const paperId = browse()
  think(THINK_S)
  if (paperId && Math.random() < EXAM_RATIO) exam(paperId)
  think(THINK_S)
}
