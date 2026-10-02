/**
 * M04 seed (SRS v1.10 §6.11): the question and structured datasets are seeded by their spec and
 * literal anchors (no writes); this seed applies the owner overrides and inserts the report rows,
 * all through the M04 repositories (overview §3 rule 3a).
 *
 * Override key `questionStore` (declared by the plugin; M06 §6.11 uses it):
 * `{ profile?: 'states', spmPool?: { [subject]: { [level]: { [difficulty]: count } } } }`.
 */

import type { SeedContext } from '@/mock/define'

import { importRunsRepo } from '../repository/import-runs'
import { questionsRepo } from '../repository/questions'
import { reportsRepo } from '../repository/reports'
import { SEED_REPORTS } from './reports'

export const QUESTION_STORE_OVERRIDE = 'questionStore'
/** `importRuns: []` seeds no import run (S5h empty state, E2E). */
export const IMPORT_RUNS_OVERRIDE = 'importRuns'

export function seedQuestionBank(ctx: SeedContext): void {
  questionsRepo.applySeedOverrides(ctx.overrides[QUESTION_STORE_OVERRIDE])
  reportsRepo.seedRows(SEED_REPORTS)
  importRunsRepo.seedDefault(ctx.overrides[IMPORT_RUNS_OVERRIDE])
}
