/**
 * Helpers of the M17-T1a tests: the real core with the owners the drill-down reads (M01 users, M02
 * schools, M03 curriculum, M04 questions, M05 practice, M08 headcount, M10 classes, M14 streak) and M17
 * (F-33 mood store, the §7 #6–#13 routes), at the project clock; requests as any user id.
 */

import type { HttpMethod, TransportResponse } from '@/api/transport'
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
import m14 from '@/modules/m14-gamification/mock'

import m17 from '../../mock'

export const ADMIN = 1
export const PELAJAR = 2
export const GURU = 5
export const IBU_BAPA = 6
export const ADMIN_SEKOLAH = 8
export const PPD = 9

export async function bootDrill(
  at: string = CLOCK_ANCHOR_ISO,
): Promise<{ runtime: MockRuntime; clock: Clock }> {
  const clock = createClock({ at })
  const runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m08, m10, m14, m17],
    clock,
    latencyMs: 0,
    onWarn: null,
  })
  return { runtime, clock }
}

export interface Reply<T = unknown> {
  status: number
  body: T
}

/** A request as user `userId` (any M01 user; `setUser` opens its session), or as a guest. */
export async function call<T = unknown>(
  runtime: MockRuntime,
  userId: number | null,
  url: string,
  method: HttpMethod = 'GET',
): Promise<Reply<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (userId !== null) headers.authorization = `Bearer ${setUser(userId).token}`
  const res: TransportResponse = await runtime.transport.request({ method, url, headers })
  return { status: res.status, body: res.body as T }
}

/** The `data` of a 200 reply (throws with the body otherwise). */
export async function data<T>(
  runtime: MockRuntime,
  userId: number | null,
  url: string,
): Promise<T> {
  const r = await call<{ data: T }>(runtime, userId, url)
  if (r.status !== 200) {
    throw new Error(
      `GET ${url} as ${String(userId)} → ${String(r.status)} ${JSON.stringify(r.body)}`,
    )
  }
  return r.body.data
}

export interface ErrorBody {
  error: { code: string; message: string }
}
