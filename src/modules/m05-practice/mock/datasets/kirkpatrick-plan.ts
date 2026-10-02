/**
 * The plan of the KirkpatrickSessionAggregate (SRS M05 v1.17 §6.14.4, DATA-M05-12; M12 v1.5 §6.5,
 * §6.9): a pure, deterministic construction of the 20,991 completed sessions of the T4/T5 students at
 * the non-fixture schools, from the observed tables in `./kirkpatrick-observed.ts`. It knows no user:
 * a student is `(school, index)`; the dataset maps the indexes to M01 users when it is primed.
 *
 * The observed tables are the M12 discovery top-up of 26 Sep; the SRS pins the 25-Sep figures. The
 * difference is the drift of that day (+70 answers, all Sejarah, +7 sessions, +2 September students;
 * 8080 unchanged): it is removed from two students of the largest school, and every figure below is
 * the 25-Sep value (SRS M12 §6.5 "generated under the 25-Sep totals ... removed deterministically").
 *
 * Margins met exactly (every one asserted by `__tests__/mock/kirkpatrick-plan.test.ts`):
 * - platform: 20,991 sessions, 306,133 answers, 253,478 correct; the 26 subject rows (answers and the
 *   displayed accuracy); 946 answering students with the observed answered counts and accuracies;
 *   bands 513 / 259 / 169 / 5 (≥ 50, 20–49, 5–19, 1–4 answers);
 * - per school: sessions, answers, served questions, students with a served question, accuracy and
 *   mean session score as displayed;
 * - 8080: 15,007 answers, its 24 subject rows, Students A (219 = 190 + 23 + 6, 4 days) and B (70 = 5 +
 *   20 + 15 + 15 + 10 + 5, 3 days), April 12 students / 511 answers / 366 correct / 3 champions and
 *   September 1 student / 60 / 33;
 * - months: January 2 students / 3 answers / 1 correct, September 58 students / 13,968 answers /
 *   12,152 correct / 28 champions.
 *
 * **INFERRED choices** (the SRS leaves them open) are marked `INFERRED` and listed in the F-26c report:
 * which students carry which margin, the subject and month placement of every session, the served
 * questions of the unanswered students, session sizes and times, the per-session score.
 *
 * **D9 fixes** (live contradicts itself; each is the minimal change, recorded in the F-26c report):
 * - 8080's correct answers are 11,339, not 11,345: its 53 student accuracies allow at most 11,339 (the 24 subject rows at most 11,344);
 * - 8107 has 5 sessions and 8228 has 4 (live "Sesi" 1 and 3) because each student with a served
 *   question needs a session; the 5 extra sessions are taken from the largest school, so the platform
 *   total stays 20,991.
 */

import { fnv1a32 } from '@/mock/determinism'

import {
  KA_PREDICTIONS,
  KA_SCHOOLS,
  KA_SUBJECTS_8080,
  KA_SUBJECTS_PLATFORM,
} from './kirkpatrick-observed'

// ---------------------------------------------------------------------------------------------
// Pins
// ---------------------------------------------------------------------------------------------

export const KA_SESSIONS = 20_991
export const KA_ANSWERED = 306_133
export const KA_CORRECT = 253_478
/** 8080's correct answers: the largest value its 53 student accuracies allow (D9; SRS says 11,345). */
export const KA_CORRECT_8080 = 11_339
export const KA_SCHOOL_8080 = 8080

/** The M12 clock (= the M05 project clock). */
export const KA_CLOCK_MS = Date.parse('2026-09-25T15:40:00+08:00')
const MYT = 8 * 3_600_000
const DAY = 86_400_000

/** Drift of 26 Sep removed from two students of this school: [answers, sessions] each. */
const DRIFT_SCHOOL = 8880
const DRIFT: readonly (readonly [number, number])[] = [
  [40, 4],
  [30, 3],
]
/** Session adjustments of the platform (D9 / drift): school → sessions added. */
const SESSION_ADJUST: Readonly<Record<number, number>> = { 8880: -12, 8107: 4, 8228: 1 }
/** Served questions of the 5 served-but-unanswered students (INFERRED for 8082 and 8106). */
const UNANSWERED_SERVED: Readonly<Record<number, number>> = {
  9167: 10,
  8765: 20,
  8107: 7,
  8082: 9,
  8106: 8,
}
/** The school with the question-less session (M12 §6.9: score 90 %). */
const QUESTIONLESS_SCHOOL = 940
const QUESTIONLESS_SCORE_TENTHS = 900

/** Months are 0 = January … 8 = September 2026. */
export const KA_MONTHS = 9
export const monthKey = (m: number): string => `2026-${String(m + 1).padStart(2, '0')}`

/** Champion boundary of the month panels: more than 50 answers (no student has exactly 50 there). */
const CHAMPION = 50

// September, January and April pins (M12 §6.5 Q-M12-MONTH).
const SEP = { students: 58, answers: 13_968, correct: 12_152, champions: 28 } as const
const SEP_8080 = { answers: 60, correct: 33 } as const
const APR_8080 = {
  answers: [130, 100, 75, 40, 35, 30, 28, 25, 20, 12, 10, 6],
  correct: 366,
} as const
const JAN = { sizes: [2, 1], correct: 1 } as const

// Students A and B (M12 §6.9): [subjectId, answered, correct, sessions].
const STUDENT_A: readonly (readonly [number, number, number, number])[] = [
  [5, 190, 150, 8],
  [4, 23, 9, 3],
  [3, 6, 1, 1],
]
const STUDENT_B: readonly (readonly [number, number, number, number])[] = [
  [1, 5, 3, 1],
  [6, 20, 11, 2],
  [3, 15, 6, 2],
  [4, 15, 5, 2],
  [2, 10, 2, 1],
  [5, 5, 0, 1],
]
/** Distinct days of A (4) and B (3): the last day of each is isolated (streak 1). */
const DAYS_A = ['2026-07-06', '2026-07-14', '2026-07-22', '2026-08-10']
const DAYS_B = ['2026-06-03', '2026-06-17', '2026-07-02']

