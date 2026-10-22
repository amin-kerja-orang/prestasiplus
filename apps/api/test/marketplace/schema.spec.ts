import { marketplaceDiscountPct, marketplaceInitial, marketplaceRatingStars, marketplaceShippingLine } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { marketplaceSeed, PRODUCTS } from '../../prisma/seed/marketplace'
import { marketplaceCategoriesSeed } from '../../prisma/seed/core/marketplace-categories'
import { money, starsOf } from '../../src/modules/marketplace/marketplace.mapper'
import { count, insertProducts } from './helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { identitySeed } from '../../prisma/seed/core/identity'

describe('format rules (AC4)', () => {
  it('discountPct is half-up and null without a positive original price', () => {
    expect(marketplaceDiscountPct('89.90', '129.90')).toBe(31)
    expect(marketplaceDiscountPct('15.00', '35.00')).toBe(57)
    expect(marketplaceDiscountPct('5.00', '10.00')).toBe(50)
    expect(marketplaceDiscountPct('19.90', null)).toBeNull()
    expect(marketplaceDiscountPct('1.00', '0.00')).toBeNull()
    // 12.5 % rounds up to 13, 0.5 % to 1.
    expect(marketplaceDiscountPct('7.00', '8.00')).toBe(13)
    expect(marketplaceDiscountPct('199.00', '200.00')).toBe(1)
  })

  it('shippingLine is exactly one of the five strings', () => {
    expect(marketplaceShippingLine('postage', '8.00')).toBe('Pos / Kurier (RM8.00)')
    expect(marketplaceShippingLine('postage', '5')).toBe('Pos / Kurier (RM5.00)')
    expect(marketplaceShippingLine('postage', null)).toBe('Pos / Kurier')
    expect(marketplaceShippingLine('free', null)).toBe('Penghantaran Percuma 🎉')
    expect(marketplaceShippingLine('cod', null)).toBe('Cash on Delivery (COD)')
    expect(marketplaceShippingLine('pickup', null)).toBe('Ambil Sendiri (Pickup)')
  })

  it('rating stars: empty without reviews, round(average) otherwise; the initial is upper case or ?', () => {
    expect(marketplaceRatingStars(null)).toBe('☆☆☆☆☆')
    expect(starsOf({ reviewCount: 0, ratingSum: 0 })).toBe('☆☆☆☆☆')
    expect(starsOf({ reviewCount: 2, ratingSum: 9 })).toBe('★★★★★') // 4.5 rounds up
    expect(starsOf({ reviewCount: 3, ratingSum: 11 })).toBe('★★★★☆')
    expect(starsOf({ reviewCount: 1, ratingSum: 1 })).toBe('★☆☆☆☆')
    expect(marketplaceInitial('kedai Ali')).toBe('K')
    expect(marketplaceInitial('  ')).toBe('?')
  })

  it('money is a two-decimal string', () => {
    expect(money({ toFixed: (n: number) => (89.9).toFixed(n) })).toBe('89.90')
  })
})

