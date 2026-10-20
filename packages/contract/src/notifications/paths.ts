import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { AUTH_ERROR_MESSAGES } from '../auth/errors'
import { ErrorBodySchema } from '../common/error'
import { envelopeOf } from '../common/envelope'
import { IdSchema } from '../common/ids'
import {
  NotificationBulkRequestSchema,
  NotificationCategorySchema,
  NotificationCountsSchema,
  NotificationListMetaSchema,
  NotificationListQuerySchema,
  NotificationListResponseSchema,
  NotificationReadAllResultSchema,
  NotificationItemSchema,
  NotificationSuccessSchema,
  NotificationUnreadCountSchema,
} from './schema'

/** Components contributed by BE-06 (M01 notifications); appended to COMPONENT_SCHEMAS in openapi.ts. */
export const NOTIFICATIONS_COMPONENT_SCHEMAS = {
  NotificationCategory: NotificationCategorySchema,
  NotificationItem: NotificationItemSchema,
  NotificationListQuery: NotificationListQuerySchema,
  NotificationCounts: NotificationCountsSchema,
  NotificationListMeta: NotificationListMetaSchema,
  NotificationListResponse: NotificationListResponseSchema,
  NotificationUnreadCount: NotificationUnreadCountSchema,
  NotificationReadAllResult: NotificationReadAllResultSchema,
  NotificationSuccess: NotificationSuccessSchema,
  NotificationBulkRequest: NotificationBulkRequestSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

/** D57a: 429 RATE_LIMITED with `retryAfter` in the body and the `Retry-After` header (seconds). */
const rateLimited = {
  ...err(
    `RATE_LIMITED "${AUTH_ERROR_MESSAGES.RATE_LIMITED}", with retryAfter seconds in the body and the Retry-After header (D57a; the per-user limit is a platform setting of the implementation).`,
  ),
  headers: {
    'Retry-After': {
      description: 'Seconds until a retry is allowed (same value as error.retryAfter).',
      schema: { type: 'integer' as const, minimum: 1 },
    },
  },
}
const WRITE_THROTTLE = ' Write route: rate limited per user (D57a).'

/** Registers the seven `/me/notifications*` routes. Bodies are `{ data, meta? }` or `{ error }`. */
export function registerNotificationsPaths(registry: OpenAPIRegistry): void {
  const csrf = z.object({
    'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
  })
  const unauthorized = err('UNAUTHORIZED "Unauthenticated." (no valid session).')
  const csrfInvalid = err('CSRF_INVALID (missing or wrong X-CSRF-Token), or PASSWORD_CHANGE_REQUIRED (shared common code, 403) while session.mustChangePassword is set.')
  const passwordChangeRequired = err('PASSWORD_CHANGE_REQUIRED (shared common code, 403): the account must change its password first (session.mustChangePassword).')
  const notFound = err('NOT_FOUND "Not Found." (unknown id, or the notification belongs to another user).')
  const idParam = z.object({ id: IdSchema })
  const success = json(envelopeOf(NotificationSuccessSchema), '{ data: { success: true } }.')
  const bulkBody = { required: true, content: { 'application/json': { schema: NotificationBulkRequestSchema } } }
  const bulkInvalid = err('VALIDATION_ERROR: fields.ids "The ids field is required." (missing, not a list or empty).')

  registry.registerPath({
    method: 'get',
    path: '/me/notifications',
    tags: ['notifications'],
    summary: 'Own notification inbox',
    description:
      'Any signed-in role, own items only, 20 per page, newest first (createdAt desc, then id desc). An out-of-range page returns data [] with the requested page. meta = ListMeta plus counts { all, unread } for the user, ignoring the filters.',
    request: { query: NotificationListQuerySchema },
    responses: { 200: json(NotificationListResponseSchema, 'One page with meta.counts.'), 401: unauthorized, 403: passwordChangeRequired },
  })

  registry.registerPath({
    method: 'get',
    path: '/me/notifications/unread-count',
    tags: ['notifications'],
    summary: 'Unread count (bell badge)',
    responses: { 200: json(envelopeOf(NotificationUnreadCountSchema), 'Unread count.'), 401: unauthorized, 403: passwordChangeRequired },
  })

  registry.registerPath({
    method: 'post',
    path: '/me/notifications/read-all',
    tags: ['notifications'],
    summary: 'Mark every unread notification read',
    description: 'Sets readAt on the caller unread items; `updated` is how many there were.' + WRITE_THROTTLE,
    request: { headers: [csrf] },
    responses: {
      200: json(envelopeOf(NotificationReadAllResultSchema), 'Number of items updated.'),
      401: unauthorized,
      403: csrfInvalid,
      429: rateLimited,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/me/notifications/bulk-read',
    tags: ['notifications'],
    summary: 'Mark the listed notifications read',
    description: 'Foreign and unknown ids are ignored silently; an item already read keeps its first readAt.' + WRITE_THROTTLE,
    request: { headers: [csrf], body: bulkBody },
    responses: { 200: success, 401: unauthorized, 403: csrfInvalid, 422: bulkInvalid, 429: rateLimited },
  })

  registry.registerPath({
    method: 'post',
    path: '/me/notifications/bulk-delete',
    tags: ['notifications'],
    summary: 'Delete the listed notifications',
    description: 'Permanent. Foreign and unknown ids are ignored silently.' + WRITE_THROTTLE,
    request: { headers: [csrf], body: bulkBody },
    responses: { 200: success, 401: unauthorized, 403: csrfInvalid, 422: bulkInvalid, 429: rateLimited },
  })

  registry.registerPath({
    method: 'post',
    path: '/me/notifications/{id}/read',
    tags: ['notifications'],
    summary: 'Mark one notification read',
    description: 'Reading twice keeps the first readAt.' + WRITE_THROTTLE,
    request: { headers: [csrf], params: idParam },
    responses: { 200: success, 401: unauthorized, 403: csrfInvalid, 404: notFound, 429: rateLimited },
  })

  registry.registerPath({
    method: 'delete',
    path: '/me/notifications/{id}',
    tags: ['notifications'],
    summary: 'Delete one notification',
    description: 'Permanent. Answers 200 { data: { success: true } }, not 204.' + WRITE_THROTTLE,
    request: { headers: [csrf], params: idParam },
    responses: { 200: success, 401: unauthorized, 403: csrfInvalid, 404: notFound, 429: rateLimited },
  })
}