// ---------------------------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------------------------

const rnd = (...parts: (string | number)[]): number => fnv1a32(parts.join(':')) / 4_294_967_296

function fail(message: string): never {
  throw new Error(`M05 KirkpatrickSessionAggregate plan: ${message}`)
}

/** Correct answers `c` of `n` whose 1-decimal half-up accuracy is `tenths`/10: [lo, hi]. */
export function accuracyWindow(n: number, tenths: number): [number, number] {
  if (n === 0) return [0, 0]
  return [Math.ceil(((2 * tenths - 1) * n) / 2000), Math.ceil(((2 * tenths + 1) * n) / 2000) - 1]
}

/**
 * Integers `x_i` with `Σ x_i = total`, `lo_i ≤ x_i ≤ hi_i`, close to `total × w_i / Σ w` (largest
 * remainder inside the bounds).
 */
export function splitBounded(
  total: number,
  weights: readonly number[],
  lo: readonly number[],
  hi: readonly number[],
): number[] {
  const n = weights.length
  const x = lo.slice()
  let rest = total - x.reduce((a, b) => a + b, 0)
  const room = hi.reduce((a, b, i) => a + b - (lo[i] as number), 0)
  if (rest < 0 || rest > room) {
    fail(
      `cannot split ${String(total)} within [${String(total - rest)}, ${String(total - rest + room)}]`,
    )
  }
  while (rest > 0) {
    const open: number[] = []
    let sum = 0
    for (let i = 0; i < n; i++) {
      if ((x[i] as number) < (hi[i] as number)) {
        open.push(i)
        sum += Math.max(weights[i] as number, 1e-9)
      }
    }
    const ideal = open.map((i) => (rest * Math.max(weights[i] as number, 1e-9)) / sum)
    let given = 0
    const frac: { i: number; f: number }[] = []
    open.forEach((i, j) => {
      const take = Math.min((hi[i] as number) - (x[i] as number), Math.floor(ideal[j] as number))
      x[i] = (x[i] as number) + take
      given += take
      frac.push({ i, f: (ideal[j] as number) - Math.floor(ideal[j] as number) })
    })
    rest -= given
    frac.sort((a, b) => b.f - a.f || a.i - b.i)
    for (const { i } of frac) {
      if (rest === 0) break
      if ((x[i] as number) < (hi[i] as number)) {
        x[i] = (x[i] as number) + 1
        rest--
      }
    }
  }
  return x
}

/**
 * Values inside windows `[lo_i, hi_i]` (with a preferred `mid_i`) whose sum is `total`: the mids
 * moved in proportion to the room in the needed direction.
 */
export function allocateInWindows(
  items: readonly { lo: number; hi: number; mid: number }[],
  total: number,
): number[] {
  const start = items.map((w) => Math.min(w.hi, Math.max(w.lo, Math.round(w.mid))))
  const diff = total - start.reduce((a, b) => a + b, 0)
  if (diff === 0) return start
  const up = diff > 0
  const room = items.map((w, i) => (up ? w.hi - (start[i] as number) : (start[i] as number) - w.lo))
  const capacity = room.reduce((a, b) => a + b, 0)
  if (capacity < Math.abs(diff)) {
    fail(`windows cannot reach ${String(total)} (short by ${String(Math.abs(diff) - capacity)})`)
  }
  const move = splitBounded(
    Math.abs(diff),
    room,
    room.map(() => 0),
    room,
  )
  return start.map((v, i) => v + (up ? 1 : -1) * (move[i] as number))
}

// ---------------------------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------------------------

const monthStartMs = (m: number): number =>
  Date.parse(`2026-${String(m + 1).padStart(2, '0')}-01T00:00:00+08:00`)
const daysIn = (m: number): number => Math.round((monthStartMs(m + 1) - monthStartMs(m)) / DAY)

/** Epoch ms of a session ending in month `m` (before the clock; 07:00–22:30 MYT). */
function timeIn(m: number, salt: string, fromDay = 1): number {
  const last = m === 8 ? 25 : daysIn(m)
  const day = fromDay + Math.floor(rnd(salt, 'day') * (last - fromDay + 1))
  const tod = 7 * 3_600_000 + Math.floor(rnd(salt, 'tod') * 15.5 * 3_600_000)
  const t = monthStartMs(m) + (day - 1) * DAY + tod
  const cap = KA_CLOCK_MS - 60_000
  return Math.min(t, cap) - (Math.min(t, cap) % 1000)
}

/** Month index (0 = January) of an epoch ms in MYT. */
export function monthOfMs(ms: number): number {
  return new Date(ms + MYT).getUTCMonth()
}

// ---------------------------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------------------------

export type KaStudentKind = 'answering' | 'unanswered' | 'questionless'

export interface KaStudent {
  school: number
  /** Index within the school (the order in which the dataset maps users). */
  index: number
  kind: KaStudentKind
  special: 'A' | 'B' | null
}

export interface KaPlan {
  students: KaStudent[]
  /** Per session (index = the plan row). */
  student: Int32Array
  /** 0 = none. */
  subject: Int16Array
  ms: Float64Array
  served: Int32Array
  answered: Int32Array
  correct: Int32Array
  /** Session score in tenths of a percent. */
  score: Int16Array
  count: number
}

/** The answers of a student in one subject: right (`c`) and wrong (`w`), and the part reserved for a month. */
interface Cell {
  c: number
  w: number
  rc: number
  rw: number
}

interface Stu extends KaStudent {
  gi: number
  q: number
  accTenths: number
  /** Correct answers. */
  c: number
  /** Sessions. */
  k: number
  /** Served questions of a student without an answer. */
  served: number
  cells: Map<number, Cell>
  /** Reserved sessions (a pinned month). */
  reserved: { month: number; subject: number; size: number; correct: number }[]
  /** Fixed cells (Students A and B): [subject, answered, correct, sessions]. */
  fixed: readonly (readonly [number, number, number, number])[] | null
}

export interface KaSchoolTarget {
  id: number
  sessions: number
  answered: number
  served: number
  accTenths: number
  skorTenths: number
}

