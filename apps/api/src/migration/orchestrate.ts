/**
 * BE-30 orchestrator: the six `migrate:*` commands that drive a whole cut-over rehearsal.
 *
 *   npm run migrate:all -w @pp/api -- [--dry-run | --apply] [--as-of YYYY-MM-DD] [--batch-size N]
 *       [--content-owner <v2 user id>] [--out-dir <.migration-out path>]
 *   npm run migrate:delta -w @pp/api -- --since <ISO-8601 timestamp> [--apply] [same flags as migrate:all]
 *   npm run migrate:verify -w @pp/api -- [--out-dir <.migration-out path>]
 *   npm run migrate:rollback -w @pp/api -- --confirm <database name> [--apply]
 *   npm run migrate:link-questions -w @pp/api -- [--apply] [--batch-size N]
 *   npm run migrate:export-question-reports -w @pp/api -- [--out-dir <.migration-out path>]
 *
 * `migrate:all`
 *   --dry-run (default)  core dry-run; then activity dry-run only when the activity preflight passes (a succeeded
 *                        `migrate:core --apply` on the same staged data and `--as-of` exists), else the activity stage
 *                        is recorded as skipped ("needs migrate:core --apply first"). No verify.
 *   --apply              for core, then activity: a dry-run and, only when it succeeded, the apply with IDENTICAL
 *                        options (same as-of, batch size, content owner; `coreAsOf = asOf` for activity) so the input
 *                        hashes match and the kit's "apply needs a passing dry-run" gate opens. The first failed stage
 *                        stops the run (exit 1). Then `runVerify` and `writeVerifyReport`; exit 1 unless verify passes.
 *
 * `migrate:delta` (freeze window, plan 14.5 item 4)
 *   DECISION: the delta is a re-run of core + activity on the freshly re-staged freeze dump. The BE-34 upsert skips
 *   unchanged rows (`legacy_hash`, or an equal-values check on tables without it; `kit/upsert.ts`), so only changed
 *   and new rows are written. The extract is deliberately NOT filtered by `updated_at`: several steps aggregate over
 *   many rows (streaks, wallets, JPN / PPD from distinct state / district pairs) and a filtered extract would corrupt
 *   them. `--since` is required and is used for the delta report only: per `staging_cloud` table that has an
 *   `updated_at` column, the rows with `updated_at > since`, and per entity the inserted / updated / unchanged counters
 *   of the run. Precondition: a succeeded core apply for the source exists (else exit 2). `--as-of` is REQUIRED and must be
 *   the first load's value (it is an input of the transform; another value would rewrite rows). Source deletes are not
 *   propagated (plan 14.5 item 4).
 *   A delta DRY-RUN skips the activity stage whenever a table that core reads (users, schools, classes, curriculum, ...)
 *   changed in staging: the activity preflight needs a core apply on the staged data now in the database, and the
 *   dry-run applies nothing. A change in an activity-only table (e.g. practice_sessions) does not skip it. The apply
 *   path has no such limit: core dry-run, core apply, then activity dry-run and apply.
 *
 * `migrate:verify` runs the reconciliation (exit 0 on pass, 1 on fail). `migrate:rollback` deletes the rows loaded from
 * the source (dry-run by default, `--confirm` must equal the database name; a refusal, `RollbackRefusedError`, exits 2). `migrate:link-questions` is the optional
 * MIG-09 backfill. `migrate:export-question-reports` (Q9 A) writes the open question reports to a CSV for the content team
 * (read-only; `--apply` is refused with exit 2; see `export/question-reports.ts`). The source is always `cloud`.
 *
 * Environment and guards are those of the kit: DATABASE_URL, `PP_ALLOW_MIGRATE_APPLY=1` for any `--apply`, and in
 * production `PP_MIGRATE_TARGET_DB` equal to the connected database. Exit codes: 0 ok, 1 failed / mismatch, 2 usage or
 * guard, 3 apply refused, 4 busy. Output is counts and surrogate ids only: never a row value. Each stage is printed as
 * soon as it finishes, so when a later stage throws (preflight, busy, apply refused) the operator still sees which
 * stages completed, e.g. that the core apply committed.
 */
