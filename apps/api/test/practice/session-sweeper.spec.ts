import { randomUUID } from 'node:crypto'

import type { ConfigService } from '@nestjs/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { PracticeRepository } from '../../src/modules/practice/practice.repository'
import { DEFAULT_PRACTICE_SWEEP_MS, PRACTICE_IDLE_MS, PracticeSessionSweeper, SWEEP_BATCH, SWEEP_MAX_ITERATIONS } from '../../src/modules/practice/session-sweeper.service'
import { type Client, type PracticeTestApp, type World, START, bootPracticeApp, checkAnswer, countRows, fillBank, loadWorld, loginAs, resetPractice, startSession, userIdByEmail } from './helpers'

let t: PracticeTestApp
let w: World
let sweeper: PracticeSessionSweeper
let pelajar: Client
let uid: string
let bank: ReturnType<typeof fillBank>
const T0 = new Date('2026-10-19T00:00:00Z')
const hours = (n: number): Date => new Date(T0.getTime() + n * 3_600_000)

beforeAll(async () => {
  t = await bootPracticeApp()
  w = await loadWorld(t.db)
  sweeper = t.app.get(PracticeSessionSweeper)
  pelajar = await loginAs(t, 'pelajar@demo.test')
  uid = await userIdByEmail(t.db, 'pelajar@demo.test')
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  t.clock.set(START)
  await resetPractice(t.db)
  t.bank.reset()
  bank = fillBank(t.bank, w)
  t.reward.calls.length = 0
})

async function session(status: 'in_progress' | 'completed', startedAt: Date): Promise<string> {
  const id = randomUUID()
  await t.db.query(
    `insert into practice_sessions (id, user_id, mode, question_count, status, started_at, completed_at) values ($1, $2, 'latih_tubi', 5, $3, $4, $5)`,
    [id, uid, status, startedAt, status === 'completed' ? startedAt : null],
  )
  return id
}

async function check(sessionId: string, questionId: string, at: Date): Promise<void> {
  await t.db.query(
    `insert into practice_checks (session_id, user_id, question_id, question_version_no, selected_label, is_correct, checked_at, seq) values ($1, $2, $3, 1, 'A', true, $4, 1)`,
    [sessionId, uid, questionId, at],
  )
}

const statusOf = async (id: string) => (await t.db.query<{ status: string; completed_at: Date | null }>('select status, completed_at from practice_sessions where id = $1', [id]))[0]

