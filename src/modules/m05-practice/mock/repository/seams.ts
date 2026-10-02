/**
 * Call-time reads of later modules (overview §6.7 "Call-time reads across modules"; D12). Nothing
 * here runs at module load, so the import cycles M05 ↔ M14, M05 → M10 and M05 → M06 are harmless.
 *
 * - **M14** `gamification.onSessionCompleted` (BR-31 step 6), when the M14 stores are booted in this
 *   runtime (`wallet.ready()`); otherwise M05 applies the BR-09 rate itself and returns the
 *   XL-27 defaults for the streak and balance (a boot without the M14 plugin, e.g. unit tests).
 * - **M10** `missions.*`, `remedialTests.forStudent` / `complete`, `questionSets.*` (F-30, not built yet): until the M10
 *   plugin exports them, every read is empty, so `mission`, `remedial` and `question_set` starts
 *   answer 404 and #20/#21 list nothing (as the SRS empty states).
 * - **M06** Tracking A sets (`ramalan`; TODO XR to M06): until M06 exports a `spm` repository with
 *   `ramalanQuestions(subjectId, year, setNo)`, a `ramalan` start answers 404 (unknown set).
 *
 * - **M10** `classrooms.list / memberIds / designation` (F-26c, class placement): the T4 / T5 class members,
 *   the four T4 session holders H1–H4, the T5 leavers and class 228, which the prime reads at finalise
 *   time to place the generated sessions (M08 level cards, M05 §6.14.1). M10 compiles its classes lazily
 *   on the first read, so M05's finalise may run before M10's; without the M10 plugin the seam is `null`
 *   and the prime places sessions without classes.
 *
 * Tests replace any seam with `setPracticeSeamsForTests`.
 */

import * as m06 from '@/modules/m06-spm/mock'
import * as m10 from '@/modules/m10-teacher-class/mock'
import * as m14 from '@/modules/m14-gamification/mock'

type Loose = Record<string, unknown>
type Fn = (...args: unknown[]) => unknown

function repo(ns: object, name: string): Loose | null {
  const r = Reflect.get(ns, name) as unknown
  return typeof r === 'object' && r !== null ? (r as Loose) : null
}

function method(ns: object, name: string, fn: string): Fn | null {
  const f = repo(ns, name)?.[fn]
  return typeof f === 'function' ? (f as Fn) : null
}

export interface GamificationInput {
  userId: number
  sessionId: string
  mode: string
  correct: number
  total: number
  timeSpent: number
  completedAt: string
  pointsEarned: number
  coinsPerCorrect?: number
}

export interface GamificationResult {
  coinsEarned: number
  pointsEarned: number
  streakCount: number
  totalBalance: number
}

/** An M10 mission as M05 reads it (loose: M10 decides the shape). */
export interface MissionView {
  id: number
  subjectId: number | null
  coinsPerCorrect: number
  title?: string
  [k: string]: unknown
}

export interface RemedialView {
  id: number
  studentId: number
  status: string
  subjectId: number | null
  questionIds: number[]
  [k: string]: unknown
}

export interface QuestionSetView {
  id: number
  subjectId: number | null
  questionIds: number[]
  maxAttempts: number
  timeLimitMinutes: number | null
  [k: string]: unknown
}

/** What the prime needs of the M10 class placement (`classrooms.designation()` and the enrolments). */
export interface ClassPlacement {
  /** Distinct students enrolled in a T4 class (149). */
  t4: ReadonlySet<number>
  /** Distinct students enrolled in a T5 class (3,911). */
  t5: ReadonlySet<number>
  /** The four T4 session holders H1–H4 (no-school pool pupils). */
  holders: readonly [number, number, number, number]
  /** The 32 generated T5 pupils that leave every T5 class. */
  leavers: ReadonlySet<number>
  /** The members of class 228 (93 grade-11 pupils of 8082). */
  class228: readonly number[]
  /** The members of class 370 (5 PERNIAGAAN, 8080; M17 §6.7 C). */
  class370: readonly number[]
  /** The teacher cards of M08 S1 designed by M10: the card's pupil count and the distinct pupils of its classes. */
  teacherCards: readonly { students: number; pupils: readonly number[] }[]
}

