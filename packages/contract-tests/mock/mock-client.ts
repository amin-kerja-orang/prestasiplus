import type { Transport } from '@/api/transport'
import { CANONICAL_ACCOUNTS, DEMO_PASSWORD } from '@/mock/core-data/accounts'

import type { ActorRole, HttpClient, HttpMethod, HttpRequestInit, Target } from '../src/http-client'

// --- The sample adapter of the README (AC7): an HttpClient over the frontend mock transport. ---
export function mockClient(transport: Transport, token?: string): HttpClient {
  return {
    async request(method: HttpMethod, path: string, init: HttpRequestInit = {}) {
      const headers: Record<string, string> = { accept: 'application/json', ...init.headers }
      if (token) headers.authorization = `Bearer ${token}`
      const res = await transport.request({
        method,
        url: `/api${path}`,
        headers,
        ...(init.body === undefined ? {} : { body: init.body }),
      })
      return { status: res.status, headers: res.headers, body: res.body ?? null }
    },
  }
}
// --- end of the sample adapter ---

const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

const toMyt = (iso: string) =>
  `${new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(0, 19)}+08:00`

/**
 * The documented mock-versus-wire difference (ADR-0018 item 6; the same mapping the contract
 * fixture tests use): the mock has numeric ids and `Z` instants, the wire has string ids and
 * `+08:00`. Without it every response that carries an id fails and hides the real mismatches.
 * `MOCK_RAW=1` switches it off to see the unmapped result.
 */
export function toWire(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return value.map((v) => toWire(v, key))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toWire(v, k)]))
  }
  if (typeof value === 'number' && (key === 'id' || key.endsWith('Id') || key.endsWith('Ids'))) {
    return String(value)
  }
  if (typeof value === 'string' && ISO_Z.test(value)) return toMyt(value)
  return value
}

/** Maps every response body of `client` with `toWire`. */
export function withWireMapping(client: HttpClient): HttpClient {
  return {
    async request(method, path, init) {
      const res = await client.request(method, path, init)
      return { ...res, body: toWire(res.body) }
    },
  }
}

const account = (role: ActorRole) => {
  const found = CANONICAL_ACCOUNTS.find((a) => a.role === role)
  if (!found) throw new Error(`no canonical mock account for role ${role}`)
  return found
}

/**
 * The mock Target. The mock logs in with `{ email, password }` and answers `{ data: { token } }`
 * (a Bearer token, no cookie, no CSRF), so `actor()` uses that private login; the contract-shaped
 * login is exercised by the auth scenarios through `anonymous`.
 */
export function mockTarget(transport: Transport, { raw = false } = {}): Target {
  const wrap = (c: HttpClient) => (raw ? c : withWireMapping(c))
  return {
    name: raw ? 'mock (raw ids)' : 'mock',
    anonymous: wrap(mockClient(transport)),
    credentials: (role) => ({ identifier: account(role).email, password: DEMO_PASSWORD }),
    async actor(role) {
      const { email, password } = account(role)
      const res = await mockClient(transport).request('POST', '/auth/login', {
        body: { email, password, remember: false },
      })
      const token = (res.body as { data?: { token?: string } } | null)?.data?.token
      if (!token) throw new Error(`mock login failed for ${role}: HTTP ${String(res.status)}`)
      return wrap(mockClient(transport, token))
    },
  }
}
