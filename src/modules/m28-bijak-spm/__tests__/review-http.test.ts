import { describe, expect, it, vi } from 'vitest'

import { ApiClient } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'

import type { IntakeQuestion } from '../admin/intake/types'
import {
  bankDetailFrom,
  bankKind,
  bankRowFrom,
  bankStatusFromWire,
  wireStatusesOf,
  type WireBankDetail,
} from '../server/bank-wire'
import { createHttpBijakAdminServer, decisionErrors } from '../server/http-admin'
import { issuesFromWire, itemPatch, questionFromItem, type WireItem } from '../server/intake-wire'
import {
  confidenceFromBand,
  countsFromWire,
  kindFromType,
  queueItemFromRow,
  queueStatusFromState,
  reviewDetailFromItem,
  statesOfStatus,
} from '../server/review-wire'

const T0 = '2026-10-20T09:00:00.000+08:00'
type Route = TransportResponse | ((r: TransportRequest) => TransportResponse)
const ok = (data: unknown, extra: object = {}, status = 200): TransportResponse => ({
  status,
  headers: {},
  body: { data, ...extra },
})
const fail = (status: number, code: string, message: string, extra: object = {}): TransportResponse => ({
  status,
  headers: {},
  body: { error: { code, message, ...extra } },
})

const tag = {
  subject: 'MAT',
  level: 'T4',
  unit: 'MAT-T4-02',
  unitLabel: 'Asas Nombor',
  sp: ['2.1.1'],
  tp: 3,
  formOrigin: 'T4',
}
function item(over: Partial<WireItem> = {}): WireItem {
  return {
    id: '11',
    label: '1',
    type: 'mcq',
    stem: 'Nilai $2+3$ ialah?',
    options: [
      { id: 'A', text: '4' },
      { id: 'B', text: '5' },
    ],
    marks: 1,
    mode: 'short_text',
    parts: [],
    scheme: { kind: 'option', marks: 1, correct: 'B', reason: '' },
    tag,
    page: 1,
    lowFields: ['tag.unit'],
    confirmed: [],
    batchId: '7',
    position: 1,
    state: 'needs_review',
    confidenceBand: 'low',
    uploader: { id: '2', name: 'Guru Contoh' },
    question: null,
    duplicates: [],
    createdAt: T0,
    updatedAt: T0,
    fieldConfidence: {},
    region: null,
    humanEdited: [],
    issues: [{ itemId: '11', where: 'Soalan 1', message: 'Unit DSKP belum dipilih.' }],
    stimulus: null,
    rejectReason: null,
    decidedBy: null,
    decidedAt: null,
    provenance: {
      sourceType: 'pdf',
      fileId: '3',
      sourcePaperId: null,
      page: 1,
      region: null,
      numberLabel: '1',
      runId: '5',
      provider: 'mock',
      model: 'heuristik-1',
    },
    events: [
      { id: '1', at: T0, action: 'extracted', actor: null, actorRole: null, from: null, to: 'needs_review', field: null, previous: null, reason: null },
    ],
    ...over,
  } as WireItem
}
const row = (over: object = {}) => ({
  id: '11',
  label: '1',
  type: 'mcq',
  stemPreview: 'Nilai ialah?',
  marks: 1,
  page: 1,
  subject: 'MAT',
  lowCount: 1,
  issueCount: 1,
  needsManual: false,
  batchId: '7',
  position: 1,
  state: 'needs_review',
  confidenceBand: 'medium',
  uploader: { id: '2', name: 'Guru Contoh' },
  question: null,
  duplicates: [],
  createdAt: T0,
  updatedAt: T0,
  ...over,
})
const batch7 = {
  id: '7',
  status: 'ready_for_review',
  statusLabel: 'Sedia untuk semakan',
  paperType: 'trial',
  subject: 'MAT',
  kertas: 2,
  year: 2025,
  source: 'Sekolah Contoh',
  copyright: 'sendiri',
  notes: null,
  adminNotes: null,
  owner: null,
  fileCount: 1,
  pageCount: 1,
  createdAt: T0,
  updatedAt: T0,
  submittedAt: null,
  files: [
    { id: 'f1', originalName: 'k2.pdf', sizeBytes: 10, pageCount: 1, status: 'done', errorCode: null, progress: { total: 1, done: 1, failed: 0 } },
  ],
}
const blueprints = ok([{ subject: 'MAT', subjectName: 'Matematik', kertas: 2 }], { meta: { totalPages: 1 } })
const review = {
  batchId: '7',
  provider: 'mock',
  model: 'heuristik-1',
  unmatched: [],
  warnings: [],
  stimuli: [],
  groups: [],
  counts: { items: 1, marks: 1, groups: 0, low: 1, states: { generated: 0, needs_review: 1, accepted: 0, rejected: 0, duplicate: 0 } },
  issues: [],
  extraction: null,
}

