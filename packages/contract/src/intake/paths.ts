import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import {
  IntakeAcceptedQuestionSchema,
  IntakeActorRefSchema,
  IntakeConfidenceBandSchema,
  IntakeDuplicateEntrySchema,
  IntakeDuplicateKindSchema,
  IntakeDuplicateScopeSchema,
  IntakeDuplicateStatusSchema,
  IntakeEventActionSchema,
  IntakeFieldConfidenceSchema,
  IntakeItemEventSchema,
  IntakeItemListMetaSchema,
  IntakeItemListQuerySchema,
  IntakeItemListResponseSchema,
  IntakeItemRowSchema,
  IntakeItemSchema,
  IntakeItemStateCountsSchema,
  IntakeItemStateSchema,
  IntakeProvenanceSchema,
  IntakeSourceTypeSchema,
} from './items'
import { INTAKE_MESSAGES } from './review'
import { INTAKE_MAX_BODY_BYTES } from './question'
import {
  IntakeAcceptRequestSchema,
  IntakeBatchIssueSchema,
  IntakeBatchReviewEnvelopeSchema,
  IntakeBatchReviewSchema,
  IntakeBulkRequestSchema,
  IntakeBulkResultEnvelopeSchema,
  IntakeBulkResultItemSchema,
  IntakeBulkResultSchema,
  IntakeBulkSkipReasonSchema,
  IntakeDuplicateRequestSchema,
  IntakeExtractRequestSchema,
  IntakeExtractionRunEnvelopeSchema,
  IntakeExtractionRunSchema,
  IntakeGateErrorBodySchema,
  IntakeGroupSchema,
  IntakeItemCreateRequestSchema,
  IntakeItemEnvelopeSchema,
  IntakeItemPatchResultSchema,
  IntakeItemPatchSchema,
  IntakeRejectRequestSchema,
  IntakeRunReasonCodeSchema,
  IntakeRunStateSchema,
  IntakeStimulusCreateRequestSchema,
  IntakeStimulusEnvelopeSchema,
  IntakeStimulusRemovedEnvelopeSchema,
  IntakeStimulusRemovedSchema,
  IntakeStimulusUpdateRequestSchema,
} from './review'
import {
  IntakeCurriculumTagSchema,
  IntakeEcfRuleSchema,
  IntakeFinalSchema,
  IntakeIssueSchema,
  IntakeLeafKindSchema,
  IntakeMcqOptionSchema,
  IntakePartSchema,
  IntakePointCodeSchema,
  IntakePointGroupSchema,
  IntakePointMatchSchema,
  IntakePointSchema,
  IntakeQuestionSchema,
  IntakeQuestionTypeSchema,
  IntakeRegionSchema,
  IntakeRubricBandSchema,
  IntakeSchemeSchema,
  IntakeStimulusKindSchema,
  IntakeStimulusSchema,
  IntakeWordRangeSchema,
} from './question'
import { registerIntakeRoute } from './rate-limit'

