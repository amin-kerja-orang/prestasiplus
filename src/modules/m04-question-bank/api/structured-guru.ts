/**
 * Teacher read mount of the structured questions (API-GUR-26, S6-T17): `GET /api/guru/structured-questions`
 * and `/:id`. Approved questions only in this round (`status=review` is wired and returns an empty page).
 * The row and detail shapes are FE-local until the contract schemas land with the read-be part; they
 * carry no admin-only field (source, compliance, visibility, createdBy, isActive, needsDiagram).
 */

import { api, type ListResult } from '@/api'

export type GuruStructuredStatus = 'approved' | 'review' | 'rejected'

/** A name that the wire may send as text or as `{ id, name }`. */
export type GuruNamed = string | { id?: number; name: string } | null

export interface GuruStructuredRow {
  id: number
  /** Position in the full ordered list (1-based). */
  number: number
  textExcerpt: string
  level: GuruNamed
  subject: GuruNamed
  /** The KBAT chip text, e.g. "MOTS 3". */
  kbat: string
  subCount: number
  marks: number
  status: GuruStructuredStatus
}

export interface GuruStructuredSubQuestion {
  id: number
  partLabel: string
  questionText: string
  marks: number
  cognitiveLevel?: string | null
  /** "Skema Jawapan". */
  modelAnswer: string
}

export interface GuruStructuredDetail {
  id: number
  subject: GuruNamed
  level: GuruNamed
  kbat: string
  status: GuruStructuredStatus
  totalMarks: number
  /** The stimulus text, shown once above all the sub-questions. */
  stimulus: string
  stimulusImage?: string | null
  subQuestions: GuruStructuredSubQuestion[]
}

export interface GuruStructuredListQuery {
  subjectId?: number | string | null
  educationLevelId?: number | string | null
  status?: string | null
  page?: number
  signal?: AbortSignal
}

export const GURU_STRUCTURED_API = '/api/guru/structured-questions'

/** The display text of a name field. */
export function namedText(value: GuruNamed | undefined): string {
  if (value == null) return ''
  return typeof value === 'string' ? value : value.name
}

/** API-GUR-26 list: 20 per page, newest first. */
export function fetchGuruStructuredQuestions(
  query: GuruStructuredListQuery = {},
): Promise<ListResult<GuruStructuredRow, Record<string, never>>> {
  return api.list<GuruStructuredRow, Record<string, never>>(GURU_STRUCTURED_API, {
    query: {
      subjectId: query.subjectId ?? null,
      educationLevelId: query.educationLevelId ?? null,
      status: query.status ?? null,
      page: query.page ?? null,
    },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** API-GUR-26 detail (404 for an unknown, unapproved or foreign id). */
export function fetchGuruStructuredQuestion(
  id: number,
  options: { signal?: AbortSignal } = {},
): Promise<GuruStructuredDetail> {
  return api.get<GuruStructuredDetail>(
    `${GURU_STRUCTURED_API}/${String(id)}`,
    options.signal ? { signal: options.signal } : {},
  )
}
