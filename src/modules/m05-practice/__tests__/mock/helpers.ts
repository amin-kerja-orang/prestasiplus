/**
 * Boot helper for the F-26 tests: the real mock core (canonical accounts, sessions) with the owners
 * the practice store reads (M01 users, M02 schools, M03 curriculum, M04 questions), the M05 plugin
 * and the M14 gamification plugin (BR-31 step 6), at the project clock.
 */

import type { TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock, type Clock } from '@/lib/time'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m14 from '@/modules/m14-gamification/mock'

import m05 from '../../mock'

export const NOW = CLOCK_ANCHOR_ISO

export async function bootPractice(
  options: { at?: string; withM14?: boolean } = {},
): Promise<{ runtime: MockRuntime; clock: Clock }> {
  const clock = createClock({ at: options.at ?? NOW })
  const plugins =
    options.withM14 === false ? [m01, m02, m03, m04, m05] : [m01, m02, m03, m04, m05, m14]
  const runtime = await bootMock({
    mode: 'test',
    plugins,
    clock,
    latencyMs: 0,
    onWarn: null,
  })
  return { runtime, clock }
}

export function request(
  runtime: MockRuntime,
  method: 'GET' | 'POST',
  url: string,
  token: string,
  body?: unknown,
): Promise<TransportResponse> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${token}`,
  }
  if (body !== undefined) headers['content-type'] = 'application/json'
  return runtime.transport.request({
    method,
    url,
    headers,
    ...(body !== undefined ? { body } : {}),
  })
}
