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
export const QUESTIONS_RULES_VERSION = 'qload-1'

export function buildQuestionsSteps(q: QuestionsContext): AnyEntityStep[] {
  return [questionsStep(q)]
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
    `rules=${QUESTIONS_RULES_VERSION}`,
  ])
  const runner = new Runner({ pool: options.pool, env: options.env })
  const report = await runner.run({ mode, steps, inputHash, gitSha, batchSize })
  return { report, questions }
}
