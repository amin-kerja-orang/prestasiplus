/**
 * The class analytics read model (S8; SRS M08 v1.13 §7 #8; BR-M08-15, -26; R1-GUR-5, R1-AS-5): risk profiles stored per
 * (user, class, subject) in the M08 store (T1 seeds, §6.10). Cards and rows follow all three filters: class
 * ("Semua Kelas" = every class of the viewer), subject ("Semua Subjek" = every subject, pooled) and risk level.
 * Mirrors the API rules: the roster is every active pupil of the classes (Belum Bermula = none, accuracy null, last),
 * pooled accuracy, risk bands on the whole-number accuracy, sorted by accuracy ascending. The stored trend of a
 * profile stands in for the 7-day windows (the mock has no answer log; INFERRED). Other unobserved rules: INFERRED.
 */

import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { classrooms, type ClassroomRow } from '@/modules/m10-teacher-class/mock'

import type { ClassAnalytics, ClassTrend, RiskLevel } from '../../api/types'
import { projection, round } from './rules'
import { spRecordsRepo } from './stores'

export const RISK_LEVELS: readonly RiskLevel[] = ['critical', 'high', 'medium', 'low']

/** The risk filter value: a known level, else '' (every level; INFERRED for an unknown value, so 'none' is not a filter). */
export const parseRiskLevel = (v: string | undefined): RiskLevel | '' =>
  RISK_LEVELS.includes(v as RiskLevel) ? (v as RiskLevel) : ''

/** OPT-RISIKO on the whole-number accuracy (half up): < 40 Kritikal, < 55 Tinggi, < 70 Sederhana, else Rendah. */
export function riskOfWholePercent(accuracy: number): RiskLevel {
  const whole = Math.round(accuracy)
  return whole < 40 ? 'critical' : whole < 55 ? 'high' : whole < 70 ? 'medium' : 'low'
}

export interface ClassAnalyticsInput {
  /** The viewer's classes for the "Kelas" select (BR-M08-26; the admin has none); school admin: Tingkatan then name. */
  ownClasses: readonly { id: number; name: string }[]
  /** The classes whose pupils are listed ("Semua Kelas" = every own class), already checked for access. */
  scope: readonly ClassroomRow[]
  /** The id the page asked for (`null` = Semua Kelas). */
  classroomId: number | null
  subjectId: number | undefined
  riskLevel: RiskLevel | ''
  /** School admin: rows carry the class names. */
  withClassNames: boolean
}

interface Pooled {
  correct: number
  answered: number
  trend: ClassTrend
  best: number
}

type Row = ClassAnalytics['rows'][number]
/** A row plus the pooled correct count of the average (not on the wire). */
type Entry = Row & { correct: number }

