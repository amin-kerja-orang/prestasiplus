import { describe, expect, it } from 'vitest'

import { intakeBadge, WIRE_TONE } from '../admin/intake/lib/intake-badge'

describe('intakeBadge (R1E2E-C1)', () => {
  it('maps each wire status to its tone and shows the wire BM label', () => {
    expect(WIRE_TONE).toEqual({
      submitted: 'pending-approval',
      processing: 'in-progress',
      ready_for_review: 'awaiting-review',
      selesai_dengan_ralat: 'awaiting-review',
      failed: 'rejected',
      cancelled: 'inactive',
    })
    expect(intakeBadge({ status: 'draf', batchStatus: 'failed', statusLabel: 'Gagal' })).toEqual({ status: 'rejected', label: 'Gagal' })
    expect(intakeBadge({ status: 'draf', batchStatus: 'ready_for_review', statusLabel: 'Selesai' })).toEqual({
      status: 'awaiting-review',
      label: 'Selesai',
    })
  })
  it('shows the partly failed batch as Selesai dengan ralat', () => {
    expect(intakeBadge({ status: 'draf', batchStatus: 'selesai_dengan_ralat', statusLabel: 'Selesai dengan ralat' })).toEqual({
      status: 'awaiting-review',
      label: 'Selesai dengan ralat',
    })
  })
  it('falls back to Draf / Semakan without a wire status (mock)', () => {
    expect(intakeBadge({ status: 'draf' })).toEqual({ status: 'draft', label: 'Draf' })
    expect(intakeBadge({ status: 'semakan' })).toEqual({ status: 'awaiting-review', label: 'Semakan' })
  })
})
