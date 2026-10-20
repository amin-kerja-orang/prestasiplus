import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { BattleListRowSchema, BattleSchoolStandingsResultSchema, BattleStudentStandingSchema } from '@pp/contract'
import { z } from 'zod'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../prisma/seed'
import {
  battleSeed,
  correctOf,
  generatedBattles,
  observedBattles,
  OBSERVED_BATTLES,
  seedUuid,
  SLOT_EMAIL,
  winnerOf,
} from '../../prisma/seed/battle'
import { FICTITIOUS_NAME_PATTERN } from '../../prisma/seed/core/fixtures/names'
import { identitySeed } from '../../prisma/seed/core/identity'
import { populationSeed } from '../../prisma/seed/core/population'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { SEED_NOW } from '../../src/db/clock'
import { prngStream } from '../../src/db/prng'
import { createTestDatabase } from '../support/db'
import { bootStandings, getAs, S, type StandingsApp } from './standings-helpers'

/** The deny-list of common real names used by the migration fixture test (test/migration/fixtures/generate.spec.ts). */
const DENY = /\b(ahmad|muhammad|mohammad|mohd|abdul|abdullah|siti|nurul|nur|aisyah|fatimah|ali|hassan|hussein|lim|tan|wong|lee|chong|kumar|raj|singh|kaur|devi|krishnan|tengku|syed|sharifah|binti|bin|a\/l|a\/p)\b/i

const SEED_FILE = fileURLToPath(new URL('../../prisma/seed/battle.ts', import.meta.url))

