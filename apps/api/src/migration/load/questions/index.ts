/**
 * QLOAD `migrate:questions`: copies the .cloud MCQs of every V2 status from `archive_cloud` into the v2 question bank (T-B9: approved are
 * live, archived and draft keep their status), repairs the rajah defect with stimulus groups from the deterministic plan, and quarantines
 * what cannot be represented (never guessed). Runs AFTER `migrate:all` (needs the `migrate:core` id maps). Entry points:
 * `buildQuestionsSteps`, `runQuestions` (guards, preflight, input hash incl. the plan hash, the kit runner, post-load) and `runPlan`
 * (the read-only planner behind `--plan`).
 */
import type pg from 'pg'

import { assertApplyAllowed } from '../../kit/apply-guard'
import { hashInput } from '../../kit/sql'
import { Runner, type AnyEntityStep, type RunReport } from '../../kit/runner'
import type { RunMode } from '../../kit/types'
import { assertNotSyntheticInProduction } from '../index'
import { coreMapCounts, PreflightError, tableFingerprints } from '../activity/preflight'
import { QuestionsContext, type QuestionsOptions } from './context'
import { assertQuestionsPreflight } from './preflight'
import { type BuiltPlan } from './plan-source'
import { runPostLoad, type PostLoadResult } from './post-load'
import { filesStep, QUESTION_IMAGE_ETL_CAP } from './files-step'
import { openMigrationFiles } from '../activity/files'
import { groupsStep, questionsStep, stimuliStep } from './steps'

export { QuestionsContext, type QuestionsOptions } from './context'
export { assertQuestionsPreflight } from './preflight'

/** Bump when a rule of the transform changes what a run writes (it is part of the input hash). */
export const QUESTIONS_RULES_VERSION = 'qload-3'

export function buildQuestionsSteps(q: QuestionsContext): AnyEntityStep[] {
  return [questionsStep(q), stimuliStep(q), groupsStep(q), ...(q.files === undefined ? [] : [filesStep(q, q.files)])]
}

/** md5 of the CONTENT of the curriculum id maps the loader reads, so a `migrate:core` re-run between dry-run and apply changes the input hash. */
export async function curriculumMapHash(pool: Pick<pg.Pool, 'query'>, source: string): Promise<string> {
  const res = await pool.query<{ h: string }>(
    `SELECT md5(coalesce(string_agg(entity || ':' || legacy_id || '>' || new_id, ',' ORDER BY entity, legacy_id), '')) AS h
       FROM etl_id_map WHERE legacy_source = $1 AND entity IN ('subjects', 'education_levels', 'chapters', 'topics')`,
    [source],
  )
  return res.rows[0]?.h ?? ''
}

/** A message when the archive has rows but none is eligible (every row another loader's type or an absorbed carrier: a mis-staged archive); else null. */
export function eligibleGuard(report: Pick<RunReport, 'recon'>): string | null {
  const r = report.recon.find((x) => x.entity === 'questions')
  if (r !== undefined && r.sourceCount > 0 && r.eligibleCount === 0) {
    return `eligible = 0 of ${r.sourceCount} archive question(s): no row is a question of this loader (an MCQ of any status). Check the excluded.type.* counters and the staging of archive_cloud before going on.`
  }
  return null
}

export interface Invariant {
  /** Every archive question row. */
  v2Total: number
  loaded: number
  /** Rajah carrier rows turned into stimuli (never questions). */
  absorbed: number
  /** Rejects kept with their cause (the quarantine CSV). */
  quarantined: number
  /** Rows of another loader's type (subjective: T-B9-6). */
  otherOwner: number
  ok: boolean
}

/** "V2 total = loaded + absorbed + quarantined (+ the types another loader owns)": zero silent loss (design 5.1, V-2). */
export function invariantOf(report: Pick<RunReport, 'recon'>, absorbed: number): Invariant | null {
  const r = report.recon.find((x) => x.entity === 'questions')
  if (r === undefined) return null
  const excluded = r.sourceCount - r.eligibleCount
  const otherOwner = excluded - absorbed
  return { v2Total: r.sourceCount, loaded: r.loaded, absorbed, quarantined: r.rejected, otherOwner, ok: otherOwner >= 0 && r.sourceCount === r.loaded + absorbed + r.rejected + otherOwner }
}

export interface QuestionsRunOptions extends Omit<QuestionsOptions, 'pool'> {
  pool: pg.Pool
  mode: RunMode
  batchSize?: number
  gitSha?: string | null
  coreAsOf?: string
  /** The plan hash of a reviewed `--plan` run: the run refuses (before any write) when its own plan differs. */
  expectedPlanHash?: string
  /** `--files-dir`: the V2 storage export (with SHA256SUMS). Absent: no picture is copied and pictured questions stay held (design 8.3). */
  filesDir?: string
}

export interface QuestionsRunResult {
  report: RunReport
  questions: QuestionsContext
  plan: BuiltPlan
  postLoad: PostLoadResult | null
}

