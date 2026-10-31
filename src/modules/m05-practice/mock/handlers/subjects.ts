/**
 * SRS M05 v1.17 §7 #2 `GET /api/practice/subjects` (S2) and #3 `GET /api/practice/subjects/:code`
 * (S3, BR-11, BR-12). Any session (A). Counts come from the M04 named queries (BR-05); nothing is
 * stored here.
 */

import { notFound, ok, requireAuth, route, unpaged, type RouteDef } from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { users } from '@/modules/m01-authentication/mock'
import { questions } from '@/modules/m04-question-bank/mock'

import type { DifficultyCounts, SubjectConfig } from '../../api/types'
import { fixtures } from '../hooks/fixtures'
import {
  activeSubjectByCode,
  offeredLevelIds,
  practiceLevelCount,
  practiceSubjects,
  subjectView,
  userIdOf,
  type SubjectRecord,
} from './common'

const DIFFICULTIES = [1, 2, 3, 4, 5] as const

/** Q-PRACTICE split by difficulty for the given offered levels (BR-12; M04 §6.13). */
function difficultyCounts(subjectId: number, levelIds: readonly number[]): DifficultyCounts {
  const out: Record<string, number> = {}
  for (const d of DIFFICULTIES) {
    out[String(d)] =
      levelIds.length === 0
        ? 0
        : questions.countWhere(
            questions.practiceWhere({
              subjectId,
              educationLevelIds: levelIds,
              difficultyLevel: d,
            }),
          )
  }
  return out as DifficultyCounts
}

function subjectConfig(s: SubjectRecord, userId: number, now: number): SubjectConfig {
  const offered = offeredLevelIds(s)
  const levels = offered.flatMap((id) => {
    const level = curriculum.level(id)
    return level
      ? [{ id, code: level.code, name: level.name, count: practiceLevelCount(s.id, id) }]
      : []
  })
  const difficultyByLevel: Record<string, DifficultyCounts> = {}
  for (const l of levels) difficultyByLevel[String(l.id)] = difficultyCounts(s.id, [l.id])
  return {
    subject: subjectView(s),
    total: levels.reduce((a, l) => a + l.count, 0),
    levels,
    difficultyStats: difficultyCounts(s.id, offered),
    difficultyByLevel,
    subjectiveCounts: fixtures.subjectiveCounts(s.id),
    trial: users.trial(userId, now),
  }
}

export const subjectRoutes: RouteDef[] = [
  route('GET', '/api/practice/subjects', [requireAuth()], () =>
    unpaged(practiceSubjects().map(subjectView)),
  ),

  route('GET', '/api/practice/subjects/:code', [requireAuth()], (req, ctx) => {
    const s = activeSubjectByCode(String(req.params.code))
    if (!s) return notFound()
    return ok(subjectConfig(s, userIdOf(req), ctx.clock.now()))
  }),
]
