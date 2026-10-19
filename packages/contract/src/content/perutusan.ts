import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { FormBooleanSchema, counter, requiredText, uploadFile } from './common'

/**
 * M09 Perutusan (#33-#40). Mock: `handlers/perutusan.ts`. The feed, detail and reactions need a
 * session; `GET /public/perutusan/{id}` is public. Write is `admin` (national) and `school_admin`
 * (own school) only (BR-M09-22). An invisible post is always 404, never 403.
 */

export const PERUTUSAN_STATUSES = ['published', 'scheduled', 'draft'] as const
export const PerutusanStatusSchema = z.enum(PERUTUSAN_STATUSES).meta({ id: 'PerutusanStatus' })
export type PerutusanStatus = z.infer<typeof PerutusanStatusSchema>

export const PERUTUSAN_STATUS_LABELS = {
  published: 'Diterbitkan',
  scheduled: 'Dijadualkan',
  draft: 'Draf',
} as const satisfies Record<PerutusanStatus, string>

export const REACTION_TYPES = ['like', 'love', 'thanks'] as const
export const PerutusanReactionTypeSchema = z.enum(REACTION_TYPES).meta({ id: 'PerutusanReactionType' })
export type PerutusanReactionType = z.infer<typeof PerutusanReactionTypeSchema>

export const PERUTUSAN_SCOPES = ['national', 'school'] as const

/** Label of a national post's scope; a school post shows the school name (fallback "Sekolah"). */
export const PERUTUSAN_NATIONAL_SCOPE_LABEL = 'Seluruh Malaysia (Kebangsaan)'
export const PERUTUSAN_SCHOOL_SCOPE_LABEL = 'Sekolah'

/** At most this many published-or-scheduled pinned posts per scope (national, or per school). */
export const PERUTUSAN_MAX_PINNED = 2
export const PERUTUSAN_COMMENT_MAX = 1000
export const PERUTUSAN_MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const PERUTUSAN_MAX_DOCUMENT_BYTES = 5 * 1024 * 1024

export const PerutusanAuthorSchema = z
  .strictObject({
    name: z.string(),
    initials: z.string(),
    roleLabel: z.string().meta({ description: '"Pengetua" (school_admin), "Admin" (admin), else empty.' }),
  })
  .meta({ id: 'PerutusanAuthor' })

export const PerutusanReactionCountsSchema = z
  .strictObject({ like: counter(), love: counter(), thanks: counter() })
  .meta({ id: 'PerutusanReactionCounts' })

const perutusanCardShape = {
  id: IdSchema,
  title: z.string(),
  excerpt: z.string().meta({ description: 'HTML stripped, whitespace collapsed, 250 characters then "...".' }),
  isPinned: z.boolean(),
  hasVideo: z.boolean(),
  scopeLabel: z.string().meta({ description: '"Seluruh Malaysia (Kebangsaan)" or the school name.' }),
  createdAt: TimestampSchema,
  author: PerutusanAuthorSchema,
  topReaction: z
    .strictObject({ type: PerutusanReactionTypeSchema, emoji: z.string().min(1), count: z.number().int().min(1) })
    .nullable()
    .meta({ description: 'The type with the highest count (ties: like, love, thanks); null when no reactions.' }),
  commentCount: counter().meta({ description: 'Approved comments only.' }),
  reads: counter(),
}

/** Item of the feed (#33): pinned first, then newest effective time, then id. Not paginated. */
export const PerutusanCardSchema = z.strictObject(perutusanCardShape).meta({ id: 'PerutusanCard' })

/** Stored attachment of a post (`images[]` / `documents[]`); the bytes are served through BE-04. */
export const PerutusanFileSchema = z
  .strictObject({ fileName: z.string().min(1), size: counter().meta({ description: 'Bytes.' }) })
  .meta({ id: 'PerutusanFile' })

/** Post page and the `data` of create (#35, #37). `reads` includes this open. */
export const PerutusanDetailSchema = z
  .strictObject({
    ...perutusanCardShape,
    body: z.string().meta({ description: 'Sanitised HTML.' }),
    youtubeEmbedUrl: z.string().nullable(),
    images: z.array(PerutusanFileSchema),
    documents: z.array(PerutusanFileSchema),
    isPublic: z.boolean(),
    publicUrl: z.string().nullable().meta({ description: '`/perutusan/awam/{id}` for a public published post, else null (the client adds the origin).' }),
    reactions: PerutusanReactionCountsSchema,
    myReactions: z.array(PerutusanReactionTypeSchema),
    canWrite: z.boolean().meta({ description: 'The caller is the author or an admin.' }),
  })
  .meta({ id: 'PerutusanDetail' })
