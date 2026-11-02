/**
 * Admin Studio endpoints (R1-F03b, T13). Stimuli and groups are the stimulus API (T32): `/api/stimuli`, `/api/stimulus-groups*`.
 * The DSKP picker (`/api/questions/studio/dskp`) is T13's (the intake figure link lives in m28's intake client). Studio talks to the real API only
 * (`VITE_API_MODE=http`, D84); `studioAvailable()` tells a page to say so. Ids are opaque strings. Mutations resolve to
 * `{data, status}` where `status` is the server's flash text.
 */
import {
  QuestionEditAsDraftResultSchema,
  type ErrorBody,
  type QuestionGateCheck,
  type ServabilityBatchResult,
  type ServabilityReport,
  type StimulusCreateRequest,
  type StimulusUpdateRequest,
  type StudioDskp,
} from '@pp/contract'

import { api, isApiError, isHttpMode, uploadQuestionImage, type ListResult } from '@/api'

import { hydrate, type WireQuestion } from '../lib/studio/draft'
import type { WireStimulus } from '../lib/studio/stimulus'

export type { StudioDskp }

export const studioAvailable = (): boolean => isHttpMode()
export const STUDIO_UNAVAILABLE = 'Studio hanya tersedia apabila sistem disambungkan ke pelayan sebenar.'

export interface Flash<T> {
  data: T
  status: string
}

/** `StimulusGroupMember` of T49. */
export interface GroupMemberSummary {
  id: string
  numberLabel: string | null
  stem: string
  status: 'draft' | 'review' | 'approved' | 'archived'
  servable: boolean
}

/** `StimulusGroupDetail` of T32. */
export interface GroupDetail {
  id: string
  label: string | null
  scope: 'section' | 'paper'
  stimuli: WireStimulus[]
  questionIds: string[]
  /** T49: the members in published order, one short form each (no per-question reads). */
  members: GroupMemberSummary[]
  /** D93: BM warning while the group has fewer than 2 questions; null otherwise. */
  warning?: string | null | undefined
}

export function fetchStudioDskp(subjectId: string, educationLevelId: string, signal?: AbortSignal): Promise<StudioDskp> {
  return api.get<StudioDskp>('/api/questions/studio/dskp', { query: { subjectId, educationLevelId }, ...(signal ? { signal } : {}) })
}

/** One row of `GET /api/stimulus-groups` (T49). */
export interface GroupListRow {
  id: string
  label: string | null
  scope: 'section' | 'paper'
  stimuli: { id: string; kind: string; label: string; imageId: string | null }[]
  memberCount: number
  members: GroupMemberSummary[]
  status: 'draft' | 'served'
  warning: string | null
}

export interface GroupListQuery {
  q?: string | null
  subjectId?: string | null
  status?: 'draft' | 'served' | null
  page?: number
  pageSize?: number
  signal?: AbortSignal
}

