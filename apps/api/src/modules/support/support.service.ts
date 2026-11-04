import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  SUPPORT_ADMIN_MESSAGES,
  SUPPORT_NEW_TICKET_NOTIFICATION,
  SUPPORT_QUEUE_PER_PAGE,
  SUPPORT_ROLE_LABELS,
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
import { NotificationsService } from '../notifications'
import { NOTIFY_BATCH, SUPPORT_AUDIT, SUPPORT_CONFIG_MISSING, WRITE_TX } from './support.constants'
import { isTicketStatus, SupportRepository, type TicketDetailRow, type TicketRow } from './support.repository'

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

const roleLabelOf = (role: string | null): string | null => (role === null ? null : (SUPPORT_ROLE_LABELS[role] ?? null))

/** The admin's view of a ticket. */
const toDetail = (r: TicketDetailRow): SupportTicketDetail => ({
  id: r.id,
  subject: r.subject,
  body: r.body,
  status: r.status,
  roleLabel: roleLabelOf(r.role),
  school: r.school,
  createdAt: toMytTimestamp(r.createdAt),
  adminReply: r.adminReply,
  repliedAt: r.repliedAt ? toMytTimestamp(r.repliedAt) : null,
})

/** A `page` query value read tolerantly: an odd value is page 1 (never a 422). */
const pageOf = (raw: string | undefined): number => {
  const page = /^[0-9]{1,9}$/.test(raw ?? '') ? Number(raw) : 1
  return Math.max(page, 1)
}

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SupportRepository) private readonly repo: SupportRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  /** GET /tiket: the caller's own tickets. An unknown `status` is ignored (all tickets). */
  async listOwn(actor: Actor, status: string | undefined): Promise<SupportTicketListResponse> {
    const { rows, total } = await this.guard(() => this.repo.listOfUser(actor.userId, isTicketStatus(status) ? status : null))
    return { data: rows.map(toView), meta: { total } }
  }

  /**
   * POST /tiket. The owner is the session user. The ticket and its audit row commit together; the
   * admin notices go out AFTER the commit and a failure there never fails the request.
   */
  async create(actor: Actor, input: SupportTicketCreateRequest): Promise<SupportTicket> {
    const now = this.clock.now()
    const row = await this.write(async (tx) => {
      const created = await this.repo.create({ userId: actor.userId, role: actor.role, subject: input.subject, body: input.body, isTest: actor.isTest, now })
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
    await this.notifyAdmins()
    return toView(row)
  }

  /** GET /admin/tiket: 25 per page. An unknown `role` is ignored. */
  async queue(status: string | undefined, rawPage?: string, rawRole?: string): Promise<SupportQueueResponse> {
    const page = pageOf(rawPage)
    const role = rawRole !== undefined && Object.hasOwn(SUPPORT_ROLE_LABELS, rawRole) ? rawRole : null
    const { rows, total, matched, counts } = await this.guard(() => this.repo.queue(hasNul(status) ? '￿' : (status ?? '').trim(), role, page))
    return {
      data: rows.map((r) => ({
        id: r.id,
        createdAt: toMytTimestamp(r.createdAt),
        userName: r.userName,
        subject: r.subject,
        status: r.status,
        replied: r.replied,
        roleLabel: roleLabelOf(r.role),
        school: r.school,
      })),
      meta: { total, counts, page, perPage: SUPPORT_QUEUE_PER_PAGE, matched },
    }
  }

  /** GET /admin/tiket/:id: unknown id is 404. */
  async ticket(id: string): Promise<SupportTicketDetail> {
    const row = await this.guard(() => this.repo.getDetail(id))
    if (!row) throw ticketNotFound()
    return toDetail(row)
  }

  /** PUT /admin/tiket/:id/reply: saves the single reply; the status does not change. The reply and its audit row commit together; the audit never holds the text. */
  async reply(actor: Actor, id: string, text: string): Promise<SupportTicketDetail> {
    const row = await this.write(async (tx) => {
      const current = await this.repo.getDetail(id)
      if (!current) throw ticketNotFound()
      await this.repo.saveReply(id, { text, repliedById: actor.userId, now: this.clock.now() })
      await this.audit.record({
        tx,
        action: SUPPORT_AUDIT.TICKET_REPLIED,
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
        details: { ticketId: id, replaced: current.adminReply !== null },
      })
      return this.repo.getDetail(id)
    })
    if (!row) throw ticketNotFound()
    return toDetail(row)
  }

  /** PATCH /admin/tiket/:id/status: the reply does not change. The status and its audit row commit together; setting the same status writes nothing. */
  async setStatus(actor: Actor, id: string, status: SupportTicketStatus): Promise<SupportTicketDetail> {
    const row = await this.write(async (tx) => {
      const current = await this.repo.getDetail(id)
      if (!current) throw ticketNotFound()
      if (current.status === status) return current
      await this.repo.setStatus(id, status, this.clock.now())
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
      return { ...current, status }
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

  /** One notice per active admin (type `new_ticket`, push flag set). Never throws: a failure is logged and skipped. */
  private async notifyAdmins(): Promise<void> {
    let ids: string[]
    try {
      ids = await this.repo.activeAdminIds()
    } catch {
      this.logger.warn('Could not list the admins to notify of a new ticket')
      return
    }
    for (let i = 0; i < ids.length; i += NOTIFY_BATCH) {
      const batch = ids.slice(i, i + NOTIFY_BATCH)
      const results = await Promise.allSettled(batch.map((id) => this.notifications.push(id, { ...SUPPORT_NEW_TICKET_NOTIFICATION }, { push: true })))
      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed > 0) this.logger.warn(`${String(failed)} new-ticket notice(s) failed`)
    }
  }

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
