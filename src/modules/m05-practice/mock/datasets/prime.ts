/**
 * The primed tables of the M05 datasets (SRS M05 v1.16 §6.14 "A generated session groups generated
 * answers of one user and day"), built once per seed by the M05 plugin's `finalise` — after every
 * dataset has compiled, before the baseline and before a persisted overlay — so they depend on the
 * **baseline** only. The cheap fields and `derive` of both datasets read them.
 *
 * For every bucket (seg, school, week, band, P) of `./spec.ts`:
 * 1. **Users** (`./ladders.ts`): each population (a monitoring school, other P, non-P) has an ordered
 *    list of eligible **generated** users of the M01 store (never an anchor of another module, never an
 *    inactive user — the 18 login-only pupils of 8090 included). Window b may use only the first
 *    N_b − (anchor users already in window b) users; a user admitted by band b gets their first
 *    session in band b. So the distinct users of each window are the pinned ones.
 *    - school pupils: grade 10/11 at the school; logged-in first (T5, then T4), then never-logged;
 *      M11's "answered without login" count bounds the logged-in answerers;
 *    - other P: active students outside the segment and the fixture schools, in no M02 pool (the
 *      attendance mirror and the T4 pool never practise here: M10 / M08 constraints);
 *    - non-P: generated active teachers (INFERRED: the only non-P users who may practise).
 * 2. **Sessions:** the bucket's generated answers in sessions are split over its generated sessions
 *    (sizes vary 0.35–1.65 × the mean, ≥ 1). Wrong answers go to sessions by weight
 *    `size^(1 − λ)`; one global λ is found by bisection so that Q-SESS-MEAN-ACC (all sessions,
 *    anchors included) is 79.8 % (M08 S1). This is the only fitted value; it moves no count.
 * 3. **Times:** a session's answers are 12–60 s apart (INFERRED) and end at `completedAt`, placed
 *    inside the bucket's week ∩ band window, preferably 07:00–22:30 MYT; sessionless answers alone.
 * 4. **Attributes:** mode `random` (PROPOSED, §6.14), `mission` for the 8 mission sessions,
 *    `latih_tubi` for 8106's sessions today (M17 §6.7 B); subject by hash among the subjects with
 *    questions at the user's level (SPM pool for T4/T5); coins = correct (× 3 for missions), points
 *    = 10 × correct (BR-09).
 *
 * Issues (a pin the generation cannot meet) are collected in `issues` for the build check.
 */

import { hashKey } from '@/mock/dataset'
import type { UserRow } from '@/modules/m01-authentication/mock'
import { users } from '@/modules/m01-authentication/mock'

import { inSegment, isFixtureSchool } from '../repository/facets'
import { SEGMENT_SCHOOLS } from './m11-cells'
import { chunkSessions, pupilChunks } from './pupil-anchors'
import type { ClassPlacement } from '../repository/seams'
import { questions } from '@/modules/m04-question-bank/mock'

import { BAND_RANGE, PIN_NOW, bandOf, weekBandRange, type Band, DAY_MS } from './calendar'
import { ANSWER_ID_MAX, SESSION_KEY_MAX } from './ids'
import { NON_P_LADDER, OTHER_P_LADDER, segmentLadders, type Ladder } from './ladders'
import {
  ATTENTION_ANCHORS,
  CLASS_228,
  CLASS_228_TOP_QUESTIONS,
  TEACHER_CARD_ACCURACY,
  TEACHER_CARD_MIN_PUPILS,
  T4_HOLDER_SESSIONS,
  T4_SESSIONS,
  T5_MEAN_TENTHS,
  T5_SESSIONS,
  T5_TOP_ROWS,
} from './level-cells'
import { poolQuestionIds } from './derive'
import { M11_AKTIF } from './m11-cells'
import { LATIH_TUBI_TODAY_SCHOOL, SESSIONLESS_2022, SESSION_MEAN_ACC_ALL } from './pins'
import { bucketKey, buckets, type Bucket } from './spec'
import type { AnswerRow, PracticeMode, SessionRow, SpecFacets } from './types'

export const MODE_CODES: readonly PracticeMode[] = [
  'random',
  'chapter',
  'revision',
  'past_year',
  'latih_tubi',
  'ramalan',
  'mission',
  'remedial',
  'question_set',
  'pksk',
]

/** Question lists of designed sessions, planned lazily (class 228). */
export interface DesignedQuestions {
  get(key: number): readonly number[] | undefined
}

export interface PracticePrime {
  // --- answers (index = key) ---
  aUser: Int32Array
  /** Generated session key, 0 = no session. */
  aSess: Int32Array
  aMs: Float64Array
  /** Position of the answer in its session (0-based), or −1. */
  aPos: Int16Array
  // --- sessions (index = key) ---
  sUser: Int32Array
  sCount: Int32Array
  sCorrect: Int32Array
  sTime: Int32Array
  sMs: Float64Array
  sSubject: Int16Array
  sLevel: Int8Array
  sMode: Uint8Array
  /** CSR: answers of session k are `sAnsKeys[sAnsStart[k] … sAnsStart[k + 1])`, in answer order. */
  sAnsStart: Int32Array
  sAnsKeys: Int32Array
  /** Designed question lists of generated sessions (key → ids by answer position; class 228, F-26c). */
  sessionQuestions: DesignedQuestions
  /** Users whose rows come from the generator (their queue / mastery are derived from the log). */
  generatedUsers: ReadonlySet<number>
  /** Users of anchor records (contributed or canonical). */
  anchorUsers: ReadonlySet<number>
  /** Level (M03 id) of every generated user. */
  userLevel: ReadonlyMap<number, number>
  /** Subjects with questions per level (T4/T5: the SPM pool). */
  levelSubjects: ReadonlyMap<number, readonly number[]>
  lambda: number
  meanAccuracy: number
  issues: string[]
}

let prime: PracticePrime | null = null

export function resetPracticePrime(): void {
  prime = null
}

export function practicePrimeOrNull(): PracticePrime | null {
  return prime
}

export function requirePracticePrime(): PracticePrime {
  if (!prime) {
    throw new Error(
      'M05 practice datasets: not primed (the M05 finalise primes them; tests boot the M05 plugin)',
    )
  }
  return prime
}

// ---------------------------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------------------------

/** What the prime reads from the compiled datasets (injected: no import cycle with the files). */
export interface PrimeInputs {
  /** Every generated (non-anchor) answer slot: key and facets. */
  answerSlots(
    visit: (key: number, f: Pick<AnswerRow, keyof SpecFacets | 'isCorrect' | 'hasSession'>) => void,
  ): void
  /** Every generated session slot. */
  sessionSlots(
    visit: (key: number, f: Pick<SessionRow, keyof SpecFacets | 'missionId'>) => void,
  ): void
  /** The anchor rows of both datasets. */
  anchorAnswers(): readonly AnswerRow[]
  anchorSessions(): readonly SessionRow[]
  /** The M10 class placement (F-26c), or null when the M10 plugin is not booted. */
  placement: ClassPlacement | null
}

const pad = (n: number, w: number) => String(n).padStart(w, '0')
const isGeneratedStudent = (u: UserRow) => u.email === `pelajar${pad(u.id, 6)}@demo.test`
const isGeneratedTeacher = (u: UserRow) => u.email === `guru${pad(u.id, 4)}@demo.test`
const FIXTURE = isFixtureSchool
const inSegmentUser = inSegment

/**
 * Users the generator never uses: the canonical accounts 1–11 (their records are the §6.12 design;
 * pelajar2 keeps every empty state) and the M11 §6.7 8080 anchors H 2005 and 4664 "Login sahaja", 4644
 * "Belum login" (M12 / M11 S4 pages of a student with 0 answers).
 */
const NEVER_PRACTISE: ReadonlySet<number> = new Set([
  ...Array.from({ length: 11 }, (_, i) => i + 1),
  2005,
  4664,
  4644,
])

/**
 * The M18 schools whose pupils answer only as M18 documents (SRS M05 §6.14.1, M18 §6.10): the lower-form
 * and primary pupils of these schools never get generated answers (8765 has 6 answering pupils, 222
 * answers; 2710's 119 are M18's anchor).
 */
/** Pupils 3201–3215 of school 8880 (class 516, T4): the sessionless answers of 8880 are theirs. */
const ANSWER_ONLY_8880: readonly number[] = Array.from({ length: 15 }, (_, i) => 3201 + i)

const M18_SCHOOLS: ReadonlySet<number> = new Set([
  8765, 8767, 8772, 3160, 2700, 2710, 7780, 1, 8880,
])

/** Population of a bucket: a school id, `'othP'` or `'nonP'`. */
type Population = number | 'othP' | 'nonP'
const populationOf = (f: SpecFacets): Population =>
  f.seg === 'mon' ? (f.schoolId as number) : f.inP ? 'othP' : 'nonP'

// ---------------------------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------------------------

interface Pools {
  bySchool: Map<number, number[]>
  othP: number[]
  nonP: number[]
  level: Map<number, number>
  /** The 11 members of class 228 under 50 % (M08 S5; the 11 / 46 split is INFERRED, only the total 57 and the top three rows are OBSERVED); empty without a placement. */
  weak228: ReadonlySet<number>
}

/**
 * The ordered eligible users of every population. With the M10 class placement (`placement`,
 * F-26c) the T4-class members and the T5 leavers never practise here (the four T4 holders and the
 * top T5 pupils are designated sessions, `buildPracticePrime`), and inside a school the never-logged
 * answerers (M11 "answered without login") are taken from the pupils in no T5 class first, so a few
 * non-members hold sessions (SRS M05 §6.14.1: T5 members hold 29,971 of the 32,122 sessions).
 * `n7For8082` places exactly two members of class 228 among the 8082 pupils admitted in the last 7
 * days and the other 91 after them (M08 class cell: "2 members active in 7 days").
 */
