import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import { ErrorBodySchema } from '../../common/error'
import { CONTENT_COMPONENT_SCHEMAS } from '../paths'
import {
  AUDIO_QUESTION_COUNT,
  AUDIO_SECTION_COUNT,
  ActiveBannerSchema,
  AdminArticleCreateRequestSchema,
  AdminArticleDetailSchema,
  AdminArticleItemSchema,
  AdminArticleUpdateRequestSchema,
  AdminAudioKbatCreateRequestSchema,
  AdminAudioKbatCreatedSchema,
  AdminAudioKbatListResponseSchema,
  AdminBannerCreateRequestSchema,
  AdminBannerSchema,
  AdminBannerUpdateRequestSchema,
  AdminNoteCreateRequestSchema,
  AdminNoteDetailSchema,
  AdminNoteUpdateRequestSchema,
  ArticleCardSchema,
  ArticleDetailSchema,
  ArticleHotCardSchema,
  AudioKbatAttemptRequestSchema,
  AudioKbatAttemptResultSchema,
  AudioKbatPlaySetSchema,
  CONTENT_FLASH,
  CONTENT_MESSAGES,
  ContentDeletedSchema,
  ContentSupportConfigSchema,
  PerutusanCommentRequestSchema,
  PerutusanCreateRequestSchema,
  PerutusanDetailSchema,
  PerutusanPublicSchema,
  PerutusanReactionRequestSchema,
  PerutusanReactionResultSchema,
  ScreenshotUploadRequestSchema,
  ScreenshotUploadResultSchema,
  VideoCreateRequestSchema,
  VideoDetailSchema,
  VideoFormContextSchema,
  VideoListResponseSchema,
  contentFileRefused,
  contentMutationOf,
} from '../schema'

const AT = '2026-10-16T09:30:00+08:00'
const author = { id: '12', name: 'Aina Penulis' }

/** All keys of a JSON value, recursively. */
const keysOf = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.flatMap(keysOf)
    : v && typeof v === 'object'
      ? Object.entries(v).flatMap(([k, x]) => [k, ...keysOf(x)])
      : []

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) => schema.safeParse(value).success