function setup(routes: Record<string, Route>) {
  const requests: TransportRequest[] = []
  const transport: Transport = {
    request: vi.fn((req: TransportRequest) => {
      requests.push(req)
      const key = `${req.method} ${req.url.split('?')[0]}`
      if (key === 'GET /api/session') return Promise.resolve(ok({ csrf: 'csrf-1' }))
      const r = routes[`${req.method} ${req.url}`] ?? routes[key]
      return Promise.resolve(typeof r === 'function' ? r(req) : (r ?? fail(500, 'SERVER_ERROR', key)))
    }),
  }
  return { server: createHttpBijakAdminServer({ client: new ApiClient({ transport }) }), requests }
}

describe('review wire mappers', () => {
  it('maps item states to the queue statuses', () => {
    expect(queueStatusFromState('generated')).toBe('semakan')
    expect(queueStatusFromState('needs_review')).toBe('semakan')
    expect(queueStatusFromState('duplicate')).toBe('semakan')
    expect(queueStatusFromState('accepted')).toBe('draf')
    expect(queueStatusFromState('rejected')).toBe('ditolak')
    expect(statesOfStatus('semakan')).toEqual(['generated', 'needs_review', 'duplicate'])
    expect(statesOfStatus('terbit')).toEqual([])
    expect(statesOfStatus('semua')).toBeNull()
    expect(
      countsFromWire({ generated: 1, needs_review: 2, accepted: 3, rejected: 4, duplicate: 5 }),
    ).toEqual({ semakan: 8, draf: 3, ditolak: 4, terbit: 0 })
  })

  it('maps kind, confidence and a row', () => {
    expect(kindFromType('mcq')).toBe('objektif')
    expect(kindFromType('essay')).toBe('esei')
    expect(kindFromType('short')).toBe('berstruktur')
    expect(confidenceFromBand('high')).toBe('tinggi')
    expect(confidenceFromBand('low')).toBe('rendah')
    const q = queueItemFromRow(row() as never, {
      subjectName: () => 'Matematik',
      batch: { kertas: 2, source: 'Sekolah Contoh' },
      now: Date.parse(T0) + 3 * 86_400_000,
    })
    expect(q).toMatchObject({
      key: '11',
      subjectName: 'Matematik',
      kertas: 2,
      kind: 'objektif',
      status: 'semakan',
      confidence: 'sederhana',
      ageDays: 3,
      uploader: 'Guru Contoh',
      source: 'Sekolah Contoh',
    })
  })

  it('builds the review detail with the gate from the item issues', () => {
    const d = reviewDetailFromItem(item(), {
      subjectName: () => 'Matematik',
      batch: { kertas: 2, source: 's' },
      now: Date.parse(T0),
    })
    expect(d.gate).toEqual(['Soalan 1: Unit DSKP belum dipilih.'])
    expect(d.questions[0]?.mcq?.options).toHaveLength(2)
    expect(d.questions[0]?.scheme['11']?.lines[0]?.text).toBe('Jawapan betul: B')
    expect(d.item.topic).toBe('Asas Nombor')
    expect(d.history[0]).toMatchObject({ by: 'Sistem', action: 'Diekstrak' })
  })

  it('keeps the question fields of an item only', () => {
    const q = questionFromItem(item())
    expect(q).not.toHaveProperty('state')
    expect(q).not.toHaveProperty('events')
    expect(q).toMatchObject({ id: '11', label: '1', lowFields: ['tag.unit'] })
    expect(issuesFromWire([{ itemId: '11', where: 'w', message: 'm' }, { where: 'Kertas', message: 'k' }])).toEqual([
      { questionId: '11', where: 'w', message: 'm' },
      { where: 'Kertas', message: 'k' },
    ])
  })

  it('diffs an edited question into a patch', () => {
    const prev = questionFromItem(item({ needsManual: true }))
    expect(itemPatch(prev, { ...prev })).toBeNull() // needsManual stays true
    const next: IntakeQuestion = {
      ...prev,
      stem: 'Baharu',
      confirmed: ['tag.unit'],
      needsManual: false,
      options: prev.options.slice(0, 1),
    }
    delete (next as { scheme?: unknown }).scheme
    expect(itemPatch(prev, next)).toEqual({
      stem: 'Baharu',
      options: [{ id: 'A', text: '4' }],
      confirmed: ['tag.unit'],
      scheme: null,
      needsManual: false,
    })
    const detached = { ...prev, stimulusId: undefined }
    expect(itemPatch({ ...prev, stimulusId: 's1' }, detached)).toEqual({ stimulusId: null })
  })

  it('reads the gate and field messages of a refused decision', () => {
    const gate = {
      body: { error: { details: { issues: [{ where: 'Soalan 1', message: 'Teks soalan kosong.' }] } } },
      message: 'x',
    } as never
    expect(decisionErrors(gate)).toEqual(['Soalan 1: Teks soalan kosong.'])
    expect(decisionErrors({ body: null, fields: { reason: 'Sebab penolakan diperlukan.' }, message: 'x' } as never)).toEqual([
      'Sebab penolakan diperlukan.',
    ])
    expect(decisionErrors({ body: null, message: 'Item ini sudah diterima.' } as never)).toEqual([
      'Item ini sudah diterima.',
    ])
  })
})

