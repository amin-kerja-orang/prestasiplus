import { Inject, Injectable } from '@nestjs/common'
import { SUPPORT_QUEUE_PER_PAGE, SUPPORT_TICKET_STATUSES, type SupportTicketStatus } from '@pp/contract'

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
  role: string | null
  school: string | null
}

/** A ticket as the admin reads it (API-SUP-05). */
export interface TicketDetailRow extends TicketRow {
  role: string | null
  school: string | null
  repliedAt: Date | null
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

  /** `role` is the active role at creation and the school is a snapshot of the user's school (DM-32). */
  async create(input: { userId: string; role: string; subject: string; body: string; isTest: boolean; now: Date }): Promise<TicketRow> {
    const userId = idFromString(input.userId)
    const owner = await this.prisma.client.user.findUnique({ where: { id: userId }, select: { schoolId: true } })
    const row = await this.prisma.client.supportTicket.create({
      data: {
        userId,
        createdRole: input.role,
        schoolId: owner?.schoolId ?? null,
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
   * The admin queue: one page of the rows with the exact status and role, newest first. `counts` and `total` follow
   * the role filter and ignore the status filter; `counts` has all five statuses in vocabulary order, so a chip at 0
   * exists. `matched` counts the rows of both filters, for the pager.
   */
  async queue(status: string, role: string | null, page: number): Promise<{ rows: QueueRow[]; total: number; matched: number; counts: { status: SupportTicketStatus; count: number }[] }> {
    const byRole = role === null ? {} : { createdRole: role }
    const where = status === '' ? byRole : { ...byRole, status }
    const [rows, matched, grouped] = await Promise.all([
      this.prisma.client.supportTicket.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * SUPPORT_QUEUE_PER_PAGE,
        take: SUPPORT_QUEUE_PER_PAGE,
        select: { id: true, createdAt: true, subject: true, status: true, adminReply: true, createdRole: true, user: { select: { name: true } }, school: { select: { name: true } } },
      }),
      this.prisma.client.supportTicket.count({ where }),
      this.prisma.client.supportTicket.groupBy({ by: ['status'], where: byRole, _count: { _all: true } }),
    ])
    const byStatus = new Map(grouped.map((g) => [g.status, g._count._all]))
    const counts = SUPPORT_TICKET_STATUSES.map((s) => ({ status: s, count: byStatus.get(s) ?? 0 }))
    return {
      matched,
      rows: rows.map((r) => ({
        id: idToString(r.id),
        createdAt: r.createdAt,
        userName: r.user.name,
        subject: r.subject,
        status: r.status as SupportTicketStatus,
        replied: r.adminReply !== null && r.adminReply !== '',
        role: r.createdRole,
        school: r.school?.name ?? null,
      })),
      total: counts.reduce((n, c) => n + c.count, 0),
      counts,
    }
  }

  /** One ticket for the admin; an id that cannot exist is simply not found. */
  async getById(id: string): Promise<TicketRow | null> {
    if (!isIdString(id)) return null
    const row = await this.prisma.client.supportTicket.findUnique({ where: { id: idFromString(id) } })
    return row ? toTicket(row) : null
  }

  /** One ticket with its context for the admin. */
  async getDetail(id: string): Promise<TicketDetailRow | null> {
    if (!isIdString(id)) return null
    const row = await this.prisma.client.supportTicket.findUnique({ where: { id: idFromString(id) }, include: { school: { select: { name: true } } } })
    return row ? { ...toTicket(row), role: row.createdRole, school: row.school?.name ?? null, repliedAt: row.adminRepliedAt } : null
  }

  /** The single admin reply: a later save replaces it. The status does not change. */
  async saveReply(id: string, input: { text: string; repliedById: string; now: Date }): Promise<void> {
    await this.prisma.client.supportTicket.update({
      where: { id: idFromString(id) },
      data: { adminReply: input.text, adminRepliedById: idFromString(input.repliedById), adminRepliedAt: input.now, updatedAt: input.now },
    })
  }

  async setStatus(id: string, status: SupportTicketStatus, now: Date): Promise<TicketRow> {
    return toTicket(await this.prisma.client.supportTicket.update({ where: { id: idFromString(id) }, data: { status, updatedAt: now } }))
  }

  async openCount(): Promise<number> {
    return this.prisma.client.supportTicket.count({ where: { status: 'dibuka' } })
  }

  async config(): Promise<{ email: string; whatsappNumber: string } | null> {
    const row = await this.prisma.client.supportConfig.findUnique({ where: { id: SUPPORT_CONFIG_ID } })
    return row ? { email: row.email, whatsappNumber: row.whatsappNumber } : null
  }
}
