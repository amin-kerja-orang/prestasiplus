import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf, listEnvelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import { IdSchema } from '../../common/ids'
import { registerRoute } from './rate-limit'
import {
  BIJAK_BUILDER_MESSAGES,
  BijakBlueprintAdminCreateSchema,
  BijakBlueprintAdminSectionInputSchema,
  BijakBlueprintAdminVersionInputSchema,
  BijakBlueprintListQuerySchema,
  BijakBlueprintViewSchema,
  BijakBuilderAnswerModeSchema,
  BijakBuilderCsrfErrorSchema,
  BijakBuilderEditorSchema,
  BijakBuilderGroupSchema,
  BijakBuilderOkSchema,
  BijakBuilderPaperCreateResultSchema,
  BijakBuilderPaperCreateSchema,
  BijakBuilderPaperListQuerySchema,
  BijakBuilderPaperPatchSchema,
  BijakBuilderPaperSchema,
  BijakBuilderPaperSectionSchema,
  BijakBuilderPaperStatusSchema,
  BijakBuilderPaperSummarySchema,
  BijakBuilderPreviewSchema,
  BijakBuilderPublishResultSchema,
  BijakBuilderQuestionSchema,
  BijakBuilderSectionCheckSchema,
  BijakBuilderSectionPatchSchema,
  BijakBuilderSectionRuleSchema,
} from './schema'

/**
 * Components contributed by BE-39 (appended to COMPONENT_SCHEMAS in openapi.ts). Paper builder
 * ids are prefixed `BijakBuilder`, blueprint ids `BijakBlueprint`; none equals an id of
 * `bijak/papers` (`BijakPaper*`, `BijakBlueprintContract`, `BijakBlueprintSection`, ...) or of
 * `bijak/attempts` (`BijakAttempt*`).
 */