describe('articles', () => {
  const card = {
    id: '501',
    slug: 'tips-belajar-berkesan',
    title: 'Tips Belajar Berkesan',
    excerpt: null,
    category: 'TIPS_BELAJAR',
    categoryLabel: 'Tips Belajar',
    isFeatured: false,
    views: 10,
    publishedAt: AT,
    author: { name: 'Aina Penulis', initial: 'A' },
  }

  it('parses reader cards, hot cards and the detail', () => {
    expect(ok(ArticleCardSchema, card)).toBe(true)
    expect(ok(ArticleCardSchema, { ...card, publishedAt: null })).toBe(true)
    expect(ok(ArticleHotCardSchema, { ...card, badge: 'PILIHAN' })).toBe(true)
    const detail = { ...card, content: '<p>Isi</p>', gradeLevel: 'SEMUA', gradeLabel: 'Semua', likes: 2, related: [card] }
    expect(ok(ArticleDetailSchema, detail)).toBe(true)
  })

  it('rejects a bad category, a UTC timestamp, a bad badge, more than 3 related and extra keys', () => {
    expect(ok(ArticleCardSchema, { ...card, category: 'SUKAN' })).toBe(false)
    expect(ok(ArticleCardSchema, { ...card, publishedAt: '2026-10-16T01:30:00Z' })).toBe(false)
    expect(ok(ArticleHotCardSchema, { ...card, badge: 'HOT' })).toBe(false)
    expect(ok(ArticleCardSchema, { ...card, secret: 1 })).toBe(false)
    const detail = { ...card, content: '', gradeLevel: 'SEMUA', gradeLabel: 'Semua', likes: 0, related: [card, card, card, card] }
    expect(ok(ArticleDetailSchema, detail)).toBe(false)
  })

  const adminDetail = {
    id: '501',
    title: 'Tips Belajar Berkesan',
    slug: 'tips-belajar-berkesan',
    excerpt: 'Ringkasan',
    content: '<p>Isi</p>',
    featuredImage: null,
    youtubeUrl: null,
    category: 'TIPS_BELAJAR',
    gradeLevel: 'DARJAH_3',
    isPublished: true,
    isFeatured: false,
    views: 0,
    likes: 0,
    authorId: '12',
    publishedAt: AT,
    createdAt: AT,
    updatedAt: AT,
    categoryLabel: 'Tips Belajar',
    gradeLabel: 'Darjah 3',
    author,
    attachments: [{ id: '7', fileName: 'nota.pdf', label: null, size: 1024 }],
  }

  it('parses the admin item and detail', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit keys to build an invalid payload
    const { content: _c, ...rest } = adminDetail
    expect(ok(AdminArticleItemSchema, { id: '501', title: 'T', category: 'BERITA', categoryLabel: 'Berita', gradeLevel: 'SEMUA', isPublished: false, isFeatured: false, views: 0, createdAt: AT, author })).toBe(true)
    expect(ok(AdminArticleDetailSchema, adminDetail)).toBe(true)
    expect(ok(AdminArticleDetailSchema, rest)).toBe(false)
  })

  it('accepts create and partial update bodies and rejects the mock refusals', () => {
    expect(ok(AdminArticleCreateRequestSchema, { title: 'Tajuk', content: '<p>Isi</p>', category: 'BERITA' })).toBe(true)
    expect(ok(AdminArticleCreateRequestSchema, { title: 'Tajuk', excerpt: null, content: '<p>Isi</p>', featuredImage: 'https://example.test/a.png', category: 'UMUM', gradeLevel: 'DARJAH_6', isPublished: true, isFeatured: true })).toBe(true)
    expect(ok(AdminArticleUpdateRequestSchema, { isPublished: true })).toBe(true)
    expect(ok(AdminArticleUpdateRequestSchema, {})).toBe(true)
    for (const bad of [
      { content: 'x', category: 'BERITA' },
      { title: '   ', content: 'x', category: 'BERITA' },
      { title: 'a'.repeat(256), content: 'x', category: 'BERITA' },
      { title: 'T', content: 'x', category: 'SUKAN' },
      { title: 'T', content: 'x', category: 'BERITA', featuredImage: 'ftp://example.test/a.png' },
      { title: 'T', content: 'x', category: 'BERITA', excerpt: 'e'.repeat(501) },
      { title: 'T', content: 'x', category: 'BERITA', gradeLevel: 'TINGKATAN_1' },
    ]) {
      expect(ok(AdminArticleCreateRequestSchema, bad)).toBe(false)
    }
    expect(ok(AdminArticleUpdateRequestSchema, { category: 'SUKAN' })).toBe(false)
  })
})

