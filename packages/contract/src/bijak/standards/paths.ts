import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import { IdSchema } from '../../common/ids'
import { registerRoute } from '../builder/rate-limit'
import { BijakBlueprintViewSchema, BijakBuilderCsrfErrorSchema, BijakBuilderOkSchema } from '../builder/schema'
import {
  BijakGenerateLimitErrorSchema,
  BijakGenerateNoBlueprintErrorSchema,
  BijakGenerateShortageErrorSchema,
  BijakSubjectSchema,
} from '../papers/schema'
import {
  BijakBlueprintInvalidErrorSchema,
  BijakBlueprintVersionItemSchema,
  BijakDraftGenerateRequestSchema,
  BijakDskpUnitSchema,
  BijakDskpUnitsQuerySchema,
  BijakDraftGenerateResultSchema,
  BijakEvidenceInputSchema,
  BijakEvidenceItemSchema,
  BijakEvidenceKindSchema,
  BijakEvidenceLineSchema,
  BijakEvidenceValuesSchema,
  BijakPoolPreviewQuerySchema,
  BijakPoolPreviewSchema,
  BijakSectionReviewInputSchema,
  BijakPoolPreviewSectionSchema,
  BijakVerificationCheckSchema,
  BijakVerificationFailedErrorSchema,
  BijakVerificationRecordSchema,
  BijakVerificationStateSchema,
  BijakVerifyInputSchema,
} from './admin'
import {
  BIJAK_STANDARDS_MESSAGES,
  BijakBlueprintClientSourceSchema,
  BijakBlueprintProblemCodeSchema,
  BijakBlueprintProblemSchema,
  BijakBlueprintWarningSchema,
  BijakDifficultyProfileSchema,
  BijakDifficultyProfileViewSchema,
  BijakLevelShareSchema,
  BijakProfileKindSchema,
  BijakQuotaBasisSchema,
  BijakQuotaLineSchema,
  BijakQuotaLineViewSchema,
  BijakQuotaTagSchema,
  BijakReviewGapSchema,
  BijakReviewPaperSchema,
  BijakSlotGroupSchema,
  BijakSlotGroupViewSchema,
  BijakTopicQuotaSchema,
  BijakTopicQuotaViewSchema,
  BijakUnitRefSchema,
  BijakUnitRefViewSchema,
  BijakVerificationSummarySchema,
} from './schema'

/**
 * Components contributed by BJS-01 (appended to COMPONENT_SCHEMAS in openapi.ts). Typed as a plain
 * record, like the builder map, to keep the shared union under the TypeScript comparison limit.
 */
export const BIJAK_STANDARDS_COMPONENT_SCHEMAS: Record<string, z.ZodType> = {
  BijakUnitRef: BijakUnitRefSchema,
  BijakUnitRefView: BijakUnitRefViewSchema,
  BijakProfileKind: BijakProfileKindSchema,
  BijakQuotaBasis: BijakQuotaBasisSchema,
  BijakLevelShare: BijakLevelShareSchema,
  BijakSlotGroup: BijakSlotGroupSchema,
  BijakSlotGroupView: BijakSlotGroupViewSchema,
  BijakDifficultyProfile: BijakDifficultyProfileSchema,
  BijakDifficultyProfileView: BijakDifficultyProfileViewSchema,
  BijakQuotaTag: BijakQuotaTagSchema,
  BijakQuotaLine: BijakQuotaLineSchema,
  BijakQuotaLineView: BijakQuotaLineViewSchema,
  BijakTopicQuota: BijakTopicQuotaSchema,
  BijakTopicQuotaView: BijakTopicQuotaViewSchema,
  BijakBlueprintClientSource: BijakBlueprintClientSourceSchema,
  BijakVerificationSummary: BijakVerificationSummarySchema,
  BijakBlueprintProblemCode: BijakBlueprintProblemCodeSchema,
  BijakBlueprintProblem: BijakBlueprintProblemSchema,
  BijakBlueprintWarning: BijakBlueprintWarningSchema,
  BijakReviewGap: BijakReviewGapSchema,
  BijakReviewPaper: BijakReviewPaperSchema,
  BijakEvidenceKind: BijakEvidenceKindSchema,
  BijakEvidenceValues: BijakEvidenceValuesSchema,
  BijakEvidenceInput: BijakEvidenceInputSchema,
  BijakEvidenceItem: BijakEvidenceItemSchema,
  BijakEvidenceLine: BijakEvidenceLineSchema,
  BijakVerificationCheck: BijakVerificationCheckSchema,
  BijakVerificationRecord: BijakVerificationRecordSchema,
  BijakVerificationState: BijakVerificationStateSchema,
  BijakVerifyInput: BijakVerifyInputSchema,
  BijakBlueprintVersionItem: BijakBlueprintVersionItemSchema,
  BijakPoolPreviewSection: BijakPoolPreviewSectionSchema,
  BijakPoolPreview: BijakPoolPreviewSchema,
  BijakPoolPreviewQuery: BijakPoolPreviewQuerySchema,
  BijakSectionReviewInput: BijakSectionReviewInputSchema,
  BijakDskpUnit: BijakDskpUnitSchema,
  BijakDskpUnitsQuery: BijakDskpUnitsQuerySchema,
  BijakDraftGenerateRequest: BijakDraftGenerateRequestSchema,
  BijakDraftGenerateResult: BijakDraftGenerateResultSchema,
  BijakBlueprintInvalidError: BijakBlueprintInvalidErrorSchema,
  BijakVerificationFailedError: BijakVerificationFailedErrorSchema,
}

