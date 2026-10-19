/**
 * M04 structured-question admin endpoints (SRS §7 #18–#19; build-plan M04-T2): S8 list and S9
 * detail. Every call needs an admin session. UI tasks read this file and do not change it
 * (build-plan §S.3 rule 5). Student practice reads the same store through M05 (XL-24).
 */

import { api, type ListResult } from '@/api'

export interface StructuredRef {
  id: number
  name: string
}

/** #18 row. `stimulusExcerpt` is the stimulus cut at 100 characters + "..." (INFERRED). */
export interface StructuredRow {
  id: number
  stimulusExcerpt: string
  subject: StructuredRef | null
  level: StructuredRef | null
  kbatLevel: number
  totalMarks: number
  subCount: number
}

/** `meta.stats` of #18: over the whole store, not affected by the filters. */
export interface StructuredListMeta {
  stats: {
    total: number
    published: number
    /** Alphabetical by name, subjects with at least one question. */
    bySubject: { name: string; count: number }[]
  }
}

export interface StructuredListQuery {
  subjectId?: number | string | null
  educationLevelId?: number | string | null
  kbatLevel?: number | string | null
  page?: number
  signal?: AbortSignal
}

export type StructuredRubric = { konstruk: string; keyword: string; marks: number }

/** DATA-M04-03. */
export interface StructuredSubQuestion {
  id: number
  structuredQuestionId: number
  partLabel: string
  questionText: string
  marks: number
  answerType: 'text' | 'numeric'
  expectedNumeric: number | null
  numericTolerance: number | null
  rubrics: StructuredRubric[]
  modelAnswer: string
  parentSubId: number | null
  order: number
}

/** #19 `data`: DATA-M04-02 with its sub-questions and the resolved names. */
export interface StructuredDetail {
  id: number
  subjectId: number
  educationLevelId: number
  subject: StructuredRef | null
  level: StructuredRef | null
  kbatLevel: number
  status: 'published' | 'draft'
  isActive: boolean
  needsDiagram: boolean
  estimatedMinutes: number
  isTrial: boolean
  topic: string | null
  questionNumber: number | null
  stimulus: string
  stimulusImage: string | null
  totalMarks: number
  visibility: 'public'
  complianceStatus: string
  sourceFile: string | null
  sourcePage: number | null
  sourceSet: string | null
  curriculumChapterId: number | null
  curriculumTopicId: number | null
  dskpSpId: number | null
  scriptType: string
  textDirection: string
  questionTemplate: 'eksperimen' | null
  /** In `order`. */
  subQuestions: StructuredSubQuestion[]
  createdBy: { id: number; name: string | null }
  createdAt: string
  updatedAt: string
}

/** #18 `GET /api/structured-questions`: 25 per page, BR-M04-26 order. */
export function fetchStructuredQuestions(
  query: StructuredListQuery = {},
): Promise<ListResult<StructuredRow, StructuredListMeta>> {
  return api.list<StructuredRow, StructuredListMeta>('/api/structured-questions', {
    query: {
      subjectId: query.subjectId ?? null,
      educationLevelId: query.educationLevelId ?? null,
      kbatLevel: query.kbatLevel ?? null,
      page: query.page ?? null,
    },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #19 `GET /api/structured-questions/:id` (404 for an unknown id). */
export function fetchStructuredQuestion(
  id: number,
  options: { signal?: AbortSignal } = {},
): Promise<StructuredDetail> {
  return api.get<StructuredDetail>(
    `/api/structured-questions/${String(id)}`,
    options.signal ? { signal: options.signal } : {},
  )
}
