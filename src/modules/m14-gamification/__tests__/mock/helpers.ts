/**
 * Boot helper for the F-26b tests: the real mock core (canonical accounts, sessions, `GET /api/me*`)
 * with the owners the M14 store reads (M01 users, M02 schools) and the M14 plugin, at the project
 * clock.
 */

import { vi } from 'vitest'

import type { TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock, type Clock } from '@/lib/time'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'

import m14 from '../../mock'

export const NOW = CLOCK_ANCHOR_ISO

export async function bootM14(at: string = NOW): Promise<{ runtime: MockRuntime; clock: Clock }> {
  const clock = createClock({ at })
  const runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m14],
    clock,
    latencyMs: 0,
    onWarn: null,
  })
  return { runtime, clock }
}

class MemoryStorage {
  readonly items = new Map<string, string>()
  getItem(key: string) {
    return this.items.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.items.set(key, value)
  }
  removeItem(key: string) {
    this.items.delete(key)
  }
}

export function stubStorage(): void {
  vi.stubGlobal('localStorage', new MemoryStorage())
}

export function get(runtime: MockRuntime, url: string, token?: string): Promise<TransportResponse> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (token !== undefined) headers.authorization = `Bearer ${token}`
  return runtime.transport.request({ method: 'GET', url, headers })
}

/** Any method, an optional query (`{page: 2}`) and body, as the API client sends them. */
export function send(
  runtime: MockRuntime,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  options: { token?: string; query?: Record<string, string | number>; body?: unknown } = {},
): Promise<TransportResponse> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (options.token !== undefined) headers.authorization = `Bearer ${options.token}`
  const query = options.query
    ? Object.fromEntries(Object.entries(options.query).map(([k, v]) => [k, String(v)]))
    : undefined
  return runtime.transport.request({
    method,
    url,
    headers,
    ...(query ? { query } : {}),
    ...(options.body !== undefined ? { body: options.body } : {}),
  })
}

/** The `data` of a response body (`{data}` envelope). */
export const dataOf = <T = unknown>(res: TransportResponse): T => (res.body as { data: T }).data
