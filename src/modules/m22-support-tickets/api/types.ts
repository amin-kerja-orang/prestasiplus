/** M22 contract types (SRS M22 v1.1 §6, §7) and the shared copy. */

export const TICKET_STATUSES = [
  'dibuka',
  'dalam_proses',
  'menunggu_balas',
  'selesai',
  'ditutup',
] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

/** BR-M22-02 labels. */
export const TICKET_STATUS_LABELS: Readonly<Record<TicketStatus, string>> = {
  dibuka: 'Dibuka',
  dalam_proses: 'Dalam Proses',
  menunggu_balas: 'Menunggu Balas',
  selesai: 'Selesai',
  ditutup: 'Ditutup',
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === 'string' && (TICKET_STATUSES as readonly string[]).includes(value)
}

export const SUBJECT_MAX = 255
export const BODY_MAX = 5000

/** SRS §8.2 #2 (PROPOSED copy). */
export const TICKET_MESSAGES = {
  subjectRequired: 'Subjek diperlukan.',
  bodyRequired: 'Butiran diperlukan.',
  subjectTooLong: 'Subjek tidak boleh melebihi 255 aksara.',
  bodyTooLong: 'Butiran tidak boleh melebihi 5000 aksara.',
} as const

/** FR-M22-06 (SERVER R5 flash). */
export const TICKET_CREATED_FLASH =
  'Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin.'

/** Rows per page of the admin queue (API-SUP-03). */
export const QUEUE_PER_PAGE = 25

/** Admin ticket messages with a source: ERR-REQ-01, ERR-ACC-04 (40 X10; rulings on #507). */
export const ADMIN_TICKET_MESSAGES = {
  statusInvalid: 'Data yang dihantar tidak sah. Sila semak dan cuba lagi.',
  ticketNotFound: 'Rekod tidak dijumpai. Ia mungkin telah dipadam.',
} as const

/** Flash after a status save, approved by the product owner (PO batch 2 on #503). */
export const ADMIN_TICKET_FLASH = {
  statusSaved: 'Status dikemas kini.',
} as const

/** `Ticket` of §7. */
export interface Ticket {
  id: number
  subject: string
  body: string
  status: TicketStatus
  statusLabel: string
  adminReply: string | null
  createdAt: string
}

export interface TicketList {
  data: Ticket[]
  meta: { total: number }
}

/** `QueueRow` of §7 (no body, no e-mail, no user id). */
export interface QueueRow {
  id: number
  createdAt: string
  userName: string | null
  subject: string
  status: TicketStatus
  replied: boolean
}

export interface QueueList {
  data: QueueRow[]
  meta: {
    total: number
    counts: { status: TicketStatus; count: number }[]
    page: number
    perPage: number
    matched: number
  }
}

/** API-SUP-05 detail: one admin reply, no thread, no e-mail. */
export interface TicketDetail {
  id: number
  subject: string
  body: string
  status: TicketStatus
  roleLabel: string | null
  school: string | null
  createdAt: string
  adminReply: string | null
  repliedAt: string | null
}
