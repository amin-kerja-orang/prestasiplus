import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { listEnvelopeOf } from '../common/envelope'
import { ContentUserRefSchema, counter, httpUrl, optionalText, pageQuery, requiredText } from './common'

/**
 * M09 articles (reader #6-#9, admin #1-#5). Mock: `handlers/articles.ts`, `handlers/admin-articles.ts`.
 * Reader routes are public and only ever return published articles (BR-M09-02).
 */

export const ARTICLE_CATEGORIES = [
  'TIPS_BELAJAR',
  'BERITA',
  'MOTIVASI',
  'PANDUAN_IBU_BAPA',
  'PANDUAN_GURU',
  'KEJAYAAN',
  'UMUM',
] as const
export const ArticleCategorySchema = z.enum(ARTICLE_CATEGORIES).meta({ id: 'ArticleCategory' })
export type ArticleCategory = z.infer<typeof ArticleCategorySchema>

/** BM labels of `ArticleCategory` (`categoryLabel`). */
export const ARTICLE_CATEGORY_LABELS = {
  TIPS_BELAJAR: 'Tips Belajar',
  BERITA: 'Berita',
  MOTIVASI: 'Motivasi',
  PANDUAN_IBU_BAPA: 'Panduan Ibu Bapa',
  PANDUAN_GURU: 'Panduan Guru',
  KEJAYAAN: 'Kejayaan',
  UMUM: 'Umum',
} as const satisfies Record<ArticleCategory, string>

export const ARTICLE_GRADE_LEVELS = [
  'SEMUA',
  'DARJAH_1',
  'DARJAH_2',
  'DARJAH_3',
  'DARJAH_4',
  'DARJAH_5',
  'DARJAH_6',
] as const
export const ArticleGradeLevelSchema = z.enum(ARTICLE_GRADE_LEVELS).meta({ id: 'ArticleGradeLevel' })
export type ArticleGradeLevel = z.infer<typeof ArticleGradeLevelSchema>

/** BM labels of `ArticleGradeLevel` (`gradeLabel`). */
export const ARTICLE_GRADE_LABELS = {
  SEMUA: 'Semua',
  DARJAH_1: 'Darjah 1',
  DARJAH_2: 'Darjah 2',
  DARJAH_3: 'Darjah 3',
  DARJAH_4: 'Darjah 4',
  DARJAH_5: 'Darjah 5',
  DARJAH_6: 'Darjah 6',
} as const satisfies Record<ArticleGradeLevel, string>

/** Page sizes are fixed per endpoint (a client `pageSize` is ignored). */
export const ARTICLE_READER_PAGE_SIZE = 18
export const ARTICLE_ADMIN_PAGE_SIZE = 20
/** `GET /articles/latest`: default and clamp range of `limit`. */
export const ARTICLE_LATEST_DEFAULT = 5
export const ARTICLE_LATEST_MAX = 50
/** Maximum stored length of an article body (INFERRED hardening of the mock). */
export const ARTICLE_CONTENT_MAX = 200_000

// ---------------------------------------------------------------------------------------------
// Reader (public)
// ---------------------------------------------------------------------------------------------

export const ArticleAuthorRefSchema = z
  .strictObject({ name: z.string(), initial: z.string() })
  .meta({ id: 'ArticleAuthorRef' })

const articleCardShape = {
  id: IdSchema,
  slug: z.string().min(1),
  title: z.string(),
  excerpt: z.string().nullable(),
  category: ArticleCategorySchema,
  categoryLabel: z.string(),
  isFeatured: z.boolean(),
  views: counter(),
  publishedAt: TimestampSchema.nullable(),
  author: ArticleAuthorRefSchema,
}

/** Item of the reader list (#6) and of `related` / latest (#9). */
export const ArticleCardSchema = z.strictObject(articleCardShape).meta({ id: 'ArticleCard' })
export type ArticleCard = z.infer<typeof ArticleCardSchema>

/** Item of the "Hot" strip (#7, BR-M09-05): `PILIHAN` when featured, else `POPULAR`. */
export const ArticleHotCardSchema = z
  .strictObject({ ...articleCardShape, badge: z.enum(['PILIHAN', 'POPULAR']) })
  .meta({ id: 'ArticleHotCard' })

/** Article page (#8). `views` already includes this open; `content` is sanitised HTML (BE-24 AC 2). */
export const ArticleDetailSchema = z
  .strictObject({
    ...articleCardShape,
    content: z.string().meta({ description: 'Sanitised HTML.' }),
    gradeLevel: ArticleGradeLevelSchema,
    gradeLabel: z.string(),
    likes: counter(),
    related: z.array(ArticleCardSchema).max(3).meta({ description: 'Up to 3 other published articles of the same category.' }),
  })
  .meta({ id: 'ArticleDetail' })
export type ArticleDetail = z.infer<typeof ArticleDetailSchema>

