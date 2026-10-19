import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf, listEnvelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import { IdSchema } from '../../common/ids'
import {
  BIJAK_BUILDER_MESSAGES,
  BijakBlueprintAdminCreateSchema,
  BijakBlueprintAdminListQuerySchema,
  BijakBlueprintAdminSchema,
  BijakBlueprintAdminSectionInputSchema,
  BijakBlueprintAdminSectionSchema,
  BijakBlueprintAdminStatusSchema,
  BijakBlueprintAdminSummarySchema,
  BijakBlueprintAdminVersionInputSchema,
  BijakBlueprintAdminVersionSchema,
  BijakBuilderAnswerModeSchema,
  BijakBuilderBlueprintRefSchema,
  BijakBuilderConformanceRuleSchema,
  BijakBuilderConformanceSchema,
  BijakBuilderCsrfErrorSchema,
  BijakBuilderDeleteResultSchema,
  BijakBuilderGroupSplitErrorSchema,
  BijakBuilderIssueSchema,
  BijakBuilderPaperInputSchema,
  BijakBuilderPaperListQuerySchema,
  BijakBuilderPaperSchema,
  BijakBuilderPaperStatusSchema,
  BijakBuilderPaperSummarySchema,
  BijakBuilderPlacementInputSchema,
  BijakBuilderPlacementSchema,
  BijakBuilderPlacementsRequestSchema,
  BijakBuilderPublishRefusedErrorSchema,
  BijakBuilderQuestionRefSchema,
  BijakBuilderQuestionStatusSchema,
  BijakBuilderSectionCheckSchema,
  BijakBuilderSectionInputSchema,
  BijakBuilderSectionRuleSchema,
  BijakBuilderSectionSchema,
  BijakBuilderSectionsRequestSchema,
} from './schema'

/**
 * Components contributed by BE-39 (appended to COMPONENT_SCHEMAS in openapi.ts). Paper builder
 * ids are prefixed `BijakBuilder`, blueprint admin ids `BijakBlueprintAdmin`; none equals an id of
 * `bijak/papers` (`BijakPaper*`, `BijakBlueprintContract`, `BijakBlueprintSection`, ...).
 */
export const BIJAK_BUILDER_COMPONENT_SCHEMAS = {
  BijakBuilderQuestionStatus: BijakBuilderQuestionStatusSchema,
  BijakBuilderAnswerMode: BijakBuilderAnswerModeSchema,
  BijakBuilderSectionRule: BijakBuilderSectionRuleSchema,
  BijakBuilderPaperStatus: BijakBuilderPaperStatusSchema,
  BijakBuilderBlueprintRef: BijakBuilderBlueprintRefSchema,
  BijakBuilderQuestionRef: BijakBuilderQuestionRefSchema,
  BijakBuilderPlacement: BijakBuilderPlacementSchema,
  BijakBuilderSection: BijakBuilderSectionSchema,
  BijakBuilderPaperSummary: BijakBuilderPaperSummarySchema,
  BijakBuilderPaper: BijakBuilderPaperSchema,
  BijakBuilderPaperInput: BijakBuilderPaperInputSchema,
  BijakBuilderSectionInput: BijakBuilderSectionInputSchema,
  BijakBuilderSectionsRequest: BijakBuilderSectionsRequestSchema,
  BijakBuilderPlacementInput: BijakBuilderPlacementInputSchema,
  BijakBuilderPlacementsRequest: BijakBuilderPlacementsRequestSchema,
  BijakBuilderDeleteResult: BijakBuilderDeleteResultSchema,
  BijakBuilderPaperListQuery: BijakBuilderPaperListQuerySchema,
  BijakBuilderConformanceRule: BijakBuilderConformanceRuleSchema,
  BijakBuilderIssue: BijakBuilderIssueSchema,
  BijakBuilderSectionCheck: BijakBuilderSectionCheckSchema,
  BijakBuilderConformance: BijakBuilderConformanceSchema,
  BijakBuilderCsrfError: BijakBuilderCsrfErrorSchema,
  BijakBuilderPublishRefusedError: BijakBuilderPublishRefusedErrorSchema,
  BijakBuilderGroupSplitError: BijakBuilderGroupSplitErrorSchema,
  BijakBlueprintAdminSectionInput: BijakBlueprintAdminSectionInputSchema,
  BijakBlueprintAdminSection: BijakBlueprintAdminSectionSchema,
  BijakBlueprintAdminStatus: BijakBlueprintAdminStatusSchema,
  BijakBlueprintAdminVersionInput: BijakBlueprintAdminVersionInputSchema,
  BijakBlueprintAdminCreate: BijakBlueprintAdminCreateSchema,
  BijakBlueprintAdminVersion: BijakBlueprintAdminVersionSchema,
  BijakBlueprintAdminSummary: BijakBlueprintAdminSummarySchema,
  BijakBlueprintAdmin: BijakBlueprintAdminSchema,
  BijakBlueprintAdminListQuery: BijakBlueprintAdminListQuerySchema,
} as const

