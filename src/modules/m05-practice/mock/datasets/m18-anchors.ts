/**
 * The M18 anchors of the M05 stores (SRS M05 v1.17 §6.14.3–§6.14.4, FR-M05-148, build note (f);
 * M18 v1.8 §6.11 B–C, XR-M18-03, XR-M18-21):
 *
 * - **PupilSubjectAccuracy** (DATA-M05-13): the stored per-pupil × subject accuracy rows behind M18
 *   S5 / S6 — 8765 pupil X BM 35/58, SEJ 34/47, PI 47/51, MT 18/22 and pupil Y MT 17/24 (cells BM 60.3,
 *   SEJ 72.3, PI 92.2, MT 76.3, overall mean 73.1); "0%" rows (0 correct, answered > 0) at 3160 (BI),
 *   2700 (BM, MT, SEJ) and 8767 (Sains, SEJ), one pupil each. The answered counts of the "0%" rows are
 *   not observed (INFERRED: 5).
 * - **SubjectMastery** (DATA-M05-11): 38 records of 12 KLUANG pupils — 14 Pemula (L0), 20 Mula Belajar
 *   (L1), 4 Aktif (L2); school means 8765 0.7 (33 records, 10 pupils) and 2710 1.2 (5 records, 2
 *   pupils); the per-pupil means of M18 S22 (8765: 0.2, 0.67 ×2, 0.75, 1 ×3, 1.5; 2710: 1, 1.5). The
 *   SRS lists 10 per-pupil means for 12 pupils; the other two are 8765 pupils with only Pemula records
 *   (INFERRED — the only placement that meets the 14 / 20 / 4 split and both school means).
 *   Levels come from BR-20 (correct ≥ 10 → L1, ≥ 25 → L2, ≥ 50 → L3, ≥ 100 → L4, ≥ 200 → L5).
 * - **The class-1156 pupil** (user 4627, 8082, grade 11; XR-M02-06): 3 sessions with a session mean of
 *   58.6 % (2/5, 5/8, 11/15 → 58.611), the last on 15 Sep (= `lastActiveAt`), and 19 mastery records
 *   with a mean level of 3.95 (2 × L5, 14 × L4, 3 × L3 → 75 / 19 = 3.947).
 *
 * Pupil identities are chosen from the M01 users (a finalise-time read); every choice is INFERRED.
 */

import { fnv1a32 } from '@/mock/determinism'

export interface LitePupil {
  id: number
  schoolId: number | null
  grade: number | null
  isActive: boolean
  lastActiveAt: string | null
}

export interface MasteryAnchor {
  userId: number
  subjectId: number
  correct: number
  answered: number
  lastAnsweredAt: string | null
}

export interface AccuracyAnchor {
  userId: number
  subjectId: number
  correct: number
  answered: number
}

/** The class-1156 pupil (M18 XR-M18-21, live id 4627). */
export const PUPIL_1156 = 4627

const h = (...parts: (string | number)[]) => fnv1a32(parts.join(':'))

// --- Levels (BR-20) ---------------------------------------------------------------------------

const LEVEL_FROM = [0, 10, 25, 50, 100, 200, 350] as const

function counters(level: number, key: string): { correct: number; answered: number } {
  const lo = LEVEL_FROM[level] as number
  const hi = (LEVEL_FROM[level + 1] as number) - 1
  const correct = lo === 0 ? 3 + (h(key, 'c') % 7) : lo + (h(key, 'c') % Math.min(hi - lo + 1, 20))
  const answered = correct + 2 + (h(key, 'a') % Math.max(3, Math.round(correct / 4)))
  return { correct, answered }
}

/** Mastery level of a record from its correct answers (BR-20). */
export function masteryLevel(correct: number): number {
  let level = 0
  for (let l = 1; l < LEVEL_FROM.length; l++) if (correct >= (LEVEL_FROM[l] as number)) level = l
  return level
}

// --- KLUANG mastery ----------------------------------------------------------------------------

/** Levels of the records of each role (see the file header). */
const ROLE_LEVELS = {
  P1: [0, 0, 0, 0, 1], // 0.2
  P2: [0, 1, 1], // 0.67
  P3: [0, 1, 1], // 0.67
  P4: [0, 1, 1, 1], // 0.75
  P5: [1, 1], // 1, the T5 pupil without `lastActiveAt`
  P6: [1, 1], // 1
  P7: [1], // 1
  P8: [1, 1, 1, 2, 2, 2], // 1.5
  E1: [0, 0, 0], // 0 (INFERRED)
  E2: [0, 0, 0, 0], // 0 (INFERRED)
  Q1: [1, 1, 1], // 2710: 1
  Q2: [1, 2], // 2710: 1.5
} as const
type Role = keyof typeof ROLE_LEVELS

/** Roles of the other nine 8765 pupils, in the order they take the pupils (by id). */
const OTHER_8765: readonly Role[] = ['P1', 'P2', 'P3', 'P4', 'P6', 'P7', 'P8', 'E1', 'E2']

export interface KluangAnchors {
  mastery: MasteryAnchor[]
  accuracy: AccuracyAnchor[]
  /** userId per role, for the build check and the tests. */
  roles: Record<string, number>
  issues: string[]
}

