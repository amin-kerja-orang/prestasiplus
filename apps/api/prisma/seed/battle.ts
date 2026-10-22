/**
 * Battle demo seed (BE-44, M16): the observed-battle shape of the prototype and its older generated battles, attached
 * to the demo students of the core seeds by natural key (e-mail, school code). Demo kind: refused in production unless
 * ALLOW_DEMO_SEED. Fictitious data only; `legacy_*` is never set.
 *
 * Source of the figures: the prototype's `battles-observed.ts` (the 47 observed "Battle Terkini" rows: date, side
 * scores and the school each side had at battle time) and `battles.ts` (the 24 generated older battles: 9 of the first
 * school against a pupil without a school, 10 intra-school of which 5 forfeited, 5 intra-school). Nothing is tuned.
 *
 * Differences from the prototype (each is a row of the deviations file):
 *  - The prototype ties its 25 players and 7 schools to M02 ids. The core seeds have 4 demo schools and fewer students,
 *    so players are "slots" mapped to students by e-mail (`SLOT_EMAIL`) and the 7 observed schools fold onto
 *    DEMO001..DEMO004 (`SCHOOL_CODE`). Folding keeps every pair of opponents two different students.
 *  - A side the prototype shows without a school keeps `school_id` NULL on the participant row, but the student's
 *    CURRENT school (used by the student standings) is the demo school.
 *  - Questions: the prototype stores no question ids for these battles (`questionIds: []`), so `battle_questions` and
 *    `battle_answers` stay EMPTY for every seeded battle. `correct` per side is `min(10, floor(score / 500))` and
 *    `answered` is 10, the prototype's `seedCorrect`.
 *  - The 97 abandoned battles and the stored school figures of the prototype (Open question 5) are not seeded.
 *
 * Idempotent: a battle has a fixed uuid (`00000000-0000-4000-8000-0000000000nn`, nn = prototype seed number); an
 * existing battle is left as it is. Deterministic: scores of the generated battles come from `ctx.prng`.
 * The run skips (does not fail) when a student or school it needs is missing, so it can sit next to a partial list.
 */
import type { PrismaClient } from '../../src/db/client'
import { assertSeedAllowed } from './guard'
import type { SeedModule } from './index'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** Schools of the prototype (A..G) folded onto the demo schools. */
export const SCHOOL_CODE: Readonly<Record<string, string>> = {
  A: 'DEMO001',
  B: 'DEMO002',
  C: 'DEMO003',
  D: 'DEMO004',
  E: 'DEMO002',
  F: 'DEMO001',
  G: 'DEMO003',
}

const demo = (school: number, n: number): string => `murid.demo00${school}.${String(n).padStart(2, '0')}@example.test`

/** Player slot (1..25 of the prototype) to the student's e-mail. Slots of one battle never share a student. */
export const SLOT_EMAIL: Readonly<Record<number, string>> = {
  1: 'pelajar@demo.test',
  2: demo(1, 1),
  3: demo(1, 2),
  4: demo(2, 1),
  5: demo(2, 2),
  // Slots 6..15 (ten pupils of one school) fold onto the five pupils of DEMO003.
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [6 + i, demo(3, (i % 5) + 1)])),
  16: demo(4, 1),
  17: demo(4, 2),
  18: demo(4, 3),
  19: demo(4, 4),
  20: demo(1, 3),
  21: demo(3, 1),
  22: demo(2, 3),
  23: demo(2, 4),
  24: demo(2, 5),
  25: demo(2, 1),
}

/** [seed #, created at, slot A, school A at battle time ('-' none), score A, score B, slot B, school B]. */
export type ObservedBattle = readonly [number, string, number, string, number, number, number, string]

