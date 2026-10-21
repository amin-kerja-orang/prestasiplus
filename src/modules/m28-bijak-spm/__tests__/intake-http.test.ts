import { describe, expect, it, vi } from 'vitest'

import { ApiClient, ApiError } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'

import { createHttpBijakAdminServer, uploadError } from '../server/http-admin'
import { IntakeBatchCreateSchema } from '@pp/contract'

import {
  batchCreateToWire,
  batchFromWire,
  pagesFromWire,
  paperTypeFromWire,
  paperTypeToWire,
  summaryFromWire,
  type WireBatchDetail,
} from '../server/intake-wire'

const T0 = '2026-10-20T09:00:00.000+08:00'
const ok = (data: unknown, extra: object = {}): TransportResponse => ({
  status: 200,
  headers: {},
  body: { data, ...extra },
})
const fail = (
  status: number,
  code: string,
  message: string,
  fields?: object,
): TransportResponse => ({
  status,
  headers: {},
  body: { error: { code, message, ...(fields ? { fields } : {}) } },
})

const summary: Omit<WireBatchDetail, 'files'> = {
  id: 'b1',
  status: 'ready_for_review',
  statusLabel: 'Sedia untuk semakan',
  paperType: 'trial',
  subject: 'MAT',
  kertas: 2,
  year: 2025,
  source: 'Sekolah',
  copyright: 'sendiri',
  notes: null,
  adminNotes: null,
  owner: null,
  fileCount: 1,
  pageCount: 2,
  createdAt: T0,
  updatedAt: T0,
  submittedAt: null,
}
const detail: WireBatchDetail = {
  ...summary,
  files: [
    { id: 'f1', originalName: 'k2.pdf', sizeBytes: 10, pageCount: 2, status: 'done', errorCode: null, progress: { total: 2, done: 2, failed: 0 } },
  ],
}

function setup(
  routes: Record<string, TransportResponse | ((r: TransportRequest) => TransportResponse)>,
) {
  const requests: TransportRequest[] = []
  const transport: Transport = {
    request: vi.fn((req: TransportRequest) => {
      requests.push(req)
      const key = `${req.method} ${req.url}`
      if (key === 'GET /api/session') return Promise.resolve(ok({ csrf: 'csrf-1' }))
      const r = routes[key]
      return Promise.resolve(
        typeof r === 'function' ? r(req) : (r ?? fail(500, 'SERVER_ERROR', key)),
      )
    }),
  }
  return { server: createHttpBijakAdminServer({ client: new ApiClient({ transport }) }), requests }
}

describe('intake wire mappers', () => {
  it('maps paper types both ways', () => {
    expect(paperTypeToWire('Percubaan SPM')).toBe('trial')
    expect(paperTypeToWire('x')).toBe('other')
    expect(paperTypeFromWire('exercise_book')).toBe('Buku Latihan')
  })
  it('builds the POST /intake/batches body the contract accepts (78-10)', () => {
    const meta = { subject: 'MAT' as const, kertas: 2 as const, year: 2025, paperType: 'Percubaan SPM', source: ' Sekolah ', copyright: 'sendiri', notes: '  Nota  ' }
    const body = batchCreateToWire(meta)
    expect(body).toEqual({ paperType: 'trial', subject: 'MAT', kertas: 2, year: 2025, source: ' Sekolah ', copyright: 'sendiri', notes: 'Nota', declaration: true })
    expect(IntakeBatchCreateSchema.safeParse(body).success).toBe(true)
    // blank notes are left out; an unchosen copyright is sent as it is, so the server's 422 names the field
    const blank = batchCreateToWire({ ...meta, notes: '   ', copyright: '' })
    expect(blank).not.toHaveProperty('notes')
    const parsed = IntakeBatchCreateSchema.safeParse(blank)
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues.map((i) => i.path.join('.'))).toEqual(['copyright'])
  })
  it('maps a summary', () => {
    const s = summaryFromWire(summary, () => 'Matematik')
    expect(s).toMatchObject({
      id: 'b1',
      title: 'Matematik Kertas 2 2025',
      status: 'draf',
      sourceKind: 'pdf',
      questionCount: 0,
    })
    expect(s.updatedAt).toBe(Date.parse(T0))
  })
  it('numbers pages continuously across files', () => {
    const p = pagesFromWire([
      { pages: [{ pageNo: 1, textSource: 'ocr', text: 'a', ocrConfidence: 80 }] },
      { pages: [{ pageNo: 1, textSource: null, text: null, ocrConfidence: null }] },
    ])
    expect(p).toEqual([
      { page: 1, text: 'a', source: 'ocr', confidence: 80 },
      { page: 2, text: '', source: 'text-layer' },
    ])
  })
  it('maps a batch whose items could not be read and flags the items step', () => {
    const b = batchFromWire(detail, [])
    expect(b).toMatchObject({
      fileName: 'k2.pdf',
      paperType: 'Percubaan SPM',
      questions: [],
      itemsUnavailable: true,
    })
  })
  it('maps upload errors', () => {
    const e413 = new ApiError({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'x',
      body: null,
    })
    expect(uploadError(e413)).toMatchObject({
      code: 'bad_request',
      message: 'Fail melebihi had 20 MB.',
    })
    const e422 = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Data tidak sah',
      fields: { files: 'Jenis fail tidak disokong. Gunakan PDF.' },
      body: null,
    })
    expect(uploadError(e422)).toMatchObject({ message: 'Jenis fail tidak disokong. Gunakan PDF.' })
  })
})

