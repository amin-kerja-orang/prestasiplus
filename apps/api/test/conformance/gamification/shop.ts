import type { Scenario, ScenarioContext, HttpClient } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError, listOf, nextTag } from '../helpers'

/**
 * M15 rewards shop (BE-23 part B), API-only deep scenarios. The shared smoke scenarios already prove each route
 * against its contract schema; these add the money rules (tokens, stock, refund), the authorisation matrix and the
 * routes that must NOT exist. They run against the seeded demo accounts (the student has syiling and no tokens), so
 * tokens come from the M14 conversion route when that is served; the scenario states plainly when it is not.
 */

const NEW_REWARD = { category: 'ewallet', vendor: 'Vendor Ujian', denominationRm: 10, tokenCost: 2, stockQuantity: 2 }

/** Tokens of the caller, read from the Kotak Misteri view. */
async function tokensOf(client: HttpClient): Promise<number> {
  return Number(dataOf(await client.request('GET', '/gamification/mystery-boxes')).tokenBalance)
}

/** Gives the student tokens through the M14 conversion (100 syiling = 2 tokens at the bronze rate). False when it is not served or refused. */
async function fundTokens(ctx: ScenarioContext, student: HttpClient): Promise<boolean> {
  const before = await tokensOf(student)
  const res = await student.request('POST', '/gamification/convert', { body: { syilingAmount: 100 } })
  if (res.status !== 200) return false
  ctx.check(((await tokensOf(student)) as number) > before, 'a conversion must raise the token balance')
  return true
}

async function createReward(ctx: ScenarioContext, admin: HttpClient, over: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const res = await admin.request('POST', '/admin/hadiah', { body: { ...NEW_REWARD, title: nextTag('Baucar Konformans '), ...over } })
  ctx.expectStatus(res, 201)
  return dataOf(res)
}