let cached: KaPlan | null = null

/** The plan (built once per module load). */
export function kirkpatrickPlan(): KaPlan {
  if (!cached) cached = buildPlan()
  return cached
}

const ATTEMPTS = 40

function buildPlan(): KaPlan {
  // --- students ---------------------------------------------------------------------------------
  const schools = [...KA_SCHOOLS].sort((a, b) => a[0] - b[0])
  const students: Stu[] = []
  const bySchool = new Map<number, Stu[]>()
  const blank = (
    school: number,
    index: number,
    kind: KaStudentKind,
    q: number,
    acc: number,
  ): Stu => ({
    school,
    index,
    kind,
    special: null,
    gi: students.length,
    q,
    accTenths: acc,
    c: 0,
    k: 0,
    served: 0,
    cells: new Map(),
    reserved: [],
    fixed: null,
  })
  const targets = new Map<number, KaSchoolTarget>()
  for (const [id, , , answered, served, sessions, acc, skor] of schools) {
    const list: Stu[] = []
    bySchool.set(id, list)
    const rows = KA_PREDICTIONS[id] ?? []
    rows.forEach(([q, a], i) => {
      const s = blank(id, i, 'answering', q, a)
      list.push(s)
      students.push(s)
    })
    if (UNANSWERED_SERVED[id] !== undefined) {
      const s = blank(id, list.length, 'unanswered', 0, 0)
      s.served = UNANSWERED_SERVED[id]
      list.push(s)
      students.push(s)
    }
    if (id === QUESTIONLESS_SCHOOL) {
      const s = blank(id, list.length, 'questionless', 0, 0)
      list.push(s)
      students.push(s)
    }
    targets.set(id, {
      id,
      sessions: sessions + (SESSION_ADJUST[id] ?? 0),
      answered,
      served,
      accTenths: acc,
      skorTenths: skor,
    })
  }

  // Students A and B of 8080 (M12 §6.9): the rows 219 / 73.1 % and 70 / 38.6 %.
  const s8080 = bySchool.get(KA_SCHOOL_8080) as Stu[]
  const stuA = s8080.find((s) => s.q === 219 && s.accTenths === 731)
  const stuB = s8080.find((s) => s.q === 70 && s.accTenths === 386)
  if (!stuA || !stuB) fail('8080 prediction rows of Students A and B not found')
  stuA.special = 'A'
  stuB.special = 'B'
  stuA.fixed = STUDENT_A
  stuB.fixed = STUDENT_B
  stuA.k = STUDENT_A.reduce((a, r) => a + r[3], 0)
  stuB.k = STUDENT_B.reduce((a, r) => a + r[3], 0)

  // The 25-Sep drift: two students of the largest school lose their 26-Sep sessions.
  const drifted = (bySchool.get(DRIFT_SCHOOL) as Stu[])
    .filter((s) => s.kind === 'answering')
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .slice(0, DRIFT.length)
  const driftStudent = new Set<Stu>(drifted)
  const driftAnswers = DRIFT.reduce((a, d) => a + d[0], 0)
  drifted.forEach((s, i) => {
    s.q -= (DRIFT[i] as readonly [number, number])[0]
  })
  const t8880 = targets.get(DRIFT_SCHOOL) as KaSchoolTarget
  t8880.answered -= driftAnswers
  t8880.served -= driftAnswers

  // --- sessions per student ---------------------------------------------------------------------
  for (const t of targets.values()) {
    const list = bySchool.get(t.id) as Stu[]
    if (list.length === 0) {
      if (t.sessions !== 0) fail(`school ${String(t.id)}: sessions but no student`)
      continue
    }
    const fixedSessions = list.filter((s) => s.kind !== 'answering').length
    const ans = list.filter((s) => s.kind === 'answering')
    for (const s of list) if (s.kind !== 'answering') s.k = 1
    const free = ans.filter((s) => s.special === null)
    const pinned = ans.filter((s) => s.special !== null).reduce((a, s) => a + s.k, 0)
    const rest = t.sessions - fixedSessions - pinned
    if (free.length === 0) {
      if (rest !== 0) fail(`school ${String(t.id)}: ${String(rest)} sessions without a student`)
      continue
    }
    const k = splitBounded(
      rest,
      free.map((s) => s.q),
      free.map(() => 1),
      free.map((s) => Math.max(1, s.q)),
    )
    free.forEach((s, i) => {
      s.k = k[i] as number
    })
  }

  // --- correct answers per student --------------------------------------------------------------
  assignStudentCorrect(targets, bySchool, driftStudent)

  // --- subject targets --------------------------------------------------------------------------
  const platformN = new Map<number, number>()
  for (const [id, , n] of KA_SUBJECTS_PLATFORM) platformN.set(id, id === 5 ? n - driftAnswers : n)
  const hostN = new Map(KA_SUBJECTS_8080.map(([id, , n]) => [id, n]))
  const restN = new Map<number, number>()
  for (const [id, n] of platformN) restN.set(id, n - (hostN.get(id) ?? 0))
  for (const [id, n] of restN) if (n < 0) fail(`subject ${String(id)}: 8080 exceeds the platform`)
  const correct = subjectCorrectTargets(restN, hostN)
  const fixedN = new Map<number, number>()
  const fixedC = new Map<number, number>()
  for (const s of [stuA, stuB]) {
    for (const [j, n, c] of s.fixed as NonNullable<Stu['fixed']>) {
      fixedN.set(j, (fixedN.get(j) ?? 0) + n)
      fixedC.set(j, (fixedC.get(j) ?? 0) + c)
    }
  }
  const plainN = new Map<number, number>()
  const plainC = new Map<number, number>()
  for (const [j, n] of hostN) {
    plainN.set(j, n - (fixedN.get(j) ?? 0))
    plainC.set(j, (correct.host.get(j) as number) - (fixedC.get(j) ?? 0))
  }
  const restAcc = new Map(KA_SUBJECTS_PLATFORM.map(([id, acc]) => [id, acc]))
  const hostAcc = new Map(KA_SUBJECTS_8080.map(([id, acc]) => [id, acc]))
  const restPeople = students.filter((s) => s.school !== KA_SCHOOL_8080 && s.kind === 'answering')
  const hostPlain = s8080.filter((s) => s.kind === 'answering' && s.special === null)

  // --- the cells and the reserved month sessions (retried with another shuffle if a pin misses) --
  let last: unknown = null
  let solved = false
  for (let attempt = 0; attempt < ATTEMPTS && !solved; attempt++) {
    for (const s of students) {
      s.cells.clear()
      s.reserved.length = 0
    }
    try {
      transport(restPeople, restN, correct.rest, restAcc, `rest${String(attempt)}`)
      transport(hostPlain, plainN, plainC, hostAcc, `host${String(attempt)}`)
      for (const s of [stuA, stuB]) {
        for (const [j, n, c] of s.fixed as NonNullable<Stu['fixed']>) {
          s.cells.set(j, { c, w: n - c, rc: 0, rw: 0 })
        }
      }
      for (const s of students) {
        if (s.kind === 'answering' && s.cells.size > s.k) {
          fail(
            `student ${String(s.gi)}: ${String(s.cells.size)} subjects for ${String(s.k)} sessions`,
          )
        }
      }
      reserveMonths(restPeople, hostPlain, attempt)
      solved = true
    } catch (e) {
      last = e
    }
  }
  if (!solved) throw last

  // --- sessions ---------------------------------------------------------------------------------
  const out = synthesise(students, targets)
  return {
    students: students.map(({ school, index, kind, special }) => ({
      school,
      index,
      kind,
      special,
    })),
    ...out,
  }
}

