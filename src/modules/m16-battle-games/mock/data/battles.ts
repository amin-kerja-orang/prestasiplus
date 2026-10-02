/**
 * M16 battle seeds (SRS M16 v1.6 §6.11.1, §6.11.2): the 47 observed battles, the 97 `abandoned`
 * battles and the 47 submitted game results of the 22 no-class anchors (M17 totals, XL3-17), the
 * stored Ketepatan / Skor of the 8 observed school standings (DC-M16-03) and the 24 generated older
 * battles (built at finalise, once the M01 users dataset is compiled).
 *
 * Players are the fictitious anchors 4301-4325 (M02 v1.23); every other value follows the SRS.
 */

import { toIsoMyt } from '@/lib/time'
import type { Prng } from '@/mock/determinism'

import { seedCorrect, winnerOf } from '../repository/common'
import type { BattleRow, GameSessionRow, StoredStandingRow } from '../types'
import { OBSERVED_BATTLES } from './battles-observed'

/** Seed battle uuid: `00000000-0000-4000-8000-0000000000nn` (nn = seed #, zero padded to 12). */
export const seedUuid = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export const SEED_BATTLE_COUNT = 168
export const OBSERVED_COUNT = 47
export const GENERATED_COUNT = 24
export const ABANDONED_COUNT = 97

/** The 22 no-class players of M02 v1.23 (4302-4319, 4322-4325). */
export const NO_CLASS_PLAYERS: readonly number[] = [
  ...Array.from({ length: 18 }, (_, i) => 4302 + i),
  4322,
  4323,
  4324,
  4325,
]

const FIVE_MIN = 5 * 60_000

function seedRow(
  n: number,
  fields: Pick<
    BattleRow,
    | 'playerA'
    | 'playerB'
    | 'schoolAId'
    | 'schoolBId'
    | 'scoreA'
    | 'scoreB'
    | 'status'
    | 'createdAtMs'
    | 'correctA'
    | 'correctB'
    | 'answered'
  >,
): BattleRow {
  const finished = fields.status !== 'abandoned'
  return {
    id: seedUuid(n),
    mode: 'quick_match',
    questionType: 'biasa',
    subjectId: null,
    pkskDomainId: null,
    pkskTargetLevel: null,
    levelId: null,
    ...fields,
    winner: finished ? winnerOf(fields.scoreA, fields.scoreB) : null,
    createdAt: toIsoMyt(fields.createdAtMs),
    finishedAt: finished ? toIsoMyt(fields.createdAtMs + FIVE_MIN) : null,
    questionIds: [],
    seeded: true,
  }
}

/** Battles 1-47 (§6.11.1), as observed. */
export function observedBattleRows(): BattleRow[] {
  return OBSERVED_BATTLES.map(([n, createdAt, a, sa, scoreA, scoreB, b, sb]) =>
    seedRow(n, {
      playerA: a,
      playerB: b,
      schoolAId: sa,
      schoolBId: sb,
      scoreA,
      scoreB,
      status: 'finished',
      createdAtMs: Date.parse(createdAt),
      correctA: seedCorrect(scoreA),
      correctB: seedCorrect(scoreB),
      answered: 10,
    }),
  )
}

const at = (iso: string): number => Date.parse(iso)

/**
 * The 97 `abandoned` battles of the 22 no-class anchors (PROPOSED records, XL3-17): 11 created
 * between 2026-06-28 and 2026-08-25 (inside the 90-day window, outside 30 days), 86 between
 * 2026-01-05 and 2026-06-19. Seed numbers 72-168. No school at battle time, so no standing, S4 list or M11
 * effect.
 */
export function abandonedBattleRows(rng: Prng): BattleRow[] {
  const rows: BattleRow[] = []
  const make = (n: number, fromMs: number, toMs: number) => {
    const a = rng.pick(NO_CLASS_PLAYERS)
    let b = rng.pick(NO_CLASS_PLAYERS)
    while (b === a) b = rng.pick(NO_CLASS_PLAYERS)
    rows.push(
      seedRow(n, {
        playerA: a,
        playerB: b,
        schoolAId: null,
        schoolBId: null,
        scoreA: 0,
        scoreB: 0,
        status: 'abandoned',
        createdAtMs: Math.floor(fromMs + rng.next() * (toMs - fromMs)),
        correctA: 0,
        correctB: 0,
        answered: 0,
      }),
    )
  }
  let n = OBSERVED_COUNT + GENERATED_COUNT + 1
  for (let i = 0; i < 11; i++)
    make(n++, at('2026-06-28T08:00:00+08:00'), at('2026-08-25T22:00:00+08:00'))
  for (let i = 0; i < 86; i++)
    make(n++, at('2026-01-05T08:00:00+08:00'), at('2026-06-19T22:00:00+08:00'))
  return rows
}

const GAMES = [
  'betul-salah',
  'cabaran-kilat',
  'tembak-jawapan',
  'susun-jawapan',
  'kad-memori',
] as const

/**
 * The 47 submitted game results of the 22 anchors (PROPOSED mix, XL3-17): 5 submitted between
 * 2026-08-27 and 2026-09-17, 42 between 2026-06-28 and 2026-08-25. They paid no syiling (M14 seed 0).
 */
