import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'

/**
 * M22 support tickets wire contract (BE-24, contract-only). Mock:
 * `src/modules/m22-support-tickets/mock/handlers/tickets.ts`, types in `.../api/types.ts`.
 *
 * Learners (any signed-in user) create and list their own tickets; the admin queue is read-only
 * (D27, DV-M22-07). There is no reply or status-change route (OQ-API-B4-21), so `adminReply` is
 * always null and new tickets stay `dibuka`. Ids are opaque strings (`Id`), not the mock integers.
 */

export const SUPPORT_TICKET_STATUSES = ['dibuka', 'dalam_proses', 'menunggu_balas', 'selesai', 'ditutup'] as const
export const SupportTicketStatusSchema = z.enum(SUPPORT_TICKET_STATUSES).meta({ id: 'SupportTicketStatus' })
export type SupportTicketStatus = z.infer<typeof SupportTicketStatusSchema>

/** BR-M22-02 labels (`statusLabel`). */
export const SUPPORT_TICKET_STATUS_LABELS = {
  dibuka: 'Dibuka',
  dalam_proses: 'Dalam Proses',
  menunggu_balas: 'Menunggu Balas',
  selesai: 'Selesai',
  ditutup: 'Ditutup',
} as const satisfies Record<SupportTicketStatus, string>

export const SUPPORT_SUBJECT_MAX = 255
export const SUPPORT_BODY_MAX = 5000
/** The admin queue returns the newest 200 tickets only (BR-M22-10). */
export const SUPPORT_QUEUE_LIMIT = 200

/** Exact BM copy (SRS M22 8.2, PROPOSED copy). */
export const SUPPORT_MESSAGES = {
  subjectRequired: 'Subjek diperlukan.',
  bodyRequired: 'Butiran diperlukan.',
  subjectTooLong: 'Subjek tidak boleh melebihi 255 aksara.',
  bodyTooLong: 'Butiran tidak boleh melebihi 5000 aksara.',
} as const

/** Page flash after a create (FR-M22-06). Client-side text: the create response carries no `status` key. */
export const SUPPORT_TICKET_CREATED_FLASH = 'Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin.'

/**
 * Notification every active admin receives when a ticket is created (BR-M22-12), sent through
 * `NotificationsService` (BE-06) with the push flag set. A notification failure never undoes the ticket.
 */
export const SUPPORT_NEW_TICKET_NOTIFICATION = {
  type: 'new_ticket',
  category: null,
  title: 'Tiket baru',
  body: 'Tiket sokongan baharu telah diterima.',
} as const

/** A ticket as its owner sees it (`GET /tiket` rows and the `data` of the create). */
export const SupportTicketSchema = z
  .strictObject({
    id: IdSchema,
    subject: z.string(),
    body: z.string(),
    status: SupportTicketStatusSchema,
    statusLabel: z.string(),
    adminReply: z.string().nullable(),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'SupportTicket' })
export type SupportTicket = z.infer<typeof SupportTicketSchema>

export const SupportTicketListQuerySchema = z
  .object({
    status: z.string().optional().meta({ description: 'A SupportTicketStatus value; an unknown value is ignored (all tickets). A `userId` here is ignored too.' }),
  })
  .meta({ id: 'SupportTicketListQuery' })

/** `meta` of `GET /tiket`: NOT the standard ListMeta; `total` counts all of the caller's tickets, whatever the filter. */
export const SupportTicketListMetaSchema = z
  .strictObject({ total: z.number().int().min(0) })
  .meta({ id: 'SupportTicketListMeta' })

export const SupportTicketListResponseSchema = z
  .object({ data: z.array(SupportTicketSchema), meta: SupportTicketListMetaSchema })
  .meta({ id: 'SupportTicketListResponse' })
export type SupportTicketListResponse = z.infer<typeof SupportTicketListResponseSchema>

/**
 * Body of `POST /tiket`. Both texts are trimmed. The owner always comes from the session: a
 * `userId` in the body or query is ignored (stripped by this schema).
 */
export const SupportTicketCreateRequestSchema = z
  .object({
    subject: z
      .string({ error: SUPPORT_MESSAGES.subjectRequired })
      .trim()
      .min(1, { error: SUPPORT_MESSAGES.subjectRequired })
      .max(SUPPORT_SUBJECT_MAX, { error: SUPPORT_MESSAGES.subjectTooLong }),
    body: z
      .string({ error: SUPPORT_MESSAGES.bodyRequired })
      .trim()
      .min(1, { error: SUPPORT_MESSAGES.bodyRequired })
      .max(SUPPORT_BODY_MAX, { error: SUPPORT_MESSAGES.bodyTooLong }),
  })
  .meta({ id: 'SupportTicketCreateRequest' })
export type SupportTicketCreateRequest = z.infer<typeof SupportTicketCreateRequestSchema>

/** Row of the admin queue: no body, no e-mail, no user id. */
export const SupportQueueRowSchema = z
  .strictObject({
    id: IdSchema,
    createdAt: TimestampSchema,
    userName: z.string().nullable(),
    subject: z.string(),
    status: SupportTicketStatusSchema,
    replied: z.boolean().meta({ description: 'adminReply is non-empty.' }),
  })
  .meta({ id: 'SupportQueueRow' })

export const SupportQueueQuerySchema = z
  .object({
    status: z.string().optional().meta({ description: 'Exact SupportTicketStatus value; blank = all; an unknown value returns no rows.' }),
  })
  .meta({ id: 'SupportQueueQuery' })

/** `meta` of `GET /admin/tiket`: `total` = all tickets; `counts` = statuses with a count above 0, in vocabulary order, over all tickets. */
export const SupportQueueMetaSchema = z
  .strictObject({
    total: z.number().int().min(0),
    counts: z.array(z.strictObject({ status: SupportTicketStatusSchema, count: z.number().int().min(1) })),
  })
  .meta({ id: 'SupportQueueMeta' })

export const SupportQueueResponseSchema = z
  .object({ data: z.array(SupportQueueRowSchema).max(SUPPORT_QUEUE_LIMIT), meta: SupportQueueMetaSchema })
  .meta({ id: 'SupportQueueResponse' })
export type SupportQueueResponse = z.infer<typeof SupportQueueResponseSchema>

/** `data` of `GET /admin/tiket/open-count`: tickets with status `dibuka`. */
export const SupportOpenCountSchema = z
  .strictObject({ count: z.number().int().min(0) })
  .meta({ id: 'SupportOpenCount' })
