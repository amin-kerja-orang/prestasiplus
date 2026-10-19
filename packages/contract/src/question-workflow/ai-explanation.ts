import { z } from '../zod'

/**
 * AI explanation of a question, STUB (mock `ai-explanation.ts`, SRS BR-M04-24, OD-7, BE-10 AC 8).
 * Route: `POST /questions/{id}/ai-explanation`. Admin only.
 *
 * No AI provider and no network is called: the server builds the deterministic canned Markdown
 * (title "## Penjelasan", the correct answer, a short reasoning list and a two-column table, three
 * variants that cycle so a regeneration visibly changes the text) and stores it as
 * `{ markdown, generatedAt }` on the question. Without `force=1` an existing explanation is
 * returned unchanged; with `force=1` it is replaced (variant = previous + 1, else `id % 3`).
 * The mock's fault-injection branches (500 bodies) are test-only and are not part of the contract.
 */

export const QUESTION_WORKFLOW_AI_MESSAGES = {
  generated: 'Penjelasan AI berjaya dijana.',
  kept: 'Penjelasan AI sudah wujud.',
  /** Test-only failure copy of the mock; kept for the screen's failure path (FR-M04-46). */
  unavailable: 'Perkhidmatan AI tidak tersedia buat masa ini.',
} as const

export const QuestionWorkflowAiExplanationQuerySchema = z
  .object({
    force: z.string().optional().meta({ description: 'Only the value 1 regenerates an existing explanation; any other value is ignored.' }),
  })
  .meta({ id: 'QuestionWorkflowAiExplanationQuery' })

/**
 * 200 body, RAW (no `data` envelope): `{ ok: true, message }`. `stub: true` marks the response as
 * the OD-7 stub (an addition to the mock body, which has only `ok` and `message`).
 */
export const QuestionWorkflowAiExplanationResultSchema = z
  .strictObject({
    ok: z.literal(true),
    message: z.enum([QUESTION_WORKFLOW_AI_MESSAGES.generated, QUESTION_WORKFLOW_AI_MESSAGES.kept]),
    stub: z.literal(true).meta({ description: 'Always true: the explanation is canned text, no AI was called (OD-7).' }),
  })
  .meta({ id: 'QuestionWorkflowAiExplanationResult' })
