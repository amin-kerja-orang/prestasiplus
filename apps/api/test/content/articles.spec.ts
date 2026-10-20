import { AdminArticleDetailSchema, ArticleCardSchema, ArticleDetailSchema, ArticleHotCardSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { ArticlesRepository } from '../../src/modules/content/articles/articles.repository'
import { freeSlug, slugify } from '../../src/modules/content/articles/articles.service'
import { fileTokenOfUrl } from '../../src/modules/content/shared/content-support'
import { makePng } from '../files/fixtures'
import {
  ADMIN,
  SCHOOL_ADMIN,
  STUDENT,
  TEACHER,
  apiFor,
  articleBody,
  bootCmsApp,
  errorOf,
  fieldsOf,
  insertArticle,
  type Api,
  type CmsApp,
} from './cms-helpers'

let t: CmsApp
let admin: Api & { agent: CmsApp extends never ? never : ReturnType<CmsApp['agent']>; csrf: string }

beforeAll(async () => {
  t = await bootCmsApp()
  admin = await apiFor(t, ADMIN)
}, 120_000)
afterAll(async () => {
  await t.close()
})

const pub = (path: string) => t.http().get(`/api${path}`)

describe('slug helpers', () => {
  it('folds accents and hyphenates; the next free suffix starts at 2', () => {
    expect(slugify('Tajuk Pelajaran: Sains & Matematik!')).toBe('tajuk-pelajaran-sains-matematik')
    expect(slugify('Çéré Müdâ')).toBe('cere-muda')
    expect(slugify('???')).toBe('')
    expect(freeSlug('a', new Set())).toBe('a')
    expect(freeSlug('a', new Set(['a']))).toBe('a-2')
    expect(freeSlug('a', new Set(['a', 'a-2', 'a-3']))).toBe('a-4')
  })
})

describe('AC 8 access', () => {
  const routes: Array<[string, string]> = [
    ['get', '/admin/articles'],
    ['get', '/admin/articles/1'],
    ['post', '/admin/articles'],
    ['put', '/admin/articles/1'],
    ['delete', '/admin/articles/1'],
  ]

  it.each(routes)('%s %s without a session is 401', async (method, path) => {
    const res = await (t.http() as never as Record<string, (p: string) => Promise<import('supertest').Response>>)[method]!(`/api${path}`)
    errorOf(res, 401, 'UNAUTHORIZED')
  })

  it.each([STUDENT, TEACHER, SCHOOL_ADMIN])('%s is refused with 403 on every admin article route', async (who) => {
    const api = await apiFor(t, who)
    for (const res of [await api.get('/admin/articles'), await api.get('/admin/articles/1'), await api.post('/admin/articles', articleBody()), await api.put('/admin/articles/1', {}), await api.del('/admin/articles/1')]) {
      errorOf(res, 403, 'FORBIDDEN')
    }
  })

  it('a write without the CSRF token is 403 CSRF_INVALID and writes nothing', async () => {
    const before = await t.db.query<{ n: string }>('select count(*)::text as n from articles')
    const res = await admin.agent.post('/api/admin/articles').send(articleBody())
    errorOf(res, 403, 'CSRF_INVALID')
    const put = await admin.agent.put('/api/admin/articles/1').send({})
    errorOf(put, 403, 'CSRF_INVALID')
    const del = await admin.agent.delete('/api/admin/articles/1')
    errorOf(del, 403, 'CSRF_INVALID')
    expect((await t.db.query<{ n: string }>('select count(*)::text as n from articles'))[0]?.n).toBe(before[0]?.n)
  })

  it('admin responses are no-store', async () => {
    const res = await admin.get('/admin/articles')
    expect(res.headers['cache-control']).toBe('no-store')
  })
})

describe('AC 1 the public never sees a draft', () => {
  let draftSlug: string
  beforeAll(async () => {
    await insertArticle(t, { title: 'Terbit Satu', slug: 'terbit-satu', category: 'TIPS_BELAJAR', featured: true, views: 5 })
    await insertArticle(t, { title: 'Draf Rahsia', slug: 'draf-rahsia', published: false, category: 'TIPS_BELAJAR', featured: true, views: 9999 })
    draftSlug = 'draf-rahsia'
  })

  it('GET /articles works without a session and lists only the published row', async () => {
    const res = await pub('/articles')
    expect(res.status).toBe(200)
    const titles = (res.body.data as Array<{ title: string }>).map((a) => a.title)
    expect(titles).toContain('Terbit Satu')
    expect(titles).not.toContain('Draf Rahsia')
    for (const a of res.body.data) ArticleCardSchema.parse(a)
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 18, totalItems: 1, totalPages: 1, from: 1, to: 1 })
    expect(JSON.stringify(res.body)).not.toContain('draf-rahsia')
  })

  it('a search or category filter cannot reach the draft either', async () => {
    expect((await pub('/articles?search=draf')).body.data).toEqual([])
    expect((await pub('/articles?category=TIPS_BELAJAR')).body.meta.totalItems).toBe(1)
    expect((await pub('/articles?category=NOPE')).body.data).toEqual([])
    expect((await pub('/articles?category=NOPE')).status).toBe(200)
  })

  it('GET /articles/hot never draws the draft (even featured and most viewed)', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await pub('/articles/hot')
      expect(res.status).toBe(200)
      for (const a of res.body.data) ArticleHotCardSchema.parse(a)
      expect((res.body.data as Array<{ slug: string }>).map((a) => a.slug)).not.toContain(draftSlug)
      expect(res.body.data[0]).toMatchObject({ slug: 'terbit-satu', badge: 'PILIHAN' })
    }
  })

  it('GET /articles/latest never lists the draft; limit is clamped', async () => {
    const res = await pub('/articles/latest')
    expect((res.body.data as Array<{ slug: string }>).map((a) => a.slug)).toEqual(['terbit-satu'])
    expect((await pub('/articles/latest?limit=0')).body.data).toHaveLength(1)
    expect((await pub('/articles/latest?limit=abc')).status).toBe(200)
    expect((await pub('/articles/latest?limit=9999')).status).toBe(200)
  })

  it('GET /articles/:slug of a draft or an unknown slug is 404 and counts nothing', async () => {
    errorOf(await pub(`/articles/${draftSlug}`), 404, 'NOT_FOUND', 'Not Found.')
    errorOf(await pub('/articles/tiada-slug'), 404, 'NOT_FOUND')
    const [row] = await t.db.query<{ views: number }>(`select views from articles where slug = 'draf-rahsia'`)
    expect(row?.views).toBe(9999)
  })

  it('unpublishing through the admin API hides an article from every reader route at once', async () => {
    const id = (await admin.post('/admin/articles', articleBody({ title: 'Akan Disorok' }))).body.data.id as string
    expect((await pub('/articles/akan-disorok')).status).toBe(200)
    await admin.put(`/admin/articles/${id}`, { isPublished: false })
    expect((await pub('/articles/akan-disorok')).status).toBe(404)
    expect(JSON.stringify((await pub('/articles')).body)).not.toContain('akan-disorok')
    expect(JSON.stringify((await pub('/articles/latest')).body)).not.toContain('akan-disorok')
    await admin.del(`/admin/articles/${id}`)
  })
})

