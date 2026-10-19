import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import { SUPPORT_COMPONENT_SCHEMAS } from '../paths'
import {
  SUPPORT_BODY_MAX,
  SUPPORT_MESSAGES,
  SUPPORT_NEW_TICKET_NOTIFICATION,
  SUPPORT_SUBJECT_MAX,
  SUPPORT_TICKET_CREATED_FLASH,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_STATUS_LABELS,
  SupportOpenCountSchema,
  SupportQueueResponseSchema,
  SupportTicketCreateRequestSchema,
  SupportTicketListResponseSchema,
  SupportTicketSchema,
} from '../schema'

const AT = '2026-10-16T09:30:00+08:00'
const ticket = {
  id: '31',
  subject: 'Tidak boleh log masuk',
  body: 'Kata laluan saya ditolak.',
  status: 'dibuka',
  statusLabel: 'Dibuka',
  adminReply: null,
  createdAt: AT,
}

/** First message of a failed parse, per field. */
const messages = (value: unknown): Record<string, string> => {
  const r = SupportTicketCreateRequestSchema.safeParse(value)
  if (r.success) return {}
  return Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))
}

describe('ticket', () => {
  it('parses a ticket and rejects a bad status, a UTC timestamp and extra keys', () => {
    expect(SupportTicketSchema.safeParse(ticket).success).toBe(true)
    expect(SupportTicketSchema.safeParse({ ...ticket, adminReply: 'Sila set semula kata laluan.' }).success).toBe(true)
    expect(SupportTicketSchema.safeParse({ ...ticket, status: 'open' }).success).toBe(false)
    expect(SupportTicketSchema.safeParse({ ...ticket, createdAt: '2026-10-16T01:30:00Z' }).success).toBe(false)
    expect(SupportTicketSchema.safeParse({ ...ticket, userId: '1' }).success).toBe(false)
  })

  it('has a BM label for every status', () => {
    expect(Object.keys(SUPPORT_TICKET_STATUS_LABELS)).toEqual([...SUPPORT_TICKET_STATUSES])
    expect(SUPPORT_TICKET_STATUS_LABELS.menunggu_balas).toBe('Menunggu Balas')
  })

  it('list meta is { total }, not ListMeta', () => {
    expect(SupportTicketListResponseSchema.safeParse({ data: [ticket], meta: { total: 3 } }).success).toBe(true)
    expect(SupportTicketListResponseSchema.safeParse({ data: [ticket], meta: { total: 3, page: 1 } }).success).toBe(false)
    expect(SupportTicketListResponseSchema.safeParse({ data: [ticket] }).success).toBe(false)
  })
})

describe('create request', () => {
  it('accepts a valid body, trims it and ignores a client-sent userId', () => {
    const parsed = SupportTicketCreateRequestSchema.parse({ subject: '  Tidak boleh log masuk  ', body: ' Butiran ', userId: '99' })
    expect(parsed).toEqual({ subject: 'Tidak boleh log masuk', body: 'Butiran' })
    expect(SupportTicketCreateRequestSchema.safeParse({ subject: 'a'.repeat(SUPPORT_SUBJECT_MAX), body: 'b'.repeat(SUPPORT_BODY_MAX) }).success).toBe(true)
  })

  it('gives the exact BM messages', () => {
    expect(messages({})).toEqual({ subject: 'Subjek diperlukan.', body: 'Butiran diperlukan.' })
    expect(messages({ subject: '   ', body: '' })).toEqual({ subject: SUPPORT_MESSAGES.subjectRequired, body: SUPPORT_MESSAGES.bodyRequired })
    expect(messages({ subject: 'a'.repeat(256), body: 'ok' })).toEqual({ subject: 'Subjek tidak boleh melebihi 255 aksara.' })
    expect(messages({ subject: 'ok', body: 'b'.repeat(5001) })).toEqual({ body: 'Butiran tidak boleh melebihi 5000 aksara.' })
    expect(messages({ subject: 5, body: ['x'] })).toEqual({ subject: SUPPORT_MESSAGES.subjectRequired, body: SUPPORT_MESSAGES.bodyRequired })
  })

  it('keeps the flash and the admin notification copy', () => {
    expect(SUPPORT_TICKET_CREATED_FLASH).toBe('Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin.')
    expect(SUPPORT_NEW_TICKET_NOTIFICATION).toEqual({
      type: 'new_ticket',
      category: null,
      title: 'Tiket baru',
      body: 'Tiket sokongan baharu telah diterima.',
    })
  })

  it('error body carries the field messages', () => {
    const body = { error: { code: 'VALIDATION_ERROR', message: 'Subjek diperlukan. (and 1 more error)', fields: { subject: 'Subjek diperlukan.', body: 'Butiran diperlukan.' } } }
    expect(ErrorBodySchema.safeParse(body).success).toBe(true)
  })
})

describe('admin queue', () => {
  const row = { id: '31', createdAt: AT, userName: 'Murid Contoh', subject: 'Tidak boleh log masuk', status: 'dibuka', replied: false }
  const meta = { total: 2, counts: [{ status: 'dibuka', count: 1 }, { status: 'selesai', count: 1 }] }

  it('parses rows with meta.total and meta.counts', () => {
    expect(SupportQueueResponseSchema.safeParse({ data: [row], meta }).success).toBe(true)
    expect(SupportQueueResponseSchema.safeParse({ data: [{ ...row, userName: null }], meta: { total: 0, counts: [] } }).success).toBe(true)
  })

  it('never exposes the body, e-mail or user id, and is capped at 200 rows', () => {
    for (const leak of ['body', 'email', 'userId']) {
      expect(SupportQueueResponseSchema.safeParse({ data: [{ ...row, [leak]: 'x' }], meta }).success).toBe(false)
    }
    expect(SupportQueueResponseSchema.safeParse({ data: Array(201).fill(row), meta }).success).toBe(false)
    expect(SupportQueueResponseSchema.safeParse({ data: [row], meta: { total: 1, counts: [{ status: 'dibuka', count: 0 }] } }).success).toBe(false)
  })

  it('open count', () => {
    expect(SupportOpenCountSchema.safeParse({ count: 0 }).success).toBe(true)
    expect(SupportOpenCountSchema.safeParse({ count: -1 }).success).toBe(false)
  })
})

describe('openapi registration', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, unknown>>
    components: { schemas: Record<string, unknown> }
  }

  it('contains the four paths', () => {
    expect(Object.keys(doc.paths['/tiket'] ?? {}).sort()).toEqual(['get', 'post'])
    expect(doc.paths['/admin/tiket']).toHaveProperty('get')
    expect(doc.paths['/admin/tiket/open-count']).toHaveProperty('get')
  })

  it('contains every support component', () => {
    for (const name of Object.keys(SUPPORT_COMPONENT_SCHEMAS)) expect(doc.components.schemas).toHaveProperty(name)
    for (const name of Object.keys(SUPPORT_COMPONENT_SCHEMAS)) expect(name).toMatch(/^Support/)
  })
})
