/**
 * M09 admin article and note endpoints (SRS M09 §7 #1-#5 and #10-#14; build task S1-S8). Every call
 * needs an admin session (guest 401, other roles 403).
 *
 * Mutations resolve to `{data, status}` (`status` = the flash text, PROPOSED COPY §8.2), so the
 * screen can queue the success flash. An unknown id rejects with 404 `NOT_FOUND`; invalid input
 * rejects with 422 `VALIDATION_ERROR` and `fields`.
 */

import { api, type ListResult } from '@/api'

import type { ArticleCategory, GradeLevel, MutationResult } from './types'

/** BR-M09-11 subject codes. */
export type NoteSubject =
  | 'matematik'
  | 'matematik_tambahan'
  | 'sains'
  | 'fizik'
  | 'kimia'
  | 'biologi'
  | 'bahasa_melayu'
  | 'bahasa_inggeris'
  | 'sejarah'

/** BR-M09-11 stored note types (the S5 filter additionally accepts the three unused ones). */
export type NoteType = 'FORMULA' | 'RINGKASAN' | 'LENGKAP' | 'TIPS_TRICKS'

/** The S5 `note_type` filter values (DV-M09-06). */
export type NoteTypeFilter = 'summary' | 'mind_map' | 'flashcard' | 'cheat_sheet' | 'full_notes'

/** `AdminArticleItem` (§6.1): one S1 row. */
export interface AdminArticleItem {
  id: number
  title: string
  category: ArticleCategory
  categoryLabel: string
  gradeLevel: GradeLevel
  isPublished: boolean
  isFeatured: boolean
  views: number
  /** ISO 8601 (+08:00). */
  createdAt: string
  author: { id: number; name: string }
}

/** `AdminArticleDetail` (§6.1, #2): every field; the author name feeds the S4 meta line. */
export interface AdminArticleDetail {
  id: number
  title: string
  slug: string
  excerpt: string | null
  content: string
  featuredImage: string | null
  youtubeUrl?: string | null
  category: ArticleCategory
  gradeLevel: GradeLevel
  isPublished: boolean
  isFeatured: boolean
  views: number
  likes?: number
  authorId?: number
  author?: { id: number; name: string }
  publishedAt: string | null
  createdAt: string
  updatedAt?: string
}

/** #3 / #4 body (the admin form never sends `youtubeUrl` or attachments, BR-M09-34). */
export interface ArticleInputBody {
  title: string
  excerpt: string | null
  content: string
  featuredImage: string | null
  category: ArticleCategory
  gradeLevel: GradeLevel
  isPublished: boolean
  isFeatured: boolean
}

export interface AdminArticleListQuery {
  search?: string
  category?: string
  /** `'1'` or `'0'`; empty = all. */
  published?: string
  page?: number
}

/** `NoteItem` (#10): one S5 row. */
export interface AdminNoteItem {
  id: number
  title: string
  subject: NoteSubject
  noteType: NoteType
  /** Stored `TINGKATAN_4` or `TINGKATAN_5` (D54). */
  grade: string
  isPublished: boolean
  views: number
  downloads: number
  author?: { id: number; name: string }
}

/** `NoteDetail` (#11). */
export interface AdminNoteDetail extends AdminNoteItem {
  summary: string | null
  content: string
  authorId?: number
  createdAt: string
  updatedAt?: string
}

/** #12 / #13 body. */
export interface NoteInputBody {
  title: string
  summary: string | null
  content: string
  subject: NoteSubject
  noteType: NoteType
  grade: string
  isPublished: boolean
}

export interface AdminNoteListQuery {
  search?: string
  /** Subject code; empty or `all` = all. */
  subject?: string
  /** Filter value (DV-M09-06); empty or `all` = all. */
  noteType?: string
  page?: number
}

interface Signal {
  signal?: AbortSignal
}

const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

const deleted = { raw: true } as const

// --- articles -------------------------------------------------------------------------------------

