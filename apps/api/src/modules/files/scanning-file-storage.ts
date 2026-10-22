import { createHash } from 'node:crypto'

import { Logger } from '@nestjs/common'

import { ApiError } from '../../common/errors/api-error'
import type { FileStorage } from './file-storage'
import { type MalwareScanner, ScannerUnavailableError } from './malware-scanner'

/** API-local messages of the malware scan refusal (not part of the contract). */
export const SCAN_MESSAGES = {
  infected: 'The file failed the security scan.',
  unavailable: 'The file could not be checked right now. Please try again later.',
} as const

const logger = new Logger('MalwareScan')

/** Decorates the real storage: `put` scans first and writes only a clean file; fails closed. */
export class ScanningFileStorage implements FileStorage {
  constructor(
    private readonly inner: FileStorage,
    private readonly scanner: MalwareScanner,
  ) {}

  async put(key: string, bytes: Buffer): Promise<void> {
    let verdict
    try {
      verdict = await this.scanner.scan(bytes)
    } catch (err) {
      logger.error(`Malware scan unavailable: ${err instanceof ScannerUnavailableError ? err.reason : 'unexpected failure'}`)
      throw ApiError.of('VALIDATION_ERROR', { fields: { file: SCAN_MESSAGES.unavailable } })
    }
    if (verdict.verdict === 'infected') {
      const sha256 = createHash('sha256').update(bytes).digest('hex')
      logger.warn(`Upload refused as infected: signature=${verdict.signature} bytes=${bytes.length} sha256=${sha256}`)
      throw ApiError.of('VALIDATION_ERROR', { fields: { file: SCAN_MESSAGES.infected } })
    }
    await this.inner.put(key, bytes)
  }

  get(key: string): Promise<Buffer | null> {
    return this.inner.get(key)
  }

  delete(key: string): Promise<void> {
    return this.inner.delete(key)
  }

  exists(key: string): Promise<boolean> {
    return this.inner.exists(key)
  }
}
