// Tests of the edge proxy: deploy/pages-direct/_worker.js (default export { fetch }) and, when this Node can strip
// types, functions/api/[[path]].ts (onRequest). Run: npm run test:edge. No dependency beyond node:test.
import { test } from 'node:test'
import assert from 'node:assert/strict'


const SECRET = 'x'.repeat(40)
const root = new URL('../', import.meta.url)

const worker = (await import(new URL('deploy/pages-direct/_worker.js', root).href)).default
const run = (request, env) => worker.fetch(request, env)

let tsFunction = null
try {
  const mod = await import(new URL('functions/api/%5B%5Bpath%5D%5D.ts', root).href)
  tsFunction = mod.onRequest
} catch (error) {
  console.warn(`# TS Pages Function tests skipped (needs Node with type stripping): ${error.code ?? error.message}`)
}

/** Runs `call` with fetch stubbed; returns the outbound request seen by the "origin" and the proxy response. */
async function viaProxy(call, { path = '/api/auth/login', method = 'POST', headers = {}, origin = {} } = {}) {
  const real = globalThis.fetch
  let seen = null
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), headers: new Headers(init.headers), method: init.method }
    const h = new Headers(origin.headers ?? {})
    const res = new Response('{"data":{}}', { status: origin.status ?? 200, headers: h })
    for (const c of origin.cookies ?? []) res.headers.append('set-cookie', c)
    return res
  }
  try {
    const req = new Request(`https://demo.pages.dev${path}`, { method, headers, body: method === 'GET' ? undefined : '{}' })
    const res = await call(req)
    return { seen, res }
  } finally {
    globalThis.fetch = real
  }
}

const spoofed = {
  'x-forwarded-for': '6.6.6.6, 7.7.7.7',
  'x-real-ip': '6.6.6.6',
  'true-client-ip': '6.6.6.6',
  'x-pp-client-ip': '6.6.6.6',
  'x-pp-edge-secret': 'client-guess',
  forwarded: 'for=6.6.6.6',
  'x-forwarded-port': '1',
  'x-forwarded-ssl': 'on',
  'content-type': 'application/json',
}

function suite(name, makeCall) {
  const env = (extra = {}) => ({ API_ORIGIN: 'https://origin.example', ASSETS: { fetch: async () => new Response('asset') }, ...extra })

  test(`${name}: client address comes from CF-Connecting-IP only`, async () => {
    const { seen } = await viaProxy((r) => makeCall(r, env()), { headers: { ...spoofed, 'cf-connecting-ip': '203.0.113.9' } })
    assert.equal(seen.headers.get('x-pp-client-ip'), '203.0.113.9')
    assert.equal(seen.headers.get('x-forwarded-for'), '203.0.113.9')
    assert.equal(seen.headers.get('x-real-ip'), '203.0.113.9')
    assert.equal(seen.headers.get('true-client-ip'), null)
    assert.equal(seen.headers.get('forwarded'), null)
    assert.equal(seen.headers.get('x-forwarded-port'), null)
    assert.equal(seen.headers.get('x-forwarded-ssl'), null)
    assert.equal(seen.headers.get('x-pp-edge-secret'), null) // no env secret: the client's guess is dropped
    assert.equal(seen.headers.get('x-forwarded-proto'), 'https')
    assert.equal(seen.headers.get('x-forwarded-host'), 'demo.pages.dev')
    assert.equal(seen.url, 'https://origin.example/api/auth/login')
  })

  test(`${name}: without CF-Connecting-IP no address header is sent`, async () => {
    const { seen } = await viaProxy((r) => makeCall(r, env()), { headers: spoofed })
    for (const h of ['x-forwarded-for', 'x-real-ip', 'x-pp-client-ip', 'cf-connecting-ip', 'true-client-ip', 'x-pp-edge-secret']) {
      assert.equal(seen.headers.get(h), null, h)
    }
  })

  test(`${name}: edge secret is sent only when configured, replacing any client value`, async () => {
    const withSecret = await viaProxy((r) => makeCall(r, env({ EDGE_PROXY_SECRET: `  ${SECRET}  ` })), {
      headers: { ...spoofed, 'cf-connecting-ip': '203.0.113.9' },
    })
    assert.equal(withSecret.seen.headers.get('x-pp-edge-secret'), SECRET)
    for (const empty of [undefined, '', '   ']) {
      const without = await viaProxy((r) => makeCall(r, env({ EDGE_PROXY_SECRET: empty })), {
        headers: { 'x-pp-edge-secret': 'client-guess', 'cf-connecting-ip': '203.0.113.9' },
      })
      assert.equal(without.seen.headers.get('x-pp-edge-secret'), null)
    }
  })

  test(`${name}: the secret never appears in a response (502 error body)`, async () => {
    const real = globalThis.fetch
    globalThis.fetch = async () => { throw new Error(`boom ${SECRET}`) }
    try {
      const res = await makeCall(new Request('https://demo.pages.dev/api/x', { headers: { 'cf-connecting-ip': '203.0.113.9' } }), env({ EDGE_PROXY_SECRET: SECRET }))
      assert.equal(res.status, 502)
      assert.equal(res.headers.get('cache-control'), 'no-store')
      assert.ok(!(await res.text()).includes(SECRET))
    } finally {
      globalThis.fetch = real
    }
  })

  test(`${name}: cache-control no-store unless the origin sets its own`, async () => {
    const none = await viaProxy((r) => makeCall(r, env()), { method: 'GET', path: '/api/health' })
    assert.equal(none.res.headers.get('cache-control'), 'no-store')
    const strict = await viaProxy((r) => makeCall(r, env()), { method: 'GET', path: '/api/health', origin: { headers: { 'cache-control': 'no-store' } } })
    assert.equal(strict.res.headers.get('cache-control'), 'no-store')
    const own = await viaProxy((r) => makeCall(r, env()), { method: 'GET', path: '/api/files/1', origin: { headers: { 'cache-control': 'private, max-age=60' } } })
    assert.equal(own.res.headers.get('cache-control'), 'private, max-age=60')
  })

  test(`${name}: set-cookie is preserved one by one`, async () => {
    const { res } = await viaProxy((r) => makeCall(r, env()), { origin: { cookies: ['pp_session=a; HttpOnly; Secure', 'other=b; Path=/'] } })
    assert.deepEqual(res.headers.getSetCookie(), ['pp_session=a; HttpOnly; Secure', 'other=b; Path=/'])
  })

  test(`${name}: oversized file upload is refused with 413 and no-store`, async () => {
    const res = await makeCall(
      new Request('https://demo.pages.dev/api/files', { method: 'POST', body: 'x', headers: { 'content-length': String(23 * 1024 * 1024) } }),
      env(),
    )
    assert.equal(res.status, 413)
    assert.equal(res.headers.get('cache-control'), 'no-store')
  })
}

suite('worker', run)
if (tsFunction) suite('pages function', (request, env) => tsFunction({ request, env }))

test('worker: a path outside /api goes to env.ASSETS.fetch', async () => {
  const calls = []
  const env = { ASSETS: { fetch: async (r) => { calls.push(new URL(r.url).pathname); return new Response('asset') } } }
  const real = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('origin must not be called') }
  try {
    const res = await run(new Request('https://demo.pages.dev/login'), env)
    assert.equal(await res.text(), 'asset')
    assert.deepEqual(calls, ['/login'])
    await run(new Request('https://demo.pages.dev/apiary'), env) // not /api/ either
    assert.deepEqual(calls, ['/login', '/apiary'])
  } finally {
    globalThis.fetch = real
  }
})