export interface PracticeSeams {
  /** The M10 class placement, or `null` when the M10 plugin is not booted. */
  classPlacement(): ClassPlacement | null
  /** BR-31 step 6; `null` when M14 is not booted. */
  onSessionCompleted(input: GamificationInput): GamificationResult | null
  missionsForStudent(userId: number, date: string): MissionView[]
  missionQuestionIds(missionId: number, userId: number): number[]
  /** The student's own remedial tests (M10 `remedialTests.forStudent`; the student start, BR-32). */
  remedialTestsForStudent(userId: number): RemedialView[]
  remedialComplete(id: number, input: { afterAccuracy: number; completedAt: string }): void
  /** The Q4 read-only preview (FR-M05-141): own teacher or admin, else `null` (M10 `remedialTests.get`). */
  remedialPreview(id: number, viewer: { id: number; role: string }): RemedialView | null
  questionSetsVisible(userId: number): QuestionSetView[]
  ramalanQuestions(subjectId: number, year: number, setNo: number): number[] | null
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const ids = (v: unknown): number[] =>
  Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []
const rowsOf = (v: unknown): Loose[] =>
  Array.isArray(v)
    ? (v as Loose[])
    : Array.isArray((v as { rows?: unknown } | null)?.rows)
      ? (v as { rows: Loose[] }).rows
      : []

const REAL: PracticeSeams = {
  classPlacement() {
    const list = method(m10, 'classrooms', 'list')
    const memberIds = method(m10, 'classrooms', 'memberIds')
    const designation = method(m10, 'classrooms', 'designation')
    if (!list || !memberIds || !designation) return null
    const d = designation() as Loose | null
    if (!d || typeof d !== 'object') return null
    const t4 = new Set<number>()
    const t5 = new Set<number>()
    for (const c of rowsOf(list({}))) {
      const level = c.educationLevel
      if (level !== 'tingkatan-4' && level !== 'tingkatan-5') continue
      for (const id of ids(memberIds(c.kind, c.classId)))
        (level === 'tingkatan-4' ? t4 : t5).add(id)
    }
    const h = (d.holders ?? {}) as Loose
    return {
      t4,
      t5,
      holders: [num(h.h1), num(h.h2), num(h.h3), num(h.h4)],
      leavers: new Set(ids(d.t5Leavers)),
      class228: ids(memberIds('classroom', 228)),
      class370: ids(memberIds('classroom', 370)),
      teacherCards: rowsOf(d.teacherCards)
        .filter((c) => num(c.students) > 0)
        .map((c) => {
          const pupils = new Set<number>()
          for (const k of rowsOf(list({})))
            if (k.kind === 'classroom' && k.teacherId === c.teacherId)
              for (const id of ids(memberIds(k.kind, k.classId))) pupils.add(id)
          return { students: num(c.students), pupils: [...pupils] }
        }),
    }
  },
  onSessionCompleted(input) {
    const ready = method(m14, 'wallet', 'ready')
    const hook = method(m14, 'gamification', 'onSessionCompleted')
    if (!ready || !hook || ready() !== true) return null
    const r = hook(input) as Loose
    return {
      coinsEarned: num(r.coinsEarned),
      pointsEarned: num(r.pointsEarned, input.pointsEarned),
      streakCount: num(r.streakCount),
      totalBalance: num(r.totalBalance),
    }
  },
  missionsForStudent(userId, date) {
    const f = method(m10, 'missions', 'forStudent')
    return f
      ? rowsOf(f(userId, date)).map((m) => ({
          ...m,
          id: num(m.id),
          subjectId: numOrNull(m.subjectId),
          coinsPerCorrect: num(m.coinsPerCorrect, 3),
        }))
      : []
  },
  missionQuestionIds(missionId, userId) {
    const f = method(m10, 'missions', 'questionIdsFor')
    return f ? ids(f(missionId, userId)) : []
  },
  remedialTestsForStudent(userId) {
    // `remedialTests.get(id)` is the teacher / admin Q4 preview (XL2-48); a student starts only a
    // test of their own list.
    const f = method(m10, 'remedialTests', 'forStudent')
    return f
      ? rowsOf(f(userId)).map((r) => ({
          ...r,
          id: num(r.id),
          studentId: num(r.studentId, userId),
          status: typeof r.status === 'string' ? r.status : '',
          subjectId: numOrNull(r.subjectId),
          questionIds: ids(r.questionIds),
        }))
      : []
  },
  remedialPreview(id, viewer) {
    const r = method(m10, 'remedialTests', 'get')?.(id, viewer) as Loose | null | undefined
    return r
      ? {
          ...r,
          id: num(r.id),
          studentId: num(r.studentId),
          status: typeof r.status === 'string' ? r.status : '',
          subjectId: null,
          questionIds: ids(r.questionIds),
        }
      : null
  },
  remedialComplete(id, input) {
    method(m10, 'remedialTests', 'complete')?.(id, input)
  },
  questionSetsVisible(userId) {
    const f = method(m10, 'questionSets', 'visibleFor')
    return f
      ? rowsOf(f(userId)).map((s) => ({
          ...s,
          id: num(s.id),
          subjectId: numOrNull(s.subjectId),
          questionIds: ids(s.questionIds),
          maxAttempts: num(s.maxAttempts),
          timeLimitMinutes: numOrNull(s.timeLimitMinutes),
        }))
      : []
  },
  // TODO(XR-M05→M06): M06 has no named repository for its Tracking A sets yet; this seam assumes
  // `spm.ramalanQuestions(subjectId, year, setNo)` (question ids of a startable set in set order,
  // BR-M06-14; null for an unknown set). The coordinator routes the XR; M06-T1 confirms or renames.
  ramalanQuestions(subjectId, year, setNo) {
    const f = method(m06, 'spm', 'ramalanQuestions')
    if (!f) return null
    const r = f(subjectId, year, setNo)
    return Array.isArray(r) ? ids(r) : null
  },
}

let override: Partial<PracticeSeams> | null = null

export function seams(): PracticeSeams {
  return override ? { ...REAL, ...override } : REAL
}

/** Test seam: replaces some seams (`null` restores the real ones). */
export function setPracticeSeamsForTests(next: Partial<PracticeSeams> | null): void {
  override = next
}
