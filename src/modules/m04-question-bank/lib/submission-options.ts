/** S10 status copy (FN-M04-5.1.2, 5.1.5; SRS §8). Pending and rejected pills are INFERRED. */

import type { DsStatus } from '@/ds'

import type { SubmissionStatus } from '../api/submissions'

export const SUBMISSION_STATUS_OPTIONS: { value: SubmissionStatus; label: string }[] = [
  { value: 'pending', label: 'Menunggu Semakan' },
  { value: 'processing', label: 'Sedang Diproses' },
  { value: 'done', label: 'Selesai' },
  { value: 'rejected', label: 'Ditolak' },
]

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: 'Menunggu Semakan',
  processing: 'Sedang Diproses',
  done: 'Selesai',
  rejected: 'Ditolak',
}

/**
 * `DsStatusBadge` status of a submission status (icon and colour come from the badge). The live
 * words "Pending" and "Processing" are passed as the badge label (live exception, discovery M04 S10).
 */
export const SUBMISSION_STATUS_DS: Record<SubmissionStatus, DsStatus> = {
  done: 'done',
  processing: 'in-progress',
  pending: 'awaiting-review',
  rejected: 'rejected',
}
