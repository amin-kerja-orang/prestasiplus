import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'

import { Inject, Injectable } from '@nestjs/common'

import { OcrError, OcrWatchdogError, type OcrErrorCode } from './ocr.error'
import { OcrConfig } from './ocr.config'
import type { PageExtraction, PdfEngine, PdfInspection, RenderedPage } from './ocr.types'
import { PDF_WORKER_CODE } from './pdf-worker-code'
import { abortReason, Semaphore } from './semaphore'

const require_ = createRequire(import.meta.url)

interface Resolved {
  pdfjsUrl: string
  canvasPath: string
  standardFontDataUrl: string
  cMapUrl: string
  wasmUrl: string
  iccUrl: string
}

let resolved: Resolved | undefined

/** Absolute, local locations of pdfjs and its data folders (nothing is ever fetched from a URL). */
function resolvePaths(): Resolved {
  if (resolved) return resolved
  const pdfjsEntry = require_.resolve('pdfjs-dist/legacy/build/pdf.mjs')
  const root = join(dirname(pdfjsEntry), '..', '..')
  let canvasPath = ''
  try {
    canvasPath = require_.resolve('@napi-rs/canvas')
  } catch {
    canvasPath = join(root, '__no_canvas__')
  }
  resolved = {
    pdfjsUrl: pathToFileURL(pdfjsEntry).href,
    canvasPath,
    standardFontDataUrl: join(root, 'standard_fonts') + '/',
    cMapUrl: join(root, 'cmaps') + '/',
    wasmUrl: join(root, 'wasm') + '/',
    iccUrl: join(root, 'iccs') + '/',
  }
  return resolved
}

type Op = 'inspect' | 'text' | 'render'

interface WorkerMessage {
  ok: boolean
  result?: unknown
  error?: { name: string; message: string }
}

/**
 * pdfjs-dist in a short-lived worker thread per operation (`eval: true`, see pdf-worker-code.ts).
 * Hard wall-clock timeout and a heap limit per worker; at most `workers` run at once. The main
 * event loop never parses or renders a page.
 */
@Injectable()
export class PdfjsEngine implements PdfEngine {
  private readonly slots: Semaphore
  /** Own pool for the upload-time inspect, so a queue of page jobs can never starve uploads. */
  private readonly inspectSlots: Semaphore

  constructor(@Inject(OcrConfig) private readonly config: OcrConfig) {
    this.slots = new Semaphore(config.workers)
    this.inspectSlots = new Semaphore(config.workers)
  }

  async inspect(bytes: Buffer, signal?: AbortSignal): Promise<PdfInspection> {
    // An /Encrypt entry in a trailer or xref-stream dictionary is stored uncompressed. A PDF that is
    // encrypted but opens with the empty password is rejected too (kept simple: all encryption is refused).
    if (bytes.includes('/Encrypt')) throw new OcrError('ENCRYPTED')
    const r = await this.run<{ pageCount: number }>('inspect', bytes, {}, signal)
    return { pageCount: r.pageCount, encrypted: false }
  }

  async extractText(bytes: Buffer, pageNo: number, signal?: AbortSignal): Promise<PageExtraction> {
    return await this.run<PageExtraction>('text', bytes, { pageNo }, signal)
  }

  async render(
    bytes: Buffer,
    pageNo: number,
    opts: { dpi: number; maxPixels: number },
    signal?: AbortSignal,
  ): Promise<RenderedPage | null> {
    const r = await this.run<{ unavailable?: true; png?: Uint8Array; width?: number; height?: number }>(
      'render',
      bytes,
      { pageNo, dpi: opts.dpi, maxPixels: opts.maxPixels },
      signal,
    )
    if (r.unavailable || !r.png) return null
    return { png: Buffer.from(r.png.buffer, r.png.byteOffset, r.png.byteLength), width: r.width!, height: r.height! }
  }

  private async run<T>(op: Op, bytes: Buffer, extra: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    const release = await (op === 'inspect' ? this.inspectSlots : this.slots).acquire(signal)
    try {
      return await this.execute<T>(op, bytes, extra, signal)
    } finally {
      release()
    }
  }

  private execute<T>(op: Op, bytes: Buffer, extra: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(abortReason(signal))
    const paths = resolvePaths()
    const inspect = op === 'inspect'
    const timeoutMs = inspect ? this.config.inspectTimeoutMs : this.config.pageTimeoutMs
    // Inspect failures that are not "corrupt" mean the file is too heavy; page work that stalls is a timeout.
    const timeoutCode: OcrErrorCode = inspect ? 'TOO_COMPLEX' : 'OCR_TIMEOUT'
    const failCode: OcrErrorCode = inspect ? 'CORRUPT' : op === 'render' ? 'RENDER_FAILED' : 'OCR_FAILED'

    return new Promise<T>((resolve, reject) => {
      const data = new Uint8Array(bytes.byteLength)
      data.set(bytes)
      const worker = new Worker(PDF_WORKER_CODE, {
        eval: true,
        env: {}, // the worker sees no variable of this process (no secrets, no DATABASE_URL)
        workerData: {
          op,
          bytes: data,
          ...paths,
          maxImagePixels: this.config.maxPixels,
          ...extra,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: this.config.workerMemoryMb,
          maxYoungGenerationSizeMb: 64,
        },
      })
      let settled = false
      const finish = (fn: () => void): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        clearInterval(watchdog)
        signal?.removeEventListener('abort', onAbort)
        void worker.terminate().catch(() => undefined)
        fn()
      }
      // The V8 heap limit does not cover typed arrays (a FlateDecode bomb inflates into ArrayBuffers), and
      // arrayBuffers of a worker are invisible from the parent, so watch the process RSS growth instead.
      const rss0 = process.memoryUsage.rss()
      const rssLimit = this.config.workerRssLimitMb * 1024 * 1024
      const watchdog = setInterval(() => {
        if (process.memoryUsage.rss() - rss0 > rssLimit) {
          finish(() => reject(new OcrWatchdogError()))
        }
      }, 25)
      const timer = setTimeout(() => finish(() => reject(new OcrError(timeoutCode, 'timeout'))), timeoutMs)
      const onAbort = (): void => finish(() => reject(abortReason(signal)))
      signal?.addEventListener('abort', onAbort, { once: true })

      worker.once('message', (msg: WorkerMessage) =>
        finish(() => {
          if (msg.ok) return resolve(msg.result as T)
          reject(this.mapError(msg.error?.name ?? '', failCode, msg.error?.message))
        }),
      )
      worker.once('error', (err: Error & { code?: string }) =>
        finish(() =>
          reject(
            err.code === 'ERR_WORKER_OUT_OF_MEMORY' ? new OcrError('TOO_COMPLEX', 'memory') : new OcrError(failCode),
          ),
        ),
      )
      worker.once('exit', () => finish(() => reject(new OcrError('TOO_COMPLEX', 'worker exited'))))
    })
  }

  private mapError(name: string, failCode: OcrErrorCode, detail?: string): OcrError {
    if (name === 'PasswordException') return new OcrError('ENCRYPTED')
    if (name === 'InvalidPDFException' || name === 'FormatError' || name === 'MissingPDFException') {
      return new OcrError('CORRUPT')
    }
    // Structural pdfjs message only (no file content); useful in logs.
    return new OcrError(failCode, `${failCode}: ${name}: ${detail ?? ''}`)
  }
}
