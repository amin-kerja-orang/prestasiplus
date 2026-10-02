/**
 * M14-T1 with the real neighbours: the full registry boot (core + every module), so the M05 read
 * contract, the M03 subject names and the test hooks run against the real stores. Boots once.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createClock, CLOCK_ANCHOR_ISO } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'

import { dataOf, send, stubStorage } from './helpers'
import {
  gameResult,
  gamificationSession,
  getWallet,
  m14Hooks,
  m14LoadFixture,
  setStreak,
  setTeacherWallet,
  setWallet,
  ledger,
  createDraw,
} from '../../mock/hooks'
import { draws, teacherRewards } from '../../mock'

let runtime: MockRuntime
let admin: string
let pelajar2: string

beforeAll(async () => {
  stubStorage()
  runtime = await bootMock({
    mode: 'test',
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
  admin = setUser(1).token
  pelajar2 = setUser(3).token
}, 120_000)

afterAll(() => vi.unstubAllGlobals())

const get = (url: string, token: string) => send(runtime, 'GET', url, { token })

describe('against the real M05 and M03', () => {
  it('S11 mastery: admin BM L2 "Aktif" 46 / 50 48.94% x1.05, Sejarah L1 "Mula Belajar" 14 / 25 35% (AC-M14-05.3)', async () => {
    const d = dataOf<{ mastery: Record<string, unknown>[] }>(
      await get('/api/gamification/dashboard', admin),
    )
    expect(d.mastery).toMatchObject([
      {
        subjectName: 'Bahasa Melayu',
        level: 2,
        stage: 'Aktif',
        correct: 46,
        nextTarget: 50,
        accuracy: 48.94,
        multiplier: 1.05,
      },
      {
        subjectName: 'Sejarah',
        level: 1,
        stage: 'Mula Belajar',
        correct: 14,
        nextTarget: 25,
        accuracy: 35,
        multiplier: 1,
      },
    ])
  })

  it('S18: admin 119 answers / 38.7% / 4 sessions, ranking 46/119, Penguasaan cards 48.9% and 35%', async () => {
    const d = dataOf<Record<string, unknown>>(await get('/api/gamification/share-cards', admin))
    expect(d).toMatchObject({
      profile: { answered: 119, accuracy: 38.7, sessions: 4 },
      ranking: { accuracy: 38.7, correct: 46, answered: 119 },
    })
    expect(d.mastery).toMatchObject([
      { subjectName: 'Bahasa Melayu', level: 2, stage: 'Aktif', accuracy: 48.9, correct: 46 },
      { subjectName: 'Sejarah', level: 1, stage: 'Mula Belajar', accuracy: 35, correct: 14 },
    ])
  })

  it('S13 for the designed pelajar: 7 of 10 completed (the seeded replay agrees with M05)', async () => {
    const res = await get('/api/gamification/challenges', setUser(2).token)
    expect((res.body as { meta: unknown }).meta).toEqual({ completed: 7, active: 10 })
  })
})

describe('test hooks (§6.14)', () => {
  it('are registered under the SRS names', () => {
    const m14 = runtime.plugins.find((p) => p.id === 'M14')
    expect(Object.keys(m14?.hooks ?? {}).sort()).toEqual(Object.keys(m14Hooks).sort())
    expect(Object.keys(m14Hooks).sort()).toEqual(
      [
        'createDraw',
        'gameResult',
        'gamificationSession',
        'getWallet',
        'ledger',
        'm14LoadFixture',
        'setStreak',
        'setTeacherWallet',
        'setWallet',
      ].sort(),
    )
  })

  it('gamificationSession runs M05 addSession then onSessionCompleted: coins by BR-M14-03, XP, streak, ledger, S13', async () => {
    const r = gamificationSession(3, { mode: 'random', correct: 5, total: 10, timeSpentSec: 120 })
    expect(r).toMatchObject({ coinsEarned: 5, pointsEarned: 50, streakCount: 1 })
    expect(typeof r.sessionId).toBe('string')
    const w = dataOf<{ currentSyiling: number; xp: number }>(
      await get('/api/gamification/wallet', pelajar2),
    )
    expect(w.currentSyiling).toBeGreaterThanOrEqual(5)
    expect(w.currentSyiling).toBe(r.totalBalance)
    expect(w.xp).toBeGreaterThanOrEqual(50)
    const rows = dataOf<{ description: string; amount: number }[]>(
      await get('/api/gamification/transactions', pelajar2),
    )
    expect(rows.some((x) => x.description === 'Latih Tubi: 5 betul — 50%' && x.amount === 5)).toBe(
      true,
    )
    const ch = await get('/api/gamification/challenges', pelajar2)
    expect((ch.body as { meta: { completed: number } }).meta.completed).toBeGreaterThanOrEqual(1)
  })

  it('validates its input at the call', () => {
    expect(() =>
      gamificationSession(3, { mode: 'nope', correct: 1, total: 1, timeSpentSec: 1 }),
    ).toThrow(RangeError)
    expect(() =>
      gamificationSession(3, { mode: 'random', correct: 2, total: 1, timeSpentSec: 1 }),
    ).toThrow(RangeError)
    expect(() =>
      gamificationSession(99_999_999, { mode: 'random', correct: 1, total: 1, timeSpentSec: 1 }),
    ).toThrow(RangeError)
    expect(() => setWallet(3, { syiling: -1 })).toThrow(RangeError)
    expect(() => setWallet(3, { tierKey: 'nope' })).toThrow(RangeError)
    expect(() => ledger(3, { type: 'zzz' as 'earn' })).toThrow(RangeError)
    expect(() => setStreak(3, { current: 5, best: 2, lastActivityDate: null })).toThrow(RangeError)
    expect(() => setTeacherWallet(5, { balance: -5 })).toThrow(RangeError)
    expect(() => createDraw({ title: '', closesAt: '2026-09-30' })).toThrow(TypeError)
    expect(() => createDraw({ title: 'x', closesAt: '30/09' })).toThrow(RangeError)
    expect(() => gameResult(3, { game: '', event: 'x', xp: 1 })).toThrow(TypeError)
    expect(() => m14LoadFixture('nope' as 'm14-cash-flow')).toThrow(RangeError)
  })

  it('setWallet sets fields without a ledger row; getWallet and ledger read them back', () => {
    const rows = ledger(3).length
    const s = setWallet(3, { syiling: 1234, tokens: -2, xp: 10, level: 4, tierKey: 'silver' })
    expect(s).toMatchObject({
      currentSyiling: 1234,
      tokenBalance: -2,
      xp: 10,
      level: 4,
      tier: { key: 'silver' },
    })
    expect(getWallet(3)).toEqual(s)
    expect(ledger(3)).toHaveLength(rows)
    expect(ledger(3, { type: 'bonus' })).toEqual([])
  })

  it('setStreak and setTeacherWallet set the stored values', () => {
    expect(setStreak(3, { current: 4, best: 9, lastActivityDate: '2026-09-25' })).toMatchObject({
      current: 4,
      best: 9,
      lastActivityDate: '2026-09-25',
    })
    expect(setTeacherWallet(5, { balance: 77, questionsCount: 3 })).toMatchObject({
      balance: 77,
      questionsCount: 3,
    })
  })

  it('gameResult: XP always, syiling only while games_award_syiling is on', async () => {
    expect(gameResult(3, { game: 'papan_bijak', event: 'correct', xp: 3 })).toEqual({
      coinsCredited: 0,
      xpAdded: 3,
    })
    await send(runtime, 'PUT', '/api/admin/reward-control/settings', {
      token: admin,
      body: { gamesAwardSyiling: 1 },
    })
    expect(gameResult(3, { game: 'papan_bijak', event: 'correct', xp: 3 })).toEqual({
      coinsCredited: 5,
      xpAdded: 3,
    })
    await send(runtime, 'PUT', '/api/admin/reward-control/settings', {
      token: admin,
      body: { gamesAwardSyiling: 0 },
    })
  })

  it('createDraw and m14LoadFixture: the open draw is listed for M15, the teacher reward 1001 exists', () => {
    const d = m14LoadFixture('m14-draw-open')
    expect(d).toMatchObject({
      title: 'Cabutan Demo',
      ticketCostSyiling: 50,
      maxTicketsPerStudent: 10,
      status: 'open',
      closesAt: '2026-09-30',
    })
    expect(draws.listOpenDraws('2026-09-25').map((x) => x.title)).toContain('Cabutan Demo')
    expect(m14LoadFixture('m14-teacher-reward')).toMatchObject({
      id: 1001,
      name: 'Baucar Buku RM20',
      costCoins: 200,
      stock: 5,
      maxPerUser: 1,
    })
    expect(teacherRewards.list({ activeOnly: true }).map((r) => r.id)).toContain(1001)
    expect(m14LoadFixture('m14-cash-flow')).toBeNull()
    expect(createDraw({ title: 'Draf', closesAt: '2026-10-01' }).status).toBe('draft')
  })
})