function buildPools(
  exclude: ReadonlySet<number>,
  placement: ClassPlacement | null,
  n7For8082: number,
): Pools {
  const students = users.query('U-ROLE', { sort: 'id' }, 'student').rows
  const teachers = users.query('U-ROLE', { sort: 'id' }, 'teacher').rows
  const level = new Map<number, number>()
  type Split = { logged: UserRow[]; never: UserRow[] }
  const empty = (): Split => ({ logged: [], never: [] })
  const bySchool = new Map<number, { gen: Split; other: Split }>()
  const oth = { gen: empty(), other: empty() }
  const mirror: UserRow[] = []
  for (const u of students) {
    if (!u.isActive || exclude.has(u.id) || NEVER_PRACTISE.has(u.id)) continue
    if (FIXTURE(u.schoolId)) continue
    if (placement && (placement.t4.has(u.id) || placement.leavers.has(u.id))) continue
    let target: { gen: Split; other: Split }
    if (inSegmentUser(u)) {
      const s = u.schoolId as number
      target = bySchool.get(s) ?? { gen: empty(), other: empty() }
      bySchool.set(s, target)
    } else if (u.pool === 'attendanceMirror' && placement) {
      // M10 R-M02-01: the 137 attendance-mirror pupils (no school) answer only outside 19–25 Sep, so they
      // sit at the end of the other-P order (admitted in the 3-month band or older).
      mirror.push(u)
      level.set(u.id, u.grade ?? 11)
      continue
    } else if (
      u.pool === null &&
      !(placement && M18_SCHOOLS.has(u.schoolId as number)) &&
      // M11 wins (Delivery Lead): a pupil of a school with weekly cells outside grades 10-11 holds no answer, so
      // the school's answers equal its M11 cell sum (the 250 answers of an 8080 grade 9 pupil were a deviation).
      !(placement && u.schoolId !== null && SEGMENT_SCHOOLS.includes(u.schoolId))
    )
      target = oth
    else continue
    const part = isGeneratedStudent(u) ? target.gen : target.other
    ;(u.hasLoggedIn ? part.logged : part.never).push(u)
    level.set(u.id, u.grade ?? 11)
  }
  // T5 before T4 (INFERRED: the segment's practice is overwhelmingly T5, M11 §6.7); generated users
  // before the users other modules designed (they answer only once their owner contributes their
  // records, and then leave the pool).
  const order = (list: readonly UserRow[]) =>
    [...list.filter((u) => u.grade === 11), ...list.filter((u) => u.grade !== 11)].map((u) => u.id)
  const isMember = (u: UserRow) => (placement ? placement.t5.has(u.id) : true)
  // Members first among the logged-in, non-members first among the never-logged.
  const loggedOrder = (list: readonly UserRow[]) => [
    ...order(list.filter(isMember)),
    ...order(list.filter((u) => !isMember(u))),
  ]
  const neverOrder = (list: readonly UserRow[]) => [
    ...order(list.filter((u) => !isMember(u))),
    ...order(list.filter(isMember)),
  ]
  const c228 = new Set(placement?.class228 ?? [])
  let weak228: ReadonlySet<number> = new Set()
  const bySchoolIds = new Map<number, number[]>()
  for (const [s, { gen, other }] of bySchool) {
    const aktif = M11_AKTIF[s]
    const awl = aktif ? aktif[4] : 0
    const all = aktif ? aktif[0] : 0
    let l = [...loggedOrder(gen.logged), ...loggedOrder(other.logged)]
    const n = [...neverOrder(gen.never), ...neverOrder(other.never)]
    if (s === 8082 && c228.size > 0) {
      // Two class-228 members inside the 7-day admissions, the other 91 right after them.
      const inClass = l.filter((id) => c228.has(id))
      const rest = l.filter((id) => !c228.has(id))
      const head = rest.slice(0, Math.max(0, n7For8082 - 2))
      // The last 46 members have no session (M08 attention list): they close the pool, beyond every ladder.
      const active = inClass.slice(0, Math.max(0, inClass.length - CLASS_228.idle))
      const idle = inClass.slice(active.length)
      weak228 = new Set(active.slice(Math.max(2, active.length - CLASS_228.under50)))
      l = [...head, ...active, ...rest.slice(head.length), ...idle]
    }
    // Logged-in answerers first (at most Aktif − answered-without-login), then never-logged.
    const loggedTake = Math.min(l.length, Math.max(0, all - awl))
    bySchoolIds.set(s, [...l.slice(0, loggedTake), ...n, ...l.slice(loggedTake)])
  }
  const othGenerated = [...order(oth.gen.logged), ...order(oth.gen.never)]
  const othDesigned = [...order(oth.other.logged), ...order(oth.other.never)]
  const nonP = [
    ...teachers.filter(
      (u) => u.isActive && u.hasLoggedIn && isGeneratedTeacher(u) && !FIXTURE(u.schoolId),
    ),
    ...teachers.filter(
      (u) => u.isActive && !u.hasLoggedIn && isGeneratedTeacher(u) && !FIXTURE(u.schoolId),
    ),
  ]
    .map((u) => u.id)
    .filter((id) => !exclude.has(id))
  for (const id of nonP) level.set(id, 11)
  return {
    bySchool: bySchoolIds,
    othP: [
      ...othGenerated,
      ...othDesigned,
      ...order(mirror.filter((u) => u.hasLoggedIn)),
      ...order(mirror.filter((u) => !u.hasLoggedIn)),
    ],
    nonP,
    level,
    weak228,
  }
}

// ---------------------------------------------------------------------------------------------
// Subjects per level
// ---------------------------------------------------------------------------------------------

function subjectsByLevel(): Map<number, number[]> {
  const out = new Map<number, number[]>()
  for (let level = 1; level <= 11; level++) {
    // M04 named queries (one O(cells) group count per level): the SPM pool for T4/T5, else the
    // eligible rows of the level (a subject whose eligible rows are not MCQ falls back in `derive`).
    const counts =
      level >= 10
        ? questions.groupCount('Q-SPM-POOL', 'subjectId', undefined, level)
        : questions.groupCount('Q-ELIGIBLE', 'subjectId', undefined, level)
    const list = [...counts]
      .filter(([s, n]) => typeof s === 'number' && n > 0)
      .map(([s]) => s as number)
      .sort((a, b) => a - b)
    out.set(level, list)
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------------------------

const unit = (key: number, salt: number) => hashKey(key, salt) / 4_294_967_296

/** Seconds spent on one generated answer (INFERRED 12–60 s). */
export const answerSeconds = (answerKey: number) => 12 + (hashKey(answerKey, 31) % 49)

/** Seconds of one answer of a session whose gaps are scaled (class 228 only; scale 1 = `answerSeconds`). */
const scaledSeconds = (answerKey: number, scale: number) =>
  Math.max(1, Math.round(answerSeconds(answerKey) * scale))

/** Sizes of `k` sessions holding `n` answers (≥ 1 each; weights 0.35–1.65). */
function sessionSizes(keys: readonly number[], n: number): number[] {
  const k = keys.length
  if (k === 0) return []
  const extra = n - k
  const w = keys.map((key) => 0.35 + 1.3 * unit(key, 41))
  const sum = w.reduce((a, b) => a + b, 0)
  const raw = w.map((x) => (extra * x) / sum)
  const sizes = raw.map((x) => 1 + Math.floor(x))
  let rest = n - sizes.reduce((a, b) => a + b, 0)
  const order = raw
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r || a.i - b.i)
  for (let j = 0; rest > 0; j = (j + 1) % k, rest--) {
    const i = (order[j] as { i: number }).i
    sizes[i] = (sizes[i] as number) + 1
  }
  return sizes
}

/** Wrong answers per session: `W` over `sizes` by weight `size^(1 − λ)`, capped at the size. */
function wrongAllocation(
  keys: readonly number[],
  sizes: readonly number[],
  wrong: number,
  lambda: number,
): number[] {
  const k = sizes.length
  const w = new Array<number>(k).fill(0)
  if (k === 0 || wrong === 0) return w
  // Sessions with the largest share per answer (size^−λ) fill first: cap them in that order while
  // their share reaches their size (each cap raises the ratio left ÷ Σweights, so one pass
  // suffices). λ > 0 favours small sessions, λ < 0 large ones.
  const capped = new Array<boolean>(k).fill(false)
  const weight = sizes.map((s) => Math.pow(s, 1 - lambda))
  let sum = weight.reduce((a, b) => a + b, 0)
  let left = wrong
  const per = (i: number) => (weight[i] as number) / (sizes[i] as number)
  const order = sizes.map((_, i) => i).sort((a, b) => per(b) - per(a) || a - b)
  for (const i of order) {
    const s = sizes[i] as number
    if (sum > 0 && (left * (weight[i] as number)) / sum >= s) {
      capped[i] = true
      left -= s
      sum -= weight[i] as number
    } else break
  }
  const target = sizes.map((s, i) =>
    capped[i] ? s : sum > 0 ? (left * (weight[i] as number)) / sum : 0,
  )
  // Rounding with a per-session offset (hash of the key): unbiased per session, so sessions of the
  // same size do not all round the same way (a plain largest-remainder rounding makes the mean jump
  // as λ moves). The total is then repaired by the closest candidates.
  let assigned = 0
  const score: number[] = new Array<number>(k).fill(0)
  for (let i = 0; i < k; i++) {
    const s = sizes[i] as number
    const t = target[i] as number
    const x = t + unit(keys[i] as number, 42)
    const f = capped[i] ? s : Math.min(s, Math.floor(x))
    w[i] = f
    score[i] = x - f
    assigned += f
  }
  let rest = wrong - assigned
  if (rest !== 0) {
    const idx = w.map((_, i) => i).filter((i) => !capped[i])
    if (rest > 0) {
      idx.sort((a, b) => (score[b] as number) - (score[a] as number) || a - b)
      for (let pass = 0; rest > 0 && pass < 64; pass++) {
        let moved = false
        for (const i of idx) {
          if (rest === 0) break
          if ((w[i] as number) < (sizes[i] as number)) {
            w[i] = (w[i] as number) + 1
            rest--
            moved = true
          }
        }
        if (!moved) break
      }
    } else {
      idx.sort((a, b) => (score[a] as number) - (score[b] as number) || a - b)
      for (let pass = 0; rest < 0 && pass < 64; pass++) {
        let moved = false
        for (const i of idx) {
          if (rest === 0) break
          if ((w[i] as number) > 0) {
            w[i] = (w[i] as number) - 1
            rest++
            moved = true
          }
        }
        if (!moved) break
      }
    }
  }
  return w
}

// ---------------------------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------------------------

const HOUR = 3_600_000
const MYT = 8 * HOUR

/** End time (ms, whole seconds) of an activity of `durMs` inside `[lo, hi)`, 07:00–22:30 if it can. */
function placeEnd(lo: number, hi: number, durMs: number, key: number, salt: number): number {
  const minEnd = lo + durMs
  const maxEnd = Math.min(hi, PIN_NOW) - 1_000
  if (maxEnd <= minEnd) return Math.max(lo, Math.min(maxEnd, minEnd))
  let t = minEnd + Math.floor(unit(key, salt) * (maxEnd - minEnd))
  const tod = (((t + MYT) % DAY_MS) + DAY_MS) % DAY_MS
  if (tod < 7 * HOUR || tod >= 22.5 * HOUR) {
    const day = t - tod
    const alt = day + 7 * HOUR + Math.floor(unit(key, salt + 1) * 15.5 * HOUR)
    if (alt >= minEnd && alt <= maxEnd) t = alt
  }
  return t - (t % 1_000)
}

// ---------------------------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------------------------

interface GenBucket {
  bucket: Bucket
  population: Population
  /** Generated answer keys in sessions, correct / wrong, ascending. */
  correct: number[]
  wrong: number[]
  /** Generated sessionless answer keys. */
  sessionless: number[]
  /** Generated session keys with their mission id, ascending. */
  sessions: { key: number; missionId: number | null }[]
}

/** A designated generated session (F-26c: the T4 holders H1–H4 and the top T5 pupils). */
interface Designated {
  user: number
  size: number
  correct: number
  /** `latih_tubi` (SPM) session (M17 §6.7 B: the week sessions of 2017-2019). */
  spm?: boolean
}

/**
 * SRS M05 §6.14.1 level cells, generator rule (M08 v1.10 Murid Terbaik): every generated user with
 * ≥ 3 completed sessions has at least one session that is not fully correct, so only the observed
 * top pupils reach a 100 % session mean. For a user whose sessions are all fully correct, the
 * largest session gives one correct answer to another session of the **same bucket** that has ≥ 2
 * wrong answers and takes one wrong answer back: sizes, cells and every count stay; only two
 * sessions' correct counts move by one. The designated sessions (`fixed`) and the users that must
 * stay fully correct (`exempt`, the top T5 pupils) are never touched.
 */
function enforceNotAllCorrect(
  plans: readonly { g: GenBucket }[],
  members: Map<number, number[]>,
  sUser: Int32Array,
  sCount: Int32Array,
  sCorrect: Int32Array,
  issues: string[],
  exempt: ReadonlySet<number>,
  fixed: ReadonlyMap<number, Designated>,
): void {
  const bucketOf = new Map<number, GenBucket>()
  const wrong = new Set<number>()
  const byUser = new Map<number, number[]>()
  for (const { g } of plans) {
    for (const k of g.wrong) wrong.add(k)
    for (const s of g.sessions) {
      bucketOf.set(s.key, g)
      const u = sUser[s.key] as number
      const list = byUser.get(u) ?? []
      list.push(s.key)
      byUser.set(u, list)
    }
  }
  const allCorrect = (keys: readonly number[]) =>
    keys.every((k) => (sCorrect[k] as number) === (sCount[k] as number))
  for (const [user, keys] of byUser) {
    if (keys.length < 3 || exempt.has(user) || !allCorrect(keys)) continue
    const donor = keys
      .filter((k) => !fixed.has(k))
      .sort((a, b) => (sCount[b] as number) - (sCount[a] as number) || a - b)[0]
    if (donor === undefined) continue
    const g = bucketOf.get(donor) as GenBucket
    const taker = g.sessions
      .map((s) => s.key)
      .filter(
        (k) => k !== donor && !fixed.has(k) && (sCount[k] as number) - (sCorrect[k] as number) >= 2,
      )
      .sort((a, b) => hashKey(a, 49) - hashKey(b, 49) || a - b)[0]
    if (taker === undefined) {
      issues.push(`generator rule: user ${String(user)} has only fully correct sessions`)
      continue
    }
    const d = members.get(donor) as number[]
    const t = members.get(taker) as number[]
    const c = d.find((k) => !wrong.has(k)) as number
    const w = t.find((k) => wrong.has(k)) as number
    d.splice(d.indexOf(c), 1, w)
    t.splice(t.indexOf(w), 1, c)
    d.sort((a, b) => a - b)
    t.sort((a, b) => a - b)
    sCorrect[donor] = (sCorrect[donor] as number) - 1
    sCorrect[taker] = (sCorrect[taker] as number) + 1
  }
}

// ---------------------------------------------------------------------------------------------
// Selections (F-26c class placement)
// ---------------------------------------------------------------------------------------------

/**
 * A subset of `cands` with exactly `k` elements whose `size` sum is `sumN` and whose `correct` sum
 * lies in `[cLo, cHi]`: a hashed start, then pair swaps (one in, one out) that close the gaps. Returns
 * null when the gaps cannot be closed.
 */
function pickClassSubset(
  cands: readonly number[],
  k: number,
  sumN: number,
  cLo: number,
  cHi: number,
  size: Int32Array,
  correct: Int32Array,
  salt: number,
): number[] | null {
  if (k < 0 || cands.length < k)
    throw new Error(`k=${String(k)} of ${String(cands.length)} candidates`)
  const order = cands.slice().sort((a, b) => hashKey(a, salt) - hashKey(b, salt) || a - b)
  const inA = new Set(order.slice(0, k))
  const out = order.slice(k)
  const bySize = (keys: Iterable<number>) => {
    const m = new Map<number, number[]>()
    for (const key of keys) {
      const list = m.get(size[key] as number) ?? []
      list.push(key)
      m.set(size[key] as number, list)
    }
    return m
  }
  const A = bySize(inA)
  const O = bySize(out)
  const remove = (m: Map<number, number[]>, key: number) => {
    const list = m.get(size[key] as number) as number[]
    list.splice(list.indexOf(key), 1)
    if (list.length === 0) m.delete(size[key] as number)
  }
  const add = (m: Map<number, number[]>, key: number) => {
    const list = m.get(size[key] as number) ?? []
    list.push(key)
    m.set(size[key] as number, list)
  }
  const swap = (a: number, b: number) => {
    remove(A, a)
    remove(O, b)
    add(A, b)
    add(O, a)
    inA.delete(a)
    inA.add(b)
  }
  let curN = 0
  let curC = 0
  for (const key of inA) {
    curN += size[key] as number
    curC += correct[key] as number
  }
  // Answers first: a pair whose size difference is the largest step that does not overshoot.
  for (let guard = 0; curN !== sumN && guard < 200_000; guard++) {
    const d = sumN - curN
    const sign = d > 0 ? 1 : -1
    let done = false
    for (let step = Math.min(Math.abs(d), 60); step >= 1 && !done; step--) {
      for (const sa of [...A.keys()].sort((x, y) => x - y)) {
        const list = O.get(sa + sign * step)
        if (!list || list.length === 0) continue
        const a = (A.get(sa) as number[])[
          hashKey(guard, sa) % (A.get(sa) as number[]).length
        ] as number
        const b = list[hashKey(guard, sa + 1) % list.length] as number
        curN += sign * step
        curC += (correct[b] as number) - (correct[a] as number)
        swap(a, b)
        done = true
        break
      }
    }
    if (!done)
      throw new Error(
        `answers stuck at ${String(curN)} of ${String(sumN)} (${String(A.size)} sizes in, ${String(O.size)} out)`,
      )
  }
  // Correct answers: swaps of equal size that move the sum into the window.
  for (let guard = 0; (curC < cLo || curC > cHi) && guard < 200_000; guard++) {
    const want = cLo + Math.floor((cHi - cLo) / 2) - curC
    const sign = want > 0 ? 1 : -1
    let done = false
    for (const sa of [...A.keys()].sort((x, y) => y - x)) {
      const inList = A.get(sa) as number[]
      const outList = O.get(sa)
      if (!outList || outList.length === 0) continue
      // The swap whose correct difference is nearest to `want` without overshooting.
      let best: [number, number] | null = null
      let bestDiff = 0
      for (let t = 0; t < 12; t++) {
        const a = inList[hashKey(guard * 12 + t, sa) % inList.length] as number
        const b = outList[hashKey(guard * 12 + t, sa + 7) % outList.length] as number
        const diff = (correct[b] as number) - (correct[a] as number)
        if (
          diff * sign > 0 &&
          Math.abs(diff) <= Math.abs(want) &&
          Math.abs(diff) > Math.abs(bestDiff)
        ) {
          best = [a, b]
          bestDiff = diff
        }
      }
      if (best) {
        curC += bestDiff
        swap(best[0], best[1])
        done = true
        break
      }
    }
    // Best effort: the accuracy is finished by `shapeClass228` (swaps inside a bucket).
    if (!done) break
  }
  return [...inA]
}

/**
 * `d` elements of `cands` (by `value`) whose value sum is close to `target`: the window of `d`
 * consecutive elements of the sorted list nearest to it, then single swaps at the edges.
 */
function pickByMean(
  cands: readonly number[],
  d: number,
  target: number,
  value: (key: number) => number,
): number[] {
  const sorted = cands.slice().sort((a, b) => value(a) - value(b) || a - b)
  if (d <= 0) return []
  const prefix = new Float64Array(sorted.length + 1)
  sorted.forEach((k, i) => {
    prefix[i + 1] = (prefix[i] as number) + value(k)
  })
  let lo = 0
  let hi = sorted.length - d
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((prefix[mid + d] as number) - (prefix[mid] as number) < target) lo = mid + 1
    else hi = mid
  }
  let start = lo
  if (start > 0) {
    const a = Math.abs((prefix[start + d] as number) - (prefix[start] as number) - target)
    const b = Math.abs((prefix[start - 1 + d] as number) - (prefix[start - 1] as number) - target)
    if (b < a) start--
  }
  return sorted.slice(start, start + d)
}

