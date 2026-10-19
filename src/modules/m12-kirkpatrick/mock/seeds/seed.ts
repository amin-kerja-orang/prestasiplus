/**
 * M12 seed (SRS M12 v1.6 §6.9), written through the M12 repositories (overview §3 rule 3a):
 *
 * - `seedM12(ctx)` (seed phase): the 33 school scores (DATA-M12-03), the two observed ALESA lists (DATA-M12-04)
 *   and the two StudentConsistency anchors (DATA-M12-05). The intervention store is empty as on live.
 * - `finaliseM12()` (after every dataset has compiled): the 336 feedback responses, whose respondents are users
 *   of the M01 dataset, and the build check of the M12-owned named queries.
 *
 * The practice figures, the populations, the SPM history and the headcount rows are NOT seeded here: they are the
 * owners' (M05 KirkpatrickSessionAggregate, M01 / M02 users and schools, M08) and are read at request time.
 */

import { checkNamedQueries } from '@/mock/dataset'
import type { SeedContext } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import { ALESA_8080_SEED, ALESA_PLATFORM_SEED } from '../data/alesa'
import { STUDENT_POOL, TEACHER_POOL, buildFeedbackRows } from '../data/feedback'
import { SCHOOL_SCORE_SEED } from '../data/school-scores'
import { alesaRepo } from '../repository/alesa'
import { bindM12Clock } from '../repository/common'
import { consistencyRepo } from '../repository/consistency'
import { feedbackQueries, feedbackRepo } from '../repository/feedback'
import { interventionQueries } from '../repository/interventions'
import { schoolScoresRepo } from '../repository/scores'

/** The observed S8 anchors: Student A (4664) 22.5 and Student B (4644) 21.1 (M12 §6.9). */
const CONSISTENCY_ANCHORS = [
  [4664, 22.5],
  [4644, 21.1],
] as const

export function seedM12(ctx: SeedContext): void {
  bindM12Clock(ctx.clock)
  schoolScoresRepo.seed(SCHOOL_SCORE_SEED)
  alesaRepo.seed('platform', ALESA_PLATFORM_SEED)
  alesaRepo.seed(8080, ALESA_8080_SEED)
  consistencyRepo.seed(CONSISTENCY_ANCHORS)
}

/** The first `n` active generated users of `role` (ids above the canonical accounts 1-11), by id. */
function pool(role: 'student' | 'teacher', n: number): number[] {
  const rows = users.query('U-ROLE-ACTIVE', { sort: 'id', page: 1, pageSize: 400 }, role, true).rows
  return rows
    .filter((u) => u.id > 11 && u.schoolId !== null)
    .slice(0, n)
    .map((u) => u.id)
}

/** Throws when a documented M12 figure differs from the computed count (stops the boot). */
export function finaliseM12(): void {
  feedbackRepo.seed(
    buildFeedbackRows(
      pool('student', STUDENT_POOL),
      pool('teacher', TEACHER_POOL),
      (id) => users.get(id)?.schoolId ?? null,
    ),
  )
  const issues = [...checkNamedQueries(feedbackQueries), ...checkNamedQueries(interventionQueries)]
  if (issues.length > 0) {
    throw new Error(`M12 build check failed:\n${issues.map((i) => `- ${i.message}`).join('\n')}`)
  }
}
