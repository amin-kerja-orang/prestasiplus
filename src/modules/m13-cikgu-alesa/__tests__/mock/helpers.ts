/**
 * Boot helper for the M13-T1 tests: the real mock core with the owners M13 reads (M01 users, M02
 * schools, M03 subjects, M04 questions, M05 answers, M08 designed answers of students 3001–3008, M10
 * classes) and the M13 plugin, at the project clock. M14 is added because M05 reads it at request time.
 */

import { CLOCK_ANCHOR_ISO, clock as globalClock, createClock, type Clock } from '@/lib/time'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'
import m08 from '@/modules/m08-student-performance/mock'
import m10 from '@/modules/m10-teacher-class/mock'
import m14 from '@/modules/m14-gamification/mock'

import m13, { AI_LATENCY_KEY } from '../../mock'

export const NOW = CLOCK_ANCHOR_ISO

export async function bootM13(): Promise<{ runtime: MockRuntime; clock: Clock }> {
  const clock = createClock({ at: NOW })
  const runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m08, m10, m13, m14],
    clock,
    latencyMs: 0,
    onWarn: null,
  })
  runtime.config.set(AI_LATENCY_KEY, 0)
  // The test hooks read the shared clock (as in the app, where it is the runtime's clock).
  globalClock.setNow(NOW)
  return { runtime, clock }
}

export { m05 }
