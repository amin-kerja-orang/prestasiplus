/**
 * Shared constants and helpers of the M07 admin screens S5-S8 (SRS M07 v1.7 §2, §8): paths, exact
 * BM copy, select options, display helpers and class strings.
 */

import { isApiError } from '@/api'
import type { DsStatus } from '@/ds'
import { formatDate } from '@/lib/time'

import type { QuestionStatus } from '../api/admin'

export const QUESTIONS_PATH = '/admin/pksk/questions'
export const QUESTION_CREATE_PATH = '/admin/pksk/questions/create'
export const ACCESS_PATH = '/admin/pksk/access'

export const ADMIN_ROUTES = {
  list: 'm07.admin.questions',
  create: 'm07.admin.questions.create',
  edit: 'm07.admin.questions.edit',
  access: 'm07.admin.access',
} as const

/** Exact copy: SRS §8.1 (OBSERVED); the flash texts are UNVERIFIED COPY (SRS §8.2). */
export const COPY = {
  confirmBulkDelete: 'Padam soalan terpilih?',
  confirmDelete: 'Padam soalan ini?',
  confirmRevoke: 'Tarik balik akses?',
  questionsEmpty: 'Tiada soalan PKSK lagi',
  questionsEmptyLink: 'Tambah soalan pertama',
  accessEmpty: 'Tiada rekod akses',
  /** The row delete answers 204 with no body, so the flash text lives here (SRS §8.2). */
  questionDeleted: 'Soalan PKSK berjaya dipadam.',
  /** INFERRED: no live load-failure copy; the generic M01 / M08 text is reused. */
  loadFailed: 'Maaf, berlaku ralat. Sila cuba semula.',
} as const

export const BAHAGIAN_FILTER_OPTIONS = [
  { value: 'A', label: 'A - Insaniah' },
  { value: 'B', label: 'B - Intelek' },
  { value: 'C', label: 'C - Esei' },
] as const

export const LEVEL_FILTER_OPTIONS = [
  { value: 'T1', label: 'Tingkatan 1' },
  { value: 'T4', label: 'Tingkatan 4' },
] as const

export const STATUS_OPTIONS: readonly { value: QuestionStatus; label: string }[] = [
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Diluluskan' },
  { value: 'rejected', label: 'Ditolak' },
]

export const STATUS_LABEL: Record<QuestionStatus, string> = {
  pending: 'Menunggu',
  approved: 'Diluluskan',
  rejected: 'Ditolak',
}

/** Badge status of a question; "Menunggu" is the live word and is passed as the badge label. */
export const STATUS_BADGE: Record<QuestionStatus, DsStatus> = {
  pending: 'awaiting-review',
  approved: 'approved',
  rejected: 'rejected',
}

/** S6 Bahagian select. */
export const BAHAGIAN_CREATE_OPTIONS = [
  { value: 'A', label: 'A - Kecerdasan Insaniah' },
  { value: 'B', label: 'B - Kecerdasan Intelek' },
  { value: 'C', label: 'C - Artikulasi Penulisan' },
] as const

export const LEVEL_CREATE_OPTIONS = [
  { value: 'T1', label: 'Tingkatan 1' },
  { value: 'T4', label: 'Tingkatan 4 (Tingkatan 3)' },
] as const

export const DIFFICULTY_CREATE_OPTIONS = [
  { value: 1, label: '1 - Sangat Mudah' },
  { value: 2, label: '2 - Mudah' },
  { value: 3, label: '3 - Sederhana' },
  { value: 4, label: '4 - Sukar' },
  { value: 5, label: '5 - Sangat Sukar' },
] as const

export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 6

/** Access status labels: "Aktif" OBSERVED; the other two are UNVERIFIED COPY (§8.2). */
export const ACCESS_STATUS: Record<
  'active' | 'expired' | 'revoked',
  { label: string; status: DsStatus }
> = {
  active: { label: 'Aktif', status: 'active' },
  expired: { label: 'Tamat Tempoh', status: 'expired' },
  revoked: { label: 'Ditarik', status: 'rejected' },
}

/** BR-M07-23: the first 80 characters (trailing spaces trimmed) + "..." when longer. */
export function limitQuestionText(text: string): string {
  return text.length > 80 ? `${text.slice(0, 80).trimEnd()}...` : text
}

/** `dd/mm/yyyy` of an ISO timestamp or a `YYYY-MM-DD` date key. */
export function displayDate(value: string): string {
  const key = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return key ? `${key[3]}/${key[2]}/${key[1]}` : formatDate(value)
}

/** One editable option row of S6 / S7 (`uid` is a stable key, so removing a row keeps the others). */
export interface OptionRow {
  uid: number
  text: string
  isCorrect: boolean
}

let nextUid = 1
export function newOption(text = '', isCorrect = false): OptionRow {
  return { uid: nextUid++, text, isCorrect }
}

/** Letter circle of an option row (A, B, C ...), recomputed from the row position. */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

/** First value of a query parameter, or ''. */
export function queryText(value: unknown): string {
  const first = Array.isArray(value) ? (value[0] as unknown) : value
  return typeof first === 'string' ? first : ''
}

/** Page number of the URL (1 when absent or invalid). */
export function queryPage(value: unknown): number {
  return Math.max(1, Number.parseInt(queryText(value), 10) || 1)
}

/** Select value that matches an option case-insensitively (BR-M07-06), else the raw text. */
export function matchOption(value: string, options: readonly { value: string }[]): string {
  const hit = options.find((o) => o.value.toLowerCase() === value.trim().toLowerCase())
  return hit ? hit.value : value
}

/** Red-alert lines of a failed call: field messages, else the API message, else the load copy. */
export function errorLines(err: unknown): string[] {
  if (!isApiError(err) || err.status === 0 || err.code === 'NETWORK_ERROR') return [COPY.loadFailed]
  const fieldTexts = err.fields ? Object.values(err.fields) : []
  if (fieldTexts.length > 0) return [...new Set(fieldTexts)]
  if (err.message === '' || /^HTTP \d+$/.test(err.message)) return [COPY.loadFailed]
  return [err.message]
}

/** Server field messages by field name (empty when the error carries none). */
export function fieldErrors(err: unknown): Record<string, string> {
  return isApiError(err) && err.fields ? { ...err.fields } : {}
}
