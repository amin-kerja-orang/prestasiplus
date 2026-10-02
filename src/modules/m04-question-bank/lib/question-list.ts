/**
 * S1 question list and S3 detail helpers (M04-T3; SRS FR-M04-01..16, 37..47). Labels and full class
 * strings are finite lookup maps (overview §8.2 rule 2).
 */

import type { BulkAction, ComplianceStatus, QuestionStatus, QuestionType } from '../api/questions'

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
  { value: 'reject', label: 'Tolak', verb: 'menolak' },
  { value: 'archive', label: 'Arkibkan', verb: 'mengarkibkan' },
  { value: 'delete', label: 'Padam', verb: 'memadamkan' },
]

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

const PILL = 'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

/** S1 status pill (BR-M04-02; archived is "Arkib" in the list, "Diarkibkan" on S3, as live). */
const STATUS_LABEL: Record<QuestionStatus, string> = {
  draft: 'Draf',
  pending_review: 'Menunggu Semakan',
  approved: 'Diluluskan',
  rejected: 'Ditolak',
  archived: 'Diarkibkan',
  pending: 'Menunggu',
}
export const statusLabel = (status: QuestionStatus, short = false): string =>
  short && status === 'archived' ? 'Arkib' : STATUS_LABEL[status]

const STATUS_CLASS: Record<QuestionStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  archived: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-700',
}
export const statusClass = (status: QuestionStatus): string => `${PILL} ${STATUS_CLASS[status]}`

const COMPLIANCE_CLASS: Record<ComplianceStatus, string> = {
  verified: 'bg-emerald-100 text-emerald-700',
  pending_mapping: 'bg-amber-100 text-amber-700',
  quarantined: 'bg-red-100 text-red-700',
  rejected: 'bg-red-100 text-red-700',
  draft: 'bg-slate-100 text-slate-600',
}
export const complianceClass = (status: ComplianceStatus): string =>
  `inline-block rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${COMPLIANCE_CLASS[status]}`

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
