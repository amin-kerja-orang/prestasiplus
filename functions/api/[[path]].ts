/**
 * Cloudflare Pages Function: same-origin /api proxy (replaces the nginx `/api/` location).
 * Forwards /api/* to the API at env `API_ORIGIN` (e.g. https://pp-api.onrender.com), so the browser
 * only ever talks to the Pages origin: no CORS, first-party cookie. Runbook: docs/ops/deploy-staging.md.
 * Minimal local types are used on purpose (@cloudflare/workers-types is not a dependency).
 */
interface Env {
  API_ORIGIN?: string
}
interface Ctx {
  request: Request
  env: Env
}

/** Largest upload accepted on POST /api/files (nginx: 22m = max(MAX_UPLOAD_MB, INTAKE_MAX_FILE_MB) + overhead). */
const MAX_FILE_BODY_BYTES = 22 * 1024 * 1024

const HOP_BY_HOP = [
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'proxy-connection',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
]

/** API error envelope: { error: { code, message } } (packages/contract/src/common/error.ts). */
function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export const onRequest = async ({ request, env }: Ctx): Promise<Response> => {
  const base = env.API_ORIGIN?.trim()
  if (!base) return errorResponse(500, 'SERVER_ERROR', 'Konfigurasi pelayan tidak lengkap.') // fail closed
  let upstream: URL
  try {
    const url = new URL(request.url)
    upstream = new URL(url.pathname + url.search, base) // method-independent: path and query kept as-is
    if (upstream.origin !== new URL(base).origin) throw new Error('origin') // never proxy to another host
  } catch {
    return errorResponse(500, 'SERVER_ERROR', 'Konfigurasi pelayan tidak lengkap.')
  }

  const incoming = new URL(request.url)
  if (incoming.pathname === '/api/files' && request.method === 'POST') {
    // Browsers always send a length for FormData; a missing or invalid one (chunked) cannot be checked here.
    const raw = request.headers.get('content-length')
    const length = raw === null ? Number.NaN : Number(raw)
    if (!Number.isFinite(length)) return errorResponse(411, 'VALIDATION_ERROR', 'Panjang kandungan diperlukan.')
    if (length > MAX_FILE_BODY_BYTES) {
      return errorResponse(413, 'VALIDATION_ERROR', 'Fail terlalu besar.')
    }
  }

  const headers = new Headers(request.headers)
  for (const name of HOP_BY_HOP) headers.delete(name)
  headers.delete('host')
  headers.delete('forwarded')
  headers.delete('x-real-ip')
  for (const name of ['x-forwarded-port', 'x-forwarded-ssl', 'true-client-ip']) headers.delete(name)
  // OVERWRITE (never append) so a client cannot prepend a spoofed address to the rate-limit key.
  const client = request.headers.get('cf-connecting-ip')
  if (client) {
    headers.set('x-forwarded-for', client)
    headers.set('x-real-ip', client)
  } else {
    headers.delete('x-forwarded-for')
  }
  headers.set('x-forwarded-proto', 'https')
  headers.set('x-forwarded-host', incoming.host)
  // Cookie, Origin, Referer, x-csrf-token and X-Request-Id are forwarded untouched (copied from the request above);
  // the API keeps a safe X-Request-Id or makes its own and returns it on the response.

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  let res: Response
  try {
    res = await fetch(upstream, {
      method: request.method,
      headers,
      body: hasBody ? request.body : null, // streamed
      redirect: 'manual',
      // Streaming request bodies need half duplex in some runtimes.
      ...(hasBody ? { duplex: 'half' } : {}),
    } as RequestInit)
  } catch {
    return errorResponse(502, 'SERVER_ERROR', 'Pelayan API tidak dapat dihubungi. Cuba lagi sebentar.')
  }

  const out = new Headers()
  res.headers.forEach((value, name) => {
    const n = name.toLowerCase()
    if (n === 'set-cookie' || HOP_BY_HOP.includes(n)) return
    out.append(name, value)
  })
  for (const cookie of res.headers.getSetCookie()) out.append('set-cookie', cookie) // each one, unchanged
  // No caching of /api at the edge or in the browser unless the API itself says otherwise (file downloads do).
  if (!out.has('cache-control')) out.set('cache-control', 'no-store')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out })
}
