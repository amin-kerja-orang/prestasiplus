/**
 * The `supportTickets` repository, owner **M22** (SRS M22 v1.1 DATA-M22-01, BR-M22-01). Other modules
 * never read it (D12). Named queries: Q-M22-USER, Q-M22-QUEUE, Q-M22-OPEN (§6.5).
 */

import { defineRepository } from '@/mock/repository'

import { TICKET_STATUSES, isTicketStatus } from '../../api/types'
import { ticketsTable, type TicketRow } from '../tables/tables'
import { nowIso } from './clock'

/** BR-M22-10: the queue returns at most 200 rows. */
export const QUEUE_LIMIT = 200

export const supportTicketsRepo = defineRepository({
  owner: 'M22',
  name: 'supportTickets',
  store: ticketsTable,
  methods: ({ store, transaction }) => ({
    /** Seed phase: rows with their ids kept. */
    seed(input: readonly TicketRow[]): void {
      transaction(() => {
        for (const r of input) store.insert({ ...r })
      })
    },

    /** Q-M22-USER: the user's tickets (id descending), optionally one vocabulary status; `total` = all of the user's. */
    forUser(userId: number, status?: string | null): { rows: TicketRow[]; total: number } {
      const total = store.count({ userId })
      const where = isTicketStatus(status) ? { userId, status } : { userId }
      const rows = store
        .query({ where, sort: { field: 'id', dir: 'desc' } })
        .rows.map((r) => ({ ...r }))
      return { rows, total }
    },

    /** Q-M22-QUEUE: rows filtered by exact status, `createdAt` desc then id desc, first 200; counts over all. */
    queue(status?: string | null): {
      rows: TicketRow[]
      total: number
      counts: { status: string; count: number }[]
    } {
      const grouped = store.groupCount('status')
      const known = TICKET_STATUSES.filter((s) => (grouped.get(s) ?? 0) > 0).map((s) => ({
        status: s,
        count: grouped.get(s) ?? 0,
      }))
      const counts = known
      const total = counts.reduce((n, c) => n + c.count, 0)
      const q = status === undefined || status === null || status === '' ? {} : { status }
      const rows = store
        .query({
          where: q as { status?: TicketRow['status'] },
          sort: [
            { field: 'createdAt', dir: 'desc' },
            { field: 'id', dir: 'desc' },
          ],
          page: 1,
          pageSize: QUEUE_LIMIT,
        })
        .rows.map((r) => ({ ...r }))
      return { rows, total, counts }
    },

    /** Q-M22-OPEN. */
    openCount(): number {
      return store.count({ status: 'dibuka' })
    },

    /** BR-M22-03: a new `dibuka` ticket owned by `userId`; `createdAt` = `updatedAt` = now. */
    create(userId: number, subject: string, body: string): TicketRow {
      const at = nowIso()
      return transaction(() =>
        store.insert({
          userId,
          subject,
          body,
          status: 'dibuka',
          adminReply: null,
          createdAt: at,
          updatedAt: at,
        }),
      )
    },

    get(id: number): TicketRow | undefined {
      const r = store.get(id)
      return r ? { ...r } : undefined
    },

    /** Test hooks only (BR-M22-16: the baseline has no write path). */
    patch(id: number, patch: Partial<TicketRow>): TicketRow | undefined {
      return transaction(() => (store.get(id) ? { ...store.update(id, patch) } : undefined))
    },

    removeAll(): void {
      transaction(() => {
        for (const r of store.query().rows) store.remove(r.id)
      })
    },

    all(): TicketRow[] {
      return store.query().rows.map((r) => ({ ...r }))
    },
  }),
})
