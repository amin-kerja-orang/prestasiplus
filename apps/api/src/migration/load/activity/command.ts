/**
 * The `migrate:activity` command (BE-29). Registers itself with the kit CLI on import.
 *
 *   npm run migrate:activity -w @pp/api -- [--dry-run | --apply] [--table=a,b] [--group=wallet,activity]
 *       [--as-of=YYYY-MM-DD] [--core-as-of=YYYY-MM-DD] [--batch-size=N] [--content-owner=<v2 user id>]
 *       [--report-file=.migration-out/<name>.txt] [--files-dir=<export dir outside the repo>]
 *
 * Needs `migrate:core --apply` to have run on the same staged data (preflight). Environment: DATABASE_URL (the v2
 * database that also holds staging_cloud and archive_cloud), for --apply PP_ALLOW_MIGRATE_APPLY=1 (and, in
 * production, PP_MIGRATE_TARGET_DB). It reads only the staged copy; it never connects to or reads the settings of the source database.
 * Files (AC9): `--files-dir=<dir>` names a read-only export of the .cloud storage files, outside the repo, with a SHA256SUMS
 * manifest; without it no file is migrated and file references stay unset.
 */
import { mytDay, SystemClock, type Clock } from '../../../db/clock'
import { registerMigrateCommand, withSourceLock, type CliContext, type CommandArgs, type MigrateCommand } from '../../kit'
import { ApplyGuardError } from '../../kit/apply-guard'
import { prepareOutputDir } from '../../profile'
import { dirname, resolve } from 'node:path'
import { resolveGitSha } from '../git-sha'
import { NoActivityStepsError, runActivity } from './index'
import { writeReportFile } from './drift'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const USER_ID = /^[1-9]\d{0,17}$/
/** Storage flags that do not exist: files come only from the exported `--files-dir`. */
const FILE_FLAGS = ['storage-dir', 'storage', 'files', 'copy-files']
const MAX_IDS_PRINTED = 200
/** Every flag this command reads (besides `--dry-run` / `--apply`, which the kit parses); anything else is a usage error. */
const KNOWN_FLAGS: ReadonlySet<string> = new Set(['as-of', 'core-as-of', 'batch-size', 'content-owner', 'report-file', 'group', 'table', 'files-dir'])

function flagValue(args: CommandArgs, name: string): string | undefined {
  const v = args.flags.get(name)
  if (v === true) throw new ApplyGuardError(`--${name} needs a value.`)
  return v
}

function list(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined
  const items = value.split(',').map((s) => s.trim()).filter((s) => s !== '')
  return items.length === 0 ? undefined : items
}

