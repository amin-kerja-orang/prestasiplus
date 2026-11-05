import type { SchoolAdminDashboard } from '@pp/contract'

import { gradeOfPoints } from '../reports/performance/services/headcount-figures'
import { K_COHORT } from './school-admin.constants'
import type { SchoolPerformanceView } from './school-admin.ports'

type Performance = SchoolAdminDashboard['performance']

/** XS-4 and XS-5 of the school, all time (`XsQueries.answerTotals`): they replace the S10 figures of the practice block. */
export interface PracticeXs {
  answered: number
  accuracy: number | null
}

const LEVELS = [
  { code: 't4', name: 'Tingkatan 4' },
  { code: 't5', name: 'Tingkatan 5' },
] as const

/**
 * Maps BE-19's school performance into the dashboard `performance` block. No figure is computed here: `gps`, `levels`,
 * `distribution` and the practice `sessions` are BE-19's (S10), and the practice `questions` and `accuracy` are the XS-4 / XS-5
 * figures passed in by the caller (`xs`, school scope, all time), so the dashboard shows the same numbers as every other screen.
 * The only rules owned by this mapper are the contract's ("no data is null, never 0 %"; both levels always listed) and the
 * k-cohort suppression (BE-19 OQ-7): a group of fewer than `K_COHORT` pupils is shown as empty, the school admin included.
 * No pupil name is ever on this block.
 *
 * `gps` is BE-19's headcount GPS (value, band, entries; the k = 5 rule is already applied there and the school admin counts as staff). The grade is
 * derived with the same `gradeOfPoints` helper the service uses. No GPS is null with 0 entries. `risk` stays
 * null (the panel is hidden): the Amaran Awal tally belongs to the M18 routes, which are outside this slice.
 */
export function performanceBlock(view: SchoolPerformanceView, xs: PracticeXs): Performance {
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
      // k = 5 stays on the S10 cohort (DOC DEFECT 3); no answers is null, never 0 % (XS-5).
      accuracy: cohortOk ? xs.accuracy : null,
      sessions,
      questions: cohortOk ? xs.answered : 0,
    },
    levels: LEVELS.map(({ code, name }) => {
      const level = view.levels.find((l) => l.code === code)
      return { code, name, accuracy: level && level.students >= K_COHORT ? level.accuracy : 0 }
    }),
    distribution,
    total: distribution.reduce((sum, d) => sum + d.count, 0),
  }
}
