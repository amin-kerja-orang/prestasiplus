import { randomInt } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  ARTICLE_ADMIN_PAGE_SIZE,
  ARTICLE_CATEGORIES,
  ARTICLE_CATEGORY_LABELS,
  ARTICLE_GRADE_LABELS,
  ARTICLE_LATEST_DEFAULT,
  ARTICLE_LATEST_MAX,
  ARTICLE_READER_PAGE_SIZE,
  CONTENT_FLASH,
  CONTENT_MESSAGES,
  AdminArticleUpdateRequestSchema,
  type AdminArticleCreateRequestSchema,
} from '@pp/contract'
import type { z } from 'zod'

import type { Env } from '../../../common/config/env.schema'
import type { Prisma } from '../../../db/generated/client'
import { AuditService } from '../../../common/audit/audit.service'
import { listMeta } from '../../../common/http/respond'
import { toMytTimestamp } from '../../../common/time/myt'
import { CLOCK, type Clock } from '../../../db/clock'
import { idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { cmsImageFileId } from '../shared/cms-image'
import {
  type Actor,
  allowedOrigins,
  auditBase,
  fileUrlOf,
  idOrNotFound,
  initialOf,
  isUniqueViolation,
  notFound,
  pageOf,
  searchOf,
  unpagedMeta,
  writeTx,
} from '../shared/content-support'
import { HTML_SANITIZER, type HtmlSanitizer } from '../shared/html-sanitizer'
import { ArticlesRepository, type ArticleCardRow, type ArticleFullRow, type ArticleWrite } from './articles.repository'

export const ARTICLE_AUDIT = { CREATED: 'content.article.created', UPDATED: 'content.article.updated', DELETED: 'content.article.deleted' } as const

type CreateBody = z.infer<typeof AdminArticleCreateRequestSchema>
type UpdateBody = z.infer<typeof AdminArticleUpdateRequestSchema>

const HOT_COUNT = 6
const HOT_POPULAR_POOL = 10
const HOT_FEATURED_CAP = 200
const RELATED_LIMIT = 3
const SLUG_ATTEMPTS = 5
const ARTICLE_NOT_FOUND = CONTENT_MESSAGES.articleNotFound

/** `Str::slug` as the mock does it: accents folded, everything else non-alphanumeric becomes one hyphen. */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** The first free slug among `base`, `base-2`, `base-3`, ... */
/** Slugs that would collide with a static sibling route (`/articles/hot`, `/articles/latest`). */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set(['hot', 'latest'])

export function freeSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base) && !RESERVED_SLUGS.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${String(n)}`)) return `${base}-${String(n)}`
}

const categoryLabel = (c: string): string => (ARTICLE_CATEGORY_LABELS as Record<string, string>)[c] ?? c
const gradeLabel = (g: string): string => (ARTICLE_GRADE_LABELS as Record<string, string>)[g] ?? g

function cardOf(a: ArticleCardRow) {
  return {
    id: idToString(a.id),
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    category: a.category,
    categoryLabel: categoryLabel(a.category),
    isFeatured: a.isFeatured,
    views: a.views,
    publishedAt: a.publishedAt ? toMytTimestamp(a.publishedAt) : null,
    author: { name: a.author.name, initial: initialOf(a.author.name) },
  }
}

function adminItemOf(a: ArticleCardRow) {
  return {
    id: idToString(a.id),
    title: a.title,
    category: a.category,
    categoryLabel: categoryLabel(a.category),
    gradeLevel: a.gradeLevel,
    isPublished: a.isPublished,
    isFeatured: a.isFeatured,
    views: a.views,
    createdAt: toMytTimestamp(a.createdAt),
    author: { id: idToString(a.author.id), name: a.author.name },
  }
}

function detailOf(a: ArticleFullRow) {
  return {
    id: idToString(a.id),
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    content: a.content,
    featuredImage: a.featuredImage ? fileUrlOf(a.featuredImage.publicId) : null,
    youtubeUrl: a.youtubeUrl,
    category: a.category,
    gradeLevel: a.gradeLevel,
    isPublished: a.isPublished,
    isFeatured: a.isFeatured,
    views: a.views,
    likes: a.likes,
    authorId: idToString(a.authorId),
    publishedAt: a.publishedAt ? toMytTimestamp(a.publishedAt) : null,
    createdAt: toMytTimestamp(a.createdAt),
    updatedAt: toMytTimestamp(a.updatedAt),
    categoryLabel: categoryLabel(a.category),
    gradeLabel: gradeLabel(a.gradeLevel),
    author: { id: idToString(a.author.id), name: a.author.name },
    attachments: a.attachments.map((x) => ({
      id: idToString(x.id),
      // The file name is not stored (files keep no client name): the label, else a neutral name from the type.
      fileName: x.label ?? `lampiran-${idToString(x.id)}.${x.file.mime === 'application/pdf' ? 'pdf' : x.file.mime.split('/')[1] ?? 'bin'}`,
      label: x.label,
      size: Number(x.file.sizeBytes),
    })),
  }
}

/** A category filter: `''`/`all` is no filter; a known code filters; an unknown code matches nothing. */
function categoryFilter(raw: string | undefined): { category: string | null; none: boolean } {
  const c = raw?.trim() ?? ''
  if (c === '' || c === 'all') return { category: null, none: false }
  return (ARTICLE_CATEGORIES as readonly string[]).includes(c) ? { category: c, none: false } : { category: null, none: true }
}

@Injectable()
export class ArticlesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ArticlesRepository) private readonly repo: ArticlesRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(HTML_SANITIZER) private readonly sanitizer: HtmlSanitizer,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  // --- reader (public) ------------------------------------------------------------------------------

  async readerList(q: { search?: string | undefined; category?: string | undefined; page?: string | undefined }) {
    const page = pageOf(q.page)
    const { category, none } = categoryFilter(q.category)
    if (none) return { data: [], meta: listMeta(page, ARTICLE_READER_PAGE_SIZE, 0) }
    const { rows, total } = await this.repo.readerList({
      search: searchOf(q.search),
      category,
      skip: (page - 1) * ARTICLE_READER_PAGE_SIZE,
      take: ARTICLE_READER_PAGE_SIZE,
    })
    return { data: rows.map(cardOf), meta: listMeta(page, ARTICLE_READER_PAGE_SIZE, total) }
  }

  /** `limit` defaults to 5 and is clamped to 1..50; a non-number is the default. */
  async latest(rawLimit: string | undefined) {
    const n = rawLimit !== undefined && /^-?\d+$/.test(rawLimit.trim()) ? Number(rawLimit.trim()) : ARTICLE_LATEST_DEFAULT
    const limit = Math.min(Math.max(n, 1), ARTICLE_LATEST_MAX)
    const rows = await this.repo.latest(limit)
    return { data: rows.map(cardOf), meta: unpagedMeta(rows.length) }
  }

  /** 6 cards drawn at random from the featured ones plus the 10 most viewed others (BR-M09-05). */
  async hot() {
    const [featured, popular] = await Promise.all([this.repo.featuredPublished(HOT_FEATURED_CAP), this.repo.popularPublished(HOT_POPULAR_POOL)])
    const pool = [...featured, ...popular]
    const drawn: ArticleCardRow[] = []
    while (drawn.length < HOT_COUNT && pool.length > 0) drawn.push(pool.splice(randomInt(pool.length), 1)[0] as ArticleCardRow)
    const data = drawn.map((a) => ({ ...cardOf(a), badge: a.isFeatured ? ('PILIHAN' as const) : ('POPULAR' as const) }))
    return { data, meta: unpagedMeta(data.length) }
  }

  /** An unpublished or unknown slug is 404; every read adds one view and the returned count includes it. */
  async detail(slug: string) {
    const found = await this.repo.publishedBySlug(slug)
    if (!found) throw notFound()
    // One atomic statement: null means the article was unpublished or deleted since the read above.
    const views = await this.repo.countView(found.id)
    if (views === null) throw notFound()
    const related = await this.repo.related(found.id, found.category, RELATED_LIMIT)
    return {
      ...cardOf({ ...found, views }),
      content: found.content,
      gradeLevel: found.gradeLevel,
      gradeLabel: gradeLabel(found.gradeLevel),
      likes: found.likes,
      related: related.map(cardOf),
    }
  }

  // --- admin ----------------------------------------------------------------------------------------

  async adminList(q: { search?: string | undefined; category?: string | undefined; published?: string | undefined; page?: string | undefined }) {
    const page = pageOf(q.page)
    const { category, none } = categoryFilter(q.category)
    if (none) return { data: [], meta: listMeta(page, ARTICLE_ADMIN_PAGE_SIZE, 0) }
    const published = q.published?.trim() === '1' ? true : q.published?.trim() === '0' ? false : null
    const { rows, total } = await this.repo.adminList({
      search: searchOf(q.search),
      category,
      published,
      skip: (page - 1) * ARTICLE_ADMIN_PAGE_SIZE,
      take: ARTICLE_ADMIN_PAGE_SIZE,
    })
    return { data: rows.map(adminItemOf), meta: listMeta(page, ARTICLE_ADMIN_PAGE_SIZE, total) }
  }

  async adminGet(rawId: string) {
    const row = await this.repo.adminGet(idOrNotFound(rawId, ARTICLE_NOT_FOUND))
    if (!row) throw notFound(ARTICLE_NOT_FOUND)
    return detailOf(row)
  }

  private origins(who: Actor): string[] {
    return allowedOrigins(who.origin, this.config.get('PUBLIC_ORIGINS', { infer: true }))
  }

  /** Reads the detail inside the write transaction, so the answer cannot fail after the commit (a retry would duplicate). */
  private async detailIn(id: string) {
    const row = await this.repo.adminGet(id)
    if (!row) throw notFound(ARTICLE_NOT_FOUND)
    return detailOf(row)
  }

  async create(who: Actor, body: CreateBody) {
    const imageId = body.featuredImage ? await cmsImageFileId(this.prisma, body.featuredImage, this.origins(who), 'featuredImage', CONTENT_MESSAGES.fieldInvalid) : null
    const isPublished = body.isPublished ?? false
    const data: ArticleWrite = {
      title: body.title,
      excerpt: body.excerpt || null,
      content: this.sanitizer.sanitize(body.content),
      featuredImageFileId: imageId,
      category: body.category,
      gradeLevel: body.gradeLevel ?? 'SEMUA',
      isPublished,
      isFeatured: body.isFeatured ?? false,
      publishedAt: isPublished ? this.clock.now() : null,
    }
    const base = slugify(body.title) || 'artikel'
    for (let attempt = 1; ; attempt++) {
      try {
        const detail = await writeTx(this.prisma, async (tx) => {
          // One creation per base at a time, so concurrent creations of one title take the next free slugs.
          await this.prisma.client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`article-slug:${base}`}))`
          const slug = freeSlug(base, await this.repo.slugsLike(base))
          const created = await this.repo.create(who.userId, slug, data)
          await this.audit.record({ tx, ...auditBase(who, ARTICLE_AUDIT.CREATED), targetType: 'article', targetId: idToString(created), details: { slug, isPublished } })
          return this.detailIn(idToString(created))
        })
        return { data: detail, status: CONTENT_FLASH.article.created }
      } catch (err) {
        // Backstop: a unique violation (a slug taken outside the lock) takes the next free one.
        if (!isUniqueViolation(err) || attempt >= SLUG_ATTEMPTS) throw err
      }
    }
  }

  /** Absent fields keep their value (only the sent fields are written); a sent `null` clears excerpt and image; the slug never changes. */
  async update(who: Actor, rawId: string, rawBody: unknown) {
    const id = idOrNotFound(rawId, ARTICLE_NOT_FOUND)
    const current = await this.repo.adminGet(id)
    // An unknown id is 404 before the body is judged (as the mock does).
    if (!current) throw notFound(ARTICLE_NOT_FOUND)
    const body: UpdateBody = new ZodValidationPipe(AdminArticleUpdateRequestSchema).transform(rawBody ?? {})
    const patch: Prisma.ArticleUncheckedUpdateManyInput = {}
    if (body.title !== undefined) patch.title = body.title
    if ('excerpt' in body) patch.excerpt = body.excerpt || null
    if (body.content !== undefined) patch.content = this.sanitizer.sanitize(body.content)
    if ('featuredImage' in body) {
      patch.featuredImageFileId = body.featuredImage ? await cmsImageFileId(this.prisma, body.featuredImage, this.origins(who), 'featuredImage', CONTENT_MESSAGES.fieldInvalid) : null
    }
    if (body.category !== undefined) patch.category = body.category
    if ('gradeLevel' in body) patch.gradeLevel = body.gradeLevel ?? 'SEMUA'
    if (body.isFeatured !== undefined) patch.isFeatured = body.isFeatured
    if (body.isPublished !== undefined) {
      patch.isPublished = body.isPublished
      // Set at the first publish only; kept after an unpublish.
      if (body.isPublished && current.publishedAt === null) patch.publishedAt = this.clock.now()
    }
    const detail = await writeTx(this.prisma, async (tx) => {
      if (!(await this.repo.update(id, { ...patch, updatedAt: this.clock.now() }))) throw notFound(ARTICLE_NOT_FOUND)
      await this.audit.record({ tx, ...auditBase(who, ARTICLE_AUDIT.UPDATED), targetType: 'article', targetId: id, details: { fields: Object.keys(patch) } })
      return this.detailIn(id)
    })
    return { data: detail, status: CONTENT_FLASH.article.updated }
  }

  async remove(who: Actor, rawId: string) {
    const id = idOrNotFound(rawId, ARTICLE_NOT_FOUND)
    await writeTx(this.prisma, async (tx) => {
      if (!(await this.repo.remove(id))) throw notFound(ARTICLE_NOT_FOUND)
      await this.audit.record({ tx, ...auditBase(who, ARTICLE_AUDIT.DELETED), targetType: 'article', targetId: id })
    })
    return { data: { deleted: 1 as const }, status: CONTENT_FLASH.article.deleted }
  }
}
