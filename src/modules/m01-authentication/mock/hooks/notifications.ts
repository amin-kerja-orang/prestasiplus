/**
 * Hook `pushNotification(userId, notification, options?)` (M01 SRS §7 "mock-only helpers", NFR-M01-02).
 *
 * Creates an unread notification for `userId` and, unless `options.push === false`, announces it as
 * a simulated foreground push: a `pp:notification-push` `CustomEvent` on `window` (detail
 * `{userId, notification}`) that makes the bell badge refresh at once (FR-M01-53). Without the
 * event the badge only catches up at its next 60 s refresh (E2E-M01-49).
 *
 * The push channel itself belongs to M22; this hook is the prototype's stand-in for it.
 */

import { clock, type Clock } from '@/lib/time'

import {
  NOTIFICATION_PUSH_EVENT,
  type AppNotification,
  type NotificationCategory,
  type NotificationPushDetail,
} from '../../api/notifications'
import { notificationsRepo, type NotificationRow } from '../handlers/notifications-store'

export interface PushNotificationInput {
  title: string
  body: string
  /** Default `system_announcement`. */
  type?: string
  /** Default `system`. Pass `null` for no category. */
  category?: NotificationCategory | null
}

export interface PushNotificationOptions {
  /** Emit the simulated push event (default true). */
  push?: boolean
}

const CATEGORIES: readonly string[] = ['system', 'reminder', 'milestone']

export function pushNotification(
  userId: number,
  notification: PushNotificationInput,
  options: PushNotificationOptions = {},
  now: Clock = clock,
): AppNotification {
  if (!Number.isInteger(userId) || userId < 1) {
    throw new RangeError(`pushNotification: invalid userId ${String(userId)}`)
  }
  if (typeof notification?.title !== 'string' || typeof notification.body !== 'string') {
    throw new TypeError('pushNotification: notification needs a title and a body')
  }
  if (
    notification.category !== undefined &&
    notification.category !== null &&
    !CATEGORIES.includes(notification.category)
  ) {
    throw new RangeError(`pushNotification: invalid category ${String(notification.category)}`)
  }
  const row: NotificationRow = notificationsRepo.create(
    userId,
    {
      type: notification.type ?? 'system_announcement',
      category: notification.category === undefined ? 'system' : notification.category,
      title: notification.title,
      body: notification.body,
    },
    now.now(),
  )
  if (options.push !== false && typeof window !== 'undefined') {
    const detail: NotificationPushDetail = { userId, notification: { ...row } }
    window.dispatchEvent(new CustomEvent(NOTIFICATION_PUSH_EVENT, { detail }))
  }
  return { ...row }
}