describe('bank wire mappers', () => {
  const detail = (over: Partial<WireBankDetail> = {}): WireBankDetail => ({
    id: '90',
    questionText: 'Nilai $2+3$ ialah?',
    subject: { id: '1', name: 'Matematik' },
    level: { id: '4', name: 'Tingkatan 4' },
    status: 'draft',
    questionType: 'mcq',
    options: ['4', '5', '6', '7'],
    correctAnswer: 1,
    tfAnswer: null,
    correctAnswerText: null,
    modelAnswer: null,
    pointsValue: 1,
    chapterLabel: 'Asas Nombor',
    createdAt: T0,
    createdBy: { id: '2', name: 'Guru Contoh' },
    dskp: null,
    ...over,
  })

  it('maps statuses both ways', () => {
    expect(bankStatusFromWire('published')).toBe('terbit')
    expect(bankStatusFromWire('approved')).toBe('semakan')
    expect(bankStatusFromWire('archived')).toBe('ditolak')
    expect(bankStatusFromWire('draft')).toBe('draf')
    expect(wireStatusesOf('semakan')).toEqual(['review', 'approved'])
    expect(wireStatusesOf('semua')).toBeNull()
  })

  it('maps a row and a flat mcq detail', () => {
    const subject = { code: 'MAT', name: 'Matematik' }
    const r = bankRowFrom(detail(), detail(), subject)
    expect(r).toMatchObject({ id: '90', kind: 'objektif', marks: 1, status: 'draf', kertas: 0, topic: 'Asas Nombor' })
    const d = bankDetailFrom(detail(), subject, r)
    expect(d.question.mcq).toEqual({
      options: [
        { id: 'A', text: '4' },
        { id: 'B', text: '5' },
        { id: 'C', text: '6' },
        { id: 'D', text: '7' },
      ],
      correct: 'B',
    })
    expect(d.question.curriculum).toMatchObject({ subject: 'MAT', level: 'T4' })
    expect(d.pendingRevision).toBe(false)
    expect(d.usedInPapers).toEqual([])
  })

  it('reads kind and marks from a part tree', () => {
    const leaf = (mode: string, key: object, marks: number) => ({
      label: '(a)',
      prompt: { ms: 'Hitung' },
      marks,
      mode,
      key,
    })
    const structured = detail({
      questionType: 'short_answer',
      parts: [
        leaf('working', { kind: 'points', marks: 2, points: [{ id: 'p', code: 'K', label: 'Kaedah', marks: 2 }] }, 2),
      ] as never,
    })
    expect(bankKind(structured)).toBe('berstruktur')
    const d = bankDetailFrom(structured, { code: 'MAT', name: 'Matematik' }, bankRowFrom(structured, structured, { code: 'MAT', name: 'Matematik' }))
    expect(d.question.marks).toBe(2)
    expect(d.question.parts?.[0]?.marks).toBe(2)
    expect(Object.values(d.question.scheme)[0]?.lines[0]).toMatchObject({ tag: 'K1', text: 'Kaedah', marks: 2 })
    expect(bankKind(detail({ questionType: 'essay' }))).toBe('esei')
  })
})

