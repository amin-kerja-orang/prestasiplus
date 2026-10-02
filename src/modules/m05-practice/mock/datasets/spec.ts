/**
 * Distribution specs of the M05 answer log (478,499) and practice sessions (32,122) — SRS M05 v1.16
 * §6.14.1 — built from the observed cells and pins of `./pins.ts` and `./m11-cells.ts`. Pure and
 * deterministic (the dataset calls the thunks for `specHash`, the feasibility check and compile).
 *
 * **Answers** (facets `seg`, `schoolId`, `week`, `band`, `inP`, `isCorrect`, `hasSession`):
 * 1. `mon` — every observed school × week cell of M11 §6.7 (+ 8765's 12 before M1). Weeks that
 *    straddle a window boundary are split so the window totals hold at the clock: today 340 (the
 *    M17 25 Sep sessions, per school), the calendar week = M32, M11 7d 7,651, the calendar month
 *    (M17 20,206 − the other-P September answers), M11 30d 22,207, M11 3m 86,697. A school's part
 *    goes only into windows where its M11 "Aktif" count is > 0; the rest of each split is in
 *    proportion to the school's weekly count (largest remainder). **INFERRED** per-school splits
 *    (`observed:false` in M11).
 * 2. `oth`, P — the 5,372 generated answers of P outside the segment, by month (M17 C-11): May in
 *    M12–M15, July in M21–M23, August in M25–M28, September in M30–M32 with the calendar week = 60
 *    (M17 week − M32) and nothing today (M17 today = the segment's 340). Weeks inside a month are
 *    weighted by their hours in it. **INFERRED** week placement.
 * 3. `oth`, not P — 756 rows without time facets (the anchors of accounts 1, 2, 4 and M08's
 *    3001–3008 fit whatever their dates).
 * 4. `isCorrect`: P = 395,873 split so the M17 pins hold (today 264, week 2,122, month 17,667);
 *    other P rows at the P rate (82.863 %); non-P 518 (anchors 180 + 338 free).
 * 5. `hasSession = false`: 3201–3215's 6,563 answers inside 8880's weeks (in proportion), pupil
 *    2022's 6 on 2026-05-04 (8080, M12), the admin's 35 (non-P).
 *
 * **Sessions** (facets as the answers minus `isCorrect` / `hasSession`, plus `missionId`, `status`):
 * the same buckets, with counts in proportion to each bucket's answers in sessions (≥ 1 per non-empty
 * bucket) so that the M17 window pins hold (today 17 per school as §6.7 B, week 152, month 1,250),
 * the 8 mission sessions sit in 8082 (7103 × 5 on 8 Sep, 7104 × 3 on 22 Sep), 54 non-P sessions and
 * 358 other-P sessions (**INFERRED**), total 32,122.
 */

import { split, type CellSpec } from '@/mock/dataset'

import { BANDS, LAST_WEEK, bandsOfWeek, weekBandRange, type Band } from './calendar'
import { BEFORE_M1, M11_AKTIF, M11_WEEKLY, SEGMENT_SCHOOLS } from './m11-cells'
import {
  ANSWERS_TOTAL,
  M17_PINS,
  MISSION_SCHOOL,
  MISSION_SESSIONS,
  NON_P_CORRECT,
  NON_P_SESSIONS,
  NON_P_TOTAL,
  OTHER_P_BY_MONTH,
  OTHER_P_MONTH_SESSIONS,
  OTHER_P_SESSIONS,
  OTHER_P_TOTAL,
  OTHER_P_WEEK_SESSIONS,
  P_ANSWERS,
  P_CORRECT,
  SEGMENT_PERIODS,
  SEGMENT_TOTAL,
  SESSIONLESS_2022,
  SCHOOL_8880_CORRECT,
  SESSIONLESS_8880,
  SESSIONLESS_8880_CORRECT,
  SESSIONLESS_ADMIN,
  SESSIONS_TOTAL,
  TODAY_BY_SCHOOL,
  MONTH_REST_CORRECT_8082,
  SCHOOL_CORRECT,
  SESSIONLESS_2022_CORRECT,
  WEEK_REST_CORRECT,
} from './pins'
import type { AnswerFacetKey, AnswerRow, SessionFacetKey, SessionRow, SpecFacets } from './types'

export type AnswerFacets = Pick<AnswerRow, AnswerFacetKey>
export type SessionFacets = Pick<SessionRow, SessionFacetKey>

