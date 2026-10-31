import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf, listEnvelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import { IdSchema } from '../../common/ids'
import { registerRoute } from './rate-limit'
import { BijakBlueprintInvalidErrorSchema, BijakPoolPreviewSchema } from '../standards/admin'
import { BIJAK_STANDARDS_MESSAGES } from '../standards/schema'
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
  BijakBuilderGroupLabelSchema,
  BijakBuilderPublishRequestSchema,
  BijakSectionPoolOptionSchema,
  BijakSectionPoolsRequestSchema,
  BijakSectionPoolsSchema,
  BijakBuilderBlockerSchema,
  BijakBuilderOkSchema,
  BijakBuilderPaperCreateResultSchema,
  BijakBuilderPaperCreateSchema,
  BijakBuilderPaperListQuerySchema,
  BijakBuilderPaperPatchSchema,
  BijakBuilderPaperSchema,
  BijakBuilderPaperSectionSchema,
  BijakBuilderPaperStatusSchema,
  BijakBuilderPaperSummarySchema,
  BijakBuilderPlacementAddSchema,
  BijakBuilderPlacementResultSchema,
  BijakBuilderPoolPreviewQuerySchema,
  BijakBuilderPoolUnitSchema,
  BijakBuilderReviewRowSchema,
  BijakBuilderReviewSchema,
  BijakBuilderSectionOrderSchema,
  BijakBuilderSectionPoolQuerySchema,
  BijakBuilderStudentQuestionSchema,
  BijakBuilderStudentUnitSchema,
  BijakBuilderStudentViewSchema,
  BijakBuilderPreviewRequestSchema,
  BijakBuilderPreviewSchema,
  BijakBuilderPublishResultSchema,
  BijakBuilderQuestionSchema,
  BijakBuilderQuestionKindSchema,
  BijakBuilderQuestionStatusSchema,
  BijakBuilderCurriculumTagSchema,
  BijakBuilderSchemeLineSchema,
  BijakBuilderReviewQuestionSchema,
  BijakBuilderSectionPatchSchema,
  BijakBuilderSectionRuleSchema,
} from './schema'

/**
 * Components contributed by BE-39 (appended to COMPONENT_SCHEMAS in openapi.ts). Typed as a plain record, not `as const`: the many literal types of this map pushed the shared COMPONENT_SCHEMAS union over the TypeScript comparison limit (TS2859). Paper builder
 * ids are prefixed `BijakBuilder`, blueprint ids `BijakBlueprint`; none equals an id of
 * `bijak/papers` (`BijakPaper*`, `BijakBlueprintContract`, `BijakBlueprintSection`, ...) or of
 * `bijak/attempts` (`BijakAttempt*`).
 */
export const BIJAK_BUILDER_COMPONENT_SCHEMAS: Record<string, z.ZodType> = {
  BijakBuilderSectionRule: BijakBuilderSectionRuleSchema,
  BijakBuilderPaperStatus: BijakBuilderPaperStatusSchema,
  BijakBuilderQuestionStatus: BijakBuilderQuestionStatusSchema,
  BijakBuilderQuestionKind: BijakBuilderQuestionKindSchema,
  BijakBuilderCurriculumTag: BijakBuilderCurriculumTagSchema,
  BijakBuilderSchemeLine: BijakBuilderSchemeLineSchema,
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
  BijakBuilderBlocker: BijakBuilderBlockerSchema,
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
  BijakBuilderPlacementAdd: BijakBuilderPlacementAddSchema,
  BijakBuilderSectionOrder: BijakBuilderSectionOrderSchema,
  BijakBuilderPlacementResult: BijakBuilderPlacementResultSchema,
  BijakBuilderReviewRow: BijakBuilderReviewRowSchema,
  BijakBuilderReview: BijakBuilderReviewSchema,
  BijakBuilderStudentQuestion: BijakBuilderStudentQuestionSchema,
  BijakBuilderStudentUnit: BijakBuilderStudentUnitSchema,
  BijakBuilderStudentView: BijakBuilderStudentViewSchema,
  BijakBuilderSectionPoolQuery: BijakBuilderSectionPoolQuerySchema,
  BijakBuilderPoolUnit: BijakBuilderPoolUnitSchema,
  BijakBuilderPoolPreviewQuery: BijakBuilderPoolPreviewQuerySchema,
  BijakBuilderGroupLabel: BijakBuilderGroupLabelSchema,
  BijakBuilderPublishRequest: BijakBuilderPublishRequestSchema,
  BijakBuilderSectionPoolOption: BijakSectionPoolOptionSchema,
  BijakBuilderSectionPoolsRequest: BijakSectionPoolsRequestSchema,
  BijakBuilderSectionPools: BijakSectionPoolsSchema,
}

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
  'Shapes and BM strings are copied from the prototype m28-bijak-spm (feature/student-prototype at 9af43134; the earlier snapshot docs/reference/bijak-paper-builder-mock is a subset of it); anything the prototype does not cover is marked [PROPOSED].'