/**
 * Most sessions a non-member receives from the T5 shed. Unbounded on purpose: only one ACTIVE non-member
 * pupil (5782 at 8106) is admitted in the never-logged slots (M11 awl); with 60 per pupil only 183 of the
 * 1,596 sessions fit. ACCEPTED (Delivery Lead decision): the concentration stays; M08 and M17 must handle
 * user 5782 when they are built.
 */
/**
 * INFERRED generation choices (only the total 57 and the first three rows of the class-228 attention list are
 * OBSERVED, `ATTENTION_ANCHORS`): the 11 / 46 split, the sessions an unobserved weak member keeps (the admitting
 * session counts) and the share of correct answers of such a member (below the lowest observed row, 44.6 %).
 */
const WEAK_228_SESSIONS = 3
const WEAK_228_SHARE = 0.4
/** The accuracy of `c` correct of `a` answers shown at one decimal, times ten (M08 rounds to 1 decimal). */
const shownTenths = (c: number, a: number) => Math.round((c * 1000) / a)
/** Named M17 pupils and class 370 as designated sessions (XR-M17-02). */
const PUPIL_ANCHORS = true
const SHED_CAP_PER_RECEIVER = 1_000_000

/** Correct answers `c` of `n` whose 1-decimal half-up accuracy is `tenths`/10: [lo, hi]. */
const accWindow = (n: number, tenths: number): [number, number] => [
  Math.ceil(((2 * tenths - 1) * n) / 2000),
  Math.ceil(((2 * tenths + 1) * n) / 2000) - 1,
]

/**
 * The class-placement pins on the finished prime (SRS M05 §6.14.1 Level cells, Class cells): T4
 * members 11 sessions at a session mean of 63.9 %, T5 members 29,971 at 79.7 %, class 228 as the
 * M08 class cell. Problems are added to `issues` (the build check stops the boot).
 */
function checkPlacement(
  placement: ClassPlacement,
  anchors: readonly SessionRow[],
  members: ReadonlyMap<number, number[]>,
  sUser: Int32Array,
  sCount: Int32Array,
  sCorrect: Int32Array,
  sTime: Int32Array,
  sMs: Float64Array,
  sSubject: Int16Array,
  issues: string[],
): void {
  const stat = (test: (u: number) => boolean) => {
    let n = 0
    let acc = 0
    let scored = 0
    for (const key of members.keys()) {
      if (!test(sUser[key] as number)) continue
      n++
      if ((sCount[key] as number) > 0) {
        acc += (100 * (sCorrect[key] as number)) / (sCount[key] as number)
        scored++
      }
    }
    for (const s of anchors) {
      if (s.status !== 'completed' || !test(s.userId)) continue
      n++
      if (s.questionCount > 0) {
        acc += (100 * s.correctCount) / s.questionCount
        scored++
      }
    }
    return { n, mean: scored === 0 ? 0 : acc / scored }
  }
  const t4 = stat((u) => placement.t4.has(u))
  const t5 = stat((u) => placement.t5.has(u))
  if (t4.n !== T4_SESSIONS)
    issues.push(`T4 members hold ${String(t4.n)} sessions, not ${String(T4_SESSIONS)}`)
  if (Math.round(t4.mean * 10) / 10 !== 63.9)
    issues.push(`T4 session mean ${t4.mean.toFixed(3)} ≠ 63.9`)
  // Class 228: the M08 class cell.
  const c228 = new Set(placement.class228)
  let n228 = 0
  let ans228 = 0
  let cor228 = 0
  let secs228 = 0
  const active7d = new Set<number>()
  const perMember = new Map<number, { answers: number; correct: number }>()
  for (const key of members.keys()) {
    const u = sUser[key] as number
    if (!c228.has(u) || sSubject[key] !== CLASS_228.subject) continue
    n228++
    ans228 += sCount[key] as number
    cor228 += sCorrect[key] as number
    const pm = perMember.get(u) ?? { answers: 0, correct: 0 }
    perMember.set(u, {
      answers: pm.answers + (sCount[key] as number),
      correct: pm.correct + (sCorrect[key] as number),
    })
    secs228 += sTime[key] as number
    if ((sMs[key] as number) >= PIN_NOW - 7 * DAY_MS) active7d.add(u)
  }
  const [cLo, cHi] = accWindow(CLASS_228.answers, CLASS_228.accuracyTenths)
  if (n228 !== CLASS_228.sessions)
    issues.push(`class 228 holds ${String(n228)} sessions, not ${String(CLASS_228.sessions)}`)
  if (ans228 !== CLASS_228.answers)
    issues.push(`class 228 holds ${String(ans228)} answers, not ${String(CLASS_228.answers)}`)
  if (cor228 < cLo || cor228 > cHi)
    issues.push(`class 228 correct ${String(cor228)} outside [${String(cLo)}, ${String(cHi)}]`)
  if (n228 > 0 && Math.round((secs228 / n228 / 60) * 10) !== 104)
    issues.push(`class 228 mean time ${(secs228 / n228 / 60).toFixed(2)} min ≠ 10.4`)
  if (active7d.size !== CLASS_228.active7d)
    issues.push(
      `class 228: ${String(active7d.size)} members active in 7 days, not ${String(CLASS_228.active7d)}`,
    )
  // S5 "Perlu Perhatian" (M08 BR-M08-10): members under 50 % and members without a session in the class subject.
  for (const s of anchors) {
    if (s.status === 'completed' && c228.has(s.userId)) {
      const pm = perMember.get(s.userId) ?? { answers: 0, correct: 0 }
      perMember.set(s.userId, {
        answers: pm.answers + s.questionCount,
        correct: pm.correct + s.correctCount,
      })
    }
  }
  let under50 = 0
  for (const pm of perMember.values()) if (pm.answers > 0 && pm.correct * 2 < pm.answers) under50++
  const idle = c228.size - perMember.size
  if (under50 !== CLASS_228.under50)
    issues.push(
      `class 228: ${String(under50)} members under 50 %, not ${String(CLASS_228.under50)}`,
    )
  if (idle !== CLASS_228.idle)
    issues.push(
      `class 228: ${String(idle)} members without a session, not ${String(CLASS_228.idle)}`,
    )
  if (t5.n !== T5_SESSIONS)
    issues.push(`T5 members hold ${String(t5.n)} sessions, not ${String(T5_SESSIONS)}`)
  if (Math.round(t5.mean * 10) !== T5_MEAN_TENTHS)
    issues.push(`T5 session mean ${t5.mean.toFixed(3)} ≠ ${String(T5_MEAN_TENTHS / 10)}`)
}

