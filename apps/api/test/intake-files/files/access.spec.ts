import { createHash } from 'node:crypto'

import {
  IntakeBatchDetailEnvelopeSchema,
  IntakeBatchListResponseSchema,
  IntakePageListEnvelopeSchema,
  type IntakeBatchDetail,
} from '@pp/contract'
import type { Response } from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { IntakeFiguresService } from '../../../src/modules/intake/files'
import { scanPdf, textPdf } from '../pdf-fixtures'
import {
  addAccount,
  binary,
  bootIntakeApp,
  createBatch,
  DECLARATION,
  expectError,
  type IntakeTestApp,
  loginAs,
  type LoggedIn,
  uploadFiles,
  uploadOk,
  walk,
} from '../helpers'

/**
 * AC5 and AC8, plus AC6 (the event loop stays free): the role matrix of all 10 routes, CSRF on the POSTs, 404 for
 * ids outside the caller's scope, served images only to the owner and Admin Pusat, and a recursive scan of every
 * JSON answer for storage details.
 */
let t: IntakeTestApp
let owner: LoggedIn
let other: LoggedIn
let admin: LoggedIn
let schoolAdmin: LoggedIn
let student: LoggedIn
const pdf = scanPdf(2, 100, 112)
let batchId: string
let fileId: string
let figureId: string
const json: unknown[] = []

beforeAll(async () => {
  t = await bootIntakeApp()
  await addAccount(t.db, 'guru.lain@demo.test', 'teacher', 'DEMO001')
  owner = await loginAs(t, 'guru@demo.test')
  other = await loginAs(t, 'guru.lain@demo.test')
  admin = await loginAs(t, 'admin@demo.test')
  schoolAdmin = await loginAs(t, 'adminsekolah@demo.test')
  student = await loginAs(t, 'pelajar@demo.test')

  const created = await createBatch(owner)
  batchId = created.id
  const up = await uploadOk(owner, batchId, [{ bytes: pdf, filename: 'Imbasan Ujian.pdf' }])
  fileId = up.files[0]!.id
  await t.drain()
  const page = (await t.db.query<{ id: string }>(`select id::text from intake_pages where intake_file_id = $1 and page_no = 1`, [fileId]))[0]!
  const figure = await t.app.get(IntakeFiguresService).crop(page.id, { x: 0.1, y: 0.1, w: 0.5, h: 0.4 })
  figureId = figure!.figureId
}, 120_000)
afterAll(async () => {
  await t.close()
})

const send = (who: { agent: LoggedIn['agent'] } | null, method: 'get' | 'post', url: string, csrf?: string | null): Promise<Response> => {
  const agent = who ? who.agent : t.http()
  const req = agent[method](url)
  if (csrf) req.set('X-CSRF-Token', csrf)
  return req as unknown as Promise<Response>
}

const ROUTES: Array<{ name: string; write: boolean; call: (csrf: string | null | undefined, who: LoggedIn | null) => Promise<Response>; idRoute: boolean; ok: number }> = [
  { name: 'POST /intake/batches', write: true, idRoute: false, ok: 201, call: (csrf, who) => (who ? who.agent : t.http()).post('/api/intake/batches').set(csrf ? { 'X-CSRF-Token': csrf } : {}).send(DECLARATION) as unknown as Promise<Response> },
  { name: 'GET /intake/batches', write: false, idRoute: false, ok: 200, call: (_c, who) => send(who, 'get', '/api/intake/batches') },
  { name: 'GET /intake/batches/:id', write: false, idRoute: true, ok: 200, call: (_c, who) => send(who, 'get', `/api/intake/batches/${batchId}`) },
  { name: 'POST /intake/batches/:id/files', write: true, idRoute: true, ok: 201, call: (csrf, who) => uploadFiles(who ?? { agent: t.http() as never, csrf: '' }, batchId, [{ bytes: textPdf(1, 40) }], { csrf: csrf ?? null }) },
  { name: 'POST /intake/batches/:id/cancel', write: true, idRoute: true, ok: 200, call: (csrf, who) => send(who, 'post', `/api/intake/batches/${batchId}/cancel`, csrf) },
  { name: 'GET /intake/files/:id/pages', write: false, idRoute: true, ok: 200, call: (_c, who) => send(who, 'get', `/api/intake/files/${fileId}/pages`) },
  { name: 'GET /intake/files/:id/pages/:n/image', write: false, idRoute: true, ok: 200, call: (_c, who) => send(who, 'get', `/api/intake/files/${fileId}/pages/1/image`) },
  { name: 'GET /intake/files/:id/pages/:n/thumb', write: false, idRoute: true, ok: 200, call: (_c, who) => send(who, 'get', `/api/intake/files/${fileId}/pages/1/thumb`) },
  { name: 'GET /intake/figures/:id/image', write: false, idRoute: true, ok: 200, call: (_c, who) => send(who, 'get', `/api/intake/figures/${figureId}/image`) },
  { name: 'GET /intake/files/:id/original', write: false, idRoute: true, ok: 200, call: (_c, who) => send(who, 'get', `/api/intake/files/${fileId}/original`) },
]

