import type { SchoolAdminDashboard } from '@pp/contract'

import { gradeOfPoints } from '../reports/performance/services/headcount-figures'
import { K_COHORT } from './school-admin.constants'
import type { SchoolPerformanceView } from './school-admin.ports'

type Performance = SchoolAdminDashboard['performance']

const LEVELS = [
  { code: 't4', name: 'Tingkatan 4' },
  { code: 't5', name: 'Tingkatan 5' },
] as const

/**
 * Maps BE-19's school performance into the dashboard `performance` block. No figure is computed here: every number is BE-19's.
 * The only rules owned by this mapper are the contract's ("no data is null, never 0 %"; both levels always listed) and the
 * k-cohort suppression (BE-19 OQ-7): a group of fewer than `K_COHORT` pupils is shown as empty, the school admin included.
 * No pupil name is ever on this block.
 *
 * `gps` is BE-19's headcount GPS (value, band, entries; the k = 5 rule is already applied there and the school admin counts as staff). The grade is
 * derived with the same `gradeOfPoints` helper the service uses. No GPS is null with 0 entries. `risk` stays
 * null (the panel is hidden): the Amaran Awal tally belongs to the M18 routes, which are outside this slice.
 */
export function performanceBlock(view: SchoolPerformanceView): Performance {
  const cohortOk = view.stats.students >= K_COHORT
  const sessions = cohortOk ? view.stats.sessions : 0

  const distribution = view.distribution.map((d) =>
    d.count >= K_COHORT ? { grade: d.grade, count: d.count, pct: d.pct } : { grade: d.grade, count: 0, pct: 0 },
  )

  return {
    gps:
      view.gps.value === null
        ? { value: null, grade: null, band: null, entries: 0 }
        : { value: view.gps.value, grade: gradeOfPoints(view.gps.value), band: view.gps.band, entries: view.gps.entries },
    risk: null,
    practice: {
      accuracy: sessions === 0 ? null : view.stats.accuracy,
      sessions,
      questions: cohortOk ? view.stats.answered : 0,
    },
    levels: LEVELS.map(({ code, name }) => {
      const level = view.levels.find((l) => l.code === code)
      return { code, name, accuracy: level && level.students >= K_COHORT ? level.accuracy : 0 }
    }),
    distribution,
    total: distribution.reduce((sum, d) => sum + d.count, 0),
  }
}