// ---------------------------------------------------------------------------------------------
// Correct answers per student (windows: total → schools → students)
// ---------------------------------------------------------------------------------------------

function assignStudentCorrect(
  targets: ReadonlyMap<number, KaSchoolTarget>,
  bySchool: ReadonlyMap<number, Stu[]>,
  drift: ReadonlySet<Stu>,
): void {
  interface Win {
    lo: number
    hi: number
    mid: number
  }
  const studentWindow = (s: Stu): Win => {
    if (s.special === 'A') return { lo: 160, hi: 160, mid: 160 }
    if (s.special === 'B') return { lo: 27, hi: 27, mid: 27 }
    if (s.kind !== 'answering') return { lo: 0, hi: 0, mid: 0 }
    if (drift.has(s)) {
      // Their 25-Sep figures are not observed (the 26-Sep rows include the drift): the accuracy
      // may move by up to 1.5 points from the 26-Sep row (the grade band stays).
      return {
        lo: Math.ceil((s.q * (s.accTenths - 15)) / 1000),
        hi: Math.min(s.q, Math.floor((s.q * (s.accTenths + 15)) / 1000)),
        mid: (s.q * s.accTenths) / 1000,
      }
    }
    const [lo, hi] = accuracyWindow(s.q, s.accTenths)
    return { lo, hi, mid: (s.q * s.accTenths) / 1000 }
  }
  const schoolWin = new Map<number, Win>()
  for (const t of targets.values()) {
    const list = bySchool.get(t.id) as Stu[]
    const wins = list.map(studentWindow)
    const sLo = wins.reduce((a, w) => a + w.lo, 0)
    const sHi = wins.reduce((a, w) => a + w.hi, 0)
    // The drift school's own accuracy is a 25-Sep value with no observation: its students decide.
    const [lo, hi] = t.id === DRIFT_SCHOOL ? [sLo, sHi] : accuracyWindow(t.answered, t.accTenths)
    const w: Win = {
      lo: Math.max(lo, sLo),
      hi: Math.min(hi, sHi),
      mid: (t.answered * t.accTenths) / 1000,
    }
    if (t.answered > 0 && w.lo > w.hi) {
      fail(
        `school ${String(t.id)}: accuracy window [${String(lo)}, ${String(hi)}] vs students [${String(sLo)}, ${String(sHi)}]`,
      )
    }
    schoolWin.set(t.id, w)
  }
  // 8080 first: the largest value its student rows allow (its subject rows allow up to 11,344).
  const w80 = schoolWin.get(KA_SCHOOL_8080) as Win
  const subj80 = KA_SUBJECTS_8080.reduce(
    (a, [, acc, n]) => {
      const [lo, hi] = accuracyWindow(n, acc)
      return [a[0] + lo, a[1] + hi] as const
    },
    [0, 0] as readonly [number, number],
  )
  const c80 = Math.min(w80.hi, subj80[1])
  if (c80 < Math.max(w80.lo, subj80[0])) fail('8080 correct answers: windows do not meet')
  if (c80 !== KA_CORRECT_8080)
    fail(`8080 correct answers ${String(c80)} ≠ ${String(KA_CORRECT_8080)}`)
  const others = [...targets.keys()].filter((id) => id !== KA_SCHOOL_8080)
  const totals = allocateInWindows(
    others.map((id) => schoolWin.get(id) as Win),
    KA_CORRECT - KA_CORRECT_8080,
  )
  const cOf = new Map<number, number>(others.map((id, i) => [id, totals[i] as number]))
  cOf.set(KA_SCHOOL_8080, KA_CORRECT_8080)
  for (const t of targets.values()) {
    const list = bySchool.get(t.id) as Stu[]
    const vals = allocateInWindows(list.map(studentWindow), cOf.get(t.id) as number)
    list.forEach((s, i) => {
      s.c = vals[i] as number
    })
  }
}

