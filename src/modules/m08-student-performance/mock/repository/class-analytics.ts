/**
 * The class analytics read model (S8; SRS M08 v1.13 §7 #8; BR-M08-15, -26): risk profiles stored per
 * (user, class, subject) in the M08 store (T1 seeds, §6.10). Cards and rows follow all three filters:
 * class, subject and risk level. Unobserved rules are marked INFERRED where they are used.
 */

import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { classrooms, type ClassroomRow } from '@/modules/m10-teacher-class/mock'

import type { ClassAnalytics, RiskLevel } from '../../api/types'
import { round } from './rules'
import { spRecordsRepo } from './stores'

/**
 * OBSERVED (SRS §6.10 S8): the subjects of the "Mata Pelajaran" select for class 4, in the live order
 * (the first is selected when none is given). Other classes list the subjects of their stored risk
 * profiles, the class subject first (INFERRED: the live rule that fills the select is not observable
 * beyond class 4).
 */
export const CLASS4_SUBJECT_OPTIONS: readonly number[] = [1, 11, 9, 12, 10, 3, 8, 23, 17, 5]

export const RISK_LEVELS: readonly RiskLevel[] = ['critical', 'high', 'medium', 'low']

/** The risk filter value: a known level, else '' (every level; INFERRED for an unknown value). */
export const parseRiskLevel = (v: string | undefined): RiskLevel | '' =>
  RISK_LEVELS.includes(v as RiskLevel) ? (v as RiskLevel) : ''

/** The subject ids of the "Mata Pelajaran" select of a class. */
export function subjectOptionsOf(cls: ClassroomRow): number[] {
  if (cls.classId === 4) return [...CLASS4_SUBJECT_OPTIONS]
  const ids: number[] = []
  if (cls.subjectId !== null) ids.push(cls.subjectId)
  for (const p of spRecordsRepo.riskProfiles(cls.classId)) {
    if (!ids.includes(p.subjectId)) ids.push(p.subjectId)
  }
  return ids
}

export interface ClassAnalyticsInput {
  /** The viewer's own classes for the "Kelas" select (BR-M08-26; the admin has none). */
  ownClasses: readonly { id: number; name: string }[]
  /** The class shown (`null` = none), already checked for access. */
  cls: ClassroomRow | null
  subjectId: number | undefined
  riskLevel: RiskLevel | ''
}

export function classAnalytics(input: ClassAnalyticsInput): ClassAnalytics {
  const { cls, riskLevel } = input
  const subjectIds = cls ? subjectOptionsOf(cls) : []
  const subjectId = input.subjectId ?? subjectIds[0] ?? null
  const subjects = subjectIds.map((id) => ({
    id,
    name: curriculum.subject(id)?.name ?? `Subjek ${String(id)}`,
  }))
  // Row order = the class list order (member order, as the live list; the store itself is keyed by id).
  const memberOrder = cls ? classrooms.memberIds(cls.kind, cls.classId) : []
  const orderOf = (userId: number): number => {
    const i = memberOrder.indexOf(userId)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  const profiles =
    cls && subjectId !== null
      ? spRecordsRepo
          .riskProfiles(cls.classId, subjectId)
          .filter((p) => riskLevel === '' || p.riskLevel === riskLevel)
          .sort((a, b) => orderOf(a.userId) - orderOf(b.userId) || a.userId - b.userId)
      : []
  const rows = profiles.map((p) => ({
    userId: p.userId,
    name: users.get(p.userId)?.name ?? `Murid ${String(p.userId)}`,
    accuracy: p.accuracy,
    answered: p.answered,
    trend: p.trend,
    projection: { low: p.gradeLow, high: p.gradeHigh },
    riskLevel: p.riskLevel,
  }))
  return {
    options: {
      classes: input.ownClasses.map((c) => ({ id: c.id, name: c.name })),
      subjects,
      selected: { classroomId: cls?.classId ?? null, subjectId, riskLevel },
    },
    summary:
      rows.length === 0
        ? null
        : {
            students: rows.length,
            accuracy: round(rows.reduce((a, r) => a + r.accuracy, 0) / rows.length, 1),
            atRisk: rows.filter((r) => r.riskLevel === 'critical' || r.riskLevel === 'high').length,
            good: rows.filter((r) => r.riskLevel === 'low').length,
          },
    rows,
  }
}
