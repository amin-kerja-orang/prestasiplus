import { describe, expect, it, vi } from 'vitest'

import { installTransport } from '@/api'
import type { Transport, TransportRequest } from '@/api'

import { fetchPaperServability } from '../../api/paper-servability'

describe('fetchPaperServability through ApiClient', () => {
  it('resolves the { data, meta } body as an object, not a bare array', async () => {
    const requests: TransportRequest[] = []
    const row = { paperId: '10', title: 'Kertas Percubaan A', served: true, reasons: [] }
    const transport: Transport = {
      request: vi.fn((req: TransportRequest) => {
        requests.push(req)
        return Promise.resolve({ status: 200, headers: { 'content-type': 'application/json' }, body: { data: [row], meta: { total: 250, truncated: true } } })
      }),
    }
    installTransport(transport)
    const res = await fetchPaperServability(5)
    expect(Array.isArray(res)).toBe(false)
    expect(res.data).toEqual([row])
    expect(res.meta).toEqual({ total: 250, truncated: true })
    expect(JSON.stringify(requests[0])).toContain('/api/admin/questions/5/paper-servability')
  })
})
