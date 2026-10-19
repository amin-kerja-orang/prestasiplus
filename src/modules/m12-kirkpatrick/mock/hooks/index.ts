/**
 * M12 test hooks (`window.__mock`, dev and e2e builds; SRS M12 v1.6 §6.11). `mock.reset()`, `mock.setNow`,
 * `mock.failNext` and `mock.loginAs` are the mock core's; the M12 hooks are:
 *
 * | Hook | Effect |
 * |---|---|
 * | `addFeedback({userId, nps, satisfaction})` | stores one response of the user for the current month (T1 figures include it, AC-M12-10.3) |
 * | `addIntervention({studentId, alertType, actionDate, alertDescription, actionTaken, ...})` | stores one intervention (`createdBy` default 1) |
 * | `addSegmentStudent({schoolId, answers, correct})` | gives one T4/T5 student of the school without a session one completed session of `answers` answered and `correct` correct questions (band-boundary checks of AC-M12-15.3; returns the user id) |
 *
 * Each validates its input and throws a `RangeError` / `TypeError` (never a crash inside the app).
 */

import { users } from '@/modules/m01-authentication/mock'
import { kirkpatrick } from '@/modules/m05-practice/mock'

import type { InterventionInput } from '../../api/types'
import { feedbackRepo, interventionsRepo, m12Now } from '../repository'

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

export function addFeedback(input: { userId: number; nps: number; satisfaction: number }) {
  const user = Number.isInteger(input.userId) ? users.get(input.userId) : undefined
  if (!user) throw new RangeError(`addFeedback: unknown user ${String(input.userId)}`)
  return feedbackRepo.submit(
    { id: user.id, role: user.role, schoolId: user.schoolId },
    { nps: input.nps, satisfaction: input.satisfaction },
    m12Now(),
  )
}

export function addIntervention(input: InterventionInput & { createdBy?: number }) {
  const { createdBy, ...rest } = input
  return interventionsRepo.create(rest, createdBy ?? 1)
}

export function addSegmentStudent(input: {
  schoolId: number
  answers: number
  correct: number
}): number {
  if (!Number.isInteger(input.schoolId))
    throw new TypeError('addSegmentStudent: schoolId must be an integer')
  if (!isCount(input.answers) || !isCount(input.correct) || input.correct > input.answers) {
    throw new RangeError('addSegmentStudent: need 0 <= correct <= answers')
  }
  const busy = new Set(kirkpatrick.students().map((s) => s.userId))
  const candidates = users.query(
    'Q-M11-T45',
    { sort: 'id', page: 1, pageSize: 5000 },
    input.schoolId,
  ).rows
  const student = candidates.find((u) => !busy.has(u.id))
  if (!student)
    throw new RangeError(
      `addSegmentStudent: school ${String(input.schoolId)} has no free T4/T5 student`,
    )
  kirkpatrick.addSession({
    userId: student.id,
    subjectId: 1,
    completedAt: m12Now(),
    questionCount: input.answers,
    answeredCount: input.answers,
    correctCount: input.correct,
  })
  return student.id
}

export const m12Hooks = { addFeedback, addIntervention, addSegmentStudent }
