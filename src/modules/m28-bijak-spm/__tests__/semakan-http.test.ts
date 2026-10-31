import { describe, expect, it, vi } from 'vitest'

import { ApiClient } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'

import { BijakError } from '../server/errors'
import { createHttpBijakServer } from '../server/http'

const ok = (data: unknown, status = 200): TransportResponse => ({ status, headers: {}, body: { data } })
const fail = (status: number, code: string, message: string, fields?: object): TransportResponse => ({
  status,
  headers: {},
  body: { error: { code, message, ...(fields ? { fields } : {}) } },
})

function setup(routes: Record<string, TransportResponse>) {
  const requests: TransportRequest[] = []
  const transport: Transport = {
    request: vi.fn((req: TransportRequest) => {
      requests.push(req)
      const key = `${req.method} ${req.url}`
      if (key === 'GET /api/session') return Promise.resolve(ok({ csrf: 'csrf-1' }))
      return Promise.resolve(routes[key] ?? fail(500, 'SERVER_ERROR', `unrouted ${key}`))
    }),
  }
  return { server: createHttpBijakServer({ client: new ApiClient({ transport }) }), requests }
}

const SELF_MARK = '/api/bijak/attempts/a1/self-mark'

describe('HttpBijakServer: Semakan (R1)', () => {
  it('self-mark posts partId, mark and band with the CSRF header and returns the outcome', async () => {
    const outcome = {
      partId: 'p1',
      awarded: 2,
      max: 4,
      band: '2',
      status: 'separa',
      attemptScore: 5,
      attemptMax: 10,
      provisional: false,
      pendingReview: 0,
      result: { score: 5, max: 10 },
    }
    const { server, requests } = setup({ [`POST ${SELF_MARK}`]: ok(outcome) })
    const out = await server.selfMark(0, 'a1', { partId: 'p1', mark: 2, band: '2' })
    expect(out.attemptScore).toBe(5)
    const req = requests.find((r) => r.url === SELF_MARK)!
    expect(req.body).toEqual({ partId: 'p1', mark: 2, band: '2' })
    expect(req.headers?.['x-csrf-token']).toBe('csrf-1')
  })

  it.each([
    ['partId', 'Bahagian ini ditanda automatik; markah kendiri tidak diperlukan.'],
    ['band', 'Band tidak sah untuk bahagian ini.'],
  ])('maps a 422 on fields.%s to a bad_request with the BM text', async (field, message) => {
    const { server } = setup({
      [`POST ${SELF_MARK}`]: fail(422, 'VALIDATION_FAILED', 'Data tidak sah', { [field]: message }),
    })
    const err = await server.selfMark(0, 'a1', { partId: 'p1', mark: 1 }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(BijakError)
    expect(err).toMatchObject({ code: 'bad_request', message })
  })

  it('maps 409 NOT_SUBMITTED to not_submitted', async () => {
    const { server } = setup({
      [`POST ${SELF_MARK}`]: fail(409, 'NOT_SUBMITTED', 'Skema hanya didedahkan selepas Hantar'),
    })
    await expect(server.selfMark(0, 'a1', { partId: 'p1', mark: 1 })).rejects.toMatchObject({
      code: 'not_submitted',
    })
  })

  it('retry returns the new attempt id; the 409 text reaches the caller', async () => {
    const good = setup({ 'POST /api/bijak/attempts/a1/retry': ok({ attemptId: 'a2' }, 201) })
    await expect(good.server.retryAttempt(0, 'a1')).resolves.toEqual({ attemptId: 'a2' })
    const msg = 'Hantar percubaan ini dahulu sebelum mencuba semula.'
    const bad = setup({ 'POST /api/bijak/attempts/a1/retry': fail(409, 'CONFLICT', msg) })
    await expect(bad.server.retryAttempt(0, 'a1')).rejects.toMatchObject({ message: msg })
  })

  it('past sittings turn instants into epoch ms', async () => {
    const { server } = setup({
      'GET /api/bijak/papers/p1/attempts': ok({
        lastSubmittedAttemptId: 'a9',
        sittings: [
          {
            attemptId: 'a9',
            mode: 'exam',
            status: 'submitted',
            startedAt: '2026-10-20T09:00:00.000+08:00',
            submittedAt: '2026-10-20T10:00:00.000+08:00',
            score: 3,
            max: 10,
            provisional: true,
          },
        ],
      }),
    })
    const out = await server.pastSittings(0, 'p1')
    expect(out.lastSubmittedAttemptId).toBe('a9')
    expect(out.sittings[0]!.submittedAt).toBe(Date.parse('2026-10-20T10:00:00.000+08:00'))
  })
})
