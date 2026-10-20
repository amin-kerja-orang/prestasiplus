import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { MARKETPLACE_CATEGORIES, marketplaceCategoriesSeed } from '../../prisma/seed/core/marketplace-categories'
import { VISIBLE_PRODUCT, VISIBLE_SQL } from '../../src/modules/marketplace/marketplace.visibility'

const repoSource = readFileSync(fileURLToPath(new URL('../../src/modules/marketplace/marketplace.repository.ts', import.meta.url)), 'utf8')

// No database needed: these specs pin the one visibility rule and the literal-substring search by their source.
describe('marketplace visibility (BR-M20-08), one shared predicate', () => {
  it('the Prisma form is: active product, and a platform product or an active seller', () => {
    expect(VISIBLE_PRODUCT).toEqual({ status: 'active', OR: [{ sellerId: null }, { seller: { status: 'active' } }] })
  })

  it('the SQL form is the same rule', () => {
    expect(VISIBLE_SQL.sql).toBe(`p.status = 'active' AND (p.seller_id IS NULL OR s.status = 'active')`)
    expect(VISIBLE_SQL.values).toEqual([])
  })

  it('search, view counter, related, shop, seller stats and hand-off all use the shared predicate, none repeats it', () => {
    expect(repoSource).toContain("from './marketplace.visibility'")
    // search (count + page) and the view counter use the SQL form; related, shop, stats and hand-off the Prisma form.
    expect(repoSource.match(/VISIBLE_SQL/g)?.length).toBeGreaterThanOrEqual(2)
    expect(repoSource.match(/VISIBLE_PRODUCT/g)?.length).toBeGreaterThanOrEqual(4)
    expect(repoSource).not.toMatch(/p\.status\s*=\s*'active'/)
    expect(repoSource).not.toMatch(/status:\s*'active'\s*,\s*OR/)
  })
})

describe('marketplace search is a literal substring match', () => {
  it('uses strpos on lower(), never LIKE/ILIKE, so %, _ and \ in q are plain characters', () => {
    expect(repoSource).toContain('strpos(lower(p.name), lower(${filter.q}))')
    expect(repoSource).not.toMatch(/\bI?LIKE\b/i)
    expect(repoSource).not.toMatch(/contains:/)
  })
})

describe('marketplace categories are a reference seed', () => {
  it('is kind reference with the 6 observed categories and unique slugs', () => {
    expect(marketplaceCategoriesSeed.kind).toBe('reference')
    expect(marketplaceCategoriesSeed.name).toBe('core-marketplace-categories')
    expect(marketplaceCategoriesSeed.profiles).toBeUndefined()
    expect(MARKETPLACE_CATEGORIES).toHaveLength(6)
    expect(new Set(MARKETPLACE_CATEGORIES.map((c) => c.slug)).size).toBe(6)
  })
})
