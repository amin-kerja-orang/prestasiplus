import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf } from '../common/envelope'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import { QuestionGateIssueSchema } from './gate'
import { QuestionSchemeV2PointsKeySchema, QuestionSchemeV2RubricKeySchema } from './parts'

/**
 * S1-T09a, API-Q-30: `POST /api/questions/:id/parts/:partId/scheme/validate`. The body is the bare scheme v2 object of the part (45 section 7.0,
 * DM-54): a `points` or a `rubric` key with `scheme_v: 2`. The answer is the same issue shape as API-Q-05 (`gate-check`); a body that does not
 * parse is reported as issues too (never a 400), so the editor shows every problem live. Read-only.
 */
export const QuestionSchemeValidateRequestSchema = z
  .union([QuestionSchemeV2PointsKeySchema, QuestionSchemeV2RubricKeySchema])
  .meta({ id: 'QuestionSchemeValidateRequest' })

export const QuestionSchemeValidateResultSchema = z
  .object({
    ok: z.boolean(),
    issues: z.array(QuestionGateIssueSchema),
  })
  .meta({
    id: 'QuestionSchemeValidateResult',
    description: 'No state change. `issues` is empty when `ok`. `step` is always 4 (Tag & pengelasan, where the scheme is edited).',
  })
export type QuestionSchemeValidateResult = z.infer<typeof QuestionSchemeValidateResultSchema>

export const QUESTION_SCHEME_VALIDATE_COMPONENT_SCHEMAS = {
  QuestionSchemeValidateRequest: QuestionSchemeValidateRequestSchema,
  QuestionSchemeValidateResult: QuestionSchemeValidateResultSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({ description, content: { 'application/json': { schema } } })
const err = (description: string) => json(ErrorBodySchema, description)

export function registerQuestionSchemeValidatePaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'post',
    path: '/questions/{id}/parts/{partId}/scheme/validate',
    tags: ['questions'],
    summary: 'Validate a marking scheme live (Admin Pusat)',
    description:
      'Validates the scheme v2 body against the marks of the stored leaf `partId` (its label path joined with `.`, URL-encoded, for example `a.i`). Runs the best-reachable-marks check (`SCHEME_SUM`), `SCHEME_DEPENDS`, `BAND_RANGE` and the penalty rule; the leaf marks come from the stored part, and a leaf with `modeConfig.example` is exempt from the sum. A body that does not parse is answered with 200 and `issues`, not 400. Nothing is saved.',
    request: {
      params: z.object({ id: IdSchema, partId: z.string().min(1) }),
      headers: [z.object({ 'X-CSRF-Token': z.string().min(1) })],
      body: { required: true, content: { 'application/json': { schema: QuestionSchemeValidateRequestSchema } } },
    },
    responses: {
      200: json(envelopeOf(QuestionSchemeValidateResultSchema), 'ok and the issues, in reading order.'),
      401: err('UNAUTHORIZED: no valid session.'),
      403: err('FORBIDDEN (not Admin Pusat) or CSRF_INVALID.'),
      404: err('NOT_FOUND: unknown question or part.'),
    },
  })
}
