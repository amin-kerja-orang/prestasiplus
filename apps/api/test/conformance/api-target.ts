import type { INestApplication } from '@nestjs/common'
import {
  type ActorRole,
  type HttpClient,
  type HttpMethod,
  type ContractIndex,
  type HttpRequestInit,
  type HttpResponse,
  type SessionClient,
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

/**
 * `METHOD /path` (parameters as `{}`, no `/api` prefix) of every route the Nest app registered.
 * Express 5 keeps the router in `app.router`, Express 4 in `app._router`; if neither has a stack
 * (or the stack holds no route) this THROWS, because an empty answer would mark every contract
 * operation "not yet implemented" and hide every failure.
 */
export function registeredRoutes(app: INestApplication): Set<string> {
  const instance = app.getHttpAdapter().getInstance() as {
    router?: { stack?: ExpressLayer[] }
    _router?: { stack?: ExpressLayer[] }
  }
  const stack = instance.router?.stack ?? instance._router?.stack
  if (!Array.isArray(stack)) throw new Error('conformance: cannot find the Express router stack (app.router / app._router)')
  const out = new Set<string>()
  for (const layer of stack) {
    const route = layer.route
    if (!route || typeof route.path !== 'string') continue
    // Nest's own fallback for the global prefix (every method, answers its 404): not a controller route.
    // Only that exact pattern is skipped; a real controller route with a wildcard is still checked.
    if (NEST_FALLBACK.test(route.path)) continue
    const path = route.path.startsWith(`${API_BASE}/`) ? route.path.slice(API_BASE.length) : route.path
    for (const m of Object.keys(route.methods)) out.add(`${m.toUpperCase()} ${normalisePath(path)}`)
  }
  if (out.size === 0) throw new Error('conformance: the Express router stack holds no route')
  return out
}

/** The route Nest adds for the global prefix `api`: `/api{/*path}` (Express 5) or `/api/*` (Express 4). */
const NEST_FALLBACK = /^\/api(\{\/?\*[A-Za-z_]*\}|\/\*[A-Za-z_]*)$/

/** Routes outside the contract on purpose, each with its reason. Nothing else may be unknown. */
export const NON_CONTRACT_ROUTES: Record<string, string> = {
  'GET /health': 'liveness / readiness probe (BE-01); infrastructure, not part of the product contract',
  'POST /me/parent-invite/generate':
    'mock-compat alias of POST /me/parent-invite (BE-25 deviation); removed when the frontend moves to the canonical route (V2-T31)',
}

/**
 * Reverse check: every route the app registered must match a contract operation, otherwise a
 * controller with a typo in its path would be skipped as "not yet implemented" for ever. Returns
 * the `METHOD /path` of every registered route that matches none (and is not in NON_CONTRACT_ROUTES).
 */
export function unknownRoutes(routes: Set<string>, contract: ContractIndex): string[] {
  return [...routes].filter((key) => {
    if (key in NON_CONTRACT_ROUTES) return false
    const [method, path] = key.split(' ') as [HttpMethod, string]
    return contract.match(method, path.replaceAll('{}', 'x')) === null
  })
}

/** The supertest `HttpClient`: same interface as the mock adapter, plus `set-cookie` and a file part. */
export function supertestClient(app: INestApplication, baseHeaders: () => Record<string, string>): HttpClient {
  // supertest binds the server to a port per request and leaves listeners behind; a whole suite sends thousands.
  ;(app.getHttpServer() as { setMaxListeners(n: number): void }).setMaxListeners(0)
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
export function apiTarget(app: INestApplication, routes = registeredRoutes(app)): Target {
  let counter = 0
  let address = '10.0.0.1'
  const base = supertestClient(app, () => ({ 'x-forwarded-for': address }))
  // One login per role inside a scenario (argon2 is the slow part); a new scenario starts clean.
  let sessions = new Map<ActorRole, Promise<SessionClient>>()
  return {
    name: 'api',
    anonymous: base,
    credentials: accountFor,
    beginScenario() {
      counter++
      sessions = new Map()
      address = `10.${String((counter >> 16) & 255)}.${String((counter >> 8) & 255)}.${String(counter & 255)}`
    },
    implements: (op) => routes.has(`${op.method} ${normalisePath(op.path)}`),
    async actor(role: ActorRole, opts) {
      let login = sessions.get(role)
      // The login goes through the runner's checked client, so its response is contract-checked.
      if (!login) {
        login = sessionLogin(opts?.via ?? base, { ...accountFor(role), remember: false })
        sessions.set(role, login)
      }
      const session = await login
      return opts?.csrf === false ? session.withoutCsrf() : session
    },
  }
}
