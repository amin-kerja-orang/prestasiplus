/**
 * SRS M05 v1.17 §7 #9 `GET /api/practice/revision` (S6) and #10 `GET /api/practice/revision/:code`
 * (S7 guard). Any session (A). Counts are the viewer's eligible queued questions (BR-14, XL-19):
 * distinct questions, so S6, the S1 badge and the S7 guard agree.
 */

import { notFound, ok, requireAuth, route, type RouteDef } from '@/mock/define'

import { users } from '@/modules/m01-authentication/mock'

import type {
  RemedialCompletedSet,
  RemedialNeededSubject,
  RemedialSuggestions,
  RevisionOverview,
  RevisionSubject,
} from '../../api/types'
import { userAnswers, userHistory, userQueue } from '../repository/reads'
import { activeSubjectByCode, pct, practiceSubjects, subjectView, userIdOf } from './common'

const TARGET = 60

/**
 * API-PRAC-08 (S5-T07): pooled accuracy per subject (correct / answered over the pupil's answers, whole
 * number, half up) and the completed revision drills (newest 20; "Sebelum" = pooled accuracy of the answers
 * given before the drill started). Staff roles and a pupil with no answers get empty lists.
 */
function remedialSuggestions(userId: number): RemedialSuggestions {
  if (users.get(userId)?.role !== 'student') return { completed: [], needed: [] }
  const answers = userAnswers(userId).filter((a) => a.subjectId !== null)
  const subjects = practiceSubjects()

  const needed: RemedialNeededSubject[] = subjects.flatMap((s) => {
    const rows = answers.filter((a) => a.subjectId === s.id)
    if (rows.length === 0) return []
    const accuracy = Math.round(pct(rows.filter((a) => a.isCorrect).length, rows.length))
    // The drill needs at least one servable question: a wrong one in the queue or a bank question to top up.
    if (accuracy >= TARGET || (userQueue(userId, s.id).length === 0 && subjectView(s).bankCount <= 0)) return []
    return [
      { subjectCode: s.code, subjectName: s.name, answered: rows.length, accuracy, target: TARGET },
    ]
  })

  const drills = userHistory(userId, { modes: ['revision'] })
    .filter((d) => d.subjectId !== null)
    .sort((a, b) => a.completedAtMs - b.completedAtMs)
  const ordinal = new Map<number, number>()
  const completed: RemedialCompletedSet[] = drills.flatMap((d) => {
    const subject = subjects.find((s) => s.id === d.subjectId)
    if (!subject) return []
    const setNo = (ordinal.get(subject.id) ?? 0) + 1
    ordinal.set(subject.id, setNo)
    const startedMs = Date.parse(d.startedAt)
    const prior = answers.filter((a) => a.subjectId === subject.id && a.answeredAtMs < startedMs)
    // No earlier answer / no questions: that side is null, and so is the difference.
    const before =
      prior.length === 0
        ? null
        : Math.round(pct(prior.filter((a) => a.isCorrect).length, prior.length))
    const after = d.questionCount === 0 ? null : Math.round(pct(d.correctCount, d.questionCount))
    return [
      {
        subjectCode: subject.code,
        subjectName: subject.name,
        setNo,
        questionCount: d.questionCount,
        before,
        after,
        delta: before === null || after === null ? null : after - before,
        at: d.completedAt ?? d.startedAt,
      },
    ]
  })
  return { completed: completed.reverse().slice(0, 20), needed }
}

export const revisionRoutes: RouteDef[] = [
  route('GET', '/api/practice/remedial-suggestions', [requireAuth()], (req) =>
    ok(remedialSuggestions(userIdOf(req))),
  ),

  route('GET', '/api/practice/revision', [requireAuth()], (req) => {
    const queue = userQueue(userIdOf(req))
    const bySubject = new Map<number, number>()
    for (const q of queue) bySubject.set(q.subjectId, (bySubject.get(q.subjectId) ?? 0) + 1)
    const body: RevisionOverview = {
      total: queue.length,
      // BR-01 order; only subjects with queued questions (FR-M05-70).
      subjects: practiceSubjects().flatMap((s) => {
        const count = bySubject.get(s.id) ?? 0
        return count > 0
          ? [{ code: s.code, name: s.name, nameEn: s.nameEn, icon: s.icon, color: s.color, count }]
          : []
      }),
    }
    return ok(body)
  }),

  route('GET', '/api/practice/revision/:code', [requireAuth()], (req) => {
    const s = activeSubjectByCode(String(req.params.code))
    if (!s) return notFound()
    const body: RevisionSubject = {
      subject: { id: s.id, code: s.code, name: s.name, color: s.color },
      // 0 is a 200: S7 then goes back to S6 with the info flash (FR-M05-72).
      count: userQueue(userIdOf(req), s.id).length,
    }
    return ok(body)
  }),
]
