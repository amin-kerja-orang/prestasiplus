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
  BijakBlueprintViewSectionSchema,
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
  BijakBuilderPreviewRequestSchema,
  BijakBuilderPreviewSchema,
  BijakBuilderPublishResultSchema,
  BijakBuilderQuestionSchema,
  BijakBuilderQuestionStatusSchema,
  BijakBuilderReviewQuestionSchema,
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
  BijakBuilderSectionRule: BijakBuilderSectionRuleSchema,
  BijakBuilderPaperStatus: BijakBuilderPaperStatusSchema,
  BijakBuilderQuestionStatus: BijakBuilderQuestionStatusSchema,
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
  BijakBuilderPreviewRequest: BijakBuilderPreviewRequestSchema,
  BijakBuilderReviewQuestion: BijakBuilderReviewQuestionSchema,
  BijakBuilderPreview: BijakBuilderPreviewSchema,
  BijakBuilderPaperListQuery: BijakBuilderPaperListQuerySchema,
  BijakBuilderCsrfError: BijakBuilderCsrfErrorSchema,
  BijakBlueprintViewSection: BijakBlueprintViewSectionSchema,
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
const BlueprintParams = z.object({
  subject: z.string().min(1).max(32).meta({ description: 'Subject code.', example: 'MAT' }),
  kertas: z.coerce.number().int().min(1).meta({ description: 'Kertas number.', example: 2 }),
})

const ROLE_NOTE = 'Admin Pusat only (D40a); Guru, Admin Sekolah and Murid get 403.'
const COPY_NOTE =
  'BM strings quoted from the mock server/admin.ts are confirmed by the LEAD round-3 review; any string or field the mock does not have is marked [PROPOSED].'
const ERROR_NOTE =
  'The mock throws bad_request for every refusal; ErrorCode has no BAD_REQUEST, so the refusal is 422 VALIDATION_ERROR (mapping awaits the LEAD decision, deviations log).'
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
/**
 * Registers the 13 admin operations of BE-39 (8 paper, 5 blueprint). The paper routes follow the
 * paper builder mock as quoted by the LEAD review (the mock is not on GitHub yet); the blueprint
 * write routes (create, version, retire) have NO mock and exist only because the card requires
 * them. Every response is `{ data }`, `{ data, meta }` or `{ error }`; every mutation needs
 * `X-CSRF-Token`.
 *
 * Removed from the first draft, because the mock has no counterpart: `PUT /admin/papers/{id}/sections`,
 * `PUT /admin/papers/{id}/placements` and `GET /admin/papers/{id}/conformance` (the conformance
 * lines are the publish `errors`).
 *
 * D57: every write route (POST, PUT, DELETE) also answers 429 RATE_LIMITED with retryAfter and a
 * Retry-After header (added by `registerRoute`); the preview is a POST and so carries it too. D57(b):
 * no response carries a credential or token, so none sends Cache-Control: no-store. D57(d)/(e): not
 * applicable (no student search, no role assignment; every route is Admin Pusat only).
 */
