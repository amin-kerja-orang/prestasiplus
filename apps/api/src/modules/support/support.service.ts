import { Inject, Injectable } from '@nestjs/common'
import {
  SUPPORT_ADMIN_MESSAGES,
  SUPPORT_QUEUE_PER_PAGE,
  SUPPORT_TICKET_STATUS_LABELS,
  type ContentSupportConfig,
  type SupportQueueResponse,
  type SupportTicket,
  type SupportTicketCreateRequest,
  type SupportTicketDetail,
  type SupportTicketStatus,
  type SupportTicketListResponse,
} from '@pp/contract'

import { AuditService } from '../../common/audit/audit.service'
import { ApiError } from '../../common/errors/api-error'
import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock } from '../../db/clock'
import type { TxClient } from '../../db/client'
import { PrismaService } from '../../db/prisma.service'
import { isOverloadError } from '../auth/auth.errors'
import { hasNul } from '../content/audio/null-char'
import { SUPPORT_AUDIT, SUPPORT_CONFIG_MISSING, WRITE_TX } from './support.constants'
import { isTicketStatus, SupportRepository, type TicketRow } from './support.repository'

/** Who is acting: the signed-in user and the request facts the audit row needs. */
export interface Actor {
  userId: string
  role: string
  sessionRowId: string
  scopeLevel: string
  schoolId: string | null
  isTest: boolean
  requestId: string | null
  ip: string | null
}

const ticketNotFound = (): ApiError => ApiError.of('NOT_FOUND', { message: SUPPORT_ADMIN_MESSAGES.ticketNotFound })

const toView = (r: TicketRow): SupportTicket => ({
  id: r.id,
  subject: r.subject,
  body: r.body,
  status: r.status,
  statusLabel: SUPPORT_TICKET_STATUS_LABELS[r.status],
  adminReply: r.adminReply,
  createdAt: toMytTimestamp(r.createdAt),
})

/** The admin's view of a ticket. `roleLabel`, `school` and `repliedAt` stay null until DM-32 stores them. */
const toDetail = (r: TicketRow): SupportTicketDetail => ({
  id: r.id,
  subject: r.subject,
  body: r.body,
  status: r.status,
  roleLabel: null,
  school: null,
  createdAt: toMytTimestamp(r.createdAt),
  adminReply: r.adminReply,
  repliedAt: null,
})

/** A `page` query value read tolerantly: an odd value is page 1 (never a 422). */
const pageOf = (raw: string | undefined): number => {
  const page = /^[0-9]{1,9}$/.test(raw ?? '') ? Number(raw) : 1
  return Math.max(page, 1)
}

@Injectable()
export class SupportService {
    constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SupportRepository) private readonly repo: SupportRepository,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** GET /tiket: the caller's own tickets. An unknown `status` is ignored (all tickets). */
  async listOwn(actor: Actor, status: string | undefined): Promise<SupportTicketListResponse> {
    const { rows, total, counts } = await this.guard(() => this.repo.listOfUser(actor.userId, isTicketStatus(status) ? status : null))
    return { data: rows.map(toView), meta: { total, counts } }
  }

  /** POST /tiket. The owner is the session user. The ticket and its audit row commit together. No notice is written (FR-X2-5, ruling on #508). */
  async create(actor: Actor, input: SupportTicketCreateRequest): Promise<SupportTicket> {
    const now = this.clock.now()
    const row = await this.write(async (tx) => {
      const created = await this.repo.create({ userId: actor.userId, subject: input.subject, body: input.body, isTest: actor.isTest, now })
      await this.audit.record({
        tx,
        action: SUPPORT_AUDIT.TICKET_CREATED,
        actorUserId: actor.userId,
        actorRole: actor.role,
        sessionRowId: actor.sessionRowId,
        scopeLevel: actor.scopeLevel,
        schoolId: actor.schoolId,
        requestId: actor.requestId,
        ip: actor.ip,
        isTest: actor.isTest,
        targetType: 'support_ticket',
        targetId: created.id,
        details: { ticketId: created.id },
      })
      return created
    })
    return toView(row)
  }

  /** GET /admin/tiket: 25 per page. */
  async queue(status: string | undefined, rawPage?: string): Promise<SupportQueueResponse> {
    const page = pageOf(rawPage)
    const { rows, total, matched, counts } = await this.guard(() => this.repo.queue(hasNul(status) ? '￿' : (status ?? '').trim(), page))
    return {
      data: rows.map((r) => ({
        id: r.id,
        createdAt: toMytTimestamp(r.createdAt),
        userName: r.userName,
        subject: r.subject,
        status: r.status,
        replied: r.replied,
      })),
      meta: { total, counts, page, perPage: SUPPORT_QUEUE_PER_PAGE, matched },
    }
  }

  /** GET /admin/tiket/:id: unknown id is 404. */
  async ticket(id: string): Promise<SupportTicketDetail> {
    const row = await this.guard(() => this.repo.getById(id))
    if (!row) throw ticketNotFound()
    return toDetail(row)
  }

  /** PATCH /admin/tiket/:id/status: the reply does not change. The status and its audit row commit together; setting the same status writes nothing. */
  async setStatus(actor: Actor, id: string, status: SupportTicketStatus): Promise<SupportTicketDetail> {
    const row = await this.write(async (tx) => {
      const current = await this.repo.getById(id)
      if (!current) throw ticketNotFound()
      if (current.status === status) return current
      const updated = await this.repo.setStatus(id, status, this.clock.now())
      await this.audit.record({
        tx,
        action: SUPPORT_AUDIT.TICKET_STATUS_CHANGED,
        actorUserId: actor.userId,
        actorRole: actor.role,
        sessionRowId: actor.sessionRowId,
        scopeLevel: actor.scopeLevel,
        schoolId: actor.schoolId,
        requestId: actor.requestId,
        ip: actor.ip,
        isTest: actor.isTest,
        targetType: 'support_ticket',
        targetId: id,
        details: { ticketId: id, before: current.status, after: status },
      })
      return updated
    })
    return toDetail(row)
  }

  async openCount(): Promise<{ count: number }> {
    return { count: await this.guard(() => this.repo.openCount()) }
  }

  /** GET /config/support (public): the contact from the singleton row. */
  async supportConfig(): Promise<ContentSupportConfig> {
    const config = await this.guard(() => this.repo.config())
    if (!config) throw ApiError.of('NOT_FOUND', { message: SUPPORT_CONFIG_MISSING })
    return config
  }

  // --- helpers ------------------------------------------------------------------------------------

  private async write<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.transaction(fn, WRITE_TX)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }

  /** A read: pool or connection overload is 429 (retryable), never a 500. */
  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }
}
