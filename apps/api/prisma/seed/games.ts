/**
 * Games demo seed (BE-45, M16 part 2): game standings, personal bests, Jutawan and spin stats for a few demo
 * students, a few closed rooms and submitted sessions, the two observed leagues with their stored standings and
 * the Sekolah Bersaing weekly snapshots. Demo kind: refused in production unless ALLOW_DEMO_SEED. Fictitious data
 * only; users are found by e-mail and schools by code (never by id), `legacy_*` is never set. The `game_settings`
 * row is inserted by the migration and is not touched here.
 *
 * Source of the values: the frontend mock (`src/modules/m16-battle-games/mock/data/{leagues,sekolah-bersaing-seed}.ts`)
 * for the leagues and the board; the standings, bests and stats are generated from `ctx.prng` (the mock's are
 * generated too). Deviations from the mock (each is a row of docs/architecture/v2-backend-deviations.md):
 *  - the mock places leagues and Sekolah Bersaing rows on its school register; here the four demo schools
 *    (DEMO001..DEMO004) stand in: league 1 (observed 8080, 8082, 8106) -> DEMO001, DEMO002, DEMO003; league 2
 *    (8078, 8090) -> DEMO004, DEMO001;
 *  - Sekolah Bersaing rows name a school as "the n-th school of a state"; only rows whose placement exists among
 *    the demo schools are seeded (Selangor 1-2 -> DEMO001, DEMO002; Johor 1-2 -> DEMO003, DEMO004), in stored order,
 *    and their ranks are compacted to 1..n (no gaps). The other rows are not seeded (no school to show);
 *  - creators are the demo teacher / admin accounts (the mock's are real accounts of its own dataset);
 *  - league and Sekolah Bersaing rows are the stored job output: nothing recomputes them (OQ-M16-09).
 *
 * Idempotent: every row is matched by its natural key and an existing row is left as it is. Deterministic: random
 * figures come from `ctx.prng`, times from `ctx.clock`. Skips (does not fail) any user or school it cannot find.
 */
import type { PrismaClient } from '../../src/db/client'
import { assertSeedAllowed } from './guard'
import type { SeedContext, SeedModule } from './index'

const DAY = 86_400_000
const ROOM_GAMES = ['papan-bijak', 'perang-fakta', 'benteng-ilmu', 'perlumbaan-matematik', 'kuiz-relay', 'teka-silang-kata'] as const
const SOLO_GAMES = ['betul-salah', 'cabaran-kilat', 'tembak-jawapan', 'susun-jawapan', 'kad-memori'] as const
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/** Demo students that get games data, in this order (the standings' creation order follows it). */
export const GAMES_SEED_STUDENTS = [
  'pelajar@demo.test',
  'pelajarmaju@demo.test',
  'pelajar2@demo.test',
  'murid.demo001.01@example.test',
  'murid.demo001.02@example.test',
  'murid.demo001.03@example.test',
  'murid.demo002.01@example.test',
  'murid.demo003.01@example.test',
] as const

interface LeaguePlan {
  inviteCode: string
  name: string
  type: string
  scope: string
  subject: string
  classLevels: string[]
  startDate: string
  endDate: string
  status: string
  creatorEmail: string
  createdAt: string
  /** School codes in join order. */
  schools: string[]
  /** Stored standings: level, school code, peserta, skor, purata (stored order). */
  standings: { level: string; school: string; peserta: number; skor: number; purata: number }[]
}

/** The two observed leagues (mock `data/leagues.ts`), invite codes, dates and figures kept. */
export const GAMES_SEED_LEAGUES: readonly LeaguePlan[] = [
  {
    inviteCode: 'RMU4VCBS',
    name: 'Liga Sejarah 2026 5ST',
    type: 'friendly',
    scope: 'school',
    subject: 'SEJ',
    classLevels: ['T5'],
    startDate: '2026-03-31',
    endDate: '2026-04-01',
    status: 'upcoming',
    creatorEmail: 'guru@demo.test',
    createdAt: '2026-03-20T10:00:00+08:00',
    schools: ['DEMO001', 'DEMO002', 'DEMO003'],
    standings: [],
  },
  {
    inviteCode: 'TEST2026',
    name: 'Liga Matematik Sprint Test',
    type: 'friendly',
    scope: 'school',
    subject: 'MATH',
    classLevels: ['T4', 'T5'],
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    status: 'ended',
    creatorEmail: 'admin@demo.test',
    createdAt: '2026-03-31T09:00:00+08:00',
    schools: ['DEMO004', 'DEMO001'],
    standings: [
      { level: 'T4', school: 'DEMO001', peserta: 8, skor: 2935.0, purata: 77.2 },
      { level: 'T4', school: 'DEMO004', peserta: 0, skor: 0, purata: 0 },
      { level: 'T5', school: 'DEMO001', peserta: 0, skor: 0, purata: 0 },
      { level: 'T5', school: 'DEMO004', peserta: 0, skor: 0, purata: 0 },
    ],
  },
]

