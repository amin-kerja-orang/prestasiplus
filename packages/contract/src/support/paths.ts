import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { envelopeOf } from '../common/envelope'
import {
  SupportOpenCountSchema,
  SupportQueueMetaSchema,
  SupportQueueQuerySchema,
  SupportQueueResponseSchema,
  SupportQueueRowSchema,
  SupportTicketCreateRequestSchema,
  SupportTicketListMetaSchema,
  SupportTicketListQuerySchema,
  SupportTicketListResponseSchema,
  SupportTicketSchema,
  SupportTicketStatusSchema,
} from './schema'

/** Components contributed by BE-24 (M22 support tickets); appended to COMPONENT_SCHEMAS in openapi.ts. */
export const SUPPORT_COMPONENT_SCHEMAS = {
  SupportTicketStatus: SupportTicketStatusSchema,
  SupportTicket: SupportTicketSchema,
  SupportTicketListQuery: SupportTicketListQuerySchema,
  SupportTicketListMeta: SupportTicketListMetaSchema,
  SupportTicketListResponse: SupportTicketListResponseSchema,
  SupportTicketCreateRequest: SupportTicketCreateRequestSchema,
  SupportQueueRow: SupportQueueRowSchema,
  SupportQueueQuery: SupportQueueQuerySchema,
  SupportQueueMeta: SupportQueueMetaSchema,
  SupportQueueResponse: SupportQueueResponseSchema,
  SupportOpenCount: SupportOpenCountSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

/** Registers the four support-ticket endpoints (M22). Bodies are `{ data, meta? }` or `{ error }`. */
export function registerSupportPaths(registry: OpenAPIRegistry): void {
  const csrf = z.object({
    'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
  })
  const unauthorized = err('UNAUTHORIZED: no valid session.')
  const adminOnly = err('FORBIDDEN "This action is unauthorized." (not an admin).')

  registry.registerPath({
    method: 'get',
    path: '/tiket',
    tags: ['support'],
    summary: 'Own support tickets',
    description:
      'Any signed-in user. Only the caller tickets are returned (a userId query value is ignored), newest id first, not paginated. `meta.total` counts all of the caller tickets whatever the status filter.',
    request: { query: SupportTicketListQuerySchema },
    responses: { 200: json(SupportTicketListResponseSchema, 'Tickets with meta.total.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'post',
    path: '/tiket',
    tags: ['support'],
    summary: 'Create a support ticket',
    description:
      'Any signed-in user; the owner is the session user. The ticket starts `dibuka` with adminReply null. Every active admin is notified (type new_ticket, title "Tiket baru", body "Tiket sokongan baharu telah diterima.") through NotificationsService; a notification failure never undoes the ticket. The page flash "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin." is client-side text.',
    request: {
      headers: [csrf],
      body: { required: true, content: { 'application/json': { schema: SupportTicketCreateRequestSchema } } },
    },
    responses: {
      201: json(envelopeOf(SupportTicketSchema), 'Ticket created.'),
      401: unauthorized,
      403: err('CSRF_INVALID (missing or wrong X-CSRF-Token).'),
      422: err(
        'VALIDATION_ERROR with fields: subject "Subjek diperlukan." or "Subjek tidak boleh melebihi 255 aksara."; body "Butiran diperlukan." or "Butiran tidak boleh melebihi 5000 aksara." Top-level message is the first field message (+ " (and 1 more error)" when both fail).',
      ),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/tiket',
    tags: ['support'],
    summary: 'Admin support queue (read-only)',
    description:
      'Admin only (D27: read-only, no reply or status change). Newest first (createdAt desc, then id desc), first 200 rows only. `meta.total` = all tickets; `meta.counts` = statuses with a count above 0, in vocabulary order, over all tickets (not the filtered ones).',
    request: { query: SupportQueueQuerySchema },
    responses: { 200: json(SupportQueueResponseSchema, 'Queue rows with meta.total and meta.counts.'), 401: unauthorized, 403: adminOnly },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/tiket/open-count',
    tags: ['support'],
    summary: 'Count of open tickets (badge)',
    description: 'Admin only. `count` = tickets with status `dibuka`.',
    responses: { 200: json(envelopeOf(SupportOpenCountSchema), 'Open ticket count.'), 401: unauthorized, 403: adminOnly },
  })
}
