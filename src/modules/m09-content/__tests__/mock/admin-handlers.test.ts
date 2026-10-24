/**
 * M09 admin content handlers (SRS M09 v1.6 §7 #1–#5, #10–#19, #21–#23, #41–#42) against the §6.11
 * totals and the §6.9 anchors, and the reader endpoints (#6–#9, #20, #24, #25) reflecting the admin
 * mutations. Booted with the real core, M01, M02, M03, M14 and M09 at the project clock
 * (2026-09-25 15:40 MYT). Tests run in order and share one runtime: writes made by an earlier test
 * are accounted for in the later expectations.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m14 from '@/modules/m14-gamification/mock'

import m09, { articles, audioKbat, banners, notes, support } from '../../mock'

class MemoryStorage {
  private readonly items = new Map<string, string>()
  getItem(key: string) {
    return this.items.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.items.set(key, value)
  }
  removeItem(key: string) {
    this.items.delete(key)
  }
}

const ADMIN = 1
const PELAJAR = 2
const GURU = 5
const ADMIN_SEKOLAH = 8

interface Answer<T = unknown> {
  status: number
  body: T
}
interface Meta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  from: number | null
  to: number | null
}
interface ListBody<T, M extends object = Record<never, never>> {
  data: T[]
  meta: Meta & M
}
interface DataBody<T> {
  data: T
  status?: string
}
interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m14, m09],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}, 120_000)

afterAll(async () => {
  await runtime.reset()
  vi.unstubAllGlobals()
})

async function call<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  as: number | null,
  body?: unknown,
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as !== null) headers.authorization = `Bearer ${setUser(as).token}`
  const multipart = body instanceof FormData
  if (body !== undefined && !multipart) headers['content-type'] = 'application/json'
  const res: TransportResponse = await runtime.transport.request({
    method,
    url,
    headers,
    ...(body !== undefined ? { body } : {}),
  })
  return { status: res.status, body: res.body as T }
}
const get = <T>(url: string, as: number | null) => call<T>('GET', url, as)
const ids = (rows: readonly { id: number }[]): number[] => rows.map((r) => r.id)

const ARTICLE = {
  title: 'Tip Belajar Ujian Admin',
  excerpt: 'Ringkasan ujian',
  content: '<p>Kandungan <b>HTML</b></p>',
  category: 'TIPS_BELAJAR',
  gradeLevel: 'DARJAH_4',
  isPublished: true,
  isFeatured: false,
}

// ---------------------------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------------------------

describe('access', () => {
  const ENDPOINTS = [
    ['GET', '/api/admin/articles'],
    ['GET', '/api/admin/articles/1'],
    ['POST', '/api/admin/articles'],
    ['PUT', '/api/admin/articles/1'],
    ['DELETE', '/api/admin/articles/1'],
    ['GET', '/api/admin/notes'],
    ['GET', '/api/admin/notes/1'],
    ['POST', '/api/admin/notes'],
    ['PUT', '/api/admin/notes/1'],
    ['DELETE', '/api/admin/notes/1'],
    ['GET', '/api/admin/banners'],
    ['GET', '/api/admin/banners/1'],
    ['POST', '/api/admin/banners'],
    ['PUT', '/api/admin/banners/1'],
    ['DELETE', '/api/admin/banners/1'],
    ['GET', '/api/admin/audio-kbat-sets'],
    ['GET', '/api/admin/audio-kbat-sets/template'],
    ['POST', '/api/admin/audio-kbat-sets'],
    ['GET', '/api/admin/screenshots'],
    ['POST', '/api/admin/screenshots'],
  ] as const

  it.each(ENDPOINTS)('%s %s answers 401 without a session', async (method, url) => {
    const r = await call<ErrorBody>(method, url, null, method === 'GET' ? undefined : {})
    expect(r.status).toBe(401)
    expect(r.body.error.code).toBe('UNAUTHORIZED')
  })

  it.each(ENDPOINTS)(
    '%s %s answers 403 to a student, a teacher and a school admin',
    async (method, url) => {
      for (const as of [PELAJAR, GURU, ADMIN_SEKOLAH]) {
        const r = await call<ErrorBody>(method, url, as, method === 'GET' ? undefined : {})
        expect(r.status, `${method} ${url} as ${String(as)}`).toBe(403)
        expect(r.body.error.code).toBe('FORBIDDEN')
      }
    },
  )

  it('a non-numeric id (also "categories") is not an article: 404', async () => {
    expect((await get('/api/admin/articles/categories', ADMIN)).status).toBe(404)
    expect((await call('PUT', '/api/admin/notes/abc', ADMIN, {})).status).toBe(404)
  })
})

// ---------------------------------------------------------------------------------------------
// Articles #1–#5
// ---------------------------------------------------------------------------------------------

describe('#1 GET /api/admin/articles (S1)', () => {
  it('lists the 72 live articles, 20 per page, newest created first (BR-M09-03)', async () => {
    const r = await get<ListBody<Json>>('/api/admin/articles', ADMIN)
    expect(r.status).toBe(200)
    expect(r.body.meta).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 72,
      totalPages: 4,
      from: 1,
      to: 20,
    })
    expect(r.body.data).toHaveLength(20)
    expect(r.body.data[0]).toMatchObject({
      id: expect.any(Number) as number,
      categoryLabel: expect.any(String) as string,
      gradeLevel: expect.any(String) as string,
      isPublished: true,
      author: { id: expect.any(Number) as number, name: expect.any(String) as string },
    })
    const dates = r.body.data.map((a: Json) => a.createdAt as string)
    expect([...dates].sort().reverse()).toEqual(dates)
    const p4 = await get<ListBody<Json>>('/api/admin/articles?page=4', ADMIN)
    expect(p4.body.meta).toMatchObject({ page: 4, from: 61, to: 72 })
  })

  it('filters by category (the §6.11 counts), published flag and title search', async () => {
    const cat = async (c: string) =>
      (await get<ListBody<Json>>(`/api/admin/articles?category=${c}`, ADMIN)).body.meta.totalItems
    expect(await cat('TIPS_BELAJAR')).toBe(21)
    expect(await cat('MOTIVASI')).toBe(14)
    expect(await cat('PANDUAN_IBU_BAPA')).toBe(10)
    expect(await cat('PANDUAN_GURU')).toBe(6)
    expect(await cat('KEJAYAAN')).toBe(7)
    expect(await cat('BERITA')).toBe(7)
    expect(await cat('UMUM')).toBe(7)
    expect(await cat('all')).toBe(72)
    expect(await cat('NOPE')).toBe(0)
    const pub = await get<ListBody<Json>>('/api/admin/articles?published=1', ADMIN)
    expect(pub.body.meta.totalItems).toBe(72)
    const draft = await get<ListBody<Json>>('/api/admin/articles?published=0', ADMIN)
    expect(draft.body.meta.totalItems).toBe(0)
    expect(draft.body.data).toEqual([])
    expect(draft.body.meta.from).toBeNull()
    const s = await get<ListBody<Json>>('/api/admin/articles?search=TIPS', ADMIN)
    expect(s.body.data.length).toBeGreaterThan(0)
    for (const a of s.body.data) expect((a.title as string).toLowerCase()).toContain('tips')
  })
})

describe('#2 GET /api/admin/articles/:id', () => {
  it('returns the full article and never counts a view (BR-M09-07)', async () => {
    const a = (await get<DataBody<Json>>('/api/admin/articles/1', ADMIN)).body.data
    const b = (await get<DataBody<Json>>('/api/admin/articles/1', ADMIN)).body.data
    expect(a).toMatchObject({
      id: 1,
      slug: expect.any(String) as string,
      content: expect.any(String) as string,
      categoryLabel: expect.any(String) as string,
      author: { id: expect.any(Number) as number },
      attachments: [],
      youtubeUrl: null,
    })
    expect(b.views).toBe(a.views)
  })

  it('answers 404 with the S1 flash copy for an unknown id', async () => {
    const r = await get<ErrorBody>('/api/admin/articles/9999', ADMIN)
    expect(r.status).toBe(404)
    expect(r.body.error.code).toBe('NOT_FOUND')
    expect(r.body.error.message).toBe('Artikel tidak dijumpai.')
  })
})

describe('#3 POST /api/admin/articles (S2) and the reader', () => {
  let createdId = 0
  let createdSlug = ''

  it('creates a published article: 201, status flash, author = admin, views 0, runtime id 73', async () => {
    const r = await call<DataBody<Json>>('POST', '/api/admin/articles', ADMIN, ARTICLE)
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('Artikel berjaya ditambah.')
    expect(r.body.data).toMatchObject({
      id: 73,
      slug: 'tip-belajar-ujian-admin',
      views: 0,
      likes: 0,
      isPublished: true,
      author: { id: ADMIN },
      youtubeUrl: null,
      categoryLabel: 'Petua Belajar',
    })
    expect(r.body.data.publishedAt).toEqual(expect.any(String))
    createdId = r.body.data.id as number
    createdSlug = r.body.data.slug as string
  })

  it('appears first on the admin list, with the new totals', async () => {
    const r = await get<ListBody<Json>>('/api/admin/articles', ADMIN)
    expect(r.body.meta.totalItems).toBe(73)
    expect(r.body.data[0]).toMatchObject({ id: createdId, title: ARTICLE.title })
  })

  it('shows on the reader list first, on the detail by slug (views +1) and in latest', async () => {
    const list = await get<ListBody<Json>>('/api/articles', null)
    expect(list.body.meta.totalItems).toBe(73)
    expect(list.body.data[0]).toMatchObject({ id: createdId, slug: createdSlug })
    const latest = await get<ListBody<Json>>('/api/articles/latest', null)
    expect(latest.body.data[0].id).toBe(createdId)
    const detail = await get<DataBody<Json>>(`/api/articles/${createdSlug}`, null)
    expect(detail.status).toBe(200)
    expect(detail.body.data).toMatchObject({
      title: ARTICLE.title,
      content: ARTICLE.content,
      views: 1,
      gradeLabel: 'Darjah 4',
    })
    expect((detail.body.data.related as Json[]).every((a) => a.category === 'TIPS_BELAJAR')).toBe(
      true,
    )
    const byCat = await get<ListBody<Json>>('/api/articles?category=TIPS_BELAJAR', null)
    expect(byCat.body.meta.totalItems).toBe(22)
  })

  it('gives a taken title the next slug (BR-M09-08)', async () => {
    const r = await call<DataBody<Json>>('POST', '/api/admin/articles', ADMIN, {
      ...ARTICLE,
      isPublished: false,
    })
    expect(r.status).toBe(201)
    expect(r.body.data.slug).toBe('tip-belajar-ujian-admin-2')
    expect(r.body.data.publishedAt).toBeNull()
  })

  it('a draft is on the admin list but not on the reader (BR-M09-02)', async () => {
    const draft = await get<ListBody<Json>>('/api/admin/articles?published=0', ADMIN)
    expect(draft.body.meta.totalItems).toBe(1)
    expect((await get('/api/articles/tip-belajar-ujian-admin-2', null)).status).toBe(404)
    expect((await get<ListBody<Json>>('/api/articles', null)).body.meta.totalItems).toBe(73)
  })

  it('answers 422 with a field error per invalid field', async () => {
    const r = await call<ErrorBody>('POST', '/api/admin/articles', ADMIN, {
      title: '',
      content: '',
      category: 'NOPE',
      gradeLevel: 'DARJAH_9',
      featuredImage: 'bukan-url',
      excerpt: 'x'.repeat(501),
      isPublished: 'mungkin',
    })
    expect(r.status).toBe(422)
    expect(r.body.error.code).toBe('VALIDATION_ERROR')
    expect(r.body.error.fields).toEqual({
      title: 'Medan ini diperlukan.',
      content: 'Medan ini diperlukan.',
      category: 'Medan ini tidak sah.',
      gradeLevel: 'Medan ini tidak sah.',
      featuredImage: 'Medan ini tidak sah.',
      excerpt: 'Medan ini tidak sah.',
      isPublished: 'Medan ini tidak sah.',
    })
    const tooLong = await call<ErrorBody>('POST', '/api/admin/articles', ADMIN, {
      ...ARTICLE,
      title: 'x'.repeat(256),
    })
    expect(tooLong.body.error.fields).toEqual({ title: 'Medan ini tidak sah.' })
    const missingCat = await call<ErrorBody>('POST', '/api/admin/articles', ADMIN, {
      title: 'T',
      content: 'C',
    })
    expect(missingCat.body.error.fields).toEqual({ category: 'Medan ini diperlukan.' })
    expect((await get<ListBody<Json>>('/api/admin/articles', ADMIN)).body.meta.totalItems).toBe(74)
  })

  it('stores a valid featured image URL and defaults the grade level to SEMUA', async () => {
    const r = await call<DataBody<Json>>('POST', '/api/admin/articles', ADMIN, {
      title: 'Dengan Gambar',
      content: 'Isi',
      category: 'UMUM',
      featuredImage: 'https://example.com/a.jpg',
    })
    expect(r.status).toBe(201)
    expect(r.body.data).toMatchObject({
      featuredImage: 'https://example.com/a.jpg',
      gradeLevel: 'SEMUA',
      isPublished: false,
      isFeatured: false,
    })
  })
})

describe('#4 PUT /api/admin/articles/:id (S3) and the reader', () => {
  it('updates the article, keeps slug, views and publishedAt, and the reader sees the change', async () => {
    const before = (await get<DataBody<Json>>('/api/admin/articles/73', ADMIN)).body.data
    const r = await call<DataBody<Json>>('PUT', '/api/admin/articles/73', ADMIN, {
      ...ARTICLE,
      title: 'Tajuk Baharu',
      isFeatured: true,
    })
    expect(r.status).toBe(200)
    expect(r.body.status).toBe('Artikel berjaya dikemaskini.')
    expect(r.body.data).toMatchObject({
      id: 73,
      title: 'Tajuk Baharu',
      slug: before.slug,
      isFeatured: true,
      views: before.views,
      publishedAt: before.publishedAt,
    })
    const reader = await get<DataBody<Json>>(`/api/articles/${before.slug as string}`, null)
    expect(reader.body.data.title).toBe('Tajuk Baharu')
  })

  it('unpublishing hides it from every reader endpoint; republishing keeps the first publishedAt', async () => {
    const before = (await get<DataBody<Json>>('/api/admin/articles/73', ADMIN)).body.data
    const off = await call<DataBody<Json>>('PUT', '/api/admin/articles/73', ADMIN, {
      ...ARTICLE,
      title: 'Tajuk Baharu',
      isPublished: false,
    })
    expect(off.body.data.isPublished).toBe(false)
    expect((await get(`/api/articles/${before.slug as string}`, null)).status).toBe(404)
    const list = await get<ListBody<Json>>('/api/articles', null)
    expect(ids(list.body.data)).not.toContain(73)
    const latest = await get<ListBody<Json>>('/api/articles/latest', null)
    expect(ids(latest.body.data)).not.toContain(73)
    const on = await call<DataBody<Json>>('PUT', '/api/admin/articles/73', ADMIN, {
      ...ARTICLE,
      title: 'Tajuk Baharu',
      isPublished: true,
      isFeatured: true,
    })
    expect(on.body.data.publishedAt).toBe(before.publishedAt)
  })

  it('leaves a field that is absent from the request unchanged', async () => {
    const r = await call<DataBody<Json>>('PUT', '/api/admin/articles/73', ADMIN, {
      title: 'Hanya Tajuk',
    })
    expect(r.status).toBe(200)
    expect(r.body.data).toMatchObject({
      title: 'Hanya Tajuk',
      content: ARTICLE.content,
      category: 'TIPS_BELAJAR',
      isPublished: true,
      isFeatured: true,
    })
  })

  it('answers 404 for an unknown id and 422 for invalid fields (nothing written)', async () => {
    const nf = await call<ErrorBody>('PUT', '/api/admin/articles/9999', ADMIN, ARTICLE)
    expect(nf.status).toBe(404)
    expect(nf.body.error.message).toBe('Artikel tidak dijumpai.')
    const bad = await call<ErrorBody>('PUT', '/api/admin/articles/73', ADMIN, {
      title: '',
      category: 'X',
    })
    expect(bad.status).toBe(422)
    expect(bad.body.error.fields).toEqual({
      title: 'Medan ini diperlukan.',
      category: 'Medan ini tidak sah.',
    })
    expect((await get<DataBody<Json>>('/api/admin/articles/73', ADMIN)).body.data.title).toBe(
      'Hanya Tajuk',
    )
  })

  it('leaves the youtube link and the attachments of a teacher article as they are', async () => {
    const t = articles.createFromTeacher(GURU, {
      title: 'Artikel Guru',
      content: '<p>Guru</p>',
      youtubeUrl: 'https://youtu.be/abc12345678',
      category: 'PANDUAN_GURU',
      gradeLevel: 'SEMUA',
      attachments: [{ file: { name: 'Nota Guru.pdf', size: 1000, mime: 'application/pdf' } }],
    })
    const detail = (await get<DataBody<Json>>(`/api/admin/articles/${String(t.id)}`, ADMIN)).body
      .data
    expect(detail.youtubeUrl).toBe('https://youtu.be/abc12345678')
    expect(detail.attachments).toMatchObject([
      { fileName: 'Nota Guru.pdf', label: null, size: 1000 },
    ])
    expect(detail.isPublished).toBe(false)
    // The admin publishes it: the teacher fields stay and the article becomes readable.
    const r = await call<DataBody<Json>>('PUT', `/api/admin/articles/${String(t.id)}`, ADMIN, {
      title: 'Artikel Guru',
      content: '<p>Guru</p>',
      category: 'PANDUAN_GURU',
      gradeLevel: 'SEMUA',
      isPublished: true,
      isFeatured: false,
    })
    expect(r.body.data.youtubeUrl).toBe('https://youtu.be/abc12345678')
    expect(r.body.data.attachments).toHaveLength(1)
    expect((await get(`/api/articles/${r.body.data.slug as string}`, null)).status).toBe(200)
    expect(r.body.data.author.id).toBe(GURU)
  })
})

describe('#5 DELETE /api/admin/articles/:id', () => {
  it('deletes the article (and its attachments); the reader no longer lists it', async () => {
    const slug = (await get<DataBody<Json>>('/api/admin/articles/73', ADMIN)).body.data
      .slug as string
    const r = await call<DataBody<Json>>('DELETE', '/api/admin/articles/73', ADMIN)
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual({ deleted: 1 })
    expect(r.body.status).toBe('Artikel berjaya dipadam.')
    expect((await get('/api/admin/articles/73', ADMIN)).status).toBe(404)
    expect((await get(`/api/articles/${slug}`, null)).status).toBe(404)
    const teacher = articles.listByAuthor(GURU)
    const withAtt = await call(
      'DELETE',
      `/api/admin/articles/${String(teacher.rows[0]?.id)}`,
      ADMIN,
    )
    expect(withAtt.status).toBe(200)
    expect(articles.attachments(teacher.rows[0]?.id ?? 0)).toEqual([])
  })

  it('answers 404 for an unknown id', async () => {
    const r = await call<ErrorBody>('DELETE', '/api/admin/articles/73', ADMIN)
    expect(r.status).toBe(404)
    expect(r.body.error.message).toBe('Artikel tidak dijumpai.')
  })
})

// ---------------------------------------------------------------------------------------------
// Notes #10–#14
// ---------------------------------------------------------------------------------------------

const NOTE = {
  title: 'Nota Ujian',
  summary: 'Ringkasan nota',
  content: '<p>Isi</p>',
  subject: 'sejarah',
  noteType: 'LENGKAP',
  grade: 'DARJAH_5',
  isPublished: true,
}

describe('#10 GET /api/admin/notes (S5)', () => {
  it('lists the 10 live notes in id order with the labels and author', async () => {
    const r = await get<ListBody<Json>>('/api/admin/notes', ADMIN)
    expect(r.status).toBe(200)
    expect(r.body.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 10, totalPages: 1 })
    expect(ids(r.body.data)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(r.body.data[0]).toMatchObject({
      id: 1,
      title: 'Sifir 1 hingga 12 — Carta Lengkap',
      subject: 'matematik',
      subjectLabel: 'Matematik',
      noteType: 'FORMULA',
      grade: 'DARJAH_2',
      gradeLabel: 'Darjah 2',
      isPublished: true,
      views: 0,
      downloads: 0,
    })
    expect(r.body.data[0].author.name).not.toBe('')
  })

  it('filters by subject, the mapped note type (DV-M09-06) and search; no match is empty', async () => {
    const n = async (q: string) =>
      (await get<ListBody<Json>>(`/api/admin/notes?${q}`, ADMIN)).body.meta.totalItems
    expect(await n('subject=matematik')).toBe(3)
    expect(await n('subject=sains')).toBe(3)
    expect(await n('subject=bahasa_melayu')).toBe(2)
    expect(await n('subject=all')).toBe(10)
    expect(await n('noteType=summary')).toBe(5)
    expect(await n('noteType=full_notes')).toBe(2)
    expect(await n('noteType=mind_map')).toBe(0)
    expect(await n('noteType=cheat_sheet')).toBe(0)
    expect(await n('search=SIFIR')).toBe(1)
    expect(await n('subject=matematik&noteType=summary')).toBe(0)
    const empty = await get<ListBody<Json>>('/api/admin/notes?search=zzzz', ADMIN)
    expect(empty.body.data).toEqual([])
    expect(empty.body.meta.totalItems).toBe(0)
  })
})

describe('#11 GET /api/admin/notes/:id', () => {
  it('returns the note with its content; 404 for an unknown id', async () => {
    const r = await get<DataBody<Json>>('/api/admin/notes/1', ADMIN)
    expect(r.status).toBe(200)
    expect(r.body.data).toMatchObject({
      id: 1,
      summary: 'Carta sifir lengkap dari 1 hingga 12 untuk hafalan mudah.',
    })
    expect(r.body.data.content).toContain('Sifir 1 hingga 12')
    const nf = await get<ErrorBody>('/api/admin/notes/99', ADMIN)
    expect(nf.status).toBe(404)
    expect(nf.body.error.code).toBe('NOT_FOUND')
  })
})

describe('#12–#14 POST, PUT, DELETE /api/admin/notes (DV-M09-01)', () => {
  it('creates a note (never the live 500): 201, id 11, counters 0, listed last', async () => {
    const r = await call<DataBody<Json>>('POST', '/api/admin/notes', ADMIN, NOTE)
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('Nota berjaya ditambah.')
    expect(r.body.data).toMatchObject({
      id: 11,
      subjectLabel: 'Sejarah',
      gradeLabel: 'Darjah 5',
      views: 0,
      downloads: 0,
      author: { id: ADMIN },
    })
    const list = await get<ListBody<Json>>('/api/admin/notes', ADMIN)
    expect(list.body.meta.totalItems).toBe(11)
    expect(list.body.data[10].id).toBe(11)
    expect(notes.count('Q-NOTE-ALL')).toBe(11)
  })

  it('accepts the upper-case codes and the checkbox string "1"', async () => {
    const r = await call<DataBody<Json>>('POST', '/api/admin/notes', ADMIN, {
      ...NOTE,
      subject: 'SAINS',
      noteType: 'tips_tricks',
      isPublished: '0',
    })
    expect(r.status).toBe(201)
    expect(r.body.data).toMatchObject({
      subject: 'sains',
      noteType: 'TIPS_TRICKS',
      isPublished: false,
    })
  })

  it('answers 422 with field errors', async () => {
    const r = await call<ErrorBody>('POST', '/api/admin/notes', ADMIN, {
      title: ' ',
      content: '',
      subject: 'geografi',
      noteType: 'MIND_MAP',
      grade: 'DARJAH_7',
    })
    expect(r.status).toBe(422)
    expect(r.body.error.fields).toEqual({
      title: 'Medan ini diperlukan.',
      content: 'Medan ini diperlukan.',
      subject: 'Medan ini tidak sah.',
      noteType: 'Medan ini tidak sah.',
      grade: 'Medan ini tidak sah.',
    })
    const none = await call<ErrorBody>('POST', '/api/admin/notes', ADMIN, {})
    expect(Object.keys(none.body.error.fields ?? {}).sort()).toEqual(
      ['content', 'grade', 'noteType', 'subject', 'title'].sort(),
    )
  })

  it('updates a note and keeps its counters and author; 404 and 422 on failure', async () => {
    const r = await call<DataBody<Json>>('PUT', '/api/admin/notes/11', ADMIN, {
      ...NOTE,
      title: 'Nota Dikemaskini',
      isPublished: false,
    })
    expect(r.status).toBe(200)
    expect(r.body.status).toBe('Nota berjaya dikemaskini.')
    expect(r.body.data).toMatchObject({ id: 11, title: 'Nota Dikemaskini', isPublished: false })
    expect((await call('PUT', '/api/admin/notes/999', ADMIN, NOTE)).status).toBe(404)
    const bad = await call<ErrorBody>('PUT', '/api/admin/notes/11', ADMIN, { title: '' })
    expect(bad.status).toBe(422)
    expect(bad.body.error.fields).toEqual({ title: 'Medan ini diperlukan.' })
    expect(notes.get(11)?.title).toBe('Nota Dikemaskini')
  })

  it('deletes notes; 404 afterwards', async () => {
    const r = await call<DataBody<Json>>('DELETE', '/api/admin/notes/11', ADMIN)
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual({ deleted: 1 })
    expect(r.body.status).toBe('Nota berjaya dipadam.')
    expect((await call('DELETE', '/api/admin/notes/11', ADMIN)).status).toBe(404)
    await call('DELETE', '/api/admin/notes/12', ADMIN)
    expect(notes.count('Q-NOTE-ALL')).toBe(10)
  })
})

// ---------------------------------------------------------------------------------------------
// Banners #15–#19
// ---------------------------------------------------------------------------------------------

const BANNER = {
  title: 'Promosi Ujian',
  description: 'Penerangan banner',
  imageUrl: 'https://example.com/b.jpg',
  bannerType: 'promo',
  linkType: 'external',
  externalUrl: 'https://example.com/pergi',
  targetAudience: 'teacher',
  displayOrder: 0,
  startDate: '2026-09-01',
  endDate: '2026-12-31',
  isActive: true,
}

describe('#15 GET /api/admin/banners (S9)', () => {
  it('lists the 5 live banners in displayOrder then id order with stored codes', async () => {
    const r = await get<ListBody<Json>>('/api/admin/banners', ADMIN)
    expect(r.status).toBe(200)
    expect(r.body.data).toHaveLength(5)
    expect(r.body.meta.totalItems).toBe(5)
    const keys = r.body.data.map((b: Json) => [b.displayOrder, b.id])
    expect([...keys].sort((a, b) => a[0] - b[0] || a[1] - b[1])).toEqual(keys)
    const types = r.body.data.map((b: Json) => b.bannerType as string).sort()
    expect(types).toEqual(['ANNOUNCEMENT', 'FEATURE', 'FEATURE', 'HERO', 'PROMOTIONAL'])
    const audiences = r.body.data.map((b: Json) => b.targetAudience as string).sort()
    expect(audiences).toEqual(['ALL', 'ALL', 'STUDENT', 'STUDENT', 'STUDENT'])
    expect(r.body.data.every((b: Json) => b.isActive === true && b.linkType === 'NONE')).toBe(true)
  })
})

describe('#16 GET /api/admin/banners/:id', () => {
  it('returns one banner; 404 with the flash copy for an unknown id', async () => {
    const r = await get<DataBody<Json>>('/api/admin/banners/1', ADMIN)
    expect(r.status).toBe(200)
    expect(r.body.data.id).toBe(1)
    const nf = await get<ErrorBody>('/api/admin/banners/99', ADMIN)
    expect(nf.status).toBe(404)
    expect(nf.body.error.message).toBe('Banner tidak dijumpai.')
  })
})

describe('#17–#19 POST, PUT, DELETE /api/admin/banners and the carousel (#20)', () => {
  it('creates a banner with the codes upper-cased (BR-M09-12): 201, id 6', async () => {
    const r = await call<DataBody<Json>>('POST', '/api/admin/banners', ADMIN, BANNER)
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('Banner berjaya ditambah.')
    expect(r.body.data).toMatchObject({
      id: 6,
      bannerType: 'PROMO',
      linkType: 'EXTERNAL',
      targetAudience: 'TEACHER',
      externalUrl: 'https://example.com/pergi',
      displayOrder: 0,
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      isActive: true,
    })
    expect(banners.count('Q-BANNER-ALL')).toBe(6)
  })

  it('delivers it to a teacher, the admin and not a student (BR-M09-14)', async () => {
    const teacher = await get<ListBody<Json>>('/api/banners/active', GURU)
    expect(teacher.body.data.map((b: Json) => b.title)).toContain('Promosi Ujian')
    const admin = await get<ListBody<Json>>('/api/banners/active', ADMIN)
    expect(admin.body.data).toHaveLength(6)
    expect(admin.body.data[0]).toEqual({
      type: expect.any(String) as string,
      title: expect.any(String) as string,
      description: expect.anything() as unknown,
    })
    const student = await get<ListBody<Json>>('/api/banners/active', PELAJAR)
    expect(student.body.data.map((b: Json) => b.title)).not.toContain('Promosi Ujian')
  })

  it('applies the defaults of the form: NONE, ALL, order 0, active; drops externalUrl when not EXTERNAL', async () => {
    const r = await call<DataBody<Json>>('POST', '/api/admin/banners', ADMIN, {
      title: 'Minimum',
      bannerType: 'EVENT',
      externalUrl: 'https://example.com/x',
    })
    expect(r.status).toBe(201)
    expect(r.body.data).toMatchObject({
      linkType: 'NONE',
      targetAudience: 'ALL',
      displayOrder: 0,
      isActive: true,
      externalUrl: null,
      imageUrl: null,
      startDate: null,
      endDate: null,
    })
    await call('DELETE', `/api/admin/banners/${String(r.body.data.id)}`, ADMIN)
  })

  it('answers 422 with field errors', async () => {
    const r = await call<ErrorBody>('POST', '/api/admin/banners', ADMIN, {
      title: '',
      bannerType: 'FEATURE',
      linkType: 'EXTERNAL',
      targetAudience: 'PARENT',
      imageUrl: 'tiada',
      displayOrder: -1,
      startDate: '2026-12-31',
      endDate: '2026-01-01',
    })
    expect(r.status).toBe(422)
    expect(r.body.error.fields).toEqual({
      title: 'Medan ini diperlukan.',
      bannerType: 'Medan ini tidak sah.',
      targetAudience: 'Medan ini tidak sah.',
      imageUrl: 'Medan ini tidak sah.',
      externalUrl: 'Medan ini diperlukan.',
      displayOrder: 'Medan ini tidak sah.',
      endDate: 'Medan ini tidak sah.',
    })
    const missing = await call<ErrorBody>('POST', '/api/admin/banners', ADMIN, { title: 'T' })
    expect(missing.body.error.fields).toEqual({ bannerType: 'Medan ini diperlukan.' })
    expect(banners.count('Q-BANNER-ALL')).toBe(6)
  })

  it('updates a banner; a seeded banner can be saved with its stored code (BR-M09-13)', async () => {
    const stored = (await get<DataBody<Json>>('/api/admin/banners/2', ADMIN)).body.data
    expect(['FEATURE', 'PROMOTIONAL', 'HERO', 'ANNOUNCEMENT']).toContain(stored.bannerType)
    const same = await call<DataBody<Json>>('PUT', '/api/admin/banners/2', ADMIN, {
      ...stored,
      title: 'Tajuk Baharu Banner',
    })
    expect(same.status).toBe(200)
    expect(same.body.status).toBe('Banner berjaya dikemaskini.')
    expect(same.body.data).toMatchObject({
      id: 2,
      title: 'Tajuk Baharu Banner',
      bannerType: stored.bannerType,
    })
    // The stored code is accepted only for that banner: a new banner may not use FEATURE.
    const other = await call<ErrorBody>('PUT', '/api/admin/banners/6', ADMIN, {
      ...BANNER,
      bannerType: 'FEATURE',
    })
    expect(other.status).toBe(422)
    expect(other.body.error.fields).toEqual({ bannerType: 'Medan ini tidak sah.' })
  })

  it('deactivating a banner or changing its audience changes the carousel (#20)', async () => {
    const off = await call<DataBody<Json>>('PUT', '/api/admin/banners/6', ADMIN, {
      isActive: false,
    })
    expect(off.body.data.isActive).toBe(false)
    expect(off.body.data.title).toBe('Promosi Ujian')
    const teacher = await get<ListBody<Json>>('/api/banners/active', GURU)
    expect(teacher.body.data.map((b: Json) => b.title)).not.toContain('Promosi Ujian')
    await call('PUT', '/api/admin/banners/6', ADMIN, { isActive: true, targetAudience: 'student' })
    const student = await get<ListBody<Json>>('/api/banners/active', PELAJAR)
    expect(student.body.data.map((b: Json) => b.title)).toContain('Promosi Ujian')
    // A banner that has ended is not delivered.
    await call('PUT', '/api/admin/banners/6', ADMIN, {
      startDate: '2026-01-01',
      endDate: '2026-02-01',
    })
    const gone = await get<ListBody<Json>>('/api/banners/active', PELAJAR)
    expect(gone.body.data.map((b: Json) => b.title)).not.toContain('Promosi Ujian')
  })

  it('answers 404 for an unknown banner on PUT and DELETE', async () => {
    const put = await call<ErrorBody>('PUT', '/api/admin/banners/99', ADMIN, BANNER)
    expect(put.status).toBe(404)
    expect(put.body.error.message).toBe('Banner tidak dijumpai.')
    expect((await call('DELETE', '/api/admin/banners/99', ADMIN)).status).toBe(404)
  })

  it('deletes a banner and it leaves the carousel', async () => {
    const r = await call<DataBody<Json>>('DELETE', '/api/admin/banners/6', ADMIN)
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual({ deleted: 1 })
    expect(r.body.status).toBe('Banner berjaya dipadam.')
    expect(banners.count('Q-BANNER-ALL')).toBe(5)
    const admin = await get<ListBody<Json>>('/api/banners/active', ADMIN)
    expect(admin.body.data).toHaveLength(5)
  })
})

// ---------------------------------------------------------------------------------------------
// Audio KBAT #21–#23
// ---------------------------------------------------------------------------------------------

function audioFields(): Record<string, string> {
  const f: Record<string, string> = {
    title: 'BM T4 Ujian Mendengar Set 1',
    educationLevelId: '10',
    subjectId: '1',
    status: 'approved',
    sourceLabel: 'Cikgu Demo 02',
    instructions: 'Dengar dan jawab.',
  }
  for (let s = 1; s <= 4; s++) {
    f[`sections[${String(s)}][title]`] = `Audio ${String(s)}`
    f[`sections[${String(s)}][transcript]`] = `Transkrip ${String(s)}`
  }
  for (let q = 1; q <= 30; q++) {
    const p = `questions[${String(q)}]`
    f[`${p}[questionText]`] = `Soalan ${String(q)}`
    f[`${p}[optionA]`] = 'A'
    f[`${p}[optionB]`] = 'B'
    f[`${p}[optionC]`] = 'C'
    f[`${p}[optionD]`] = 'D'
    f[`${p}[correctAnswer]`] = q % 2 === 0 ? 'B' : 'A'
    f[`${p}[marks]`] = '1'
    f[`${p}[kbatLevel]`] = '3'
  }
  return f
}

function audioForm(
  override: Record<string, string | null> = {},
  files: Record<string, File> = {},
): FormData {
  const form = new FormData()
  for (const [k, v] of Object.entries({ ...audioFields(), ...override })) {
    if (v !== null) form.append(k, v)
  }
  for (const [k, file] of Object.entries(files)) form.append(k, file)
  return form
}

describe('#21 GET /api/admin/audio-kbat-sets (S12)', () => {
  it('has no set and the stat cards read 0 / 0 / 0 / 0', async () => {
    const r = await get<ListBody<Json, { stats: Json }>>('/api/admin/audio-kbat-sets', ADMIN)
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual([])
    expect(r.body.meta.totalItems).toBe(0)
    expect(r.body.meta.stats).toEqual({ sets: 0, approved: 0, draftPending: 0, questions: 0 })
  })
})

describe('#23 POST /api/admin/audio-kbat-sets (S13, multipart)', () => {
  it('creates an approved set with section files: 201, 4 sections, 30 questions', async () => {
    const mp3 = new File(['abc'], 'Bahagian Satu.MP3', { type: 'audio/mpeg' })
    const r = await call<DataBody<Json>>(
      'POST',
      '/api/admin/audio-kbat-sets',
      ADMIN,
      audioForm({}, { 'sections[1][audio]': mp3 }),
    )
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('Set Audio KBAT berjaya disimpan.')
    expect(r.body.data).toMatchObject({
      id: 1,
      title: 'BM T4 Ujian Mendengar Set 1',
      status: 'approved',
      statusLabel: 'Diluluskan',
      questionCount: 30,
      sourceLabel: 'Cikgu Demo 02',
      instructions: 'Dengar dan jawab.',
    })
    expect(r.body.data.educationLevel.id).toBe(10)
    expect(r.body.data.subject.id).toBe(1)
    expect(r.body.data.sections).toHaveLength(4)
    expect(r.body.data.sections[0]).toMatchObject({
      no: 1,
      title: 'Audio 1',
      audioFileName: 'bahagian-satu.mp3',
      transcript: 'Transkrip 1',
      questionFrom: 1,
      questionTo: 8,
    })
    expect(r.body.data.sections[3]).toMatchObject({
      questionFrom: 25,
      questionTo: 30,
      audioFileName: null,
    })
    expect(audioKbat.get(1)?.questions[1]).toMatchObject({
      correctAnswer: 'B',
      marks: 1,
      kbatLevel: 3,
    })
  })

  it('updates the stat cards (BR-M09-15) and lists the set with its filters', async () => {
    const r = await get<ListBody<Json, { stats: Json }>>('/api/admin/audio-kbat-sets', ADMIN)
    expect(r.body.meta.stats).toEqual({ sets: 1, approved: 1, draftPending: 0, questions: 30 })
    expect(r.body.data).toHaveLength(1)
    expect(r.body.data[0]).toMatchObject({ id: 1, questionCount: 30, statusLabel: 'Diluluskan' })
    expect(r.body.data[0].educationLevel.name).toEqual(expect.any(String))
    const none = await get<ListBody<Json, { stats: Json }>>(
      '/api/admin/audio-kbat-sets?educationLevelId=11&search=zzz&status=draft',
      ADMIN,
    )
    expect(none.body.data).toEqual([])
    // The stat cards never follow the filter.
    expect(none.body.meta.stats.sets).toBe(1)
    const hit = await get<ListBody<Json>>(
      '/api/admin/audio-kbat-sets?educationLevelId=10&subjectId=1&status=approved&search=cikgu demo',
      ADMIN,
    )
    expect(ids(hit.body.data)).toEqual([1])
  })

  it('the approved set is on the student list and its player, with the stored audio URL and no answers', async () => {
    const list = await get<{ data: Json[] }>('/api/audio-kbat-sets', PELAJAR)
    expect(ids(list.body.data)).toEqual([1])
    const detail = await get<DataBody<Json>>('/api/audio-kbat-sets/1', PELAJAR)
    expect(detail.status).toBe(200)
    expect(detail.body.data.sections[0].audioUrl).toBe('/storage/audio-kbat/1/bahagian-satu.mp3')
    expect(detail.body.data.sections[1].audioUrl).toBeNull()
    expect(JSON.stringify(detail.body.data)).not.toContain('correctAnswer')
  })

  it('a draft or pending set counts in Draf/Menunggu and is not on the student list', async () => {
    const r = await call<DataBody<Json>>(
      'POST',
      '/api/admin/audio-kbat-sets',
      ADMIN,
      audioForm({ status: 'pending_review', title: 'Set Dua' }),
    )
    expect(r.status).toBe(201)
    expect(r.body.data.statusLabel).toBe('Menunggu Semakan')
    const stats = (await get<ListBody<Json, { stats: Json }>>('/api/admin/audio-kbat-sets', ADMIN))
      .body.meta.stats
    expect(stats).toEqual({ sets: 2, approved: 1, draftPending: 1, questions: 60 })
    expect(ids((await get<{ data: Json[] }>('/api/audio-kbat-sets', PELAJAR)).body.data)).toEqual([
      1,
    ])
    expect((await get('/api/audio-kbat-sets/2', PELAJAR)).status).toBe(404)
    const byStatus = await get<ListBody<Json>>(
      '/api/admin/audio-kbat-sets?status=pending_review',
      ADMIN,
    )
    expect(ids(byStatus.body.data)).toEqual([2])
    expect(support.screenshotCount()).toBe(0)
  })

  it('defaults status to approved, accepts snake_case keys and an empty file input', async () => {
    const form = new FormData()
    for (const [k, v] of Object.entries(audioFields())) {
      form.append(
        k
          .replace('educationLevelId', 'education_level_id')
          .replace('subjectId', 'subject_id')
          .replace('sourceLabel', 'source_label')
          .replace('[questionText]', '[question_text]')
          .replace('[optionA]', '[option_a]')
          .replace('[correctAnswer]', '[correct_answer]')
          .replace('[kbatLevel]', '[kbat_level]'),
        v,
      )
    }
    form.delete('status')
    form.append('sections[2][audio]', new File([], ''))
    const r = await call<DataBody<Json>>('POST', '/api/admin/audio-kbat-sets', ADMIN, form)
    expect(r.status).toBe(201)
    expect(r.body.data.status).toBe('approved')
    expect(r.body.data.sections[1].audioFileName).toBeNull()
  })

  it('accepts a JSON body with sections and questions arrays', async () => {
    const f = audioFields()
    const r = await call<DataBody<Json>>('POST', '/api/admin/audio-kbat-sets', ADMIN, {
      title: 'Set JSON',
      educationLevelId: 11,
      subjectId: 2,
      status: 'draft',
      sections: [1, 2, 3, 4].map((n) => ({ title: `Bahagian ${String(n)}` })),
      questions: Array.from({ length: 30 }, (_, i) => ({
        questionText: f[`questions[${String(i + 1)}][questionText]`],
        optionA: 'a',
        optionB: 'b',
        optionC: 'c',
        optionD: 'd',
        correctAnswer: 'C',
        marks: 2,
      })),
    })
    expect(r.status).toBe(201)
    expect(r.body.data.sections[2].title).toBe('Bahagian 3')
    expect(audioKbat.get(r.body.data.id as number)?.questions[0]).toMatchObject({
      correctAnswer: 'C',
      marks: 2,
      kbatLevel: 3,
    })
  })

  it('answers 422 for a missing title, an unknown level or subject, and an archived status', async () => {
    const r = await call<ErrorBody>(
      'POST',
      '/api/admin/audio-kbat-sets',
      ADMIN,
      audioForm({ title: '', educationLevelId: '999', subjectId: null, status: 'archived' }),
    )
    expect(r.status).toBe(422)
    expect(r.body.error.fields).toEqual({
      title: 'Medan ini diperlukan.',
      educationLevelId: 'Medan ini tidak sah.',
      subjectId: 'Medan ini diperlukan.',
      status: 'Medan ini tidak sah.',
    })
  })

  it('answers 422 for incomplete or out-of-range questions', async () => {
    const r = await call<ErrorBody>(
      'POST',
      '/api/admin/audio-kbat-sets',
      ADMIN,
      audioForm({
        'questions[3][questionText]': '',
        'questions[4][correctAnswer]': 'E',
        'questions[5][marks]': '21',
        'questions[6][kbatLevel]': '0',
        'questions[7][optionC]': null,
        'questions[8][dskpSpId]': 'x',
        'questions[30][correctAnswer]': null,
      }),
    )
    expect(r.status).toBe(422)
    expect(r.body.error.fields).toEqual({
      'questions.3.questionText': 'Medan ini diperlukan.',
      'questions.4.correctAnswer': 'Medan ini tidak sah.',
      'questions.5.marks': 'Medan ini tidak sah.',
      'questions.6.kbatLevel': 'Medan ini tidak sah.',
      'questions.7.optionC': 'Medan ini diperlukan.',
      'questions.8.dskpSpId': 'Medan ini tidak sah.',
      'questions.30.correctAnswer': 'Medan ini diperlukan.',
    })
    const noQuestions = await call<ErrorBody>('POST', '/api/admin/audio-kbat-sets', ADMIN, {
      title: 'T',
      educationLevelId: 10,
      subjectId: 1,
    })
    expect(noQuestions.status).toBe(422)
    expect(Object.keys(noQuestions.body.error.fields ?? {})).toHaveLength(30 * 5 + 30 - 0)
  })

  it('refuses a section file that is not audio or is over 20 MB', async () => {
    const png = new File(['x'], 'gambar.png', { type: 'image/png' })
    const big = new File(['x'], 'besar.mp3', { type: 'audio/mpeg' })
    Object.defineProperty(big, 'size', { value: 20 * 1024 * 1024 + 1 })
    const r = await call<ErrorBody>(
      'POST',
      '/api/admin/audio-kbat-sets',
      ADMIN,
      audioForm({}, { 'sections[1][audio]': png, 'sections[2][audio]': big }),
    )
    expect(r.status).toBe(422)
    expect(r.body.error.fields).toEqual({
      'sections.1.audio': 'gambar.png: format atau saiz tidak dibenarkan.',
      'sections.2.audio': 'besar.mp3: format atau saiz tidak dibenarkan.',
    })
  })

  it('writes nothing on a 422', async () => {
    const before = audioKbat.stats().sets
    await call('POST', '/api/admin/audio-kbat-sets', ADMIN, audioForm({ title: '' }))
    expect(audioKbat.stats().sets).toBe(before)
  })
})

describe('#22 GET /api/admin/audio-kbat-sets/template', () => {
  it('serves the XLSX and Word placeholder files', async () => {
    const xlsx = await get<Blob>('/api/admin/audio-kbat-sets/template?format=xlsx', ADMIN)
    expect(xlsx.status).toBe(200)
    expect(xlsx.body).toBeInstanceOf(Blob)
    expect(xlsx.body.type).toContain('spreadsheetml')
    const docx = await get<Blob>('/api/admin/audio-kbat-sets/template?format=docx', ADMIN)
    expect(docx.status).toBe(200)
    expect(docx.body.type).toContain('wordprocessingml')
    const dflt = await get<Blob>('/api/admin/audio-kbat-sets/template', ADMIN)
    expect(dflt.body.type).toContain('spreadsheetml')
  })

  it('answers 422 for an unknown format', async () => {
    const r = await get<ErrorBody>('/api/admin/audio-kbat-sets/template?format=pdf', ADMIN)
    expect(r.status).toBe(422)
    expect(r.body.error.fields).toEqual({ format: 'Medan ini tidak sah.' })
  })
})

// ---------------------------------------------------------------------------------------------
// Screenshots #41–#42
// ---------------------------------------------------------------------------------------------

describe('#41 GET /api/admin/screenshots (S14)', () => {
  it('is empty on the default seed: "Jumlah: 0 fail"', async () => {
    const r = await get<{ data: Json[]; meta: { total: number } }>('/api/admin/screenshots', ADMIN)
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual([])
    expect(r.body.meta.total).toBe(0)
  })
})

describe('#42 POST /api/admin/screenshots', () => {
  const upload = (...files: File[]): FormData => {
    const form = new FormData()
    for (const f of files) form.append('files[]', f)
    return form
  }

  it('saves images under sanitised names, a taken name gets -1 (BR-M09-30)', async () => {
    const r = await call<DataBody<{ saved: Json[]; rejected: Json[] }>>(
      'POST',
      '/api/admin/screenshots',
      ADMIN,
      upload(
        new File(['a'], 'Skrin Saya (1).PNG', { type: 'image/png' }),
        new File(['b'], 'skrin saya (1).png', { type: 'image/png' }),
      ),
    )
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('2 fail berjaya dimuat naik.')
    expect(r.body.data.rejected).toEqual([])
    expect(r.body.data.saved.map((s) => s.fileName)).toEqual([
      'skrin-saya-1.png',
      'skrin-saya-1-1.png',
    ])
    expect(r.body.data.saved[0]).toMatchObject({
      id: 1,
      originalName: 'Skrin Saya (1).PNG',
      size: 1,
      mimeType: 'image/png',
      uploadedById: ADMIN,
      url: 'blob:mock/screenshots/skrin-saya-1.png',
    })
    const list = await get<{ data: Json[]; meta: { total: number } }>(
      '/api/admin/screenshots',
      ADMIN,
    )
    expect(list.body.meta.total).toBe(2)
    expect(list.body.data).toHaveLength(2)
    expect(support.screenshotCount()).toBe(2)
  })

  it('reports a refused file next to the saved ones; a type-less file is judged by extension', async () => {
    const r = await call<DataBody<{ saved: Json[]; rejected: Json[] }>>(
      'POST',
      '/api/admin/screenshots',
      ADMIN,
      upload(
        new File(['a'], 'foto.webp', { type: '' }),
        new File(['b'], 'dokumen.pdf', { type: 'application/pdf' }),
      ),
    )
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('1 fail berjaya dimuat naik.')
    expect(r.body.data.saved.map((s) => s.fileName)).toEqual(['foto.webp'])
    expect(r.body.data.rejected).toEqual([
      { name: 'dokumen.pdf', reason: 'dokumen.pdf: format atau saiz tidak dibenarkan.' },
    ])
  })

  it('refuses a file over 10 MB', async () => {
    const big = new File(['x'], 'besar.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
    const r = await call<ErrorBody>('POST', '/api/admin/screenshots', ADMIN, upload(big))
    expect(r.status).toBe(422)
    expect(r.body.error.fields).toEqual({
      files: 'Fail mesti JPG, PNG, GIF, WebP atau BMP, maksimum 10 MB.',
    })
    expect(support.screenshotCount()).toBe(3)
  })

  it('answers 422 when no file is sent (also an empty file input)', async () => {
    const none = await call<ErrorBody>('POST', '/api/admin/screenshots', ADMIN, upload())
    expect(none.status).toBe(422)
    expect(none.body.error.fields).toEqual({ files: 'Medan ini diperlukan.' })
    const empty = await call<ErrorBody>(
      'POST',
      '/api/admin/screenshots',
      ADMIN,
      upload(new File([], '')),
    )
    expect(empty.status).toBe(422)
  })

  it('is private: the list is admin only', async () => {
    expect((await get('/api/admin/screenshots', PELAJAR)).status).toBe(403)
  })
})

// ---------------------------------------------------------------------------------------------
// Security hardening (M-1, M-2, L-1, L-2, L-4; limits are INFERRED, not observed on live)
// ---------------------------------------------------------------------------------------------

describe('hardening', () => {
  const audioSection = (file: File) =>
    call<DataBody<Json> & ErrorBody>(
      'POST',
      '/api/admin/audio-kbat-sets',
      ADMIN,
      audioForm({}, { 'sections[1][audio]': file }),
    )

  it('M-1: an audio file needs an audio MIME and an audio extension', async () => {
    const html = await audioSection(new File(['x'], 'x.html', { type: 'audio/mpeg' }))
    expect(html.status).toBe(422)
    expect(html.body.error.fields).toEqual({
      'sections.1.audio': 'x.html: format atau saiz tidak dibenarkan.',
    })
    const wrongType = await audioSection(new File(['x'], 'x.mp3', { type: 'text/html' }))
    expect(wrongType.status).toBe(422)
    const noExt = await audioSection(new File(['x'], 'rakaman', { type: 'audio/mpeg' }))
    expect(noExt.status).toBe(422)
    const mp4 = await audioSection(new File(['x'], 'Klip Satu.MP4', { type: 'video/mp4' }))
    expect(mp4.status).toBe(201)
    expect(mp4.body.data.sections[0].audioFileName).toBe('klip-satu.mp4')
  })

  it('M-2: the stored audio name has no leading dots, a fallback and a length cap', async () => {
    const dots = await audioSection(new File(['x'], '..hidden.mp3', { type: 'audio/mpeg' }))
    expect(dots.body.data.sections[0].audioFileName).toBe('hidden.mp3')
    const empty = await audioSection(new File(['x'], '..$$.mp3', { type: 'audio/mpeg' }))
    expect(empty.body.data.sections[0].audioFileName).toBe('audio1.mp3')
    const odd = await audioSection(new File(['x'], 'a.b.c.ogg', { type: 'audio/ogg' }))
    expect(odd.body.data.sections[0].audioFileName).toBe('abc.ogg')
    const long = await audioSection(
      new File(['x'], `${'a'.repeat(300)}.wav`, { type: 'audio/wav' }),
    )
    const stored = long.body.data.sections[0].audioFileName as string
    expect(stored.length).toBeLessThanOrEqual(124)
    expect(stored.endsWith('.wav')).toBe(true)
  })

  const shots = (...files: File[]): FormData => {
    const form = new FormData()
    for (const f of files) form.append('files[]', f)
    return form
  }

  it('L-1: at most 20 screenshots per request', async () => {
    const before = support.screenshotCount()
    const many = Array.from(
      { length: 21 },
      (_, i) => new File(['x'], `f${String(i)}.png`, { type: 'image/png' }),
    )
    const r = await call<ErrorBody>('POST', '/api/admin/screenshots', ADMIN, shots(...many))
    expect(r.status).toBe(422)
    expect(r.body.error.fields?.files).toContain('20')
    expect(support.screenshotCount()).toBe(before)
    const twenty = await call<DataBody<{ saved: Json[] }>>(
      'POST',
      '/api/admin/screenshots',
      ADMIN,
      shots(...many.slice(0, 20)),
    )
    expect(twenty.status).toBe(201)
    expect(twenty.body.data.saved).toHaveLength(20)
  })

  it('L-1: an oversized file is a rejected entry and the extension must agree with the MIME', async () => {
    const big = new File(['x'], 'besar.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
    const r = await call<DataBody<{ saved: Json[]; rejected: Json[] }>>(
      'POST',
      '/api/admin/screenshots',
      ADMIN,
      shots(
        big,
        new File(['x'], 'ok.png', { type: 'image/png' }),
        new File(['x'], 'palsu.html', { type: 'image/png' }),
        new File(['x'], 'palsu2.png', { type: 'image/jpeg' }),
        new File(['x'], 'cat.JPEG', { type: 'image/jpeg' }),
      ),
    )
    expect(r.status).toBe(201)
    expect(r.body.data.saved.map((s) => s.fileName)).toEqual(['ok.png', 'cat.jpeg'])
    expect(r.body.data.rejected.map((x) => x.name)).toEqual([
      'besar.png',
      'palsu.html',
      'palsu2.png',
    ])
  })

  it('L-2: a screenshot name that sanitises to nothing becomes screenshot-{n}.{ext}', async () => {
    const before = support.screenshotCount()
    const r = await call<DataBody<{ saved: Json[] }>>(
      'POST',
      '/api/admin/screenshots',
      ADMIN,
      shots(
        new File(['x'], '$$$.png', { type: 'image/png' }),
        new File(['x'], '..Foto Baru.png', { type: 'image/png' }),
      ),
    )
    expect(r.status).toBe(201)
    const names = r.body.data.saved.map((s) => s.fileName as string)
    expect(names[0]).toBe(`screenshot-${String(before + 1)}.png`)
    expect(names[1]).toBe('foto-baru.png')
  })

  it('L-4: article and note content are capped at 200,000 characters', async () => {
    const ok = 'x'.repeat(200_000)
    const a = await call<DataBody<Json>>('POST', '/api/admin/articles', ADMIN, {
      ...ARTICLE,
      content: ok,
    })
    expect(a.status).toBe(201)
    const tooBig = await call<ErrorBody>('POST', '/api/admin/articles', ADMIN, {
      ...ARTICLE,
      content: `${ok}x`,
    })
    expect(tooBig.body.error.fields).toEqual({ content: 'Medan ini tidak sah.' })
    const n = await call<ErrorBody>('POST', '/api/admin/notes', ADMIN, {
      ...NOTE,
      content: `${ok}x`,
    })
    expect(n.status).toBe(422)
    expect(n.body.error.fields).toEqual({ content: 'Medan ini tidak sah.' })
    expect((await call('POST', '/api/admin/notes', ADMIN, { ...NOTE, content: ok })).status).toBe(
      201,
    )
  })

  it('L-4: audio text limits and the banner description limit', async () => {
    const r = await call<ErrorBody>(
      'POST',
      '/api/admin/audio-kbat-sets',
      ADMIN,
      audioForm({
        instructions: 'x'.repeat(5001),
        'questions[1][questionText]': 'x'.repeat(2001),
        'questions[2][optionA]': 'x'.repeat(501),
        'questions[3][explanation]': 'x'.repeat(2001),
      }),
    )
    expect(r.status).toBe(422)
    expect(r.body.error.fields).toEqual({
      instructions: 'Medan ini tidak sah.',
      'questions.1.questionText': 'Medan ini tidak sah.',
      'questions.2.optionA': 'Medan ini tidak sah.',
      'questions.3.explanation': 'Medan ini tidak sah.',
    })
    const edge = await call(
      'POST',
      '/api/admin/audio-kbat-sets',
      ADMIN,
      audioForm({
        instructions: 'x'.repeat(5000),
        'questions[1][questionText]': 'x'.repeat(2000),
        'questions[2][optionA]': 'x'.repeat(500),
        'questions[3][explanation]': 'x'.repeat(2000),
      }),
    )
    expect(edge.status).toBe(201)
    const b = await call<ErrorBody>('POST', '/api/admin/banners', ADMIN, {
      ...BANNER,
      description: 'x'.repeat(5001),
    })
    expect(b.body.error.fields).toEqual({ description: 'Medan ini tidak sah.' })
    const okBanner = await call('POST', '/api/admin/banners', ADMIN, {
      ...BANNER,
      description: 'x'.repeat(5000),
    })
    expect(okBanner.status).toBe(201)
  })
})
