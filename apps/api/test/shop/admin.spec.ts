import {
  RewardBulkResultSchema,
  RewardCancelResultSchema,
  RewardDeliverResultSchema,
  RewardItemSchema,
  RewardListResponseSchema,
  RewardRedemptionListResponseSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, STUDENT, STUDENT_2, STUDENT_MAJU, TEACHER, actorFor, apiOf, bootShopApp, expectError, fund, insertReward, login, stockOf, userIdOf, walletRow, type Api, type ShopTestApp } from './helpers'

const MINIMAL = { category: 'ewallet', vendor: 'Vendor Ujian', title: 'Baucar Baharu', denominationRm: 10, tokenCost: 12 }

describe('M15 admin routes (BE-23)', () => {
  let t: ShopTestApp
  let admin: Api
  beforeAll(async () => {
    t = await bootShopApp()
    admin = apiOf(await login(t, ADMIN))
  })
  afterAll(async () => {
    await t.close()
  })

  /** A pending_admin redemption of `who` for a fresh reward. */
  async function redemption(who: string, o: { tokenCost?: number; stock?: number | null; validityDays?: number; consent?: boolean } = {}) {
    const uid = await userIdOf(t.db, who)
    const cost = o.tokenCost ?? 6
    const key = `adm-${String(Math.random()).slice(2)}` // fixture key only
    await fund(t, uid, { tokens: cost }, key)
    const reward = await insertReward(t, { tokenCost: cost, stock: o.stock === undefined ? 5 : o.stock, validityDays: o.validityDays ?? 30, consent: o.consent ?? false })
    const r = await t.shop.redeem(actorFor(uid), { rewardId: reward })
    return { uid, reward, id: r.id, cost }
  }

  describe('guards', () => {
    const routes: [string, string][] = [
      ['get', '/admin/hadiah'],
      ['get', '/admin/hadiah/1'],
      ['get', '/admin/hadiah/redemptions'],
      ['post', '/admin/hadiah'],
      ['post', '/admin/hadiah/bulk'],
      ['put', '/admin/hadiah/1'],
      ['post', '/admin/hadiah/redemptions/1/cancel'],
      ['post', '/admin/hadiah/redemptions/1/deliver'],
    ]
    it.each(routes)('%s %s: anonymous 401, student and teacher 403', async (method, path) => {
      const call = (a: { agent: ReturnType<ShopTestApp['agent']>; csrf: string } | null) => {
        const agent = a ? a.agent : t.agent()
        const req = (agent as unknown as Record<string, (u: string) => { set: (k: string, v: string) => { send: (b: object) => Promise<import('supertest').Response> } } & Promise<import('supertest').Response>>)[method]!(`/api${path}`)
        return a && method !== 'get' ? req.set('X-CSRF-Token', a.csrf).send({}) : (req as unknown as Promise<import('supertest').Response>)
      }
      expectError(await call(null), 401, 'UNAUTHORIZED')
      for (const who of [STUDENT, TEACHER]) expectError(await call(await login(t, who)), 403, 'FORBIDDEN', 'This action is unauthorized.')
    })

    it('an admin in Mod Pelajar acts as a student: 403', async () => {
      const me = await login(t, ADMIN)
      const entered = await me.agent.post('/api/session/mode').set('X-CSRF-Token', me.csrf).send({ mode: 'mod_pelajar' })
      const api = apiOf({ ...me, csrf: entered.body.data.csrf })
      expectError(await api.get('/admin/hadiah'), 403, 'FORBIDDEN')
      expectError(await api.post('/admin/hadiah/bulk', {}), 403, 'FORBIDDEN')
    })

    it.each([
      ['post', '/admin/hadiah'],
      ['post', '/admin/hadiah/bulk'],
      ['put', '/admin/hadiah/1'],
      ['post', '/admin/hadiah/redemptions/1/cancel'],
      ['post', '/admin/hadiah/redemptions/1/deliver'],
    ])('%s %s without the CSRF header is 403 CSRF_INVALID', async (method, path) => {
      const me = await login(t, ADMIN)
      const res = await (me.agent as unknown as Record<string, (u: string) => { send: (b: object) => Promise<import('supertest').Response> }>)[method]!(`/api${path}`).send({})
      expectError(res, 403, 'CSRF_INVALID')
    })

    it('the parent approval routes do not exist (UD-3): 404', async () => {
      expect((await admin.get('/parent/hadiah-approvals')).status).toBe(404)
    })

    it('answers 429 past the admin write ceiling', async () => {
      const limited = await bootShopApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '2' } })
      try {
        const api = apiOf(await login(limited, ADMIN))
        await api.post('/admin/hadiah/bulk', {})
        await api.post('/admin/hadiah/bulk', {})
        expectError(await api.post('/admin/hadiah/bulk', {}), 429, 'RATE_LIMITED')
      } finally {
        await limited.close()
      }
    })
  })

  describe('GET /admin/hadiah and /admin/hadiah/:id', () => {
    it('pages by 50 in displayOrder then id with the four cards (the 59 seeded rewards are all inactive)', async () => {
      const res = await admin.get('/admin/hadiah')
      expect(res.headers['cache-control']).toBe('no-store')
      const list = RewardListResponseSchema.parse(res.body)
      expect(list.data).toHaveLength(50)
      expect(list.meta).toMatchObject({ page: 1, pageSize: 50, totalItems: 59, totalPages: 2, from: 1, to: 50, activeCat: 'all' })
      expect(list.meta.cards).toMatchObject({ total: 59, active: 0, redemptionsThisMonth: 0, pendingAdmin: 0 })
      const order = list.data.map((r) => r.id)
      const second = RewardListResponseSchema.parse((await admin.get('/admin/hadiah?page=2')).body)
      expect(second.data).toHaveLength(9)
      expect(new Set([...order, ...second.data.map((r) => r.id)]).size).toBe(59)
      expect(list.data[0]!.categoryLabel).toMatch(/\S/)
    })

    it('filters by category, the cards ignore the filter, an unknown key lists nothing with activeCat null, a bad page reads as 1, a page past the end is empty', async () => {
      const all = RewardListResponseSchema.parse((await admin.get('/admin/hadiah')).body)
      const cat = all.data[0]!.category
      const filtered = RewardListResponseSchema.parse((await admin.get(`/admin/hadiah?cat=${cat}`)).body)
      expect(filtered.meta.activeCat).toBe(cat)
      expect(filtered.data.every((r) => r.category === cat)).toBe(true)
      expect(filtered.meta.cards.total).toBe(59)
      const unknown = RewardListResponseSchema.parse((await admin.get('/admin/hadiah?cat=nope')).body)
      expect(unknown.data).toEqual([])
      expect(unknown.meta).toMatchObject({ activeCat: null, totalItems: 0 })
      expect(RewardListResponseSchema.parse((await admin.get('/admin/hadiah?page=abc')).body).meta.page).toBe(1)
      const beyond = RewardListResponseSchema.parse((await admin.get('/admin/hadiah?page=9')).body)
      expect(beyond.data).toEqual([])
      expect(beyond.meta).toMatchObject({ page: 9, from: null, to: null })
      expect(RewardListResponseSchema.parse((await admin.get('/admin/hadiah?cat=all')).body).meta.activeCat).toBe('all')
    })

    it('reads one reward in the edit shape; unknown and non-numeric ids are 404 Not Found.', async () => {
      const id = await insertReward(t, { title: 'Baucar Baca', stock: 4, maxPerMonth: 2 })
      const res = await admin.get(`/admin/hadiah/${id}`)
      expect(res.status).toBe(200)
      const item = RewardItemSchema.parse(res.body.data)
      expect(item).toMatchObject({ id, title: 'Baucar Baca', stockQuantity: 4, maxPerMonthPerStudent: 2, denominationRm: 10, imageUrl: null, isActive: true })
      expectError(await admin.get('/admin/hadiah/999999'), 404, 'NOT_FOUND', 'Not Found.')
      expectError(await admin.get('/admin/hadiah/abc'), 404, 'NOT_FOUND', 'Not Found.')
    })

    it('does not read the static path "redemptions" as an id', async () => {
      const res = await admin.get('/admin/hadiah/redemptions')
      expect(res.status).toBe(200)
      RewardRedemptionListResponseSchema.parse(res.body)
    })
  })

  describe('POST /admin/hadiah and PUT /admin/hadiah/:id', () => {
    it('creates with the defaults, 201, one audit event, tolerant of digit strings', async () => {
      const res = await admin.post('/admin/hadiah', MINIMAL)
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const item = RewardItemSchema.parse(res.body.data)
      expect(item).toMatchObject({ voucherValidityDays: 365, deliveryMethod: 'manual', displayOrder: 100, isActive: true, requiresParentConsent: false, stockQuantity: null, maxPerMonthPerStudent: null, description: null })
      const audit = await t.db.query<{ action: string; target_type: string; target_id: string }>(`select action, target_type, target_id from audit_events where action = 'shop.reward.created'`)
      expect(audit.at(-1)).toEqual({ action: 'shop.reward.created', target_type: 'reward', target_id: item.id })
      const digits = await admin.post('/admin/hadiah', { ...MINIMAL, denominationRm: '25', tokenCost: '30', stockQuantity: '3' })
      expect(RewardItemSchema.parse(digits.body.data)).toMatchObject({ denominationRm: 25, tokenCost: 30, stockQuantity: 3 })
    })

    it('stores imageUrl (http/https only) and returns it on create, read and replace', async () => {
      const res = await admin.post('/admin/hadiah', { ...MINIMAL, imageUrl: 'https://cdn.example.test/a.png' })
      expect(RewardItemSchema.parse(res.body.data).imageUrl).toBe('https://cdn.example.test/a.png')
      const id = res.body.data.id as string
      expect(RewardItemSchema.parse((await admin.get(`/admin/hadiah/${id}`)).body.data).imageUrl).toBe('https://cdn.example.test/a.png')
      expect(RewardItemSchema.parse((await admin.put(`/admin/hadiah/${id}`, MINIMAL)).body.data).imageUrl).toBeNull()
      for (const bad of ['javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://x']) {
        expect(expectError(await admin.post('/admin/hadiah', { ...MINIMAL, imageUrl: bad }), 422, 'VALIDATION_ERROR').fields).toEqual({ imageUrl: 'The image url field must be a valid URL.' })
      }
    })

    it('422 with a field per problem and the Laravel-style summary; nothing is created', async () => {
      const before = (await t.db.query<{ n: string }>(`select count(*)::text as n from rewards`))[0]!.n
      const res = await admin.post('/admin/hadiah', { category: 'nope', title: 'x'.repeat(201), denominationRm: 0, tokenCost: 10001, maxPerMonthPerStudent: 100, voucherValidityDays: 1826, displayOrder: 10000, imageUrl: 'ftp://x' })
      const e = expectError(res, 422, 'VALIDATION_ERROR')
      expect(Object.keys(e.fields ?? {}).sort()).toEqual(['category', 'denominationRm', 'displayOrder', 'imageUrl', 'maxPerMonthPerStudent', 'title', 'tokenCost', 'vendor', 'voucherValidityDays'])
      expect(e.fields!.category).toBe('The selected category is invalid.')
      expect(e.fields!.vendor).toBe('The vendor field is required.')
      expect(e.message).toBe('The selected category is invalid. (and 8 more errors)')
      expect((await t.db.query<{ n: string }>(`select count(*)::text as n from rewards`))[0]!.n).toBe(before)
    })

    it('replaces a reward (omitted optional fields fall back to their defaults); unknown id 404 before the body is checked', async () => {
      const id = await insertReward(t, { stock: 2, maxPerMonth: 3 })
      const res = await admin.put(`/admin/hadiah/${id}`, { ...MINIMAL, title: 'Tajuk Baharu', isActive: false })
      expect(res.status).toBe(200)
      expect(RewardItemSchema.parse(res.body.data)).toMatchObject({ id, title: 'Tajuk Baharu', isActive: false, stockQuantity: null, maxPerMonthPerStudent: null, displayOrder: 100 })
      expectError(await admin.put('/admin/hadiah/999999', {}), 404, 'NOT_FOUND', 'Not Found.')
      expectError(await admin.put(`/admin/hadiah/${id}`, {}), 422, 'VALIDATION_ERROR')
      expect((await t.db.query(`select 1 from audit_events where action = 'shop.reward.updated' and target_id = $1`, [id]))).toHaveLength(1)
    })
  })

  describe('POST /admin/hadiah/bulk', () => {
    it('activates, deactivates, sets stock, monthly cap and token cost; unknown ids are ignored; one audit event per call', async () => {
      const a = await insertReward(t, { tokenCost: 10, active: false })
      const b = await insertReward(t, { tokenCost: 7, active: false })
      const call = async (body: object) => RewardBulkResultSchema.parse((await admin.post('/admin/hadiah/bulk', body)).body.data)
      expect(await call({ action: 'activate', ids: [a, b, '999999', a] })).toEqual({ affected: 2 })
      expect((await t.db.query<{ n: string }>(`select count(*)::text n from rewards where id in ($1, $2) and is_active`, [a, b]))[0]!.n).toBe('2')
      expect(await call({ action: 'deactivate', ids: [a] })).toEqual({ affected: 1 })
      expect(await call({ action: 'set_stock', ids: [a, b], stockValue: '12' })).toEqual({ affected: 2 })
      expect(await stockOf(t, a)).toBe(12)
      await call({ action: 'set_stock', ids: [a], stockValue: '' })
      expect(await stockOf(t, a)).toBeNull()
      await call({ action: 'set_max_per_month', ids: [a, b], maxPerMonthValue: '2' })
      await call({ action: 'set_max_per_month', ids: [b], maxPerMonthValue: '0' })
      const caps = await t.db.query<{ id: string; max_per_month_per_student: number | null }>(`select id::text, max_per_month_per_student from rewards where id in ($1, $2) order by id`, [a, b])
      expect(caps.map((c) => c.max_per_month_per_student)).toEqual([2, null])
      await call({ action: 'set_token_cost', ids: [a, b], tokenCostDeltaPct: '50%' }) // 10 -> 15, 7 -> 10.5 -> 11 (half up)
      const costs = await t.db.query<{ token_cost: number; denomination_rm: string }>(`select token_cost, denomination_rm::text from rewards where id in ($1, $2) order by id`, [a, b])
      expect(costs.map((c) => c.token_cost)).toEqual([15, 11])
      expect(costs.every((c) => c.denomination_rm === '10.00')).toBe(true)
      await call({ action: 'set_token_cost', ids: [a], tokenCostDeltaPct: '-90' })
      expect((await t.db.query<{ token_cost: number }>(`select token_cost from rewards where id = $1`, [a]))[0]!.token_cost).toBe(1) // the mock's float arithmetic: 15 * (1 - 0.9) + 0.5 = 1.9999999 -> 1 (kept as is)
      expect(await t.db.query(`select 1 from audit_events where action = 'shop.reward.bulk_action'`)).not.toHaveLength(0)
    })

    it('deletes rewards without redemptions and keeps those with any (keptIds)', async () => {
      const free = await insertReward(t)
      const used = await redemption(STUDENT)
      const res = await admin.post('/admin/hadiah/bulk', { action: 'delete', ids: [free, used.reward] })
      expect(RewardBulkResultSchema.parse(res.body.data)).toEqual({ affected: 1, keptIds: [used.reward] })
      expect(await t.db.query(`select 1 from rewards where id = $1`, [free])).toHaveLength(0)
      expect(await t.db.query(`select 1 from rewards where id = $1`, [used.reward])).toHaveLength(1)
    })

    it('422 for an unknown action, empty or bad ids and bad values', async () => {
      const f = async (body: object) => expectError(await admin.post('/admin/hadiah/bulk', body), 422, 'VALIDATION_ERROR').fields
      expect(await f({ action: 'nope', ids: ['1'] })).toEqual({ action: 'The selected action is invalid.' })
      expect(await f({ ids: ['1'] })).toEqual({ action: 'The action field is required.' })
      expect(await f({ action: 'activate', ids: [] })).toEqual({ ids: 'The ids field is required.' })
      expect(await f({ action: 'activate', ids: ['0'] })).toEqual({ ids: 'The ids field must contain positive integers.' })
      expect(await f({ action: 'set_stock', ids: ['1'], stockValue: '1000000' })).toEqual({ stockValue: 'The stock value must be 0-999999 or empty.' })
      expect(await f({ action: 'set_max_per_month', ids: ['1'], maxPerMonthValue: '100' })).toEqual({ maxPerMonthValue: 'The max per month value must be 0-99 or empty.' })
      expect(await f({ action: 'set_token_cost', ids: ['1'], tokenCostDeltaPct: '0' })).toEqual({ tokenCostDeltaPct: 'The token cost adjustment must be between -90 and 500 (not 0).' })
      expect(await f({ action: 'set_token_cost', ids: ['1'], tokenCostDeltaPct: '501' })).toEqual({ tokenCostDeltaPct: 'The token cost adjustment must be between -90 and 500 (not 0).' })
    })
  })

  describe('GET /admin/hadiah/redemptions', () => {
    it('defaults to pending_admin newest first with the user and the snapshot; status filters; unknown status is empty with activeStatus null', async () => {
      const first = await redemption(STUDENT)
      t.clock.advance(60_000)
      const second = await redemption(STUDENT_MAJU)
      const list = RewardRedemptionListResponseSchema.parse((await admin.get('/admin/hadiah/redemptions')).body)
      expect(list.meta.activeStatus).toBe('pending_admin')
      const ids = list.data.map((r) => r.id)
      expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id))
      const row = list.data.find((r) => r.id === first.id)!
      expect(row).toMatchObject({ user: { id: first.uid, email: STUDENT }, rewardId: first.reward, tokenCost: 6, denominationRm: 10, status: 'pending_admin', rewardVendor: 'Vendor Ujian' })
      expect(row.user.name.length).toBeGreaterThan(0)
      const none = RewardRedemptionListResponseSchema.parse((await admin.get('/admin/hadiah/redemptions?status=delivered')).body)
      expect(none.meta.activeStatus).toBe('delivered')
      expect(none.data.every((r) => r.status === 'delivered')).toBe(true)
      expect(RewardRedemptionListResponseSchema.parse((await admin.get('/admin/hadiah/redemptions?status=all')).body).meta.activeStatus).toBe('all')
      const unknown = RewardRedemptionListResponseSchema.parse((await admin.get('/admin/hadiah/redemptions?status=nope')).body)
      expect(unknown).toMatchObject({ data: [], meta: { activeStatus: null, totalItems: 0 } })
      const cards = RewardListResponseSchema.parse((await admin.get('/admin/hadiah')).body).meta.cards
      expect(cards.pendingAdmin).toBeGreaterThanOrEqual(2)
      expect(cards.redemptionsThisMonth).toBeGreaterThanOrEqual(2)
    })
  })

  describe('deliver and cancel', () => {
    it('delivers: trimmed code stored, expiresAt = now + validity days, 409 the second time, the code is never returned or audited', async () => {
      const r = await redemption(STUDENT, { validityDays: 30 })
      const res = await admin.post(`/admin/hadiah/redemptions/${r.id}/deliver`, { code: '  KOD-RAHSIA-123  ' })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const data = RewardDeliverResultSchema.parse(res.body.data)
      expect(data).toMatchObject({ id: r.id, status: 'delivered' })
      expect(JSON.stringify(res.body)).not.toContain('KOD-RAHSIA-123')
      const now = t.clock.now().getTime()
      expect(Date.parse(data.expiresAt) - Date.parse(data.deliveredAt)).toBe(30 * 86_400_000)
      expect(Math.abs(Date.parse(data.deliveredAt) - now)).toBeLessThan(1000)
      const [row] = await t.db.query<{ status: string; voucher_code: string }>(`select status, voucher_code from reward_redemptions where id = $1`, [r.id])
      expect(row).toEqual({ status: 'delivered', voucher_code: 'KOD-RAHSIA-123' })
      expectError(await admin.post(`/admin/hadiah/redemptions/${r.id}/deliver`, { code: 'LAIN' }), 409, 'CONFLICT', 'Tebusan ini tidak lagi menunggu pemprosesan.')
      const audit = await t.db.query<{ detail: unknown }>(`select to_jsonb(a) as detail from audit_events a where action = 'shop.redemption.delivered' and target_id = $1`, [r.id])
      expect(audit).toHaveLength(1)
      expect(JSON.stringify(audit[0]!.detail)).not.toContain('KOD-RAHSIA-123')
    })

    it('deliver: 404 unknown id (even with a bad body), 422 for a blank or 101-character code', async () => {
      expectError(await admin.post('/admin/hadiah/redemptions/999999/deliver', {}), 404, 'NOT_FOUND', 'Not Found.')
      expectError(await admin.post('/admin/hadiah/redemptions/abc/deliver', { code: 'X' }), 404, 'NOT_FOUND', 'Not Found.')
      const r = await redemption(STUDENT_2)
      expect(expectError(await admin.post(`/admin/hadiah/redemptions/${r.id}/deliver`, {}), 422, 'VALIDATION_ERROR').fields).toEqual({ code: 'The code field is required.' })
      expect(expectError(await admin.post(`/admin/hadiah/redemptions/${r.id}/deliver`, { code: '   ' }), 422, 'VALIDATION_ERROR').fields).toEqual({ code: 'The code field is required.' })
      expect(expectError(await admin.post(`/admin/hadiah/redemptions/${r.id}/deliver`, { code: 'x'.repeat(101) }), 422, 'VALIDATION_ERROR').fields).toEqual({ code: 'The code field must not be greater than 100 characters.' })
      expect((await t.db.query<{ status: string }>(`select status from reward_redemptions where id = $1`, [r.id]))[0]!.status).toBe('pending_admin')
    })

    it('cancels once: tokens refunded to the student through the wallet, reserved stock released, audit written; a second cancel is 409 and refunds nothing', async () => {
      const r = await redemption(STUDENT_MAJU, { tokenCost: 9, stock: 3 })
      const spent = await walletRow(t, r.uid)
      expect(await stockOf(t, r.reward)).toBe(2)
      const res = await admin.post(`/admin/hadiah/redemptions/${r.id}/cancel`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(RewardCancelResultSchema.parse(res.body.data)).toEqual({ id: r.id, status: 'cancelled', refundedTokens: 9 })
      expect((await walletRow(t, r.uid)).tokens).toBe(spent.tokens + 9)
      expect(await stockOf(t, r.reward)).toBe(3)
      const [row] = await t.db.query<{ status: string; cancelled_by: string; stock_reserved: boolean }>(`select status, cancelled_by, stock_reserved from reward_redemptions where id = $1`, [r.id])
      expect(row).toEqual({ status: 'cancelled', cancelled_by: 'admin', stock_reserved: false })
      const refund = await t.db.query<{ delta: number; ref_id: string }>(`select delta, ref_id from token_movements where user_id = $1 and source = 'hadiah_refund'`, [r.uid])
      expect(refund).toEqual([{ delta: 9, ref_id: `redemption:${r.id}` }])
      expectError(await admin.post(`/admin/hadiah/redemptions/${r.id}/cancel`), 409, 'CONFLICT', 'Tebusan ini tidak lagi menunggu pemprosesan.')
      expect((await walletRow(t, r.uid)).tokens).toBe(spent.tokens + 9)
      expect(await t.db.query(`select 1 from audit_events where action = 'shop.redemption.cancelled' and target_id = $1`, [r.id])).toHaveLength(1)
    })

    it('cancel does not touch unlimited stock; a delivered row cannot be cancelled; unknown id is 404 Tebusan tidak dijumpai.', async () => {
      const r = await redemption(STUDENT, { stock: null })
      await admin.post(`/admin/hadiah/redemptions/${r.id}/cancel`)
      expect(await stockOf(t, r.reward)).toBeNull()
      const d = await redemption(STUDENT)
      await admin.post(`/admin/hadiah/redemptions/${d.id}/deliver`, { code: 'ABC' })
      expectError(await admin.post(`/admin/hadiah/redemptions/${d.id}/cancel`), 409, 'CONFLICT')
      expectError(await admin.post('/admin/hadiah/redemptions/999999/cancel'), 404, 'NOT_FOUND', 'Tebusan tidak dijumpai.')
      expectError(await admin.post('/admin/hadiah/redemptions/abc/cancel'), 404, 'NOT_FOUND', 'Not Found.')
    })

    it('a redemption waiting for parent consent (parent routes not built, UD-3) can be cancelled with one refund and the reserved stock back, but not delivered', async () => {
      const r = await redemption(STUDENT, { consent: true, tokenCost: 7, stock: 3 })
      expect(await stockOf(t, r.reward)).toBe(2)
      const spent = await walletRow(t, r.uid)
      expectError(await admin.post(`/admin/hadiah/redemptions/${r.id}/deliver`, { code: 'ABC' }), 409, 'CONFLICT')
      const res = await admin.post(`/admin/hadiah/redemptions/${r.id}/cancel`)
      expect(RewardCancelResultSchema.parse(res.body.data)).toEqual({ id: r.id, status: 'cancelled', refundedTokens: 7 })
      expect((await walletRow(t, r.uid)).tokens).toBe(spent.tokens + 7)
      expect(await stockOf(t, r.reward)).toBe(3)
      expectError(await admin.post(`/admin/hadiah/redemptions/${r.id}/cancel`), 409, 'CONFLICT')
      expect((await walletRow(t, r.uid)).tokens).toBe(spent.tokens + 7)
    })
  })
})
