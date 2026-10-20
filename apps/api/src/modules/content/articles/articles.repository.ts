import { Inject, Injectable } from '@nestjs/common'

import type { Prisma } from '../../../db/generated/client'
import { idFromString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'

const authorSelect = { select: { id: true, name: true } } as const

const cardInclude = { author: authorSelect } satisfies Prisma.ArticleInclude
/** List rows never carry the body. */
const CARD_OMIT = { content: true } as const
export type ArticleCardRow = Prisma.ArticleGetPayload<{ include: typeof cardInclude; omit: typeof CARD_OMIT }>
export type ArticleBodyRow = Prisma.ArticleGetPayload<{ include: typeof cardInclude }>

const detailInclude = {
  author: authorSelect,
  featuredImage: { select: { publicId: true } },
  attachments: { orderBy: { id: 'asc' }, include: { file: { select: { publicId: true, sizeBytes: true, mime: true } } } },
} satisfies Prisma.ArticleInclude
export type ArticleFullRow = Prisma.ArticleGetPayload<{ include: typeof detailInclude }>

export interface ArticleWrite {
  title: string
  excerpt: string | null
  content: string
  featuredImageFileId: bigint | null
  category: string
  gradeLevel: string
  isPublished: boolean
  isFeatured: boolean
  publishedAt: Date | null
}

/** Reader order (BR-M09-03): publish time, newest first, then id. */
const READER_ORDER: Prisma.ArticleOrderByWithRelationInput[] = [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }]

/** The only doorway to `articles` and `article_attachments`. Methods use `prisma.client`, so they join a caller's transaction. */
@Injectable()
export class ArticlesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // --- reader (published rows only; the published filter lives here, once) --------------------------

  async readerList(f: { search: string; category: string | null; skip: number; take: number }): Promise<{ rows: ArticleCardRow[]; total: number }> {
    const where: Prisma.ArticleWhereInput = {
      isPublished: true,
      ...(f.category ? { category: f.category } : {}),
      ...(f.search ? { title: { contains: f.search, mode: 'insensitive' } } : {}),
    }
    const [rows, total] = await Promise.all([
      this.prisma.client.article.findMany({ where, orderBy: READER_ORDER, skip: f.skip, take: f.take, include: cardInclude, omit: CARD_OMIT }),
      this.prisma.client.article.count({ where }),
    ])
    return { rows, total }
  }

  latest(take: number): Promise<ArticleCardRow[]> {
    return this.prisma.client.article.findMany({ where: { isPublished: true }, orderBy: READER_ORDER, take, include: cardInclude, omit: CARD_OMIT })
  }

  featuredPublished(take: number): Promise<ArticleCardRow[]> {
    return this.prisma.client.article.findMany({ where: { isPublished: true, isFeatured: true }, orderBy: READER_ORDER, take, include: cardInclude, omit: CARD_OMIT })
  }

  popularPublished(take: number): Promise<ArticleCardRow[]> {
    return this.prisma.client.article.findMany({
      where: { isPublished: true, isFeatured: false },
      orderBy: [{ views: 'desc' }, { id: 'asc' }],
      take,
      include: cardInclude,
      omit: CARD_OMIT,
    })
  }

  publishedBySlug(slug: string): Promise<ArticleBodyRow | null> {
    return this.prisma.client.article.findFirst({ where: { slug, isPublished: true }, include: cardInclude })
  }

  related(id: bigint, category: string, take: number): Promise<ArticleCardRow[]> {
    return this.prisma.client.article.findMany({
      where: { isPublished: true, category, id: { not: id } },
      orderBy: READER_ORDER,
      take,
      include: cardInclude,
      omit: CARD_OMIT,
    })
  }

  /** Adds one view to a PUBLISHED article in one statement and returns the new count; null when it is gone or unpublished. */
  async countView(id: bigint): Promise<number | null> {
    const rows = await this.prisma.client.$queryRaw<Array<{ views: number }>>`UPDATE articles SET views = views + 1 WHERE id = ${id} AND is_published = true RETURNING views`
    return rows[0]?.views ?? null
  }

  // --- admin ----------------------------------------------------------------------------------------

  async adminList(f: { search: string; category: string | null; published: boolean | null; skip: number; take: number }) {
    const where: Prisma.ArticleWhereInput = {
      ...(f.category ? { category: f.category } : {}),
      ...(f.published === null ? {} : { isPublished: f.published }),
      ...(f.search ? { title: { contains: f.search, mode: 'insensitive' } } : {}),
    }
    const [rows, total] = await Promise.all([
      this.prisma.client.article.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: f.skip, take: f.take, include: cardInclude, omit: CARD_OMIT }),
      this.prisma.client.article.count({ where }),
    ])
    return { rows, total }
  }

  adminGet(id: string): Promise<ArticleFullRow | null> {
    return this.prisma.client.article.findUnique({ where: { id: idFromString(id) }, include: detailInclude })
  }

  async slugsLike(base: string): Promise<Set<string>> {
    const rows = await this.prisma.client.article.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })
    return new Set(rows.map((r) => r.slug))
  }

  async create(authorId: string, slug: string, data: ArticleWrite): Promise<bigint> {
    const row = await this.prisma.client.article.create({ data: { ...data, slug, authorId: idFromString(authorId) }, select: { id: true } })
    return row.id
  }

  /** Writes only the fields in `patch`; false when the row is gone. */
  async update(id: string, patch: Prisma.ArticleUncheckedUpdateManyInput): Promise<boolean> {
    const r = await this.prisma.client.article.updateMany({ where: { id: idFromString(id) }, data: patch })
    return r.count === 1
  }

  async remove(id: string): Promise<boolean> {
    const r = await this.prisma.client.article.deleteMany({ where: { id: idFromString(id) } })
    return r.count === 1
  }
}
