/**
 * U-OP-02 env check for S4-T08 (FR-QA-43, AC-QA-43 precondition): the environment the intake worker needs on UAT. READ-ONLY, no DB,
 * no `--apply`. It reads `process.env` of the shell that runs it, so run it with the API's environment loaded (the UAT developer does).
 *
 *   npx tsx apps/api/scripts/uat-ops/u-op-02-intake-env-check.ts
 *
 * Checks (one PASS/FAIL line each):
 *  - `JOBS_WORKER_ENABLED=true` (the in-process job worker runs);
 *  - `OCR_ENGINE=tesseract` (read as `OcrConfig` does, so anything else counts as `none`);
 *  - `OCR_LANG_DIR` set, an absolute folder, with `msa.traineddata` and `eng.traineddata` readable (same file names as `ocr-engine.ts`);
 *  - no external AI provider (D112(2)): `AI_PROVIDER` is not `mock` and not an external id, and `AI_API_KEY` is empty. An unset
 *    `AI_PROVIDER` is INFO only (the code defaults to the mock, which calls nobody).
 * It cannot prove AC-QA-43 itself (a scanned PDF extracting on UAT): that is a human [UAT] run after S0-T03 + S1-T03.
 *
 * Report: `.evidence/uat-ops/u-op-02-intake-env-check-<ISO time>.txt`. It holds variable names and the values of the non-secret ones
 * (engine id, folder path); never `AI_API_KEY` or any other secret. Exit code 0 ok, 1 a check FAILed, 2 usage error.
 */
import { accessSync, constants, statSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

import { exitCodeOf, formatLine, isMain, line, parseUatArgs, writeReport, type CheckLine, type UatArgsSpec } from './lib'

export const SPEC: UatArgsSpec = { name: 'u-op-02-intake-env-check', allowApply: false }

/** The two language files the in-house OCR needs (`ocr-engine.ts`). */
export const OCR_LANGS = ['msa', 'eng'] as const

/** File system seam: tests pass a fake. Returns `null` when the path is readable, else a short reason. */
export interface FsProbe {
  isDirectory(path: string): boolean
  readable(path: string): boolean
}

export const realFs: FsProbe = {
  isDirectory(path) {
    try {
      return statSync(path).isDirectory()
    } catch {
      return false
    }
  },
  readable(path) {
    try {
      accessSync(path, constants.R_OK)
      return true
    } catch {
      return false
    }
  },
}

/**
 * The engine as `OcrConfig` reads it (`ocr.config.ts`: trimmed, case-insensitive `tesseract`, anything else is `none`). Mirrored here, not
 * imported, because `OcrConfig` carries Nest parameter decorators that `tsx` only compiles from `apps/api/`; the spec pins the two together.
 */
export function engineOf(env: NodeJS.ProcessEnv): 'none' | 'tesseract' {
  return (env.OCR_ENGINE ?? '').trim().toLowerCase() === 'tesseract' ? 'tesseract' : 'none'
}

/** All env checks (pure given `env` and `fs`). */
export function checkIntakeEnv(env: NodeJS.ProcessEnv, fs: FsProbe = realFs): CheckLine[] {
  const out: CheckLine[] = []
  const jobs = (env.JOBS_WORKER_ENABLED ?? '').trim()
  out.push(
    jobs === 'true'
      ? line('PASS', 'JOBS_WORKER_ENABLED=true')
      : line('FAIL', `JOBS_WORKER_ENABLED is ${jobs === '' ? 'not set' : `"${jobs}"`}, expected "true" (S0-T03)`),
  )

  const rawEngine = (env.OCR_ENGINE ?? '').trim()
  out.push(
    engineOf(env) === 'tesseract'
      ? line('PASS', 'OCR_ENGINE=tesseract')
      : line('FAIL', `OCR_ENGINE is ${rawEngine === '' ? 'not set' : `"${rawEngine}"`}, expected "tesseract" (the mock/none engine is for CI only)`),
  )

  const dir = (env.OCR_LANG_DIR ?? '').trim()
  if (dir === '') {
    out.push(line('FAIL', 'OCR_LANG_DIR is not set'))
    for (const lang of OCR_LANGS) out.push(line('SKIP', `${lang}.traineddata (no OCR_LANG_DIR)`))
  } else if (!isAbsolute(dir)) {
    out.push(line('FAIL', `OCR_LANG_DIR is not an absolute path: ${dir}`))
    for (const lang of OCR_LANGS) out.push(line('SKIP', `${lang}.traineddata (OCR_LANG_DIR is not absolute)`))
  } else if (!fs.isDirectory(dir)) {
    out.push(line('FAIL', `OCR_LANG_DIR is not a folder on this host: ${dir}`))
    for (const lang of OCR_LANGS) out.push(line('SKIP', `${lang}.traineddata (OCR_LANG_DIR is not a folder)`))
  } else {
    out.push(line('PASS', `OCR_LANG_DIR=${dir}`))
    for (const lang of OCR_LANGS) {
      out.push(
        fs.readable(join(dir, `${lang}.traineddata`))
          ? line('PASS', `${lang}.traineddata readable`)
          : line('FAIL', `${lang}.traineddata is missing or unreadable in OCR_LANG_DIR`),
      )
    }
  }

  const provider = (env.AI_PROVIDER ?? '').trim().toLowerCase()
  if (provider === '') out.push(line('INFO', 'AI_PROVIDER not set (the code defaults to the mock; no external provider is called)'))
  else if (provider === 'mock') out.push(line('FAIL', 'AI_PROVIDER=mock: the mock is never used on UAT (FR-ADM-Q07.5); unset it'))
  else out.push(line('FAIL', `AI_PROVIDER="${provider}": no external AI provider on UAT (D112(2))`))
  out.push(
    (env.AI_API_KEY ?? '').trim() === ''
      ? line('PASS', 'AI_API_KEY is empty (no external AI provider)')
      : line('FAIL', 'AI_API_KEY is set (value not shown): no external AI provider on UAT (D112(2))'),
  )
  out.push(line('INFO', 'AC-QA-43 (a scanned PDF extracts with no AI provider) is a [UAT] run after S0-T03 + S1-T03; this script covers the env precondition only'))
  return out
}

function main(): number {
  const started = new Date()
  try {
    parseUatArgs(process.argv.slice(2), SPEC)
    const lines = checkIntakeEnv(process.env)
    for (const l of lines) console.log(formatLine(l))
    console.log(`INFO report written: ${writeReport('u-op-02-intake-env-check', lines, { now: started })}`)
    return exitCodeOf(lines)
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 2
  }
}

if (isMain(import.meta.url)) process.exit(main())