/** Tag of the BJS-01 routes (kept apart so the BE-39 operation counts stay as they are). */
export const BIJAK_STANDARDS_TAG = 'bijak-standards'

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const body = (schema: z.ZodType) => ({
  required: true as const,
  content: { 'application/json': { schema } },
})
const csrf = z.object({
  'X-CSRF-Token': z
    .string()
    .min(1)
    .meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})
const BlueprintParams = z.object({
  subject: z.string().min(1).max(32).meta({ description: 'Subject code.', example: 'MAT' }),
  kertas: z.coerce.number().int().min(1).meta({ description: 'Kertas number.', example: 2 }),
})
const SectionParams = BlueprintParams.extend({
  position: z.coerce.number().int().min(1).meta({ description: '1-based section position.', example: 1 }),
})
const EvidenceParams =BlueprintParams.extend({ evidenceId: IdSchema })

const ROLE_NOTE =
  'Admin Pusat only (AC-32.1, AC-39.3); Admin Sekolah, PPD/JPN, Guru, Ibu bapa and Murid get 403 and nothing changes.'
const SPEC = 'Architecture: docs/architecture/v2-bijak-spm-standards.md (slug bijak-spm).'
const UNAUTHORIZED = err('UNAUTHORIZED (no valid session).')
const FORBIDDEN_READ = err('FORBIDDEN (the active role is not Admin Pusat).')
const FORBIDDEN_WRITE = json(
  z.union([ErrorBodySchema, BijakBuilderCsrfErrorSchema]),
  'FORBIDDEN (the active role is not Admin Pusat) or CSRF_INVALID (missing or wrong X-CSRF-Token).',
)
const BLUEPRINT_NOT_FOUND = err('NOT_FOUND "Kontrak tidak ditemui" [PROPOSED].')

/**
 * Registers the BJS-01 admin routes: version history, evidence (list, add, delete), verification
 * (read, verify), pool preview and draft generation. The existing blueprint routes (list, get,
 * create, version, retire) stay in `bijak/builder/paths.ts` and gain the extended bodies.
 * Every write is rate limited (D57) through `registerRoute`.
 */
