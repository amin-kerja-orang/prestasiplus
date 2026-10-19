/**
 * #5 Results (S5; SRS M12 v1.6 FR-M12-48 ... FR-M12-59, BR-M12-10, BR-M12-11, BR-M12-16 ... BR-M12-24).
 * The GPS cards follow `school_id` only; the subject GPS and trend tables are the platform rows in every scope
 * (DV-M12-26); a scope without an SPM history row has no GPS and no grade distribution (BR-M12-16/17/18).
 * D9 choice (G4 F5, INFERRED): a history row that stores no grade counts (school 8880's 2026 subject-only row, GPS 2.88,
 * 150 candidates) shows its GPS, year and the 150 candidates, no grade distribution, and `pass` / `passPct` /
 * `gradeA` / `gradeAPct` as `null` ("-"), so no "0/0 calon" sits next to a real GPS. Alternative not taken: show the
 * GPS as "-" too. A scope with no history row at all keeps the observed zero state (0/0, 9167).
 */

import { kirkpatrick, type KaSchoolAgg } from '@/modules/m05-practice/mock'

import type { Results, ResultsSchoolRow } from '../../../api/types'
import { SPM_GRADES } from '../../data/rules-data'
import { DC_M12_01, DC_M12_02 } from '../../data/constants'
import { mean1, pct1, pctTenths } from '../common'
import { schoolScoresRepo } from '../scores'
import { gradeOfAccuracyTenths, tahapOfScore } from '../rules'
import { schoolName, type Scope } from '../scope'
import { alesaOf } from './alesa'
import { gradeCountsOf, historyRow, subjectGps, trendTable } from './history'
import { predictionsOf } from './predictions'
import { statsOf } from './shared'

export function resultsOf(scope: Scope): Results {
  const s = statsOf(scope)
  const t = s.totals
  const history = historyRow(scope.schoolId)
  const counts = gradeCountsOf(history)
  const candidates = counts ? counts.reduce((a, b) => a + b, 0) : (history?.candidates ?? 0)
  // Unknown (null) when the row has candidates but no grade counts; 0 when there is no history row at all.
  const unknown = history !== null && counts === null
  const pass = counts ? counts.slice(0, 8).reduce((a, b) => a + b, 0) : unknown ? null : 0
  const gradeA = counts ? counts.slice(0, 3).reduce((a, b) => a + b, 0) : unknown ? null : 0

  const bySchool = new Map<number, KaSchoolAgg>(
    kirkpatrick.schools(scope.ka).map((a) => [a.schoolId, a]),
  )
  const schoolRows: (ResultsSchoolRow & { score: number })[] = s.pop.schools.map((p) => {
    const a = bySchool.get(p.schoolId)
    const active = a?.activeStudents ?? 0
    const score = schoolScoresRepo.get(p.schoolId)?.score ?? 0
    return {
      schoolId: p.schoolId,
      name: schoolName(p.schoolId),
      students: p.t4t5,
      active,
      accuracy: active > 0 && a ? pct1(a.correct, a.answered) : null,
      answers: active > 0 && a ? a.answered : null,
      engagement: active === 0 && (a?.sessions ?? 0) === 0 ? null : score,
      tahap: tahapOfScore(score),
      faded: active === 0,
      score,
    }
  })
  schoolRows.sort((x, y) => y.score - x.score || x.schoolId - y.schoolId)

  const predictions = predictionsOf(scope)
  const alesa = alesaOf(scope, predictions)
  const active = t.activeStudents
  const accuracy = s.accuracy
  const gps = history?.gps ?? null

  return {
    kpi: {
      gps,
      gpsYear: history?.year ?? null,
      recordsLabel: DC_M12_01,
      passPct: pass === null ? null : pct1(pass, candidates),
      pass,
      candidates,
      gradeA,
      gradeAPct: gradeA === null ? null : pct1(gradeA, candidates),
      accuracy,
      answers: t.answered,
      active,
      activePct: pct1(active, s.pop.t4t5),
      t4t5: s.pop.t4t5,
      records: DC_M12_02,
    },
    distribution:
      counts && history
        ? {
            year: history.year,
            candidates,
            rows: SPM_GRADES.map((grade, i) => ({
              grade,
              n: counts[i] as number,
              pct: pct1(counts[i] as number, candidates),
            })),
          }
        : null,
    subjectGps: subjectGps(),
    trend: trendTable(),
    schools: schoolRows.map((r) => ({
      schoolId: r.schoolId,
      name: r.name,
      students: r.students,
      active: r.active,
      accuracy: r.accuracy,
      answers: r.answers,
      engagement: r.engagement,
      tahap: r.tahap,
      faded: r.faded,
    })),
    predictions: predictions.map((p) => ({
      userId: p.userId,
      name: p.name,
      schoolId: p.schoolId,
      schoolName: p.schoolName,
      answers: p.answers,
      accuracy: p.tenths / 10,
      grade: p.grade,
    })),
    alesa,
    roi: {
      active,
      perStudent: active > 0 ? mean1(t.answered, active) : 0,
      accuracy,
      gps,
    },
    insights: {
      active,
      t4t5: s.pop.t4t5,
      pct: pct1(active, s.pop.t4t5),
      accuracy,
      grade: gradeOfAccuracyTenths(pctTenths(t.correct, t.answered)),
      year: history?.year ?? null,
      gps,
    },
  }
}
