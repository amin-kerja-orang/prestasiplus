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

/** @type {Map<string, string>} */
const jar = new Map()
let csrf = ''

/**
 * One HTTP call with timeout, cookie jar and CSRF header.
 * @param {string} method
 * @param {string} path
 * @param {unknown} [body]
 * @returns {Promise<{ status: number, json: any }>}
 */
async function call(method, path, body) {
  /** @type {Record<string, string>} */
  const headers = { accept: 'application/json' }
  if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  if (method !== 'GET' && csrf) headers['x-csrf-token'] = csrf
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(BASE + path, {
    method,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  for (const line of res.headers.getSetCookie()) {
    const [pair = ''] = line.split(';')
    const eq = pair.indexOf('=')
    if (eq > 0) {
      const name = pair.slice(0, eq).trim()
      const value = pair.slice(eq + 1).trim()
      if (value === '' || /;\s*max-age=0/i.test(line)) jar.delete(name)
      else jar.set(name, value)
    }
  }
  const text = await res.text()
  /** @type {any} */
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: res.status, json }
}

class StepError extends Error {
  /** @param {string} reason @param {number | string} [status] */
  constructor(reason, status = '-') {
    super(reason)
    this.status = status
  }
}

/**
 * @param {{ status: number, json: any }} r
 * @param {string} what
 */
function expect2xx(r, what) {
  if (r.status < 200 || r.status >= 300) {
    const code = r.json?.error?.code
    throw new StepError(`${what}${code ? ` (${code})` : ''}`, r.status)
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
      const d = expect2xx(r, 'login rejected')
      if (!jar.size) throw new StepError('no session cookie in Set-Cookie', r.status)
      if (typeof d?.csrf !== 'string' || !d.csrf)
        throw new StepError('no csrf in session', r.status)
      csrf = d.csrf
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