/**
 * The KLUANG anchors, from the pupils of 8765, 2710, 3160, 2700 and 8767 (active students by id)
 * and the users that answer at 8765 in the answer log (`answering8765`, ascending).
 */
export function kluangAnchors(
  pupils: readonly LitePupil[],
  answering8765: readonly number[],
): KluangAnchors {
  const issues: string[] = []
  const roles: Record<string, number> = {}
  const mastery: MasteryAnchor[] = []
  const accuracy: AccuracyAnchor[] = []
  const of = (school: number) =>
    pupils.filter((p) => p.schoolId === school && p.isActive).sort((a, b) => a.id - b.id)

  const record = (userId: number, role: Role, lastActive: string | null) => {
    const levels = ROLE_LEVELS[role] as readonly number[]
    levels.forEach((level, i) => {
      const subjectId = 1 + (((h(role, userId) % 7) + i) % 19)
      const c = counters(level, `${String(userId)}:${String(i)}`)
      mastery.push({
        userId,
        subjectId,
        correct: c.correct,
        answered: c.answered,
        lastAnsweredAt: lastActive ?? '2026-02-27T12:00:00+08:00',
      })
    })
    roles[role] = userId
  }

  // 8765: ten pupils.
  const p8765 = of(8765)
  const nullPupil =
    p8765.find((p) => p.grade === 11 && p.lastActiveAt === null) ??
    p8765.find((p) => p.lastActiveAt === null)
  if (!nullPupil) issues.push('8765: no pupil without lastActiveAt for the L1 record')
  else record(nullPupil.id, 'P5', null)
  const dated = p8765.filter((p) => p !== nullPupil && p.lastActiveAt !== null)
  OTHER_8765.forEach((role, i) => {
    const p = dated[i]
    if (!p) issues.push(`8765: no pupil for ${role}`)
    else record(p.id, role, p.lastActiveAt)
  })

  // 2710: two pupils (never the M16 anchor 4321).
  const p2710 = of(2710).filter((p) => p.id !== 4321)
  ;(['Q1', 'Q2'] as const).forEach((role, i) => {
    const p = p2710[i]
    if (!p) issues.push(`2710: no pupil for ${role}`)
    else record(p.id, role, p.lastActiveAt)
  })

  // PupilSubjectAccuracy: 8765 X and Y are two of the pupils that answer there.
  const x = answering8765[0]
  const y = answering8765[1]
  if (x === undefined || y === undefined) {
    issues.push('8765: fewer than two answering pupils for the accuracy rows X and Y')
  } else {
    roles.X = x
    roles.Y = y
    for (const [subjectId, correct, answered] of [
      [1, 35, 58],
      [5, 34, 47],
      [6, 47, 51],
      [3, 18, 22],
    ] as const) {
      accuracy.push({ userId: x, subjectId, correct, answered })
    }
    accuracy.push({ userId: y, subjectId: 3, correct: 17, answered: 24 })
  }
  // The "0%" rows: one pupil at each school.
  const zero: readonly (readonly [number, readonly number[]])[] = [
    [3160, [2]],
    [2700, [1, 3, 5]],
    [8767, [4, 5]],
  ]
  for (const [school, subjects] of zero) {
    const p = of(school)[0]
    if (!p) {
      issues.push(`${String(school)}: no pupil for the 0 % accuracy rows`)
      continue
    }
    roles[`zero${String(school)}`] = p.id
    for (const subjectId of subjects) {
      accuracy.push({ userId: p.id, subjectId, correct: 0, answered: 5 })
    }
  }
  return { mastery, accuracy, roles, issues }
}

// --- Class 1156 (user 4627) -------------------------------------------------------------------------

/** Sessions of the class-1156 pupil: [id, subject, correct, questions, completedAt, seconds]. */
export const SESSIONS_1156: readonly (readonly [string, number, number, number, string, number])[] =
  [
    ['K01', 3, 2, 5, '2026-09-08T19:20:00+08:00', 200],
    ['K02', 5, 5, 8, '2026-09-11T20:05:00+08:00', 320],
    ['K03', 1, 11, 15, '2026-09-15T19:40:00+08:00', 600],
  ]
/** Their first answer id (M05 anchor range 500,001–509,999; the canonical rows end at 500,250). */
export const ANSWER_ID_START_1156 = 500_301

/** 19 mastery records: 2 × L5, 14 × L4, 3 × L3 (mean level 75 / 19 = 3.947). */
export function mastery1156(): MasteryAnchor[] {
  const levels = [5, 5, ...Array<number>(14).fill(4), 3, 3, 3]
  return levels.map((level, i) => {
    const lo = LEVEL_FROM[level] as number
    const span = (LEVEL_FROM[level + 1] as number) - lo
    const correct = lo + (h('m1156', i) % Math.max(1, Math.floor(span * 0.8)))
    const answered = Math.round(correct / (0.78 + (h('m1156a', i) % 15) / 100))
    return {
      userId: PUPIL_1156,
      subjectId: 1 + i,
      correct,
      answered: Math.max(answered, correct),
      lastAnsweredAt: `2026-09-${String(1 + (h('m1156d', i) % 15)).padStart(2, '0')}T19:00:00+08:00`,
    }
  })
}
