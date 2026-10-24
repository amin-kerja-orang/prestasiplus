/**
 * M04 objective-question endpoints (SRS v1.16 §7 #1–#8; build-plan M04-T1). Types and client
 * functions for S1 (list), S2 (create), S3 (detail, AI explanation), S4 (edit) and the bulk and
 * delete actions. Every call needs an admin session. UI tasks read this file and do not change it
 * (build-plan §S.3 rule 5).
 *
 * Mutations resolve to `{data, status}`: `status` is the flash text (UNVERIFIED COPY, SRS §8), so
 * the screen shows it as the green alert and never invents its own. A validation failure rejects
 * with an `ApiError` (`422`, `fields` keyed by the camelCase input names) whose `message` is the
 * first message plus the count of the others, so a screen can list every message in one alert.
 * An unknown id rejects with a `404` `ApiError` (the screen shows the standard 404 page).
 */

import { api, isHttpMode, wireId, type ListResult } from '@/api'

export type QuestionStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'archived'
  /** v2 wire lifecycle codes (BE-09 / D54a), received in http mode only. */
  | 'review'
  | 'published'
  /** PKSK rows only (M07 BR-M07-02). */
  | 'pending'
export type QuestionType = 'mcq' | 'true_false' | 'short_answer' | 'fill_blank' | 'essay'
export type ComplianceStatus = 'verified' | 'pending_mapping' | 'quarantined' | 'rejected' | 'draft'
export type SourceType = 'textbook' | 'dskp' | 'trial' | 'marking_scheme' | 'ai_generated'
export type ScriptType = 'rumi' | 'arab' | 'jawi' | 'mixed'
export type TextDirection = 'ltr' | 'rtl'
export type QuestionLanguage = 'bm' | 'en'
export type BulkAction = 'approve' | 'reject' | 'archive' | 'delete' | 'pending_review' | 'publish'

/**
 * http mode only (BE-09 `QuestionStatus`, BE-09 bulk actions): the mock vocabulary of the filter and
 * the workflow actions mapped to the v2 wire codes (filter: approved stays `approved`, `published` is its own option). A value not listed has no 1:1 wire equivalent (`rejected`, `reject`).
 */
export const STATUS_FILTER_TO_WIRE: Readonly<Record<string, string>> = {
  draft: 'draft',
  pending_review: 'review',
  approved: 'approved',
  published: 'published',
  archived: 'archived',
}
export const BULK_ACTION_TO_WIRE: Readonly<Record<string, string>> = {
  pending_review: 'review',
  approve: 'approved',
  publish: 'published',
  archive: 'archived',
  delete: 'delete',
}
/** Mock values with no wire equivalent; hidden from the UI in http mode. */
export const NO_WIRE_STATUS_FILTERS: readonly string[] = ['rejected']
/** http mode only: the wire status an action should leave a question in (gate check target). */
const BULK_TARGET_STATUS: Readonly<Record<string, string>> = {
  pending_review: 'review',
  approve: 'approved',
  publish: 'published',
  archive: 'archived',
}
export const NO_WIRE_BULK_ACTIONS: readonly string[] = ['reject']

const wire = (map: Readonly<Record<string, string>>, v: string): string =>
  (Object.hasOwn(map, v) ? map[v] : undefined) ?? v

/** `{id, name}` of a subject or an education level (M03). */
export interface NamedRef {
  id: number
  name: string
}

/** #1 row (`QuestionRow`, SRS §7). `level` is `null` for the 9 legacy rows without a level. */
export interface QuestionRow {
  id: number
  questionText: string
  subject: NamedRef | null
  level: NamedRef | null
  difficultyLevel: number
  status: QuestionStatus
  isActive: boolean
  complianceStatus: ComplianceStatus
  aiVerified: boolean
  dskpTagged: boolean
  sourceType: SourceType | null
  sourceFile: string | null
}

export interface QuestionListQuery {
  subjectId?: number | string | null
  educationLevelId?: number | string | null
  difficultyLevel?: number | string | null
  status?: string | null
  dskpFilter?: string | null
  complianceFilter?: string | null
  sourceFilter?: string | null
  search?: string | null
  page?: number
  /** Rows per page (v2 admin list; the server caps it at 100). */
  pageSize?: number | null
  signal?: AbortSignal
}

/** #2 tile: `icon` is the live Font Awesome class of the S1 tile (SRS §6.10). */
export interface QuestionSummarySubject {
  id: number
  name: string
  icon: string | null
  group: 'teras' | 'elektif'
  total: number
  approved: number
}

export interface QuestionSummary {
  total: number
  subjects: QuestionSummarySubject[]
}

export interface AiExplanation {
  markdown: string
  generatedAt: string
}

export interface PkskOption {
  text: string
  isCorrect: boolean
}