export function registerBijakStandardsPaths(registry: OpenAPIRegistry): void {
  registerRoute(
    registry,
    {
      method: 'get',
      path: '/admin/bijak/dskp/units',
      tags: [BIJAK_STANDARDS_TAG],
      summary: 'DSKP unit picker for the quota editor (subject and level)',
      description: `Units (kind unit) of the subject's DSKP, sorted by sortOrder; elective marks the elective units. Source of the display fields of BijakUnitRefView. 404 NOT_FOUND for an unknown subject; an empty list for a subject with no DSKP units (for example Geografi). Query level is optional here (omitted = T4 and T5) [PROPOSED]. ${SPEC} ${ROLE_NOTE}`,
      request: { query: BijakDskpUnitsQuerySchema },
      responses: {
        200: json(envelopeOf(z.array(BijakDskpUnitSchema)), 'DSKP units (unpaged).'),
        401: UNAUTHORIZED,
        403: FORBIDDEN_READ,
        404: err('NOT_FOUND (unknown subject).'),
        422: err('VALIDATION_ERROR with fields (subject, level).'),
      },
    },
    false,
  )

  registerRoute(
    registry,
    {
      method: 'get',
      path: '/admin/bijak/subjects',
      tags: [BIJAK_STANDARDS_TAG],
      summary: 'Bijak subject list for "Tambah Kontrak" (all active subjects, Bijak codes)',
      description: `Unpaged. Returns Bijak codes (for example MAT), not the curriculum codes of GET /admin/subjects, and covers all active subjects, not only those on the student hub. ${SPEC} ${ROLE_NOTE}`,
      responses: {
        200: json(envelopeOf(z.array(BijakSubjectSchema)), 'Subjects.'),
        401: UNAUTHORIZED,
        403: FORBIDDEN_READ,
      },
    },
    false,
  )

  registerRoute(registry, {
    method: 'get',
    path: '/admin/blueprints/{subject}/{kertas}/versions',
    tags: [BIJAK_STANDARDS_TAG],
    summary: 'Blueprint: version history, newest first',
    description: `Every version row with its status, source, whether it serves students, structure hash and verification summary. ${SPEC} ${ROLE_NOTE}`,
    request: { params: BlueprintParams },
    responses: {
      200: json(envelopeOf(z.array(BijakBlueprintVersionItemSchema)), 'Versions, newest first.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
      404: BLUEPRINT_NOT_FOUND,
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/admin/blueprints/{subject}/{kertas}/evidence',
    tags: [BIJAK_STANDARDS_TAG],
    summary: 'Blueprint: evidence items of the head',
    description: `Trial papers, skema and LPM format documents recorded for the head version (AC-39.2). ${SPEC} ${ROLE_NOTE}`,
    request: { params: BlueprintParams },
    responses: {
      200: json(envelopeOf(z.array(BijakEvidenceItemSchema)), 'Evidence items.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
      404: BLUEPRINT_NOT_FOUND,
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/admin/blueprints/{subject}/{kertas}/evidence',
    tags: [BIJAK_STANDARDS_TAG],
    summary: 'Blueprint: add an evidence item to the head',
    description: `Unknown keys are rejected. A new version copies the head evidence, so re-verification starts from the history. A Disahkan head answers 409 CONFLICT "${BIJAK_STANDARDS_MESSAGES.evidenceLocked}" [PROPOSED]: edit through a new version first (AC-39.4). ${SPEC} ${ROLE_NOTE}`,
    request: { params: BlueprintParams, headers: [csrf], body: body(BijakEvidenceInputSchema) },
    responses: {
      201: json(envelopeOf(BijakEvidenceItemSchema), 'The new evidence item.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: BLUEPRINT_NOT_FOUND,
      409: err(`CONFLICT "${BIJAK_STANDARDS_MESSAGES.evidenceLocked}" [PROPOSED] (the head is Disahkan).`),
      422: err('VALIDATION_ERROR with fields (kind, body, year, paperCode, values.*).'),
    },
  })

  registerRoute(registry, {
    method: 'delete',
    path: '/admin/blueprints/{subject}/{kertas}/evidence/{evidenceId}',
    tags: [BIJAK_STANDARDS_TAG],
    summary: 'Blueprint: remove an evidence item from the head',
    description: `409 when the head is Disahkan (same rule as add); 404 "${BIJAK_STANDARDS_MESSAGES.evidenceNotFound}" [PROPOSED] for an unknown id. ${SPEC} ${ROLE_NOTE}`,
    request: { params: EvidenceParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(BijakBuilderOkSchema), 'Removed.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: err(`NOT_FOUND "${BIJAK_STANDARDS_MESSAGES.evidenceNotFound}" [PROPOSED] (blueprint or evidence).`),
      409: err(`CONFLICT "${BIJAK_STANDARDS_MESSAGES.evidenceLocked}" [PROPOSED] (the head is Disahkan).`),
    },
  })

  registerRoute(
    registry,
    {
      method: 'get',
      path: '/admin/blueprints/{subject}/{kertas}/verification',
      tags: [BIJAK_STANDARDS_TAG],
      summary: 'Blueprint: recorded verification (if any) and the live check of the head',
      description: `record is null until the blueprint is Disahkan. check is recomputed on every call: completeness gaps, blueprint problems and the evidence comparison lines (ok, differs, not_covered, tidak_disahkan), AC-39.1 and AC-39.7. ${SPEC} ${ROLE_NOTE}`,
      request: { params: BlueprintParams },
      responses: {
        200: json(envelopeOf(BijakVerificationStateSchema), 'Record and live check.'),
        401: UNAUTHORIZED,
        403: FORBIDDEN_READ,
        404: BLUEPRINT_NOT_FOUND,
      },
    },
    false,
  )

  registerRoute(registry, {
    method: 'post',
    path: '/admin/blueprints/{subject}/{kertas}/verify',
    tags: [BIJAK_STANDARDS_TAG],
    summary: 'Blueprint: set Spec to Disahkan (the only way to write Disahkan)',
    description: `Body { note } (required, not blank: 422 VALIDATION_ERROR fields.note "${BIJAK_STANDARDS_MESSAGES.noteRequired}"). Runs the AC-39.1 list and the AC-39.7 evidence comparison; on pass the head becomes Disahkan in one transaction, a verification row is recorded (insert-only), serves_students moves to it, and the action is audited. 422 VERIFICATION_FAILED lists every failure (details.check). 409 CONFLICT "${BIJAK_STANDARDS_MESSAGES.alreadyVerified}" [PROPOSED] when already Disahkan. ${SPEC} ${ROLE_NOTE}`,
    request: { params: BlueprintParams, headers: [csrf], body: body(BijakVerifyInputSchema) },
    responses: {
      200: json(envelopeOf(BijakBlueprintViewSchema), 'The blueprint, now Disahkan.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: BLUEPRINT_NOT_FOUND,
      409: err(`CONFLICT "${BIJAK_STANDARDS_MESSAGES.alreadyVerified}" [PROPOSED].`),
      422: json(
        z.union([BijakVerificationFailedErrorSchema, ErrorBodySchema]),
        `VERIFICATION_FAILED "${BIJAK_STANDARDS_MESSAGES.verificationFailed}" [PROPOSED] with details.check (every failure), or VALIDATION_ERROR for an invalid body.`,
      ),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/admin/blueprints/{subject}/{kertas}/sections/{position}/review',
    tags: [BIJAK_STANDARDS_TAG],
    summary: 'Blueprint: mark a section\'s seeded quota and KBAT values as reviewed (AC-39.9)',
    description: `Empty strict body {}. Sets reviewed on every quota line and kbatReviewed on the section of the HEAD row, in place, without changing any value and without a new version. Sahkan is refused (UNREVIEWED) while any line or KBAT value is "Belum disemak". 404 NOT_FOUND for an unknown blueprint or section position. 409 CONFLICT "${BIJAK_STANDARDS_MESSAGES.evidenceLocked}" [PROPOSED] when the head is Disahkan (edit through a new version). ${SPEC} ${ROLE_NOTE}`,
    request: { params: SectionParams, headers: [csrf], body: body(BijakSectionReviewInputSchema) },
    responses: {
      200: json(envelopeOf(BijakBlueprintViewSchema), 'The head blueprint with the section marked reviewed.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: err('NOT_FOUND (blueprint or section position).'),
      409: err(`CONFLICT "${BIJAK_STANDARDS_MESSAGES.evidenceLocked}" [PROPOSED] (the head is Disahkan).`),
      422: err('VALIDATION_ERROR (the body must be {}).'),
    },
  })

  registerRoute(
    registry,
    {
      method: 'get',
      path: '/admin/blueprints/{subject}/{kertas}/pool',
      tags: [BIJAK_STANDARDS_TAG],
      summary: 'Blueprint: Pratonton kolam (needed / available per line, verdict, excluded breakdown)',
      description: `Query version (default: the head). Computed by the same code and the same candidate list as Jana Kertas, so counts equal rows. The verdict comes from the reference attempt: boleh guarantees a generation on the same pool succeeds. An empty pool is not an error ("${BIJAK_STANDARDS_MESSAGES.poolEmpty}"). ${SPEC} ${ROLE_NOTE}`,
      request: { params: BlueprintParams, query: BijakPoolPreviewQuerySchema },
      responses: {
        200: json(envelopeOf(BijakPoolPreviewSchema), 'The pool preview.'),
        401: UNAUTHORIZED,
        403: FORBIDDEN_READ,
        404: BLUEPRINT_NOT_FOUND,
        422: err('VALIDATION_ERROR with fields (version).'),
      },
    },
    false,
  )

  registerRoute(registry, {
    method: 'post',
    path: '/admin/papers/generate',
    tags: [BIJAK_STANDARDS_TAG],
    summary: 'Jana draf kertas: a draft Kertas Pilihan generated from the head blueprint (AC-29.2)',
    description: `Same generator as Jana Kertas. Creates a draft pilihan paper that is opened for editing and never published automatically. Admin Pusat may use a Spec or Disahkan head. 422 NO_BLUEPRINT, 422 SHORTAGE and 503 GENERATE_LIMIT have the same shapes as POST /bijak/papers/generate. ${SPEC} ${ROLE_NOTE}`,
    request: { headers: [csrf], body: body(BijakDraftGenerateRequestSchema) },
    responses: {
      201: json(envelopeOf(BijakDraftGenerateResultSchema), 'The draft paper id.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      422: json(
        z.union([BijakGenerateNoBlueprintErrorSchema, BijakGenerateShortageErrorSchema, ErrorBodySchema]),
        'NO_BLUEPRINT, SHORTAGE (error.details.shortages) or VALIDATION_ERROR (subject, kertas).',
      ),
      500: err('SERVER_ERROR: the independent re-check found a violation (logged, never served).'),
      503: json(BijakGenerateLimitErrorSchema, 'GENERATE_LIMIT [PROPOSED]: solver budget reached.'),
    },
  })
}
