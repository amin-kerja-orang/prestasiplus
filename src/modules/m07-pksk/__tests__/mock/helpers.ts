/**
 * Boot helper of the M07-T1a tests: the real core with the owners M07 reads (M01 users, M02, M03,
 * M04 questions), M05 (sessions), M14 (syiling) and M07 at the project clock 2026-09-25.
 */

import type { TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock, type Clock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'
import m14 from '@/modules/m14-gamification/mock'

import m07 from '../../mock'

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

export async function bootPksk(
  at: string = CLOCK_ANCHOR_ISO,
): Promise<{ runtime: MockRuntime; clock: Clock }> {
  const clock = createClock({ at })
  const runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m07, m14],
    clock,
    latencyMs: 0,
    onWarn: null,
  })
  return { runtime, clock }
}

/** Canonical account ids (M01 §6.8). */
export const ADMIN = 1
export const PELAJAR = 2
export const PELAJAR2 = 3
export const MAJU = 4
export const GURU = 5
export const IBUBAPA = 6

export interface Answer<T = unknown> {
  status: number
  body: T
}

export async function call<T = unknown>(
  runtime: MockRuntime,
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  userId: number | null,
  body?: unknown,
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (userId !== null) headers.authorization = `Bearer ${setUser(userId).token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res: TransportResponse = await runtime.transport.request({
    method,
    url,
    headers,
    ...(body !== undefined ? { body } : {}),
  })
  return { status: res.status, body: res.body as T }
}

export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> }
}
