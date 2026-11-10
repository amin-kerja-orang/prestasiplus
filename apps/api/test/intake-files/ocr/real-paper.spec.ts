import { AiExtractRequestSchema, type AiExtractRequest } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { segmentPaper } from '../../../src/modules/ai-extraction/providers/paper-segmenter'
import { TesseractEngine } from '../../../src/modules/ocr/ocr-engine'
import { isScannedPage, type OcrEngine, type PdfEngine } from '../../../src/modules/ocr'
import { paperPdf, scannedPaperPdf } from '../pdf-fixtures'
import { SAMPLE_EXPECTED, SAMPLE_PAGE_1, SAMPLE_PAGE_2 } from '../sample-paper'
import { engine, ocrConfig } from './helpers'

/** The page loop of `IntakeProcessingService.processPage`: text layer first, OCR for a page with no text layer. */
async function readPdf(pdf: PdfEngine, ocr: OcrEngine, bytes: Buffer, pageCount: number): Promise<AiExtractRequest> {
  const pages: { page: number; text: string; source: 'text-layer' | 'ocr'; confidence?: number }[] = []
  for (let n = 1; n <= pageCount; n++) {
    const ex = await pdf.extractText(bytes, n)
    if (!isScannedPage(ex, 20)) {
      pages.push({ page: n, text: ex.text, source: 'text-layer' })
      continue
    }
    const png = await pdf.render(bytes, n, { dpi: 150, maxPixels: 12_000_000 })
    if (!png) throw new Error('no canvas')
    const r = await ocr.recognize(png.png)
    pages.push({ page: n, text: r.text, source: 'ocr', confidence: Math.round(r.confidence) })
  }
  return AiExtractRequestSchema.parse({ pages, subject: 'SN', kertas: 1 })
}

const notAvailable: OcrEngine = { available: false, recognize: () => Promise.reject(new Error('OCR off')) }

describe('real paper PDF, text layer', () => {
  it('reads the text layer and segments questions, options, key and rajah groups', async () => {
    const bytes = paperPdf([SAMPLE_PAGE_1, SAMPLE_PAGE_2])
    const req = await readPdf(engine(), notAvailable, bytes, 2)
    expect(req.pages.every((p) => p.source === 'text-layer')).toBe(true)
    const paper = segmentPaper(req)
    expect(paper.questions).toHaveLength(SAMPLE_EXPECTED.questions)
    for (const q of paper.questions) expect(q.options.length, `options of ${q.label}`).toBe(SAMPLE_EXPECTED.options[q.label])
    const label = new Map(paper.stimuli.map((s) => [s.id, s.label]))
    for (const q of paper.questions) expect(q.stimulusId ? label.get(q.stimulusId) : undefined).toBe(SAMPLE_EXPECTED.stimulus[q.label])
    for (const q of paper.questions) expect(q.scheme).toMatchObject({ correct: SAMPLE_EXPECTED.key[q.label] })
  })
})

const langDir = process.env.PP_TEST_TESSDATA
const realOcr = langDir ? describe : describe.skip

/** Needs msa.traineddata and eng.traineddata in the folder named by PP_TEST_TESSDATA (no network is used). */
realOcr('real paper PDF, scanned page through Tesseract', () => {
  it('OCRs the scanned page and segments the whole paper', { timeout: 240_000 }, async () => {
    const scanned = await scannedPaperPdf([SAMPLE_PAGE_2])
    expect(scanned).not.toBeNull()
    const tess = new TesseractEngine(ocrConfig({ OCR_ENGINE: 'tesseract', OCR_LANG_DIR: langDir as string }))
    expect(tess.available).toBe(true)
    try {
      const t0 = Date.now()
      const scanReq = await readPdf(engine(), tess, scanned as Buffer, 1)
      const ms = Date.now() - t0
      expect(scanReq.pages[0]?.source).toBe('ocr')
      const textReq = await readPdf(engine(), tess, paperPdf([SAMPLE_PAGE_1]), 1)
      const paper = segmentPaper({ ...scanReq, pages: [{ ...(textReq.pages[0] as (typeof textReq.pages)[number]) }, { ...(scanReq.pages[0] as (typeof scanReq.pages)[number]), page: 2 }] })
      const found = paper.questions.map((q) => `${q.label}:${String(q.options.length)}`).join(' ')
      console.info(`[t-c4] OCR page ${String(ms)} ms, confidence ${String(scanReq.pages[0]?.confidence)}, questions ${found}`)
      expect(paper.questions.map((q) => q.label)).toEqual(['1', '2', '3', '4', '5', '6'])
      for (const q of paper.questions) expect(q.options.length, `options of ${q.label}`).toBe(SAMPLE_EXPECTED.options[q.label])
      const label = new Map(paper.stimuli.map((s) => [s.id, s.label]))
      for (const q of paper.questions) expect(q.stimulusId ? label.get(q.stimulusId) : undefined).toBe(SAMPLE_EXPECTED.stimulus[q.label])
      expect(paper.questions[4]?.stem).toMatch(/logam/i)
    } finally {
      await tess.close()
    }
  })
})
