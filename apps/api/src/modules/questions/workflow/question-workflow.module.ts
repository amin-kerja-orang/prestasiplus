import { Module, type OnModuleInit } from '@nestjs/common'

import { AiExplanationController, AiExplanationService } from './ai-explanation'
import { DiagramAuditController, DiagramAuditService } from './diagram-audit'
import { DskpController, DskpService } from './dskp'
import { MasterNotesController, MasterNotesService } from './master-notes'
import { QualityController, QualityService } from './quality'
import { FilesModule } from '../../files'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { QuestionBankAdapter } from './bank'
import { LifecycleService } from './lifecycle'
import { CurriculumModule } from '../../curriculum'
import { GuruQuestionImportController, QuestionImportsController, QuestionImportsService } from './imports'
import { NotificationsModule } from '../../notifications'
import { QuestionsModule } from '../questions.module'
import { QuestionWorkflowPorts } from './ports'
import { QuestionReportsController, QuestionReportsService } from './reports'
import { ReportsRepository } from './reports/reports.repository'
import { QuestionWorkflowService } from './question-workflow.service'

/**
 * Question workflow (M04 rest, BE-10, lane PC-5): lifecycle transitions with status events, student
 * reports, Excel/CSV imports, quality audit, diagram audit, DSKP lookups, master notes and the AI
 * explanation stub. Contract: `packages/contract/src/question-workflow/**`.
 *
 * HOW TO ADD YOUR ROUTE GROUP (one subfolder each, no edits outside your lines):
 *   1. Create `<group>/<group>.controller.ts` and `<group>/<group>.service.ts`.
 *      Controllers use `@AdminOnly()` / `@GuruOnly()` / `@AdminOrGuru()` from `./actor`, and
 *      `@UseGuards(RateLimitGuard)` + `@RateLimit(...)` on writes like the curriculum module.
 *      Services read the question bank ONLY through `QuestionWorkflowPorts.questionBank`.
 *   2. Add `YourController` to `controllers` and `YourService` to `providers` (and `exports` when
 *      another module needs it) below, in the marked block. One line each.
 *
 * Subfolders reserved for the groups (create them when you add your files):
 *   reports/        POST|GET /question-reports, GET /question-reports/mine, PATCH /question-reports/:id
 *   imports/        /question-imports, /guru/questions/import|template (CSV parser + template)
 *   quality/        GET /question-quality, POST /question-quality/audit
 *   diagram-audit/  GET /diagram-audit, POST /diagram-audit/:kind/:id/image|dismiss
 *   master-notes/   GET /master-notes, POST /master-notes/:id/:action
 *   ai-explanation/ POST /questions/:id/ai-explanation (stub, OD-7)
 *   dskp/           GET /guru/dskp/bidang|sk|sp (reads CurriculumRepository)
 *   lifecycle/      transition table + gates, status events, source takedown; exposes
 *                   `QuestionWorkflowService.transition(...)` for BE-09's `bulk-action` / `PUT`
 *
 * `QuestionWorkflowPorts` is exported. This module imports `QuestionsModule` (BE-09) and registers
 * `QuestionBankAdapter` (`bank/`) as the question bank in its own `onModuleInit`.
 */
@Module({
  imports: [AuditModule, ThrottleModule, NotificationsModule, CurriculumModule, FilesModule, QuestionsModule],
  controllers: [
    // --- controllers: one line per route group ---------------------------------------------
    QualityController,
    DiagramAuditController,
    MasterNotesController,
    AiExplanationController,
    DskpController,
    QuestionReportsController,
    QuestionImportsController,
    GuruQuestionImportController,
  ],
  providers: [
    QuestionWorkflowPorts,
    QuestionBankAdapter,
    QuestionWorkflowService,
    LifecycleService,
    // --- providers: one line per route group service ---------------------------------------
    QualityService,
    DiagramAuditService,
    MasterNotesService,
    AiExplanationService,
    DskpService,
    ReportsRepository,
    QuestionReportsService,
    QuestionImportsService,
  ],
  exports: [QuestionWorkflowPorts, QuestionWorkflowService, QuestionReportsService],
})
export class QuestionWorkflowModule implements OnModuleInit {
  constructor(
    private readonly ports: QuestionWorkflowPorts,
    private readonly bank: QuestionBankAdapter,
  ) {}

  /** Replaces the empty default with the BE-09 question bank (once; a second call throws). */
  onModuleInit(): void {
    this.ports.provideQuestionBank(this.bank)
  }
}
