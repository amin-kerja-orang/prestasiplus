/**
 * M04 mock plugin (F-25: the question, structured-question and report stores; SRS v1.11; overview
 * §6.10, D12). Owner of `questions` (objective rows, the SPM pool rows and the PKSK rows),
 * `structuredQuestions`, `jutawanQuestions` (the M16 Jutawan bank, outside Q-ALL),
 * `questionReports` and `questionImportRuns`.
 *
 * PUBLIC exports (the only M04 mock code other modules may import, `@/modules/m04-question-bank/mock`):
 * the repositories `questions` (incl. the Jutawan methods), `structured`, `reports` and
 * `importRuns` (SRS §7.1). Types for their rows come with them.
 *
 * Also public (v1.17, for the M10 teacher CSV import #57/#58, D12): `IMPORT_TEMPLATE_CSV` (the template
 * file text), `parseCsv(text)` and `planImport(text, defaults?, lookups?)` with their types (`CsvRecord`,
 * `ImportDefaults`, `ImportLookups`, `ImportPlan`, `PlannedRow`); both options default to none / M03.
 *
 * Test hook (dev/e2e builds): `createQuestionFixture(row)` = `questions.createFixture(row)` (SRS §7.1,
 * the M10 E2E fixture 700301).
 *
 * Bump `version` whenever the seed, `derive` or a cheap field changes (overview §6.9, §14 rule 4b).
 * M04-T1/T2 add the handlers (#1–#27) and their routes.
 */

import { defineMockModule } from '@/mock/define'

// M04-T1 (objective questions): routes #1–#8 and the DSKP cascade #28–#30.
import { dskpRoutes } from './handlers/dskp'
import { questionRoutes } from './handlers/questions'
import { jutawanDataset } from './datasets/jutawan'
import { questionsDataset } from './datasets/questions'
import { structuredDataset } from './datasets/structured'
import { questionsRepo, type Question } from './repository/questions'
import { importRunsRepo, importRunsTable } from './repository/import-runs'
import { reportsRepo, reportsTable } from './repository/reports'
import { structuredRepo } from './repository/structured'
import {
  IMPORT_RUNS_OVERRIDE,
  QUESTION_STORE_OVERRIDE,
  seedQuestionBank,
} from './seeds/question-bank'
// M04-T2 (workflow): routes #9–#13 and #18–#27, the submissions / master-notes / audit stores.
import { workflowRoutes } from './handlers/workflow'
// M04-T6 (reports): routes #14–#17.
import { reportRoutes } from './handlers/reports'
import { qualityAuditRepo, qualityAuditTable } from './repository/audit-state'
import { masterNotesRepo, masterNotesTable } from './repository/master-notes'
import { submissionsRepo, submissionsTable } from './repository/submissions'
import { finaliseWorkflow, MASTER_NOTES_OVERRIDE, seedWorkflow } from './seeds/workflow'

const plugin = defineMockModule({
  id: 'M04',
  // M01: creator names (`users`); M02: teacher schools. Handlers read them at request time.
  dependsOn: ['core', 'M01', 'M02', 'M03'],
  version: 6,
  tables: {
    reports: reportsTable,
    importRuns: importRunsTable,
    submissions: submissionsTable,
    masterNotes: masterNotesTable,
    qualityAudit: qualityAuditTable,
  },
  datasets: {
    questions: questionsDataset,
    structuredQuestions: structuredDataset,
    jutawanQuestions: jutawanDataset,
  },
  repositories: {
    questions: questionsRepo,
    structured: structuredRepo,
    reports: reportsRepo,
    importRuns: importRunsRepo,
    submissions: submissionsRepo,
    masterNotes: masterNotesRepo,
    qualityAudit: qualityAuditRepo,
  },
  overrides: [QUESTION_STORE_OVERRIDE, IMPORT_RUNS_OVERRIDE, MASTER_NOTES_OVERRIDE],
  seed(ctx) {
    seedQuestionBank(ctx)
    seedWorkflow()
  },
  // The master notes read which question ids exist, so they are seeded once the dataset is compiled.
  finalise(ctx) {
    finaliseWorkflow(ctx)
  },
  routes: [...questionRoutes, ...dskpRoutes, ...workflowRoutes, ...reportRoutes],
  hooks: {
    createQuestionFixture: (
      row: Partial<Question> & { id: number; subjectId: number; educationLevelId: number },
    ) => questionsRepo.createFixture(row),
  },
})

export default plugin

export const { questions, structured, reports, importRuns, submissions, masterNotes } =
  plugin.repositories

export type {
  Question,
  QuestionFacets,
  QuestionReport,
  QuestionStatus,
  QuestionType,
  StructuredQuestion,
  StructuredSubQuestion,
} from './repository/types'
export type {
  GradeResult,
  PracticeFilter,
  PkskFilter,
  PkskInput,
  QuestionInput,
  QuestionPatch,
  SpmPoolFilter,
  SpmPoolView,
  Viewer,
} from './repository/questions'
export type { ReportInput, ReportUpdate } from './repository/reports'
export { IMPORT_TEMPLATE_CSV, parseCsv, planImport } from './import/csv'
export type { CsvRecord, ImportDefaults, ImportLookups, ImportPlan, PlannedRow } from './import/csv'
export type { StructuredInput, StructuredSubInput } from './repository/structured'
export type { QuestionSubmission, SubmissionInput } from './repository/submissions'
export type { MasterNote } from './repository/master-notes'
