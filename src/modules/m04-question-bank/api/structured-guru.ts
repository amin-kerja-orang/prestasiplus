/**
 * Teacher read mount of the structured questions (API-GUR-26, S6-T17): `GET /api/guru/structured-questions`
 * and `/:id`. Approved questions only in this round (`status=review` is wired and returns an empty page).
 * The types mirror the contract schemas `GuruStructuredRow`, `GuruStructuredDetail` and `GuruStructuredSub`; they
 * carry no admin-only field (source, compliance, visibility, createdBy, isActive, needsDiagram).
 */

import { api, type ListResult } from '@/api'

export type GuruStructuredStatus = 'approved' | 'review'

export interface GuruNamedRef {
  id: number
  name: string
}

export type GuruCognitiveLevel =
  'mengingat' | 'memahami' | 'mengaplikasi' | 'menganalisis' | 'menilai' | 'mencipta'

/** `GuruStructuredRow` of the contract (packages/contract/src/questions/schema.ts). */
export interface GuruStructuredRow {
  id: number
  /** Position in the full ordered list (1-based). */
  number: number
  textExcerpt: string
  level: GuruNamedRef | null
  subject: GuruNamedRef | null
  /** "LOTS 1", "LOTS 2", "MOTS 3", "HOTS 4" to "HOTS 6"; empty when there is no chip. */
  kbat: string
  subCount: number
  marks: number
  status: GuruStructuredStatus
}

/** `GuruStructuredSub`: no id (key by index); `marks` is 0 for a branch part. */
export interface GuruStructuredSubQuestion {
  partLabel: string
  questionText: string
  marks: number
  cognitiveLevel: GuruCognitiveLevel | null
  /** "Skema Jawapan". */
  modelAnswer: string
  depth: number
}

/** `GuruStructuredDetail`. */
export interface GuruStructuredDetail {
  id: number
  subject: GuruNamedRef | null
  level: GuruNamedRef | null
  kbat: string
  status: GuruStructuredStatus
  /** The stimulus text, shown once above all the sub-questions. */
  stimulus: string
  stimulusImage: string | null
  totalMarks: number
  subCount: number
  subQuestions: GuruStructuredSubQuestion[]
  createdAt: string
}

export interface GuruStructuredListQuery {
  subjectId?: number | string | null
  educationLevelId?: number | string | null
  status?: string | null
  page?: number
  signal?: AbortSignal
}

export const GURU_STRUCTURED_API = '/api/guru/structured-questions'

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
