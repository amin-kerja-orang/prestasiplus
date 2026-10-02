/**
 * Boot helper for the F-29 tests: the mock core with the owners the M09 store reads (M01 users,
 * M02 schools), M14 (whose streak anchors the M01 build check counts as activity dates) and the
 * M09 plugin, at the project clock. Only these modules boot, so the tests do not depend on the
 * build of unrelated modules.
 */

import { CLOCK_ANCHOR_ISO, createClock, type Clock } from '@/lib/time'
import { defineMockCore } from '@/mock/define'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m14 from '@/modules/m14-gamification/mock'

import m09 from '../../mock'

export const NOW = CLOCK_ANCHOR_ISO

export async function bootM09(at: string = NOW): Promise<{ runtime: MockRuntime; clock: Clock }> {
  const clock = createClock({ at })
  const runtime = await bootMock({
    mode: 'test',
    core: defineMockCore({}),
    plugins: [m01, m02, m14, m09],
    clock,
    latencyMs: 0,
    onWarn: null,
  })
  return { runtime, clock }
}
