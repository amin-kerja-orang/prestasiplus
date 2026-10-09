/**
 * Seed of the M18-owned stores (SRS M18 v1.8 §6.11 G and I), every value as observed:
 * - DATA-M18-04 CorrectionSubject rows of 8880, 8765 and 2710 (`pupilsWeak` = `pupils` on every
 *   observed row; 2710's rows are the audit top-up with the other columns not observed);
 * - DATA-M18-01 AmaranIntervention ids 2 and 3: pupil 3215 (M08 anchor for live pupil 2229), 8880,
 *   teacher = the first teacher of 8880 (fictitious), 2026-04-13, effectiveness `belum_dinilai`.
 * Runs in `finalise` (after the owners' datasets compiled); reads the owners through their repositories.
 */

import { toIsoMyt } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'

import { resetRiskCache } from '../repository/risk'
import { amaranInterventionsRepo, correctionSubjectsRepo } from '../repository/stores'
import type { AmaranInterventionRow, CorrectionSubjectRow } from '../repository/types'

/** [code, pupils, questions, accuracy, accuracyBefore, accuracyAfter, avgLevel] (null = not observed). */
type Obs = readonly [
  code: string,
  pupils: number,
  questions: number | null,
  accuracy: number | null,
  before: number | null,
  after: number | null,
  level: number | null,
]

const CORRECTIONS: Readonly<Record<number, readonly Obs[]>> = {
  8880: [
    ['BM', 1, 26, 34.6, 72, 72, null],
    ['BI', 1, 8, 50, 71.9, 71.9, null],
    ['MATH', 1, 5, 100, 72.4, 72.4, null],
  ],
  8765: [
    ['MATH', 6, 184, 45.6, 77.3, 77.3, 0.7],
    ['CHEM', 5, 142, 48.5, null, null, 1],
    ['PHY', 5, 114, 43.5, null, null, 0.4],
    ['ADDMATH', 2, 97, 48.5, null, null, 1.5],
    ['SK', 3, 71, 56.8, null, null, 1],
    ['SEJ', 3, 68, 44.1, 84.6, 84.6, 0.7],
    ['BIO', 3, 58, 45.5, null, null, 0.3],
    ['PERNIAGA', 2, 52, 55.4, null, null, 1],
    ['GEO', 1, 19, 47.4, null, null, null],
  ],
  2710: [
    ['BM', 1, null, null, null, null, null],
    ['SEJ', 1, null, null, null, null, null],
    ['PHY', 1, null, null, null, null, null],
    ['GEO', 1, null, null, null, null, null],
    ['SK', 1, null, null, null, null, null],
  ],
}

/** The seeded intervention pupil (live id 2229 mapped once onto the M08 anchor 3215). */
export const INTERVENTION_PUPIL = 3215
export const INTERVENTION_SCHOOL = 8880

export function buildCorrections(): { rows: CorrectionSubjectRow[]; issues: string[] } {
  const rows: CorrectionSubjectRow[] = []
  const issues: string[] = []
  for (const [school, list] of Object.entries(CORRECTIONS)) {
    const schoolId = Number(school)
    list.forEach(([code, pupils, questions, accuracy, before, after, level], position) => {
      const subject = curriculum.subjectByCode(code)
      if (!subject) {
        issues.push(`correction ${school}: no M03 subject with code ${code}`)
        return
      }
      rows.push({
        id: `${school}:${String(subject.id)}`,
        schoolId,
        subjectId: subject.id,
        position,
        pupils,
        pupilsWeak: pupils,
        questions,
        accuracy,
        accuracyBefore: before,
        accuracyAfter: after,
        avgLevel: level,
      })
    })
  }
  return { rows, issues }
}

export function buildInterventions(): {
  rows: AmaranInterventionRow[]
  issues: string[]
} {
  const issues: string[] = []
  const teacher = users
    .adminList({ role: 'teacher', schoolId: INTERVENTION_SCHOOL, page: 1, pageSize: 100 })
    .rows.sort((a, b) => a.id - b.id)[0]
  if (!teacher) {
    issues.push(`interventions: school ${String(INTERVENTION_SCHOOL)} has no teacher`)
    return { rows: [], issues }
  }
  if (!users.get(INTERVENTION_PUPIL)) {
    issues.push(`interventions: pupil ${String(INTERVENTION_PUPIL)} is not in the users store`)
    return { rows: [], issues }
  }
  const at = toIsoMyt(Date.parse('2026-04-13T10:00:00+08:00'))
  const base = {
    studentId: INTERVENTION_PUPIL,
    teacherId: teacher.id,
    schoolId: INTERVENTION_SCHOOL,
    classroomId: null,
    interventionDate: '2026-04-13',
    status: 'done' as const,
    followUp: null,
    effectiveness: 'belum_dinilai' as const,
    createdAt: at,
    updatedAt: at,
  }
  return {
    rows: [
      {
        ...base,
        id: 2,
        type: 'kaunseling',
        notes: 'Catatan contoh intervensi (data demo).',
      },
      {
        ...base,
        id: 3,
        type: 'mentor_rakan',
        notes: 'Catatan contoh intervensi kedua (data demo).',
      },
    ],
    issues,
  }
}

let issuesFound: string[] = []

/** Problems the last finalise found (an owner anchor missing); the tests assert there are none. */
export const m18SeedIssues = (): readonly string[] => issuesFound

/**
 * Finalise phase: writes both stores. A missing owner anchor is recorded (`m18SeedIssues`), not thrown,
 * so one owner gap never blocks the boot of every session.
 */
export function finaliseM18(): void {
  const c = buildCorrections()
  const i = buildInterventions()
  issuesFound = [...c.issues, ...i.issues]
  resetRiskCache() // a mock reset / reseed drops every risk memo
  correctionSubjectsRepo.seed(c.rows)
  amaranInterventionsRepo.seed(i.rows)
}