export function classAnalytics(input: ClassAnalyticsInput): ClassAnalytics {
  const { scope, riskLevel } = input
  const subjects = curriculum.subjects({ active: true }).map((s) => ({ id: s.id, name: s.name }))
  const selected = { classroomId: input.classroomId, subjectId: input.subjectId ?? null, riskLevel }
  const empty = (): ClassAnalytics => ({
    options: { classes: input.ownClasses.map((c) => ({ id: c.id, name: c.name })), subjects, selected },
    summary: null,
    rows: [],
  })

  // Roster: active pupils of the scope classes, each once (the class names follow the scope order). The observed class 4
  // profiles belong to pupils the enrolment store does not list: a stored profile also puts its pupil on the roster.
  const classNames = new Map<number, string[]>()
  const addTo = (id: number, name: string): void => {
    const names = classNames.get(id) ?? []
    if (!names.includes(name)) classNames.set(id, [...names, name])
  }
  const profilesOf = new Map<number, ReturnType<typeof spRecordsRepo.riskProfiles>>()
  for (const c of scope) {
    for (const id of classrooms.memberIds(c.kind, c.classId)) addTo(id, c.name)
    const profiles = spRecordsRepo.riskProfiles(c.classId, input.subjectId)
    profilesOf.set(c.classId, profiles)
    for (const p of profiles) addTo(p.userId, c.name)
  }
  // The API takes the roster from XS-1 (active, not suspended, Tingkatan 1-5). The mock cannot mirror the grade rule: the observed class 4
  // roster (51 pupils, anchors) is made of placeholder accounts whose seeded grades are arbitrary (Darjah 1-5 among them), and seeds
  // mirror observation. The mock has no suspension flag either. Only the inactive accounts are out.
  const roster = [...classNames.keys()].filter((id) => users.get(id)?.isActive !== false)
  if (roster.length === 0) return empty()

  // Pooled over the stored (user, class, subject) profiles of the scope; a (user, subject) pair counts once.
  const pooled = new Map<number, Pooled>()
  const seen = new Set<string>()
  for (const c of scope) {
    for (const p of profilesOf.get(c.classId) ?? []) {
      const key = `${String(p.userId)}:${String(p.subjectId)}`
      if (seen.has(key)) continue
      seen.add(key)
      const t = pooled.get(p.userId) ?? { correct: 0, answered: 0, trend: 'stable' as ClassTrend, best: -1 }
      t.correct += (p.accuracy * p.answered) / 100
      t.answered += p.answered
      if (p.answered > t.best) {
        t.best = p.answered
        t.trend = p.trend
      }
      pooled.set(p.userId, t)
    }
  }

  const all = roster.map((userId): Entry => {
    const t = pooled.get(userId)
    const hasAnswers = t !== undefined && t.answered > 0
    const accuracy = hasAnswers ? round((t.correct / t.answered) * 100, 1) : null
    // The band uses the whole-number accuracy rounded half up from the UNROUNDED percentage, never from the 1-decimal one.
    const rawPercent = hasAnswers ? Math.min((t.correct / t.answered) * 100, 100) : null
    return {
      userId,
      name: users.get(userId)?.name ?? `Murid ${String(userId)}`,
      accuracy,
      correct: hasAnswers ? t.correct : 0,
      answered: hasAnswers ? t.answered : 0,
      trend: hasAnswers ? t.trend : 'stable',
      projection: accuracy === null ? null : projection(accuracy),
      riskLevel: rawPercent === null ? 'none' : riskOfWholePercent(rawPercent),
      classes: input.withClassNames ? (classNames.get(userId) ?? []) : [],
    }
  })
  // Accuracy ascending, then name; Belum Bermula last.
  all.sort((a, b) => {
    if ((a.accuracy === null) !== (b.accuracy === null)) return a.accuracy === null ? 1 : -1
    return (a.accuracy ?? 0) - (b.accuracy ?? 0) || a.name.localeCompare(b.name, 'ms') || a.userId - b.userId
  })
  const shown = all.filter((r) => riskLevel === '' || r.riskLevel === riskLevel)
  if (shown.length === 0) return empty()
  const answered = shown.filter((r) => r.accuracy !== null)
  const sumAnswered = answered.reduce((a, r) => a + r.answered, 0)
  const sumCorrect = answered.reduce((a, r) => a + r.correct, 0)
  return {
    options: { classes: input.ownClasses.map((c) => ({ id: c.id, name: c.name })), subjects, selected },
    summary: {
      students: shown.length,
      accuracy: sumAnswered === 0 ? null : round((sumCorrect / sumAnswered) * 100, 1),
      atRisk: shown.filter((r) => r.riskLevel === 'critical' || r.riskLevel === 'high').length,
      good: shown.filter((r) => r.riskLevel === 'low').length,
    },
    rows: shown.map((r) => ({
      userId: r.userId,
      name: r.name,
      accuracy: r.accuracy,
      answered: r.answered,
      trend: r.trend,
      projection: r.projection,
      riskLevel: r.riskLevel,
      classes: r.classes,
    })),
  }
}
