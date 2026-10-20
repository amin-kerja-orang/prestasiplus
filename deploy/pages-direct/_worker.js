// Cloudflare Pages advanced-mode worker (demo, direct upload).
// JS port of functions/api/[[path]].ts: same-origin /api proxy to the Render API; everything else is static assets.
const DEFAULT_API_ORIGIN = 'https://prestasiplus-api.onrender.com'
const MAX_FILE_BODY_BYTES = 22 * 1024 * 1024
const HOP_BY_HOP = [
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'proxy-connection',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
]

function errorResponse(status, code, message) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

async function proxy(request, env) {
  const base = (env.API_ORIGIN || DEFAULT_API_ORIGIN).trim()
  const incoming = new URL(request.url)
  let upstream
  try {
    upstream = new URL(incoming.pathname + incoming.search, base)
  } catch {
    return errorResponse(500, 'SERVER_ERROR', 'Konfigurasi pelayan tidak lengkap.')
  }
  if (incoming.pathname === '/api/files' && request.method === 'POST') {
    const length = Number(request.headers.get('content-length') || '0')
    if (length > MAX_FILE_BODY_BYTES) return errorResponse(413, 'VALIDATION_ERROR', 'Fail terlalu besar.')
  }
  const headers = new Headers(request.headers)
  for (const name of HOP_BY_HOP) headers.delete(name)
  headers.delete('host')
  headers.delete('forwarded')
  headers.delete('x-real-ip')
  const client = request.headers.get('cf-connecting-ip')
  if (client) {
    headers.set('x-forwarded-for', client)
    headers.set('x-real-ip', client)
  } else {
    headers.delete('x-forwarded-for')
  }
  headers.set('x-forwarded-proto', 'https')
  headers.set('x-forwarded-host', incoming.host)

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  let res
  try {
    res = await fetch(upstream, {
      method: request.method,
      headers,
      body: hasBody ? request.body : null,
      redirect: 'manual',
    })
  } catch {
    return errorResponse(502, 'SERVER_ERROR', 'Pelayan API tidak dapat dihubungi. Cuba lagi sebentar.')
  }
  const out = new Headers()
  res.headers.forEach((value, name) => {
    const n = name.toLowerCase()
    if (n === 'set-cookie' || HOP_BY_HOP.includes(n)) return
    out.append(name, value)
  })
  for (const cookie of res.headers.getSetCookie()) out.append('set-cookie', cookie)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return proxy(request, env)
    return env.ASSETS.fetch(request)
  },
}
