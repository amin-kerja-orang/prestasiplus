import { SchoolAdminDashboardSchema } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { performanceBlock } from '../../src/modules/school-admin/dashboard.mapper'
import { currentSubscriptionStatus } from '../../src/modules/school-admin/dashboard.service'
import { emptyView } from './helpers'

const wrap = (performance: ReturnType<typeof performanceBlock>) => performance

describe('dashboard mapper: BE-19 view into the dashboard performance block', () => {
  it('the empty view is the empty aggregate: null accuracy (never 0 %), both levels at 0, no distribution', () => {
    const p = wrap(performanceBlock(emptyView()))
    expect(p.practice).toEqual({ accuracy: null, sessions: 0, questions: 0 })
    expect(p.levels).toEqual([
      { code: 't4', name: 'Tingkatan 4', accuracy: 0 },
      { code: 't5', name: 'Tingkatan 5', accuracy: 0 },
    ])
    expect(p.distribution).toEqual([])
    expect(p.total).toBe(0)
    expect(p.risk).toBeNull()
    expect(p.gps).toEqual({ value: null, grade: null, band: null, entries: 0 })
  })

  it('passes BE-19 figures through untouched when every group has 5 or more pupils', () => {
    const p = performanceBlock(
      emptyView({
        stats: { students: 30, sessions: 41, answered: 600, accuracy: 72.5 },
        levels: [
          { code: 't4', accuracy: 70.1, students: 15 },
          { code: 't5', accuracy: 75, students: 15 },
        ],
        distribution: [
          { grade: 'A', count: 10, pct: 40 },
          { grade: 'B', count: 15, pct: 60 },
        ],
      }),
    )
    expect(p.practice).toEqual({ accuracy: 72.5, sessions: 41, questions: 600 })
    expect(p.levels.map((l) => l.accuracy)).toEqual([70.1, 75])
    expect(p.total).toBe(25)
    expect(p.gps).toEqual({ value: null, grade: null, band: null, entries: 0 })
  })

  it('k = 5: a level, a grade cell, the GPS and the whole practice block under 5 pupils are suppressed', () => {
    const p = performanceBlock(
      emptyView({
        stats: { students: 4, sessions: 9, answered: 90, accuracy: 55 },
        levels: [
          { code: 't4', accuracy: 60, students: 4 },
          { code: 't5', accuracy: 80, students: 5 },
        ],
        distribution: [
          { grade: 'A', count: 4, pct: 50 },
          { grade: 'B', count: 5, pct: 50 },
        ],
      }),
    )
    expect(p.practice).toEqual({ accuracy: null, sessions: 0, questions: 0 })
    expect(p.levels.map((l) => l.accuracy)).toEqual([0, 80])
    expect(p.distribution).toEqual([
      { grade: 'A', count: 0, pct: 0 },
      { grade: 'B', count: 5, pct: 50 },
    ])
    expect(p.total).toBe(5)
    expect(p.gps).toEqual({ value: null, grade: null, band: null, entries: 0 })
  })

  it('the block never carries a name and parses inside the dashboard schema', () => {
    const p = performanceBlock(emptyView({ stats: { students: 9, sessions: 3, answered: 30, accuracy: 50 } }))
    const shape = SchoolAdminDashboardSchema.shape.performance
    expect(shape.safeParse(p).success).toBe(true)
  })
})

describe('currentSubscriptionStatus (BR-M27-14)', () => {
  const today = '2026-10-19'
  it('active in period, grace, expired, lapsed-active counts as expired, cancelled and none are none', () => {
    expect(currentSubscriptionStatus([{ status: 'active', startsOn: '2026-01-01', endsOn: '2026-12-31' }], today)).toBe('active')
    expect(currentSubscriptionStatus([{ status: 'grace', startsOn: '2026-01-01', endsOn: '2026-10-01' }], today)).toBe('grace')
    expect(currentSubscriptionStatus([{ status: 'expired', startsOn: '2025-01-01', endsOn: '2025-12-31' }], today)).toBe('expired')
    expect(currentSubscriptionStatus([{ status: 'active', startsOn: '2025-01-01', endsOn: '2026-01-01' }], today)).toBe('expired')
    expect(currentSubscriptionStatus([{ status: 'cancelled', startsOn: '2026-01-01', endsOn: '2026-12-31' }], today)).toBe('none')
    expect(currentSubscriptionStatus([], today)).toBe('none')
  })
})