describe('battle demo seed (BE-44)', () => {
  let t: StandingsApp

  const counts = async () => {
    const q = async (sql: string) => Number((await t.db.query<{ n: string }>(sql))[0]!.n)
    return {
      battles: await q('select count(*) n from battles'),
      participants: await q('select count(*) n from battle_participants'),
      questions: await q('select count(*) n from battle_questions'),
      answers: await q('select count(*) n from battle_answers'),
    }
  }
  const fingerprint = async (): Promise<string> => {
    const rows = await t.db.query(
      `select b.id::text, b.mode, b.question_type, b.status, b.winner, b.answered, b.is_test, b.created_at, b.finished_at,
              p.side, p.user_id::text, p.school_id::text, p.score, p.correct, p.is_bot
         from battles b join battle_participants p on p.battle_id = b.id order by b.id, p.side`,
    )
    return createHash('sha256').update(JSON.stringify(rows)).digest('hex')
  }

  beforeAll(async () => {
    t = await bootStandings(SEED_NOW, [battleSeed])
  })
  afterAll(async () => {
    await t.close()
  })

  it('is a demo seed registered after the Bijak sittings, before practice (which stays last)', () => {
    expect(battleSeed.kind).toBe('demo')
    const names = seedModules.map((m) => m.name)
    expect(names.indexOf('battle')).toBe(names.indexOf('poc-bijak-sittings') + 1)
    expect(names.indexOf('practice')).toBe(names.length - 1)
  })

  it('is refused in production without ALLOW_DEMO_SEED (the runner skips it)', async () => {
    const db = await createTestDatabase()
    try {
      await runSeeds([identitySeed, schoolsSeed, populationSeed], { prisma: db.prisma })
      const done = await runSeeds([battleSeed], { prisma: db.prisma, env: { NODE_ENV: 'production' } })
      expect(done).toEqual([])
      expect(await db.prisma.battle.count()).toBe(0)
    } finally {
      await db.drop()
    }
  })

  it('writes the 47 observed and 24 generated battles with two participants each; no questions, no answers', async () => {
    expect(await counts()).toEqual({ battles: 71, participants: 142, questions: 0, answers: 0 })
    expect(OBSERVED_BATTLES).toHaveLength(47)
    const statuses = await t.db.query<{ status: string; n: string }>(`select status, count(*) n from battles group by status order by status`)
    expect(statuses.map((r) => [r.status, Number(r.n)])).toEqual([['finished', 66], ['forfeited', 5]])
    expect(await t.db.query(`select 1 from battles where is_test or status not in ('finished','forfeited')`)).toEqual([])
    expect(await t.db.query(`select 1 from battle_participants where is_test or is_bot`)).toEqual([])
  })

  it('uses fixed uuids (natural key), stored winner by the 0-0 / draw rules, and correct = min(10, floor(score / 500))', async () => {
    const rows = await t.db.query<{ id: string; winner: string | null; sa: number; sb: number; ca: number; cb: number; answered: number }>(
      `select b.id::text, b.winner, a.score sa, c.score sb, a.correct ca, c.correct cb, b.answered
         from battles b join battle_participants a on a.battle_id = b.id and a.side = 'A' join battle_participants c on c.battle_id = b.id and c.side = 'B'`,
    )
    expect(rows).toHaveLength(71)
    for (const r of rows) {
      expect(r.id).toMatch(/^00000000-0000-4000-8000-0000000000\d\d$/)
      expect(r.winner).toBe(winnerOf(r.sa, r.sb))
      expect([r.ca, r.cb]).toEqual([correctOf(r.sa), correctOf(r.sb)])
      expect(r.answered).toBe(10)
    }
    expect(rows.find((r) => r.id === seedUuid(18))!.winner).toBe('B') // 0-0 goes to B
    expect(rows.find((r) => r.id === seedUuid(2))!.winner).toBeNull() // draw
    expect(correctOf(9763)).toBe(10)
    expect(correctOf(883)).toBe(1)
  })

  it('pairs two different students in every battle and never sets legacy_*', async () => {
    expect(await t.db.query(`select 1 from battle_participants a join battle_participants c on a.battle_id = c.battle_id and a.side = 'A' and c.side = 'B' where a.user_id = c.user_id`)).toEqual([])
    expect(await t.db.query(`select 1 from battles where legacy_source is not null or legacy_id is not null or legacy_hash is not null`)).toEqual([])
    expect(await t.db.query(`select 1 from battle_participants where legacy_source is not null or legacy_id is not null`)).toEqual([])
    for (const b of [...observedBattles(), ...generatedBattles(prngStream('m16:seed-battles'))]) expect(b.emailA, `battle ${b.n}`).not.toBe(b.emailB)
  })

  it('is deterministic: the generated battles are the same for the same stream', () => {
    const a = generatedBattles(prngStream('m16:seed-battles'))
    expect(a).toHaveLength(24)
    expect(generatedBattles(prngStream('m16:seed-battles'))).toEqual(a)
    expect(a.filter((b) => b.status === 'forfeited')).toHaveLength(5)
    expect(a.filter((b) => b.schoolB === null)).toHaveLength(9)
  })

  it('is idempotent: a second and third run keep every row, id and figure (same counts and fingerprint)', async () => {
    const before = await counts()
    const fp = await fingerprint()
    await runSeeds([battleSeed], { prisma: t.db.prisma })
    await runSeeds([battleSeed], { prisma: t.db.prisma })
    expect(await counts()).toEqual(before)
    expect(await fingerprint()).toBe(fp)
  })

  it('seed users are fictitious: demo accounts or "<Role> Contoh <Word>", example.test / demo.test e-mails, none on the real-name deny-list', async () => {
    const users = await t.db.query<{ name: string; email: string }>(
      `select distinct u.name, u.email from battle_participants p join users u on u.id = p.user_id`,
    )
    expect(users.length).toBeGreaterThanOrEqual(20)
    const have = new Set(users.map((u) => u.email))
    for (const e of observedBattles().flatMap((b) => [b.emailA, b.emailB])) expect(have.has(e), e).toBe(true)
    expect(Object.values(SLOT_EMAIL)).toHaveLength(25)
    for (const u of users) {
      expect(u.email).toMatch(/@(example|demo)\.test$/)
      expect(/Demo/.test(u.name) || FICTITIOUS_NAME_PATTERN.test(u.name), u.name).toBe(true)
      expect(DENY.test(u.name), u.name).toBe(false)
      expect(DENY.test(u.email), u.email).toBe(false)
    }
    const code = readFileSync(SEED_FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(code).not.toMatch(/legacy|Math\.random|Date\.now|new Date\(\s*\)/)
  })

  describe('replay of the prototype cases that do not depend on its stored figures (AC 17)', () => {
    let pelajar: Awaited<ReturnType<StandingsApp['login']>>
    beforeAll(async () => {
      pelajar = await t.login(S.PELAJAR)
    })
    const students = async (q: string) => z.object({ data: z.array(BattleStudentStandingSchema) }).parse((await getAs(pelajar, `/battle/standings/students${q}`)).body).data
    const schools = async (q: string) => z.object({ data: BattleSchoolStandingsResultSchema }).parse((await getAs(pelajar, `/battle/standings/schools${q}`)).body).data

    it('weekly is empty (the newest seeded battle is from the week before the anchor)', async () => {
      expect(await students('')).toEqual([])
      expect(await schools('')).toEqual({ activePeriod: 'weekly', rows: [], podium: [] })
    })

    it('monthly (2026-09): the school of the 2026-09-16 battles only, 8 sides 4 won 4 lost by 2 pupils; students 2 / 0 / 2 each', async () => {
      const month = await schools('?period=monthly')
      expect(month.rows.map((r) => [r.name, r.battles, r.menang, r.seri, r.kalah, r.pelajar])).toEqual([['SJK(C) Demo Empat', 8, 4, 0, 4, 2]])
      const rows = await students('?period=monthly')
      expect(rows.map((r) => [r.menang, r.seri, r.kalah])).toEqual([[2, 0, 2], [2, 0, 2]])
      // 4 battles: scores 8313/6230, 0/0, 8430/8930, 6431/3465 -> round(score / 100) per side, sums of the two pupils: 591.
      expect(rows.reduce((n, r) => n + r.skor, 0)).toBe(83 + 62 + 0 + 0 + 84 + 89 + 64 + 35)
    })

    it('all time: counts of the prototype rows (sides, wins, draws, losses), with the 7 observed schools folded onto the 4 demo schools', async () => {
      const all = await schools('?period=all_time')
      const by = new Map(all.rows.map((r) => [r.name, r]))
      const fig = (name: string) => {
        const r = by.get(name)!
        return [r.battles, r.menang, r.seri, r.kalah]
      }
      expect(fig('SJK(C) Demo Empat')).toEqual([10, 5, 0, 5]) // 8082 alone
      expect(by.get('SJK(C) Demo Empat')!.pelajar).toBe(4)
      expect(fig('SMK Demo Satu')).toEqual([19 + 3, 12 + 2, 1, 6 + 1]) // 8106 + 8880
      expect(fig('SK Demo Dua')).toEqual([18 + 30, 9 + 15, 0, 9 + 15]) // 8090 + 8080
      expect(fig('SK Demo Tiga')).toEqual([40 + 3, 20 + 1, 0, 20 + 2]) // 8078 + 2710
      expect(all.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4])
      expect(all.podium).toHaveLength(3)
      expect(all.podium.map((p) => p.skor)).toEqual(all.rows.slice(0, 3).map((r) => r.skor))
      // Both Johor schools keep their national rank under a state filter.
      const johor = await schools('?period=all_time&state=Johor')
      expect(johor.rows.map((r) => r.rank)).toEqual(all.rows.filter((r) => r.state === 'Johor').map((r) => r.rank))
      expect(johor.rows).toHaveLength(2)
    })

    it('history of the demo student: the 8 finished battles of the first observed pupil, newest first', async () => {
      const res = await getAs(pelajar, '/battle/history')
      const rows = z.object({ data: z.array(BattleListRowSchema) }).parse(res.body).data
      expect(rows).toHaveLength(8)
      expect(rows[0]!.createdAt).toBe('2026-07-20T21:58:00.000+08:00')
      expect(rows[0]).toMatchObject({ scoreA: 9445, scoreB: 9763, winner: 'B' })
      expect(rows.map((r) => r.createdAt)).toEqual([...rows.map((r) => r.createdAt)].sort().reverse())
    })

    it('the school page of the monthly school: week null, month box, fighters empty (no battle this week), recent newest first', async () => {
      const id = (await t.db.query<{ id: string }>(`select id::text from schools where code = 'DEMO004'`))[0]!.id
      const res = await getAs(pelajar, `/battle/schools/${id}`)
      const data = res.body.data
      expect(data.week).toBeNull()
      expect(data.month).toMatchObject({ rank: 1, battles: 8, menang: 4, kalah: 4 })
      expect(data.fighters).toEqual([])
      expect(data.recent[0].createdAt).toBe('2026-09-16T21:58:00.000+08:00')
      expect(data.recent).toHaveLength(5)
    })
  })
})
