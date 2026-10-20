import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { AI_MESSAGES } from '../ai/schema'
import {
  IntakeConfidenceBandSchema,
  IntakeItemRowSchema,
  IntakeItemSchema,
  IntakeItemStateCountsSchema,
} from './items'
import {
  INTAKE_MAX_STEM_CHARS,
  IntakeCurriculumTagSchema,
  IntakeIssueSchema,
  IntakeLeafKindSchema,
  IntakeMcqOptionSchema,
  IntakePartSchema,
  IntakeQuestionTypeSchema,
  IntakeSchemeSchema,
  IntakeStimulusKindSchema,
  IntakeStimulusSchema,
  IntakeWordRangeSchema,
  INTAKE_MAX_OPTIONS,
  INTAKE_MAX_PARTS,
} from './question'

/**
 * BE-38 (contract only): the review workflow requests and responses: extraction run, item edit, add,
 * accept, reject, duplicate decision, bulk action, stimulus (rajah / petikan) maintenance and the batch
 * review summary.
 *
 * Roles for every route (D40a, card AC3): Guru (`teacher`) works on the batches they own, Admin Pusat
 * (`admin`) on all. Admin Sekolah, PPD and every other role get 403; an id outside the caller's scope
 * is 404 (ids cannot be probed). Mutating routes need `X-CSRF-Token` and answer 429 (D57a).
 * The AI service and the extraction worker can never call these routes and can never move an item
 * past `generated` / `needs_review` (card AC2).
 */

/* ------------------------------------------------------------------------------------------ */
/* Copy                                                                                        */
/* ------------------------------------------------------------------------------------------ */

/**
 * BM messages. `batchNotFound` and `extractionFailed` are verbatim from the prototype
 * (`store.ts` and `IntakeUploadPage.vue`). `alreadyImported` is the flag text of v2-question-bank
 * AC-06.4. `extractionFailed`, `budgetExhausted` and `unavailable` are the merged BE-36 `AI_MESSAGES`
 * (imported, one sentence for the AI service and the intake). Every other message is `[PROPOSED]` new
 * copy for the LEAD to approve.
 */
export const INTAKE_MESSAGES = {
  batchNotFound: 'Kumpulan ekstrak tidak ditemui',
  extractionFailed: AI_MESSAGES.extractionFailed,
  alreadyImported: 'Kertas sama sudah diimport',
  budgetExhausted: AI_MESSAGES.budgetExhausted,
  unavailable: AI_MESSAGES.unavailable,
  itemNotFound: 'Item ekstrak tidak ditemui',
  stimulusNotFound: 'Rajah atau petikan tidak ditemui',
  itemLocked: 'Item ini sudah diterima atau ditolak dan tidak boleh disunting.',
  itemAlreadyAccepted: 'Item ini sudah diterima.',
  itemIsDuplicate: 'Item ini ditandakan sebagai pendua. Pilih Bukan pendua dahulu untuk menerimanya.',
  duplicateTargetNotFound: 'Padanan pendua tidak ditemui',
  notExtractable: 'Kumpulan ini belum boleh diekstrak: tiada fail, atau fail masih diproses.',
  stimulusInUse: 'Rajah atau petikan ini sudah digunakan oleh soalan yang diterima dan tidak boleh diubah.',
  payloadTooLarge: 'Data terlalu besar.',
  gateFailed: 'Soalan belum memenuhi semakan kualiti. Baiki isu yang disenaraikan.',
  rejectReasonRequired: 'Sebab penolakan diperlukan.',
  duplicateTargetRequired: 'Pilih soalan atau item yang sama.',
  groupMoved: 'Soalan dipindahkan supaya kumpulan kekal berturutan.',
  emptyPatch: 'Tiada perubahan untuk disimpan.',
} as const

/* ------------------------------------------------------------------------------------------ */
/* Extraction run: POST /intake/batches/{id}/extract                                           */
/* ------------------------------------------------------------------------------------------ */