describe('banners', () => {
  const banner = {
    id: '3',
    title: 'Selamat Datang',
    description: null,
    imageUrl: null,
    bannerType: 'FEATURE',
    linkType: 'NONE',
    externalUrl: null,
    targetAudience: 'ALL',
    displayOrder: 0,
    startDate: '2026-10-01',
    endDate: null,
    isActive: true,
    createdAt: AT,
    updatedAt: AT,
  }

  it('parses active and admin banners, including a stored legacy code', () => {
    expect(ok(ActiveBannerSchema, { type: 'HERO', title: 'Hebahan', description: null })).toBe(true)
    expect(ok(AdminBannerSchema, banner)).toBe(true)
    expect(ok(AdminBannerSchema, { ...banner, startDate: '01/10/2026' })).toBe(false)
    expect(ok(AdminBannerSchema, { ...banner, displayOrder: -1 })).toBe(false)
  })

  it('create: form codes only, EXTERNAL needs a URL, end not before start', () => {
    expect(ok(AdminBannerCreateRequestSchema, { title: 'Hebahan', bannerType: 'HERO' })).toBe(true)
    expect(ok(AdminBannerCreateRequestSchema, { title: 'Hebahan', bannerType: 'EVENT', linkType: 'EXTERNAL', externalUrl: 'https://example.test/acara', targetAudience: 'STUDENT', displayOrder: 2, startDate: '2026-10-01', endDate: '2026-10-31', isActive: false })).toBe(true)
    for (const bad of [
      { title: 'Hebahan' },
      { title: 'Hebahan', bannerType: 'FEATURE' },
      { title: 'Hebahan', bannerType: 'HERO', linkType: 'EXTERNAL' },
      { title: 'Hebahan', bannerType: 'HERO', linkType: 'EXTERNAL', externalUrl: 'bukan-url' },
      { title: 'Hebahan', bannerType: 'HERO', startDate: '2026-10-31', endDate: '2026-10-01' },
      { title: 'Hebahan', bannerType: 'HERO', startDate: '2026-02-30' },
      { title: 'Hebahan', bannerType: 'HERO', displayOrder: -1 },
      { title: 'Hebahan', bannerType: 'HERO', description: 'd'.repeat(5001) },
    ]) {
      expect(ok(AdminBannerCreateRequestSchema, bad)).toBe(false)
    }
  })

  it('update: partial, and a stored legacy code is accepted', () => {
    expect(ok(AdminBannerUpdateRequestSchema, { bannerType: 'FEATURE' })).toBe(true)
    expect(ok(AdminBannerUpdateRequestSchema, { isActive: false })).toBe(true)
    expect(ok(AdminBannerUpdateRequestSchema, { startDate: '2026-10-31', endDate: '2026-10-01' })).toBe(false)
    expect(ok(AdminBannerUpdateRequestSchema, { title: '' })).toBe(false)
  })
})

describe('notes', () => {
  const note = {
    id: '4',
    title: 'Rumus Luas',
    summary: null,
    subject: 'matematik',
    subjectLabel: 'Matematik',
    noteType: 'MIND_MAP',
    grade: 'DARJAH_4',
    gradeLabel: 'Darjah 4',
    isPublished: false,
    views: 0,
    downloads: 0,
    author,
    createdAt: AT,
    updatedAt: AT,
  }

  it('parses a detail (all seven stored types may be listed)', () => {
    expect(ok(AdminNoteDetailSchema, { ...note, content: '<p>Nota</p>' })).toBe(true)
    expect(ok(AdminNoteDetailSchema, { ...note, noteType: 'KUIZ', content: 'x' })).toBe(false)
    expect(ok(AdminNoteDetailSchema, { ...note, subject: 'geografi', content: 'x' })).toBe(false)
  })

  it('create accepts only the four form types; update is partial', () => {
    const base = { title: 'Rumus Luas', content: '<p>Nota</p>', subject: 'sains', noteType: 'FORMULA', grade: 'DARJAH_5' }
    expect(ok(AdminNoteCreateRequestSchema, base)).toBe(true)
    expect(ok(AdminNoteCreateRequestSchema, { ...base, summary: null, isPublished: true })).toBe(true)
    for (const bad of [
      { ...base, noteType: 'MIND_MAP' },
      { ...base, grade: 'DARJAH_7' },
      { ...base, subject: 'geografi' },
      { ...base, summary: 's'.repeat(1001) },
      { title: 'x' },
    ]) {
      expect(ok(AdminNoteCreateRequestSchema, bad)).toBe(false)
    }
    expect(ok(AdminNoteUpdateRequestSchema, { isPublished: true })).toBe(true)
    expect(ok(AdminNoteUpdateRequestSchema, { noteType: 'MIND_MAP' })).toBe(false)
  })
})

