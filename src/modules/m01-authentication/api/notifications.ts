/**
 * M01 notification endpoints (SRS M01 v1.12 §7 #13–#19; build-plan M01-T2). Types and client
 * functions for the bell badge (T5a) and S11 Notifikasi (T8). UI tasks read this file and do not
 * change it (build-plan §S.3 rule 5).
 *
 * The "Notification" entity is shared with M22, which extends it (DATA-M01-04).
 */

import { api, wireId, type EntityId, type ListResult } from '@/api'

export type NotificationCategory = 'system' | 'reminder' | 'milestone'
export type NotificationStatusFilter = 'unread' | 'read'

/** DATA-M01-04. `category` is null for the admin's live items (matches no category filter). */
export interface AppNotification {
  id: number
  userId: number
  /** Lowercase code, e.g. `spaced_review`; the screen shows it uppercased. */
  type: string
  category: NotificationCategory | null
  title: string
  body: string
  /** ISO datetime, or null while unread. */
  readAt: string | null
  createdAt: string
}

/** `meta.counts` of #13: not affected by the filters. */
export interface NotificationCounts extends Record<string, number> {
  all: number
  unread: number
}

export interface NotificationListQuery {
  filter?: NotificationStatusFilter | null
  type?: NotificationCategory | null
  page?: number
  signal?: AbortSignal
}

/** Simulated foreground push: dispatched on `window` by `__mock.pushNotification` (FR-M01-53). */
export const NOTIFICATION_PUSH_EVENT = 'pp:notification-push'

export interface NotificationPushDetail {
  userId: number
  notification: AppNotification
}

/** #13 `GET /api/me/notifications`: 20 per page, newest first. */
export function fetchNotifications(
  query: NotificationListQuery = {},
): Promise<ListResult<AppNotification, { counts: NotificationCounts }>> {
  return api.list<AppNotification, { counts: NotificationCounts }>('/api/me/notifications', {
    query: { filter: query.filter ?? null, type: query.type ?? null, page: query.page ?? null },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #14 `GET /api/me/notifications/unread-count`. */
export async function fetchUnreadCount(options: { signal?: AbortSignal } = {}): Promise<number> {
  const data = await api.get<{ count: number }>(
    '/api/me/notifications/unread-count',
    options.signal ? { signal: options.signal } : {},
  )
  return data.count
}

/** #15 `POST /api/me/notifications/read-all`: resolves to the number of items updated. */
export async function markAllNotificationsRead(): Promise<number> {
  const data = await api.post<{ updated: number }>('/api/me/notifications/read-all')
  return data.updated
}

/** #16 `POST /api/me/notifications/:id/read` (404 for an unknown or foreign id). */
export function markNotificationRead(id: number): Promise<{ success: true }> {
  return api.post<{ success: true }>(`/api/me/notifications/${String(id)}/read`)
}

/** #17 `POST /api/me/notifications/bulk-read`. */
export function bulkMarkNotificationsRead(ids: readonly EntityId[]): Promise<{ success: true }> {
  // Contract `NotificationBulkRequestSchema`: `ids` are strings (SWX-2).
  return api.post<{ success: true }>('/api/me/notifications/bulk-read', {
    body: { ids: ids.map(wireId) },
  })
}

/** #18 `DELETE /api/me/notifications/:id` (404 for an unknown or foreign id). */
export function deleteNotification(id: number): Promise<{ success: true }> {
  return api.delete<{ success: true }>(`/api/me/notifications/${String(id)}`)
}

/** #19 `POST /api/me/notifications/bulk-delete`. */
export function bulkDeleteNotifications(ids: readonly EntityId[]): Promise<{ success: true }> {
  return api.post<{ success: true }>('/api/me/notifications/bulk-delete', {
    body: { ids: ids.map(wireId) },
  })
}
