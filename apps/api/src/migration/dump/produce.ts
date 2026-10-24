/**
 * `dump:produce` (AM-10): .cloud MySQL -> raw dump -> anonymised dump, in one command, with the raw data deleted
 * before the command returns (success, failure or interrupt).
 *
 *   <work>/raw   dump:cloud output (raw personal data)         ALWAYS wiped in a `finally`
 *   <work>/anon  anonymiser output (leak-scanned by runAnonymise; this is what leaves the PC)
 *   <work>/schema-report.json|md  the schema report (names, types and counts only)
 *
 * The key and the anonymiser rules are checked by the caller BEFORE any connection is opened.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { AnonymiseAbortedError } from '../anonymise/errors'
import { runAnonymise as defaultRunAnonymise, type AnonymiseResult } from '../anonymise/run'
import { checkCoverage, type AnonConfig } from '../anonymise/rules'
import { TABLES } from '../ddl/spec'
import { prepareOutputDir } from '../profile'
import { silentLogger } from '../staging/log'
import { DirReader } from '../staging/readers'
import { dumpCloud, type CommonOptions } from './cloud'
import { registerSensitive } from './cleanup'
import { DumpAbortedError, DumpError, DumpUsageError } from './errors'
import { writeReport } from './report'
import { wipeDir } from './wipe'

export interface ProduceOptions extends CommonOptions {
  workDir: string
  key: Uint8Array
  config: AnonConfig
  /** Tests inject a stub to prove the raw wipe on coverage and leak failures. */
  runAnonymise?: typeof defaultRunAnonymise
  /** Tests inject a failing wipe to prove the `rmSync` fallback. */
  wipe?: typeof wipeDir
  clock?: () => number
}

export interface ProduceResult {
  workDir: string
  anonDir: string
  tables: { table: string; rows: number; bytes: number }[]
  totalRows: number
  manifestSha256: string
  elapsedMs: number
}

export function assertWorkUsable(workDir: string): void {
  if (existsSync(workDir)) {
    if (!statSync(workDir).isDirectory()) throw new DumpUsageError('The work path exists and is not a directory. Use a new path.')
    if (readdirSync(workDir).length > 0) throw new DumpUsageError('The work directory is not empty. Use a new directory (an old dump is never overwritten or mixed).')
  }
}

export async function produceDump(options: ProduceOptions): Promise<ProduceResult> {
  const log = options.log ?? silentLogger
  const clock = options.clock ?? Date.now
  const started = clock()
  const specs = options.specs ?? TABLES
  const anonymise = options.runAnonymise ?? defaultRunAnonymise

  checkCoverage(specs, options.config)
  assertWorkUsable(options.workDir)
  const work = prepareOutputDir(options.workDir)
  const raw = join(work, 'raw')
  const anon = join(work, 'anon')

  const signal = options.client.signal
  const stopIfAborted = (): void => {
    if (signal?.aborted) throw new DumpAbortedError('Interrupted.')
  }
  const wipe = options.wipe ?? wipeDir
  const unregister = [registerSensitive(raw), registerSensitive(`${raw}.partial`), registerSensitive(`${anon}.partial`)]

  let failure: unknown
  let result: AnonymiseResult | undefined
  try {
    const dump = await dumpCloud({ ...options, outDir: raw })
    await writeReport(work, dump.report)
    stopIfAborted()
    const reader = new DirReader(raw)
    try {
      result = await anonymise({ reader, outDir: anon, config: options.config, key: options.key, sourceDir: raw, tables: specs, log, signal })
    } finally {
      await reader.close().catch(() => undefined)
    }
    // An interrupt is never a success: the anonymised output is removed too and the exit code is 1.
    stopIfAborted()
  } catch (e) {
    failure = e instanceof AnonymiseAbortedError ? new DumpAbortedError('Interrupted.') : e
    if (failure instanceof DumpAbortedError) rmSync(anon, { recursive: true, force: true })
  }

  // ALWAYS: the raw data goes, whatever happened above. A failed zero-overwrite falls back to a plain removal.
  let wipeError: unknown
  let removedWithoutOverwrite = false
  try {
    const a = await wipe(raw, { missingOk: true })
    const b = await wipe(`${raw}.partial`, { missingOk: true })
    const linked = a.hardLinked + b.hardLinked
    log.info(`Raw dump deleted: ${a.files + b.files} file(s) overwritten with zeros and removed, ${linked} file(s) unlinked only (hard-linked).`)
  } catch (e) {
    wipeError = e
    for (const path of [raw, `${raw}.partial`]) {
      try {
        rmSync(path, { recursive: true, force: true })
      } catch {
        // reported below through existsSync
      }
    }
    removedWithoutOverwrite = !existsSync(raw) && !existsSync(`${raw}.partial`)
    log.warn(
      removedWithoutOverwrite
        ? `The raw dump could not be overwritten with zeros (${e instanceof Error ? e.name : 'error'}); it was removed without overwriting. Full-disk encryption is the guard.`
        : `The raw dump could NOT be deleted automatically (${e instanceof Error ? e.name : 'error'}). Run dump:wipe --dir <work>/raw yourself, now.`,
    )
  } finally {
    for (const u of unregister) u()
  }
  if (failure) throw failure
  if (wipeError) {
    throw new DumpError(
      removedWithoutOverwrite
        ? 'The anonymised dump is ready but the raw dump could only be removed, not overwritten (see the warning above).'
        : 'The anonymised dump is ready but the raw dump could not be deleted. Delete <work>/raw with dump:wipe before anything else.',
    )
  }
  if (!result) throw new DumpError('The anonymiser produced no result.')

  const manifestPath = join(anon, 'manifest.json')
  const tables = result.tables.map((t) => {
    const file = join(anon, `${t.table}.ndjson`)
    return { table: t.table, rows: t.rows, bytes: existsSync(file) ? statSync(file).size : 0 }
  })
  return {
    workDir: work,
    anonDir: anon,
    tables,
    totalRows: result.totalRows,
    manifestSha256: createHash('sha256').update(readFileSync(manifestPath)).digest('hex'),
    elapsedMs: clock() - started,
  }
}