/** #1 `GET /api/admin/articles` (20 per page, BR-M09-03 order; an empty filter value is dropped). */
export function fetchAdminArticles(
  query: AdminArticleListQuery = {},
  options: Signal = {},
): Promise<ListResult<AdminArticleItem>> {
  return api.list<AdminArticleItem>('/api/admin/articles', {
    query: {
      search: query.search || undefined,
      category: query.category && query.category !== 'all' ? query.category : undefined,
      published: query.published || undefined,
      page: query.page && query.page > 1 ? query.page : undefined,
    },
    ...withSignal(options),
  })
}

/** #2 `GET /api/admin/articles/:id` (never counts a view; 404 for an unknown id). */
export function fetchAdminArticle(id: number, options: Signal = {}): Promise<AdminArticleDetail> {
  return api.get<AdminArticleDetail>(`/api/admin/articles/${String(id)}`, withSignal(options))
}

/** #3 `POST /api/admin/articles` (201; 422 with `fields`). */
export function createAdminArticle(
  input: ArticleInputBody,
): Promise<MutationResult<AdminArticleDetail>> {
  return api.post<MutationResult<AdminArticleDetail>>('/api/admin/articles', {
    body: input,
    raw: true,
  })
}

/** #4 `PUT /api/admin/articles/:id` (404; 422). */
export function updateAdminArticle(
  id: number,
  input: ArticleInputBody,
): Promise<MutationResult<AdminArticleDetail>> {
  return api.put<MutationResult<AdminArticleDetail>>(`/api/admin/articles/${String(id)}`, {
    body: input,
    raw: true,
  })
}

/** #5 `DELETE /api/admin/articles/:id` (404 for an unknown id). */
export function deleteAdminArticle(id: number): Promise<MutationResult<{ deleted: number }>> {
  return api.delete<MutationResult<{ deleted: number }>>(
    `/api/admin/articles/${String(id)}`,
    deleted,
  )
}

// --- notes ----------------------------------------------------------------------------------------

/** #10 `GET /api/admin/notes` (20 per page, id ascending). */
export function fetchAdminNotes(
  query: AdminNoteListQuery = {},
  options: Signal = {},
): Promise<ListResult<AdminNoteItem>> {
  return api.list<AdminNoteItem>('/api/admin/notes', {
    query: {
      search: query.search || undefined,
      subject: query.subject && query.subject !== 'all' ? query.subject : undefined,
      noteType: query.noteType && query.noteType !== 'all' ? query.noteType : undefined,
      page: query.page && query.page > 1 ? query.page : undefined,
    },
    ...withSignal(options),
  })
}

/** #11 `GET /api/admin/notes/:id` (404 for an unknown id). */
export function fetchAdminNote(id: number, options: Signal = {}): Promise<AdminNoteDetail> {
  return api.get<AdminNoteDetail>(`/api/admin/notes/${String(id)}`, withSignal(options))
}

/** #12 `POST /api/admin/notes` (201; 422; DV-M09-01). */
export function createAdminNote(input: NoteInputBody): Promise<MutationResult<AdminNoteDetail>> {
  return api.post<MutationResult<AdminNoteDetail>>('/api/admin/notes', { body: input, raw: true })
}

/** #13 `PUT /api/admin/notes/:id` (404; 422; DV-M09-01). */
export function updateAdminNote(
  id: number,
  input: NoteInputBody,
): Promise<MutationResult<AdminNoteDetail>> {
  return api.put<MutationResult<AdminNoteDetail>>(`/api/admin/notes/${String(id)}`, {
    body: input,
    raw: true,
  })
}

/** #14 `DELETE /api/admin/notes/:id` (404 for an unknown id). */
export function deleteAdminNote(id: number): Promise<MutationResult<{ deleted: number }>> {
  return api.delete<MutationResult<{ deleted: number }>>(`/api/admin/notes/${String(id)}`, deleted)
}
