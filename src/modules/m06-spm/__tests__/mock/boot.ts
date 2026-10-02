/** Boot helper of the M06-T1 tests: core + M01-M05 owners + the M06 plugin at the project clock. */

import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'

import m06 from '../../mock'

export const ADMIN = 1
export const PELAJAR = 2
export const PELAJAR2 = 3
export const GURU = 5

export async function bootM06(): Promise<MockRuntime> {
  return bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m06],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}

export class MemoryStorage {
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

export interface Answer<T = unknown> {
  status: number
  body: T
}

type Method = 'GET' | 'POST'

export async function call<T = unknown>(
  runtime: MockRuntime,
  userId: number | null,
  method: Method,
  url: string,
  body?: unknown,
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (userId !== null) headers.authorization = `Bearer ${setUser(userId).token}`
  if (body !== undefined && !(body instanceof FormData)) headers['content-type'] = 'application/json'
  const res = await runtime.transport.request({
    method,
    url,
    headers,
    ...(body !== undefined ? { body } : {}),
  })
  return { status: res.status, body: res.body as T }
}

/** The `data` of a 200/201 answer. */
export async function dataOf<T>(
  runtime: MockRuntime,
  userId: number | null,
  method: Method,
  url: string,
  body?: unknown,
): Promise<T> {
  const r = await call<{ data: T }>(runtime, userId, method, url, body)
  if (r.status !== 200 && r.status !== 201)
    throw new Error(`${method} ${url} as ${String(userId)} -> ${String(r.status)} ${JSON.stringify(r.body)}`)
  return r.body.data
}
