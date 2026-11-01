import { describe, expect, it } from 'vitest'

import { intakeBadge, WIRE_TONE } from '../admin/intake/lib/intake-badge'

describe('intakeBadge (R1E2E-C1)', () => {
  it('maps each wire status to its tone and shows the wire BM label', () => {
    expect(WIRE_TONE).toEqual({
      submitted: 'pending-approval',
      processing: 'in-progress',
      ready_for_review: 'awaiting-review',
      failed: 'rejected',
      cancelled: 'inactive',
    })
    expect(intakeBadge({ status: 'draf', batchStatus: 'failed', statusLabel: 'Gagal' })).toEqual({ status: 'rejected', label: 'Gagal' })
    expect(intakeBadge({ status: 'draf', batchStatus: 'ready_for_review', statusLabel: 'Sedia untuk semakan' })).toEqual({
      status: 'awaiting-review',
      label: 'Sedia untuk semakan',
    })
  })
  it('falls back to Draf / Semakan without a wire status (mock)', () => {
    expect(intakeBadge({ status: 'draf' })).toEqual({ status: 'draft', label: 'Draf' })
    expect(intakeBadge({ status: 'semakan' })).toEqual({ status: 'awaiting-review', label: 'Semakan' })
  })
})
