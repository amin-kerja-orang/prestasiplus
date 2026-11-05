/**
 * "Soalan & Rujukan" form values, validation and the API-GUR-24 request body (PRD-20 R1-GUR-44a; FR-GUR-44a-2, -3, -7, -8).
 * Pure, so it is unit tested. The DSKP rule (Bab, SP, TP, Aras only where they exist, D112) is the shared `dskp-rule.ts`
 * of "Tambah Soalan" (S6-T06).
 */
import type { PersonalQuestion, PersonalQuestionRequest } from '../../api/personal-questions-types'
import { parseTp, validateDskp, type DskpContext, type DskpField } from '../soalan/dskp-rule'

export interface RujukanValues {
  subjectId: string
  levelId: string
  chapterId: string
  /** The single SP of the select (sent as a one-element `spIds`). */
  spId: string
  tp: string
  cognitiveLevel: string
  /** Kesukaran 1 to 5 as text; '' = not chosen. */
  difficulty: string
  text: string
  referenceUrl: string
  options: string[]
  /** The radio: `null` = none ticked. */
  correct: number | null
}

export function emptyValues(): RujukanValues {
  return {
    subjectId: '',
    levelId: '',
    chapterId: '',
    spId: '',
    tp: '',
    cognitiveLevel: '',
    difficulty: '',
    text: '',
    referenceUrl: '',
    options: ['', '', '', ''],
    correct: null,
  }
}

/** The saved question as form values (the edit page). */
export function valuesOf(q: PersonalQuestion): RujukanValues {
  return {
    subjectId: String(q.subjectId),
    levelId: String(q.educationLevelId),
    chapterId: q.chapterId === null ? '' : String(q.chapterId),
    spId: q.spIds[0] === undefined ? '' : String(q.spIds[0]),
    tp: q.tp === null ? '' : String(q.tp),
    cognitiveLevel: q.cognitiveLevel ?? '',
    difficulty: q.difficulty >= 1 && q.difficulty <= 5 ? String(q.difficulty) : '',
    text: q.text,
    referenceUrl: q.referenceUrl ?? '',
    options: Array.from({ length: 4 }, (_, i) => q.options[i]?.text ?? ''),
    correct: q.correctIndex,
  }
}

/** The API-GUR-24 body; only the DSKP fields that were chosen and a non-empty link are sent. */
export function buildBody(v: RujukanValues): PersonalQuestionRequest {
  const body: PersonalQuestionRequest = {
    subjectId: Number(v.subjectId),
    educationLevelId: Number(v.levelId),
    difficulty: Number(v.difficulty),
    text: v.text.trim(),
    options: v.options.map((o) => ({ text: o.trim() })),
    correctIndex: v.correct ?? 0,
  }
  if (v.chapterId !== '') body.chapterId = Number(v.chapterId)
  if (v.spId !== '') body.spIds = [Number(v.spId)]
  const tp = parseTp(v.tp)
  if (tp !== null) body.tp = tp
  if (v.cognitiveLevel !== '') body.cognitiveLevel = v.cognitiveLevel
  const link = v.referenceUrl.trim()
  if (link !== '') body.referenceUrl = link
  return body
}

/** The exact BM texts of the PRD 44a field table. */
export const RUJUKAN_MESSAGES = {
  subject: 'Sila pilih subjek.',
  level: 'Sila pilih tingkatan.',
  difficulty: 'Sila pilih kesukaran.',
  text: 'Sila isi teks soalan.',
  textLong: 'Teks soalan tidak boleh melebihi 2000 aksara.',
  url: 'Pautan mesti bermula dengan http:// atau https://.',
  urlLong: 'Pautan tidak boleh melebihi 2048 aksara.',
  option: (letter: string): string => `Sila isi pilihan ${letter}.`,
  optionLong: (letter: string): string => `Pilihan ${letter} tidak boleh melebihi 500 aksara.`,
  correct: 'Sila tanda satu jawapan yang betul.',
} as const

/** Wire field names of the errors (the keys of the server `fields`). */
export type RujukanField =
  | 'subjectId'
  | 'educationLevelId'
  | DskpField
  | 'difficulty'
  | 'text'
  | 'referenceUrl'
  | 'options'
  | 'correctIndex'

const len = (text: string): number => [...text].length
const LETTERS = ['A', 'B', 'C', 'D'] as const
export const URL_MAX = 2048

/** Whether a link is an http or https address (`javascript:`, `ftp:` and the like are refused). */
export function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false
  try {
    const u = new URL(value)
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== ''
  } catch {
    return false
  }
}

/** Field errors of the whole form, in form order (`{}` = valid). The first error of the options is shown under them. */
export function validateForm(
  v: RujukanValues,
  ctx: DskpContext,
): Partial<Record<RujukanField, string>> {
  const e: Partial<Record<RujukanField, string>> = {}
  if (v.subjectId === '') e.subjectId = RUJUKAN_MESSAGES.subject
  if (v.levelId === '') e.educationLevelId = RUJUKAN_MESSAGES.level
  Object.assign(
    e,
    validateDskp(
      {
        chapterId: v.chapterId,
        spIds: v.spId === '' ? [] : [v.spId],
        tp: v.tp,
        cognitiveLevel: v.cognitiveLevel,
      },
      ctx,
    ),
  )
  if (v.difficulty === '') e.difficulty = RUJUKAN_MESSAGES.difficulty
  const text = v.text.trim()
  if (text === '') e.text = RUJUKAN_MESSAGES.text
  else if (len(text) > 2000) e.text = RUJUKAN_MESSAGES.textLong
  const link = v.referenceUrl.trim()
  if (link !== '') {
    if (len(link) > URL_MAX) e.referenceUrl = RUJUKAN_MESSAGES.urlLong
    else if (!isHttpUrl(link)) e.referenceUrl = RUJUKAN_MESSAGES.url
  }
  for (const [i, letter] of LETTERS.entries()) {
    const option = (v.options[i] ?? '').trim()
    if (option === '') e.options ??= RUJUKAN_MESSAGES.option(letter)
    else if (len(option) > 500) e.options ??= RUJUKAN_MESSAGES.optionLong(letter)
  }
  if (v.correct === null) e.correctIndex = RUJUKAN_MESSAGES.correct
  return e
}

/** Excerpt of the list column "Teks": the first 120 characters, "…" after a cut. */
export function excerpt(text: string, max = 120): string {
  const chars = [...text]
  return chars.length <= max ? text : `${chars.slice(0, max).join('')}…`
}
