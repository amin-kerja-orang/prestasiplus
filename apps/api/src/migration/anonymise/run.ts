/**
 * The anonymiser core (BE-35): reads a `TableReader` (a dump directory or the read-only cloud source),
 * applies the column rules and writes a `pp-staging-dump/1` directory that `staging:load` accepts.
 *
 * Guarantees:
 *   - default deny: no row is read before every DDL column has a rule (rules.ts);
 *   - the source is only ever read; the output is a new, empty directory that is not inside the source
 *     and that the caller has already checked with `prepareOutputDir` (under `.migration-out`);
 *   - files are created with mode 0600 and never overwritten (`wx`);
 *   - the leak scan (leak-scan.ts) runs on the finished output; on a hit, or on any error, everything
 *     written is deleted again;
 *   - the log carries table names and counts only;
 *   - `redact-pii` columns (free-text content, A1-LEAK) are masked with the COMPLETE originals index: before the main pass an
 *     index pass reads every table that has a rule that replaces values (users, schools, sponsors, ...), in whatever order the
 *     tables come, so a content table never sees a half-filled index. The index pass is skipped when no column uses redact-pii.
 */
import { existsSync, readdirSync, realpathSync, renameSync, rmdirSync, rmSync, statSync } from 'node:fs'
import { open, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

import { columnNames, TABLES, type TableSpec } from '../ddl/spec'
import { DUMP_FORMAT, type TableReader } from '../staging/readers'
import { silentLogger, type Logger } from '../staging/log'
import { prepareOutputDir } from '../profile'
import { AnonymiseAbortedError, InputError, LeakScanError, OutputError, type LeakHit } from './errors'
import { LeakScanner, OriginalsIndex, scanDumpDirectory, type ScanResult } from './leak-scan'
import { Pseudonymiser, type PseudonymKind } from './pseudonyms'
import { PiiRedactor, type RedactKind } from './redact'
import { applyRule, checkCoverage, ruleFor, type AnonConfig, type Rule } from './rules'

const OWN_COLUMNS = new Set(['_loaded_at', '_row_hash'])
const PLAIN = /^[a-z0-9_]{1,63}$/

export interface AnonymiseOptions {
  reader: TableReader
  /**
   * The FINAL output path: it does not exist yet (or is an empty directory). The run writes into
   * `<outDir>.partial` and renames it to `outDir` only after the leak scan passed; on any error the
   * partial directory is removed entirely.
   */
  outDir: string
  config: AnonConfig
  key: Uint8Array
  /** Tables to process (default: every table of the staging DDL). Tests use a synthetic DDL. */
  tables?: readonly TableSpec[]
  log?: Logger
  batchSize?: number
  /** Real path of the source directory, when the source is a dump directory. */
  sourceDir?: string
  /** Optional: when it aborts, the run stops between tables and between batches, deletes its partial output and throws `AnonymiseAbortedError`. */
  signal?: AbortSignal
  /** E-mail domains the leak scan accepts besides example.test (never needed for real runs). */
  extraAllowedEmailDomains?: readonly string[]
}

export interface AnonymiseResult {
  tables: { table: string; rows: number }[]
  totalRows: number
  scan: ScanResult
  pseudonyms: Record<PseudonymKind, number>
  /** `redact-pii`: how many spans were masked, per table.column and kind. Counts only, never a value. */
  redactions: RedactionCount[]
}

export interface RedactionCount {
  table: string
  column: string
  kind: RedactKind
  count: number
}

const real = (p: string): string => {
  try {
    return realpathSync.native(p)
  } catch {
    return resolve(p)
  }
}
const overlaps = (a: string, b: string): boolean => {
  const rel = relative(a, b)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** Real path of a path that may not exist yet: the nearest existing ancestor is resolved, the rest is appended. */
function realEvenIfMissing(path: string): string {
  const wanted = resolve(path)
  let probe = wanted
  while (!existsSync(probe) && dirname(probe) !== probe) probe = dirname(probe)
  return join(real(probe), relative(probe, wanted))
}

/** Call BEFORE creating the output directory: it must not contain, equal or sit inside the source. */
export function assertNotOverlapping(outDir: string, sourceDir: string | undefined): void {
  if (sourceDir === undefined) return
  const out = realEvenIfMissing(outDir)
  const src = realEvenIfMissing(sourceDir)
  if (overlaps(src, out) || overlaps(out, src)) {
    throw new OutputError('The output directory and the source overlap. The anonymiser never writes into the source.')
  }
}

export const PARTIAL_SUFFIX = '.partial'

/**
 * The output must not exist (or be an empty directory), no stale `.partial` may exist, and neither may
 * overlap the source. Creates nothing.
 */
export function assertOutputUsable(outDir: string, sourceDir?: string): void {
  assertNotOverlapping(outDir, sourceDir)
  assertNotOverlapping(`${outDir}${PARTIAL_SUFFIX}`, sourceDir)
  if (existsSync(outDir) && !statSync(outDir).isDirectory()) {
    throw new OutputError('The output path exists and is not a directory (a file is in the way). Use a new path.')
  }
  if (existsSync(outDir) && readdirSync(real(outDir)).length > 0) {
    throw new OutputError('The output directory is not empty. Use a new directory (an old dump is never overwritten or mixed).')
  }
  if (existsSync(`${outDir}${PARTIAL_SUFFIX}`)) {
    throw new OutputError('A leftover ".partial" directory from an earlier run exists next to the output. Check it, delete it, and run again.')
  }
}

function describe(names: string[]): string {
  const ok = names.filter((n) => PLAIN.test(n)).sort()
  const other = names.length - ok.length
  return [ok.join(', '), other > 0 ? `${other} with unprintable names` : ''].filter(Boolean).join('; ')
}

export async function runAnonymise(options: AnonymiseOptions): Promise<AnonymiseResult> {
  const log = options.log ?? silentLogger
  const tables = options.tables ?? TABLES
  const batchSize = options.batchSize ?? 2000

  // Default deny, before the source or the output is touched.
  checkCoverage(tables, options.config)
  assertOutputUsable(options.outDir, options.sourceDir)
  const finalDir = realEvenIfMissing(options.outDir)
  const outDir = prepareOutputDir(`${finalDir}${PARTIAL_SUFFIX}`) // same .migration-out guard; created empty, mode 0700

  const pseudo = new Pseudonymiser(options.key)
  const index = new OriginalsIndex()
  const patterns = { allowedEmailDomains: ['example.test', ...(options.extraAllowedEmailDomains ?? [])] }
  // The same index and the same allowed domains as the leak scan below, so a masked output cannot be flagged by it.
  const redactor = new PiiRedactor(index, patterns)
  const redactions = new Map<string, RedactionCount>()
  const manifestTables: Record<string, { rows: number; file?: string }> = {}
  const results: { table: string; rows: number }[] = []

  const stop = (): void => {
    if (options.signal?.aborted) throw new AnonymiseAbortedError('The anonymiser was interrupted. The partial output was deleted.')
  }
  const cleanup = (): void => rmSync(outDir, { recursive: true, force: true })
  const dummyRoles = new Set(options.config.dummyPasswordRoles.map((r) => r.toLowerCase()))
  const lockedFor = (rule: Rule, row: Record<string, unknown>): boolean =>
    rule.rule === 'hash-password-dummy' && !(typeof row.role === 'string' && dummyRoles.has(row.role.trim().toLowerCase()))
  const rulesOf = (spec: TableSpec): Map<string, Rule> => {
    const rules = new Map<string, Rule>()
    for (const c of columnNames(spec)) rules.set(c, ruleFor(options.config, spec.name, c) as Rule)
    return rules
  }

  try {
    // Index pass (only when some column uses redact-pii). The originals index is filled while rules replace values, row by
    // row, so without this pass a content table could be masked before the user table (or any later table with a replaced
    // name, phone, IC, ...) was indexed, and the leak scan at the end, which sees the complete index, would then fail the
    // run. Here every table with a value-replacing rule is read once, only its replaced columns are looked at, and nothing
    // is written. The pseudonymiser is not used (its fakes and its collision order stay those of the main pass).
    if (tables.some((spec) => [...rulesOf(spec).values()].some((r) => r.rule === 'redact-pii'))) {
      let indexed = 0
      for (const spec of tables) {
        stop()
        const replacing = [...rulesOf(spec)].filter(([, r]) => !['keep', 'redact-pii', 'slug-from-id', 'null-content'].includes(r.rule))
        if (replacing.length === 0 || !(await options.reader.has(spec.name))) continue
        const rules = new Map(replacing)
        for await (const batch of options.reader.read(spec.name, batchSize)) {
          for (const row of batch) {
            for (const [column, value] of Object.entries(row)) {
              const rule = rules.get(column)
              if (!rule) continue
              index.record(rule, value, rule.rule === 'pseudonym' ? undefined : applyRule(rule, value, pseudo, lockedFor(rule, row), { row }))
            }
          }
          stop()
        }
        indexed++
      }
      log.info(`Index pass: originals of ${indexed} table(s) indexed for redact-pii (nothing written).`)
    }

    for (const spec of tables) {
      stop()
      if (!(await options.reader.has(spec.name))) {
        log.warn(`Table ${spec.name} is absent from the input; nothing written for it.`)
        continue
      }
      const rules = rulesOf(spec)

      const file = `${spec.name}.ndjson`
      const path = join(outDir, file)
      let handle: Awaited<ReturnType<typeof open>> | undefined
      let rows = 0
      try {
        for await (const batch of options.reader.read(spec.name, batchSize)) {
          const lines: string[] = []
          for (const row of batch) {
            const out: Record<string, unknown> = {}
            for (const [column, value] of Object.entries(row)) {
              if (OWN_COLUMNS.has(column)) continue
              const rule = rules.get(column)
              if (!rule) {
                throw new InputError(
                  `Table ${spec.name}: the input has a column that the staging DDL does not define (${describe([column])}). Default deny: it is not copied. Add it to ddl/spec.ts and give it a rule.`,
                )
              }
              const result = applyRule(rule, value, pseudo, lockedFor(rule, row), {
                redactor,
                row,
                onRedact: (kind) => {
                  const key = `${spec.name}\0${column}\0${kind}`
                  const seen = redactions.get(key)
                  if (seen) seen.count++
                  else redactions.set(key, { table: spec.name, column, kind, count: 1 })
                },
              })
              index.record(rule, value, result)
              out[column] = result
            }
            lines.push(JSON.stringify(out))
          }
          if (lines.length === 0) continue
          if (!handle) {
            handle = await open(path, 'wx', 0o600)
          }
          await handle.write(`${lines.join('\n')}\n`)
          rows += lines.length
          stop()
        }
      } finally {
        await handle?.close()
      }
      const expected = options.reader.expectedRows(spec.name)
      if (expected !== null && expected !== rows) {
        throw new InputError(`Table ${spec.name}: the input manifest promises ${expected} rows but ${rows} were read.`)
      }
      manifestTables[spec.name] = rows > 0 ? { rows, file } : { rows: 0 }
      results.push({ table: spec.name, rows })
      log.info(`Anonymised ${spec.name}: ${rows} rows.`)
    }

    const manifestPath = join(outDir, 'manifest.json')
    await writeFile(manifestPath, `${JSON.stringify({ format: DUMP_FORMAT, source: 'cloud', anonymised: true, tables: manifestTables }, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    })

    const scanner = new LeakScanner(index, patterns)
    const scan = await scanDumpDirectory(outDir, scanner, tables, batchSize)
    const allow = new Set(options.config.leakScan.allow)
    const isOriginal = (h: LeakHit) => h.kind === 'original-value' || h.kind === 'original-name'
    const tolerated = scan.hits.filter((h) => isOriginal(h) && allow.has(`${h.table}.${h.column}`))
    const hits = scan.hits.filter((h) => !tolerated.includes(h))
    for (const h of tolerated) log.warn(`Leak scan: ${h.count} ${h.kind} hit(s) in ${h.table}.${h.column} tolerated by leakScan.allow.`)
    if (hits.length > 0) {
      for (const h of hits) log.warn(`Leak scan hit: ${h.table}.${h.column} (${h.kind}) x${h.count}.`)
      throw new LeakScanError(hits, true)
    }
    log.info(`Leak scan: clean (${scan.rowsScanned} rows, ${scan.cellsScanned} cells checked).`)

    const redactionList = [...redactions.values()].sort((a, b) => `${a.table}.${a.column}.${a.kind}`.localeCompare(`${b.table}.${b.column}.${b.kind}`))
    const perColumn = new Map<string, number>()
    for (const r of redactionList) perColumn.set(`${r.table}.${r.column}`, (perColumn.get(`${r.table}.${r.column}`) ?? 0) + r.count)
    for (const [where, n] of perColumn) {
      const kinds = redactionList.filter((r) => `${r.table}.${r.column}` === where).map((r) => `${r.kind} x${r.count}`)
      log.info(`Redacted ${n} span(s) in ${where} (${kinds.join(', ')}).`)
    }

    const totalRows = results.reduce((sum, t) => sum + t.rows, 0)
    // Not atomic: the empty directory is removed, then the partial one is renamed. If either step fails the
    // partial output is deleted by the handler below and the run must simply be repeated; nothing leaks.
    try {
      if (existsSync(finalDir)) rmdirSync(finalDir) // an empty directory the caller made
      renameSync(outDir, finalDir)
    } catch (e) {
      const code = (e as { code?: unknown })?.code
      throw new OutputError(
        `Could not move the finished output into place (${typeof code === 'string' ? code : 'error'}; the target may be in use, on another volume, or not a directory). The partial output was deleted; repeat the run.`,
      )
    }
    log.info(`Done: ${results.length} tables, ${totalRows} rows.`)
    return { tables: results, totalRows, scan, pseudonyms: pseudo.counts, redactions: redactionList }
  } catch (e) {
    cleanup()
    throw e
  }
}