describe('videos', () => {
  const uploader = { name: 'Hakim Pengunggah', initial: 'H', roleLabel: 'Guru' }
  const card = { id: '9', title: 'Tips SPM', platformLabel: 'YouTube', thumbnailUrl: null, views: 3, createdAt: AT, uploader }
  const detail = {
    ...card,
    videoUrl: 'https://www.youtube.com/watch?v=abc123',
    embedUrl: 'https://www.youtube.com/embed/abc123',
    platform: 'Youtube',
    description: null,
    category: 'tips-spm',
    categoryLabel: 'Tips SPM',
    subject: { id: '3', name: 'Matematik' },
    visibility: 'global',
    canManage: false,
    related: [card],
  }

  it('parses the library with facets, the detail and the form context', () => {
    const meta = {
      page: 1,
      pageSize: 24,
      totalItems: 1,
      totalPages: 1,
      from: 1,
      to: 1,
      facets: {
        total: 1,
        categories: [{ code: 'tips-spm', label: 'Tips SPM', count: 1 }, { code: 'motivasi', label: 'Motivasi', count: 0 }],
        subjects: [{ id: '3', name: 'Matematik', count: 1 }],
      },
    }
    expect(ok(VideoListResponseSchema, { data: [card], meta })).toBe(true)
    expect(ok(VideoListResponseSchema, { data: [card], meta: { ...meta, facets: undefined } })).toBe(false)
    expect(ok(VideoDetailSchema, detail)).toBe(true)
    expect(ok(VideoDetailSchema, { ...detail, subject: null, embedUrl: null, platform: 'Other' })).toBe(true)
    expect(ok(VideoFormContextSchema, { uploader, school: { id: '88', name: 'SK Contoh' } })).toBe(true)
    expect(ok(VideoFormContextSchema, { uploader, school: null })).toBe(true)
  })

  it('rejects a bad platform, visibility and related count', () => {
    expect(ok(VideoDetailSchema, { ...detail, platform: 'Twitch' })).toBe(false)
    expect(ok(VideoDetailSchema, { ...detail, visibility: 'private' })).toBe(false)
    expect(ok(VideoDetailSchema, { ...detail, related: Array(7).fill(card) })).toBe(false)
  })

  it('create body: required fields, http(s) URL, category and visibility', () => {
    const body = { videoUrl: 'https://youtu.be/abc123', title: 'Tips SPM', category: 'tips-spm', visibility: 'global' }
    expect(ok(VideoCreateRequestSchema, body)).toBe(true)
    expect(ok(VideoCreateRequestSchema, { ...body, description: null, subjectId: '3', visibility: 'school' })).toBe(true)
    for (const bad of [
      { ...body, videoUrl: 'youtube.com/x' },
      { ...body, videoUrl: 'javascript:alert(1)' },
      { ...body, title: '' },
      { ...body, category: 'sukan' },
      { ...body, visibility: 'private' },
      { ...body, description: 'd'.repeat(1001) },
      { title: 'Tips SPM', category: 'tips-spm', visibility: 'global' },
    ]) {
      expect(ok(VideoCreateRequestSchema, bad)).toBe(false)
    }
  })
})