const PLAN_TABLES = ['archive_cloud.questions', 'archive_cloud.question_options', 'archive_cloud.question_stimulus', 'archive_cloud.legacy_canonical_map', 'archive_cloud.stimuli', 'archive_cloud.media_assets']

/** Hash of what the plan was built from (the staged question tables, the curriculum maps and the plan itself); the plan file carries it. */
export async function planInputHash(pool: pg.Pool, source: string, planHash: string): Promise<string> {
  return hashInput([...(await tableFingerprints(pool, PLAN_TABLES)), `curriculum-map=${await curriculumMapHash(pool, source)}`, `plan=${planHash}`])
}

/** The read-only planner (`--plan`): reads the archive and returns the rajah plan; writes nothing. */
export async function runPlan(options: { pool: pg.Pool; env: Readonly<Record<string, string | undefined>>; source: QuestionsOptions['source']; asOf: string; coreAsOf?: string; pageSize?: number }): Promise<{ questions: QuestionsContext; plan: BuiltPlan; inputHash: string }> {
  await assertNotSyntheticInProduction(options.pool, options.env)
  await assertQuestionsPreflight({ pool: options.pool, env: options.env, source: options.source, asOf: options.asOf, coreAsOf: options.coreAsOf })
  const questions = new QuestionsContext({ pool: options.pool, env: options.env, source: options.source, asOf: options.asOf, pageSize: options.pageSize })
  const plan = await questions.plan()
  return { questions, plan, inputHash: await planInputHash(options.pool, options.source, plan.plan.hash) }
}

export async function runQuestions(options: QuestionsRunOptions): Promise<QuestionsRunResult> {
  const { mode, batchSize, gitSha, coreAsOf, expectedPlanHash, filesDir, ...rest } = options
  if (mode === 'apply') await assertApplyAllowed(options.pool, options.env)
  await assertNotSyntheticInProduction(options.pool, options.env)
  await assertQuestionsPreflight({ pool: options.pool, env: options.env, source: options.source, asOf: options.asOf, coreAsOf })
  // One page = one batch: the keyset page and the runner's batch stay aligned.
  const questions = new QuestionsContext({ ...rest, pageSize: rest.pageSize ?? batchSize })
  if (filesDir !== undefined) {
    questions.files = await openMigrationFiles({ dir: filesDir, env: options.env, mode, source: options.source, capOverrides: { question_image: QUESTION_IMAGE_ETL_CAP } })
  }
  const steps = buildQuestionsSteps(questions)
  // The plan is part of the input: an apply is refused (no matching dry-run) when the staged data, the curriculum or the planner rules changed.
  const built = await questions.plan()
  if (expectedPlanHash !== undefined && expectedPlanHash !== built.plan.hash) {
    throw new PreflightError(`Refusing to run: the plan of this run (${built.plan.hash.slice(0, 12)}) differs from the reviewed plan file (${expectedPlanHash.slice(0, 12)}): the staged data, the curriculum or the planner rules changed. Run --plan again and review it.`)
  }
  const inputHash = hashInput([
    ...(await tableFingerprints(options.pool, PLAN_TABLES)),
    `plan=${built.plan.hash}`,
    `source=${options.source}`,
    `steps=${steps.map((s) => s.entity).join(',')}`,
    `core-map=${await coreMapCounts(options.pool, options.source)}`,
    `curriculum-map=${await curriculumMapHash(options.pool, options.source)}`,
    `rules=${QUESTIONS_RULES_VERSION}`,
    `files=${questions.files?.manifestHash ?? 'none'}`,
  ])
  const runner = new Runner({ pool: options.pool, env: options.env })
  const report = await runner.run({ mode, steps, inputHash, gitSha, batchSize })
  let postLoad: PostLoadResult | null = null
  if (mode === 'apply') {
    await analyseLoadedTables(options.pool, options.progress)
    if (report.status === 'succeeded') postLoad = await runPostLoad(options.pool, options.source, options.progress)
  }
  return { report, questions, plan: built, postLoad }
}

/** Tables that a bulk load fills; without fresh statistics the draw and shape queries plan as nested loops. */
export const ANALYSED_TABLES: readonly string[] = ['questions', 'question_versions', 'question_parts', 'part_options', 'answer_keys', 'question_tags', 'stimuli', 'stimulus_groups', 'stimulus_group_stimuli', 'question_version_stimuli', 'etl_id_map']

/** ANALYZE after the last batch has committed (outside every batch transaction). A failure is a warning, never a failed run. */
export async function analyseLoadedTables(pool: pg.Pool, out?: (line: string) => void): Promise<void> {
  try {
    for (const t of ANALYSED_TABLES) await pool.query(`ANALYZE "${t}"`)
    out?.(`analyzed ${ANALYSED_TABLES.length} tables: ${ANALYSED_TABLES.join(', ')}`)
  } catch (e) {
    out?.(`warning: ANALYZE failed (${e instanceof Error ? e.name : 'error'}); run ANALYZE on ${ANALYSED_TABLES.join(', ')} by hand`)
  }
}
