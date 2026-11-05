import { describe, expect, it, vi } from 'vitest'

import { IntakeBatchCreateSchema } from '@pp/contract'

import { ApiClient, ApiError } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'

import { intakeBadge } from '../admin/intake/lib/intake-badge'
import { createHttpBijakAdminServer, uploadError } from '../server/http-admin'
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
  itemCount: 0,
  reviewedCount: 0,
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
      batchStatus: 'ready_for_review',
      statusLabel: 'Sedia untuk semakan',
      sourceKind: 'pdf',
      questionCount: 0,
      reviewedCount: 0,
    })
    expect(s.updatedAt).toBe(Date.parse(T0))
  })
  it('leaves null kertas and year out of a teacher batch title (S1-T08)', () => {
    const t = summaryFromWire({ ...summary, kertas: null, year: null }, () => 'Matematik')
    expect(t.title).toBe('Matematik')
    expect(t.title).not.toMatch(/null|Kertas|\d/)
    expect(t).toMatchObject({ kertas: null, year: null })
    expect(summaryFromWire({ ...summary, kertas: null }, () => 'Matematik').title).toBe('Matematik 2025')
    expect(summaryFromWire(summary, () => 'Matematik').title).toBe('Matematik Kertas 2 2025')
    expect(batchFromWire({ ...detail, kertas: null, year: null }, [])).toMatchObject({ kertas: 0, year: 0 })
  })
  it('maps itemCount, reviewedCount and the wire status of a summary (R1E2E-C1)', () => {
    const s = summaryFromWire({ ...summary, itemCount: 2, reviewedCount: 2 }, () => 'Matematik')
    expect(s.status).toBe('draf') // every http batch stays in the Draf filter bucket
    expect(batchFromWire({ ...detail, status: 'ready_for_review', statusLabel: 'Sedia untuk semakan' }, [])).toMatchObject({ status: 'draf', batchStatus: 'ready_for_review', statusLabel: 'Sedia untuk semakan' })
    expect(s).toMatchObject({ questionCount: 2, reviewedCount: 2, batchStatus: 'ready_for_review', statusLabel: 'Sedia untuk semakan' })
    const p = summaryFromWire({ ...summary, status: 'processing', statusLabel: 'Sedang diproses' }, () => 'Matematik')
    expect(p).toMatchObject({ status: 'draf', batchStatus: 'processing', statusLabel: 'Sedang diproses' })
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
    // the request declare() really sends: the exact contract body (78-10), no notes when blank
    expect(create.body).toEqual({ paperType: 'trial', subject: 'MAT', kertas: 2, year: 2025, source: 'Sekolah', copyright: 'sendiri', declaration: true })
    expect(IntakeBatchCreateSchema.safeParse(create.body).success).toBe(true)
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

  describe('Quick Edit (FR-ADM-Q24.3)', () => {
    const leaf = {
      label: '1',
      mode: 'mcq',
      marks: 1,
      prompt: { ms: 'Teks lama yang panjang.' },
      options: ['A', 'B', 'C'].map((label) => ({ label, body: { ms: `Pilihan ${label}`, en: 'kept' } })),
      key: { kind: 'option', correct: 'A' },
    }
    const detail = (over: object = {}) => ({
      id: 'q',
      questionText: 'Teks lama yang panjang.',
      subject: { id: '3', name: 'Sains' },
      level: { id: '7', name: 'Tingkatan 4' },
      subjectId: '3',
      educationLevelId: '7',
      difficultyLevel: 2,
      explanation: null,
      status: 'approved',
      questionType: 'mcq',
      pointsValue: 1,
      parts: [leaf],
      ...over,
    })
    const routes = (over: object = {}) => ({
      'GET /api/admin/blueprints': ok([]),
      'GET /api/questions/q': ok(detail(over)),
      'GET /api/questions/q/gate-check': ok({ issues: [{ message: 'Sila pilih Bab.' }] }),
      'POST /api/questions/q/edit-as-draft': ok({ id: 'q', versionNo: 2 }),
      'PUT /api/questions/q': ok(detail()),
    })
    const edited = (correct = 'B') => ({
      stem: 'Teks baharu yang panjang.',
      options: leaf.options.map((o) => ({ id: o.label, text: `${o.label} baharu` })),
      scheme: { kind: 'option', marks: 1, correct },
      explanation: ' Sebab. ',
    }) as never

    it('reads a single-leaf MCQ into the flat shape with the gate messages', async () => {
      const { server } = setup(routes())
      const e = await server.getBankEditable('q')
      expect(e.quickEdit).toEqual({ outOfScope: false, gate: ['Sila pilih Bab.'] })
      expect(e.pendingRevision).toBe(false)
      expect(e.question.options.map((o) => o.id)).toEqual(['A', 'B', 'C'])
    })

    it.each([
      ['two leaves', { parts: [leaf, { ...leaf, label: '2' }] }],
      ['a grouped member', { stimulusGroup: { id: '9' } }],
      ['another mode', { parts: [{ ...leaf, mode: 'essay' }] }],
      ['a prompt that differs from the stem', { parts: [{ ...leaf, prompt: { ms: 'Apakah fungsi X?' } }] }],
      ['a leaf under a branch', { parts: [{ label: 'a', prompt: { ms: 'Induk' }, children: [leaf] }] }],
    ])('%s is out of scope, and a save is refused without a write', async (_name, over) => {
      const { server, requests } = setup(routes(over))
      expect((await server.getBankEditable('q')).quickEdit?.outOfScope).toBe(true)
      const res = await server.reviseQuestionFull('q', edited())
      expect(res.ok).toBe(false)
      expect(requests.some((r) => r.method !== 'GET')).toBe(false)
    })

    it('locks Menunggu Semakan, on the read and on a late save', async () => {
      const { server, requests } = setup(routes({ status: 'review' }))
      expect((await server.getBankEditable('q')).pendingRevision).toBe(true)
      expect((await server.reviseQuestionFull('q', edited())).ok).toBe(false)
      expect(requests.some((r) => r.method !== 'GET')).toBe(false)
    })

    it('a question with no subject makes no copy', async () => {
      const { server, requests } = setup(routes({ subjectId: null }))
      expect((await server.reviseQuestionFull('q', edited())).ok).toBe(false)
      expect(requests.some((r) => r.method !== 'GET')).toBe(false)
    })

    it('a failed gate read keeps the form and says so', async () => {
      const { server } = setup({ ...routes(), 'GET /api/questions/q/gate-check': fail(500, 'SERVER_ERROR', 'x') })
      const e = await server.getBankEditable('q')
      expect(e.quickEdit).toEqual({ outOfScope: false, gate: null })
    })

    it('a live question goes through edit-as-draft, then PUT keeps the rest of the leaf', async () => {
      const { server, requests } = setup(routes())
      const res = await server.reviseQuestionFull('q', edited())
      expect(res).toMatchObject({ ok: true, message: expect.stringContaining('Draf baharu #q dicipta.') })
      const writes = requests.filter((r) => r.method !== 'GET').map((r) => `${r.method} ${r.url}`)
      expect(writes).toEqual(['POST /api/questions/q/edit-as-draft', 'PUT /api/questions/q'])
      const body = requests.find((r) => r.method === 'PUT')?.body as {
        explanation: string
        questionText: string
        difficultyLevel: number
        parts: { key: unknown; prompt: { ms: string }; options: { body: { ms: string; en: string } }[] }[]
      }
      expect(body).toMatchObject({ questionText: 'Teks baharu yang panjang.', difficultyLevel: 2, explanation: 'Sebab.' })
      expect(body.parts[0]?.key).toEqual({ kind: 'option', correct: 'B' })
      expect(body.parts[0]?.prompt.ms).toBe('Teks baharu yang panjang.')
      expect(body.parts[0]?.options[1]?.body).toEqual({ ms: 'B baharu', en: 'kept' })
    })

    it('an open draft is reused: no second edit-as-draft', async () => {
      const { server, requests } = setup(routes({ status: 'draft' }))
      const res = await server.reviseQuestionFull('q', edited())
      expect(res).toMatchObject({ ok: true, message: 'Soalan dikemas kini.' })
      expect(requests.some((r) => r.url.endsWith('/edit-as-draft'))).toBe(false)
    })
  })

  it('keeps the routes without a controller unavailable', async () => {
    const { server } = setup({})
    await expect(server.resubmit('k')).rejects.toMatchObject({ code: 'unavailable' })
  })

  it('submitForReview drops the wire status/label so the badge shows Semakan (R1E2E-C1)', async () => {
    const { server } = setup({
      'GET /api/intake/batches/b1/review': ok({ issues: [] }),
      'GET /api/intake/batches/b1': ok(detail),
    })
    expect((await server.getIntakeBatch('b1')).statusLabel).toBe('Sedia untuk semakan')
    const res = await server.submitForReview('b1')
    if (!res.ok) throw new Error('expected ok')
    expect(res.batch.status).toBe('semakan')
    expect(res.batch.batchStatus).toBeUndefined()
    expect(res.batch.statusLabel).toBeUndefined()
    expect(intakeBadge(res.batch)).toEqual({ status: 'awaiting-review', label: 'Semakan' })
  })
})