export const INTAKE_RUN_STATES = ['queued', 'running', 'succeeded', 'failed'] as const
export const IntakeRunStateSchema = z.enum(INTAKE_RUN_STATES).meta({
  id: 'IntakeRunState',
  description: '[PROPOSED] State of an extraction run (jobs states of plan 15.2, without cancelled).',
})
export type IntakeRunState = z.infer<typeof IntakeRunStateSchema>

/**
 * Why a run is waiting or failed. The first two codes are the BE-36 wire codes of the same name.
 * `EXTRACTION_FAILED` carries the prototype message "Pengekstrakan gagal.".
 */
export const INTAKE_RUN_REASON_CODES = ['AI_BUDGET_EXHAUSTED', 'AI_UNAVAILABLE', 'EXTRACTION_FAILED'] as const
export const IntakeRunReasonCodeSchema = z.enum(INTAKE_RUN_REASON_CODES).meta({
  id: 'IntakeRunReasonCode',
  description:
    '[PROPOSED] AI_BUDGET_EXHAUSTED: the monthly cap is reached, the run stays queued and resumes when the cap is raised (card). AI_UNAVAILABLE: the provider is not configured or unreachable (failed after retries). EXTRACTION_FAILED: any other failure.',
})
export type IntakeRunReasonCode = z.infer<typeof IntakeRunReasonCodeSchema>

export const IntakeExtractionRunSchema = z
  .strictObject({
    id: IdSchema.meta({ description: 'Run id (the `runId` of provenance and of the AI cost log).' }),
    batchId: IdSchema,
    state: IntakeRunStateSchema,
    reason: z
      .strictObject({ code: IntakeRunReasonCodeSchema, message: z.string().min(1).max(500).meta({ description: 'BM message, no secret, no content.' }) })
      .nullable()
      .meta({ description: 'Visible reason while queued (budget) or after a failure; null otherwise.' }),
    itemCount: z.number().int().min(0).nullable().meta({ description: 'Items created ("N dikesan", AC-04.6); null until the run succeeded.' }),
    provider: z.string().max(64).nullable(),
    model: z.string().max(128).nullable(),
    attempts: z.number().int().min(0),
    queuedAt: TimestampSchema,
    startedAt: TimestampSchema.nullable(),
    finishedAt: TimestampSchema.nullable(),
  })
  .meta({ id: 'IntakeExtractionRun', description: '[PROPOSED] One extraction run of a batch.' })
export type IntakeExtractionRun = z.infer<typeof IntakeExtractionRunSchema>

/** Empty body. Strict, so a content field is a 422: the pages come from the stored batch, never from the request. */
export const IntakeExtractRequestSchema = z
  .strictObject({})
  .meta({ id: 'IntakeExtractRequest', description: '[PROPOSED] Empty object. Input comes from the stored batch; the request cannot carry content or a provider choice.' })
export type IntakeExtractRequest = z.infer<typeof IntakeExtractRequestSchema>

/* ------------------------------------------------------------------------------------------ */
/* Item edit: PATCH /intake/items/{id}                                                         */
/* ------------------------------------------------------------------------------------------ */

const StimulusTable = z.strictObject({
  head: z.array(z.string().max(500)).max(50),
  rows: z.array(z.array(z.string().max(500)).max(50)).max(500),
})

/**
 * Edit of the extracted fields (prototype `saveExtracted` per item; card: marks the field "Disunting
 * oleh manusia", keeps the AI text in history). A key that is present replaces the whole value (a
 * `parts` array replaces all parts); `null` clears an optional field. The server decides what it
 * cannot take from a client: `id`, `lowFields` and the review state are not writable, and
 * `needsManual` can only be set to `false` ("Tandakan selesai disemak"). `confirmed` may only list
 * fields that are in `lowFields`. After the edit the server recomputes the state by the rule of
 * `intakeOpenState` (needs_review while a low field is unconfirmed, needsManual, or an open exact or
 * near duplicate entry; otherwise generated) and records the previous value of every changed field in
 * the item history; the UI marks those fields "Disunting oleh manusia". The edit is refused (409) on an
 * accepted or rejected item. The whole JSON body is capped (`INTAKE_MAX_BODY_BYTES`, 413 above it).
 */
