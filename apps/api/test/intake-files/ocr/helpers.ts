import { ConfigService } from '@nestjs/config'

import { OcrConfig } from '../../../src/modules/ocr/ocr.config'
import { PdfjsEngine } from '../../../src/modules/ocr/pdfjs.engine'

export function ocrConfig(env: Record<string, string | number> = {}): OcrConfig {
  const values: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) values[k] = String(v)
  return new OcrConfig(new ConfigService(values))
}

export function engine(env: Record<string, string | number> = {}): PdfjsEngine {
  return new PdfjsEngine(ocrConfig(env))
}

/** PNG signature check. */
export function isPng(b: Buffer): boolean {
  return b.length > 8 && b.readUInt32BE(0) === 0x89504e47
}
