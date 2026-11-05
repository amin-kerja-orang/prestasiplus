import { GamificationDrawSchema, GamificationEconomySettingsSchema, GamificationRewardControlSchema, GamificationSettingsListSchema, GamificationSyilingRewardSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { mytDay } from '../../src/db/clock'
import { NotificationsService } from '../../src/modules/notifications'
import { RewardSettingsService } from '../../src/modules/shop'
import { BOX_RANDOM, CsprngBoxRandom, SeededBoxRandom } from '../../src/modules/shop/box-random'
import { pickWinners } from '../../src/modules/shop/draw-winners.service'
import { WalletService } from '../../src/modules/wallet'
import { ADMIN, STUDENT_MAJU, bareUser, bootGamificationApp, dataOf, fail, signIn, userIdOf, walletOf, type Client, type GamificationTestApp } from './helpers'

const KEYS = ['coins_per_question', 'cash_rate_coins', 'cash_rate_sen', 'min_cash_withdrawal', 'cash_withdrawal_enabled', 'reward_budget_sen_session', 'reward_budget_sen_month', 'current_session_year', 'flat_quiz_reward', 'games_award_syiling']
const SUMMARY = 'Sila lengkapkan semua medan wajib.'
const POOL_MSG = 'Format JSON kolam hadiah tidak sah.'
const POOL = [{ label: 'Hadiah', valueSen: 100, qty: 1 }]

describe('M14 admin operations: settings, reward control, lucky draws (BE-23, AC4, AC5, AC9)', () => {
  let t: GamificationTestApp
  let admin: Client

  const settingRow = async (key: string) => Number((await t.db.query<{ v: string }>(`select value::text v from gamification_settings where key = $1`, [key]))[0]!.v)
  const rewardRow = async () => (await t.db.query<{ coins_per_correct: number; redeem_budget_sen: number; session_year: number; mini_games_give_coins: boolean; updated_by: string | null }>(`select coins_per_correct, redeem_budget_sen, session_year, mini_games_give_coins, updated_by::text from reward_settings`))[0]!
  const prizeRows = (drawId: string) => t.db.query<{ label: string; value_sen: number; qty: number; position: number }>(`select label, value_sen, qty, position from draw_prizes where draw_id = $1 order by position`, [drawId])
  const auditCount = async (action: string) => Number((await t.db.query<{ n: string }>(`select count(*)::text n from audit_events where action = $1`, [action]))[0]!.n)

  beforeAll(async () => {
    t = await bootGamificationApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '1000' } })
    admin = await signIn(t, ADMIN)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  describe('settings (S9)', () => {
    it('GET answers all ten rows in the S9 order with the toggle kinds and the stored labels', async () => {
      const list = GamificationSettingsListSchema.parse(dataOf(await admin.get('/admin/gamification/settings')))
      expect(list.map((s) => s.key)).toEqual(KEYS)
      expect(list.filter((s) => s.kind === 'toggle').map((s) => s.key)).toEqual(['cash_withdrawal_enabled', 'games_award_syiling'])
      expect(list.find((s) => s.key === 'cash_rate_sen')).toMatchObject({ value: 8, label: 'Nilai sen bagi setiap unit syiling (cth: 10 syiling = 8 sen)' })
      expect(list.find((s) => s.key === 'current_session_year')!.value).toBe(2026)
    })

    it('PUT changes only the posted keys and answers all ten; audited', async () => {
      const before = await auditCount('gamification.settings.updated')
      const res = await admin.put('/admin/gamification/settings', { settings: [{ key: 'min_cash_withdrawal', value: 150 }, { key: 'games_award_syiling', value: '1' }] })
      expect(res.status).toBe(200)
      const list = GamificationSettingsListSchema.parse(dataOf(res))
      expect(list).toHaveLength(10)
      expect(list.find((s) => s.key === 'min_cash_withdrawal')!.value).toBe(150)
      expect(list.find((s) => s.key === 'games_award_syiling')!.value).toBe(1)
      expect(list.find((s) => s.key === 'cash_rate_sen')!.value).toBe(8)
      expect(await auditCount('gamification.settings.updated')).toBe(before + 1)
      await admin.put('/admin/gamification/settings', { settings: [{ key: 'min_cash_withdrawal', value: 100 }, { key: 'games_award_syiling', value: 0 }] })
    })

    it('422: nothing posted, a missing key, a non-integer value (per field); unknown key, a negative value or a toggle above 1 (fields.settings); one bad item saves nothing', async () => {
      fail(await admin.put('/admin/gamification/settings', {}), 422, 'VALIDATION_ERROR', SUMMARY)
      expect(fail(await admin.put('/admin/gamification/settings', { settings: [] }), 422, 'VALIDATION_ERROR').fields).toEqual({ settings: 'Medan ini diperlukan.' })
      expect(fail(await admin.put('/admin/gamification/settings', { settings: [{ value: 1 }, { key: 'flat_quiz_reward', value: 'x' }] }), 422, 'VALIDATION_ERROR').fields).toEqual({ 'settings.0.key': 'Medan ini diperlukan.', 'settings.1.value': 'Medan ini tidak sah.' })
      for (const bad of [{ key: 'nope', value: 1 }, { key: 'flat_quiz_reward', value: -1 }, { key: 'cash_withdrawal_enabled', value: 2 }]) {
        const err = fail(await admin.put('/admin/gamification/settings', { settings: [{ key: 'flat_quiz_reward', value: 7 }, bad] }), 422, 'VALIDATION_ERROR', SUMMARY)
        expect(err.fields).toEqual({ settings: SUMMARY })
      }
      expect((await rewardRow()).coins_per_correct).toBe(1)
    })

    it('the four reward_settings keys are read from and written to that row; their old rows stay as they were (S7-T05)', async () => {
      const res = await admin.put('/admin/gamification/settings', { settings: [{ key: 'flat_quiz_reward', value: 7 }, { key: 'games_award_syiling', value: 1 }] })
      const list = GamificationSettingsListSchema.parse(dataOf(res))
      expect(list.find((s) => s.key === 'flat_quiz_reward')!.value).toBe(7)
      expect(list.find((s) => s.key === 'games_award_syiling')!.value).toBe(1)
      expect(list.find((s) => s.key === 'reward_budget_sen_session')!.value).toBe(300)
      expect(await rewardRow()).toMatchObject({ coins_per_correct: 7, mini_games_give_coins: true })
      expect(await settingRow('flat_quiz_reward')).toBe(1)
      expect(await settingRow('games_award_syiling')).toBe(0)
      expect(await settingRow('reward_budget_sen_session')).toBe(1000)
      for (const bad of [{ key: 'flat_quiz_reward', value: 21 }, { key: 'reward_budget_sen_session', value: 100_001 }, { key: 'current_session_year', value: 2019 }, { key: 'games_award_syiling', value: 2 }]) {
        expect(fail(await admin.put('/admin/gamification/settings', { settings: [bad] }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ settings: SUMMARY })
      }
      await admin.put('/admin/gamification/settings', { settings: [{ key: 'flat_quiz_reward', value: 1 }, { key: 'games_award_syiling', value: 0 }] })
    })

    it('two admins saving different keys keep both: a save writes only its posted columns; before and after stay for the audit (S7-T05)', async () => {
      const service = t.app.get(RewardSettingsService)
      const adminId = await userIdOf(t.db, ADMIN)
      const at = new Date()
      const read = service.read.bind(service)
      // The other admin commits between this save's read and its write, the window of a stale read.
      const spy = vi.spyOn(service, 'read').mockImplementationOnce(async (db) => {
        const stale = await read(db)
        await t.prisma.transaction((tx) => service.save(tx, [{ key: 'reward_budget_sen_session', value: 500 }], adminId, at))
        return stale
      })
      const { before, after } = await t.prisma.transaction((tx) => service.save(tx, [{ key: 'flat_quiz_reward', value: 5 }], adminId, at))
      spy.mockRestore()
      expect(await rewardRow()).toMatchObject({ coins_per_correct: 5, redeem_budget_sen: 500, updated_by: adminId })
      expect(before).toMatchObject({ coinsPerCorrect: 1, redeemBudgetSen: 300 })
      expect(after).toMatchObject({ coinsPerCorrect: 5, redeemBudgetSen: 500 })
      await admin.put('/admin/gamification/settings', { settings: [{ key: 'flat_quiz_reward', value: 1 }, { key: 'reward_budget_sen_session', value: 300 }] })
    })
  })

  describe('reward control (S10)', () => {
    it('GET: tiles (RM0.00 / 0 / 0 for the session year), the five shared settings, 11 rewards with costRm, the sample draw with its ordered pool', async () => {
      const d = GamificationRewardControlSchema.parse(dataOf(await admin.get('/admin/reward-control')))
      expect(d.tiles).toEqual({ sessionYear: 2026, liabilityRm: 0, students: 0, claims: 0 })
      expect(d.settings).toEqual({ rewardBudgetSenSession: 300, rewardBudgetSenMonth: 300, flatQuizReward: 1, currentSessionYear: 2026, gamesAwardSyiling: 0, redeemBudget: 300, flatCoins: 1, sessionYear: 2026, miniGamesCoins: false })
      expect(d.rewards).toHaveLength(11)
      expect(d.rewards.every((r) => r.costRm === r.costValueSen / 100 && r.type === r.type.toUpperCase())).toBe(true)
      expect(d.draws).toHaveLength(1)
      expect(d.draws[0]).toMatchObject({ title: 'Cabutan Demo', status: 'open', ticketCostSyiling: 50, maxTicketsPerStudent: 10, ticketsSold: 0, prizePool: [{ label: 'Hadiah Demo', valueSen: 1000, qty: 1 }, { label: 'Baucar RM5', valueSen: 500, qty: 10 }] })
    })

    it('the claim tiles sum the claims of the session year (cost snapshot, distinct students) and follow current_session_year', async () => {
      const reward = (await t.db.query<{ id: string }>(`select id::text from syiling_rewards order by id limit 1`))[0]!.id
      const a = await bareUser(t, 'Tuntut Satu')
      const b = await bareUser(t, 'Tuntut Dua')
      for (const [u, sen, at] of [[a, 250, '2026-03-01T10:00:00+08:00'], [a, 150, '2026-12-31T23:30:00+08:00'], [b, 300, '2026-07-01T10:00:00+08:00'], [b, 999, '2025-12-31T23:59:00+08:00'], [b, 888, '2027-01-01T00:00:00+08:00']] as const) {
        await t.db.query(`insert into reward_claims (user_id, reward_id, cost_value_sen, claimed_at) values ($1, $2, $3, $4)`, [u, reward, sen, at])
      }
      expect((await GamificationRewardControlSchema.parse(dataOf(await admin.get('/admin/reward-control')))).tiles).toEqual({ sessionYear: 2026, liabilityRm: 7, students: 2, claims: 3 })
      await admin.put('/admin/reward-control/settings', { currentSessionYear: 2027 })
      expect(GamificationRewardControlSchema.parse(dataOf(await admin.get('/admin/reward-control'))).tiles).toEqual({ sessionYear: 2027, liabilityRm: 8.88, students: 1, claims: 1 })
      await admin.put('/admin/reward-control/settings', { currentSessionYear: 2026 })
    })

    it('PUT settings: the five shared keys (camelCase or snake_case), only the posted ones change, the S9 list sees them', async () => {
      const res = await admin.put('/admin/reward-control/settings', { flatQuizReward: '2', reward_budget_sen_month: 400, currentSessionYear: '', gamesAwardSyiling: null })
      expect(res.status).toBe(200)
      expect(GamificationEconomySettingsSchema.parse(dataOf(res))).toEqual({ rewardBudgetSenSession: 300, rewardBudgetSenMonth: 400, flatQuizReward: 2, currentSessionYear: 2026, gamesAwardSyiling: 0, redeemBudget: 300, flatCoins: 2, sessionYear: 2026, miniGamesCoins: false })
      const s9 = GamificationSettingsListSchema.parse(dataOf(await admin.get('/admin/gamification/settings')))
      expect(s9.find((s) => s.key === 'flat_quiz_reward')!.value).toBe(2)
      await admin.put('/admin/reward-control/settings', { flat_quiz_reward: 1, rewardBudgetSenMonth: 300 })
    })

    it('PUT settings: the four API-ADM-16 names write reward_settings with updated_by and audit before and after; a new name wins over an older one (S7-T05)', async () => {
      const res = await admin.put('/admin/reward-control/settings', { redeemBudget: 500, flatCoins: 3, flatQuizReward: 9, sessionYear: 2027, miniGamesCoins: true })
      expect(res.status).toBe(200)
      expect(GamificationEconomySettingsSchema.parse(dataOf(res))).toEqual({ rewardBudgetSenSession: 500, rewardBudgetSenMonth: 300, flatQuizReward: 3, currentSessionYear: 2027, gamesAwardSyiling: 1, redeemBudget: 500, flatCoins: 3, sessionYear: 2027, miniGamesCoins: true })
      const row = await rewardRow()
      expect(row).toMatchObject({ coins_per_correct: 3, redeem_budget_sen: 500, session_year: 2027, mini_games_give_coins: true })
      const [audit] = await t.db.query<{ actor_user_id: string; detail: Record<string, unknown> }>(`select actor_user_id::text, detail from audit_events where action = 'gamification.settings.updated' order by id desc limit 1`)
      expect(row.updated_by).toBe(audit!.actor_user_id)
      expect(audit!.detail).toMatchObject({
        before: { coinsPerCorrect: 1, redeemBudgetSen: 300, sessionYear: 2026, miniGamesGiveCoins: false },
        after: { coinsPerCorrect: 3, redeemBudgetSen: 500, sessionYear: 2027, miniGamesGiveCoins: true },
      })
      await admin.put('/admin/reward-control/settings', { redeemBudget: 300, flatCoins: 1, sessionYear: 2026, miniGamesCoins: false })
    })

    it('PUT settings accepts the inclusive bounds; a value outside its range is 422 with the message of its P09 row and saves nothing (S7-T05)', async () => {
      for (const body of [{ flatCoins: 0 }, { flatCoins: 20 }, { redeemBudget: 0 }, { redeemBudget: 100_000 }, { sessionYear: 2020 }, { sessionYear: 2100 }]) expect((await admin.put('/admin/reward-control/settings', body)).status).toBe(200)
      await admin.put('/admin/reward-control/settings', { redeemBudget: 300, flatCoins: 1, sessionYear: 2026 })
      const fieldsOf = async (body: object) => fail(await admin.put('/admin/reward-control/settings', body), 422, 'VALIDATION_ERROR', SUMMARY).fields
      expect(await fieldsOf({ flatCoins: 21 })).toEqual({ flatCoins: 'Nilai mesti antara 0 dan 20.' })
      expect(await fieldsOf({ flatCoins: -1 })).toEqual({ flatCoins: 'Nilai mesti antara 0 dan 20.' })
      expect(await fieldsOf({ redeemBudget: 100_001 })).toEqual({ redeemBudget: 'Bajet tidak sah.' })
      expect(await fieldsOf({ sessionYear: 2101 })).toEqual({ sessionYear: 'Tahun tidak sah.' })
      expect(await fieldsOf({ miniGamesCoins: 'x' })).toEqual({ miniGamesCoins: 'Medan ini tidak sah.' })
      expect(await fieldsOf({ flatCoins: 5, redeemBudget: -1 })).toEqual({ redeemBudget: 'Bajet tidak sah.' })
      expect(await rewardRow()).toMatchObject({ coins_per_correct: 1, redeem_budget_sen: 300, session_year: 2026, mini_games_give_coins: false })
    })

    it('a removed row reads as the DM-48 defaults and the next save puts it back (S7-T05)', async () => {
      await t.db.query('delete from reward_settings')
      expect(GamificationRewardControlSchema.parse(dataOf(await admin.get('/admin/reward-control'))).settings).toMatchObject({ redeemBudget: 300, flatCoins: 1, sessionYear: 2026, miniGamesCoins: false })
      await admin.put('/admin/reward-control/settings', { flatCoins: 1 })
      expect(await rewardRow()).toMatchObject({ coins_per_correct: 1, redeem_budget_sen: 300, session_year: 2026, mini_games_give_coins: false })
    })

    it('PUT settings 422: a non-integer is fields[<camelName>], nothing posted is fields.settings, a negative that stays in gamification_settings is 422 without fields', async () => {
      expect(fail(await admin.put('/admin/reward-control/settings', { flatQuizReward: 'abc', rewardBudgetSenMonth: 1.5 }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ flatQuizReward: 'Medan ini tidak sah.', rewardBudgetSenMonth: 'Medan ini tidak sah.' })
      expect(fail(await admin.put('/admin/reward-control/settings', {}), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ settings: 'Medan ini diperlukan.' })
      expect(fail(await admin.put('/admin/reward-control/settings', { rewardBudgetSenMonth: -1 }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toBeUndefined()
      expect(fail(await admin.put('/admin/reward-control/settings', { gamesAwardSyiling: 5 }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ gamesAwardSyiling: 'Medan ini tidak sah.' })
      expect((await rewardRow()).mini_games_give_coins).toBe(false)
    })

    it('PUT rewards/:id/cost saves the real cost and RM follows; 422 for negative or non-integer, 404 for an unknown or non-numeric id', async () => {
      const id = (await t.db.query<{ id: string }>(`select id::text from syiling_rewards order by id limit 1`))[0]!.id
      const res = await admin.put(`/admin/reward-control/rewards/${id}/cost`, { costValueSen: '1250' })
      expect(res.status).toBe(200)
      expect(GamificationSyilingRewardSchema.parse(dataOf(res))).toMatchObject({ id, costValueSen: 1250, costRm: 12.5 })
      expect(await auditCount('gamification.reward_cost.updated')).toBe(1)
      fail(await admin.put(`/admin/reward-control/rewards/${id}/cost`, { costValueSen: -1 }), 422, 'VALIDATION_ERROR', SUMMARY)
      fail(await admin.put(`/admin/reward-control/rewards/${id}/cost`, { costValueSen: 1.5 }), 422, 'VALIDATION_ERROR', SUMMARY)
      fail(await admin.put(`/admin/reward-control/rewards/${id}/cost`, {}), 422, 'VALIDATION_ERROR', SUMMARY)
      fail(await admin.put('/admin/reward-control/rewards/999999/cost', { costValueSen: 5 }), 404, 'NOT_FOUND', 'Hadiah tidak dijumpai.')
      fail(await admin.put('/admin/reward-control/rewards/abc/cost', { costValueSen: 5 }), 404, 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
    })
  })

  describe('POST /admin/reward-control/draws (AC5, AC9)', () => {
    const body = { title: '  Cabutan Hari Raya ', description: 'Menang besar', ticketCostSyiling: 20, maxTicketsPerStudent: 5, closesAt: '2026-12-31' }

    it('creates a draft, with the pool stored as ORDERED draw_prizes rows and returned as prizePool[] in the mock shape', async () => {
      const prizePool = [{ label: 'Basikal', valueSen: 50_000, qty: 1 }, { label: 'Baucar RM10', value_sen: 1000, qty: 3 }, { label: 'Pen', valueSen: 0, qty: 20 }]
      const res = await admin.post('/admin/reward-control/draws', { ...body, prizePool })
      expect(res.status).toBe(201)
      const d = GamificationDrawSchema.parse(dataOf(res))
      expect(d).toMatchObject({ title: 'Cabutan Hari Raya', description: 'Menang besar', ticketCostSyiling: 20, maxTicketsPerStudent: 5, status: 'draft', closesAt: '2026-12-31', ticketsSold: 0 })
      expect(d.prizePool).toEqual([{ label: 'Basikal', valueSen: 50_000, qty: 1 }, { label: 'Baucar RM10', valueSen: 1000, qty: 3 }, { label: 'Pen', valueSen: 0, qty: 20 }])
      expect(await prizeRows(d.id)).toEqual([{ label: 'Basikal', value_sen: 50_000, qty: 1, position: 0 }, { label: 'Baucar RM10', value_sen: 1000, qty: 3, position: 1 }, { label: 'Pen', value_sen: 0, qty: 20, position: 2 }])
      expect(await auditCount('gamification.draw.created')).toBe(1)
      // the list shows it first (newest first) with the same pool
      const list = GamificationRewardControlSchema.parse(dataOf(await admin.get('/admin/reward-control'))).draws
      expect(list[0]!.id).toBe(d.id)
    })

    it('"Buka serta-merta" opens it; the pool may be the JSON text of the live form; no closing date is allowed; the closing day stays the day shown', async () => {
      const open = GamificationDrawSchema.parse(dataOf(await admin.post('/admin/reward-control/draws', { ...body, openNow: true, prizePool: '[{"label":"A","value_sen":100,"qty":2}]' })))
      expect(open).toMatchObject({ status: 'open', prizePool: [{ label: 'A', valueSen: 100, qty: 2 }], closesAt: '2026-12-31' })
      const stored = (await t.db.query<{ c: string }>(`select closes_at::text c from draws where id = $1`, [open.id]))[0]!.c
      expect(Date.parse(stored)).toBe(Date.parse('2026-12-31T23:59:59.999+08:00')) // the end of that Malaysia day
      const bare = GamificationDrawSchema.parse(dataOf(await admin.post('/admin/reward-control/draws', { title: 'Tanpa Tarikh', ticketCostSyiling: 1, maxTicketsPerStudent: 1, openNow: 'on', prizePool: [{ label: 'A', valueSen: 0, qty: 1 }] })))
      expect(bare).toMatchObject({ status: 'open', prizePool: [{ label: 'A', valueSen: 0, qty: 1 }], closesAt: null, description: '' })
    })

    it('422: invalid JSON, a non-array pool and a pool line the table would refuse are "Format JSON kolam hadiah tidak sah." with fields.prizePool', async () => {
      for (const prizePool of ['not json', '{"a":1}', 'null1', [{ label: 'X', valueSen: -1, qty: 1 }], [{ label: 'X', valueSen: 5, qty: 0 }], [{ label: 'X', valueSen: 5.5, qty: 1 }], [{ valueSen: 5, qty: 1 }], [{ label: 'X', valueSen: 5, qty: 'a' }], 'x', 7]) {
        const err = fail(await admin.post('/admin/reward-control/draws', { ...body, prizePool }), 422, 'VALIDATION_ERROR', POOL_MSG)
        expect(err.fields).toEqual({ prizePool: POOL_MSG })
      }
      fail(await admin.post('/admin/reward-control/draws', { ...body, prizePool: Array.from({ length: 101 }, () => ({ label: 'X', valueSen: 1, qty: 1 })) }), 422, 'VALIDATION_ERROR', POOL_MSG)
    })

    it('422: a missing title, cost or limit, a malformed date and a date that does not exist', async () => {
      const err = fail(await admin.post('/admin/reward-control/draws', { description: 'x'.repeat(1001), ticketCostSyiling: 0, closesAt: '31/12/2026' }), 422, 'VALIDATION_ERROR', SUMMARY)
      expect(err.fields).toEqual({ title: 'Tajuk diperlukan.', description: 'Medan ini tidak sah.', ticketCostSyiling: 'Harga tiket tidak sah.', maxTicketsPerStudent: 'Medan ini diperlukan.', closesAt: 'Medan ini tidak sah.', prizePool: 'Hadiah diperlukan.' })
      expect(fail(await admin.post('/admin/reward-control/draws', { ...body, prizePool: POOL, closesAt: '2026-02-31' }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ closesAt: 'Medan ini tidak sah.' })
      expect(fail(await admin.post('/admin/reward-control/draws', { ...body, prizePool: POOL, title: '   ' }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ title: 'Tajuk diperlukan.' })
    })

    it('P10-01..P10-04: the limits are title 120, description 500, price 1 to 10000 and tickets per pupil 1 to 100, at the edge and one past it', async () => {
      const ok = { ...body, prizePool: POOL }
      for (const edge of [{ title: 'T'.repeat(120) }, { description: 'D'.repeat(500) }, { ticketCostSyiling: 1 }, { ticketCostSyiling: 10_000 }, { maxTicketsPerStudent: 1 }, { maxTicketsPerStudent: 100 }]) {
        expect((await admin.post('/admin/reward-control/draws', { ...ok, ...edge })).status).toBe(201)
      }
      const past: [Record<string, unknown>, Record<string, string>][] = [
        [{ title: 'T'.repeat(121) }, { title: 'Medan ini tidak sah.' }],
        [{ description: 'D'.repeat(501) }, { description: 'Medan ini tidak sah.' }],
        [{ ticketCostSyiling: 0 }, { ticketCostSyiling: 'Harga tiket tidak sah.' }],
        [{ ticketCostSyiling: 10_001 }, { ticketCostSyiling: 'Harga tiket tidak sah.' }],
        [{ ticketCostSyiling: 1.5 }, { ticketCostSyiling: 'Harga tiket tidak sah.' }],
        [{ ticketCostSyiling: undefined }, { ticketCostSyiling: 'Harga tiket tidak sah.' }],
        [{ maxTicketsPerStudent: 0 }, { maxTicketsPerStudent: 'Medan ini tidak sah.' }],
        [{ maxTicketsPerStudent: 101 }, { maxTicketsPerStudent: 'Medan ini tidak sah.' }],
        [{ title: undefined }, { title: 'Tajuk diperlukan.' }],
      ]
      for (const [change, fields] of past) expect(fail(await admin.post('/admin/reward-control/draws', { ...ok, ...change }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual(fields)
    })

    it('P10-05: a prize is required (no pool, an empty list, a blank label) and its label is at most 120; the message is also the top-level one when it is the only error', async () => {
      for (const prizePool of [undefined, null, '', '   ', '[]', [], [{ label: '   ', valueSen: 1, qty: 1 }], [{ label: '', valueSen: 1, qty: 1 }], [{ label: 'A', valueSen: 1, qty: 1 }, { label: ' ', valueSen: 1, qty: 1 }]]) {
        expect(fail(await admin.post('/admin/reward-control/draws', { ...body, prizePool }), 422, 'VALIDATION_ERROR', 'Hadiah diperlukan.').fields).toEqual({ prizePool: 'Hadiah diperlukan.' })
      }
      expect((await admin.post('/admin/reward-control/draws', { ...body, prizePool: [{ label: 'H'.repeat(120), valueSen: 1, qty: 1 }] })).status).toBe(201)
      fail(await admin.post('/admin/reward-control/draws', { ...body, prizePool: [{ label: 'H'.repeat(121), valueSen: 1, qty: 1 }] }), 422, 'VALIDATION_ERROR', POOL_MSG)
      // with another error as well, the summary is the top-level message
      expect(fail(await admin.post('/admin/reward-control/draws', { ...body, title: '', prizePool: [] }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ title: 'Tajuk diperlukan.', prizePool: 'Hadiah diperlukan.' })
    })

    it('P10-05: the closing day must not be before today (Malaysia): today is allowed, yesterday is "Tarikh tutup mesti pada masa hadapan."', async () => {
      const today = mytDay(t.clock.now())
      const yesterday = mytDay(new Date(t.clock.now().getTime() - 86_400_000))
      const res = await admin.post('/admin/reward-control/draws', { ...body, prizePool: POOL, closesAt: today, openNow: true })
      expect(GamificationDrawSchema.parse(dataOf(res))).toMatchObject({ closesAt: today, status: 'open' })
      expect(fail(await admin.post('/admin/reward-control/draws', { ...body, prizePool: POOL, closesAt: yesterday }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ closesAt: 'Tarikh tutup mesti pada masa hadapan.' })
    })

    it('a refused create writes no draw and no prize row', async () => {
      const draws = Number((await t.db.query<{ n: string }>(`select count(*)::text n from draws`))[0]!.n)
      fail(await admin.post('/admin/reward-control/draws', { ...body, prizePool: 'broken' }), 422, 'VALIDATION_ERROR')
      expect(Number((await t.db.query<{ n: string }>(`select count(*)::text n from draws`))[0]!.n)).toBe(draws)
    })

    it('AC9: deleting a draw cascades to its prizes, but a draw with tickets cannot be deleted (RESTRICT)', async () => {
      const d = GamificationDrawSchema.parse(dataOf(await admin.post('/admin/reward-control/draws', { ...body, prizePool: [{ label: 'P', valueSen: 1, qty: 1 }, { label: 'Q', valueSen: 2, qty: 2 }] })))
      expect(await prizeRows(d.id)).toHaveLength(2)
      const u = await bareUser(t, 'Tiket')
      await t.db.query(`insert into draw_tickets (draw_id, user_id) values ($1, $2)`, [d.id, u])
      await expect(t.db.query(`delete from draws where id = $1`, [d.id])).rejects.toThrow()
      await t.db.query(`delete from draw_tickets where draw_id = $1`, [d.id])
      await t.db.query(`delete from draws where id = $1`, [d.id])
      expect(await prizeRows(d.id)).toEqual([])
    })
  })

  describe('draw list, Buka and Tutup (API-GAME-09, API-ADM-24, DM-65)', () => {
    const mk = async (extra: Record<string, unknown> = {}) =>
      GamificationDrawSchema.parse(dataOf(await admin.post('/admin/reward-control/draws', { title: 'Cabutan Senarai', ticketCostSyiling: 5, maxTicketsPerStudent: 3, prizePool: POOL, ...extra })))
    const stored = async (id: string) => (await t.db.query<{ status: string; cancelled_at: string | null }>(`select status, cancelled_at::text from draws where id = $1`, [id]))[0]!

    it('GET /draws lists every draw newest first in the GamificationDraw shape, with ticketsSold', async () => {
      const a = await mk()
      const b = await mk({ openNow: true })
      const u = await bareUser(t, 'Tiket Senarai')
      await t.db.query(`insert into draw_tickets (draw_id, user_id) values ($1, $2)`, [b.id, u])
      const list = dataOf<unknown[]>(await admin.get('/admin/reward-control/draws')).map((d) => GamificationDrawSchema.parse(d))
      expect(list.map((d) => d.id).slice(0, 2)).toEqual([b.id, a.id])
      expect(list.find((d) => d.id === b.id)).toMatchObject({ status: 'open', ticketsSold: 1 })
      expect(list.find((d) => d.title === 'Cabutan Demo')).toMatchObject({ status: 'open' })
      // the same rows as the Kawalan Reward read
      expect(GamificationRewardControlSchema.parse(dataOf(await admin.get('/admin/reward-control'))).draws).toEqual(list)
    })

    it('Buka moves a draft to open, writes one audit event and leaves the rest of the draw unchanged; Tutup moves it to closed', async () => {
      const d = await mk({ closesAt: '2026-12-31' })
      const opened = GamificationDrawSchema.parse(dataOf(await admin.post(`/admin/reward-control/draws/${d.id}/open`)))
      expect(opened).toEqual({ ...d, status: 'open' })
      expect(await stored(d.id)).toEqual({ status: 'open', cancelled_at: null })
      const closed = GamificationDrawSchema.parse(dataOf(await admin.post(`/admin/reward-control/draws/${d.id}/close`)))
      expect(closed).toEqual({ ...d, status: 'closed' })
      expect((await stored(d.id)).status).toBe('closed')
      const events = await t.db.query<{ action: string; detail: { from: string; to: string }; target_id: string }>(`select action, detail, target_id::text from audit_events where target_type = 'draw' and target_id = $1 order by id`, [d.id])
      expect(events.map((e) => [e.action, e.detail.from, e.detail.to])).toEqual([['gamification.draw.opened', 'draft', 'open'], ['gamification.draw.closed', 'open', 'closed']])
    })

    it('409 CONFLICT when the stored state is not the one the step starts from (a second press, Buka on a closed draw, Tutup on a draft), with no second audit event', async () => {
      const d = await mk()
      fail(await admin.post(`/admin/reward-control/draws/${d.id}/close`), 409, 'CONFLICT')
      await admin.post(`/admin/reward-control/draws/${d.id}/open`)
      const before = await auditCount('gamification.draw.opened')
      fail(await admin.post(`/admin/reward-control/draws/${d.id}/open`), 409, 'CONFLICT')
      await admin.post(`/admin/reward-control/draws/${d.id}/close`)
      fail(await admin.post(`/admin/reward-control/draws/${d.id}/close`), 409, 'CONFLICT')
      fail(await admin.post(`/admin/reward-control/draws/${d.id}/open`), 409, 'CONFLICT')
      expect(await auditCount('gamification.draw.opened')).toBe(before)
      for (const status of ['drawn', 'cancelled']) {
        const x = await mk({ openNow: true })
        await t.db.query(`update draws set status = $2 where id = $1`, [x.id, status])
        fail(await admin.post(`/admin/reward-control/draws/${x.id}/open`), 409, 'CONFLICT')
        fail(await admin.post(`/admin/reward-control/draws/${x.id}/close`), 409, 'CONFLICT')
        expect((await stored(x.id)).status).toBe(status)
      }
    })

    it('404 for an unknown draw and for an id that is not a number', async () => {
      for (const verb of ['open', 'close']) {
        fail(await admin.post(`/admin/reward-control/draws/999999/${verb}`), 404, 'NOT_FOUND')
        fail(await admin.post(`/admin/reward-control/draws/abc/${verb}`), 404, 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
      }
    })

    it('an open draw past its closing day reads closed and nothing is written; Tutup still closes the stored row; a draft past its day cannot be opened', async () => {
      const yesterday = mytDay(new Date(t.clock.now().getTime() - 86_400_000))
      const lapse = (id: string) => t.db.query(`update draws set closes_at = $2::timestamptz where id = $1`, [id, `${yesterday}T23:59:59.999+08:00`])
      const d = await mk({ openNow: true, closesAt: '2026-12-31' })
      const lapsed = await mk({ closesAt: '2026-12-31' })
      await lapse(d.id)
      await lapse(lapsed.id)
      const list = dataOf<{ id: string; status: string }[]>(await admin.get('/admin/reward-control/draws'))
      expect(list.find((x) => x.id === d.id)!.status).toBe('closed')
      expect(GamificationRewardControlSchema.parse(dataOf(await admin.get('/admin/reward-control'))).draws.find((x) => x.id === d.id)!.status).toBe('closed')
      expect((await stored(d.id)).status).toBe('open')
      expect(fail(await admin.post(`/admin/reward-control/draws/${lapsed.id}/open`), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ closesAt: 'Tarikh tutup mesti pada masa hadapan.' })
      expect((await stored(lapsed.id)).status).toBe('draft')
      expect(GamificationDrawSchema.parse(dataOf(await admin.post(`/admin/reward-control/draws/${d.id}/close`))).status).toBe('closed')
      expect((await stored(d.id)).status).toBe('closed')
    })

    it('on its closing day itself a draft opens and reads open; a draw with no closing date opens and stays open', async () => {
      const same = await mk({ closesAt: mytDay(t.clock.now()) })
      expect(GamificationDrawSchema.parse(dataOf(await admin.post(`/admin/reward-control/draws/${same.id}/open`))).status).toBe('open')
      const none = await mk()
      expect(GamificationDrawSchema.parse(dataOf(await admin.post(`/admin/reward-control/draws/${none.id}/open`))).status).toBe('open')
      expect(dataOf<{ id: string; status: string }[]>(await admin.get('/admin/reward-control/draws')).find((x) => x.id === none.id)!.status).toBe('open')
    })
  })

  describe('Cabut pemenang and Tandakan Dihantar (API-GAME-09, API-ADM-24, DM-36, AC-GM-22.4, AC-GM-22.5)', () => {
    /** An open draw with `qtys` prize lines and one pupil per entry of `ticketsPerPupil` (that many tickets each), then closed with Tutup unless `close` is false. */
    const newDraw = async (qtys: number[], ticketsPerPupil: number[], close = true) => {
      const d = GamificationDrawSchema.parse(dataOf(await admin.post('/admin/reward-control/draws', { title: 'Cabutan Undi', ticketCostSyiling: 5, maxTicketsPerStudent: 100, openNow: true, prizePool: qtys.map((qty, i) => ({ label: `Hadiah ${String(i + 1)}`, valueSen: 100 * (i + 1), qty })) })))
      const users: string[] = []
      for (const [i, n] of ticketsPerPupil.entries()) {
        const u = await bareUser(t, `Pembeli ${d.id}-${String(i)}`)
        users.push(u)
        for (let k = 0; k < n; k++) await t.db.query(`insert into draw_tickets (draw_id, user_id) values ($1, $2)`, [d.id, u])
      }
      if (close) dataOf(await admin.post(`/admin/reward-control/draws/${d.id}/close`))
      return { id: d.id, users }
    }
    const press = (id: string) => admin.post(`/admin/reward-control/draws/${id}/winners`)
    const winnerRows = (id: string) =>
      t.db.query<{ id: string; draw_prize_id: string; ticket_id: string; slot: number; user_id: string; drawn_by_id: string | null; delivered_at: string | null; delivered_by_id: string | null }>(
        `select id::text, draw_prize_id::text, ticket_id::text, slot, user_id::text, drawn_by_id::text, delivered_at::text, delivered_by_id::text from draw_winners where draw_id = $1 order by draw_prize_id, slot`,
        [id],
      )
    const stored = async (id: string) => (await t.db.query<{ status: string; winner_user_id: string | null; drawn_at: string | null }>(`select status, winner_user_id::text, drawn_at::text from draws where id = $1`, [id]))[0]!
    const events = (id: string, action: string) => t.db.query<{ detail: Record<string, unknown>; target_id: string; actor_user_id: string }>(`select detail, target_id::text, actor_user_id::text from audit_events where action = $1 and target_id = $2 order by id`, [action, id])
    const notices = (userId: string) => t.db.query<{ type: string; category: string | null; title: string; body: string }>(`select type, category, title, body from notifications where user_id = $1 order by id`, [userId])
    /** Test seam: the draw takes its randomness from the BOX_RANDOM source; here it always picks the first of the pool. */
    const pickFirst = () => vi.spyOn(t.app.get(BOX_RANDOM), 'stream').mockReturnValue({ int: (min: number) => min })

    it('draws every prize slot of a closed draw in one press: 3 winners for 1 + 2 prizes, in prize and slot order, status drawn, first winner kept on the draw', async () => {
      const { id, users } = await newDraw([1, 2], [1, 1, 1, 1, 1, 1, 1, 1])
      const res = await press(id)
      expect(res.status).toBe(200)
      const drawn = GamificationDrawSchema.parse(dataOf(res))
      expect(drawn).toMatchObject({ id, status: 'drawn', ticketsSold: 8 })
      expect(drawn.winners.map((w) => [w.prizePosition, w.prizeLabel, w.slot])).toEqual([[0, 'Hadiah 1', 0], [1, 'Hadiah 2', 0], [1, 'Hadiah 2', 1]])
      expect(new Set(drawn.winners.map((w) => w.userId)).size).toBe(3)
      for (const w of drawn.winners) {
        expect(users).toContain(w.userId)
        expect(w.name).toMatch(/^Pengguna Pembeli /)
        expect(w.deliveredAt).toBeNull()
      }
      const rows = await winnerRows(id)
      expect(rows).toHaveLength(3)
      const adminId = await userIdOf(t.db, ADMIN)
      for (const r of rows) expect(r).toMatchObject({ drawn_by_id: adminId, delivered_at: null, delivered_by_id: null })
      // each ticket is the winner's own ticket of this draw
      for (const r of rows) expect(await t.db.query(`select 1 from draw_tickets where id = $1 and draw_id = $2 and user_id = $3`, [r.ticket_id, id, r.user_id])).toHaveLength(1)
      expect(await stored(id)).toMatchObject({ status: 'drawn', winner_user_id: drawn.winners[0]!.userId })
      expect((await stored(id)).drawn_at).not.toBeNull()
    })

    it('writes ONE audit event in the same transaction, with the draw id as target, the admin as actor and the winning tickets', async () => {
      const { id } = await newDraw([2], [1, 1, 1, 1, 1])
      const before = await auditCount('gamification.draw.drawn')
      const drawn = GamificationDrawSchema.parse(dataOf(await press(id)))
      expect(await auditCount('gamification.draw.drawn')).toBe(before + 1)
      const [ev, ...rest] = await events(id, 'gamification.draw.drawn')
      expect(rest).toEqual([])
      expect(ev).toMatchObject({ target_id: id, actor_user_id: await userIdOf(t.db, ADMIN) })
      expect(ev!.detail).toMatchObject({ ticketCount: 5 })
      expect((ev!.detail.winners as { ticketId: string; userId: string }[]).map((w) => [w.ticketId, w.userId])).toEqual(drawn.winners.map((w) => [w.ticketId, w.userId]))
    })

    it('AC-GM-22.4: with 2 prizes, pupil A (9 tickets) wins one prize only and pupil B (1 ticket) gets the other', async () => {
      const { id, users } = await newDraw([1, 1], [9, 1])
      const drawn = GamificationDrawSchema.parse(dataOf(await press(id)))
      expect(drawn.winners.map((w) => w.userId).sort()).toEqual([...users].sort())
    })

    it('a winner leaves the pool with all their tickets: the first of the pool wins slot 0, then only the other pupil can win slot 1', async () => {
      const { id, users } = await newDraw([2], [3, 2])
      const spy = pickFirst()
      try {
        const drawn = GamificationDrawSchema.parse(dataOf(await press(id)))
        expect(drawn.winners.map((w) => w.userId)).toEqual([users[0], users[1]])
        const firstTicket = (await t.db.query<{ id: string }>(`select id::text from draw_tickets where draw_id = $1 order by id limit 1`, [id]))[0]!.id
        expect(drawn.winners[0]!.ticketId).toBe(firstTicket)
        expect(spy).toHaveBeenCalledWith(`cabutan-draw:${id}`)
      } finally {
        spy.mockRestore()
      }
    })

    it('fewer pupils than prizes: as many winners as pupils (2 of 5 prizes, filled in prize order), and the draw is drawn', async () => {
      const { id } = await newDraw([3, 2], [4, 1])
      const drawn = GamificationDrawSchema.parse(dataOf(await press(id)))
      expect(drawn.status).toBe('drawn')
      expect(drawn.winners.map((w) => [w.prizePosition, w.slot])).toEqual([[0, 0], [0, 1]])
      expect(await winnerRows(id)).toHaveLength(2)
    })

    it('AC-GM-22.5: a closed draw with no ticket answers 409 NO_PARTICIPANTS "Tiada peserta"; it stays closed, with no winner, notice or audit event', async () => {
      const { id } = await newDraw([2], [])
      const before = await auditCount('gamification.draw.drawn')
      fail(await press(id), 409, 'NO_PARTICIPANTS', 'Tiada peserta')
      expect(await stored(id)).toEqual({ status: 'closed', winner_user_id: null, drawn_at: null })
      expect(await winnerRows(id)).toEqual([])
      expect(await auditCount('gamification.draw.drawn')).toBe(before)
      expect(dataOf<{ id: string; status: string }[]>(await admin.get('/admin/reward-control/draws')).find((d) => d.id === id)!.status).toBe('closed')
    })

    it('each winner gets the in-app notice "Tahniah! Anda memenangi {prize} dalam {title}." (milestone); a pupil who did not win gets none', async () => {
      const { id, users } = await newDraw([1], [1, 1, 1])
      const drawn = GamificationDrawSchema.parse(dataOf(await press(id)))
      const winner = drawn.winners[0]!
      expect(await notices(winner.userId)).toEqual([{ type: 'cabutan_winner', category: 'milestone', title: 'Cabutan Bertuah', body: 'Tahniah! Anda memenangi Hadiah 1 dalam Cabutan Undi.' }])
      for (const u of users.filter((x) => x !== winner.userId)) expect(await notices(u)).toEqual([])
    })

    it('a press that fails after the winners were written leaves nothing: no winner row, status unchanged, no audit event (one transaction)', async () => {
      const { id } = await newDraw([1], [1, 1])
      const spy = vi.spyOn(t.app.get(NotificationsService), 'push').mockRejectedValueOnce(new Error('inbox down'))
      const before = await auditCount('gamification.draw.drawn')
      try {
        expect((await press(id)).status).toBe(500)
      } finally {
        spy.mockRestore()
      }
      expect(await winnerRows(id)).toEqual([])
      expect((await stored(id)).status).toBe('closed')
      expect(await auditCount('gamification.draw.drawn')).toBe(before)
      // and the same press works afterwards
      expect(GamificationDrawSchema.parse(dataOf(await press(id))).status).toBe('drawn')
    })

    it('a second press is 409 CONFLICT: no second winner set, no second audit event, the first result is untouched', async () => {
      const { id } = await newDraw([2], [1, 1, 1, 1])
      const first = GamificationDrawSchema.parse(dataOf(await press(id)))
      const rows = await winnerRows(id)
      fail(await press(id), 409, 'CONFLICT')
      expect(await winnerRows(id)).toEqual(rows)
      expect((await events(id, 'gamification.draw.drawn'))).toHaveLength(1)
      expect(dataOf<{ id: string; winners: unknown[] }[]>(await admin.get('/admin/reward-control/draws')).find((d) => d.id === id)!.winners).toEqual(first.winners)
    })

    it('concurrent presses: exactly one wins the run (200), the others are 409; one set of winners, one audit event', async () => {
      const { id } = await newDraw([2], [1, 1, 1, 1])
      const results = await Promise.all([press(id), press(id), press(id)])
      expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409])
      expect(await winnerRows(id)).toHaveLength(2)
      expect((await events(id, 'gamification.draw.drawn'))).toHaveLength(1)
      for (const r of results.filter((x) => x.status === 409)) fail(r, 409, 'CONFLICT')
    })

    it('a ticket purchase racing the run: the run holds the row lock, so the ticket is either in the pool or refused after it', async () => {
      const { id } = await newDraw([1], [1, 1], false)
      const buyer = await bareUser(t, 'Lewat')
      const buy = t.prisma.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM draws WHERE id = ${BigInt(id)} FOR SHARE`
        await new Promise((r) => setTimeout(r, 200))
        await tx.drawTicket.create({ data: { drawId: BigInt(id), userId: BigInt(buyer) } })
      })
      await new Promise((r) => setTimeout(r, 50))
      dataOf(await admin.post(`/admin/reward-control/draws/${id}/close`))
      await buy
      const drawn = GamificationDrawSchema.parse(dataOf(await press(id)))
      // the close waited for the buyer's share lock, so the late ticket is already in the table when the run reads the pool
      expect(drawn.ticketsSold).toBe(3)
    })

    it('state rules: only a closed draw is drawn; a draft, an open draw still selling, a drawn and a cancelled draw are 409 CONFLICT and nothing is written', async () => {
      const draft = await newDraw([1], [1], false)
      await t.db.query(`update draws set status = 'draft' where id = $1`, [draft.id])
      const open = await newDraw([1], [1], false)
      const drawn = await newDraw([1], [1])
      await press(drawn.id)
      const cancelled = await newDraw([1], [1], false)
      await t.db.query(`update draws set status = 'cancelled', cancelled_at = now() where id = $1`, [cancelled.id])
      const before = await auditCount('gamification.draw.drawn')
      for (const [x, status] of [[draft, 'draft'], [open, 'open'], [drawn, 'drawn'], [cancelled, 'cancelled']] as const) {
        fail(await press(x.id), 409, 'CONFLICT')
        expect((await stored(x.id)).status).toBe(status)
      }
      expect(await auditCount('gamification.draw.drawn')).toBe(before)
      expect(await winnerRows(draft.id)).toEqual([])
      expect(await winnerRows(open.id)).toEqual([])
    })

    it('an open draw whose closing day has passed reads closed and is drawn from; one closing today is still selling and is refused', async () => {
      const yesterday = mytDay(new Date(t.clock.now().getTime() - 86_400_000))
      const lapsed = await newDraw([1], [1, 1], false)
      await t.db.query(`update draws set closes_at = $2::timestamptz where id = $1`, [lapsed.id, `${yesterday}T23:59:59.999+08:00`])
      expect(dataOf<{ id: string; status: string }[]>(await admin.get('/admin/reward-control/draws')).find((d) => d.id === lapsed.id)!.status).toBe('closed')
      expect(GamificationDrawSchema.parse(dataOf(await press(lapsed.id))).status).toBe('drawn')
      expect((await stored(lapsed.id)).status).toBe('drawn')
      const today = await newDraw([1], [1, 1], false)
      await t.db.query(`update draws set closes_at = $2::timestamptz where id = $1`, [today.id, `${mytDay(t.clock.now())}T23:59:59.999+08:00`])
      fail(await press(today.id), 409, 'CONFLICT')
      expect((await stored(today.id)).status).toBe('open')
    })

    it('404 for an unknown draw and for an id that is not a number; the route takes no body', async () => {
      fail(await press('999999'), 404, 'NOT_FOUND')
      fail(await press('abc'), 404, 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
      const { id } = await newDraw([1], [1])
      // a body is ignored: it cannot pick a winner or a prize
      expect(GamificationDrawSchema.parse(dataOf(await admin.post(`/admin/reward-control/draws/${id}/winners`, { drawPrizeId: '1', userId: '1' }))).winners).toHaveLength(1)
    })

    it('only an admin: a pupil gets 403 on both routes and nothing is drawn', async () => {
      const { id } = await newDraw([1], [1])
      const student = await signIn(t, STUDENT_MAJU)
      fail(await student.post(`/admin/reward-control/draws/${id}/winners`), 403, 'FORBIDDEN')
      fail(await student.post(`/admin/reward-control/draws/${id}/winners/1/deliver`), 403, 'FORBIDDEN')
      expect((await stored(id)).status).toBe('closed')
    })

    it('the draw list and Kawalan Reward carry the winners of a drawn draw and an empty list for the others', async () => {
      const a = await newDraw([2], [1, 1, 1])
      const b = await newDraw([1], [1])
      const drawn = GamificationDrawSchema.parse(dataOf(await press(a.id)))
      const list = dataOf<unknown[]>(await admin.get('/admin/reward-control/draws')).map((d) => GamificationDrawSchema.parse(d))
      expect(list.find((d) => d.id === a.id)).toEqual(drawn)
      expect(list.find((d) => d.id === b.id)!.winners).toEqual([])
      expect(GamificationRewardControlSchema.parse(dataOf(await admin.get('/admin/reward-control'))).draws).toEqual(list)
    })

    it('the draw statuses of Buka and Tutup are unchanged; a drawn draw cannot be opened or closed again', async () => {
      const { id } = await newDraw([1], [1])
      await press(id)
      fail(await admin.post(`/admin/reward-control/draws/${id}/open`), 409, 'CONFLICT')
      fail(await admin.post(`/admin/reward-control/draws/${id}/close`), 409, 'CONFLICT')
    })

    it('a draw with tickets and no prize line answers 409 and stays closed, with no winner', async () => {
      const { id } = await newDraw([1], [1])
      await t.db.query(`delete from draw_prizes where draw_id = ${id}`)
      fail(await press(id), 409, 'CONFLICT')
      expect(await stored(id)).toEqual({ status: 'closed', winner_user_id: null, drawn_at: null })
      expect(await winnerRows(id)).toEqual([])
    })

    it('the winner rows refuse a second winner for the same slot and a second prize for the same pupil', async () => {
      const { id, users } = await newDraw([1], [2, 1])
      await press(id)
      const [first] = await winnerRows(id)
      const [prize] = await t.db.query<{ id: string }>(`select id::text from draw_prizes where draw_id = $1`, [id])
      const [spare] = await t.db.query<{ id: string }>(`select id::text from draw_tickets where draw_id = $1 and id <> $2 order by id limit 1`, [id, first!.ticket_id])
      const insert = (slot: number, userId: string, ticketId: string) =>
        t.db.query(`insert into draw_winners (draw_id, draw_prize_id, ticket_id, slot, user_id, drawn_at) values ($1, $2, $3, $4, $5, now())`, [id, prize!.id, ticketId, slot, userId])
      await expect(insert(0, users.find((u) => u !== first!.user_id)!, spare!.id)).rejects.toThrow(/uq_draw_winners_draw_prize_id_slot/)
      await expect(insert(1, first!.user_id, spare!.id)).rejects.toThrow(/uq_draw_winners_draw_id_user_id|uq_draw_winners_ticket_id/)
    })

    describe('pickWinners (the draw itself)', () => {
      const ticketsOf = (perPupil: number[]) => perPupil.flatMap((n, u) => Array.from({ length: n }, () => ({ userId: BigInt(u + 1) })))

      it('AC-GM-22.4: in 10,000 draws of 2 prizes with A holding 9 tickets and B holding 1, A takes the first prize about 90% of the time (within 3 points), and the two prizes always go to A and B', () => {
        let aFirst = 0
        for (let i = 0; i < 10_000; i++) {
          const picks = pickWinners(ticketsOf([9, 1]), [{ qty: 1 }, { qty: 1 }], CsprngBoxRandom.stream(`harness:${String(i)}`))
          expect(picks.map((p) => p.ticket.userId).sort()).toEqual([1n, 2n])
          if (picks[0]!.ticket.userId === 1n) aFirst++
        }
        expect(Math.abs(aFirst / 10_000 - 0.9)).toBeLessThan(0.03)
      })

      it('never more winners than the pool has pupils or than the sum of qty; no tickets gives no winner', () => {
        expect(pickWinners(ticketsOf([5, 5, 5]), [{ qty: 2 }, { qty: 4 }], CsprngBoxRandom.stream('a'))).toHaveLength(3)
        expect(pickWinners(ticketsOf([1, 1, 1, 1]), [{ qty: 2 }], CsprngBoxRandom.stream('b'))).toHaveLength(2)
        expect(pickWinners([], [{ qty: 2 }], CsprngBoxRandom.stream('c'))).toEqual([])
      })

      it('a prize line of qty 3 gets the slots 0, 1 and 2, in line order; the same seed gives the same winners and the CSPRNG source does not repeat', () => {
        const tickets = ticketsOf([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
        const slots = pickWinners(tickets, [{ qty: 3 }, { qty: 1 }], SeededBoxRandom.stream('k')).map((p) => [p.prize.qty, p.slot])
        expect(slots).toEqual([[3, 0], [3, 1], [3, 2], [1, 0]])
        const ids = (key: string, source: typeof SeededBoxRandom) => pickWinners(tickets, [{ qty: 3 }], source.stream(key)).map((p) => p.ticket.userId)
        expect(ids('k', SeededBoxRandom)).toEqual(ids('k', SeededBoxRandom))
        const outcomes = new Set<string>()
        for (let i = 0; i < 12; i++) outcomes.add(ids(`k${String(i)}`, CsprngBoxRandom).join(','))
        expect(outcomes.size).toBeGreaterThan(1)
      })
    })

    describe('Tandakan Dihantar', () => {
      const deliver = (id: string, winnerId: string) => admin.post(`/admin/reward-control/draws/${id}/winners/${winnerId}/deliver`)

      it('marks the winner delivered with the time and the admin, answers the draw, and writes one audit event with the draw id as target', async () => {
        const { id } = await newDraw([2], [1, 1, 1])
        const drawn = GamificationDrawSchema.parse(dataOf(await press(id)))
        const [w0, w1] = drawn.winners
        const res = await deliver(id, w0!.id)
        expect(res.status).toBe(200)
        const after = GamificationDrawSchema.parse(dataOf(res))
        expect(after.status).toBe('drawn')
        expect(after.winners[0]!.deliveredAt).not.toBeNull()
        expect(after.winners[1]).toEqual(w1)
        const row = (await winnerRows(id)).find((r) => r.id === w0!.id)!
        expect(row).toMatchObject({ delivered_by_id: await userIdOf(t.db, ADMIN) })
        expect(row.delivered_at).not.toBeNull()
        const [ev, ...rest] = await events(id, 'gamification.draw.winner_delivered')
        expect(rest).toEqual([])
        expect(ev).toMatchObject({ target_id: id, actor_user_id: await userIdOf(t.db, ADMIN), detail: { winnerId: w0!.id, prizePosition: 0, slot: 0 } })
      })

      it('a winner already marked is 409 CONFLICT: the first time stays and no second audit event is written', async () => {
        const { id } = await newDraw([1], [1, 1])
        const w = GamificationDrawSchema.parse(dataOf(await press(id))).winners[0]!
        const first = GamificationDrawSchema.parse(dataOf(await deliver(id, w.id))).winners[0]!.deliveredAt
        fail(await deliver(id, w.id), 409, 'CONFLICT')
        const results = await Promise.all([deliver(id, w.id), deliver(id, w.id)])
        expect(results.map((r) => r.status)).toEqual([409, 409])
        expect(GamificationDrawSchema.parse(dataOf<{ id: string }[]>(await admin.get('/admin/reward-control/draws')).find((d) => d.id === id)).winners[0]!.deliveredAt).toBe(first)
        expect(await events(id, 'gamification.draw.winner_delivered')).toHaveLength(1)
      })

      it('concurrent presses on one winner: one 200, one 409, one audit event', async () => {
        const { id } = await newDraw([1], [1, 1])
        const w = GamificationDrawSchema.parse(dataOf(await press(id))).winners[0]!
        const results = await Promise.all([deliver(id, w.id), deliver(id, w.id)])
        expect(results.map((r) => r.status).sort()).toEqual([200, 409])
        expect(await events(id, 'gamification.draw.winner_delivered')).toHaveLength(1)
      })

      it('404 for an unknown winner, a winner of another draw, a draw with no winners and a non-numeric id', async () => {
        const a = await newDraw([1], [1])
        const b = await newDraw([1], [1])
        const wa = GamificationDrawSchema.parse(dataOf(await press(a.id))).winners[0]!
        await press(b.id)
        const undrawn = await newDraw([1], [1])
        fail(await deliver(a.id, '999999'), 404, 'NOT_FOUND')
        fail(await deliver(b.id, wa.id), 404, 'NOT_FOUND')
        fail(await deliver(undrawn.id, wa.id), 404, 'NOT_FOUND')
        fail(await deliver('999999', wa.id), 404, 'NOT_FOUND')
        fail(await deliver(a.id, 'abc'), 404, 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
        fail(await deliver('abc', wa.id), 404, 'NOT_FOUND')
        expect((await winnerRows(a.id))[0]!.delivered_at).toBeNull()
      })
    })
  })

  describe('edit a draft draw and cancel with refund (API-ADM-24, DM-65, FR-GM-22.3, AC-GM-22.6, ERR-GAME-23)', () => {
    const PRICE = 5
    const mk = async (extra: Record<string, unknown> = {}) =>
      GamificationDrawSchema.parse(dataOf(await admin.post('/admin/reward-control/draws', { title: 'Cabutan Batal', ticketCostSyiling: PRICE, maxTicketsPerStudent: 10, closesAt: '2026-12-31', prizePool: [{ label: 'Asal', valueSen: 100, qty: 1 }], ...extra })))
    const stored = async (id: string) => (await t.db.query<{ status: string; cancelled_at: string | null }>(`select status, cancelled_at::text from draws where id = $1`, [id]))[0]!
    const cancel = (id: string) => admin.post(`/admin/reward-control/draws/${id}/cancel`)
    const refunds = (userId: string) => t.db.query<{ type: string; source: string; source_id: string | null; amount: number; description: string }>(`select type, source, source_id, amount, description from coin_ledger where user_id = $1 and source = 'cabutan_refund' order by id`, [userId])
    const edit = { title: 'Disunting', description: 'Baharu', ticketCostSyiling: 9, maxTicketsPerStudent: 4, closesAt: '2026-12-30', prizePool: [{ label: 'Satu', valueSen: 500, qty: 1 }, { label: 'Dua', valueSen: 50, qty: 3 }] }

    /** Pupils with 100 syiling who each bought `n` tickets the way the shop does (ticket row, then a spend keyed by the ticket). */
    const sell = async (drawId: string, counts: number[]) => {
      const wallet = t.app.get(WalletService)
      const users: string[] = []
      for (const [i, n] of counts.entries()) {
        const u = await bareUser(t, `Murid Batal ${drawId}-${String(i)}`)
        users.push(u)
        await wallet.credit({ userId: u, amount: 100, source: 'ujian', sourceId: `seed:${drawId}:${u}`, description: 'Baki', type: 'earn', isTest: false })
        for (let k = 0; k < n; k++) {
          const ticket = (await t.db.query<{ id: string }>(`insert into draw_tickets (draw_id, user_id) values ($1, $2) returning id::text`, [drawId, u]))[0]!.id
          await wallet.debit({ userId: u, amount: PRICE, source: 'cabutan_ticket', sourceId: `draw:${drawId}:ticket:${ticket}`, description: 'Tiket Cabutan: Cabutan Batal', type: 'spend', isTest: false })
        }
      }
      return users
    }

    describe('PUT /admin/reward-control/draws/:id', () => {
      it('edits a draft: the fields change and the prize lines are replaced in the new order; one audit event', async () => {
        const d = await mk({ prizePool: [{ label: 'A', valueSen: 1, qty: 1 }, { label: 'B', valueSen: 2, qty: 2 }, { label: 'C', valueSen: 3, qty: 3 }] })
        const before = await auditCount('gamification.draw.updated')
        const res = await admin.put(`/admin/reward-control/draws/${d.id}`, edit)
        expect(res.status).toBe(200)
        const e = GamificationDrawSchema.parse(dataOf(res))
        expect(e).toEqual({ ...d, title: 'Disunting', description: 'Baharu', ticketCostSyiling: 9, maxTicketsPerStudent: 4, closesAt: '2026-12-30', prizePool: [{ label: 'Satu', valueSen: 500, qty: 1 }, { label: 'Dua', valueSen: 50, qty: 3 }] })
        expect(await prizeRows(d.id)).toEqual([{ label: 'Satu', value_sen: 500, qty: 1, position: 0 }, { label: 'Dua', value_sen: 50, qty: 3, position: 1 }])
        expect((await stored(d.id)).status).toBe('draft')
        expect(await auditCount('gamification.draw.updated')).toBe(before + 1)
        expect(dataOf<{ id: string }[]>(await admin.get('/admin/reward-control/draws')).find((x) => x.id === d.id)).toEqual(e)
      })

      it('the create validation is reused with its messages, and a refused body writes nothing (title, pool and audit unchanged)', async () => {
        const d = await mk()
        const before = await auditCount('gamification.draw.updated')
        expect(fail(await admin.put(`/admin/reward-control/draws/${d.id}`, { description: 'x'.repeat(501), ticketCostSyiling: 0, closesAt: '31/12/2026' }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ title: 'Tajuk diperlukan.', description: 'Medan ini tidak sah.', ticketCostSyiling: 'Harga tiket tidak sah.', maxTicketsPerStudent: 'Medan ini diperlukan.', closesAt: 'Medan ini tidak sah.', prizePool: 'Hadiah diperlukan.' })
        expect(fail(await admin.put(`/admin/reward-control/draws/${d.id}`, { ...edit, prizePool: 'not json' }), 422, 'VALIDATION_ERROR', POOL_MSG).fields).toEqual({ prizePool: POOL_MSG })
        expect(fail(await admin.put(`/admin/reward-control/draws/${d.id}`, { ...edit, prizePool: [] }), 422, 'VALIDATION_ERROR', 'Hadiah diperlukan.').fields).toEqual({ prizePool: 'Hadiah diperlukan.' })
        expect(fail(await admin.put(`/admin/reward-control/draws/${d.id}`, { ...edit, closesAt: '2020-01-01' }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ closesAt: 'Tarikh tutup mesti pada masa hadapan.' })
        expect(fail(await admin.put(`/admin/reward-control/draws/${d.id}`, { ...edit, title: 'T'.repeat(121) }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ title: 'Medan ini tidak sah.' })
        expect(fail(await admin.put(`/admin/reward-control/draws/${d.id}`, { ...edit, ticketCostSyiling: 10_001 }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ ticketCostSyiling: 'Harga tiket tidak sah.' })
        expect(fail(await admin.put(`/admin/reward-control/draws/${d.id}`, { ...edit, maxTicketsPerStudent: 101 }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ maxTicketsPerStudent: 'Medan ini tidak sah.' })
        expect(await prizeRows(d.id)).toEqual([{ label: 'Asal', value_sen: 100, qty: 1, position: 0 }])
        expect((await t.db.query<{ title: string }>(`select title from draws where id = $1`, [d.id]))[0]!.title).toBe('Cabutan Batal')
        expect(await auditCount('gamification.draw.updated')).toBe(before)
      })

      it('draft only: an open, closed, drawn or cancelled draw is 409 CONFLICT and nothing changes; an unknown or non-numeric id is 404', async () => {
        for (const status of ['open', 'closed', 'drawn', 'cancelled']) {
          const d = await mk()
          await t.db.query(`update draws set status = $2 where id = $1`, [d.id, status])
          fail(await admin.put(`/admin/reward-control/draws/${d.id}`, edit), 409, 'CONFLICT')
          expect(await prizeRows(d.id)).toEqual([{ label: 'Asal', value_sen: 100, qty: 1, position: 0 }])
        }
        fail(await admin.put('/admin/reward-control/draws/999999', edit), 404, 'NOT_FOUND')
        fail(await admin.put('/admin/reward-control/draws/abc', edit), 404, 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
      })

      it('check order is 404, then 422, then 409: an invalid body on an unknown id is 404, on an open draw 422, a valid body on an open draw 409', async () => {
        fail(await admin.put('/admin/reward-control/draws/999999', {}), 404, 'NOT_FOUND')
        const d = await mk({ openNow: true })
        fail(await admin.put(`/admin/reward-control/draws/${d.id}`, {}), 422, 'VALIDATION_ERROR', SUMMARY)
        fail(await admin.put(`/admin/reward-control/draws/${d.id}`, edit), 409, 'CONFLICT')
      })

      it('a draft that Buka opened first cannot be edited afterwards; concurrent edits all succeed in turn (last write wins) with one coherent pool', async () => {
        const d = await mk()
        const results = await Promise.all([1, 2, 3].map((n) => admin.put(`/admin/reward-control/draws/${d.id}`, { ...edit, title: `Edit ${String(n)}`, prizePool: [{ label: `P${String(n)}`, valueSen: n, qty: n }] })))
        expect(results.map((r) => r.status)).toEqual([200, 200, 200])
        const rows = await prizeRows(d.id)
        expect(rows).toHaveLength(1)
        expect(rows[0]!.position).toBe(0)
        await admin.post(`/admin/reward-control/draws/${d.id}/open`)
        fail(await admin.put(`/admin/reward-control/draws/${d.id}`, edit), 409, 'CONFLICT')
      })

      it('admin only: a pupil gets 403, and a request without the CSRF token is refused; the draw is unchanged', async () => {
        const d = await mk()
        const student = await signIn(t, STUDENT_MAJU)
        fail(await student.put(`/admin/reward-control/draws/${d.id}`, edit), 403, 'FORBIDDEN')
        fail(await admin.noCsrfPut(`/admin/reward-control/draws/${d.id}`, edit), 403, 'CSRF_INVALID')
        expect((await prizeRows(d.id))[0]!.label).toBe('Asal')
      })
    })

    describe('POST /admin/reward-control/draws/:id/cancel', () => {
      it('AC-GM-22.6: an open draw with 6 tickets sold is cancelled; 6 cabutan_refund rows, each pupil restored, the lifetime total unchanged', async () => {
        const d = await mk({ openNow: true })
        const users = await sell(d.id, [1, 1, 1, 1, 1, 1])
        for (const u of users) expect(await walletOf(t, u)).toMatchObject({ current_syiling: 100 - PRICE, total_syiling_earned: 100 })
        const before = await auditCount('gamification.draw.cancelled')
        const res = await cancel(d.id)
        expect(res.status).toBe(200)
        const out = GamificationDrawSchema.parse(dataOf(res))
        expect(out).toEqual({ ...d, status: 'cancelled', ticketsSold: 6 })
        const row = await stored(d.id)
        expect(row.status).toBe('cancelled')
        expect(row.cancelled_at).not.toBeNull()
        const tickets = await t.db.query<{ id: string; user_id: string }>(`select id::text, user_id::text from draw_tickets where draw_id = $1`, [d.id])
        let rows = 0
        for (const u of users) {
          const mine = await refunds(u)
          rows += mine.length
          const ticket = tickets.find((x) => x.user_id === u)!
          expect(mine).toEqual([{ type: 'refund', source: 'cabutan_refund', source_id: `draw:${d.id}:ticket:${ticket.id}`, amount: PRICE, description: 'Pulangan tiket cabutan: Cabutan Batal' }])
          expect(await walletOf(t, u)).toMatchObject({ current_syiling: 100, total_syiling_earned: 100 })
        }
        expect(rows).toBe(6)
        const events = await t.db.query<{ detail: Record<string, unknown>; actor_user_id: string }>(`select detail, actor_user_id::text from audit_events where action = 'gamification.draw.cancelled' and target_id = $1`, [d.id])
        expect(events).toHaveLength(1)
        expect(events[0]).toMatchObject({ actor_user_id: await userIdOf(t.db, ADMIN), detail: { from: 'open', refundedTickets: 6, refundedSyiling: 6 * PRICE } })
        expect(await auditCount('gamification.draw.cancelled')).toBe(before + 1)
      })

      it('a pupil with several tickets is refunded once per ticket', async () => {
        const d = await mk({ openNow: true })
        const [u] = await sell(d.id, [3])
        expect(await walletOf(t, u!)).toMatchObject({ current_syiling: 100 - 3 * PRICE })
        await cancel(d.id)
        expect(await refunds(u!)).toHaveLength(3)
        expect(await walletOf(t, u!)).toMatchObject({ current_syiling: 100, total_syiling_earned: 100 })
      })

      it('a second cancel is 409 CONFLICT: no extra refund, no second audit event; concurrent presses refund once', async () => {
        const d = await mk({ openNow: true })
        const users = await sell(d.id, [1, 2])
        const results = await Promise.all([cancel(d.id), cancel(d.id), cancel(d.id)])
        expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409])
        for (const r of results.filter((x) => x.status === 409)) fail(r, 409, 'CONFLICT')
        fail(await cancel(d.id), 409, 'CONFLICT')
        expect((await refunds(users[0]!)).length + (await refunds(users[1]!)).length).toBe(3)
        for (const u of users) expect((await walletOf(t, u))!.current_syiling).toBe(100)
        expect(await t.db.query(`select 1 from audit_events where action = 'gamification.draw.cancelled' and target_id = $1`, [d.id])).toHaveLength(1)
      })

      it('two draws whose tickets reverse the same two pupils, cancelled concurrently, both succeed with exactly one refund per ticket (wallets lock in user id order)', async () => {
        const a = await mk({ openNow: true })
        const b = await mk({ openNow: true })
        const [u1, u2] = [await bareUser(t, `Kunci A ${a.id}`), await bareUser(t, `Kunci B ${b.id}`)]
        const wallet = t.app.get(WalletService)
        for (const u of [u1, u2]) await wallet.credit({ userId: u, amount: 100, source: 'ujian', sourceId: `seed:${a.id}:${b.id}:${u}`, description: 'Baki', type: 'earn', isTest: false })
        const buy = async (drawId: string, u: string) => {
          const ticket = (await t.db.query<{ id: string }>(`insert into draw_tickets (draw_id, user_id) values ($1, $2) returning id::text`, [drawId, u]))[0]!.id
          await wallet.debit({ userId: u, amount: PRICE, source: 'cabutan_ticket', sourceId: `draw:${drawId}:ticket:${ticket}`, description: 'Tiket', type: 'spend', isTest: false })
        }
        await buy(a.id, u1)
        await buy(a.id, u2)
        await buy(b.id, u2)
        await buy(b.id, u1)
        const results = await Promise.all([cancel(a.id), cancel(b.id)])
        expect(results.map((r) => r.status)).toEqual([200, 200])
        for (const u of [u1, u2]) {
          expect(await refunds(u)).toHaveLength(2)
          expect(await walletOf(t, u)).toMatchObject({ current_syiling: 100, total_syiling_earned: 100 })
        }
      })

      it('a refund key that already exists is harmless: the cancel succeeds, that key stays one row and the balance is right', async () => {
        const d = await mk({ openNow: true })
        const users = await sell(d.id, [1, 1])
        const ticket = (await t.db.query<{ id: string }>(`select id::text from draw_tickets where draw_id = $1 and user_id = $2`, [d.id, users[0]]))[0]!.id
        await t.app.get(WalletService).credit({ userId: users[0]!, amount: PRICE, source: 'cabutan_refund', sourceId: `draw:${d.id}:ticket:${ticket}`, description: 'Pulangan tiket cabutan: Cabutan Batal', type: 'refund', isTest: false })
        expect(GamificationDrawSchema.parse(dataOf(await cancel(d.id))).status).toBe('cancelled')
        expect(await t.db.query(`select 1 from coin_ledger where source = 'cabutan_refund' and source_id = $1`, [`draw:${d.id}:ticket:${ticket}`])).toHaveLength(1)
        for (const u of users) {
          expect(await refunds(u)).toHaveLength(1)
          expect((await walletOf(t, u))!.current_syiling).toBe(100)
        }
      })

      it('a ticket purchase racing a cancel: the ticket is refunded, or the purchase is refused DRAW_CANCELLED/DRAW_CLOSED; the wallet nets to its start and nothing deadlocks', async () => {
        const student = await signIn(t, STUDENT_MAJU)
        const uid = await userIdOf(t.db, STUDENT_MAJU)
        await t.app.get(WalletService).credit({ userId: uid, amount: 50, source: 'ujian', sourceId: `race:${uid}:${String(Date.now())}`, description: 'Baki', type: 'earn', isTest: false })
        for (let i = 0; i < 4; i++) {
          const d = await mk({ openNow: true })
          const start = (await walletOf(t, uid))!.current_syiling
          const [buy, cut] = await Promise.all([student.post(`/cabutan/${d.id}/tickets`), cancel(d.id)])
          expect(cut.status).toBe(200)
          if (buy.status === 201) expect(await refunds(uid)).toEqual(expect.arrayContaining([expect.objectContaining({ source_id: expect.stringContaining(`draw:${d.id}:ticket:`) })]))
          else expect(['DRAW_CANCELLED', 'DRAW_CLOSED']).toContain(fail(buy, 409, (buy.body as { error: { code: string } }).error.code).code)
          expect((await walletOf(t, uid))!.current_syiling).toBe(start)
          expect(await t.db.query(`select 1 from coin_ledger where source = 'cabutan_refund' and source_id like $1`, [`draw:${d.id}:%`])).toHaveLength(buy.status === 201 ? 1 : 0)
        }
      })

      it('a closed draw cancels and refunds its tickets', async () => {
        const d = await mk({ openNow: true })
        const users = await sell(d.id, [1, 1])
        await admin.post(`/admin/reward-control/draws/${d.id}/close`)
        expect(GamificationDrawSchema.parse(dataOf(await cancel(d.id))).status).toBe('cancelled')
        for (const u of users) {
          expect(await refunds(u)).toHaveLength(1)
          expect((await walletOf(t, u))!.current_syiling).toBe(100)
        }
        const [ev] = await t.db.query<{ detail: { from: string } }>(`select detail from audit_events where action = 'gamification.draw.cancelled' and target_id = $1`, [d.id])
        expect(ev!.detail.from).toBe('closed')
      })

      it('an open draw past its closing day (reads closed) cancels too', async () => {
        const d = await mk({ openNow: true })
        const [u] = await sell(d.id, [1])
        const yesterday = mytDay(new Date(t.clock.now().getTime() - 86_400_000))
        await t.db.query(`update draws set closes_at = $2::timestamptz where id = $1`, [d.id, `${yesterday}T23:59:59.999+08:00`])
        expect(GamificationDrawSchema.parse(dataOf(await cancel(d.id))).status).toBe('cancelled')
        expect(await refunds(u!)).toHaveLength(1)
      })

      it('a draft cancels with no refund and one audit row', async () => {
        const d = await mk()
        const res = await cancel(d.id)
        expect(res.status).toBe(200)
        expect(GamificationDrawSchema.parse(dataOf(res))).toEqual({ ...d, status: 'cancelled' })
        expect((await stored(d.id)).cancelled_at).not.toBeNull()
        expect(await t.db.query(`select 1 from coin_ledger where source = 'cabutan_refund' and source_id like $1`, [`draw:${d.id}:%`])).toEqual([])
        const [ev] = await t.db.query<{ detail: Record<string, unknown> }>(`select detail from audit_events where action = 'gamification.draw.cancelled' and target_id = $1`, [d.id])
        expect(ev!.detail).toMatchObject({ from: 'draft', refundedTickets: 0, refundedSyiling: 0 })
      })

      it('a drawn draw cannot be cancelled: 409, no refund, status unchanged', async () => {
        const d = await mk({ openNow: true })
        const [u] = await sell(d.id, [1])
        await admin.post(`/admin/reward-control/draws/${d.id}/close`)
        dataOf(await admin.post(`/admin/reward-control/draws/${d.id}/winners`))
        fail(await cancel(d.id), 409, 'CONFLICT')
        expect((await stored(d.id)).status).toBe('drawn')
        expect(await refunds(u!)).toEqual([])
        expect((await walletOf(t, u!))!.current_syiling).toBe(100 - PRICE)
      })

      it('a draw priced 0 cancels without refund rows (the wallet credit refuses 0)', async () => {
        const d = await mk({ openNow: true })
        const [u] = await sell(d.id, [1])
        await t.db.query(`update draws set ticket_cost_syiling = 0 where id = $1`, [d.id])
        expect(GamificationDrawSchema.parse(dataOf(await cancel(d.id))).status).toBe('cancelled')
        expect(await refunds(u!)).toEqual([])
      })

      it('a failing refund rolls everything back: the draw keeps its state, no refund row, no audit event (one transaction)', async () => {
        const d = await mk({ openNow: true })
        const users = await sell(d.id, [1, 1])
        const wallet = t.app.get(WalletService)
        const real = wallet.credit.bind(wallet)
        let calls = 0
        const spy = vi.spyOn(wallet, 'credit').mockImplementation((...args) => {
          calls += 1
          if (calls === 2) throw new Error('ledger down')
          return real(...args)
        })
        try {
          expect((await cancel(d.id)).status).toBe(500)
        } finally {
          spy.mockRestore()
        }
        expect((await stored(d.id)).status).toBe('open')
        for (const u of users) expect(await refunds(u)).toEqual([])
        expect(await t.db.query(`select 1 from audit_events where action = 'gamification.draw.cancelled' and target_id = $1`, [d.id])).toEqual([])
        expect(GamificationDrawSchema.parse(dataOf(await cancel(d.id))).status).toBe('cancelled')
      })

      it('404 for an unknown or non-numeric id; the route takes no body; only an admin (a pupil gets 403) and CSRF is required', async () => {
        fail(await cancel('999999'), 404, 'NOT_FOUND')
        fail(await cancel('abc'), 404, 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
        const d = await mk()
        const student = await signIn(t, STUDENT_MAJU)
        fail(await student.post(`/admin/reward-control/draws/${d.id}/cancel`), 403, 'FORBIDDEN')
        fail(await admin.noCsrfPost(`/admin/reward-control/draws/${d.id}/cancel`), 403, 'CSRF_INVALID')
        expect((await stored(d.id)).status).toBe('draft')
        expect(GamificationDrawSchema.parse(dataOf(await admin.post(`/admin/reward-control/draws/${d.id}/cancel`, { status: 'drawn' }))).status).toBe('cancelled')
      })

      it('a cancelled draw cannot be opened, closed, drawn or edited, and is listed as cancelled', async () => {
        const d = await mk()
        await cancel(d.id)
        fail(await admin.post(`/admin/reward-control/draws/${d.id}/open`), 409, 'CONFLICT')
        fail(await admin.post(`/admin/reward-control/draws/${d.id}/close`), 409, 'CONFLICT')
        fail(await admin.post(`/admin/reward-control/draws/${d.id}/winners`), 409, 'CONFLICT')
        fail(await admin.put(`/admin/reward-control/draws/${d.id}`, edit), 409, 'CONFLICT')
        expect(dataOf<{ id: string; status: string }[]>(await admin.get('/admin/reward-control/draws')).find((x) => x.id === d.id)!.status).toBe('cancelled')
      })
    })
  })
})
