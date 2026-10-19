import type { INestApplication } from '@nestjs/common'
import {
  type ActorRole,
  type HttpClient,
  type HttpMethod,
  type HttpRequestInit,
  type HttpResponse,
  type Target,
  sessionLogin,
} from '@pp/contract-tests'
import request from 'supertest'

import { accountFor } from './accounts'

const API_BASE = '/api'

/** `/admin/users/:id` and `/admin/users/{userId}` are the same route: compare with every parameter as `{}`. */
export function normalisePath(path: string): string {
  return (path.split('?')[0] ?? '')
    .replace(/\/+$/, '')
    .replace(/:[A-Za-z0-9_]+/g, '{}')
    .replace(/\{[^}]*\}/g, '{}')
}

interface ExpressLayer {
  route?: { path: unknown; methods: Record<string, boolean> }
}

/** `METHOD /path` (parameters as `{}`, no `/api` prefix) of every route the Nest app registered. */
export function registeredRoutes(app: INestApplication): Set<string> {
  const instance = app.getHttpAdapter().getInstance() as {
    router?: { stack: ExpressLayer[] }
    _router?: { stack: ExpressLayer[] }
  }
  const stack = (instance.router ?? instance._router)?.stack ?? []
  const out = new Set<string>()
  for (const layer of stack) {
    const route = layer.route
    if (!route || typeof route.path !== 'string') continue
    const path = route.path.startsWith(API_BASE) ? route.path.slice(API_BASE.length) : route.path
    for (const m of Object.keys(route.methods)) out.add(`${m.toUpperCase()} ${normalisePath(path)}`)
  }
  return out
}

/** The supertest `HttpClient`: same interface as the mock adapter, plus `set-cookie` and a file part. */
export function supertestClient(app: INestApplication, baseHeaders: () => Record<string, string>): HttpClient {
  return {
    async request(method: HttpMethod, path: string, init: HttpRequestInit = {}): Promise<HttpResponse> {
      const agent = request(app.getHttpServer())
      const url = `${API_BASE}${path}`
      let req = {
        GET: () => agent.get(url),
        POST: () => agent.post(url),
        PUT: () => agent.put(url),
        PATCH: () => agent.patch(url),
        DELETE: () => agent.delete(url),
      }[method]()
      for (const [k, v] of Object.entries({ ...baseHeaders(), ...init.headers })) req = req.set(k, v)
      if (init.file) {
        const { field, filename, contentType, content } = init.file
        req = req.attach(field, Buffer.from(content), { filename, contentType })
      } else if (init.body !== undefined) {
        req = req.send(init.body as object)
      }
      const res = await req
      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(res.headers as Record<string, string | string[] | undefined>)) {
        if (v === undefined) continue
        headers[k.toLowerCase()] = Array.isArray(v) ? v.join('\n') : String(v)
      }
      const isJson = (headers['content-type'] ?? '').includes('json')
      const body = isJson && res.text !== '' ? (res.body as unknown) : null
      return { status: res.status, headers, body }
    },
  }
}

/**
 * The API `Target`: every request goes to the in-process Nest app through supertest.
 *
 * - `beginScenario` gives the scenario its own client address (`X-Forwarded-For`, with
 *   `TRUST_PROXY_HOPS=1`), so login counters of one scenario never reach another.
 * - `implements` is true for the routes the Nest app registered; a contract operation without a
 *   route belongs to a card not built yet and is reported as "not yet implemented".
 * - `actor` signs in through `POST /auth/login` with the seeded account of the role and follows the
 *   cookie and CSRF token the server issues (`sessionLogin`).
 */
export function apiTarget(app: INestApplication): Target {
  const routes = registeredRoutes(app)
  let counter = 0
  let address = '10.0.0.1'
  const base = supertestClient(app, () => ({ 'x-forwarded-for': address }))
  return {
    name: 'api',
    anonymous: base,
    credentials: accountFor,
    beginScenario() {
      counter++
      address = `10.${String((counter >> 16) & 255)}.${String((counter >> 8) & 255)}.${String(counter & 255)}`
    },
    implements: (op) => routes.has(`${op.method} ${normalisePath(op.path)}`),
    async actor(role: ActorRole, opts) {
      const session = await sessionLogin(base, { ...accountFor(role), remember: false })
      return opts?.csrf === false ? session.withoutCsrf() : session
    },
  }
}
