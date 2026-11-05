import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import { SUPPORT_COMPONENT_SCHEMAS } from '../paths'
import {
  SUPPORT_ADMIN_MESSAGES,
  SUPPORT_ADMIN_FLASH,
  SUPPORT_BODY_MAX,
  SUPPORT_MESSAGES,
  SUPPORT_NEW_TICKET_NOTIFICATION,
  SUPPORT_QUEUE_PER_PAGE,
  SUPPORT_SUBJECT_MAX,
  SUPPORT_TICKET_CREATED_FLASH,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_STATUS_LABELS,
  SupportOpenCountSchema,
  SupportQueueResponseSchema,
  SupportTicketCreateRequestSchema,
  SupportTicketDetailSchema,
  SupportTicketListResponseSchema,
  SupportTicketReplyRequestSchema,
  SupportTicketSchema,
  SupportTicketStatusRequestSchema,
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
  const meta = { total: 2, counts: [{ status: 'dibuka', count: 1 }, { status: 'selesai', count: 1 }], page: 1, perPage: 25, matched: 2 }

  it('parses rows with meta.total and meta.counts', () => {
    expect(SupportQueueResponseSchema.safeParse({ data: [row], meta }).success).toBe(true)
    expect(SupportQueueResponseSchema.safeParse({ data: [{ ...row, userName: null }], meta: { total: 0, counts: [], page: 1, perPage: 25, matched: 0 } }).success).toBe(true)
  })

  it('never exposes the body, e-mail or user id, and is capped at one page', () => {
    for (const leak of ['body', 'email', 'userId']) {
      expect(SupportQueueResponseSchema.safeParse({ data: [{ ...row, [leak]: 'x' }], meta }).success).toBe(false)
    }
    expect(SupportQueueResponseSchema.safeParse({ data: Array(SUPPORT_QUEUE_PER_PAGE + 1).fill(row), meta }).success).toBe(false)
    expect(SupportQueueResponseSchema.safeParse({ data: [row], meta: { ...meta, counts: [{ status: 'dibuka', count: -1 }] } }).success).toBe(false)
  })

  it('takes a chip at 0, the pager meta and the role and school of a row (defects on #507)', () => {
    const paged = { total: 1, counts: [{ status: 'dibuka', count: 1 }, { status: 'selesai', count: 0 }], page: 1, perPage: 25, matched: 1 }
    expect(SupportQueueResponseSchema.safeParse({ data: [{ ...row, roleLabel: 'Murid', school: null }], meta: paged }).success).toBe(true)
    expect(SupportQueueResponseSchema.safeParse({ data: [row], meta: { ...paged, page: 0 } }).success).toBe(false)
  })

  it('takes the pager meta and the role and school of a row (defects on #507)', () => {
    const paged = { total: 1, counts: [{ status: 'dibuka', count: 1 }], page: 1, perPage: 25, matched: 1 }
    expect(SupportQueueResponseSchema.safeParse({ data: [{ ...row, roleLabel: 'Murid', school: null }], meta: paged }).success).toBe(true)
    expect(SupportQueueResponseSchema.safeParse({ data: [row], meta: { ...paged, page: 0 } }).success).toBe(false)
  })

  it('open count', () => {
    expect(SupportOpenCountSchema.safeParse({ count: 0 }).success).toBe(true)
    expect(SupportOpenCountSchema.safeParse({ count: -1 }).success).toBe(false)
  })
})

describe('admin ticket detail, reply and status (API-SUP-05)', () => {
  const detail = { id: '31', subject: 'S', body: 'B', status: 'dibuka', roleLabel: null, school: null, createdAt: AT, adminReply: null, repliedAt: null }

  it('parses the detail and refuses an e-mail or a user id', () => {
    expect(SupportTicketDetailSchema.parse({ ...detail, roleLabel: 'Murid', school: 'Sekolah Contoh', adminReply: 'Baik.', repliedAt: AT }).adminReply).toBe('Baik.')
    expect(SupportTicketDetailSchema.safeParse({ ...detail, email: 'a@b.test' }).success).toBe(false)
    expect(SupportTicketDetailSchema.safeParse({ ...detail, userId: '1' }).success).toBe(false)
  })

  it('the reply is trimmed, 1..5000, with the ERR catalogue messages', () => {
    const issue = (value: unknown) => SupportTicketReplyRequestSchema.safeParse(value).error?.issues[0]?.message
    expect(SupportTicketReplyRequestSchema.parse({ text: '  Baik.  ' }).text).toBe('Baik.')
    expect(issue({ text: '   ' })).toBe(SUPPORT_ADMIN_MESSAGES.replyRequired)
    expect(issue({})).toBe(SUPPORT_ADMIN_MESSAGES.replyRequired)
    expect(issue({ text: 'x'.repeat(SUPPORT_BODY_MAX + 1) })).toBe(SUPPORT_ADMIN_MESSAGES.replyTooLong)
  })

  it('the status is one of the five codes', () => {
    for (const status of SUPPORT_TICKET_STATUSES) expect(SupportTicketStatusRequestSchema.safeParse({ status }).success).toBe(true)
    expect(SupportTicketStatusRequestSchema.safeParse({ status: 'baru' }).error?.issues[0]?.message).toBe(SUPPORT_ADMIN_MESSAGES.statusInvalid)
  })

  it('keeps the two approved flashes', () => {
    expect(SUPPORT_ADMIN_FLASH).toEqual({ replySaved: 'Balasan disimpan.', statusSaved: 'Status dikemas kini.' })
  })
})

describe('openapi registration', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, unknown>>
    components: { schemas: Record<string, unknown> }
  }

  it('contains the support paths', () => {
    expect(Object.keys(doc.paths['/tiket'] ?? {}).sort()).toEqual(['get', 'post'])
    expect(doc.paths['/admin/tiket']).toHaveProperty('get')
    expect(doc.paths['/admin/tiket/open-count']).toHaveProperty('get')
    expect(doc.paths['/admin/tiket/{id}']).toHaveProperty('get')
    expect(doc.paths['/admin/tiket/{id}/reply']).toHaveProperty('put')
    expect(doc.paths['/admin/tiket/{id}/status']).toHaveProperty('patch')
  })

  it('contains every support component', () => {
    for (const name of Object.keys(SUPPORT_COMPONENT_SCHEMAS)) expect(doc.components.schemas).toHaveProperty(name)
    for (const name of Object.keys(SUPPORT_COMPONENT_SCHEMAS)) expect(name).toMatch(/^Support/)
  })
})
