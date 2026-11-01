/** Status badge of an intake batch: the wire BM label and tone in http mode, Draf / Semakan in the mock. */
import type { DsStatus } from '@/ds/status'

import type { IntakeBatch, IntakeSummary } from '../types'

type Badged = Pick<IntakeSummary | IntakeBatch, 'status' | 'batchStatus' | 'statusLabel'>

export const WIRE_TONE: Record<NonNullable<Badged['batchStatus']>, DsStatus> = {
  submitted: 'pending-approval',
  processing: 'in-progress',
  ready_for_review: 'awaiting-review',
  failed: 'rejected',
  cancelled: 'inactive',
}

export function intakeBadge(r: Badged): { status: DsStatus; label: string } {
  return {
    status: r.batchStatus ? WIRE_TONE[r.batchStatus] : r.status === 'draf' ? 'draft' : 'awaiting-review',
    label: r.statusLabel ?? (r.status === 'draf' ? 'Draf' : 'Semakan'),
  }
}