/**
 * Question lists of the sessions of class 228 in its subject (M08 §6.10, BR-M08-18): 596 tested questions
 * of the T5 pool, 381 "Mudah" (Indeks ≤ 0.30), 78 "Sederhana", 137 "Sukar" (> 0.70), over the answers the
 * members already have (their count and correctness stay). Sukar = 1 attempt, wrong (the three observed top rows: 2 + 2 + 1, `CLASS_228_TOP_QUESTIONS`); Sederhana = 2
 * attempts, 1 right; Mudah = the rest, the wrong answers on questions with ≥ 4 attempts (Indeks ≤ 0.25).
 * Slots are dealt question by question to sessions that do not hold the question yet.
 */
function planClass228Questions(
  keys: readonly number[],
  members: ReadonlyMap<number, number[]>,
  wrongAll: ReadonlySet<number>,
  sLevel: Int8Array,
  userOf: (key: number) => number,
  out: Map<number, readonly number[]>,
  issues: string[],
): void {
  const sorted = keys.slice().sort((a, b) => a - b)
  if (sorted.length === 0) return
  const level = sLevel[sorted[0] as number] as number
  const pool = poolQuestionIds(CLASS_228.subject, level)
  // The three OBSERVED top rows of S11 (discovery M08 S5/S11, lines 1379-1382) are M04 anchors; they take the
  // lowest ids among the Sukar questions so that BR-M08-18 (Indeks descending, ties by id) lists them first.
  const anchorQs: number[] = CLASS_228_TOP_QUESTIONS.map((q) => q.id)
  const rest = pool
    .filter((id) => !anchorQs.includes(id))
    .sort((a, b) => hashKey(a, 81) - hashKey(b, 81) || a - b)
  const lastAnchor = anchorQs[anchorQs.length - 1] as number
  const singles = rest
    .filter((id) => id > lastAnchor)
    .slice(0, CLASS_228.difficulty.sukar - anchorQs.length)
  const singleSet = new Set(singles)
  const others = rest
    .filter((id) => !singleSet.has(id))
    .slice(0, CLASS_228.questions - CLASS_228.difficulty.sukar)
  const chosen = [...others, ...anchorQs, ...singles]
  if (
    anchorQs.some((id) => !pool.includes(id)) ||
    singles.length < CLASS_228.difficulty.sukar - anchorQs.length ||
    chosen.length < CLASS_228.questions
  ) {
    issues.push(
      `class 228: the pool has ${String(pool.length)} < ${String(CLASS_228.questions)} questions`,
    )
    return
  }
  interface Slot {
    key: number
    pos: number
  }
  const wrongSlots: Slot[] = []
  const rightSlots: Slot[] = []
  for (const key of sorted) {
    ;(members.get(key) as number[]).forEach((a, pos) =>
      (wrongAll.has(a) ? wrongSlots : rightSlots).push({ key, pos }),
    )
  }
  const { mudah, sederhana, sukar } = CLASS_228.difficulty
  const n = wrongSlots.length + rightSlots.length
  // Sukar attempts: the three observed questions take 2 + 2 + 1, the others 1 (all wrong).
  const topAttempts = CLASS_228_TOP_QUESTIONS.reduce((a, q) => a + q.attempts, 0)
  const sukarAttempts = sukar - CLASS_228_TOP_QUESTIONS.length + topAttempts
  const mudahAttempts = n - sukarAttempts - 2 * sederhana
  const mudahWrong = wrongSlots.length - sukarAttempts - sederhana
  // Mudah = Indeks ≤ 0.30: at most a quarter of a question's attempts may be wrong (margin for rounding).
  if (
    mudahAttempts < mudah ||
    mudahWrong < 0 ||
    mudahWrong > Math.floor(mudahAttempts / 4) ||
    rightSlots.length < sederhana
  ) {
    issues.push(
      `class 228: ${String(n)} answers (${String(wrongSlots.length)} wrong) cannot give ${String(mudah)} / ${String(sederhana)} / ${String(sukar)} questions`,
    )
    return
  }
  // Targets: [attempts, wrong] per question (the questions with most attempts first, so the last ones
  // still find sessions that do not hold them).
  const targets: [number, number][] = []
  const base = Math.floor(mudahAttempts / mudah)
  const extra = mudahAttempts - base * mudah
  const attempts = Array.from({ length: mudah }, (_, i) => base + (i < extra ? 1 : 0))
  const wrongOf = attempts.map((a) => Math.floor((mudahWrong * a) / mudahAttempts))
  let left = mudahWrong - wrongOf.reduce((x, y) => x + y, 0)
  for (let i = 0; left > 0; i = (i + 1) % mudah) {
    if ((wrongOf[i] as number) + 1 <= Math.floor((attempts[i] as number) / 4)) {
      wrongOf[i] = (wrongOf[i] as number) + 1
      left--
    }
  }
  for (let i = 0; i < mudah; i++) targets.push([attempts[i] as number, wrongOf[i] as number])
  for (let i = 0; i < sederhana; i++) targets.push([2, 1])
  for (const q of CLASS_228_TOP_QUESTIONS) targets.push([q.attempts, q.attempts])
  for (let i = CLASS_228_TOP_QUESTIONS.length; i < sukar; i++) targets.push([1, 1])
  const shuffle = (list: Slot[], salt: number) =>
    list.sort((a, b) => hashKey(a.key * 1000 + a.pos, salt) - hashKey(b.key * 1000 + b.pos, salt))
  shuffle(wrongSlots, 82)
  shuffle(rightSlots, 83)
  const assigned = new Map<number, number[]>()
  const held = new Map<number, Set<number>>()
  for (const key of sorted) {
    assigned.set(key, new Array<number>((members.get(key) as number[]).length).fill(0))
  }
  const take = (list: Slot[], q: number, users?: Set<number>): boolean => {
    for (let i = 0; i < list.length; i++) {
      const s = list[i] as Slot
      const h = held.get(s.key) ?? new Set<number>()
      if (h.has(q)) continue
      // The observed rows count pupils: each attempt of one question is by another member.
      if (users?.has(userOf(s.key))) continue
      users?.add(userOf(s.key))
      h.add(q)
      held.set(s.key, h)
      ;(assigned.get(s.key) as number[])[s.pos] = q
      list[i] = list[list.length - 1] as Slot
      list.pop()
      return true
    }
    return false
  }
  for (let i = 0; i < targets.length; i++) {
    const [attempts, wrong] = targets[i] as [number, number]
    const q = chosen[i] as number
    const users = anchorQs.includes(q) ? new Set<number>() : undefined
    for (let a = 0; a < attempts; a++) {
      if (!take(a < wrong ? wrongSlots : rightSlots, q, users)) {
        issues.push(`class 228: no session slot left for question ${String(q)}`)
        return
      }
    }
  }
  for (const [key, ids] of assigned) out.set(key, ids)
}