import { existsSync, lstatSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type pg from 'pg'

import { EXIT, runCli } from './cli'
import { STAGING_SCHEMA } from './ddl/spec'
import {
  ApplyGuardError,
  registerMigrateCommand,
  sanitizeDbError,
  type CliContext,
  type CommandArgs,
  type MigrateCommand,
  type ReconRow,
  type RunCounters,
  type RunMode,
  type RunReport,
} from './kit'
import { quoteIdent } from './kit/sql'
import { runCore } from './load'
import { assertCorePreflight, PreflightError, runActivity } from './load/activity'
import { exportOpenQuestionReports } from './export/question-reports'
import { prepareOutputDir, ProfileOutputError } from './profile'
import { linkQuestions, LinkQuestionsBusyError } from './backfill/link-questions'
import { rollbackLegacy, runVerify, writeVerifyReport, type VerifyOptions, type VerifyReport } from './verify'

type Env = Readonly<Record<string, string | undefined>>

// ---------------------------------------------------------------- types

export type StageName = 'core' | 'activity' | 'verify'

export interface StageResult {
  name: StageName
  /** `verify` for the reconciliation stage. */
  mode: RunMode | 'verify'
  status: 'succeeded' | 'failed' | 'skipped'
  runId?: string
  recon?: ReconRow[]
  counters?: RunCounters
  skippedReason?: string
  /** Message of a failed verify stage (the run did not throw: it is part of the result). */
  error?: string
}

export interface DeltaEntity {
  stage: 'core' | 'activity'
  entity: string
  read: number
  inserted: number
  updated: number
  unchanged: number
}

export interface DeltaReport {
  source: 'cloud'
  mode: RunMode
  generatedAt: string
  /** The `--since` instant as an ISO string (UTC). */
  since: string
  /** `staging_cloud` tables with an `updated_at` column and the number of rows newer than `since`. */
  staged: { table: string; changedRows: number }[]
  entities: DeltaEntity[]
}

export interface PipelineResult {
  stages: StageResult[]
  verify?: VerifyReport
  delta?: DeltaReport
  status: 'succeeded' | 'failed'
}

export interface PipelineOptions {
  pool: pg.Pool
  env: Env
  source?: 'cloud'
  /** Default `dry-run`. */
  mode?: RunMode
  /** `YYYY-MM-DD`; the same value goes to every stage. */
  asOf: string
  batchSize?: number
  /** v2 user id that owns migrated content (activity `--content-owner`). */
  contentOwner?: string
  /** Report directory (a `.migration-out` folder). Default `<repo>/.migration-out`. */
  outDir?: string
  gitSha?: string | null
  /** Called with each stage as soon as it finishes (the CLI prints it), so completed stages survive a later throw. */
  onStage?: (stage: StageResult) => void
  /** Test seam: the reconciliation. Default `runVerify` (Part B). */
  verify?: (options: VerifyOptions) => Promise<VerifyReport>
  /** Test seam: the report writer. Default `writeVerifyReport` (Part B). */
  writeReport?: (report: VerifyReport, outDir?: string) => { json: string; md: string }
}

export interface DeltaOptions extends PipelineOptions {
  /** ISO-8601 instant with a zone, e.g. `2026-06-02T00:00:00Z`. */
  since: string
}

export const ACTIVITY_NEEDS_CORE = 'needs migrate:core --apply first'
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const DEFAULT_OUT_DIR = join(REPO_ROOT, '.migration-out')
const MAX_IDS_PRINTED = 200

// ---------------------------------------------------------------- stages

const fromReport = (name: 'core' | 'activity', report: RunReport): StageResult => ({
  name,
  mode: report.mode,
  status: report.status,
  runId: report.runId,
  recon: report.recon,
  counters: report.counters,
})

async function runStage(name: 'core' | 'activity', mode: RunMode, o: PipelineOptions): Promise<StageResult> {
  const source = o.source ?? 'cloud'
  const common = { pool: o.pool, env: o.env, source, asOf: o.asOf, mode, batchSize: o.batchSize, gitSha: o.gitSha }
  if (name === 'core') return fromReport('core', (await runCore(common)).report)
  // Activity resolves ids from the core run that used the same as-of, so the preflight is told which one that was.
  return fromReport('activity', (await runActivity({ ...common, coreAsOf: o.asOf, contentOwnerUserId: o.contentOwner })).report)
}

/** Why the activity dry-run cannot start yet, or undefined when the preflight passes. */
async function activitySkipReason(o: PipelineOptions): Promise<string | undefined> {
  try {
    await assertCorePreflight({ pool: o.pool, env: o.env, source: o.source ?? 'cloud', asOf: o.asOf, coreAsOf: o.asOf })
    return undefined
  } catch (e) {
    if (e instanceof PreflightError) return ACTIVITY_NEEDS_CORE
    throw e
  }
}

async function verifyStage(o: PipelineOptions, runIds: readonly string[]): Promise<{ stage: StageResult; report?: VerifyReport }> {
  const outDir = o.outDir ?? DEFAULT_OUT_DIR
  let report: VerifyReport | undefined
  try {
    report = await (o.verify ?? runVerify)({ pool: o.pool, env: o.env, source: o.source ?? 'cloud', outDir, runIds })
    report.files = (o.writeReport ?? writeVerifyReport)(report, outDir)
    return { stage: { name: 'verify', mode: 'verify', status: report.status === 'pass' ? 'succeeded' : 'failed' }, report }
  } catch (e) {
    const safe = sanitizeDbError(e)
    const error = safe instanceof Error ? safe.message : 'unexpected error'
    return { stage: { name: 'verify', mode: 'verify', status: 'failed', error }, report }
  }
}

async function runPipeline(o: PipelineOptions): Promise<PipelineResult> {
  const stages: StageResult[] = []
  const add = (s: StageResult): void => {
    stages.push(s)
    o.onStage?.(s)
  }
  const done = (verify?: VerifyReport): PipelineResult => ({
    stages,
    verify,
    status: stages.every((s) => s.status !== 'failed') ? 'succeeded' : 'failed',
  })

  if ((o.mode ?? 'dry-run') === 'dry-run') {
    const core = await runStage('core', 'dry-run', o)
    add(core)
    if (core.status !== 'succeeded') return done()
    const reason = await activitySkipReason(o)
    add(
      reason === undefined
        ? await runStage('activity', 'dry-run', o)
        : { name: 'activity', mode: 'dry-run', status: 'skipped', skippedReason: reason },
    )
    return done()
  }

  const applyRuns: string[] = []
  for (const name of ['core', 'activity'] as const) {
    const dry = await runStage(name, 'dry-run', o)
    add(dry)
    if (dry.status !== 'succeeded') return done()
    const applied = await runStage(name, 'apply', o)
    add(applied)
    if (applied.status !== 'succeeded') return done()
    if (applied.runId !== undefined) applyRuns.push(applied.runId)
  }
  const { stage, report } = await verifyStage(o, applyRuns)
  add(stage)
  return done(report)
}

/** `migrate:all`: core, then activity, then (on `--apply`) the reconciliation. */
export function runAll(options: PipelineOptions): Promise<PipelineResult> {
  return runPipeline(options)
}

// ---------------------------------------------------------------- delta

/** A delta needs a first load to be a delta of: a succeeded core apply for the source. */
export async function assertFirstLoadExists(pool: Pick<pg.Pool, 'query'>, source: string): Promise<void> {
  const res = await pool.query(
    `SELECT 1 FROM etl_runs
     WHERE mode = 'apply' AND status = 'succeeded' AND sources @> ARRAY[$1]::text[] AND entity_set @> ARRAY['users', 'classrooms']::text[]
     LIMIT 1`,
    [source],
  )
  if ((res.rowCount ?? 0) === 0) throw new ApplyGuardError('No earlier succeeded migrate:core --apply run: run migrate:all --apply first.')
}

/** Rows newer than `since` per staging table that has an `updated_at` column (counts only). */
export async function stagedChanges(pool: Pick<pg.Pool, 'query'>, since: string): Promise<DeltaReport['staged']> {
  const tables = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.columns WHERE table_schema = $1 AND column_name = 'updated_at' ORDER BY 1`,
    [STAGING_SCHEMA],
  )
  const out: DeltaReport['staged'] = []
  for (const { table_name: table } of tables.rows) {
    const res = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ${quoteIdent(STAGING_SCHEMA)}.${quoteIdent(table)} WHERE "updated_at" > $1::timestamptz`,
      [since],
    )
    out.push({ table, changedRows: Number(res.rows[0]?.n ?? 0) })
  }
  return out
}

