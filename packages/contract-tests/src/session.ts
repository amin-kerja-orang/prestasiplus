import type { HttpClient, HttpMethod, HttpRequestInit, HttpResponse } from './http-client'

/** Name of the CSRF header (contract: `Session.csrf` is sent back in `X-CSRF-Token`). */
export const CSRF_HEADER = 'x-csrf-token'

const SAFE_METHODS = new Set<HttpMethod>(['GET'])

/** `name=value` pairs of every cookie in a (newline-joined) `set-cookie` header value. */
export function parseSetCookie(header: string | undefined): Record<string, string> {
  const jar: Record<string, string> = {}
  for (const line of (header ?? '').split('\n')) {
    const pair = line.split(';')[0] ?? ''
    const eq = pair.indexOf('=')
    if (eq > 0) jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim()
  }
  return jar
}

export interface SessionLogin {
  identifier: string
  password: string
  schoolId?: string
  remember?: boolean
}

export interface SessionClient extends HttpClient {
  /** `Session.csrf` from the login response. */
  readonly csrf: string
  /** A client with the same cookies that omits the CSRF header (for CSRF_INVALID scenarios). */
  withoutCsrf(): HttpClient
}

/**
 * Cookie session with CSRF (ADR-0016/0017): POST /auth/login, keep the cookies the server sets,
 * send them on every call, and add `X-CSRF-Token` to every non-GET call. Written against
 * `HttpClient` only, so it works with any adapter that surfaces `set-cookie`.
 */
export async function sessionLogin(base: HttpClient, creds: SessionLogin): Promise<SessionClient> {
  const res = await base.request('POST', '/auth/login', {
    body: { remember: false, ...creds },
  })
  if (res.status !== 200) throw new Error(`login failed: HTTP ${String(res.status)}`)
  const jar = parseSetCookie(res.headers['set-cookie'])
  const csrf = (res.body as { data?: { csrf?: unknown } } | null)?.data?.csrf
  if (typeof csrf !== 'string') throw new Error('login response carries no data.csrf')
  const cookie = Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  const send =
    (useCsrf: boolean) =>
    (method: HttpMethod, path: string, init: HttpRequestInit = {}) =>
      base.request(method, path, {
        ...init,
        headers: {
          ...init.headers,
          cookie,
          ...(useCsrf && !SAFE_METHODS.has(method) ? { [CSRF_HEADER]: csrf } : {}),
        },
      })
  return {
    csrf,
    request: send(true),
    withoutCsrf: () => ({ request: send(false) }),
  }
}

export type { HttpResponse }
