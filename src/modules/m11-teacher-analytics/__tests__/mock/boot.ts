/**
 * Boot helper of the M11-T1 tests: the real core with the owners M11 reads (M01 users, M02 schools,
 * M03 curriculum, M04 questions, M05 practice, M08 designed sessions, M10 classes), the M11 plugin, at the
 * project clock. Registry order is kept.
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
import m08 from '@/modules/m08-student-performance/mock'
import m10 from '@/modules/m10-teacher-class/mock'

import m11 from '../../mock'

export async function bootM11(
  at: string = CLOCK_ANCHOR_ISO,
): Promise<{ runtime: MockRuntime; clock: Clock }> {
  const clock = createClock({ at })
  const runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m08, m10, m11],
    clock,
    latencyMs: 0,
    onWarn: null,
  })
  return { runtime, clock }
}

export const ADMIN = 1
export const PELAJAR = 2
export const GURU = 5
export const ADMIN_SEKOLAH = 8

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

/** A GET as canonical account `userId` (or without a session when `userId` is null). */
export async function getAs<T = unknown>(
  runtime: MockRuntime,
  userId: number | null,
  url: string,
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (userId !== null) headers.authorization = `Bearer ${setUser(userId).token}`
  const res: TransportResponse = await runtime.transport.request({ method: 'GET', url, headers })
  return { status: res.status, body: res.body as T }
}

/** The `data` of a 200 answer. */
export async function dataAs<T>(
  runtime: MockRuntime,
  userId: number | null,
  url: string,
): Promise<T> {
  const r = await getAs<{ data: T }>(runtime, userId, url)
  if (r.status !== 200)
    throw new Error(
      `GET ${url} as ${String(userId)} → ${String(r.status)} ${JSON.stringify(r.body)}`,
    )
  return r.body.data
}
