import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../prisma/seed'
import { contentSeed, SEED_ARTICLES, SEED_BANNERS, SEED_VIDEOS } from '../../prisma/seed/content'
import { createTestDatabase, type TestDatabase } from '../support/db'

const snapshot = async (db: TestDatabase) => ({
  articles: await db.query(`select slug, title, category, is_published, published_at, legacy_source, legacy_id, featured_image_file_id from articles order by slug`),
  banners: await db.query(`select title, banner_type, target_audience, is_active, legacy_source, image_file_id from banners order by title`),
  videos: await db.query(`select title, platform, category, legacy_source, uploader_id::text from videos order by title`),
  config: await db.query(`select id::text, email, whatsapp_number from support_config`),
  tickets: await db.query(`select subject, status, legacy_source from support_tickets order by subject`),
})

describe('content seed (demo kind)', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds(seedModules, { prisma: db.prisma })
  })
  afterAll(async () => {
    await db.drop()
  })

  it('is a registered demo seed, after identity', () => {
    const names = seedModules.map((m) => m.name)
    expect(contentSeed.kind ?? 'demo').toBe('demo')
    expect(names).toContain('content')
    expect(names.indexOf('content')).toBeGreaterThan(names.indexOf('core-identity'))
  })

  it('loads the sample rows with no legacy values and no media', async () => {
    const s = await snapshot(db)
    expect(s.articles).toHaveLength(SEED_ARTICLES.length)
    expect(s.banners).toHaveLength(SEED_BANNERS.length)
    expect(s.videos).toHaveLength(SEED_VIDEOS.length)
    expect(s.config).toEqual([{ id: '1', email: 'sokongan@demo.test', whatsapp_number: '60100000000' }])
    expect(s.tickets).toHaveLength(1)
    const rows = [...s.articles, ...s.banners, ...s.videos, ...s.tickets]
    expect(rows.every((r) => r.legacy_source == null)).toBe(true)
    expect(s.articles.every((a) => a.featured_image_file_id === null)).toBe(true)
    expect(s.banners.every((b) => b.image_file_id === null)).toBe(true)
    // One draft; it has no publication date. The published ones have one.
    expect(s.articles.filter((a) => !a.is_published).map((a) => a.published_at)).toEqual([null])
    expect(s.articles.filter((a) => a.is_published).every((a) => a.published_at !== null)).toBe(true)
  })

  it('is fictitious: demo domains and example markers only', async () => {
    const text = JSON.stringify(await snapshot(db))
    expect(text).not.toMatch(/@(gmail|yahoo|hotmail|moe)\./i)
    expect(SEED_ARTICLES.every((a) => a.title.startsWith('Contoh'))).toBe(true)
    expect(SEED_BANNERS.every((b) => b.title.startsWith('Contoh'))).toBe(true)
    expect(SEED_VIDEOS.every((v) => v.title.startsWith('Contoh'))).toBe(true)
  })

  it('is idempotent: a re-run keeps the same rows', async () => {
    const before = await snapshot(db)
    await runSeeds(seedModules, { prisma: db.prisma })
    await runSeeds([contentSeed], { prisma: db.prisma })
    expect(await snapshot(db)).toEqual(before)
  })

  it('leaves rows loaded by the migration alone (legacy rows are never matched or changed)', async () => {
    await db.query(`insert into banners (title, banner_type, legacy_source, legacy_id) values ($1, 'PROMO', 'cloud', 'b1')`, [SEED_BANNERS[0].title])
    await runSeeds([contentSeed], { prisma: db.prisma })
    expect((await db.query(`select count(*)::int n from banners where title = $1`, [SEED_BANNERS[0].title]))[0]!.n).toBe(2)
    expect((await db.query(`select banner_type from banners where legacy_id = 'b1'`))[0]!.banner_type).toBe('PROMO')
  })
})

describe('content seed in production', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('writes nothing without ALLOW_DEMO_SEED', async () => {
    const ran = await runSeeds(seedModules, { prisma: db.prisma, env: { NODE_ENV: 'production' } })
    expect(ran).not.toContain('content')
    const s = await snapshot(db)
    expect([s.articles.length, s.banners.length, s.videos.length, s.config.length, s.tickets.length]).toEqual([0, 0, 0, 0, 0])
  })

  it('loads with ALLOW_DEMO_SEED', async () => {
    const ran = await runSeeds(seedModules, { prisma: db.prisma, env: { NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true' } })
    expect(ran).toContain('content')
    expect((await snapshot(db)).articles).toHaveLength(SEED_ARTICLES.length)
  })
})
