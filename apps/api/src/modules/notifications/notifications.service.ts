import { Inject, Injectable } from '@nestjs/common'
import {
  NOTIFICATIONS_PAGE_SIZE,
  NOTIFICATION_CATEGORIES,
  NotificationInputSchema,
  type NotificationCategory,
  type NotificationItem,
  type NotificationListResponse,
} from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { listMeta } from '../../common/http'
import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock } from '../../db/clock'
import { isIdString } from '../../db/ids'
import { isOverloadError } from '../auth/auth.errors'
import { NOTIFICATION_BULK_MAX, NOTIFICATION_BULK_TOO_MANY, NOTIFICATION_LIMITS } from './notifications.constants'
import { NotificationsRepository, type NotificationFilter, type NotificationRow } from './notifications.repository'

export interface PushInput {
  type: string
  category?: NotificationCategory | null
  title: string
  body: string
}

/**
 * Options of `push`. B1 has no push provider: `push: true` is accepted and is a no-op hook, so
 * callers can already state their intent. A provider card will act on it later.
 */
export interface PushOptions {
  push?: boolean
}

export interface ListQuery {
  filter?: string | undefined
  type?: string | undefined
  page?: string | undefined
}

const toItem = (r: NotificationRow): NotificationItem => ({
  id: r.id,
  userId: r.userId,
  type: r.type,
  category: r.category as NotificationCategory | null,
  title: r.title,
  body: r.body,
  readAt: r.readAt ? toMytTimestamp(r.readAt) : null,
  createdAt: toMytTimestamp(r.createdAt),
})

/** Cuts `text` to at most `max` characters, the last one being an ellipsis. */
const truncate = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`)

/** Valid, de-duplicated ids; anything that cannot be an id matches nothing, as a foreign id does. */
const idsOf = (ids: readonly string[]): string[] => [...new Set(ids.filter(isIdString))]

/** M01 notification inbox (own items only) and the `push` entry point other modules call. */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly repo: NotificationsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(userId: string, q: ListQuery): Promise<NotificationListResponse> {
    const filter: NotificationFilter = {}
    if (q.filter === 'unread' || q.filter === 'read') filter.status = q.filter
    if (q.type !== undefined && (NOTIFICATION_CATEGORIES as readonly string[]).includes(q.type)) filter.category = q.type
    const page = /^[1-9]\d{0,8}$/.test(q.page ?? '') ? Number(q.page) : 1
    const [{ rows, total }, counts] = await this.guard(() =>
      Promise.all([this.repo.page(userId, filter, (page - 1) * NOTIFICATIONS_PAGE_SIZE, NOTIFICATIONS_PAGE_SIZE), this.repo.counts(userId)]),
    )
    return { data: rows.map(toItem), meta: { ...listMeta(page, NOTIFICATIONS_PAGE_SIZE, total), counts } }
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    return { count: await this.guard(() => this.repo.unreadCount(userId)) }
  }

  async readAll(userId: string): Promise<{ updated: number }> {
    return { updated: await this.guard(() => this.repo.markAllRead(userId, this.clock.now())) }
  }

  async markRead(userId: string, id: string): Promise<{ success: true }> {
    if (!isIdString(id) || !(await this.guard(() => this.repo.markRead(userId, id, this.clock.now())))) throw ApiError.of('NOT_FOUND')
    return { success: true }
  }

  async remove(userId: string, id: string): Promise<{ success: true }> {
    if (!isIdString(id) || !(await this.guard(() => this.repo.remove(userId, id)))) throw ApiError.of('NOT_FOUND')
    return { success: true }
  }

  async bulkRead(userId: string, ids: readonly string[]): Promise<{ success: true }> {
    const clean = this.capped(ids)
    await this.guard(() => this.repo.markManyRead(userId, clean, this.clock.now()))
    return { success: true }
  }

  async bulkDelete(userId: string, ids: readonly string[]): Promise<{ success: true }> {
    const clean = this.capped(ids)
    await this.guard(() => this.repo.removeMany(userId, clean))
    return { success: true }
  }

  /**
   * Creates an unread notification for `userId`. Called by other modules (BE-24, BE-36, the BE-06
   * account flows). It joins the ambient transaction (`prisma.transaction`) when the caller has one,
   * so a rollback removes the notification too.
   *
   * Never throws over text length: `title` is cut to 200 and `body` to 2000 characters with a
   * trailing ellipsis, so a long message cannot break the caller's flow. It still throws on
   * programming errors: a `category` outside the contract enum (or not null/omitted), an empty or
   * over-long `type` (max 64), an empty `title` or `body`, or a bad `userId`.
   *
   * `options.push` is a no-op hook in B1 (no push provider).
   * TODO(push-provider card, not yet allocated): act on `options.push` once a push provider exists.
   */
  async push(userId: string, input: PushInput, options: PushOptions = {}): Promise<NotificationItem> {
    if (!isIdString(userId)) throw new RangeError('NotificationsService.push: invalid user id')
    const parsed = NotificationInputSchema.parse(input)
    if (parsed.type.length > NOTIFICATION_LIMITS.type) throw new RangeError('NotificationsService.push: type is too long')
    void options.push // B1: no push provider, intentionally unused.
    const row = await this.repo.create(
      userId,
      {
        type: parsed.type,
        category: parsed.category ?? null,
        title: truncate(parsed.title, NOTIFICATION_LIMITS.title),
        body: truncate(parsed.body, NOTIFICATION_LIMITS.body),
      },
      this.clock.now(),
    )
    return toItem(row)
  }

  private capped(ids: readonly string[]): string[] {
    if (ids.length > NOTIFICATION_BULK_MAX) throw ApiError.of('VALIDATION_ERROR', { fields: { ids: NOTIFICATION_BULK_TOO_MANY } })
    return idsOf(ids)
  }

  /** An overloaded database is a retryable 429, never a 500. */
  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }
}