describe('sweep', () => {
  it('abandons a session idle for more than 2 h, keeping its checks and writing nothing else', async () => {
    const idle = await session('in_progress', hours(0))
    await check(idle, bank.random[0] as string, hours(0.5))
    const none = await session('in_progress', hours(0))
    expect(await sweeper.sweep(hours(2.6))).toBe(2)
    expect(await statusOf(idle)).toEqual({ status: 'abandoned', completed_at: null })
    expect((await statusOf(none))?.status).toBe('abandoned')
    expect(await countRows(t.db, 'practice_checks', 'session_id = $1', [idle])).toBe(1)
    expect(await countRows(t.db, 'practice_answers')).toBe(0)
    expect(t.reward.calls).toHaveLength(0)
  })

  it('the threshold is 2 h from the last activity', async () => {
    const edge = await session('in_progress', hours(0))
    expect(await sweeper.sweep(new Date(T0.getTime() + PRACTICE_IDLE_MS))).toBe(0)
    expect((await statusOf(edge))?.status).toBe('in_progress')
    expect(await sweeper.sweep(new Date(T0.getTime() + PRACTICE_IDLE_MS + 1))).toBe(1)
  })

  it('a recent check keeps an old session in progress', async () => {
    const live = await session('in_progress', hours(0))
    await check(live, bank.random[0] as string, hours(2.5))
    expect(await sweeper.sweep(hours(3))).toBe(0)
    expect((await statusOf(live))?.status).toBe('in_progress')
    expect(await sweeper.sweep(hours(4.6))).toBe(1)
  })

  it('leaves a completed session untouched and a second pass changes nothing', async () => {
    const done = await session('completed', hours(0))
    const idle = await session('in_progress', hours(0))
    expect(await sweeper.sweep(hours(5))).toBe(1)
    expect(await sweeper.sweep(hours(6))).toBe(0)
    expect((await statusOf(done))?.status).toBe('completed')
    expect((await statusOf(idle))?.status).toBe('abandoned')
  })

  it('an abandoned session is not in the history (repo and GET /practice/sessions)', async () => {
    const started = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    const q = started.questions[0]?.id as string
    expect((await checkAnswer(pelajar, started.sessionId, t.bank, q, true)).status).toBe(200)
    const done = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    for (const x of done.questions) await checkAnswer(pelajar, done.sessionId, t.bank, x.id, true)
    expect((await pelajar.post(`/api/practice/sessions/${done.sessionId}/submit`, { timeSpent: 10 })).status).toBe(200)
    t.reward.calls.length = 0

    expect(await sweeper.sweep(new Date(new Date(START).getTime() + 3 * 3_600_000))).toBe(1)
    expect((await statusOf(started.sessionId))?.status).toBe('abandoned')
    expect(t.reward.calls).toHaveLength(0)
    expect(await countRows(t.db, 'practice_checks', 'session_id = $1', [started.sessionId])).toBe(1)

    const list = await pelajar.get('/api/practice/sessions?modes=random')
    expect(list.body.data.map((r: { id: string }) => r.id)).toEqual([done.sessionId])
    const repo = t.app.get(PracticeRepository)
    expect((await repo.history(uid, { modes: ['random'] })).map((s) => s.id)).toEqual([done.sessionId])
    expect(await repo.historyCount(uid, { modes: ['random'] })).toBe(1)
  })

  it('one pass loops full batches until a short one and sums them', async () => {
    const calls: number[] = []
    const answers = [500, 500, 120]
    const fake = new PracticeSessionSweeper({ abandonIdle: (_c: Date, limit: number) => (calls.push(limit), Promise.resolve(answers.shift() ?? 0)) } as unknown as PracticeRepository, cfg({}))
    expect(await fake.sweep()).toBe(1120)
    expect(calls).toEqual([500, 500, 500])
  })

  it('a pass stops after 20 rounds even when every batch is full', async () => {
    let n = 0
    const fake = new PracticeSessionSweeper({ abandonIdle: () => (n++, Promise.resolve(SWEEP_BATCH)) } as unknown as PracticeRepository, cfg({}))
    expect(await fake.sweep()).toBe(SWEEP_BATCH * SWEEP_MAX_ITERATIONS)
    expect(n).toBe(20)
  })

  it('never throws: a failing statement is logged and returns 0', async () => {
    const broken = new PracticeSessionSweeper({ abandonIdle: () => Promise.reject(new Error('db down')) } as unknown as PracticeRepository, cfg({}))
    await expect(broken.sweep()).resolves.toBe(0)
  })
})

const cfg = (env: Record<string, string | undefined>): ConfigService => ({ get: (k: string) => env[k] }) as unknown as ConfigService

describe('timer', () => {
  const repo = {} as PracticeRepository
  it('is off under NODE_ENV=test and with 0', () => {
    for (const env of [{ NODE_ENV: 'test' }, { NODE_ENV: 'production', PRACTICE_SWEEP_INTERVAL_MS: '0' }, { NODE_ENV: 'test', PRACTICE_SWEEP_INTERVAL_MS: '' }]) {
      const s = new PracticeSessionSweeper(repo, cfg(env))
      s.onModuleInit()
      expect(s.active, JSON.stringify(env)).toBe(false)
    }
  })

  it('is armed by an explicit period or by the 5 minute default outside test, and onModuleDestroy clears it', () => {
    for (const env of [{ NODE_ENV: 'test', PRACTICE_SWEEP_INTERVAL_MS: '60000' }, { NODE_ENV: 'production' }]) {
      const s = new PracticeSessionSweeper(repo, cfg(env))
      s.onModuleInit()
      expect(s.active, JSON.stringify(env)).toBe(true)
      s.onModuleDestroy()
      expect(s.active).toBe(false)
    }
    expect(DEFAULT_PRACTICE_SWEEP_MS).toBe(300_000)
  })

  it('the Nest app under test has no timer', () => {
    expect(sweeper.active).toBe(false)
  })
})