export const OBSERVED_BATTLES: readonly ObservedBattle[] = [
  [1, '2026-07-20T21:58:00+08:00', 1, 'A', 9445, 9763, 2, '-'],
  [2, '2026-07-20T21:57:00+08:00', 1, 'A', 8830, 8830, 2, '-'],
  [3, '2026-07-20T21:56:00+08:00', 1, 'A', 8514, 8663, 2, '-'],
  [4, '2026-07-20T21:55:00+08:00', 1, 'A', 7730, 9497, 2, '-'],
  [5, '2026-07-20T21:54:00+08:00', 1, 'A', 9196, 9780, 2, '-'],
  [6, '2026-07-20T21:53:00+08:00', 1, 'A', 883, 0, 2, '-'],
  [7, '2026-07-20T21:52:00+08:00', 1, 'A', 8447, 8413, 2, '-'],
  [8, '2026-07-20T21:51:00+08:00', 1, 'A', 0, 950, 2, '-'],
  [9, '2026-06-20T21:58:00+08:00', 2, '-', 0, 3682, 3, 'A'],
  [10, '2026-06-20T21:57:00+08:00', 2, '-', 9629, 2698, 3, 'A'],
  [11, '2026-06-20T21:56:00+08:00', 4, 'B', 3099, 3814, 5, 'B'],
  [12, '2026-06-20T21:55:00+08:00', 4, 'B', 0, 9146, 5, 'B'],
  [13, '2026-06-20T21:54:00+08:00', 4, 'B', 8046, 7746, 5, 'B'],
  [14, '2026-06-20T21:53:00+08:00', 4, 'B', 6897, 7580, 5, 'B'],
  [15, '2026-06-20T21:52:00+08:00', 5, 'B', 4665, 2015, 4, 'B'],
  [16, '2026-06-20T21:51:00+08:00', 5, 'B', 5380, 1366, 4, 'B'],
  [17, '2026-06-20T21:50:00+08:00', 4, 'B', 8946, 8230, 5, 'B'],
  [18, '2026-06-20T21:49:00+08:00', 5, 'B', 0, 0, 4, 'B'],
  [19, '2026-06-20T21:48:00+08:00', 5, 'B', 0, 0, 4, 'B'],
  [20, '2026-05-20T21:58:00+08:00', 6, 'C', 0, 800, 7, 'C'],
  [21, '2026-05-20T21:57:00+08:00', 6, 'C', 0, 5965, 7, 'C'],
  [22, '2026-05-20T21:56:00+08:00', 7, 'C', 0, 7946, 6, 'C'],
  [23, '2026-05-20T21:55:00+08:00', 7, 'C', 0, 0, 6, 'C'],
  [24, '2026-05-20T21:54:00+08:00', 7, 'C', 0, 0, 6, 'C'],
  [25, '2026-05-20T21:53:00+08:00', 8, 'C', 6780, 7382, 9, 'C'],
  [26, '2026-05-20T21:52:00+08:00', 9, 'C', 5914, 6031, 8, 'C'],
  [27, '2026-05-20T21:51:00+08:00', 10, 'C', 9681, 8911, 11, 'C'],
  [28, '2026-05-20T21:50:00+08:00', 12, 'C', 0, 6931, 13, 'C'],
  [29, '2026-04-20T21:58:00+08:00', 14, 'C', 2398, 2583, 15, 'C'],
  [30, '2026-09-16T21:58:00+08:00', 16, 'D', 8313, 6230, 17, 'D'],
  [31, '2026-09-16T21:57:00+08:00', 16, 'D', 0, 0, 17, 'D'],
  [32, '2026-09-16T21:56:00+08:00', 16, 'D', 8430, 8930, 17, 'D'],
  [33, '2026-09-16T21:55:00+08:00', 16, 'D', 6431, 3465, 17, 'D'],
  [34, '2026-05-20T21:49:00+08:00', 18, 'D', 0, 4515, 19, 'D'],
  [35, '2026-03-20T21:58:00+08:00', 20, 'F', 0, 816, 21, 'G'],
  [36, '2026-03-20T21:57:00+08:00', 21, 'G', 0, 0, 20, 'F'],
  [37, '2026-03-20T21:56:00+08:00', 20, 'F', 966, 0, 21, 'G'],
  [38, '2026-06-20T21:47:00+08:00', 22, 'E', 6131, 7329, 23, 'E'],
  [39, '2026-06-20T21:46:00+08:00', 23, 'E', 6714, 0, 22, 'E'],
  [40, '2026-06-20T21:45:00+08:00', 23, 'E', 0, 6447, 22, 'E'],
  [41, '2026-06-20T21:44:00+08:00', 24, 'E', 0, 0, 25, 'E'],
  [42, '2026-06-20T21:43:00+08:00', 24, 'E', 0, 0, 25, 'E'],
  [43, '2026-06-20T21:42:00+08:00', 25, 'E', 0, 1516, 24, 'E'],
  [44, '2026-06-20T21:41:00+08:00', 24, 'E', 0, 0, 25, 'E'],
  [45, '2026-06-20T21:40:00+08:00', 25, 'E', 0, 0, 24, 'E'],
  [46, '2026-06-20T21:39:00+08:00', 25, 'E', 2815, 1132, 24, 'E'],
  [47, '2026-06-20T21:38:00+08:00', 24, 'E', 0, 2932, 25, 'E'],
]

export interface SeedBattle {
  /** Prototype seed number 1..71; also the last digits of the uuid. */
  n: number
  createdAt: string
  status: 'finished' | 'forfeited'
  emailA: string
  emailB: string
  /** School code stored on the participant row, or null. */
  schoolA: string | null
  schoolB: string | null
  scoreA: number
  scoreB: number
}

export const seedUuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

/** 0-0 goes to side B, a draw is null (DV-M16-35). */
export const winnerOf = (a: number, b: number): 'A' | 'B' | null => (a === 0 && b === 0 ? 'B' : a > b ? 'A' : b > a ? 'B' : null)

/** The prototype's `seedCorrect`: a right answer per 500 points, at most ten. */
export const correctOf = (score: number): number => Math.min(10, Math.floor(score / 500))

const schoolOf = (key: string): string | null => (key === '-' ? null : (SCHOOL_CODE[key] ?? null))