describe('role matrix (AC8)', () => {
  it.each(ROUTES.map((r) => [r.name, r] as const))('%s: anonymous 401, student 403, school admin 403', async (_n, r) => {
    expectError(await r.call(null, null), 'UNAUTHORIZED')
    expectError(await r.call(student.csrf, student), 'FORBIDDEN')
    expectError(await r.call(schoolAdmin.csrf, schoolAdmin), 'FORBIDDEN')
  })

  it.each(ROUTES.filter((r) => r.write).map((r) => [r.name, r] as const))('%s: a missing or wrong CSRF token is 403 CSRF_INVALID', async (_n, r) => {
    expectError(await r.call(null, owner), 'CSRF_INVALID')
    expectError(await r.call('not-the-token', owner), 'CSRF_INVALID')
  })

  it.each(ROUTES.filter((r) => r.idRoute).map((r) => [r.name, r] as const))('%s: another teacher gets 404, never 403', async (_n, r) => {
    const res = await r.call(other.csrf, other)
    expectError(res, 'NOT_FOUND')
  })

  it('unknown and malformed ids are 404 for the owner too', async () => {
    for (const url of [
      '/api/intake/batches/999999999',
      '/api/intake/batches/abc',
      '/api/intake/files/999999999/pages',
      '/api/intake/files/abc/original',
      `/api/intake/files/${fileId}/pages/0/image`,
      `/api/intake/files/${fileId}/pages/99/image`,
      `/api/intake/files/${fileId}/pages/x/thumb`,
      '/api/intake/figures/999999999/image',
      '/api/intake/figures/abc/image',
    ]) {
      expectError(await owner.agent.get(url), 'NOT_FOUND')
    }
    expectError(await owner.agent.post('/api/intake/batches/999999999/cancel').set('X-CSRF-Token', owner.csrf), 'NOT_FOUND')
    expectError(await uploadFiles(owner, '999999999', [{ bytes: textPdf(1, 41) }]), 'NOT_FOUND')
  })

  it('create validates the declaration with the contract (422, fields by name)', async () => {
    const res = await owner.agent.post('/api/intake/batches').set('X-CSRF-Token', owner.csrf).send({ ...DECLARATION, declaration: false, year: 1800, subject: 'mat', extra: 1 })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['declaration', 'year', 'subject']))
    const bad = await owner.agent.get('/api/intake/batches?page=0&status=nope')
    expect(bad.status).toBe(422)
  })
})