/** Tags of the two route groups (tests count operations by tag). */
export const BIJAK_BUILDER_TAG = 'bijak-builder'
export const BIJAK_BLUEPRINT_ADMIN_TAG = 'bijak-blueprint-admin'

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
const PaperIdParams = z.object({ id: IdSchema.meta({ description: 'Paper id.' }) })
const BlueprintIdParams = z.object({
  id: IdSchema.meta({ description: 'Blueprint (family) id, stable over versions.' }),
})

const ROLE_NOTE =
  'Admin Pusat only (D40a); Guru, Admin Sekolah and Murid get 403.'
const UNAUTHORIZED = err('UNAUTHORIZED (no valid session).')
const FORBIDDEN_READ = err('FORBIDDEN (the active role is not Admin Pusat).')
const FORBIDDEN_WRITE = json(
  z.union([ErrorBodySchema, BijakBuilderCsrfErrorSchema]),
  'FORBIDDEN (the active role is not Admin Pusat) or CSRF_INVALID "Sesi tidak sah. Sila muat semula halaman dan cuba lagi." (missing or wrong X-CSRF-Token).',
)
const PAPER_NOT_FOUND = err(`NOT_FOUND "${BIJAK_BUILDER_MESSAGES.paperNotFound}".`)
const BLUEPRINT_NOT_FOUND = err(`NOT_FOUND "${BIJAK_BUILDER_MESSAGES.blueprintNotFound}".`)
const PAPER_LOCKED = err(`CONFLICT "${BIJAK_BUILDER_MESSAGES.paperLocked}" (the paper is published).`)

/**
 * Registers the 14 admin routes of BE-39. There is no mock route or mock method behind them: the
 * paths are fixed by this contract (card BE-39 Endpoints). Every response is `{ data }`,
 * `{ data, meta }` or `{ error }`; every mutation needs `X-CSRF-Token`.
 */
