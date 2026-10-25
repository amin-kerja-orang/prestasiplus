/**
 * F-29: the M09 content store (SRS M09 v1.2 §6.9, §6.11; M05 §6.12). Booted through `bootMock`
 * with the real M01/M02 owners, so the plugin, repositories, seed, build check and conventions
 * are checked as the app runs them.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { diffForHumans, type Clock } from '@/lib/time'
import { checkNamedQueries } from '@/mock/dataset'
import { mulberry32 } from '@/mock/determinism'
import type { MockRuntime } from '@/mock/index'
import { RepositoryError } from '@/mock/repository'

import plugin, { articles, audioKbat, banners, notes, perutusan, support, videos } from '../../mock'
import { excerptOf } from '../../mock/repository'
import { SEED_ARTICLES } from '../../mock/data/articles'
import { SEED_NOTES } from '../../mock/data/content'
import { slugify } from '../../mock/data/labels'
import { VIDEO_ORDER, cellOf } from '../../mock/data/video-cells'
import { LIVE_VIDEOS } from '../../mock/data/video-live-data'
import { parseVideoUrl } from '../../mock/data/video-url'
import { videosDataset } from '../../mock/datasets/videos'
import { articleQueries, videoQueries } from '../../mock/repository'
import type { Viewer } from '../../mock/types'
import { bootM09, NOW } from './helpers'

let runtime: MockRuntime
let clock: Clock

const ADMIN: Viewer = { id: 1, role: 'admin', schoolId: 900002 }
const STUDENT: Viewer = { id: 2, role: 'student', schoolId: 900001 }
const PELAJAR_MAJU: Viewer = { id: 4, role: 'student', schoolId: 900004 }
const GURU: Viewer = { id: 5, role: 'teacher', schoolId: 900001 }

beforeAll(async () => {
  ;({ runtime, clock } = await bootM09())
}, 120_000)

afterAll(async () => {
  await runtime.reset()
})

const ids = (rows: readonly { id: number }[]): number[] => rows.map((r) => r.id)
const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

describe('videos dataset (M09 §6.11)', () => {
  it('has the live total and the documented category and subject counts', () => {
    expect(videos.count('Q-VID-ALL')).toBe(2_260)
    expect(videosDataset.count()).toBe(2_260)
    const cats = videos.groupCount('Q-VID-ALL', 'category')
    expect(Object.fromEntries(cats)).toEqual({
      motivasi: 3,
      tutorial: 12,
      'tips-spm': 3,
      ceramah: 2_242,
    })
    expect(videos.count('Q-VID-CAT', 'lain-lain')).toBe(0)
    const subjects = videos.groupCount('Q-VID-ALL', 'subjectId')
    expect(subjects.get(3)).toBe(865)
    expect(subjects.get(5)).toBe(97)
    expect(subjects.get(8)).toBe(420)
    expect(subjects.get(9)).toBe(779)
    expect(subjects.get(10)).toBe(96)
    expect(subjects.get(null)).toBe(3)
    expect(subjects.size).toBe(6)
  })

  it('has the joint Sejarah × category counts 1 / 12 / 3 / 81 / 0 and all rows global Youtube by Admin Demo', () => {
    const joint = (['motivasi', 'tutorial', 'tips-spm', 'ceramah', 'lain-lain'] as const).map((c) =>
      videos.count('Q-VID-SUBJ-CAT', 5, c),
    )
    expect(joint).toEqual([1, 12, 3, 81, 0])
    expect(videos.count('Q-VID-GLOBAL')).toBe(2_260)
    expect(videosDataset.count({ platform: 'Youtube', uploaderId: 1 })).toBe(2_260)
  })

  it('passes every documented named query and the dataset feasibility check', () => {
    expect(checkNamedQueries(videoQueries)).toEqual([])
    expect(checkNamedQueries(articleQueries)).toEqual([])
    expect(videosDataset.feasibility().ok).toBe(true)
    expect(videosDataset.feasibility().anchors).toBe(2_260)
  })

  it('places every id in its explicit cell (a row per id 1–2,260)', () => {
    const seen = videosDataset.query({ sort: 'id' })
    expect(seen.total).toBe(2_260)
    expect(ids(seen.rows)).toEqual(range(1, 2_260))
    for (const row of seen.rows) {
      const cell = cellOf(row.id)
      if (row.subjectId !== cell.subjectId || row.category !== cell.category) {
        throw new Error(`video ${String(row.id)} is in the wrong cell`)
      }
    }
  })

  it('pins ids 2255–2260 and 21–31 to Sejarah and 2224 to Sejarah ceramah', () => {
    for (const id of [...range(2_255, 2_260), ...range(21, 31)]) {
      expect(videosDataset.get(id)?.subjectId).toBe(5)
    }
    const v = videosDataset.get(2_224)
    expect(v?.category).toBe('ceramah')
    expect(v?.subjectId).toBe(5)
    expect(v?.views).toBe(134)
    expect(v?.createdAt).toBe('2026-03-03T12:00:00+08:00')
    expect(v?.description).toContain('Kredit penuh kepada Cikgu Demo')
  })

  it('keeps the observed rows (live titles, views, cells) and the fictitious teacher name', () => {
    expect(videosDataset.get(64)).toMatchObject({
      title: 'Pengenalan Asas Nombor Bab 2 Tingkatan 4',
      views: 115,
      subjectId: 3,
    })
    expect(videosDataset.get(19)).toMatchObject({
      views: 345,
      subjectId: null,
      category: 'ceramah',
    })
    expect(videosDataset.get(18)).toMatchObject({ views: 261, subjectId: 5, category: 'motivasi' })
    expect(videosDataset.get(17)).toMatchObject({
      views: 152,
      subjectId: null,
      category: 'motivasi',
    })
    expect(videosDataset.get(2_220)).toMatchObject({ views: 44, subjectId: 10 })
    expect(videosDataset.get(2_260)?.title).toBe('Sejarah Bersama Cikgu Demo: Tamadun Awal Dunia')
  })

  it('takes every row from the live capture: real title, YouTube id, URLs, no generated media (D22)', () => {
    expect(videosDataset.get(1_500)).toMatchObject({
      title: 'Form 5 Add Maths KSSM Chapter 6 | Self Exercise 6.9 | Trigonometric Functions',
      views: 36,
      externalId: 'gC15LMLz40M',
      videoUrl: 'https://www.youtube.com/watch?v=gC15LMLz40M',
      thumbnailUrl: 'https://img.youtube.com/vi/gC15LMLz40M/hqdefault.jpg',
      subjectId: 8,
      visibility: 'global',
      platform: 'Youtube',
      uploaderId: 1,
    })
    expect(videosDataset.get(16)?.title).toBe('Motivasi Pelajar: Jangan Putus Asa Mengejar Impian')
    expect(videosDataset.get(2_229)?.title).toBe('Sejarah Tingkatan 1: Bab 6')
    expect(LIVE_VIDEOS).toHaveLength(2_260)
    expect(new Set(LIVE_VIDEOS.map((r) => r[1])).size).toBe(2_260)
    for (const row of videosDataset.query({ sort: 'id' }).rows) {
      expect(row.externalId).toMatch(/^[A-Za-z0-9_-]{11}$/)
      if (row.id !== 2_224) expect(row.description).toBeNull()
    }
  })

  it('lists by listKey desc in the captured live order (live is not sorted by age)', () => {
    const rows = videosDataset.query({ sort: [{ field: 'listKey', dir: 'desc' }] }).rows
    expect(ids(rows)).toEqual([...VIDEO_ORDER])
    expect(new Set(rows.map((r) => r.listKey)).size).toBe(2_260)
    const live = JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'docs/discovery/inventory/M09/_live-videos.json'),
        'utf8',
      ),
    ) as { videos: { id: number; ageText: string }[] }
    expect(live.videos.map((v) => v.id)).toEqual([...VIDEO_ORDER])
  })

  it("shows every row's live ageText at the default clock (2,260 of 2,260)", () => {
    const live = JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'docs/discovery/inventory/M09/_live-videos.json'),
        'utf8',
      ),
    ) as { videos: { id: number; ageText: string }[] }
    const byId = new Map(videosDataset.query({ sort: 'id' }).rows.map((r) => [r.id, r]))
    let matched = 0
    for (const v of live.videos) {
      const row = byId.get(v.id)
      if (row && diffForHumans(row.createdAt, NOW) === v.ageText) matched++
    }
    expect(matched).toBe(2_260)
  })

  it('lists page 1 = the 24 live anchors in live order and page 2 as observed', () => {
    const page1 = videos.list({ viewer: null })
    expect(page1.total).toBe(2_260)
    expect(ids(page1.rows)).toEqual([
      2224, 64, 433, 825, 1020, 19, 2225, 65, 434, 827, 1021, 2226, 66, 435, 852, 1022, 2227, 67,
      436, 877, 1023, 2228, 68, 437,
    ])
    const page2 = videos.list({ viewer: null, page: 2 })
    expect(ids(page2.rows)).toEqual([
      878, 1024, 2229, 69, 438, 879, 1025, 2230, 70, 439, 880, 1026, 2231, 71, 440, 881, 1027, 2232,
      72, 441, 882, 1028, 2233, 73,
    ])
  })

  it('reproduces ?subject=5 pages 1–2, ?category=motivasi and page 95', () => {
    const s1 = videos.list({ viewer: null, subjectId: 5 })
    expect(ids(s1.rows)).toEqual(range(2_224, 2_247))
    expect(s1.total).toBe(97)
    const s2 = videos.list({ viewer: null, subjectId: 5, page: 2 })
    expect(ids(s2.rows)).toEqual([...range(2_248, 2_260), ...range(21, 31)])
    expect(ids(videos.list({ viewer: null, category: 'motivasi' }).rows)).toEqual([18, 17, 16])
    const last = videos.list({ viewer: null, page: 95 })
    expect(ids(last.rows)).toEqual([2_220, 2_221, 2_222, 2_223])
    expect(Math.ceil(last.total / 24)).toBe(95)
  })

  it('computes the S17 facets (BR-M09-18)', () => {
    const all = videos.facets({ viewer: null })
    expect(all.total).toBe(2_260)
    expect(all.categories).toEqual([
      { category: 'motivasi', count: 3 },
      { category: 'tutorial', count: 12 },
      { category: 'tips-spm', count: 3 },
      { category: 'ceramah', count: 2_242 },
      { category: 'lain-lain', count: 0 },
    ])
    expect(all.subjects).toEqual([
      { subjectId: 3, count: 865 },
      { subjectId: 5, count: 97 },
      { subjectId: 8, count: 420 },
      { subjectId: 9, count: 779 },
      { subjectId: 10, count: 96 },
    ])
    expect(all.noSubject).toBe(3)
    const sejarah = videos.facets({ viewer: null, subjectId: 5 })
    expect(sejarah.total).toBe(97)
    expect(sejarah.categories.map((c) => c.count)).toEqual([1, 12, 3, 81, 0])
    const motivasi = videos.facets({ viewer: null, category: 'motivasi' })
    expect(motivasi.subjects).toEqual([{ subjectId: 5, count: 1 }])
    const searched = videos.facets({ viewer: null, search: 'sejarah tingkatan 1' })
    expect(searched.total).toBe(8)
    expect(searched.subjects).toEqual([{ subjectId: 5, count: 8 }])
  })

  it('searches by title (case-insensitive) and the order is a permutation', () => {
    expect(videos.list({ viewer: null, search: 'BAROMETER' }).total).toBe(8)
    expect(new Set(VIDEO_ORDER).size).toBe(2_260)
  })

  it('gives the related list (same subject, id desc, 6) and none without a subject', () => {
    expect(ids(videos.related(2_224, null))).toEqual([2_260, 2_259, 2_258, 2_257, 2_256, 2_255])
    expect(videos.related(19, null)).toEqual([])
    const detail = videos.detail(2_224, null)
    expect(detail?.canManage).toBe(false)
    expect(detail?.embedUrl).toBe('https://www.youtube.com/embed/iqtUCV6AHuI')
    expect(videos.detail(9_999, null)).toBeUndefined()
  })

  it('counts a view after the response (BR-M09-07)', () => {
    const before = videosDataset.get(2_225)?.views ?? 0
    videos.countView(2_225)
    expect(videosDataset.get(2_225)?.views).toBe(before + 1)
  })

  it('writes videos through the repository only (uploader or admin; "Sekolah Saya" needs a school)', () => {
    expect(videos.videoSchool(5)).toBe(900001)
    expect(videos.videoSchool(1)).toBeNull()
    expect(() =>
      videos.create(1, {
        videoUrl: 'https://youtu.be/abcdefghijk',
        title: 'Video sekolah',
        category: 'tutorial',
        visibility: 'school',
      }),
    ).toThrow(/tiada sekolah/i)
    const own = videos.create(5, {
      videoUrl: 'https://youtu.be/abcdefghijk',
      title: 'Video sekolah guru',
      category: 'tutorial',
      subjectId: 5,
      visibility: 'school',
    })
    expect(own.id).toBe(2_261)
    expect(own).toMatchObject({ platform: 'Youtube', externalId: 'abcdefghijk', schoolId: 900001 })
    // Same school and the uploader see it; another school and guests do not; the admin does.
    expect(videos.list({ viewer: STUDENT, search: 'sekolah guru' }).total).toBe(1)
    expect(videos.list({ viewer: GURU, search: 'sekolah guru' }).total).toBe(1)
    expect(videos.list({ viewer: ADMIN, search: 'sekolah guru' }).total).toBe(1)
    expect(videos.list({ viewer: PELAJAR_MAJU, search: 'sekolah guru' }).total).toBe(0)
    expect(videos.list({ viewer: null, search: 'sekolah guru' }).total).toBe(0)
    expect(videos.detail(own.id, PELAJAR_MAJU)).toBeUndefined()
    expect(videos.list({ viewer: STUDENT }).total).toBe(2_261)
    expect(() => videos.update(own.id, STUDENT, { ...ownInput(), title: 'x' })).toThrow(
      /tidak dibenarkan/,
    )
    videos.remove(own.id, GURU)
    expect(videos.list({ viewer: ADMIN }).total).toBe(2_260)
  })

  it('refuses a direct write to the store from outside the repository (D12)', () => {
    expect(() => videosDataset.update(2_224, { views: 1 })).toThrow(RepositoryError)
  })
})

function ownInput() {
  return {
    videoUrl: 'https://youtu.be/abcdefghijk',
    title: 'Video sekolah guru',
    category: 'tutorial' as const,
    subjectId: 5,
    visibility: 'school' as const,
  }
}

describe('BR-M09-17 video URL parsing', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abcdefghijk', 'Youtube', 'abcdefghijk'],
    ['https://youtube.com/embed/abcdefghijk', 'Youtube', 'abcdefghijk'],
    ['https://www.youtube.com/shorts/abcdefghijk', 'Youtube', 'abcdefghijk'],
    ['https://youtu.be/abcdefghijk', 'Youtube', 'abcdefghijk'],
    ['https://vimeo.com/123456', 'Vimeo', '123456'],
    ['https://dai.ly/x8abc', 'Dailymotion', 'x8abc'],
    ['https://www.tiktok.com/@a/video/1', 'TikTok', null],
    ['https://example.com/v', 'Other', null],
  ])('%s', (url, platform, externalId) => {
    expect(parseVideoUrl(url)).toMatchObject({ platform, externalId })
  })
})

describe('articles (M09 §6.9, §6.11)', () => {
  it('has the 72 live articles with the documented category, level and featured counts', () => {
    expect(articles.count('Q-ART-ALL')).toBe(72)
    expect(articles.count('Q-ART-PUBLISHED')).toBe(72)
    expect(articles.count('Q-ART-FEATURED')).toBe(13)
    const cat = Object.fromEntries(articles.groupCount('Q-ART-ALL', 'category'))
    expect(cat).toEqual({
      TIPS_BELAJAR: 21,
      MOTIVASI: 14,
      PANDUAN_IBU_BAPA: 10,
      PANDUAN_GURU: 6,
      KEJAYAAN: 7,
      BERITA: 7,
      UMUM: 7,
    })
    const level = Object.fromEntries(articles.groupCount('Q-ART-ALL', 'gradeLevel'))
    expect(level).toEqual({
      // D54: Darjah 1-4 (26) re-levelled to Tingkatan 4, Darjah 5-6 (16) to Tingkatan 5; no Darjah left.
      SEMUA: 30,
      TINGKATAN_4: 26,
      TINGKATAN_5: 16,
    })
    expect(SEED_ARTICLES.some((a) => /^DARJAH_/.test(a.gradeLevel))).toBe(false)
    expect(ids(SEED_ARTICLES)).toEqual(range(1, 72))
    expect(articles.count('Q-ART-CATEGORY', 'BERITA')).toBe(7)
  })

  it('uses fictitious authors only (36 by Admin Demo, 36 by Cikgu Demo 01)', () => {
    const byAuthor = articles.groupCount('Q-ART-ALL', 'authorId')
    expect(byAuthor.get(1)).toBe(36)
    expect(byAuthor.get(3_101)).toBe(36)
    expect(byAuthor.size).toBe(2)
    const card = articles.latest(1)[0]
    expect(card?.author).toEqual({ name: 'Cikgu Demo 01', initial: 'C' })
  })

  it('keeps the observed slugs and slugifies the seed ones', () => {
    expect(articles.get(10)?.slug).toBe('teknik-pomodoro-belajar-25-minit-rehat-5-minit')
    expect(articles.get(66)?.slug).toBe('selamat-datang-ke-prestasi')
    expect(articles.get(7)?.slug).toBe('panduan-guru-menggunakan-jombelajar')
    expect(articles.get(57)?.slug).toHaveLength(61)
    expect(articles.get(63)?.slug).toBe('kempen-sifar-buli-dilancarkan-di-sekolah-seluruh-negara')
    expect(new Set(SEED_ARTICLES.map((a) => a.slug)).size).toBe(72)
    expect(slugify('Kempen "Sifar Buli" Dilancarkan')).toBe('kempen-sifar-buli-dilancarkan')
  })

  it('orders the admin list by createdAt desc then id asc (pages 1 and 4)', () => {
    const p1 = articles.adminList({})
    expect(p1.total).toBe(72)
    expect(ids(p1.rows)).toEqual(range(10, 29))
    expect(ids(articles.adminList({ page: 4 }).rows)).toEqual([
      70, 71, 72, 9, 1, 2, 3, 4, 5, 6, 7, 8,
    ])
    expect(ids(articles.adminList({ category: 'MOTIVASI' }).rows)[0]).toBe(25)
    expect(articles.adminList({ category: 'MOTIVASI' }).total).toBe(14)
    expect(ids(articles.adminList({ category: 'TIPS_BELAJAR', page: 2 }).rows)[0]).toBe(8)
    expect(ids(articles.adminList({ search: 'sifir' }).rows)).toEqual([17, 6])
    expect(articles.adminList({ published: false }).total).toBe(0)
  })

  it('orders the reader list by publishedAt desc then id asc (BR-M09-03)', () => {
    const p1 = articles.readerList({})
    expect(p1.total).toBe(72)
    expect(ids(p1.rows).slice(0, 10)).toEqual([9, 1, 2, 3, 4, 5, 6, 7, 8, 72])
    expect(ids(articles.readerList({ page: 4 }).rows)).toEqual(range(10, 27).reverse())
    expect(ids(articles.readerList({ category: 'BERITA' }).rows)).toEqual(range(59, 65).reverse())
    expect(ids(articles.readerList({ category: 'TIPS_BELAJAR', page: 2 }).rows)).toEqual([
      12, 11, 10,
    ])
    expect(ids(articles.readerList({ search: 'sifir' }).rows).sort((a, b) => a - b)).toEqual([
      6, 17,
    ])
  })

  it('gives latest(5), related(3) and the hot pool', () => {
    expect(articles.latest(5).map((a) => a.title)).toEqual([
      'AI Ini Apa Sebenarnya? Jom Fahami Bersama!',
      '5 Tips Belajar Matematik yang Menyeronokkan',
      'Cara Baca Buku Cerita dalam Bahasa Inggeris',
      'Sains Menyeronokkan: Eksperimen Mudah di Rumah',
      'Panduan Ibu Bapa: Jadual Belajar untuk Anak',
    ])
    expect(ids(articles.related(10))).toEqual([9, 1, 2])
    const rng = mulberry32(7)
    const hot = articles.hot(rng)
    expect(hot).toHaveLength(6)
    expect(new Set(ids(hot)).size).toBe(6)
    const pool = new Set([
      ...SEED_ARTICLES.filter((a) => a.isFeatured).map((a) => a.id),
      11,
      57,
      64,
      67,
      28,
      23,
      43,
      63,
      42,
      26,
    ])
    for (const h of hot) {
      expect(pool.has(h.id)).toBe(true)
      expect(h.badge).toBe(h.isFeatured ? 'PILIHAN' : 'POPULAR')
    }
    // The observed POPULAR cards all lie in the top-10 non-featured by views.
    for (const id of [23, 28, 43, 57, 64]) expect(pool.has(id)).toBe(true)
  })

  it('reproduces the observed relative ages at the project clock', () => {
    const age = (id: number) => diffForHumans(articles.get(id)?.publishedAt ?? '', NOW)
    expect(age(10)).toBe('9 bulan yang lepas')
    expect(age(11)).toBe('9 bulan yang lepas')
    expect(age(12)).toBe('8 bulan yang lepas')
    expect(age(23)).toBe('8 bulan yang lepas')
    expect(age(1)).toBe('7 bulan yang lepas')
    expect(age(9)).toBe('7 bulan yang lepas')
    expect(age(64)).toBe('7 bulan yang lepas')
  })

  it('counts a view before the response on detail (BR-M09-07) and hides drafts', () => {
    const before = articles.get(10)?.views
    expect(before).toBe(596)
    const d = articles.detail('teknik-pomodoro-belajar-25-minit-rehat-5-minit', { countView: true })
    expect(d?.views).toBe(597)
    expect(d?.likes).toBe(6)
    expect(d?.gradeLabel).toBe('Tingkatan 4')
    expect(d?.categoryLabel).toBe('Tips Belajar')
    expect(d?.content).toContain('Apa Itu Teknik Pomodoro?')
    expect(articles.detail('tiada-slug')).toBeUndefined()
  })

  it('supports the M10 teacher form (drafts, limits, own-only, attachments)', () => {
    const created = articles.createFromTeacher(3_101, {
      title: 'Artikel Guru Baharu',
      content: '<p>Isi</p>',
      category: 'TIPS_BELAJAR',
      gradeLevel: 'TINGKATAN_4',
      youtubeUrl: 'https://youtu.be/abcdefghijk',
      attachments: [
        { file: { name: 'Nota Bab 1.pdf', size: 1_000, mime: 'application/pdf' }, label: 'Nota' },
      ],
    })
    expect(created).toMatchObject({
      id: 73,
      isPublished: false,
      slug: 'artikel-guru-baharu',
      authorId: 3_101,
    })
    expect(articles.readerList({ search: 'Guru Baharu' }).total).toBe(0)
    expect(articles.statsByAuthor(3_101)).toMatchObject({ total: 37, published: 36, pending: 1 })
    expect(articles.listByAuthor(3_101, 1, 5).rows[0]?.id).toBe(73)
    const own = articles.getOwn(73, 3_101)
    expect(own?.attachments).toHaveLength(1)
    expect(own?.attachments[0]?.storedPath).toContain('nota-bab-1.pdf')
    expect(articles.getOwn(73, 5)).toBeUndefined()
    expect(() =>
      articles.updateFromTeacher(73, 5, {
        title: 'x',
        content: 'y',
        category: 'UMUM',
        gradeLevel: 'SEMUA',
      }),
    ).toThrow(/tidak dibenarkan/)
    const updated = articles.updateFromTeacher(73, 3_101, {
      title: 'Artikel Guru Baharu 2',
      content: '<p>Isi 2</p>',
      category: 'TIPS_BELAJAR',
      gradeLevel: 'TINGKATAN_4',
    })
    expect(updated).toMatchObject({ slug: 'artikel-guru-baharu', isPublished: false })
    expect(() =>
      articles.createFromTeacher(3_101, {
        title: 'Video',
        content: 'x',
        category: 'UMUM',
        gradeLevel: 'SEMUA',
        attachments: [{ file: { name: 'clip.mp4', size: 10, mime: 'video/mp4' } }],
      }),
    ).toThrow(/PDF, Word, Excel/)
    const attId = own?.attachments[0]?.id as number
    expect(() => articles.deleteAttachment(attId, 5)).toThrow(/tidak dibenarkan/)
    articles.deleteAttachment(attId, 3_101)
    expect(articles.attachments(73)).toHaveLength(0)
    articles.remove(73)
    expect(articles.get(73)).toBeUndefined()
    // BR-M09-08: a taken slug gets "-2".
    const a = articles.create(1, {
      title: 'Selamat Datang ke PRESTASIPLUS',
      content: 'x',
      category: 'UMUM',
      gradeLevel: 'SEMUA',
      isPublished: true,
      isFeatured: false,
    })
    expect(a.slug).toBe('selamat-datang-ke-prestasiplus')
    const b = articles.create(1, {
      title: 'Selamat Datang ke PRESTASIPLUS',
      content: 'x',
      category: 'UMUM',
      gradeLevel: 'SEMUA',
      isPublished: false,
      isFeatured: false,
    })
    expect(b.slug).toBe('selamat-datang-ke-prestasiplus-2')
    expect(b.publishedAt).toBeNull()
    articles.remove(a.id)
    articles.remove(b.id)
  })
})

describe('M05 dashboard inputs (M05 §6.12, §7 #1; M09 FR-M09-40)', () => {
  it('banners.activeFor(admin) = the 5 seeded banners, order kept', () => {
    const list = banners.activeFor({ role: 'admin' })
    expect(list).toHaveLength(5)
    expect(list.map((b) => b.type)).toEqual([
      'HERO',
      'FEATURE',
      'PROMOTIONAL',
      'ANNOUNCEMENT',
      'FEATURE',
    ])
    expect(list.map((b) => b.title)).toEqual([
      'Selamat Datang ke PRESTASIPLUS',
      '2,000+ Soalan Latihan Tersedia!',
      'Cabaran Mingguan: Siapa Paling Rajin?',
      'Tips untuk Ibu Bapa: Bimbing Anak Belajar',
      'Kumpul Badge & Tunjukkan Kehebatan!',
    ])
    expect(list[0]).toEqual({
      type: 'HERO',
      title: 'Selamat Datang ke PRESTASIPLUS',
      description:
        'Platform pembelajaran interaktif untuk pelajar sekolah. Jom mula belajar hari ini!',
    })
  })

  it('delivers by audience (BR-M09-14) and inside the date window', () => {
    expect(banners.activeFor({ role: 'student' })).toHaveLength(5)
    expect(banners.activeFor({ role: 'teacher' }).map((b) => b.title)).toEqual([
      'Selamat Datang ke PRESTASIPLUS',
      'Tips untuk Ibu Bapa: Bimbing Anak Belajar',
    ])
    expect(banners.activeFor({ role: 'parent' })).toHaveLength(2)
    expect(banners.count('Q-BANNER-ALL')).toBe(5)
    expect(Object.fromEntries(banners.groupCount('Q-BANNER-ALL', 'bannerType'))).toEqual({
      HERO: 1,
      FEATURE: 2,
      PROMOTIONAL: 1,
      ANNOUNCEMENT: 1,
    })
    clock.setNow('2027-01-02T09:00:00+08:00')
    expect(banners.activeFor({ role: 'admin' })).toEqual([])
    clock.setNow(NOW)
    expect(banners.activeFor({ role: 'admin' })).toHaveLength(5)
  })

  it('articles.latest(5) carries slug, title, category and publishedAt for the strip and aside', () => {
    const list = articles.latest(5)
    expect(list).toHaveLength(5)
    expect(list[0]).toMatchObject({
      slug: 'ai-ini-apa-sebenarnya-jom-fahami-bersama',
      category: 'TIPS_BELAJAR',
      categoryLabel: 'Tips Belajar',
    })
    expect(list.every((a) => typeof a.publishedAt === 'string')).toBe(true)
    expect(list.map((a) => diffForHumans(a.publishedAt ?? '', NOW))).toEqual(
      Array(5).fill('7 bulan yang lepas'),
    )
  })
})

describe('notes, perutusan, support', () => {
  it('has the 10 D54 Tingkatan 4/5 notes (note types keep the live split)', () => {
    expect(notes.count('Q-NOTE-ALL')).toBe(10)
    expect(notes.count('Q-NOTE-SUBJECT', 'matematik')).toBe(1)
    expect(notes.count('Q-NOTE-SUBJECT', 'kimia')).toBe(2)
    expect(notes.count('Q-NOTE-SUBJECT', 'sains')).toBe(0)
    expect(notes.count('Q-NOTE-TYPE', 'RINGKASAN')).toBe(5)
    expect(notes.adminList({ subject: 'biologi' }).total).toBe(2)
    expect(notes.adminList({ search: 'termokimia' }).total).toBe(1)
    expect(SEED_NOTES.map((n) => n.grade).sort()).toEqual([
      ...Array<string>(5).fill('TINGKATAN_4'),
      ...Array<string>(5).fill('TINGKATAN_5'),
    ])
    expect(SEED_NOTES.some((n) => /darjah/i.test(`${n.title} ${n.grade}`))).toBe(false)
    expect(notes.adminList({ noteType: 'summary' }).total).toBe(5)
    expect(notes.adminList({ noteType: 'full_notes' }).total).toBe(2)
  })

  it('has the 3 live perutusan (pinned 2, public 1, reads 3 / 4 / 55, reactions like 1, love 5)', () => {
    expect(perutusan.count('Q-PER-ALL')).toBe(3)
    expect(perutusan.count('Q-PER-PINNED')).toBe(2)
    expect(perutusan.count('Q-PER-PUBLIC')).toBe(1)
    const admin = perutusan.list(ADMIN)
    expect(admin.map((p) => p.id)).toEqual([4, 2, 3])
    expect(admin.map((p) => p.reads)).toEqual([3, 4, 55])
    expect(admin[0]?.topReaction).toEqual({ type: 'like', emoji: '👍', count: 1 })
    expect(admin[2]?.topReaction).toEqual({ type: 'love', emoji: '❤️', count: 5 })
    expect(admin[0]?.author).toMatchObject({ initials: 'AD', roleLabel: 'Pengetua' })
    expect(admin.every((p) => p.commentCount === 0)).toBe(true)
    // Scope (BR-M09-23): pelajarmaju (900004) sees no school post; pelajar (900001) sees #2 only.
    expect(perutusan.list(PELAJAR_MAJU)).toEqual([])
    expect(perutusan.list(STUDENT).map((p) => p.id)).toEqual([2])
    expect(perutusan.publicDetail(4)?.id).toBe(4)
    expect(perutusan.publicDetail(2)).toBeUndefined()
  })

  it('counts reads once per logged-in reader who is neither the admin nor the author', () => {
    expect(perutusan.markRead(2, ADMIN)).toBe(4)
    expect(perutusan.markRead(2, STUDENT)).toBe(5)
    expect(perutusan.markRead(2, STUDENT)).toBe(5)
    expect(perutusan.markRead(2, { id: 3_103, role: 'school_admin', schoolId: 900001 })).toBe(5)
  })

  it('toggles reactions and stores comments pending (never shown)', () => {
    const r = perutusan.toggleReaction(4, STUDENT, 'thanks')
    expect(r.reactions).toEqual({ like: 1, love: 0, thanks: 1 })
    expect(r.myReactions).toEqual(['thanks'])
    expect(perutusan.toggleReaction(4, STUDENT, 'thanks').reactions.thanks).toBe(0)
    perutusan.addComment(4, STUDENT, 'Terima kasih')
    expect(perutusan.comments(4)).toEqual([])
    expect(() => perutusan.addComment(4, STUDENT, ' ')).toThrow(/1 hingga 1000/)
  })

  it('holds the support config and an empty audio / screenshot state', () => {
    expect(support.config()).toEqual({
      email: 'support@prestasiplus.my',
      whatsappNumber: '60123456789',
    })
    support.setWhatsappNumber('60111111111')
    expect(support.config().whatsappNumber).toBe('60111111111')
    expect(support.screenshotCount()).toBe(0)
  })

  it('registers as plugin M09 with the documented repositories', () => {
    expect(plugin.id).toBe('M09')
    expect(Object.keys(plugin.repositories).sort()).toEqual(
      ['articles', 'audioKbat', 'banners', 'notes', 'perutusan', 'support', 'videos'].sort(),
    )
  })
})

describe('cross-module references and reset', () => {
  it('resolves every author, school and reactor of the seed in M01 / M02', async () => {
    const { users } = await import('@/modules/m01-authentication/mock')
    const { schools } = await import('@/modules/m02-users-schools/mock')
    expect(users.get(1)?.name).toBe('Admin Demo')
    expect(users.get(3_101)).toMatchObject({ name: 'Cikgu Demo 01', role: 'teacher' })
    expect(users.get(3_102)).toMatchObject({
      name: 'Azlan Demo',
      role: 'school_admin',
      schoolId: 900_003,
    })
    expect(users.get(3_103)).toMatchObject({ role: 'school_admin', schoolId: 900_001 })
    expect(users.get(3_104)).toMatchObject({ role: 'school_admin', schoolId: 900_002 })
    for (const id of [3_105, 3_106, 3_107, 3_108, 3_109])
      expect(users.get(id)?.role).toBe('student')
    for (const id of [900_001, 900_002, 900_003]) expect(schools.get(id)).toBeDefined()
    expect(schools.get(videos.videoSchool(5) ?? 0)?.name).toBeDefined()
  })

  it('restores the seed on reset (writes are discarded, counts are the live ones)', async () => {
    const extra = videos.create(1, {
      videoUrl: 'https://youtu.be/abcdefghijk',
      title: 'Sementara',
      category: 'lain-lain',
      visibility: 'global',
    })
    expect(extra.id).toBeGreaterThan(2_260)
    expect(videos.count('Q-VID-ALL')).toBe(2_261)
    await runtime.reset()
    expect(videos.count('Q-VID-ALL')).toBe(2_260)
    expect(videos.count('Q-VID-CAT', 'lain-lain')).toBe(0)
    expect(articles.count('Q-ART-ALL')).toBe(72)
    expect(support.config().whatsappNumber).toBe('60123456789')
    expect(perutusan.list(ADMIN).map((p) => p.reads)).toEqual([3, 4, 55])
  })
})

describe('perutusan writes and visibility (BR-M09-22…28)', () => {
  const SCHOOL_ADMIN: Viewer = { id: 3_103, role: 'school_admin', schoolId: 900_001 }
  const base = { title: 'T', body: '<p>Isi</p>', status: 'published' as const }

  it('creates a national post as admin and a school post as school_admin', () => {
    const national = perutusan.create(ADMIN, base)
    expect(national).toMatchObject({ scope: 'national', schoolId: null, authorId: 1, reads: 0 })
    const school = perutusan.create(SCHOOL_ADMIN, base)
    expect(school).toMatchObject({ scope: 'school', schoolId: 900_001, authorId: 3_103 })
    expect(perutusan.list(PELAJAR_MAJU).map((p) => p.id)).toEqual([national.id])
    expect(perutusan.list(STUDENT).map((p) => p.id)).toContain(school.id)
  })

  it('refuses other roles (403) and a school admin without a school', () => {
    expect(() => perutusan.create(STUDENT, base)).toThrow(/tidak dibenarkan/)
    expect(() => perutusan.create(GURU, base)).toThrow(/tidak dibenarkan/)
    expect(() =>
      perutusan.create({ id: 3_103, role: 'school_admin', schoolId: null }, base),
    ).toThrow(/mempunyai sekolah/)
  })

  it('refuses a third pinned published post in one scope, not in another', () => {
    const pin = { ...base, isPinned: true }
    perutusan.create(ADMIN, pin)
    perutusan.create(ADMIN, pin)
    expect(() => perutusan.create(ADMIN, pin)).toThrow(/Maksimum 2/)
    // School 900001 already has pinned #2: one more fits, the next does not.
    perutusan.create(SCHOOL_ADMIN, pin)
    expect(() => perutusan.create(SCHOOL_ADMIN, pin)).toThrow(/Maksimum 2/)
    // A draft pin does not count.
    expect(() => perutusan.create(ADMIN, { ...pin, status: 'draft' })).not.toThrow()
  })

  it('hides a scheduled post until its time and shows drafts only to author and admin', () => {
    const at = new Date(Date.parse(NOW) + 3_600_000).toISOString()
    const scheduled = perutusan.create(ADMIN, {
      ...base,
      title: 'Berjadual',
      status: 'scheduled',
      scheduledAt: at,
    })
    const draft = perutusan.create(ADMIN, { ...base, title: 'Draf', status: 'draft' })
    const titles = (v: Viewer) => perutusan.list(v).map((p) => p.title)
    expect(titles(STUDENT)).not.toContain('Berjadual')
    expect(titles(STUDENT)).not.toContain('Draf')
    expect(perutusan.detail(scheduled.id, STUDENT)).toBeUndefined()
    expect(perutusan.detail(draft.id, STUDENT)).toBeUndefined()
    expect(perutusan.detail(draft.id, ADMIN)?.canWrite).toBe(true)
    expect(perutusan.detail(scheduled.id, ADMIN)).toBeDefined()
    expect(titles(ADMIN)).not.toContain('Draf')
    expect(perutusan.mine(ADMIN).map((p) => p.title)).toEqual(
      expect.arrayContaining(['Berjadual', 'Draf']),
    )
    expect(perutusan.mine(STUDENT)).toEqual([])
    clock.setNow(Date.parse(NOW) + 2 * 3_600_000)
    expect(titles(STUDENT)).toContain('Berjadual')
    expect(perutusan.detail(scheduled.id, STUDENT)).toBeDefined()
    expect(titles(STUDENT)).not.toContain('Draf')
    clock.setNow(NOW)
    expect(titles(STUDENT)).not.toContain('Berjadual')
  })

  it('lists mine pinned first (BR-M09-24)', () => {
    const mine = perutusan.mine(ADMIN)
    const firstUnpinned = mine.findIndex((p) => !p.isPinned)
    expect(firstUnpinned).toBeGreaterThan(0)
    expect(mine.slice(firstUnpinned).some((p) => p.isPinned)).toBe(false)
  })

  it('cuts the excerpt at 250 characters (BR-M09-27)', () => {
    expect(excerptOf('<p>' + 'a'.repeat(250) + '</p>')).toBe('a'.repeat(250))
    expect(excerptOf('<p>' + 'a'.repeat(251) + '</p>')).toBe('a'.repeat(250) + '...')
    expect(excerptOf('<p>a</p>  <b>b</b>\n c')).toBe('a b c')
  })
})

describe('audio KBAT, banners, notes, support writes', () => {
  it('rejects a set that is not 4 sections and 30 questions', () => {
    const fixture = audioKbat.seedFixture(1, 1)
    const head = { title: 'x', educationLevelId: 10, subjectId: 1 }
    expect(() =>
      audioKbat.create(1, {
        ...head,
        sections: fixture.sections.slice(0, 3),
        questions: fixture.questions,
      }),
    ).toThrow(/4 bahagian dan 30 soalan/)
    expect(() =>
      audioKbat.create(1, {
        ...head,
        sections: fixture.sections,
        questions: fixture.questions.slice(0, 29),
      }),
    ).toThrow(/4 bahagian dan 30 soalan/)
  })

  it('computes stats, ANDed filters and approved sets after the two fixtures', () => {
    // seedFixture(1) ran in the previous test (approved, level 10, subject 1); add the draft.
    audioKbat.seedFixture(1, 2)
    expect(audioKbat.stats()).toEqual({ sets: 2, approved: 1, draftOrPending: 1, questions: 60 })
    expect(audioKbat.adminList({ status: 'draft', subjectId: 2 })).toHaveLength(1)
    expect(audioKbat.adminList({ status: 'draft', subjectId: 1 })).toHaveLength(0)
    expect(audioKbat.adminList({ educationLevelId: 10, search: 'BM T4' })).toHaveLength(1)
    expect(audioKbat.adminList({ educationLevelId: 10, search: 'BI' })).toHaveLength(0)
    expect(audioKbat.adminList({ search: 'demo 02' })).toHaveLength(2)
    expect(audioKbat.approved({ educationLevelId: 10, subjectId: 1 })).toHaveLength(1)
    expect(audioKbat.approved({ educationLevelId: 11 })).toHaveLength(0)
    expect(audioKbat.approved().map((s) => s.title)).toEqual(['BM T4 Ujian Mendengar Set 1'])
  })

  it('upper-cases banner codes on create and update (BR-M09-12) and removes', () => {
    const input = {
      title: 'Baharu',
      description: null,
      imageUrl: null,
      bannerType: 'promo',
      linkType: 'external',
      externalUrl: 'https://example.com',
      targetAudience: 'teacher',
      displayOrder: 9,
      startDate: null,
      endDate: null,
      isActive: true,
    }
    const created = banners.create(input)
    expect(created).toMatchObject({
      bannerType: 'PROMO',
      linkType: 'EXTERNAL',
      targetAudience: 'TEACHER',
    })
    expect(banners.activeFor({ role: 'teacher' }).map((b) => b.title)).toContain('Baharu')
    const updated = banners.update(created.id, {
      ...input,
      bannerType: 'event',
      targetAudience: 'student',
    })
    expect(updated).toMatchObject({ bannerType: 'EVENT', targetAudience: 'STUDENT' })
    expect(banners.activeFor({ role: 'teacher' }).map((b) => b.title)).not.toContain('Baharu')
    banners.remove(created.id)
    expect(banners.get(created.id)).toBeUndefined()
    expect(() => banners.remove(created.id)).toThrow(/tidak dijumpai/)
    expect(banners.count('Q-BANNER-ALL')).toBe(5)
  })

  it('pages the notes list', () => {
    const p2 = notes.adminList({ page: 2, pageSize: 4 })
    expect(p2.total).toBe(10)
    expect(ids(p2.rows)).toEqual([5, 6, 7, 8])
    expect(ids(notes.adminList({ page: 3, pageSize: 4 }).rows)).toEqual([9, 10])
    expect(notes.adminList({ page: 4, pageSize: 4 }).rows).toEqual([])
  })

  it('applies the screenshot rules (BR-M09-30)', () => {
    const png = { name: 'Foto Kelas 1.PNG', size: 1_000, mime: 'image/png' }
    expect(support.addScreenshot(1, png)).toMatchObject({
      fileName: 'foto-kelas-1.png',
      originalName: 'Foto Kelas 1.PNG',
    })
    expect(support.addScreenshot(1, png).fileName).toBe('foto-kelas-1-1.png')
    expect(support.addScreenshot(1, png).fileName).toBe('foto-kelas-1-2.png')
    const limit = 10 * 1024 * 1024
    expect(
      support.addScreenshot(1, { name: 'a.bmp', size: limit, mime: 'image/bmp' }).fileName,
    ).toBe('a.bmp')
    expect(() =>
      support.addScreenshot(1, { name: 'b.png', size: limit + 1, mime: 'image/png' }),
    ).toThrow(/10 MB/)
    expect(() =>
      support.addScreenshot(1, { name: 'c.pdf', size: 10, mime: 'application/pdf' }),
    ).toThrow(/JPG, PNG/)
    expect(support.screenshotCount()).toBe(4)
  })
})