/** Components contributed by BE-38 (appended to COMPONENT_SCHEMAS in openapi.ts). Every id is prefixed `Intake`. */
export const INTAKE_COMPONENT_SCHEMAS = {
  // question content (prototype shapes)
  IntakeLeafKind: IntakeLeafKindSchema,
  IntakeQuestionType: IntakeQuestionTypeSchema,
  IntakeMcqOption: IntakeMcqOptionSchema,
  IntakeCurriculumTag: IntakeCurriculumTagSchema,
  IntakePointCode: IntakePointCodeSchema,
  IntakePointMatch: IntakePointMatchSchema,
  IntakeEcfRule: IntakeEcfRuleSchema,
  IntakePoint: IntakePointSchema,
  IntakePointGroup: IntakePointGroupSchema,
  IntakeFinal: IntakeFinalSchema,
  IntakeRubricBand: IntakeRubricBandSchema,
  IntakeScheme: IntakeSchemeSchema,
  IntakePart: IntakePartSchema,
  IntakeQuestion: IntakeQuestionSchema,
  IntakeRegion: IntakeRegionSchema,
  IntakeWordRange: IntakeWordRangeSchema,
  IntakeStimulusKind: IntakeStimulusKindSchema,
  IntakeStimulus: IntakeStimulusSchema,
  IntakeIssue: IntakeIssueSchema,
  // item, states, duplicates, events
  IntakeItemState: IntakeItemStateSchema,
  IntakeConfidenceBand: IntakeConfidenceBandSchema,
  IntakeFieldConfidence: IntakeFieldConfidenceSchema,
  IntakeDuplicateKind: IntakeDuplicateKindSchema,
  IntakeDuplicateScope: IntakeDuplicateScopeSchema,
  IntakeDuplicateStatus: IntakeDuplicateStatusSchema,
  IntakeDuplicateEntry: IntakeDuplicateEntrySchema,
  IntakeActorRef: IntakeActorRefSchema,
  IntakeAcceptedQuestion: IntakeAcceptedQuestionSchema,
  IntakeSourceType: IntakeSourceTypeSchema,
  IntakeProvenance: IntakeProvenanceSchema,
  IntakeEventAction: IntakeEventActionSchema,
  IntakeItemEvent: IntakeItemEventSchema,
  IntakeItemRow: IntakeItemRowSchema,
  IntakeItem: IntakeItemSchema,
  IntakeItemListQuery: IntakeItemListQuerySchema,
  IntakeItemStateCounts: IntakeItemStateCountsSchema,
  IntakeItemListMeta: IntakeItemListMetaSchema,
  IntakeItemListResponse: IntakeItemListResponseSchema,
  // workflow
  IntakeRunState: IntakeRunStateSchema,
  IntakeRunReasonCode: IntakeRunReasonCodeSchema,
  IntakeExtractionRun: IntakeExtractionRunSchema,
  IntakeExtractRequest: IntakeExtractRequestSchema,
  IntakeItemPatch: IntakeItemPatchSchema,
  IntakeItemPatchResult: IntakeItemPatchResultSchema,
  IntakeItemCreateRequest: IntakeItemCreateRequestSchema,
  IntakeAcceptRequest: IntakeAcceptRequestSchema,
  IntakeRejectRequest: IntakeRejectRequestSchema,
  IntakeDuplicateRequest: IntakeDuplicateRequestSchema,
  IntakeGateErrorBody: IntakeGateErrorBodySchema,
  IntakeBulkRequest: IntakeBulkRequestSchema,
  IntakeBulkSkipReason: IntakeBulkSkipReasonSchema,
  IntakeBulkResultItem: IntakeBulkResultItemSchema,
  IntakeBulkResult: IntakeBulkResultSchema,
  IntakeStimulusCreateRequest: IntakeStimulusCreateRequestSchema,
  IntakeStimulusUpdateRequest: IntakeStimulusUpdateRequestSchema,
  IntakeStimulusRemoved: IntakeStimulusRemovedSchema,
  IntakeGroup: IntakeGroupSchema,
  IntakeBatchIssue: IntakeBatchIssueSchema,
  IntakeBatchReview: IntakeBatchReviewSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })
const idParams = z.object({ id: IdSchema })
const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})

const ROLES =
  'Roles (D40a): Guru (`teacher`) on the batches they own, Admin Pusat (`admin`) on all. Admin Sekolah, PPD and every other role get 403.'

const unauthorized = err('UNAUTHORIZED: no valid session.')
const forbidden = err('FORBIDDEN (a role without access), or CSRF_INVALID when X-CSRF-Token is missing or wrong.')
const tooLarge = err(
  `PAYLOAD_TOO_LARGE "${INTAKE_MESSAGES.payloadTooLarge}": the JSON body is over ${INTAKE_MAX_BODY_BYTES} bytes ([PROPOSED] cap; nginx may answer first). Same behaviour as the users and schools writes.`,
)
const invalid = err('VALIDATION_ERROR: one response, `fields` keyed by input name (BM messages).')
const notFound = (what: string, message: string) =>
  err(`NOT_FOUND "${message}": unknown ${what}, or one outside the caller scope (the two are not told apart).`)

/**
 * Registers the BE-38 routes (13). Paths are relative to the `/api` server. [PROPOSED] unless the
 * card names them: the card names extract, items (list, get, patch), accept, reject, duplicate and
 * bulk; the other five carry what the prototype review page does and the card has no endpoint for
 * (add item, stimuli, review summary; OQ-API-B2-23/25/26).
 */
