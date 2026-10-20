// @ts-check
/**
 * Bijak SPM deploy smoke test (go/no-go, a few seconds). Node 22+, no dependencies.
 *
 * Usage:
 *   BASE_URL=https://staging.example BIJAK_STUDENT_USER=<user or e-mail> BIJAK_STUDENT_PASS=<pass> \
 *     node e2e/smoke/bijak-smoke.mjs        (or: npm run smoke:bijak)
 *
 * WARNING: it writes real data on the target (one student attempt, started then submitted).
 *
 * Env:
 *   BASE_URL | BIJAK_API_BASE   origin of the stack (SPA and /api on the same origin). Required.
 *   BIJAK_STUDENT_USER / _PASS  student login (identifier = e-mail or username). Required.
 *   BIJAK_SCHOOL_ID             optional, for a username that exists in several schools.
 *   BIJAK_PAPER_ID              optional paper id; default is the first published paper.
 *   SMOKE_TIMEOUT_MS            per-request timeout, default 10000.
 *   SMOKE_MODE                  attempt mode, `latihan` (default, untimed) or `exam`.
 *   Path overrides (defaults in PATHS below): SMOKE_HEALTH_PATH, SMOKE_LOGIN_PATH.
 *
 * Auth: cookie session (`pp_session` from Set-Cookie, kept in a hand-made jar) plus the CSRF token
 * from the login response (`data.csrf`) sent as `X-CSRF-Token` on every mutating request.
 * Hardening for the Cloudflare Pages /api proxy: redirects are never followed (3xx FAILs), an HTML
 * body on /api FAILs (wrong proxy route), every Set-Cookie is kept separately (Path honoured,
 * Domain ignored, Max-Age=0/Expires in the past delete), cookies and CSRF are refreshed on every
 * response, mutations send `Origin`. Failures print status, content-type, cf-ray/server and the
 * first 200 chars of the body (secrets masked). `--verbose` or SMOKE_VERBOSE=1 prints headers.
 * Exit codes: 0 all steps passed, 1 a step failed, 2 missing env (usage printed).
 */

const env = process.env
const baseRaw = env.BASE_URL || env.BIJAK_API_BASE || ''
const user = env.BIJAK_STUDENT_USER || ''
const pass = env.BIJAK_STUDENT_PASS || ''

if (!baseRaw || !user || !pass) {
  console.error(
    [
      'Usage: BASE_URL=<origin> BIJAK_STUDENT_USER=<user> BIJAK_STUDENT_PASS=<pass> node e2e/smoke/bijak-smoke.mjs',
      'Missing: ' +
        [
          !baseRaw && 'BASE_URL (or BIJAK_API_BASE)',
          !user && 'BIJAK_STUDENT_USER',
          !pass && 'BIJAK_STUDENT_PASS',
        ]
          .filter(Boolean)
          .join(', '),
      'Optional: BIJAK_PAPER_ID, BIJAK_SCHOOL_ID, SMOKE_TIMEOUT_MS, SMOKE_MODE, SMOKE_HEALTH_PATH, SMOKE_LOGIN_PATH',
      'Note: writes real data (one attempt) on the target.',
    ].join('\n'),
  )
  process.exit(2)
}

const BASE = baseRaw.replace(/\/+$/, '').replace(/\/api$/, '')
const TIMEOUT = Number(env.SMOKE_TIMEOUT_MS) || 10_000
const MODE = env.SMOKE_MODE === 'exam' ? 'exam' : 'latihan'
const PATHS = {
  health: env.SMOKE_HEALTH_PATH || '/api/health',
  login: env.SMOKE_LOGIN_PATH || '/api/auth/login',
}

const VERBOSE = env.SMOKE_VERBOSE === '1' || process.argv.includes('--verbose')
const ORIGIN = new URL(BASE).origin

/** @type {Map<string, { value: string, path: string }>} */
const jar = new Map()
let csrf = ''

