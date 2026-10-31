/**
 * The `articles` repository (owner M09; SRS M09 v1.2 §6.1, §6.11, BR-M09-02…08, BR-M09-34).
 *
 * Reader queries (S15/S16, M05 dashboard): `latest`, `readerList`, `hot`, `related`, `detail`.
 * Admin queries (S1): `adminList`, `adminGet`. Teacher-form writes for M10 (XL2-19): `listByAuthor`,
 * `statsByAuthor`, `getOwn`, `createFromTeacher`, `updateFromTeacher`, `deleteAttachment`.
 * Read-only for M24: `get`. Every count is a named query (`count('Q-ART-…')`).
 */

import { defineNamedQueries } from '@/mock/dataset'
import type { Prng } from '@/mock/determinism/prng'
import { defineRepository } from '@/mock/repository'
import { users } from '@/modules/m01-authentication/mock'

import { CATEGORY_LABELS, GRADE_LABELS, slugify } from '../data/labels'
import { articleAttachmentsTable, articlesTable } from '../tables/tables'
import type {
  AdminArticleItem,
  ArticleAttachmentRow,
  ArticleCard,
  ArticleCategory,
  ArticleDetail,
  ArticleRow,
  GradeLevel,
  HotCard,
} from '../types'
import { visibleGradeLevels } from '../types'
import { authorRef, M09Error, nowIso, norm } from './common'

export const READER_PAGE_SIZE = 18
export const ADMIN_PAGE_SIZE = 20
export const LATEST_LIMIT = 5
export const RELATED_LIMIT = 3
export const HOT_COUNT = 6
export const HOT_POPULAR_POOL = 10
export const MAX_ATTACHMENTS = 5
export const MAX_ATTACHMENT_BYTES = 20_971_520
export const MAX_IMAGE_BYTES = 2_097_152
const ATTACHMENT_EXT = /\.(pdf|docx?|xlsx?|pptx?)$/i
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp']

const READER_SORT = [
  { field: 'publishedAt', dir: 'desc' },
  { field: 'id', dir: 'asc' },
] as const
const ADMIN_SORT = [
  { field: 'createdAt', dir: 'desc' },
  { field: 'id', dir: 'asc' },
] as const

/** Named count queries (M09 §6.11 Q-ART-*); `expected` = the documented live figures. */
export const articleQueries = defineNamedQueries(articlesTable, {
  'Q-ART-ALL': { where: {}, expected: 72, source: 'M09 §6.11' },
  'Q-ART-PUBLISHED': { where: { isPublished: true }, expected: 72, source: 'M09 §6.11' },
  'Q-ART-FEATURED': { where: { isFeatured: true }, expected: 13, source: 'M09 §6.11' },
  'Q-ART-CATEGORY': {
    where: (category: ArticleCategory) => ({ category, isPublished: true }),
    expected: [
      { args: ['TIPS_BELAJAR'], value: 21 },
      { args: ['MOTIVASI'], value: 14 },
      { args: ['PANDUAN_IBU_BAPA'], value: 10 },
      { args: ['PANDUAN_GURU'], value: 6 },
      { args: ['KEJAYAAN'], value: 7 },
      { args: ['BERITA'], value: 7 },
      { args: ['UMUM'], value: 7 },
    ],
    source: 'M09 §6.11',
  },
  'Q-ART-GRADE': {
    where: (gradeLevel: GradeLevel) => ({ gradeLevel }),
    expected: [
      { args: ['SEMUA'], value: 30 },
      { args: ['DARJAH_1'], value: 4 },
      { args: ['DARJAH_2'], value: 5 },
      { args: ['DARJAH_3'], value: 7 },
      { args: ['DARJAH_4'], value: 10 },
      { args: ['DARJAH_5'], value: 9 },
      { args: ['DARJAH_6'], value: 7 },
    ],
    source: 'M09 §6.11',
  },
})

