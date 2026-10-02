/**
 * The `notifications` table and repository (owner M01; M22 extends the entity, DATA-M01-04).
 *
 * Rules (BR-19): a notification belongs to one user, is unread while `readAt` is null, and is listed
 * newest first. `counts.all` / `counts.unread` ignore the filters. Status (`filter`) and category
 * (`type`) filters are independent and combine with AND when both are sent (INFERRED; the live
 * links only ever set one). Deletion is permanent. Ids of other users' notifications behave as if
 * they did not exist (404 for single-item calls; ignored by the bulk calls, as a scoped
 * `whereIn`).
 *
 * The file lives under `handlers/` (build-plan §S.3: a module mock task writes `mock/handlers/**`).
 */

import { toIsoMyt } from '@/lib/time'
import { defineTable, maxPlusOne } from '@/mock/define'
import { defineRepository } from '@/mock/repository'

import type {
  AppNotification,
  NotificationCategory,
  NotificationStatusFilter,
} from '../../api/notifications'

export type NotificationRow = AppNotification

export const notificationsTable = defineTable<NotificationRow>({
  name: 'notifications',
  ids: maxPlusOne(),
  indexes: ['userId'],
})

export interface NotificationInput {
  type: string
  category?: NotificationCategory | null
  title: string
  body: string
}

export interface NotificationListOptions {
  filter?: NotificationStatusFilter | undefined
  category?: NotificationCategory | undefined
  page: number
  pageSize: number
}

/** Newest first; equal times fall back to the higher id. */
function newestFirst(a: NotificationRow, b: NotificationRow): number {
  return b.createdAt.localeCompare(a.createdAt) || b.id - a.id
}

export const notificationsRepo = defineRepository({
  name: 'notifications',
  owner: 'M01',
  store: notificationsTable,
  methods: ({ store, transaction }) => {
    const ownedBy = (userId: number, id: number): NotificationRow | undefined => {
      const row = store.get(id)
      return row && row.userId === userId ? row : undefined
    }
    const unreadOf = (userId: number): NotificationRow[] =>
      store.query({ where: { userId, readAt: null } }).rows

    return {
      /** #13: one page plus the unfiltered counts. */
      list: (userId: number, options: NotificationListOptions) => {
        const rows = store
          .query({
            where: {
              userId,
              ...(options.filter === 'unread' ? { readAt: null } : {}),
              ...(options.category ? { category: options.category } : {}),
            },
            match: options.filter === 'read' ? (r) => r.readAt !== null : undefined,
          })
          .rows.sort(newestFirst)
        const start = (options.page - 1) * options.pageSize
        return { rows: rows.slice(start, start + options.pageSize), total: rows.length }
      },
      /** `meta.counts` of #13. */
      counts: (userId: number): { all: number; unread: number } => ({
        all: store.count({ userId }),
        unread: store.count({ userId, readAt: null }),
      }),
      /** #14. */
      unreadCount: (userId: number): number => store.count({ userId, readAt: null }),
      get: (id: number): NotificationRow | null => store.get(id) ?? null,
      /** #15: returns how many items were unread. */
      markAllRead: (userId: number, now: number): number =>
        transaction(() => {
          const unread = unreadOf(userId)
          const readAt = toIsoMyt(now)
          for (const row of unread) store.update(row.id, { readAt })
          return unread.length
        }),
      /** #16: false for an unknown or foreign id. Reading twice keeps the first `readAt`. */
      markRead: (userId: number, id: number, now: number): boolean => {
        const row = ownedBy(userId, id)
        if (!row) return false
        if (row.readAt === null) store.update(id, { readAt: toIsoMyt(now) })
        return true
      },
      /** #17: foreign and unknown ids are ignored. Returns how many became read. */
      markManyRead: (userId: number, ids: readonly number[], now: number): number =>
        transaction(() => {
          let n = 0
          for (const id of new Set(ids)) {
            const row = ownedBy(userId, id)
            if (row && row.readAt === null) {
              store.update(id, { readAt: toIsoMyt(now) })
              n++
            }
          }
          return n
        }),
      /** #18: false for an unknown or foreign id. */
      remove: (userId: number, id: number): boolean => {
        if (!ownedBy(userId, id)) return false
        store.remove(id)
        return true
      },
      /** #19: foreign and unknown ids are ignored. Returns how many were deleted. */
      removeMany: (userId: number, ids: readonly number[]): number =>
        transaction(() => {
          let n = 0
          for (const id of new Set(ids)) {
            if (ownedBy(userId, id)) {
              store.remove(id)
              n++
            }
          }
          return n
        }),
      /**
       * Creates an unread notification for `userId` (hook `pushNotification`; M22 sender). The
       * caller decides whether to announce it as a push.
       */
      create: (userId: number, input: NotificationInput, now: number): NotificationRow =>
        store.insert({
          userId,
          type: input.type,
          category: input.category ?? null,
          title: input.title,
          body: input.body,
          readAt: null,
          createdAt: toIsoMyt(now),
        }),
      /** Seed rows with their fixed ids (SRS §6.8); seed phase. */
      seedRows: (rows: readonly NotificationRow[]): void => {
        for (const r of rows) store.insert(r)
      },
    }
  },
})
