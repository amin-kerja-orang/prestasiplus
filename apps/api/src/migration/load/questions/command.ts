/**
 * The `migrate:questions` command (QLOAD). Registers itself with the kit CLI on import.
 *
 *   npm run migrate:questions -w @pp/api -- [--dry-run | --apply] [--as-of=YYYY-MM-DD] [--core-as-of=YYYY-MM-DD] [--batch-size=N] [--out-dir=<.migration-out path>]
 *
 * Run AFTER `migrate:all` (needs `migrate:core --apply` on the same staged data). Environment: DATABASE_URL (the v2 database that
 * also holds archive_cloud), for --apply PP_ALLOW_MIGRATE_APPLY=1 (and in production PP_MIGRATE_TARGET_DB). It reads only the archive.
 * Output is counts only, never a question text.
 */
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { mytDay, SystemClock, type Clock } from '../../../db/clock'
import { registerMigrateCommand, withSourceLock, type CliContext, type CommandArgs, type MigrateCommand } from '../../kit'
import { ApplyGuardError } from '../../kit/apply-guard'
import { resolveGitSha } from '../git-sha'
import { prepareOutputDir, ProfileOutputError } from '../../profile'
import { chapterCoverageWarning, eligibleGuard, runQuestions } from './index'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const KNOWN_FLAGS: ReadonlySet<string> = new Set(['as-of', 'core-as-of', 'batch-size', 'out-dir'])

function flagValue(args: CommandArgs, name: string): string | undefined {
  const v = args.flags.get(name)
  if (v === true) throw new ApplyGuardError(`--${name} needs a value.`)
  return v
}

function date(name: string, value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  if (!DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new ApplyGuardError(`--${name} must be YYYY-MM-DD.`)
  return value
}

/** Validated before any work, like the other migrate commands: the directory must be inside a `.migration-out` folder. */
export function outDirOf(args: CommandArgs, prepare: (dir: string) => string = prepareOutputDir): string {
  const raw = flagValue(args, 'out-dir')
  try {
    return prepare(raw === undefined ? resolve('.migration-out') : resolve(raw))
  } catch (e) {
    if (e instanceof ProfileOutputError) throw new ApplyGuardError(`--out-dir: ${e.message}`)
    throw e
  }
}

export interface QuestionsArgs {
  asOf: string
  coreAsOf?: string
  batchSize?: number
  outDir: string
}

/** Every flag check of the command, so a bad flag never costs a dry-run (and the argv shape of `slot.sh etl` is testable). */
export function parseQuestionsArgs(args: CommandArgs, prepare?: (dir: string) => string): QuestionsArgs {
  for (const name of args.flags.keys()) if (!KNOWN_FLAGS.has(name)) throw new ApplyGuardError(`unknown flag --${name}.`)
  if (args.positional.length > 0) throw new ApplyGuardError('unexpected argument: this command takes flags only (--name=value).')
  const asOf = date('as-of', flagValue(args, 'as-of')) ?? defaultAsOf()
  const coreAsOf = date('core-as-of', flagValue(args, 'core-as-of'))
  const sizeText = flagValue(args, 'batch-size')
  const batchSize = sizeText === undefined ? undefined : Number(sizeText)
  if (batchSize !== undefined && (!Number.isInteger(batchSize) || batchSize < 1)) throw new ApplyGuardError('--batch-size must be a positive integer.')
  return { asOf, coreAsOf, batchSize, outDir: outDirOf(args, prepare) }
}

export const defaultAsOf = (clock: Clock = new SystemClock()): string => mytDay(clock.now())

export const migrateQuestions: MigrateCommand = {
  name: 'migrate:questions',
  summary: 'loads the approved .cloud MCQs from archive_cloud into the v2 question bank, after migrate:all (dry-run by default)',
  async run(args: CommandArgs, ctx: CliContext): Promise<number> {
    const { asOf, coreAsOf, batchSize, outDir } = parseQuestionsArgs(args)

    const { report, questions } = await withSourceLock(ctx.pool, 'cloud', () =>
      runQuestions({ pool: ctx.pool, env: ctx.env, source: 'cloud', asOf, coreAsOf, mode: args.mode, batchSize, gitSha: resolveGitSha(ctx.env), progress: ctx.out }),
    )
    ctx.out(`migrate:questions ${report.mode}: run ${report.runId} ${report.status}`)
    ctx.out('entity | source | eligible | loaded | rejected | status')
    for (const r of report.recon) ctx.out(`${r.entity} | ${r.sourceCount} | ${r.eligibleCount} | ${r.loaded} | ${r.rejected} | ${r.status}`)
    const notes = [...questions.notes.counters].sort(([a], [b]) => (a < b ? -1 : 1))
    for (const [name, n] of notes) ctx.out(`note ${name}: ${n}`)
    const chapterWarning = chapterCoverageWarning(report, questions.notes.counters)
    if (chapterWarning !== null) ctx.out(`warning: ${chapterWarning}`)
    const rejects = await ctx.pool.query<{ reason: string; column_name: string | null; n: number }>(
      `SELECT reason, column_name, count(*)::int AS n FROM etl_rejects WHERE run_id = $1 GROUP BY reason, column_name ORDER BY reason, column_name`,
      [report.runId],
    )
    const file = join(outDir, `questions-${report.mode}-${report.runId}-${randomBytes(3).toString('hex')}.json`)
    // Counts only: no question text, no row, no id.
    writeFileSync(
      file,
      `${JSON.stringify({ command: 'migrate:questions', runId: report.runId, mode: report.mode, status: report.status, asOf, recon: report.recon, counters: report.counters, resumedBatches: report.resumedBatches, notes: Object.fromEntries(notes), warnings: chapterWarning === null ? [] : [chapterWarning], rejects: rejects.rows.map((r) => ({ reason: r.reason, cause: r.column_name, count: r.n })) }, null, 2)}\n`,
      { encoding: 'utf8', mode: 0o600, flag: 'wx' },
    )
    ctx.out(`report: ${file}`)
    const guard = eligibleGuard(report)
    if (guard !== null) {
      ctx.err(`migrate:questions FAILED: ${guard}`)
      return 1
    }
    return report.status === 'succeeded' ? 0 : 1
  },
}

registerMigrateCommand(migrateQuestions)
