import { GamesSoloSubmitResponseSchema, type GamesSoloGame } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GamificationService } from '../../../src/modules/gamification'
import { ACCOUNTS, bootGamesApp, insertMcqQuestions, loginAs, START, type Client, type GamesTestApp } from '../helpers'
import { itemRows, type DbItem } from './support'

/** D-13: the games rewards port is bound to BE-23 (`games_award_syiling`), seed 0 pays nothing. Real Postgres, real wiring. */
describe('games rewards port bound to GamificationService (D-13)', () => {
  let t: GamesTestApp
  let student: Client
  let student2: Client
  let admin: Client

  const setGames = (v: number) => t.db.query(`update gamification_settings set value = $1 where key = 'games_award_syiling'`, [v])
  /** Game credits only (the seeded wallet history is not ours). */
  const ledger = (userId: string) =>
    t.db.query<{ source: string; source_id: string | null; amount: number; description: string; is_test: boolean }>(
      `select source, source_id, amount, description, is_test from coin_ledger where user_id = $1::bigint and source_id like 'game:%' order by id`,
      [userId],
    )
  const syiling = async (userId: string) =>
    Number((await t.db.query<{ s: number }>(`select coalesce(sum(current_syiling), 0) as s from wallets where user_id = $1::bigint`, [userId]))[0]?.s ?? 0)

  /** Opens betul-salah, answers `flags` (T right, F wrong) and returns the session id. */
  async function play(c: Client, flags: string, query = '?darjah=10'): Promise<string> {
    const game: GamesSoloGame = 'betul-salah'
    const res = await c.get(`/api/games/solo/${game}${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const sessionId = (res.body as { data: { sessionId: string } }).data.sessionId
    const rows: DbItem[] = await itemRows(t.db, sessionId)
    for (const [i, f] of flags.split('').entries()) {
      t.clock.advance(1000)
      const item = rows[i] as DbItem
      const right = f === 'T'
      const r = await c.post(`/api/games/solo/${game}/check`, { session_id: sessionId, item_id: item.question_id, answer: right ? item.statement_true : !item.statement_true })
      expect(r.status, JSON.stringify(r.body)).toBe(200)
    }
    return sessionId
  }
  const submit = (c: Client, sessionId: string) => c.post('/api/games/solo/betul-salah/submit', { session_id: sessionId })

  beforeAll(async () => {
    t = await bootGamesApp({ withGamification: true })
    await insertMcqQuestions(t.db, { subject: 'MATH', level: 'T4', count: 60, prefix: 'R' })
    student = await loginAs(t, ACCOUNTS.student)
    student2 = await loginAs(t, ACCOUNTS.student2)
    admin = await loginAs(t, ACCOUNTS.admin, { mod: true })
  })
  afterAll(async () => {
    await t.close()
  })

  it('binds the adapter once: the port is no longer the never-earning default', async () => {
    expect(t.ports.rewards.constructor.name).toBe('GamesRewardsAdapter')
  })

  it('seed value 0: the submit credits 0, says 0 and writes no ledger row', async () => {
    await setGames(0)
    const before = await syiling(student.userId)
    const id = await play(student, 'TTTFTT')
    const res = await submit(student, id)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(GamesSoloSubmitResponseSchema.parse(res.body)).toMatchObject({ syiling_awarded: 0, correct_count: 5, total_answered: 6 })
    expect(await ledger(student.userId)).toEqual([])
    expect(await syiling(student.userId)).toBe(before)
  })

  it('games_award_syiling = 1: credits the computed coins once, with the M14 wording; a replay never pays twice', async () => {
    await setGames(1)
    const before = await syiling(student.userId)
    const id = await play(student, 'TTTFTT')
    const res = await submit(student, id)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(GamesSoloSubmitResponseSchema.parse(res.body)).toMatchObject({ syiling_awarded: 9, correct_count: 5, total_answered: 6 })
    const rows = await ledger(student.userId)
    expect(rows).toEqual([{ source: 'betul_salah', source_id: `game:${id}`, amount: 9, description: 'Betul/Salah: 5 betul, streak 3', is_test: false }])
    expect(await syiling(student.userId)).toBe(before + 9)
    // a second submit is refused and a direct replay of the same result key adds nothing
    expect((await submit(student, id)).status).toBe(409)
    const again = await t.app.get(GamificationService, { strict: false }).onGameResult(
      student.userId,
      { game: 'betul_salah', event: 'finish', coins: 9, xp: 0, correct: 5, total: 6, detail: { maxStreak: 3 }, key: id },
      { isTest: false },
    )
    expect(again).toEqual({ coinsCredited: 0, xpAdded: 0 })
    expect(await ledger(student.userId)).toHaveLength(1)
    expect(await syiling(student.userId)).toBe(before + 9)
  })

  it('two concurrent submits pay exactly once', async () => {
    await setGames(1)
    const id = await play(student2, 'TT')
    const out = await Promise.all([submit(student2, id), submit(student2, id)])
    expect(out.map((r) => r.status).sort()).toEqual([200, 409])
    expect(await ledger(student2.userId)).toHaveLength(1)
  })

  it('coins disabled for the pupil: nothing is credited even with the setting on', async () => {
    await setGames(1)
    await t.db.query(`update users set is_complimentary = true where id = $1::bigint`, [student2.userId])
    const before = (await ledger(student2.userId)).length
    const id = await play(student2, 'TT')
    const res = await submit(student2, id)
    expect((GamesSoloSubmitResponseSchema.parse(res.body) as { syiling_awarded: number }).syiling_awarded).toBe(0)
    expect((await ledger(student2.userId)).length).toBe(before)
    await t.db.query(`update users set is_complimentary = false where id = $1::bigint`, [student2.userId])
  })

  it('Mod Pelajar (isTest) never earns, through the adapter and through the API', async () => {
    await setGames(1)
    const rewards = t.ports.rewards
    expect(await rewards.onGameResult(student.userId, { game: 'betul_salah', event: 'finish', coins: 9, xp: 5, key: 'mod-x' }, { isTest: true })).toEqual({ coinsCredited: 0, xpAdded: 0 })
    expect((await ledger(student.userId)).some((r) => r.source_id === 'game:mod-x')).toBe(false)
    const id = await play(admin, 'TT')
    const res = await submit(admin, id)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect((GamesSoloSubmitResponseSchema.parse(res.body) as { syiling_awarded: number }).syiling_awarded).toBe(0)
    expect(await ledger(admin.userId)).toEqual([])
  })

  it('Papan Bijak: the rates come from the wallet tier and the credits use the M14 wording', async () => {
    await setGames(1)
    const rewards = t.ports.rewards
    const rates = await rewards.tierRates(student.userId)
    expect(rates.correct).toBeGreaterThan(0)
    expect(rates.win).toBeGreaterThan(rates.correct)
    const u = student2.userId
    const before = await syiling(u)
    const key = `pb-${String(START)}`
    expect((await rewards.onGameResult(u, { game: 'papan_bijak', event: 'correct', xp: 0, key: `${key}-1` }, { isTest: false })).coinsCredited).toBe(rates.correct)
    expect((await rewards.onGameResult(u, { game: 'papan_bijak', event: 'win', xp: 0, key: `${key}-2` }, { isTest: false })).coinsCredited).toBe(rates.win)
    expect(await syiling(u)).toBe(before + rates.correct + rates.win)
    const rows = (await ledger(u)).filter((r) => r.source_id?.startsWith(`game:${key}`))
    expect(rows.map((r) => [r.source, r.description])).toEqual([
      ['papan_bijak', 'Jawab betul dalam Papan Bijak 🎲'],
      ['papan_bijak_win', 'Menang Papan Bijak! 🏆🎲'],
    ])
    await setGames(0)
    expect(await rewards.canEarnSyiling(u)).toBe(false)
    expect((await rewards.onGameResult(u, { game: 'papan_bijak', event: 'win', xp: 0, key: `${key}-3` }, { isTest: false })).coinsCredited).toBe(0)
  })
})