export const IntakeItemPatchSchema = z
  .strictObject({
    label: z.string().max(32).optional(),
    type: IntakeQuestionTypeSchema.optional(),
    stem: z.string().max(INTAKE_MAX_STEM_CHARS).optional(),
    options: z.array(IntakeMcqOptionSchema).max(INTAKE_MAX_OPTIONS).optional(),
    marks: z.number().int().min(0).max(1000).optional(),
    mode: IntakeLeafKindSchema.optional(),
    unit: z.string().max(32).nullable().optional(),
    wordRange: IntakeWordRangeSchema.nullable().optional(),
    parts: z.array(IntakePartSchema).max(INTAKE_MAX_PARTS).optional(),
    scheme: IntakeSchemeSchema.nullable().optional(),
    tag: IntakeCurriculumTagSchema.optional(),
    stimulusId: IdSchema.nullable().optional().meta({
      description: 'Attach to (or, with null, detach from) a stimulus of the same batch. Attaching gathers the group contiguous: the response says `reordered`.',
    }),
    page: z.number().int().min(1).max(10_000).optional(),
    confirmed: z.array(z.string().min(1).max(64)).max(50).optional().meta({ description: 'The full list of confirmed low fields after this edit.' }),
    needsManual: z.literal(false).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: INTAKE_MESSAGES.emptyPatch })
  .meta({
    id: 'IntakeItemPatch',
    description: 'Prototype IntakeQuestion fields that a person may edit. Partial; at least one key.',
  })
export type IntakeItemPatch = z.infer<typeof IntakeItemPatchSchema>

/** Response of the edit: the item, and whether the paper order changed (prototype `attachToStimulus().moved`). */
export const IntakeItemPatchResultSchema = z
  .strictObject({
    data: IntakeItemSchema,
    reordered: z.boolean().meta({
      description: `True when attaching to a stimulus moved items to keep the group contiguous; the screen shows "${INTAKE_MESSAGES.groupMoved}".`,
    }),
  })
  .meta({ id: 'IntakeItemPatchResult' })
export type IntakeItemPatchResult = z.infer<typeof IntakeItemPatchResultSchema>

/* ------------------------------------------------------------------------------------------ */
/* Add an item: POST /intake/batches/{id}/items                                                */
/* ------------------------------------------------------------------------------------------ */

/**
 * "Tambah soalan" (prototype `blankQuestion(subject, nextLabel(questions), page)`): a blank item the
 * reviewer fills in, for a question the extractor missed (AC-04.6). The server picks the next number
 * label (highest numeric label plus one) and the batch subject. Source type is `manual`. Defaults, from
 * the prototype `blankQuestion` and `emptyTag(subject)`: see `INTAKE_BLANK_ITEM_DEFAULTS`.
 */
export const INTAKE_BLANK_ITEM_DEFAULTS = {
  type: 'short',
  stem: '',
  options: [],
  marks: 1,
  mode: 'short_text',
  parts: [],
  page: 1,
  lowFields: [],
  confirmed: [],
  tag: { level: 'T4+T5', unit: null, unitLabel: '', sp: [], tp: 3, formOrigin: 'T4' },
} as const

export const IntakeItemCreateRequestSchema = z
  .strictObject({ page: z.number().int().min(1).max(10_000).optional().meta({ description: 'Page the missing question is on; defaults to 1.' }) })
  .meta({ id: 'IntakeItemCreateRequest', description: '[PROPOSED] Body of POST /intake/batches/{id}/items.' })