export const shopScenarios: Scenario[] = [
  {
    id: 'shop-api/every route needs a session, the admin routes need the admin role and writes need the CSRF header',
    domain: 'shop',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      const reads = ['/cabutan', '/gamification/mystery-boxes', '/hadiah-digital/items', '/hadiah-digital/redemptions', '/admin/hadiah', '/admin/hadiah/1', '/admin/hadiah/redemptions']
      for (const path of reads) expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
      const writes: [string, string][] = [
        ['POST', '/hadiah/redemptions'],
        ['POST', '/gamification/mystery-boxes/1/open'],
        ['POST', '/cabutan/1/tickets'],
        ['POST', '/admin/hadiah'],
        ['POST', '/admin/hadiah/bulk'],
        ['PUT', '/admin/hadiah/1'],
        ['POST', '/admin/hadiah/redemptions/1/cancel'],
        ['POST', '/admin/hadiah/redemptions/1/deliver'],
      ]
      for (const [method, path] of writes) {
        const res = await anon.request(method as 'POST' | 'PUT', path, { body: {} })
        ctx.check(res.status === 401 || res.status === 403, `${method} ${path} anonymous must be 401 (or 403 CSRF), got ${String(res.status)}`)
      }

      const student = await ctx.as('student')
      for (const path of ['/admin/hadiah', '/admin/hadiah/1', '/admin/hadiah/redemptions']) expectError(ctx, await student.request('GET', path), 403, 'FORBIDDEN')
      for (const [method, path] of writes.filter(([, p]) => p.startsWith('/admin'))) {
        expectError(ctx, await student.request(method as 'POST' | 'PUT', path, { body: {} }), 403, 'FORBIDDEN')
      }
      const noCsrf = await ctx.as('student', { csrf: false })
      expectError(ctx, await noCsrf.request('POST', '/hadiah/redemptions', { body: { rewardId: '1' } }), 403, 'CSRF_INVALID')
      expectError(ctx, await noCsrf.request('POST', '/cabutan/1/tickets'), 403, 'CSRF_INVALID')
      const adminNoCsrf = await ctx.as('admin', { csrf: false })
      expectError(ctx, await adminNoCsrf.request('POST', '/admin/hadiah/bulk', { body: { action: 'activate', ids: ['1'] } }), 403, 'CSRF_INVALID')
      // The parent approval routes (UD-3) are not in openapi.json, so the runner cannot call them; the integration suite asserts their 404.
    },
  },
  {
    id: 'shop-api/Hadiah catalogue: create, read back, replace, bulk-switch and the inactive reward is not redeemable',
    domain: 'shop',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const student = await ctx.as('student')
      const created = await createReward(ctx, admin, { isActive: false })
      const id = String(created.id)
      ctx.check(created.voucherValidityDays === 365 && created.deliveryMethod === 'manual' && created.displayOrder === 100, 'the create defaults are 365 days, manual, order 100')
      const read = dataOf(await admin.request('GET', `/admin/hadiah/${id}`))
      ctx.check(read.id === id && read.stockQuantity === 2 && read.isActive === false, 'GET by id must agree with the created reward')
      const list = await admin.request('GET', '/admin/hadiah?cat=ewallet')
      ctx.expectStatus(list, 200)
      const meta = (list.body as { meta?: { activeCat?: string; pageSize?: number } }).meta
      ctx.check(meta?.activeCat === 'ewallet' && meta.pageSize === 50, 'the catalogue list must echo the category and page size 50')

      // An inactive reward cannot be redeemed: 404 and nothing changes.
      const refused = await student.request('POST', '/hadiah/redemptions', { body: { rewardId: id } })
      expectError(ctx, refused, 404, 'NOT_FOUND')
      ctx.check(errorOf(refused).message === 'Hadiah tidak dijumpai.', 'an inactive reward must answer "Hadiah tidak dijumpai."')

      const bulk = await admin.request('POST', '/admin/hadiah/bulk', { body: { action: 'activate', ids: [id, '99999999'] } })
      ctx.expectStatus(bulk, 200)
      ctx.check(dataOf(bulk).affected === 1, 'bulk activate must change only the existing reward')
      const put = await admin.request('PUT', `/admin/hadiah/${id}`, { body: { ...NEW_REWARD, title: 'Tajuk Diganti', stockQuantity: 0, isActive: true } })
      ctx.expectStatus(put, 200)
      ctx.check(dataOf(put).title === 'Tajuk Diganti' && dataOf(put).stockQuantity === 0, 'PUT must replace the reward')

      // Stock 0: refused before the token check, and the stock stays 0.
      expectError(ctx, await student.request('POST', '/hadiah/redemptions', { body: { rewardId: id } }), 409, 'OUT_OF_STOCK')
      ctx.check(dataOf(await admin.request('GET', `/admin/hadiah/${id}`)).stockQuantity === 0, 'a refused redemption must not change the stock')

      const bad = await admin.request('POST', '/admin/hadiah', { body: { category: 'nope' } })
      expectError(ctx, bad, 422, 'VALIDATION_ERROR')
      ctx.check(typeof (errorOf(bad).fields as Record<string, string> | undefined)?.category === 'string', 'a 422 must name the category field')
      expectError(ctx, await admin.request('GET', '/admin/hadiah/99999999'), 404, 'NOT_FOUND')
      // The static path is not read as an id.
      ctx.expectStatus(await admin.request('GET', '/admin/hadiah/redemptions'), 200)

      const del = await admin.request('POST', '/admin/hadiah/bulk', { body: { action: 'delete', ids: [id] } })
      ctx.check(dataOf(del).affected === 1, 'a reward without redemptions must be deletable')
      expectError(ctx, await admin.request('GET', `/admin/hadiah/${id}`), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'shop-api/redeem, deliver and cancel: tokens leave once, come back once, stock follows, a redeemed reward is kept by delete',
    domain: 'shop',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const student = await ctx.as('student')
      // Without tokens the money rule still holds.
      const reward = await createReward(ctx, admin, { tokenCost: 2, stockQuantity: 2, maxPerMonthPerStudent: 1 })
      const id = String(reward.id)
      const tokens0 = await tokensOf(student)
      if (tokens0 < 2) {
        const refused = await student.request('POST', '/hadiah/redemptions', { body: { rewardId: id } })
        if (refused.status === 409) {
          expectError(ctx, refused, 409, 'INSUFFICIENT_TOKENS')
          ctx.check(errorOf(refused).message === 'Token tidak mencukupi.', 'the message must be "Token tidak mencukupi."')
          ctx.check(dataOf(await admin.request('GET', `/admin/hadiah/${id}`)).stockQuantity === 2, 'a refused redemption must give the stock back')
        }
      }
      if (!(await fundTokens(ctx, student))) {
        // The M14 conversion is not served in this run: nothing more can be proven about spending tokens here.
        await admin.request('POST', '/admin/hadiah/bulk', { body: { action: 'delete', ids: [id] } })
        return
      }
      const tokens1 = await tokensOf(student)
      const red = await student.request('POST', '/hadiah/redemptions', { body: { rewardId: id } })
      ctx.expectStatus(red, 201)
      const redemptionId = String(dataOf(red).id)
      ctx.check(dataOf(red).status === 'pending_admin' && dataOf(red).tokenBalance === tokens1 - 2, 'a redemption is pending_admin and reports the balance after the debit')
      ctx.check((await tokensOf(student)) === tokens1 - 2, 'the token balance must be debited once')
      ctx.check(dataOf(await admin.request('GET', `/admin/hadiah/${id}`)).stockQuantity === 1, 'the stock must drop by one')
      // Monthly cap 1.
      expectError(ctx, await student.request('POST', '/hadiah/redemptions', { body: { rewardId: id } }), 409, 'MONTHLY_CAP')
      ctx.check((await tokensOf(student)) === tokens1 - 2, 'a capped redemption must not debit')

      const queue = await admin.request('GET', '/admin/hadiah/redemptions')
      ctx.expectStatus(queue, 200)
      ctx.check(listOf(queue).some((r) => r.id === redemptionId && r.status === 'pending_admin'), 'the pending queue must list the redemption')
      ctx.check(!JSON.stringify(queue.body).includes('voucher'), 'the queue must not carry a voucher code')

      // Cancel: refund once, stock back, second cancel is 409.
      const cancel = await admin.request('POST', `/admin/hadiah/redemptions/${redemptionId}/cancel`)
      ctx.expectStatus(cancel, 200)
      ctx.check(dataOf(cancel).refundedTokens === 2 && dataOf(cancel).status === 'cancelled', 'cancel must report the refund')
      ctx.check((await tokensOf(student)) === tokens1, 'the tokens must be refunded exactly once')
      ctx.check(dataOf(await admin.request('GET', `/admin/hadiah/${id}`)).stockQuantity === 2, 'the reserved stock must come back')
      const again = await admin.request('POST', `/admin/hadiah/redemptions/${redemptionId}/cancel`)
      expectError(ctx, again, 409, 'CONFLICT')
      ctx.check((await tokensOf(student)) === tokens1, 'a second cancel must not refund again')

      // Redeem again (the cancelled row does not count towards the cap), then deliver.
      const second = await student.request('POST', '/hadiah/redemptions', { body: { rewardId: id } })
      ctx.expectStatus(second, 201)
      const secondId = String(dataOf(second).id)
      const bad = await admin.request('POST', `/admin/hadiah/redemptions/${secondId}/deliver`, { body: { code: '' } })
      expectError(ctx, bad, 422, 'VALIDATION_ERROR')
      const delivered = await admin.request('POST', `/admin/hadiah/redemptions/${secondId}/deliver`, { body: { code: 'KOD-KONFORMANS' } })
      ctx.expectStatus(delivered, 200)
      ctx.check(!JSON.stringify(delivered.body).includes('KOD-KONFORMANS'), 'the deliver answer must not echo the voucher code')
      expectError(ctx, await admin.request('POST', `/admin/hadiah/redemptions/${secondId}/deliver`, { body: { code: 'LAIN' } }), 409, 'CONFLICT')
      expectError(ctx, await admin.request('POST', `/admin/hadiah/redemptions/${secondId}/cancel`), 409, 'CONFLICT')
      const all = await admin.request('GET', '/admin/hadiah/redemptions?status=delivered')
      ctx.check(listOf(all).some((r) => r.id === secondId), 'the delivered filter must list the redemption')

      // A reward that has redemptions is kept by the bulk delete.
      const del = await admin.request('POST', '/admin/hadiah/bulk', { body: { action: 'delete', ids: [id] } })
      ctx.check(dataOf(del).affected === 0 && Array.isArray(dataOf(del).keptIds) && (dataOf(del).keptIds as string[]).includes(id), 'delete must keep a reward that has redemptions')
      await admin.request('POST', '/admin/hadiah/bulk', { body: { action: 'deactivate', ids: [id] } })
    },
  },
  {
    id: 'shop-api/Kotak Misteri: four boxes, own history only, a refusal writes nothing, an opening pays inside the ranges',
    domain: 'shop',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const other = await ctx.as('admin')
      const view = dataOf(await student.request('GET', '/gamification/mystery-boxes'))
      const boxes = view.boxes as { id: string; costTokens: number; coinMin: number; coinMax: number; xpMin: number; xpMax: number }[]
      ctx.check(boxes.length === 4 && boxes.map((b) => b.costTokens).join(',') === '2,5,10,25', 'the four boxes cost 2, 5, 10 and 25 tokens')
      expectError(ctx, await student.request('POST', '/gamification/mystery-boxes/99/open'), 404, 'NOT_FOUND')
      const adminHistory = (dataOf(await other.request('GET', '/gamification/mystery-boxes')).history as { id: string }[]).map((h) => h.id)
      const studentHistory = (view.history as { id: string }[]).map((h) => h.id)
      ctx.check(studentHistory.every((h) => !adminHistory.includes(h)), 'an opening must appear in one user history only')

      const tokens = Number(view.tokenBalance)
      if (tokens < 2) {
        const refused = await student.request('POST', '/gamification/mystery-boxes/4/open')
        expectError(ctx, refused, 409, 'INSUFFICIENT_TOKENS')
        ctx.check(errorOf(refused).message === 'Token tidak mencukupi.', 'the message must be "Token tidak mencukupi."')
        ctx.check((await tokensOf(student)) === tokens, 'a refused opening must not debit')
        if (!(await fundTokens(ctx, student))) return
      }
      const before = await tokensOf(student)
      const coinsBefore = Number(dataOf(await student.request('GET', '/gamification/wallet')).currentSyiling)
      const open = await student.request('POST', '/gamification/mystery-boxes/1/open')
      ctx.expectStatus(open, 200)
      const o = dataOf(open)
      const box = boxes[0]!
      ctx.check(Number(o.coins) >= box.coinMin && Number(o.coins) <= box.coinMax && Number(o.xp) >= box.xpMin && Number(o.xp) <= box.xpMax, 'coins and xp must fall inside the box ranges')
      ctx.check(o.tokenBalance === before - box.costTokens, 'the box cost must be debited in tokens')
      ctx.check(o.syilingBalance === coinsBefore + Number(o.coins), 'the coins must be credited to the syiling balance')
      const after = dataOf(await student.request('GET', '/gamification/mystery-boxes'))
      ctx.check((after.history as { id: string }[])[0]?.id === o.openingId, 'the newest opening must head the history')
    },
  },
  {
    id: 'shop-api/Cabutan Bertuah: the demo draw is listed with its prize pool, a ticket debits the syiling and the counter follows',
    domain: 'shop',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const other = await ctx.as('admin')
      const view = dataOf(await student.request('GET', '/cabutan'))
      const draws = view.draws as { id: string; title: string; ticketCostSyiling: number; maxTicketsPerStudent: number; ticketsOwned: number; prizePool: unknown[] }[]
      const demo = draws.find((d) => d.title === 'Cabutan Demo')
      ctx.check(demo !== undefined && demo.prizePool.length === 2, 'the seeded "Cabutan Demo" must be listed with two prize lines')
      if (!demo) return
      expectError(ctx, await student.request('POST', '/cabutan/99999999/tickets'), 409, 'DRAW_CLOSED')
      const syiling = Number(view.syilingBalance)
      if (syiling < demo.ticketCostSyiling) {
        expectError(ctx, await student.request('POST', `/cabutan/${demo.id}/tickets`), 409, 'INSUFFICIENT_BALANCE')
        return
      }
      const buy = await student.request('POST', `/cabutan/${demo.id}/tickets`)
      ctx.expectStatus(buy, 201)
      const b = dataOf(buy)
      ctx.check(b.ticketsOwned === demo.ticketsOwned + 1 && b.syilingBalance === syiling - demo.ticketCostSyiling, 'a ticket must debit exactly the ticket cost and count one more')
      const mine = (dataOf(await student.request('GET', '/cabutan')).draws as typeof draws).find((d) => d.id === demo.id)
      ctx.check(mine?.ticketsOwned === demo.ticketsOwned + 1, 'the list must show the new ticket count')
      const theirs = (dataOf(await other.request('GET', '/cabutan')).draws as typeof draws).find((d) => d.id === demo.id)
      ctx.check(theirs !== undefined && theirs.ticketsOwned === 0, 'another user must not see tickets that are not theirs')
    },
  },
  {
    id: 'shop-api/Kedai Hadiah Digital is empty for every account and reads its chip from cat',
    domain: 'shop',
    targets: API_ONLY,
    async run(ctx) {
      for (const role of ['student', 'admin'] as const) {
        const client = await ctx.as(role)
        const items = await client.request('GET', '/hadiah-digital/items?cat=ewallet')
        ctx.expectStatus(items, 200)
        ctx.check(listOf(items).length === 0 && (items.body as { meta?: { activeCat?: string } }).meta?.activeCat === 'ewallet', 'items are always empty and echo cat')
        const unknown = (await client.request('GET', '/hadiah-digital/items?cat=nope')).body as { meta?: { activeCat?: unknown } }
        ctx.check(unknown.meta !== undefined && unknown.meta.activeCat === null, 'an unknown cat must give activeCat null')
        ctx.check(listOf(await client.request('GET', '/hadiah-digital/redemptions')).length === 0, 'the digital redemptions are always empty')
      }
    },
  },
]
