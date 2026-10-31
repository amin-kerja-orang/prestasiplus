import { describe, expect, it, vi } from 'vitest'

import { ApiClient } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'

import bijakRoutes from '../routes'
import { BijakError } from '../server/errors'
import { createHttpBijakServer } from '../server/http'
import { BijakServer } from '../server/store'

const ok = (data: unknown, status = 200): TransportResponse => ({
  status,
  headers: {},
  body: { data },
})
const fail = (status: number, code: string, message: string): TransportResponse => ({
  status,
  headers: {},
  body: { error: { code, message } },
})

function http(routes: Record<string, TransportResponse>) {
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

describe('HTTP Kuiz client', () => {
  it('POSTs the start request with the CSRF header and returns the session', async () => {
    const session = { sessionId: 's', count: 1, items: [] }
    const { server, requests } = http({ 'POST /api/bijak/kuiz/sessions': ok(session, 201) })
    await expect(server.startKuiz({ count: 10, subject: 'MATH' })).resolves.toEqual(session)
    const req = requests.find((r) => r.method === 'POST')!
    expect(req.headers?.['x-csrf-token']).toBe('csrf-1')
    expect(req.body).toEqual({ count: 10, subject: 'MATH' })
  })

  it('maps 422 NO_QUESTIONS to BijakError no_questions', async () => {
    const { server } = http({
      'POST /api/bijak/kuiz/sessions': fail(422, 'NO_QUESTIONS', 'Belum ada soalan objektif'),
    })
    await expect(server.startKuiz({})).rejects.toMatchObject({ code: 'no_questions' })
  })

  it('check and finish use the session routes; 409 ALREADY_SUBMITTED reads as bad_request', async () => {
    const { server, requests } = http({
      'POST /api/bijak/kuiz/sessions/s%201/check': ok({
        correct: true,
        correctOptionId: 'B',
        explanation: null,
      }),
      'POST /api/bijak/kuiz/sessions/s%201/finish': fail(
        409,
        'ALREADY_SUBMITTED',
        'Kuiz ini sudah selesai.',
      ),
    })
    await expect(server.checkKuiz('s 1', { itemId: 'q', optionId: 'B' })).resolves.toMatchObject({
      correct: true,
    })
    await expect(server.finishKuiz('s 1', 30)).rejects.toMatchObject({
      code: 'bad_request',
      message: 'Kuiz ini sudah selesai.',
    })
    expect(requests.find((r) => r.url.endsWith('/finish'))?.body).toEqual({ timeSpent: 30 })
  })

  it('reads a paper page by ?page= and checks against the paper route', async () => {
    const { server, requests } = http({
      'GET /api/bijak/kuiz/papers/p1': ok({ page: 2 }),
      'POST /api/bijak/kuiz/papers/p1/check': ok({
        correct: false,
        correctOptionId: 'A',
        explanation: null,
      }),
    })
    await expect(server.getKuizPaperPage('p1', 2)).resolves.toMatchObject({ page: 2 })
    expect(requests.find((r) => r.method === 'GET' && r.url.includes('kuiz'))?.query).toEqual({
      page: '2',
    })
    await expect(
      server.checkKuizPaper('p1', { itemId: 'q', optionId: 'C' }),
    ).resolves.toMatchObject({
      correctOptionId: 'A',
    })
  })
})

describe('mock Kuiz server', () => {
  const server = () => new BijakServer({ latencyMs: 0 })

  it('draws objective items without the key and marks on the server', async () => {
    const s = server()
    const q = await s.startKuiz({ count: 5, subject: 'MAT' })
    expect(q.items).toHaveLength(5)
    expect(JSON.stringify(q)).not.toMatch(/correct/i)
    const item = q.items[0]!
    const first = await s.checkKuiz(q.sessionId, { itemId: item.id, optionId: item.options[0]!.id })
    // A repeat returns the stored verdict.
    await expect(
      s.checkKuiz(q.sessionId, { itemId: item.id, optionId: item.options[1]!.id }),
    ).resolves.toEqual(first)
    const done = await s.finishKuiz(q.sessionId)
    expect(done.total).toBe(5)
    expect(done.answered).toBe(1)
    await expect(s.finishKuiz(q.sessionId)).rejects.toBeInstanceOf(BijakError)
  })

  it('answers no_questions for a subject without objective questions', async () => {
    await expect(server().startKuiz({ subject: 'ZZZ' })).rejects.toMatchObject({
      code: 'no_questions',
    })
  })

  it('pages a paper by Bahagian, marks MCQ and turns structured leaves into open items', async () => {
    const s = server()
    const p1 = await s.getKuizPaperPage('mat-k1-2025-a', 1)
    expect(p1.pageCount).toBeGreaterThanOrEqual(1)
    expect(p1.markableTotal).toBeGreaterThan(0)
    const item = p1.items[0]!
    const v = await s.checkKuizPaper('mat-k1-2025-a', {
      itemId: item.id,
      optionId: item.options[0]!.id,
    })
    expect(typeof v.correct).toBe('boolean')
    const k2 = await s.getKuizPaperPage('mat-k2-2025-a', 1)
    expect(k2.items.some((i) => i.kind === 'open' && !i.markable)).toBe(true)
    await expect(s.getKuizPaperPage('nope', 1)).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('Kuiz routes', () => {
  it('registers /simulasi/kuiz and /simulasi/:paperId/kuiz for students (and Admin Pusat in Mod Pelajar), in-place 403 for others', () => {
    for (const path of ['/simulasi/kuiz', '/simulasi/:paperId/kuiz']) {
      const r = bijakRoutes.find((x) => x.path === path)
      expect(r, path).toBeTruthy()
      expect(r!.meta).toMatchObject({
        access: 'auth',
        roles: ['student', 'admin'],
        onForbidden: '403',
        layout: 'user',
      })
    }
  })
})

describe('parseCount (V2 (int) cast, fallback 20)', () => {
  it('truncates like V2 and falls back to 20', async () => {
    const { parseCount } = await import('../lib/kuiz')
    expect([5.5, '5', '10', 7, 'abc', null, undefined, 40].map(parseCount)).toEqual([5, 5, 10, 20, 20, 20, 20, 40])
  })
})
