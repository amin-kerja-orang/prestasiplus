/**
 * The `migrate:questions` command (QLOAD). Registers itself with the kit CLI on import.
 *
 *   npm run migrate:questions -w @pp/api -- [--dry-run | --apply] [--as-of=YYYY-MM-DD] [--core-as-of=YYYY-MM-DD] [--batch-size=N] [--out-dir=<.migration-out path>]
 *                                           [--plan-file=<rajah-plan-*.ndjson of a --plan run>]
 *   npm run migrate:questions -w @pp/api -- --plan [--as-of=..] [--core-as-of=..] [--batch-size=N] [--out-dir=..]       (read-only planner)
 *
 * Run AFTER `migrate:all` (needs `migrate:core --apply` on the same staged data). Environment: DATABASE_URL (the v2 database that
 * also holds archive_cloud), for --apply PP_ALLOW_MIGRATE_APPLY=1 (and in production PP_MIGRATE_TARGET_DB). It reads only the archive.
 * Output is counts and ids only, never a question text: the report JSON, `rajah-plan-<run>.ndjson` (the plan: ids, tiers, signals) and
 * `rejects-questions-<run>.csv` (the quarantine: ids, V2 status, subject and level codes, reason, cause). `--plan-file` makes the run
 * refuse when its own plan differs from the one that was reviewed (the plan hash, which includes the staged data).
 */
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { mytDay, SystemClock, type Clock } from '../../../db/clock'
import { registerMigrateCommand, withSourceLock, type CliContext, type CommandArgs, type MigrateCommand } from '../../kit'
import { ApplyGuardError } from '../../kit/apply-guard'
import { resolveGitSha } from '../git-sha'
import { prepareOutputDir, ProfileOutputError } from '../../profile'
import { eligibleGuard, invariantOf, planInputHash, QUESTIONS_RULES_VERSION, runPlan, runQuestions } from './index'
import { filesMissingCsv } from './files-step'
import { planFileLines, PLAN_RULES_VERSION } from './plan'
import { quarantineCsv, quarantineRows } from './repairs'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const KNOWN_FLAGS: ReadonlySet<string> = new Set(['as-of', 'core-as-of', 'batch-size', 'out-dir', 'plan', 'plan-file', 'files-dir'])

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
  /** `--plan`: only build and write the rajah plan. */
  plan: boolean
  planFile?: string
  /** `--files-dir`: the V2 storage export; the picture pass runs only with it. */
  filesDir?: string
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
  const plan = args.flags.get('plan') === true
  if (args.flags.has('plan') && !plan) throw new ApplyGuardError('--plan takes no value.')
  if (plan && args.mode === 'apply') throw new ApplyGuardError('--plan is read-only: do not combine it with --apply.')
  const planFile = flagValue(args, 'plan-file')
  if (plan && planFile !== undefined) throw new ApplyGuardError('--plan-file belongs to a --dry-run or --apply run, not to --plan.')
  const filesDir = flagValue(args, 'files-dir')
  if (plan && filesDir !== undefined) throw new ApplyGuardError('--files-dir belongs to a --dry-run or --apply run, not to --plan.')
  return { asOf, coreAsOf, batchSize, outDir: outDirOf(args, prepare), plan, ...(planFile === undefined ? {} : { planFile }), ...(filesDir === undefined ? {} : { filesDir }) }
}

export const defaultAsOf = (clock: Clock = new SystemClock()): string => mytDay(clock.now())

