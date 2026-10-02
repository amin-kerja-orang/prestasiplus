/**
 * REQUIREMENT: the complimentary handlers (#16, #17, #18, #23) need M10 (and so M03 and M04) booted with
 * M02; without them they answer a 500 (`MSG_NEEDS_M10`).
 *
 * Boot helper of the M02-T3 tests (complimentary students, subscriptions): the real core with M01, M02
 * and the owners the complimentary handlers read (M03 subjects, M04 for M10, M10 classes and
 * enrolments), at the project clock.
 */

import { createClock } from '@/lib/time'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m10 from '@/modules/m10-teacher-class/mock'

import m02 from '../../mock'
import { NOW } from './helpers'

export async function bootM02Full(): Promise<MockRuntime> {
  return bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m10],
    clock: createClock({ at: NOW }),
    latencyMs: 0,
    onWarn: null,
  })
}
