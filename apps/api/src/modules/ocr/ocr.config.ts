import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { OCR_MIN_TEXT_CHARS } from './ocr.types'

function positive(value: unknown, fallback: number): number {
  const n = Number(value)
  return value !== undefined && value !== null && value !== '' && Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Settings of the OCR module, read from the environment (all optional):
 * OCR_ENGINE (`none` default | `tesseract`), OCR_LANG_DIR (absolute folder with msa + eng traineddata),
 * OCR_WORKERS (2), OCR_PAGE_TIMEOUT_MS (30000), OCR_INSPECT_TIMEOUT_MS (15000), OCR_MAX_PAGES (200),
 * OCR_MIN_TEXT_CHARS (20), OCR_RENDER_DPI (150), OCR_MAX_PIXELS (12000000), OCR_WORKER_MEMORY_MB (256).
 * Read untyped so the class does not depend on the env schema listing the keys.
 */
@Injectable()
export class OcrConfig {
  readonly engine: 'none' | 'tesseract'
  readonly langDir: string | undefined
  readonly workers: number
  readonly pageTimeoutMs: number
  readonly inspectTimeoutMs: number
  readonly maxPages: number
  readonly minTextChars: number
  readonly renderDpi: number
  readonly maxPixels: number
  readonly workerMemoryMb: number
  /** RSS growth of the process, in MB, that the watchdog treats as a runaway worker. */
  readonly workerRssLimitMb: number

  constructor(@Inject(ConfigService) config: ConfigService) {
    const str = (key: string): string | undefined => {
      const v = config.get<string>(key)
      return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
    }
    this.engine = str('OCR_ENGINE')?.toLowerCase() === 'tesseract' ? 'tesseract' : 'none'
    this.langDir = str('OCR_LANG_DIR')
    this.workers = Math.floor(positive(config.get('OCR_WORKERS'), 2))
    this.pageTimeoutMs = positive(config.get('OCR_PAGE_TIMEOUT_MS'), 30_000)
    this.inspectTimeoutMs = positive(config.get('OCR_INSPECT_TIMEOUT_MS'), 15_000)
    this.maxPages = Math.floor(positive(config.get('OCR_MAX_PAGES'), 200))
    this.minTextChars = Math.floor(positive(config.get('OCR_MIN_TEXT_CHARS'), OCR_MIN_TEXT_CHARS))
    this.renderDpi = positive(config.get('OCR_RENDER_DPI'), 150)
    this.maxPixels = Math.floor(positive(config.get('OCR_MAX_PIXELS'), 12_000_000))
    this.workerMemoryMb = Math.floor(positive(config.get('OCR_WORKER_MEMORY_MB'), 256))
    this.workerRssLimitMb = Math.floor(positive(config.get('OCR_WORKER_RSS_LIMIT_MB'), this.workerMemoryMb * 2))
  }
}