describe('scope of data and served bytes (AC5)', () => {
  it('the owner and Admin Pusat read page image, thumb, figure and original; the headers are strict', async () => {
    for (const who of [owner, admin]) {
      for (const [url, mime] of [
        [`/api/intake/files/${fileId}/pages/1/image`, 'image/webp'],
        [`/api/intake/files/${fileId}/pages/2/thumb`, 'image/webp'],
        [`/api/intake/figures/${figureId}/image`, 'image/png'],
      ] as const) {
        const res = await who.agent.get(url).buffer().parse(binary)
        expect(res.status, url).toBe(200)
        expect(res.headers['content-type']).toBe(mime)
        expect(res.headers['x-content-type-options']).toBe('nosniff')
        expect(res.headers['cache-control']).toBe('no-store')
        expect(res.headers['content-disposition']).toBe('inline')
        expect((res.body as Buffer).length).toBeGreaterThan(20)
      }
      const original = await who.agent.get(`/api/intake/files/${fileId}/original`).buffer().parse(binary)
      expect(original.status).toBe(200)
      expect(original.headers['content-type']).toBe('application/pdf')
      expect(original.headers['x-content-type-options']).toBe('nosniff')
      expect(original.headers['cache-control']).toBe('no-store')
      expect(original.headers['content-disposition']).toBe('attachment; filename="Imbasan Ujian.pdf"')
      expect(createHash('sha256').update(original.body as Buffer).digest('hex')).toBe(createHash('sha256').update(pdf).digest('hex'))
    }
  })

  it('a thumbnail is at most 240 px wide and the image is the rendered page', async () => {
    const pages = IntakePageListEnvelopeSchema.parse((await owner.agent.get(`/api/intake/files/${fileId}/pages`)).body).data.pages
    expect(pages).toHaveLength(2)
    expect(pages.every((p) => p.hasImage && (p.width ?? 0) > 240)).toBe(true)
    const thumb = (await owner.agent.get(`/api/intake/files/${fileId}/pages/1/thumb`).buffer().parse(binary)).body as Buffer
    // WebP: RIFF....WEBP then VP8 / VP8L / VP8X; the width sits at different offsets, so check through the canvas.
    const { loadImage } = await import('@napi-rs/canvas')
    const img = await loadImage(thumb)
    expect(img.width).toBeLessThanOrEqual(240)
    expect(img.width).toBeGreaterThan(0)
  })

  it('a page without an image is 404', async () => {
    const b = await createBatch(owner)
    const up = await uploadOk(owner, b.id, [{ bytes: textPdf(1, 42) }])
    // not processed yet: pending page, no image
    expectError(await owner.agent.get(`/api/intake/files/${up.files[0]!.id}/pages/1/image`), 'NOT_FOUND')
    expectError(await owner.agent.get(`/api/intake/files/${up.files[0]!.id}/pages/1/thumb`), 'NOT_FOUND')
  })

  it('no JSON answer carries a storage key, a hash, a path or the storage folder', async () => {
    const b = await createBatch(owner)
    json.push(b)
    const up = await uploadFiles(owner, b.id, [{ bytes: textPdf(2, 43), filename: '../../etc/passwd.pdf' }])
    json.push(up.body)
    await t.drain()
    for (const who of [owner, admin]) {
      for (const url of ['/api/intake/batches', `/api/intake/batches/${batchId}`, `/api/intake/batches/${b.id}`, `/api/intake/files/${fileId}/pages`]) {
        const res = await who.agent.get(url)
        expect(res.status).toBe(200)
        json.push(res.body)
      }
    }
    const c = await createBatch(owner)
    const cancelled = await owner.agent.post(`/api/intake/batches/${c.id}/cancel`).set('X-CSRF-Token', owner.csrf)
    expect(cancelled.status).toBe(200)
    json.push(cancelled.body)
    // A finished batch cannot be cancelled: 409, with the standard error body.
    const conflict = await owner.agent.post(`/api/intake/batches/${b.id}/cancel`).set('X-CSRF-Token', owner.csrf)
    expectError(conflict, 'CONFLICT')
    expect(json.length).toBeGreaterThan(8)

    const hashes = [pdf, textPdf(2, 43)].map((x) => createHash('sha256').update(x).digest('hex'))
    const seenKeys = new Set<string>()
    for (const body of json) {
      walk(body, (key, v) => {
        if (key) seenKeys.add(key)
        if (typeof v === 'string' && key !== 'requestId') {
          expect(v).not.toContain(t.dir)
          expect(v, `${String(key)} in ${JSON.stringify(body).slice(0, 300)}`).not.toMatch(/intake-(original|page|figure)\/|\.webp\b|\/tmp\/|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)
          for (const h of hashes) expect(v).not.toContain(h)
        }
      })
    }
    expect([...seenKeys].filter((k) => /storage|sha|hash|path|publicid|file_?key|bucket|url/i.test(k))).toEqual([])
    // The hostile client name is stored as a plain name, never a path.
    const detail = IntakeBatchDetailEnvelopeSchema.parse((await owner.agent.get(`/api/intake/batches/${b.id}`)).body).data
    expect(detail.files[0]!.originalName).toBe('passwd.pdf')
  })

  it('a teacher lists only own batches; Admin Pusat sees all; paging and the status filter work', async () => {
    const mine = IntakeBatchListResponseSchema.parse((await owner.agent.get('/api/intake/batches?pageSize=100')).body)
    const theirs = IntakeBatchListResponseSchema.parse((await other.agent.get('/api/intake/batches')).body)
    const all = IntakeBatchListResponseSchema.parse((await admin.agent.get('/api/intake/batches?pageSize=100')).body)
    expect(theirs.data).toEqual([])
    expect(theirs.meta).toMatchObject({ totalItems: 0, from: null, to: null })
    expect(all.meta.totalItems).toBe(mine.meta.totalItems)
    expect(mine.data.every((b) => b.owner?.name === 'Guru Demo')).toBe(true)
    expect(mine.data.map((b) => b.id)).toEqual([...mine.data.map((b) => b.id)].sort((a, c) => Number(c) - Number(a)))
    const ready = IntakeBatchListResponseSchema.parse((await owner.agent.get('/api/intake/batches?status=ready_for_review&pageSize=1&page=1')).body)
    expect(ready.data.every((b) => b.status === 'ready_for_review')).toBe(true)
    expect(ready.meta.pageSize).toBe(1)
    // The other teacher creates one; the admin now sees both owners.
    await createBatch(other)
    const both = IntakeBatchListResponseSchema.parse((await admin.agent.get('/api/intake/batches?pageSize=100')).body)
    expect(new Set(both.data.map((b) => b.owner?.id)).size).toBe(2)
    expect(both.meta.totalItems).toBe(all.meta.totalItems + 1)
  })

  it('Admin Pusat can read any batch and its detail parses', async () => {
    const res = await admin.agent.get(`/api/intake/batches/${batchId}`)
    const d: IntakeBatchDetail = IntakeBatchDetailEnvelopeSchema.parse(res.body).data
    expect(d.id).toBe(batchId)
    expect(d.copyright).toBe('sendiri')
    expect(d.source).toBe(DECLARATION.source)
    expect(d.notes).toBe(DECLARATION.notes)
    expect(d.adminNotes).toBeNull()
    expect(d.submittedAt).toMatch(/\+08:00$/)
  })
})