/** Entity counters of the last run of each stage (the apply when there is one, else the dry-run). */
function deltaEntities(stages: readonly StageResult[]): DeltaEntity[] {
  const out: DeltaEntity[] = []
  for (const name of ['core', 'activity'] as const) {
    const last = [...stages].reverse().find((s) => s.name === name && s.counters !== undefined)
    for (const [entity, c] of Object.entries(last?.counters ?? {})) {
      out.push({ stage: name, entity, read: c.read, inserted: c.inserted, updated: c.updated, unchanged: c.unchanged })
    }
  }
  return out
}

/** `migrate:delta`: the same sequence as `runAll` on the re-staged freeze dump, plus the delta report. */
export async function runDelta(options: DeltaOptions): Promise<PipelineResult> {
  const since = parseSince(options.since)
  await assertFirstLoadExists(options.pool, options.source ?? 'cloud')
  const result = await runPipeline(options)
  result.delta = {
    source: 'cloud',
    mode: options.mode ?? 'dry-run',
    generatedAt: new Date().toISOString(),
    since,
    staged: await stagedChanges(options.pool, since),
    entities: deltaEntities(result.stages),
  }
  return result
}

const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-](\d{2}):(\d{2}))$/

/**
 * An ISO-8601 instant WITH a zone (a bare local time is ambiguous across the freeze); returns it as a UTC ISO string.
 * Impossible values (30 February, hour 24, minute 60, offset beyond 23:59) are rejected: every field must round-trip.
 */
