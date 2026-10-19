import { Inject, Injectable } from '@nestjs/common'

import type { Prisma } from '../../db/generated/client'
import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'

export interface NotificationRow {
  id: string
  userId: string
  type: string
  category: string | null
  title: string
  body: string
  readAt: Date | null
  createdAt: Date
}

export interface NotificationFilter {
  status?: 'unread' | 'read'
  category?: string
}

interface DbRow {
  id: bigint
  userId: bigint
  type: string
  category: string | null
  title: string
  body: string
  readAt: Date | null
  createdAt: Date
}

const toRow = (r: DbRow): NotificationRow => ({
  id: idToString(r.id),
  userId: idToString(r.userId),
  type: r.type,
  category: r.category,
  title: r.title,
  body: r.body,
  readAt: r.readAt,
  createdAt: r.createdAt,
})

/**
 * The only doorway to `notifications`. Every method takes the owner's id and puts it in the WHERE
 * of the statement itself (AC 7): another user's row is never read, changed or deleted. Ids that are
 * not canonical bigint strings must be filtered out by the caller.
 */
@Injectable()
export class NotificationsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private where(userId: string, f: NotificationFilter): Prisma.NotificationWhereInput {
    return {
      userId: idFromString(userId),
      ...(f.status === 'unread' ? { readAt: null } : {}),
      ...(f.status === 'read' ? { readAt: { not: null } } : {}),
      ...(f.category ? { category: f.category } : {}),
    }
  }

  /** Newest first, ties by the higher id. */
  async page(userId: string, f: NotificationFilter, skip: number, take: number): Promise<{ rows: NotificationRow[]; total: number }> {
    const where = this.where(userId, f)
    const [rows, total] = await Promise.all([
      this.prisma.client.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }),
      this.prisma.client.notification.count({ where }),
    ])
    return { rows: rows.map(toRow), total }
  }

  async counts(userId: string): Promise<{ all: number; unread: number }> {
    const uid = idFromString(userId)
    const [all, unread] = await Promise.all([
      this.prisma.client.notification.count({ where: { userId: uid } }),
      this.prisma.client.notification.count({ where: { userId: uid, readAt: null } }),
    ])
    return { all, unread }
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.client.notification.count({ where: { userId: idFromString(userId), readAt: null } })
  }

  /** Sets `read_at` on the unread rows of the owner; returns how many there were. */
  async markAllRead(userId: string, now: Date): Promise<number> {
    const res = await this.prisma.client.notification.updateMany({ where: { userId: idFromString(userId), readAt: null }, data: { readAt: now } })
    return res.count
  }

  /** Marks the owner's rows in `ids` read (a row already read keeps its first `read_at`). Foreign ids match nothing. */
  async markManyRead(userId: string, ids: readonly string[], now: Date): Promise<number> {
    if (ids.length === 0) return 0
    const res = await this.prisma.client.notification.updateMany({
      where: { userId: idFromString(userId), id: { in: ids.map(idFromString) }, readAt: null },
      data: { readAt: now },
    })
    return res.count
  }

  /** True when the row exists AND is the owner's; an already read row keeps its first `read_at`. */
  async markRead(userId: string, id: string, now: Date): Promise<boolean> {
    const uid = idFromString(userId)
    const nid = idFromString(id)
    const res = await this.prisma.client.notification.updateMany({ where: { userId: uid, id: nid, readAt: null }, data: { readAt: now } })
    if (res.count === 1) return true
    // Count 0: already read (still the owner's), or unknown / foreign.
    return (await this.prisma.client.notification.count({ where: { userId: uid, id: nid } })) === 1
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const res = await this.prisma.client.notification.deleteMany({ where: { userId: idFromString(userId), id: idFromString(id) } })
    return res.count === 1
  }

  async removeMany(userId: string, ids: readonly string[]): Promise<number> {
    if (ids.length === 0) return 0
    const res = await this.prisma.client.notification.deleteMany({ where: { userId: idFromString(userId), id: { in: ids.map(idFromString) } } })
    return res.count
  }

  async create(userId: string, input: { type: string; category: string | null; title: string; body: string }, now: Date): Promise<NotificationRow> {
    const row = await this.prisma.client.notification.create({ data: { userId: idFromString(userId), ...input, createdAt: now } })
    return toRow(row)
  }
}
