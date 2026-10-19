/**
 * #2 Reaction (S2), #3 Learning (S3), #4 Behavior (S4) and #6 Chain (S6): SRS M12 v1.6 BR-M12-02 ... BR-M12-15,
 * BR-M12-25, BR-M12-32. Every count is computed from the owners' stores (D11); only the school scores,
 * the correlation constants and the mood count (0, BR-M12-15) are stored or constant.
 */

import { curriculum } from '@/modules/m03-curriculum/mock'
import { kirkpatrick, type KaSchoolAgg } from '@/modules/m05-practice/mock'
import { schools } from '@/modules/m02-users-schools/mock'

import type { Behavior, BehaviorAlert, Chain, Learning, Reaction } from '../../../api/types'
import { CORRELATION_BANDS, DC_M12_03_R } from '../../data/constants'
import { mean1, pct1, pctTenths } from '../common'
import { feedbackRepo } from '../feedback'
import { schoolScoresRepo } from '../scores'
import { statusOfAccuracy, strengthOfR, tahapOfScore } from '../rules'
import { populationOf, schoolName, type Scope } from '../scope'
import { historyRow } from './history'
import { bandsOf, statsOf } from './shared'

/** #2: the four T1 figures (global: ignores the scope, BR-M12-32). */
export function reactionOf(): Reaction {
  const a = feedbackRepo.aggregates()
  return {
    npsStudent: a.npsStudent,
    npsTeacher: a.npsTeacher,
    npsAdmin: a.npsAdmin,
    satisfaction: a.satisfaction,
  }
}

const aggBySchool = (scope: Scope): Map<number, KaSchoolAgg> =>
  new Map(kirkpatrick.schools(scope.ka).map((a) => [a.schoolId, a]))

/** #3 (S3). */
export function learningOf(scope: Scope): Learning {
  const s = statsOf(scope)
  const t = s.totals

  const subjects = kirkpatrick
    .subjects(scope.ka)
    .filter((x) => x.answered > 0)
    .map((x) => {
      const tenths = pctTenths(x.correct, x.answered)
      return {
        subjectId: x.subjectId,
        name: curriculum.subject(x.subjectId)?.name ?? `Subjek ${String(x.subjectId)}`,
        answers: x.answered,
        accuracy: tenths / 10,
        status: statusOfAccuracy(tenths / 10),
        tenths,
        correct: x.correct,
      }
    })
    // Observed order (AC-M12-12.2, platform and 8080): exact accuracy descending (school 8080: Tasawwur Islam 697/738 = 94.444%
    // before Pendidikan Moral 285/302 = 94.371%, both shown 94.4; asserted in data.test.ts), then the subject name A-Z (the three 100.0% rows of 8080 read
    // Bahasa Cina, Reka Bentuk & Teknologi, Sains Komputer; answers ascending fits too, answers descending does not).
    .sort(
      (a, b) => b.correct * a.answers - a.correct * b.answers || a.name.localeCompare(b.name, 'ms'),
    )
    .map((r) => ({
      subjectId: r.subjectId,
      name: r.name,
      answers: r.answers,
      accuracy: r.accuracy,
      status: r.status,
    }))

  const bySchool = aggBySchool(scope)
  const schoolRows = s.pop.schools
    .map((p) => {
      const a = bySchool.get(p.schoolId)
      const accuracyTenths = a ? pctTenths(a.correct, a.answered) : 0
      return {
        schoolId: p.schoolId,
        name: schoolName(p.schoolId),
        students: p.t4t5,
        answers: a?.answered ?? 0,
        accuracy: accuracyTenths / 10,
        avgScore: a ? mean1(a.scoreSum, a.scoredSessions) : 0,
        subjects: schoolScoresRepo.get(p.schoolId)?.subjectCount ?? 0,
        tenths: accuracyTenths,
      }
    })
    .sort((a, b) => b.tenths - a.tenths || a.schoolId - b.schoolId)
    .map((r) => ({
      schoolId: r.schoolId,
      name: r.name,
      students: r.students,
      answers: r.answers,
      accuracy: r.accuracy,
      avgScore: r.avgScore,
      subjects: r.subjects,
    }))

  return {
    kpi: {
      answers: t.answered,
      accuracy: s.accuracy,
      avgScore: mean1(t.scoreSum, t.scoredSessions),
      // Invariant (BR-M12-05): every session of the Kirkpatrick segment is completed, so "Sesi Selesai" equals the
      // session count and the completion rate is 100 whenever there is a session.
      sessionsCompleted: t.sessions,
      sessions: t.sessions,
      completionPct: t.sessions > 0 ? 100 : 0,
    },
    subjects,
    schools: schoolRows,
  }
}