describe('perutusan', () => {
  const author = { name: 'Zainab Pengetua', initials: 'ZP', roleLabel: 'Pengetua' }
  const detail = {
    id: '5',
    title: 'Hebahan Peperiksaan',
    excerpt: 'Ringkas...',
    isPinned: true,
    hasVideo: false,
    scopeLabel: 'Seluruh Malaysia (Kebangsaan)',
    createdAt: AT,
    author,
    topReaction: { type: 'like', emoji: '👍', count: 2 },
    commentCount: 1,
    reads: 7,
    body: '<p>Isi</p>',
    youtubeEmbedUrl: null,
    images: [{ fileName: 'a.png', size: 100 }],
    documents: [],
    isPublic: true,
    publicUrl: '/perutusan/awam/5',
    reactions: { like: 2, love: 0, thanks: 0 },
    myReactions: ['like'],
    canWrite: false,
  }

  it('parses the detail, with and without a top reaction', () => {
    expect(ok(PerutusanDetailSchema, detail)).toBe(true)
    expect(ok(PerutusanDetailSchema, { ...detail, topReaction: null, publicUrl: null })).toBe(true)
    expect(ok(PerutusanDetailSchema, { ...detail, reactions: { like: 1, love: 0 } })).toBe(false)
    expect(ok(PerutusanDetailSchema, { ...detail, myReactions: ['wow'] })).toBe(false)
    expect(ok(PerutusanDetailSchema, { ...detail, topReaction: { type: 'like', emoji: '', count: 0 } })).toBe(false)
  })

  it('parses the public post and the reaction and comment bodies', () => {
    const pub = { id: '5', title: 'T', author, body: '<p>x</p>', createdAt: AT, youtubeEmbedUrl: null, scopeLabel: 'Sekolah', reactionTotal: 2, reads: 7, commentCount: 1 }
    expect(ok(PerutusanPublicSchema, pub)).toBe(true)
    expect(ok(PerutusanPublicSchema, { ...pub, isPublic: true })).toBe(false)
    expect(ok(PerutusanReactionRequestSchema, { type: 'thanks' })).toBe(true)
    expect(ok(PerutusanReactionRequestSchema, { type: 'wow' })).toBe(false)
    expect(ok(PerutusanReactionResultSchema, { reactions: { like: 1, love: 0, thanks: 0 }, myReactions: [] })).toBe(true)
    expect(ok(PerutusanCommentRequestSchema, { body: 'Terima kasih' })).toBe(true)
    expect(ok(PerutusanCommentRequestSchema, { body: '' })).toBe(false)
    expect(ok(PerutusanCommentRequestSchema, { body: 'a'.repeat(1001) })).toBe(false)
  })

  it('create (multipart): files, status, scheduledAt and boolean parts', () => {
    const png = new File(['x'], 'poster.png', { type: 'image/png' })
    const pdf = new File(['x'], 'surat.pdf', { type: 'application/pdf' })
    const base = { title: 'Hebahan', status: 'published' }
    expect(ok(PerutusanCreateRequestSchema, base)).toBe(true)
    expect(ok(PerutusanCreateRequestSchema, { ...base, body: '<p>x</p>', images: [png, png], documents: [pdf], isPinned: '1', isPublic: 'on' })).toBe(true)
    expect(ok(PerutusanCreateRequestSchema, { ...base, status: 'scheduled', scheduledAt: '2026-11-01T08:00' })).toBe(true)
    expect(ok(PerutusanCreateRequestSchema, { ...base, status: 'scheduled', scheduledAt: '2026-11-01T08:00:00+08:00' })).toBe(true)
    for (const bad of [
      { status: 'published' },
      { title: 'Hebahan' },
      { ...base, status: 'archived' },
      { ...base, scheduledAt: 'esok' },
      { ...base, images: [pdf] },
      { ...base, documents: [png] },
      { ...base, images: [new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'besar.png', { type: 'image/png' })] },
      { ...base, documents: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'besar.pdf', { type: 'application/pdf' })] },
      { ...base, images: ['poster.png'] },
    ]) {
      expect(ok(PerutusanCreateRequestSchema, bad)).toBe(false)
    }
  })
})

