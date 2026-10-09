/**
 * SRS M22 v1.1 §7 #1-#4. Guard AU = any signed-in user (the user is forced from the session, `userId` in
 * query or body is ignored, FR-M22-25); guard AD = role `admin` (DV-M22-07, read-only queue, D27).
 *
 * A create also notifies every active `admin` through M01 `pushNotification` (BR-M22-12, XR-M22-01): the
 * hook is reached through the M01 plugin (`hooks`), the only public path; a failure never undoes the ticket.
 */

import {
  created,
  ok,
  queryString,
  requireAuth,
  requireRole,
  route,
  validationError,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import m01, { users } from '@/modules/m01-authentication/mock'

import {
  BODY_MAX,
  SUBJECT_MAX,
  TICKET_MESSAGES as MSG,
  TICKET_STATUS_LABELS,
  isTicketStatus,
  type Ticket,
} from '../../api/types'
import { supportTicketsRepo } from '../repository/tickets'
import type { TicketRow } from '../tables/tables'

const signedIn = requireAuth()
const adminOnly = requireRole('admin')

/** BR-M22-12 notification content. */
export const NEW_TICKET_NOTIFICATION = {
  type: 'new_ticket',
  category: null,
  title: 'Tiket baru',
  body: 'Tiket sokongan baharu telah diterima.',
} as const

type PushFn = (
  userId: number,
  n: { type: string; category: null; title: string; body: string },
  o?: { push?: boolean },
) => unknown

/** Every active platform admin (XR-M22-01 fallback: `adminList`). */
function activeAdminIds(): number[] {
  const ids: number[] = []
  const pageSize = 500
  for (let page = 1; ; page += 1) {
    const { rows, total } = users.adminList({ role: 'admin', isActive: true, page, pageSize })
    ids.push(...rows.map((r) => r.id))
    if (page * pageSize >= total || rows.length === 0) break
  }
  return ids
}

function notifyAdmins(): void {
  const push = m01.hooks.pushNotification as unknown as PushFn
  for (const id of activeAdminIds()) {
    try {
      push(id, { ...NEW_TICKET_NOTIFICATION }, { push: true })
    } catch {
      // BR-M22-12: failure to notify does not undo the ticket.
    }
  }
}

export const toTicket = (r: TicketRow): Ticket => ({
  id: r.id,
  subject: r.subject,
  body: r.body,
  status: r.status,
  statusLabel: TICKET_STATUS_LABELS[r.status],
  adminReply: r.adminReply,
  createdAt: r.createdAt,
})

// #1
function listOwn(req: MockRequest): MockResponse {
  const status = queryString(req.query, 'status')
  const { rows, total } = supportTicketsRepo.forUser(
    req.session?.userId ?? -1,
    isTicketStatus(status) ? status : null,
  )
  return ok(rows.map(toTicket), { meta: { total } })
}

// #2
function create(req: MockRequest): MockResponse {
  const body = (
    typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body) ? req.body : {}
  ) as Record<string, unknown>
  const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  const fields: Record<string, string> = {}
  if (subject === '') fields.subject = MSG.subjectRequired
  else if (subject.length > SUBJECT_MAX) fields.subject = MSG.subjectTooLong
  if (text === '') fields.body = MSG.bodyRequired
  else if (text.length > BODY_MAX) fields.body = MSG.bodyTooLong
  if (Object.keys(fields).length > 0) return validationError(fields)

  const row = supportTicketsRepo.create(req.session?.userId ?? -1, subject, text)
  notifyAdmins()
  return created(toTicket(row))
}

// #3
function queue(req: MockRequest): MockResponse {
  const status = queryString(req.query, 'status') ?? ''
  const { rows, total, counts } = supportTicketsRepo.queue(status)
  return ok(
    rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      userName: users.get(r.userId)?.name ?? null,
      subject: r.subject,
      status: r.status,
      replied: r.adminReply !== null && r.adminReply !== '',
    })),
    { meta: { total, counts } },
  )
}

// #4
const openCount = (): MockResponse => ok({ count: supportTicketsRepo.openCount() })

export const ticketRoutes: readonly RouteDef[] = [
  route('GET', '/api/tiket', [signedIn], listOwn),
  route('POST', '/api/tiket', [signedIn], create),
  route('GET', '/api/admin/tiket', [adminOnly], queue),
  route('GET', '/api/admin/tiket/open-count', [adminOnly], openCount),
]
