/**
 * Helpers of the M17-T1b tests (SRS §7 #3–#5): the real core with the owners the Command Center board reads
 * (M01 users, M02 schools and subscriptions, M03 curriculum, M04 questions, M05 practice, M08 SPM history and
 * headcount, M10 classes, M12 feedback, M14 badges) and M17 (F-33 mood store, the routes), at the project
 * clock. Requests as any user id (`call` / `data` of the T1a helpers).
 */

import { CLOCK_ANCHOR_ISO, createClock, type Clock } from '@/lib/time'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'
import m08 from '@/modules/m08-student-performance/mock'
import m10 from '@/modules/m10-teacher-class/mock'
import m12 from '@/modules/m12-kirkpatrick/mock'
import m14 from '@/modules/m14-gamification/mock'

import m17 from '../../mock'

export { ADMIN, ADMIN_SEKOLAH, GURU, IBU_BAPA, PELAJAR, PPD, call, data } from './drill-helpers'
export type { ErrorBody, Reply } from './drill-helpers'

export async function bootBoard(
  at: string = CLOCK_ANCHOR_ISO,
): Promise<{ runtime: MockRuntime; clock: Clock }> {
  const clock = createClock({ at })
  const runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m08, m10, m12, m14, m17],
    clock,
    latencyMs: 0,
    onWarn: null,
  })
  return { runtime, clock }
}