describe('audio KBAT student play', () => {
  const question = (no: number) => ({ no, questionText: `Soalan ${String(no)}`, options: { A: 'a', B: 'b', C: 'c', D: 'd' }, marks: 1 })
  const set = {
    id: '14',
    title: 'Set Contoh',
    instructions: null,
    sections: [
      { no: 1, title: 'Audio 1', audioUrl: '/files/abc', questions: [question(1), question(2)] },
      { no: 2, title: 'Audio 2', audioUrl: null, questions: [question(9)] },
      { no: 3, title: 'Audio 3', audioUrl: null, questions: [question(17)] },
      { no: 4, title: 'Audio 4', audioUrl: null, questions: [question(25)] },
    ],
  }

  it('parses a set and never carries answers or explanations', () => {
    expect(ok(AudioKbatPlaySetSchema, set)).toBe(true)
    expect(keysOf(set)).not.toContain('correctAnswer')
    for (const leak of ['correctAnswer', 'explanation', 'kbatLevel', 'dskpSpId']) {
      const leaked = { ...set, sections: [{ ...set.sections[0], questions: [{ ...question(1), [leak]: 'A' }] }, ...set.sections.slice(1)] }
      expect(ok(AudioKbatPlaySetSchema, leaked)).toBe(false)
    }
  })

  it('needs exactly 4 sections and valid question numbers', () => {
    expect(ok(AudioKbatPlaySetSchema, { ...set, sections: set.sections.slice(0, 3) })).toBe(false)
    expect(ok(AudioKbatPlaySetSchema, { ...set, sections: [{ ...set.sections[0], questions: [question(31)] }, ...set.sections.slice(1)] })).toBe(false)
  })

  it('attempt request: answers required, 1..30, no duplicate, A..D', () => {
    expect(ok(AudioKbatAttemptRequestSchema, { answers: [{ no: 1, choice: 'A' }, { no: 30, choice: 'D' }] })).toBe(true)
    expect(ok(AudioKbatAttemptRequestSchema, { answers: [] })).toBe(true)
    for (const bad of [
      {},
      { answers: 'A' },
      { answers: [{ no: 0, choice: 'A' }] },
      { answers: [{ no: 31, choice: 'A' }] },
      { answers: [{ no: 1, choice: 'E' }] },
      { answers: [{ no: 1, choice: 'a' }] },
      { answers: [{ no: 1.5, choice: 'A' }] },
      { answers: [{ no: 1, choice: 'A' }, { no: 1, choice: 'B' }] },
    ]) {
      expect(ok(AudioKbatAttemptRequestSchema, bad)).toBe(false)
    }
    // userId is never read from the body: it is stripped
    expect(AudioKbatAttemptRequestSchema.parse({ answers: [], userId: '99' })).toEqual({ answers: [] })
  })

  it('attempt result', () => {
    expect(ok(AudioKbatAttemptResultSchema, { score: 12, totalMarks: 30 })).toBe(true)
    expect(ok(AudioKbatAttemptResultSchema, { score: -1, totalMarks: 30 })).toBe(false)
  })
})

describe('audio KBAT admin', () => {
  const sections = Array.from({ length: AUDIO_SECTION_COUNT }, (_, i) => ({ title: `Audio ${String(i + 1)}` }))
  const questions = Array.from({ length: AUDIO_QUESTION_COUNT }, (_, i) => ({
    questionText: `Soalan ${String(i + 1)}`,
    optionA: 'a',
    optionB: 'b',
    optionC: 'c',
    optionD: 'd',
    correctAnswer: 'B',
  }))
  const create = { title: 'Set Contoh', educationLevelId: '3', subjectId: '5', sections, questions }

  it('create accepts exactly 4 sections and 30 questions, with optional audio files', () => {
    expect(ok(AdminAudioKbatCreateRequestSchema, create)).toBe(true)
    const audio = new File(['x'], 'bahagian1.mp3', { type: 'audio/mpeg' })
    const full = {
      ...create,
      status: 'draft',
      sourceLabel: 'Bank soalan',
      instructions: 'Dengar dengan teliti.',
      sections: [{ title: 'Audio 1', audio, transcript: 'Teks' }, ...sections.slice(1)],
      questions: [{ ...questions[0], marks: '2', kbatLevel: '4', dskpSpId: '77', explanation: 'Sebab' }, ...questions.slice(1)],
    }
    expect(ok(AdminAudioKbatCreateRequestSchema, full)).toBe(true)
  })

  it('create rejects the shape and field refusals the mock returns', () => {
    const noAudio = new File(['x'], 'nota.html', { type: 'audio/mpeg' })
    for (const bad of [
      { ...create, sections: sections.slice(0, 3) },
      { ...create, questions: questions.slice(0, 29) },
      { ...create, status: 'archived' },
      { ...create, title: '' },
      { ...create, educationLevelId: undefined },
      { ...create, sections: [{ audio: noAudio }, ...sections.slice(1)] },
      { ...create, sections: [{ audio: 'x.mp3' }, ...sections.slice(1)] },
      { ...create, questions: [{ ...questions[0], correctAnswer: 'E' }, ...questions.slice(1)] },
      { ...create, questions: [{ ...questions[0], optionA: '' }, ...questions.slice(1)] },
      { ...create, questions: [{ ...questions[0], marks: 21 }, ...questions.slice(1)] },
      { ...create, questions: [{ ...questions[0], kbatLevel: 6 }, ...questions.slice(1)] },
    ]) {
      expect(ok(AdminAudioKbatCreateRequestSchema, bad)).toBe(false)
    }
  })

  it('parses the list with meta.stats and the create response', () => {
    const item = { id: '14', title: 'Set Contoh', educationLevel: { id: '3', name: 'Darjah 3' }, subject: { id: '5', name: 'Sejarah' }, status: 'approved', statusLabel: 'Approved', questionCount: 30 }
    const meta = { page: 1, pageSize: 100, totalItems: 1, totalPages: 1, from: 1, to: 1, stats: { sets: 1, approved: 1, draftPending: 0, questions: 30 } }
    expect(ok(AdminAudioKbatListResponseSchema, { data: [item], meta })).toBe(true)
    expect(ok(AdminAudioKbatListResponseSchema, { data: [item], meta: { ...meta, stats: undefined } })).toBe(false)
    const created = {
      ...item,
      sourceLabel: null,
      instructions: null,
      createdAt: AT,
      sections: [
        { no: 1, title: 'Audio 1', audioFileName: 'bahagian1.mp3', transcript: null, questionFrom: 1, questionTo: 8 },
        { no: 2, title: 'Audio 2', audioFileName: null, transcript: null, questionFrom: 9, questionTo: 16 },
        { no: 3, title: 'Audio 3', audioFileName: null, transcript: null, questionFrom: 17, questionTo: 24 },
        { no: 4, title: 'Audio 4', audioFileName: null, transcript: null, questionFrom: 25, questionTo: 30 },
      ],
    }
    expect(ok(AdminAudioKbatCreatedSchema, created)).toBe(true)
    expect(ok(AdminAudioKbatCreatedSchema, { ...created, status: 'live' })).toBe(false)
  })
})

