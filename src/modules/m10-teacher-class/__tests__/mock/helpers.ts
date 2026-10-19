/**
 * Boot helper for the F-30 tests: the real mock core (canonical accounts, sessions) with the owners
 * the M10 store reads (M01 users, M02 schools, M03 curriculum, M04 questions) and the M10 plugin, at
 * the project clock. `withPractice` adds M05 (and M14) to check the seams against the real stores.
 */

import { CLOCK_ANCHOR_ISO, createClock, type Clock } from '@/lib/time'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'
import m14 from '@/modules/m14-gamification/mock'

import m10 from '../../mock'

export const NOW = CLOCK_ANCHOR_ISO

export async function bootM10(
  options: { at?: string; withPractice?: boolean } = {},
): Promise<{ runtime: MockRuntime; clock: Clock }> {
  const clock = createClock({ at: options.at ?? NOW })
  const plugins = options.withPractice
    ? [m01, m02, m03, m04, m05, m10, m14]
    : [m01, m02, m03, m04, m10]
  const runtime = await bootMock({ mode: 'test', plugins, clock, latencyMs: 0, onWarn: null })
  return { runtime, clock }
}