// ---------------------------------------------------------------------------------------------
// Buckets: one per (seg, schoolId, week, band, inP) — the unit both datasets share
// ---------------------------------------------------------------------------------------------

export interface Bucket extends SpecFacets {
  /** Answers of the bucket (all). */
  answers: number
  correct: number
  /** Answers without a session. */
  sessionless: number
  sessionlessCorrect: number
  /** Sessions of the bucket (all `completed`), by mission id (`null` = no mission). */
  sessions: Map<number | null, number>
}

export function bucketKey(f: SpecFacets): string {
  return `${f.seg}|${String(f.schoolId)}|${String(f.week)}|${String(f.band)}|${String(f.inP)}`
}

function fail(message: string): never {
  throw new Error(`M05 practice spec: ${message}`)
}

const sumOf = (values: Iterable<number>) => {
  let s = 0
  for (const v of values) s += v
  return s
}

/** Largest remainder of `total` over `weights` (keyed), zero weights get 0. */
function apportion<K>(total: number, weights: readonly (readonly [K, number])[]): Map<K, number> {
  if (total === 0) return new Map(weights.map(([k]) => [k, 0]))
  if (sumOf(weights.map(([, w]) => w)) <= 0) fail(`cannot place ${String(total)} on zero weights`)
  return new Map(split(total, weights))
}

/** M11 window index of a band for the "Aktif > 0" rule: 7d / 30d / 3m / all. */
function aktifOk(schoolId: number, band: Band): boolean {
  const a = M11_AKTIF[schoolId] ?? [0, 0, 0, 0, 0]
  if (band <= 2) return a[1] > 0
  if (band <= 4) return a[2] > 0
  if (band === 5) return a[3] > 0
  return a[0] > 0
}

// ---------------------------------------------------------------------------------------------
// 1. Segment answers per (school, week, band)
// ---------------------------------------------------------------------------------------------

/** September answers of P outside the segment (all inside the calendar month). */
const OTHER_P_MONTH = OTHER_P_BY_MONTH.sep
/** Calendar-week answers of P outside the segment (M17 week − M32). */
function otherPWeek(): number {
  return M17_PINS.answers.week - weekColumn(LAST_WEEK)
}

function weekColumn(k: number): number {
  return sumOf(SEGMENT_SCHOOLS.map((s) => (M11_WEEKLY[s] as readonly number[])[k - 1] ?? 0))
}

/** Window totals W_b of the segment (answers in bands 0…b) at the clock. */
function segmentWindows(): number[] {
  const today = sumOf(Object.values(TODAY_BY_SCHOOL).map(([, a]) => a))
  return [
    today,
    weekColumn(LAST_WEEK),
    SEGMENT_PERIODS.d7,
    M17_PINS.answers.month - OTHER_P_MONTH,
    SEGMENT_PERIODS.d30,
    SEGMENT_PERIODS.m3,
    SEGMENT_TOTAL,
  ]
}