function date(name: string, value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  if (!DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new ApplyGuardError(`--${name} must be YYYY-MM-DD.`)
  return value
}

/** The default `--as-of`: today's calendar day in Malaysia (Asia/Kuala_Lumpur, UTC+8), not the UTC day (OD-10 Q8). */
export function defaultAsOf(clock: Clock = new SystemClock()): string {
  return mytDay(clock.now())
}

/**
 * The one-line file summary (counts only). Without `--files-dir`: how many references were left unset. With it: copied,
 * already present and rejected banner images (a dry-run copies nothing: "copied" is what an apply would copy), and the
 * references that have no v2 target (audio).
 */
export function filesLine(counters: ReadonlyMap<string, number>, withDir: boolean, mode: string): string {
  const sum = (match: (k: string) => boolean): number => [...counters].filter(([k]) => match(k)).reduce((t, [, v]) => t + v, 0)
  const off = sum((k) => k.startsWith('file_migration_off.'))
  if (!withDir) return `files: not migrated (no --files-dir) ${off} references`
  const copied = sum((k) => k.endsWith('.copied') && k.startsWith('files.'))
  const present = sum((k) => k.endsWith('.present') && k.startsWith('files.'))
  const rejected = sum((k) => k.startsWith('files.') && k.includes('.rejected.'))
  return `files: ${mode === 'apply' ? 'copied' : 'would copy (dry-run, nothing written)'} ${copied}, already present ${present}, rejected ${rejected}; not migrated (no v2 target) ${off} references`
}

export const migrateActivity: MigrateCommand = {
  name: 'migrate:activity',
  summary: 'ETL of wallets, practice and exam history, gamification, content and operations from staging_cloud (dry-run by default)',
  async run(args: CommandArgs, ctx: CliContext): Promise<number> {
    for (const f of FILE_FLAGS) {
      if (args.flags.has(f)) throw new ApplyGuardError(`--${f} is not available: the .cloud storage is never read directly; pass --files-dir=<export directory> (outside the repo, with a SHA256SUMS manifest).`)
    }
    // A typo such as --talbe=wallets must not silently select the full entity set.
    for (const name of args.flags.keys()) {
      if (!KNOWN_FLAGS.has(name)) throw new ApplyGuardError(`unknown flag --${name}.`)
    }
    if (args.positional.length > 0) throw new ApplyGuardError('unexpected argument: this command takes flags only (--name=value).')
    const asOf = date('as-of', flagValue(args, 'as-of')) ?? defaultAsOf()
    const coreAsOf = date('core-as-of', flagValue(args, 'core-as-of'))
    const sizeText = flagValue(args, 'batch-size')
    const batchSize = sizeText === undefined ? undefined : Number(sizeText)
    if (batchSize !== undefined && (!Number.isInteger(batchSize) || batchSize < 1)) throw new ApplyGuardError('--batch-size must be a positive integer.')
    const owner = flagValue(args, 'content-owner')
    if (owner !== undefined && !USER_ID.test(owner)) throw new ApplyGuardError('--content-owner must be a v2 user id (digits).')
    const filesDir = flagValue(args, 'files-dir')
    if (filesDir !== undefined && filesDir.trim() === '') throw new ApplyGuardError('--files-dir needs a directory.')
    const reportFile = flagValue(args, 'report-file')
    // Fail before any work when the report path is not allowed (a .migration-out folder under the repo).
    if (reportFile !== undefined) prepareOutputDir(dirname(resolve(reportFile)))

    const lines: string[] = []
    const emit = (line: string): void => {
      lines.push(line)
      ctx.out(line)
    }

    let result: Awaited<ReturnType<typeof runActivity>>
    try {
      // Dry-run and apply both take the per-source lock (the orchestrator's key); runActivity itself stays lock-free for it.
      result = await withSourceLock(ctx.pool, 'cloud', () => runActivity({
        pool: ctx.pool,
        env: ctx.env,
        source: 'cloud',
        asOf,
        coreAsOf,
        mode: args.mode,
        batchSize,
        gitSha: resolveGitSha(ctx.env),
        contentOwnerUserId: owner,
        filesDir,
        groupNames: list(flagValue(args, 'group')),
        only: list(flagValue(args, 'table')),
      }))
    } catch (e) {
      if (e instanceof NoActivityStepsError) {
        ctx.err(e.message)
        return 2
      }
      throw e
    }
    const { report, activity, notMigrated, blockedBySpec } = result

    emit(`migrate:activity ${report.mode}: run ${report.runId} ${report.status}`)
    emit('entity | source | eligible | loaded | rejected | status')
    for (const r of report.recon) {
      emit(`${r.entity} | ${r.sourceCount} | ${r.eligibleCount} | ${r.loaded} | ${r.rejected} | ${r.status}`)
    }
    // A green run can still leave a table empty when the staging spec lacks a column: say so (counts only).
    for (const b of blockedBySpec) emit(`blocked by spec: ${b.entity} 0/${b.sourceCount}`)
    // Counts and surrogate ids only: no name, e-mail, IC, phone, free text or hash is ever printed.
    for (const [name, n] of [...activity.notes.counters].sort(([a], [b]) => (a < b ? -1 : 1))) emit(`note ${name}: ${n}`)
    for (const [name, ids] of [...activity.notes.ids].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (ids.length > 0) emit(`ids ${name}: ${ids.slice(0, MAX_IDS_PRINTED).join(',')}${ids.length > MAX_IDS_PRINTED ? ',...' : ''}`)
    }
    emit(filesLine(activity.notes.counters, filesDir !== undefined, args.mode))
    for (const l of activity.drift.lines()) emit(l)
    for (const n of notMigrated) emit(`not migrated ${n.table}: ${n.reason}`)

    if (reportFile !== undefined) emit(`report file: ${writeReportFile(reportFile, lines)}`)
    return report.status === 'succeeded' ? 0 : 1
  },
}

registerMigrateCommand(migrateActivity)
