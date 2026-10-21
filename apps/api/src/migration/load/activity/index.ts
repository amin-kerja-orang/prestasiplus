/**
 * BE-29 `migrate:activity`: ETL of the catalogue, wallets, practice and exam history, content and operations
 * from `staging_cloud` (and, for the snapshot join, `archive_cloud`) into the v2 tables. It runs after
 * `migrate:core`, whose `etl_id_map` entries it resolves parents from.
 *
 * Entry points: `buildActivitySteps` (ordered steps of the registered groups), `planActivity` (guards, preflight,
 * steps and input hash) and `runActivity` (plan plus the kit runner). The groups live in their own files and are
 * registered in `groups.ts`; this file knows none of their steps.
 */
import type pg from 'pg'

import { ApplyGuardError, assertApplyAllowed } from '../../kit/apply-guard'
import { Runner, type AnyEntityStep, type RunReport } from '../../kit/runner'
import type { RunMode } from '../../kit/types'
import { assertNotSyntheticInProduction } from '../index'
import { ActivityContext, ACTIVITY_GROUP_NAMES, type ActivityGroup, type ActivityGroupName, type ActivityOptions } from './context'
import { ACTIVITY_GROUPS } from './groups'
import { NOT_MIGRATED_ACTIVITY, type NotMigrated } from './not-migrated'
import { activityInputHash, assertCorePreflight } from './preflight'
import { rebuildAfterResume } from './resume-report'

export { ActivityContext, ACTIVITY_GROUP_NAMES, type ActivityGroup, type ActivityGroupName, type ActivityOptions } from './context'
export { DriftCollector, writeReportFile } from './drift'
export { ACTIVITY_GROUPS } from './groups'
export { NOT_MIGRATED_ACTIVITY, type NotMigrated } from './not-migrated'
export { assertCorePreflight, PreflightError, ACTIVITY_READ_TABLES } from './preflight'

/** There is nothing to run: no group registered, or the `--group` / `--table` filter matched no step. */
export class NoActivityStepsError extends RangeError {}

const orderOf = (name: ActivityGroupName): number => ACTIVITY_GROUP_NAMES.indexOf(name)

/** The groups in the fixed run order (a stable sort: two registrations of one name keep their array order). */
export function orderedGroups(groups: readonly ActivityGroup[]): ActivityGroup[] {
  for (const g of groups) {
    if (!ACTIVITY_GROUP_NAMES.includes(g.name)) throw new RangeError(`Unknown activity group "${String(g.name)}".`)
  }
  return groups
    .map((g, i) => ({ g, i }))
    .sort((x, y) => orderOf(x.g.name) - orderOf(y.g.name) || x.i - y.i)
    .map((x) => x.g)
}

/**
 * The ordered entity steps: groups in the fixed order, each group's steps in its own order. `only` keeps the
 * steps whose entity name is listed (an unknown name is an error, so a typo never runs nothing quietly).
 */
export function buildActivitySteps(a: ActivityContext, groups: readonly ActivityGroup[], only?: readonly string[]): AnyEntityStep[] {
  const all = orderedGroups(groups).flatMap((g) => g.steps(a))
  const names = all.map((s) => s.entity)
  const repeated = names.find((n, i) => names.indexOf(n) !== i)
  if (repeated !== undefined) throw new RangeError(`Entity "${repeated}" is registered by two steps.`)
  if (only === undefined || only.length === 0) return all
  const unknown = only.filter((n) => !names.includes(n))
  if (unknown.length > 0) {
    throw new RangeError(`Unknown --table value(s): ${unknown.join(', ')}. Known: ${names.join(', ') || '(none registered)'}.`)
  }
  return all.filter((s) => only.includes(s.entity))
}

/** The built-in list plus each group's own, without repeats, in print order. */
export function notMigratedOf(groups: readonly ActivityGroup[]): NotMigrated[] {
  const out: NotMigrated[] = [...NOT_MIGRATED_ACTIVITY]
  for (const g of orderedGroups(groups)) {
    for (const n of g.notMigrated) if (!out.some((o) => o.table === n.table)) out.push(n)
  }
  return out
}