export function seedGameSessions(rng: Prng): GameSessionRow[] {
  const rows: GameSessionRow[] = []
  const used = new Set<string>()
  const hex13 = (): string => {
    let out = ''
    for (let i = 0; i < 13; i++) out += '0123456789abcdef'[Math.floor(rng.next() * 16)]
    return out
  }
  const prefix: Record<(typeof GAMES)[number], string> = {
    'betul-salah': 'tf_',
    'cabaran-kilat': 'speed_',
    'tembak-jawapan': 'shoot_',
    'susun-jawapan': 'ws_',
    'kad-memori': 'mem_',
  }
  const make = (fromMs: number, toMs: number) => {
    const game = rng.pick(GAMES)
    let id = prefix[game] + hex13()
    while (used.has(id)) id = prefix[game] + hex13()
    used.add(id)
    const submittedAtMs = Math.floor(fromMs + rng.next() * (toMs - fromMs))
    rows.push({
      id,
      userId: rng.pick(NO_CLASS_PLAYERS),
      game,
      darjah: game === 'kad-memori' ? null : rng.int(1, 6),
      createdAtMs: submittedAtMs - rng.int(40, 70) * 1000,
      submittedAtMs,
      score: game === 'kad-memori' ? 0 : rng.int(40, 400),
      coinsComputed: 0,
      coinsCredited: 0,
      isNewRecord: false,
    })
  }
  for (let i = 0; i < 5; i++) make(at('2026-08-27T08:00:00+08:00'), at('2026-09-17T20:00:00+08:00'))
  for (let i = 0; i < 42; i++)
    make(at('2026-06-28T08:00:00+08:00'), at('2026-08-25T20:00:00+08:00'))
  return rows
}

/**
 * Stored Ketepatan / Skor of the 8 observed school standings (DC-M16-03, §6.11.2). `orderKey` is
 * the live order for equal Skor (8078 before 8082).
 */
export const STORED_STANDINGS: readonly Omit<StoredStandingRow, 'id'>[] = [
  { periodKey: 'all_time', schoolId: 8106, ketepatan: 69, skor: 738, orderKey: 1 },
  { periodKey: 'all_time', schoolId: 8090, ketepatan: 48, skor: 519, orderKey: 2 },
  { periodKey: 'all_time', schoolId: 8078, ketepatan: 29, skor: 367, orderKey: 3 },
  { periodKey: 'all_time', schoolId: 8082, ketepatan: 29, skor: 367, orderKey: 4 },
  { periodKey: 'all_time', schoolId: 8880, ketepatan: 33, skor: 340, orderKey: 5 },
  { periodKey: 'all_time', schoolId: 8080, ketepatan: 24, skor: 303, orderKey: 6 },
  { periodKey: 'all_time', schoolId: 2710, ketepatan: 8, skor: 87, orderKey: 7 },
  { periodKey: 'monthly:2026-09', schoolId: 8082, ketepatan: 58, skor: 591, orderKey: 1 },
]

/** Inputs of the generated older battles (§6.11.1 "Generated older battles"). */
export interface GeneratedPupils {
  /** Pupils of the school, M02 students (not the anchors). */
  p8106: readonly number[]
  p8078: readonly number[]
  p8080: readonly number[]
  /** Students without a school. */
  noSchool: readonly number[]
}

const DAY = 86_400_000

/**
 * The 24 generated older battles: 8106 9 (A is a pupil of 8106, B has no school, A wins), 8078 10
 * intra-school (5 of them forfeited by the loser) and 8080 5 intra-school. Seed numbers 48-71;
 * scores PROPOSED, no tie. Uses `p8106` 5, `p8078` 8 and `p8080` 6 pupils.
 */
export function generatedBattleRows(pupils: GeneratedPupils, rng: Prng): BattleRow[] {
  const rows: BattleRow[] = []
  let n = OBSERVED_COUNT + 1
  const start = (day: string) => at(`${day}T21:00:00+08:00`)
  const build = (
    schoolId: number,
    a: number,
    b: number,
    bSchool: number | null,
    dayMs: number,
    forfeited: boolean,
    aWins: boolean,
  ) => {
    const hi = 5000 + rng.int(0, 40) * 100
    const lo = rng.int(0, 45) * 100
    const [scoreA, scoreB] = aWins ? [hi, lo] : [lo, hi]
    rows.push(
      seedRow(n++, {
        playerA: a,
        playerB: b,
        schoolAId: schoolId,
        schoolBId: bSchool,
        scoreA,
        scoreB,
        status: forfeited ? 'forfeited' : 'finished',
        createdAtMs: dayMs,
        correctA: seedCorrect(scoreA),
        correctB: seedCorrect(scoreB),
        answered: 10,
      }),
    )
  }
  const d8106 = start('2026-02-01')
  for (let k = 0; k < 9; k++) {
    const a = pupils.p8106[k % pupils.p8106.length] as number
    const b = rng.pick(pupils.noSchool)
    build(8106, a, b, null, d8106 + k * DAY, false, true)
  }
  const pairs78: readonly (readonly [number, number])[] = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
    [0, 4],
    [1, 5],
  ]
  const d8078 = start('2026-02-10')
  pairs78.forEach(([i, j], k) => {
    build(
      8078,
      pupils.p8078[i] as number,
      pupils.p8078[j] as number,
      8078,
      d8078 + k * DAY,
      k % 2 === 1,
      k % 3 !== 0,
    )
  })
  const pairs80: readonly (readonly [number, number])[] = [
    [0, 1],
    [2, 3],
    [4, 5],
    [0, 2],
    [1, 4],
  ]
  const d8080 = start('2026-02-20')
  pairs80.forEach(([i, j], k) => {
    build(
      8080,
      pupils.p8080[i] as number,
      pupils.p8080[j] as number,
      8080,
      d8080 + k * DAY,
      false,
      k % 2 === 0,
    )
  })
  return rows
}
