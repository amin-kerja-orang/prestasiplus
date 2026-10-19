import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import { NOTIFICATIONS_COMPONENT_SCHEMAS } from '../paths'
import {
  NOTIFICATIONS_PAGE_SIZE,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_IDS_REQUIRED,
  NotificationBulkRequestSchema,
  NotificationInputSchema,
  NotificationItemSchema,
  NotificationListQuerySchema,
  NotificationListResponseSchema,
  NotificationReadAllResultSchema,
  NotificationSuccessSchema,
  NotificationUnreadCountSchema,
} from '../schema'

const AT = '2026-10-16T09:30:00+08:00'
const item = {
  id: '12',
  userId: '7',
  type: 'spaced_review',
  category: 'reminder',
  title: 'Masa mengulang kaji',
  body: 'Ada soalan menunggu anda.',
  readAt: null,
  createdAt: AT,
}
const meta = { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, from: 1, to: 1, counts: { all: 3, unread: 1 } }

describe('notification item', () => {
  it('parses unread and read items, with or without a category', () => {
    expect(NotificationItemSchema.safeParse(item).success).toBe(true)
    expect(NotificationItemSchema.safeParse({ ...item, readAt: AT }).success).toBe(true)
    expect(NotificationItemSchema.safeParse({ ...item, category: null, type: 'new_ticket' }).success).toBe(true)
    expect([...NOTIFICATION_CATEGORIES]).toEqual(['system', 'reminder', 'milestone'])
  })

  it('rejects numeric ids, an unknown category, a UTC timestamp and extra keys', () => {
    expect(NotificationItemSchema.safeParse({ ...item, id: 12 }).success).toBe(false)
    expect(NotificationItemSchema.safeParse({ ...item, userId: 7 }).success).toBe(false)
    expect(NotificationItemSchema.safeParse({ ...item, category: 'promo' }).success).toBe(false)
    expect(NotificationItemSchema.safeParse({ ...item, createdAt: '2026-10-16T01:30:00Z' }).success).toBe(false)
    expect(NotificationItemSchema.safeParse({ ...item, readAt: '2026-10-16' }).success).toBe(false)
    expect(NotificationItemSchema.safeParse({ ...item, push: true }).success).toBe(false)
  })

  it('push input needs type, title and body; category is optional', () => {
    expect(NotificationInputSchema.safeParse({ type: 'new_ticket', category: null, title: 'Tiket baru', body: 'Tiket sokongan baharu telah diterima.' }).success).toBe(true)
    expect(NotificationInputSchema.safeParse({ type: 'x', title: 't', body: 'b' }).success).toBe(true)
    expect(NotificationInputSchema.safeParse({ type: 'x', title: 't' }).success).toBe(false)
  })
})

describe('list', () => {
  it('page size is 20; meta carries counts { all, unread }', () => {
    expect(NOTIFICATIONS_PAGE_SIZE).toBe(20)
    expect(NotificationListResponseSchema.safeParse({ data: [item], meta }).success).toBe(true)
    expect(NotificationListResponseSchema.safeParse({ data: [], meta: { ...meta, totalItems: 0, from: null, to: null } }).success).toBe(true)
    expect(NotificationListResponseSchema.safeParse({ data: Array(21).fill(item), meta }).success).toBe(false)
  })

  it('rejects meta without counts or with bad counts', () => {
    const noCounts = { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, from: 1, to: 1 }
    expect(NotificationListResponseSchema.safeParse({ data: [item], meta: noCounts }).success).toBe(false)
    expect(NotificationListResponseSchema.safeParse({ data: [item], meta: { ...meta, counts: { all: 1 } } }).success).toBe(false)
    expect(NotificationListResponseSchema.safeParse({ data: [item], meta: { ...meta, counts: { all: 1, unread: -1 } } }).success).toBe(false)
  })

  it('unknown filter, type and page values are accepted (the server ignores them)', () => {
    expect(NotificationListQuerySchema.safeParse({}).success).toBe(true)
    expect(NotificationListQuerySchema.safeParse({ filter: 'bogus', type: 'bogus', page: 'abc' }).success).toBe(true)
  })

  it('small responses', () => {
    expect(NotificationUnreadCountSchema.safeParse({ count: 0 }).success).toBe(true)
    expect(NotificationUnreadCountSchema.safeParse({ count: -1 }).success).toBe(false)
    expect(NotificationReadAllResultSchema.safeParse({ updated: 4 }).success).toBe(true)
    expect(NotificationSuccessSchema.safeParse({ success: true }).success).toBe(true)
    expect(NotificationSuccessSchema.safeParse({ success: false }).success).toBe(false)
  })
})