export interface ArticleFilter {
  search?: string
  category?: ArticleCategory | 'all' | ''
  page?: number
  pageSize?: number
}

export interface AdminArticleFilter extends ArticleFilter {
  /** `''`/undefined = all, `true` = Diterbitkan, `false` = Draf. */
  published?: boolean | ''
}

export interface FileInput {
  name: string
  size: number
  mime: string
}

/** The M10 teacher article form (M09 §6.11 `createFromTeacher`). */
export interface TeacherArticleInput {
  title: string
  content: string
  youtubeUrl?: string | null
  category: ArticleCategory
  gradeLevel: GradeLevel
  excerpt?: string | null
  featuredImageFile?: FileInput | null
  attachments?: { file: FileInput; label?: string | null }[]
}

/** The admin form S2/S3 fields. */
export interface AdminArticleInput {
  title: string
  excerpt?: string | null
  content: string
  featuredImage?: string | null
  category: ArticleCategory
  gradeLevel: GradeLevel
  isPublished: boolean
  isFeatured: boolean
}

const card = (a: ArticleRow): ArticleCard => ({
  id: a.id,
  slug: a.slug,
  title: a.title,
  excerpt: a.excerpt,
  category: a.category,
  categoryLabel: CATEGORY_LABELS[a.category],
  isFeatured: a.isFeatured,
  views: a.views,
  publishedAt: a.publishedAt,
  author: authorRef(a.authorId),
})

const adminItem = (a: ArticleRow): AdminArticleItem => ({
  id: a.id,
  title: a.title,
  category: a.category,
  categoryLabel: CATEGORY_LABELS[a.category],
  gradeLevel: a.gradeLevel,
  isPublished: a.isPublished,
  isFeatured: a.isFeatured,
  views: a.views,
  createdAt: a.createdAt,
  author: { id: a.authorId, name: authorRef(a.authorId).name },
})

const sanitiseName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')

const invalid = (message: string): never => {
  throw new M09Error('VALIDATION_ERROR', message)
}

function checkAttachment(file: FileInput): void {
  if (!ATTACHMENT_EXT.test(file.name)) {
    invalid(`Lampiran "${file.name}" mesti PDF, Word, Excel atau PowerPoint.`)
  }
  if (file.size > MAX_ATTACHMENT_BYTES) invalid(`Lampiran "${file.name}" melebihi 20 MB.`)
}

function checkImage(file: FileInput): void {
  if (!IMAGE_MIME.includes(file.mime)) invalid('Gambar utama mesti JPEG, PNG atau WebP.')
  if (file.size > MAX_IMAGE_BYTES) invalid('Gambar utama melebihi 2 MB.')
}