export const BIJAK_BUILDER_COMPONENT_SCHEMAS = {
  BijakBuilderAnswerMode: BijakBuilderAnswerModeSchema,
  BijakBuilderSectionRule: BijakBuilderSectionRuleSchema,
  BijakBuilderPaperStatus: BijakBuilderPaperStatusSchema,
  BijakBuilderSectionCheck: BijakBuilderSectionCheckSchema,
  BijakBuilderPaperSection: BijakBuilderPaperSectionSchema,
  BijakBuilderPaperSummary: BijakBuilderPaperSummarySchema,
  BijakBuilderPaper: BijakBuilderPaperSchema,
  BijakBuilderQuestion: BijakBuilderQuestionSchema,
  BijakBuilderGroup: BijakBuilderGroupSchema,
  BijakBuilderEditor: BijakBuilderEditorSchema,
  BijakBuilderPaperCreate: BijakBuilderPaperCreateSchema,
  BijakBuilderPaperCreateResult: BijakBuilderPaperCreateResultSchema,
  BijakBuilderSectionPatch: BijakBuilderSectionPatchSchema,
  BijakBuilderPaperPatch: BijakBuilderPaperPatchSchema,
  BijakBuilderOk: BijakBuilderOkSchema,
  BijakBuilderPublishResult: BijakBuilderPublishResultSchema,
  BijakBuilderPreview: BijakBuilderPreviewSchema,
  BijakBuilderPaperListQuery: BijakBuilderPaperListQuerySchema,
  BijakBuilderCsrfError: BijakBuilderCsrfErrorSchema,
  BijakBlueprintView: BijakBlueprintViewSchema,
  BijakBlueprintAdminSectionInput: BijakBlueprintAdminSectionInputSchema,
  BijakBlueprintAdminVersionInput: BijakBlueprintAdminVersionInputSchema,
  BijakBlueprintAdminCreate: BijakBlueprintAdminCreateSchema,
  BijakBlueprintListQuery: BijakBlueprintListQuerySchema,
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

const ROLE_NOTE = 'Admin Pusat only (D40a); Guru, Admin Sekolah and Murid get 403.'
const COPY_NOTE =
  'The BM copy of this route is [PROPOSED] per D58b (strings quoted by the LEAD review are kept verbatim; the LEAD aligns them when the prototype code is pushed).'
const UNAUTHORIZED = err('UNAUTHORIZED (no valid session).')
const FORBIDDEN_READ = err('FORBIDDEN (the active role is not Admin Pusat).')
const FORBIDDEN_WRITE = json(
  z.union([ErrorBodySchema, BijakBuilderCsrfErrorSchema]),
  'FORBIDDEN (the active role is not Admin Pusat) or CSRF_INVALID "Sesi tidak sah. Sila muat semula halaman dan cuba lagi." (missing or wrong X-CSRF-Token).',
)
const PAPER_NOT_FOUND = err(`NOT_FOUND "${BIJAK_BUILDER_MESSAGES.paperNotFound}".`)
const BLUEPRINT_NOT_FOUND = err(
  `NOT_FOUND "${BIJAK_BUILDER_MESSAGES.blueprintNotFound}" [PROPOSED].`,
)
const PAPER_LOCKED = err(
  `CONFLICT "${BIJAK_BUILDER_MESSAGES.paperLocked}" [PROPOSED] (the paper is terbit; HTTP status 409 is [PROPOSED], the mock throws the message).`,
)

/**
 * Registers the 13 admin operations of BE-39 (8 paper, 5 blueprint). The paper routes follow the
 * paper builder mock as quoted by the LEAD review (the mock is not pushed yet); the blueprint write
 * routes (create, version, retire) have NO mock and exist only because the card requires them.
 * Every response is `{ data }`, `{ data, meta }` or `{ error }`; every mutation needs
 * `X-CSRF-Token`.
 *
 * Removed from the first draft, because the mock has no counterpart: `PUT /admin/papers/{id}/sections`,
 * `PUT /admin/papers/{id}/placements` and `GET /admin/papers/{id}/conformance` (the conformance
 * lines are `paper.checks`; publish returns them as `errors`).
 *
 * D57: every write route (POST, PUT, DELETE) also answers 429 RATE_LIMITED with retryAfter and a
 * Retry-After header (added by `registerRoute`). D57(b): no response carries a credential or token,
 * so none sends Cache-Control: no-store. D57(d)/(e): not applicable (no student search, no role
 * assignment; every route is Admin Pusat only).
 */
export function registerBijakBuilderPaths(registry: OpenAPIRegistry): void {
  /* ----------------------------------------------------------------------------- papers */

  registerRoute(registry, {
    method: 'get',
    path: '/admin/papers',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: list papers (draf and terbit)',
    description: `Newest update first. Optional filter: status. Each row carries budget and ok. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { query: BijakBuilderPaperListQuerySchema },
    responses: {
      200: json(listEnvelopeOf(BijakBuilderPaperSummarySchema), 'Papers (paged).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/admin/papers',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: create a paper (createPaper)',
    description: `Body { subject, kertas, title? }. The sections come from the blueprint of that subject and kertas and start empty; the status is draf. Answers the new id. No blueprint for the pair: 422 fields.subject "${BIJAK_BUILDER_MESSAGES.noBlueprint}". ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { headers: [csrf], body: body(BijakBuilderPaperCreateSchema) },
    responses: {
      201: json(envelopeOf(BijakBuilderPaperCreateResultSchema), 'The new paper id.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      422: err(
        `VALIDATION_ERROR with fields (subject "${BIJAK_BUILDER_MESSAGES.noBlueprint}", kertas, title "${BIJAK_BUILDER_MESSAGES.titleRequired}").`,
      ),
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/admin/papers/{id}',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: the editor read (getPaperEditor)',
    description: `The paper with its sections, question ids and section checks, plus the picker candidates (questions) and the stimulus groups. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: PaperIdParams },
    responses: {
      200: json(envelopeOf(BijakBuilderEditorSchema), 'The paper, picker questions and groups.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
      404: PAPER_NOT_FOUND,
    },
  })

  registerRoute(registry, {
    method: 'put',
    path: '/admin/papers/{id}',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: edit a paper (single PUT, PaperPatch)',
    description: `Body { title?, year?, durationMin?, sections?: [{ id, questionIds }] }; only the keys sent change. This one route carries every edit (the first draft's separate sections and placements routes are gone). Refused with 409 "${BIJAK_BUILDER_MESSAGES.paperLocked}" while the paper is terbit. 422 fields: title "${BIJAK_BUILDER_MESSAGES.titleRequired}", sections "${BIJAK_BUILDER_MESSAGES.invalidSection}" (unknown section id) or "${BIJAK_BUILDER_MESSAGES.invalidQuestion}" (a question that cannot go on this paper). Duplicates and split groups are not refused here; they show up in checks and block publish. Answers the updated paper. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf], body: body(BijakBuilderPaperPatchSchema) },
    responses: {
      200: json(envelopeOf(BijakBuilderPaperSchema), 'The updated paper.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
      409: PAPER_LOCKED,
      422: err('VALIDATION_ERROR with fields (title, year, durationMin, sections).'),
    },
  })

  registerRoute(registry, {
    method: 'delete',
    path: '/admin/papers/{id}',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: delete a paper (idempotent)',
    description: `Idempotent, as the mock deletePaper: an unknown id also answers 200 { data: { ok: true } } (so there is no 404). A terbit paper answers 409 CONFLICT "${BIJAK_BUILDER_MESSAGES.deleteTerbit}" [PROPOSED]; unpublish it first. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(BijakBuilderOkSchema), 'Deleted, or there was nothing to delete.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      409: err(`CONFLICT "${BIJAK_BUILDER_MESSAGES.deleteTerbit}" [PROPOSED].`),
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/admin/papers/{id}/preview',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: student-view preview of the paper questions (previewQuestions)',
    description: `The saved questions of the paper as a student sees them, with each question's option bank and each group's stimulus (the BE-16 student views, so no answer key and no scheme). Result shape [PROPOSED]. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: PaperIdParams },
    responses: {
      200: json(envelopeOf(BijakBuilderPreviewSchema), 'Questions and groups in the student view.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
      404: PAPER_NOT_FOUND,
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/admin/papers/{id}/publish',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: publish (draf to terbit)',
    description: `No request body. A normal 200 result (not an error): { ok: true }, or { ok: false, errors: string[] } with the BM lines built from checkPaper, for example "Soalan berulang dalam kertas: ..." and "Kumpulan rangsangan X dipecahkan antara dua bahagian" (plus the section lines, for example "Bahagian A: perlu 3 soalan, hanya 2 tersedia"). Nothing changes on ok: false. On ok: true the status becomes terbit and the paper appears in GET /bijak/papers; implementations pin the question versions in force (a later edit, version n+1, does not change the paper). Publishing a paper that is already terbit is a no-op { ok: true } [PROPOSED]. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(BijakBuilderPublishResultSchema), 'Publish result (ok true or false).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/admin/papers/{id}/withdraw',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: unpublish, tarik balik (terbit back to draf)',
    description: `No request body. The status goes back to draf (the mock's unpublish; there is no withdrawn state). The paper leaves GET /bijak/papers; attempts already started are unaffected. A paper that is already draf is a no-op. Path name /withdraw follows the card ("tarik balik"); the mock's method name is not known [PROPOSED]. Answers the paper. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(BijakBuilderPaperSchema), 'The paper, now draf.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
    },
  })

  /* ------------------------------------------------------------------------- blueprints */

  registerRoute(registry, {
    method: 'get',
    path: '/admin/blueprints',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint: list blueprints (slim BlueprintView, latest version)',
    description: `One row per blueprint (subject and kertas). Filters: subject, kertas. The view is slim ([PROPOSED] field list): no pool tags, no version history. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { query: BijakBlueprintListQuerySchema },
    responses: {
      200: json(listEnvelopeOf(BijakBlueprintViewSchema), 'Blueprints (paged).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/admin/blueprints/{id}',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint: one blueprint (slim BlueprintView, latest version)',
    description: `${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: BlueprintIdParams },
    responses: {
      200: json(envelopeOf(BijakBlueprintViewSchema), 'The blueprint.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
      404: BLUEPRINT_NOT_FOUND,
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/admin/blueprints',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint admin: create a blueprint, version 1 (NO MOCK)',
    description: `No mock exists for blueprint writes; kept because the card requires them. A second blueprint for the same subject and kertas answers 409 CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintExists}" [PROPOSED]: add a version instead. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { headers: [csrf], body: body(BijakBlueprintAdminCreateSchema) },
    responses: {
      201: json(envelopeOf(BijakBlueprintViewSchema), 'The created blueprint (version 1).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      409: err(`CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintExists}" [PROPOSED].`),
      422: err(
        'VALIDATION_ERROR with fields (subject, kertas, code, durationMin, sections, sections.N.*).',
      ),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/admin/blueprints/{id}/versions',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint admin: add a new version, the only way to edit (NO MOCK)',
    description: `No mock exists; kept because the card requires it. Creates version n+1 from the full body; earlier versions stay as they were (a version used by a terbit paper is immutable). A retired blueprint answers 409 CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintAlreadyRetired}" [PROPOSED]. Answers the slim view of the new latest version. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: {
      params: BlueprintIdParams,
      headers: [csrf],
      body: body(BijakBlueprintAdminVersionInputSchema),
    },
    responses: {
      201: json(envelopeOf(BijakBlueprintViewSchema), 'The blueprint at its new version.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: BLUEPRINT_NOT_FOUND,
      409: err(`CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintAlreadyRetired}" [PROPOSED].`),
      422: err('VALIDATION_ERROR with fields (code, durationMin, sections, sections.N.*).'),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/admin/blueprints/{id}/retire',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint admin: retire a blueprint (NO MOCK)',
    description: `No mock exists; kept because the card requires it. No request body. Every version becomes retired: new papers cannot be created from it. Terbit papers keep their version. Retiring a retired blueprint answers 409 CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintAlreadyRetired}" [PROPOSED]. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: BlueprintIdParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(BijakBlueprintViewSchema), 'The retired blueprint.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: BLUEPRINT_NOT_FOUND,
      409: err(`CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintAlreadyRetired}" [PROPOSED].`),
    },
  })
}
