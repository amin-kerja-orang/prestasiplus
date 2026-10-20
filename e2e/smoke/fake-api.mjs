// @ts-check
/**
 * Fake Bijak API for exercising bijak-smoke.mjs without a real stack. Listens on 127.0.0.1 only.
 *
 *   FAKE_MODE=<mode> node e2e/smoke/fake-api.mjs        # prints "LISTENING <port>", PORT=0 picks a free one
 *
 * Modes: happy (default) | redirect (302 to /login on the papers list) | html (SPA fallback on
 * /api/bijak/*) | nocsrf (drops X-CSRF-Token like a proxy that strips it, so mutations get 403) |
 * health500.
 * Mimics the BE-16 contract shapes: { data } envelope, pp_session cookie (two Set-Cookie headers, one
 * with Expires), session rotation once, X-CSRF-Token + Origin required on non-GET once logged in.
 * Contains only the made-up credentials user "demo" / password "demo-pass".
 */
import http from 'node:http'

const MODE = process.env.FAKE_MODE || 'happy'
const PORT = Number(process.env.PORT) || 0
const CSRF = 'csrf-fake-0001'
let session = 'sess-1'
let rotated = false
/** @type {Record<string, { answer: unknown, rev: number }>} */
const answers = {}
let status = 'in_progress'

const view = () => ({
  serverNow: new Date().toISOString(),
  attempt: {
    id: 'att-1',
    status,
    answers: Object.fromEntries(
      Object.entries(answers).map(([k, v]) => [k, { ...v, savedAt: new Date().toISOString() }]),
    ),
  },
  sections: [{ id: 's1', questionIds: ['q1'] }],
  questions: [
    {
      id: 'q1',
      number: 1,
      sectionId: 's1',
      stem: 'Soalan?',
      marks: 1,
      mcq: {
        options: [
          { id: 'o1', text: 'A' },
          { id: 'o2', text: 'B' },
        ],
      },
    },
  ],
  groups: [],
  checks: [],
})

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  const path = url.pathname
  /** @type {Buffer[]} */
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    /** @param {number} code @param {unknown} body @param {string[]} [cookies] */
    const json = (code, body, cookies = []) => {
      res.writeHead(code, {
        'content-type': 'application/json; charset=utf-8',
        ...(cookies.length ? { 'set-cookie': cookies } : {}),
      })
      res.end(JSON.stringify(body))
    }
    const err = (/** @type {number} */ code, /** @type {string} */ c) =>
      json(code, { error: { code: c, message: c } })
    const cookie = req.headers.cookie ?? ''
    const authed = cookie.includes(`pp_session=${session}`)

    if (path === '/api/health')
      return MODE === 'health500'
        ? err(500, 'SERVER_ERROR')
        : json(200, { data: { status: 'ok', db: 'up' } })
    if (path === '/api/auth/login' && req.method === 'POST') {
      const b = JSON.parse(Buffer.concat(chunks).toString() || '{}')
      if (b.identifier !== 'demo' || b.password !== 'demo-pass')
        return err(401, 'INVALID_CREDENTIALS')
      return json(200, { data: { csrf: CSRF } }, [
        `pp_session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Wed, 21 Oct 2099 07:28:00 GMT`,
        'pp_pref=1; Path=/; Secure; SameSite=Lax; Max-Age=3600',
      ])
    }
    if (!path.startsWith('/api/')) {
      res.writeHead(200, { 'content-type': 'text/html' })
      return void res.end('<!doctype html><html>app</html>')
    }
    if (MODE === 'html' && path.startsWith('/api/bijak')) {
      res.writeHead(200, { 'content-type': 'text/html' })
      return void res.end('<!doctype html><html><body>SPA index</body></html>')
    }
    if (!authed) return err(401, 'UNAUTHENTICATED')
    if (req.method !== 'GET') {
      if (!req.headers.origin) return err(403, 'ORIGIN_MISSING')
      const token = MODE === 'nocsrf' ? undefined : req.headers['x-csrf-token']
      if (token !== CSRF) return err(403, 'CSRF_INVALID')
    }
    if (path === '/api/session') return json(200, { data: { csrf: CSRF } })
    if (path === '/api/bijak/papers') {
      if (MODE === 'redirect') {
        res.writeHead(302, { location: '/login' })
        return void res.end()
      }
      return json(200, { data: [{ id: 'paper-1', title: 'Kertas 1' }] })
    }
    if (path === '/api/bijak/attempts' && req.method === 'POST')
      return json(201, { data: { attemptId: 'att-1' } })
    if (path === '/api/bijak/attempts/att-1' && req.method === 'GET') {
      // Rotate the session cookie once, on the first attempt read.
      if (!rotated) {
        rotated = true
        session = 'sess-2'
        return json(200, { data: view() }, [
          `pp_session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        ])
      }
      return json(200, { data: view() })
    }
    if (path === '/api/bijak/attempts/att-1/answers' && req.method === 'PUT') {
      const b = JSON.parse(Buffer.concat(chunks).toString() || '{}')
      for (const c of b.changes ?? []) answers[c.partId] = { answer: c.answer, rev: c.rev }
      return json(200, { data: { savedAt: new Date().toISOString() } })
    }
    if (path === '/api/bijak/attempts/att-1/submit' && req.method === 'POST') {
      status = 'submitted'
      return json(200, { data: { attemptId: 'att-1', late: 0 } })
    }
    if (path === '/api/bijak/attempts/att-1/result')
      return json(200, {
        data: { attempt: { id: 'att-1' }, result: { score: 1, max: 1, percent: 100 } },
      })
    return err(404, 'NOT_FOUND')
  })
})

server.listen(PORT, '127.0.0.1', () => {
  const a = server.address()
  console.log(`LISTENING ${typeof a === 'object' && a ? a.port : PORT}`)
})