/** BR-M12-14: the three alert lists in the fixed order, each in school-id order. */
function alertsOf(scope: Scope): BehaviorAlert[] {
  const pop = populationOf(scope)
  const bySchool = aggBySchool(scope)
  const list1: BehaviorAlert[] = []
  const list2: BehaviorAlert[] = []
  const list3: BehaviorAlert[] = []
  for (const p of pop.schools) {
    const name = schoolName(p.schoolId)
    const agg = bySchool.get(p.schoolId)
    if (p.never * 2 > p.t4t5) {
      list1.push({ list: 1, schoolId: p.schoolId, name, kind: 'never', n: p.never })
    }
    if (p.teachersLoggedIn >= 1 && (agg?.answered ?? 0) === 0) {
      list2.push({ list: 2, schoolId: p.schoolId, name, kind: 'teacher', n: p.teachersLoggedIn })
    }
    const active = agg?.activeStudents ?? 0
    if (active * 2 > p.t4t5) {
      list3.push({ list: 3, schoolId: p.schoolId, name, kind: 'good', pct: pct1(active, p.t4t5) })
    }
  }
  return [...list1, ...list2, ...list3]
}

/** #4 (S4). */
export function behaviorOf(scope: Scope): Behavior {
  const s = statsOf(scope)
  const t = s.totals
  const bySchool = aggBySchool(scope)
  const rows = s.pop.schools
    .map((p) => {
      const a = bySchool.get(p.schoolId)
      const score = schoolScoresRepo.get(p.schoolId)?.score ?? 0
      const active = a?.activeStudents ?? 0
      const answers = a?.answered ?? 0
      const code = schools.get(p.schoolId)?.code ?? ''
      return {
        schoolId: p.schoolId,
        name: schoolName(p.schoolId),
        code: code === '' ? null : code,
        students: p.t4t5,
        active,
        answers,
        sessions: a?.sessions ?? 0,
        perActive: active > 0 ? mean1(answers, active) : 0,
        score,
        tahap: tahapOfScore(score),
      }
    })
    .sort((x, y) => y.score - x.score || x.schoolId - y.schoolId)

  const heat = kirkpatrick.heat(scope.ka)
  return {
    kpi: {
      t4t5: s.pop.t4t5,
      active: t.activeStudents,
      sessions: t.sessions,
      answers: t.answered,
      accuracy: s.accuracy,
      teacherPct: pct1(s.pop.teachersLoggedIn, s.pop.teachers),
      teachersLoggedIn: s.pop.teachersLoggedIn,
      teachers: s.pop.teachers,
    },
    bands: bandsOf(s.pop.t4t5, s.students),
    schools: rows,
    heat: { max: heat.reduce((m, r) => Math.max(m, ...r), 0), cells: heat },
    alerts: alertsOf(scope),
    moodCount: 0,
  }
}

/** #6 (S6): the platform chain (ignores the scope). */
export function chainOf(platform: Scope): Chain {
  const s = statsOf(platform)
  const t1 = feedbackRepo.aggregates()
  const gps = historyRow(null)
  return {
    t1: { nps: t1.nps, satisfaction: t1.satisfaction, responses: t1.responses },
    t2: {
      accuracy: s.accuracy,
      answers: s.totals.answered,
      avgScore: mean1(s.totals.scoreSum, s.totals.scoredSessions),
    },
    t3: {
      active: s.totals.activeStudents,
      t4t5: s.pop.t4t5,
      pct: pct1(s.totals.activeStudents, s.pop.t4t5),
      sessions: s.totals.sessions,
      bands: bandsOf(s.pop.t4t5, s.students),
    },
    t4: { gps: gps?.gps ?? null, r: DC_M12_03_R, strength: strengthOfR(DC_M12_03_R) },
    correlation: { bands: CORRELATION_BANDS.map((b) => ({ ...b })), r: DC_M12_03_R },
  }
}
