import { describe, expect, it } from 'vitest'

import { isScannedPage } from '../../../src/modules/ocr/ocr.types'
import { OcrError } from '../../../src/modules/ocr/ocr.error'
import { bombPdf, corruptPdf, encryptedPdf, scanPdf, textPdf } from '../pdf-fixtures'
import { engine, isPng } from './helpers'

describe('PdfjsEngine', () => {
  it('inspects page counts', async () => {
    const e = engine()
    expect(await e.inspect(textPdf(1))).toEqual({ pageCount: 1, encrypted: false })
    expect((await e.inspect(textPdf(7))).pageCount).toBe(7)
    expect((await e.inspect(scanPdf(3))).pageCount).toBe(3)
  })

  it('rejects an encrypted PDF (byte scan and pdfjs PasswordException)', async () => {
    const e = engine()
    await expect(e.inspect(encryptedPdf())).rejects.toMatchObject({ code: 'ENCRYPTED' })
    // The /Encrypt name is hidden from the byte scan; pdfjs itself must still refuse it.
    await expect(e.inspect(encryptedPdf({ hideName: true }))).rejects.toMatchObject({ code: 'ENCRYPTED' })
  })

  it('rejects a corrupt PDF', async () => {
    const e = engine()
    const err = await e.inspect(corruptPdf()).catch((x: unknown) => x)
    expect(err).toBeInstanceOf(OcrError)
    expect((err as OcrError).code).toBe('CORRUPT')
    await expect(e.inspect(Buffer.from('not a pdf at all'))).rejects.toMatchObject({ code: 'CORRUPT' })
  })

  it('extracts lines with fraction bboxes (y from the top) from a text layer', async () => {
    const e = engine()
    const p = await e.extractText(textPdf(2, 4), 2)
    expect(p.pageNo).toBe(2)
    expect(p.width).toBeCloseTo(595, 0)
    expect(p.height).toBeCloseTo(842, 0)
    expect(p.blocks).toHaveLength(4)
    expect(p.text.split('\n')).toEqual(p.blocks.map((b) => b.text))
    expect(p.text.split('\n')[0]).toBe('Page 2 line 1: Soalan ujian sintetik untuk pemprosesan')
    expect(p.charCount).toBe(p.text.length)
    for (const b of p.blocks) {
      expect(b.confidence).toBeNull()
      expect(b.bbox.x).toBeGreaterThan(0)
      expect(b.bbox.w).toBeGreaterThan(0.2)
      expect(b.bbox.h).toBeGreaterThan(0)
      expect(b.bbox.x + b.bbox.w).toBeLessThanOrEqual(1)
      expect(b.bbox.y + b.bbox.h).toBeLessThanOrEqual(1)
    }
    // Lines run top to bottom, near the top of the page (text starts at y=790 of 842).
    const ys = p.blocks.map((b) => b.bbox.y)
    expect([...ys].sort((a, b) => a - b)).toEqual(ys)
    expect(ys[0]).toBeLessThan(0.1)
    expect(isScannedPage(p)).toBe(false)
  })

  it('treats an image-only page as scanned and renders it to PNG', async () => {
    const e = engine()
    const pdf = scanPdf(2)
    const p = await e.extractText(pdf, 1)
    expect(p.charCount).toBe(0)
    expect(p.blocks).toEqual([])
    expect(isScannedPage(p)).toBe(true)
    expect(isScannedPage({ charCount: 19 })).toBe(true)
    expect(isScannedPage({ charCount: 20 })).toBe(false)
    const r = await e.render(pdf, 1, { dpi: 150, maxPixels: 12_000_000 })
    expect(r).not.toBeNull()
    expect(isPng(r!.png)).toBe(true)
    // A4 at 150 dpi is about 1240 x 1754 px.
    expect(r!.width).toBeGreaterThan(1200)
    expect(r!.width).toBeLessThan(1260)
    expect(r!.height).toBeGreaterThan(1700)
    expect(r!.height).toBeLessThan(1780)
  })

  it('clamps the render size to maxPixels', async () => {
    const r = await engine().render(textPdf(1), 1, { dpi: 300, maxPixels: 500_000 })
    expect(r!.width * r!.height).toBeLessThanOrEqual(500_000)
    expect(r!.width * r!.height).toBeGreaterThan(400_000)
  })

  it('fails a page number out of range without crashing', async () => {
    await expect(engine().extractText(textPdf(1), 5)).rejects.toMatchObject({ code: 'OCR_FAILED' })
  })

  it('survives a FlateDecode bomb: bounded, typed error or result, process stays up', async () => {
    const e = engine({ OCR_PAGE_TIMEOUT_MS: 8000, OCR_INSPECT_TIMEOUT_MS: 8000, OCR_WORKER_MEMORY_MB: 128 })
    const bomb = await bombPdf(600)
    expect(bomb.length).toBeLessThan(5 * 1024 * 1024)
    const started = Date.now()
    const rss0 = process.memoryUsage().rss
    const outcomes: string[] = []
    for (const op of ['inspect', 'text'] as const) {
      try {
        if (op === 'inspect') outcomes.push(`inspect:${(await e.inspect(bomb)).pageCount}`)
        else outcomes.push(`text:${(await e.extractText(bomb, 1)).charCount}`)
      } catch (err) {
        expect(err).toBeInstanceOf(OcrError)
        outcomes.push(`${op}:${(err as OcrError).code}`)
      }
    }
    console.log(`[bomb] outcomes=${outcomes.join(',')} elapsed=${Date.now() - started}ms rssDelta=${Math.round((process.memoryUsage().rss - rss0) / 1048576)}MB`)
    expect(Date.now() - started).toBeLessThan(25_000)
    expect(outcomes[0]).toMatch(/^(inspect:1|inspect:TOO_COMPLEX)$/)
    // Inflating the stream is refused (memory watchdog) or times out; it is never read to the end.
    expect(outcomes[1]).toMatch(/^text:(TOO_COMPLEX|OCR_TIMEOUT)$/)
    // The engine still works afterwards.
    expect((await e.inspect(textPdf(2))).pageCount).toBe(2)
  }, 60_000)

  it('bounds concurrency by OCR_WORKERS', async () => {
    const e = engine({ OCR_WORKERS: 1 })
    const pdf = textPdf(1)
    const t0 = Date.now()
    const res = await Promise.all([e.inspect(pdf), e.inspect(pdf), e.inspect(pdf)])
    expect(res.map((r) => r.pageCount)).toEqual([1, 1, 1])
    expect(Date.now() - t0).toBeGreaterThan(0)
  })

  it('honours an already aborted signal and aborts a running task', async () => {
    const e = engine()
    const done = new AbortController()
    done.abort()
    await expect(e.inspect(textPdf(1), done.signal)).rejects.toMatchObject({ name: 'AbortError' })
    const ac = new AbortController()
    const p = e.extractText(textPdf(20, 40), 1, ac.signal)
    ac.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  })
})
