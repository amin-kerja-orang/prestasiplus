import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootMarketplaceApp, count, expectError, loginAs, type MarketplaceTestApp } from './helpers'

const SLUG = 'beg-sekolah-anti-air-premium-vH1Fj'
const ROUTES = [
  ['GET', '/api/marketplace/categories'],
  ['GET', '/api/marketplace/products'],
  ['GET', `/api/marketplace/products/${SLUG}`],
  ['POST', `/api/marketplace/products/${SLUG}/whatsapp`],
  ['GET', '/api/marketplace/sellers/1'],
] as const

let t: MarketplaceTestApp
beforeAll(async () => {
  t = await bootMarketplaceApp()
}, 120_000)
afterAll(async () => {
  await t.close()
})

describe('roles and sessions (AC8)', () => {
  it.each(ROUTES)('%s %s without a session is 401 UNAUTHORIZED "Unauthenticated."', async (method, url) => {
    const req = method === 'GET' ? t.http().get(url) : t.http().post(url)
    expectError(await req, 401, 'UNAUTHORIZED', 'Unauthenticated.')
  })

  it('a refused call counts nothing', async () => {
    await t.http().get(`/api/marketplace/products/${SLUG}`)
    await t.http().post(`/api/marketplace/products/${SLUG}/whatsapp`)
    expect(await count(t.db, `select views as n from marketplace_products where id = 1`)).toBe(30)
    expect(await count(t.db, `select whatsapp_clicks as n from marketplace_sellers where id = 1`)).toBe(16)
  })

  it.each(Object.entries(ACCOUNTS))('%s (%s) gets 200 on all five routes', async (_role, account) => {
    const c = await loginAs(t, account)
    for (const [method, url] of ROUTES) {
      const res = method === 'GET' ? await c.get(url) : await c.post(url)
      expect(res.status, `${method} ${url}`).toBe(200)
    }
  })

  it('the POST needs the CSRF header: missing or wrong is 403 CSRF_INVALID and counts nothing', async () => {
    const c = await loginAs(t, ACCOUNTS.student)
    const before = await count(t.db, `select whatsapp_clicks as n from marketplace_sellers where id = 1`)
    expectError(await c.postNoCsrf(`/api/marketplace/products/${SLUG}/whatsapp`), 403, 'CSRF_INVALID')
    expectError(await c.postNoCsrf(`/api/marketplace/products/${SLUG}/whatsapp`).set('X-CSRF-Token', 'wrong'), 403, 'CSRF_INVALID')
    expect(await count(t.db, `select whatsapp_clicks as n from marketplace_sellers where id = 1`)).toBe(before)
  })

  it('the product page and the shop answer without a cache; GET reads do not carry sellers\' contact data', async () => {
    const c = await loginAs(t, ACCOUNTS.student)
    expect((await c.get(`/api/marketplace/products/${SLUG}`)).headers['cache-control']).toBe('no-store')
    const text = JSON.stringify((await c.get(`/api/marketplace/products/${SLUG}`)).body) + JSON.stringify((await c.get('/api/marketplace/sellers/1')).body)
    // No phone, WhatsApp number, owner id, counter or legacy column on the wire.
    expect(text).not.toMatch(/60100000000|0100000000|whatsapp|phone|userId":"1"|legacy_|whatsappClicks/)
  })
})

describe('429 on the counter routes (D57a)', () => {
  it('the product page and the hand-off are limited per user, with Retry-After', async () => {
    const limited = await bootMarketplaceApp({ THROTTLE_MARKETPLACE_VIEW_PER_MINUTE: '3', THROTTLE_MARKETPLACE_WRITE_PER_MINUTE: '2' })
    try {
      const c = await loginAs(limited, ACCOUNTS.student)
      for (let i = 0; i < 3; i++) expect((await c.get(`/api/marketplace/products/${SLUG}`)).status).toBe(200)
      const blocked = await c.get(`/api/marketplace/products/${SLUG}`)
      expectError(blocked, 429, 'RATE_LIMITED')
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
      // A blocked call is not counted: 30 + 3.
      expect(await count(limited.db, `select views as n from marketplace_products where id = 1`)).toBe(33)

      for (let i = 0; i < 2; i++) expect((await c.post(`/api/marketplace/products/${SLUG}/whatsapp`)).status).toBe(200)
      expectError(await c.post(`/api/marketplace/products/${SLUG}/whatsapp`), 429, 'RATE_LIMITED')
      expect(await count(limited.db, `select whatsapp_clicks as n from marketplace_sellers where id = 1`)).toBe(18)
      // Another user has its own window.
      const other = await loginAs(limited, ACCOUNTS.teacher)
      expect((await other.get(`/api/marketplace/products/${SLUG}`)).status).toBe(200)
    } finally {
      await limited.close()
    }
  })
})
