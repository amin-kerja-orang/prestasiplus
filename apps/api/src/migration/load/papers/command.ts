/**
 * The `migrate:papers` command (T-B10). Registers itself with the kit CLI on import.
 *
 *   npx tsx src/migration/load/papers/cli.ts -- [--dry-run | --apply] [--terbit] [--files-dir=<export dir outside the repo>] [--as-of=YYYY-MM-DD] [--core-as-of=YYYY-MM-DD] [--batch-size=N] [--out-dir=<.migration-out path>]
 *
 * Run AFTER `migrate:all`, `migrate:questions` and `migrate:structured`. `--terbit` (with `--apply` only) runs the Terbit pass through
 * the real publish gate for the V2-published papers and writes `papers-terbit-<run>.csv`. Environment: DATABASE_URL, for --apply
 * PP_ALLOW_MIGRATE_APPLY=1; `--files-dir` (a read-only export of the V2 storage with a SHA256SUMS, as `migrate:activity`) lets the Kertas Subjektif
 * document pages load (without it the pages are skipped and counted; FILE_STORAGE_DIR is needed for --apply); `--terbit` also needs the API's own env (SESSION_SECRET ...). Counts and ids only in the output.
 */
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { mytDay, SystemClock } from '../../../db/clock'
import { registerMigrateCommand, withSourceLock, type CliContext, type CommandArgs, type MigrateCommand } from '../../kit'
import { ApplyGuardError } from '../../kit/apply-guard'
import { prepareOutputDir, ProfileOutputError } from '../../profile'
import { resolveGitSha } from '../git-sha'
import { runPapers, runTerbitPass, terbitCsv } from './index'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const KNOWN_FLAGS: ReadonlySet<string> = new Set(['as-of', 'core-as-of', 'batch-size', 'out-dir', 'terbit', 'files-dir'])

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

export interface PapersArgs {
  asOf: string
  coreAsOf?: string
  batchSize?: number
  outDir: string
  terbit: boolean
  filesDir?: string
}

export function parsePapersArgs(args: CommandArgs, prepare: (dir: string) => string = prepareOutputDir): PapersArgs {
  for (const name of args.flags.keys()) if (!KNOWN_FLAGS.has(name)) throw new ApplyGuardError(`unknown flag --${name}.`)
  if (args.positional.length > 0) throw new ApplyGuardError('unexpected argument: this command takes flags only (--name=value).')
  const sizeText = flagValue(args, 'batch-size')
  const batchSize = sizeText === undefined ? undefined : Number(sizeText)
  if (batchSize !== undefined && (!Number.isInteger(batchSize) || batchSize < 1)) throw new ApplyGuardError('--batch-size must be a positive integer.')
  const terbit = args.flags.get('terbit') === true
  if (args.flags.has('terbit') && !terbit) throw new ApplyGuardError('--terbit takes no value.')
  if (terbit && args.mode !== 'apply') throw new ApplyGuardError('--terbit needs --apply.')
  const filesDir = flagValue(args, 'files-dir')
  if (filesDir !== undefined && filesDir.trim() === '') throw new ApplyGuardError('--files-dir needs a directory.')
  const raw = flagValue(args, 'out-dir')
  let outDir: string
  try {
    outDir = prepare(raw === undefined ? resolve('.migration-out') : resolve(raw))
  } catch (e) {
    if (e instanceof ProfileOutputError) throw new ApplyGuardError(`--out-dir: ${e.message}`)
    throw e
  }
  return { asOf: date('as-of', flagValue(args, 'as-of')) ?? mytDay(new SystemClock().now()), coreAsOf: date('core-as-of', flagValue(args, 'core-as-of')), batchSize, outDir, terbit, filesDir }
}

export const migratePapers: MigrateCommand = {
  name: 'migrate:papers',
  summary: 'loads the V2 SPM sets, blueprints and papers from archive_cloud (after migrate:questions and migrate:structured; --terbit publishes through the real gate; dry-run by default)',
  async run(args: CommandArgs, ctx: CliContext): Promise<number> {
    const { asOf, coreAsOf, batchSize, outDir, terbit, filesDir } = parsePapersArgs(args)
    const { report, questions } = await withSourceLock(ctx.pool, 'cloud', () =>
      runPapers({ pool: ctx.pool, env: ctx.env, source: 'cloud', asOf, coreAsOf, mode: args.mode, batchSize, filesDir, gitSha: resolveGitSha(ctx.env), progress: ctx.out }),
    )
    ctx.out(`migrate:papers ${report.mode}: run ${report.runId} ${report.status}`)
    ctx.out('entity | source | eligible | loaded | rejected | status')
    for (const r of report.recon) ctx.out(`${r.entity} | ${r.sourceCount} | ${r.eligibleCount} | ${r.loaded} | ${r.rejected} | ${r.status}`)
    const notes = [...questions.notes.counters].sort(([a], [b]) => (a < b ? -1 : 1))
    for (const [name, n] of notes) ctx.out(`note ${name}: ${n}`)
    const stamp = `${report.runId}-${randomBytes(3).toString('hex')}`
    let terbitSummary: Record<string, number> | undefined
    if (terbit && report.status === 'succeeded') {
      const { findMigrationActor, openTerbitPublisher } = await import('./terbit-nest')
      const actor = await findMigrationActor(ctx.pool)
      if (actor === null) {
        ctx.err('migrate:papers: no Admin Pusat user exists to act as the Terbit actor; the Terbit pass was skipped.')
        return 1
      }
      const opened = await openTerbitPublisher(actor)
      try {
        const t = await runTerbitPass(ctx.pool, 'cloud', opened.publish)
        terbitSummary = { considered: t.considered, published: t.published, legacy: t.legacy, failed: t.failed, held: t.held }
        for (const [k, v] of Object.entries(terbitSummary)) ctx.out(`terbit ${k}: ${v}`)
        const csv = join(outDir, `papers-terbit-${stamp}.csv`)
        writeFileSync(csv, terbitCsv(t), { encoding: 'utf8', mode: 0o600, flag: 'wx' })
        ctx.out(`terbit report: ${csv}`)
      } finally {
        await opened.close()
      }
    }
    const file = join(outDir, `papers-${report.mode}-${stamp}.json`)
    writeFileSync(
      file,
      `${JSON.stringify({ command: 'migrate:papers', runId: report.runId, mode: report.mode, status: report.status, asOf, recon: report.recon, counters: report.counters, notes: Object.fromEntries(notes), terbit: terbitSummary ?? null }, null, 2)}\n`,
      { encoding: 'utf8', mode: 0o600, flag: 'wx' },
    )
    ctx.out(`report: ${file}`)
    return report.status === 'succeeded' ? 0 : 1
  },
}

registerMigrateCommand(migratePapers)
