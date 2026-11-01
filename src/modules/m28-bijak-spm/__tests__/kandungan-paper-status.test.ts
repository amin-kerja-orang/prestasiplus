/** Lane "Bijak SPM" offers and labels all four paper statuses of the API (REQ-A-022). */
import { SERVABILITY_PAPER_STATUSES } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { PAPER_STATUS_OPTIONS, paperStatusBadge, paperStatusLabel } from '../admin/kandungan/lanes'
import type { AdminPaperSummary } from '../domain/admin-types'
import { bijakAdminServer } from '../server/client'
import { createMockKandungan, laneStatusOf } from '../admin/kandungan/local-kandungan'

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

  it('the mock lane gives unpublished papers draft, ready, withdrawn in turn and published papers published', () => {
    const paper = (id: string, status: 'draf' | 'terbit') => ({ id, status }) as AdminPaperSummary
    const m = laneStatusOf([paper('a', 'draf'), paper('b', 'terbit'), paper('c', 'draf'), paper('d', 'draf'), paper('e', 'draf')])
    expect([...m.values()]).toEqual(['draft', 'published', 'ready', 'withdrawn', 'draft'])
  })

  it('the mock lane returns and filters every unpublished status, and the filters partition the rows', async () => {
    const admin = bijakAdminServer()
    await admin.createPaper({ subject: 'MAT', kertas: 1 })
    await admin.createPaper({ subject: 'MAT', kertas: 2 })
    const api = createMockKandungan()
    const all = await api.paperLane({ page: 1, pageSize: 100000 })
    let sum = 0
    for (const status of SERVABILITY_PAPER_STATUSES) {
      const r = await api.paperLane({ status, page: 1, pageSize: 100000 })
      expect(r.rows.every((x) => x.status === status)).toBe(true)
      if (status !== 'published') expect(r.rows.length, status).toBeGreaterThan(0)
      sum += r.total
    }
    expect(sum).toBe(all.total)
    expect((await api.paperLane({ page: 1, pageSize: 100000 })).rows.map((x) => x.status)).toEqual(all.rows.map((x) => x.status))
  })
})
