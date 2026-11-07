/** Kiriman Guru status copy and mapping (FR-ADM-Q12.1, 40 OPT-KIRIMAN-STATUS, field 12-01). */

import type { IntakeItemRow, IntakeKirimanStatus } from '@pp/contract'

import type { DsStatus } from '@/ds'

export type SubmissionStatus = Exclude<IntakeKirimanStatus, 'Jumlah'>

export const SUBMISSION_STATUS_OPTIONS: readonly SubmissionStatus[] = [
  'Pending',
  'Processing',
  'Selesai',
  'Ditolak',
]

/** `DsStatusBadge` status of a submission status (icon and colour come from the badge). */
export const SUBMISSION_STATUS_DS: Record<SubmissionStatus, DsStatus> = {
  Selesai: 'done',
  Processing: 'in-progress',
  Pending: 'awaiting-review',
  Ditolak: 'rejected',
}

/** The status of one row: `Terima` moves it to `Processing`, and only an approved question to `Selesai`. */
export function submissionStatusOf(row: Pick<IntakeItemRow, 'state' | 'question'>): SubmissionStatus {
  if (row.state === 'rejected') return 'Ditolak'
  if (row.state !== 'accepted') return 'Pending'
  return row.question?.status === 'approved' ? 'Selesai' : 'Processing'
}