describe('reader details', () => {
  it('the detail adds one view per read, includes it, and relates up to 3 of the same category', async () => {
    for (let i = 1; i <= 5; i++) await insertArticle(t, { title: `Motivasi ${String(i)}`, slug: `motivasi-${String(i)}`, category: 'MOTIVASI', publishedAt: `2026-10-0${String(i)}T00:00:00Z` })
    const a = await pub('/articles/motivasi-3')
    expect(a.status).toBe(200)
    const detail = ArticleDetailSchema.parse(a.body.data)
    expect(detail.views).toBe(1)
    expect(detail.related).toHaveLength(3)
    expect(detail.related.every((r) => r.category === 'MOTIVASI' && r.slug !== 'motivasi-3')).toBe(true)
    expect(detail.related.map((r) => r.slug)).toEqual(['motivasi-5', 'motivasi-4', 'motivasi-2'])
    expect(detail.author.initial).toBe(detail.author.name.charAt(0).toUpperCase())
    expect((await pub('/articles/motivasi-3')).body.data.views).toBe(2)
  })

  it('paginates 18 per page with the standard meta; an out-of-range or junk page is not an error', async () => {
    for (let i = 1; i <= 20; i++) await insertArticle(t, { title: `Halaman ${String(i)}`, slug: `halaman-${String(i)}`, category: 'BERITA', publishedAt: `2026-09-${String(i).padStart(2, '0')}T00:00:00Z` })
    const p1 = await pub('/articles?category=BERITA')
    expect(p1.body.data).toHaveLength(18)
    expect(p1.body.meta).toMatchObject({ page: 1, pageSize: 18, totalItems: 20, totalPages: 2, from: 1, to: 18 })
    expect(p1.body.data[0].slug).toBe('halaman-20') // newest first
    const p2 = await pub('/articles?category=BERITA&page=2')
    expect(p2.body.data).toHaveLength(2)
    expect(p2.body.meta).toMatchObject({ page: 2, from: 19, to: 20 })
    const far = await pub('/articles?category=BERITA&page=99')
    expect(far.status).toBe(200)
    expect(far.body.data).toEqual([])
    expect(far.body.meta.from).toBeNull()
    expect((await pub('/articles?category=BERITA&page=abc')).body.meta.page).toBe(1)
    expect((await pub('/articles?category=BERITA&page=0')).body.meta.page).toBe(1)
    expect((await pub('/articles?search=HALAMAN 1&category=BERITA')).body.meta.totalItems).toBe(11)
  })
})

