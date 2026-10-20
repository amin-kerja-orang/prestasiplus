import { existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'

import { Logger } from '@nestjs/common'

import { OcrError } from './ocr.error'
import type { OcrConfig } from './ocr.config'
import type { OcrEngine, OcrResult, TextBlock } from './ocr.types'
import { abortReason, Semaphore } from './semaphore'

/** Default engine: OCR is switched off (scanned pages fail with OCR_UNAVAILABLE). */
export class DisabledOcrEngine implements OcrEngine {
  readonly available = false

  recognize(): Promise<OcrResult> {
    return Promise.reject(new OcrError('OCR_UNAVAILABLE'))
  }
}

/** Why Tesseract cannot be used with these settings, or `null` when it can. */
export function tesseractUnavailableReason(config: Pick<OcrConfig, 'engine' | 'langDir'>): string | null {
  if (config.engine !== 'tesseract') return 'OCR_ENGINE is not tesseract'
  const dir = config.langDir
  if (!dir) return 'OCR_LANG_DIR is not set'
  if (!isAbsolute(dir) || /^[a-z][a-z0-9+.-]*:\/\//i.test(dir)) return 'OCR_LANG_DIR must be an absolute local folder'
  try {
    if (!statSync(dir).isDirectory()) return 'OCR_LANG_DIR is not a folder'
  } catch {
    return 'OCR_LANG_DIR does not exist'
  }
  for (const lang of ['msa', 'eng']) {
    if (!existsSync(join(dir, `${lang}.traineddata`))) return `${lang}.traineddata is missing in OCR_LANG_DIR`
  }
  return null
}

interface TessWorker {
  recognize(
    image: Buffer,
    options: object,
    output: { blocks: boolean },
  ): Promise<{
    data: {
      text: string
      confidence: number
      blocks: { paragraphs: { lines: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }[] }[] | null
    }
  }>
  terminate(): Promise<unknown>
}

/** PNG width and height from the IHDR chunk (0 when the buffer is not a PNG). */
export function pngSize(png: Buffer): { width: number; height: number } {
  if (png.length < 24 || png.readUInt32BE(0) !== 0x89504e47) return { width: 0, height: 0 }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

/**
 * Tesseract (tesseract.js) with Malay + English from a LOCAL folder. It never uses the CDN: `langPath`
 * is a local folder, `cacheMethod` is `none` and the engine is unavailable unless both traineddata files exist.
 * A pool of up to `workers` Tesseract workers is created lazily; a worker that exceeds the page timeout is
 * terminated and dropped.
 */
export class TesseractEngine implements OcrEngine {
  readonly available: boolean
  readonly unavailableReason: string | null
  private readonly logger = new Logger('TesseractEngine')
  private readonly slots: Semaphore
  private readonly idle: TessWorker[] = []
  private closed = false

  constructor(private readonly config: OcrConfig) {
    this.unavailableReason = tesseractUnavailableReason(config)
    this.available = this.unavailableReason === null
    this.slots = new Semaphore(config.workers)
    if (!this.available) this.logger.warn(`OCR unavailable: ${this.unavailableReason}`)
  }

  private async createWorker(): Promise<TessWorker> {
    const { createWorker } = await import('tesseract.js')
    return (await createWorker(['msa', 'eng'], 1, {
      langPath: this.config.langDir!,
      cachePath: join(tmpdir(), 'pp-tesseract'),
      cacheMethod: 'none',
      gzip: false,
      logger: () => undefined,
    })) as unknown as TessWorker
  }

  async recognize(png: Buffer, signal?: AbortSignal): Promise<OcrResult> {
    if (!this.available || this.closed) throw new OcrError('OCR_UNAVAILABLE')
    const release = await this.slots.acquire(signal)
    let worker: TessWorker | undefined
    let healthy = false
    try {
      worker = this.idle.pop() ?? (await this.createWorker())
      const w = worker
      const result = await new Promise<Awaited<ReturnType<TessWorker['recognize']>>>((resolve, reject) => {
        const onAbort = (): void => reject(abortReason(signal))
        const timer = setTimeout(() => reject(new OcrError('OCR_TIMEOUT')), this.config.pageTimeoutMs)
        signal?.addEventListener('abort', onAbort, { once: true })
        w.recognize(png, {}, { blocks: true }).then(
          (r) => resolve(r),
          () => reject(new OcrError('OCR_FAILED')),
        ).finally(() => {
          clearTimeout(timer)
          signal?.removeEventListener('abort', onAbort)
        })
      })
      healthy = true
      return this.toResult(result.data, png)
    } catch (e) {
      if (e instanceof OcrError) throw e
      if (signal?.aborted) throw e
      throw new OcrError('OCR_FAILED')
    } finally {
      if (worker) {
        if (healthy && !this.closed) this.idle.push(worker)
        else void worker.terminate().catch(() => undefined)
      }
      release()
    }
  }

  private toResult(
    data: Awaited<ReturnType<TessWorker['recognize']>>['data'],
    png: Buffer,
  ): OcrResult {
    const { width, height } = pngSize(png)
    const blocks: TextBlock[] = []
    for (const b of data.blocks ?? []) {
      for (const p of b.paragraphs) {
        for (const l of p.lines) {
          const text = l.text.replace(/\s+/g, ' ').trim()
          if (!text || !width || !height) continue
          const x = Math.min(1, Math.max(0, l.bbox.x0 / width))
          const y = Math.min(1, Math.max(0, l.bbox.y0 / height))
          const x2 = Math.min(1, Math.max(0, l.bbox.x1 / width))
          const y2 = Math.min(1, Math.max(0, l.bbox.y1 / height))
          blocks.push({
            text,
            bbox: { x, y, w: x2 - x, h: y2 - y },
            confidence: Math.min(100, Math.max(0, l.confidence)),
          })
        }
      }
    }
    return {
      text: data.text,
      confidence: Math.min(100, Math.max(0, data.confidence)),
      blocks,
    }
  }

  async close(): Promise<void> {
    this.closed = true
    await Promise.all(this.idle.splice(0).map((w) => w.terminate().catch(() => undefined)))
  }
}

export function createOcrEngine(config: OcrConfig): OcrEngine {
  return config.engine === 'tesseract' ? new TesseractEngine(config) : new DisabledOcrEngine()
}
