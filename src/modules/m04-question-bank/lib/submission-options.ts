/** S10 status copy (FN-M04-5.1.2, 5.1.5; SRS §8). Pending and rejected pills are INFERRED. */

import type { SubmissionStatus } from '../api/submissions'

export const SUBMISSION_STATUS_OPTIONS: { value: SubmissionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'done', label: 'Selesai' },
  { value: 'rejected', label: 'Ditolak' },
]

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  done: 'Selesai',
  rejected: 'Ditolak',
}

/** `UBadge` colour and icon of a status (staff theme; the word carries the meaning). */
export const SUBMISSION_STATUS_COLOR: Record<SubmissionStatus, 'success' | 'info' | 'warning' | 'error'> = {
  done: 'success',
  processing: 'info',
  pending: 'warning',
  rejected: 'error',
}

export const SUBMISSION_STATUS_ICON: Record<SubmissionStatus, string> = {
  done: 'i-ph-check-circle',
  processing: 'i-ph-gear',
  pending: 'i-ph-clock',
  rejected: 'i-ph-x-circle',
}