/** Subject correct targets: platform windows, 8080 windows, the rest by difference. */
function subjectCorrectTargets(
  rest: ReadonlyMap<number, number>,
  host: ReadonlyMap<number, number>,
): { rest: Map<number, number>; host: Map<number, number> } {
  const hostAcc = new Map(KA_SUBJECTS_8080.map(([id, acc]) => [id, acc]))
  const platAcc = new Map(KA_SUBJECTS_PLATFORM.map(([id, acc]) => [id, acc]))
  const hostIds = [...host.keys()]
  const hostVals = allocateInWindows(
    hostIds.map((id) => {
      const n = host.get(id) as number
      const [lo, hi] = accuracyWindow(n, hostAcc.get(id) as number)
      return { lo, hi, mid: (n * (hostAcc.get(id) as number)) / 1000 }
    }),
    KA_CORRECT_8080,
  )
  const hostC = new Map(hostIds.map((id, i) => [id, hostVals[i] as number]))
  const ids = [...rest.keys()]
  const platN = (id: number) => (rest.get(id) as number) + (host.get(id) ?? 0)
  const platVals = allocateInWindows(
    ids.map((id) => {
      const n = platN(id)
      const [lo, hi] = accuracyWindow(n, platAcc.get(id) as number)
      const h = hostC.get(id) ?? 0
      return {
        lo: Math.max(lo, h),
        hi: Math.min(hi, h + (rest.get(id) as number)),
        mid: (n * (platAcc.get(id) as number)) / 1000,
      }
    }),
    KA_CORRECT,
  )
  const restC = new Map(ids.map((id, i) => [id, (platVals[i] as number) - (hostC.get(id) ?? 0)]))
  return { rest: restC, host: hostC }
}

// ---------------------------------------------------------------------------------------------
// The cells: two transports (right answers, wrong answers) between students and subjects
// ---------------------------------------------------------------------------------------------

const jCount = (q: number): number =>
  q < 20 ? 1 : q < 50 ? 2 : q < 200 ? 3 : q < 1000 ? 4 : q < 5000 ? 6 : 8

/**
 * The answers of `people` in the subjects, exactly on both margins: every student's right answers
 * (`s.c`) and wrong answers (`s.q − s.c`) against every subject's (`targetC`, `targetN − targetC`).
 * Students with at most 4 sessions go whole into one subject; the others are cut into parts that
 * are laid along the subjects (a north-west-corner pass, once for the right and once for the wrong
 * answers), the parts and the subjects sorted by accuracy plus noise, so that a student meets a few
 * subjects of a similar accuracy. Two passes, two trees of cells: never infeasible.
 */
function transport(
  people: readonly Stu[],
  targetN: ReadonlyMap<number, number>,
  targetC: ReadonlyMap<number, number>,
  accuracy: ReadonlyMap<number, number>,
  label: string,
): void {
  const subjects = [...targetN.keys()]
  const capC = new Map<number, number>()
  const capW = new Map<number, number>()
  for (const j of subjects) {
    const n = targetN.get(j) as number
    const c = targetC.get(j) as number
    if (c < 0 || c > n)
      fail(`${label}: subject ${String(j)} has ${String(c)} right of ${String(n)}`)
    capC.set(j, c)
    capW.set(j, n - c)
  }
  const subjKey = new Map(
    subjects.map((j) => [
      j,
      (accuracy.get(j) ?? 800) / 1000 + (rnd('subjkey', label, j) - 0.5) * 0.02,
    ]),
  )
  const order = subjects
    .slice()
    .sort((a, b) => (subjKey.get(b) as number) - (subjKey.get(a) as number) || a - b)
  const put = (s: Stu, j: number, c: number, w: number) => {
    const cell = s.cells.get(j) ?? { c: 0, w: 0, rc: 0, rw: 0 }
    cell.c += c
    cell.w += w
    s.cells.set(j, cell)
    capC.set(j, (capC.get(j) as number) - c)
    capW.set(j, (capW.get(j) as number) - w)
  }
  const accOf = (s: Stu) => (s.q > 0 ? s.c / s.q : 0)
  const rigid = people.filter((s) => s.k <= 4)
  const moving = people.filter((s) => s.k > 4)

  // Whole students first: the subject nearest in accuracy that can hold both their right and wrong.
  for (const s of rigid.sort((a, b) => rnd('rigid', label, a.gi) - rnd('rigid', label, b.gi))) {
    const wrong = s.q - s.c
    let best: number | null = null
    let bestGap = Number.POSITIVE_INFINITY
    for (const j of order) {
      if ((capC.get(j) as number) < s.c || (capW.get(j) as number) < wrong) continue
      const gap = Math.abs((subjKey.get(j) as number) - accOf(s)) + rnd('rg', label, s.gi, j) * 0.02
      if (gap < bestGap) {
        best = j
        bestGap = gap
      }
    }
    if (best === null) fail(`${label}: no subject holds student ${String(s.gi)} whole`)
    put(s, best, s.c, wrong)
  }

  // The others, in parts.
  interface Part {
    s: Stu
    c: number
    w: number
    key: number
  }
  const parts: Part[] = []
  for (const s of moving) {
    const m = Math.max(1, Math.min(jCount(s.q), Math.floor(s.k / 4)))
    const weights = Array.from({ length: m }, (_, i) => 0.5 + rnd('part', label, s.gi, i))
    const cs = splitBounded(
      s.c,
      weights,
      weights.map(() => 0),
      weights.map(() => s.c),
    )
    const ws = splitBounded(
      s.q - s.c,
      weights,
      weights.map(() => 0),
      weights.map(() => s.q - s.c),
    )
    for (let i = 0; i < m; i++) {
      parts.push({
        s,
        c: cs[i] as number,
        w: ws[i] as number,
        key: accOf(s) + (rnd('partkey', label, s.gi, i) - 0.5) * 0.06,
      })
    }
  }
  parts.sort((a, b) => b.key - a.key || a.s.gi - b.s.gi)
  for (const pass of ['c', 'w'] as const) {
    const cap = pass === 'c' ? capC : capW
    let at = 0
    for (const p of parts) {
      let left = pass === 'c' ? p.c : p.w
      while (left > 0) {
        while (at < order.length && (cap.get(order[at] as number) as number) === 0) at++
        if (at === order.length) fail(`${label}: subjects exhausted before the students`)
        const j = order[at] as number
        const take = Math.min(left, cap.get(j) as number)
        put(p.s, j, pass === 'c' ? take : 0, pass === 'w' ? take : 0)
        left -= take
      }
    }
  }
  for (const j of subjects) {
    if (capC.get(j) !== 0 || capW.get(j) !== 0) fail(`${label}: subject ${String(j)} not filled`)
  }
}

