/**
 * Boot helper of the M05-T1 tests: the real core with the owners the dashboard and the read
 * handlers read (M01, M02, M03, M04), M05, the M09 content store (banners, articles) and the M14
 * gamification store (wallet, streak, quests, badges), at the project clock.
 */

import { CLOCK_ANCHOR_ISO, createClock, type Clock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m09 from '@/modules/m09-content/mock'
import m14 from '@/modules/m14-gamification/mock'

import m05 from '../../mock'
import { request } from './helpers'

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

export async function bootAll(): Promise<{ runtime: MockRuntime; clock: Clock }> {
  const clock = createClock({ at: CLOCK_ANCHOR_ISO })
  const runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m09, m14],
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
export const ADMIN_SEKOLAH = 8

export interface Answer<T = unknown> {
  status: number
  body: T
}

/** A GET as canonical account `userId`. */
export async function getAs<T = unknown>(
  runtime: MockRuntime,
  userId: number,
  url: string,
): Promise<Answer<T>> {
  const res = await request(runtime, 'GET', url, setUser(userId).token)
  return { status: res.status, body: res.body as T }
}

/** A list answer: `{data, meta}`. */
export interface ListBody<T, M extends object = Record<never, never>> {
  data: T[]
  meta: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    from?: number | null
    to?: number | null
  } & M
}

export interface ErrorBody {
  error: { code: string; message: string }
}
