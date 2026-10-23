/**
 * The `migrate:questions` command (QLOAD). Registers itself with the kit CLI on import.
 *
 *   npm run migrate:questions -w @pp/api -- [--dry-run | --apply] [--as-of=YYYY-MM-DD] [--core-as-of=YYYY-MM-DD] [--batch-size=N]
 *
 * Run AFTER `migrate:all` (needs `migrate:core --apply` on the same staged data). Environment: DATABASE_URL (the v2 database that
 * also holds archive_cloud), for --apply PP_ALLOW_MIGRATE_APPLY=1 (and in production PP_MIGRATE_TARGET_DB). It reads only the archive.
 * Output is counts only, never a question text.
 */
import { mytDay, SystemClock, type Clock } from '../../../db/clock'
import { registerMigrateCommand, withSourceLock, type CliContext, type CommandArgs, type MigrateCommand } from '../../kit'
import { ApplyGuardError } from '../../kit/apply-guard'
import { resolveGitSha } from '../git-sha'
import { runQuestions } from './index'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const KNOWN_FLAGS: ReadonlySet<string> = new Set(['as-of', 'core-as-of', 'batch-size'])

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

export const defaultAsOf = (clock: Clock = new SystemClock()): string => mytDay(clock.now())

export const migrateQuestions: MigrateCommand = {
  name: 'migrate:questions',
  summary: 'loads the approved .cloud MCQs from archive_cloud into the v2 question bank, after migrate:all (dry-run by default)',
  async run(args: CommandArgs, ctx: CliContext): Promise<number> {
    for (const name of args.flags.keys()) if (!KNOWN_FLAGS.has(name)) throw new ApplyGuardError(`unknown flag --${name}.`)
    if (args.positional.length > 0) throw new ApplyGuardError('unexpected argument: this command takes flags only (--name=value).')
    const asOf = date('as-of', flagValue(args, 'as-of')) ?? defaultAsOf()
    const coreAsOf = date('core-as-of', flagValue(args, 'core-as-of'))
    const sizeText = flagValue(args, 'batch-size')
    const batchSize = sizeText === undefined ? undefined : Number(sizeText)
    if (batchSize !== undefined && (!Number.isInteger(batchSize) || batchSize < 1)) throw new ApplyGuardError('--batch-size must be a positive integer.')

    const { report, questions } = await withSourceLock(ctx.pool, 'cloud', () =>
      runQuestions({ pool: ctx.pool, env: ctx.env, source: 'cloud', asOf, coreAsOf, mode: args.mode, batchSize, gitSha: resolveGitSha(ctx.env), progress: ctx.out }),
    )
    ctx.out(`migrate:questions ${report.mode}: run ${report.runId} ${report.status}`)
    ctx.out('entity | source | eligible | loaded | rejected | status')
    for (const r of report.recon) ctx.out(`${r.entity} | ${r.sourceCount} | ${r.eligibleCount} | ${r.loaded} | ${r.rejected} | ${r.status}`)
    for (const [name, n] of [...questions.notes.counters].sort(([a], [b]) => (a < b ? -1 : 1))) ctx.out(`note ${name}: ${n}`)
    return report.status === 'succeeded' ? 0 : 1
  },
}

registerMigrateCommand(migrateQuestions)
