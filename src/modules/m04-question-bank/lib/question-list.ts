/**
 * S1 question list and S3 detail helpers (M04-T3; SRS FR-M04-01..16, 37..47). Labels and full class
 * strings are finite lookup maps (overview §8.2 rule 2).
 */

import type { DsStatus } from '@/ds'

import { isHttpMode } from '@/api'

import {
  NO_WIRE_BULK_ACTIONS,
  NO_WIRE_STATUS_FILTERS,
  type BulkAction,
  type ComplianceStatus,
  type QuestionStatus,
  type QuestionType,
} from '../api/questions'

export const QUESTIONS_LIST_PATH = '/admin/questions'
export const QUESTIONS_CREATE_PATH = '/admin/questions/create'

export const QUESTION_ROUTES = {
  list: 'm04.questions.list',
  detail: 'm04.questions.detail',
} as const

export const questionDetailPath = (id: number): string => `${QUESTIONS_LIST_PATH}/${String(id)}`
export const questionEditPath = (id: number): string => `${QUESTIONS_LIST_PATH}/${String(id)}/edit`

export const DELETE_CONFIRM = 'Adakah anda pasti mahu memadamkan soalan ini?'
export const STATUS_CONFIRM = 'Adakah anda pasti mahu mengubah status soalan ini?'
export const REGENERATE_CONFIRM = 'Jana semula Penjelasan AI? Versi lama akan ditimpa.'

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Sangat Mudah',
  2: 'Mudah',
  3: 'Sederhana',
  4: 'Sukar',
  5: 'Sangat Sukar',
}

/** "Kesukaran" filter options: "⭐ Sangat Mudah" … (FN-M04-1.1.7). */
export const DIFFICULTY_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  label: `${'⭐'.repeat(n)} ${DIFFICULTY_LABELS[n] ?? ''}`,
}))

export const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draf' },
  { value: 'pending_review', label: 'Menunggu Semakan' },
  { value: 'approved', label: 'Diluluskan' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'archived', label: 'Diarkibkan' },
] as const

export const DSKP_OPTIONS = [
  { value: 'tagged', label: 'Ada DSKP Tag' },
  { value: 'untagged', label: 'Belum Ditag' },
] as const

