/**
 * M09 admin client for banners, Audio KBAT sets and screenshots (SRS M09 v1.6 §7 #15–#19, #21–#23,
 * #41–#42; screens S9–S14). Every call needs an admin session (`A`): other roles get 403, a guest
 * 401 (the client's 401 policy sends the user to `/login`).
 *
 * Failures reject with `ApiError`: 404 `NOT_FOUND` for an unknown id, 422 `VALIDATION_ERROR` with
 * `fields`. The mutating calls resolve to `{data, status}` (`status` = the flash text, PROPOSED COPY,
 * SRS §8.2). The list calls accept both a bare `{data}` envelope and a `{data, meta}` one (the
 * handlers were written in parallel with this client).
 */

import { api, type ListResult } from '@/api'

import type { MutationResult } from './types'

type Signal = { signal?: AbortSignal }
const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

/** A `{data}` or `{data, meta}` answer reduced to its rows. */
function rowsOf<T>(result: T[] | { data: T[] }): T[] {
  return Array.isArray(result) ? result : result.data
}

// --- banners (DATA-M09-03) ------------------------------------------------------------------------

/** #15 and #16 item. Codes are stored upper case (BR-M09-12). */
export interface AdminBanner {
  id: number
  title: string
  description: string | null
  imageUrl: string | null
  bannerType: string
  linkType: string
  externalUrl: string | null
  targetAudience: string
  displayOrder: number
  /** `YYYY-MM-DD` or `null`. */
  startDate: string | null
  endDate: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** #17 and #18 body. `externalUrl` is only sent when `linkType` is `EXTERNAL` (FR-M09-55). */
export interface BannerInput {
  title: string
  description: string | null
  imageUrl: string | null
  bannerType: string
  linkType: string
  externalUrl?: string
  targetAudience: string
  displayOrder: number
  startDate: string | null
  endDate: string | null
  isActive: boolean
}

/** #15 `GET /api/admin/banners`: every banner, `displayOrder` then id (BR-M09-12). */
export async function fetchAdminBanners(options: Signal = {}): Promise<AdminBanner[]> {
  return rowsOf(
    await api.get<AdminBanner[] | ListResult<AdminBanner>>(
      '/api/admin/banners',
      withSignal(options),
    ),
  )
}

/** #16 `GET /api/admin/banners/:id` (404 for an unknown banner). */
export function fetchAdminBanner(id: number, options: Signal = {}): Promise<AdminBanner> {
  return api.get<AdminBanner>(`/api/admin/banners/${String(id)}`, withSignal(options))
}

/** #17 `POST /api/admin/banners` (201; 422 with `fields`). */
export function createBanner(body: BannerInput): Promise<MutationResult<AdminBanner>> {
  return api.post<MutationResult<AdminBanner>>('/api/admin/banners', { body, raw: true })
}

/** #18 `PUT /api/admin/banners/:id` (404; 422). */
export function updateBanner(id: number, body: BannerInput): Promise<MutationResult<AdminBanner>> {
  return api.put<MutationResult<AdminBanner>>(`/api/admin/banners/${String(id)}`, {
    body,
    raw: true,
  })
}

/** #19 `DELETE /api/admin/banners/:id` (404). */
export function deleteBanner(id: number): Promise<MutationResult<{ deleted: number }>> {
  return api.delete<MutationResult<{ deleted: number }>>(`/api/admin/banners/${String(id)}`, {
    raw: true,
  })
}

// --- Audio KBAT sets (DATA-M09-04) -----------------------------------------------------------------

export type AudioSetStatus = 'draft' | 'pending_review' | 'approved' | 'archived'

/** #21 item. */
export interface AdminAudioSetItem {
  id: number
  title: string
  educationLevel: { id: number; name: string }
  subject: { id: number; name: string }
  status: AudioSetStatus
  statusLabel: string
  questionCount: number
}

/** #21 `meta.stats`: counted over every set, never filtered (BR-M09-15). */
export interface AudioSetStats {
  sets: number
  approved: number
  draftPending: number
  questions: number
}

export interface AudioSetListMeta {
  stats: AudioSetStats
}

export interface AdminAudioSetQuery {
  educationLevelId?: number
  subjectId?: number
  status?: AudioSetStatus
  search?: string
  /** FR-M09-65 asserts no pager: the screen always asks for the largest page (max 100). */
  pageSize?: number
}

/** #23 question fields (one of the 30). `correctAnswer` is `A` to `D`. */
export interface AudioQuestionInput {
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctAnswer: 'A' | 'B' | 'C' | 'D'
  marks: number
  kbatLevel: number
  dskpSpId?: number
  explanation?: string
}

/** #23 section fields (one of the 4). The audio file is optional. */
export interface AudioSectionInput {
  title: string
  audio?: File
  transcript?: string
}

/** #23 body, sent as multipart (`FormData`). */
export interface AudioSetInput {
  title: string
  educationLevelId: number
  subjectId: number
  status: 'approved' | 'pending_review' | 'draft'
  sourceLabel?: string
  instructions?: string
  /** Four sections, in order. */
  sections: AudioSectionInput[]
  /** Thirty questions, in order. */
  questions: AudioQuestionInput[]
}

/** #21 `GET /api/admin/audio-kbat-sets` (`meta.stats` always present). */
export function fetchAdminAudioSets(
  query: AdminAudioSetQuery = {},
  options: Signal = {},
): Promise<ListResult<AdminAudioSetItem, AudioSetListMeta>> {
  return api.list<AdminAudioSetItem, AudioSetListMeta>('/api/admin/audio-kbat-sets', {
    query: { ...query },
    ...withSignal(options),
  })
}

export type AudioTemplateFormat = 'xlsx' | 'docx'

/** #22 `GET /api/admin/audio-kbat-sets/template?format=` (a placeholder file, OQ-M09-03). */
export function fetchAudioTemplate(
  format: AudioTemplateFormat,
): Promise<{ blob: Blob; filename: string | null }> {
  return api.blob('/api/admin/audio-kbat-sets/template', { query: { format } })
}

/** The FormData of #23: dotted-bracket names `sections[1][title]`, `questions[30][optionA]`, ... */
export function audioSetFormData(input: AudioSetInput): FormData {
  const form = new FormData()
  form.append('title', input.title)
  form.append('educationLevelId', String(input.educationLevelId))
  form.append('subjectId', String(input.subjectId))
  form.append('status', input.status)
  if (input.sourceLabel) form.append('sourceLabel', input.sourceLabel)
  if (input.instructions) form.append('instructions', input.instructions)
  input.sections.forEach((section, index) => {
    const key = `sections[${String(index + 1)}]`
    form.append(`${key}[title]`, section.title)
    if (section.audio) form.append(`${key}[audio]`, section.audio)
    if (section.transcript) form.append(`${key}[transcript]`, section.transcript)
  })
  input.questions.forEach((q, index) => {
    const key = `questions[${String(index + 1)}]`
    form.append(`${key}[questionText]`, q.questionText)
    form.append(`${key}[optionA]`, q.optionA)
    form.append(`${key}[optionB]`, q.optionB)
    form.append(`${key}[optionC]`, q.optionC)
    form.append(`${key}[optionD]`, q.optionD)
    form.append(`${key}[correctAnswer]`, q.correctAnswer)
    form.append(`${key}[marks]`, String(q.marks))
    form.append(`${key}[kbatLevel]`, String(q.kbatLevel))
    if (q.dskpSpId !== undefined) form.append(`${key}[dskpSpId]`, String(q.dskpSpId))
    if (q.explanation) form.append(`${key}[explanation]`, q.explanation)
  })
  return form
}

/** #23 `POST /api/admin/audio-kbat-sets` (multipart, 201; 422 with `fields`). */
export function createAudioSet(input: AudioSetInput): Promise<MutationResult<{ id: number }>> {
  return api.multipart<MutationResult<{ id: number }>>(
    '/api/admin/audio-kbat-sets',
    audioSetFormData(input),
    { raw: true },
  )
}

// --- M03 lookups (a module's UI code cannot import another module's `api/`, ADR-0009) -------------

/** M03 `GET /api/education-levels` item (the part S12/S13 use). */
export interface LevelOption {
  id: number
  name: string
}

/** M03 `GET /api/subjects` item (the part S12/S13 use). */
export interface SubjectOption {
  id: number
  name: string
}

/** The 11 education levels in id order (Darjah 1 to Tingkatan 5). */
export function fetchLevelOptions(options: Signal = {}): Promise<ListResult<LevelOption>> {
  return api.list<LevelOption>('/api/education-levels', withSignal(options))
}

/** The subjects; the screens sort them A–Z (FN-M09-5.1.6). */
export function fetchSubjectOptions(options: Signal = {}): Promise<ListResult<SubjectOption>> {
  return api.list<SubjectOption>('/api/subjects', withSignal(options))
}

// --- screenshots (DATA-M09-10) ---------------------------------------------------------------------

/** #41 item. */
export interface ScreenshotFile {
  id: number
  fileName: string
  originalName: string
  size: number
  mimeType: string
  uploadedById: number
  createdAt: string
  /**
   * Image URL. The mock returns an object URL for a file uploaded in this session and the
   * `blob:mock/screenshots/{fileName}` placeholder otherwise (the page draws a glyph for that).
   */
  url?: string
}

/** #42 answer (provisional, L-5): files kept and files refused with the reason. */
export interface ScreenshotUploadResult {
  saved: ScreenshotFile[]
  rejected: { name: string; reason: string }[]
}

/** #41 `GET /api/admin/screenshots`. */
export async function fetchScreenshots(options: Signal = {}): Promise<ScreenshotFile[]> {
  return rowsOf(
    await api.get<ScreenshotFile[] | ListResult<ScreenshotFile>>(
      '/api/admin/screenshots',
      withSignal(options),
    ),
  )
}

/** #42 `POST /api/admin/screenshots` (multipart `files[]`; 201; 422 when nothing is accepted). */
export function uploadScreenshots(files: File[]): Promise<MutationResult<ScreenshotUploadResult>> {
  const form = new FormData()
  for (const file of files) form.append('files[]', file)
  return api.multipart<MutationResult<ScreenshotUploadResult>>('/api/admin/screenshots', form, {
    raw: true,
  })
}