/** DATA-M04-01 as the API returns it (the internal count facets stay in the store). */
export interface Question {
  id: number
  subjectId: number | null
  educationLevelId: number | null
  difficultyLevel: number
  questionType: QuestionType
  questionText: string
  questionImage: string | null
  /** MCQ: 4 strings ("" allowed for C/D from an import); `null` for the other types and PKSK rows. */
  options: string[] | null
  optionImages: (string | null)[]
  correctAnswer: number | null
  tfAnswer: boolean | null
  correctAnswerText: string | null
  altAnswers: string[]
  modelAnswer: string | null
  explanation: string | null
  aiExplanation: AiExplanation | null
  language: QuestionLanguage
  pointsValue: number
  status: QuestionStatus
  isActive: boolean
  complianceStatus: ComplianceStatus
  aiVerified: boolean
  sourceType: SourceType | null
  sourceFile: string | null
  sourcePage: number | null
  sourceSet: string | null
  qualityScore: number | null
  needsDiagram: boolean
  spmPool: boolean
  dskpSpId: number | null
  curriculumChapterId: number | null
  curriculumTopicId: number | null
  chapterLabel: string | null
  scriptType: ScriptType
  textDirection: TextDirection
  pkskDomainId: number | null
  pkskTargetLevel: 'T1' | 'T4' | null
  pkskOptions: PkskOption[] | null
  /** User id of the creator (`createdBy{name}` is on the detail). */
  createdBy: number
  createdAt: string
  updatedAt: string
  usage: { attempts: number; correct: number }
}

export interface DskpBidangRef {
  id: number
  code: string | null
  name: string
}
export interface DskpSkRef {
  id: number
  code: string
  description: string
}
export interface DskpSpRef {
  id: number
  code: string
  description: string
}

/** #4 `data`: the question with its names, the DSKP chain and the creator. */
export interface QuestionDetail extends Omit<Question, 'createdBy'> {
  subject: NamedRef | null
  level: NamedRef | null
  /** `null` when the question is not DSKP-tagged. */
  dskp: { bidang: DskpBidangRef; sk: DskpSkRef; sp: DskpSpRef } | null
  /** `name` is `null` when the creator is not in the users store (INFERRED). */
  createdBy: { id: number; name: string | null }
}

/** A mutation result: the data plus the flash text (UNVERIFIED COPY, SRS §8). */
export interface QuestionMutation<T> {
  data: T
  status: string
}

/**
 * #3 / #5 body (SRS §5). Numbers may be given as digits (form values). On edit (#5) the whole
 * form is posted (`questionType` is not); an absent `dskpSpId` keeps the saved SP, `''` or `null`
 * clears it (S4 "Buang tag DSKP"); an absent image keeps the saved one.
 */
export interface QuestionInputBody {
  subjectId: number | string | null
  educationLevelId: number | string | null
  difficultyLevel: number | string | null
  /** Create only (a saved question keeps its type). */
  questionType?: QuestionType
  questionText: string
  dskpSpId?: number | string | null
  questionImage?: File | Blob | null
  /** MCQ: 4 texts A–D. */
  options?: readonly string[]
  /** MCQ: up to 4 option pictures, by index. */
  optionImages?: readonly (File | Blob | null | undefined)[]
  /** MCQ: 0–3 (digits allowed). */
  correctAnswer?: number | string | null
  /** True/false: `true`, `false`, or `null` (no answer chosen, as live). */
  tfAnswer?: boolean | null
  correctAnswerText?: string | null
  /** A comma list, or the items. */
  altAnswers?: string | readonly string[] | null
  modelAnswer?: string | null
  explanation?: string | null
  language?: QuestionLanguage
  pointsValue?: number | string | null
  /** Edit only: remove the saved question image / option image `i`. */
  removeQuestionImage?: boolean
  removeOptionImage?: readonly boolean[]
}

/** #3 / #5 as multipart (the images are files); keys as in SRS §7 (`options[0]`, `optionImages[0]` …). */
export function toQuestionFormData(input: QuestionInputBody): FormData {
  const form = new FormData()
  const put = (key: string, value: string | number | boolean | null | undefined) => {
    if (value === undefined) return
    if (value === null) form.append(key, '')
    else if (typeof value === 'boolean') form.append(key, value ? 'true' : 'false')
    else form.append(key, String(value))
  }
  put('subjectId', input.subjectId)
  put('educationLevelId', input.educationLevelId)
  put('difficultyLevel', input.difficultyLevel)
  put('questionType', input.questionType)
  put('questionText', input.questionText)
  put('dskpSpId', input.dskpSpId)
  if (input.questionImage) form.append('questionImage', input.questionImage)
  input.options?.forEach((text, i) => {
    form.append(`options[${String(i)}]`, text)
  })
  input.optionImages?.forEach((file, i) => {
    if (file) form.append(`optionImages[${String(i)}]`, file)
  })
  put('correctAnswer', input.correctAnswer)
  put('tfAnswer', input.tfAnswer)
  put('correctAnswerText', input.correctAnswerText)
  if (input.altAnswers !== undefined) {
    const alt = input.altAnswers
    put('altAnswers', alt === null ? null : typeof alt === 'string' ? alt : alt.join(','))
  }
  put('modelAnswer', input.modelAnswer)
  put('explanation', input.explanation)
  put('language', input.language)
  put('pointsValue', input.pointsValue)
  if (input.removeQuestionImage) form.append('removeQuestionImage', '1')
  input.removeOptionImage?.forEach((remove, i) => {
    if (remove) form.append(`removeOptionImage[${String(i)}]`, '1')
  })
  return form
}