export function buildPracticePrime(inputs: PrimeInputs): PracticePrime {
  const issues: string[] = []
  const placement = inputs.placement
  /** Levels of the designated users (the T4 holders 10, the top T5 pupils 11). */
  const levelOverride = new Map<number, number>()
  const byKey = new Map<string, GenBucket>()
  for (const b of buckets()) {
    byKey.set(bucketKey(b), {
      bucket: b,
      population: populationOf(b),
      correct: [],
      wrong: [],
      sessionless: [],
      sessions: [],
    })
  }
  const bucketOf = (f: SpecFacets): GenBucket | undefined => byKey.get(bucketKey(f))

  inputs.answerSlots((key, f) => {
    const g = bucketOf(f)
    if (!g) {
      issues.push(`answer ${String(key)}: no bucket ${bucketKey(f)}`)
      return
    }
    if (!f.hasSession) g.sessionless.push(key)
    else if (f.isCorrect) g.correct.push(key)
    else g.wrong.push(key)
  })
  inputs.sessionSlots((key, f) => {
    const g = bucketOf(f)
    if (!g) {
      issues.push(`session g${String(key)}: no bucket ${bucketKey(f)}`)
      return
    }
    g.sessions.push({ key, missionId: f.missionId })
  })

  // --- anchors ---------------------------------------------------------------------------------
  const anchorAnswers = inputs.anchorAnswers()
  const anchorSessions = inputs.anchorSessions()
  const anchorUsers = new Set<number>()
  for (const a of anchorAnswers) anchorUsers.add(a.userId)
  for (const s of anchorSessions) anchorUsers.add(s.userId)
  /** Users of anchors per population, by band (answers; sessions for non-P). */
  const anchorWindows = new Map<Population, Set<number>[]>()
  const addAnchor = (pop: Population, band: Band, userId: number) => {
    const list = anchorWindows.get(pop) ?? Array.from({ length: 7 }, () => new Set<number>())
    for (let b = band; b <= 6; b++) (list[b] as Set<number>).add(userId)
    anchorWindows.set(pop, list)
  }
  for (const a of anchorAnswers) {
    if (a.inP) addAnchor(populationOf(a), bandOf(Math.min(a.answeredAtMs, PIN_NOW)), a.userId)
  }
  for (const s of anchorSessions) {
    if (!s.inP && s.status === 'completed')
      addAnchor('nonP', bandOf(Math.min(s.completedAtMs, PIN_NOW)), s.userId)
  }

  // --- designated sessions: the T4 holders H1–H4 and the top T5 pupils (M10 class placement) ---------
  const fixed = new Map<number, Designated>()
  const fixedByBucket = new Map<GenBucket, number[]>()
  const designatedUsers = new Set<number>()
  const topUsers: number[] = []
  const designate = (g: GenBucket, list: readonly Designated[], what: string): void => {
    const keys = g.sessions.map((s) => s.key).slice(0, list.length)
    if (keys.length < list.length) {
      issues.push(
        `${what}: bucket ${bucketKey(g.bucket)} has ${String(g.sessions.length)} sessions`,
      )
      return
    }
    keys.forEach((key, i) => {
      const d = list[i] as Designated
      fixed.set(key, d)
      designatedUsers.add(d.user)
      addAnchor(g.population, g.bucket.band as Band, d.user)
    })
    fixedByBucket.set(g, [...(fixedByBucket.get(g) ?? []), ...keys])
  }
  if (placement) {
    const all = [...byKey.values()]
    // H1–H4: sessions of pool pupils of no school ('othP'), in an old bucket with room.
    const holderBucket = all
      .filter((g) => g.population === 'othP' && g.bucket.band === 6 && g.sessions.length >= 11)
      .sort(
        (a, b) =>
          b.sessions.length - a.sessions.length || (a.bucket.week ?? 0) - (b.bucket.week ?? 0),
      )[0]
    if (!holderBucket) issues.push('T4 holders: no old other-P bucket with 11 sessions')
    else {
      designate(
        holderBucket,
        T4_HOLDER_SESSIONS.map(([h, correct, size]) => ({
          user: placement.holders[h],
          size,
          correct,
        })),
        'T4 holders',
      )
      for (const h of placement.holders) levelOverride.set(h, 10)
    }
    // The ten top T5 pupils (all sessions fully correct), members of 8078 by ascending id.
    const tops = users
      .query('U-ROLE', { sort: 'id' }, 'student')
      .rows.filter(
        (u) =>
          u.schoolId === 8078 &&
          u.grade === 11 &&
          u.isActive &&
          u.hasLoggedIn &&
          isGeneratedStudent(u) &&
          placement.t5.has(u.id) &&
          !anchorUsers.has(u.id) &&
          !NEVER_PRACTISE.has(u.id),
      )
      .slice(0, T5_TOP_ROWS.length)
    const topBucket = all
      .filter(
        (g) =>
          g.population === 8078 &&
          g.bucket.band === 6 &&
          g.sessions.length >= T5_TOP_ROWS.reduce((a, r) => a + r[0], 0) + 40 &&
          g.correct.length >= T5_TOP_ROWS.reduce((a, r) => a + r[1], 0) + 200,
      )
      .sort(
        (a, b) =>
          b.sessions.length - a.sessions.length || (a.bucket.week ?? 0) - (b.bucket.week ?? 0),
      )[0]
    if (tops.length < T5_TOP_ROWS.length || !topBucket) {
      issues.push('top T5 pupils: no pupils or no old 8078 bucket with room')
    } else {
      const list: Designated[] = []
      T5_TOP_ROWS.forEach(([sessions, questions], i) => {
        const user = (tops[i] as UserRow).id
        topUsers.push(user)
        levelOverride.set(user, 11)
        const sizes = sessionSizes(
          Array.from({ length: sessions }, (_, x) => 900_000_000 + user * 100 + x),
          questions,
        )
        for (const size of sizes) list.push({ user, size, correct: size })
      })
      designate(topBucket, list, 'top T5 pupils')
    }
  }

  // --- the named pupils of M17 (§6.7) and class 370: designated sessions inside the cells --------------------
  const pupilUsers = new Set<number>()
  if (placement) {
    const chunksAll = PUPIL_ANCHORS ? pupilChunks(placement.class370) : []
    const perBucket = new Map<GenBucket, Designated[]>()
    const buckets = [...byKey.values()]
    for (const c of chunksAll) {
      const g = buckets.find(
        (x) => x.population === c.school && x.bucket.week === c.week && x.bucket.band === c.band,
      )
      const u = users.get(c.user)
      if (!g || !u || !u.isActive || u.schoolId !== c.school) {
        issues.push(
          `pupil ${String(c.user)}: no bucket ${String(c.school)}/${String(c.week)}/${String(c.band)} or the pupil is inactive or at another school`,
        )
        continue
      }
      pupilUsers.add(c.user)
      const list = perBucket.get(g) ?? []
      // Derived session counts (0): the average session size of the bucket, so its remaining sessions keep theirs.
      const free = g.sessions.filter((x) => x.missionId === null).length
      const avg = Math.max(
        1,
        (g.bucket.answers - g.bucket.sessionless) / Math.max(1, g.sessions.length),
      )
      const sessions =
        c.sessions > 0 ? c.sessions : Math.max(1, Math.min(free, Math.round(c.answers / avg)))
      for (const x of chunkSessions({ ...c, sessions })) {
        list.push({
          user: c.user,
          size: x.size,
          correct: x.correct,
          ...(c.spm ? { spm: true } : {}),
        })
      }
      perBucket.set(g, list)
    }
    for (const [g, list] of perBucket) {
      const keys = g.sessions
        .filter((x) => x.missionId === null && !fixed.has(x.key))
        .map((x) => x.key)
        // from the end: the first sessions of a bucket admit its users (fresh) and the missions sit early
        .slice(-list.length)
      if (keys.length < list.length) {
        issues.push(
          `named pupils: bucket ${bucketKey(g.bucket)} has ${String(keys.length)} sessions for ${String(list.length)}`,
        )
        continue
      }
      keys.forEach((key, i) => {
        const d = list[i] as Designated
        fixed.set(key, d)
        designatedUsers.add(d.user)
        addAnchor(g.population, g.bucket.band as Band, d.user)
      })
      fixedByBucket.set(g, [...(fixedByBucket.get(g) ?? []), ...keys])
    }
  }

  // --- 8880: the 6,563 sessionless answers belong to pupils 3201–3215 (class 516; M18 XR-M18-08) ---------
  // They are answer-only users of the 8880 ladder (band 6: the answers are dated M1–M8), so they hold no
  // session (T4 members) and 8880's other 16 of the 31 answering pupils are generated.
  for (const id of ANSWER_ONLY_8880) {
    const u = users.get(id)
    if (!u || !u.isActive || u.schoolId !== 8880) {
      issues.push(`8880 answer-only pupil ${String(id)} is missing, inactive or at another school`)
      continue
    }
    addAnchor(8880, 6, id)
  }

  // --- users -----------------------------------------------------------------------------------
  const ladders = new Map<Population, Ladder>(segmentLadders())
  ladders.set('othP', OTHER_P_LADDER)
  ladders.set('nonP', NON_P_LADDER)
  const effective = (pop: Population): number[] => {
    const ladder = ladders.get(pop) ?? [0, 0, 0, 0, 0, 0, 0]
    const anchors = anchorWindows.get(pop)
    const out: number[] = []
    for (let b = 0; b < 7; b++) {
      const n = (ladder[b] as number) - (anchors ? (anchors[b] as Set<number>).size : 0)
      out.push(Math.max(0, n, b > 0 ? (out[b - 1] as number) : 0))
    }
    return out
  }
  const exclude = new Set<number>([...anchorUsers, ...topUsers, ...ANSWER_ONLY_8880, ...pupilUsers])
  const pools = buildPools(exclude, placement, effective(8082)[2] as number)
  for (const [id, lv] of levelOverride) pools.level.set(id, lv)
  levelOverride.clear()
  const poolOf = (pop: Population): number[] =>
    pop === 'othP' ? pools.othP : pop === 'nonP' ? pools.nonP : (pools.bySchool.get(pop) ?? [])

  // --- the M08 S1 teacher cards (M10 designation; OBSERVED 72.5 % and 72.7 %) ------------------------------
  // A card whose pupils hold (almost) no session in the log gets TEACHER_CARD_MIN_PUPILS active pupils among the
  // admitted users of their population: they take the last positions of the admitted prefix (band 6 only), so
  // no ladder count moves. Their sessions are shaped to the observed accuracy further down.
  const cards = (placement?.teacherCards ?? [])
    .filter((c) => TEACHER_CARD_ACCURACY[c.students] !== undefined)
    .map((c) => ({
      tenths: TEACHER_CARD_ACCURACY[c.students] as number,
      pupils: new Set(c.pupils),
    }))
  if (placement) {
    for (const key of Object.keys(TEACHER_CARD_ACCURACY)) {
      if (!placement.teacherCards.some((c) => String(c.students) === key))
        issues.push(
          `teacher card ${key} pupils: M10 designs no such card, its observed accuracy cannot be placed`,
        )
    }
  }
  const cardUsers = new Set<number>()
  for (const c of cards) for (const u of c.pupils) cardUsers.add(u)
  for (const c of cards) {
    const byPop = new Map<Population, number[]>()
    for (const u of c.pupils) {
      const school = users.get(u)?.schoolId ?? null
      const pop: Population = school !== null && pools.bySchool.has(school) ? school : 'othP'
      byPop.set(pop, [...(byPop.get(pop) ?? []), u])
    }
    for (const [pop, list] of byPop) {
      const pool = poolOf(pop)
      const reach = (effective(pop)[6] as number) | 0
      const inside = list.filter((u) => pool.indexOf(u) >= 0 && pool.indexOf(u) < reach)
      let need = Math.max(0, TEACHER_CARD_MIN_PUPILS - inside.length)
      let slot = reach - 1
      for (const u of list) {
        if (need === 0) break
        const at = pool.indexOf(u)
        if (at < reach) continue // inside already, or not in the pool at all (at = -1 is < reach)
        while (slot >= 0 && cardUsers.has(pool[slot] as number)) slot--
        if (slot < 0) break
        pool[at] = pool[slot] as number
        pool[slot] = u
        slot--
        need--
      }
    }
  }

  const aUser = new Int32Array(ANSWER_ID_MAX + 1)
  const aSess = new Int32Array(ANSWER_ID_MAX + 1)
  const aMs = new Float64Array(ANSWER_ID_MAX + 1)
  const aPos = new Int16Array(ANSWER_ID_MAX + 1).fill(-1)
  const sUser = new Int32Array(SESSION_KEY_MAX + 1)
  const sCount = new Int32Array(SESSION_KEY_MAX + 1)
  const sCorrect = new Int32Array(SESSION_KEY_MAX + 1)
  const sTime = new Int32Array(SESSION_KEY_MAX + 1)
  const sMs = new Float64Array(SESSION_KEY_MAX + 1)
  const sSubject = new Int16Array(SESSION_KEY_MAX + 1)
  const sLevel = new Int8Array(SESSION_KEY_MAX + 1)
  const sMode = new Uint8Array(SESSION_KEY_MAX + 1)
  /** 1 = the session that admits its user in its band (never moved); band; population code. */
  const sFresh = new Uint8Array(SESSION_KEY_MAX + 1)
  const sBand = new Int8Array(SESSION_KEY_MAX + 1).fill(-1)
  const sPop = new Int32Array(SESSION_KEY_MAX + 1)
  const generatedUsers = new Set<number>()

  const all = [...byKey.values()]
  const byPopulation = new Map<Population, GenBucket[]>()
  for (const g of all) {
    const list = byPopulation.get(g.population) ?? []
    list.push(g)
    byPopulation.set(g.population, list)
  }
  const popCode = (pop: Population): number => (pop === 'othP' ? 0 : pop === 'nonP' ? -1 : pop)

  // Session users per population, band by band (non-P: its sessions have no band; see below).
  for (const [pop, list] of byPopulation) {
    const pool = poolOf(pop)
    const n = effective(pop)
    const need = n[6] as number
    if (need > pool.length) {
      issues.push(
        `population ${String(pop)}: ${String(need)} users needed, ${String(pool.length)} eligible users (generated users are recognised by the M01 e-mail pattern pelajar{000000}@demo.test / guru{0000}@demo.test until M01 exposes users.isGenerated, XR logged)`,
      )
    }
    const userAt = (i: number) => pool[Math.min(i, pool.length - 1)] as number
    if (pop === 'nonP') {
      const sessions = list.flatMap((g) => g.sessions).sort((a, b) => a.key - b.key)
      const week = n[1] as number
      const total = n[6] as number
      sessions.forEach((s, i) => {
        const idx = i < total ? i : hashKey(s.key, 43) % Math.max(1, total)
        sUser[s.key] = userAt(idx)
        sPop[s.key] = popCode(pop)
        // The first `week` sessions (one per week user) are this week; the rest earlier.
        sMs[s.key] = i < week ? -1 : -2
      })
      continue
    }
    for (let b = 0 as Band; b <= 6; b = (b + 1) as Band) {
      const sessions = list
        .filter((g) => g.bucket.band === b)
        .flatMap((g) => g.sessions)
        .filter((s) => !fixed.has(s.key))
        .sort((x, y) => x.key - y.key)
      const lo = b > 0 ? (n[b - 1] as number) : 0
      const hi = n[b] as number
      const fresh = hi - lo
      if (sessions.length > 0 && hi === 0) {
        issues.push(`population ${String(pop)} band ${String(b)}: sessions but no users`)
      }
      if (fresh > sessions.length) {
        issues.push(
          `population ${String(pop)} band ${String(b)}: ${String(fresh)} new users, ${String(sessions.length)} sessions`,
        )
      }
      sessions.forEach((s, i) => {
        const isFresh = i < fresh
        const idx = isFresh ? lo + i : hashKey(s.key, 44) % Math.max(1, hi)
        sUser[s.key] = userAt(idx)
        sFresh[s.key] = isFresh ? 1 : 0
        sBand[s.key] = b
        sPop[s.key] = popCode(pop)
      })
      // Sessionless answers of the band: users already admitted (1…hi).
      for (const g of list.filter((x) => x.bucket.band === b)) {
        for (const key of g.sessionless) {
          aUser[key] =
            pop === 8880
              ? (ANSWER_ONLY_8880[hashKey(key, 45) % ANSWER_ONLY_8880.length] as number)
              : userAt(hashKey(key, 45) % Math.max(1, hi))
        }
      }
    }
  }
  // Designated sessions: their fixed users.
  for (const [key, d] of fixed) {
    sUser[key] = d.user
    sFresh[key] = 1
  }
  // Pupil 2022's 6 sessionless answers (M12, 4 May 2026; M17 §6.7 C).
  if (placement) {
    const g2022 = all.find(
      (x) =>
        x.population === SESSIONLESS_2022.schoolId &&
        x.bucket.week === SESSIONLESS_2022.week &&
        x.bucket.band === 6,
    )
    if (!g2022 || g2022.sessionless.length !== SESSIONLESS_2022.count) {
      issues.push('pupil 2022: the sessionless answers of 8080 M12 are missing')
    } else {
      for (const key of g2022.sessionless) aUser[key] = 2022
    }
  }

  // --- sizes and the λ fit -----------------------------------------------------------------------
  const plans = all
    .filter((g) => g.sessions.length > 0 || g.correct.length + g.wrong.length > 0)
    .map((g) => {
      const fixedKeys = fixedByBucket.get(g) ?? []
      const free = g.sessions.filter((s) => !fixed.has(s.key))
      const fixedAnswers = fixedKeys.reduce((a, k) => a + (fixed.get(k) as Designated).size, 0)
      const fixedWrong = fixedKeys.reduce(
        (a, k) => a + (fixed.get(k) as Designated).size - (fixed.get(k) as Designated).correct,
        0,
      )
      const n = g.correct.length + g.wrong.length - fixedAnswers
      if (free.length === 0 && n > 0) {
        issues.push(`bucket ${bucketKey(g.bucket)}: ${String(n)} answers but no generated session`)
      }
      if (n < free.length) {
        issues.push(
          `bucket ${bucketKey(g.bucket)}: ${String(free.length)} sessions for ${String(n)} answers`,
        )
      }
      return {
        g,
        free,
        fixedKeys,
        wrongFree: g.wrong.length - fixedWrong,
        sizes: sessionSizes(
          free.map((s) => s.key),
          Math.max(n, free.length),
        ),
      }
    })
  const anchorAcc = anchorSessions
    .filter((s) => s.status === 'completed' && s.questionCount > 0)
    .map((s) => s.correctCount / s.questionCount)
  const fixedAcc = [...fixed.values()].map((d) => d.correct / d.size)
  const generatedCount = plans.reduce((a, p) => a + p.sizes.length, 0) + fixedAcc.length
  const meanFor = (lambda: number): number => {
    let sum = anchorAcc.reduce((a, b) => a + b, 0) + fixedAcc.reduce((a, b) => a + b, 0)
    for (const { free, sizes, wrongFree } of plans) {
      const w = wrongAllocation(
        free.map((s) => s.key),
        sizes,
        wrongFree,
        lambda,
      )
      sizes.forEach((s, i) => {
        sum += (s - (w[i] as number)) / s
      })
    }
    return sum / (generatedCount + anchorAcc.length)
  }
  // The mean falls as λ grows (more wrong answers in small sessions): bisect λ in [−4, 8].
  const target = SESSION_MEAN_ACC_ALL / 100
  let lo = -4
  let hi = 8
  let lambda = 0
  let mean = meanFor(0)
  if (Math.abs(mean - target) >= 0.00005) {
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2
      const m = meanFor(mid)
      if (m > target) lo = mid
      else hi = mid
      lambda = mid
      mean = m
      if (Math.abs(m - target) < 0.00005) break
    }
  }
  if (Math.abs(mean - target) >= 0.0004) {
    issues.push(
      `Q-SESS-MEAN-ACC ${(mean * 100).toFixed(3)} % cannot reach ${String(SESSION_MEAN_ACC_ALL)} %`,
    )
  }

  // --- assignment of the answers to the sessions -----------------------------------------------
  const csrCounts = new Int32Array(SESSION_KEY_MAX + 2)
  const members = new Map<number, number[]>()
  for (const { g, free, fixedKeys, sizes, wrongFree } of plans) {
    const w = wrongAllocation(
      free.map((s) => s.key),
      sizes,
      wrongFree,
      lambda,
    )
    let ci = 0
    let wi = 0
    for (const key of fixedKeys) {
      const f = fixed.get(key) as Designated
      const keys: number[] = []
      for (let x = 0; x < f.correct && ci < g.correct.length; x++)
        keys.push(g.correct[ci++] as number)
      for (let x = 0; x < f.size - f.correct && wi < g.wrong.length; x++) {
        keys.push(g.wrong[wi++] as number)
      }
      keys.sort((a, b) => a - b)
      members.set(key, keys)
      sCount[key] = keys.length
      sCorrect[key] = f.correct
      csrCounts[key + 1] = keys.length
    }
    free.forEach((s, j) => {
      const size = sizes[j] as number
      const wrong = w[j] as number
      const keys: number[] = []
      let c = 0
      for (let x = 0; x < size - wrong && ci < g.correct.length; x++) {
        keys.push(g.correct[ci++] as number)
        c++
      }
      for (let x = 0; x < wrong && wi < g.wrong.length; x++) keys.push(g.wrong[wi++] as number)
      keys.sort((a, b) => a - b)
      members.set(s.key, keys)
      sCount[s.key] = keys.length
      sCorrect[s.key] = c
      csrCounts[s.key + 1] = keys.length
    })
    if (ci !== g.correct.length || wi !== g.wrong.length) {
      issues.push(`bucket ${bucketKey(g.bucket)}: answers left over after the split`)
    }
  }

  // --- the class placement: class 228, then the T5 members' share (F-26c) -----------------------------
  const isT5 = (u: number) => (placement ? placement.t5.has(u) : false)
  const c228Users = new Set<number>(placement?.class228 ?? [])
  const scale228 = new Map<number, number>()
  if (placement) {
    const eff8082 = effective(8082)
    const pool8082 = poolOf(8082)
    const inBand = (
      b: number,
      pool: readonly number[],
      eff: readonly number[],
      pred: (u: number) => boolean,
    ) => pool.slice(0, eff[b] as number).filter(pred)
    // Class 228 (school 8082): its sessions, answers and correct answers; anchors of its members count.
    let a228 = { sessions: 0, answers: 0, correct: 0 }
    for (const s of anchorSessions) {
      if (s.status === 'completed' && c228Users.has(s.userId)) {
        a228 = {
          sessions: a228.sessions + 1,
          answers: a228.answers + s.questionCount,
          correct: a228.correct + s.correctCount,
        }
      }
    }
    const movable8082: number[] = []
    let fresh228 = { sessions: 0, answers: 0, correct: 0 }
    for (const g of byPopulation.get(8082) ?? []) {
      for (const s of g.sessions) {
        if (fixed.has(s.key)) continue
        if (sFresh[s.key] === 1) {
          if (c228Users.has(sUser[s.key] as number)) {
            fresh228 = {
              sessions: fresh228.sessions + 1,
              answers: fresh228.answers + (sCount[s.key] as number),
              correct: fresh228.correct + (sCorrect[s.key] as number),
            }
          }
        } else if (
          s.missionId === null &&
          inBand(sBand[s.key] as number, pool8082, eff8082, (u) => c228Users.has(u)).length > 0
        ) {
          movable8082.push(s.key)
        }
      }
    }
    const [cLo, cHi] = accWindow(CLASS_228.answers, CLASS_228.accuracyTenths)
    const need = CLASS_228.sessions - a228.sessions - fresh228.sessions
    let subset: number[] | null = null
    try {
      subset = pickClassSubset(
        movable8082,
        need,
        CLASS_228.answers - a228.answers - fresh228.answers,
        cLo - a228.correct - fresh228.correct,
        cHi - a228.correct - fresh228.correct,
        sCount,
        sCorrect,
        71,
      )
    } catch (e) {
      issues.push(
        `class 228: the sessions, answers and accuracy cannot be met (${(e as Error).message}; need ${String(need)}, fresh ${String(fresh228.sessions)}, anchors ${String(a228.sessions)})`,
      )
    }
    if (subset !== null) {
      const chosen = new Set(subset)
      for (const key of movable8082) {
        const b = sBand[key] as number
        const eligible = chosen.has(key)
          ? inBand(b, pool8082, eff8082, (u) => c228Users.has(u))
          : inBand(b, pool8082, eff8082, (u) => !c228Users.has(u))
        if (eligible.length === 0) continue
        sUser[key] = eligible[hashKey(key, 72) % eligible.length] as number
      }
      // Sessions of 8082 that stay movable but were not candidates keep a non-228 user.
      for (const g of byPopulation.get(8082) ?? []) {
        for (const s of g.sessions) {
          if (fixed.has(s.key) || sFresh[s.key] === 1 || chosen.has(s.key)) continue
          if (c228Users.has(sUser[s.key] as number)) {
            const eligible = inBand(
              sBand[s.key] as number,
              pool8082,
              eff8082,
              (u) => !c228Users.has(u),
            )
            if (eligible.length > 0)
              sUser[s.key] = eligible[hashKey(s.key, 73) % eligible.length] as number
          }
        }
      }
    }

    // The 11 members under 50 % (S5 attention list) keep few sessions: the surplus moves to the other
    // admitted members of the same band, so the 36 others carry the class accuracy. The first three keep
    // the OBSERVED session counts 3 / 2 / 5 and an accuracy that shows as 48.3 / 45 / 44.6 (anchorGoal).
    const anchorGoal = new Map<number, number>()
    const anchorIds = [...pools.weak228].slice(0, ATTENTION_ANCHORS.length)
    const weak228 = pools.weak228
    if (subset !== null && weak228.size > 0) {
      const strongIn = (b: number) =>
        inBand(b, pool8082, eff8082, (u) => c228Users.has(u) && !weak228.has(u))
      const kept = new Map<number, number>()
      const keys8082: number[] = []
      for (const g of byPopulation.get(8082) ?? []) for (const s of g.sessions) keys8082.push(s.key)
      keys8082.sort((a, b) => a - b)
      for (const key of keys8082) {
        const u = sUser[key] as number
        if (weak228.has(u) && (fixed.has(key) || sFresh[key] === 1))
          kept.set(u, (kept.get(u) ?? 0) + 1)
      }
      for (const key of keys8082) {
        const u = sUser[key] as number
        if (!weak228.has(u) || fixed.has(key) || sFresh[key] === 1) continue
        const n = kept.get(u) ?? 0
        if (!anchorIds.includes(u) && n < WEAK_228_SESSIONS) {
          kept.set(u, n + 1)
          continue
        }
        const to = strongIn(sBand[key] as number)
        if (to.length > 0) sUser[key] = to[hashKey(key, 74) % to.length] as number
      }
      // Anchors: add sessions (taken from the other members of the class, same band) so that the count and the
      // answer total give the observed accuracy.
      anchorIds.forEach((u, i) => {
        const spec = ATTENTION_ANCHORS[i] as (typeof ATTENTION_ANCHORS)[number]
        const pos = pool8082.indexOf(u)
        let have = 0
        let haveAnswers = 0
        for (const key of keys8082) {
          if (sUser[key] === u) {
            have++
            haveAnswers += sCount[key] as number
          }
        }
        const need = spec.sessions - have
        const cands = keys8082.filter(
          (k) =>
            !fixed.has(k) &&
            sFresh[k] !== 1 &&
            c228Users.has(sUser[k] as number) &&
            !weak228.has(sUser[k] as number) &&
            pos < (eff8082[sBand[k] as number] as number),
        )
        const bySize = new Map<number, number[]>()
        for (const k of cands) {
          const l = bySize.get(sCount[k] as number) ?? []
          l.push(k)
          bySize.set(sCount[k] as number, l)
        }
        const sizes = [...bySize.keys()].sort((a, b) => a - b)
        // Pick `need` sessions whose sizes complete an answer total with a valid correct count.
        const best = (target: number): number[] | null => {
          const go = (idx: number, left: number, sum: number, taken: number[]): number[] | null => {
            if (left === 0) return sum === target ? taken : null
            if (idx >= sizes.length) return null
            const size = sizes[idx] as number
            const avail = (bySize.get(size) as number[]).length
            for (let c = Math.min(left, avail); c >= 0; c--) {
              if (sum + c * size > target) continue
              const r = go(idx + 1, left - c, sum + c * size, [
                ...taken,
                ...Array<number>(c).fill(size),
              ])
              if (r) return r
            }
            return null
          }
          return go(0, need, haveAnswers, [])
        }
        const goalOf = (total: number) => {
          for (let c = Math.floor(total * 0.5); c >= 0; c--) {
            if (shownTenths(c, total) === spec.tenths) return c
          }
          return -1
        }
        // The answer total nearest 21 answers per session (the class mean) first.
        const base = Math.round(spec.sessions * 21)
        for (let d = 0; d < 80 && !anchorGoal.has(u); d++) {
          for (const total of d === 0 ? [base] : [base + d, base - d]) {
            if (need < 0 || total < haveAnswers + need || goalOf(total) < 0) continue
            const picked = best(total)
            if (!picked) continue
            const taken = new Map<number, number>()
            for (const size of picked) taken.set(size, (taken.get(size) ?? 0) + 1)
            for (const [size, n] of taken) {
              const list = (bySize.get(size) as number[])
                .slice()
                .sort((a, b) => hashKey(a, 75) - hashKey(b, 75) || a - b)
              for (const k of list.slice(0, n)) sUser[k] = u
            }
            anchorGoal.set(u, goalOf(total))
            break
          }
        }
        if (!anchorGoal.has(u))
          issues.push(
            `class 228: attention row ${String(i + 1)} (${String(spec.sessions)} sessions) cannot be built`,
          )
      })
    }

    // Accuracy of class 228: it reads 77.6 % per answer while 8082 reads 82.3 %. Correct answers move
    // from the class's sessions to other sessions of the same bucket and (nearly) the same size: one
    // correct and one wrong answer key change places, so every session size and every bucket total
    // stay. Partners are taken above and below in size alternately, so the session mean stays.
    {
      const wrongKeys = new Set<number>()
      for (const g of byPopulation.get(8082) ?? []) for (const k of g.wrong) wrongKeys.add(k)
      const target = Math.floor((cLo + cHi) / 2)
      const inClass = (key: number) => c228Users.has(sUser[key] as number)
      let cur = a228.correct
      for (const g of byPopulation.get(8082) ?? []) {
        for (const s of g.sessions) if (inClass(s.key)) cur += sCorrect[s.key] as number
      }
      let deficit = cur - target
      const start = deficit
      let moves = 0
      const buckets8082 = (byPopulation.get(8082) ?? []).map((g) => {
        const ins: number[] = []
        const weakIns: number[] = []
        const outsBySize = new Map<number, number[]>()
        for (const s of g.sessions) {
          if (fixed.has(s.key)) continue
          if (inClass(s.key))
            (pools.weak228.has(sUser[s.key] as number) ? weakIns : ins).push(s.key)
          else {
            const list = outsBySize.get(sCount[s.key] as number) ?? []
            list.push(s.key)
            outsBySize.set(sCount[s.key] as number, list)
          }
        }
        return { ins, weakIns, outsBySize }
      })
      // One correct answer of session `a` changes places with a wrong answer of a session of the same bucket
      // and (nearly) the same size that is not in `used`; returns false when there is none.
      const swapOnce = (
        a: number,
        outsBySize: ReadonlyMap<number, number[]>,
        used: Set<number>,
        pass: number,
      ): boolean => {
        if ((sCorrect[a] as number) < 1) return false
        const size = sCount[a] as number
        let partner = -1
        for (let d = 0; d <= 8 && partner < 0; d++) {
          const order = pass % 2 === 0 ? [d, -d] : [-d, d]
          for (const off of order) {
            const list = outsBySize.get(size + off)
            if (!list) continue
            const hit = list.find(
              (k) => !used.has(k) && (sCount[k] as number) - (sCorrect[k] as number) >= 1,
            )
            if (hit !== undefined) {
              partner = hit
              break
            }
            if (d === 0) break
          }
        }
        if (partner < 0) return false
        const la = members.get(a) as number[]
        const lb = members.get(partner) as number[]
        const ia = la.findIndex((k) => !wrongKeys.has(k))
        const ib = lb.findIndex((k) => wrongKeys.has(k))
        if (ia < 0 || ib < 0) return false
        const ka = la[ia] as number
        la[ia] = lb[ib] as number
        lb[ib] = ka
        la.sort((x, y) => x - y)
        lb.sort((x, y) => x - y)
        sCorrect[a] = (sCorrect[a] as number) - 1
        sCorrect[partner] = (sCorrect[partner] as number) + 1
        used.add(partner)
        deficit--
        moves++
        return true
      }
      // The sessions of the members under 50 % first: down to WEAK_228_SHARE of their answers.
      for (const { weakIns, outsBySize } of buckets8082) {
        const used = new Set<number>()
        for (const a of weakIns) {
          if (anchorGoal.has(sUser[a] as number)) continue
          const goal = Math.floor((sCount[a] as number) * WEAK_228_SHARE)
          while ((sCorrect[a] as number) > goal && swapOnce(a, outsBySize, used, 0)) {
            /* repeat */
          }
        }
      }
      // The observed rows: the member's correct answers down to the goal that shows the observed accuracy.
      for (const [u, goal] of anchorGoal) {
        const total = () => {
          let t = 0
          for (const k of members.keys()) if (sUser[k] === u) t += sCorrect[k] as number
          return t
        }
        for (const { weakIns, outsBySize } of buckets8082) {
          const used = new Set<number>()
          for (const a of weakIns.filter((k) => sUser[k] === u)) {
            while (total() > goal && swapOnce(a, outsBySize, used, 0)) {
              /* repeat */
            }
          }
        }
        if (total() !== goal)
          issues.push(
            `class 228: an observed attention row stays at ${String(total())} correct, not ${String(goal)}`,
          )
      }
      for (let pass = 0; pass < 2000 && deficit > 0; pass++) {
        let progress = false
        for (const { ins, outsBySize } of buckets8082) {
          const used = new Set<number>()
          ins.sort((x, y) => (sCorrect[y] as number) - (sCorrect[x] as number) || x - y)
          for (const a of ins) {
            if (deficit <= 0) break
            if (swapOnce(a, outsBySize, used, pass)) progress = true
          }
        }
        if (!progress) break
      }
      if (deficit > 0)
        issues.push(
          `class 228: ${String(deficit)} of ${String(start)} correct answers too many after ${String(moves)} swaps`,
        )
    }

    // The teacher cards: the mean of the session accuracies of a card's pupils reads 72.5 % / 72.7 % (M08 S1).
    // A correct answer changes places with a wrong one between a pupil's session and a session of the same bucket
    // and size (nearest size otherwise) of a user outside every designed set; the bucket totals stay.
    if (cards.length > 0) {
      const wrongKeys = new Set<number>()
      for (const g of all) for (const k of g.wrong) wrongKeys.add(k)
      const bucketOfKey = new Map<number, GenBucket>()
      for (const g of all) for (const x of g.sessions) bucketOfKey.set(x.key, g)
      const swap = (from: number, to: number): boolean => {
        // one correct answer of `from` and one wrong answer of `to` change places
        const lf = members.get(from) as number[]
        const lt = members.get(to) as number[]
        const i = lf.findIndex((k) => !wrongKeys.has(k))
        const j = lt.findIndex((k) => wrongKeys.has(k))
        if (i < 0 || j < 0) return false
        const k = lf[i] as number
        lf[i] = lt[j] as number
        lt[j] = k
        lf.sort((x, y) => x - y)
        lt.sort((x, y) => x - y)
        sCorrect[from] = (sCorrect[from] as number) - 1
        sCorrect[to] = (sCorrect[to] as number) + 1
        return true
      }
      for (const card of cards) {
        const mine: number[] = []
        for (const key of members.keys()) {
          const u = sUser[key] as number
          if (card.pupils.has(u) && !fixed.has(key) && (sCount[key] as number) > 0) mine.push(key)
        }
        mine.sort((a, b) => a - b)
        let fixedSum = 0
        let fixedN = 0
        for (const s of anchorSessions) {
          if (s.status === 'completed' && card.pupils.has(s.userId) && s.questionCount > 0) {
            fixedSum += s.correctCount / s.questionCount
            fixedN++
          }
        }
        const total = mine.length + fixedN
        if (mine.length === 0) {
          issues.push(`teacher card (${String(card.tenths / 10)} %): its pupils hold no session`)
          continue
        }
        const goalSum = (card.tenths / 1000) * total
        const sumNow = () =>
          mine.reduce((a, k) => a + (sCorrect[k] as number) / (sCount[k] as number), fixedSum)
        const partnersOf = (key: number, size: number, want: 'wrong' | 'right'): number[] => {
          const g = bucketOfKey.get(key)
          if (!g) return []
          const out: number[] = []
          for (const x of g.sessions) {
            const k = x.key
            const u = sUser[k] as number
            if (fixed.has(k) || c228Users.has(u) || cardUsers.has(u) || k === key) continue
            const room =
              want === 'wrong'
                ? (sCount[k] as number) - (sCorrect[k] as number)
                : (sCorrect[k] as number)
            if (room < 1) continue
            out.push(k)
          }
          return out.sort(
            (a, b) =>
              Math.abs((sCount[a] as number) - size) - Math.abs((sCount[b] as number) - size) ||
              a - b,
          )
        }
        const tol = 0.0004 * total
        const stuck = new Set<number>()
        for (let guard = 0; guard < 400; guard++) {
          const gap = sumNow() - goalSum
          if (Math.abs(gap) <= tol) break
          // The best combination of up to three single-answer moves (each 1 / size of a card session, down
          // or up) that brings the gap closest to zero.
          const moves: { k: number; down: boolean; d: number }[] = []
          for (const k of mine) {
            if (stuck.has(k)) continue
            const size = sCount[k] as number
            if ((sCorrect[k] as number) >= 1) moves.push({ k, down: true, d: -1 / size })
            if (size - (sCorrect[k] as number) >= 1) moves.push({ k, down: false, d: 1 / size })
          }
          let best: number[] = []
          let bestGap = Math.abs(gap)
          const m = moves.length
          const used = new Map<string, number>()
          const roomOf = (mv: { k: number; down: boolean }) =>
            mv.down
              ? (sCorrect[mv.k] as number)
              : (sCount[mv.k] as number) - (sCorrect[mv.k] as number)
          const tryCombo = (idx: number[], sum: number) => {
            used.clear()
            for (const i of idx) {
              const mv = moves[i] as { k: number; down: boolean }
              const key = `${String(mv.k)}${mv.down ? 'd' : 'u'}`
              used.set(key, (used.get(key) ?? 0) + 1)
              if ((used.get(key) as number) > roomOf(mv)) return
              const opp = `${String(mv.k)}${mv.down ? 'u' : 'd'}`
              if (used.has(opp)) return
            }
            const g2 = Math.abs(gap + sum)
            if (g2 < bestGap - 1e-12) {
              bestGap = g2
              best = idx.slice()
            }
          }
          for (let i = 0; i < m; i++) {
            tryCombo([i], (moves[i] as { d: number }).d)
            if (m > 300) continue
            for (let j = i; j < m; j++) {
              tryCombo([i, j], (moves[i] as { d: number }).d + (moves[j] as { d: number }).d)
              if (m > 30) continue
              for (let l = j; l < m; l++) {
                tryCombo(
                  [i, j, l],
                  (moves[i] as { d: number }).d +
                    (moves[j] as { d: number }).d +
                    (moves[l] as { d: number }).d,
                )
              }
            }
          }
          if (best.length === 0) break
          let failed = false
          for (const i of best) {
            const mv = moves[i] as { k: number; down: boolean }
            const partner = partnersOf(mv.k, sCount[mv.k] as number, mv.down ? 'wrong' : 'right')[0]
            if (partner === undefined || !(mv.down ? swap(mv.k, partner) : swap(partner, mv.k))) {
              stuck.add(mv.k)
              failed = true
              break
            }
          }
          if (failed) continue
        }
        const shown = Math.round((sumNow() / total) * 1000)
        if (shown !== card.tenths)
          issues.push(`teacher card: ${String(shown / 10)} %, not ${String(card.tenths / 10)} %`)
      }
    }

    // The swaps above move the mean of the session accuracies by a little (unequal sizes). It is
    // brought back to 79.8 %: a correct answer moves from a small session to a large one of the same
    // bucket (never a designated session or one of class 228), which lowers the mean.
    {
      let sum = anchorAcc.reduce((a, b) => a + b, 0)
      let total = anchorAcc.length
      for (const key of members.keys()) {
        sum += (sCorrect[key] as number) / (sCount[key] as number)
        total++
      }
      const goal = SESSION_MEAN_ACC_ALL / 100
      let excess = sum - goal * total
      const wrongKeys = new Set<number>()
      for (const g of all) for (const k of g.wrong) wrongKeys.add(k)
      for (let pass = 0; pass < 200 && excess > 0.5 * (1 / 20); pass++) {
        let progress = false
        for (const g of all) {
          if (g.population === 'nonP' || g.sessions.length < 2) continue
          const cand = g.sessions
            .map((x) => x.key)
            .filter(
              (k) =>
                !fixed.has(k) &&
                !c228Users.has(sUser[k] as number) &&
                !cardUsers.has(sUser[k] as number),
            )
            .sort((a, b) => (sCount[a] as number) - (sCount[b] as number) || a - b)
          let i = 0
          let j = cand.length - 1
          while (i < j && excess > 0.5 * (1 / 20)) {
            const small = cand[i] as number
            const large = cand[j] as number
            const gain = 1 / (sCount[small] as number) - 1 / (sCount[large] as number)
            if (gain <= 0) break
            const ls = members.get(small) as number[]
            const ll = members.get(large) as number[]
            const is = ls.findIndex((k) => !wrongKeys.has(k))
            const il = ll.findIndex((k) => wrongKeys.has(k))
            if (is < 0) {
              i++
              continue
            }
            if (il < 0) {
              j--
              continue
            }
            const ks = ls[is] as number
            ls[is] = ll[il] as number
            ll[il] = ks
            ls.sort((x, y) => x - y)
            ll.sort((x, y) => x - y)
            sCorrect[small] = (sCorrect[small] as number) - 1
            sCorrect[large] = (sCorrect[large] as number) + 1
            excess -= gain
            progress = true
            i++
            j--
          }
        }
        if (!progress) break
      }
    }

    // The T5 members' share: exactly T5_SESSIONS sessions with a session mean of 79.7 %.
    const memberSessions: number[] = []
    let t5Count = anchorSessions.filter((s) => s.status === 'completed' && isT5(s.userId)).length
    let t5Acc = anchorSessions
      .filter((s) => s.status === 'completed' && isT5(s.userId) && s.questionCount > 0)
      .reduce((a, s) => a + (100 * s.correctCount) / s.questionCount, 0)
    for (const g of all) {
      if (g.population === 'nonP') continue
      for (const s of g.sessions) {
        if (isT5(sUser[s.key] as number)) {
          memberSessions.push(s.key)
          t5Count++
          t5Acc += (100 * (sCorrect[s.key] as number)) / (sCount[s.key] as number)
        }
      }
    }
    const shed = t5Count - T5_SESSIONS
    const accOf = (key: number) => (100 * (sCorrect[key] as number)) / (sCount[key] as number)
    if (shed < 0) {
      issues.push(`T5 members hold ${String(t5Count)} sessions, fewer than ${String(T5_SESSIONS)}`)
    } else if (shed > 0) {
      const wantSum = (T5_MEAN_TENTHS / 10) * T5_SESSIONS
      const targetShedAcc = t5Acc - wantSum
      const receivers = (pop: number, b: number): number[] => {
        const pool = poolOf(pop)
        const eff = effective(pop)
        return pool.slice(0, eff[b] as number).filter((u) => !isT5(u))
      }
      const cache = new Map<string, number[]>()
      const recv = (pop: number, b: number) => {
        const k = `${String(pop)}:${String(b)}`
        let r = cache.get(k)
        if (!r) {
          r = receivers(pop, b)
          cache.set(k, r)
        }
        return r
      }
      const movable = memberSessions.filter((key) => {
        if (fixed.has(key) || sFresh[key] === 1) return false
        const pop = sPop[key] as number
        if (pop <= 0 || c228Users.has(sUser[key] as number) || cardUsers.has(sUser[key] as number))
          return false
        return recv(pop, sBand[key] as number).length > 0
      })
      // Tentative assignment in hash order: each session goes to the least loaded eligible receiver
      // that holds fewer than SHED_CAP_PER_RECEIVER shed sessions; a session without such a receiver
      // is not a candidate. The picked subset keeps its tentative receiver, so no cap is exceeded.
      const load = new Map<number, number>()
      const receiverOf = new Map<number, number>()
      const cands: number[] = []
      for (const key of movable.sort((x, y) => hashKey(x, 75) - hashKey(y, 75) || x - y)) {
        const r = recv(sPop[key] as number, sBand[key] as number)
        let best = -1
        for (const u of r) {
          const lu = load.get(u) ?? 0
          if (lu >= SHED_CAP_PER_RECEIVER) continue
          if (best < 0) best = u
          else {
            const lb = load.get(best) ?? 0
            if (lu < lb || (lu === lb && hashKey(key, u) < hashKey(key, best))) best = u
          }
        }
        if (best < 0) continue
        load.set(best, (load.get(best) ?? 0) + 1)
        receiverOf.set(key, best)
        cands.push(key)
      }
      if (cands.length < shed) {
        issues.push(
          `T5 members: ${String(cands.length)} sessions fit under ${String(SHED_CAP_PER_RECEIVER)} per non-member, ${String(shed)} needed`,
        )
      } else {
        for (const key of pickByMean(cands, shed, targetShedAcc, accOf)) {
          sUser[key] = receiverOf.get(key) as number
        }
      }
    }
  }

  // --- subjects, levels, modes -----------------------------------------------------------------
  const levelSubjects = subjectsByLevel()
  const levelOf = (userId: number) => pools.level.get(userId) ?? 11
  for (const g of all) {
    for (const s of g.sessions) {
      const user = sUser[s.key] as number
      generatedUsers.add(user)
      const level = levelOf(user)
      const subjects = levelSubjects.get(level) ?? []
      sLevel[s.key] = level
      sSubject[s.key] =
        s.missionId !== null
          ? 3
          : (subjects[hashKey(s.key, 46) % Math.max(1, subjects.length)] ?? 0)
      const mode: PracticeMode =
        s.missionId !== null
          ? 'mission'
          : (g.bucket.schoolId === LATIH_TUBI_TODAY_SCHOOL && g.bucket.band === 0) ||
              fixed.get(s.key)?.spm === true
            ? 'latih_tubi'
            : 'random'
      sMode[s.key] = MODE_CODES.indexOf(mode)
    }
    for (const key of g.sessionless) generatedUsers.add(aUser[key] as number)
  }

  // Class 228 is a Bahasa Inggeris class (M08 BR-M08-10 counts "in the class subject"): every session of
  // its members is in the class subject, so the class cell (1,618 sessions, 34,882 answers) reads in it.
  if (placement) {
    for (const g of all) {
      for (const s of g.sessions) {
        if (s.missionId === null && c228Users.has(sUser[s.key] as number)) {
          sSubject[s.key] = CLASS_228.subject
        }
      }
    }
  }

  enforceNotAllCorrect(plans, members, sUser, sCount, sCorrect, issues, new Set(topUsers), fixed)

  // Class 228 tests 596 questions of its subject (M08 §6.10: 381 easy / 78 medium / 137 hard).
  // Planned on the first read of a session's questions (it reads the question pool, about 300 ms), not at
  // boot; the plan only uses the finished assignment, so the lists are the same whenever it runs.
  let designedMap: Map<number, readonly number[]> | null = null
  const designedQuestions: DesignedQuestions = {
    get(key) {
      if (!placement) return undefined
      if (!designedMap) {
        const wrongAll = new Set<number>()
        for (const g of all) for (const k of g.wrong) wrongAll.add(k)
        const found: string[] = []
        const map = new Map<number, readonly number[]>()
        planClass228Questions(
          [...members.keys()].filter(
            (k) => c228Users.has(sUser[k] as number) && sSubject[k] === CLASS_228.subject,
          ),
          members,
          wrongAll,
          sLevel,
          (k) => sUser[k] as number,
          map,
          found,
        )
        if (found.length > 0) throw new Error(`M05 practice prime: ${found.join('; ')}`)
        designedMap = map
      }
      return designedMap.get(key)
    },
  }

  const sAnsStart = new Int32Array(SESSION_KEY_MAX + 2)
  for (let k = 1; k <= SESSION_KEY_MAX + 1; k++)
    sAnsStart[k] = (sAnsStart[k - 1] as number) + (csrCounts[k] as number)
  const sAnsKeys = new Int32Array(sAnsStart[SESSION_KEY_MAX + 1] as number)

  // Class 228: the time per session is 10.4 minutes (INFERRED: the seconds between two answers of
  // its sessions are scaled, the others keep 12–60 s).
  if (placement) {
    const keys228 = [...members.keys()].filter((k) => c228Users.has(sUser[k] as number))
    let anchorSeconds = 0
    for (const s of anchorSessions) {
      if (s.status === 'completed' && c228Users.has(s.userId)) anchorSeconds += s.timeSpent
    }
    const wantSeconds = CLASS_228.meanSeconds * CLASS_228.sessions - anchorSeconds
    const total = (scale: number) => {
      let secs = 0
      for (const k of keys228) {
        for (const a of members.get(k) as number[]) secs += scaledSeconds(a, scale)
      }
      return secs
    }
    if (keys228.length > 0) {
      let lo2 = 0.2
      let hi2 = 1.5
      for (let i = 0; i < 40; i++) {
        const mid = (lo2 + hi2) / 2
        if (total(mid) < wantSeconds) lo2 = mid
        else hi2 = mid
      }
      const scale = (lo2 + hi2) / 2
      for (const k of keys228) scale228.set(k, scale)
    }
  }
  for (const [key, keys] of members) {
    let p = sAnsStart[key] as number
    let secs = 0
    const scale = scale228.get(key) ?? 1
    for (const a of keys) secs += scaledSeconds(a, scale)
    sTime[key] = secs
    for (const a of keys) sAnsKeys[p++] = a
  }

  // Times per session (window of its bucket) and per answer.
  const weekRange = BAND_RANGE[1]
  const oldRange: readonly [number, number] = [
    Date.parse('2026-03-01T00:00:00+08:00'),
    Date.parse('2026-08-20T00:00:00+08:00'),
  ]
  for (const { g } of plans) {
    for (const s of g.sessions) {
      const keys = members.get(s.key) as number[]
      const dur = (sTime[s.key] as number) * 1_000
      let range: readonly [number, number] | null
      if (g.population === 'nonP') range = sMs[s.key] === -1 ? weekRange : oldRange
      else range = weekBandRange(g.bucket.week as number, g.bucket.band as Band)
      if (s.missionId !== null) {
        // The mission's date (M10 v1.7): 8 Sep for 7103, 22 Sep for 7104.
        const day = Date.parse(
          `${s.missionId === 7103 ? '2026-09-08' : '2026-09-22'}T00:00:00+08:00`,
        )
        range = [day, day + DAY_MS]
      }
      if (!range) {
        issues.push(`session g${String(s.key)}: empty time window`)
        continue
      }
      const end = placeEnd(range[0], range[1], dur, s.key, 47)
      sMs[s.key] = end
      const scale = scale228.get(s.key) ?? 1
      let t = end - dur
      keys.forEach((a, i) => {
        t += scaledSeconds(a, scale) * 1_000
        aUser[a] = sUser[s.key] as number
        aSess[a] = s.key
        aMs[a] = t
        aPos[a] = i
      })
    }
  }
  for (const g of all) {
    const range =
      g.bucket.week !== null && g.bucket.band !== null
        ? weekBandRange(g.bucket.week, g.bucket.band as Band)
        : oldRange
    for (const key of g.sessionless) {
      if (!range) continue
      aMs[key] = placeEnd(range[0], range[1], 0, key, 48)
    }
  }
  for (const id of designatedUsers) generatedUsers.add(id)
  for (const id of ANSWER_ONLY_8880) generatedUsers.add(id)
  if (placement)
    checkPlacement(
      placement,
      anchorSessions,
      members,
      sUser,
      sCount,
      sCorrect,
      sTime,
      sMs,
      sSubject,
      issues,
    )

  const out: PracticePrime = {
    aUser,
    aSess,
    aMs,
    aPos,
    sUser,
    sCount,
    sCorrect,
    sTime,
    sMs,
    sSubject,
    sLevel,
    sMode,
    sAnsStart,
    sAnsKeys,
    sessionQuestions: designedQuestions,
    generatedUsers,
    anchorUsers,
    userLevel: pools.level,
    levelSubjects,
    lambda,
    meanAccuracy: mean,
    issues,
  }
  prime = out
  return out
}