describe('review client', () => {
  it('lists the queue with counts, batch kertas and the status filter', async () => {
    const { server, requests } = setup({
      'GET /api/admin/blueprints': blueprints,
      'GET /api/intake/items': ok(
        [row(), row({ id: '12', state: 'accepted' })],
        { meta: { totalPages: 1, counts: { generated: 0, needs_review: 1, accepted: 1, rejected: 0, duplicate: 0 } } },
      ),
      'GET /api/intake/batches/7': ok(batch7),
    })
    const q = await server.listReviewQueue()
    expect(q.counts).toEqual({ semakan: 1, draf: 1, ditolak: 0, terbit: 0 })
    expect(q.items.map((i) => i.key)).toEqual(['11'])
    expect(q.items[0]).toMatchObject({ kertas: 2, subjectName: 'Matematik', source: 'Sekolah Contoh' })
    const accepted = await server.listReviewQueue({ status: 'draf' })
    expect(accepted.items.map((i) => i.key)).toEqual(['12'])
    expect(requests.some((r) => r.query?.state === 'accepted')).toBe(true)
    expect((await server.listReviewQueue({ status: 'terbit' })).items).toEqual([])
    expect((await server.listReviewQueue({ kertas: 1 })).items).toEqual([])
  })

  it('status terbit reads only the counts, not the items', async () => {
    const { server, requests } = setup({
      'GET /api/admin/blueprints': blueprints,
      'GET /api/intake/items': ok([row()], {
        meta: { totalPages: 9, counts: { generated: 1, needs_review: 0, accepted: 2, rejected: 0, duplicate: 0 } },
      }),
    })
    const q = await server.listReviewQueue({ status: 'terbit' })
    expect(q.items).toEqual([])
    expect(q.counts).toEqual({ semakan: 1, draf: 2, ditolak: 0, terbit: 0 })
    const reads = requests.filter((r) => r.url === '/api/intake/items')
    expect(reads).toHaveLength(1)
    expect(reads[0]?.query).toMatchObject({ pageSize: '1' })
  })

  it('opens an item and maps 404 to not_found', async () => {
    const { server } = setup({
      'GET /api/admin/blueprints': blueprints,
      'GET /api/intake/items/11': ok(item()),
      'GET /api/intake/batches/7': ok(batch7),
      'GET /api/intake/items/99': fail(404, 'NOT_FOUND', 'Item ekstrak tidak ditemui'),
    })
    const d = await server.getReviewItem('11')
    expect(d.item.kertas).toBe(2)
    await expect(server.getReviewItem('99')).rejects.toMatchObject({
      code: 'not_found',
      message: 'Item ekstrak tidak ditemui',
    })
  })

  it('accepts with CSRF and reports a gate failure as errors', async () => {
    const { server, requests } = setup({
      'POST /api/intake/items/11/accept': ok(item({ state: 'accepted' })),
      'POST /api/intake/items/12/accept': fail(422, 'VALIDATION_ERROR', 'Soalan belum memenuhi semakan kualiti. Baiki isu yang disenaraikan.', {
        details: { issues: [{ where: 'Soalan 1', message: 'Teks soalan kosong.' }] },
      }),
      'POST /api/intake/items/13/accept': fail(409, 'CONFLICT', 'Item ini sudah diterima.'),
    })
    expect(await server.reviewDecision('11', { action: 'terbit' })).toEqual({ ok: true, errors: [] })
    const call = requests.find((r) => r.url === '/api/intake/items/11/accept')!
    expect(call.headers?.['x-csrf-token']).toBe('csrf-1')
    expect(await server.reviewDecision('12', { action: 'terbit' })).toEqual({
      ok: false,
      errors: ['Soalan 1: Teks soalan kosong.'],
    })
    expect(await server.reviewDecision('13', { action: 'terbit' })).toEqual({
      ok: false,
      errors: ['Item ini sudah diterima.'],
    })
  })

  it('rejects only with a reason', async () => {
    const { server, requests } = setup({
      'POST /api/intake/items/11/reject': ok(item({ state: 'rejected' })),
    })
    expect(await server.reviewDecision('11', { action: 'tolak' })).toMatchObject({ ok: false })
    expect(requests.some((r) => r.url.endsWith('/reject'))).toBe(false)
    expect(await server.reviewDecision('11', { action: 'tolak', reason: ' Salah ' })).toEqual({ ok: true, errors: [] })
    expect(requests.find((r) => r.url.endsWith('/reject'))?.body).toEqual({ reason: 'Salah' })
  })
})