export function observedBattles(): SeedBattle[] {
  return OBSERVED_BATTLES.map(([n, createdAt, a, sa, scoreA, scoreB, b, sb]) => ({
    n,
    createdAt,
    status: 'finished' as const,
    emailA: SLOT_EMAIL[a] as string,
    emailB: SLOT_EMAIL[b] as string,
    schoolA: schoolOf(sa),
    schoolB: schoolOf(sb),
    scoreA,
    scoreB,
  }))
}

/** Pupils the generated battles draw from (index into these lists, wrapping where the prototype has more pupils). */
const P_A = ['murid.demo001.03', 'murid.demo001.04', 'murid.demo001.05', 'murid.demo001.06'].map((l) => `${l}@example.test`).concat('pelajar2@demo.test')
const P_C = [1, 2, 3, 4, 5, 1, 2, 3].map((n) => demo(3, n))
const P_E = [1, 2, 3, 4, 5, 1].map((n) => demo(2, n))
const NO_SCHOOL = [1, 2, 3, 4, 5].map((n) => demo(4, n))

/** 24 generated older battles (prototype seed numbers 48..71), scores from the given stream. */
export function generatedBattles(rng: { int(min: number, max: number): number; pick<T>(items: readonly T[]): T }): SeedBattle[] {
  const out: SeedBattle[] = []
  let n = 48
  const start = (day: string): number => Date.parse(`${day}T21:00:00+08:00`)
  const build = (emailA: string, emailB: string, schoolA: string, schoolB: string | null, at: number, forfeited: boolean, aWins: boolean): void => {
    const hi = 5000 + rng.int(0, 40) * 100
    const lo = rng.int(0, 45) * 100
    const [scoreA, scoreB] = aWins ? [hi, lo] : [lo, hi]
    out.push({ n: n++, createdAt: new Date(at).toISOString(), status: forfeited ? 'forfeited' : 'finished', emailA, emailB, schoolA, schoolB, scoreA, scoreB })
  }
  const d1 = start('2026-02-01')
  for (let k = 0; k < 9; k++) build(P_A[k % P_A.length] as string, rng.pick(NO_SCHOOL), 'DEMO001', null, d1 + k * DAY, false, true)
  const pairs78: readonly (readonly [number, number])[] = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5]]
  const d2 = start('2026-02-10')
  pairs78.forEach(([i, j], k) => build(P_C[i] as string, P_C[j] as string, 'DEMO003', 'DEMO003', d2 + k * DAY, k % 2 === 1, k % 3 !== 0))
  const pairs80: readonly (readonly [number, number])[] = [[0, 1], [2, 3], [4, 5], [0, 2], [1, 4]]
  const d3 = start('2026-02-20')
  pairs80.forEach(([i, j], k) => build(P_E[i] as string, P_E[j] as string, 'DEMO002', 'DEMO002', d3 + k * DAY, false, k % 2 === 0))
  return out
}

async function seedBattle(db: PrismaClient, b: SeedBattle, users: Map<string, bigint>, schools: Map<string, bigint>): Promise<void> {
  const id = seedUuid(b.n)
  if (await db.battle.findUnique({ where: { id }, select: { id: true } })) return
  const userA = users.get(b.emailA)
  const userB = users.get(b.emailB)
  if (userA === undefined || userB === undefined) return
  const at = new Date(b.createdAt)
  const school = (code: string | null): bigint | null => (code === null ? null : (schools.get(code) ?? null))
  await db.battle.create({
    data: {
      id,
      mode: 'quick_match',
      questionType: 'biasa',
      answered: 10,
      winner: winnerOf(b.scoreA, b.scoreB),
      status: b.status,
      finishedAt: new Date(at.getTime() + 5 * MINUTE),
      isTest: false,
      createdAt: at,
      participants: {
        create: [
          { side: 'A', userId: userA, schoolId: school(b.schoolA), score: b.scoreA, correct: correctOf(b.scoreA), createdAt: at },
          { side: 'B', userId: userB, schoolId: school(b.schoolB), score: b.scoreB, correct: correctOf(b.scoreB), createdAt: at },
        ],
      },
    },
  })
}

export const battleSeed: SeedModule = {
  name: 'battle',
  kind: 'demo',
  async run(ctx) {
    // Defence in depth: the runner already refuses demo modules in production without the flag.
    assertSeedAllowed()
    const { prisma } = ctx
    const battles = [...observedBattles(), ...generatedBattles(ctx.prng('m16:seed-battles'))]
    const emails = [...new Set(battles.flatMap((b) => [b.emailA, b.emailB]))]
    const users = new Map<string, bigint>()
    for (const u of await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } })) {
      if (u.email) users.set(u.email, u.id)
    }
    const schools = new Map<string, bigint>()
    for (const s of await prisma.school.findMany({ where: { code: { in: Object.values(SCHOOL_CODE) } }, select: { id: true, code: true } })) {
      if (s.code) schools.set(s.code, s.id)
    }
    for (const b of battles) await seedBattle(prisma, b, users, schools)
  },
}
