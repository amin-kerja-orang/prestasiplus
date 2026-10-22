/**
 * The `migrate:core` command (BE-28). Registers itself with the kit CLI on import.
 *
 *   npm run migrate:core -w @pp/api -- [--dry-run | --apply] [--as-of YYYY-MM-DD] [--batch-size N]
 *
 * Environment: DATABASE_URL (the v2 database that also holds staging_cloud), IC_HASH_KEY (else
 * SESSION_SECRET outside production), PP_MIGRATE_ROSTER_DEFAULT_HASHES (optional; the lead's comma-separated
 * list of shared roster default hashes, never logged), and for --apply PP_ALLOW_MIGRATE_APPLY=1.
 * Reads only the fixtures / anonymised staging copy; it never connects to a source database.
 */
import { mytDay, SystemClock, type Clock } from '../../db/clock'
import { registerMigrateCommand, type CliContext, type CommandArgs, type MigrateCommand } from '../kit'
import { ApplyGuardError } from '../kit/apply-guard'
import { resolveGitSha } from './git-sha'
import { NOT_MIGRATED, runCore } from './index'

const DATE = /^\d{4}-\d{2}-\d{2}$/

function flagValue(args: CommandArgs, name: string): string | undefined {
  const v = args.flags.get(name)
  if (v === true) throw new ApplyGuardError(`--${name} needs a value.`)
  return v
}

/** The default `--as-of`: today's calendar day in Malaysia (Asia/Kuala_Lumpur, UTC+8), not the UTC day (OD-10 Q8). */
export function defaultAsOf(clock: Clock = new SystemClock()): string {
  return mytDay(clock.now())
}

export const migrateCore: MigrateCommand = {
  name: 'migrate:core',
  summary: 'ETL of reference data, identity and classes from staging_cloud (dry-run by default)',
  async run(args: CommandArgs, ctx: CliContext): Promise<number> {
    const asOf = flagValue(args, 'as-of') ?? defaultAsOf()
    if (!DATE.test(asOf) || Number.isNaN(Date.parse(`${asOf}T00:00:00Z`))) throw new ApplyGuardError('--as-of must be YYYY-MM-DD.')
    const sizeText = flagValue(args, 'batch-size')
    const batchSize = sizeText === undefined ? undefined : Number(sizeText)
    if (batchSize !== undefined && (!Number.isInteger(batchSize) || batchSize < 1)) throw new ApplyGuardError('--batch-size must be a positive integer.')

    const { report, core } = await runCore({ pool: ctx.pool, env: ctx.env, source: 'cloud', asOf, mode: args.mode, batchSize, gitSha: resolveGitSha(ctx.env) })

    ctx.out(`migrate:core ${report.mode}: run ${report.runId} ${report.status}`)
    ctx.out('entity | source | eligible | loaded | rejected | status')
    for (const r of report.recon) {
      ctx.out(`${r.entity} | ${r.sourceCount} | ${r.eligibleCount} | ${r.loaded} | ${r.rejected} | ${r.status}`)
    }
    // Counts and surrogate ids only: no name, e-mail, IC, phone or hash is ever printed.
    for (const [name, n] of [...core.notes.counters].sort(([a], [b]) => (a < b ? -1 : 1))) ctx.out(`note ${name}: ${n}`)
    for (const name of ['ppd_officer_without_scope', 'duplicate_email', 'duplicate_username', 'ic_invalid']) {
      const ids = core.notes.ids.get(name)
      if (ids && ids.length > 0) ctx.out(`ids ${name}: ${ids.slice(0, 200).join(',')}${ids.length > 200 ? ',...' : ''}`)
    }
    for (const n of NOT_MIGRATED) ctx.out(`not migrated ${n.table}: ${n.reason}`)
    return report.status === 'succeeded' ? 0 : 1
  },
}

registerMigrateCommand(migrateCore)