export function registerBijakBuilderPaths(registry: OpenAPIRegistry): void {
  /* ----------------------------------------------------------------------------- papers */

  registerRoute(registry, {
    method: 'get',
    path: '/admin/papers',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: list papers (draf and terbit)',
    description: `Newest update first. Optional filter: status. Each row (AdminPaperSummary) carries subjectName, code, budget and ok. The mock listAdminPapers returns a plain array; this route is paged (deviations log). ${COPY_NOTE} ${ROLE_NOTE}`,
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
    description: `Body { subject, kertas, title? }. The sections come from the blueprint of that subject and kertas and start empty; the status is draf. Answers the new id. No blueprint for the pair: a plain 422 VALIDATION_ERROR "${BIJAK_BUILDER_MESSAGES.noBlueprint}" with no field (the mock throws it without a field). ${ERROR_NOTE} ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { headers: [csrf], body: body(BijakBuilderPaperCreateSchema) },
    responses: {
      201: json(envelopeOf(BijakBuilderPaperCreateResultSchema), 'The new paper id.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      422: err(
        `VALIDATION_ERROR: no blueprint "${BIJAK_BUILDER_MESSAGES.noBlueprint}" (no field), or fields (subject, kertas, title "${BIJAK_BUILDER_MESSAGES.titleRequired}").`,
      ),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/admin/papers/preview',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: student-view preview of questions, saved or not (previewQuestions)',
    description: `Body { ids }: the question ids currently in the editor, so unsaved edits can be previewed (the mock previewQuestions(ids)). Answers { questions, stimuli, optionBanks }: the questions as a student sees them, the stimulus of each group by group id and the shared option bank of each group by group id. It never carries an answer key or scheme. It reads only; it is a POST because it takes a body, so it needs the CSRF header and is rate limited. Ids that do not exist are left out [PROPOSED]. The ReviewQuestion field list is derived from the BE-16 student view [PROPOSED]. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { headers: [csrf], body: body(BijakBuilderPreviewRequestSchema) },
    responses: {
      200: json(envelopeOf(BijakBuilderPreviewSchema), 'Questions, stimuli and option banks.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      422: err('VALIDATION_ERROR with fields (ids).'),
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/admin/papers/{id}',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: the editor read (getPaperEditor)',
    description: `PaperEditorData: the paper (AdminPaper, with sections and question ids), the blueprint of its subject and kertas (BlueprintView, or null), the picker candidates (BuilderQuestion) and the stimulus groups (BuilderGroup). ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: PaperIdParams },
    responses: {
      200: json(
        envelopeOf(BijakBuilderEditorSchema),
        'The paper, its blueprint, picker questions and groups.',
      ),
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
    description: `Body { title?, year?, durationMin?, sections?: [{ id, questionIds }] }; only the keys sent change. This one route carries every edit. A terbit paper is refused: 422 VALIDATION_ERROR "${BIJAK_BUILDER_MESSAGES.paperLocked}" (no field). Other refusals: title "${BIJAK_BUILDER_MESSAGES.titleRequired}"; a section id that is not a section of the paper "${BIJAK_BUILDER_MESSAGES.invalidSection}"; a question whose curriculum subject differs from the paper subject "${BIJAK_BUILDER_MESSAGES.invalidQuestion}" (a subject check only, not a kertas or status check). Duplicates and split groups are not refused here; they come back as publish errors. Answers the updated paper. ${ERROR_NOTE} ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf], body: body(BijakBuilderPaperPatchSchema) },
    responses: {
      200: json(envelopeOf(BijakBuilderPaperSchema), 'The updated paper.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
      422: json(
        ErrorBodySchema,
        `VALIDATION_ERROR: the paper is terbit "${BIJAK_BUILDER_MESSAGES.paperLocked}", or a field is invalid (title, year, durationMin, sections).`,
      ),
    },
  })

  registerRoute(registry, {
    method: 'delete',
    path: '/admin/papers/{id}',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: delete a paper (idempotent)',
    description: `Idempotent, as the mock deletePaper: an unknown id also answers 200 { data: { ok: true } } (so there is no 404). A terbit paper answers 422 VALIDATION_ERROR "${BIJAK_BUILDER_MESSAGES.deleteTerbit}" (no field); unpublish it first. ${ERROR_NOTE} ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(BijakBuilderOkSchema), 'Deleted, or there was nothing to delete.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      422: err(`VALIDATION_ERROR "${BIJAK_BUILDER_MESSAGES.deleteTerbit}" (no field).`),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/admin/papers/{id}/publish',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: publish (draf to terbit)',
    description: `No request body. A normal 200 result (not an error): { ok: true, errors: [] }, or { ok: false, errors: string[] } with the BM lines built by checkPaper, each prefixed with the section label ("{label}: "): "Kurang N soalan (perlu X, ada Y)", "Markah M tidak sama dengan bajet B", "{N} soalan belum Terbit", "Kumpulan rangsangan G tidak berturutan", "tidak lengkap", and the paper-wide "Soalan berulang dalam kertas: ..." and "Kumpulan rangsangan X dipecahkan antara dua bahagian". Nothing changes on ok: false. On ok: true the status becomes terbit and the paper appears in GET /bijak/papers; implementations pin the question versions in force (a later edit, version n+1, does not change the paper). Publishing a paper that is already terbit is a no-op { ok: true, errors: [] } [PROPOSED]. ${COPY_NOTE} ${ROLE_NOTE}`,
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
    description: `No request body. The status goes back to draf (the mock unpublishPaper; there is no withdrawn state). The paper leaves GET /bijak/papers; attempts already started are unaffected. A paper that is already draf is a no-op [PROPOSED]. The path name follows the card ("tarik balik"). The mock method returns void; this route answers the updated paper (deviations log). ${COPY_NOTE} ${ROLE_NOTE}`,
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
    summary: 'Blueprint: list blueprints (BlueprintView, latest active version)',
    description: `One row per blueprint (subject and kertas), as the mock listBlueprints (BlueprintView). Filters: subject, kertas. Retired blueprints are not listed [PROPOSED]. The mock returns a plain array; this route is paged (deviations log). ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { query: BijakBlueprintListQuerySchema },
    responses: {
      200: json(listEnvelopeOf(BijakBlueprintViewSchema), 'Blueprints (paged).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/admin/blueprints/{subject}/{kertas}',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint: one blueprint by subject and kertas (BlueprintView)',
    description: `BlueprintView has no id, so a blueprint is addressed by subject and kertas, as the mock does. Route path is [PROPOSED]. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: BlueprintParams },
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
    path: '/admin/blueprints/{subject}/{kertas}/versions',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint admin: add a new version, the only way to edit (NO MOCK)',
    description: `No mock exists; kept because the card requires it. Creates version n+1 from the full body; earlier versions stay as they were (a version used by a terbit paper is immutable). The version number is internal and not part of BlueprintView. A retired blueprint answers 409 CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintAlreadyRetired}" [PROPOSED]. Answers the view of the new latest version. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: {
      params: BlueprintParams,
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
    path: '/admin/blueprints/{subject}/{kertas}/retire',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint admin: retire a blueprint (NO MOCK)',
    description: `No mock exists; kept because the card requires it. No request body. Every version becomes retired: it is no longer listed and new papers cannot be created from it. Terbit papers keep their version. Retiring a retired blueprint answers 409 CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintAlreadyRetired}" [PROPOSED]. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: BlueprintParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(BijakBuilderOkSchema), 'Retired.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: BLUEPRINT_NOT_FOUND,
      409: err(`CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintAlreadyRetired}" [PROPOSED].`),
    },
  })
}
