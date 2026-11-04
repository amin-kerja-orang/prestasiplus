import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

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
      pageTimeoutMs: 90000,
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
    expect(c.pageTimeoutMs).toBe(90000)
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

/** Minimal valid PNG signature + IHDR (width 200, height 100); pngSize only reads the header. */
function tinyPng(width = 200, height = 100): Buffer {
  const b = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0)
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12, 'latin1')
  b.writeUInt32BE(width, 16)
  b.writeUInt32BE(height, 20)
  b[24] = 8
  b[25] = 2
  return b
}

const tess = vi.hoisted(() => ({ recognize: vi.fn(), terminate: vi.fn(), createWorker: vi.fn() }))
vi.mock('tesseract.js', () => ({ createWorker: tess.createWorker }))

describe('TesseractEngine recognize (stubbed tesseract.js, no real OCR)', () => {
  const dirs: string[] = []
  const makeEngine = (extra: Record<string, string | number> = {}): TesseractEngine => {
    const dir = mkdtempSync(join(tmpdir(), 'pp-lang-'))
    dirs.push(dir)
    writeFileSync(join(dir, 'msa.traineddata'), '')
    writeFileSync(join(dir, 'eng.traineddata'), '')
    const e = new TesseractEngine(ocrConfig({ OCR_ENGINE: 'tesseract', OCR_LANG_DIR: dir, ...extra }))
    expect(e.available).toBe(true)
    return e
  }
  const reset = (): void => {
    tess.recognize.mockReset()
    tess.terminate.mockReset().mockResolvedValue(undefined)
    tess.createWorker.mockReset().mockImplementation(() => Promise.resolve({ recognize: tess.recognize, terminate: tess.terminate }))
  }
  afterEach(() => {
    vi.useRealTimers()
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })

  it('maps text, confidence, lines and normalised bbox from the recogniser, with local langPath', async () => {
    reset()
    tess.recognize.mockResolvedValue({
      data: {
        text: 'Soalan 1\n',
        confidence: 91.5,
        blocks: [
          {
            paragraphs: [
              {
                lines: [
                  { text: '  Soalan   1 \n', confidence: 93, bbox: { x0: 20, y0: 10, x1: 120, y1: 30 } },
                  { text: '   ', confidence: 50, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
                  { text: 'Edge', confidence: 140, bbox: { x0: 150, y0: 80, x1: 400, y1: 100 } },
                ],
              },
            ],
          },
        ],
      },
    })
    const e = makeEngine()
    const r = await e.recognize(tinyPng(200, 100))
    expect(r.text).toBe('Soalan 1\n')
    expect(r.confidence).toBe(91.5)
    expect(r.blocks).toHaveLength(2)
    const first = r.blocks[0]!
    expect(first).toMatchObject({ text: 'Soalan 1', confidence: 93 })
    expect(first.bbox.x).toBeCloseTo(0.1)
    expect(first.bbox.y).toBeCloseTo(0.1)
    expect(first.bbox.w).toBeCloseTo(0.5)
    expect(first.bbox.h).toBeCloseTo(0.2)
    expect(r.blocks[1]!.text).toBe('Edge')
    expect(r.blocks[1]!.confidence).toBe(100)
    expect(r.blocks[1]!.bbox.x + r.blocks[1]!.bbox.w).toBeLessThanOrEqual(1)
    const [langs, , opts] = tess.createWorker.mock.calls[0]!
    expect(langs).toEqual(['msa', 'eng'])
    expect(opts).toMatchObject({ langPath: expect.stringContaining('pp-lang-'), cacheMethod: 'none' })
    await e.close()
    expect(tess.terminate).toHaveBeenCalledTimes(1)
  })

  it('fails with OCR_TIMEOUT when the recogniser never resolves, and drops the worker', async () => {
    reset()
    tess.recognize.mockReturnValue(new Promise(() => undefined))
    const e = makeEngine({ OCR_PAGE_TIMEOUT_MS: 25 })
    await expect(e.recognize(tinyPng())).rejects.toMatchObject({ name: 'OcrError', code: 'OCR_TIMEOUT' })
    expect(tess.terminate).toHaveBeenCalledTimes(1)
  })

  it('fails with OCR_FAILED when the recogniser throws', async () => {
    reset()
    tess.recognize.mockRejectedValue(new Error('boom'))
    const e = makeEngine()
    await expect(e.recognize(tinyPng())).rejects.toMatchObject({ name: 'OcrError', code: 'OCR_FAILED' })
    expect(tess.terminate).toHaveBeenCalledTimes(1)
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
