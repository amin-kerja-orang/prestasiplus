// S3-T06 admin UI: the HTTP side of the Set Builder client for Kertas Subjektif (contract `surface=subjektif`, API-BIJAK-14).
import { BIJAK_BUILDER_MESSAGES as M } from '@pp/contract'
import { describe, expect, it, vi } from 'vitest'

import { ApiClient } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'

import { BuilderError, builderMessage } from '../admin/builder/server/api'
import { createHttpBuilderServer } from '../admin/builder/server/http'

const T0 = '2026-10-20T09:00:00.000+08:00'
const ok = (data: unknown, extra: object = {}): TransportResponse => ({ status: 200, headers: {}, body: { data, ...extra } })
const fail = (status: number, code: string, message: string, fields?: Record<string, string>): TransportResponse => ({
  status,
  headers: {},
  body: { error: { code, message, ...(fields ? { fields } : {}) } },
})

function setup(handler: (req: TransportRequest) => TransportResponse) {
  const requests: TransportRequest[] = []
  const transport: Transport = {
    request: vi.fn((req: TransportRequest) => {
      requests.push(req)
      if (req.method === 'GET' && req.url === '/api/session') return Promise.resolve(ok({ csrf: 'csrf-1' }))
      return Promise.resolve(handler(req))
    }),
  }
  return { server: createHttpBuilderServer({ client: new ApiClient({ transport }) }), requests }
}

describe('listSubjektif', () => {
  it('asks for surface=subjektif with the filters and 25 per page, and reads meta.counts and the row fields', async () => {
    const { server, requests } = setup(() =>
      ok(
        [{ id: 'a', subject: 'MAT', surface: 'subjektif', examBoard: 'selangor', year: 2025, schemeCount: 1, questionCount: 2, updatedAt: T0 }],
        { meta: { totalItems: 41, totalPages: 2, counts: { total: 41, published: 30, withScheme: 12 } } },
      ),
    )
    const page = await server.listSubjektif({ subject: 'MAT', kertas: 2, status: 'terbit', page: 2 })
    const sent = requests.find((r) => r.url.startsWith('/api/admin/papers'))!
    const q = new URLSearchParams(sent.url.split('?')[1] ?? '')
    const all = { ...Object.fromEntries(q), ...(sent.query ?? {}) }
    expect(all).toMatchObject({ surface: 'subjektif', subject: 'MAT', kertas: '2', status: 'terbit', page: '2', pageSize: '25' })
    expect(page.total).toBe(41)
    expect(page.counts).toEqual({ total: 41, published: 30, withScheme: 12 })
    expect(page.rows[0]).toMatchObject({ id: 'a', schemeCount: 1, examBoard: 'selangor', updatedAt: Date.parse(T0) })
  })
})

describe('listSubjektif without meta.counts', () => {
  it('returns null counts, not zeros', async () => {
    const { server } = setup(() => ok([{ id: 'a', subject: 'MAT', updatedAt: T0 }], { meta: { totalItems: 1, totalPages: 1 } }))
    expect((await server.listSubjektif()).counts).toBeNull()
  })
})

describe('createSubjektif', () => {
  it('posts surface subjektif with the 18-02..18-08 body', async () => {
    const { server, requests } = setup(() => ok({ id: 'n1' }))
    const out = await server.createSubjektif({ title: ' Bahasa Melayu Kertas 2 ', subject: 'BM', kertas: 2, examBoard: 'selangor', year: 2025, totalMarks: 40 })
    expect(out).toEqual({ id: 'n1' })
    const post = requests.find((r) => r.method === 'POST')!
    expect(post.body).toEqual({ surface: 'subjektif', title: 'Bahasa Melayu Kertas 2', subject: 'BM', kertas: 2, examBoard: 'selangor', year: 2025, totalMarks: 40 })
  })

  it('keeps the 422 fields on the BuilderError', async () => {
    const { server } = setup(() => fail(422, 'VALIDATION_FAILED', M.yearRequired, { year: M.yearRequired, examBoard: M.examBoardRequired }))
    const err = await server.createSubjektif({ title: 'x', subject: 'BM', kertas: 2, examBoard: '', year: 0, totalMarks: 40 }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(BuilderError)
    expect((err as BuilderError).fields).toEqual({ year: M.yearRequired, examBoard: M.examBoardRequired })
  })
})

describe('source upload (field 18-09, API-BIJAK-14)', () => {
  const pdf = (name: string) => new File([new Uint8Array([37, 80, 68, 70])], name, { type: 'application/pdf' })

  it('sends multipart paper and scheme to POST /api/admin/papers/:id/source', async () => {
    const { server, requests } = setup(() => ok({ batchId: 'b1' }))
    const out = await server.uploadSource('p1', { paper: pdf('kertas.pdf'), scheme: pdf('skema.pdf') })
    expect(out).toEqual({ batchId: 'b1' })
    const post = requests.find((r) => r.url === '/api/admin/papers/p1/source')!
    expect(post.method).toBe('POST')
    const form = post.body as FormData
    expect(form.get('paper')).toBeInstanceOf(File)
    expect((form.get('scheme') as File).name).toBe('skema.pdf')
  })

  it('a 404 (route not there yet) is a not_found error with the generic text, never a success', async () => {
    const { server } = setup(() => fail(404, 'NOT_FOUND', 'Not Found'))
    const err = await server.uploadSource('p1', { paper: pdf('kertas.pdf') }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(BuilderError)
    expect((err as BuilderError).kind).toBe('not_found')
    expect(builderMessage(err, 'Sesuatu tidak kena. Sila cuba lagi.')).toBe('Sesuatu tidak kena. Sila cuba lagi.')
  })

  it('apply posts { apply: true }', async () => {
    const { server, requests } = setup(() => ok({ placements: 3 }))
    expect(await server.applySource('p1')).toEqual({ placements: 3 })
    expect(requests.find((r) => r.url === '/api/admin/papers/p1/source')!.body).toEqual({ apply: true })
  })
})