export const COMPLIANCE_OPTIONS = [
  { value: 'verified', label: 'Verified' },
  { value: 'pending_mapping', label: 'Pending Mapping' },
  { value: 'quarantined', label: 'Quarantined' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Draft' },
  { value: 'missing_source', label: 'Tiada Source PDF' },
  { value: 'verified_generated', label: 'AI Verified' },
] as const

export const SOURCE_OPTIONS = [
  { value: 'textbook', label: 'Textbook' },
  { value: 'dskp', label: 'DSKP' },
  { value: 'trial', label: 'Trial' },
  { value: 'marking_scheme', label: 'Skema' },
] as const

export const BULK_OPTIONS: readonly { value: BulkAction; label: string; verb: string }[] = [
  { value: 'approve', label: 'Luluskan', verb: 'meluluskan' },
  { value: 'publish', label: 'Terbitkan', verb: 'menerbitkan' },
  { value: 'reject', label: 'Tolak', verb: 'menolak' },
  { value: 'archive', label: 'Arkibkan', verb: 'mengarkibkan' },
  { value: 'delete', label: 'Padam', verb: 'memadamkan' },
]

/**
 * Bulk actions that exist only in http mode (no mock equivalent). ADR-0027: "Terbitkan" is the approve step there, so
 * http mode shows Terbitkan instead of Luluskan (`HTTP_HIDDEN_BULK_ACTIONS`); both send the wire action `approved`.
 */
const HTTP_ONLY_BULK_ACTIONS: readonly string[] = ['publish']
const HTTP_HIDDEN_BULK_ACTIONS: readonly string[] = ['approve']

/** The status filter options; http mode hides those with no v2 wire equivalent and shows `approved` as Diterbitkan (ADR-0027). */
export const statusOptionsFor = (
  http: boolean = isHttpMode(),
): readonly { value: string; label: string }[] => {
  if (!http) return STATUS_OPTIONS
  return STATUS_OPTIONS.filter((o) => !NO_WIRE_STATUS_FILTERS.includes(o.value)).map((o) =>
    o.value === 'approved' ? { value: o.value, label: 'Diterbitkan' } : o,
  )
}

/** The bulk actions; http mode hides those with no v2 wire equivalent (and Luluskan) and adds Terbitkan. */
export const bulkOptionsFor = (http: boolean = isHttpMode()) =>
  BULK_OPTIONS.filter((o) =>
    http
      ? !NO_WIRE_BULK_ACTIONS.includes(o.value) && !HTTP_HIDDEN_BULK_ACTIONS.includes(o.value)
      : !HTTP_ONLY_BULK_ACTIONS.includes(o.value),
  )

export const bulkConfirmText = (verb: string, n: number): string =>
  `Adakah anda pasti mahu ${verb} ${String(n)} soalan?`

/** The list filters as URL query names (live GET form) and as the API's camelCase keys. */
export const FILTER_KEYS = [
  'subject_id',
  'education_level_id',
  'difficulty_level',
  'status',
  'dskp_filter',
  'compliance_filter',
  'source_filter',
  'search',
] as const
export type FilterKey = (typeof FILTER_KEYS)[number]

/** Tile name: cut to 12 characters + "..." when longer (FR-M04-03). */
export function tileName(name: string): string {
  return name.length > 12 ? `${name.slice(0, 12)}...` : name
}

/** Question text in the list: cut to 80 characters + "..." (FR-M04-08). */
export function excerpt(text: string): string {
  return text.length > 80 ? `${text.slice(0, 80)}...` : text
}

/** "PENDING_MAPPING" -> "PENDING MAPPING" (DV-M04-08). */
export const upperWords = (code: string): string => code.replaceAll('_', ' ').toUpperCase()

export const sourceLabel = (type: string | null): string =>
  type === null ? 'TIADA' : upperWords(type)

/**
 * Question status as the screens may receive it: the mock vocabulary (`QuestionStatus`) or the v2 wire
 * lifecycle (`draft | review | approved | archived`, BE-09 / D54a, ADR-0027), or any unknown string.
 * Every lookup below is fail-safe: an unknown value gets a neutral badge, never a crash.
 */
type AnyStatus = QuestionStatus | 'review' | (string & {})

export type BadgeColor = 'success' | 'warning' | 'error' | 'neutral'

interface StatusMeta {
  label: string
  ds: DsStatus
  color: BadgeColor
}

const STATUS_META: Record<string, StatusMeta> = {
  draft: { label: 'Draf', ds: 'draft', color: 'neutral' },
  pending_review: { label: 'Menunggu Semakan', ds: 'awaiting-review', color: 'warning' },
  review: { label: 'Menunggu Semakan', ds: 'awaiting-review', color: 'warning' },
  approved: { label: 'Diluluskan', ds: 'approved', color: 'success' },
  rejected: { label: 'Ditolak', ds: 'rejected', color: 'error' },
  archived: { label: 'Diarkibkan', ds: 'inactive', color: 'neutral' },
  pending: { label: 'Menunggu', ds: 'pending-approval', color: 'warning' },
}

const UNKNOWN_STATUS: StatusMeta = { label: 'Tidak diketahui', ds: 'draft', color: 'neutral' }

const metaOf = (status: AnyStatus | null | undefined): StatusMeta =>
  (status != null && Object.hasOwn(STATUS_META, status) ? STATUS_META[status] : undefined) ??
  UNKNOWN_STATUS

/** S1 status pill (BR-M04-02; archived is "Arkib" in the list, "Diarkibkan" on S3, as live). */
export const statusLabel = (status: AnyStatus, short = false): string =>
  short && status === 'archived'
    ? 'Arkib'
    : status === 'approved' && isHttpMode()
      ? 'Diterbitkan' // ADR-0027: in the real API `approved` is the published (served) state
      : metaOf(status).label

/** `DsStatusBadge` status of a question status; the live word is passed as the badge label. */
export const statusDs = (status: AnyStatus): DsStatus => metaOf(status).ds

/** `UBadge` colour of a status (staff theme: tokens only, the word carries the meaning). */
export const statusColor = (status: AnyStatus): BadgeColor => metaOf(status).color

const COMPLIANCE_COLOR: Record<ComplianceStatus, BadgeColor> = {
  verified: 'success',
  pending_mapping: 'warning',
  quarantined: 'error',
  rejected: 'error',
  draft: 'neutral',
}
export const complianceColor = (status: ComplianceStatus | (string & {})): BadgeColor =>
  (Object.hasOwn(COMPLIANCE_COLOR, status) ? COMPLIANCE_COLOR[status as ComplianceStatus] : undefined) ??
  'neutral'

export const LANGUAGE_LABELS: Record<string, string> = { bm: 'Bahasa Melayu', en: 'English' }

export const TYPE_ANSWER_HEADINGS: Record<Exclude<QuestionType, 'mcq'>, string> = {
  true_false: 'Jawapan Betul / Salah',
  short_answer: 'Jawapan Pendek',
  fill_blank: 'Jawapan Isi Tempat Kosong',
  essay: 'Jawapan Contoh (Esei)',
}

/**
 * DSKP lines on S3 are cut with "..." (FN-M04-1.5.5). The cut length 60 is INFERRED from the observed
 * lines ("...Satelit berdasarkan buku teks..." and "...aplikasi Bab 9..." are 60 characters of text).
 */
export function cut(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}...` : text
}

/** The error text of a failed reply, as the live `fetch(...).then(r => r.json())` script builds it. */
export function errorTextOf(reply: { status: number; body: unknown }): string {
  let data: unknown = reply.body
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch (err) {
      return (err instanceof Error && err.message) || 'Gagal jana penjelasan'
    }
  }
  const message =
    typeof data === 'object' && data !== null ? (data as { message?: unknown }).message : undefined
  return typeof message === 'string' && message !== '' ? message : `HTTP ${String(reply.status)}`
}

/**
 * http mode: the lines for questions the API left untouched (it gives no per-question reason, see
 * `bulkQuestionAction`). One line per question; `updated` is the affected count.
 */
export function notUpdatedLines(updated: number, ids: readonly number[], verb: string): string[] {
  return [
    `${String(updated)} soalan berjaya dikemaskini, ${String(ids.length)} tidak dikemaskini.`,
    ...ids.map(
      (id) =>
        `Soalan #${String(id)} tidak dapat ${verb}: syarat belum dipenuhi atau peralihan status tidak dibenarkan.`,
    ),
  ]
}
