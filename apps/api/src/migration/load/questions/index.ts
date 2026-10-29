/**
 * QLOAD `migrate:questions`: copies the approved .cloud MCQs from `archive_cloud` into the v2 question bank (published, live,
 * active, single-part MCQs). Runs AFTER `migrate:all` (needs the `migrate:core` id maps). Entry points: `buildQuestionsSteps`
 * and `runQuestions` (guards, preflight, input hash, the kit runner).
 */
import type pg from 'pg'

import { assertApplyAllowed } from '../../kit/apply-guard'
import { hashInput } from '../../kit/sql'
import { Runner, type AnyEntityStep, type RunReport } from '../../kit/runner'
import type { RunMode } from '../../kit/types'
import { assertNotSyntheticInProduction } from '../index'
import { coreMapCounts, tableFingerprints } from '../activity/preflight'
import { QuestionsContext, type QuestionsOptions } from './context'
import { assertQuestionsPreflight } from './preflight'
import { questionsStep } from './steps'

export { QuestionsContext, type QuestionsOptions } from './context'
export { assertQuestionsPreflight } from './preflight'

/** Bump when a rule of the transform changes what a run writes (it is part of the input hash). */
export const QUESTIONS_RULES_VERSION = 'qload-2'

export function buildQuestionsSteps(q: QuestionsContext): AnyEntityStep[] {
  return [questionsStep(q)]
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

/** A message when the archive has rows but none is eligible (a wrong status or type code, or a mis-staged archive); else null. */
export function eligibleGuard(report: Pick<RunReport, 'recon'>): string | null {
  const r = report.recon.find((x) => x.entity === 'questions')
  if (r !== undefined && r.sourceCount > 0 && r.eligibleCount === 0) {
    return `eligible = 0 of ${r.sourceCount} archive question(s): no row is approved (status diluluskan) and an MCQ. Check the excluded.status.* and excluded.type.* counters and the staging of archive_cloud before going on.`
  }
  return null
}

/**
 * A warning (never a failure) when loaded questions carry no chapter: their archive row has neither `chapter_id` nor `topic_id`
 * (`chapter_missing`), or has one that the core id maps do not know (`chapter_unmapped`). Such a question serves every subject
 * and level draw, but chapter-mode practice, a chapter mission and the chapter heatmap never offer it. Counts only. Null when
 * every new question has a chapter (or nothing was inserted, as on a no-op re-run).
 */
export function chapterCoverageWarning(report: Pick<RunReport, 'recon'>, counters: ReadonlyMap<string, number>): string | null {
  const missing = counters.get('questions.chapter_missing') ?? 0
  const unmapped = counters.get('questions.chapter_unmapped') ?? 0
  if (missing + unmapped === 0) return null
  const loaded = report.recon.find((x) => x.entity === 'questions')?.loaded ?? 0
  return (
    `${missing + unmapped} of ${loaded} new question(s) have no chapter (chapter_missing ${missing}: the archive row has no chapter_id and no topic_id; ` +
    `chapter_unmapped ${unmapped}: its chapter_id is not in the migrate:core id map). They serve subject and level draws only: chapter-mode practice, ` +
    'chapter missions and the chapter heatmap do not offer them. If staging:load warned "Table questions: the input carries no column chapter_id" ' +
    'the dump omitted the column (re-run dump:grants and re-stage); otherwise .cloud holds no chapter for them (runbook section 12, migrate:questions).'
  )
}

export interface QuestionsRunOptions extends Omit<QuestionsOptions, 'pool'> {
  pool: pg.Pool
  mode: RunMode
  batchSize?: number
  gitSha?: string | null
  coreAsOf?: string
}

export interface QuestionsRunResult {
  report: RunReport
  questions: QuestionsContext
}

export async function runQuestions(options: QuestionsRunOptions): Promise<QuestionsRunResult> {
  const { mode, batchSize, gitSha, coreAsOf, ...rest } = options
  if (mode === 'apply') await assertApplyAllowed(options.pool, options.env)
  await assertNotSyntheticInProduction(options.pool, options.env)
  await assertQuestionsPreflight({ pool: options.pool, env: options.env, source: options.source, asOf: options.asOf, coreAsOf })
  // One page = one batch: the keyset page and the runner's batch stay aligned.
  const questions = new QuestionsContext({ ...rest, pageSize: rest.pageSize ?? batchSize })
  const steps = buildQuestionsSteps(questions)
  const inputHash = hashInput([
    ...(await tableFingerprints(options.pool, ['archive_cloud.questions', 'archive_cloud.question_options'])),
    `source=${options.source}`,
    `steps=${steps.map((s) => s.entity).join(',')}`,
    `core-map=${await coreMapCounts(options.pool, options.source)}`,
    `curriculum-map=${await curriculumMapHash(options.pool, options.source)}`,
    `rules=${QUESTIONS_RULES_VERSION}`,
  ])
  const runner = new Runner({ pool: options.pool, env: options.env })
  const report = await runner.run({ mode, steps, inputHash, gitSha, batchSize })
  if (mode === 'apply') await analyseLoadedTables(options.pool, options.progress)
  return { report, questions }
}

/** Tables that a bulk load fills; without fresh statistics the draw and shape queries plan as nested loops. */
export const ANALYSED_TABLES: readonly string[] = ['questions', 'question_versions', 'question_parts', 'part_options', 'answer_keys', 'question_tags', 'etl_id_map']

/** ANALYZE after the last batch has committed (outside every batch transaction). A failure is a warning, never a failed run. */
export async function analyseLoadedTables(pool: pg.Pool, out?: (line: string) => void): Promise<void> {
  try {
    for (const t of ANALYSED_TABLES) await pool.query(`ANALYZE "${t}"`)
    out?.(`analyzed ${ANALYSED_TABLES.length} tables: ${ANALYSED_TABLES.join(', ')}`)
  } catch (e) {
    out?.(`warning: ANALYZE failed (${e instanceof Error ? e.name : 'error'}); run ANALYZE on ${ANALYSED_TABLES.join(', ')} by hand`)
  }
}