export const migrateQuestions: MigrateCommand = {
  name: 'migrate:questions',
  summary: 'loads the .cloud MCQs of every status from archive_cloud into the v2 question bank with rajah groups, after migrate:all (dry-run by default; --plan writes the rajah plan only)',
  async run(args: CommandArgs, ctx: CliContext): Promise<number> {
    const { asOf, coreAsOf, batchSize, outDir, plan: planOnly, planFile, filesDir } = parseQuestionsArgs(args)

    if (planOnly) {
      const { plan, inputHash } = await runPlan({ pool: ctx.pool, env: ctx.env, source: 'cloud', asOf, coreAsOf, pageSize: batchSize })
      const file = join(outDir, `rajah-plan-${plan.plan.hash.slice(0, 12)}-${randomBytes(3).toString('hex')}.ndjson`)
      writeFileSync(file, `${planFileLines(plan.plan, { rules: QUESTIONS_RULES_VERSION, inputHash }).join('\n')}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
      ctx.out(`migrate:questions --plan: ${plan.rows} question row(s) planned, plan hash ${plan.plan.hash.slice(0, 12)}`)
      ctx.out(`plan summary: ${JSON.stringify(plan.plan.summary)}`)
      if (plan.canonical.unsupportedKinds > 0) ctx.out(`note: ${plan.canonical.unsupportedKinds} canonical stimulus kind(s) have no V3 kind and are not grouped`)
      ctx.out(`plan: ${file}`)
      return 0
    }
    const expectedPlanHash = planFile === undefined ? undefined : planHashOf(planFile)

    const { report, questions, plan, postLoad } = await withSourceLock(ctx.pool, 'cloud', () =>
      runQuestions({ pool: ctx.pool, env: ctx.env, source: 'cloud', asOf, coreAsOf, mode: args.mode, batchSize, gitSha: resolveGitSha(ctx.env), progress: ctx.out, expectedPlanHash, filesDir }),
    )
    ctx.out(`migrate:questions ${report.mode}: run ${report.runId} ${report.status}`)
    ctx.out('entity | source | eligible | loaded | rejected | status')
    for (const r of report.recon) ctx.out(`${r.entity} | ${r.sourceCount} | ${r.eligibleCount} | ${r.loaded} | ${r.rejected} | ${r.status}`)
    const notes = [...questions.notes.counters].sort(([a], [b]) => (a < b ? -1 : 1))
    for (const [name, n] of notes) ctx.out(`note ${name}: ${n}`)
    const rejects = await ctx.pool.query<{ reason: string; column_name: string | null; n: number }>(
      `SELECT reason, column_name, count(*)::int AS n FROM etl_rejects WHERE run_id = $1 GROUP BY reason, column_name ORDER BY reason, column_name`,
      [report.runId],
    )
    const suffix = `${report.mode}-${report.runId}-${randomBytes(3).toString('hex')}`
    const invariant = invariantOf(report, plan.plan.absorbed.size)
    const file = join(outDir, `questions-${suffix}.json`)
    // Counts only: no question text, no row, no id.
    writeFileSync(
      file,
      `${JSON.stringify({ command: 'migrate:questions', runId: report.runId, mode: report.mode, status: report.status, asOf, recon: report.recon, counters: report.counters, resumedBatches: report.resumedBatches, notes: Object.fromEntries(notes), rejects: rejects.rows.map((r) => ({ reason: r.reason, cause: r.column_name, count: r.n })), invariant, plan: plan.plan.summary, planHash: plan.plan.hash, postLoad }, null, 2)}\n`,
      { encoding: 'utf8', mode: 0o600, flag: 'wx' },
    )
    ctx.out(`report: ${file}`)
    // The plan this run followed (ids, tiers, signals) and the quarantine (ids and codes): the PO reviews both.
    const inputHash = await planInputHash(ctx.pool, 'cloud', plan.plan.hash)
    const planOut = join(outDir, `rajah-plan-${suffix}.ndjson`)
    writeFileSync(planOut, `${planFileLines(plan.plan, { rules: `${QUESTIONS_RULES_VERSION}/${PLAN_RULES_VERSION}`, inputHash }).join('\n')}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    ctx.out(`rajah plan: ${planOut}`)
    const quarantine = await quarantineRows(ctx.pool, report.runId)
    const csvOut = join(outDir, `rejects-questions-${suffix}.csv`)
    writeFileSync(csvOut, quarantineCsv(quarantine), { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    ctx.out(`quarantine: ${quarantine.length} row(s): ${csvOut}`)
    if (filesDir !== undefined) {
      const missingOut = join(outDir, `files-missing-${suffix}.csv`)
      writeFileSync(missingOut, filesMissingCsv(questions.fileFailures), { encoding: 'utf8', mode: 0o600, flag: 'wx' })
      ctx.out(`pictures: ${questions.fileFailures.length} path(s) not usable: ${missingOut}`)
    }
    if (invariant !== null) {
      ctx.out(`invariant: V2 total ${invariant.v2Total} = loaded ${invariant.loaded} + absorbed ${invariant.absorbed} + quarantined ${invariant.quarantined} + other loader ${invariant.otherOwner}: ${invariant.ok ? 'ok' : 'MISMATCH'}`)
      if (!invariant.ok) {
        ctx.err('migrate:questions FAILED: the V2 total does not equal loaded + absorbed + quarantined.')
        return 1
      }
    }
    ctx.out(`rajah plan summary: ${JSON.stringify(plan.plan.summary)}`)
    const guard = eligibleGuard(report)
    if (guard !== null) {
      ctx.err(`migrate:questions FAILED: ${guard}`)
      return 1
    }
    return report.status === 'succeeded' ? 0 : 1
  },
}

/** The plan hash recorded in the first line of a `rajah-plan-*.ndjson` file. */
export function planHashOf(file: string): string {
  const first = readFileSync(file, 'utf8').split('\n', 1)[0] ?? ''
  try {
    const meta = JSON.parse(first) as { t?: string; planHash?: string }
    if (meta.t === 'meta' && typeof meta.planHash === 'string' && /^[0-9a-f]{64}$/.test(meta.planHash)) return meta.planHash
  } catch {
    // falls through
  }
  throw new ApplyGuardError('--plan-file is not a rajah plan file written by this command.')
}

registerMigrateCommand(migrateQuestions)