describe('AC 2 and AC 6 admin articles', () => {
  it('creates an article: 201, status flash, the author is the session user, a slug is made, views 0', async () => {
    const res = await admin.post('/admin/articles', articleBody({ title: 'Tajuk Pertama' }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.status).toBe('Artikel berjaya ditambah.')
    const d = AdminArticleDetailSchema.parse(res.body.data)
    expect(d).toMatchObject({ slug: 'tajuk-pertama', views: 0, likes: 0, isPublished: true, categoryLabel: 'Tips Belajar', gradeLabel: 'Darjah 4', youtubeUrl: null, featuredImage: null, attachments: [] })
    expect(d.publishedAt).toEqual(expect.any(String))
    const [admRow] = await t.db.query<{ id: string }>(`select id::text from users where email = 'admin@demo.test'`)
    expect(d.authorId).toBe(admRow?.id)
    // A client-sent author is ignored.
    const other = await admin.post('/admin/articles', articleBody({ title: 'Penulis Palsu', authorId: '999999' }))
    expect(other.body.data.authorId).toBe(admRow?.id)
  })

  it('a taken title gets the next suffix; the slug is stable on rename and publishedAt is set at the first publish only', async () => {
    const a = await admin.post('/admin/articles', articleBody({ title: 'Tajuk Pertama', isPublished: false }))
    expect(a.body.data.slug).toBe('tajuk-pertama-2')
    expect(a.body.data.publishedAt).toBeNull()
    const id = a.body.data.id as string
    const renamed = await admin.put(`/admin/articles/${id}`, { title: 'Nama Baru Sama Sekali' })
    expect(renamed.status).toBe(200)
    expect(renamed.body.status).toBe('Artikel berjaya dikemaskini.')
    expect(renamed.body.data).toMatchObject({ title: 'Nama Baru Sama Sekali', slug: 'tajuk-pertama-2', publishedAt: null })
    const on = await admin.put(`/admin/articles/${id}`, { isPublished: true })
    const first = on.body.data.publishedAt as string
    expect(first).toEqual(expect.any(String))
    await admin.put(`/admin/articles/${id}`, { isPublished: false })
    t.clock.set('2026-10-19T10:00:00+08:00')
    const again = await admin.put(`/admin/articles/${id}`, { isPublished: true })
    expect(again.body.data.publishedAt).toBe(first)
  })

  it('concurrent creations of one title all succeed with distinct slugs', async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => admin.post('/admin/articles', articleBody({ title: 'Serentak', isPublished: false }))))
    for (const r of results) expect(r.status, JSON.stringify(r.body)).toBe(201)
    const slugs = results.map((r) => r.body.data.slug as string)
    expect(new Set(slugs).size).toBe(6)
    expect(slugs).toContain('serentak')
  })

  it('an absent field keeps its value; a sent null clears excerpt; gradeLevel null becomes SEMUA', async () => {
    const id = (await admin.post('/admin/articles', articleBody({ title: 'Kekal' }))).body.data.id as string
    const only = await admin.put(`/admin/articles/${id}`, { title: 'Hanya Tajuk' })
    expect(only.body.data).toMatchObject({ title: 'Hanya Tajuk', excerpt: 'Ringkasan ujian', category: 'TIPS_BELAJAR', gradeLevel: 'DARJAH_4', isPublished: true, isFeatured: false })
    const cleared = await admin.put(`/admin/articles/${id}`, { excerpt: null, gradeLevel: null })
    expect(cleared.body.data).toMatchObject({ excerpt: null, gradeLevel: 'SEMUA' })
    expect(cleared.body.data.content).toContain('Kandungan')
  })

  it('answers 422 with a message per invalid field and writes nothing', async () => {
    const before = (await t.db.query<{ n: string }>('select count(*)::text as n from articles'))[0]?.n
    const res = await admin.post('/admin/articles', { title: '', content: '', category: 'NOPE', gradeLevel: 'DARJAH_9', featuredImage: 'bukan-url', excerpt: 'x'.repeat(501), isPublished: 'mungkin' })
    expect(fieldsOf(res)).toMatchObject({ title: expect.any(String), content: expect.any(String), category: expect.any(String), gradeLevel: expect.any(String), featuredImage: expect.any(String), excerpt: expect.any(String), isPublished: expect.any(String) })
    expect(fieldsOf(await admin.post('/admin/articles', { title: 'T', content: 'C' }))).toHaveProperty('category')
    expect((await t.db.query<{ n: string }>('select count(*)::text as n from articles'))[0]?.n).toBe(before)
  })

  it('404 uses the screen copy for an unknown or malformed id, before the body is judged', async () => {
    errorOf(await admin.get('/admin/articles/999999'), 404, 'NOT_FOUND', 'Artikel tidak dijumpai.')
    errorOf(await admin.get('/admin/articles/categories'), 404, 'NOT_FOUND', 'Artikel tidak dijumpai.')
    errorOf(await admin.put('/admin/articles/999999', { title: '' }), 404, 'NOT_FOUND', 'Artikel tidak dijumpai.')
    errorOf(await admin.del('/admin/articles/999999'), 404, 'NOT_FOUND', 'Artikel tidak dijumpai.')
    errorOf(await admin.del('/admin/articles/12abc'), 404, 'NOT_FOUND')
  })

  it('the admin list shows every status, 20 per page, newest created first, with filters', async () => {
    const all = await admin.get('/admin/articles')
    expect(all.body.meta.pageSize).toBe(20)
    const dates = (all.body.data as Array<{ createdAt: string }>).map((a) => a.createdAt)
    expect([...dates].sort().reverse()).toEqual(dates)
    expect((await admin.get('/admin/articles?published=0')).body.data.every((a: { isPublished: boolean }) => !a.isPublished)).toBe(true)
    expect((await admin.get('/admin/articles?published=1')).body.data.every((a: { isPublished: boolean }) => a.isPublished)).toBe(true)
    expect((await admin.get('/admin/articles?search=draf')).body.data.map((a: { title: string }) => a.title)).toContain('Draf Rahsia')
    expect((await admin.get('/admin/articles?category=NOPE')).body.data).toEqual([])
  })

  it('the admin detail never counts a view', async () => {
    const id = await insertArticle(t, { title: 'Tanpa Kiraan', slug: 'tanpa-kiraan', views: 7 })
    await admin.get(`/admin/articles/${id}`)
    await admin.get(`/admin/articles/${id}`)
    expect((await admin.get(`/admin/articles/${id}`)).body.data.views).toBe(7)
  })

  it('delete is a hard delete answering 200 { deleted: 1 }, and its attachments go with it', async () => {
    const id = (await admin.post('/admin/articles', articleBody({ title: 'Untuk Dipadam' }))).body.data.id as string
    const png = await adminUpload()
    const fileId = (await t.db.query<{ id: string }>(`select id::text from files where public_id = $1`, [png]))[0]?.id
    await t.db.query(`insert into article_attachments (article_id, file_id, label) values ($1, $2, 'Lampiran A')`, [id, fileId])
    const detail = await admin.get(`/admin/articles/${id}`)
    expect(detail.body.data.attachments).toMatchObject([{ label: 'Lampiran A', fileName: 'Lampiran A', size: expect.any(Number) }])
    const res = await admin.del(`/admin/articles/${id}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { deleted: 1 }, status: 'Artikel berjaya dipadam.' })
    expect((await t.db.query<{ n: string }>(`select count(*)::text as n from article_attachments where article_id = $1`, [id]))[0]?.n).toBe('0')
    errorOf(await admin.get(`/admin/articles/${id}`), 404, 'NOT_FOUND')
  })

  it('every write is audited in the same transaction, with no body text in the audit row', async () => {
    const res = await admin.post('/admin/articles', articleBody({ title: 'Diaudit', content: '<p>teks rahsia dalam isi</p>' }))
    const id = res.body.data.id as string
    await admin.put(`/admin/articles/${id}`, { isFeatured: true })
    await admin.del(`/admin/articles/${id}`)
    const rows = await t.db.query<{ action: string; target_type: string; detail: unknown }>(`select action, target_type, detail from audit_events where target_id = $1 order by id`, [id])
    expect(rows.map((r) => r.action)).toEqual(['content.article.created', 'content.article.updated', 'content.article.deleted'])
    expect(rows.every((r) => r.target_type === 'article')).toBe(true)
    expect(JSON.stringify(rows)).not.toContain('teks rahsia')
  })

  it('a failed validation or a missing id leaves no audit row', async () => {
    const before = (await t.db.query<{ n: string }>(`select count(*)::text as n from audit_events where action like 'content.article.%'`))[0]?.n
    await admin.post('/admin/articles', { title: '' })
    await admin.put('/admin/articles/999999', {})
    await admin.del('/admin/articles/999999')
    expect((await t.db.query<{ n: string }>(`select count(*)::text as n from audit_events where action like 'content.article.%'`))[0]?.n).toBe(before)
  })
})

describe('AC 2 sanitiser on write', () => {
  const dirty =
    '<p onclick="steal()">Isi</p><script>alert(1)</script><img src="/api/files/AAAAAAAAAAAAAAAAAAAAAA" onerror="alert(2)">' +
    '<SCRIPT>alert(3)</SCRIPT><a href="  java\tscript:alert(4)">pautan</a><iframe src="https://e.test"></iframe>' +
    '<a href="data:text/html;base64,AAAA">d</a><p style="position:fixed">s</p>'

  function expectClean(html: string): void {
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/onerror|onclick/i)
    expect(html).not.toMatch(/javascript:|data:text/i)
    expect(html).not.toMatch(/<iframe/i)
    expect(html).not.toMatch(/style=/i)
    expect(html).toContain('Isi')
    expect(html).toContain("/api/files/AAAAAAAAAAAAAAAAAAAAAA")
  }

  it('removes <script>, onerror and friends from the stored body and from the returned body', async () => {
    const res = await admin.post('/admin/articles', articleBody({ title: 'Kotor', content: dirty }))
    expect(res.status).toBe(201)
    expectClean(res.body.data.content as string)
    const [stored] = await t.db.query<{ content: string }>(`select content from articles where id = $1`, [res.body.data.id])
    expectClean(stored?.content ?? '')
    expect(stored?.content).toBe(res.body.data.content)
    expectClean((await admin.get(`/admin/articles/${res.body.data.id}`)).body.data.content as string)
    expectClean((await pub(`/articles/${res.body.data.slug as string}`)).body.data.content as string)
  })

  it('sanitises on update too, and an untouched body is not re-sanitised away', async () => {
    const id = (await admin.post('/admin/articles', articleBody({ title: 'Kemas Kini Kotor' }))).body.data.id as string
    const res = await admin.put(`/admin/articles/${id}`, { content: dirty })
    expectClean(res.body.data.content as string)
    const [stored] = await t.db.query<{ content: string }>(`select content from articles where id = $1`, [id])
    expectClean(stored?.content ?? '')
  })

  it('the writer sanitises; the reader returns what is stored', async () => {
    const slug = 'masuk-terus'
    await insertArticle(t, { title: 'Masuk Terus', slug, content: '<p>ok</p>' })
    expect((await pub(`/articles/${slug}`)).body.data.content).toBe('<p>ok</p>')
  })
})

describe('AC 7 featured image goes through BE-04 (cms_image)', () => {
  it('accepts the download URL of an uploaded cms_image and returns it', async () => {
    const token = await adminUpload()
    const res = await admin.post('/admin/articles', articleBody({ title: 'Ada Gambar', featuredImage: `https://app.example/api/files/${token}` }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.featuredImage).toBe(`/api/files/${token}`)
    const [row] = await t.db.query<{ featured_image_file_id: string | null }>(`select featured_image_file_id::text from articles where id = $1`, [res.body.data.id])
    expect(row?.featured_image_file_id).not.toBeNull()
    const cleared = await admin.put(`/admin/articles/${res.body.data.id as string}`, { featuredImage: null })
    expect(cleared.body.data.featuredImage).toBeNull()
  })

  it('refuses an external URL, an unknown token and a file of another purpose', async () => {
    expect(fieldsOf(await admin.post('/admin/articles', articleBody({ featuredImage: 'https://example.com/a.jpg' })))).toHaveProperty('featuredImage', 'Medan ini tidak sah.')
    expect(fieldsOf(await admin.post('/admin/articles', articleBody({ featuredImage: 'https://x.test/api/files/AAAAAAAAAAAAAAAAAAAAAA' })))).toHaveProperty('featuredImage')
    const res = await admin.agent.post('/api/files?purpose=avatar').set('X-CSRF-Token', admin.csrf).attach('file', makePng(), { filename: 'a.png', contentType: 'image/png' })
    expect(res.status).toBe(201)
    expect(fieldsOf(await admin.post('/admin/articles', articleBody({ featuredImage: `https://x.test${res.body.data.url as string}` })))).toHaveProperty('featuredImage')
  })
})