export type IntakeItemCreateRequest = z.infer<typeof IntakeItemCreateRequestSchema>

/* ------------------------------------------------------------------------------------------ */
/* Accept / reject / duplicate                                                                 */
/* ------------------------------------------------------------------------------------------ */

/** Accept takes no content: it converts the item as it stands. Strict empty object. */
export const IntakeAcceptRequestSchema = z
  .strictObject({})
  .meta({ id: 'IntakeAcceptRequest', description: '[PROPOSED] Empty object. The server converts the stored item (prototype intakeToDef) into a Draf question through QuestionsService.' })
export type IntakeAcceptRequest = z.infer<typeof IntakeAcceptRequestSchema>

export const IntakeRejectRequestSchema = z
  .strictObject({
    reason: z.string().trim().min(1, INTAKE_MESSAGES.rejectReasonRequired).max(500),
  })
  .meta({ id: 'IntakeRejectRequest', description: '[PROPOSED] A reason is mandatory; the item never becomes a question and is kept with the reason.' })
export type IntakeRejectRequest = z.infer<typeof IntakeRejectRequestSchema>

/**
 * Duplicate decision (card: "duplicate links to the matching question"; AC-06.2, AC-06.3, AC-06.5).
 *  - `duplicate`: link the item to exactly one of `matchedQuestionId` (bank) or `matchedItemId` (an item
 *    of the SAME batch). The matching entry becomes `linked` (a new one is created when the check did
 *    not find it: kind `near`, similarity null) and the item becomes `duplicate`. This is also the
 *    AC-06.3 "Gabung (keep one)" choice [PROPOSED mapping]; "Tolak" is the reject route.
 *  - `variant` [PROPOSED]: AC-06.2 "link as a variant" (exam schema D11 family): the entry becomes
 *    `linked` with kind `variant`; informational, the item state does not change. "Link as a new
 *    version of the matched question" has no basis in the card or the prototype and is an open question.
 *  - `not_duplicate` ("Bukan pendua", AC-06.5): dismisses the one entry named by `duplicateId`, for that
 *    pair only; the state is recomputed (needs_review or generated).
 * Target scope (IDOR): `matchedItemId` must belong to the item's own batch; `matchedQuestionId` must be a
 * question the caller may read under BE-09 scope. An id that does not exist, is in another batch or is
 * not readable gets the IDENTICAL 422 (`fields.matchedQuestionId` or `fields.matchedItemId`, message
 * "Padanan pendua tidak ditemui"), so the route cannot be used to probe ids.
 */
export const IntakeDuplicateRequestSchema = z
  .strictObject({
    decision: z.enum(['duplicate', 'variant', 'not_duplicate']),
    matchedQuestionId: IdSchema.optional(),
    matchedItemId: IdSchema.optional(),
    duplicateId: IdSchema.optional().meta({ description: 'The IntakeDuplicateEntry to dismiss (not_duplicate only).' }),
    note: z.string().trim().max(500).optional(),
  })
  .refine(
    (v) =>
      v.decision === 'not_duplicate'
        ? v.duplicateId !== undefined && v.matchedQuestionId === undefined && v.matchedItemId === undefined
        : v.duplicateId === undefined && (v.matchedQuestionId === undefined) !== (v.matchedItemId === undefined),
    { message: INTAKE_MESSAGES.duplicateTargetRequired },
  )
  .meta({
    id: 'IntakeDuplicateRequest',
    description:
      '[PROPOSED] duplicate and variant need exactly one of matchedQuestionId / matchedItemId; not_duplicate needs duplicateId and no target.',
  })
export type IntakeDuplicateRequest = z.infer<typeof IntakeDuplicateRequestSchema>

/**
 * 422 of accept (and of the bulk skips): the quality gate failed. `details.issues` is the prototype
 * `submitForReview` `{ ok: false, issues }` result carried in the standard error format.
 */