/** #1 `GET /api/questions`: 20 per page, newest first; PKSK rows never included. */
export function fetchQuestions(query: QuestionListQuery = {}): Promise<ListResult<QuestionRow>> {
  return api.list<QuestionRow>('/api/questions', {
    query: {
      subjectId: query.subjectId ?? null,
      educationLevelId: query.educationLevelId ?? null,
      difficultyLevel: query.difficultyLevel ?? null,
      status:
        query.status && isHttpMode() ? wire(STATUS_FILTER_TO_WIRE, query.status) : (query.status ?? null),
      dskpFilter: query.dskpFilter ?? null,
      complianceFilter: query.complianceFilter ?? null,
      sourceFilter: query.sourceFilter ?? null,
      search: query.search ?? null,
      page: query.page ?? null,
      pageSize: query.pageSize ?? null,
    },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #2 `GET /api/questions/summary`: the S1 "Jumlah" and the 31 subject tiles. */
export function fetchQuestionSummary(
  options: { signal?: AbortSignal } = {},
): Promise<QuestionSummary> {
  return api.get<QuestionSummary>(
    '/api/questions/summary',
    options.signal ? { signal: options.signal } : {},
  )
}

/** #3 `POST /api/questions` (201; 422 with `fields`). */
export function createQuestion(input: QuestionInputBody): Promise<QuestionMutation<Question>> {
  return api.post<QuestionMutation<Question>>('/api/questions', {
    body: toQuestionFormData(input),
    raw: true,
  })
}

/** #4 `GET /api/questions/:id` (a PKSK row is included; 404 for an unknown id). */
export function fetchQuestion(
  id: number,
  options: { signal?: AbortSignal } = {},
): Promise<QuestionDetail> {
  return api.get<QuestionDetail>(
    `/api/questions/${String(id)}`,
    options.signal ? { signal: options.signal } : {},
  )
}

/** #5 `PUT /api/questions/:id` (404; 422). Sent as multipart, as the live form. */
export function updateQuestion(
  id: number,
  input: QuestionInputBody,
): Promise<QuestionMutation<Question>> {
  return api.put<QuestionMutation<Question>>(`/api/questions/${String(id)}`, {
    body: toQuestionFormData(input),
    raw: true,
  })
}

/** #6 `DELETE /api/questions/:id` (permanent; 404). */
export function deleteQuestion(id: number): Promise<QuestionMutation<{ deleted: number }>> {
  return api.delete<QuestionMutation<{ deleted: number }>>(`/api/questions/${String(id)}`, {
    raw: true,
  })
}

/**
 * #7 `POST /api/questions/bulk-action` (422 when no action or no ids).
 *
 * http mode: the API answers only `{affected}` and silently leaves an id untouched when its transition
 * is refused or the publish/approve gate fails (BE-09 `bulkAction`, 2f3b8311); it returns no per-id
 * reason. So when `affected` is below the number of distinct ids, each id is re-read and the ones not in
 * the target status come back in `notUpdated` for the screen to list one by one. Mock mode: never set.
 */
export async function bulkQuestionAction(
  action: BulkAction,
  ids: readonly number[],
): Promise<QuestionMutation<{ affected: number }> & { notUpdated?: number[] }> {
  const http = isHttpMode()
  const result = await api.post<QuestionMutation<{ affected: number }>>(
    '/api/questions/bulk-action',
    {
      // `ids` are strings on the wire in http mode (`ids: string[]`; a number is 422); mock keeps the numbers.
      body: {
        action: http ? wire(BULK_ACTION_TO_WIRE, action) : action,
        ids: ids.map((id) => wireId(id)),
      },
      raw: true,
    },
  )
  const target = BULK_TARGET_STATUS[action]
  const distinct = [...new Set(ids)]
  if (!http || target === undefined || result.data.affected >= distinct.length) return result
  const notUpdated: number[] = []
  for (const id of distinct) {
    try {
      if ((await fetchQuestion(id)).status !== target) notUpdated.push(id)
    } catch {
      notUpdated.push(id)
    }
  }
  return { ...result, notUpdated }
}

/**
 * #8 `POST /api/questions/:id/ai-explanation`. Resolves for every HTTP status with
 * `{status, headers, body}` (`api.raw`), because the card reads the reply exactly as the live script
 * does (FR-M04-46): JSON with `message`, JSON without one ("HTTP {status}"), a non-JSON body (the
 * caller parses it) or, for a network failure, a rejected `ApiError` (`NETWORK_ERROR`).
 * Success is HTTP 200 `{ok: true, message}`.
 */
export function generateAiExplanation(
  id: number,
  options: { force?: boolean; signal?: AbortSignal } = {},
): Promise<{ status: number; headers: Record<string, string>; body: unknown }> {
  return api.raw('POST', `/api/questions/${String(id)}/ai-explanation`, undefined, {
    ...(options.force ? { query: { force: 1 } } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  })
}