describe('screenshots and support config', () => {
  const png = (name = 'tangkap.png') => new File(['x'], name, { type: 'image/png' })

  it('upload: 1 to 20 images of an allowed type', () => {
    expect(ok(ScreenshotUploadRequestSchema, { files: [png()] })).toBe(true)
    expect(ok(ScreenshotUploadRequestSchema, { files: Array.from({ length: 20 }, () => png()) })).toBe(true)
    expect(ok(ScreenshotUploadRequestSchema, { files: [] })).toBe(false)
    expect(ok(ScreenshotUploadRequestSchema, { files: Array.from({ length: 21 }, () => png()) })).toBe(false)
    expect(ok(ScreenshotUploadRequestSchema, { files: [new File(['x'], 'a.exe', { type: 'application/octet-stream' })] })).toBe(false)
    // declared type and extension must agree
    expect(ok(ScreenshotUploadRequestSchema, { files: [new File(['x'], 'a.gif', { type: 'image/png' })] })).toBe(false)
    expect(ok(ScreenshotUploadRequestSchema, { files: [new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'b.png', { type: 'image/png' })] })).toBe(false)
  })

  it('upload result keeps the refusal reasons', () => {
    const saved = { id: '1', fileName: 'tangkap.png', originalName: 'Tangkap.png', size: 12, mimeType: 'image/png', uploadedById: '2', createdAt: AT, url: 'https://files.example.test/tangkap.png' }
    expect(ok(ScreenshotUploadResultSchema, { saved: [saved], rejected: [{ name: 'a.exe', reason: contentFileRefused('a.exe') }] })).toBe(true)
    expect(contentFileRefused('a.exe')).toBe('a.exe: format atau saiz tidak dibenarkan.')
    expect(ok(ScreenshotUploadResultSchema, { saved: [{ ...saved, size: -1 }], rejected: [] })).toBe(false)
  })

  it('support config', () => {
    expect(ok(ContentSupportConfigSchema, { email: 'bantuan@example.test', whatsappNumber: '60123456789' })).toBe(true)
    expect(ok(ContentSupportConfigSchema, { email: 'bantuan@example.test' })).toBe(false)
  })
})