describe('extraction and the editor client', () => {
  const batchRoutes: Record<string, Route> = {
    'GET /api/intake/batches/7': ok(batch7),
    'GET /api/intake/files/f1/pages': ok({ fileId: 'f1', pages: [] }),
    'GET /api/intake/batches/7/review': ok(review),
    'GET /api/intake/items': ok([row(), row({ id: '12', state: 'accepted' }), row({ id: '13', state: 'rejected' })], { meta: { totalPages: 1 } }),
    'GET /api/intake/items/11': ok(item()),
  }

  it('requests the extraction with CSRF and an empty body', async () => {
    const { server, requests } = setup({
      'POST /api/intake/batches/7/extract': ok({ id: '1', state: 'queued' }, {}, 202),
    })
    await server.extractBatch('7')
    const call = requests.find((r) => r.url.endsWith('/extract'))!
    expect(call.headers?.['x-csrf-token']).toBe('csrf-1')
    expect(call.body).toEqual({})
  })

  it('maps an extract refusal to the server message', async () => {
    const { server } = setup({
      'POST /api/intake/batches/7/extract': fail(409, 'CONFLICT', 'Kertas sama sudah diimport'),
    })
    await expect(server.extractBatch('7')).rejects.toMatchObject({
      code: 'bad_request',
      message: 'Kertas sama sudah diimport',
    })
  })

  it('opens a batch with its open items, stimuli and the extraction state', async () => {
    const { server } = setup(batchRoutes)
    const b = await server.getIntakeBatch('7')
    expect(b.questions.map((q) => q.id)).toEqual(['11']) // accepted and rejected are final
    expect(b.itemsUnavailable).toBeUndefined()
    expect(b.extraction).toMatchObject({ state: 'none', canExtract: true, processing: false })
    expect(b.provider).toBe('mock')
    expect(b.sourceKind).toBe('pdf')
  })

  it('saves only what changed: PATCH an edited item, add one, reject a removed one', async () => {
    const { server, requests } = setup({
      ...batchRoutes,
      'PATCH /api/intake/items/11': ok(item({ stem: 'Baharu' }), { reordered: false }),
      'POST /api/intake/batches/7/items': ok(item({ id: '21', label: '2' }), {}, 201),
      'PATCH /api/intake/items/21': ok(item({ id: '21', label: '2', stem: 'Taip' }), { reordered: false }),
      'POST /api/intake/items/11/reject': ok(item({ state: 'rejected' })),
    })
    const b = await server.getIntakeBatch('7')
    const first = { ...b.questions[0]!, stem: 'Baharu' }
    // nothing changed: no write
    await server.saveExtracted('7', { questions: b.questions, stimuli: [] })
    expect(requests.filter((r) => r.method !== 'GET')).toHaveLength(0)

    const added: IntakeQuestion = { ...first, id: 'q-2-local', label: '2', stem: 'Taip', lowFields: [] }
    const saved = await server.saveExtracted('7', { questions: [first, added], stimuli: [] })
    const writes = requests.filter((r) => r.method !== 'GET').map((r) => `${r.method} ${r.url}`)
    expect(writes).toEqual([
      'PATCH /api/intake/items/11',
      'POST /api/intake/batches/7/items',
      'PATCH /api/intake/items/21',
    ])
    expect(saved.idMap?.items).toEqual({ 'q-2-local': '21' })
    // a retry with the same local id does not create a second item
    await server.saveExtracted('7', { questions: [first, added], stimuli: [] })
    expect(requests.filter((r) => r.url === '/api/intake/batches/7/items')).toHaveLength(1)

    // removing an item rejects it with a fixed reason
    await server.saveExtracted('7', { questions: [{ ...added, id: '21' }], stimuli: [] })
    const rej = requests.find((r) => r.url === '/api/intake/items/11/reject')!
    expect(rej.body).toEqual({ reason: 'Dibuang oleh penyemak.' })
  })

  it('creates, edits and removes stimuli before the items', async () => {
    const stim = { id: 's9', kind: 'diagram', label: 'Rajah 1', alt: 'Graf', caption: 'Graf' }
    const { server, requests } = setup({
      ...batchRoutes,
      'POST /api/intake/batches/7/stimuli': ok(stim, {}, 201),
      'PATCH /api/intake/stimuli/s9': ok({ ...stim, alt: 'Graf garis' }),
      'DELETE /api/intake/stimuli/s9': ok({ id: 's9', detachedItemIds: [] }),
      'PATCH /api/intake/items/11': ok(item({ stimulusId: 's9' }), { reordered: false }),
    })
    const b = await server.getIntakeBatch('7')
    const local = { id: 'stim-local', kind: 'diagram' as const, label: 'Rajah 1', alt: 'Graf', caption: 'Graf', page: 1 }
    const q = { ...b.questions[0]!, stimulusId: 'stim-local' }
    const out = await server.saveExtracted('7', { questions: [q], stimuli: [local] })
    expect(out.idMap?.stimuli).toEqual({ 'stim-local': 's9' })
    const itemPatchCall = requests.find((r) => r.url === '/api/intake/items/11' && r.method === 'PATCH')!
    expect(itemPatchCall.body).toEqual({ stimulusId: 's9' })
    await server.saveExtracted('7', {
      questions: [{ ...q, stimulusId: 's9' }],
      stimuli: [{ ...local, id: 's9', alt: 'Graf garis' }],
    })
    expect(requests.some((r) => r.method === 'PATCH' && r.url === '/api/intake/stimuli/s9')).toBe(true)
    await server.saveExtracted('7', { questions: [{ ...q, stimulusId: undefined }], stimuli: [] })
    expect(requests.some((r) => r.method === 'DELETE' && r.url === '/api/intake/stimuli/s9')).toBe(true)
  })

  it('a 409 locked item is dropped from the save and the rest still goes through', async () => {
    const locked = 'Item ini sudah diterima atau ditolak dan tidak boleh disunting.'
    const { server, requests } = setup({
      ...batchRoutes,
      'GET /api/intake/items': ok(
        [row(), row({ id: '12', position: 2 })],
        { meta: { totalPages: 1 } },
      ),
      'GET /api/intake/items/12': ok(item({ id: '12', label: '2', position: 2 })),
      'PATCH /api/intake/items/11': fail(409, 'CONFLICT', locked),
      'PATCH /api/intake/items/12': ok(item({ id: '12', label: '2', stem: 'B' }), { reordered: false }),
    })
    const b = await server.getIntakeBatch('7')
    const edited = b.questions.map((q) => ({ ...q, stem: 'B' }))
    const saved = await server.saveExtracted('7', { questions: edited, stimuli: [] })
    expect(saved.questions.map((q) => q.id)).toEqual(['12'])
    expect(requests.filter((r) => r.method === 'PATCH').map((r) => r.url)).toEqual([
      '/api/intake/items/11',
      '/api/intake/items/12',
    ])
    // the next save does not retry it and does not create a copy
    await server.saveExtracted('7', { questions: edited.map((q) => ({ ...q, stem: 'C' })), stimuli: [] })
    expect(requests.filter((r) => r.method === 'PATCH' && r.url === '/api/intake/items/11')).toHaveLength(1)
    expect(requests.some((r) => r.method === 'POST' && r.url.endsWith('/items'))).toBe(false)
  })

  it('submit runs the batch gate: issues come back, none gives Semakan', async () => {
    const issue = { itemId: '11', where: 'Soalan 1', message: 'Teks soalan kosong.', blocksAccept: true }
    const bad = setup({ 'GET /api/intake/batches/7/review': ok({ ...review, issues: [issue] }) })
    expect(await bad.server.submitForReview('7')).toEqual({
      ok: false,
      issues: [{ questionId: '11', where: 'Soalan 1', message: 'Teks soalan kosong.' }],
    })
    const good = setup(batchRoutes)
    const res = await good.server.submitForReview('7')
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.batch.status).toBe('semakan')
  })

  it('creates a manual batch: declaration then one blank item', async () => {
    const { server, requests } = setup({
      ...batchRoutes,
      'POST /api/intake/batches': ok(batch7, {}, 201),
      'POST /api/intake/batches/7/items': ok(item(), {}, 201),
      'GET /api/intake/batches/7': ok({ ...batch7, files: [], fileCount: 0 }),
    })
    const b = await server.createManualBatch(1, {
      subject: 'MAT',
      kertas: 2,
      year: 2025,
      paperType: 'Soalan Umum',
      source: 'Taip sendiri',
      copyright: 'sendiri',
      notes: '',
    })
    expect(b.sourceKind).toBe('manual')
    expect(requests.find((r) => r.url === '/api/intake/batches')?.body).toMatchObject({
      paperType: 'general',
      declaration: true,
    })
    expect(requests.find((r) => r.url === '/api/intake/batches/7/items')?.body).toEqual({ page: 1 })
  })
})