export const ArticleListQuerySchema = z
  .object({
    search: z.string().optional().meta({ description: 'Title contains, case-insensitive.' }),
    category: z.string().optional().meta({
      description: 'An ArticleCategory code or `all`; an unknown code matches nothing (empty list, not an error).',
    }),
    page: pageQuery(),
  })
  .meta({ id: 'ArticleListQuery' })

export const ArticleLatestQuerySchema = z
  .object({
    limit: z.coerce.number().int().optional().meta({
      description: `Default ${ARTICLE_LATEST_DEFAULT}; clamped to 1..${ARTICLE_LATEST_MAX} (never an error).`,
    }),
  })
  .meta({ id: 'ArticleLatestQuery' })

export const ArticleSlugParamsSchema = z.object({ slug: z.string().min(1) })

export const ArticleListResponseSchema = listEnvelopeOf(ArticleCardSchema)
export const ArticleHotListResponseSchema = listEnvelopeOf(ArticleHotCardSchema)

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

/** Row of the admin list (#1). */
export const AdminArticleItemSchema = z
  .strictObject({
    id: IdSchema,
    title: z.string(),
    category: ArticleCategorySchema,
    categoryLabel: z.string(),
    gradeLevel: ArticleGradeLevelSchema,
    isPublished: z.boolean(),
    isFeatured: z.boolean(),
    views: counter(),
    createdAt: TimestampSchema,
    author: ContentUserRefSchema,
  })
  .meta({ id: 'AdminArticleItem' })

/** Attachment row of the admin detail (rows are not created by the admin routes, BR-M09-34). */
export const ArticleAttachmentSchema = z
  .strictObject({
    id: IdSchema,
    fileName: z.string(),
    label: z.string().nullable(),
    size: counter().meta({ description: 'Bytes.' }),
  })
  .meta({ id: 'ArticleAttachment' })

/** Admin detail (#2, and the `data` of #3/#4): every stored field plus labels, author and attachments. */
export const AdminArticleDetailSchema = z
  .strictObject({
    id: IdSchema,
    title: z.string(),
    slug: z.string().min(1),
    excerpt: z.string().nullable(),
    content: z.string().meta({ description: 'Sanitised HTML.' }),
    featuredImage: z.string().nullable().meta({ description: 'Absolute http(s) URL, or null.' }),
    youtubeUrl: z.string().nullable(),
    category: ArticleCategorySchema,
    gradeLevel: ArticleGradeLevelSchema,
    isPublished: z.boolean(),
    isFeatured: z.boolean(),
    views: counter(),
    likes: counter(),
    authorId: IdSchema,
    publishedAt: TimestampSchema.nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    categoryLabel: z.string(),
    gradeLabel: z.string(),
    author: ContentUserRefSchema,
    attachments: z.array(ArticleAttachmentSchema),
  })
  .meta({ id: 'AdminArticleDetail' })
export type AdminArticleDetail = z.infer<typeof AdminArticleDetailSchema>

export const AdminArticleListQuerySchema = z
  .object({
    search: z.string().optional().meta({ description: 'Title contains, case-insensitive.' }),
    category: z.string().optional().meta({ description: 'An ArticleCategory code or `all`; an unknown code matches nothing.' }),
    published: z.string().optional().meta({ description: '`1` = published only, `0` = unpublished only, anything else = all.' }),
    page: pageQuery(),
  })
  .meta({ id: 'AdminArticleListQuery' })

const articleBodyShape = {
  title: requiredText(255),
  excerpt: optionalText(500),
  content: z.string().trim().min(1).max(ARTICLE_CONTENT_MAX).meta({ description: 'Rich text HTML; sanitised on write (BE-24 AC 2).' }),
  featuredImage: httpUrl().nullable().optional().meta({ description: 'Absolute http(s) URL. Blank or null clears it.' }),
  category: ArticleCategorySchema,
  gradeLevel: ArticleGradeLevelSchema.nullable().optional().meta({ description: 'Absent or null on create = SEMUA.' }),
  isPublished: z.boolean().optional().meta({ description: 'Default false on create.' }),
  isFeatured: z.boolean().optional().meta({ description: 'Default false on create.' }),
}

/**
 * Create body (#3). Attachments and `youtubeUrl` are not accepted here (BR-M09-34). The author is
 * the session user; the slug is generated (unique, stable) and `publishedAt` is set on first publish.
 */
export const AdminArticleCreateRequestSchema = z.object(articleBodyShape).meta({ id: 'AdminArticleCreateRequest' })

/** Update body (#4): same fields, every one optional (an absent field keeps its value; a sent blank text clears it). */
export const AdminArticleUpdateRequestSchema = z.object(articleBodyShape).partial().meta({ id: 'AdminArticleUpdateRequest' })

export const AdminArticleListResponseSchema = listEnvelopeOf(AdminArticleItemSchema)
