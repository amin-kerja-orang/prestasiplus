/**
 * @api S7 rewards and wallet against the REAL API (card S7-T05, DM-48, DM-78): the reward settings on `/admin/reward-control`,
 * and a redeem and a Cabutan ticket with one `clientUuid` sent twice, down to the wallet the pupil reads. Requests only,
 * no screen (the screens are S7-T11), so it runs at 1280 only. Each run makes its own reward, draw and keys, and restores the rate.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_STUDENT_PASS, BIJAK_ADMIN_PUSAT_PASS).
 */

import { randomUUID } from 'node:crypto'

import type { APIRequestContext, Page } from '@playwright/test'

import { expect, test } from '../fixtures/api'
import { account, csrfOf, newPeerContext, type ApiRole } from './helpers'

interface Caller {
  request: APIRequestContext
  headers: Record<string, string>
}

async function signIn(page: Page, role: ApiRole): Promise<Caller> {
  const a = account(role)
  const login = await page.request.post('/api/auth/login', { data: { identifier: a.user, password: a.pass } })
  expect(login.status(), 'POST /api/auth/login').toBe(200)
  return { request: page.request, headers: { 'X-CSRF-Token': await csrfOf(page) } }
}

const dataOf = async <T>(res: { json(): Promise<unknown> }): Promise<T> => ((await res.json()) as { data: T }).data

test.describe('S7 rewards and wallet @api', () => {
  test.setTimeout(120_000)
  // Requests only, so the viewport adds nothing; a second project would run into the admin write limit of the API.
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1280, 'one project is enough')

  test('reward settings read and write through the four API-ADM-16 names, inside their ranges @api', async ({ page }) => {
    const admin = await signIn(page, 'adminPusat')
    const settings = async () => (await dataOf<{ settings: Record<string, unknown> }>(await admin.request.get('/api/admin/reward-control'))).settings
    const put = (data: object) => admin.request.put('/api/admin/reward-control/settings', { headers: admin.headers, data })

    const before = await settings()
    expect(before).toMatchObject({ flatCoins: before.flatQuizReward, redeemBudget: before.rewardBudgetSenSession, sessionYear: before.currentSessionYear })
    expect(typeof before.miniGamesCoins).toBe('boolean')

    try {
      expect((await put({ flatCoins: 3 })).status()).toBe(200)
      expect(await settings()).toMatchObject({ flatCoins: 3, flatQuizReward: 3 })
      const list = await dataOf<{ key: string; value: number }[]>(await admin.request.get('/api/admin/gamification/settings'))
      expect(list.find((s) => s.key === 'flat_quiz_reward')?.value).toBe(3)
      for (const bad of [{ flatCoins: 21 }, { redeemBudget: 100_001 }, { sessionYear: 2019 }]) expect((await put(bad)).status(), JSON.stringify(bad)).toBe(422)
      expect((await settings()).flatCoins).toBe(3)
    } finally {
      expect((await put({ flatCoins: before.flatCoins })).status()).toBe(200)
    }
  })

  test('a redeem and a ticket sent twice with one clientUuid move the wallet once @api', async ({ page, browser }, info) => {
    const pupil = await signIn(page, 'student')
    const adminContext = await newPeerContext(browser, info)
    const adminPage = await adminContext.newPage()
    const admin = await signIn(adminPage, 'adminPusat')
    const wallet = async () => dataOf<{ currentSyiling: number; tokenBalance: number }>(await pupil.request.get('/api/gamification/wallet'))

    const session = await dataOf<{ user: { id: string } }>(await pupil.request.get('/api/session'))
    const { rate } = await dataOf<{ rate: number }>(await pupil.request.get('/api/gamification/convert'))
    const award = await admin.request.post('/api/admin/gamification/award', { headers: admin.headers, data: { userId: session.user.id, amount: rate + 20, reason: 'Ujian e2e S7' } })
    expect(award.status(), 'POST award').toBe(200)
    const convert = await pupil.request.post('/api/gamification/convert', { headers: pupil.headers, data: { syilingAmount: rate } })
    expect(convert.status(), 'POST convert').toBeLessThan(300)

    const reward = await dataOf<{ id: string }>(
      await admin.request.post('/api/admin/hadiah', {
        headers: admin.headers,
        data: { category: 'telco', vendor: 'Vendor Ujian', title: `Hadiah Ujian ${randomUUID()}`, denominationRm: 1, tokenCost: 1, isActive: true },
      }),
    )
    const before = await wallet()
    const body = { rewardId: reward.id, clientUuid: randomUUID() }
    const first = await pupil.request.post('/api/hadiah/redemptions', { headers: pupil.headers, data: body })
    expect(first.status(), 'first redeem').toBe(201)
    const second = await pupil.request.post('/api/hadiah/redemptions', { headers: pupil.headers, data: body })
    expect(second.status(), 'repeat redeem').toBe(201)
    expect(await dataOf<{ id: string }>(second)).toEqual(await dataOf<{ id: string }>(first))
    expect((await wallet()).tokenBalance).toBe(before.tokenBalance - 1)

    const draw = await dataOf<{ id: string }>(
      await admin.request.post('/api/admin/reward-control/draws', { headers: admin.headers, data: { title: `Cabutan Ujian ${randomUUID()}`, ticketCostSyiling: 5, maxTicketsPerStudent: 3, openNow: true } }),
    )
    const ticket = { clientUuid: randomUUID() }
    const a = await pupil.request.post(`/api/cabutan/${draw.id}/tickets`, { headers: pupil.headers, data: ticket })
    expect(a.status(), 'first ticket').toBe(201)
    const b = await pupil.request.post(`/api/cabutan/${draw.id}/tickets`, { headers: pupil.headers, data: ticket })
    expect(b.status(), 'repeat ticket').toBe(201)
    expect(await dataOf<object>(b)).toEqual(await dataOf<object>(a))
    expect((await wallet()).currentSyiling).toBe(before.currentSyiling - 5)

    const bad = await pupil.request.post('/api/hadiah/redemptions', { headers: pupil.headers, data: { rewardId: reward.id, clientUuid: 'bukan-uuid' } })
    expect(bad.status()).toBe(422)
    await adminContext.close()
  })
})