describe('bulk body', () => {
  const messages = (v: unknown) => {
    const r = NotificationBulkRequestSchema.safeParse(v)
    return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
  }
  it('needs a non-empty list of ids', () => {
    expect(NotificationBulkRequestSchema.safeParse({ ids: ['1', '2'] }).success).toBe(true)
    expect(messages({})).toEqual([`ids: ${NOTIFICATION_IDS_REQUIRED}`])
    expect(messages({ ids: [] })).toEqual([`ids: ${NOTIFICATION_IDS_REQUIRED}`])
    expect(messages({ ids: 'x' })).toEqual([`ids: ${NOTIFICATION_IDS_REQUIRED}`])
    expect(NOTIFICATION_IDS_REQUIRED).toBe('The ids field is required.')
  })
  it('ids are strings, not numbers', () => {
    expect(NotificationBulkRequestSchema.safeParse({ ids: [1, 2] }).success).toBe(false)
  })
})

describe('openapi registration', () => {
  type Op = { tags?: string[]; parameters?: { name: string; in: string }[]; responses: Record<string, unknown> }
  const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, Op>>; components: { schemas: Record<string, unknown> } }
  const routes: [string, string][] = [
    ['get', '/me/notifications'],
    ['get', '/me/notifications/unread-count'],
    ['post', '/me/notifications/read-all'],
    ['post', '/me/notifications/bulk-read'],
    ['post', '/me/notifications/bulk-delete'],
    ['post', '/me/notifications/{id}/read'],
    ['delete', '/me/notifications/{id}'],
  ]

  it('contains the 7 routes and counts them by its own tag', () => {
    for (const [method, path] of routes) expect(doc.paths[path]?.[method], `${method} ${path}`).toBeDefined()
    const tagged = Object.values(doc.paths).flatMap((p) => Object.values(p)).filter((o) => o.tags?.includes('notifications'))
    expect(tagged).toHaveLength(7)
  })

  it('contains every component, with the Notification prefix', () => {
    for (const id of Object.keys(NOTIFICATIONS_COMPONENT_SCHEMAS)) {
      expect(id.startsWith('Notification'), id).toBe(true)
      expect(doc.components.schemas[id], id).toBeDefined()
    }
  })

  it('every route answers 401; mutations need CSRF (403); single-item routes answer 404', () => {
    for (const [method, path] of routes) {
      const op = doc.paths[path]?.[method]
      expect(op?.responses['401'], `${method} ${path}`).toBeDefined()
      const csrf = op?.parameters?.some((p) => p.name === 'X-CSRF-Token') ?? false
      expect(csrf, `${method} ${path} csrf`).toBe(method !== 'get')
      if (method !== 'get') expect(op?.responses['403']).toBeDefined()
      if (path.includes('{id}')) {
        expect(op?.responses['404']).toBeDefined()
        expect(op?.parameters?.some((p) => p.name === 'id' && p.in === 'path')).toBe(true)
      }
    }
    expect(doc.paths['/me/notifications/bulk-read']?.post?.responses['422']).toBeDefined()
    expect(doc.paths['/me/notifications/{id}']?.delete?.responses['204']).toBeUndefined()
  })

  it('every write route declares 429 RATE_LIMITED with the Retry-After header (D57a)', () => {
    type Res = { description?: string; headers?: Record<string, { schema?: unknown }> }
    for (const [method, path] of routes.filter(([m]) => m !== 'get')) {
      const res = doc.paths[path]?.[method]?.responses['429'] as Res | undefined
      expect(res, `${method} ${path}`).toBeDefined()
      expect(res?.description, `${method} ${path}`).toContain('RATE_LIMITED')
      expect(res?.headers?.['Retry-After']?.schema, `${method} ${path}`).toMatchObject({ type: 'integer' })
    }
  })
})
