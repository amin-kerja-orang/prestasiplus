/** Materialised table of M22 (SRS M22 v1.1 DATA-M22-01): `support_tickets`. New id = max + 1 (BR-M22-03). */

import { defineTable, maxPlusOne } from '@/mock/define'

import type { TicketStatus } from '../../api/types'

export interface TicketRow {
  id: number
  userId: number
  subject: string
  body: string
  status: TicketStatus
  adminReply: string | null
  /** ISO 8601 (+08:00). */
  createdAt: string
  updatedAt: string
}

export const ticketsTable = defineTable<TicketRow>({
  name: 'm22.supportTickets',
  ids: maxPlusOne(),
  indexes: ['userId', 'status'],
})
