import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { activePdf, textPdf } from '../pdf-fixtures'
import { engine, isPng } from './helpers'

describe('pdfjs security (AC-7)', () => {
  let server: Server
  let port: number
  const hits: string[] = []

  beforeAll(async () => {
    server = createServer((req, res) => {
      hits.push(`${req.method} ${req.url}`)
      res.end('x')
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    port = (server.address() as AddressInfo).port
  })
  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()))
  })

  it('executes no script and follows no link while inspecting, extracting and rendering', async () => {
    const e = engine()
    const pdf = activePdf(port)
    expect(pdf.includes(`127.0.0.1:${port}/uri`)).toBe(true)
    expect(pdf.includes('/JavaScript')).toBe(true)
    expect(pdf.includes('/Launch')).toBe(true)

    expect((await e.inspect(pdf)).pageCount).toBe(1)
    const text = await e.extractText(pdf, 1)
    expect(text.text).toContain('Active content test page')
    const img = await e.render(pdf, 1, { dpi: 100, maxPixels: 12_000_000 })
    expect(isPng(img!.png)).toBe(true)

    // Give any stray request time to arrive.
    await new Promise((r) => setTimeout(r, 400))
    expect(hits).toEqual([])
  })
})

describe('worker time limits', () => {
  it('a page operation over OCR_PAGE_TIMEOUT_MS is OCR_TIMEOUT and the worker is terminated', async () => {
    // A heavy page (many lines, 300 dpi render) cannot finish in 30 ms including worker start-up.
    const e = engine({ OCR_PAGE_TIMEOUT_MS: 30 })
    const pdf = textPdf(1, 60)
    const started = Date.now()
    await expect(e.render(pdf, 1, { dpi: 300, maxPixels: 12_000_000 })).rejects.toMatchObject({ code: 'OCR_TIMEOUT' })
    expect(Date.now() - started).toBeLessThan(2000)
    // The timed-out worker is gone: the engine's slot is free and the next call with a sane limit works.
    const ok = engine({ OCR_PAGE_TIMEOUT_MS: 30_000, OCR_WORKERS: 1 })
    await expect(ok.extractText(pdf, 1)).resolves.toMatchObject({ pageNo: 1 })
  })

  it('an inspect over OCR_INSPECT_TIMEOUT_MS is TOO_COMPLEX', async () => {
    const e = engine({ OCR_INSPECT_TIMEOUT_MS: 1 })
    await expect(e.inspect(textPdf(1))).rejects.toMatchObject({ code: 'TOO_COMPLEX' })
  })

  it('a timeout frees the slot: with one worker, a timed-out task does not block the next', async () => {
    const e = engine({ OCR_WORKERS: 1, OCR_PAGE_TIMEOUT_MS: 30 })
    const pdf = textPdf(1, 60)
    const r1 = e.render(pdf, 1, { dpi: 300, maxPixels: 12_000_000 }).catch((x: unknown) => x)
    const r2 = e.render(pdf, 1, { dpi: 300, maxPixels: 12_000_000 }).catch((x: unknown) => x)
    expect(await r1).toMatchObject({ code: 'OCR_TIMEOUT' })
    expect(await r2).toMatchObject({ code: 'OCR_TIMEOUT' })
  })

  it('terminates worker threads it started (no thread left behind)', async () => {
    const e = engine({ OCR_PAGE_TIMEOUT_MS: 30 })
    const before = process.getActiveResourcesInfo().filter((r) => r === 'MessagePort' || r === 'Worker').length
    await e.render(textPdf(1, 60), 1, { dpi: 300, maxPixels: 12_000_000 }).catch(() => undefined)
    await new Promise((r) => setTimeout(r, 300))
    const after = process.getActiveResourcesInfo().filter((r) => r === 'MessagePort' || r === 'Worker').length
    expect(after).toBeLessThanOrEqual(before)
  })
})