/** Browses the existing groups (T49, Admin Pusat): newest first, one page, members in short form. */
export function listGroups(query: GroupListQuery = {}): Promise<ListResult<GroupListRow>> {
  return api.list<GroupListRow>('/api/stimulus-groups', {
    query: { q: query.q ?? null, subjectId: query.subjectId ?? null, status: query.status ?? null, page: query.page ?? null, pageSize: query.pageSize ?? null },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/* ---- stimuli (T32) ------------------------------------------------------------------------------------ */

export const createStimulus = (body: StimulusCreateRequest): Promise<Flash<WireStimulus>> =>
  api.post<Flash<WireStimulus>>('/api/stimuli', { body, raw: true })

export const updateStimulus = (id: string, body: StimulusUpdateRequest): Promise<Flash<WireStimulus>> =>
  api.put<Flash<WireStimulus>>(`/api/stimuli/${id}`, { body, raw: true })

/* ---- groups (T32, D90) -------------------------------------------------------------------------------- */

export const fetchGroup = (id: string, signal?: AbortSignal): Promise<GroupDetail> =>
  api.get<GroupDetail>(`/api/stimulus-groups/${id}`, signal ? { signal } : {})

export const createGroup = (body: { label?: string | null; stimulusIds: string[]; questionIds?: string[] }): Promise<Flash<GroupDetail>> =>
  api.post<Flash<GroupDetail>>('/api/stimulus-groups', { body, raw: true })

export const setGroupStimuli = (id: string, stimulusIds: string[]): Promise<Flash<GroupDetail>> =>
  api.put<Flash<GroupDetail>>(`/api/stimulus-groups/${id}`, { body: { stimulusIds }, raw: true })

export const dissolveGroup = (id: string): Promise<Flash<{ deleted: 1; releasedQuestionIds: string[] }>> =>
  api.delete<Flash<{ deleted: 1; releasedQuestionIds: string[] }>>(`/api/stimulus-groups/${id}`, { raw: true })

export const addGroupMember = (id: string, questionId: string): Promise<Flash<GroupDetail>> =>
  api.post<Flash<GroupDetail>>(`/api/stimulus-groups/${id}/members`, { body: { questionId }, raw: true })

export const removeGroupMember = (id: string, questionId: string): Promise<Flash<{ group: GroupDetail; warning: string | null }>> =>
  api.delete<Flash<{ group: GroupDetail; warning: string | null }>>(`/api/stimulus-groups/${id}/members/${questionId}`, { raw: true })

/** The complete ordered member list in one atomic call (adds, removals and order); a served member keeps its place (409 otherwise). */
export const setGroupMembers = (id: string, questionIds: string[]): Promise<Flash<GroupDetail>> =>
  api.put<Flash<GroupDetail>>(`/api/stimulus-groups/${id}/members`, { body: { questionIds }, raw: true })

export const reorderGroupMembers = (id: string, questionIds: string[]): Promise<Flash<GroupDetail>> =>
  api.put<Flash<GroupDetail>>(`/api/stimulus-groups/${id}/members/order`, { body: { questionIds }, raw: true })

/** Creates a question directly inside a group (appended at the end). */
export const createQuestionInGroup = (id: string, body: Record<string, unknown>): Promise<Flash<StudioQuestionDetail>> =>
  api.post<Flash<StudioQuestionDetail>>(`/api/stimulus-groups/${id}/questions`, { body, raw: true })

/* ---- questions ---------------------------------------------------------------------------------------- */

export interface StudioQuestionDetail extends WireQuestion {
  id: string
  status: string
}

export const fetchStudioQuestion = (id: string, signal?: AbortSignal): Promise<StudioQuestionDetail> =>
  api.get<StudioQuestionDetail>(`/api/questions/${id}`, signal ? { signal } : {})

export const createStudioQuestion = (body: Record<string, unknown>): Promise<Flash<StudioQuestionDetail>> =>
  api.post<Flash<StudioQuestionDetail>>('/api/questions', { body, raw: true })

export const updateStudioQuestion = (id: string, body: Record<string, unknown>): Promise<Flash<StudioQuestionDetail>> =>
  api.put<Flash<StudioQuestionDetail>>(`/api/questions/${id}`, { body, raw: true })

export interface QuestionPick {
  id: string
  questionText: string
}

/** Finds questions to put in a group (admin list search; the server caps the page size). */
export function searchQuestions(search: string, signal?: AbortSignal): Promise<ListResult<QuestionPick>> {
  return api.list<QuestionPick>('/api/questions', { query: { search, pageSize: 10 }, ...(signal ? { signal } : {}) })
}

/** Uploads one picture (`purpose=question_image`) and returns its public token; failures are 422 under `fieldKey`. */
export const uploadStudioImage = (file: Blob, fieldKey: string): Promise<string> => uploadQuestionImage(file, fieldKey)

/* ---- Studio list, lifecycle and "Dilihat murid di" (R1-F03a, T13 unit 2b) ------------------------------ */

/** One row of `GET /api/questions` as the Studio list reads it (ids are opaque strings). */
export interface StudioRow {
  id: string
  questionText: string
  subject: { id: string; name: string } | null
  level: { id: string; name: string } | null
  status: string
  isActive: boolean
  dskpComplete?: boolean | undefined
  sourceType: string | null
  sourceFile: string | null
  /** REQ-C-010: V2 columns "Kertas" ('1' to '3') and "No." (printed number label); absent or null on an older server. */
  kertas?: string | null | undefined
  numberLabel?: string | null | undefined
}

/** `meta.counts`: the questions per lifecycle status under the current filters, status itself left out (the four tiles). */
export interface StudioListExtra {
  counts?: Partial<Record<'draft' | 'review' | 'approved' | 'archived', number>>
}

export interface StudioListQuery {
  subjectId?: string | null
  status?: string | null
  search?: string | null
  /** Filters on the source paper (T47): year, state or examining body, paper 1 to 3, exam type. */
  tahun?: string | null
  negeri?: string | null
  kertas?: string | null
  jenis?: string | null
  page?: number
  pageSize?: number
  signal?: AbortSignal
}

export function fetchStudioList(q: StudioListQuery): Promise<ListResult<StudioRow, StudioListExtra>> {
  return api.list<StudioRow, StudioListExtra>('/api/questions', {
    query: { subjectId: q.subjectId ?? null, status: q.status ?? null, search: q.search ?? null, tahun: q.tahun ?? null, negeri: q.negeri ?? null, kertas: q.kertas ?? null, jenis: q.jenis ?? null, page: q.page ?? null, pageSize: q.pageSize ?? null },
    ...(q.signal ? { signal: q.signal } : {}),
  })
}

/** `QuestionStatusResult` of T33: the answer of a move; `servability` is set for an approval only. */
export interface StatusResult {
  question: { id: string; status: string }
  servability: ServabilityReport | null
}

/** `POST /api/questions/:id/status` (T33). The answer carries the servability report of an approval. */
export const moveQuestionStatus = (id: string, to: 'draft' | 'review' | 'approved' | 'archived', reason?: string): Promise<StatusResult> =>
  api.post<StatusResult>(`/api/questions/${id}/status`, { body: reason === undefined ? { to } : { to, reason } })

/** `GET /api/questions/:id/gate-check` (T33): no state change; the issues name every gap and its wizard step. */
export const fetchGateCheck = (id: string, gate: 'submit' | 'approve' = 'approve', signal?: AbortSignal): Promise<QuestionGateCheck> =>
  api.get<QuestionGateCheck>(`/api/questions/${id}/gate-check`, { query: { gate }, ...(signal ? { signal } : {}) })

/** `GET /api/admin/servability/questions/:id` (T30). */
export const fetchServability = (id: string, signal?: AbortSignal): Promise<ServabilityReport> =>
  api.get<ServabilityReport>(`/api/admin/servability/questions/${id}`, signal ? { signal } : {})

/** `POST /api/admin/servability/questions/batch` (T30): at most 100 ids; the list column of one page. */
export const fetchServabilityBatch = (ids: string[], signal?: AbortSignal): Promise<ServabilityBatchResult> =>
  api.post<ServabilityBatchResult>('/api/admin/servability/questions/batch', { body: { ids }, ...(signal ? { signal } : {}) })

/** Why a question cannot be opened as a draft from the list or the status bar (a mode the editor cannot hold). */
export class EditAsDraftRefused extends Error {
  readonly lines: string[]
  constructor(lines: string[]) {
    super(lines[0] ?? 'Soalan ini belum boleh disunting di Studio.')
    this.lines = lines
  }
}

/** The draft "Edit sebagai draf" opens: version `versionNo` of question `id`; `existing` when a draft or review was already there (409). */
export interface EditedAsDraft {
  id: string
  versionNo: number
  existing: boolean
}

/**
 * "Edit sebagai draf" (V2 A03, REQ-A-038): `POST /api/questions/:id/edit-as-draft` copies the live version into version n+1 as a draft
 * (the live version keeps serving). 201 `{data: {id, versionNo}, status}` opens that draft; 409 CONFLICT whose `details {id, versionNo}`
 * name a draft or review that already exists opens that one instead (not an error). Any other 409 (not live) is rethrown. A question the
 * editor cannot hold is refused first, as before (`EditAsDraftRefused`).
 */
export async function editAsDraft(id: string): Promise<EditedAsDraft> {
  const q = await fetchStudioQuestion(id)
  const h = hydrate(q)
  if (h.unsupported.length > 0) throw new EditAsDraftRefused(h.unsupported)
  try {
    const res = await api.post<Flash<unknown>>(`/api/questions/${id}/edit-as-draft`, { raw: true })
    const made = QuestionEditAsDraftResultSchema.parse(res.data)
    return { id: made.id, versionNo: made.versionNo, existing: false }
  } catch (err) {
    const details = isApiError(err, 'CONFLICT') && err.status === 409 ? (err.body as ErrorBody | null)?.error.details : undefined
    const parsed = QuestionEditAsDraftResultSchema.safeParse(details)
    if (parsed.success) return { id: parsed.data.id, versionNo: parsed.data.versionNo, existing: true }
    throw err
  }
}
