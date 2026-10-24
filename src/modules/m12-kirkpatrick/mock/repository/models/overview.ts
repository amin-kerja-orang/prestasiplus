/**
 * #1 Overview (S1; SRS M12 v1.6 FR-M12-20 ... FR-M12-31, BR-M12-01 ... BR-M12-08, BR-M12-16, BR-M12-32).
 * The T1 card is global (BR-M12-32), the GPS follows `school_id` only (BR-M12-16), everything else the scope.
 */

import { daysInMonth, monthName } from '@/lib/time'
import { kirkpatrick } from '@/modules/m05-practice/mock'

import type { Comparison, ComparisonPanel, Overview } from '../../../api/types'
import { DC_M12_02 } from '../../data/constants'
import { dayKey, fmt1, monthKeyOf, pct1, round1 } from '../common'
import { feedbackRepo } from '../feedback'
import type { Scope } from '../scope'
import { historyRow } from './history'
import { bandsOf, statsOf } from './shared'

const pad2 = (n: number): string => String(n).padStart(2, '0')

const splitMonth = (month: string): [number, number] =>
  month.split('-').map(Number) as [number, number]

/** "Januari 2026" of a `YYYY-MM` key. */
function monthLabel(month: string): string {
  const [y, m] = splitMonth(month)
  return `${monthName(m, 'ms')} ${String(y)}`
}

function lastDayOf(month: string): string {
  const [y, m] = splitMonth(month)
  return `${month}-${pad2(daysInMonth(y, m))}`
}

/** One SEBELUM / SELEPAS panel: the answers of every student of the month in scope (BR-M12-08). */
function panelOf(month: string, scope: Scope, to: string): ComparisonPanel {
  const agg = kirkpatrick.month(month, scope.ka)
  return {
    month,
    from: `${month}-01`,
    to,
    active: agg.students.length,
    accuracy: pct1(agg.correct, agg.answered),
    answers: agg.answered,
    champions: agg.students.filter((s) => s.answered >= 50).length,
  }
}

/**
 * BR-M12-08: SEBELUM = the first month with an answer in scope (whole month), SELEPAS = the current month from
 * day 1 to today (mock clock); the sentences follow in the fixed order, each only when its condition holds.
 */
export function comparisonOf(scope: Scope, nowMs: number): Comparison {
  const first = kirkpatrick.months(scope.ka)[0]
  if (first === undefined) {
    return {
      subtitle: 'Tiada Data vs Tiada Data',
      before: null,
      after: null,
      delta: null,
      sentences: ['Data tidak mencukupi untuk perbandingan.'],
    }
  }
  const current = monthKeyOf(nowMs)
  const before = panelOf(first, scope, lastDayOf(first))
  const after = panelOf(current, scope, dayKey(nowMs))
  const delta = {
    active: after.active - before.active,
    accuracy: round1(after.accuracy - before.accuracy),
    answers: after.answers - before.answers,
    champions: after.champions - before.champions,
  }

  const text: string[] = []
  if (delta.accuracy > 0) text.push(`Peningkatan ${fmt1(delta.accuracy)}% dalam ketepatan jawapan.`)
  else if (delta.accuracy < 0) {
    text.push(`Penurunan ${fmt1(Math.abs(delta.accuracy))}% dalam ketepatan jawapan.`)
  }
  if (delta.active > 0) text.push(`${String(delta.active)} pelajar baru mula aktif.`)
  else if (delta.active < 0) {
    text.push(`${String(Math.abs(delta.active))} pelajar kurang aktif berbanding sebelumnya.`)
  }
  if (delta.answers > 0 && before.answers > 0) {
    text.push(`Jumlah jawapan meningkat ${fmt1((delta.answers / before.answers) * 100)}%.`)
  }
  if (delta.champions > 0) text.push(`${String(delta.champions)} pelajar naik ke tahap Juara.`)

  return {
    subtitle: `${monthLabel(first)} vs ${monthLabel(current)}`,
    before,
    after,
    delta,
    sentences: text,
  }
}

/** The S1 read model for a scope. */
export function overviewOf(scope: Scope, nowMs: number): Overview {
  const s = statsOf(scope)
  const gps = historyRow(scope.schoolId)
  const t1 = feedbackRepo.aggregates()
  return {
    scope: { schoolId: scope.schoolId, state: scope.state },
    t4: {
      gps: gps?.gps ?? null,
      gpsYear: gps?.year ?? null,
      recordsLabel: DC_M12_02,
    },
    t3: {
      active: s.totals.activeStudents,
      t4t5: s.pop.t4t5,
      sessions: s.totals.sessions,
      accuracy: s.accuracy,
    },
    t2: { accuracy: s.accuracy, answers: s.totals.answered },
    t1: { satisfaction: t1.satisfaction, responses: t1.responses },
    comparison: comparisonOf(scope, nowMs),
    kpi: {
      t4t5: s.pop.t4t5,
      answers: s.totals.answered,
      teachersLoggedIn: s.pop.teachersLoggedIn,
      teachers: s.pop.teachers,
      accuracy: s.accuracy,
    },
    bands: bandsOf(s.pop.t4t5, s.students),
  }
}
