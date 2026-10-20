import { z } from '../zod'
import { ListMetaSchema } from '../common/envelope'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'

/**
 * M01 notification inbox wire contract (BE-06, contract-only). Mock:
 * `src/modules/m01-authentication/mock/handlers/{notifications,notifications-store}.ts`, wire types
 * `api/notifications.ts`.
 *
 * A notification belongs to one user and every route works on the signed-in user's own items only.
 * An id of another user behaves as if it did not exist: 404 on the single-item routes, silently
 * ignored by the bulk routes. Differences from the mock: ids are opaque `Id` strings (UD-1), and
 * the bulk `ids` items are `Id`s, so the mock "ids.* must be an integer" rule is not part of the
 * contract (an unknown id is ignored like a foreign one). Every write route also documents 429
 * RATE_LIMITED with `retryAfter` and `Retry-After` (D57a; the mock has no throttle). The entity is
 * shared with M22, which sends through `NotificationsService.push`; BE-06 account flows push the
 * security notices of `ACCOUNT_SECURITY_NOTIFICATIONS` (password reset, reset by IC) through it.
 */

export const NOTIFICATION_CATEGORIES = ['system', 'reminder', 'milestone'] as const
export const NotificationCategorySchema = z
  .enum(NOTIFICATION_CATEGORIES)
  .meta({ id: 'NotificationCategory' })
export type NotificationCategory = z.infer<typeof NotificationCategorySchema>

/** The inbox is paged 20 per page, newest first (createdAt desc, then id desc). */
export const NOTIFICATIONS_PAGE_SIZE = 20

/** `type` is a lower-case code (e.g. `spaced_review`, `new_ticket`) and open-ended; the screen shows it upper-cased. */
export const NotificationItemSchema = z
  .strictObject({
    id: IdSchema,
    userId: IdSchema.meta({ description: 'Always the signed-in user.' }),
    type: z.string().min(1),
    category: NotificationCategorySchema.nullable().meta({
      description: 'null for the admin live items (they match no category filter).',
    }),
    title: z.string(),
    body: z.string(),
    readAt: TimestampSchema.nullable().meta({ description: 'null while unread.' }),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'NotificationItem' })
export type NotificationItem = z.infer<typeof NotificationItemSchema>

/** Input of `NotificationsService.push` (not an HTTP body): what other modules hand over. */
export const NotificationInputSchema = z.strictObject({
  type: z.string().min(1),
  category: NotificationCategorySchema.nullish(),
  title: z.string().min(1),
  body: z.string().min(1),
})
export type NotificationInput = z.infer<typeof NotificationInputSchema>

/**
 * Query of `GET /me/notifications`. Unknown `filter` / `type` values are ignored (all items), and a
 * `page` that is missing or not a positive integer means page 1; none of these is a 422. `filter`
 * and `type` combine with AND.
 */
export const NotificationListQuerySchema = z
  .object({
    filter: z.string().optional().meta({ description: '`unread` or `read`; any other value is ignored.' }),
    type: z.string().optional().meta({ description: 'A NotificationCategory (system, reminder, milestone); any other value is ignored.' }),
    page: z.string().optional().meta({ description: 'Page number, 1-based; invalid means 1. Page size is fixed at 20.' }),
  })
  .meta({ id: 'NotificationListQuery' })
export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>

/** `meta.counts` is the user's totals and ignores `filter` and `type`. */
export const NotificationCountsSchema = z
  .strictObject({ all: z.number().int().min(0), unread: z.number().int().min(0) })
  .meta({ id: 'NotificationCounts' })
export type NotificationCounts = z.infer<typeof NotificationCountsSchema>

export const NotificationListMetaSchema = ListMetaSchema.extend({ counts: NotificationCountsSchema })
  .meta({ id: 'NotificationListMeta' })
export type NotificationListMeta = z.infer<typeof NotificationListMetaSchema>

export const NotificationListResponseSchema = z
  .object({ data: z.array(NotificationItemSchema).max(NOTIFICATIONS_PAGE_SIZE), meta: NotificationListMetaSchema })
  .meta({ id: 'NotificationListResponse' })
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>

/** `data` of `GET /me/notifications/unread-count`. */
export const NotificationUnreadCountSchema = z
  .strictObject({ count: z.number().int().min(0) })
  .meta({ id: 'NotificationUnreadCount' })

/** `data` of `POST /me/notifications/read-all`: how many were unread. */
export const NotificationReadAllResultSchema = z
  .strictObject({ updated: z.number().int().min(0) })
  .meta({ id: 'NotificationReadAllResult' })

/** `data` of the single-item and bulk actions (200, also for DELETE; never 204). */
export const NotificationSuccessSchema = z
  .strictObject({ success: z.literal(true) })
  .meta({ id: 'NotificationSuccess' })

/** Body of `bulk-read` and `bulk-delete`. */
export const NOTIFICATION_IDS_REQUIRED = 'The ids field is required.'
export const NotificationBulkRequestSchema = z
  .object({
    ids: z
      .array(IdSchema, { error: NOTIFICATION_IDS_REQUIRED })
      .min(1, { error: NOTIFICATION_IDS_REQUIRED })
      .meta({ description: 'Non-empty. Foreign and unknown ids are silently ignored; duplicates count once.' }),
  })
  .meta({ id: 'NotificationBulkRequest' })
export type NotificationBulkRequest = z.infer<typeof NotificationBulkRequestSchema>
