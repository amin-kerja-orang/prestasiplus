import { Inject, Injectable } from '@nestjs/common'
import { SUPPORT_QUEUE_LIMIT, SUPPORT_TICKET_STATUSES, type SupportTicketStatus } from '@pp/contract'

import { idFromString, idToString, isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { UsersRepository } from '../users'
import { SUPPORT_CONFIG_ID } from './support.constants'

export interface TicketRow {
  id: string
  userId: string
  subject: string
  body: string
  status: SupportTicketStatus
  adminReply: string | null
  createdAt: Date
}

export interface QueueRow {
  id: string
  createdAt: Date
  userName: string | null
  subject: string
  status: SupportTicketStatus
  replied: boolean
}

interface DbTicket {
  id: bigint
  userId: bigint
  subject: string
  body: string
  status: string
  adminReply: string | null
  createdAt: Date
}

const toTicket = (r: DbTicket): TicketRow => ({
  id: idToString(r.id),
  userId: idToString(r.userId),
  subject: r.subject,
  body: r.body,
  status: r.status as SupportTicketStatus,
  adminReply: r.adminReply,
  createdAt: r.createdAt,
})

export const isTicketStatus = (value: unknown): value is SupportTicketStatus =>
  typeof value === 'string' && (SUPPORT_TICKET_STATUSES as readonly string[]).includes(value)

/**
 * The only doorway to `support_tickets` and `support_config`. Methods use `prisma.client`, so they join
 * the caller's transaction when there is one. The owner of a ticket is always a parameter set by the
 * service from the session, never read from a request.
 */
@Injectable()
export class SupportRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersRepository) private readonly users: UsersRepository,
  ) {}

  /** Ids of the active admins (the new-ticket notice recipients), through the users doorway. */
  activeAdminIds(): Promise<string[]> {
    return this.users.activeAdminIds()
  }

  async create(input: { userId: string; subject: string; body: string; isTest: boolean; now: Date }): Promise<TicketRow> {
    const row = await this.prisma.client.supportTicket.create({
      data: {
        userId: idFromString(input.userId),
        subject: input.subject,
        body: input.body,
        status: 'dibuka',
        isTest: input.isTest,
        createdAt: input.now,
        updatedAt: input.now,
      },
    })
    return toTicket(row)
  }

  /** The caller's tickets, newest id first; `total` counts all of them whatever the status filter. */
  async listOfUser(userId: string, status: SupportTicketStatus | null): Promise<{ rows: TicketRow[]; total: number }> {
    if (!isIdString(userId)) return { rows: [], total: 0 }
    const owner = idFromString(userId)
    const [rows, total] = await Promise.all([
      this.prisma.client.supportTicket.findMany({
        where: { userId: owner, ...(status ? { status } : {}) },
        orderBy: { id: 'desc' },
      }),
      this.prisma.client.supportTicket.count({ where: { userId: owner } }),
    ])
    return { rows: rows.map(toTicket), total }
  }

  /**
   * The admin queue: rows filtered by the exact status, newest first, at most 200. `counts` and `total`
   * are over every ticket (never the filtered ones); statuses with no ticket are left out, in vocabulary order.
   */
  async queue(status: string): Promise<{ rows: QueueRow[]; total: number; counts: { status: SupportTicketStatus; count: number }[] }> {
    const [rows, grouped] = await Promise.all([
      this.prisma.client.supportTicket.findMany({
        where: status === '' ? {} : { status },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: SUPPORT_QUEUE_LIMIT,
        select: { id: true, createdAt: true, subject: true, status: true, adminReply: true, user: { select: { name: true } } },
      }),
      this.prisma.client.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
    ])
    const byStatus = new Map(grouped.map((g) => [g.status, g._count._all]))
    const counts = SUPPORT_TICKET_STATUSES.flatMap((s) => {
      const count = byStatus.get(s) ?? 0
      return count > 0 ? [{ status: s, count }] : []
    })
    return {
      rows: rows.map((r) => ({
        id: idToString(r.id),
        createdAt: r.createdAt,
        userName: r.user.name,
        subject: r.subject,
        status: r.status as SupportTicketStatus,
        replied: r.adminReply !== null && r.adminReply !== '',
      })),
      total: counts.reduce((n, c) => n + c.count, 0),
      counts,
    }
  }

  async openCount(): Promise<number> {
    return this.prisma.client.supportTicket.count({ where: { status: 'dibuka' } })
  }

  async config(): Promise<{ email: string; whatsappNumber: string } | null> {
    const row = await this.prisma.client.supportConfig.findUnique({ where: { id: SUPPORT_CONFIG_ID } })
    return row ? { email: row.email, whatsappNumber: row.whatsappNumber } : null
  }
}
