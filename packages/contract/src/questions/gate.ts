import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf } from '../common/envelope'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import { ServabilityReportSchema } from '../servability/schema'
import { QuestionCognitiveLevelSchema } from './parts'
import { QuestionDskpStatusSchema, QuestionSchema } from './schema'

/**
 * R1-B05 (ADR-0031, pipeline arch 3.1): the approve gate as a read (`gate-check`) and the lifecycle status route. The gate itself is
 * `GATES` in the API (`questions/workflow/lifecycle/gates.ts`): the merged approve gate of ADR-0027 plus, for a NEW approval, the DSKP rules of
 * 45 section 4.1 (R-DSKP: unit, SP, TP and a cognitive level on every leaf only where DSKP nodes exist for the Subjek + Tingkatan; the Bab where
 * the Subjek + Tingkatan has chapters; the kertas of an SPM-bound question; Kesukaran always).
 */

export const QUESTION_GATE_NAMES = ['submit', 'approve'] as const
export const QuestionGateNameSchema = z.enum(QUESTION_GATE_NAMES).meta({ id: 'QuestionGateName' })

/** The wizard step an issue belongs to (V2 Studio): 1 Kertas, 2 Rangsangan, 3 Sub-bahagian, 4 Tag & pengelasan. */
export const QuestionGateIssueSchema = z
  .object({
    path: z.string().meta({ description: 'The `fields` key: `unitId`, `kertas`, `parts.b.cognitiveLevel`, ...' }),
    code: z.string().meta({ description: 'Stable machine code, the Code column of 45 section 4.1, for example NO_SUBJECT, NO_LEVEL, NO_UNIT, NO_SP, LEAF_NO_TP, LEAF_NO_ARAS, NO_KERTAS, NO_CHAPTER, NO_DIFFICULTY, STEM_SHORT (TP_MISSING and SP_NOT_IN_TAXONOMY also exist).' }),
    message: z.string().meta({ description: 'BM text, for example "Bahagian (b) belum ada aras pemikiran."' }),
    step: z.number().int().min(1).max(4),
  })
  .meta({ id: 'QuestionGateIssue' })
export type QuestionGateIssue = z.infer<typeof QuestionGateIssueSchema>

export const QuestionGateCheckQuerySchema = z.object({ gate: QuestionGateNameSchema.default('approve') }).meta({ id: 'QuestionGateCheckQuery' })

export const QuestionGateCheckSchema = z
  .object({
    gate: QuestionGateNameSchema,
    ok: z.boolean(),
    issues: z.array(QuestionGateIssueSchema),
  })
  .meta({ id: 'QuestionGateCheck', description: 'No state change. `issues` is empty when `ok`; its length drives the "· n belum lengkap" counter.' })
export type QuestionGateCheck = z.infer<typeof QuestionGateCheckSchema>

export const QUESTION_STATUS_TARGETS = ['draft', 'review', 'approved', 'archived', 'rejected'] as const

/** 422 `fields.reason` of `to: "rejected"` (API-Q-06, FR-QA-32): required, 5 to 500 characters. */
export const QUESTION_REJECTION_REASON_MESSAGE = 'Sila nyatakan sebab penolakan (sekurang-kurangnya 5 aksara).'
export const QuestionStatusRequestSchema = z
  .strictObject({
    to: z.enum(QUESTION_STATUS_TARGETS, { error: 'Status tidak sah.' }),
    reason: z.string().trim().max(500).nullish(),
  })
  .meta({ id: 'QuestionStatusRequest' })
export type QuestionStatusRequest = z.infer<typeof QuestionStatusRequestSchema>

export const QuestionStatusResultSchema = z
  .object({
    question: QuestionSchema,
    servability: ServabilityReportSchema.nullable().meta({ description: 'Where the question is visible to pupils; present when `to` is `approved`, else null.' }),
  })
  .meta({ id: 'QuestionStatusResult' })

/** Components contributed by R1-B05 (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const QUESTION_GATE_COMPONENT_SCHEMAS = {
  QuestionCognitiveLevel: QuestionCognitiveLevelSchema,
  QuestionDskpStatus: QuestionDskpStatusSchema,
  QuestionGateName: QuestionGateNameSchema,
  QuestionGateIssue: QuestionGateIssueSchema,
  QuestionGateCheck: QuestionGateCheckSchema,
  QuestionStatusRequest: QuestionStatusRequestSchema,
  QuestionStatusResult: QuestionStatusResultSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({ description, content: { 'application/json': { schema } } })
const err = (description: string) => json(ErrorBodySchema, description)
const idParams = z.object({ id: IdSchema })
const csrf = z.object({ 'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }) })
const unauthorized = err('UNAUTHORIZED: no valid session.')
const forbidden = err('FORBIDDEN (Admin Pusat, or the owning Guru for their own question), or CSRF_INVALID.')
const notFound = err('NOT_FOUND: unknown id, or another Guru\'s question.')

export function registerQuestionGatePaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/questions/{id}/gate-check',
    tags: ['questions'],
    summary: 'Check a gate without changing the question',
    description:
      '`gate=approve` (default) is the merged approve gate ("Terbitkan"): marks, one key per MCQ, a key for every other mode, images resolved, unit, SP and TP chosen, no open duplicate (no per-question source or rights rule: V2 asks for them once, at the intake batch, D99); and for an SPM-bound question (a subject of the SPM catalogue at Tingkatan 4 or 5) a cognitive level on every leaf ("Bahagian (b) belum ada aras pemikiran.") and the kertas. `gate=submit` is the draft-to-review gate. Legacy questions already approved are never re-checked (D80 DEC-2): the gate runs only on a new approval.',
    request: { params: idParams, query: z.object({ gate: QuestionGateNameSchema.optional() }) },
    responses: { 200: json(envelopeOf(QuestionGateCheckSchema), 'The issues, in reading order.'), 401: unauthorized, 403: forbidden, 404: notFound },
  })
  registry.registerPath({
    method: 'post',
    path: '/questions/{id}/status',
    tags: ['questions'],
    summary: 'Move a question along the lifecycle',
    description:
      'Draft to review (the owning Guru or Admin), review to approved ("Terbitkan", Admin Pusat; runs the merged approve gate), review to archived and approved to archived (Admin; no reason needed, one is recorded when given), review to draft (a reason is required), `to: "rejected"` ("Tolak", Admin Pusat, from review only: stored as status draft with `rejection_reason`, reason 5 to 500 characters, else 422 `fields.reason`; sending for review again clears it) and archived to draft (Admin). `approved` is the only servable status, so the answer carries the ServabilityReport of an approval. Refusals: 409 for a pair outside the table, 422 with `fields` keyed by path (the gate issues) and `details.gate`, 403 for a role that may not move it.',
    request: { params: idParams, headers: [csrf], body: { required: true, content: { 'application/json': { schema: QuestionStatusRequestSchema } } } },
    responses: {
      200: json(envelopeOf(QuestionStatusResultSchema), 'The question after the change.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
      409: err('CONFLICT: the pair is outside the lifecycle table.'),
      422: err('VALIDATION_ERROR: the gate failed (`fields` keyed by path, `details.gate`), or a reason / status is missing or unknown.'),
    },
  })
}
