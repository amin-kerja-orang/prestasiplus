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

export const SUBMISSION_PILL_CLASS: Record<SubmissionStatus, string> = {
  done: 'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
}
