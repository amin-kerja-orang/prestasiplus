/**
 * The two read paths of the dump pipeline (AM-10): `runCheck` (schema preflight, no data rows) and `dumpCloud`
 * (the one-session consistent-snapshot export into a new `pp-staging-dump/1` directory).
 *
 * Order of `dumpCloud`: schema read (metadata only) -> grant check (refuse = nothing read) -> plan -> ONE client session
 * -> splitter -> manifest + schema report -> rename `<out>.partial` to `<out>`. On any error or interrupt the partial
 * directory is deleted.
 */
import { createHash } from 'node:crypto'
import { existsSync, renameSync, rmdirSync, rmSync, realpathSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

import { TABLES, type TableSpec } from '../ddl/spec'
import { assertOutputUsable, PARTIAL_SUFFIX } from '../anonymise/run'
import { prepareOutputDir } from '../profile'
import { silentLogger, type Logger } from '../staging/log'
import { DUMP_FORMAT } from '../staging/readers'
import { collectClient, runClient, type ClientConfig } from './client'
import { DumpUsageError, ReadOnlyRequiredError } from './errors'
import { assertDatetimeOffset, buildCountSql, buildDumpSql, buildMetaSql, buildPlan, parseCounts, parseMeta, type SchemaInfo, type TablePlan } from './export-sql'
import { describeVerdict, evaluateGrants, type GrantVerdict } from './grants'
import { buildReport, writeReport, type SchemaReport } from './report'
import { splitExport, type SplitTable } from './split'
import { registerSensitive } from './cleanup'
import { wipeDir } from './wipe'

export const DEFAULT_DATETIME_OFFSET = '+08:00'

export interface CommonOptions {
  client: ClientConfig
  log?: Logger
  /** Tests use a synthetic spec. Default: the staging DDL spec. */
  specs?: readonly TableSpec[]
  /** Restrict to these spec table names. */
  tables?: readonly string[]
  datetimeOffset?: string
  now?: () => Date
}

function realEvenIfMissing(path: string): string {
  const wanted = resolve(path)
  let probe = wanted
  while (!existsSync(probe) && dirname(probe) !== probe) probe = dirname(probe)
  let base: string
  try {
    base = realpathSync.native(probe)
  } catch {
    base = probe
  }
  return join(base, relative(probe, wanted))
}

/** Reads the schema and judges the grants. Metadata only. Throws when the option file names no database. */
export async function readSchema(client: ClientConfig): Promise<{ schema: SchemaInfo; verdict: GrantVerdict }> {
  const schema = parseMeta(await collectClient(client, buildMetaSql()))
  if (!schema.hasDatabase) {
    throw new DumpUsageError('The connection has no default database (DATABASE() is NULL). Add database=<name> under [client] in the option file.')
  }
  return { schema, verdict: evaluateGrants(schema.grantLines) }
}

export function refusalMessage(verdict: GrantVerdict): string {
  return `Refusing: the MySQL account is not read-only (${describeVerdict(verdict)}). Nothing was read. Ask for a SELECT-only account.`
}

/**
 * The output location, checked BEFORE any connection: inside `.migration-out` (and the working directory or repository),
 * new or empty, no stale `.partial`. Creates nothing that stays.
 */
export function checkOutputLocation(outDir: string): void {
  assertOutputUsable(outDir)
  rmSync(prepareOutputDir(`${resolve(outDir)}${PARTIAL_SUFFIX}`), { recursive: true, force: true })
}

function validateTables(tables: readonly string[] | undefined, specs: readonly TableSpec[]): void {
  if (!tables) return
  const known = new Set(specs.map((s) => s.name))
  for (const t of tables) if (!known.has(t)) throw new DumpUsageError('--tables names a table that ddl/spec.ts does not define.')
}

export interface CheckResult {
  report: SchemaReport
  verdict: GrantVerdict
  outDir: string
}

export async function runCheck(options: CommonOptions & { outDir: string }): Promise<CheckResult> {
  const log = options.log ?? silentLogger
  const specs = options.specs ?? TABLES
  const now = options.now ?? (() => new Date())
  validateTables(options.tables, specs)
  checkOutputLocation(options.outDir)
  const { schema, verdict } = await readSchema(options.client)
  log.info(`Server: ${schema.flavor} ${schema.version}. Grants: ${verdict.readOnly ? 'read-only' : 'NOT read-only'}.`)
  const plans = buildPlan(schema, specs, { datetimeOffset: options.datetimeOffset ?? DEFAULT_DATETIME_OFFSET, only: options.tables })
  // Row counts are aggregates, but they are still a read: only for an account that passed the grant check.
  const counts = verdict.readOnly ? parseCounts(await collectClient(options.client, buildCountSql(plans))) : undefined
  const report = buildReport({ now: now(), schema, verdict, plans, specTableNames: plans.map((p) => p.name), counts })
  const dir = prepareOutputDir(options.outDir)
  try {
    await writeReport(dir, report)
  } catch (e) {
    rmSync(dir, { recursive: true, force: true })
    throw e
  }
  return { report, verdict, outDir: dir }
}

export interface DumpResult {
  outDir: string
  tables: SplitTable[]
  totalRows: number
  manifestSha256: string
  report: SchemaReport
  /** table -> column -> count of integers of 2^53 or more in the raw file. */
  largeIntegers: Record<string, Record<string, number>>
}

export async function dumpCloud(options: CommonOptions & { outDir: string }): Promise<DumpResult> {
  const log = options.log ?? silentLogger
  const specs = options.specs ?? TABLES
  const now = options.now ?? (() => new Date())
  const offset = assertDatetimeOffset(options.datetimeOffset ?? DEFAULT_DATETIME_OFFSET)
  validateTables(options.tables, specs)
  // Nothing is read, and no connection is opened, before the output location is accepted.
  checkOutputLocation(options.outDir)

  const { schema, verdict } = await readSchema(options.client)
  if (!verdict.readOnly) throw new ReadOnlyRequiredError(refusalMessage(verdict))
  log.info(`Server: ${schema.flavor} ${schema.version}. Grants: read-only. Time zone (session/global/system): ${schema.timeZone.session}/${schema.timeZone.global}/${schema.timeZone.system}.`)

  const plans: TablePlan[] = buildPlan(schema, specs, { datetimeOffset: offset, only: options.tables })
  const present = plans.filter((p) => p.present)
  const gone = plans.filter((p) => !p.present)
  if (gone.length > 0) {
    const names = (reason: string) => gone.filter((p) => (p.absentReason ?? 'absent') === reason).map((p) => p.name)
    const parts = [['absent or not granted', names('absent')], ['views', names('view')]].filter(([, n]) => (n as string[]).length > 0).map(([label, n]) => `${(n as string[]).length} ${label} (${(n as string[]).join(', ')})`)
    log.warn(`Spec tables not exported: ${parts.join('; ')}.`)
  }
  for (const p of present) {
    if (p.missingInSource.length > 0) log.warn(`Table ${p.name}: ${p.missingInSource.length} spec column(s) are missing or not granted: ${p.missingInSource.join(', ')}.`)
  }
  if (present.length === 0) throw new DumpUsageError('None of the requested spec tables exists in the source database.')

  const finalDir = realEvenIfMissing(options.outDir)
  const partial = prepareOutputDir(`${finalDir}${PARTIAL_SUFFIX}`)
  const unregister = registerSensitive(partial)
  try {
    const split = await splitExport(runClient(options.client, buildDumpSql(plans)), plans, partial)
    const counts = new Map(split.tables.map((t) => [t.table, t.rows]))
    const report = buildReport({
      now: now(),
      schema,
      verdict,
      plans,
      specTableNames: plans.map((p) => p.name),
      counts,
      invalidJson: split.invalidJson,
      largeIntegers: split.largeIntegers,
      datetimeOffset: offset,
    })
    const manifest: Record<string, { rows: number; file?: string }> = {}
    for (const t of split.tables) manifest[t.table] = t.rows > 0 ? { rows: t.rows, file: t.file } : { rows: 0 }
    const manifestText = `${JSON.stringify({ format: DUMP_FORMAT, source: 'cloud', raw: true, exported_at: now().toISOString(), datetime_offset: offset, ...(Object.keys(split.largeIntegers).length > 0 ? { large_integers: split.largeIntegers } : {}), tables: manifest }, null, 2)}\n`
    await writeFile(join(partial, 'manifest.json'), manifestText, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    await writeReport(partial, report)
    // Not atomic when the target exists as an empty directory; a failure deletes the partial output (see anonymise/run.ts).
    if (existsSync(finalDir)) rmdirSync(finalDir)
    renameSync(partial, finalDir)
    const totalRows = split.tables.reduce((sum, t) => sum + t.rows, 0)
    for (const t of split.tables) log.info(`Exported ${t.table}: ${t.rows} rows.`)
    for (const [table, columns] of Object.entries(split.largeIntegers)) {
      log.warn(`Table ${table}: integer value(s) of 2^53 or more in ${Object.keys(columns).join(', ')}. They are exact in the raw file, but a reader that uses JSON.parse rounds them; dump:produce refuses such a dump.`)
    }
    log.info(`Done: ${split.tables.length} tables, ${totalRows} rows. This directory is RAW personal data: run dump:wipe on it the same day.`)
    return { outDir: finalDir, tables: split.tables, totalRows, manifestSha256: createHash('sha256').update(manifestText).digest('hex'), report, largeIntegers: split.largeIntegers }
  } catch (e) {
    // Raw personal data may be in there: zero it, then make sure nothing is left whatever the wipe did.
    await wipeDir(partial, { missingOk: true }).catch(() => undefined)
    rmSync(partial, { recursive: true, force: true })
    throw e
  } finally {
    unregister()
  }
}
