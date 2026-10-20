import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'

import { FixedClock } from '../../src/db/clock'
import type { PrismaService } from '../../src/db/prisma.service'
import { BattleModule } from '../../src/modules/battle'
import { BattleDeps } from '../../src/modules/battle/battle.deps'
import { BattleReadService } from '../../src/modules/battle/battle-read.service'
import { GAME_RESULT_PORT, type GameResultPort } from '../../src/modules/battle/game-result.port'
import { createTestApp } from '../support/app'
import { createTestDatabase, type TestDatabase } from '../support/db'

const NOW = '2026-09-25T15:40:00+08:00'

describe('BattleReadService', () => {
  let db: TestDatabase
  let svc: BattleReadService
  let u1: string
  let u2: string
  let u3: string
  const clock = new FixedClock(NOW)

  const user = async (name: string) => (await db.query<{ id: string }>(`insert into users (name) values ($1) returning id::text`, [name]))[0]!.id
  const battle = async (status: string, createdAt: string, a: string, b: string, over: { test?: boolean; answered?: number; ca?: number; cb?: number } = {}) => {
    const [row] = await db.query<{ id: string }>(`insert into battles (mode, question_type, status, answered, is_test, created_at) values ('quick_match', 'biasa', $1, $2, $3, $4) returning id::text`, [
      status,
      over.answered ?? 10,
      over.test ?? false,
      createdAt,
    ])
    await db.query(`insert into battle_participants (battle_id, side, user_id, correct, is_test) values ($1, 'A', $2, $3, $5), ($1, 'B', $4, $6, $5)`, [row!.id, a, over.ca ?? 6, b, over.test ?? false, over.cb ?? 4])
  }

  beforeAll(async () => {
    db = await createTestDatabase()
    svc = new BattleReadService({ client: db.prisma } as unknown as PrismaService, clock)
    ;[u1, u2, u3] = [await user('Pelajar Satu'), await user('Pelajar Dua'), await user('Pelajar Tiga')]
    await battle('finished', '2026-09-20T10:00:00+08:00', u1, u2)
    await battle('forfeited', '2026-09-21T10:00:00+08:00', u2, u1, { answered: 3, ca: 1, cb: 2 })
    await battle('active', '2026-09-22T10:00:00+08:00', u1, u2)
    await battle('finished', '2026-09-23T10:00:00+08:00', u1, u2, { test: true })
    await battle('finished', '2026-06-01T10:00:00+08:00', u1, u2)
  })
  afterAll(async () => {
    await db.drop()
  })

  it('countFor: finished and forfeited battles of both sides in [from, to), without is_test and other users', async () => {
    const m = await svc.countFor([u1, u2, 'nope'], { from: new Date('2026-09-01T00:00:00+08:00'), to: new Date('2026-10-01T00:00:00+08:00') })
    expect(m.get(u1)).toEqual({ count: 2, correct: 8, answered: 13 })
    expect(m.get(u2)).toEqual({ count: 2, correct: 5, answered: 13 })
    expect(m.has(u3)).toBe(false)
    expect((await svc.countFor([u1], { from: new Date('2026-09-20T10:00:00+08:00'), to: new Date('2026-09-21T10:00:00+08:00') })).get(u1)).toEqual({ count: 1, correct: 6, answered: 10 })
    expect((await svc.countFor([], { from: new Date(0), to: new Date(NOW) })).size).toBe(0)
  })

  it('windowCounts: battles of any status created in the last N days (not test), by the clock', async () => {
    expect(await svc.windowCounts(7)).toEqual({ battles: 3 })
    expect(await svc.windowCounts(1)).toEqual({ battles: 0 })
    expect(await svc.windowCounts(200)).toEqual({ battles: 4 })
  })

  it('hasBattled: a finished or forfeited battle exists for the user', async () => {
    expect(await svc.hasBattled(u1)).toBe(true)
    expect(await svc.hasBattled(u3)).toBe(false)
    expect(await svc.hasBattled('not-an-id')).toBe(false)
  })

  it('a bot side (a real pupil used as a simulated opponent) earns nothing: countFor, hasBattled, windowCounts', async () => {
    const u4 = await user('Pelajar Empat')
    const [row] = await db.query<{ id: string }>(`insert into battles (mode, question_type, status, answered, created_at) values ('quick_match', 'biasa', 'finished', 10, '2026-09-24T10:00:00+08:00') returning id::text`)
    await db.query(`insert into battle_participants (battle_id, side, user_id, correct, is_bot) values ($1, 'A', $2, 5, true), ($1, 'B', $3, 5, false)`, [row!.id, u4, u3])
    const range = { from: new Date('2026-09-01T00:00:00+08:00'), to: new Date('2026-10-01T00:00:00+08:00') }
    const m = await svc.countFor([u3, u4], range)
    expect(m.get(u3)).toEqual({ count: 1, correct: 5, answered: 10 }) // the human side still counts
    expect(m.has(u4)).toBe(false)
    expect(await svc.hasBattled(u4)).toBe(false)
    expect(await svc.hasBattled(u3)).toBe(true)
    // Side A is the bot: the battle is not counted for M17 either.
    expect(await svc.windowCounts(7)).toEqual({ battles: 3 })
  })
})

describe('BattleModule wiring', () => {
  let app: INestApplication
  let db: TestDatabase

  beforeAll(async () => {
    db = await createTestDatabase()
    app = await createTestApp({ modules: [BattleModule], db })
  })
  afterAll(async () => {
    await app.close()
    await db.drop()
  })

  it('resolves the shared providers, the no-op M14 port, and exports the read service', async () => {
    expect(app.get(BattleDeps, { strict: false })).toBeInstanceOf(BattleDeps)
    expect(app.get(BattleReadService, { strict: false })).toBeInstanceOf(BattleReadService)
    const port = app.get<GameResultPort>(GAME_RESULT_PORT, { strict: false })
    await expect(port.onGameResult({ userId: '1', game: 'battle', event: 'win', coins: 0, xp: 0, correct: 1, total: 10, isTest: false })).resolves.toBeUndefined()
  })

  it('the skeleton adds no route: a battle path is still default-deny 401 or 404, never 500', async () => {
    const res = await request(app.getHttpServer()).get('/api/battle/lobby')
    expect([401, 404]).toContain(res.status)
  })
})

describe('BattleDeps reads (empty owner data)', () => {
  let db: TestDatabase
  let app: INestApplication
  let deps: BattleDeps
  beforeAll(async () => {
    db = await createTestDatabase()
    app = await createTestApp({ modules: [BattleModule], db })
    deps = app.get(BattleDeps, { strict: false })
  })
  afterAll(async () => {
    await app.close()
    await db.drop()
  })

  it('answers empty/neutral values on an empty database', async () => {
    expect(await deps.activeStudents()).toEqual([])
    expect(await deps.searchStudents('ab', '1', 10)).toEqual([])
    expect(await deps.student('999')).toBeNull()
    expect(await deps.student('x')).toBeNull()
    expect(await deps.subject('x')).toBeNull()
    expect(await deps.gradeOf('999')).toBeNull()
    expect(await deps.school('999')).toBeNull()
    expect(await deps.arenaQuestion('999')).toBeNull()
    expect(await deps.gradeAnswer('999', 0)).toBeNull()
    expect(await deps.platformAccuracy()).toBe(0)
    expect(deps.pkskDomains()).toEqual([])
    expect(await deps.drawQuestions({ questionType: 'pksk', subjectId: null, levelId: null }, 10, { next: () => 0, int: () => 0, pick: (a) => a[0]! })).toBeNull()
  })
})