export function registerBijakBuilderPaths(registry: OpenAPIRegistry): void {
  /* ----------------------------------------------------------------------------- papers */

  registry.registerPath({
    method: 'get',
    path: '/admin/papers',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: list paper drafts and published papers',
    description: `Newest update first. Filters: status, subject, kertas, q (title contains). \`meta.counts\` carries one count per status over the whole set. ${ROLE_NOTE}`,
    request: { query: BijakBuilderPaperListQuerySchema },
    responses: {
      200: json(listEnvelopeOf(BijakBuilderPaperSummarySchema), 'Papers (paged).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/papers',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: create a paper draft',
    description: `Creates a paper with status draft, version 1 and no sections. Sections and placements are set with the two PUT routes. A retired blueprint is refused (422 fields.blueprint "${BIJAK_BUILDER_MESSAGES.blueprintRetired}"). ${ROLE_NOTE}`,
    request: { headers: [csrf], body: body(BijakBuilderPaperInputSchema) },
    responses: {
      201: json(envelopeOf(BijakBuilderPaperSchema), 'The created draft.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: BLUEPRINT_NOT_FOUND,
      422: err('VALIDATION_ERROR with fields (title, subject, kertas, year, code, durationMin, blueprint).'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/papers/{id}',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: one paper with sections and ordered placements',
    description: `Includes the placed question ids, pinned versions and a read-only question summary for each placement. ${ROLE_NOTE}`,
    request: { params: PaperIdParams },
    responses: {
      200: json(envelopeOf(BijakBuilderPaperSchema), 'The paper.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
      404: PAPER_NOT_FOUND,
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/papers/{id}',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: replace the paper header',
    description: `Replaces title, subject, kertas, year, code, durationMin, instructions, reference and the selected blueprint version (same body as create). Refused with 409 while the paper is published (withdraw it first). The status is re-evaluated after the change (a ready paper that no longer conforms goes back to draft). ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf], body: body(BijakBuilderPaperInputSchema) },
    responses: {
      200: json(envelopeOf(BijakBuilderPaperSchema), 'The updated paper.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: err(
        `NOT_FOUND "${BIJAK_BUILDER_MESSAGES.paperNotFound}" or "${BIJAK_BUILDER_MESSAGES.blueprintNotFound}" (unknown blueprint reference).`,
      ),
      409: PAPER_LOCKED,
      422: err('VALIDATION_ERROR with fields; a retired blueprint is refused (fields.blueprint).'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/admin/papers/{id}',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: delete a draft',
    description: `Only while the status is draft; any other status answers 409 CONFLICT "${BIJAK_BUILDER_MESSAGES.deleteNotDraft}". Answers 200 with { data: { deleted: 1 } }, not 204. ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(BijakBuilderDeleteResultSchema), 'Deleted.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
      409: err(`CONFLICT "${BIJAK_BUILDER_MESSAGES.deleteNotDraft}".`),
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/papers/{id}/sections',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: replace the ordered section list',
    description: `The array order is the section order; an item with an existing id keeps its placements, an item without id is created. A section that is left out is removed and must hold no placement (422 fields.sections "${BIJAK_BUILDER_MESSAGES.sectionHasPlacements}"). Answers the whole paper. Refused with 409 while the paper is published. ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf], body: body(BijakBuilderSectionsRequestSchema) },
    responses: {
      200: json(envelopeOf(BijakBuilderPaperSchema), 'The paper with the new sections.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
      409: PAPER_LOCKED,
      422: err('VALIDATION_ERROR with fields (sections, sections.N.label, sections.N.rule, sections.N.markBudget).'),
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/papers/{id}/placements',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: replace the ordered placements',
    description: `Every placement of the paper, in order; the array order is the order inside each section. Questions of one stimulus group (D6) must stay in one section and stay consecutive, otherwise 422 VALIDATION_ERROR "${BIJAK_BUILDER_MESSAGES.groupSplit}" with details.groups. A question may appear once (422 "${BIJAK_BUILDER_MESSAGES.duplicateQuestion}"). Unknown section or question id: 422 with fields. Questions of any lifecycle status may be placed in a draft; only published ones pass the publish gate. An explicit pinnedVersion must exist. Refused with 409 while the paper is published. Answers the whole paper; the status is re-evaluated. ${ROLE_NOTE}`,
    request: {
      params: PaperIdParams,
      headers: [csrf],
      body: body(BijakBuilderPlacementsRequestSchema),
    },
    responses: {
      200: json(envelopeOf(BijakBuilderPaperSchema), 'The paper with the new placements.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
      409: PAPER_LOCKED,
      422: {
        description:
          'VALIDATION_ERROR: a stimulus group split (details.groups), a duplicate question, an unknown sectionId or questionId, or an invalid body (fields).',
        content: {
          'application/json': {
            schema: z.union([BijakBuilderGroupSplitErrorSchema, ErrorBodySchema]),
          },
        },
      },
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/papers/{id}/conformance',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: conformance report and shortages against the blueprint version',
    description: `Computed with the shared exam-core engine: marks budget per section, allowed modes, question counts and choose-N rules, plus group integrity and the published status of every placed question. Lists every gap with its section and rule; \`shortages\` has { section, need, have } per blueprint section the paper cannot fill. A paper without a blueprint reports a blueprint gap. Always 200. ${ROLE_NOTE}`,
    request: { params: PaperIdParams },
    responses: {
      200: json(envelopeOf(BijakBuilderConformanceSchema), 'The conformance report.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
      404: PAPER_NOT_FOUND,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/papers/{id}/publish',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: publish to student Bijak SPM (Kertas Pilihan)',
    description: `No request body. Gate (v2-question-bank 4.8): every placed question is published and the paper conforms to its blueprint version. On success the placements are pinned to the question versions in force, the status becomes published and the paper appears in GET /bijak/papers; a later edit of a question (version n+1) does not change it. On failure nothing changes: 422 VALIDATION_ERROR "${BIJAK_BUILDER_MESSAGES.publishRefused}" with details.issues and details.shortages. Allowed from draft, ready or withdrawn (working assumption, open question); an already published paper answers 409 CONFLICT "${BIJAK_BUILDER_MESSAGES.alreadyPublished}". Writes an audit event. ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(BijakBuilderPaperSchema), 'The published paper with pinned versions.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
      409: err(`CONFLICT "${BIJAK_BUILDER_MESSAGES.alreadyPublished}".`),
      422: json(
        z.union([BijakBuilderPublishRefusedErrorSchema, ErrorBodySchema]),
        'VALIDATION_ERROR: the publish gate failed (details.issues, details.shortages).',
      ),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/papers/{id}/withdraw',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: withdraw a published paper from Kertas Pilihan',
    description: `No request body. The paper disappears from GET /bijak/papers; attempts already started on it are unaffected. Only a published paper can be withdrawn: any other status answers 409 CONFLICT "${BIJAK_BUILDER_MESSAGES.notPublished}". Writes an audit event. ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(BijakBuilderPaperSchema), 'The withdrawn paper.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
      409: err(`CONFLICT "${BIJAK_BUILDER_MESSAGES.notPublished}".`),
    },
  })

  /* ------------------------------------------------------------------------- blueprints */

  registry.registerPath({
    method: 'get',
    path: '/admin/blueprints',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint admin: list blueprints (Kontrak) with their latest version',
    description: `One row per blueprint (subject and kertas), newest update first. Filters: subject, kertas, status. Includes blueprints whose source is Draf and retired ones when status is not filtered. ${ROLE_NOTE}`,
    request: { query: BijakBlueprintAdminListQuerySchema },
    responses: {
      200: json(listEnvelopeOf(BijakBlueprintAdminSummarySchema), 'Blueprints (paged).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/blueprints',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint admin: create a blueprint (version 1)',
    description: `Subject and kertas identify the blueprint (generation finds a blueprint by that pair). A second blueprint for the same pair answers 409 CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintExists}" (working assumption): create a new version instead. The version starts active with its provenance tag (source Disahkan, Spec or Draf). ${ROLE_NOTE}`,
    request: { headers: [csrf], body: body(BijakBlueprintAdminCreateSchema) },
    responses: {
      201: json(envelopeOf(BijakBlueprintAdminSchema), 'The created blueprint with version 1.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      409: err(`CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintExists}".`),
      422: err('VALIDATION_ERROR with fields (subject, kertas, code, durationMin, sections, sections.N.*).'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/blueprints/{id}',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint admin: one blueprint with every version',
    description: `Versions are newest first; each carries \`locked\` (true once a published paper uses it). ${ROLE_NOTE}`,
    request: { params: BlueprintIdParams },
    responses: {
      200: json(envelopeOf(BijakBlueprintAdminSchema), 'The blueprint with its versions.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
      404: BLUEPRINT_NOT_FOUND,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/blueprints/{id}/versions',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint admin: add a new version (the only way to edit)',
    description: `Creates version n+1 from the full body; earlier versions stay exactly as they were (a version used by a published paper is immutable). A retired blueprint answers 409 CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintAlreadyRetired}". ${ROLE_NOTE}`,
    request: {
      params: BlueprintIdParams,
      headers: [csrf],
      body: body(BijakBlueprintAdminVersionInputSchema),
    },
    responses: {
      201: json(envelopeOf(BijakBlueprintAdminSchema), 'The blueprint including the new version.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: BLUEPRINT_NOT_FOUND,
      409: err(`CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintAlreadyRetired}".`),
      422: err('VALIDATION_ERROR with fields (code, durationMin, sections, sections.N.*).'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/blueprints/{id}/retire',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint admin: retire a blueprint',
    description: `No request body. Every version becomes retired: it cannot be chosen by a new paper. Papers already published keep their pinned version. Retiring a retired blueprint answers 409 CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintAlreadyRetired}". Writes an audit event. ${ROLE_NOTE}`,
    request: { params: BlueprintIdParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(BijakBlueprintAdminSchema), 'The retired blueprint.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: BLUEPRINT_NOT_FOUND,
      409: err(`CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintAlreadyRetired}".`),
    },
  })
}