describe('bank client', () => {
  const summary = ok({
    total: 9,
    subjects: [
      { id: '1', name: 'Matematik', icon: null, group: 'teras', total: 5, approved: 2 },
      { id: '2', name: 'Sejarah', icon: null, group: 'teras', total: 4, approved: 4 },
    ],
  })
  const wireDetail = {
    id: '90',
    questionText: 'Nilai ialah?',
    subject: { id: '1', name: 'Matematik' },
    level: { id: '4', name: 'Tingkatan 4' },
    status: 'draft',
    questionType: 'mcq',
    options: ['a', 'b', 'c', 'd'],
    correctAnswer: 0,
    tfAnswer: null,
    correctAnswerText: null,
    modelAnswer: null,
    pointsValue: 1,
    chapterLabel: null,
    createdAt: T0,
    createdBy: { id: '2', name: null },
    dskp: null,
  }

  it('lists only the Bijak subjects, filtered by status, with one read per row', async () => {
    const { server, requests } = setup({
      'GET /api/admin/blueprints': blueprints,
      'GET /api/questions/summary': summary,
      'GET /api/questions': ok([{ ...wireDetail }], { meta: { totalItems: 1 } }),
      'GET /api/questions/90': ok(wireDetail),
    })
    const rows = await server.listBank({ status: 'draf' })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: '90', subject: 'MAT', subjectName: 'Matematik', status: 'draf', kind: 'objektif' })
    const list = requests.find((r) => r.url === '/api/questions')!
    expect(list.query).toMatchObject({ subjectId: '1', status: 'draft' })
    expect(requests.some((r) => r.query?.subjectId === '2')).toBe(false) // no Sejarah blueprint
    expect(await server.listBank({ status: 'draf', kind: 'esei' })).toEqual([])
  })

  it('computes the stats per Bijak subject from counts', async () => {
    const { server } = setup({
      'GET /api/admin/blueprints': blueprints,
      'GET /api/questions/summary': summary,
      'GET /api/questions': (r) =>
        ok([], { meta: { totalItems: r.query?.status === 'draft' ? 3 : r.query?.status === 'review' ? 1 : 0 } }),
    })
    const s = await server.bankStats()
    expect(s.total).toBe(5)
    expect(s.bySubject).toEqual([
      { code: 'MAT', name: 'Matematik', terbit: 2, semakan: 1, draf: 3, ditolak: 0 },
    ])
  })

  it('opens the preview of a question', async () => {
    const { server } = setup({
      'GET /api/admin/blueprints': blueprints,
      'GET /api/questions/90': ok(wireDetail),
    })
    const d = await server.getBankDetail('90')
    expect(d.row.subject).toBe('MAT')
    expect(d.question.mcq?.correct).toBe('A')
  })
})
