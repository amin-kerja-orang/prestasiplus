/**
 * The named pupils of the M17 Command Center (SRS M17 §6.7 B/C/E, XR-M17-02; M05 §6.14.1): their sessions are
 * designated sessions of the prime (`buildPracticePrime`), placed inside the (school, week, band) buckets of
 * the observed M11 cells, so no school, week or window total moves.
 *
 * OBSERVED (M17 discovery S3/S6/S7): pupil 2022 (school 8080) 2,378 answers, 2,372 in 123 sessions (93.7 %),
 * 2,223 correct in all, week 21 Sep 452 · 450 · 23 sessions (the 25 Sep 09:21 session of 20 inside), week
 * 14 Sep 1,166 (month 1,618 · 98.1 %); class 370 "5 PERNIAGAAN" 30 members, 13,641 answers, 79.0 %, member totals
 * 2,378 · 2,204 · 1,836 … 20, rows 1-3 at 93.5 / 73.2 / 77.8 %, 3 "Aktif" (7 days) and 8 active in 30 days;
 * 8082 pupils 2013 (week 330 · 329 · 18 sessions, month 2,893 · 99.2 %), 2014 (234 · 145 · 11), 2015
 * (200 · 187 · 15), 2016 (4 sessions of 40, 118 correct), 2020 (month 3,637 · 92.6 %); 8106 pupils 2017 (week 99 · 80,
 * month 1,701 · 90.2 %), 2018 and 2019 (week 159 · 125, 6 sessions of the 25 Sep, 63 correct each), 2023 (month
 * 1,179 · 87.9 %). INFERRED: the split of the unobserved parts over the buckets (the weeks of the older answers, the
 * session sizes of about 20 answers, the accuracy of class 370 members rows 4-30).
 * M17 names the month top pupil of 8080 "2021"; its 1,618 · 98.1 % equal pupil 2022's own month (1,166 + 452),
 * so the figures are anchored on 2022 (reported to the M17 owner).
 */

import { hashKey } from '@/mock/dataset'

export interface PupilChunk {
  user: number
  school: number
  week: number
  band: number
  sessions: number
  answers: number
  correct: number
  /** `latih_tubi` (SPM mode) sessions: they are not in the weekly ranking (M17 §6.7 B). */
  spm?: boolean
}

/** Class 370: member totals by rank, answers (M17 §6.7 C). */
export const CLASS_370_TOTALS: readonly number[] = [
  2378, 2204, 1836, 1792, 1148, 669, 485, 452, 385, 335, 302, 210, 178, 144, 133, 132, 125, 107,
  105, 85, 71, 60, 55, 50, 45, 41, 41, 31, 22, 20,
]
export const CLASS_370 = {
  id: 370,
  school: 8080,
  /** 79.0 % of 13,641: the correct answers (10,776 = 79.00 %). */
  correct: 10_776,
  /** Row 1 (pupil 2022): 2,223 correct (93.5 %); row 2: 73.2 %; row 3: 77.8 % (observed). */
  rowCorrect: [2223, 1613, 1428] as readonly number[],
  /** Members with a session in the last 7 days / the last 30 days at the clock. */
  active7d: 3,
  active30d: 8,
  topPupil: 2022,
} as const

/** The 6 sessionless answers of pupil 2022 (week M12) hold one correct answer: the sessions read 93.7 %. */
export const SESSIONLESS_2022_CORRECT = 1
/** 2022's sessions: 2,372 answers, 2,222 correct (93.7 %); with 1 sessionless correct the pupil reads 2,223. */
export const PUPIL_2022 = { sessions: 123, answers: 2378, correct: 2223 } as const

/** 0 = derived by the prime from the average session size of the bucket (the sessions keep its size distribution). */
const sessionsFor = () => 0