/** Masks secrets for logs: cookie values, CSRF token, anything after `pass`. */
const mask = (/** @type {string} */ s) =>
  s
    .replaceAll(pass, '***')
    .replace(/(token|csrf|password|secret)("?\s*[:=]\s*"?)[^"\s,;}]+/gi, '$1$2***')
    .replace(/(pp_session=)[^;\s]+/g, '$1***')

/** Applies one Set-Cookie line to the jar: name=value only, Path kept, Domain and flags ignored. */
function applySetCookie(/** @type {string} */ line) {
  const [pair = '', ...attrs] = line.split(';')
  const eq = pair.indexOf('=')
  if (eq <= 0) return
  const name = pair.slice(0, eq).trim()
  const value = pair.slice(eq + 1).trim()
  let path = '/'
  let expired = value === ''
  for (const a of attrs) {
    const i = a.indexOf('=')
    const k = (i < 0 ? a : a.slice(0, i)).trim().toLowerCase()
    const v = i < 0 ? '' : a.slice(i + 1).trim()
    if (k === 'path' && v.startsWith('/')) path = v
    if (k === 'max-age' && Number(v) <= 0) expired = true
    if (k === 'expires' && Date.parse(v) < Date.now()) expired = true
  }
  if (expired) jar.delete(name)
  else jar.set(name, { value, path })
}

/** Why a response is not what the API would send: proxy hints, content type, redacted body start. */
function diagnose(/** @type {Response} */ res, /** @type {string} */ text) {
  const h = res.headers
  const via = h.get('cf-ray')
    ? `via Cloudflare (cf-ray ${h.get('cf-ray')})`
    : `server=${h.get('server') ?? 'unknown'}, no cf-ray`
  const body = mask(text.replace(/\s+/g, ' ').slice(0, 200))
  return `[${res.status} ${h.get('content-type') ?? 'no content-type'}; ${via}; body: ${body}]`
}

/**
 * One HTTP call with timeout, cookie jar, CSRF header and Origin. Never follows redirects; a 3xx or
 * a non-JSON body (SPA fallback on a wrong proxy route) throws a StepError with diagnostics.
 * @param {string} method
 * @param {string} path
 * @param {unknown} [body]
 * @returns {Promise<{ status: number, json: any, diag: string }>}
 */
async function call(method, path, body) {
  /** @type {Record<string, string>} */
  const headers = { accept: 'application/json' }
  const sent = [...jar].filter(([, c]) => path.startsWith(c.path))
  if (sent.length) headers.cookie = sent.map(([k, c]) => `${k}=${c.value}`).join('; ')
  if (method !== 'GET') {
    headers.origin = ORIGIN
    if (csrf) headers['x-csrf-token'] = csrf
  }
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (VERBOSE) {
    const shown = { ...headers, ...(headers.cookie ? { cookie: '***' } : {}) }
    if (shown['x-csrf-token']) shown['x-csrf-token'] = '***'
    console.log(`  > ${method} ${path} ${JSON.stringify(shown)}`)
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  // getSetCookie() keeps each header separate (get() would merge them and break Expires dates).
  const setCookies = res.headers.getSetCookie()
  for (const line of setCookies) applySetCookie(line)
  const text = await res.text()
  const diag = diagnose(res, text)
  if (VERBOSE) {
    const names = setCookies.map((l) => (l.split('=')[0] ?? '') + '=***')
    console.log(
      `  < ${res.status} ${res.headers.get('content-type') ?? ''} set-cookie: ${names.join(', ') || '-'}`,
    )
    console.log(`    ${diag}`)
  }
  if (res.status >= 300 && res.status < 400) {
    throw new StepError(
      `redirect to ${res.headers.get('location') ?? '?'} (not followed; session lost or wrong route) ${diag}`,
      res.status,
    )
  }
  /** @type {any} */
  let json = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      throw new StepError(
        `response is not JSON (SPA fallback? wrong proxy route) ${diag}`,
        res.status,
      )
    }
  }
  // A rotated CSRF token (session renewed) replaces the old one.
  if (typeof json?.data?.csrf === 'string' && json.data.csrf) csrf = json.data.csrf
  return { status: res.status, json, diag }
}

class StepError extends Error {
  /** @param {string} reason @param {number | string} [status] */
  constructor(reason, status = '-') {
    super(reason)
    this.status = status
  }
}

/**
 * @param {{ status: number, json: any, diag: string }} r
 * @param {string} what
 */
function expect2xx(r, what) {
  if (r.status < 200 || r.status >= 300) {
    const code = r.json?.error?.code
    throw new StepError(`${what}${code ? ` (${code})` : ''} ${r.diag}`, r.status)
  }
  return r.json?.data
}

/**
 * First answerable leaf of the first question: { partId, answer }.
 * @param {any} view
 */
function firstAnswer(view) {
  const q = view?.questions?.[0]
  if (!q) throw new StepError('attempt has no questions')
  if (q.mcq?.options?.length) return { partId: q.id, answer: { choice: q.mcq.options[0].id } }
  /** @param {any[]} parts @returns {any} */
  const leaf = (parts) => {
    for (const p of parts ?? []) {
      if (p.answer?.kind) return p
      const inner = leaf(p.children)
      if (inner) return inner
    }
    return null
  }
  const part = leaf(q.parts)
  if (!part) throw new StepError('first question has no answerable part')
  switch (part.answer.kind) {
    case 'match_letter': {
      const letter = q.optionBank?.[0]?.id ?? 'A'
      return { partId: part.id, answer: { choice: letter } }
    }
    case 'essay':
    case 'short_text':
    case 'table_fill':
      return { partId: part.id, answer: { text: 'smoke' } }
    default:
      return { partId: part.id, answer: { steps: [], final: '1' } }
  }
}

/** @type {{ paperId?: string, attemptId?: string, partId?: string, answer?: any }} */
const ctx = {}
const attemptUrl = () => `/api/bijak/attempts/${encodeURIComponent(String(ctx.attemptId))}`

/** @type {Array<[string, () => Promise<void>]>} */
const steps = [
  [
    'health',
    async () => {
      const d = expect2xx(await call('GET', PATHS.health), 'health')
      if (d?.status !== 'ok') throw new StepError('health body is not status ok', 200)
    },
  ],
  [
    'login',
    async () => {
      const r = await call('POST', PATHS.login, {
        identifier: user,
        password: pass,
        ...(env.BIJAK_SCHOOL_ID ? { schoolId: env.BIJAK_SCHOOL_ID } : {}),
      })
      expect2xx(r, 'login rejected')
      if (!jar.size) {
        throw new StepError(
          `no session cookie kept from Set-Cookie (proxy dropped it?) ${r.diag}`,
          r.status,
        )
      }
      if (!csrf) {
        // Fallback, as the BE-16 client: the token is also in GET /api/session.
        expect2xx(await call('GET', '/api/session'), 'session (csrf fallback)')
      }
      if (!csrf) throw new StepError('no csrf token from login or /api/session', r.status)
    },
  ],
  [
    'list-papers',
    async () => {
      const d = expect2xx(await call('GET', '/api/bijak/papers'), 'list papers')
      if (!Array.isArray(d) || d.length < 1) throw new StepError('no published paper', 200)
      ctx.paperId = env.BIJAK_PAPER_ID || d[0].id
    },
  ],
  [
    'start-attempt',
    async () => {
      const d = expect2xx(
        await call('POST', '/api/bijak/attempts', { paperId: ctx.paperId, mode: MODE }),
        'start attempt',
      )
      if (!d?.attemptId) throw new StepError('no attemptId in response', 200)
      ctx.attemptId = d.attemptId
    },
  ],
  [
    'autosave',
    async () => {
      const view = expect2xx(await call('GET', attemptUrl()), 'load attempt')
      Object.assign(ctx, firstAnswer(view))
      const d = expect2xx(
        await call('PUT', `${attemptUrl()}/answers`, {
          changes: [
            { partId: ctx.partId, answer: ctx.answer, rev: 1, savedAt: new Date().toISOString() },
          ],
        }),
        'autosave',
      )
      if (d?.closed) throw new StepError('attempt already closed', 200)
    },
  ],
  [
    'read-back',
    async () => {
      const view = expect2xx(await call('GET', attemptUrl()), 'read attempt')
      const stored = view?.attempt?.answers?.[String(ctx.partId)]
      if (!stored) throw new StepError('saved answer not found on the server', 200)
      if (JSON.stringify(stored.answer) !== JSON.stringify(ctx.answer)) {
        throw new StepError('stored answer differs from the one saved', 200)
      }
    },
  ],
  [
    'submit',
    async () => {
      const d = expect2xx(
        await call('POST', `${attemptUrl()}/submit`, {
          idempotencyKey: `smoke-${Date.now()}`,
          changes: [],
        }),
        'submit',
      )
      if (!d?.attemptId) throw new StepError('no attemptId in submit result', 200)
    },
  ],
  [
    'result',
    async () => {
      const d = expect2xx(await call('GET', `${attemptUrl()}/result`), 'result')
      const res = d?.result
      if (typeof res?.score !== 'number' || typeof res?.max !== 'number') {
        throw new StepError('result has no numeric score/max', 200)
      }
    },
  ],
]

let passed = 0
for (const [name, run] of steps) {
  const t0 = Date.now()
  try {
    await run()
    console.log(`PASS ${name} (${Date.now() - t0} ms)`)
    passed++
  } catch (e) {
    if (e instanceof StepError) {
      console.log(`FAIL ${name}: ${e.status} ${e.message}`)
    } else {
      const err = /** @type {any} */ (e)
      const why =
        err?.name === 'TimeoutError'
          ? `timeout after ${TIMEOUT} ms`
          : err?.cause?.code || err?.message
      console.log(`FAIL ${name}: - ${String(why).slice(0, 120)}`)
    }
    break
  }
}

const ok = passed === steps.length
console.log(ok ? 'SMOKE PASS' : `SMOKE FAIL (${passed}/${steps.length} passed)`)
process.exit(ok ? 0 : 1)
