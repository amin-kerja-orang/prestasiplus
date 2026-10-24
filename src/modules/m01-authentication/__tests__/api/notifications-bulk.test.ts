/**
 * SWX-2 hardening: the bulk-read / bulk-delete bodies send `ids` through `wireId` (contract
 * `NotificationBulkRequestSchema`, `IdSchema` strings). A number is a 422 in http mode; mock mode keeps it.
 */
import { NotificationBulkRequestSchema } from '@pp/contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installTransport } from '@/api'
import type { Transport, TransportRequest } from '@/api'

import { bulkDeleteNotifications, bulkMarkNotificationsRead } from '../../api/notifications'

const sent: TransportRequest[] = []

beforeEach(() => {
  sent.length = 0
  const transport: Transport = {
    request: vi.fn((req: TransportRequest) => {
      if (req.method === 'GET' && req.url === '/api/session') {
        return Promise.resolve({ status: 200, headers: {}, body: { data: { csrf: 'c' } } })
      }
      sent.push(req)
      return Promise.resolve({ status: 200, headers: {}, body: { data: { success: true } } })
    }),
  }
  installTransport(transport)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

const last = (): TransportRequest => sent[sent.length - 1]!

describe.each([
  ['bulkMarkNotificationsRead', bulkMarkNotificationsRead, '/api/me/notifications/bulk-read'],
  ['bulkDeleteNotifications', bulkDeleteNotifications, '/api/me/notifications/bulk-delete'],
] as const)('%s', (_name, call, url) => {
  it('http mode: a number goes out as a string', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await call([11, '12'])
    expect(last().url).toBe(url)
    expect(last().body).toEqual({ ids: ['11', '12'] })
    expect(NotificationBulkRequestSchema.safeParse(last().body).success).toBe(true)
  })

  it('mock mode: the number is kept', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await call([11, 12])
    expect(last().body).toEqual({ ids: [11, 12] })
  })
})
