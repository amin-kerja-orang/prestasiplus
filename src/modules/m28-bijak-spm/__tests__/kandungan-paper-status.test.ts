/** Lane "Bijak SPM" offers and labels all four paper statuses of the API (REQ-A-022). */
import { SERVABILITY_PAPER_STATUSES } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { PAPER_STATUS_OPTIONS, paperStatusBadge, paperStatusLabel } from '../admin/kandungan/lanes'
import { createMockKandungan } from '../admin/kandungan/local-kandungan'

describe('paper lane statuses', () => {
  it('has one option per API status, in API order, with BM labels', () => {
    expect(PAPER_STATUS_OPTIONS.map((o) => o.value)).toEqual([...SERVABILITY_PAPER_STATUSES])
    expect(PAPER_STATUS_OPTIONS.map((o) => o.label)).toEqual(['Draf', 'Sedia', 'Terbit', 'Ditarik balik'])
    expect(paperStatusLabel('ready')).toBe('Sedia')
    expect(paperStatusLabel('withdrawn')).toBe('Ditarik balik')
    expect(paperStatusLabel('zzz')).toBe('zzz')
  })

  it('gives each status a badge look', () => {
    expect(SERVABILITY_PAPER_STATUSES.map(paperStatusBadge)).toEqual(['draft', 'awaiting-review', 'published', 'inactive'])
  })

  it('the mock lane only returns the statuses the mock store has (draft, published) and its filter partitions the rows', async () => {
    const api = createMockKandungan()
    const all = await api.paperLane({ page: 1, pageSize: 100000 })
    expect(all.rows.every((x) => x.status === 'draft' || x.status === 'published')).toBe(true)
    let sum = 0
    for (const status of SERVABILITY_PAPER_STATUSES) {
      const r = await api.paperLane({ status, page: 1, pageSize: 100000 })
      expect(r.rows.every((x) => x.status === status)).toBe(true)
      sum += r.total
    }
    expect(sum).toBe(all.total)
  })
})