export const articlesRepo = defineRepository({
  owner: 'M09',
  name: 'articles',
  store: articlesTable,
  stores: { attachments: articleAttachmentsTable },
  queries: articleQueries,
  methods: ({ store, stores, transaction }) => {
    /** Hidden Darjah-tagged articles are never read (D72): every list read adds this `gradeLevel` set. */
    const shownGrade = () => ({ gradeLevel: [...visibleGradeLevels()] })

    const readerWhere = (category?: string) => ({
      isPublished: true,
      ...shownGrade(),
      ...(category && category !== 'all' ? { category: category as ArticleCategory } : {}),
    })

    const uniqueSlug = (title: string): string => {
      const base = slugify(title) || 'artikel'
      let slug = base
      for (let n = 2; store.query({ where: { slug } }).total > 0; n++) slug = `${base}-${String(n)}`
      return slug
    }

    const requireArticle = (id: number): ArticleRow => {
      const row = store.get(id)
      if (!row) throw new M09Error('NOT_FOUND', `Artikel ${String(id)} tidak dijumpai.`)
      return row
    }

    const isAdmin = (userId: number): boolean => users.get(userId)?.role === 'admin'

    const requireOwn = (id: number, userId: number): ArticleRow => {
      const row = requireArticle(id)
      if (row.authorId !== userId && !isAdmin(userId)) {
        throw new M09Error('FORBIDDEN', 'Anda tidak dibenarkan mengubah artikel ini.')
      }
      return row
    }

    const attachmentsOf = (articleId: number): ArticleAttachmentRow[] =>
      stores.attachments.query({ where: { articleId } }).rows

    const addAttachments = (
      articleId: number,
      list: { file: FileInput; label?: string | null }[],
    ): void => {
      for (const { file, label } of list) {
        stores.attachments.insert({
          articleId,
          fileName: file.name,
          label: label?.trim() ? label.trim() : null,
          mime: file.mime,
          size: file.size,
          storedPath: `/storage/article-attachments/${String(articleId)}/${sanitiseName(file.name)}`,
          createdAt: nowIso(),
        })
      }
    }

    const readerRelated = (a: ArticleRow, limit: number): ArticleCard[] =>
      store
        .query({
          where: { ...readerWhere(a.category), id: { ne: a.id } },
          sort: READER_SORT,
          page: 1,
          pageSize: limit,
        })
        .rows.map(card)

    return {
      /** Seed phase: literal rows (ids kept). */
      seed(rows: readonly ArticleRow[]): void {
        transaction(() => {
          for (const row of rows) store.insert({ ...row })
        })
      },

      /** M24 / internal: any article by id (no visibility filter). */
      get(id: number): ArticleRow | undefined {
        return store.get(id)
      },

      /** BR-M09-06: the 5 newest published articles (M05 dashboard strip and aside, S16 aside). */
      latest(limit: number = LATEST_LIMIT): ArticleCard[] {
        return store
          .query({
            where: { isPublished: true, ...shownGrade() },
            sort: READER_SORT,
            page: 1,
            pageSize: limit,
          })
          .rows.map(card)
      },

      /** S15 list: published only, title substring, category, 18 per page. */
      readerList(filter: ArticleFilter = {}): { rows: ArticleCard[]; total: number } {
        const term = norm(filter.search ?? '')
        const res = store.query({
          where: readerWhere(filter.category),
          ...(term === ''
            ? {}
            : { match: (a: ArticleRow) => a.title.toLowerCase().includes(term) }),
          sort: READER_SORT,
          page: filter.page ?? 1,
          pageSize: filter.pageSize ?? READER_PAGE_SIZE,
        })
        return { rows: res.rows.map(card), total: res.total }
      },

      /** BR-M09-05: 6 random cards from featured ∪ top-10 non-featured by views, in draw order. */
      hot(rng: Prng): HotCard[] {
        const featured = store.query({
          where: { isPublished: true, isFeatured: true, ...shownGrade() },
          sort: READER_SORT,
        }).rows
        const popular = store.query({
          where: { isPublished: true, isFeatured: false, ...shownGrade() },
          sort: [
            { field: 'views', dir: 'desc' },
            { field: 'id', dir: 'asc' },
          ],
          page: 1,
          pageSize: HOT_POPULAR_POOL,
        }).rows
        const pool = [...featured, ...popular]
        const drawn: ArticleRow[] = []
        while (drawn.length < HOT_COUNT && pool.length > 0) {
          const i = Math.floor(rng.next() * pool.length)
          drawn.push(pool.splice(i, 1)[0] as ArticleRow)
        }
        return drawn.map((a) => ({ ...card(a), badge: a.isFeatured ? 'PILIHAN' : 'POPULAR' }))
      },

      /** BR-M09-06: up to 3 other published articles of the category, reader order. */
      related(id: number, limit: number = RELATED_LIMIT): ArticleCard[] {
        const a = store.get(id)
        return a ? readerRelated(a, limit) : []
      },

      /**
       * S16 detail by slug: a published article only; `countView` increments `views` before the
       * response (BR-M09-07: the shown value includes the open).
       */
      detail(slug: string, options: { countView?: boolean } = {}): ArticleDetail | undefined {
        const found = store.query({ where: { slug } }).rows[0]
        if (!found?.isPublished || !visibleGradeLevels().includes(found.gradeLevel)) return undefined
        const a = options.countView ? store.update(found.id, { views: found.views + 1 }) : found
        return {
          ...card(a),
          content: a.content,
          gradeLevel: a.gradeLevel,
          gradeLabel: GRADE_LABELS[a.gradeLevel],
          likes: a.likes,
          related: readerRelated(a, RELATED_LIMIT),
        }
      },

      /** S1 list: everything, `createdAt` desc then id asc, 20 per page. */
      adminList(filter: AdminArticleFilter = {}): { rows: AdminArticleItem[]; total: number } {
        const term = norm(filter.search ?? '')
        const res = store.query({
          where: {
            ...shownGrade(),
            ...(filter.category && filter.category !== 'all' ? { category: filter.category } : {}),
            ...(filter.published === '' || filter.published === undefined
              ? {}
              : { isPublished: filter.published }),
          },
          ...(term === ''
            ? {}
            : { match: (a: ArticleRow) => a.title.toLowerCase().includes(term) }),
          sort: ADMIN_SORT,
          page: filter.page ?? 1,
          pageSize: filter.pageSize ?? ADMIN_PAGE_SIZE,
        })
        return { rows: res.rows.map(adminItem), total: res.total }
      },

      /** S3/S4: the full row and its attachments. */
      adminGet(id: number): (ArticleRow & { attachments: ArticleAttachmentRow[] }) | undefined {
        const row = store.get(id)
        return row && visibleGradeLevels().includes(row.gradeLevel)
          ? { ...row, attachments: attachmentsOf(id) }
          : undefined
      },

      /** The admin by-id reads and writes: a hidden Darjah article answers "not found" (D72). */
      getVisible(id: number): ArticleRow | undefined {
        const row = store.get(id)
        return row && visibleGradeLevels().includes(row.gradeLevel) ? row : undefined
      },

      /** S2 create (admin): slug BR-M09-08; `publishedAt` set when created published. */
      create(authorId: number, input: AdminArticleInput): ArticleRow {
        return transaction(() => {
          const now = nowIso()
          return store.insert({
            title: input.title,
            slug: uniqueSlug(input.title),
            excerpt: input.excerpt ?? null,
            content: input.content,
            featuredImage: input.featuredImage ?? null,
            youtubeUrl: null,
            category: input.category,
            gradeLevel: input.gradeLevel,
            isPublished: input.isPublished,
            isFeatured: input.isFeatured,
            views: 0,
            likes: 0,
            authorId,
            publishedAt: input.isPublished ? now : null,
            createdAt: now,
            updatedAt: now,
          })
        })
      },

      /** S3 update (admin): slugs never change; `publishedAt` is set on first publish. */
      update(id: number, input: AdminArticleInput): ArticleRow {
        return transaction(() => {
          const row = requireArticle(id)
          const now = nowIso()
          return store.update(id, {
            title: input.title,
            excerpt: input.excerpt ?? null,
            content: input.content,
            featuredImage: input.featuredImage ?? null,
            category: input.category,
            gradeLevel: input.gradeLevel,
            isPublished: input.isPublished,
            isFeatured: input.isFeatured,
            publishedAt: input.isPublished ? (row.publishedAt ?? now) : row.publishedAt,
            updatedAt: now,
          })
        })
      },

      /** S1 delete: the article and its attachments. */
      remove(id: number): void {
        transaction(() => {
          requireArticle(id)
          for (const att of attachmentsOf(id)) stores.attachments.remove(att.id)
          store.remove(id)
        })
      },

      // --- M10 teacher form (endpoints #66–#70, XL2-19) -----------------------------------------

      /** S29 list: the teacher's own articles, newest first. */
      listByAuthor(
        userId: number,
        page = 1,
        pageSize = 10,
      ): { rows: AdminArticleItem[]; total: number } {
        const res = store.query({
          where: { authorId: userId, ...shownGrade() },
          sort: ADMIN_SORT,
          page,
          pageSize,
        })
        return { rows: res.rows.map(adminItem), total: res.total }
      },

      /** S29 stats: total, published, pending (unpublished), Σ views. */
      statsByAuthor(userId: number): {
        total: number
        published: number
        pending: number
        views: number
      } {
        const mine = store.query({ where: { authorId: userId, ...shownGrade() } }).rows
        const published = mine.filter((a) => a.isPublished).length
        return {
          total: mine.length,
          published,
          pending: mine.length - published,
          views: mine.reduce((sum, a) => sum + a.views, 0),
        }
      },

      /** The teacher's own article with its attachments (the author or the admin only). */
      getOwn(
        id: number,
        userId: number,
      ): (ArticleRow & { attachments: ArticleAttachmentRow[] }) | undefined {
        const row = store.get(id)
        if (!row || (row.authorId !== userId && !isAdmin(userId))) return undefined
        return { ...row, attachments: attachmentsOf(id) }
      },

      /** `isPublished = false` (BR-M09-34); attachments ≤ 5, each ≤ 20 MB and of an allowed type. */
      createFromTeacher(userId: number, input: TeacherArticleInput): ArticleRow {
        const list = input.attachments ?? []
        if (list.length > MAX_ATTACHMENTS) invalid('Maksimum 5 lampiran.')
        for (const a of list) checkAttachment(a.file)
        if (input.featuredImageFile) checkImage(input.featuredImageFile)
        return transaction(() => {
          const now = nowIso()
          const row = store.insert({
            title: input.title,
            slug: uniqueSlug(input.title),
            excerpt: input.excerpt ?? null,
            content: input.content,
            featuredImage: input.featuredImageFile
              ? `/storage/articles/${sanitiseName(input.featuredImageFile.name)}`
              : null,
            youtubeUrl: input.youtubeUrl ?? null,
            category: input.category,
            gradeLevel: input.gradeLevel,
            isPublished: false,
            isFeatured: false,
            views: 0,
            likes: 0,
            authorId: userId,
            publishedAt: null,
            createdAt: now,
            updatedAt: now,
          })
          addAttachments(row.id, list)
          return row
        })
      },

      /** Keeps `isPublished`, the slug and the existing attachments; adds the new ones (≤ 5 in all). */
      updateFromTeacher(id: number, userId: number, input: TeacherArticleInput): ArticleRow {
        const row = requireOwn(id, userId)
        const list = input.attachments ?? []
        if (attachmentsOf(id).length + list.length > MAX_ATTACHMENTS)
          invalid('Maksimum 5 lampiran.')
        for (const a of list) checkAttachment(a.file)
        if (input.featuredImageFile) checkImage(input.featuredImageFile)
        return transaction(() => {
          const next = store.update(id, {
            title: input.title,
            excerpt: input.excerpt ?? null,
            content: input.content,
            youtubeUrl: input.youtubeUrl ?? null,
            category: input.category,
            gradeLevel: input.gradeLevel,
            featuredImage: input.featuredImageFile
              ? `/storage/articles/${sanitiseName(input.featuredImageFile.name)}`
              : row.featuredImage,
            updatedAt: nowIso(),
          })
          addAttachments(id, list)
          return next
        })
      },

      /** Only the author (or the admin) may delete an attachment. */
      deleteAttachment(attachmentId: number, userId: number): void {
        transaction(() => {
          const att = stores.attachments.get(attachmentId)
          if (!att) throw new M09Error('NOT_FOUND', 'Lampiran tidak dijumpai.')
          requireOwn(att.articleId, userId)
          stores.attachments.remove(attachmentId)
        })
      },

      /** The attachments of an article (read-only view for the form). */
      attachments(articleId: number): ArticleAttachmentRow[] {
        return attachmentsOf(articleId)
      },
    }
  },
})