// ---------------------------------------------------------------------------------------------
// The reserved month sessions (January, April of 8080, September)
// ---------------------------------------------------------------------------------------------

function reserveMonths(rest: readonly Stu[], hostPlain: readonly Stu[], attempt: number): void {
  const used = new Set<Stu>()
  const room = (s: Stu) => s.k - s.cells.size // sessions left for reserved ones
  const wrongs = (s: Stu) => s.q - s.c
  const availC = (s: Stu) => [...s.cells.values()].reduce((a, x) => a + x.c - x.rc, 0)
  const availW = (s: Stu) => [...s.cells.values()].reduce((a, x) => a + x.w - x.rw, 0)

  /** Carves `amount` answers (`correct` right) of a month out of the student's cells. */
  const place = (
    s: Stu,
    month: number,
    amount: number,
    correct: number,
    sessionsWanted: number,
    tag: string,
  ): boolean => {
    const r = room(s)
    if (r < 1 || amount < 1) return false
    const entries = [...s.cells.entries()]
      .map(([j, x]) => ({ j, x, c: x.c - x.rc, w: x.w - x.rw }))
      .sort((a, b) => b.c + b.w - (a.c + a.w) || a.j - b.j)
    const wantW = amount - correct
    const chosen: typeof entries = []
    let sumC = 0
    let sumW = 0
    for (const e of entries) {
      if (sumC >= correct && sumW >= wantW) break
      if (chosen.length >= Math.min(r, 4)) break
      chosen.push(e)
      sumC += e.c
      sumW += e.w
    }
    if (sumC < correct || sumW < wantW) return false
    const cA = splitBounded(
      correct,
      chosen.map((e) => e.c),
      chosen.map(() => 0),
      chosen.map((e) => e.c),
    )
    const wA = splitBounded(
      wantW,
      chosen.map((e) => e.w),
      chosen.map(() => 0),
      chosen.map((e) => e.w),
    )
    const tot = chosen.map((_, i) => (cA[i] as number) + (wA[i] as number))
    const active = chosen.map((_, i) => i).filter((i) => (tot[i] as number) > 0)
    // The sessions left for the student's other answers must fit them: one per subject with answers
    // left, at most one per answer left (none when nothing is left).
    const kLeft = s.k - s.reserved.length
    const afterFree = entries.reduce((a, e) => a + e.c + e.w, 0) - amount
    const cellsFree = entries.filter((e) => {
      const i = chosen.indexOf(e)
      return e.c + e.w - (i >= 0 ? (tot[i] as number) : 0) > 0
    }).length
    const loSessions = Math.max(active.length, kLeft - afterFree)
    const hiSessions = Math.min(amount, kLeft - cellsFree)
    if (loSessions > hiSessions) return false
    const sessions = Math.min(hiSessions, Math.max(loSessions, Math.min(r, sessionsWanted)))
    const cnt = splitBounded(
      sessions,
      active.map((i) => tot[i] as number),
      active.map(() => 1),
      active.map((i) => tot[i] as number),
    )
    active.forEach((i, u) => {
      const e = chosen[i] as (typeof chosen)[number]
      const sizes = compose(
        tot[i] as number,
        cnt[u] as number,
        `${tag}:${String(s.gi)}:${String(e.j)}`,
      )
      const cors = splitBounded(
        cA[i] as number,
        sizes,
        sizes.map(() => 0),
        sizes,
      )
      sizes.forEach((size, x) => {
        s.reserved.push({ month, subject: e.j, size, correct: cors[x] as number })
      })
      e.x.rc += cA[i] as number
      e.x.rw += wA[i] as number
    })
    return true
  }
  const sessionsFor = (s: Stu, amount: number) =>
    Math.max(1, Math.min(room(s), Math.ceil(amount / 30)))

  // January: two sessions of 2 and 1 answers, 1 correct (M12 §6.5: 2 students / 3 / 1 / 0 champions).
  {
    const cand = rest
      .filter((s) => room(s) >= 2 && s.q >= 20 && s.c >= 1 && wrongs(s) >= 1)
      .sort((a, b) => rnd('jan', attempt, a.gi) - rnd('jan', attempt, b.gi))
    let placed = 0
    for (const s of cand) {
      if (placed === 2) break
      if (place(s, 0, JAN.sizes[placed] as number, placed === 0 ? JAN.correct : 0, 1, 'jan')) {
        used.add(s)
        placed++
      }
    }
    if (placed < 2) fail('January: no two students')
  }

  // 8080 April: 12 students, 511 answers, 366 correct, 3 champions.
  {
    const pick = hostPlain
      .filter((s) => room(s) >= 1)
      .sort((a, b) => b.q - a.q || a.index - b.index)
      .slice(0, 12)
    if (pick.length < 12) fail('8080 April: fewer than 12 students')
    const amounts = APR_8080.answers as readonly number[]
    const win = pick.map((s, i) => {
      const a = amounts[i] as number
      return { lo: Math.max(0, a - wrongs(s)), hi: Math.min(a, s.c), mid: (a * s.c) / s.q }
    })
    const cor = allocateInWindows(win, APR_8080.correct)
    pick.forEach((s, i) => {
      const a = amounts[i] as number
      if (a > s.q || !place(s, 3, a, cor[i] as number, sessionsFor(s, a), 'apr')) {
        fail('8080 April: a student cannot hold its answers')
      }
      used.add(s)
    })
  }
  // 8080 September: 1 student, 60 answers, 33 correct.
  {
    const cand = hostPlain
      .filter(
        (s) =>
          !used.has(s) &&
          room(s) >= 2 &&
          s.q >= 120 &&
          s.c >= SEP_8080.correct &&
          wrongs(s) >= SEP_8080.answers - SEP_8080.correct,
      )
      .sort((a, b) => rnd('sep80', attempt, a.gi) - rnd('sep80', attempt, b.gi))
    const s = cand.find((x) => place(x, 8, SEP_8080.answers, SEP_8080.correct, 3, 'sep80'))
    if (!s) fail('8080 September: no student')
    used.add(s)
  }

  // September, the other schools: 57 students, 27 champions.
  const restSep = SEP.students - 1
  const restAnswers = SEP.answers - SEP_8080.answers
  const restCorrect = SEP.correct - SEP_8080.correct
  for (let tryNo = 0; tryNo < 60; tryNo++) {
    const pool = rest
      .filter((s) => !used.has(s) && room(s) >= 2)
      .sort((a, b) => rnd('sep', attempt, tryNo, a.gi) - rnd('sep', attempt, tryNo, b.gi))
    const champs = pool.filter((s) => s.q >= 400).slice(0, SEP.champions - 1)
    const small = pool
      .filter((s) => s.q >= 8 && !champs.includes(s))
      .slice(0, restSep - champs.length)
    if (champs.length < SEP.champions - 1 || small.length < restSep - champs.length) continue
    const smallAmt = small.map((s, i) =>
      Math.min(s.q, 3 + Math.floor(rnd('smallamt', attempt, tryNo, s.gi, i) * 40)),
    )
    const champTotal = restAnswers - smallAmt.reduce((a, b) => a + b, 0)
    const hi = champs.map((s) => Math.floor(s.q * 0.85))
    if (hi.reduce((a, b) => a + b, 0) < champTotal) continue
    const champAmt = splitBounded(
      champTotal,
      champs.map((s) => Math.pow(s.q, 0.8)),
      champs.map(() => CHAMPION + 1),
      hi,
    )
    const chosen = [...champs, ...small]
    const amounts = [...champAmt, ...smallAmt]
    const win = chosen.map((s, i) => {
      const a = amounts[i] as number
      return { lo: Math.max(0, a - wrongs(s)), hi: Math.min(a, s.c), mid: (a * s.c) / s.q }
    })
    const lo = win.reduce((a, w) => a + w.lo, 0)
    const hiSum = win.reduce((a, w) => a + w.hi, 0)
    if (restCorrect < lo || restCorrect > hiSum) continue
    const cor = allocateInWindows(win, restCorrect)
    // Try the whole set; on failure restore the students' reserved lists and cells.
    const before = chosen.map(
      (s) =>
        [
          s.reserved.length,
          [...s.cells.entries()].map(([j, x]) => [j, x.rc, x.rw] as const),
        ] as const,
    )
    const ok = chosen.every((s, i) => {
      const a = amounts[i] as number
      return availC(s) >= (cor[i] as number) && availW(s) >= a - (cor[i] as number)
        ? place(s, 8, a, cor[i] as number, sessionsFor(s, a), 'sep')
        : false
    })
    if (ok) {
      chosen.forEach((s) => used.add(s))
      return
    }
    chosen.forEach((s, i) => {
      const [len, saved] = before[i] as (typeof before)[number]
      s.reserved.length = len
      for (const [j, rc, rw] of saved) {
        const x = s.cells.get(j) as Cell
        x.rc = rc
        x.rw = rw
      }
    })
  }
  fail('September: no set of 57 students meets the 25-Sep pins')
}

