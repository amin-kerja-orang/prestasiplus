/**
 * The `migrate:repair-stimuli` command: repairs, in place, the stimuli that an earlier `migrate:questions` loaded with V2 HTML as text (see
 * repair-stimuli.ts). The full migration is NOT re-run.
 *
 *   npm run migrate:repair-stimuli -w @pp/api -- --files-dir=<V2 storage export with SHA256SUMS> [--dry-run | --apply] [--batch-size=N] [--out-dir=<.migration-out path>]
 *
 * `--files-dir` is the folder that holds `stimuli/<uuid>/<file>` and a `SHA256SUMS` of those paths (relative to the folder). Dry-run (default) runs
 * everything in ONE transaction that is rolled back and copies no file; `--apply` needs `PP_ALLOW_MIGRATE_APPLY=1` (and in production
 * `PP_MIGRATE_TARGET_DB`), `FILE_STORAGE_DIR`, and a passing dry-run on the same input. Output is counts only.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

import { registerMigrateCommand, withSourceLock, type CliContext, type CommandArgs, type MigrateCommand } from '../../kit'
import { ApplyGuardError } from '../../kit/apply-guard'
import { Runner } from '../../kit/runner'
import { hashInput } from '../../kit/sql'
import { openMigrationFiles } from '../activity/files'
import { CoreNotes } from '../context'
import { resolveGitSha } from '../git-sha'
import { assertNotSyntheticInProduction } from '../index'
import { outDirOf } from './command'
import { candidatesDigest, QUESTION_IMAGE_ETL_CAP, REPAIR_RULES_VERSION, repairStimuliStep } from './repair-stimuli'

const KNOWN_FLAGS: ReadonlySet<string> = new Set(['files-dir', 'batch-size', 'out-dir'])

export interface RepairArgs {
  filesDir: string
  batchSize?: number
  outDir: string
}

export function parseRepairArgs(args: CommandArgs, prepare?: (dir: string) => string): RepairArgs {
  for (const name of args.flags.keys()) if (!KNOWN_FLAGS.has(name)) throw new ApplyGuardError(`unknown flag --${name}.`)
  if (args.positional.length > 0) throw new ApplyGuardError('unexpected argument: this command takes flags only (--name=value).')
  const filesDir = args.flags.get('files-dir')
  if (filesDir === undefined || filesDir === true || filesDir === '') throw new ApplyGuardError('--files-dir=<V2 storage export with SHA256SUMS> is required.')
  const sizeText = args.flags.get('batch-size')
  if (sizeText === true) throw new ApplyGuardError('--batch-size needs a value.')
  const batchSize = sizeText === undefined ? undefined : Number(sizeText)
  if (batchSize !== undefined && (!Number.isInteger(batchSize) || batchSize < 1)) throw new ApplyGuardError('--batch-size must be a positive integer.')
  return { filesDir, ...(batchSize === undefined ? {} : { batchSize }), outDir: outDirOf(args, prepare) }
}

export const migrateRepairStimuli: MigrateCommand = {
  name: 'migrate:repair-stimuli',
  summary: 'repairs loaded stimuli that still hold V2 <img>/<table> HTML: copies the pictures, sets asset_file_id / table_data (dry-run by default; needs --files-dir)',
  async run(args: CommandArgs, ctx: CliContext): Promise<number> {
    const { filesDir, batchSize, outDir } = parseRepairArgs(args)
    // The repair reads no staged rows. After the cutover staging_cloud is dropped (KP-23), so the synthetic-dump check only runs while it exists.
    const staged = (await ctx.pool.query<{ ok: boolean }>(`SELECT to_regclass('staging_cloud.users') IS NOT NULL AS ok`)).rows[0]?.ok === true
    if (staged) await assertNotSyntheticInProduction(ctx.pool, ctx.env)
    const mode = args.mode
    const files = await openMigrationFiles({ dir: filesDir, env: ctx.env, mode, source: 'cloud', capOverrides: { question_image: QUESTION_IMAGE_ETL_CAP } })
    const notes = new CoreNotes()
    const { report, candidates } = await withSourceLock(ctx.pool, 'cloud', async () => {
      const found = await candidatesDigest(ctx.pool)
      const inputHash = hashInput([`candidates=${found.count}:${found.digest}`, `manifest=${files.manifestHash}`, 'source=cloud', `rules=${REPAIR_RULES_VERSION}`])
      const run = await new Runner({ pool: ctx.pool, env: ctx.env }).run({
        mode,
        steps: [repairStimuliStep({ pool: ctx.pool, files, notes })],
        inputHash,
        gitSha: resolveGitSha(ctx.env),
        batchSize,
      })
      return { report: run, candidates: found.count }
    })
    ctx.out(`migrate:repair-stimuli ${report.mode === 'apply' ? 'apply' : 'dry-run (rolled back, no file written)'}: run ${report.runId} ${report.status}`)
    ctx.out(`candidate stimuli: ${candidates}`)
    ctx.out('entity | candidates | fixed | rejected | status')
    for (const r of report.recon) ctx.out(`${r.entity} | ${r.eligibleCount} | ${r.loaded} | ${r.rejected} | ${r.status}`)
    const counts = [...notes.counters].sort(([a], [b]) => (a < b ? -1 : 1))
    for (const [name, n] of counts) ctx.out(`${name}: ${n}`)
    const file = join(outDir, `repair-stimuli-${report.mode}-${report.runId}-${randomBytes(3).toString('hex')}.json`)
    writeFileSync(file, `${JSON.stringify({ command: 'migrate:repair-stimuli', runId: report.runId, mode: report.mode, status: report.status, candidates, recon: report.recon, counts: Object.fromEntries(counts) }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    ctx.out(`report: ${file}`)
    return report.status === 'succeeded' ? 0 : 1
  },
}

registerMigrateCommand(migrateRepairStimuli)
