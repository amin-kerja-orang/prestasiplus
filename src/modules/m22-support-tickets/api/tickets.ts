/** M22 client (SRS M22 v1.1 §7 #1-#4, API-SUP-05). Failures reject with `ApiError` (401, 403, 422 `fields`). */

import { api } from '@/api'

import type { QueueList, Ticket, TicketDetail, TicketList, TicketStatus } from './types'

/** #1 `GET /api/tiket`. */
export const fetchTickets = (o: { status?: TicketStatus | null; signal?: AbortSignal } = {}) =>
  api.get<TicketList>('/api/tiket', {
    query: { status: o.status ?? null },
    raw: true,
    ...(o.signal ? { signal: o.signal } : {}),
  })

/** #2 `POST /api/tiket`. */
export const createTicket = (input: { subject: string; body: string }) =>
  api.post<Ticket>('/api/tiket', { body: input })

/** #3 `GET /api/admin/tiket`. */
export const fetchQueue = (o: { status?: string | null; page?: number; signal?: AbortSignal } = {}) =>
  api.get<QueueList>('/api/admin/tiket', {
    query: { status: o.status ?? null, page: o.page ?? null },
    raw: true,
    ...(o.signal ? { signal: o.signal } : {}),
  })

/** #4 `GET /api/admin/tiket/open-count`. */
export const fetchOpenCount = (o: { signal?: AbortSignal } = {}) =>
  api.get<{ count: number }>('/api/admin/tiket/open-count', o.signal ? { signal: o.signal } : {})

/** API-SUP-05 `GET /api/admin/tiket/:id`. */
export const fetchTicketDetail = (id: number, o: { signal?: AbortSignal } = {}) =>
  api.get<TicketDetail>(`/api/admin/tiket/${String(id)}`, o.signal ? { signal: o.signal } : {})

/** API-SUP-05 `PATCH /api/admin/tiket/:id/status`. */
export const setTicketStatus = (id: number, status: TicketStatus) =>
  api.patch<TicketDetail>(`/api/admin/tiket/${String(id)}/status`, { body: { status } })
