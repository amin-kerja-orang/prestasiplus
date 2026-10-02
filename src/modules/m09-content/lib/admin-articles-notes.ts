/**
 * Shared constants and helpers of the M09 admin article and note screens (S1-S8): route names and
 * paths, exact BM copy (SRS M09 §8), select options (BR-M09-01, BR-M09-11), display helpers and
 * class strings.
 */

import { isApiError } from '@/api'
import { formatDate, formatDateEn } from '@/lib/time'

import type { NoteSubject, NoteType, NoteTypeFilter } from '../api/admin-articles-notes'
import type { ArticleCategory, GradeLevel } from '../api/types'

export const ARTICLES_LIST_PATH = '/admin/articles'
export const NOTES_LIST_PATH = '/admin/notes'

export const ARTICLE_ROUTES = {
  list: 'm09.admin.articles.list',
  create: 'm09.admin.articles.create',
  edit: 'm09.admin.articles.edit',
  preview: 'm09.admin.articles.preview',
} as const

export const NOTE_ROUTES = {
  list: 'm09.admin.notes.list',
  create: 'm09.admin.notes.create',
  edit: 'm09.admin.notes.edit',
  preview: 'm09.admin.notes.preview',
} as const

/** Exact observed copy (SRS §8.1) and the PROPOSED COPY placeholders (§8.2). */
export const COPY = {
  articleNotFound: 'Artikel tidak dijumpai.',
  confirmDeleteArticle: 'Adakah anda pasti mahu padam artikel ini?',
  confirmDeleteNote: 'Adakah anda pasti mahu padam nota ini?',
  articleEmpty: 'Tiada artikel dijumpai.',
  noteEmpty: 'Tiada nota dijumpai.',
  draft: 'Draf',
  published: 'Diterbitkan',
  /**
   * INFERRED: M09 SRS §8 has no load-failure copy (the live 500 page is replaced, DV-M09-01); the
   * generic placeholder of M03 (§8) is reused.
   */
  loadFailed: 'Ralat memuatkan data. Sila cuba semula.',
  genericError: 'Ralat berlaku. Sila cuba lagi.',
} as const

/** BR-M09-01 article categories (code, label), in the live option order. */
export const CATEGORY_OPTIONS: readonly { value: ArticleCategory; label: string }[] = [
  { value: 'TIPS_BELAJAR', label: 'Tips Belajar' },
  { value: 'BERITA', label: 'Berita' },
  { value: 'MOTIVASI', label: 'Motivasi' },
  { value: 'PANDUAN_IBU_BAPA', label: 'Panduan Ibu Bapa' },
  { value: 'PANDUAN_GURU', label: 'Panduan Guru' },
  { value: 'KEJAYAAN', label: 'Kejayaan' },
  { value: 'UMUM', label: 'Umum' },
]

/** BR-M09-01 levels of the S2/S3 select ("Semua" first, the default). */
export const GRADE_OPTIONS: readonly { value: GradeLevel; label: string }[] = [
  { value: 'SEMUA', label: 'Semua' },
  { value: 'DARJAH_1', label: 'Darjah 1' },
  { value: 'DARJAH_2', label: 'Darjah 2' },
  { value: 'DARJAH_3', label: 'Darjah 3' },
  { value: 'DARJAH_4', label: 'Darjah 4' },
  { value: 'DARJAH_5', label: 'Darjah 5' },
  { value: 'DARJAH_6', label: 'Darjah 6' },
]

/** The `published` filter (FR-M09-02). */
export const PUBLISHED_FILTER_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Semua Status' },
  { value: '1', label: 'Diterbitkan' },
  { value: '0', label: 'Draf' },
]

/** BR-M09-11 note subjects (code, label), the S5 filter and the note form. */
export const NOTE_SUBJECT_OPTIONS: readonly { value: NoteSubject; label: string }[] = [
  { value: 'matematik', label: 'Matematik' },
  { value: 'sains', label: 'Sains' },
  { value: 'bahasa_melayu', label: 'Bahasa Melayu' },
  { value: 'bahasa_inggeris', label: 'Bahasa Inggeris' },
  { value: 'sejarah', label: 'Sejarah' },
]