describe('intake client', () => {
  it('lists batches and filters client-side', async () => {
    const { server, requests } = setup({
      'GET /api/intake/batches': ok([summary], { meta: { totalPages: 1 } }),
    })
    expect(await server.listIntakeBatches()).toHaveLength(1)
    expect(await server.listIntakeBatches({ subject: 'BM' })).toHaveLength(0)
    expect(requests.some((r) => r.url.startsWith('/api/intake/batches'))).toBe(true)
  })

  it('gets a batch with its pages, and tolerates a pages failure', async () => {
    const { server } = setup({
      'GET /api/intake/batches/b1': ok(detail),
      'GET /api/intake/files/f1/pages': ok({
        fileId: 'f1',
        pages: [{ pageNo: 1, textSource: 'ocr', text: 'hi', ocrConfidence: 90 }],
      }),
    })
    expect((await server.getIntakeBatch('b1')).pages).toHaveLength(1)
    const { server: s2 } = setup({ 'GET /api/intake/batches/b1': ok(detail) })
    expect((await s2.getIntakeBatch('b1')).pages).toEqual([])
  })

  it('creates a batch then uploads the file with CSRF', async () => {
    const { server, requests } = setup({
      'POST /api/intake/batches': ok(summary),
      'POST /api/intake/batches/b1/files': ok({ files: [] }),
      'GET /api/intake/batches/b1': ok(detail),
    })
    const file = new File(['%PDF'], 'k2.pdf', { type: 'application/pdf' })
    const meta = {
      subject: 'MAT',
      kertas: 2,
      year: 2025,
      paperType: 'Percubaan SPM',
      source: 'Sekolah',
      copyright: 'sendiri',
      notes: '',
      fileName: 'k2.pdf',
      fileHash: 'h',
      pageCount: 1,
    }
    const b = await server.createIntakeBatch(1, meta as never, {} as never, [], file)
    expect(b.id).toBe('b1')
    const create = requests.find((r) => r.method === 'POST' && r.url === '/api/intake/batches')!
    expect(create.headers?.['x-csrf-token']).toBe('csrf-1')
    expect(create.body).toMatchObject({ paperType: 'trial', declaration: true, subject: 'MAT' })
    expect(create.body).not.toHaveProperty('notes')
    const up = requests.find((r) => r.url === '/api/intake/batches/b1/files')!
    expect(up.headers?.['x-csrf-token']).toBe('csrf-1')
    expect(up.body).toBeInstanceOf(FormData)
    expect((up.body as FormData).get('files')).toBeInstanceOf(File)
  })

  it('cancels the batch and maps a 422 when the upload is rejected', async () => {
    const { server, requests } = setup({
      'POST /api/intake/batches': ok(summary),
      'POST /api/intake/batches/b1/files': fail(422, 'VALIDATION_ERROR', 'Data tidak sah', {
        files: 'Fail melebihi had 20 MB.',
      }),
      'POST /api/intake/batches/b1/cancel': ok(detail),
    })
    const file = new File(['x'], 'k2.pdf')
    await expect(
      server.createIntakeBatch(1, { paperType: 'Lain-lain', notes: 'n' } as never, {} as never, [], file),
    ).rejects.toMatchObject({ code: 'bad_request', message: 'Fail melebihi had 20 MB.' })
    expect(requests.some((r) => r.url === '/api/intake/batches/b1/cancel')).toBe(true)
  })

  it('keeps the routes without a controller unavailable', async () => {
    const { server } = setup({})
    await expect(server.resubmit('k')).rejects.toMatchObject({ code: 'unavailable' })
    await expect(server.getBankEditable('q')).rejects.toMatchObject({ code: 'unavailable' })
  })
})