describe('non-ASCII client file names', () => {
  it('are stored as sent (UTF-8) and downloaded with an ASCII fallback plus filename*', async () => {
    const b = await createBatch(owner)
    const up = await uploadOk(owner, b.id, [{ bytes: textPdf(1, 44), filename: 'Kertas Ujian \u00e9\u00f1 \u4e2d.pdf' }])
    expect(up.files[0]!.originalName).toBe('Kertas Ujian \u00e9\u00f1 \u4e2d.pdf')
    const res = await owner.agent.get(`/api/intake/files/${up.files[0]!.id}/original`).buffer().parse(binary)
    expect(res.status).toBe(200)
    expect(res.headers['content-disposition']).toBe(`attachment; filename="Kertas Ujian __ _.pdf"; filename*=UTF-8''Kertas%20Ujian%20%C3%A9%C3%B1%20%E4%B8%AD.pdf`)
  })
})

describe('the event loop stays free while pages render (AC6)', () => {
  it('GET /api/health answers within 200 ms while a page job renders and OCR runs', async () => {
    const b = await createBatch(owner)
    await uploadOk(owner, b.id, [{ bytes: scanPdf(6, 102, 112) }])
    t.ocr.delayMs = 150
    try {
      await t.jobs.runOnce(1) // process_file fans out
      const running = t.jobs.runOnce(2) // two page jobs at once: render in a worker thread, then the fake OCR
      const latencies: number[] = []
      for (let i = 0; i < 12; i++) {
        const started = performance.now()
        const res = await t.http().get('/api/health')
        latencies.push(performance.now() - started)
        expect(res.status).toBe(200)
        await new Promise((r) => setTimeout(r, 20))
      }
      await running
      expect(Math.max(...latencies)).toBeLessThan(200)
      await t.drain()
    } finally {
      t.ocr.delayMs = 0
    }
    expect((await owner.agent.get(`/api/intake/batches/${b.id}`)).body.data.status).toBe('ready_for_review')
  })
})