describe('review fixes', () => {
  it('reserved slugs: a title that slugifies to hot or latest gets the next suffix, and the static routes still win', async () => {
    const hot = await admin.post('/admin/articles', articleBody({ title: 'Hot' }))
    const latest = await admin.post('/admin/articles', articleBody({ title: 'LATEST' }))
    expect(hot.body.data.slug).toBe('hot-2')
    expect(latest.body.data.slug).toBe('latest-2')
    expect(freeSlug('hot', new Set())).toBe('hot-2')
    const res = await pub('/articles/hot')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('12 concurrent creations of one title all succeed with distinct slugs', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => admin.post('/admin/articles', articleBody({ title: 'Lumba', isPublished: false }))))
    for (const r of results) expect(r.status, JSON.stringify(r.body)).toBe(201)
    expect(new Set(results.map((r) => r.body.data.slug as string)).size).toBe(12)
  })

  it('an image URL on another host is refused; the configured public origin is accepted', async () => {
    const token = await adminUpload()
    for (const url of [`https://evil.test/api/files/${token}`, `http://app.example.evil.test/api/files/${token}`, `https://app.example:8443/api/files/${token}`]) {
      expect(fieldsOf(await admin.post('/admin/articles', articleBody({ featuredImage: url }))), url).toHaveProperty('featuredImage')
    }
    expect((await admin.post('/admin/articles', articleBody({ title: 'Asal Betul', featuredImage: `https://app.example/api/files/${token}` }))).status).toBe(201)
    expect(fileTokenOfUrl('//evil.test/api/files/' + token, ['https://app.example'])).toBeNull()
    expect(fileTokenOfUrl(`/api/files/${token}`, [])).toBe(token)
  })

  it('a pool timeout (P2028) on a write is 429 with Retry-After, never a 5xx', async () => {
    const prisma = t.app.get(PrismaService)
    const spy = vi.spyOn(prisma, 'transaction').mockRejectedValueOnce(Object.assign(new Error('Transaction already closed'), { code: 'P2028' }))
    const res = await admin.post('/admin/articles', articleBody({ title: 'Tamat Masa' }))
    spy.mockRestore()
    errorOf(res, 429, 'RATE_LIMITED')
    expect(res.headers['retry-after']).toBeTruthy()
    expect((await t.db.query<{ n: string }>(`select count(*)::text as n from articles where title = 'Tamat Masa'`))[0]?.n).toBe('0')
  })

  it('a partial update writes only the sent fields and never touches the others', async () => {
    const id = (await admin.post('/admin/articles', articleBody({ title: 'Separa' }))).body.data.id as string
    await t.db.query(`update articles set is_featured = true, views = 41, excerpt = 'diubah serentak' where id = $1`, [id])
    const res = await admin.put(`/admin/articles/${id}`, { title: 'Separa Baru' })
    expect(res.body.data).toMatchObject({ title: 'Separa Baru', isFeatured: true, views: 41, excerpt: 'diubah serentak' })
  })

  it('counting a view is one atomic statement that refuses an unpublished or missing article', async () => {
    const repo = t.app.get(ArticlesRepository, { strict: false })
    const draft = await insertArticle(t, { title: 'Draf Kiraan', slug: 'draf-kiraan', published: false })
    expect(await repo.countView(BigInt(draft))).toBeNull()
    expect(await repo.countView(999_999_999n)).toBeNull()
    const live = await insertArticle(t, { title: 'Hidup Kiraan', slug: 'hidup-kiraan', views: 4 })
    expect(await repo.countView(BigInt(live))).toBe(5)
  })

  it('list queries do not carry the body', async () => {
    const repo = t.app.get(ArticlesRepository, { strict: false })
    const { rows } = await repo.readerList({ search: '', category: null, skip: 0, take: 2 })
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(r).not.toHaveProperty('content')
  })

  it('the reader order puts a published row without a publish time last, not first', async () => {
    await insertArticle(t, { title: 'Tanpa Masa', slug: 'tanpa-masa', publishedAt: null, published: true })
    const [row] = await t.db.query<{ n: string }>(`select count(*)::text as n from articles where is_published and published_at is null`)
    expect(Number(row?.n)).toBeGreaterThanOrEqual(0)
    const list = await pub('/articles?search=Tanpa Masa')
    expect(list.status).toBe(200)
    const all = (await pub('/articles/latest?limit=50')).body.data as Array<{ slug: string }>
    if (all.length > 1) expect(all[0]?.slug).not.toBe('tanpa-masa')
  })
})

