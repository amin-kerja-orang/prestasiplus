/**
 * Admin Studio endpoints (R1-F03b, T13). Stimuli and groups are the stimulus API (T32): `/api/stimuli`, `/api/stimulus-groups*`.
 * The DSKP picker (`/api/questions/studio/dskp`) is T13's (the intake figure link lives in m28's intake client). Studio talks to the real API only
 * (`VITE_API_MODE=http`, D84); `studioAvailable()` tells a page to say so. Ids are opaque strings. Mutations resolve to
 * `{data, status}` where `status` is the server's flash text.
 */
import type {
  QuestionGateCheck,
  ServabilityBatchResult,
  ServabilityReport,
  StimulusCreateRequest,
  StimulusUpdateRequest,
  StudioDskp,
} from '@pp/contract'

import { api, isHttpMode, uploadQuestionImage, type ListResult } from '@/api'

import { hydrate, toRequestBody, type WireQuestion } from '../lib/studio/draft'
import type { WireStimulus } from '../lib/studio/stimulus'

export type { StudioDskp }

export const studioAvailable = (): boolean => isHttpMode()
export const STUDIO_UNAVAILABLE = 'Studio hanya tersedia apabila sistem disambungkan ke pelayan sebenar.'

export interface Flash<T> {
  data: T
  status: string
}

/** `StimulusGroupDetail` of T32. */
export interface GroupDetail {
  id: string
  label: string | null
  scope: 'section' | 'paper'
  stimuli: WireStimulus[]
  questionIds: string[]
  /** D93: BM warning while the group has fewer than 2 questions; null otherwise. */
  warning?: string | null | undefined
}

export function fetchStudioDskp(subjectId: string, educationLevelId: string, signal?: AbortSignal): Promise<StudioDskp> {
  return api.get<StudioDskp>('/api/questions/studio/dskp', { query: { subjectId, educationLevelId }, ...(signal ? { signal } : {}) })
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
}

/** `meta.counts`: the questions per lifecycle status under the current filters, status itself left out (the four tiles). */
export interface StudioListExtra {
  counts?: Partial<Record<'draft' | 'review' | 'approved' | 'archived', number>>
}

export interface StudioListQuery {
  subjectId?: string | null
  status?: string | null
  search?: string | null
  page?: number
  pageSize?: number
  signal?: AbortSignal
}

export function fetchStudioList(q: StudioListQuery): Promise<ListResult<StudioRow, StudioListExtra>> {
  return api.list<StudioRow, StudioListExtra>('/api/questions', {
    query: { subjectId: q.subjectId ?? null, status: q.status ?? null, search: q.search ?? null, page: q.page ?? null, pageSize: q.pageSize ?? null },
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

/**
 * "Edit sebagai draf" (V2 A03): creates the draft at once. V3 has no `edit-as-draft` route; `PUT /api/questions/:id` on an
 * approved question writes version n+1 as a draft while the live version keeps serving (Q-5, ADR-0027), so the stored content is
 * read, mapped through the editor model and written back unchanged (UX-17). Resolves to the question id.
 */
export async function editAsDraft(id: string): Promise<string> {
  const q = await fetchStudioQuestion(id)
  const h = hydrate(q)
  if (h.unsupported.length > 0) throw new EditAsDraftRefused(h.unsupported)
  const res = await updateStudioQuestion(id, toRequestBody(h.draft))
  return res.data.id
}