/** Sekolah Bersaing weeks (mock `SB_WEEKS`): the rows whose placement exists among the demo schools, stored order. */
const SB_ROWS: readonly (readonly [state: string, n: number, aktifPct: number, streakAvg: number, notaPer10: number])[] = [
  ['Johor', 1, 0.0, 9.3, 0.0],
  ['Selangor', 1, 0.0, 8.2, 0.0],
  ['Selangor', 2, 0.0, 8.1, 0.0],
  ['Johor', 2, 0.0, 7.9, 0.0],
]
export const GAMES_SEED_SB_WEEKS = ['2026-09-21', '2026-09-14', '2026-09-07', '2026-08-31'] as const

const at = (iso: string): Date => new Date(iso)

async function userId(prisma: PrismaClient, email: string): Promise<bigint | null> {
  const u = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })
  return u?.id ?? null
}

async function seedStats(ctx: SeedContext): Promise<void> {
  const { prisma } = ctx
  const rng = ctx.prng('games:seed:stats')
  const now = ctx.clock.now()
  for (const email of GAMES_SEED_STUDENTS) {
    // Draw first so the stream does not depend on which users exist.
    const standings = ROOM_GAMES.map((game) => {
      const jumlah = game === 'papan-bijak' ? rng.int(3, 20) : rng.int(0, 6)
      const wins = rng.int(0, jumlah)
      return { game, wins, jumlah, skor: jumlah * rng.int(20, 60), betul: jumlah * rng.int(2, 8), ago: rng.int(1, 40) }
    })
    const bests = SOLO_GAMES.map((game) => ({ game, bestScore: rng.int(40, 400) }))
    const jutawan = { bestLevel: rng.int(0, 15), games: rng.int(1, 12) }
    const spinsTotal = rng.int(1, 20)
    const spin = { spins: spinsTotal, won: rng.int(0, spinsTotal), ago: rng.int(1, 9) }
    const id = await userId(prisma, email)
    if (id === null) continue
    for (const s of standings) {
      const exists = await prisma.gameStanding.findUnique({ where: { game_userId: { game: s.game, userId: id } } })
      if (exists) continue
      // Created in this loop order: the identity id is the creation-order tie-break of the boards.
      await prisma.gameStanding.create({
        data: { game: s.game, userId: id, wins: s.wins, jumlah: s.jumlah, skor: s.skor, betul: s.betul, reachedAt: new Date(now.getTime() - s.ago * DAY), isTest: false, createdAt: new Date(now.getTime() - s.ago * DAY) },
      })
    }
    for (const b of bests) {
      await prisma.personalBest.upsert({ where: { userId_game: { userId: id, game: b.game } }, update: {}, create: { userId: id, game: b.game, bestScore: b.bestScore, updatedAt: now } })
    }
    await prisma.jutawanStat.upsert({ where: { userId: id }, update: {}, create: { userId: id, bestLevel: jutawan.bestLevel, games: jutawan.games } })
    await prisma.spinStat.upsert({
      where: { userId: id },
      update: {},
      create: { userId: id, spins: spin.spins, won: spin.won, lastSpinDate: new Date(now.getTime() - spin.ago * DAY) },
    })
  }
}

/** A few closed rooms (as the mock's 160) with human players, and submitted solo sessions. */
async function seedRoomsAndSessions(ctx: SeedContext): Promise<void> {
  const { prisma } = ctx
  const rng = ctx.prng('games:seed:rooms')
  const now = ctx.clock.now()
  const hosts = GAMES_SEED_STUDENTS.slice(0, 4)
  for (let i = 0; i < 4; i++) {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[rng.int(0, CODE_ALPHABET.length - 1)]).join('')
    const game = ROOM_GAMES[i % ROOM_GAMES.length] as (typeof ROOM_GAMES)[number]
    const when = new Date(now.getTime() - (i + 2) * 3 * DAY)
    const hostId = await userId(prisma, hosts[i] as string)
    const guestId = await userId(prisma, GAMES_SEED_STUDENTS[(i + 1) % hosts.length] as string)
    if (hostId === null || (await prisma.gameRoom.findUnique({ where: { code } }))) continue
    const max = game === 'papan-bijak' ? 4 : game === 'perang-fakta' ? 6 : 2
    await prisma.gameRoom.create({
      data: { code, game, subject: 'MATEMATIK', gradeLevel: 'TINGKATAN_4', matchMode: 'same_grade', maxPlayers: max, hostId, status: 'closed', createdAt: when, updatedAt: when },
    })
    await prisma.gameRoomPlayer.create({ data: { roomCode: code, userId: hostId, points: 0, correct: 0, isBot: false, joinedAt: when } })
    if (guestId !== null && guestId !== hostId) {
      await prisma.gameRoomPlayer.create({ data: { roomCode: code, userId: guestId, points: 0, correct: 0, isBot: false, joinedAt: when } })
    }
  }
  const sessions = [
    { email: GAMES_SEED_STUDENTS[0], game: 'betul-salah', score: 180, correct: 12, items: 40, ago: 2 },
    { email: GAMES_SEED_STUDENTS[1], game: 'cabaran-kilat', score: 250, correct: 9, items: 30, ago: 3 },
    { email: GAMES_SEED_STUDENTS[0], game: 'tembak-jawapan', score: 120, correct: 8, items: 30, ago: 4 },
  ] as const
  for (const [i, s] of sessions.entries()) {
    const id = await userId(prisma, s.email)
    if (id === null) continue
    const created = new Date(now.getTime() - s.ago * DAY)
    if (await prisma.gameSession.findFirst({ where: { userId: id, game: s.game, createdAt: created } })) continue
    // A fixed uuid (not the column default gen_random_uuid()), so two seeded databases hold identical rows (BE-26 AC1).
    const sessionId = `00000000-0000-4000-8045-${String(i + 1).padStart(12, '0')}`
    await prisma.gameSession.create({
      data: { id: sessionId, userId: id, game: s.game, darjah: 10, itemCount: s.items, score: s.score, correctCount: s.correct, checks: s.correct, submittedAt: created, createdAt: created, updatedAt: created },
    })
  }
}