/** Sizes ≥ 1 of `parts` sessions holding `total` answers (weights 0.35–1.65). */
export function compose(total: number, parts: number, salt: string): number[] {
  if (parts <= 0) return []
  if (total < parts) fail(`compose: ${String(total)} answers for ${String(parts)} sessions`)
  const w = Array.from({ length: parts }, (_, i) => 0.35 + 1.3 * rnd('size', salt, i))
  const extra = splitBounded(
    total - parts,
    w,
    w.map(() => 0),
    w.map(() => total),
  )
  return extra.map((e) => e + 1)
}

// ---------------------------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------------------------

interface Draft {
  student: number
  subject: number
  month: number
  ms: number
  answered: number
  correct: number
  served: number
}

function synthesise(
  students: readonly Stu[],
  targets: ReadonlyMap<number, KaSchoolTarget>,
): Omit<KaPlan, 'students'> {
  const drafts: Draft[] = []
  const bySchoolDrafts = new Map<number, Draft[]>()
  const push = (s: Stu, d: Draft) => {
    drafts.push(d)
    const l = bySchoolDrafts.get(s.school) ?? []
    l.push(d)
    bySchoolDrafts.set(s.school, l)
  }
  const allowedMonths = (s: Stu): number[] =>
    s.school === KA_SCHOOL_8080 ? [4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7]

  for (const s of students) {
    if (s.kind === 'unanswered') {
      push(s, {
        student: s.gi,
        subject: 5,
        month: 6,
        ms: timeIn(6, `un:${String(s.gi)}`),
        answered: 0,
        correct: 0,
        served: s.served,
      })
      continue
    }
    if (s.kind === 'questionless') {
      push(s, {
        student: s.gi,
        subject: 0,
        month: 6,
        ms: timeIn(6, `ql:${String(s.gi)}`),
        answered: 0,
        correct: 0,
        served: 0,
      })
      continue
    }
    // Reserved sessions.
    for (const r of s.reserved) {
      push(s, {
        student: s.gi,
        subject: r.subject,
        month: r.month,
        ms: timeIn(r.month, `res:${String(s.gi)}:${String(drafts.length)}`),
        answered: r.size,
        correct: r.correct,
        served: r.size,
      })
    }
    // Free sessions per cell.
    const months = allowedMonths(s)
    const cells = [...s.cells.entries()]
      .map(([j, x]) => ({ j, n: x.c + x.w - x.rc - x.rw, c: x.c - x.rc }))
      .filter((c) => c.n > 0)
      .sort((a, b) => a.j - b.j)
    const sessions = s.k - s.reserved.length
    if (cells.length > sessions) {
      fail(`student ${String(s.gi)}: ${String(cells.length)} cells, ${String(sessions)} sessions`)
    }
    let per: number[]
    if (s.special !== null) {
      const fixed = s.fixed as NonNullable<Stu['fixed']>
      per = cells.map((c) => (fixed.find((f) => f[0] === c.j) as readonly number[])[3] as number)
    } else {
      per = splitBounded(
        sessions,
        cells.map((c) => c.n),
        cells.map(() => 1),
        cells.map((c) => c.n),
      )
    }
    let dayIdx = 0
    cells.forEach((cell, ci) => {
      const cnt = per[ci] as number
      const sizes = compose(cell.n, cnt, `f:${String(s.gi)}:${String(cell.j)}`)
      const cors = splitBounded(
        cell.c,
        sizes.map((z) => z * (0.6 + rnd('cw', s.gi, cell.j, z))),
        sizes.map(() => 0),
        sizes,
      )
      for (let x = 0; x < cnt; x++) {
        let ms: number
        let month: number
        if (s.special !== null) {
          const days = s.special === 'A' ? DAYS_A : DAYS_B
          const day = days[dayIdx % days.length] as string
          dayIdx++
          const hh = String(9 + (dayIdx % 10)).padStart(2, '0')
          const mm = String((dayIdx * 7) % 60).padStart(2, '0')
          ms = Date.parse(`${day}T${hh}:${mm}:00+08:00`)
          month = monthOfMs(ms)
        } else {
          month = months[Math.floor(rnd('month', s.gi, cell.j, x) * months.length)] as number
          ms = timeIn(month, `f:${String(s.gi)}:${String(cell.j)}:${String(x)}`)
        }
        push(s, {
          student: s.gi,
          subject: cell.j,
          month,
          ms,
          answered: sizes[x] as number,
          correct: cors[x] as number,
          served: sizes[x] as number,
        })
      }
    })
  }

  // Served questions: the school's surplus over its answered questions goes to +1…+3 on sessions.
  for (const t of targets.values()) {
    const list = bySchoolDrafts.get(t.id) ?? []
    const unansweredServed = list.filter((d) => d.answered === 0).reduce((a, d) => a + d.served, 0)
    let surplus = t.served - t.answered - unansweredServed
    if (surplus < 0) fail(`school ${String(t.id)}: served < answered`)
    const cand = list
      .filter((d) => d.answered > 0)
      .sort((a, b) => rnd('sv', a.ms, a.student) - rnd('sv', b.ms, b.student))
    if (surplus > 0 && cand.length === 0) fail(`school ${String(t.id)}: surplus without sessions`)
    let pass = 0
    while (surplus > 0) {
      for (const d of cand) {
        if (surplus === 0) break
        if (d.served - d.answered < 1 + pass) {
          d.served++
          surplus--
        }
      }
      pass++
    }
  }

  const scores = scoreSessions(targets, bySchoolDrafts)

  const n = drafts.length
  const plan = {
    student: new Int32Array(n),
    subject: new Int16Array(n),
    ms: new Float64Array(n),
    served: new Int32Array(n),
    answered: new Int32Array(n),
    correct: new Int32Array(n),
    score: new Int16Array(n),
    count: n,
  }
  // Stable order: by school id, student index, time.
  const order = drafts
    .map((d, i) => ({ d, i }))
    .sort((a, b) => {
      const sa = students[a.d.student] as Stu
      const sb = students[b.d.student] as Stu
      return sa.school - sb.school || a.d.student - b.d.student || a.d.ms - b.d.ms || a.i - b.i
    })
  order.forEach(({ d }, r) => {
    plan.student[r] = d.student
    plan.subject[r] = d.subject
    plan.ms[r] = d.ms
    plan.served[r] = d.served
    plan.answered[r] = d.answered
    plan.correct[r] = d.correct
    plan.score[r] = scores.get(d) ?? 0
  })
  return plan
}

