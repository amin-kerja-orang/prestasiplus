/**
 * Boot helper of the M08-T1 tests: the real core with the owners M08 reads (M01 users, M02 schools,
 * M03 curriculum, M04 questions, M05 practice, M10 classes, M14 gamification), the M08 plugin, at the
 * project clock. Registry order is kept (M08 before M10 before M14).
 */

import { CLOCK_ANCHOR_ISO, createClock, type Clock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import type { TransportResponse } from '@/api/transport'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'
import m10 from '@/modules/m10-teacher-class/mock'
import m14 from '@/modules/m14-gamification/mock'

import m08 from '../../mock'

export async function bootM08(
  at: string = CLOCK_ANCHOR_ISO,
): Promise<{ runtime: MockRuntime; clock: Clock }> {
  const clock = createClock({ at })
  const runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m08, m10, m14],
    clock,
    latencyMs: 0,
    onWarn: null,
  })
  return { runtime, clock }
}

export const ADMIN = 1
export const PELAJAR = 2
export const PELAJAR2 = 3
export const MAJU = 4
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

/** A request as canonical account `userId` (or without a session when `userId` is null). */
export async function send<T = unknown>(
  runtime: MockRuntime,
  userId: number | null,
  method: 'GET' | 'POST',
  url: string,
  body?: unknown,
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (userId !== null) headers.authorization = `Bearer ${setUser(userId).token}`
  if (body !== undefined && !(body instanceof FormData))
    headers['content-type'] = 'application/json'
  const res: TransportResponse = await runtime.transport.request({
    method,
    url,
    headers,
    ...(body !== undefined ? { body } : {}),
  })
  return { status: res.status, body: res.body as T }
}

export const getAs = <T = unknown>(runtime: MockRuntime, userId: number | null, url: string) =>
  send<T>(runtime, userId, 'GET', url)

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
