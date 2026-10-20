import { IntakeBatchDetailEnvelopeSchema, IntakePageListEnvelopeSchema, type IntakePageList } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { scanPdf, textPdf } from '../pdf-fixtures'
import { bootIntakeApp, createBatch, getBatch, type IntakeTestApp, loginAs, type LoggedIn, uploadOk } from '../helpers'

/** AC1: digital and scanned PDFs end with the same output shape; text PDFs never call OCR. */
let t: IntakeTestApp
let teacher: LoggedIn

beforeAll(async () => {
  t = await bootIntakeApp()
  teacher = await loginAs(t, 'guru@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

async function pagesOf(fileId: string): Promise<IntakePageList> {
  const res = await teacher.agent.get(`/api/intake/files/${fileId}/pages`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return IntakePageListEnvelopeSchema.parse(res.body).data
}

const shapeOf = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.length === 0 ? [] : [shapeOf(v[0])]
  if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shapeOf(x)]).sort(([a], [b]) => String(a).localeCompare(String(b))))
  return v === null ? 'null' : typeof v
}

describe('digital and scanned PDFs (AC1)', () => {
  it('a digital-born PDF yields text and blocks without OCR; a scan renders and uses the OCR engine', async () => {
    const batch = await createBatch(teacher)
    expect(batch.status).toBe('submitted')
    const digital = textPdf(2)
    const scan = scanPdf(2)
    const up = await uploadOk(teacher, batch.id, [{ bytes: digital, filename: 'digital.pdf' }, { bytes: scan, filename: 'imbasan.pdf' }])
    expect(up.files).toHaveLength(2)
    expect(up.files.every((f) => f.status === 'uploaded')).toBe(true)
    expect((await getBatch(teacher, batch.id)).status).toBe('processing')

    await t.drain()

    const detail = await getBatch(teacher, batch.id)
    expect(detail.status).toBe('ready_for_review')
    expect(detail.statusLabel).toBe('Sedia untuk semakan')
    expect(detail.files.map((f) => f.status)).toEqual(['done', 'done'])
    expect(detail.files.map((f) => f.progress)).toEqual([
      { total: 2, done: 2, failed: 0 },
      { total: 2, done: 2, failed: 0 },
    ])
    // OCR ran for the two scanned pages only.
    expect(t.ocr.calls).toHaveLength(2)

    const d = await pagesOf(detail.files[0]!.id)
    const s = await pagesOf(detail.files[1]!.id)
    for (const p of d.pages) {
      expect(p.textSource).toBe('text-layer')
      expect(p.ocrStatus).toBe('not_needed')
      expect(p.ocrConfidence).toBeNull()
      expect(p.text).toContain(`Page ${p.pageNo} line 1`)
      expect(p.blocks.length).toBeGreaterThan(0)
      expect(p.blocks.every((b) => b.confidence === null)).toBe(true)
      expect(p.hasImage).toBe(true)
    }
    for (const p of s.pages) {
      expect(p.textSource).toBe('ocr')
      expect(p.ocrStatus).toBe('done')
      expect(p.ocrConfidence).toBe(91.5)
      expect(p.text).toBe(t.ocr.text)
      expect(p.hasImage).toBe(true)
    }
    // Same output shape: keys and value types of a page entry (nullables compared by their set of keys).
    const keys = (p: object): string[] => Object.keys(p).sort()
    expect(keys(d.pages[0]!)).toEqual(keys(s.pages[0]!))
    expect(shapeOf({ ...d.pages[0]!, ocrConfidence: 1, blocks: [], figures: [] })).toEqual(shapeOf({ ...s.pages[0]!, ocrConfidence: 1, blocks: [], figures: [] }))
    expect(shapeOf(d.pages[0]!.blocks[0])).toEqual({ bbox: { h: 'number', w: 'number', x: 'number', y: 'number' }, confidence: 'null', text: 'string' })
    expect(shapeOf(s.pages[0]!.blocks[0])).toEqual({ bbox: { h: 'number', w: 'number', x: 'number', y: 'number' }, confidence: 'number', text: 'string' })
  })

  it('without an OCR engine every scanned page fails OCR_UNAVAILABLE, a file with only failed pages is failed, and so is its batch', async () => {
    t.ocr.available = false
    t.ocr.calls.length = 0
    try {
      const batch = await createBatch(teacher)
      await uploadOk(teacher, batch.id, [{ bytes: scanPdf(1, 82, 112) }])
      await t.drain()
      const detail = IntakeBatchDetailEnvelopeSchema.parse({ data: await getBatch(teacher, batch.id) }).data
      expect(detail.status).toBe('failed')
      expect(detail.files[0]).toMatchObject({ status: 'failed', errorCode: 'OCR_UNAVAILABLE', progress: { total: 1, done: 0, failed: 1 } })
      expect(t.ocr.calls).toHaveLength(0)
      const pages = await pagesOf(detail.files[0]!.id)
      expect(pages.pages[0]).toMatchObject({ ocrStatus: 'failed', errorCode: 'OCR_UNAVAILABLE', text: null, hasImage: true })
    } finally {
      t.ocr.available = true
    }
  })
})
