import type { CurriculumTag } from './types'

/** Shown for T1-T3 content, which is outside DSKP and has no unit (same copy as the intake editor). */
export const T1_T3_TOPIC = 'Tingkatan 1-3 (di luar DSKP)'

/** Topic name to display: the unit label, or the T1-T3 copy when the question has no unit. */
export function topicOf(c: CurriculumTag): string {
  return c.unitLabel || (c.formOrigin === 'T1-T3' ? T1_T3_TOPIC : '')
}