export interface ActivityRunOptions extends Omit<ActivityOptions, 'pool'> {
  pool: pg.Pool
  mode: RunMode
  batchSize?: number
  gitSha?: string | null
  /** The groups to run. Default: the registry in `groups.ts`. */
  groups?: readonly ActivityGroup[]
  /** `--group`: run only these groups. */
  groupNames?: readonly string[]
  /** `--table`: run only these entities. */
  only?: readonly string[]
  /** The `--as-of` that `migrate:core` ran with, when it differs from that run's own date. */
  coreAsOf?: string
  /** Test seam: wrap or replace the built steps (e.g. to inject a failure after batch N). */
  transformSteps?: (steps: AnyEntityStep[]) => AnyEntityStep[]
}

export interface ActivityPlan {
  activity: ActivityContext
  steps: AnyEntityStep[]
  inputHash: string
  notMigrated: NotMigrated[]
}

/**
 * Everything before the first row is read: the apply guard, the synthetic-data guard, the BE-28 preflight, the
 * steps and the input hash. Throws `ApplyGuardError` (guards, preflight) or `NoActivityStepsError`.
 */
export async function planActivity(options: ActivityRunOptions): Promise<ActivityPlan> {
  const { mode, batchSize: _batchSize, gitSha: _gitSha, groups, groupNames, only, coreAsOf, transformSteps, ...activityOptions } = options
  void _batchSize
  void _gitSha
  // The same guard the Runner applies; checking it first means a refused apply never reaches the database work.
  if (mode === 'apply') await assertApplyAllowed(options.pool, options.env)
  await assertNotSyntheticInProduction(options.pool, options.env)
  await assertCorePreflight({ pool: options.pool, env: options.env, source: options.source, asOf: options.asOf, coreAsOf })

  const activity = new ActivityContext(activityOptions)
  const wanted = groupNames === undefined || groupNames.length === 0 ? undefined : groupNames
  if (wanted) {
    const bad = wanted.filter((n) => !(ACTIVITY_GROUP_NAMES as readonly string[]).includes(n))
    if (bad.length > 0) throw new ApplyGuardError(`Unknown --group value(s): ${bad.join(', ')}. Known: ${ACTIVITY_GROUP_NAMES.join(', ')}.`)
  }
  const registry = groups ?? ACTIVITY_GROUPS
  const chosen = wanted ? registry.filter((g) => wanted.includes(g.name)) : registry
  let steps = buildActivitySteps(activity, chosen, only)
  if (transformSteps) steps = transformSteps(steps)
  if (steps.length === 0) throw new NoActivityStepsError('No activity steps to run: no group is registered, or the --group / --table filter matched nothing.')

  const extraTables = chosen.flatMap((g) => g.reads ?? [])
  const inputHash = await activityInputHash({
    pool: options.pool,
    source: options.source,
    asOf: options.asOf,
    stepNames: steps.map((s) => s.entity),
    extraTables,
    contentOwnerUserId: options.contentOwnerUserId,
  })
  return { activity, steps, inputHash, notMigrated: notMigratedOf(chosen) }
}

export interface ActivityRunResult {
  report: RunReport
  activity: ActivityContext
  notMigrated: NotMigrated[]
}

/** Runs the whole command through the kit runner (dry-run by default; apply needs a passing dry-run on the same input). */
export async function runActivity(options: ActivityRunOptions): Promise<ActivityRunResult> {
  const plan = await planActivity(options)
  const runner = new Runner({ pool: options.pool, env: options.env })
  const report = await runner.run({
    mode: options.mode,
    steps: plan.steps,
    inputHash: plan.inputHash,
    gitSha: options.gitSha,
    batchSize: options.batchSize,
  })
  // A resumed apply skipped the checkpointed batches, so the in-memory drift and notes cover only the resumed part.
  if (report.mode === 'apply' && report.resumedBatches > 0) {
    await rebuildAfterResume(plan.activity, options.pool, report.runId, plan.steps.map((s) => s.entity))
  }
  return { report, activity: plan.activity, notMigrated: plan.notMigrated }
}
