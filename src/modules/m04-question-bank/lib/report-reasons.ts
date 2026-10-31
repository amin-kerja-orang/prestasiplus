/**
 * The report reason sets (SRS DATA-M04-10, BR-M04-15, FN-M04-3.1.4 / 3.1.5), the status labels
 * (BR-M04-14) and the category mapping (BR-M04-15). Pure data: shared by the mock handlers (labels in
 * the ReportView), the S14 modal, S7 and S13.
 */

import type { DsStatus } from '@/ds'

export type ReportVariant = 'mcq' | 'structured'

export type ReportTint =
  'default' | 'red' | 'amber' | 'orange' | 'yellow' | 'blue' | 'indigo' | 'slate'

export interface ReportReason {
  value: string
  label: string
  description: string
  /** Default ticked tint (FR-M04-65); `default` = the neutral ticked style (INFERRED). */
  tint: ReportTint
}

export const MCQ_REASON_SET: readonly ReportReason[] = [
  {
    value: 'wrong_answer',
    label: 'Jawapan tidak tepat',
    description: 'Jawapan yang ditandakan betul sebenarnya salah',
    tint: 'red',
  },
  {
    value: 'confusing_question',
    label: 'Soalan mengelirukan',
    description: 'Ayat soalan tidak jelas atau mengelirukan',
    tint: 'amber',
  },
  {
    value: 'wrong_options',
    label: 'Set jawapan tidak tepat',
    description: 'Pilihan jawapan yang diberikan tidak betul',
    tint: 'orange',
  },
  {
    value: 'missing_options',
    label: 'Pilihan jawapan tidak lengkap',
    description: 'Soalan tiada cukup pilihan jawapan',
    tint: 'default',
  },
  {
    value: 'duplicate',
    label: 'Soalan berulang / pendua',
    description: 'Soalan yang sama muncul lebih dari sekali',
    tint: 'default',
  },
  {
    value: 'typo',
    label: 'Kesalahan ejaan / taip',
    description: 'Ada kesilapan ejaan dalam soalan atau jawapan',
    tint: 'indigo',
  },
  {
    value: 'other',
    label: 'Lain-lain',
    description: 'Sebab lain yang tidak disenaraikan',
    tint: 'slate',
  },
]

export const STRUCTURED_REASON_SET: readonly ReportReason[] = [
  {
    value: 'wrong_answer',
    label: 'Skema jawapan tidak tepat',
    description: 'Keyword/rubrik yang ditandakan tidak sepadan dengan jawapan sebenar',
    tint: 'red',
  },
  {
    value: 'confusing_question',
    label: 'Soalan mengelirukan',
    description: 'Ayat soalan atau arahan tidak jelas',
    tint: 'amber',
  },
  {
    value: 'wrong_options',
    label: 'Markah tidak adil',
    description: 'Pembahagian markah atau pemarkahan auto tidak tepat',
    tint: 'orange',
  },
  {
    value: 'typo',
    label: 'Kesalahan ejaan / taip',
    description: 'Ada kesilapan ejaan dalam soalan atau skema',
    tint: 'indigo',
  },
  {
    value: 'other',
    label: 'Lain-lain',
    description: 'Sebab lain yang tidak disenaraikan',
    tint: 'slate',
  },
]

export function reasonSet(variant: ReportVariant): readonly ReportReason[] {
  return variant === 'mcq' ? MCQ_REASON_SET : STRUCTURED_REASON_SET
}

/** `outdated` is sent only by the M10 teacher databank (BR-M04-15), never offered in the modal. */
const OUTDATED_LABEL = 'Soalan sudah tidak relevan'

/**
 * The pill label of a stored reason (DV-M04-08): the question type's set; `outdated`; legacy
 * `unclear` = "Soalan mengelirukan"; any other (legacy free) text as it is.
 */
export function reasonLabel(variant: ReportVariant, reason: string): string {
  const hit = reasonSet(variant).find((r) => r.value === reason)
  if (hit) return hit.label
  if (reason === 'outdated') return OUTDATED_LABEL
  if (reason === 'unclear') return 'Soalan mengelirukan'
  return reason
}

export type ReportCategory = 'Jawapan Salah' | 'Tak Jelas' | 'Lain-lain'

/** Category badge from the first reason (BR-M04-15). */
export function reportCategory(reasons: readonly string[]): ReportCategory {
  const first = reasons[0]
  if (first === 'wrong_answer' || first === 'wrong_options') return 'Jawapan Salah'
  if (first === 'confusing_question' || first === 'unclear') return 'Tak Jelas'
  return 'Lain-lain'
}

export type ReportStatus = 'pending' | 'reviewed' | 'fixed' | 'dismissed'
/** BR-M04-14: `removed` = fixed, the question exists and is inactive ("Dikeluarkan"). */
export type ReportDisplayStatus = ReportStatus | 'removed'

export const DISPLAY_STATUS_LABEL: Record<ReportDisplayStatus, string> = {
  pending: 'Menunggu',
  reviewed: 'Disemak',
  fixed: 'Diperbaiki',
  removed: 'Dikeluarkan',
  dismissed: 'Ditolak',
}

/** `DsStatusBadge` status of a report status (icon and colour); the live word is the badge label. */
export const DISPLAY_STATUS_DS: Record<ReportDisplayStatus, DsStatus> = {
  pending: 'awaiting-review',
  reviewed: 'in-progress',
  fixed: 'done',
  removed: 'rejected',
  dismissed: 'inactive',
}

export const REPORT_FILTERS = ['pending', 'reviewed', 'fixed', 'dismissed', 'all'] as const
export type ReportFilter = (typeof REPORT_FILTERS)[number]

/** The notes S7 sends for "Tolak & Aktifkan Semula" and "Nyahaktif Segera" (FN-M04-3.2.14 / 3.2.15). */
export const DISMISS_NOTE = 'Soalan dan jawapan disemak — tiada masalah'
export const DEACTIVATE_NOTE = 'Dinyahaktifkan segera oleh admin'
/** The note S7 sends for "Arkib" (R1-B17); the server stores the lifecycle reason itself. */
export const ARCHIVE_NOTE = 'Diarkibkan oleh admin'

export const REPORT_COMMENT_MAX = 500
export const REPORT_NOTES_MAX = 1000

/** S14 network-failure text (FR-M04-69; the `failureText` prop default). */
export const REPORT_FAILURE_TEXT = 'Ralat. Sila cuba lagi.'
