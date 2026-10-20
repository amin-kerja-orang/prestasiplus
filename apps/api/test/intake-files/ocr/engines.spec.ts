import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { cropImage, encodeImage } from '../../../src/modules/ocr/images'
import { createOcrEngine, DisabledOcrEngine, TesseractEngine, tesseractUnavailableReason } from '../../../src/modules/ocr/ocr-engine'
import { OcrError } from '../../../src/modules/ocr/ocr.error'
import { scanPdf } from '../pdf-fixtures'
import { engine, isPng, ocrConfig } from './helpers'

describe('OcrConfig', () => {
  it('has the documented defaults', () => {
    const c = ocrConfig()
    expect(c).toMatchObject({
      engine: 'none',
      workers: 2,
      pageTimeoutMs: 30000,
      inspectTimeoutMs: 15000,
      maxPages: 200,
      minTextChars: 20,
      renderDpi: 150,
      maxPixels: 12_000_000,
      workerMemoryMb: 256,
    })
    expect(c.langDir).toBeUndefined()
  })

  it('reads overrides and ignores junk', () => {
    const c = ocrConfig({ OCR_ENGINE: 'Tesseract', OCR_WORKERS: 3, OCR_PAGE_TIMEOUT_MS: 'abc', OCR_MAX_PAGES: -1 })
    expect(c.engine).toBe('tesseract')
    expect(c.workers).toBe(3)
    expect(c.pageTimeoutMs).toBe(30000)
    expect(c.maxPages).toBe(200)
  })
})

describe('DisabledOcrEngine', () => {
  it('is the default, unavailable, and refuses to recognize', async () => {
    const e = createOcrEngine(ocrConfig())
    expect(e).toBeInstanceOf(DisabledOcrEngine)
    expect(e.available).toBe(false)
    await expect(e.recognize(Buffer.alloc(0))).rejects.toMatchObject({ name: 'OcrError', code: 'OCR_UNAVAILABLE' })
  })
})

describe('TesseractEngine gating (never touches the network)', () => {
  it('is unavailable without OCR_LANG_DIR', async () => {
    const e = new TesseractEngine(ocrConfig({ OCR_ENGINE: 'tesseract' }))
    expect(e.available).toBe(false)
    expect(e.unavailableReason).toMatch(/OCR_LANG_DIR/)
    await expect(e.recognize(Buffer.alloc(0))).rejects.toBeInstanceOf(OcrError)
    await expect(e.recognize(Buffer.alloc(0))).rejects.toMatchObject({ code: 'OCR_UNAVAILABLE' })
  })

  it('is unavailable for a relative path, a URL, a missing folder or missing language files', () => {
    const base = { OCR_ENGINE: 'tesseract' }
    expect(tesseractUnavailableReason(ocrConfig({ ...base, OCR_LANG_DIR: 'langs' }))).toMatch(/absolute/)
    expect(tesseractUnavailableReason(ocrConfig({ ...base, OCR_LANG_DIR: 'https://cdn.example/langs' }))).toMatch(/absolute/)
    expect(tesseractUnavailableReason(ocrConfig({ ...base, OCR_LANG_DIR: '/nonexistent/langs' }))).toMatch(/exist/)
    const dir = mkdtempSync(join(tmpdir(), 'pp-lang-'))
    try {
      expect(tesseractUnavailableReason(ocrConfig({ ...base, OCR_LANG_DIR: dir }))).toMatch(/msa/)
      writeFileSync(join(dir, 'msa.traineddata'), 'x')
      expect(tesseractUnavailableReason(ocrConfig({ ...base, OCR_LANG_DIR: dir }))).toMatch(/eng/)
      writeFileSync(join(dir, 'eng.traineddata'), 'x')
      expect(tesseractUnavailableReason(ocrConfig({ ...base, OCR_LANG_DIR: dir }))).toBeNull()
      // Available by configuration; the engine object is built but no worker (and no download) starts here.
      expect(new TesseractEngine(ocrConfig({ ...base, OCR_LANG_DIR: dir })).available).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('is unavailable when OCR_ENGINE is not tesseract even with a folder', () => {
    expect(tesseractUnavailableReason(ocrConfig({ OCR_LANG_DIR: tmpdir() }))).toMatch(/OCR_ENGINE/)
    expect(createOcrEngine(ocrConfig({ OCR_ENGINE: 'tesseract' })).available).toBe(false)
  })
})

describe('image helpers', () => {
  it('encodes a rendered page as webp (or png fallback) with a maximum width, and crops by fractions', async () => {
    const r = await engine().render(scanPdf(1), 1, { dpi: 72, maxPixels: 12_000_000 })
    expect(isPng(r!.png)).toBe(true)
    const thumb = await encodeImage(r!.png, { format: 'webp', maxWidth: 240 })
    expect(thumb.width).toBe(240)
    expect(thumb.height).toBeGreaterThan(300)
    expect(thumb.contentType).toBe(thumb.format === 'webp' ? 'image/webp' : 'image/png')
    if (thumb.format === 'webp') expect(thumb.data.subarray(0, 4).toString('latin1')).toBe('RIFF')
    const png = await encodeImage(r!.png, { format: 'png' })
    expect(png.format).toBe('png')
    expect(png.width).toBe(r!.width)
    expect(isPng(png.data)).toBe(true)
    // Never scaled up.
    expect((await encodeImage(r!.png, { format: 'png', maxWidth: 5000 })).width).toBe(r!.width)

    const crop = await cropImage(r!.png, { x: 0.25, y: 0.5, w: 0.5, h: 0.25 })
    expect(isPng(crop)).toBe(true)
    expect(crop.readUInt32BE(16)).toBe(Math.round(r!.width * 0.5))
    expect(crop.readUInt32BE(20)).toBe(Math.round(r!.height * 0.25))
    // A box past the edge is clamped, not an error.
    const edge = await cropImage(r!.png, { x: 0.9, y: 0.9, w: 0.5, h: 0.5 })
    expect(edge.readUInt32BE(16)).toBeLessThanOrEqual(Math.ceil(r!.width * 0.1) + 1)
  })

  it('reports RENDER_FAILED for bytes that are not an image', async () => {
    await expect(encodeImage(Buffer.from('nope'), { format: 'png' })).rejects.toMatchObject({ code: 'RENDER_FAILED' })
  })
})
