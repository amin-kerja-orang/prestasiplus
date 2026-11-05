/**
 * SRS M22 v1.1 §7 #1-#4, API-SUP-05. Guard AU = any signed-in user (the user is forced from the session,
 * `userId` in query or body is ignored, FR-M22-25); guard AD = role `admin` (DV-M22-07).
 *
 * A create writes no notice (FR-X2-5, ruling on #508).
 */

import {
  created,
  int,
  notFound,
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
import { users } from '@/modules/m01-authentication/mock'

import {
  ADMIN_TICKET_MESSAGES,
  BODY_MAX,
  QUEUE_PER_PAGE,
  SUBJECT_MAX,
  TICKET_MESSAGES as MSG,
  TICKET_STATUS_LABELS,
  isTicketStatus,
  type Ticket,
  type TicketDetail,
} from '../../api/types'
import { supportTicketsRepo } from '../repository/tickets'
import type { TicketRow } from '../tables/tables'

const signedIn = requireAuth()
const adminOnly = requireRole('admin')

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
  const { rows, total, counts } = supportTicketsRepo.forUser(
    req.session?.userId ?? -1,
    isTicketStatus(status) ? status : null,
  )
  return ok(rows.map(toTicket), { meta: { total, counts } })
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
  return created(toTicket(row))
}

// #3
function queue(req: MockRequest): MockResponse {
  const status = queryString(req.query, 'status') ?? ''
  const rawPage = queryString(req.query, 'page') ?? ''
  const page = /^[0-9]{1,9}$/.test(rawPage) ? Math.max(Number(rawPage), 1) : 1
  const { rows, total, matched, counts } = supportTicketsRepo.queue(status, page)
  return ok(
    rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      userName: users.get(r.userId)?.name ?? null,
      subject: r.subject,
      status: r.status,
      replied: r.adminReply !== null && r.adminReply !== '',
    })),
    { meta: { total, counts, page, perPage: QUEUE_PER_PAGE, matched } },
  )
}

// #4
const openCount = (): MockResponse => ok({ count: supportTicketsRepo.openCount() })

/** API-SUP-05 detail; `roleLabel`, `school` and `repliedAt` stay null until DM-32, as on the server. */
const toDetail = (r: TicketRow): TicketDetail => ({
  id: r.id,
  subject: r.subject,
  body: r.body,
  status: r.status,
  roleLabel: null,
  school: null,
  createdAt: r.createdAt,
  adminReply: r.adminReply,
  repliedAt: null,
})

function detail(req: MockRequest): MockResponse {
  const row = supportTicketsRepo.get(Number(req.params.id))
  return row ? ok(toDetail(row)) : notFound(ADMIN_TICKET_MESSAGES.ticketNotFound)
}

function setStatus(req: MockRequest): MockResponse {
  const body = (
    typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body) ? req.body : {}
  ) as Record<string, unknown>
  if (!isTicketStatus(body.status)) {
    return validationError({ status: ADMIN_TICKET_MESSAGES.statusInvalid })
  }
  const row = supportTicketsRepo.setStatus(Number(req.params.id), body.status)
  return row ? ok(toDetail(row)) : notFound(ADMIN_TICKET_MESSAGES.ticketNotFound)
}

export const ticketRoutes: readonly RouteDef[] = [
  route('GET', '/api/tiket', [signedIn], listOwn),
  route('POST', '/api/tiket', [signedIn], create),
  route('GET', '/api/admin/tiket', [adminOnly], queue),
  route('GET', '/api/admin/tiket/open-count', [adminOnly], openCount),
  route('GET', '/api/admin/tiket/:id', [adminOnly], detail, { params: { id: int() } }),
  route('PATCH', '/api/admin/tiket/:id/status', [adminOnly], setStatus, { params: { id: int() } }),
]