export type PerutusanDetail = z.infer<typeof PerutusanDetailSchema>

/** Item of `GET /perutusan/mine` (#34): own posts, every status. */
export const PerutusanOwnItemSchema = z
  .strictObject({
    id: IdSchema,
    title: z.string(),
    status: PerutusanStatusSchema,
    statusLabel: z.string(),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'PerutusanOwnItem' })

/**
 * `GET /perutusan/compose-context` (#36): admin is national, school_admin is school; every other
 * role has `scope` null, empty label and `canWrite` false.
 */
export const PerutusanComposeContextSchema = z
  .strictObject({
    scope: z.enum(PERUTUSAN_SCOPES).nullable(),
    scopeLabel: z.string(),
    canWrite: z.boolean(),
  })
  .meta({ id: 'PerutusanComposeContext' })

const SCHEDULED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/

const imageFile = uploadFile({
  maxBytes: PERUTUSAN_MAX_IMAGE_BYTES,
  mimes: ['image/jpeg', 'image/png', 'image/gif'],
  extensions: ['jpg', 'jpeg', 'png', 'gif'],
  description: 'JPG, PNG or GIF, at most 2 MB.',
})
const documentFile = uploadFile({
  maxBytes: PERUTUSAN_MAX_DOCUMENT_BYTES,
  mimes: ['application/pdf'],
  extensions: ['pdf'],
  description: 'PDF, at most 5 MB.',
})

/**
 * Create body (#37), `multipart/form-data` (file storage: BE-04). `images` and `documents` are
 * repeated parts (`images[]`, `documents[]`). Scope and author come from the session (admin =
 * national, school_admin = own school), never from the body.
 */
export const PerutusanCreateRequestSchema = z
  .object({
    title: requiredText(255),
    body: z.string().optional().meta({ description: 'Rich text HTML; sanitised on write.' }),
    status: PerutusanStatusSchema,
    scheduledAt: z
      .string()
      .regex(SCHEDULED_AT)
      .optional()
      .meta({ description: 'Only used when status is `scheduled`; must be in the future. A value without an offset is Malaysia time.' }),
    youtubeUrl: z.string().optional().meta({ description: 'Must parse as a YouTube URL.' }),
    isPinned: FormBooleanSchema.optional(),
    isPublic: FormBooleanSchema.optional(),
    images: z.array(imageFile).optional(),
    documents: z.array(documentFile).optional(),
  })
  .meta({ id: 'PerutusanCreateRequest' })

/** Body of `POST /perutusan/{id}/reactions` (#38): posting the same type again removes it. */
export const PerutusanReactionRequestSchema = z
  .object({ type: PerutusanReactionTypeSchema })
  .meta({ id: 'PerutusanReactionRequest' })

/** `data` of #38. */
export const PerutusanReactionResultSchema = z
  .strictObject({ reactions: PerutusanReactionCountsSchema, myReactions: z.array(PerutusanReactionTypeSchema) })
  .meta({ id: 'PerutusanReactionResult' })

/** Body of `POST /perutusan/{id}/comments` (#39). */
export const PerutusanCommentRequestSchema = z
  .object({ body: z.string().min(1).max(PERUTUSAN_COMMENT_MAX) })
  .meta({ id: 'PerutusanCommentRequest' })

/** `data` of #39: stored `pending` and not shown until approved (no moderation route exists, OQ-API-B4-18). */
export const PerutusanCommentResultSchema = z
  .strictObject({ id: IdSchema, status: z.literal('pending') })
  .meta({ id: 'PerutusanCommentResult' })

/** `data` of `GET /public/perutusan/{id}` (#40): only a public, published post; counts no read. */
export const PerutusanPublicSchema = z
  .strictObject({
    id: IdSchema,
    title: z.string(),
    author: PerutusanAuthorSchema,
    body: z.string().meta({ description: 'Sanitised HTML.' }),
    createdAt: TimestampSchema,
    youtubeEmbedUrl: z.string().nullable(),
    scopeLabel: z.string(),
    reactionTotal: counter(),
    reads: counter(),
    commentCount: counter(),
  })
  .meta({ id: 'PerutusanPublic' })
