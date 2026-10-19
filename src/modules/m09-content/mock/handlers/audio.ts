/**
 * SRS M09 v1.5 §7 #24 `GET /api/audio-kbat-sets` (S21), #25 `GET /api/audio-kbat-sets/:id` and
 * #26 `POST /api/audio-kbat-sets/:id/attempts` (provisional player, L-3). Logged in (U); only
 * `approved` sets are visible (FR-M09-74). #25 never returns the answers or the explanations.
 */

import {
  created,
  int,
  notFound,
  ok,
  queryInt,
  requireAuth,
  required,
  route,
  rule,
  unpaged,
  validate,
  type RouteDef,
} from '@/mock/define'

import { audioKbatRepo, M09Error } from '../repository'
import { QUESTION_COUNT } from '../repository/audio-support'
import type { AudioKbatSetRow } from '../types'
import {
  FIELD_INVALID,
  FIELD_REQUIRED,
  levelRef,
  refusal,
  requireViewer,
  subjectRef,
} from './common'

const listItem = (s: AudioKbatSetRow) => ({
  id: s.id,
  title: s.title,
  educationLevel: levelRef(s.educationLevelId) ?? { id: s.educationLevelId, name: '' },
  subject: subjectRef(s.subjectId) ?? { id: s.subjectId, name: '' },
})

/** INFERRED storage path of a section's audio file (no real storage in the prototype). */
const audioUrlOf = (setId: number, fileName: string | null): string | null =>
  fileName === null ? null : `/storage/audio-kbat/${String(setId)}/${fileName}`

function detailBody(set: AudioKbatSetRow) {
  return {
    id: set.id,
    title: set.title,
    instructions: set.instructions,
    sections: set.sections.map((section) => ({
      no: section.no,
      title: section.title,
      audioUrl: audioUrlOf(set.id, section.audioFileName),
      questions: set.questions
        .filter((q) => q.no >= section.questionFrom && q.no <= section.questionTo)
        .map((q) => ({
          no: q.no,
          questionText: q.questionText,
          options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD },
          marks: q.marks,
        })),
    })),
  }
}

const ATTEMPT_RULES = {
  answers: [
    required(),
    rule('answers', (value) => {
      if (!Array.isArray(value)) return FIELD_INVALID
      const seen = new Set<number>()
      for (const a of value as { no?: unknown; choice?: unknown }[]) {
        const no = typeof a?.no === 'number' ? a.no : NaN
        if (!Number.isInteger(no) || no < 1 || no > QUESTION_COUNT || seen.has(no))
          return FIELD_INVALID
        if (typeof a.choice !== 'string' || !['A', 'B', 'C', 'D'].includes(a.choice)) {
          return FIELD_INVALID
        }
        seen.add(no)
      }
      return null
    }),
  ],
}

export const audioRoutes: RouteDef[] = [
  route('GET', '/api/audio-kbat-sets', [requireAuth()], (req) => {
    const educationLevelId = queryInt(req.query, 'educationLevelId')
    const subjectId = queryInt(req.query, 'subjectId')
    const sets = audioKbatRepo.approved({
      ...(educationLevelId !== undefined ? { educationLevelId } : {}),
      ...(subjectId !== undefined ? { subjectId } : {}),
    })
    return unpaged(sets.map(listItem))
  }),

  route(
    'GET',
    '/api/audio-kbat-sets/:id',
    [requireAuth()],
    (req) => {
      const set = audioKbatRepo.get(Number(req.params.id))
      return set?.status === 'approved' ? ok(detailBody(set)) : notFound()
    },
    { params: { id: int() } },
  ),

  route(
    'POST',
    '/api/audio-kbat-sets/:id/attempts',
    [requireAuth()],
    (req) => {
      const id = Number(req.params.id)
      if (audioKbatRepo.get(id)?.status !== 'approved') return notFound()
      const invalid = validate(req.body, ATTEMPT_RULES, {
        messages: { required: FIELD_REQUIRED, answers: FIELD_INVALID },
      })
      if (invalid) return invalid
      const { answers } = req.body as {
        answers: { no: number; choice: 'A' | 'B' | 'C' | 'D' }[]
      }
      try {
        const attempt = audioKbatRepo.attempt(id, requireViewer(req).id, answers)
        return created({ score: attempt.score, totalMarks: attempt.totalMarks })
      } catch (error) {
        if (error instanceof M09Error) return refusal(error, 'answers')
        throw error
      }
    },
    { params: { id: int() } },
  ),
]
