/**
 * M09-T1: the reader handlers (SRS M09 v1.5 §7 #6–#9, #20, #24–#40, #43) against the §6.11 totals and
 * the §6.9 anchors. Booted with the real core, M01, M02, M03, M14 and M09 at the project clock
 * (2026-09-25 15:40 MYT). The admin endpoints (#1–#5, #10–#19, #21–#23, #41–#42) are deferred and
 * have no test. Tests run in order and share one runtime: writes made by an earlier test are
 * accounted for in the later expectations.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock, type Clock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m14 from '@/modules/m14-gamification/mock'

import type {
  ActiveBanner,
  ArticleCard,
  ArticleDetail,
  AudioAttemptResult,
  AudioSetDetail,
  AudioSetListItem,
  ComposeContext,
  HotCard,
  OwnPerutusanItem,
  PerutusanCard,
  PerutusanDetail,
  PublicPerutusan,
  ReactionResult,
  SupportConfig,
  VideoCard,
  VideoDetail,
  VideoFormContext,
  VideoListMeta,
} from '../../api/types'
import m09, { audioKbat, perutusan, videos } from '../../mock'

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

// Canonical accounts (M01 §6.8).
const ADMIN = 1
const PELAJAR = 2
const MAJU = 4
const GURU = 5
const ADMIN_SEKOLAH = 8

interface Answer<T = unknown> {
  status: number
  body: T
}

interface ListBody<T, M extends object = Record<never, never>> {
  data: T[]
  meta: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    from: number | null
    to: number | null
  } & M
}

interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> }
}

let runtime: MockRuntime
let clock: Clock

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  clock = createClock({ at: CLOCK_ANCHOR_ISO })
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m14, m09],
    clock,
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
  const multipart = typeof FormData !== 'undefined' && body instanceof FormData
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

async function data<T>(url: string, as: number | null): Promise<T> {
  const r = await get<{ data: T }>(url, as)
  expect(r.status, url).toBe(200)
  return r.body.data
}

const ids = (rows: readonly { id: number }[]): number[] => rows.map((r) => r.id)
const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

// ---------------------------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------------------------

describe('access', () => {
  it.each([
    ['GET', '/api/banners/active'],
    ['GET', '/api/audio-kbat-sets'],
    ['GET', '/api/audio-kbat-sets/1'],
    ['POST', '/api/audio-kbat-sets/1/attempts'],
    ['GET', '/api/videos/form-context'],
    ['POST', '/api/videos'],
    ['PUT', '/api/videos/1'],
    ['DELETE', '/api/videos/1'],
    ['GET', '/api/perutusan'],
    ['GET', '/api/perutusan/mine'],
    ['GET', '/api/perutusan/2'],
    ['GET', '/api/perutusan/compose-context'],
    ['POST', '/api/perutusan'],
    ['POST', '/api/perutusan/2/reactions'],
    ['POST', '/api/perutusan/2/comments'],
  ] as const)('%s %s answers 401 UNAUTHORIZED without a session', async (method, url) => {
    const r = await call<ErrorBody>(method, url, null)
    expect(r.status).toBe(401)
    expect(r.body.error.code).toBe('UNAUTHORIZED')
  })

  it.each([
    '/api/articles',
    '/api/articles/hot',
    '/api/articles/latest',
    '/api/videos',
    '/api/videos/1',
    '/api/public/perutusan/4',
    '/api/config/support',
  ])('%s is public', async (url) => {
    const r = await get(url, null)
    expect(r.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------------------------
// Articles #6–#9
// ---------------------------------------------------------------------------------------------

describe('#6 GET /api/articles (S15)', () => {
  it('lists the 72 published articles, 18 per page, in reader order (BR-M09-03)', async () => {
    const r = await get<ListBody<ArticleCard>>('/api/articles', null)
    expect(r.status).toBe(200)
    expect(r.body.meta).toMatchObject({
      page: 1,
      pageSize: 18,
      totalItems: 72,
      totalPages: 4,
      from: 1,
      to: 18,
    })
    expect(ids(r.body.data).slice(0, 10)).toEqual([9, 1, 2, 3, 4, 5, 6, 7, 8, 72])
    const p4 = await get<ListBody<ArticleCard>>('/api/articles?page=4', null)
    expect(ids(p4.body.data)).toEqual(range(10, 27).reverse())
    expect(p4.body.meta).toMatchObject({ page: 4, from: 55, to: 72 })
  })

  it('carries the category label, the featured flag and the author of each card', async () => {
    const first = (await get<ListBody<ArticleCard>>('/api/articles', null)).body.data[0]
    expect(first).toMatchObject({ id: 9, categoryLabel: expect.any(String) as string })
    expect(first?.author.name).not.toBe('')
    expect(first?.author.initial).toHaveLength(1)
  })

  it('filters by category (the per-category counts of §6.11) and by search', async () => {
    const counts: Record<string, number> = {
      TIPS_BELAJAR: 21,
      MOTIVASI: 14,
      PANDUAN_IBU_BAPA: 10,
      PANDUAN_GURU: 6,
      KEJAYAAN: 7,
      BERITA: 7,
      UMUM: 7,
    }
    for (const [code, total] of Object.entries(counts)) {
      const r = await get<ListBody<ArticleCard>>(`/api/articles?category=${code}`, null)
      expect(r.body.meta.totalItems, code).toBe(total)
    }
    const berita = await get<ListBody<ArticleCard>>('/api/articles?category=BERITA', null)
    expect(ids(berita.body.data)).toEqual(range(59, 65).reverse())
    const search = await get<ListBody<ArticleCard>>('/api/articles?search=SIFIR', null)
    expect(ids(search.body.data).sort((a, b) => a - b)).toEqual([6, 17])
    const all = await get<ListBody<ArticleCard>>('/api/articles?category=all', null)
    expect(all.body.meta.totalItems).toBe(72)
  })

  it('answers an empty page for no match, an unknown category or a page past the end', async () => {
    for (const url of [
      '/api/articles?search=zzzz-tiada',
      '/api/articles?category=BUKAN_KATEGORI',
      '/api/articles?page=9',
    ]) {
      const r = await get<ListBody<ArticleCard>>(url, null)
      expect(r.status, url).toBe(200)
      expect(r.body.data, url).toEqual([])
    }
    const none = await get<ListBody<ArticleCard>>('/api/articles?search=zzzz-tiada', null)
    expect(none.body.meta).toMatchObject({ totalItems: 0, totalPages: 1, from: null, to: null })
  })
})

describe('#7 GET /api/articles/hot', () => {
  it('draws 6 distinct published articles from featured ∪ top-10 popular (BR-M09-05)', async () => {
    const cards = await data<HotCard[]>('/api/articles/hot', null)
    expect(cards).toHaveLength(6)
    expect(new Set(ids(cards)).size).toBe(6)
    for (const c of cards) {
      expect(c.badge).toBe(c.isFeatured ? 'PILIHAN' : 'POPULAR')
    }
  })

  it('never returns a draw of fewer than 6 and varies between calls', async () => {
    const draws = new Set<string>()
    for (let i = 0; i < 6; i++) {
      draws.add(ids(await data<HotCard[]>('/api/articles/hot', null)).join(','))
    }
    expect(draws.size).toBeGreaterThan(1)
  })
})

describe('#9 GET /api/articles/latest', () => {
  it('returns the 5 newest published articles, the same as the first 5 of #6', async () => {
    const latest = await data<ArticleCard[]>('/api/articles/latest', null)
    expect(ids(latest)).toEqual([9, 1, 2, 3, 4])
    const list = await get<ListBody<ArticleCard>>('/api/articles', null)
    expect(ids(list.body.data.slice(0, 5))).toEqual(ids(latest))
    expect(await data<ArticleCard[]>('/api/articles/latest?limit=3', null)).toHaveLength(3)
    expect(await data<ArticleCard[]>('/api/articles/latest?limit=0', null)).toHaveLength(1)
  })
})

describe('#8 GET /api/articles/:slug (S16)', () => {
  it('returns the detail with the related list and counts a view before replying (BR-M09-07)', async () => {
    const [{ slug, views }] = (await get<ListBody<ArticleCard>>('/api/articles', null)).body
      .data as [ArticleCard]
    const first = await data<ArticleDetail>(`/api/articles/${slug}`, null)
    expect(first.views).toBe(views + 1)
    expect(first.content).not.toBe('')
    expect(first.gradeLabel).toEqual(expect.any(String))
    expect(first.related.length).toBeLessThanOrEqual(3)
    expect(first.related.every((c) => c.category === first.category && c.id !== first.id)).toBe(
      true,
    )
    const second = await data<ArticleDetail>(`/api/articles/${slug}`, PELAJAR)
    expect(second.views).toBe(views + 2)
  })

  it('answers 404 for an unknown slug; the static paths are not taken as slugs', async () => {
    const r = await get<ErrorBody>('/api/articles/tiada-artikel-ini', null)
    expect(r.status).toBe(404)
    expect(r.body.error.code).toBe('NOT_FOUND')
    expect((await get('/api/articles/hot', null)).status).toBe(200)
    expect((await get('/api/articles/latest', null)).status).toBe(200)
  })
})

// ---------------------------------------------------------------------------------------------
// Banners #20 and support #43
// ---------------------------------------------------------------------------------------------

describe('#20 GET /api/banners/active', () => {
  it('delivers all 5 banners to the admin (OBSERVED) and to a student, in displayOrder', async () => {
    const admin = await data<ActiveBanner[]>('/api/banners/active', ADMIN)
    expect(admin).toHaveLength(5)
    expect(admin.map((b) => b.type).sort()).toEqual([
      'ANNOUNCEMENT',
      'FEATURE',
      'FEATURE',
      'HERO',
      'PROMOTIONAL',
    ])
    const student = await data<ActiveBanner[]>('/api/banners/active', PELAJAR)
    expect(student).toEqual(admin)
  })

  it('gives a teacher only the ALL-audience banners (2 of 5, BR-M09-14)', async () => {
    const teacher = await data<ActiveBanner[]>('/api/banners/active', GURU)
    expect(teacher).toHaveLength(2)
  })
})

describe('#43 GET /api/config/support', () => {
  it('returns the support e-mail and the WhatsApp number (DV-M09-14)', async () => {
    expect(await data<SupportConfig>('/api/config/support', null)).toEqual({
      email: 'support@prestasiplus.my',
      whatsappNumber: '60123456789',
    })
  })
})

// ---------------------------------------------------------------------------------------------
// Audio KBAT #24–#26 (provisional)
// ---------------------------------------------------------------------------------------------

describe('#24–#26 audio KBAT (provisional, L-3)', () => {
  it('starts empty (0 sets on live)', async () => {
    const r = await get<ListBody<AudioSetListItem>>('/api/audio-kbat-sets', PELAJAR)
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual([])
    expect(r.body.meta.totalItems).toBe(0)
  })

  it('lists approved sets only, filtered by level and subject', async () => {
    const approved = audioKbat.seedFixture(ADMIN, 1)
    const draft = audioKbat.seedFixture(ADMIN, 2)
    const list = await data<AudioSetListItem[]>('/api/audio-kbat-sets', PELAJAR)
    expect(ids(list)).toEqual([approved.id])
    expect(list[0]?.educationLevel.id).toBe(10)
    expect(list[0]?.subject.id).toBe(1)
    expect(
      await data<AudioSetListItem[]>('/api/audio-kbat-sets?educationLevelId=11', PELAJAR),
    ).toEqual([])
    expect(
      ids(await data<AudioSetListItem[]>('/api/audio-kbat-sets?subjectId=1', PELAJAR)),
    ).toEqual([approved.id])
    expect((await get(`/api/audio-kbat-sets/${String(draft.id)}`, PELAJAR)).status).toBe(404)
  })

  it('shows 4 sections with 8 / 8 / 8 / 6 questions and no answers', async () => {
    const set = audioKbat.approved()[0]
    const detail = await data<AudioSetDetail>(`/api/audio-kbat-sets/${String(set?.id)}`, PELAJAR)
    expect(detail.sections.map((s) => s.questions.length)).toEqual([8, 8, 8, 6])
    expect(detail.sections[0]?.audioUrl).toContain('audio1.mp3')
    expect(detail.sections[0]?.questions[0]).toEqual({
      no: 1,
      questionText: 'Soalan contoh 1',
      options: { A: 'Pilihan A 1', B: 'Pilihan B 1', C: 'Pilihan C 1', D: 'Pilihan D 1' },
      marks: 1,
    })
    expect(JSON.stringify(detail)).not.toContain('correctAnswer')
    expect((await get('/api/audio-kbat-sets/9999', PELAJAR)).status).toBe(404)
  })

  it('scores an attempt (BR-M09-16) and stores one row per submit', async () => {
    const set = audioKbat.approved()[0]
    const url = `/api/audio-kbat-sets/${String(set?.id)}/attempts`
    const allA = range(1, 30).map((no) => ({ no, choice: 'A' }))
    const full = await call<{ data: AudioAttemptResult }>('POST', url, PELAJAR, { answers: allA })
    expect(full.status).toBe(201)
    expect(full.body.data).toEqual({ score: 30, totalMarks: 30 })
    const half = await call<{ data: AudioAttemptResult }>('POST', url, PELAJAR, {
      answers: range(1, 30).map((no) => ({ no, choice: no <= 10 ? 'A' : 'B' })),
    })
    expect(half.body.data).toEqual({ score: 10, totalMarks: 30 })
    expect(audioKbat.attempts(set?.id ?? 0)).toHaveLength(2)
  })

  it('refuses a bad attempt with 422 and an unknown or draft set with 404', async () => {
    const set = audioKbat.approved()[0]
    const url = `/api/audio-kbat-sets/${String(set?.id)}/attempts`
    for (const body of [
      {},
      { answers: [] },
      { answers: [{ no: 1, choice: 'E' }] },
      { answers: [{ no: 31, choice: 'A' }] },
      {
        answers: [
          { no: 1, choice: 'A' },
          { no: 1, choice: 'B' },
        ],
      },
    ]) {
      const r = await call<ErrorBody>('POST', url, PELAJAR, body)
      expect(r.status, JSON.stringify(body)).toBe(422)
      expect(r.body.error.fields?.answers).toEqual(expect.any(String))
    }
    const draftId = audioKbat.adminList({ status: 'draft' })[0]?.id
    const bad = await call('POST', `/api/audio-kbat-sets/${String(draftId)}/attempts`, PELAJAR, {
      answers: [{ no: 1, choice: 'A' }],
    })
    expect(bad.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------------------------
// Videos #27–#32
// ---------------------------------------------------------------------------------------------

describe('#27 GET /api/videos (S17)', () => {
  it('lists the 2,260 videos, 24 per page: page 1 is the live order of anchors', async () => {
    const r = await get<ListBody<VideoCard, VideoListMeta>>('/api/videos', null)
    expect(r.status).toBe(200)
    expect(r.body.meta).toMatchObject({
      page: 1,
      pageSize: 24,
      totalItems: 2_260,
      totalPages: 95,
      from: 1,
      to: 24,
    })
    expect(ids(r.body.data)).toEqual([
      2224, 64, 433, 825, 1020, 19, 2225, 65, 434, 827, 1021, 2226, 66, 435, 852, 1022, 2227, 67,
      436, 877, 1023, 2228, 68, 437,
    ])
    expect(r.body.data[0]).toMatchObject({
      platformLabel: 'YouTube',
      uploader: { name: 'Admin Demo', initial: 'A', roleLabel: 'Admin' },
    })
    const last = await get<ListBody<VideoCard, VideoListMeta>>('/api/videos?page=95', null)
    expect(ids(last.body.data)).toEqual([2_220, 2_221, 2_222, 2_223])
  })

  it('carries the pills: total 2,260, the category and the subject counts (BR-M09-18)', async () => {
    const { facets } = (await get<ListBody<VideoCard, VideoListMeta>>('/api/videos', null)).body
      .meta
    expect(facets.total).toBe(2_260)
    expect(facets.categories).toEqual([
      { code: 'motivasi', label: 'Motivasi', count: 3 },
      { code: 'tutorial', label: 'Tutorial', count: 12 },
      { code: 'tips-spm', label: 'Petua SPM', count: 3 },
      { code: 'ceramah', label: 'Ceramah', count: 2_242 },
      { code: 'lain-lain', label: 'Lain-lain', count: 0 },
    ])
    expect(facets.subjects.map((s) => [s.id, s.count])).toEqual([
      [3, 865],
      [5, 97],
      [8, 420],
      [9, 779],
      [10, 96],
    ])
    expect(facets.subjects.every((s) => s.name !== '')).toBe(true)
    expect(facets.subjects.find((s) => s.id === 5)?.name).toBe('Sejarah')
  })

  it('filters by subject (?subject=5: 97 videos) and keeps the subject pills whole', async () => {
    const r = await get<ListBody<VideoCard, VideoListMeta>>('/api/videos?subject=5', null)
    expect(r.body.meta.totalItems).toBe(97)
    expect(ids(r.body.data)).toEqual(range(2_224, 2_247))
    expect(r.body.meta.facets.total).toBe(97)
    expect(r.body.meta.facets.categories.map((c) => c.count)).toEqual([1, 12, 3, 81, 0])
    expect(r.body.meta.facets.subjects.map((s) => s.count)).toEqual([865, 97, 420, 779, 96])
    const p2 = await get<ListBody<VideoCard, VideoListMeta>>('/api/videos?subject=5&page=2', null)
    expect(ids(p2.body.data)).toEqual([...range(2_248, 2_260), ...range(21, 31)])
  })

  it('filters by category (?category=motivasi: 18, 17, 16) and narrows the subject pills', async () => {
    const r = await get<ListBody<VideoCard, VideoListMeta>>('/api/videos?category=motivasi', null)
    expect(ids(r.body.data)).toEqual([18, 17, 16])
    expect(r.body.meta.facets.total).toBe(2_260)
    expect(r.body.meta.facets.subjects.reduce((n, s) => n + s.count, 0)).toBeLessThanOrEqual(3)
    const empty = await get<ListBody<VideoCard, VideoListMeta>>(
      '/api/videos?category=lain-lain',
      null,
    )
    expect(empty.body.data).toEqual([])
    expect(empty.body.meta.totalItems).toBe(0)
  })

  it('searches by title', async () => {
    const r = await get<ListBody<VideoCard, VideoListMeta>>(
      '/api/videos?search=Tamadun%20Awal%20Dunia',
      null,
    )
    expect(ids(r.body.data)).toContain(2_260)
    expect(r.body.meta.facets.total).toBe(r.body.meta.totalItems)
  })
})

describe('#28 GET /api/videos/:id (S18)', () => {
  it('returns the anchor 2224 with its views before this open, then counts the open (BR-M09-07)', async () => {
    const first = await data<VideoDetail>('/api/videos/2224', PELAJAR)
    expect(first).toMatchObject({
      id: 2224,
      views: 134,
      category: 'ceramah',
      categoryLabel: 'Ceramah',
      subject: { id: 5, name: 'Sejarah' },
      visibility: 'global',
      platform: 'Youtube',
      canManage: false,
      createdAt: '2026-03-03T12:00:00+08:00',
    })
    expect(first.description).toContain('Kredit penuh kepada Cikgu Demo')
    expect(first.embedUrl).toMatch(/^https:\/\/www\.youtube\.com\/embed\//)
    expect(first.related).toHaveLength(6)
    expect(ids(first.related)).toEqual([...ids(first.related)].sort((a, b) => b - a))
    const second = await data<VideoDetail>('/api/videos/2224', null)
    expect(second.views).toBe(135)
  })

  it('serves the S19 form load (?for=edit) without counting a view', async () => {
    const before = await data<VideoDetail>('/api/videos/2227?for=edit', PELAJAR)
    const again = await data<VideoDetail>('/api/videos/2227?for=edit', PELAJAR)
    expect(again.views).toBe(before.views)
    const read = await data<VideoDetail>('/api/videos/2227', PELAJAR)
    expect(read.views).toBe(before.views)
    const next = await data<VideoDetail>('/api/videos/2227', PELAJAR)
    expect(next.views).toBe(before.views + 1)
  })

  it('lists related videos of the same subject, id descending (BR-M09-20); none without a subject', async () => {
    const v = await data<VideoDetail>('/api/videos/2224', ADMIN)
    expect(v.canManage).toBe(true)
    const sorted = [...ids(v.related)].sort((a, b) => b - a)
    expect(ids(v.related)).toEqual(sorted)
    expect(ids(v.related)).not.toContain(2224)
    const noSubject = await data<VideoDetail>('/api/videos/19', PELAJAR)
    expect(noSubject.subject).toBeNull()
    expect(noSubject.related).toEqual([])
    expect(noSubject.views).toBe(345)
  })

  it('answers 404 for an unknown id and does not match /form-context', async () => {
    expect((await get('/api/videos/99999', null)).status).toBe(404)
    expect((await get('/api/videos/form-context', null)).status).toBe(401)
  })
})

describe('#32 GET /api/videos/form-context', () => {
  it('shows no video-form school for the admin and the guru school for the guru (BR-M09-21)', async () => {
    const admin = await data<VideoFormContext>('/api/videos/form-context', ADMIN)
    expect(admin.uploader).toMatchObject({ name: 'Admin Demo', initial: 'A', roleLabel: 'Admin' })
    expect(admin.school).toBeNull()
    const guru = await data<VideoFormContext>('/api/videos/form-context', GURU)
    expect(guru.uploader.roleLabel).toBe('Guru')
    expect(guru.school).toMatchObject({ id: 900001 })
    expect(guru.school?.name).toEqual(expect.any(String))
    expect((await data<VideoFormContext>('/api/videos/form-context', PELAJAR)).school).toBeNull()
  })
})

describe('#29–#31 video writes (S19, S20)', () => {
  const body = {
    videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    title: 'Video ujian pelajar',
    description: 'Penerangan ringkas',
    category: 'tutorial',
    subjectId: 3,
    visibility: 'global',
  }
  let ownId = 0

  it('creates a video for any logged-in user (201, flash, platform derived)', async () => {
    const r = await call<{ data: VideoDetail; status: string }>(
      'POST',
      '/api/videos',
      PELAJAR,
      body,
    )
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('Video berjaya diterbitkan.')
    ownId = r.body.data.id
    expect(ownId).toBeGreaterThan(2_260)
    expect(r.body.data).toMatchObject({
      title: 'Video ujian pelajar',
      platformLabel: 'YouTube',
      platform: 'Youtube',
      thumbnailUrl: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg',
      embedUrl: 'https://www.youtube.com/embed/abcdefghijk',
      views: 0,
      canManage: true,
      subject: { id: 3, name: 'Matematik' },
      uploader: { roleLabel: 'Pelajar' },
    })
    const list = await get<ListBody<VideoCard, VideoListMeta>>('/api/videos', null)
    expect(list.body.meta.totalItems).toBe(2_261)
    expect(list.body.meta.facets.categories.find((c) => c.code === 'tutorial')?.count).toBe(13)
    expect(ids(list.body.data)[0]).toBe(ownId)
  })

  it('refuses invalid input with 422 fields', async () => {
    const empty = await call<ErrorBody>('POST', '/api/videos', PELAJAR, {})
    expect(empty.status).toBe(422)
    expect(Object.keys(empty.body.error.fields ?? {}).sort()).toEqual([
      'category',
      'title',
      'videoUrl',
      'visibility',
    ])
    const bad = await call<ErrorBody>('POST', '/api/videos', PELAJAR, {
      ...body,
      videoUrl: 'bukan url',
      category: 'lain',
      description: 'x'.repeat(1_001),
      subjectId: 9_999,
    })
    expect(Object.keys(bad.body.error.fields ?? {}).sort()).toEqual([
      'category',
      'description',
      'subjectId',
      'videoUrl',
    ])
  })

  it('refuses "Sekolah Saya" without a video-form school and accepts it for the guru', async () => {
    const refused = await call<ErrorBody>('POST', '/api/videos', ADMIN, {
      ...body,
      visibility: 'school',
    })
    expect(refused.status).toBe(422)
    expect(refused.body.error.fields?.visibility).toEqual(expect.any(String))
    const ok = await call<{ data: VideoDetail }>('POST', '/api/videos', GURU, {
      ...body,
      title: 'Video sekolah guru',
      visibility: 'school',
    })
    expect(ok.status).toBe(201)
    const schoolId = ok.body.data.id
    // Visible to the uploader, the admin and the same school; hidden from guests and others (BR-M09-19).
    expect((await get(`/api/videos/${String(schoolId)}`, GURU)).status).toBe(200)
    expect((await get(`/api/videos/${String(schoolId)}`, ADMIN)).status).toBe(200)
    // The school rule compares the viewer's video-form school, not the profile school: the school
    // admin's profile school is 900001 too, yet without a video-form school the video is hidden.
    expect((await get(`/api/videos/${String(schoolId)}`, ADMIN_SEKOLAH)).status).toBe(404)
    videos.setVideoSchool(ADMIN_SEKOLAH, 900001)
    expect((await get(`/api/videos/${String(schoolId)}`, ADMIN_SEKOLAH)).status).toBe(200)
    expect((await get(`/api/videos/${String(schoolId)}`, MAJU)).status).toBe(404)
    expect((await get(`/api/videos/${String(schoolId)}`, null)).status).toBe(404)
    const guest = await get<ListBody<VideoCard, VideoListMeta>>('/api/videos', null)
    expect(guest.body.meta.totalItems).toBe(2_261)
    const own = await get<ListBody<VideoCard, VideoListMeta>>('/api/videos', GURU)
    expect(own.body.meta.totalItems).toBe(2_262)
    expect(await call('DELETE', `/api/videos/${String(schoolId)}`, GURU)).toMatchObject({
      status: 200,
    })
  })

  it('lets only the uploader or the admin edit (PUT) and refuses others with 403', async () => {
    const edit = { ...body, title: 'Tajuk baharu' }
    const other = await call<ErrorBody>('PUT', `/api/videos/${String(ownId)}`, MAJU, edit)
    expect(other.status).toBe(403)
    expect(other.body.error.code).toBe('FORBIDDEN')
    const own = await call<{ data: VideoDetail; status: string }>(
      'PUT',
      `/api/videos/${String(ownId)}`,
      PELAJAR,
      edit,
    )
    expect(own.status).toBe(200)
    expect(own.body.status).toBe('Video berjaya dikemaskini.')
    expect(own.body.data.title).toBe('Tajuk baharu')
    const admin = await call<{ data: VideoDetail }>('PUT', `/api/videos/${String(ownId)}`, ADMIN, {
      ...edit,
      videoUrl: 'https://vimeo.com/123456',
      category: 'motivasi',
    })
    expect(admin.status).toBe(200)
    expect(admin.body.data).toMatchObject({
      platform: 'Vimeo',
      category: 'motivasi',
      thumbnailUrl: null,
    })
    expect((await call('PUT', '/api/videos/99999', PELAJAR, edit)).status).toBe(404)
    const invalid = await call<ErrorBody>('PUT', `/api/videos/${String(ownId)}`, PELAJAR, {
      ...edit,
      title: '',
    })
    expect(invalid.status).toBe(422)
    expect(invalid.body.error.fields?.title).toBe('Medan ini diperlukan.')
  })

  it('lets only the uploader or the admin delete (DELETE)', async () => {
    expect((await call('DELETE', `/api/videos/${String(ownId)}`, MAJU)).status).toBe(403)
    expect((await call('DELETE', '/api/videos/99999', PELAJAR)).status).toBe(404)
    const r = await call<{ data: { deleted: number }; status: string }>(
      'DELETE',
      `/api/videos/${String(ownId)}`,
      PELAJAR,
    )
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ data: { deleted: 1 }, status: 'Video berjaya dipadam.' })
    expect((await get(`/api/videos/${String(ownId)}`, null)).status).toBe(404)
    const list = await get<ListBody<VideoCard, VideoListMeta>>('/api/videos', null)
    expect(list.body.meta.totalItems).toBe(2_260)
    expect(list.body.meta.facets.total).toBe(2_260)
  })

  it('lets the admin delete another user video', async () => {
    const made = await call<{ data: VideoDetail }>('POST', '/api/videos', MAJU, body)
    const gone = await call('DELETE', `/api/videos/${String(made.body.data.id)}`, ADMIN)
    expect(gone.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------------------------
// Perutusan #33–#40
// ---------------------------------------------------------------------------------------------

describe('#33 GET /api/perutusan (S22)', () => {
  it('shows the admin all 3 posts: pinned first, then newest (BR-M09-24)', async () => {
    const r = await get<ListBody<PerutusanCard>>('/api/perutusan', ADMIN)
    expect(ids(r.body.data)).toEqual([4, 2, 3])
    expect(r.body.data.map((p) => p.reads)).toEqual([3, 4, 55])
    expect(r.body.meta.totalItems).toBe(3)
    expect(r.body.data.map((p) => p.isPinned)).toEqual([true, true, false])
    expect(r.body.data.map((p) => p.hasVideo)).toEqual([true, false, true])
    expect(r.body.data.map((p) => p.commentCount)).toEqual([0, 0, 0])
  })

  it('shows the reaction of each post: like 1 on #4, love 5 on #3 (BR-M09-25)', async () => {
    const list = (await get<ListBody<PerutusanCard>>('/api/perutusan', ADMIN)).body.data
    expect(list.find((p) => p.id === 4)?.topReaction).toEqual({
      type: 'like',
      emoji: '👍',
      count: 1,
    })
    expect(list.find((p) => p.id === 3)?.topReaction).toEqual({
      type: 'love',
      emoji: '❤️',
      count: 5,
    })
    expect(list.find((p) => p.id === 2)?.topReaction).toBeNull()
  })

  it('scopes the posts to the viewer (BR-M09-23)', async () => {
    expect(ids((await get<ListBody<PerutusanCard>>('/api/perutusan', PELAJAR)).body.data)).toEqual([
      2,
    ])
    expect((await get<ListBody<PerutusanCard>>('/api/perutusan', MAJU)).body.data).toEqual([])
    expect(
      ids((await get<ListBody<PerutusanCard>>('/api/perutusan', ADMIN_SEKOLAH)).body.data),
    ).toEqual([2])
  })
})

describe('#35 GET /api/perutusan/:id (S23)', () => {
  it('counts one read for a student, none for a repeat, the admin or the author (BR-M09-07)', async () => {
    const first = await data<PerutusanDetail>('/api/perutusan/2', PELAJAR)
    expect(first.reads).toBe(5)
    expect((await data<PerutusanDetail>('/api/perutusan/2', PELAJAR)).reads).toBe(5)
    expect((await data<PerutusanDetail>('/api/perutusan/2', ADMIN)).reads).toBe(5)
    const admin = await data<PerutusanDetail>('/api/perutusan/4', ADMIN)
    expect(admin.reads).toBe(3)
  })

  it('returns the body, the public link, the embed URL and the reaction state', async () => {
    const p4 = await data<PerutusanDetail>('/api/perutusan/4', ADMIN)
    expect(p4).toMatchObject({
      id: 4,
      isPublic: true,
      publicUrl: '/perutusan/awam/4',
      youtubeEmbedUrl: 'https://www.youtube.com/embed/SEEDPRT0004',
      reactions: { like: 1, love: 0, thanks: 0 },
      myReactions: [],
      canWrite: true,
    })
    expect(p4.body).toContain('<p>')
    const p2 = await data<PerutusanDetail>('/api/perutusan/2', PELAJAR)
    expect(p2).toMatchObject({ publicUrl: null, youtubeEmbedUrl: null, canWrite: false })
    expect(p2.author.roleLabel).toBe('Pengetua')
  })

  it('answers 404 for an unknown post or one outside the viewer scope (never 403)', async () => {
    expect((await get('/api/perutusan/3', PELAJAR)).status).toBe(404)
    expect((await get('/api/perutusan/4', MAJU)).status).toBe(404)
    expect((await get('/api/perutusan/999', ADMIN)).status).toBe(404)
  })
})

describe('#36 GET /api/perutusan/compose-context (S24)', () => {
  it('gives the admin national scope and the school admin the school scope', async () => {
    expect(await data<ComposeContext>('/api/perutusan/compose-context', ADMIN)).toEqual({
      scope: 'national',
      scopeLabel: 'Seluruh Malaysia (Kebangsaan)',
      canWrite: true,
    })
    const school = await data<ComposeContext>('/api/perutusan/compose-context', ADMIN_SEKOLAH)
    expect(school).toMatchObject({ scope: 'school', canWrite: true })
    expect(school.scopeLabel).not.toBe('')
  })

  it('reports canWrite false for the other roles', async () => {
    for (const as of [PELAJAR, GURU]) {
      expect(await data<ComposeContext>('/api/perutusan/compose-context', as)).toEqual({
        scope: null,
        scopeLabel: '',
        canWrite: false,
      })
    }
  })
})

describe('#37 POST /api/perutusan (S24) and #34 GET /api/perutusan/mine (S25)', () => {
  const form = (fields: Record<string, string | Blob | Blob[]>): FormData => {
    const f = new FormData()
    for (const [key, value] of Object.entries(fields)) {
      if (Array.isArray(value)) for (const v of value) f.append(key, v)
      else f.append(key, value)
    }
    return f
  }
  const file = (name: string, type: string, size: number): File =>
    new File([new Uint8Array(size)], name, { type })

  it('refuses a non-writer with 403 (BR-M09-22, INFERRED)', async () => {
    for (const as of [PELAJAR, GURU, MAJU]) {
      const r = await call<ErrorBody>(
        'POST',
        '/api/perutusan',
        as,
        form({ title: 'Tajuk', status: 'published' }),
      )
      expect(r.status).toBe(403)
    }
  })

  it('publishes a national post (201, flash) that appears first among the unpinned', async () => {
    const r = await call<{ data: PerutusanDetail; status: string }>(
      'POST',
      '/api/perutusan',
      ADMIN,
      form({
        title: 'Perutusan kebangsaan ujian',
        body: '<p>Kandungan</p>',
        status: 'published',
        isPublic: '1',
        youtubeUrl: 'https://youtu.be/abcdefghijk',
        images: [file('gambar.png', 'image/png', 1_000)],
        documents: [file('nota.pdf', 'application/pdf', 2_000)],
      }),
    )
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('Perutusan berjaya dihantar.')
    expect(r.body.data).toMatchObject({
      title: 'Perutusan kebangsaan ujian',
      scopeLabel: 'Seluruh Malaysia (Kebangsaan)',
      isPublic: true,
      isPinned: false,
      reads: 0,
      images: [{ fileName: 'gambar.png', size: 1_000 }],
      documents: [{ fileName: 'nota.pdf', size: 2_000 }],
      youtubeEmbedUrl: 'https://www.youtube.com/embed/abcdefghijk',
      publicUrl: `/perutusan/awam/${String(r.body.data.id)}`,
    })
    const list = await get<ListBody<PerutusanCard>>('/api/perutusan', ADMIN)
    expect(ids(list.body.data)).toEqual([4, 2, r.body.data.id, 3])
    // National scope: every logged-in user sees it (BR-M09-23).
    expect(ids((await get<ListBody<PerutusanCard>>('/api/perutusan', MAJU)).body.data)).toEqual([
      r.body.data.id,
    ])
  })

  it('stores a draft for the author only and lists it on S25 with its status label', async () => {
    const r = await call<{ data: PerutusanDetail; status: string }>(
      'POST',
      '/api/perutusan',
      ADMIN,
      form({ title: 'Draf ujian', status: 'draft' }),
    )
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('Draf perutusan disimpan.')
    const draftId = r.body.data.id
    expect(
      ids((await get<ListBody<PerutusanCard>>('/api/perutusan', PELAJAR)).body.data),
    ).not.toContain(draftId)
    expect((await get(`/api/perutusan/${String(draftId)}`, PELAJAR)).status).toBe(404)
    const mine = await get<ListBody<OwnPerutusanItem>>('/api/perutusan/mine', ADMIN)
    expect(mine.body.data.map((p) => p.statusLabel)).toEqual(
      expect.arrayContaining(['Draf', 'Diterbitkan']),
    )
    expect(mine.body.data.find((p) => p.id === draftId)).toMatchObject({
      title: 'Draf ujian',
      status: 'draft',
      statusLabel: 'Draf',
    })
    expect(
      (await get<ListBody<OwnPerutusanItem>>('/api/perutusan/mine', PELAJAR)).body.data,
    ).toEqual([])
  })

  it('schedules a post for a future time and refuses a past or invalid time', async () => {
    const future = await call<{ data: PerutusanDetail; status: string }>(
      'POST',
      '/api/perutusan',
      ADMIN,
      form({ title: 'Dijadualkan', status: 'scheduled', scheduledAt: '2026-10-05T09:00:00+08:00' }),
    )
    expect(future.status).toBe(201)
    expect(future.body.status).toBe('Perutusan dijadualkan.')
    expect((await get(`/api/perutusan/${String(future.body.data.id)}`, PELAJAR)).status).toBe(404)
    const past = await call<ErrorBody>(
      'POST',
      '/api/perutusan',
      ADMIN,
      form({ title: 'Lepas', status: 'scheduled', scheduledAt: '2026-01-05T09:00:00+08:00' }),
    )
    expect(past.status).toBe(422)
    expect(past.body.error.fields?.scheduledAt).toEqual(expect.any(String))
  })

  it('validates the title, the status, the video link and the files (422 fields)', async () => {
    const empty = await call<ErrorBody>('POST', '/api/perutusan', ADMIN, form({}))
    expect(Object.keys(empty.body.error.fields ?? {}).sort()).toEqual(['status', 'title'])
    const bad = await call<ErrorBody>(
      'POST',
      '/api/perutusan',
      ADMIN,
      form({
        title: 'x',
        status: 'published',
        youtubeUrl: 'https://vimeo.com/1',
        images: [file('besar.png', 'image/png', 2 * 1024 * 1024 + 1)],
        documents: [file('salah.docx', 'application/msword', 100)],
      }),
    )
    expect(bad.status).toBe(422)
    expect(Object.keys(bad.body.error.fields ?? {}).sort()).toEqual([
      'documents',
      'images',
      'youtubeUrl',
    ])
    expect(bad.body.error.fields?.images).toBe('besar.png: format atau saiz tidak dibenarkan.')
  })

  it('limits the pinned published posts to 2 per scope (BR-M09-28)', async () => {
    const pinned = (title: string) =>
      call<ErrorBody & { data: PerutusanDetail }>(
        'POST',
        '/api/perutusan',
        ADMIN,
        form({ title, status: 'published', isPinned: '1' }),
      )
    expect((await pinned('Sematan 1')).status).toBe(201)
    expect((await pinned('Sematan 2')).status).toBe(201)
    const third = await pinned('Sematan 3')
    expect(third.status).toBe(422)
    expect(third.body.error.fields?.isPinned).toBe('Maksimum 2 perutusan boleh disematkan.')
    // A draft is not a published pin, so it is not refused.
    const draft = await call(
      'POST',
      '/api/perutusan',
      ADMIN,
      form({ title: 'Draf sematan', status: 'draft', isPinned: '1' }),
    )
    expect(draft.status).toBe(201)
  })

  it('lets the school admin write a school post visible to the same school only', async () => {
    const r = await call<{ data: PerutusanDetail }>(
      'POST',
      '/api/perutusan',
      ADMIN_SEKOLAH,
      form({ title: 'Perutusan sekolah ujian', status: 'published' }),
    )
    expect(r.status).toBe(201)
    const id = r.body.data.id
    expect((await get(`/api/perutusan/${String(id)}`, PELAJAR)).status).toBe(200)
    expect((await get(`/api/perutusan/${String(id)}`, MAJU)).status).toBe(404)
    expect(r.body.data.author.roleLabel).toBe('Pengetua')
  })
})

describe('#38 POST /api/perutusan/:id/reactions', () => {
  it('toggles a reaction and returns the counts and the user types (BR-M09-25)', async () => {
    const on = await call<{ data: ReactionResult }>('POST', '/api/perutusan/2/reactions', PELAJAR, {
      type: 'like',
    })
    expect(on.status).toBe(200)
    expect(on.body.data).toEqual({
      reactions: { like: 1, love: 0, thanks: 0 },
      myReactions: ['like'],
    })
    const both = await call<{ data: ReactionResult }>(
      'POST',
      '/api/perutusan/2/reactions',
      PELAJAR,
      {
        type: 'thanks',
      },
    )
    expect(both.body.data.myReactions.sort()).toEqual(['like', 'thanks'])
    const off = await call<{ data: ReactionResult }>(
      'POST',
      '/api/perutusan/2/reactions',
      PELAJAR,
      {
        type: 'like',
      },
    )
    expect(off.body.data).toEqual({
      reactions: { like: 0, love: 0, thanks: 1 },
      myReactions: ['thanks'],
    })
    const admin = await call<{ data: ReactionResult }>(
      'POST',
      '/api/perutusan/3/reactions',
      ADMIN,
      {
        type: 'love',
      },
    )
    expect(admin.body.data.reactions).toEqual({ like: 0, love: 6, thanks: 0 })
  })

  it('answers 422 for an unknown type and 404 for an unknown or hidden post', async () => {
    const bad = await call<ErrorBody>('POST', '/api/perutusan/2/reactions', PELAJAR, {
      type: 'wow',
    })
    expect(bad.status).toBe(422)
    expect(bad.body.error.fields?.type).toEqual(expect.any(String))
    expect(
      (await call('POST', '/api/perutusan/3/reactions', PELAJAR, { type: 'like' })).status,
    ).toBe(404)
    expect(
      (await call('POST', '/api/perutusan/999/reactions', PELAJAR, { type: 'like' })).status,
    ).toBe(404)
  })
})

describe('#39 POST /api/perutusan/:id/comments', () => {
  it('stores a pending comment that is neither shown nor counted (BR-M09-26)', async () => {
    const r = await call<{ data: { id: number; status: string }; status: string }>(
      'POST',
      '/api/perutusan/2/comments',
      PELAJAR,
      { body: 'Terima kasih cikgu.' },
    )
    expect(r.status).toBe(201)
    expect(r.body.data.status).toBe('pending')
    expect(r.body.status).toBe('Komen anda telah dihantar dan akan disemak.')
    expect((await data<PerutusanDetail>('/api/perutusan/2', PELAJAR)).commentCount).toBe(0)
  })

  it('refuses an empty or over-long comment with 422 and a hidden post with 404', async () => {
    for (const body of [{}, { body: '   ' }, { body: 'x'.repeat(1_001) }]) {
      const r = await call<ErrorBody>('POST', '/api/perutusan/2/comments', PELAJAR, body)
      expect(r.status, JSON.stringify(body)).toBe(422)
      expect(r.body.error.fields?.body).toEqual(expect.any(String))
    }
    expect(
      (await call('POST', '/api/perutusan/2/comments', PELAJAR, { body: 'x'.repeat(1_000) }))
        .status,
    ).toBe(201)
    expect((await call('POST', '/api/perutusan/3/comments', PELAJAR, { body: 'Hai' })).status).toBe(
      404,
    )
  })
})

describe('#40 GET /api/public/perutusan/:id (S28)', () => {
  it('opens the public post #4 without a session and counts no read', async () => {
    const before = await data<PublicPerutusan>('/api/public/perutusan/4', null)
    expect(before).toMatchObject({
      id: 4,
      reactionTotal: 1,
      reads: 3,
      commentCount: 0,
      youtubeEmbedUrl: 'https://www.youtube.com/embed/SEEDPRT0004',
    })
    expect(before.author.roleLabel).toBe('Pengetua')
    expect(before.body).toContain('<p>')
    expect((await data<PublicPerutusan>('/api/public/perutusan/4', null)).reads).toBe(3)
  })

  it('answers 404 for a post that is not public, a draft or unknown', async () => {
    for (const id of [2, 3, 999]) {
      expect((await get(`/api/public/perutusan/${String(id)}`, null)).status, String(id)).toBe(404)
    }
  })
})

// ---------------------------------------------------------------------------------------------
// G4 review follow-ups (run last: they change the clock and the video and perutusan counts)
// ---------------------------------------------------------------------------------------------

describe('hot articles pool (BR-M09-05)', () => {
  it('only ever draws from the featured articles plus the 10 most viewed non-featured ones', async () => {
    const all: ArticleCard[] = []
    for (const page of [1, 2, 3, 4]) {
      const r = await get<ListBody<ArticleCard>>(`/api/articles?page=${String(page)}`, null)
      all.push(...r.body.data)
    }
    const featured = all.filter((a) => a.isFeatured)
    expect(featured).toHaveLength(13)
    const topViewed = all
      .filter((a) => !a.isFeatured)
      .sort((a, b) => b.views - a.views || a.id - b.id)
      .slice(0, 10)
    const pool = new Set([...ids(featured), ...ids(topViewed)])
    expect(pool.size).toBe(23)
    const seen = new Set<number>()
    for (let i = 0; i < 25; i++) {
      for (const c of await data<HotCard[]>('/api/articles/hot', null)) {
        expect(pool.has(c.id), String(c.id)).toBe(true)
        seen.add(c.id)
      }
    }
    expect(seen.size).toBeGreaterThan(6)
  })
})

describe('videos: admin on the virtual dataset, malformed input and non-owners', () => {
  const body = {
    videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    title: 'Tajuk disunting admin',
    category: 'tutorial',
    subjectId: 9,
    visibility: 'global',
  }

  it('lets the admin edit and delete a seeded virtual video', async () => {
    const put = await call<{ data: VideoDetail }>('PUT', '/api/videos/1500', ADMIN, body)
    expect(put.status).toBe(200)
    expect(put.body.data).toMatchObject({
      id: 1500,
      title: 'Tajuk disunting admin',
      category: 'tutorial',
    })
    expect((await data<VideoDetail>('/api/videos/1500', PELAJAR)).title).toBe(
      'Tajuk disunting admin',
    )
    expect((await call('DELETE', '/api/videos/1500', ADMIN)).status).toBe(200)
    expect((await get('/api/videos/1500', null)).status).toBe(404)
    const list = await get<ListBody<VideoCard, VideoListMeta>>('/api/videos', null)
    expect(list.body.meta.totalItems).toBe(2_259)
  })

  it('answers 403 to a non-owner before validating the body', async () => {
    expect((await call('PUT', '/api/videos/2224', MAJU, {})).status).toBe(403)
    expect((await call('DELETE', '/api/videos/2224', MAJU)).status).toBe(403)
  })

  it('answers 422, not 500, to a malformed body', async () => {
    const r = await call<ErrorBody>('POST', '/api/videos', PELAJAR, {
      videoUrl: 7,
      title: 5,
      description: { a: 1 },
      category: 'tutorial',
      visibility: 'global',
    })
    expect(r.status).toBe(422)
    expect(Object.keys(r.body.error.fields ?? {}).sort()).toEqual([
      'description',
      'title',
      'videoUrl',
    ])
  })
})

describe('perutusan: scheduling in MYT, the pin limit and comment length', () => {
  const form = (fields: Record<string, string>): FormData => {
    const f = new FormData()
    for (const [k, v] of Object.entries(fields)) f.append(k, v)
    return f
  }

  it('reads an offset-less scheduledAt as Malaysia time and shows the post once it is due', async () => {
    const r = await call<{ data: PerutusanDetail }>(
      'POST',
      '/api/perutusan',
      ADMIN,
      form({ title: 'Jadual MYT', status: 'scheduled', scheduledAt: '2026-10-05T09:00' }),
    )
    expect(r.status).toBe(201)
    const id = r.body.data.id
    expect(perutusan.get(id)?.scheduledAt).toBe('2026-10-05T09:00:00+08:00')
    expect((await get(`/api/perutusan/${String(id)}`, PELAJAR)).status).toBe(404)
    clock.setNow('2026-10-05T08:59:00+08:00')
    expect((await get(`/api/perutusan/${String(id)}`, PELAJAR)).status).toBe(404)
    clock.setNow('2026-10-05T09:01:00+08:00')
    expect((await get(`/api/perutusan/${String(id)}`, PELAJAR)).status).toBe(200)
    clock.setNow(CLOCK_ANCHOR_ISO)
  })

  it('refuses an impossible scheduledAt with 422', async () => {
    const r = await call<ErrorBody>(
      'POST',
      '/api/perutusan',
      ADMIN,
      form({ title: 'Salah', status: 'scheduled', scheduledAt: '2026-02-30T09:00' }),
    )
    expect(r.status).toBe(422)
    expect(r.body.error.fields?.scheduledAt).toEqual(expect.any(String))
  })

  it('counts scheduled pinned posts towards the limit of 2 per scope', async () => {
    // Earlier tests left the national scope with 2 published pinned posts.
    const r = await call<ErrorBody>(
      'POST',
      '/api/perutusan',
      ADMIN,
      form({
        title: 'Sematan dijadual',
        status: 'scheduled',
        isPinned: '1',
        scheduledAt: '2026-11-01T09:00',
      }),
    )
    expect(r.status).toBe(422)
    expect(r.body.error.fields?.isPinned).toBe('Maksimum 2 perutusan boleh disematkan.')
  })

  it('counts the pins per school: the school admin school already has 1 (post #2)', async () => {
    const pin = (title: string) =>
      call<ErrorBody>(
        'POST',
        '/api/perutusan',
        ADMIN_SEKOLAH,
        form({ title, status: 'published', isPinned: '1' }),
      )
    expect((await pin('Sematan sekolah 1')).status).toBe(201)
    const second = await pin('Sematan sekolah 2')
    expect(second.status).toBe(422)
    expect(second.body.error.fields?.isPinned).toBe('Maksimum 2 perutusan boleh disematkan.')
  })

  it('measures a comment in characters (code points): 1,000 emoji pass, 1,001 fail', async () => {
    const send = (text: string) =>
      call('POST', '/api/perutusan/2/comments', PELAJAR, { body: text })
    expect((await send('😀'.repeat(1_000))).status).toBe(201)
    expect((await send('😀'.repeat(1_001))).status).toBe(422)
  })
})
