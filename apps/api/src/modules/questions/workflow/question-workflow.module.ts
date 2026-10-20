import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { QuestionWorkflowPorts } from './ports'
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
 * `QuestionWorkflowPorts` is exported: BE-09 calls `provideQuestionBank(adapter)` from its own
 * `onModuleInit` (see `ports.ts`); neither card edits the other's module file.
 */
@Module({
  imports: [AuditModule, ThrottleModule],
  controllers: [
    // --- controllers: one line per route group ---------------------------------------------
  ],
  providers: [
    QuestionWorkflowPorts,
    QuestionWorkflowService,
    // --- providers: one line per route group service ---------------------------------------
  ],
  exports: [QuestionWorkflowPorts, QuestionWorkflowService],
})
export class QuestionWorkflowModule {}
