import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'

/**
 * M22 support tickets wire contract (BE-24, contract-only). Mock:
 * `src/modules/m22-support-tickets/mock/handlers/tickets.ts`, types in `.../api/types.ts`.
 *
 * Learners (any signed-in user) create and list their own tickets. Admin Pusat reads the queue and
 * sets the status (API-SUP-03, API-SUP-05). Ids are opaque strings (`Id`), not the mock integers.
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
/** Rows per page of the admin queue (API-SUP-03). */
export const SUPPORT_QUEUE_PER_PAGE = 25

/** Exact BM copy (SRS M22 8.2, PROPOSED copy). */
export const SUPPORT_MESSAGES = {
  subjectRequired: 'Subjek diperlukan.',
  bodyRequired: 'Butiran diperlukan.',
  subjectTooLong: 'Subjek tidak boleh melebihi 255 aksara.',
  bodyTooLong: 'Butiran tidak boleh melebihi 5000 aksara.',
} as const

/** Admin ticket messages with a source: 30 P20-03, ERR-REQ-12, ERR-REQ-01, ERR-ACC-04 (40 X10; rulings on #507). */
export const SUPPORT_ADMIN_MESSAGES = {
  replyRequired: 'Sila tulis balasan.',
  replyTooLong: 'Balasan tidak boleh melebihi 5000 aksara.',
  statusInvalid: 'Data yang dihantar tidak sah. Sila semak dan cuba lagi.',
  ticketNotFound: 'Rekod tidak dijumpai. Ia mungkin telah dipadam.',
} as const

/** Flashes after an admin save, approved by the product owner (PO batch 2 on #503). */
export const SUPPORT_ADMIN_FLASH = {
  replySaved: 'Balasan disimpan.',
  statusSaved: 'Status dikemas kini.',
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
    roleLabel: z.string().nullable().optional().meta({ description: 'Role label from `created_role`; null on an old row of a user with several roles. Sent once DM-32 lands.' }),
    school: z.string().nullable().optional().meta({ description: 'School from `school_id`. Sent once DM-32 lands.' }),
  })
  .meta({ id: 'SupportQueueRow' })

export const SupportQueueQuerySchema = z
  .object({
    status: z.string().optional().meta({ description: 'Exact SupportTicketStatus value; blank = all; an unknown value returns no rows.' }),
    role: z.string().optional().meta({ description: 'Exact role of `created_role`; an unknown value is ignored. Applies once DM-32 lands.' }),
    page: z.string().optional().meta({ description: 'Page number from 1, 25 rows per page; an odd value is page 1; a page past the end returns no rows.' }),
  })
  .meta({ id: 'SupportQueueQuery' })

/**
 * `meta` of `GET /admin/tiket`: `total` and `counts` cover the role-filtered tickets, whatever the status filter;
 * `counts` has all five statuses in vocabulary order; `matched` = rows matching both filters, for the pager.
 */
export const SupportQueueMetaSchema = z
  .strictObject({
    total: z.number().int().min(0),
    counts: z.array(z.strictObject({ status: SupportTicketStatusSchema, count: z.number().int().min(0) })),
    page: z.number().int().min(1),
    perPage: z.number().int().min(1),
    matched: z.number().int().min(0),
  })
  .meta({ id: 'SupportQueueMeta' })

export const SupportQueueResponseSchema = z
  .object({ data: z.array(SupportQueueRowSchema).max(SUPPORT_QUEUE_PER_PAGE), meta: SupportQueueMetaSchema })
  .meta({ id: 'SupportQueueResponse' })
export type SupportQueueResponse = z.infer<typeof SupportQueueResponseSchema>

/** `data` of `GET /admin/tiket/{id}` and of its reply and status writes (API-SUP-05). One admin reply, no thread (OD-4); no e-mail. */
export const SupportTicketDetailSchema = z
  .strictObject({
    id: IdSchema,
    subject: z.string(),
    body: z.string(),
    status: SupportTicketStatusSchema,
    roleLabel: z.string().nullable().meta({ description: 'Role label from `created_role`; null on an old row of a user with several roles.' }),
    school: z.string().nullable(),
    createdAt: TimestampSchema,
    adminReply: z.string().nullable(),
    repliedAt: TimestampSchema.nullable(),
  })
  .meta({ id: 'SupportTicketDetail' })
export type SupportTicketDetail = z.infer<typeof SupportTicketDetailSchema>

/** Body of `PUT /admin/tiket/{id}/reply`. The text is trimmed. */
export const SupportTicketReplyRequestSchema = z
  .object({
    text: z
      .string({ error: SUPPORT_ADMIN_MESSAGES.replyRequired })
      .trim()
      .min(1, { error: SUPPORT_ADMIN_MESSAGES.replyRequired })
      .max(SUPPORT_BODY_MAX, { error: SUPPORT_ADMIN_MESSAGES.replyTooLong }),
  })
  .meta({ id: 'SupportTicketReplyRequest' })
export type SupportTicketReplyRequest = z.infer<typeof SupportTicketReplyRequestSchema>

/** Body of `PATCH /admin/tiket/{id}/status`. */
export const SupportTicketStatusRequestSchema = z
  .object({ status: z.enum(SUPPORT_TICKET_STATUSES, { error: SUPPORT_ADMIN_MESSAGES.statusInvalid }) })
  .meta({ id: 'SupportTicketStatusRequest' })
export type SupportTicketStatusRequest = z.infer<typeof SupportTicketStatusRequestSchema>

/** `data` of `GET /admin/tiket/open-count`: tickets with status `dibuka`. */
export const SupportOpenCountSchema = z
  .strictObject({ count: z.number().int().min(0) })
  .meta({ id: 'SupportOpenCount' })
