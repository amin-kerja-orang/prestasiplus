/**
 * Admin Studio endpoints (R1-F03b, T13). Stimuli and groups are the stimulus API (T32): `/api/stimuli`, `/api/stimulus-groups*`.
 * The DSKP picker (`/api/questions/studio/dskp`) is T13's (the intake figure link lives in m28's intake client). Studio talks to the real API only
 * (`VITE_API_MODE=http`, D84); `studioAvailable()` tells a page to say so. Ids are opaque strings. Mutations resolve to
 * `{data, status}` where `status` is the server's flash text.
 */
import type { StimulusCreateRequest, StimulusUpdateRequest, StudioDskp } from '@pp/contract'

import { api, isHttpMode, uploadQuestionImage, type ListResult } from '@/api'

import type { WireQuestion } from '../lib/studio/draft'
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

export const createGroup = (body: { label?: string | null; stimulusIds: string[]; questionIds: string[] }): Promise<Flash<GroupDetail>> =>
  api.post<Flash<GroupDetail>>('/api/stimulus-groups', { body, raw: true })

export const setGroupStimuli = (id: string, stimulusIds: string[]): Promise<Flash<GroupDetail>> =>
  api.put<Flash<GroupDetail>>(`/api/stimulus-groups/${id}`, { body: { stimulusIds }, raw: true })

export const dissolveGroup = (id: string): Promise<Flash<{ deleted: 1; releasedQuestionIds: string[] }>> =>
  api.delete<Flash<{ deleted: 1; releasedQuestionIds: string[] }>>(`/api/stimulus-groups/${id}`, { raw: true })

export const addGroupMember = (id: string, questionId: string): Promise<Flash<GroupDetail>> =>
  api.post<Flash<GroupDetail>>(`/api/stimulus-groups/${id}/members`, { body: { questionId }, raw: true })

export const removeGroupMember = (id: string, questionId: string): Promise<Flash<{ group: GroupDetail; warning: string | null }>> =>
  api.delete<Flash<{ group: GroupDetail; warning: string | null }>>(`/api/stimulus-groups/${id}/members/${questionId}`, { raw: true })

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