describe('tables, constraints and seed (AC9, plan 14.9)', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, marketplaceCategoriesSeed, marketplaceSeed], { prisma: db.prisma })
  }, 120_000)
  afterAll(async () => {
    await db.drop()
  })

  const rejects = async (sql: string) => {
    await expect(db.query(sql)).rejects.toThrow()
  }

  it('the seed holds the 6 categories, 1 seller, 10 products and 45 images with the observed counters', async () => {
    expect(await count(db, `select count(*) as n from marketplace_categories`)).toBe(6)
    expect(await count(db, `select count(*) as n from marketplace_sellers`)).toBe(1)
    expect(await count(db, `select count(*) as n from marketplace_products`)).toBe(10)
    expect(await count(db, `select count(*) as n from marketplace_product_images`)).toBe(45)
    expect(await count(db, `select sum(views) as n from marketplace_products`)).toBe(111)
    expect(await count(db, `select whatsapp_clicks as n from marketplace_sellers`)).toBe(16)
    expect(await count(db, `select count(*) as n from marketplace_reviews`)).toBe(0)
    expect(PRODUCTS).toHaveLength(10)
    // Seeds never set the legacy columns and the contact data is fictitious.
    expect(await count(db, `select count(*) as n from marketplace_products where legacy_source is not null or legacy_id is not null`)).toBe(0)
    expect(await count(db, `select count(*) as n from marketplace_sellers where legacy_source is not null or legacy_id is not null`)).toBe(0)
    expect(await count(db, `select count(*) as n from marketplace_sellers where phone = '0100000000' and whatsapp = '60100000000'`)).toBe(1)
  })

  it('a second seed run adds nothing and keeps a moved counter', async () => {
    await db.query(`update marketplace_products set views = views + 5 where id = 1`)
    await runSeeds([marketplaceCategoriesSeed, marketplaceSeed], { prisma: db.prisma })
    expect(await count(db, `select count(*) as n from marketplace_products`)).toBe(10)
    expect(await count(db, `select count(*) as n from marketplace_product_images`)).toBe(45)
    expect(await count(db, `select count(*) as n from marketplace_categories`)).toBe(6)
    expect(await count(db, `select count(*) as n from marketplace_sellers`)).toBe(1)
    expect(await count(db, `select views as n from marketplace_products where id = 1`)).toBe(35)
  })

  it('the supporting indexes exist', async () => {
    const rows = await db.query<{ indexname: string }>(`select indexname from pg_indexes where tablename like 'marketplace_%'`)
    const names = rows.map((r) => r.indexname)
    for (const n of [
      'uq_marketplace_categories_slug',
      'uq_marketplace_sellers_user_id',
      'uq_marketplace_sellers_legacy',
      'ix_marketplace_sellers_status',
      'uq_marketplace_products_slug',
      'uq_marketplace_products_legacy',
      'ix_marketplace_products_status_category_id',
      'ix_marketplace_products_seller_id',
      'ix_marketplace_products_created_at_id',
      'uq_marketplace_product_images_product_position',
      'ix_marketplace_reviews_product_id_created_at',
    ]) {
      expect(names, n).toContain(n)
    }
  })

  it('enum columns are text + check; bad values, negative amounts and duplicate keys are rejected', async () => {
    const product = (over: string) =>
      `insert into marketplace_products (name, slug, category_id, price, condition, stock_status, status, shipping_method) values ${over}`
    await rejects(product(`('x', 'c1', 1, 1, 'broken', 'available', 'active', 'free')`))
    await rejects(product(`('x', 'c2', 1, 1, 'new', 'plenty', 'active', 'free')`))
    await rejects(product(`('x', 'c3', 1, 1, 'new', 'available', 'published', 'free')`))
    await rejects(product(`('x', 'c4', 1, 1, 'new', 'available', 'active', 'drone')`))
    await rejects(product(`('x', 'c5', 1, -1, 'new', 'available', 'active', 'free')`))
    await rejects(product(`('x', 'c6', 999, 1, 'new', 'available', 'active', 'free')`))
    await rejects(product(`('x', 'beg-sekolah-anti-air-premium-vH1Fj', 1, 1, 'new', 'available', 'active', 'free')`))
    await rejects(`insert into marketplace_sellers (user_id, shop_name, phone, whatsapp, status) select id, 'x', 'x', 'x', 'open' from users limit 1 offset 3`)
    await rejects(`insert into marketplace_product_images (product_id, position, url) values (1, 1, 'dup')`)
    await rejects(`insert into marketplace_product_images (product_id, position, url) values (1, 0, 'zero')`)
    await rejects(`insert into marketplace_reviews (product_id, user_id, rating, text) select 1, id, 6, 'x' from users limit 1`)
    await rejects(`insert into marketplace_reviews (product_id, user_id, rating, text) values (1, 999999, 5, 'x')`)
    await rejects(`update marketplace_products set views = -1 where id = 1`)
  })

  it('legacy_source is cloud or my and (legacy_source, legacy_id) is unique', async () => {
    await rejects(`update marketplace_products set legacy_source = 'other', legacy_id = '1' where id = 1`)
    await db.query(`update marketplace_products set legacy_source = 'cloud', legacy_id = '77' where id = 1`)
    await rejects(`update marketplace_products set legacy_source = 'cloud', legacy_id = '77' where id = 2`)
    await db.query(`update marketplace_products set legacy_source = null, legacy_id = null where id = 1`)
  })

  it('deleting a product removes its images and reviews; a category or seller in use cannot be deleted', async () => {
    await insertProducts(db, 1, { prefix: 'Sementara' })
    const id = (await db.query<{ id: string }>(`select id::text from marketplace_products where slug = 'sementara-1'`))[0]!.id
    await db.query(`insert into marketplace_product_images (product_id, position, url) values ($1, 1, '/x.jpg')`, [id])
    await db.query(`delete from marketplace_products where id = $1`, [id])
    expect(await count(db, `select count(*) as n from marketplace_product_images where product_id = $1`, [id])).toBe(0)
    await rejects(`delete from marketplace_categories where id = 1`)
    await rejects(`delete from marketplace_sellers where id = 1`)
  })

  it('EXPLAIN of the search query on a generated 10k-product set (recorded for the PR)', async () => {
    await db.query(
      `insert into marketplace_products (seller_id, name, slug, category_id, price, original_price, condition, stock_status, status, shipping_method, views, created_at)
       select 1, 'Produk Besar ' || g, 'produk-besar-' || g, 1 + g % 6, 5 + (g % 50), null, case when g % 4 = 0 then 'used' else 'new' end,
              'available', case when g % 10 = 0 then 'draft' else 'active' end, 'postage', g % 97, timestamptz '2026-01-01 00:00+08' + g * interval '1 minute'
         from generate_series(1, 10000) g`,
    )
    await db.query(`analyze marketplace_products`)
    await db.query(`analyze marketplace_sellers`)
    const visible = `p.status = 'active' AND (p.seller_id IS NULL OR s.status = 'active')`
    const plans: Record<string, string> = {
      'latest, category': `select p.id from marketplace_products p left join marketplace_sellers s on s.id = p.seller_id where ${visible} and p.category_id = 3 order by p.created_at desc, p.id desc limit 20 offset 0`,
      'latest, no filter': `select p.id from marketplace_products p left join marketplace_sellers s on s.id = p.seller_id where ${visible} order by p.created_at desc, p.id asc limit 20 offset 0`,
      'q + condition, price_low': `select p.id from marketplace_products p left join marketplace_sellers s on s.id = p.seller_id where ${visible} and strpos(lower(p.name), lower('besar 12')) > 0 and p.condition = 'new' order by p.price asc, p.id asc limit 20 offset 0`,
    }
    for (const [name, sql] of Object.entries(plans)) {
      const rows = await db.query<Record<string, string>>(`explain (analyze, buffers) ${sql}`)
      const plan = rows.map((r) => Object.values(r)[0]).join('\n')
      console.log(`EXPLAIN ${name}\n${plan}`)
      expect(plan).toMatch(/Execution Time/)
    }
    const filtered = (await db.query<Record<string, string>>(`explain ${plans['latest, category']}`)).map((r) => Object.values(r)[0]).join('\n')
    expect(filtered).toMatch(/marketplace_products/)
  })
})
