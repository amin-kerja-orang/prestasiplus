/**
 * S1 question list and S3 detail helpers (M04-T3; SRS FR-M04-01..16, 37..47). Labels and full class
 * strings are finite lookup maps (overview §8.2 rule 2).
 */

import type { DsStatus } from '@/ds'

import { isHttpMode } from '@/api'

import { mathmlToLatex } from './mathml'

import {
  NO_WIRE_BULK_ACTIONS,
  NO_WIRE_STATUS_FILTERS,
  type BulkAction,
  type ComplianceStatus,
  type QuestionStatus,
  type QuestionType,
} from '../api/questions'

export const QUESTIONS_LIST_PATH = '/admin/questions'
export const QUESTIONS_CREATE_PATH = '/admin/studio/questions/create'

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
  { value: 'verified_generated', label: 'AI Verified' },
  { value: 'pending_mapping', label: 'Pending Mapping' },
  { value: 'missing_source', label: 'Tiada Source PDF' },
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
export function excerpt(raw: string): string {
  // A migrated question's baked MathML would print as markup: read it as its LaTeX source before cutting.
  const text = mathmlToLatex(raw)
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

export const LANGUAGE_LABELS: Record<string, string> = { ms: 'Bahasa Melayu', en: 'English', 'ms+en': 'BM + English (dwibahasa)' }

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

/**
 * REQ-A-023: the lines for the questions the API refused (`failed[]`): the count line, then one line per question with the server's own
 * text (no local copy of it). A row without a message falls back to the generic notUpdated wording.
 */
export function failedLines(
  updated: number,
  rows: readonly { id: number; message: string }[],
  verb: string,
): string[] {
  return [
    `${String(updated)} soalan berjaya dikemaskini, ${String(rows.length)} tidak dikemaskini.`,
    ...rows.map((r) =>
      r.message !== ''
        ? `Soalan #${String(r.id)}: ${r.message}`
        : `Soalan #${String(r.id)} tidak dapat ${verb}: syarat belum dipenuhi atau peralihan status tidak dibenarkan.`,
    ),
  ]
}

/** [PROPOSED] UX-80: shown after "Jana Penjelasan AI" on an approved or archived question; the AI text went to a new draft version. */
export const AI_DRAFT_NOTICE = 'Penjelasan AI disimpan sebagai draf baharu. Semak dan terbitkan draf itu.'

/* ---- the regroup work-list (R1-ADM-QE-08, PRD45 6.6; API-Q-13 `RegroupWorklistRow` / `RegroupWorklistMeta` of packages/contract/src/questions/regroup.ts). ---- */

export const REGROUP_TAB = 'regroup'
export const REGROUP_PATH = '/admin/questions/regroup'

export const REGROUP_COPY = {
  empty: 'Tiada soalan perlu dikumpulkan semula.',
  subject: 'Subjek',
  level: 'Tingkatan',
  flag: 'Sebab',
  /** PRD45 6.6.2 and PRD30 QE-08: the dismiss confirm. */
  dismissConfirm: 'Tandakan sebagai bukan masalah?',
  dismissYes: 'Ya, Tandakan',
  cancel: 'Batal',
  notConsecutive: 'Pilih baris yang berturutan sahaja.',
  /** PRD45 6.6.3 (R1 copy, D113); the same text the API answers with. */
  undoConflict: 'Kumpulan telah diubah selepas kumpul semula; tidak boleh dibuat asal.',
} as const

export const REGROUP_FLAGS = ['stimulus_missing', 'figure_only', 'stem_duplicated'] as const
export type RegroupFlag = (typeof REGROUP_FLAGS)[number]

/**
 * `Sebab` of a work-list row and the options of its filter: BM words taken from the existing reason sentences of the contract
 * (`SERVABILITY_REASON_MS`: `stimulus_missing` "Rangsangan tiada...", `figure_only` "...hanya mengandungi rangsangan"); V2 has no regroup list.
 */
export const REGROUP_FLAG_LABELS: Readonly<Record<RegroupFlag, string>> = {
  stimulus_missing: 'Rangsangan tiada',
  figure_only: 'Hanya rangsangan',
  stem_duplicated: 'Teks soalan berulang',
}

/** The BM `Sebab` of a flag; an unknown code is shown as it is. */
export const regroupFlagLabel = (flag: string): string => (REGROUP_FLAG_LABELS as Record<string, string>)[flag] ?? flag

export interface RegroupWorkRow {
  questionId: string
  numberLabel: string | null
  stemExcerpt: string
  subject: string
  level: string
  flag: RegroupFlag
  /** `Rujukan`: numbered ("bernombor") or unnumbered ("tanpa nombor"); null when the detector stored none. */
  reference: 'numbered' | 'unnumbered' | null
  paper: { id: string; paperCode: string | null; year: number | null; examType: string | null } | null
}

export interface RegroupCounts {
  /** Keyed by subject id / education level id. */
  bySubject: Record<string, number>
  byLevel: Record<string, number>
  byFlag: { stimulus_missing: number; figure_only: number; stem_duplicated: number }
  open: number
  done: number
}

/** "{n} perlu tindakan · {m} selesai" (PRD45 6.6.2). */
export const regroupHeader = (open: number, done: number): string => `${String(open)} perlu tindakan · ${String(done)} selesai`

/** `Rujukan` (PRD45 6.6.2): `bernombor` or "tanpa nombor", a dash when none is stored. */
export function regroupReference(row: Pick<RegroupWorkRow, 'reference'>): string {
  if (row.reference === 'unnumbered') return 'tanpa nombor'
  return row.reference === 'numbered' ? 'bernombor' : '—'
}

/** `Kertas sumber` and number: paper code, exam type and year, then "No. n". */
export function regroupSource(row: Pick<RegroupWorkRow, 'paper' | 'numberLabel'>): string {
  const p = row.paper
  const paper =
    p === null
      ? '—'
      : [p.paperCode, p.examType, p.year === null ? null : `(${String(p.year)})`].filter((x): x is string => x !== null && x !== '').join(' ') || '—'
  return row.numberLabel === null ? paper : `${paper} · No. ${row.numberLabel}`
}

/**
 * "Pilih baris yang berturutan sahaja." (PRD45 6.6.2): the selected rows share one source paper and their numbers are whole numbers
 * with no gap. Fewer than one row, a row with no paper or a non-numeric number is not a run.
 * Labels such as "14a" or "3(a)" are refused on purpose: they name a sub-part, so "next number" is undefined (is 14b after 14a, or 15?)
 * and a guess could group questions that are not neighbours. The admin groups those through Studio. Pending lead confirmation.
 */
export function isConsecutiveRun(rows: readonly Pick<RegroupWorkRow, 'paper' | 'numberLabel'>[]): boolean {
  if (rows.length === 0) return false
  const paperId = rows[0]?.paper?.id
  if (paperId === undefined) return false
  const numbers: number[] = []
  for (const r of rows) {
    if (r.paper?.id !== paperId || r.numberLabel === null || !/^\d+$/.test(r.numberLabel)) return false
    numbers.push(Number.parseInt(r.numberLabel, 10))
  }
  numbers.sort((x, y) => x - y)
  return numbers.every((n, i) => i === 0 || n === (numbers[i - 1] ?? 0) + 1)
}