/** `total` split over `weights` (largest remainder, each part ≤ its cap). */
function split(total: number, weights: readonly number[], caps?: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  const raw = weights.map((w) => (total * w) / sum)
  const out = raw.map((x, i) => Math.min(Math.floor(x), caps ? (caps[i] as number) : Infinity))
  let rest = total - out.reduce((a, b) => a + b, 0)
  const order = raw
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r || a.i - b.i)
  for (let guard = 0; rest > 0 && guard < 10_000; guard++) {
    const i = (order[guard % order.length] as { i: number }).i
    if (out[i]! < (caps ? (caps[i] as number) : Infinity)) {
      out[i] = (out[i] as number) + 1
      rest--
    }
  }
  return out
}

/** Chunk list of a pupil: `[week, band, answers, sessions?]` parts with `correct` shared over them. */
function chunks(
  user: number,
  school: number,
  parts: readonly (readonly [number, number, number, number?])[],
  correct: number,
  spm?: (week: number, band: number) => boolean,
): PupilChunk[] {
  const caps = parts.map((p) => p[2])
  const cs = split(
    correct,
    parts.map((p) => p[2]),
    caps,
  )
  return parts.map((p, i) => ({
    user,
    school,
    week: p[0],
    band: p[1],
    answers: p[2],
    sessions: p[3] ?? sessionsFor(),
    correct: cs[i] as number,
    ...(spm?.(p[0], p[1]) ? { spm: true } : {}),
  }))
}

/**
 * The chunks of the named pupils. `class370` = the members of class 370 (M10), `rowsOf` is ignored for
 * pupils that are not members.
 */