/**
 * Mean session score per school (S3 "Skor Purata"): `accuracy + noise`, shifted so the school's mean
 * (over sessions with an answered question) is the displayed value; kept in 0–100 with 0.1
 * resolution.
 */
function scoreSessions(
  targets: ReadonlyMap<number, KaSchoolTarget>,
  bySchoolDrafts: ReadonlyMap<number, Draft[]>,
): Map<Draft, number> {
  const table = new Map<Draft, number>()
  for (const t of targets.values()) {
    const list = bySchoolDrafts.get(t.id) ?? []
    const scored = list.filter((d) => d.answered > 0)
    if (t.id === QUESTIONLESS_SCHOOL) {
      for (const d of list) table.set(d, QUESTIONLESS_SCORE_TENTHS)
      continue
    }
    for (const d of list) if (d.answered === 0) table.set(d, 0)
    if (scored.length === 0) continue
    const base = scored.map(
      (d, i) => (100 * d.correct) / d.answered + (rnd('score', t.id, i, d.ms) - 0.5) * 24,
    )
    const goal = t.skorTenths / 10
    const mean = (shift: number) =>
      scored.reduce((a, _, i) => a + Math.min(100, Math.max(0, (base[i] as number) + shift)), 0) /
      scored.length
    let lo = -100
    let hi = 100
    for (let it = 0; it < 60; it++) {
      const mid = (lo + hi) / 2
      if (mean(mid) < goal) lo = mid
      else hi = mid
    }
    const shift = (lo + hi) / 2
    const tenths = scored.map((_, i) =>
      Math.round(Math.min(100, Math.max(0, (base[i] as number) + shift)) * 10),
    )
    // Exact mean: Σ tenths = goal × count (rounded), moved one tenth at a time.
    const want = Math.round(t.skorTenths * scored.length)
    let have = tenths.reduce((a, b) => a + b, 0)
    const order = scored.map((_, i) => i).sort((a, b) => rnd('fix', t.id, a) - rnd('fix', t.id, b))
    for (let guard = 0; have !== want && guard < 1_000_000; guard++) {
      const step = have < want ? 1 : -1
      let moved = false
      for (const i of order) {
        const v = (tenths[i] as number) + step
        if (v < 0 || v > 1000) continue
        tenths[i] = v
        have += step
        moved = true
        if (have === want) break
      }
      if (!moved) fail(`school ${String(t.id)}: score fit stuck`)
    }
    scored.forEach((d, i) => table.set(d, tenths[i] as number))
  }
  return table
}

export { DRIFT_SCHOOL }