export function parseSince(value: string): string {
  const m = ISO_INSTANT.exec(value)
  const bad = new ApplyGuardError('--since must be an ISO-8601 timestamp with a zone, e.g. 2026-06-02T00:00:00Z.')
  if (!m) throw bad
  const [y, mo, d, h, mi, sec] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(Number) as [number, number, number, number, number, number]
  const wall = new Date(Date.UTC(y, mo - 1, d, h, mi, sec))
  const roundTrips =
    wall.getUTCFullYear() === y && wall.getUTCMonth() === mo - 1 && wall.getUTCDate() === d &&
    wall.getUTCHours() === h && wall.getUTCMinutes() === mi && wall.getUTCSeconds() === sec
  const offsetOk = m[8] === undefined || (Number(m[8]) <= 23 && Number(m[9]) <= 59)
  const ms = Date.parse(value)
  if (!roundTrips || !offsetOk || Number.isNaN(ms)) throw bad
  return new Date(ms).toISOString()
}

function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

/** Writes `delta-<stamp>.json` (mode 0600) into a `.migration-out` folder; returns the path. */
export function writeDeltaReport(delta: DeltaReport, outDir: string = DEFAULT_OUT_DIR): string {
  const dir = prepareOutputDir(outDir)
  const file = join(dir, `delta-${delta.generatedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}.json`)
  // Like profile/render.ts: never write through a symbolic link; replace an existing file, then create with `wx`.
  if (existsSync(file) || isLink(file)) {
    if (lstatSync(file).isSymbolicLink()) throw new RangeError('The delta report file is a symbolic link; refusing to write through it.')
    unlinkSync(file)
  }
  writeFileSync(file, `${JSON.stringify(delta, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  return file
}

// ---------------------------------------------------------------- command line

const DATE = /^\d{4}-\d{2}-\d{2}$/
const USER_ID = /^[1-9]\d{0,17}$/

function flagValue(args: CommandArgs, name: string): string | undefined {
  const v = args.flags.get(name)
  if (v === true) throw new ApplyGuardError(`--${name} needs a value.`)
  return v
}

interface CommonFlags {
  asOf: string
  batchSize?: number
  contentOwner?: string
  outDir: string
}

function batchSizeOf(args: CommandArgs): number | undefined {
  const text = flagValue(args, 'batch-size')
  if (text === undefined) return undefined
  const n = Number(text)
  if (!Number.isInteger(n) || n < 1) throw new ApplyGuardError('--batch-size must be a positive integer.')
  return n
}

/** Validated before any work, so a bad flag never costs a dry-run. */
function outDirOf(args: CommandArgs): string {
  const raw = flagValue(args, 'out-dir')
  const dir = raw === undefined ? DEFAULT_OUT_DIR : resolve(raw)
  try {
    return prepareOutputDir(dir)
  } catch (e) {
    if (e instanceof ProfileOutputError) throw new ApplyGuardError(`--out-dir: ${e.message}`)
    throw e
  }
}

/** Today's calendar date in Asia/Kuala_Lumpur (UTC+8), `YYYY-MM-DD`; the clock is a test seam. */
export function malaysiaDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

function commonFlags(args: CommandArgs, requireAsOf = false): CommonFlags {
  const given = flagValue(args, 'as-of')
  if (given === undefined && requireAsOf) {
    throw new ApplyGuardError('--as-of is required: reuse the --as-of of the first load (YYYY-MM-DD).')
  }
  const asOf = given ?? malaysiaDate()
  if (!DATE.test(asOf) || Number.isNaN(Date.parse(`${asOf}T00:00:00Z`))) throw new ApplyGuardError('--as-of must be YYYY-MM-DD.')
  const contentOwner = flagValue(args, 'content-owner')
  if (contentOwner !== undefined && !USER_ID.test(contentOwner)) throw new ApplyGuardError('--content-owner must be a v2 user id (digits).')
  return { asOf, batchSize: batchSizeOf(args), contentOwner, outDir: outDirOf(args) }
}

function printRecon(ctx: CliContext, recon: readonly ReconRow[]): void {
  ctx.out('entity | source | eligible | loaded | rejected | status')
  for (const r of recon) ctx.out(`${r.entity} | ${r.sourceCount} | ${r.eligibleCount} | ${r.loaded} | ${r.rejected} | ${r.status}`)
}

function printStage(ctx: CliContext, label: string, s: StageResult): void {
  if (s.status === 'skipped') {
    ctx.out(`${label} ${s.name} ${s.mode}: skipped (${s.skippedReason ?? 'no reason'})`)
  } else if (s.name === 'verify') {
    ctx.out(`${label} verify: ${s.status}${s.error !== undefined ? ` (${s.error})` : ''}`)
  } else {
    ctx.out(`${label} ${s.name} ${s.mode}: run ${s.runId} ${s.status}`)
    printRecon(ctx, s.recon ?? [])
  }
}

/** After the stages (already printed one by one): the verify report and which stage stopped the run. */
function printOutcome(ctx: CliContext, label: string, result: PipelineResult): void {
  if (result.verify) printVerify(ctx, result.verify)
  const failed = result.stages.find((s) => s.status === 'failed')
  if (failed) ctx.err(`${label} stopped: stage ${failed.name} (${failed.mode}) failed.`)
}

function printVerify(ctx: CliContext, report: VerifyReport): void {
  ctx.out(`verify ${report.status}: ${report.entities.length} entities, ${report.checks.length} checks, runs ${report.runIds.join(',') || '-'}`)
  ctx.out('entity | source | eligible | loaded | rejected | expected_delta | target | status')
  for (const e of report.entities) {
    ctx.out(`${e.entity} | ${e.sourceCount} | ${e.eligibleCount} | ${e.loaded} | ${e.rejected} | ${e.expectedDelta} | ${e.targetCount ?? '-'} | ${e.status}`)
  }
  for (const c of report.checks.filter((x) => x.status !== 'ok')) {
    ctx.out(`check ${c.kind} ${c.name}: ${c.status} expected=${c.expected ?? '-'} actual=${c.actual ?? '-'}`)
  }
  if (report.files) ctx.out(`report files: ${report.files.json} ${report.files.md}`)
}

function printDelta(ctx: CliContext, delta: DeltaReport): void {
  ctx.out(`delta since ${delta.since} (${delta.mode})`)
  ctx.out('staging table | rows with updated_at > since')
  for (const t of delta.staged.filter((x) => x.changedRows > 0)) ctx.out(`${t.table} | ${t.changedRows}`)
  ctx.out(`staging tables with updated_at: ${delta.staged.length}, with changed rows: ${delta.staged.filter((x) => x.changedRows > 0).length}`)
  ctx.out('stage | entity | read | inserted | updated | unchanged')
  for (const e of delta.entities) ctx.out(`${e.stage} | ${e.entity} | ${e.read} | ${e.inserted} | ${e.updated} | ${e.unchanged}`)
}

export const migrateAll: MigrateCommand = {
  name: 'migrate:all',
  summary: 'core then activity (dry-run first, then apply) and the reconciliation (dry-run by default)',
  async run(args, ctx) {
    const f = commonFlags(args)
    const result = await runAll({ pool: ctx.pool, env: ctx.env, mode: args.mode, ...f, onStage: (s) => printStage(ctx, 'migrate:all', s) })
    printOutcome(ctx, 'migrate:all', result)
    return result.status === 'succeeded' ? 0 : 1
  },
}

export const migrateDelta: MigrateCommand = {
  name: 'migrate:delta',
  summary: 'freeze-window re-run of core and activity on the re-staged dump; only changed rows are written',
  async run(args, ctx) {
    const since = flagValue(args, 'since')
    if (since === undefined) throw new ApplyGuardError('--since is required (ISO-8601 timestamp, e.g. 2026-06-02T00:00:00Z).')
    parseSince(since)
    const f = commonFlags(args, true)
    const result = await runDelta({ pool: ctx.pool, env: ctx.env, mode: args.mode, since, ...f, onStage: (s) => printStage(ctx, 'migrate:delta', s) })
    printOutcome(ctx, 'migrate:delta', result)
    if (result.delta) {
      printDelta(ctx, result.delta)
      ctx.out(`delta report: ${writeDeltaReport(result.delta, f.outDir)}`)
    }
    return result.status === 'succeeded' ? 0 : 1
  },
}

export const migrateVerify: MigrateCommand = {
  name: 'migrate:verify',
  summary: 'reconciliation report and go/no-go gate for the loaded data (read-only)',
  async run(args, ctx) {
    const outDir = outDirOf(args)
    const report = await runVerify({ pool: ctx.pool, env: ctx.env, source: 'cloud', outDir })
    report.files = writeVerifyReport(report, outDir)
    printVerify(ctx, report)
    return report.status === 'pass' ? 0 : 1
  },
}

export const migrateRollback: MigrateCommand = {
  name: 'migrate:rollback',
  summary: 'delete every row loaded from the source (dry-run by default; --confirm=<database name> is required)',
  async run(args, ctx) {
    const confirm = flagValue(args, 'confirm')
    if (confirm === undefined) throw new ApplyGuardError('--confirm=<database name> is required (it must equal the connected database).')
    const report = await rollbackLegacy({ pool: ctx.pool, env: ctx.env, source: 'cloud', confirmDb: confirm, dryRun: args.mode !== 'apply' })
    ctx.out(`migrate:rollback ${report.dryRun ? 'dry-run' : 'apply'} on "${report.database}": ${report.status}`)
    ctx.out('table | deleted')
    for (const t of report.tables) ctx.out(`${t.table} | ${t.deleted}`)
    ctx.out(`etl_id_map | ${report.idMapDeleted}`)
    // Adopted seed rows that other tables use are kept and unmarked, not deleted (counts only).
    for (const r of report.released ?? []) ctx.out(`released ${r.table}: ${r.rows}`)
    for (const w of report.warnings ?? []) ctx.out(`warning: ${w}`)
    return report.status === 'succeeded' ? 0 : 1
  },
}

export const migrateLinkQuestions: MigrateCommand = {
  name: 'migrate:link-questions',
  summary: 'optional backfill: link migrated answers to bank questions by natural key + content hash (dry-run by default)',
  async run(args, ctx) {
    const batchSize = batchSizeOf(args)
    let r: Awaited<ReturnType<typeof linkQuestions>>
    try {
      r = await linkQuestions({ pool: ctx.pool, env: ctx.env, source: 'cloud', mode: args.mode, batchSize })
    } catch (e) {
      // Another backfill holds the lock, or an ETL apply is running: the kit's "busy" exit code.
      if (e instanceof LinkQuestionsBusyError) {
        ctx.err(e.message)
        return EXIT.busy
      }
      throw e
    }
    ctx.out(`migrate:link-questions ${r.mode}`)
    ctx.out('examined | linked | ambiguous | unmatched | already linked')
    ctx.out(`${r.examined} | ${r.linked} | ${r.ambiguous} | ${r.unmatched} | ${r.alreadyLinked}`)
    // Surrogate answer ids only, capped.
    for (const [name, ids] of [['ambiguous', r.ambiguousIds], ['unmatched', r.unmatchedIds]] as const) {
      if (ids.length > 0) ctx.out(`ids ${name}: ${ids.slice(0, MAX_IDS_PRINTED).join(',')}${ids.length > MAX_IDS_PRINTED ? ',...' : ''}`)
    }
    return 0
  },
}

export const migrateExportQuestionReports: MigrateCommand = {
  name: 'migrate:export-question-reports',
  summary: 'export the open question reports to a CSV for the content team (read-only; personal-data-bearing file)',
  async run(args, ctx) {
    // Reads only: there is nothing to apply, so --apply is a usage error rather than something silently ignored.
    if (args.mode === 'apply') throw new ApplyGuardError('migrate:export-question-reports is a read-only command: it has no --apply.')
    const outDir = outDirOf(args)
    const r = await exportOpenQuestionReports({ pool: ctx.pool, source: 'cloud', outDir })
    ctx.out(`migrate:export-question-reports: ${r.exported} open report(s) exported of ${r.total} (working assumption for "open": see the summary file)`)
    ctx.out('status | reports | exported')
    for (const s of r.byStatus) ctx.out(`${s.status} | ${s.count} | ${s.exported ? 'yes' : 'no'}`)
    ctx.out(`csv: ${r.csv}`)
    ctx.out(`summary: ${r.summary}`)
    ctx.out('The CSV holds reporter free text: hand it over to the content team and delete it (runbook section 17a).')
    return 0
  },
}

for (const c of [migrateAll, migrateDelta, migrateVerify, migrateRollback, migrateLinkQuestions, migrateExportQuestionReports]) registerMigrateCommand(c)

// Run the CLI only when this file is the entry (`tsx src/migration/orchestrate.ts migrate:all ...`), never on import.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli(process.argv.slice(2))
}
