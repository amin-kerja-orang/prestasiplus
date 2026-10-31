/**
 * Studio status flow and "Dilihat murid di" (R1-F03a, T13 unit 2b). Pure copy and rules for the list and the status bar of the
 * edit page. V2 words are verbatim (parity doc S1 to S14, design S1.1, S1.3, 9.2); a PROPOSED label is marked.
 * Wire statuses are the lifecycle codes of ADR-0027: draft, review, approved, archived.
 */
import type { QuestionGateIssue, ServabilityReport } from '@pp/contract'

export type StudioStatus = 'draft' | 'review' | 'approved' | 'archived'

/** The V2 badge words (admin.md A01/A03): Draft, Reviewed, Approved, Archived. */
export const STATUS_BADGE: Readonly<Record<StudioStatus, string>> = {
  draft: 'Draft',
  review: 'Reviewed',
  approved: 'Approved',
  archived: 'Archived',
}

export const STATUS_ORDER: readonly StudioStatus[] = ['draft', 'review', 'approved', 'archived']

export const isStudioStatus = (s: string): s is StudioStatus => (STATUS_ORDER as readonly string[]).includes(s)

/** Badge word of a wire status; an unknown code is shown as it is (never hidden). */
export const statusBadge = (s: string): string => (isStudioStatus(s) ? STATUS_BADGE[s] : s)

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning'
export const statusTone = (s: string): BadgeTone =>
  s === 'approved' ? 'success' : s === 'review' ? 'warning' : s === 'archived' ? 'neutral' : 'info'

/** Status bar sentence (design S1.3 table); Reviewed and Archived are PROPOSED there. */
export const STATUS_TEXT: Readonly<Record<StudioStatus, string>> = {
  draft: 'Belum dipapar kepada pelajar.',
  review: 'Menunggu keputusan penerbitan.',
  approved: 'Soalan ini boleh dijawab oleh pelajar.',
  archived: 'Tidak dipapar kepada pelajar.',
}

export const APPROVED_NOTE = 'Soalan ini telah diterbitkan. Gunakan "Edit sebagai draf" untuk menyuntingnya.'

export const FLASH = {
  submitted: 'Soalan dihantar untuk semakan.',
  published: 'Soalan diterbitkan — kini boleh dijawab oleh pelajar.',
  archived: 'Soalan diarkibkan — tidak lagi dipapar kepada pelajar.',
  /** [PROPOSED] the two moves back to draft have no V2 flash. */
  backToDraft: 'Soalan dikembalikan ke draf.',
  restored: 'Soalan dipulihkan ke draf.',
} as const

/** V2 flash of "Edit sebagai draf". */
export const draftCreatedFlash = (id: string): string =>
  `Draf baharu #${id} dicipta. Soalan asal kekal diterbitkan sehingga draf ini diterbitkan.`

export const GATE_HEADING = 'Soalan belum boleh diterbitkan — sila betulkan isu di bawah.'
export const UNSAVED_HINT = 'Simpan draf dahulu — perubahan belum disimpan.'

/**
 * The reasons sent with the two moves that need one in the lifecycle table (approved to archived, review to draft). V2 asks for
 * none (the Panel dialog has no reason field), so Studio sends a fixed sentence and the audit row still has a reason (UX-18).
 */
export const REASON = {
  archive: 'Disembunyikan dari Studio.',
  backToDraft: 'Dikembalikan ke draf dari Studio.',
} as const

export const ARCHIVE_DIALOG = {
  title: 'Arkibkan soalan ini?',
  confirm: 'Sembunyikan',
  cancel: 'Batal',
} as const

/** Archive dialog body, with the effect line of design S3.1 (AC-04.4) when the count is known. */
export const archiveBody = (servedIn: number | null): string =>
  servedIn === null || servedIn <= 0
    ? 'Soalan ini akan disembunyikan daripada murid.'
    : `Soalan ini akan hilang daripada ${String(servedIn)} aktiviti.`

export type StatusAction = 'review' | 'approved' | 'archived' | 'draft' | 'edit-as-draft'

export interface StatusButton {
  action: StatusAction
  label: string
  /** `true` for the main move of the state (solid button). */
  primary: boolean
}

/**
 * Buttons of the status bar per state (design S1.3). Review has no "Arkib": the lifecycle table has no review-to-archived pair
 * (draft, approved and archived only), so it offers "Kembali ke draf" first (UX-18).
 */
export function statusButtons(status: string): StatusButton[] {
  switch (status) {
    case 'draft':
      return [
        { action: 'review', label: 'Hantar untuk semakan', primary: true },
        { action: 'archived', label: 'Arkib', primary: false },
      ]
    case 'review':
      return [
        { action: 'approved', label: 'Terbitkan', primary: true },
        { action: 'draft', label: 'Kembali ke draf', primary: false },
      ]
    case 'approved':
      return [
        { action: 'edit-as-draft', label: 'Edit sebagai draf', primary: true },
        { action: 'archived', label: 'Arkib', primary: false },
      ]
    case 'archived':
      return [{ action: 'draft', label: 'Pulihkan ke draf', primary: true }]
    default:
      return []
  }
}

/** Flash of a finished move, by (from, to). */
export function moveFlash(from: string, to: StatusAction): string {
  if (to === 'review') return FLASH.submitted
  if (to === 'approved') return FLASH.published
  if (to === 'archived') return FLASH.archived
  return from === 'archived' ? FLASH.restored : FLASH.backToDraft
}

/** Only these statuses can be hidden from the list row ("Sembunyikan"). */
export const canArchive = (status: string): boolean => status === 'draft' || status === 'approved'

/* ---- approval refusal (S14) ---------------------------------------------------------------------- */

export const STEP_NAMES: Readonly<Record<number, string>> = { 1: 'Langkah 1', 2: 'Langkah 2', 3: 'Langkah 3', 4: 'Langkah 4' }

/** One line per gap: the server sentence, then the wizard step in muted text (design S1.3). */
export function gateLines(issues: readonly QuestionGateIssue[]): { text: string; step: string }[] {
  return issues.map((i) => ({ text: i.message, step: STEP_NAMES[i.step] ?? '' }))
}

/* ---- "Dilihat murid di" (S13) -------------------------------------------------------------------- */

export const SERVED_TITLE = 'Dilihat murid di'
export const SERVED_YES = 'Boleh dilihat'
export const SERVED_NO = 'Tidak boleh dilihat'

/** Status bar sentence: "Dilihat murid di 5 daripada 6 aktiviti". */
export const servedSummary = (r: Pick<ServabilityReport, 'servedCount' | 'total'>): string =>
  `${SERVED_TITLE} ${String(r.servedCount)} daripada ${String(r.total)} aktiviti`

/** List caption under the badge: "Dilihat murid di 5/6". */
export const servedCaption = (r: Pick<ServabilityReport, 'servedCount' | 'total'>): string =>
  `${SERVED_TITLE} ${String(r.servedCount)}/${String(r.total)}`

export interface ServedRow {
  activity: string
  label: string
  served: boolean
  reason: string
}

/** One row per activity: the label, Boleh / Tidak boleh dilihat and, when not served, the first (main) reason. */
export function servedRows(r: ServabilityReport): ServedRow[] {
  return r.activities.map((a) => ({
    activity: a.activity,
    label: a.label,
    served: a.served,
    reason: a.served ? '' : (a.reasons[0]?.message ?? ''),
  }))
}
