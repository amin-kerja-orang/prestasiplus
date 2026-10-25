/**
 * A blank question ready to type into (review page "Tambah soalan" and a new manual batch). The tag
 * is empty with no default (AC-04.1, AC-05.1) and there is no AI suggestion, so nothing is listed in
 * `lowFields`: the tag rule alone asks for the missing fields.
 */
import type { SubjectCode } from '../../../domain/types'
import { emptyTag } from '../../../domain/tag-edit'
import type { IntakeQuestion } from '../types'

export function blankQuestion(subject: SubjectCode, n: number, page = 1): IntakeQuestion {
  return {
    id: `q-${n}-${Date.now().toString(36)}`,
    label: String(n),
    type: 'short',
    stem: '',
    options: [],
    marks: 1,
    mode: 'short_text',
    parts: [],
    tag: emptyTag(subject),
    page,
    lowFields: [],
    confirmed: [],
  }
}

/** Next printed number for a batch: the highest numeric label plus one. */
export function nextLabel(questions: readonly IntakeQuestion[]): number {
  return questions.reduce((m, q) => Math.max(m, Number.parseInt(q.label, 10) || 0), 0) + 1
}