export const IntakeGateErrorBodySchema = z
  .strictObject({
    error: z.strictObject({
      code: z.literal('VALIDATION_ERROR'),
      message: z.literal(INTAKE_MESSAGES.gateFailed),
      details: z.strictObject({ issues: z.array(IntakeIssueSchema).min(1) }),
      requestId: z.string().optional(),
    }),
  })
  .meta({ id: 'IntakeGateErrorBody', description: '[PROPOSED] ErrorBody whose details.issues lists every failed gate rule (BM, verbatim from the prototype).' })
export type IntakeGateErrorBody = z.infer<typeof IntakeGateErrorBodySchema>

/* ------------------------------------------------------------------------------------------ */
/* Bulk: POST /intake/items/bulk                                                               */
/* ------------------------------------------------------------------------------------------ */

export const INTAKE_BULK_MAX_IDS = 100
export const INTAKE_BULK_ACTIONS = ['accept', 'reject'] as const

/**
 * Bulk accept or reject (card). `accept` is Admin Pusat only (403 for a Guru) and only takes items
 * whose confidence band reaches the server threshold (`INTAKE_BULK_ACCEPT_MIN_BAND`, default `high`,
 * card open question 2); the threshold is server configuration, not a request field. `reject` needs a
 * reason. An item that fails is skipped and listed (AC-07.4, "No bypass": the same gate as a single
 * accept), never silently dropped. An id the caller cannot see (unknown or outside the Guru's own
 * batches) is skipped as `NOT_FOUND`, the same as an unknown id; it is never a 404 for the whole call.
 */
