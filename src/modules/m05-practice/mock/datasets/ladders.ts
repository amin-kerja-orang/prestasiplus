/**
 * Distinct-user "ladders" of the generated practice (SRS M05 v1.16 §6.14.1; M11 §6.7 "Aktif";
 * M17 engaged / sessions pins; M08 S20 week participants). A ladder lists, per window of
 * `./calendar.ts` (today ⊂ week ⊂ 7d ⊂ month ⊂ 30d ⊂ 3m ⊂ all), how many distinct users of a
 * population answer in that window. The generator gives the users of each population a fixed order
 * and lets window b use only its first N_b users, placing each newly admitted user's first session in
 * the band that admits it, so "distinct users in window b" is exactly N_b.
 *
 * - Monitoring school s: [today, week, M11 7d, month, M11 30d, M11 3m, M11 all]. today = the M17
 *   25 Sep pupils; week (Σ 30) and month (Σ 81) are **INFERRED** splits that keep M17 engaged
 *   32 / 86 with the other-P ladder.
 * - Other P: `OTHER_P_USERS`. Non-P (teachers, by sessions): week 14 (M08 46 − M17 32), all 22.
 *
 * Anchor users (records other modules contribute) count towards the ladder; the generated users
 * fill only the rest (`../datasets/prime.ts`).
 */

import { split } from '@/mock/dataset'

import { M11_AKTIF } from './m11-cells'
import {
  M17_PINS,
  OTHER_P_USERS,
  SEGMENT_MONTH_USERS,
  SEGMENT_WEEK_USERS,
  TODAY_USERS,
  WEEK_PARTICIPANTS,
} from './pins'
import { buckets } from './spec'

export type Ladder = readonly [number, number, number, number, number, number, number]

/** Non-P ladder (by completed sessions): week 14, all 22 (INFERRED: 8 more than the week). */
export const NON_P_LADDER: Ladder = (() => {
  const week = WEEK_PARTICIPANTS - M17_PINS.engaged.week
  return [0, week, week, week, week, week, week + 8]
})()

export const OTHER_P_LADDER: Ladder = [
  OTHER_P_USERS.today,
  OTHER_P_USERS.week,
  OTHER_P_USERS.d7,
  OTHER_P_USERS.month,
  OTHER_P_USERS.d30,
  OTHER_P_USERS.m3,
  OTHER_P_USERS.all,
]

function fail(message: string): never {
  throw new Error(`M05 practice ladders: ${message}`)
}

/** Bands with answers per school (from the spec). */
function bandsWithAnswers(): Map<number, Set<number>> {
  const out = new Map<number, Set<number>>()
  for (const b of buckets()) {
    if (b.seg !== 'mon' || b.band === null) continue
    const s = b.schoolId as number
    const set = out.get(s) ?? new Set<number>()
    set.add(b.band)
    out.set(s, set)
  }
  return out
}

/** Distributes `total` over `[key, lo, hi]` bounds in proportion to the room (hi − lo). */
function bounded(total: number, rows: readonly (readonly [number, number, number])[]) {
  const lo = rows.reduce((a, [, l]) => a + l, 0)
  const hi = rows.reduce((a, [, , h]) => a + h, 0)
  if (total < lo || total > hi)
    fail(`${String(total)} users outside [${String(lo)}, ${String(hi)}]`)
  const out = new Map(rows.map(([k, l]) => [k, l]))
  let rest = total - lo
  while (rest > 0) {
    const open = rows.filter(([k, , h]) => (out.get(k) as number) < h)
    const extra = split(
      rest,
      open.map(([k, , h]) => [k, h - (out.get(k) as number)] as const),
    )
    let moved = 0
    for (const [k, n] of extra) {
      const room =
        (rows.find(([x]) => x === k) as readonly [number, number, number])[2] -
        (out.get(k) as number)
      const add = Math.min(n, room)
      out.set(k, (out.get(k) as number) + add)
      moved += add
    }
    if (moved === 0) fail('no room left')
    rest -= moved
  }
  return out
}

let cached: Map<number, Ladder> | null = null

/** The ladder of every monitoring school with answers. */
export function segmentLadders(): ReadonlyMap<number, Ladder> {
  if (cached) return cached
  const bands = bandsWithAnswers()
  const schools = [...bands.keys()].sort((a, b) => a - b)
  const aktif = (s: number) => M11_AKTIF[s] ?? fail(`no M11 Aktif row for ${String(s)}`)
  // Week users: ≥ today's pupils, ≥ 1 with week answers, = 7d users when no band-2 answer.
  const week = bounded(
    SEGMENT_WEEK_USERS,
    schools.map((s) => {
      const a7 = aktif(s)[1]
      const has = bands.get(s) as Set<number>
      const t = TODAY_USERS[s] ?? 0
      if (a7 === 0) return [s, 0, 0] as const
      const lo = has.has(2) ? Math.max(t, has.has(0) || has.has(1) ? 1 : 0) : a7
      return [s, lo, a7] as const
    }),
  )
  // Month users: between the 7d and 30d users; = 30d users when no band-4 answer.
  const month = bounded(
    SEGMENT_MONTH_USERS,
    schools.map((s) => {
      const [, a7, a30] = aktif(s)
      const has = bands.get(s) as Set<number>
      return has.has(4) ? ([s, a7, a30] as const) : ([s, a30, a30] as const)
    }),
  )
  const out = new Map<number, Ladder>()
  for (const s of schools) {
    const [all, a7, a30, a3m] = aktif(s)
    const ladder: Ladder = [
      TODAY_USERS[s] ?? 0,
      week.get(s) ?? 0,
      a7,
      month.get(s) ?? 0,
      a30,
      a3m,
      all,
    ]
    for (let i = 1; i < 7; i++) {
      if ((ladder[i] as number) < (ladder[i - 1] as number))
        fail(`school ${String(s)} ladder not monotone: ${ladder.join(', ')}`)
    }
    out.set(s, ladder)
  }
  cached = out
  return out
}