const ERROR_NOTE =
  'The mock throws error kind bad_request for these refusals (not_found for a missing paper); ErrorCode has no BAD_REQUEST, so the refusal is 422 VALIDATION_ERROR (mapping awaits the LEAD decision, deviations log).'
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
 * prototype paper builder (m28-bijak-spm `server/admin.ts` and the domain files at 9af43134; see
 * schema.ts); the blueprint write routes (create, version, retire) have NO mock and exist only because the card requires
 * them. Every response is `{ data }`, `{ data, meta }` or `{ error }`; every mutation needs
 * `X-CSRF-Token`.
 *
 * Removed from the first draft, because the mock has no counterpart: `PUT /admin/papers/{id}/sections`,
 * `PUT /admin/papers/{id}/placements` and `GET /admin/papers/{id}/conformance` (the conformance
 * lines are the publish `errors`).
 *
 * D57: every write route (POST, PUT, DELETE) also answers 429 RATE_LIMITED with retryAfter and a
 * Retry-After header (added by `registerRoute`); the preview is a POST and so carries it too. D57(b):
 * no response carries a credential or token; only the preview 200 sends Cache-Control: no-store,
 * because it carries answer keys. D57(d)/(e): not
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
      422: err('VALIDATION_ERROR with fields (page, pageSize, status).'),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/admin/papers',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: create a paper (createPaper)',
    description: `Body { subject, kertas, title? }. The paper copies code, duration, instructions, reference and sections (label, rule, budget, count) from the blueprint of that subject and kertas, with empty question lists; the status is draf, the year is the current year, the default title is "Percubaan SPM {subjectName} Kertas {kertas} (draf)" and the section ids are generated. Answers the new id. No blueprint for the pair, or one whose source is Draf: a plain 422 VALIDATION_ERROR "${BIJAK_BUILDER_MESSAGES.noBlueprint}" with no field (the mock throws it without a field). ${ERROR_NOTE} ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { headers: [csrf], body: body(BijakBuilderPaperCreateSchema) },
    responses: {
      201: json(envelopeOf(BijakBuilderPaperCreateResultSchema), 'The new paper id.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      422: err(
        `VALIDATION_ERROR: no blueprint "${BIJAK_BUILDER_MESSAGES.noBlueprint}" (no field), or fields (subject, kertas).`,
      ),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/admin/papers/preview',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: student-view preview of questions, saved or not (previewQuestions)',
    description: `Body { ids }: the question ids currently in the editor, so unsaved edits can be previewed (the mock previewQuestions(ids)). Answers { questions, stimuli, optionBanks }: the question content as ReviewQuestion, the stimulus of each group by group id and the shared option bank of each group by group id. Ids that do not exist are left out. ReviewQuestion is the admin review shape: it carries the mark scheme and the MCQ correct option, so this route is Admin Pusat only, nothing of it reaches students, and the 200 sends Cache-Control: no-store (D57b, conservative). It reads only; it is a POST because it takes a body, so it needs the CSRF header and is rate limited. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { headers: [csrf], body: body(BijakBuilderPreviewRequestSchema) },
    responses: {
      200: {
        ...json(envelopeOf(BijakBuilderPreviewSchema), 'Questions, stimuli and option banks.'),
        headers: {
          'Cache-Control': {
            description:
              'no-store: the answer carries answer keys and mark schemes (D57b, conservative).',
            schema: { type: 'string' as const, enum: ['no-store'] },
          },
        },
      },
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
    description: `Body { title?, year?, durationMin?, sections?: [{ id, questionIds }] }; only the keys sent change. This one route carries every edit (the mock savePaper). Checks run in the mock order: 1. the paper exists (404 NOT_FOUND), 2. the paper is not terbit, 3. the title is not blank, 4. year and durationMin apply, 5. each section id and its questions, in the order sent. A terbit paper is refused: 422 VALIDATION_ERROR "${BIJAK_BUILDER_MESSAGES.paperLocked}" (no field). Other refusals: title "${BIJAK_BUILDER_MESSAGES.titleRequired}"; a section id that is not a section of the paper "${BIJAK_BUILDER_MESSAGES.invalidSection}"; a question id that does not exist, or whose curriculum subject differs from the paper subject, "${BIJAK_BUILDER_MESSAGES.invalidQuestion}" (an existence and subject check only, not a kertas or status check). R1-B09a / D90: a stimulus group is one unit, so a list that holds a member of a group is stored with the WHOLE group (all members, contiguous, in the group's published order); a question twice on the paper is refused with "Soalan berulang dalam kertas: {ids}". Status is not checked here (publish reports "{N} soalan belum Terbit"); POST /placements is the servable-checked way to add. Answers the editor data (PaperEditorData), as the mock does. ${ERROR_NOTE} ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf], body: body(BijakBuilderPaperPatchSchema) },
    responses: {
      200: json(envelopeOf(BijakBuilderEditorSchema), 'The editor data after the edit.'),
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
    description: `Optional body { override?: boolean, reason?: string } (R1-T34, V2 Panel tick "Terbitkan walaupun tidak memenuhi kontrak blueprint"): with override true and a reason of at least 5 characters the structural blueprint-conformance blockers ("Soalan {id} tidak layak: ...") are overridden and the paper is published; the reason and the overridden lines go to the audit row bijak.paper.published_override and the answer lists them in \`overridden\`. Override without a reason: 422 "${BIJAK_BUILDER_MESSAGES.overrideReasonRequired}" on fields.reason. Blockers about the questions or the printed structure (not Terbit, duplicates, split or incomplete groups, counts, marks) are never overridable: the answer stays ok false. A normal 200 result (not an error): { ok: true, errors: [] }, or { ok: false, errors: string[] } with the BM lines of checkPaper. Paper-wide lines come first: "Soalan berulang dalam kertas: {ids}" and "Kumpulan rangsangan {group} dipecahkan antara dua bahagian". Each section line follows, prefixed with the section label ("{label}: "): "Kurang N soalan (perlu X, ada Y)" or "Lebih N soalan (perlu X, ada Y)", "Markah M tidak sama dengan bajet B", "Kumpulan rangsangan G tidak berturutan", "Kumpulan rangsangan G tidak lengkap (N soalan tiada)" and "{N} soalan belum Terbit". Nothing changes on ok: false. A refusal (ok false) also carries \`blockerDetails\` (the same blockers as \`errors\`, structured: { code, message, overridable, section?, questionId? }) and \`canOverride\`, computed by the same rule as GET /admin/papers/{id}/review (one source of truth; codes in BIJAK_BUILDER_BLOCKER_OVERRIDABLE). On ok: true the status becomes terbit, publishedAt is set and the paper appears in GET /bijak/papers; implementations pin the question versions in force (a later edit, version n+1, does not change the paper). A paper that is already terbit is checked again and stays terbit. ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf], body: { required: false as const, content: { 'application/json': { schema: BijakBuilderPublishRequestSchema } } } },
    responses: {
      200: json(envelopeOf(BijakBuilderPublishResultSchema), 'Publish result (ok true or false).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
      422: err(`VALIDATION_ERROR "${BIJAK_BUILDER_MESSAGES.overrideReasonRequired}" (override without a reason).`),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/admin/papers/{id}/withdraw',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: unpublish, tarik balik (terbit back to draf)',
    description: `No request body. The status goes back to draf, publishedAt is cleared and updatedAt is touched (the mock unpublishPaper; there is no withdrawn state). The paper leaves GET /bijak/papers; attempts already started are unaffected [PROPOSED, not in the mock]. A paper that is already draf stays draf. The path name follows the card ("tarik balik"). The mock returns void; this route answers { ok: true } (deviations log). ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(BijakBuilderOkSchema), 'Done; the paper is now draf.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
    },
  })

  /* ------------------------------------------------- R1-B09a: placements, review, copy, pool */

  const SectionParams = z.object({ id: IdSchema, sid: IdSchema.meta({ description: 'Section id.' }) })
  const LOCKED = err(`VALIDATION_ERROR "${BIJAK_BUILDER_MESSAGES.paperLocked}", or a placement refusal (BM reason).`)

  registerRoute(registry, {
    method: 'post',
    path: '/admin/papers/{id}/placements',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: place a question (or its whole stimulus group) in a section',
    description: `Body { sectionId, questionId }. The question must be servable (Terbit/approved) and of the paper subject; otherwise 422 with a BM reason. D90: a question of a stimulus group places the WHOLE group, all members contiguous in the group's published order, under one stimulus; the answer lists every added id. The version in force is recorded on the placement. A question already on the paper: 422 "Soalan {id} sudah ada dalam kertas ini". Terbit paper: 422 paperLocked. ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf], body: body(BijakBuilderPlacementAddSchema) },
    responses: {
      201: json(envelopeOf(BijakBuilderPlacementResultSchema), 'The editor data and the added ids.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
      422: LOCKED,
    },
  })

  registerRoute(registry, {
    method: 'delete',
    path: '/admin/papers/{id}/placements/{questionId}',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: remove a placed question; a stimulus group is removed whole',
    description: `D90 decision: removing any member of a stimulus group removes the whole group (the answer lists every removed id). A question that is not on the paper: 422 "Soalan {id} tiada dalam kertas ini". ${ROLE_NOTE}`,
    request: { params: z.object({ id: IdSchema, questionId: IdSchema }), headers: [csrf] },
    responses: {
      200: json(envelopeOf(BijakBuilderPlacementResultSchema), 'The editor data and the removed ids.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
      422: LOCKED,
    },
  })

  registerRoute(registry, {
    method: 'put',
    path: '/admin/papers/{id}/sections/{sid}/order',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: reorder the units of a section (a stimulus group moves as one unit)',
    description: `Body { order }: one id per unit (any member id for a group), every unit exactly once, else 422 "${'Susunan mesti menyenaraikan setiap soalan atau kumpulan dalam bahagian tepat sekali'}". Members of a group always stay contiguous and in the group's order. ${ROLE_NOTE}`,
    request: { params: SectionParams, headers: [csrf], body: body(BijakBuilderSectionOrderSchema) },
    responses: {
      200: json(envelopeOf(BijakBuilderPlacementResultSchema), 'The editor data after the move.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
      422: LOCKED,
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/admin/papers/{id}/sections/{sid}/pool',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: candidate pool of a section (units, groups whole)',
    description: `Candidates by subject, kertas, level and DSKP unit from the standard pool (bijak-pool facts). A stimulus group is ONE unit with the stimulus once and marks = sum of members. Each unit says eligible (with BM reasons) and placed. ${ROLE_NOTE}`,
    request: { params: SectionParams, query: BijakBuilderSectionPoolQuerySchema },
    responses: {
      200: json(listEnvelopeOf(BijakBuilderPoolUnitSchema), 'Units (paged).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
      404: PAPER_NOT_FOUND,
      422: err('VALIDATION_ERROR with fields (q, level, unit, page, pageSize) or invalid section.'),
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/admin/papers/pool-preview',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: Pratonton kolam for a subject and kertas (shortage report)',
    description: `Same code and candidate list as Jana set (composeStandardPaper): verdict, per-section needed/available and the first shortage. Uses the head blueprint (Spec or Disahkan). 404 when there is none. ${ROLE_NOTE}`,
    request: { query: BijakBuilderPoolPreviewQuerySchema },
    responses: {
      200: json(envelopeOf(BijakPoolPreviewSchema), 'The pool preview.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
      404: BLUEPRINT_NOT_FOUND,
      422: err('VALIDATION_ERROR with fields (subject, kertas).'),
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/admin/papers/{id}/review',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: review (blockers, per-row servability, visibility)',
    description: `Blockers are the publish refusal lines (checkPaper plus the structural tier of verifyComposition). \`blockerDetails\` is the same list, structured ({ code, message, overridable, section?, questionId? }), and \`canOverride\` is true when no hard blocker is present and at least one is overridable (the Kontrak is the only thing in the way); the publish refusal carries the same two fields. Standard-tier findings (quota, profile, KBAT) are notes and set blueprintNeedsReview; they never block a curated paper (D78 O-2). ${ROLE_NOTE}`,
    request: { params: PaperIdParams },
    responses: {
      200: json(envelopeOf(BijakBuilderReviewSchema), 'The review.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
      404: PAPER_NOT_FOUND,
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/admin/papers/{id}/student-view',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: preview as the pupil sees it',
    description: `Cover plus numbered questions per section; a stimulus group shows its stimulus once with all its questions. No key, no scheme. ${ROLE_NOTE}`,
    request: { params: PaperIdParams },
    responses: {
      200: json(envelopeOf(BijakBuilderStudentViewSchema), 'The student view.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
      404: PAPER_NOT_FOUND,
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/admin/papers/{id}/copy',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: Salin set (copy to a new draf)',
    description: `V2 "Salin set": a new draf with the same header, sections and placements (current versions, nothing pinned), title "{title} (Salinan)". Allowed from draf or terbit. ${ROLE_NOTE}`,
    request: { params: PaperIdParams, headers: [csrf] },
    responses: {
      201: json(envelopeOf(BijakBuilderPaperCreateResultSchema), 'The new paper id.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
    },
  })

  /* ------------------------------------------------- R1-T34: paper-review edits and section pools */

  registerRoute(registry, {
    method: 'put',
    path: '/admin/papers/{id}/groups/{groupId}',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: Sunting petikan (title of a stimulus group on the paper)',
    description: `V2 Panel "Sunting petikan". Body { label }. The group must be placed on the paper (otherwise 422 "${BIJAK_BUILDER_MESSAGES.groupNotOnPaper}"). The title belongs to the shared stimulus group of the question bank (D90), so the new title shows wherever the group is placed (deviation from V2, where a native paper owned its passage). Terbit paper: 422 paperLocked. ${ROLE_NOTE}`,
    request: { params: z.object({ id: IdSchema, groupId: IdSchema }), headers: [csrf], body: body(BijakBuilderGroupLabelSchema) },
    responses: {
      200: json(envelopeOf(BijakBuilderEditorSchema), 'The editor data.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: PAPER_NOT_FOUND,
      422: LOCKED,
    },
  })

  const QuestionIdParams = z.object({ questionId: IdSchema.meta({ description: 'Question id.' }) })

  registerRoute(registry, {
    method: 'get',
    path: '/admin/section-pools/{questionId}',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: the section pools of a question and the pools it can be given',
    description: `A section pool (for example MAT2-A) decides which Bahagian of a blueprint a question is eligible for; without it the publish check reports "bukan dalam kolam bahagian ini" as a note. 404 "${BIJAK_BUILDER_MESSAGES.poolQuestionNotFound}" for an unknown, PKSK or hidden question. ${ROLE_NOTE}`,
    request: { params: QuestionIdParams },
    responses: {
      200: json(envelopeOf(BijakSectionPoolsSchema), 'The pools on the question and the available pools.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
      404: err(`NOT_FOUND "${BIJAK_BUILDER_MESSAGES.poolQuestionNotFound}".`),
    },
  })

  registerRoute(registry, {
    method: 'put',
    path: '/admin/section-pools/{questionId}',
    tags: [BIJAK_BUILDER_TAG],
    summary: 'Paper builder: set the section pools of a question (G3)',
    description: `Body { pools }: the full list of blueprint pool codes of the question (empty clears them). Every code must be the pool of a section of an ACTIVE blueprint of the question subject, otherwise 422 "${BIJAK_BUILDER_MESSAGES.poolInvalid}" on fields.pools. Other tags on the question (the legacy \`spm\` tag, PKSK tags) are never changed. The change is audited (bijak.question.pool_updated: ids and codes only). The question may be in any lifecycle status. ${ROLE_NOTE}`,
    request: { params: QuestionIdParams, headers: [csrf], body: body(BijakSectionPoolsRequestSchema) },
    responses: {
      200: json(envelopeOf(BijakSectionPoolsSchema), 'The pools now on the question.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: err(`NOT_FOUND "${BIJAK_BUILDER_MESSAGES.poolQuestionNotFound}".`),
      422: err(`VALIDATION_ERROR "${BIJAK_BUILDER_MESSAGES.poolInvalid}" on fields.pools.`),
    },
  })

  /* ------------------------------------------------------------------------- blueprints */

  registerRoute(registry, {
    method: 'get',
    path: '/admin/blueprints',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint: list blueprints (BlueprintView, latest active version)',
    description: `One row per blueprint (subject and kertas): the head version, as the mock listBlueprints (BlueprintView). BJS-01: Draf heads are now listed too (the editor needs them); the view carries version, servesStudents, verification, evidenceCount, warnings, needsReview and reviewPapers (O-2). Retired blueprints are not listed [PROPOSED]. Filters subject and kertas are [PROPOSED]. The mock returns a plain array; this route is paged (deviations log). ${COPY_NOTE} ${ROLE_NOTE}`,
    request: { query: BijakBlueprintListQuerySchema },
    responses: {
      200: json(listEnvelopeOf(BijakBlueprintViewSchema), 'Blueprints (paged).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
      422: err('VALIDATION_ERROR with fields (page, pageSize, subject, kertas).'),
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/admin/blueprints/{subject}/{kertas}',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint: one blueprint by subject and kertas (BlueprintView, NO MOCK)',
    description: `No mock route (the mock has listBlueprints and the blueprint inside getPaperEditor); kept because the card requires a blueprint get. BlueprintView has no id, so a blueprint is addressed by subject and kertas. Route path is [PROPOSED]. ${COPY_NOTE} ${ROLE_NOTE}`,
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
      422: json(
        z.union([BijakBlueprintInvalidErrorSchema, ErrorBodySchema]),
        `BLUEPRINT_INVALID "${BIJAK_STANDARDS_MESSAGES.blueprintInvalid}" [PROPOSED] with details.problems (every problem at once, AC-25.7), or VALIDATION_ERROR with fields (subject, kertas, code, durationMin, sections, sections.N.*). The body is strict: unknown keys are rejected. source accepts Draf or Spec only.`,
      ),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/admin/blueprints/{subject}/{kertas}/versions',
    tags: [BIJAK_BLUEPRINT_ADMIN_TAG],
    summary: 'Blueprint admin: add a new version, the only way to edit (NO MOCK)',
    description: `No mock exists; kept because the card requires it. Creates version n+1 from the full body; earlier versions stay as they were (a version used by a terbit paper is immutable). BJS-01: the version number is now part of the view. The server decides the source of the new row (client Draf or Spec only): Disahkan is kept only when the previous head is Disahkan and the structural hash is unchanged (cosmetic edit); a structural edit makes a Spec head while the last Disahkan version keeps serving students (AC-39.4, Q-B22). A retired blueprint answers 409 CONFLICT "${BIJAK_BUILDER_MESSAGES.blueprintAlreadyRetired}" [PROPOSED]. Answers the view of the new latest version. ${COPY_NOTE} ${ROLE_NOTE}`,
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
      422: json(
        z.union([BijakBlueprintInvalidErrorSchema, ErrorBodySchema]),
        `BLUEPRINT_INVALID "${BIJAK_STANDARDS_MESSAGES.blueprintInvalid}" [PROPOSED] with details.problems (every problem at once), or VALIDATION_ERROR with fields (code, durationMin, sections, sections.N.*).`,
      ),
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
