/**
 * The class-1156 pupil's practice records (SRS M05 v1.17 §6.14.1 build note (f), XR-M02-06; M18 v1.8
 * XR-M18-21): user 4627 (M02 v1.26, school 8082, grade 11, class 1156 "5 CYBER") owns 3 completed
 * sessions with a session mean of 58.6 % (K01 2/5, K02 5/8, K03 11/15; the last on 15 Sep, his
 * `lastActiveAt`). They are M05 anchors: each replaces a generated session (and its answers replace
 * generated answers) in the 8082 cell of its week and window, so no total, cell or pin moves. The
 * questions are drawn from the M04 SPM pool of the session's subject (T5), as for the canonical
 * accounts; which answers are the correct ones is INFERRED (a seeded shuffle).
 *
 * The 19 mastery records (mean level 3.95) are stored counters, seeded in `seedPractice`.
 */

import { toIsoMyt } from '@/lib/time'
import { fnv1a32, mulberry32 } from '@/mock/determinism'
import { questions } from '@/modules/m04-question-bank/mock'

import { ANSWER_ID_START_1156, PUPIL_1156, SESSIONS_1156 } from '../datasets/m18-anchors'
import type { AnswerRow, SessionRow } from '../datasets/types'
import { completeAnswer, completeSession } from './anchors'

export function class1156Anchors(): { answers: AnswerRow[]; sessions: SessionRow[] } {
  const answers: AnswerRow[] = []
  const sessions: SessionRow[] = []
  let nextId = ANSWER_ID_START_1156
  for (const [id, subjectId, correct, total, completedAt, seconds] of SESSIONS_1156) {
    const rng = mulberry32(fnv1a32(`m05:class1156:${id}`))
    const rows = questions.spmPool({ subjectId }).sample(total, rng)
    if (rows.length < total) {
      throw new Error(
        `M05 class 1156: the SPM pool of subject ${String(subjectId)} has ${String(rows.length)} < ${String(total)} rows`,
      )
    }
    const order = Array.from({ length: total }, (_, i) => i)
    // The correct answers sit at seeded positions.
    const shuffle = mulberry32(fnv1a32(`m05:class1156:${id}:correct`))
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(shuffle.next() * (i + 1))
      ;[order[i], order[j]] = [order[j] as number, order[i] as number]
    }
    const right = new Set(order.slice(0, correct))
    const end = Date.parse(completedAt)
    const start = end - seconds * 1_000
    rows.forEach((q, i) => {
      const at = start + Math.round(((i + 1) * seconds) / total) * 1_000
      answers.push(
        completeAnswer(
          {
            id: nextId++,
            userId: PUPIL_1156,
            questionId: q.id,
            isCorrect: right.has(i),
            answeredAt: toIsoMyt(Math.min(at, end)),
            sessionId: id,
          },
          'M05',
        ),
      )
    })
    sessions.push(
      completeSession(
        {
          id,
          userId: PUPIL_1156,
          mode: 'random',
          completedAt,
          questionCount: total,
          correctCount: correct,
          subjectId,
          levelId: 11,
          timeSpent: seconds,
          questionIds: rows.map((q) => q.id),
        },
        'M05',
      ),
    )
  }
  return { answers, sessions }
}