/** The S5 "Jenis" filter (FN-M09-3.1.2, DV-M09-06: live options kept). */
export const NOTE_TYPE_FILTER_OPTIONS: readonly {
  value: 'all' | NoteTypeFilter
  label: string
}[] = [
  { value: 'all', label: 'Semua Jenis' },
  { value: 'summary', label: 'Ringkasan' },
  { value: 'mind_map', label: 'Mind Map' },
  { value: 'flashcard', label: 'Flashcard' },
  { value: 'cheat_sheet', label: 'Cheat Sheet' },
  { value: 'full_notes', label: 'Nota Penuh' },
]

/** The note form "Jenis" options: the 4 stored types shown as stored (FN-M09-3.2.3, DV-M09-01). */
export const NOTE_TYPE_FORM_OPTIONS: readonly { value: NoteType; label: string }[] = [
  { value: 'FORMULA', label: 'FORMULA' },
  { value: 'RINGKASAN', label: 'RINGKASAN' },
  { value: 'LENGKAP', label: 'LENGKAP' },
  { value: 'TIPS_TRICKS', label: 'TIPS_TRICKS' },
]

/** The note form "Tahap" options: Darjah 1 to 6 (stored `DARJAH_n`). */
export const NOTE_GRADE_OPTIONS: readonly { value: string; label: string }[] = [
  1, 2, 3, 4, 5, 6,
].map((n) => ({ value: `DARJAH_${String(n)}`, label: `Darjah ${String(n)}` }))

const SUBJECT_LABELS = new Map<string, string>(NOTE_SUBJECT_OPTIONS.map((o) => [o.value, o.label]))

/** BR-M09-11: the subject shown as its label in upper case ("BAHASA MELAYU"). */
export function noteSubjectText(code: string): string {
  return (SUBJECT_LABELS.get(code) ?? code).toUpperCase()
}

/** BR-M09-11: stored `DARJAH_2` shown "DARJAH 2". */
export function noteGradeText(grade: string): string {
  return grade.replace(/_/g, ' ')
}

/** Laravel `Str::limit(text, n)`: the first `n` characters (right-trimmed) plus "..." when longer. */
export function limitText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}...` : text
}

/** S1 "Tarikh": dd/mm/yyyy (BR-M09-10). */
export function listDate(iso: string): string {
  return formatDate(iso)
}

/** S4 / S8: "dd Mon yyyy" with English month abbreviations (BR-M09-10). */
export function previewDate(iso: string): string {
  return formatDateEn(iso)
}

/** First value of a query parameter as a string. */
export function queryText(value: unknown): string {
  const first = Array.isArray(value) ? (value[0] as unknown) : value
  return typeof first === 'string' ? first : ''
}

/** Page number of the URL (1 when absent or invalid). */
export function queryPage(value: unknown): number {
  return Math.max(1, Number.parseInt(queryText(value), 10) || 1)
}

/** Red-alert lines of a failed call: field messages, else the API message, else the generic copy. */
export function errorLines(err: unknown): string[] {
  if (!isApiError(err) || err.status === 0 || err.code === 'NETWORK_ERROR') {
    return [COPY.genericError]
  }
  const fieldTexts = err.fields ? Object.values(err.fields) : []
  if (fieldTexts.length > 0) return [...new Set(fieldTexts)]
  if (err.message === '' || /^HTTP \d+$/.test(err.message)) return [COPY.genericError]
  return [err.message]
}

/** Server field messages by field name (empty when the error carries none). */
export function fieldErrors(err: unknown): Record<string, string> {
  return isApiError(err) && err.fields ? { ...err.fields } : {}
}

export function isNotFoundError(err: unknown): boolean {
  return isApiError(err) && err.status === 404
}

/** Primary admin button (S1 "Cari", "Tambah", save). */
export const PRIMARY_BUTTON_CLASS =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'

/** "Reset" link (slate-100, FR-M09-02). */
export const RESET_BUTTON_CLASS =
  'inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300'

export const FORM_LABEL_CLASS = 'mb-1.5 block text-sm font-semibold text-slate-700'

/** Row icon buttons: 44 px below `lg`, compact from `lg` (M02/M03 precedent). */
export const ICON_BUTTON_CLASS =
  'inline-flex h-11 min-h-11 w-11 min-w-11 shrink-0 items-center justify-center rounded-lg transition lg:h-9 lg:min-h-9 lg:w-9 lg:min-w-9 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
