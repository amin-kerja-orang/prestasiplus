/**
 * M01 SRS v1.12 §7 #13–#19: the signed-in user's notifications (any role, own items only).
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 13 | `GET /api/me/notifications?filter=&type=&page=` | 20 per page, `meta.counts {all, unread}` |
 * | 14 | `GET /api/me/notifications/unread-count` | `{count}` |
 * | 15 | `POST /api/me/notifications/read-all` | `{updated}` |
 * | 16 | `POST /api/me/notifications/:id/read` | 404 for an unknown or foreign id |
 * | 17 | `POST /api/me/notifications/bulk-read` | `{ids}`; 422 without a non-empty integer list |
 * | 18 | `DELETE /api/me/notifications/:id` | 404 for an unknown or foreign id |
 * | 19 | `POST /api/me/notifications/bulk-delete` | `{ids}`; 422 as #17 |
 *
 * The handlers only shape requests and responses; every rule lives in the repository.
 */

import {
  int,
  ok,
  notFound,
  pageParams,
  paged,
  queryString,
  requireAuth,
  route,
  rule,
  validate,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'

import type { NotificationCategory, NotificationStatusFilter } from '../../api/notifications'
import { notificationsRepo } from './notifications-store'

export const NOTIFICATIONS_PAGE_SIZE = 20

const CATEGORIES: readonly string[] = ['system', 'reminder', 'milestone']

function userIdOf(req: MockRequest): number {
  if (!req.session) throw new Error('requireAuth() must run first')
  return req.session.userId
}

/** `ids`: `required|array` with integer items (Laravel), in Laravel's English default messages. */
const idsRules = {
  ids: [
    rule(
      'required',
      (value) =>
        Array.isArray(value) && value.length > 0 ? null : 'The :attribute field is required.',
      { implicit: true },
    ),
    rule('integer', (value) =>
      (value as unknown[]).every((v) => Number.isInteger(v))
        ? null
        : 'The :attribute.* field must be an integer.',
    ),
  ],
}

/** The validated `ids`, or the 422 response. */
function idsOf(req: MockRequest): number[] | MockResponse {
  const invalid = validate(req.body, idsRules)
  return invalid ?? (req.body as { ids: number[] }).ids
}

export const notificationRoutes: RouteDef[] = [
  route('GET', '/api/me/notifications', [requireAuth()], (req) => {
    const userId = userIdOf(req)
    const filterRaw = queryString(req.query, 'filter')
    const typeRaw = queryString(req.query, 'type')
    const filter: NotificationStatusFilter | undefined =
      filterRaw === 'unread' || filterRaw === 'read' ? filterRaw : undefined
    const category =
      typeRaw !== undefined && CATEGORIES.includes(typeRaw)
        ? (typeRaw as NotificationCategory)
        : undefined
    const req20 = pageParams(req.query, { pageSize: NOTIFICATIONS_PAGE_SIZE })
    const page = notificationsRepo.list(userId, {
      filter,
      category,
      page: req20.page,
      pageSize: req20.pageSize,
    })
    return paged(page, req20, { counts: notificationsRepo.counts(userId) })
  }),

  route('GET', '/api/me/notifications/unread-count', [requireAuth()], (req) =>
    ok({ count: notificationsRepo.unreadCount(userIdOf(req)) }),
  ),

  route('POST', '/api/me/notifications/read-all', [requireAuth()], (req, ctx) =>
    ok({ updated: notificationsRepo.markAllRead(userIdOf(req), ctx.clock.now()) }),
  ),

  route('POST', '/api/me/notifications/bulk-read', [requireAuth()], (req, ctx) => {
    const ids = idsOf(req)
    if (!Array.isArray(ids)) return ids
    notificationsRepo.markManyRead(userIdOf(req), ids, ctx.clock.now())
    return ok({ success: true })
  }),

  route('POST', '/api/me/notifications/bulk-delete', [requireAuth()], (req) => {
    const ids = idsOf(req)
    if (!Array.isArray(ids)) return ids
    notificationsRepo.removeMany(userIdOf(req), ids)
    return ok({ success: true })
  }),

  route(
    'POST',
    '/api/me/notifications/:id/read',
    [requireAuth()],
    (req, ctx) =>
      notificationsRepo.markRead(userIdOf(req), req.params.id as number, ctx.clock.now())
        ? ok({ success: true })
        : notFound(),
    { params: { id: int() } },
  ),

  route(
    'DELETE',
    '/api/me/notifications/:id',
    [requireAuth()],
    (req) =>
      notificationsRepo.remove(userIdOf(req), req.params.id as number)
        ? ok({ success: true })
        : notFound(),
    { params: { id: int() } },
  ),
]
