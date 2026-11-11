/**
 * The `migrate:papers` command (T-B10). Registers itself with the kit CLI on import.
 *
 *   npx tsx src/migration/load/papers/cli.ts -- [--dry-run | --apply] [--files-dir=<export dir outside the repo>] [--as-of=YYYY-MM-DD] [--core-as-of=YYYY-MM-DD] [--batch-size=N] [--out-dir=<.migration-out path>]
 *
 * Run AFTER `migrate:all`, `migrate:questions` and `migrate:structured`. The Terbit pass (publishing the V2-published papers through the real gate) is the separate
 * command `migrate:terbit` (`terbit-command.ts`): it needs the decorator metadata of the API build, so it runs with node from `dist/migrate-terbit.js`, not tsx. Environment: DATABASE_URL, for --apply
 * PP_ALLOW_MIGRATE_APPLY=1; `--files-dir` (a read-only export of the V2 storage with a SHA256SUMS, as `migrate:activity`) lets the Kertas Subjektif
 * document pages load (without it the pages are skipped and counted; FILE_STORAGE_DIR is needed for --apply). Counts and ids only in the output.
 */
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { mytDay, SystemClock } from '../../../db/clock'
import { registerMigrateCommand, withSourceLock, type CliContext, type CommandArgs, type MigrateCommand } from '../../kit'
import { ApplyGuardError } from '../../kit/apply-guard'
import { prepareOutputDir, ProfileOutputError } from '../../profile'
import { resolveGitSha } from '../git-sha'
import { runPapers } from './index'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const KNOWN_FLAGS: ReadonlySet<string> = new Set(['as-of', 'core-as-of', 'batch-size', 'out-dir', 'files-dir', 'recompute'])

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

/** `--recompute` is a bare switch: any value (`--recompute=false`, `--recompute false`) is refused, never read as "off". */
function recomputeFlag(args: CommandArgs): boolean {
  const v = args.flags.get('recompute')
  if (v === undefined) return false
  if (v !== true) throw new ApplyGuardError('--recompute takes no value: pass it bare to turn it on, or leave it out.')
  return true
}

export interface PapersArgs {
  asOf: string
  coreAsOf?: string
  batchSize?: number
  outDir: string
  filesDir?: string
  /** `--recompute` or `PP_MIGRATE_PAPERS_RECOMPUTE=1`: re-run the plan over existing papers (default OFF). */
  recompute: boolean
}

export function parsePapersArgs(args: CommandArgs, prepare: (dir: string) => string = prepareOutputDir, env: Readonly<Record<string, string | undefined>> = process.env): PapersArgs {
  if (args.flags.has('terbit')) throw new ApplyGuardError('--terbit moved: run migrate:terbit (node dist/migrate-terbit.js) after migrate:papers --apply.')
  for (const name of args.flags.keys()) if (!KNOWN_FLAGS.has(name)) throw new ApplyGuardError(`unknown flag --${name}.`)
  if (args.positional.length > 0) throw new ApplyGuardError('unexpected argument: this command takes flags only (--name=value).')
  const sizeText = flagValue(args, 'batch-size')
  const batchSize = sizeText === undefined ? undefined : Number(sizeText)
  if (batchSize !== undefined && (!Number.isInteger(batchSize) || batchSize < 1)) throw new ApplyGuardError('--batch-size must be a positive integer.')
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
  return { asOf: date('as-of', flagValue(args, 'as-of')) ?? mytDay(new SystemClock().now()), coreAsOf: date('core-as-of', flagValue(args, 'core-as-of')), batchSize, outDir, filesDir, recompute: recomputeFlag(args) || env.PP_MIGRATE_PAPERS_RECOMPUTE === '1' }
}

export const migratePapers: MigrateCommand = {
  name: 'migrate:papers',
  summary: 'loads the V2 SPM sets, blueprints and papers from archive_cloud (after migrate:questions and migrate:structured; the Terbit pass is migrate:terbit; dry-run by default)',
  async run(args: CommandArgs, ctx: CliContext): Promise<number> {
    const { asOf, coreAsOf, batchSize, outDir, filesDir, recompute } = parsePapersArgs(args, undefined, ctx.env)
    const { report, questions } = await withSourceLock(ctx.pool, 'cloud', () =>
      runPapers({ pool: ctx.pool, env: ctx.env, source: 'cloud', asOf, coreAsOf, mode: args.mode, batchSize, filesDir, recompute, gitSha: resolveGitSha(ctx.env), progress: ctx.out }),
    )
    ctx.out(`migrate:papers ${report.mode}: run ${report.runId} ${report.status}`)
    ctx.out('entity | source | eligible | loaded | rejected | status')
    for (const r of report.recon) ctx.out(`${r.entity} | ${r.sourceCount} | ${r.eligibleCount} | ${r.loaded} | ${r.rejected} | ${r.status}`)
    const notes = [...questions.notes.counters].sort(([a], [b]) => (a < b ? -1 : 1))
    for (const [name, n] of notes) ctx.out(`note ${name}: ${n}`)
    const stamp = `${report.runId}-${randomBytes(3).toString('hex')}`
    const file = join(outDir, `papers-${report.mode}-${stamp}.json`)
    writeFileSync(
      file,
      `${JSON.stringify({ command: 'migrate:papers', runId: report.runId, mode: report.mode, status: report.status, asOf, recon: report.recon, counters: report.counters, notes: Object.fromEntries(notes), repointed: questions.notes.ids.get('papers.repointed') ?? [], skippedWithAttempts: questions.notes.ids.get('papers.recompute_skipped_attempts') ?? [] }, null, 2)}\n`,
      { encoding: 'utf8', mode: 0o600, flag: 'wx' },
    )
    ctx.out(`report: ${file}`)
    return report.status === 'succeeded' ? 0 : 1
  },
}

registerMigrateCommand(migratePapers)
