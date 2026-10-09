/**
 * Boot helper of the M16-T1 tests: the mock core with the owners M16 reads (M01 users, M02 schools, M03
 * curriculum, M04 questions, M05 platform accuracy, M14 gamification) and the M16 plugin, at the project
 * clock (2026-09-25 15:40 MYT). Only these modules boot, so the tests do not depend on unrelated modules.
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
import m07 from '@/modules/m07-pksk/mock'
import m10 from '@/modules/m10-teacher-class/mock'
import m11 from '@/modules/m11-teacher-analytics/mock'
import m14 from '@/modules/m14-gamification/mock'

import m16 from '../../mock'

export const NOW = CLOCK_ANCHOR_ISO

export interface Booted {
  runtime: MockRuntime
  clock: Clock
}

export async function bootM16(at: string = NOW): Promise<Booted> {
  const clock = createClock({ at })
  const runtime = await bootMock({
    mode: 'test',
    clock,
    latencyMs: 0,
    onWarn: null,
    plugins: [m01, m02, m03, m04, m05, m07, m10, m11, m14, m16],
  })
  return { runtime, clock }
}

export interface Answer<T = unknown> {
  status: number
  body: T
}

export class MemoryStorage {
  private readonly items = new Map<string, string>()
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

export { setUser }
export type { TransportResponse }