describe('large bodies (JSON limit of the content write routes)', () => {
  it('a body of about 190,000 characters is accepted on article create and update and on note create', async () => {
    const big = 'x'.repeat(190_000)
    const a = await admin.post('/admin/articles', articleBody({ title: 'Besar', content: big }))
    expect(a.status, JSON.stringify(a.body).slice(0, 200)).toBe(201)
    expect(a.body.data.content).toHaveLength(190_000)
    expect((await admin.put('/admin/articles/' + (a.body.data.id as string), { content: big + 'y' })).status).toBe(200)
    const n = await admin.post('/admin/notes', { title: 'Nota Besar', content: big, subject: 'sains', noteType: 'RINGKASAN', grade: 'DARJAH_1' })
    expect(n.status).toBe(201)
  })

  it('a body over the contract cap is the contract 422, not 413', async () => {
    const over = 'x'.repeat(200_001)
    expect(fieldsOf(await admin.post('/admin/articles', articleBody({ content: over })))).toHaveProperty('content')
    expect(fieldsOf(await admin.put('/admin/articles/1', { content: over }).then((r) => (r.status === 404 ? admin.post('/admin/articles', articleBody({ content: over })) : r)))).toHaveProperty('content')
    expect(fieldsOf(await admin.post('/admin/notes', { title: 'T', content: over, subject: 'sains', noteType: 'RINGKASAN', grade: 'DARJAH_1' }))).toHaveProperty('content')
  })

  it('an anonymous or cookie-less 1.2 MB body is refused cheaply by the default parser (413), never parsed by the large one', async () => {
    const big = JSON.stringify(articleBody({ content: 'x'.repeat(1_200_000) }))
    const anon = await t.http().post('/api/admin/articles').set('Content-Type', 'application/json').send(big)
    expect(anon.status).toBe(413)
    const fake = await t.http().post('/api/admin/notes').set('Content-Type', 'application/json').set('Cookie', 'other=1').send(big)
    expect(fake.status).toBe(413)
    // A small anonymous body still reaches the guards: 401.
    errorOf(await t.http().post('/api/admin/articles').send(articleBody()), 401, 'UNAUTHORIZED')
  })

  it('a signed-in admin can still post a large body (cookie present, Content-Length within the limit)', async () => {
    const res = await admin.post('/admin/articles', articleBody({ title: 'Besar Sesi', content: 'x'.repeat(190_000) }))
    expect(res.status).toBe(201)
  })

  it('a body far over the limit is still 413', async () => {
    expect((await admin.post('/admin/articles', articleBody({ content: 'x'.repeat(1_400_000) }))).status).toBe(413)
  })
})

describe('rate limit', () => {
  it('public reads are limited per address and answer 429 with Retry-After', async () => {
    const limited = await bootCmsApp({ THROTTLE_PUBLIC_SEARCH_PER_MINUTE: '3' })
    try {
      for (let i = 0; i < 3; i++) expect((await limited.http().get('/api/articles')).status).toBe(200)
      const res = await limited.http().get('/api/articles')
      errorOf(res, 429, 'RATE_LIMITED')
      expect(res.headers['retry-after']).toBeTruthy()
    } finally {
      await limited.close()
    }
  })
})

async function adminUpload(): Promise<string> {
  const res = await admin.agent.post('/api/files?purpose=cms_image').set('X-CSRF-Token', admin.csrf).attach('file', makePng(), { filename: 'gambar.png', contentType: 'image/png' })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return res.body.data.id as string
}