export function pupilChunks(class370: readonly number[]): PupilChunk[] {
  const out: PupilChunk[] = []

  // --- 8080: pupil 2022 -----------------------------------------------------------------------
  // 25 Sep (week 32, band 0): the 09:21 session of 20, all correct; week 32 rest: 22 sessions, 432 · 430;
  // week 31 (14 Sep): 1,166 · 1,137; older: 40 sessions, 754 · 635 (first session 4 May, M12).
  out.push(
    { user: 2022, school: 8080, week: 32, band: 0, sessions: 1, answers: 20, correct: 20 },
    { user: 2022, school: 8080, week: 32, band: 1, sessions: 22, answers: 432, correct: 430 },
    { user: 2022, school: 8080, week: 31, band: 2, sessions: 26, answers: 500, correct: 489 },
    { user: 2022, school: 8080, week: 31, band: 3, sessions: 34, answers: 666, correct: 648 },
    { user: 2022, school: 8080, week: 12, band: 6, sessions: 14, answers: 270, correct: 226 },
    { user: 2022, school: 8080, week: 13, band: 6, sessions: 5, answers: 96, correct: 81 },
    { user: 2022, school: 8080, week: 14, band: 6, sessions: 8, answers: 152, correct: 128 },
    { user: 2022, school: 8080, week: 18, band: 6, sessions: 13, answers: 236, correct: 200 },
  )

  // --- 8082 -----------------------------------------------------------------------------------
  out.push(
    ...chunks(
      2013,
      8082,
      [
        [32, 1, 330, 18],
        [30, 3, 1700],
        [31, 2, 300],
        [29, 3, 363],
        [31, 3, 200],
      ],
      2870,
    ),
    { user: 2014, school: 8082, week: 32, band: 1, sessions: 11, answers: 234, correct: 145 },
    { user: 2015, school: 8082, week: 32, band: 1, sessions: 15, answers: 200, correct: 187 },
    { user: 2016, school: 8082, week: 32, band: 0, sessions: 4, answers: 160, correct: 118 },
    ...chunks(
      2020,
      8082,
      [
        [30, 3, 1900],
        [31, 2, 1000],
        [29, 3, 400],
        [31, 3, 337],
      ],
      3368,
    ),
  )
  // 2013's week chunk must carry its observed 329 correct (the month rest takes the other 2,541).
  const w2013 = out.find((c) => c.user === 2013 && c.week === 32) as PupilChunk
  const rest2013 = out.filter((c) => c.user === 2013 && c.week !== 32)
  const cs2013 = split(
    2870 - 329,
    rest2013.map((c) => c.answers),
    rest2013.map((c) => c.answers),
  )
  w2013.correct = 329
  rest2013.forEach((c, i) => (c.correct = cs2013[i] as number))

  // --- 8106 -----------------------------------------------------------------------------------
  const chunks2017 = chunks(
    2017,
    8106,
    [
      [29, 3, 800],
      [30, 3, 802],
    ],
    1534 - 80,
  )
  out.push(
    {
      user: 2017,
      school: 8106,
      week: 32,
      band: 1,
      sessions: 5,
      answers: 99,
      correct: 80,
      spm: true,
    },
    ...chunks2017,
    ...chunks(
      2023,
      8106,
      [
        [31, 2, 600],
        [31, 3, 300],
        [29, 3, 279],
      ],
      1036,
    ),
  )
  for (const user of [2018, 2019]) {
    out.push(
      { user, school: 8106, week: 32, band: 0, sessions: 6, answers: 80, correct: 63, spm: true },
      { user, school: 8106, week: 32, band: 1, sessions: 4, answers: 79, correct: 62, spm: true },
    )
  }

  // --- 8080: class 370 (the members other than 2022) --------------------------------------------
  const members = class370.filter((id) => id !== CLASS_370.topPupil).sort((a, b) => a - b)
  const totals = CLASS_370_TOTALS.slice(1)
  const correctOf: number[] = []
  const free: number[] = []
  const known = [CLASS_370.rowCorrect[1] as number, CLASS_370.rowCorrect[2] as number]
  const freeTarget = CLASS_370.correct - (CLASS_370.rowCorrect[0] as number) - known[0]! - known[1]!
  const freeTotals: number[] = []
  members.forEach((_u, i) => {
    if (i < 2) {
      correctOf[i] = known[i] as number
    } else {
      free.push(i)
      freeTotals.push(totals[i] as number)
    }
  })
  // Accuracy of rows 4-30: about 76 % with a spread of ± 8 points; the sum is exact.
  const weights = free.map((i) => {
    const u = members[i] as number
    return (totals[i] as number) * (0.7 + 0.12 * (hashKey(u, 370) / 4_294_967_296))
  })
  const parts = split(
    freeTarget,
    weights,
    free.map((i) => totals[i] as number),
  )
  free.forEach((i, k) => (correctOf[i] = parts[k] as number))

  // Recent activity at the clock: rows 2-3 and one more in the last 7 days; four more within 30 days (8 with 2022).
  const recent: [number, number, number][] = []
  const placeRecent = (i: number, week: number, band: number, size: number) =>
    recent.push([i, week * 10 + band, size])
  placeRecent(0, 31, 2, 20)
  placeRecent(1, 30, 3, 20)
  placeRecent(2, 31, 2, 20)
  for (let i = 3; i < 7; i++) placeRecent(i, 29, 3, 10)

  members.forEach((u, i) => {
    const total = totals[i] as number
    const correct = correctOf[i] as number
    const r = recent.find((x) => x[0] === i)
    let olderAnswers = total
    let olderCorrect = correct
    if (r) {
      const size = Math.min(r[2], total)
      const c = Math.min(size, Math.round((size * correct) / total))
      out.push({
        user: u,
        school: 8080,
        week: Math.floor(r[1] / 10),
        band: r[1] % 10,
        sessions: 1,
        answers: size,
        correct: c,
      })
      olderAnswers -= size
      olderCorrect -= c
    }
    if (olderAnswers > 0) {
      out.push({
        user: u,
        school: 8080,
        week: 18,
        band: 6,
        sessions: 0,
        answers: olderAnswers,
        correct: olderCorrect,
      })
    }
  })
  return out
}

/** A chunk's sessions: sizes spread over the answers, the wrong answers over the sessions (larger ones first). */
export function chunkSessions(c: PupilChunk): { size: number; correct: number }[] {
  const s = c.sessions
  const base = Math.floor(c.answers / s)
  const extra = c.answers - base * s
  const sizes = Array.from({ length: s }, (_, i) => base + (i < extra ? 1 : 0))
  const wrong = c.answers - c.correct
  const wb = Math.floor(wrong / s)
  let wr = wrong - wb * s
  return sizes.map((size) => {
    const w = wb + (wr > 0 ? 1 : 0)
    if (wr > 0) wr--
    return { size, correct: Math.max(0, size - w) }
  })
}
