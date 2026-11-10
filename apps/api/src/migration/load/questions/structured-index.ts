/**
 * `migrate:structured` (T-B9-6, T-B9-7): the structured, subjective and canonical-only question loaders as one run
 * (steps `structured_questions`, `subjective_questions`, `exam_questions`). Runs AFTER `migrate:all` and after `migrate:questions`
 * (the canonical step links stimuli that the stimulus pass put in the id map, and the dedupe against `legacy_canonical_map` assumes the
 * legacy rows are the questions). The steps are also exported so `migrate:questions` can run them in its own run
 * (`buildStructuredSteps`).
 */
import type pg from 'pg'

import { ARCHIVE_SCHEMA } from '../../ddl/spec'
import { assertApplyAllowed } from '../../kit/apply-guard'
import { hashInput } from '../../kit/sql'
import { Runner, type AnyEntityStep, type RunReport } from '../../kit/runner'
import type { RunMode } from '../../kit/types'
import { assertNotSyntheticInProduction } from '../index'
import { coreMapCounts, PreflightError, tableFingerprints } from '../activity/preflight'
import { canonicalStep } from './canonical-steps'
import { QuestionsContext, type QuestionsOptions } from './context'
import { curriculumMapHash } from './index'
import { assertQuestionsPreflight } from './preflight'
import { structuredStep, subjectiveStep } from './structured-steps'
import { STRUCTURED_RULES_VERSION } from './structured-plan'
import { CANONICAL_RULES_VERSION } from './canonical-plan'

export const STRUCTURED_RUN_RULES = `${STRUCTURED_RULES_VERSION}+${CANONICAL_RULES_VERSION}`

export function buildStructuredSteps(q: QuestionsContext): AnyEntityStep[] {
  return [structuredStep(q), subjectiveStep(q), canonicalStep(q)]
}

const NEEDED: Record<string, readonly string[]> = {
  structured_questions: ['id', 'subject_id', 'education_level_id', 'status', 'stimulus', 'kbat_level', 'total_marks', 'created_by'],
  structured_sub_questions: ['id', 'structured_question_id', 'number', 'body', 'marks', 'scheme'],
  structured_rubric_points: ['id', 'structured_sub_question_id', 'marks', 'text', 'code', 'position'],
  exam_questions: ['id', 'exam_paper_id', 'source_paper_id', 'status_id', 'number_label', 'position', 'stem', 'chapter_id', 'difficulty'],
  question_parts: ['id', 'exam_question_id', 'answer_mode_id', 'marks', 'parent_part_id', 'position', 'label', 'prompt', 'word_limit', 'config'],
  part_options: ['id', 'question_part_id', 'label', 'body', 'is_correct', 'position'],
  part_answer_keys: ['id', 'question_part_id', 'answer_key_kind_id', 'content'],
  legacy_canonical_map: ['canonical_type', 'canonical_id'],
}

/** The core preflight plus the columns the structured loaders read (a dump staged before the spec extension is refused, naming the column). */
export async function assertStructuredPreflight(options: Parameters<typeof assertQuestionsPreflight>[0]): Promise<void> {
  await assertQuestionsPreflight(options)
  for (const [table, columns] of Object.entries(NEEDED)) {
    const res = await options.pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
      [ARCHIVE_SCHEMA, table],
    )
    const have = new Set(res.rows.map((r) => r.column_name))
    const missing = columns.filter((c) => !have.has(c))
    if (missing.length > 0) {
      throw new PreflightError(`Preflight failed: ${ARCHIVE_SCHEMA}.${table} lacks column(s) ${missing.join(', ')}: re-stage with the current spec (staging:load).`)
    }
  }
}

export interface StructuredRunOptions extends Omit<QuestionsOptions, 'pool'> {
  pool: pg.Pool
  mode: RunMode
  batchSize?: number
  gitSha?: string | null
  coreAsOf?: string
}

export async function runStructured(options: StructuredRunOptions): Promise<{ report: RunReport; questions: QuestionsContext }> {
  const { mode, batchSize, gitSha, coreAsOf, ...rest } = options
  if (mode === 'apply') await assertApplyAllowed(options.pool, options.env)
  await assertNotSyntheticInProduction(options.pool, options.env)
  await assertStructuredPreflight({ pool: options.pool, env: options.env, source: options.source, asOf: options.asOf, coreAsOf })
  const questions = new QuestionsContext({ ...rest, pageSize: rest.pageSize ?? batchSize })
  const steps = buildStructuredSteps(questions)
  const inputHash = hashInput([
    ...(await tableFingerprints(options.pool, [
      'archive_cloud.structured_questions', 'archive_cloud.structured_sub_questions', 'archive_cloud.structured_rubric_points',
      'archive_cloud.questions', 'archive_cloud.exam_questions', 'archive_cloud.question_parts', 'archive_cloud.part_options',
      'archive_cloud.part_answer_keys', 'archive_cloud.question_stimulus', 'archive_cloud.legacy_canonical_map',
    ])),
    `source=${options.source}`,
    `steps=${steps.map((s) => s.entity).join(',')}`,
    `core-map=${await coreMapCounts(options.pool, options.source)}`,
    `curriculum-map=${await curriculumMapHash(options.pool, options.source)}`,
    `rules=${STRUCTURED_RUN_RULES}`,
  ])
  const runner = new Runner({ pool: options.pool, env: options.env })
  const report = await runner.run({ mode, steps, inputHash, gitSha, batchSize })
  return { report, questions }
}