export function registerIntakePaths(registry: OpenAPIRegistry): void {
  const tags = ['intake']

  registerIntakeRoute(registry, {
    method: 'post',
    path: '/intake/batches/{id}/extract',
    tags,
    summary: 'Enqueue extraction of a batch (idempotent)',
    description:
      `Card BE-38. ${ROLES} Idempotent per batch: a new request enqueues a run (202); a request while a run is queued or running returns that run (202); a request after a succeeded run returns it unchanged (200, no new items, no cost). After a failed run the same request retries and creates no duplicate items. ` +
      'When BE-36 reports the monthly budget exhausted the run stays `queued` with `reason.code` AI_BUDGET_EXHAUSTED and resumes when the cap is raised (202, not an error). A file whose hash was already imported by ANOTHER finished batch is refused before any provider call: 409 CONFLICT "Kertas sama sudah diimport"; `details.batchId` names the earlier batch ONLY when that batch is in the scope of the caller (a Guru is never told about another teacher batch), otherwise `details` is omitted and the message is the same. A batch that cannot be extracted yet (no stored file, a file still being processed, a manual batch) is 409 CONFLICT "Kumpulan ini belum boleh diekstrak: tiada fail, atau fail masih diproses." [PROPOSED]. The request body is empty; the pages come from the stored batch.',
    request: { headers: csrf, params: idParams, body: body(IntakeExtractRequestSchema) },
    responses: {
      200: json(IntakeExtractionRunEnvelopeSchema, 'The extraction already succeeded; the run is returned unchanged.'),
      202: json(IntakeExtractionRunEnvelopeSchema, 'Queued or running. Poll GET /intake/batches/{id}/review (`extraction`) or GET /intake/items.'),
      401: unauthorized,
      403: forbidden,
      404: notFound('batch', INTAKE_MESSAGES.batchNotFound),
      409: err(
        `CONFLICT, two cases told apart by \`message\`: "${INTAKE_MESSAGES.alreadyImported}" (the file hash was imported by another batch; details.batchId only if that batch is in the caller scope; no provider call, no cost) or "${INTAKE_MESSAGES.notExtractable}" (no file, still processing, or a manual batch).`,
      ),
      422: invalid,
    },
  })

  registerIntakeRoute(registry, {
    method: 'get',
    path: '/intake/batches/{id}/review',
    tags,
    summary: 'Review summary of a batch (counts, stimuli, groups, gate issues)',
    description: `[PROPOSED] Replaces what the prototype review page read from getIntakeBatch and validateBatch. ${ROLES} The batch declaration and processing status are BE-37.`,
    request: { params: idParams },
    responses: {
      200: json(IntakeBatchReviewEnvelopeSchema, 'Summary.'),
      401: unauthorized,
      403: forbidden,
      404: notFound('batch', INTAKE_MESSAGES.batchNotFound),
    },
  })

  registerIntakeRoute(registry, {
    method: 'post',
    path: '/intake/batches/{id}/items',
    tags,
    summary: 'Add a blank item ("Tambah soalan")',
    description: `[PROPOSED] Prototype review page "Tambah soalan" (blankQuestion, nextLabel; AC-04.6). The item is \`manual\` source, state \`generated\`. ${ROLES}`,
    request: { headers: csrf, params: idParams, body: body(IntakeItemCreateRequestSchema) },
    responses: {
      201: json(IntakeItemEnvelopeSchema, 'The new item.'),
      401: unauthorized,
      403: forbidden,
      404: notFound('batch', INTAKE_MESSAGES.batchNotFound),
      422: invalid,
    },
  })

  registerIntakeRoute(registry, {
    method: 'post',
    path: '/intake/batches/{id}/stimuli',
    tags,
    summary: 'Add a rajah or petikan to a batch',
    description: `[PROPOSED] Prototype addStimulus. The label is numbered by the server ("Rajah 1", "Petikan 2") unless sent. \`svg\` cannot be sent. ${ROLES}`,
    request: { headers: csrf, params: idParams, body: body(IntakeStimulusCreateRequestSchema) },
    responses: {
      201: json(IntakeStimulusEnvelopeSchema, 'The new stimulus.'),
      401: unauthorized,
      403: forbidden,
      404: notFound('batch', INTAKE_MESSAGES.batchNotFound),
      413: tooLarge,
      422: invalid,
    },
  })

  registerIntakeRoute(registry, {
    method: 'patch',
    path: '/intake/stimuli/{id}',
    tags,
    summary: 'Edit a stimulus (caption, alt text, passage text)',
    description: `[PROPOSED] Prototype patchStimulus. Group membership is edited on the item (PATCH /intake/items/{id} stimulusId). Once an accepted item uses the stimulus it is read-only here: 409 CONFLICT "${INTAKE_MESSAGES.stimulusInUse}" (it was snapshotted into the bank; edit it there). ${ROLES}`,
    request: { headers: csrf, params: idParams, body: body(IntakeStimulusUpdateRequestSchema) },
    responses: {
      200: json(IntakeStimulusEnvelopeSchema, 'The stimulus after the edit.'),
      401: unauthorized,
      403: forbidden,
      404: notFound('stimulus', INTAKE_MESSAGES.stimulusNotFound),
      409: err(`CONFLICT "${INTAKE_MESSAGES.stimulusInUse}"`),
      413: tooLarge,
      422: invalid,
    },
  })

  registerIntakeRoute(registry, {
    method: 'delete',
    path: '/intake/stimuli/{id}',
    tags,
    summary: 'Remove a stimulus and detach its items',
    description: `[PROPOSED] Prototype removeStimulus (dropStimulus): every item that used it loses its stimulusId. Refused with 409 CONFLICT "${INTAKE_MESSAGES.stimulusInUse}" while an accepted item uses it. ${ROLES}`,
    request: { headers: csrf, params: idParams },
    responses: {
      200: json(IntakeStimulusRemovedEnvelopeSchema, 'Removed; lists the detached items.'),
      401: unauthorized,
      403: forbidden,
      404: notFound('stimulus', INTAKE_MESSAGES.stimulusNotFound),
      409: err(`CONFLICT "${INTAKE_MESSAGES.stimulusInUse}"`),
    },
  })

  registerIntakeRoute(registry, {
    method: 'get',
    path: '/intake/items',
    tags,
    summary: 'Review queue (paginated, filterable)',
    description: `Card BE-38, v2-question-bank US-07. ${ROLES} A Guru sees own items only; Admin Pusat sees all. Page size 20 (max 100). \`meta.counts\` holds the per-state counts for the status tabs.`,
    request: { query: IntakeItemListQuerySchema },
    responses: {
      200: json(IntakeItemListResponseSchema, 'A page of rows.'),
      401: unauthorized,
      403: forbidden,
      422: invalid,
    },
  })

  registerIntakeRoute(registry, {
    method: 'get',
    path: '/intake/items/{id}',
    tags,
    summary: 'One item with its fields, confidence, region, gate issues and history',
    description: `Card BE-38. ${ROLES}`,
    request: { params: idParams },
    responses: {
      200: json(IntakeItemEnvelopeSchema, 'The item.'),
      401: unauthorized,
      403: forbidden,
      404: notFound('item', INTAKE_MESSAGES.itemNotFound),
    },
  })

  registerIntakeRoute(registry, {
    method: 'patch',
    path: '/intake/items/{id}',
    tags,
    summary: 'Edit the extracted fields of an item',
    description:
      `Card BE-38 (prototype saveExtracted, per item). ${ROLES} Marks each edited field as edited by a human and keeps the previous text in the item history (AC-08.2). \`lowFields\`, the review state and \`needsManual: true\` cannot be written; \`confirmed\` may list only low fields. An accepted or rejected item is final: 409 CONFLICT "${INTAKE_MESSAGES.itemLocked}".`,
    request: { headers: csrf, params: idParams, body: body(IntakeItemPatchSchema) },
    responses: {
      200: json(IntakeItemPatchResultSchema, 'The item after the edit, and whether the paper order changed.'),
      401: unauthorized,
      403: forbidden,
      404: notFound('item', INTAKE_MESSAGES.itemNotFound),
      409: err(`CONFLICT "${INTAKE_MESSAGES.itemLocked}"`),
      413: tooLarge,
      422: invalid,
    },
  })

  registerIntakeRoute(registry, {
    method: 'post',
    path: '/intake/items/{id}/accept',
    tags,
    summary: 'Accept an item: create a Draf question',
    description:
      `Card BE-38 (AC1, AC3, AC4, AC9). ${ROLES} Only an authenticated human reviewer can call it; the AI service cannot. Runs the quality gate for this item: every per-question rule of the prototype validateBatch (low fields confirmed, marks equal the sum of the part marks, ...), plus the unit being in the curriculum list and the item's stimulus having alt text and a stored figure (INTAKE_ACCEPT_BLOCKING_RULES). Batch-level rules (source, copyright, empty batch, group order) and an open exact or near duplicate entry do NOT block accept; BE-10 submit enforces them. On failure 422 VALIDATION_ERROR with \`details.issues\`. An item in state \`duplicate\` (a person linked it) is refused: 409 "${INTAKE_MESSAGES.itemIsDuplicate}" [PROPOSED]; a rejected item: 409 "${INTAKE_MESSAGES.itemLocked}"; an accepted item: 409 "${INTAKE_MESSAGES.itemAlreadyAccepted}". Only the first accepted item of a stimulus group snapshots the stimulus into the bank; later ones join that group. On success the server creates a question through QuestionsService with status \`draft\` (wire code, D54a) and provenance, and stores its id and version on the item (\`question\`). Submit, approve and publish are the BE-10 endpoints.`,
    request: { headers: csrf, params: idParams, body: body(IntakeAcceptRequestSchema) },
    responses: {
      200: json(IntakeItemEnvelopeSchema, 'The item, now `accepted`, with `question` set.'),
      401: unauthorized,
      403: forbidden,
      404: notFound('item', INTAKE_MESSAGES.itemNotFound),
      409: err(
        `CONFLICT: "${INTAKE_MESSAGES.itemAlreadyAccepted}" (already accepted), "${INTAKE_MESSAGES.itemLocked}" (rejected) or "${INTAKE_MESSAGES.itemIsDuplicate}" (state duplicate).`,
      ),
      422: {
        description: `Either the quality gate failed (IntakeGateErrorBody: VALIDATION_ERROR "${INTAKE_MESSAGES.gateFailed}" with details.issues), or the strict body was invalid (ordinary ErrorBody with fields).`,
        content: { 'application/json': { schema: z.union([IntakeGateErrorBodySchema, ErrorBodySchema]) } },
      },
    },
  })

  registerIntakeRoute(registry, {
    method: 'post',
    path: '/intake/items/{id}/reject',
    tags,
    summary: 'Reject an item with a reason',
    description: `Card BE-38. ${ROLES} The reason is mandatory ("${INTAKE_MESSAGES.rejectReasonRequired}"); the item never becomes a question and is kept with the reason. Prototype "Buang soalan" maps here.`,
    request: { headers: csrf, params: idParams, body: body(IntakeRejectRequestSchema) },
    responses: {
      200: json(IntakeItemEnvelopeSchema, 'The item, now `rejected`.'),
      401: unauthorized,
      403: forbidden,
      404: notFound('item', INTAKE_MESSAGES.itemNotFound),
      409: err(`CONFLICT "${INTAKE_MESSAGES.itemLocked}"`),
      422: invalid,
    },
  })

  registerIntakeRoute(registry, {
    method: 'post',
    path: '/intake/items/{id}/duplicate',
    tags,
    summary: 'Link an item to the question or item it duplicates, or dismiss the flag',
    description: `Card BE-38, v2-question-bank US-06. ${ROLES} Only a human decision sets the state \`duplicate\`; the automatic check adds \`open\` entries and leaves the item generated or needs_review. \`duplicate\` (also "Gabung") links exactly one of matchedQuestionId (bank) or matchedItemId (SAME batch) and sets the state \`duplicate\`; \`variant\` [PROPOSED] links as an informational variant without changing the state; \`not_duplicate\` ("Bukan pendua") dismisses the entry named by duplicateId for that pair only. A target that does not exist, is in another batch, or is not readable by the caller (BE-09 scope) gets the identical 422 "${INTAKE_MESSAGES.duplicateTargetNotFound}" on the field, so ids cannot be probed.`,
    request: { headers: csrf, params: idParams, body: body(IntakeDuplicateRequestSchema) },
    responses: {
      200: json(IntakeItemEnvelopeSchema, 'The item after the decision.'),
      401: unauthorized,
      403: forbidden,
      404: notFound('item', INTAKE_MESSAGES.itemNotFound),
      409: err(`CONFLICT "${INTAKE_MESSAGES.itemLocked}"`),
      422: err(`VALIDATION_ERROR: strict body, or fields.matchedQuestionId / fields.matchedItemId "${INTAKE_MESSAGES.duplicateTargetNotFound}" (identical for unknown, other batch and not readable).`),
    },
  })

  registerIntakeRoute(registry, {
    method: 'post',
    path: '/intake/items/bulk',
    tags,
    summary: 'Bulk accept or reject',
    description:
      `Card BE-38. ${ROLES} \`accept\` is Admin Pusat only (a Guru gets 403) and only for items at or above the server confidence threshold (default band \`high\`, card open question 2; returned as \`threshold\`). \`reject\` needs a reason. Up to 100 ids. The same gate as a single accept applies; an item that fails is skipped and listed with its reason, never dropped, and the response is 200 with per-id outcomes. An id the caller cannot see (unknown, or outside a Guru's own batches) is skipped as NOT_FOUND, the two are not told apart.`,
    request: { headers: csrf, body: body(IntakeBulkRequestSchema) },
    responses: {
      200: json(IntakeBulkResultEnvelopeSchema, 'Per-id outcomes in request order.'),
      401: unauthorized,
      403: forbidden,
      422: invalid,
    },
  })
}
