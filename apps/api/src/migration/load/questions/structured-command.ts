/**
 * The `migrate:structured` command (T-B9-6, T-B9-7). Registers itself with the kit CLI on import.
 *
 *   npx tsx src/migration/load/questions/structured-cli.ts -- [--dry-run | --apply] [--as-of=YYYY-MM-DD] [--core-as-of=YYYY-MM-DD] [--batch-size=N] [--out-dir=<.migration-out path>] [--files-dir=<V2 storage export>]
 *
 * Run AFTER `migrate:all` and `migrate:questions`. Environment: DATABASE_URL, for --apply PP_ALLOW_MIGRATE_APPLY=1. Counts only in the output.
 */
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { mytDay, SystemClock } from '../../../db/clock'
import { registerMigrateCommand, withSourceLock, type CliContext, type CommandArgs, type MigrateCommand } from '../../kit'
import { ApplyGuardError } from '../../kit/apply-guard'
import { prepareOutputDir, ProfileOutputError } from '../../profile'
import { resolveGitSha } from '../git-sha'
import { filesMissingCsv } from './files-step'
import { runStructured } from './structured-index'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const KNOWN_FLAGS: ReadonlySet<string> = new Set(['as-of', 'core-as-of', 'batch-size', 'out-dir', 'files-dir'])

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

export interface StructuredArgs {
  asOf: string
  coreAsOf?: string
  batchSize?: number
  outDir: string
  /** `--files-dir`: the V2 storage export; the run then ends with the picture pass (releases the questions held for a picture). */
  filesDir?: string
}

export function parseStructuredArgs(args: CommandArgs, prepare: (dir: string) => string = prepareOutputDir): StructuredArgs {
  for (const name of args.flags.keys()) if (!KNOWN_FLAGS.has(name)) throw new ApplyGuardError(`unknown flag --${name}.`)
  if (args.positional.length > 0) throw new ApplyGuardError('unexpected argument: this command takes flags only (--name=value).')
  const sizeText = flagValue(args, 'batch-size')
  const batchSize = sizeText === undefined ? undefined : Number(sizeText)
  if (batchSize !== undefined && (!Number.isInteger(batchSize) || batchSize < 1)) throw new ApplyGuardError('--batch-size must be a positive integer.')
  const raw = flagValue(args, 'out-dir')
  let outDir: string
  try {
    outDir = prepare(raw === undefined ? resolve('.migration-out') : resolve(raw))
  } catch (e) {
    if (e instanceof ProfileOutputError) throw new ApplyGuardError(`--out-dir: ${e.message}`)
    throw e
  }
  const filesDir = flagValue(args, 'files-dir')
  return { asOf: date('as-of', flagValue(args, 'as-of')) ?? mytDay(new SystemClock().now()), coreAsOf: date('core-as-of', flagValue(args, 'core-as-of')), batchSize, outDir, ...(filesDir === undefined ? {} : { filesDir }) }
}

export const migrateStructured: MigrateCommand = {
  name: 'migrate:structured',
  summary: 'loads the V2 structured, subjective and canonical-only questions from archive_cloud (after migrate:all and migrate:questions; dry-run by default)',
  async run(args: CommandArgs, ctx: CliContext): Promise<number> {
    const { asOf, coreAsOf, batchSize, outDir, filesDir } = parseStructuredArgs(args)
    const { report, questions } = await withSourceLock(ctx.pool, 'cloud', () =>
      runStructured({ pool: ctx.pool, env: ctx.env, source: 'cloud', asOf, coreAsOf, mode: args.mode, batchSize, gitSha: resolveGitSha(ctx.env), progress: ctx.out, filesDir }),
    )
    ctx.out(`migrate:structured ${report.mode}: run ${report.runId} ${report.status}`)
    ctx.out('entity | source | eligible | loaded | rejected | status')
    for (const r of report.recon) ctx.out(`${r.entity} | ${r.sourceCount} | ${r.eligibleCount} | ${r.loaded} | ${r.rejected} | ${r.status}`)
    const notes = [...questions.notes.counters].sort(([a], [b]) => (a < b ? -1 : 1))
    for (const [name, n] of notes) ctx.out(`note ${name}: ${n}`)
    const rejects = await ctx.pool.query<{ entity: string; reason: string; column_name: string | null; n: number }>(
      `SELECT entity, reason, column_name, count(*)::int AS n FROM etl_rejects WHERE run_id = $1 GROUP BY entity, reason, column_name ORDER BY entity, reason, column_name`,
      [report.runId],
    )
    const file = join(outDir, `structured-${report.mode}-${report.runId}-${randomBytes(3).toString('hex')}.json`)
    writeFileSync(
      file,
      `${JSON.stringify({ command: 'migrate:structured', runId: report.runId, mode: report.mode, status: report.status, asOf, recon: report.recon, counters: report.counters, notes: Object.fromEntries(notes), rejects: rejects.rows.map((r) => ({ entity: r.entity, reason: r.reason, cause: r.column_name, count: r.n })) }, null, 2)}\n`,
      { encoding: 'utf8', mode: 0o600, flag: 'wx' },
    )
    ctx.out(`report: ${file}`)
    if (filesDir !== undefined) {
      const missingOut = join(outDir, `files-missing-structured-${report.mode}-${report.runId}-${randomBytes(3).toString('hex')}.csv`)
      writeFileSync(missingOut, filesMissingCsv(questions.fileFailures), { encoding: 'utf8', mode: 0o600, flag: 'wx' })
      ctx.out(`pictures: ${questions.fileFailures.length} path(s) not usable: ${missingOut}`)
    }
    return report.status === 'succeeded' ? 0 : 1
  },
}

registerMigrateCommand(migrateStructured)
