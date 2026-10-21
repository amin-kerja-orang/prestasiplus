import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * Marketplace buyer slice (BE-46) scenarios: the five routes against the seeded shop (6 categories, 1 seller,
 * 10 products). Counters are asserted relatively (the suite shares one database). API target only: they need
 * a cookie session with CSRF and the marketplace seed. Every response is also checked against the contract
 * by the runner.
 */
const SLUG = 'beg-sekolah-anti-air-premium-vH1Fj'

export const marketplaceScenarios: Scenario[] = [
  {
    id: 'marketplace-api/categories and search: seeded shape, filters, sort and paging',
    domain: 'marketplace',
    targets: API_ONLY,
    async run(ctx) {
      const me = await ctx.as('student')
      const cats = await me.request('GET', '/marketplace/categories')
      ctx.expectStatus(cats, 200)
      ctx.check(listOf(cats).length === 6, 'expected the 6 constant categories')
      ctx.check((cats.body as { meta?: unknown }).meta === undefined, 'categories must carry no meta')

      const all = await me.request('GET', '/marketplace/products')
      ctx.expectStatus(all, 200)
      const meta = (all.body as { meta?: { pageSize?: number; totalItems?: number } }).meta
      ctx.check(meta?.pageSize === 20 && (meta?.totalItems ?? 0) >= 10, 'page size must be 20 and the seed has 10 products')
      const used = listOf(await me.request('GET', '/marketplace/products?condition=used'))
      ctx.check(used.length >= 3 && used.every((p) => p.condition === 'used'), 'condition=used must return used products only')
      ctx.check(listOf(await me.request('GET', '/marketplace/products?condition=foo')).length === 0, 'an unknown condition matches nothing')
      ctx.check(listOf(await me.request('GET', '/marketplace/products?category=tiada')).length === 0, 'an unknown category is empty')
      const byPrice = listOf(await me.request('GET', '/marketplace/products?sort=price_low')).map((p) => Number(p.price))
      ctx.check(byPrice.every((v, i) => i === 0 || (byPrice[i - 1] ?? 0) <= v), 'price_low must be ascending')
      ctx.expectStatus(await me.request('GET', '/marketplace/products?page=abc&sort=zzz&q=%20'), 200)
    },
  },
  {
    id: 'marketplace-api/product page adds one view per call; hidden or unknown slug is 404',
    domain: 'marketplace',
    targets: API_ONLY,
    async run(ctx) {
      const me = await ctx.as('student')
      const first = await me.request('GET', `/marketplace/products/${SLUG}`)
      ctx.expectStatus(first, 200)
      const second = await me.request('GET', `/marketplace/products/${SLUG}`)
      ctx.expectStatus(second, 200)
      const a = Number(dataOf(first).views)
      const b = Number(dataOf(second).views)
      ctx.check(b === a + 1, `views must rise by exactly 1 per call, got ${String(a)} then ${String(b)}`)
      ctx.check(Array.isArray(dataOf(first).images) && (dataOf(first).images as unknown[]).length === 4, 'the product has 4 images')
      expectError(ctx, await me.request('GET', '/marketplace/products/tiada-produk'), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'marketplace-api/whatsapp hand-off: wa.me URL, 404 for unknown, CSRF and session required',
    domain: 'marketplace',
    targets: API_ONLY,
    async run(ctx) {
      const me = await ctx.as('student')
      const res = await me.request('POST', `/marketplace/products/${SLUG}/whatsapp`)
      ctx.expectStatus(res, 200)
      const url = String(dataOf(res).url)
      ctx.check(url.startsWith('https://wa.me/60100000000?text='), 'the URL must be the seller wa.me link')
      ctx.check(decodeURIComponent(url).includes('"Beg Sekolah Anti-Air Premium" di PRESTASIPLUS Marketplace.'), 'the message names the product')
      expectError(ctx, await me.request('POST', '/marketplace/products/tiada/whatsapp'), 404, 'NOT_FOUND')
      const noCsrf = await ctx.as('student', { csrf: false })
      expectError(ctx, await noCsrf.request('POST', `/marketplace/products/${SLUG}/whatsapp`), 403, 'CSRF_INVALID')
      expectError(ctx, await ctx.anonymous().request('POST', `/marketplace/products/${SLUG}/whatsapp`), 401, 'UNAUTHORIZED')
    },
  },
  {
    id: 'marketplace-api/shop page: active seller only, ids that do not exist or are not numbers are 404',
    domain: 'marketplace',
    targets: API_ONLY,
    async run(ctx) {
      const me = await ctx.as('teacher')
      const shop = await me.request('GET', '/marketplace/sellers/1')
      ctx.expectStatus(shop, 200)
      const body = dataOf(shop) as { shop?: { shopName?: string; productCount?: number }; products?: unknown[] }
      ctx.check(body.shop?.shopName === 'JomBelajar Official' && body.shop?.productCount === 10, 'the seeded shop has 10 visible products')
      ctx.check(body.products?.length === 10, 'the shop lists its 10 products')
      for (const id of ['99', 'abc']) expectError(ctx, await me.request('GET', `/marketplace/sellers/${id}`), 404, 'NOT_FOUND')
      ctx.check(errorOf(await me.request('GET', '/marketplace/sellers/abc')).message === 'Not Found.', 'the 404 message is "Not Found."')
    },
  },
  {
    id: 'marketplace-api/anonymous is 401 on every route and every signed-in role gets 200',
    domain: 'marketplace',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      for (const path of ['/marketplace/categories', '/marketplace/products', `/marketplace/products/${SLUG}`, '/marketplace/sellers/1']) {
        expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
      }
      for (const role of ['student', 'teacher', 'school_admin', 'admin'] as const) {
        const c = await ctx.as(role)
        ctx.expectStatus(await c.request('GET', '/marketplace/categories'), 200)
        ctx.expectStatus(await c.request('GET', '/marketplace/products'), 200)
      }
    },
  },
]