/** `[schoolId, week, band, answers]` of every non-empty segment cell. */
export function segmentCells(): [number, number, Band, number][] {
  const windows = segmentWindows()
  const bandTotal = BANDS.map(
    (b) => (windows[b] as number) - (b > 0 ? (windows[b - 1] as number) : 0),
  )
  // Per (school, week) the answers still to place; bands newest first.
  const rest = new Map<string, number>()
  const key = (s: number, k: number) => `${String(s)}:${String(k)}`
  for (const s of SEGMENT_SCHOOLS) {
    const row = M11_WEEKLY[s] as readonly number[]
    row.forEach((n, i) => {
      if (n > 0) rest.set(key(s, i + 1), n)
    })
    const before = BEFORE_M1[s] ?? 0
    if (before > 0) rest.set(key(s, 0), before)
  }
  const out: [number, number, Band, number][] = []
  const place = (s: number, k: number, b: Band, n: number) => {
    if (n <= 0) return
    const left = rest.get(key(s, k)) ?? 0
    if (n > left) fail(`school ${String(s)} week ${String(k)}: ${String(n)} > ${String(left)}`)
    rest.set(key(s, k), left - n)
    out.push([s, k, b, n])
  }
  for (const b of BANDS) {
    // Weeks meeting band b: those whose newest band is b take everything left; a week that also
    // reaches a newer band was already partly placed there.
    const weeks: number[] = []
    for (let k = 0; k <= LAST_WEEK; k++) if (bandsOfWeek(k).includes(b)) weeks.push(k)
    // Full placement for weeks entirely inside band b or whose remaining part is only band b
    // (their older bands do not exist).
    const finishing = weeks.filter((k) => {
      const bands = bandsOfWeek(k)
      return bands[bands.length - 1] === b
    })
    const splitting = weeks.filter((k) => !finishing.includes(k))
    let placed = 0
    for (const k of finishing) {
      for (const s of SEGMENT_SCHOOLS) {
        const n = rest.get(key(s, k)) ?? 0
        if (b === 0 && k === LAST_WEEK) continue // today is set per school below
        if (n > 0) {
          if (!aktifOk(s, b))
            fail(`school ${String(s)} has answers in band ${String(b)} but no Aktif`)
          place(s, k, b, n)
          placed += n
        }
      }
    }
    const need = (bandTotal[b] as number) - placed
    if (splitting.length > 1) fail(`band ${String(b)} splits more than one week`)
    const k = splitting[0]
    if (k === undefined) {
      if (need !== 0) fail(`band ${String(b)} misses ${String(need)} answers`)
      continue
    }
    if (b === 0) {
      for (const [s, [, answers]] of Object.entries(TODAY_BY_SCHOOL))
        place(Number(s), k, 0, answers)
      if (need !== sumOf(Object.values(TODAY_BY_SCHOOL).map(([, a]) => a)))
        fail('today pins do not match the segment today window')
      continue
    }
    if (need < 0) fail(`band ${String(b)} over-full by ${String(-need)}`)
    const weights = SEGMENT_SCHOOLS.map(
      (s) => [s, aktifOk(s, b) ? (rest.get(key(s, k)) ?? 0) : 0] as const,
    )
    for (const [s, n] of apportion(need, weights)) place(s, k, b, n)
  }
  for (const [k, n] of rest) if (n !== 0) fail(`cell ${k} keeps ${String(n)} unplaced answers`)
  return out
}

// ---------------------------------------------------------------------------------------------
// 2. Other-P answers per (week, band)
// ---------------------------------------------------------------------------------------------

/** `[week, band, answers]` of the generated answers of P outside the segment. */
export function otherPCells(): [number, Band, number][] {
  const hours = (k: number, b: Band) => {
    const r = weekBandRange(k, b)
    return r ? (r[1] - r[0]) / 3_600_000 : 0
  }
  const parts = (weeks: readonly number[], bands: readonly Band[]) =>
    weeks.flatMap((k) => bands.filter((b) => hours(k, b) > 0).map((b) => [k, b] as const))
  const out: [number, Band, number][] = []
  const spread = (total: number, slots: readonly (readonly [number, Band])[]) => {
    const alloc = apportion(
      total,
      slots.map((s, i) => [i, hours(s[0], s[1])] as const),
    )
    slots.forEach(([k, b], i) => {
      const n = alloc.get(i) ?? 0
      if (n > 0) out.push([k, b, n])
    })
  }
  spread(OTHER_P_BY_MONTH.may, parts([12, 13, 14, 15], [6]))
  spread(OTHER_P_BY_MONTH.jul, parts([21, 22, 23], [5]))
  spread(OTHER_P_BY_MONTH.aug, parts([25, 26, 27, 28], [5, 4]))
  const week = otherPWeek()
  out.push([LAST_WEEK, 1, week])
  spread(OTHER_P_BY_MONTH.sep - week, parts([30, 31], [3, 2]))
  if (sumOf(out.map(([, , n]) => n)) !== OTHER_P_TOTAL) fail('other-P months do not add up')
  return out
}

// ---------------------------------------------------------------------------------------------
// 3. Correct answers
// ---------------------------------------------------------------------------------------------

const P_RATE = P_CORRECT / P_ANSWERS

/** Window group of a band for the correct pins: today / rest of week / rest of month / older. */
function correctGroup(band: number): 0 | 1 | 2 | 3 {
  if (band === 0) return 0
  if (band === 1) return 1
  if (band <= 3) return 2
  return 3
}