describe('envelopes, messages and errors', () => {
  it('mutation envelope carries data and the BM flash text', () => {
    const schema = contentMutationOf(ContentDeletedSchema)
    expect(ok(schema, { data: { deleted: 1 }, status: CONTENT_FLASH.video.deleted })).toBe(true)
    expect(ok(schema, { data: { deleted: 1 } })).toBe(false)
    expect(ok(schema, { data: { deleted: 2 }, status: 'x' })).toBe(false)
  })

  it('keeps the exact BM copy of the mock', () => {
    expect(CONTENT_MESSAGES.fieldRequired).toBe('Medan ini diperlukan.')
    expect(CONTENT_MESSAGES.fieldInvalid).toBe('Medan ini tidak sah.')
    expect(CONTENT_MESSAGES.articleNotFound).toBe('Artikel tidak dijumpai.')
    expect(CONTENT_MESSAGES.perutusanPinLimit).toBe('Maksimum 2 perutusan boleh disematkan.')
    expect(CONTENT_FLASH.screenshots(3)).toBe('3 fail berjaya dimuat naik.')
    expect(CONTENT_FLASH.perutusan.scheduled).toBe('Perutusan dijadualkan.')
  })

  it('error bodies carry field messages', () => {
    const body = { error: { code: 'VALIDATION_ERROR', message: 'Medan ini diperlukan.', fields: { title: 'Medan ini diperlukan.' } } }
    expect(ok(ErrorBodySchema, body)).toBe(true)
  })
})

describe('openapi registration', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { requestBody?: { content: Record<string, unknown> } }>>
    components: { schemas: Record<string, unknown> }
  }

  const ROUTES: readonly [string, string][] = [
    ['get', '/articles'], ['get', '/articles/hot'], ['get', '/articles/latest'], ['get', '/articles/{slug}'],
    ['get', '/banners/active'], ['get', '/config/support'],
    ['get', '/videos'], ['get', '/videos/{id}'], ['get', '/videos/form-context'], ['post', '/videos'], ['put', '/videos/{id}'], ['delete', '/videos/{id}'],
    ['get', '/perutusan'], ['get', '/perutusan/{id}'], ['get', '/perutusan/mine'], ['get', '/perutusan/compose-context'],
    ['post', '/perutusan'], ['post', '/perutusan/{id}/comments'], ['post', '/perutusan/{id}/reactions'], ['get', '/public/perutusan/{id}'],
    ['get', '/audio-kbat-sets'], ['get', '/audio-kbat-sets/{id}'], ['post', '/audio-kbat-sets/{id}/attempts'],
    ['get', '/admin/articles'], ['get', '/admin/articles/{id}'], ['post', '/admin/articles'], ['put', '/admin/articles/{id}'], ['delete', '/admin/articles/{id}'],
    ['get', '/admin/banners'], ['get', '/admin/banners/{id}'], ['post', '/admin/banners'], ['put', '/admin/banners/{id}'], ['delete', '/admin/banners/{id}'],
    ['get', '/admin/notes'], ['get', '/admin/notes/{id}'], ['post', '/admin/notes'], ['put', '/admin/notes/{id}'], ['delete', '/admin/notes/{id}'],
    ['get', '/admin/screenshots'], ['post', '/admin/screenshots'],
    ['get', '/admin/audio-kbat-sets'], ['get', '/admin/audio-kbat-sets/template'], ['post', '/admin/audio-kbat-sets'],
  ]

  it('registers the 43 M09 routes', () => {
    expect(ROUTES).toHaveLength(43)
    for (const [method, path] of ROUTES) expect(doc.paths[path], `${method} ${path}`).toHaveProperty(method)
  })

  it('contains every content component, with unique ids', () => {
    const ids = Object.keys(CONTENT_COMPONENT_SCHEMAS)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(doc.components.schemas).toHaveProperty(id)
    for (const id of ids) expect(id).toMatch(/^(Content|Article|AdminArticle|Banner|AdminBanner|Note|AdminNote|Video|Perutusan|Audio|AdminAudio|Screenshot)/)
  })

  it('describes the multipart routes as multipart/form-data', () => {
    for (const path of ['/perutusan', '/admin/screenshots', '/admin/audio-kbat-sets']) {
      expect(Object.keys(doc.paths[path]?.post?.requestBody?.content ?? {})).toEqual(['multipart/form-data'])
    }
  })
})
