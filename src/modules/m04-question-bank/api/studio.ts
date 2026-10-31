/**
 * Admin Studio endpoints (R1-F03b, T13): stimulus groups (D90), the DSKP picker and the part-tree question save. Studio talks
 * to the real API only (`VITE_API_MODE=http`, D84: no mock prototype); `studioAvailable()` tells a page to say so instead of
 * calling a mock that has no such routes. Ids are opaque strings. Mutations resolve to `{data, status}` where `status` is
 * the server's flash text.
 */
import type { StudioDskp, StudioGroup, StudioStimulusInput, StudioStimulusPatch } from '@pp/contract'

import { api, isHttpMode, uploadQuestionImage, type ListResult } from '@/api'

import type { WireQuestion } from '../lib/studio/draft'

export type { StudioDskp, StudioGroup, StudioStimulusInput, StudioStimulusPatch }

export const studioAvailable = (): boolean => isHttpMode()
export const STUDIO_UNAVAILABLE = 'Studio hanya tersedia apabila sistem disambungkan ke pelayan sebenar.'

export interface Flash<T> {
  data: T
  status: string
}

const BASE = '/api/questions/studio'

/* ---- DSKP -------------------------------------------------------------------------------------------- */

export function fetchStudioDskp(subjectId: string, educationLevelId: string, signal?: AbortSignal): Promise<StudioDskp> {
  return api.get<StudioDskp>(`${BASE}/dskp`, { query: { subjectId, educationLevelId }, ...(signal ? { signal } : {}) })
}

/* ---- groups (D90) ------------------------------------------------------------------------------------- */

export const fetchStudioGroup = (id: string, signal?: AbortSignal): Promise<StudioGroup> =>
  api.get<StudioGroup>(`${BASE}/groups/${id}`, signal ? { signal } : {})

export const createStudioGroup = (body: { label?: string | null; stimuli: StudioStimulusInput[]; questionIds?: string[] }): Promise<Flash<StudioGroup>> =>
  api.post<Flash<StudioGroup>>(`${BASE}/groups`, { body, raw: true })

export const updateStudioGroup = (id: string, body: { label: string | null }): Promise<Flash<StudioGroup>> =>
  api.patch<Flash<StudioGroup>>(`${BASE}/groups/${id}`, { body, raw: true })

export const dissolveStudioGroup = (id: string): Promise<Flash<{ id: string; detachedQuestionIds: string[] }>> =>
  api.delete<Flash<{ id: string; detachedQuestionIds: string[] }>>(`${BASE}/groups/${id}`, { raw: true })

export const addStudioStimulus = (id: string, body: StudioStimulusInput): Promise<Flash<StudioGroup>> =>
  api.post<Flash<StudioGroup>>(`${BASE}/groups/${id}/stimuli`, { body, raw: true })

export const patchStudioStimulus = (id: string, stimulusId: string, body: StudioStimulusPatch): Promise<Flash<StudioGroup>> =>
  api.patch<Flash<StudioGroup>>(`${BASE}/groups/${id}/stimuli/${stimulusId}`, { body, raw: true })

export const removeStudioStimulus = (id: string, stimulusId: string): Promise<Flash<StudioGroup>> =>
  api.delete<Flash<StudioGroup>>(`${BASE}/groups/${id}/stimuli/${stimulusId}`, { raw: true })

/** The complete ordered member list: adds, removals and reordering in one atomic call. */
export const setStudioGroupMembers = (id: string, questionIds: string[]): Promise<Flash<StudioGroup>> =>
  api.put<Flash<StudioGroup>>(`${BASE}/groups/${id}/members`, { body: { questionIds }, raw: true })

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
