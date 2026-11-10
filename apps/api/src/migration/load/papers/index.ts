/**
 * `migrate:papers` (T-B10-1 to T-B10-4): SPM sets, blueprints, papers (steps `spm_sets`, `paper_blueprints`, `exam_papers`), then the optional
 * Terbit pass through the real publish gate. The Kertas Subjektif page-image documents (`paper_documents`, `paper_document_pages`: V2 parity, 0265)
 * load here too (steps `paper_documents` and `paper_document_pages`); the pages need `--files-dir`. Runs AFTER `migrate:all`, `migrate:questions` and `migrate:structured` (placements and set
 * members resolve through `etl_id_map`; the surface of a paper reads the blueprints loaded here, so blueprints run before papers).
 */
import type pg from 'pg'

import { ARCHIVE_SCHEMA } from '../../ddl/spec'
import { assertApplyAllowed } from '../../kit/apply-guard'
import { hashInput } from '../../kit/sql'
import { Runner, type AnyEntityStep, type RunReport } from '../../kit/runner'
import type { RunMode } from '../../kit/types'
import { assertNotSyntheticInProduction } from '../index'
import { openMigrationFiles, type MigrationFiles } from '../activity/files'
import { coreMapCounts, PreflightError, tableFingerprints } from '../activity/preflight'
import { QuestionsContext, type QuestionsOptions } from '../questions/context'
import { curriculumMapHash } from '../questions'
import { assertQuestionsPreflight } from '../questions/preflight'
import { spmSetsStep } from '../spm-sets/steps'
import { blueprintsStep } from './blueprints-step'
import { documentPagesStep, documentsStep, finaliseDocuments, type FinaliseDocumentsResult } from './documents-step'
import { papersStep } from './papers-step'
import { PAPERS_RULES_VERSION } from './plan'

export { finaliseDocuments, type FinaliseDocumentsResult } from './documents-step'
export { LEGACY_PUBLISH_BODY, LEGACY_PUBLISH_REASON, runTerbitPass, terbitCsv, terbitCandidates, type PaperPublisher, type TerbitReport } from './terbit-pass'

export function buildPapersSteps(q: QuestionsContext, files?: MigrationFiles): AnyEntityStep[] {
  return [spmSetsStep(q), blueprintsStep(q), papersStep(q), documentsStep(q), documentPagesStep(q, files)]
}

const NEEDED: Record<string, readonly string[]> = {
  spm_sets: ['id', 'subject_id', 'year', 'set_number', 'kind'],
  spm_set_question: ['spm_set_id', 'question_id', 'position'],
  paper_blueprints: ['id', 'subject_id', 'kertas', 'paper_code', 'duration_minutes', 'total_marks', 'auto_markable', 'source'],
  blueprint_sections: ['id', 'paper_blueprint_id', 'label', 'position', 'selection_rule_id', 'instruction', 'select_count', 'mark_budget', 'expected_answer_modes'],
  exam_papers: ['id', 'status_id', 'title', 'subject_id', 'kertas', 'cover_code', 'duration_minutes', 'instructions', 'reference_assets', 'created_by'],
  paper_sections: ['id', 'exam_paper_id', 'label', 'position', 'selection_rule_id', 'instruction_text', 'select_count', 'mark_budget'],
  exam_paper_questions: ['id', 'exam_question_id', 'paper_section_id', 'sort_order', 'number_label', 'marks_override'],
  exam_questions: ['id', 'paper_section_id', 'position', 'number_label'],
  legacy_canonical_map: ['canonical_type', 'canonical_id', 'source', 'legacy_id'],
  paper_documents: ['id', 'subject_id', 'kertas', 'title', 'negeri', 'year', 'source_file', 'duration_minutes', 'marks_total', 'page_count', 'scheme_page_count', 'published_at'],
  paper_document_pages: ['id', 'paper_document_id', 'kind', 'position', 'path', 'sha', 'width', 'height'],
}

export async function assertPapersPreflight(options: Parameters<typeof assertQuestionsPreflight>[0]): Promise<void> {
  await assertQuestionsPreflight(options)
  for (const [table, columns] of Object.entries(NEEDED)) {
    const res = await options.pool.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`, [ARCHIVE_SCHEMA, table])
    const have = new Set(res.rows.map((r) => r.column_name))
    const missing = columns.filter((c) => !have.has(c))
    if (missing.length > 0) throw new PreflightError(`Preflight failed: ${ARCHIVE_SCHEMA}.${table} lacks column(s) ${missing.join(', ')}: re-stage with the current spec (staging:load).`)
  }
}

export interface PapersRunOptions extends Omit<QuestionsOptions, 'pool'> {
  pool: pg.Pool
  mode: RunMode
  batchSize?: number
  gitSha?: string | null
  coreAsOf?: string
  /** `--files-dir`: the read-only export of the V2 storage (outside the repo, with a SHA256SUMS). Without it the document pages are skipped. */
  filesDir?: string
}

export async function runPapers(options: PapersRunOptions): Promise<{ report: RunReport; questions: QuestionsContext; documents?: FinaliseDocumentsResult }> {
  const { mode, batchSize, gitSha, coreAsOf, filesDir, ...rest } = options
  if (mode === 'apply') await assertApplyAllowed(options.pool, options.env)
  await assertNotSyntheticInProduction(options.pool, options.env)
  await assertPapersPreflight({ pool: options.pool, env: options.env, source: options.source, asOf: options.asOf, coreAsOf })
  const questions = new QuestionsContext({ ...rest, pageSize: rest.pageSize ?? batchSize })
  // The directory, its manifest and the storage are checked before any row is read (nothing is copied here).
  const files = filesDir === undefined ? undefined : await openMigrationFiles({ dir: filesDir, env: options.env, mode, source: options.source })
  const steps = buildPapersSteps(questions, files)
  const inputHash = hashInput([
    ...(await tableFingerprints(options.pool, [
      'archive_cloud.spm_sets', 'archive_cloud.spm_set_question', 'archive_cloud.paper_blueprints', 'archive_cloud.blueprint_sections',
      'archive_cloud.exam_papers', 'archive_cloud.paper_sections', 'archive_cloud.exam_paper_questions', 'archive_cloud.exam_questions',
      'archive_cloud.legacy_canonical_map', 'archive_cloud.paper_documents', 'archive_cloud.paper_document_pages',
    ])),
    `source=${options.source}`,
    `steps=${steps.map((s) => s.entity).join(',')}`,
    `core-map=${await coreMapCounts(options.pool, options.source)}`,
    `curriculum-map=${await curriculumMapHash(options.pool, options.source)}`,
    `rules=${PAPERS_RULES_VERSION}`,
    `files=${files?.manifestHash ?? 'none'}`,
  ])
  const runner = new Runner({ pool: options.pool, env: options.env })
  const report = await runner.run({ mode, steps, inputHash, gitSha, batchSize })
  // Counts and the empty-document guard follow the pages actually loaded (apply only: a dry-run wrote nothing).
  const documents = mode === 'apply' && files !== undefined && report.status === 'succeeded' ? await finaliseDocuments(options.pool, options.source) : undefined
  if (documents !== undefined) {
    questions.notes.count('paper_documents.recounted', documents.recounted)
    questions.notes.count('paper_documents.hidden_without_pages', documents.unpublishedEmpty)
  }
  return { report, questions, documents }
}