export const IntakeBulkRequestSchema = z
  .strictObject({
    action: z.enum(INTAKE_BULK_ACTIONS),
    ids: z.array(IdSchema).min(1).max(INTAKE_BULK_MAX_IDS).refine((ids) => new Set(ids).size === ids.length, { message: 'Duplicate ids.' }),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.action !== 'reject' || (v.reason !== undefined && v.reason.length > 0), {
    message: INTAKE_MESSAGES.rejectReasonRequired,
    path: ['reason'],
  })
  .refine((v) => v.action !== 'accept' || v.reason === undefined, { message: 'reason is only for reject.', path: ['reason'] })
  .meta({ id: 'IntakeBulkRequest', description: '[PROPOSED] Body of POST /intake/items/bulk.' })
export type IntakeBulkRequest = z.infer<typeof IntakeBulkRequestSchema>

export const INTAKE_BULK_SKIP_REASONS = ['NOT_FOUND', 'WRONG_STATE', 'GATE_FAILED', 'BELOW_THRESHOLD'] as const
export const IntakeBulkSkipReasonSchema = z.enum(INTAKE_BULK_SKIP_REASONS).meta({
  id: 'IntakeBulkSkipReason',
  description:
    '[PROPOSED] NOT_FOUND: unknown id or outside the caller scope (the two are not told apart). WRONG_STATE: already accepted or rejected. GATE_FAILED: see `issues`. BELOW_THRESHOLD: the confidence band is under the bulk-accept threshold.',
})
export type IntakeBulkSkipReason = z.infer<typeof IntakeBulkSkipReasonSchema>

export const IntakeBulkResultItemSchema = z
  .strictObject({
    id: IdSchema,
    outcome: z.enum(['done', 'skipped']),
    reason: IntakeBulkSkipReasonSchema.nullable(),
    issues: z.array(IntakeIssueSchema).optional().meta({ description: 'Present when reason is GATE_FAILED.' }),
    item: IntakeItemRowSchema.nullable().meta({ description: 'The item after the action; null when skipped.' }),
  })
  .meta({ id: 'IntakeBulkResultItem' })

export const IntakeBulkResultSchema = z
  .strictObject({
    action: z.enum(INTAKE_BULK_ACTIONS),
    threshold: IntakeConfidenceBandSchema.nullable().meta({ description: 'The band floor applied to an accept; null for reject.' }),
    results: z.array(IntakeBulkResultItemSchema).meta({ description: 'One entry per requested id, in request order.' }),
    done: z.number().int().min(0),
    skipped: z.number().int().min(0),
  })
  .meta({ id: 'IntakeBulkResult', description: '[PROPOSED] Per-id outcome of a bulk action.' })
export type IntakeBulkResult = z.infer<typeof IntakeBulkResultSchema>

/* ------------------------------------------------------------------------------------------ */
/* Stimuli (rajah / petikan) of a batch                                                        */
/* ------------------------------------------------------------------------------------------ */

/**
 * "Tambah rajah" / "Tambah petikan" (prototype `addStimulus(kind)`). The server numbers the label
 * ("Rajah 1", "Petikan 2": the count of stimuli whose label starts with the same word plus one) unless
 * `label` is sent. No `svg` field exists on a write (stored-XSS rule).
 */
export const IntakeStimulusCreateRequestSchema = z
  .strictObject({
    kind: IntakeStimulusKindSchema,
    label: z.string().trim().min(1).max(100).optional(),
    page: z.number().int().min(1).max(10_000).optional(),
    caption: z.string().max(300).optional(),
    alt: z.string().max(1000).optional(),
    text: z.string().max(INTAKE_MAX_STEM_CHARS).optional(),
    table: StimulusTable.optional(),
  })
  .meta({ id: 'IntakeStimulusCreateRequest', description: '[PROPOSED] Body of POST /intake/batches/{id}/stimuli.' })
export type IntakeStimulusCreateRequest = z.infer<typeof IntakeStimulusCreateRequestSchema>

/** Edit of a stimulus (prototype `patchStimulus`: caption, alt text, passage text; plus label and table). */
export const IntakeStimulusUpdateRequestSchema = z
  .strictObject({
    label: z.string().trim().min(1).max(100).optional(),
    caption: z.string().max(300).nullable().optional(),
    alt: z.string().max(1000).optional(),
    text: z.string().max(INTAKE_MAX_STEM_CHARS).nullable().optional(),
    table: StimulusTable.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: INTAKE_MESSAGES.emptyPatch })
  .meta({ id: 'IntakeStimulusUpdateRequest', description: '[PROPOSED] Body of PATCH /intake/stimuli/{id}. Partial; at least one key.' })
export type IntakeStimulusUpdateRequest = z.infer<typeof IntakeStimulusUpdateRequestSchema>

/** Result of removing a stimulus: every item that used it is detached (prototype `removeStimulus`). */
export const IntakeStimulusRemovedSchema = z
  .strictObject({ id: IdSchema, detachedItemIds: z.array(IdSchema) })
  .meta({ id: 'IntakeStimulusRemoved', description: '[PROPOSED] Stimulus removed; the listed items no longer have a stimulusId.' })
export type IntakeStimulusRemoved = z.infer<typeof IntakeStimulusRemovedSchema>

/* ------------------------------------------------------------------------------------------ */
/* Batch review summary: GET /intake/batches/{id}/review                                       */
/* ------------------------------------------------------------------------------------------ */

/**
 * [PROPOSED] A gate issue in the batch summary. `blocksAccept` says whether it stops a single accept
 * (item-level and stimulus-level rules) or only the later BE-10 submit (batch-level rules: empty batch,
 * source and copyright, group contiguity). See `INTAKE_ACCEPT_BLOCKING_RULES` in question.ts.
 */
export const IntakeBatchIssueSchema = IntakeIssueSchema.extend({
  blocksAccept: z.boolean(),
}).meta({ id: 'IntakeBatchIssue', description: '[PROPOSED] IntakeIssue plus blocksAccept.' })
export type IntakeBatchIssue = z.infer<typeof IntakeBatchIssueSchema>

/** Prototype `GroupInfo` (grouping.ts): a stimulus group and whether its items are contiguous. */
export const IntakeGroupSchema = z
  .strictObject({
    stimulusId: IdSchema,
    itemIds: z.array(IdSchema),
    from: z.string().max(32).meta({ description: 'Printed label of the first item.' }),
    to: z.string().max(32).meta({ description: 'Printed label of the last item.' }),
    contiguous: z.boolean(),
  })
  .meta({ id: 'IntakeGroup', description: 'Prototype GroupInfo with questionIds renamed itemIds.' })
export type IntakeGroup = z.infer<typeof IntakeGroupSchema>

/**
 * What the review header and the side panels of the prototype read from `getIntakeBatch` and
 * `validateBatch`: counts, the extractor, unmatched scheme entries, the stimuli and groups, and the
 * issues that are not tied to one item. The batch declaration and processing status are BE-37
 * (`GET /intake/batches/{id}`); this is the review content only.
 */
export const IntakeBatchReviewSchema = z
  .strictObject({
    batchId: IdSchema,
    provider: z.string().max(64).nullable().meta({ description: 'Prototype IntakeBatch.provider ("Pengekstrak: <provider> (<model>)"). Never a key or URL.' }),
    model: z.string().max(128).nullable(),
    unmatched: z.array(z.string().max(200)).meta({ description: 'Scheme entries whose question number was not found (AC-04.2), e.g. "Skema 9". Prototype ExtractedPaper.unmatched.' }),
    warnings: z.array(z.string().max(500)).meta({ description: 'Paper-level BM warnings, e.g. "Tiada soalan dikesan dalam teks kertas." (prototype ExtractedPaper.warnings).' }),
    stimuli: z.array(IntakeStimulusSchema),
    groups: z.array(IntakeGroupSchema),
    counts: z.strictObject({
      items: z.number().int().min(0).meta({ description: 'Prototype "N soalan".' }),
      marks: z.number().int().min(0).meta({ description: 'Prototype "N markah" (paperMarks).' }),
      groups: z.number().int().min(0).meta({ description: 'Prototype "N kumpulan rajah".' }),
      low: z.number().int().min(0).meta({ description: 'Low fields not yet confirmed (prototype lowCount).' }),
      states: IntakeItemStateCountsSchema,
    }),
    issues: z.array(IntakeBatchIssueSchema).meta({
      description: 'Gate issues of the whole batch: every item issue (with itemId) plus the batch-level and stimulus-level ones (no itemId): "Kertas" source and copyright, empty batch, non-contiguous group, missing alt text.',
    }),
    extraction: IntakeExtractionRunSchema.nullable().meta({ description: 'The latest run; null before extraction was requested.' }),
  })
  .meta({ id: 'IntakeBatchReview', description: '[PROPOSED] Review header and side panels of one batch.' })
export type IntakeBatchReview = z.infer<typeof IntakeBatchReviewSchema>

/* ------------------------------------------------------------------------------------------ */
/* Responses                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export const IntakeItemEnvelopeSchema = z.object({ data: IntakeItemSchema }).meta({ id: 'IntakeItemEnvelope' })
export const IntakeExtractionRunEnvelopeSchema = z.object({ data: IntakeExtractionRunSchema }).meta({ id: 'IntakeExtractionRunEnvelope' })
export const IntakeBulkResultEnvelopeSchema = z.object({ data: IntakeBulkResultSchema }).meta({ id: 'IntakeBulkResultEnvelope' })
export const IntakeBatchReviewEnvelopeSchema = z.object({ data: IntakeBatchReviewSchema }).meta({ id: 'IntakeBatchReviewEnvelope' })
export const IntakeStimulusEnvelopeSchema = z.object({ data: IntakeStimulusSchema }).meta({ id: 'IntakeStimulusEnvelope' })
export const IntakeStimulusRemovedEnvelopeSchema = z.object({ data: IntakeStimulusRemovedSchema }).meta({ id: 'IntakeStimulusRemovedEnvelope' })