async function schoolIdByCode(prisma: PrismaClient, code: string): Promise<bigint | null> {
  return (await prisma.school.findFirst({ where: { code }, select: { id: true } }))?.id ?? null
}

async function seedLeagues(ctx: SeedContext): Promise<void> {
  const { prisma } = ctx
  for (const plan of GAMES_SEED_LEAGUES) {
    if (await prisma.league.findUnique({ where: { inviteCode: plan.inviteCode } })) continue
    const subject = await prisma.subject.findUnique({ where: { code: plan.subject }, select: { id: true } })
    const creatorId = await userId(prisma, plan.creatorEmail)
    const league = await prisma.league.create({
      data: {
        name: plan.name, type: plan.type, scope: plan.scope, subjectId: subject?.id ?? null, gameMode: 'mixed', scoringMethod: 'total_score',
        startDate: at(`${plan.startDate}T00:00:00.000Z`), endDate: at(`${plan.endDate}T00:00:00.000Z`), maxSchools: null,
        inviteCode: plan.inviteCode, creatorId, status: plan.status, isTest: false, createdAt: at(plan.createdAt),
      },
    })
    await prisma.leagueClassLevel.createMany({ data: plan.classLevels.map((level) => ({ leagueId: league.id, level })) })
    for (const code of plan.schools) {
      const schoolId = await schoolIdByCode(prisma, code)
      if (schoolId !== null) await prisma.leagueSchool.create({ data: { leagueId: league.id, schoolId, joinedAt: at('2026-03-31T09:00:00+08:00') } })
    }
    const perLevel = new Map<string, number>()
    for (const s of plan.standings) {
      const schoolId = await schoolIdByCode(prisma, s.school)
      if (schoolId === null) continue
      const order = (perLevel.get(s.level) ?? 0) + 1
      perLevel.set(s.level, order)
      await prisma.leagueStanding.create({ data: { leagueId: league.id, level: s.level, schoolId, peserta: s.peserta, skor: s.skor, purata: s.purata, sortOrder: order } })
    }
  }
}

async function seedSekolahBersaing(ctx: SeedContext): Promise<void> {
  const { prisma } = ctx
  // "n-th school of the state" among the demo schools, by code.
  const demo = await prisma.school.findMany({ where: { code: { startsWith: 'DEMO' } }, select: { id: true, code: true, state: true }, orderBy: { code: 'asc' } })
  const byState = new Map<string, bigint[]>()
  for (const s of demo) if (s.state) byState.set(s.state, [...(byState.get(s.state) ?? []), s.id])
  const placed = SB_ROWS.flatMap(([state, n, aktifPct, streakAvg, notaPer10]) => {
    const schoolId = byState.get(state)?.[n - 1]
    return schoolId === undefined ? [] : [{ schoolId, aktifPct, streakAvg, notaPer10 }]
  })
  for (const week of GAMES_SEED_SB_WEEKS) {
    const weekStart = at(`${week}T00:00:00.000Z`)
    for (const [i, p] of placed.entries()) {
      const rank = i + 1
      if (await prisma.sekolahBersaingWeek.findUnique({ where: { weekStart_rank: { weekStart, rank } } })) continue
      await prisma.sekolahBersaingWeek.create({ data: { weekStart, rank, schoolId: p.schoolId, aktifPct: p.aktifPct, streakAvg: p.streakAvg, notaPer10: p.notaPer10, isAnonymous: false } })
    }
  }
}

export const gamesSeed: SeedModule = {
  name: 'games',
  kind: 'demo',
  async run(ctx) {
    assertSeedAllowed()
    await seedStats(ctx)
    await seedRoomsAndSessions(ctx)
    await seedLeagues(ctx)
    await seedSekolahBersaing(ctx)
  },
}
