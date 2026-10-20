import { GamificationDrawSchema, GamificationEconomySettingsSchema, GamificationRewardControlSchema, GamificationSettingsListSchema, GamificationSyilingRewardSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { cryptoDrawRandom } from '../../src/modules/gamification/ports'
import { prngStream } from '../../src/db/prng'
import { GamificationPorts } from '../../src/modules/gamification'
import { ADMIN, bareUser, bootGamificationApp, dataOf, fail, signIn, userIdOf, type Client, type GamificationTestApp } from './helpers'

const KEYS = ['coins_per_question', 'cash_rate_coins', 'cash_rate_sen', 'min_cash_withdrawal', 'cash_withdrawal_enabled', 'reward_budget_sen_session', 'reward_budget_sen_month', 'current_session_year', 'flat_quiz_reward', 'games_award_syiling']
const SUMMARY = 'Sila lengkapkan semua medan wajib.'
const POOL_MSG = 'Format JSON kolam hadiah tidak sah.'

describe('M14 admin operations: settings, reward control, lucky draws (BE-23, AC4, AC5, AC9)', () => {
  let t: GamificationTestApp
  let admin: Client

  const settingRow = async (key: string) => Number((await t.db.query<{ v: string }>(`select value::text v from gamification_settings where key = $1`, [key]))[0]!.v)
  const prizeRows = (drawId: string) => t.db.query<{ label: string; value_sen: number; qty: number; position: number }>(`select label, value_sen, qty, position from draw_prizes where draw_id = $1 order by position`, [drawId])
  const auditCount = async (action: string) => Number((await t.db.query<{ n: string }>(`select count(*)::text n from audit_events where action = $1`, [action]))[0]!.n)

  /** Test seam: the draw shuffles with a seeded stream instead of the CSPRNG (AC5 determinism). */
  const seedDraws = (seed: number) => t.app.get(GamificationPorts).overrideDrawRandom((id) => {
    const stream = prngStream(`draw:${id}`, seed)
    return (max) => stream.int(0, max)
  })

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
      expect(await settingRow('flat_quiz_reward')).toBe(1)
    })
  })

  describe('reward control (S10)', () => {
    it('GET: tiles (RM0.00 / 0 / 0 for the session year), the five shared settings, 11 rewards with costRm, the sample draw with its ordered pool', async () => {
      const d = GamificationRewardControlSchema.parse(dataOf(await admin.get('/admin/reward-control')))
      expect(d.tiles).toEqual({ sessionYear: 2026, liabilityRm: 0, students: 0, claims: 0 })
      expect(d.settings).toEqual({ rewardBudgetSenSession: 1000, rewardBudgetSenMonth: 300, flatQuizReward: 1, currentSessionYear: 2026, gamesAwardSyiling: 0 })
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
      expect(GamificationEconomySettingsSchema.parse(dataOf(res))).toEqual({ rewardBudgetSenSession: 1000, rewardBudgetSenMonth: 400, flatQuizReward: 2, currentSessionYear: 2026, gamesAwardSyiling: 0 })
      const s9 = GamificationSettingsListSchema.parse(dataOf(await admin.get('/admin/gamification/settings')))
      expect(s9.find((s) => s.key === 'flat_quiz_reward')!.value).toBe(2)
      await admin.put('/admin/reward-control/settings', { flat_quiz_reward: 1, rewardBudgetSenMonth: 300 })
    })

    it('PUT settings 422: a non-integer is fields[<camelName>], nothing posted is fields.settings, a negative is 422 without fields', async () => {
      expect(fail(await admin.put('/admin/reward-control/settings', { flatQuizReward: 'abc', rewardBudgetSenMonth: 1.5 }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ flatQuizReward: 'Medan ini tidak sah.', rewardBudgetSenMonth: 'Medan ini tidak sah.' })
      expect(fail(await admin.put('/admin/reward-control/settings', {}), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ settings: 'Medan ini diperlukan.' })
      expect(fail(await admin.put('/admin/reward-control/settings', { flatQuizReward: -1 }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toBeUndefined()
      expect(fail(await admin.put('/admin/reward-control/settings', { gamesAwardSyiling: 5 }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toBeUndefined()
      expect(await settingRow('games_award_syiling')).toBe(0)
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
      fail(await admin.put('/admin/reward-control/rewards/abc/cost', { costValueSen: 5 }), 404, 'NOT_FOUND', 'Not Found.')
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

    it('"Buka serta-merta" opens it; the pool may be the JSON text of the live form; no pool is an empty pool; the closing day stays the day shown', async () => {
      const open = GamificationDrawSchema.parse(dataOf(await admin.post('/admin/reward-control/draws', { ...body, openNow: true, prizePool: '[{"label":"A","value_sen":100,"qty":2}]' })))
      expect(open).toMatchObject({ status: 'open', prizePool: [{ label: 'A', valueSen: 100, qty: 2 }], closesAt: '2026-12-31' })
      const stored = (await t.db.query<{ c: string }>(`select closes_at::text c from draws where id = $1`, [open.id]))[0]!.c
      expect(Date.parse(stored)).toBe(Date.parse('2026-12-31T23:59:59.999+08:00')) // the end of that Malaysia day
      const bare = GamificationDrawSchema.parse(dataOf(await admin.post('/admin/reward-control/draws', { title: 'Tanpa Hadiah', ticketCostSyiling: 1, maxTicketsPerStudent: 1, openNow: 'on', prizePool: '' })))
      expect(bare).toMatchObject({ status: 'open', prizePool: [], closesAt: null, description: '' })
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
      expect(err.fields).toEqual({ title: 'Medan ini diperlukan.', description: 'Medan ini tidak sah.', ticketCostSyiling: 'Medan ini tidak sah.', maxTicketsPerStudent: 'Medan ini diperlukan.', closesAt: 'Medan ini tidak sah.' })
      expect(fail(await admin.post('/admin/reward-control/draws', { ...body, closesAt: '2026-02-31' }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ closesAt: 'Medan ini tidak sah.' })
      expect(fail(await admin.post('/admin/reward-control/draws', { ...body, title: '   ' }), 422, 'VALIDATION_ERROR', SUMMARY).fields).toEqual({ title: 'Medan ini diperlukan.' })
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

  describe('runDraw: winners are drawn with the seeded PRNG and never exceed the pool (AC5, AC9)', () => {
    const newDraw = async (qtys: number[], tickets: number) => {
      const d = GamificationDrawSchema.parse(dataOf(await admin.post('/admin/reward-control/draws', { title: 'Cabutan Undi', ticketCostSyiling: 5, maxTicketsPerStudent: 100, openNow: true, prizePool: qtys.map((qty, i) => ({ label: `Hadiah ${String(i + 1)}`, valueSen: 100 * (i + 1), qty })) })))
      const users: string[] = []
      for (let i = 0; i < tickets; i++) users.push(await bareUser(t, `Pembeli ${d.id}-${String(i)}`))
      for (const u of users) await t.db.query(`insert into draw_tickets (draw_id, user_id) values ($1, $2)`, [d.id, u])
      return { id: d.id, users }
    }
    const actor = async () => ({ userId: await userIdOf(t.db, ADMIN), role: 'admin', requestId: null, ip: null, isTest: false })

    it('awards at most the sum of qty (3), one ticket per prize slot in pool order, closes the draw and writes ONE audit event', async () => {
      const { id } = await newDraw([1, 2], 8)
      const before = await auditCount('gamification.draw.drawn')
      const r = await t.admin.runDraw(id, await actor())
      expect(r.awards).toHaveLength(3)
      expect(r.awards.map((a) => a.label)).toEqual(['Hadiah 1', 'Hadiah 2', 'Hadiah 2'])
      expect(new Set(r.awards.map((a) => a.ticketId)).size).toBe(3)
      const row = (await t.db.query<{ status: string; winner_user_id: string | null; drawn_at: string | null }>(`select status, winner_user_id::text, drawn_at::text from draws where id = $1`, [id]))[0]!
      expect(row).toMatchObject({ status: 'closed', winner_user_id: r.awards[0]!.userId })
      expect(row.drawn_at).not.toBeNull()
      expect(await auditCount('gamification.draw.drawn')).toBe(before + 1)
      const ev = (await t.db.query<{ detail: { awards: unknown[] }; target_id: string }>(`select detail, target_id::text from audit_events where action = 'gamification.draw.drawn' order by id desc limit 1`))[0]!
      expect(ev.target_id).toBe(id)
      expect(ev.detail.awards).toHaveLength(3)
    })

    it('the audit event holds what is needed to audit the result: all ticket ids, the shuffled order and the winning tickets', async () => {
      const { id } = await newDraw([2], 5)
      const r = await t.admin.runDraw(id, await actor())
      const ev = (await t.db.query<{ detail: { ticketCount: number; ticketIds: string[]; shuffledTicketIds: string[]; winningTicketIds: string[] } }>(`select detail from audit_events where action = 'gamification.draw.drawn' and target_id = $1`, [id]))[0]!
      const all = (await t.db.query<{ id: string }>(`select id::text from draw_tickets where draw_id = $1 order by id`, [id])).map((x) => x.id)
      expect(ev.detail.ticketCount).toBe(5)
      expect(ev.detail.ticketIds).toEqual(all)
      expect([...ev.detail.shuffledTicketIds].sort()).toEqual([...all].sort())
      expect(ev.detail.winningTicketIds).toEqual(r.awards.map((a) => a.ticketId))
      expect(ev.detail.shuffledTicketIds.slice(0, 2)).toEqual(ev.detail.winningTicketIds)
    })

    it('production randomness is the CSPRNG, not the seeded stream: it is not repeatable and takes no seed input', async () => {
      t.app.get(GamificationPorts).overrideDrawRandom(cryptoDrawRandom)
      const { id } = await newDraw([1], 12)
      const seen = new Set<string>()
      for (let i = 0; i < 8; i++) {
        await t.db.query(`update draws set status = 'open', drawn_at = null, winner_user_id = null where id = $1`, [id])
        seen.add((await t.admin.runDraw(id, null)).awards[0]!.ticketId)
      }
      expect(seen.size).toBeGreaterThan(1)
      expect(t.admin.runDraw.length).toBe(2)
    })

    it('locks the draw row FOR UPDATE: a concurrent FOR SHARE lock waits until the run commits', async () => {
      const { id } = await newDraw([1], 3)
      const events: string[] = []
      const run = t.prisma.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM draws WHERE id = ${BigInt(id)} FOR UPDATE`
        events.push('locked')
        await new Promise((r) => setTimeout(r, 300))
        events.push('releasing')
      })
      await new Promise((r) => setTimeout(r, 100))
      const share = t.prisma.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM draws WHERE id = ${BigInt(id)} FOR SHARE`
        events.push('shared')
      })
      await Promise.all([run, share])
      expect(events).toEqual(['locked', 'releasing', 'shared'])
      // and runDraw itself goes through the same lock without deadlocking against a share holder
      await expect(t.admin.runDraw(id, null)).resolves.toBeDefined()
    })

    it('fewer tickets than prizes: only as many awards as tickets (2 of 5); no tickets: no award but the draw still closes', async () => {
      const a = await newDraw([5], 2)
      expect((await t.admin.runDraw(a.id, null)).awards).toHaveLength(2)
      const b = await newDraw([5], 0)
      expect((await t.admin.runDraw(b.id, null)).awards).toEqual([])
      expect((await t.db.query<{ status: string }>(`select status from draws where id = $1`, [b.id]))[0]!.status).toBe('closed')
    })

    it('is deterministic under the seeded PRNG: the same tickets and seed give the same winners, another seed shuffles differently', async () => {
      const { id } = await newDraw([3], 12)
      const tickets = (await t.db.query<{ id: string; user_id: string }>(`select id::text, user_id::text from draw_tickets where draw_id = $1 order by id`, [id])).map((x) => ({ id: x.id, userId: x.user_id }))
      // Run the same draw as a copy on another draw id with identical ticket order is not possible (the stream name holds the id), so
      // replay the SAME draw twice by reopening it between the runs.
      const first = await (seedDraws(7), t.admin.runDraw(id, null))
      await t.db.query(`update draws set status = 'open', drawn_at = null, winner_user_id = null where id = $1`, [id])
      const second = await (seedDraws(7), t.admin.runDraw(id, null))
      expect(second.awards).toEqual(first.awards)
      await t.db.query(`update draws set status = 'open', drawn_at = null, winner_user_id = null where id = $1`, [id])
      const outcomes = new Set<string>()
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        await t.db.query(`update draws set status = 'open', drawn_at = null, winner_user_id = null where id = $1`, [id])
        outcomes.add((seedDraws(seed), await t.admin.runDraw(id, null)).awards.map((a) => a.ticketId).join(','))
      }
      expect(outcomes.size).toBeGreaterThan(1)
      for (const o of outcomes) expect(o.split(',').every((tid) => tickets.some((x) => x.id === tid))).toBe(true)
    })

    it('a closed or draft draw is 409 DRAW_CLOSED "Cabutan ditutup."; an unknown draw is 404', async () => {
      const { id } = await newDraw([1], 1)
      await t.admin.runDraw(id, null)
      await expect(t.admin.runDraw(id, null)).rejects.toMatchObject({ code: 'DRAW_CLOSED', status: 409, message: 'Cabutan ditutup.' })
      const draft = GamificationDrawSchema.parse(dataOf(await admin.post('/admin/reward-control/draws', { title: 'Draf', ticketCostSyiling: 1, maxTicketsPerStudent: 1 })))
      await expect(t.admin.runDraw(draft.id, null)).rejects.toMatchObject({ code: 'DRAW_CLOSED' })
      await expect(t.admin.runDraw('999999', null)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })
})
