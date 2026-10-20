/**
 * Content and support seed (BE-24, DEMO data): a handful of fictitious articles, banners and videos, the
 * support contact row and one sample ticket. Runs after the identity seed (the author is the demo admin
 * `admin@demo.test`). Idempotent: articles by `slug`, banners and videos by title (no `legacy_*` row is
 * ever matched, so rows loaded by the ETL are untouched), support_config by id 1, the ticket by subject
 * for the demo student. `legacy_*` is never set. Only fictitious text, no real names, no uploaded files
 * (image columns stay null: no media is generated). Not a reference seed: refused in production unless
 * ALLOW_DEMO_SEED.
 */
import type { SeedModule } from './index'

const AUTHOR_EMAIL = 'admin@demo.test'
const STUDENT_EMAIL = 'pelajar@demo.test'

/** Publication offsets are days before the fixed seed clock, so the order is stable. */
const DAY_MS = 86_400_000

export const SEED_ARTICLES = [
  {
    slug: 'contoh-tips-belajar-berkesan',
    title: 'Contoh: Tips belajar dengan berkesan',
    excerpt: 'Beberapa langkah mudah untuk mengatur masa belajar anda.',
    content: '<p>Ini ialah artikel contoh. Buat jadual belajar ringkas dan ulang kaji sedikit setiap hari.</p>',
    category: 'TIPS_BELAJAR',
    gradeLevel: 'SEMUA',
    isPublished: true,
    isFeatured: true,
    views: 120,
    publishedDaysAgo: 3,
  },
  {
    slug: 'contoh-berita-sekolah',
    title: 'Contoh: Berita sekolah demo',
    excerpt: 'Ringkasan berita contoh untuk paparan senarai.',
    content: '<p>Berita contoh untuk tujuan demonstrasi sahaja.</p>',
    category: 'BERITA',
    gradeLevel: 'DARJAH_6',
    isPublished: true,
    isFeatured: false,
    views: 40,
    publishedDaysAgo: 1,
  },
  {
    slug: 'contoh-draf-panduan-guru',
    title: 'Contoh: Draf panduan guru',
    excerpt: null,
    content: '<p>Draf yang belum diterbitkan; tidak dipaparkan kepada umum.</p>',
    category: 'PANDUAN_GURU',
    gradeLevel: 'SEMUA',
    isPublished: false,
    isFeatured: false,
    views: 0,
    publishedDaysAgo: null,
  },
] as const

export const SEED_BANNERS = [
  { title: 'Contoh: Selamat datang', description: 'Banner contoh untuk semua pengguna.', bannerType: 'HERO', targetAudience: 'ALL', displayOrder: 1, isActive: true },
  { title: 'Contoh: Promosi pelajar', description: 'Banner contoh untuk pelajar.', bannerType: 'PROMO', targetAudience: 'STUDENT', displayOrder: 2, isActive: true },
  { title: 'Contoh: Banner tidak aktif', description: null, bannerType: 'ANNOUNCEMENT', targetAudience: 'ALL', displayOrder: 3, isActive: false },
] as const

export const SEED_VIDEOS = [
  { title: 'Contoh: Video motivasi', videoUrl: 'https://www.youtube.com/watch?v=demo0000001', platform: 'Youtube', externalId: 'demo0000001', category: 'motivasi' },
  { title: 'Contoh: Tutorial pecahan', videoUrl: 'https://www.youtube.com/watch?v=demo0000002', platform: 'Youtube', externalId: 'demo0000002', category: 'tutorial' },
  { title: 'Contoh: Ceramah tip SPM', videoUrl: 'https://vimeo.com/900000003', platform: 'Vimeo', externalId: '900000003', category: 'tips-spm' },
] as const

export const SEED_SUPPORT_CONFIG = { id: 1n, email: 'sokongan@demo.test', whatsappNumber: '60100000000' } as const

export const SEED_TICKET = {
  subject: 'Contoh: Soalan tentang akaun',
  body: 'Tiket contoh daripada akaun demo. Tiada maklumat peribadi sebenar.',
} as const

export const contentSeed: SeedModule = {
  name: 'content',
  async run(ctx) {
    const { prisma } = ctx
    const now = ctx.clock.now()
    const author = await prisma.user.findFirst({ where: { email: { equals: AUTHOR_EMAIL, mode: 'insensitive' } } })
    if (!author) throw new Error(`content seed: demo author ${AUTHOR_EMAIL} is missing (run the identity seed first).`)

    for (const a of SEED_ARTICLES) {
      const { publishedDaysAgo, ...fields } = a
      const publishedAt = publishedDaysAgo === null ? null : new Date(now.getTime() - publishedDaysAgo * DAY_MS)
      await prisma.article.upsert({
        where: { slug: a.slug },
        create: { ...fields, publishedAt, authorId: author.id, createdAt: now, updatedAt: now },
        update: { ...fields, publishedAt, updatedAt: now },
      })
    }

    for (const b of SEED_BANNERS) {
      const existing = await prisma.banner.findFirst({ where: { title: b.title, legacySource: null } })
      if (existing) await prisma.banner.update({ where: { id: existing.id }, data: { ...b, updatedAt: now } })
      else await prisma.banner.create({ data: { ...b, createdAt: now, updatedAt: now } })
    }

    for (const v of SEED_VIDEOS) {
      const existing = await prisma.video.findFirst({ where: { title: v.title, legacySource: null } })
      if (existing) await prisma.video.update({ where: { id: existing.id }, data: { ...v, updatedAt: now } })
      else await prisma.video.create({ data: { ...v, uploaderId: author.id, createdAt: now, updatedAt: now } })
    }

    await prisma.supportConfig.upsert({
      where: { id: SEED_SUPPORT_CONFIG.id },
      create: { ...SEED_SUPPORT_CONFIG, createdAt: now, updatedAt: now },
      update: { email: SEED_SUPPORT_CONFIG.email, whatsappNumber: SEED_SUPPORT_CONFIG.whatsappNumber, updatedAt: now },
    })

    const student = await prisma.user.findFirst({ where: { email: { equals: STUDENT_EMAIL, mode: 'insensitive' } } })
    if (student) {
      const ticket = await prisma.supportTicket.findFirst({ where: { userId: student.id, subject: SEED_TICKET.subject, legacySource: null } })
      if (!ticket) await prisma.supportTicket.create({ data: { ...SEED_TICKET, userId: student.id, createdAt: now, updatedAt: now } })
    }
  },
}