/** Correct answers per cell (index-aligned with `cells`), honouring group totals. */
function correctSplit(
  cells: readonly { band: number; answers: number; fixed?: number }[],
  groupTotals: readonly number[],
): number[] {
  const out = cells.map((c) => c.fixed ?? -1)
  for (let g = 0; g < 4; g++) {
    const idx = cells.map((c, i) => [c, i] as const).filter(([c]) => correctGroup(c.band) === g)
    const fixed = sumOf(idx.filter(([c]) => c.fixed !== undefined).map(([c]) => c.fixed as number))
    const free = idx.filter(([c]) => c.fixed === undefined)
    const need = (groupTotals[g] as number) - fixed
    const alloc = apportion(
      need,
      free.map(([c, i]) => [i, c.answers] as const),
    )
    for (const [, i] of free) {
      const n = alloc.get(i) ?? 0
      const cell = cells[i] as { answers: number }
      if (n > cell.answers) fail(`correct ${String(n)} > answers ${String(cell.answers)}`)
      out[i] = n
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Buckets
// ---------------------------------------------------------------------------------------------

let cachedBuckets: Bucket[] | null = null

/** Every bucket with its answers, correct answers, sessionless answers and sessions. */
export function buckets(): readonly Bucket[] {
  if (cachedBuckets) return cachedBuckets
  const seg = segmentCells()
  const oth = otherPCells()

  // Correct: other P first (at the P rate, with the week / month parts rounded the same way).
  const othTotalCorrect = Math.round(OTHER_P_TOTAL * P_RATE)
  const othWeek = otherPWeek()
  const othWeekCorrect = Math.round(othWeek * P_RATE)
  const othMonthCorrect = Math.round(OTHER_P_BY_MONTH.sep * P_RATE)
  const othCorrect = correctSplit(
    oth.map(([, b, n]) => ({ band: b, answers: n })),
    [0, othWeekCorrect, othMonthCorrect - othWeekCorrect, othTotalCorrect - othMonthCorrect],
  )
  // Segment: the rest of P, with the M17 pins over P.
  const todayCorrect = M17_PINS.correct.today
  const segWeekCorrect = M17_PINS.correct.week - othWeekCorrect
  const segMonthCorrect = M17_PINS.correct.month - othMonthCorrect
  const segTotalCorrect = P_CORRECT - othTotalCorrect
  // 8880 reads 7,307 correct (M18 XR-M18-05); the other schools of the old group take the rest.
  // NOTE: this moves 1,126 correct answers out of 8880's old cells into the others, which raises the
  // old-band accuracy of 8082 and 8080 by about 0.24 points, further from the M17 §6.7 per-school pins
  // (82.3 % / 81.7 %). Those pins were already unmet (AUD-04); M17-T1 must resolve AUD-04.
  const correct8880 = apportion(
    SCHOOL_8880_CORRECT,
    seg.map((c, i) => [i, c[0] === 8880 ? c[3] : 0] as const),
  )
  // M17 §6.7: the rest of the week of 8080 and 8106, and the month part of 8082, hold the correct answers the
  // named pupils need (SCHOOL_CORRECT / WEEK_REST_CORRECT / MONTH_REST_CORRECT_8082).
  const month8082 = apportion(
    MONTH_REST_CORRECT_8082,
    seg.map((c, i) => [i, c[0] === 8082 && (c[2] === 2 || c[2] === 3) ? c[3] : 0] as const),
  )
  const groupTotals = [
    todayCorrect,
    segWeekCorrect - todayCorrect,
    segMonthCorrect - segWeekCorrect,
    segTotalCorrect - segMonthCorrect,
  ]
  const cellInput = (fixedOld?: ReadonlyMap<number, number>) =>
    seg.map(([s, k, b, n], i) => ({
      band: b,
      answers: n,
      ...(b === 0 ? { fixed: (TODAY_BY_SCHOOL[s] as readonly number[])[2] } : {}),
      ...(b === 1 && k === LAST_WEEK && WEEK_REST_CORRECT[s] !== undefined
        ? { fixed: WEEK_REST_CORRECT[s] }
        : {}),
      ...(s === 8082 && (b === 2 || b === 3) ? { fixed: month8082.get(i) } : {}),
      ...(s === 8880 ? { fixed: correct8880.get(i) } : {}),
      ...(fixedOld?.has(i) ? { fixed: fixedOld.get(i) } : {}),
    }))
  // First pass: the corrects of today / week / month; then 8082 and 8080 read their school total in the old
  // cells (bands 4-6), spread by answers, and the other schools take the difference (second pass).
  const first = correctSplit(cellInput(), groupTotals)
  const fixedOld = new Map<number, number>()
  for (const [school, total] of Object.entries(SCHOOL_CORRECT)) {
    const sid = Number(school)
    const recent = seg.reduce(
      (a, c, i) => a + (c[0] === sid && c[2] <= 3 ? (first[i] as number) : 0),
      0,
    )
    const alloc = apportion(
      total - recent,
      seg.map((c, i) => [i, c[0] === sid && c[2] >= 4 ? c[3] : 0] as const),
    )
    for (const [i, n] of alloc) {
      const c = seg[i] as [number, number, Band, number]
      if (c[0] === sid && c[2] >= 4) fixedOld.set(i, n)
    }
  }
  const segCorrect = correctSplit(cellInput(fixedOld), groupTotals)

  // Sessionless answers of the segment: 8880 in proportion to its cells; 2022 in 8080 M12.
  const cells880 = seg.map((c, i) => [c, i] as const).filter(([[s]]) => s === 8880)
  const sessionless = new Map<number, number>(
    [
      ...apportion(
        SESSIONLESS_8880,
        cells880.map(([[, , , n], i]) => [i, n] as const),
      ),
    ].filter(([, n]) => n > 0),
  )
  const i2022 = seg.findIndex(
    ([s, k, b]) => s === SESSIONLESS_2022.schoolId && k === SESSIONLESS_2022.week && b === 6,
  )
  if (i2022 < 0) fail('no 8080 M12 cell for pupil 2022')
  sessionless.set(i2022, (sessionless.get(i2022) ?? 0) + SESSIONLESS_2022.count)

  // 8880's sessionless answers read 76.3 % (5,008 correct), the rest of each cell is in sessions.
  const slc8880 = apportion(
    SESSIONLESS_8880_CORRECT,
    [...sessionless.entries()]
      .filter(([i]) => (seg[i] as [number, number, Band, number])[0] === 8880)
      .map(([i, nl]) => [i, nl] as const),
  )
  const out: Bucket[] = []
  seg.forEach(([s, k, b, n], i) => {
    const correct = segCorrect[i] as number
    const nl = sessionless.get(i) ?? 0
    out.push({
      seg: 'mon',
      schoolId: s,
      week: k,
      band: b,
      inP: true,
      answers: n,
      correct,
      sessionless: nl,
      sessionlessCorrect:
        s === 8880 && nl > 0
          ? (slc8880.get(i) ?? 0)
          : s === SESSIONLESS_2022.schoolId && k === SESSIONLESS_2022.week && b === 6
            ? SESSIONLESS_2022_CORRECT
            : n === 0
              ? 0
              : Math.round((correct * nl) / n),
      sessions: new Map(),
    })
  })
  oth.forEach(([k, b, n], i) => {
    out.push({
      seg: 'oth',
      schoolId: null,
      week: k,
      band: b,
      inP: true,
      answers: n,
      correct: othCorrect[i] as number,
      sessionless: 0,
      sessionlessCorrect: 0,
      sessions: new Map(),
    })
  })
  // Non-P: the admin's 35 sessionless answers (20 correct, live) are anchors of this module.
  out.push({
    seg: 'oth',
    schoolId: null,
    week: null,
    band: null,
    inP: false,
    answers: NON_P_TOTAL,
    correct: NON_P_CORRECT,
    sessionless: SESSIONLESS_ADMIN,
    sessionlessCorrect: 20,
    sessions: new Map([[null, NON_P_SESSIONS]]),
  })

  assignSessions(out)
  cachedBuckets = out
  return out
}

/** Answers of a bucket that sit in sessions. */
export const sessionAnswers = (b: Bucket) => b.answers - b.sessionless

/** Session counts per bucket (see the file header). */
function assignSessions(all: Bucket[]): void {
  const today = sumOf(Object.values(TODAY_BY_SCHOOL).map(([n]) => n))
  const segWeek = M17_PINS.sessions.week - today - OTHER_P_WEEK_SESSIONS
  const segMonth =
    M17_PINS.sessions.month -
    M17_PINS.sessions.week -
    (OTHER_P_MONTH_SESSIONS - OTHER_P_WEEK_SESSIONS)
  const seg = all.filter((b) => b.seg === 'mon')
  const oth = all.filter((b) => b.seg === 'oth' && b.inP)
  const segRest = SESSIONS_TOTAL - NON_P_SESSIONS - OTHER_P_SESSIONS - today - segWeek - segMonth
  const othRest = OTHER_P_SESSIONS - OTHER_P_MONTH_SESSIONS

  const allocate = (list: readonly Bucket[], total: number) => {
    const live = list.filter((b) => sessionAnswers(b) > 0)
    if (total < live.length) fail(`${String(total)} sessions for ${String(live.length)} buckets`)
    const extra = apportion(
      total - live.length,
      live.map((b, i) => [i, sessionAnswers(b) - 1] as const),
    )
    live.forEach((b, i) => {
      const n = 1 + (extra.get(i) ?? 0)
      if (n > sessionAnswers(b)) fail(`bucket ${bucketKey(b)}: ${String(n)} sessions > answers`)
      b.sessions.set(null, n)
    })
  }
  // Today: the M17 §6.7 B sessions per school.
  for (const b of seg.filter((x) => x.band === 0)) {
    const pin = TODAY_BY_SCHOOL[b.schoolId as number]
    if (!pin) fail(`no today pin for ${String(b.schoolId)}`)
    b.sessions.set(null, pin[0])
  }
  allocate(
    seg.filter((b) => b.band === 1),
    segWeek,
  )
  allocate(
    seg.filter((b) => b.band === 2 || b.band === 3),
    segMonth,
  )
  allocate(
    seg.filter((b) => (b.band as number) >= 4),
    segRest,
  )
  allocate(
    oth.filter((b) => b.band === 1),
    OTHER_P_WEEK_SESSIONS,
  )
  allocate(
    oth.filter((b) => b.band === 2 || b.band === 3),
    OTHER_P_MONTH_SESSIONS - OTHER_P_WEEK_SESSIONS,
  )
  allocate(
    oth.filter((b) => (b.band as number) >= 4),
    othRest,
  )
  // Mission sessions: carved out of their 8082 bucket's sessions (M10 v1.7).
  for (const [missionId, count, date] of MISSION_SESSIONS) {
    const ms = Date.parse(`${date}T12:00:00+08:00`)
    const b = seg.find((x) => {
      if (x.schoolId !== MISSION_SCHOOL || x.week === null || x.band === null) return false
      const r = weekBandRange(x.week, x.band as Band)
      return r !== null && ms >= r[0] && ms < r[1]
    })
    if (!b) fail(`no 8082 bucket for mission ${String(missionId)} on ${date}`)
    const plain = b.sessions.get(null) ?? 0
    if (plain < count) fail(`mission ${String(missionId)}: bucket has ${String(plain)} sessions`)
    b.sessions.set(null, plain - count)
    b.sessions.set(missionId, count)
  }
}

// ---------------------------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------------------------

const specOf = (b: Bucket): SpecFacets => ({
  seg: b.seg,
  schoolId: b.schoolId,
  week: b.week,
  band: b.band,
  inP: b.inP,
})

/** Answer cells (Σ 478,499). */
export function answerDistribution(): CellSpec<AnswerFacets>[] {
  const cells: CellSpec<AnswerFacets>[] = []
  for (const b of buckets()) {
    const f = specOf(b)
    const inSession = sessionAnswers(b)
    const correctIn = b.correct - b.sessionlessCorrect
    const push = (hasSession: boolean, isCorrect: boolean, count: number) => {
      if (count < 0) fail(`negative cell in ${bucketKey(b)}`)
      if (count > 0) cells.push({ facets: { ...f, hasSession, isCorrect }, count })
    }
    push(true, true, correctIn)
    push(true, false, inSession - correctIn)
    push(false, true, b.sessionlessCorrect)
    push(false, false, b.sessionless - b.sessionlessCorrect)
  }
  const total = sumOf(cells.map((c) => c.count))
  if (total !== ANSWERS_TOTAL) fail(`answers total ${String(total)} ≠ ${String(ANSWERS_TOTAL)}`)
  return cells
}

/** Session cells (Σ 32,122, all `completed`). */
export function sessionDistribution(): CellSpec<SessionFacets>[] {
  const cells: CellSpec<SessionFacets>[] = []
  for (const b of buckets()) {
    for (const [missionId, count] of b.sessions) {
      if (count > 0) {
        cells.push({ facets: { ...specOf(b), missionId, status: 'completed' }, count })
      }
    }
  }
  const total = sumOf(cells.map((c) => c.count))
  if (total !== SESSIONS_TOTAL) fail(`sessions total ${String(total)} ≠ ${String(SESSIONS_TOTAL)}`)
  return cells
}
