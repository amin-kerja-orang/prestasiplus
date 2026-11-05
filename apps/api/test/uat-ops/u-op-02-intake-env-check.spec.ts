import { ConfigService } from '@nestjs/config'
import { describe, expect, it } from 'vitest'

import { OcrConfig } from '../../src/modules/ocr/ocr.config'
import { parseUatArgs } from '../../scripts/uat-ops/lib'
import { checkIntakeEnv, engineOf, SPEC, type FsProbe } from '../../scripts/uat-ops/u-op-02-intake-env-check'

/** S4-T08 U-OP-02: the intake env check (pure, with a fake file system; no DB). */
const fsWith = (dirs: string[], files: string[]): FsProbe => ({ isDirectory: (p) => dirs.includes(p), readable: (p) => files.includes(p) })
const good = { JOBS_WORKER_ENABLED: 'true', OCR_ENGINE: 'tesseract', OCR_LANG_DIR: '/opt/tessdata' }
const goodFs = fsWith(['/opt/tessdata'], ['/opt/tessdata/msa.traineddata', '/opt/tessdata/eng.traineddata'])
const statuses = (env: NodeJS.ProcessEnv, fs: FsProbe = goodFs): string[] => checkIntakeEnv(env, fs).map((l) => l.status)

describe('checkIntakeEnv', () => {
  it('passes a complete UAT environment (INFO only for the unset AI provider and the manual AC)', () => {
    const lines = checkIntakeEnv(good, goodFs)
    expect(lines.filter((l) => l.status === 'FAIL')).toEqual([])
    expect(lines.filter((l) => l.status === 'PASS').map((l) => l.text)).toEqual([
      'JOBS_WORKER_ENABLED=true',
      'OCR_ENGINE=tesseract',
      'OCR_LANG_DIR=/opt/tessdata',
      'msa.traineddata readable',
      'eng.traineddata readable',
      'AI_API_KEY is empty (no external AI provider)',
    ])
  })

  it('fails when the worker is off or unset', () => {
    expect(checkIntakeEnv({ ...good, JOBS_WORKER_ENABLED: 'false' }, goodFs)[0]).toMatchObject({ status: 'FAIL', text: expect.stringContaining('"false"') })
    expect(checkIntakeEnv({ ...good, JOBS_WORKER_ENABLED: undefined }, goodFs)[0]).toMatchObject({ status: 'FAIL', text: expect.stringContaining('not set') })
  })

  it('fails when the engine is none, unset or unknown', () => {
    for (const engine of [undefined, 'none', 'mock']) expect(checkIntakeEnv({ ...good, OCR_ENGINE: engine }, goodFs)[1]?.status).toBe('FAIL')
  })

  it('fails on a missing, relative or absent language folder and skips the file lines', () => {
    expect(statuses({ ...good, OCR_LANG_DIR: undefined }).slice(2, 5)).toEqual(['FAIL', 'SKIP', 'SKIP'])
    expect(statuses({ ...good, OCR_LANG_DIR: 'tessdata' }).slice(2, 5)).toEqual(['FAIL', 'SKIP', 'SKIP'])
    expect(statuses(good, fsWith([], [])).slice(2, 5)).toEqual(['FAIL', 'SKIP', 'SKIP'])
  })

  it('fails per language file that is unreadable', () => {
    const noEng = fsWith(['/opt/tessdata'], ['/opt/tessdata/msa.traineddata'])
    expect(statuses(good, noEng).slice(2, 5)).toEqual(['PASS', 'PASS', 'FAIL'])
    expect(checkIntakeEnv(good, noEng)[4]?.text).toContain('eng.traineddata')
  })

  it('fails on the mock or an external AI provider and never prints the key', () => {
    expect(checkIntakeEnv({ ...good, AI_PROVIDER: 'mock' }, goodFs).some((l) => l.status === 'FAIL' && l.text.includes('AI_PROVIDER=mock'))).toBe(true)
    expect(checkIntakeEnv({ ...good, AI_PROVIDER: 'openai' }, goodFs).some((l) => l.status === 'FAIL' && l.text.includes('external'))).toBe(true)
    const withKey = checkIntakeEnv({ ...good, AI_API_KEY: 'rahsia-123' }, goodFs)
    expect(withKey.some((l) => l.status === 'FAIL' && l.text.includes('AI_API_KEY'))).toBe(true)
    expect(withKey.map((l) => l.text).join('\n')).not.toContain('rahsia-123')
  })
})

describe('engineOf', () => {
  it('reads the engine exactly as OcrConfig does', () => {
    for (const value of [undefined, '', ' ', 'none', 'tesseract', ' Tesseract ', 'TESSERACT', 'mock', 'other']) {
      const config = new OcrConfig(new ConfigService({ OCR_ENGINE: value }))
      expect(engineOf({ OCR_ENGINE: value })).toBe(config.engine)
    }
  })
})

describe('arguments', () => {
  it('is read-only: --apply and unknown arguments are usage errors', () => {
    expect(() => parseUatArgs(['--apply'], SPEC)).toThrow('u-op-02-intake-env-check is read-only: there is no --apply')
    expect(() => parseUatArgs(['--x'], SPEC)).toThrow('unknown argument --x')
    expect(parseUatArgs(['--dry-run'], SPEC).dryRun).toBe(true)
  })
})
