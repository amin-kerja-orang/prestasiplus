import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { ListMetaSchema } from '../common/envelope'
import { TimestampSchema } from '../common/time'
import { QuestionWorkflowStatusSchema } from '../question-workflow/lifecycle'
import {
  IntakeIssueSchema,
  IntakeQuestionSchema,
  IntakeQuestionTypeSchema,
  IntakeRegionSchema,
  IntakeStimulusSchema,
} from './question'

/**
 * BE-38 (contract only): the intake ITEM, its review states and the review-queue list.
 *
 * The prototype (commit `9af43134`, `admin/intake/types.ts`, `server/store.ts`) has one document per
 * batch (`IntakeBatch.questions[]`, status `draf` | `semakan`). The card BE-38 splits the batch into
 * items (open question 1 of the card: working assumption, the LEAD adapts the frontend client). An item
 * is a prototype `IntakeQuestion` plus the fields below, flattened (no nesting), so the editor binds to
 * the same field names it uses today. Everything the prototype does not define is `[PROPOSED]`.
 *
 * D54(a): the five QUESTION lifecycle codes (`draft`, `review`, `approved`, `published`, `archived`)
 * appear only in `question.status`, the read-through status of the question an accepted item created.
 * The item REVIEW states below are a separate set; no mock question status (`pending_review`,
 * `rejected` as a question status, `approved` meaning live) exists on this wire.
 */

/* ------------------------------------------------------------------------------------------ */
/* Item review states                                                                          */
/* ------------------------------------------------------------------------------------------ */

/** Card BE-38 and v2-question-bank 4.1 ("Extraction-item review state"). Codes are English (migration rule). */
export const INTAKE_ITEM_STATES = ['generated', 'needs_review', 'accepted', 'rejected', 'duplicate'] as const
export const IntakeItemStateSchema = z.enum(INTAKE_ITEM_STATES).meta({
  id: 'IntakeItemState',
  description:
    '[PROPOSED] Review state of an extracted item (card BE-38): generated = Dijana, needs_review = Perlu semakan, accepted = Diterima (a Draf question exists), rejected = Ditolak (never becomes a question, kept with a reason), duplicate = Pendua. NOT a question status (D54a).',
})
export type IntakeItemState = z.infer<typeof IntakeItemStateSchema>

export const INTAKE_ITEM_STATE_LABELS = {
  generated: 'Dijana',
  needs_review: 'Perlu semakan',
  accepted: 'Diterima',
  rejected: 'Ditolak',
  duplicate: 'Pendua',
} as const satisfies Record<IntakeItemState, string>

/**
 * The only states the AI service and the extraction worker may write (card AC2, AC-05.6): it can never
 * accept, reject, mark a duplicate by decision or confirm a low field. Only an authenticated human
 * reviewer moves an item further. (An automatic duplicate flag from the check sets `duplicate`; that
 * is the check, not the AI adapter.)
 */
export const INTAKE_AI_SETTABLE_STATES = ['generated', 'needs_review'] as const satisfies readonly IntakeItemState[]

/** States from which a person can still edit, accept, reject or mark the item. `accepted` and `rejected` are final here. */
export const INTAKE_OPEN_STATES = ['generated', 'needs_review', 'duplicate'] as const satisfies readonly IntakeItemState[]

/* ------------------------------------------------------------------------------------------ */
/* Confidence                                                                                  */
/* ------------------------------------------------------------------------------------------ */

/**
 * [PROPOSED] Bands of v2-question-bank AC-05.3 ([Default]: High >= 0.90, Medium 0.70-0.89, Low < 0.70).
 * The prototype review queue used `tinggi` | `sederhana` | `rendah` (admin-types `Confidence`); the wire
 * uses English codes (deviation row).
 */
export const INTAKE_CONFIDENCE_BANDS = ['high', 'medium', 'low'] as const
export const IntakeConfidenceBandSchema = z.enum(INTAKE_CONFIDENCE_BANDS).meta({
  id: 'IntakeConfidenceBand',
  description: '[PROPOSED] high = Tinggi (>= 0.90), medium = Sederhana (0.70 to 0.89), low = Rendah (< 0.70). The band of an item is its LOWEST field (AC-07.1).',
})
export type IntakeConfidenceBand = z.infer<typeof IntakeConfidenceBandSchema>

export const INTAKE_CONFIDENCE_BAND_LABELS = {
  high: 'Tinggi',
  medium: 'Sederhana',
  low: 'Rendah',
} as const satisfies Record<IntakeConfidenceBand, string>

export const INTAKE_CONFIDENCE_HIGH_MIN = 0.9
export const INTAKE_CONFIDENCE_MEDIUM_MIN = 0.7

/** Band of one confidence value (0..1). */
export function intakeConfidenceBand(confidence: number): IntakeConfidenceBand {
  if (confidence >= INTAKE_CONFIDENCE_HIGH_MIN) return 'high'
  if (confidence >= INTAKE_CONFIDENCE_MEDIUM_MIN) return 'medium'
  return 'low'
}

/** Band of an item: the lowest of its field confidences. No field data (a manual item) counts as high. */
export function intakeItemConfidenceBand(fieldConfidence: Readonly<Record<string, number>>): IntakeConfidenceBand {
  const values = Object.values(fieldConfidence)
  if (values.length === 0) return 'high'
  return intakeConfidenceBand(Math.min(...values))
}

export const IntakeFieldConfidenceSchema = z
  .record(z.string().min(1).max(64), z.number().min(0).max(1))
  .meta({
    id: 'IntakeFieldConfidence',
    description:
      '[PROPOSED] Field name to confidence 0..1 (same scale as BE-36 `fieldConfidence`). The prototype only lists `lowFields`; `lowFields` stays the authority for the gate.',
  })

/* ------------------------------------------------------------------------------------------ */
/* Duplicates                                                                                  */
/* ------------------------------------------------------------------------------------------ */

/**
 * [PROPOSED] Card BE-38 AC5 and v2-question-bank US-06 / exam schema D11: exact = "Pendua tepat"
 * (blocked until rejected or linked), near = "Mungkin pendua" (similarity >= 0.85, reviewer decides),
 * variant = same structure with different numbers or figure (allowed, not a duplicate; informational).
 */
export const INTAKE_DUPLICATE_KINDS = ['exact', 'near', 'variant'] as const
export const IntakeDuplicateKindSchema = z.enum(INTAKE_DUPLICATE_KINDS).meta({
  id: 'IntakeDuplicateKind',
  description: '[PROPOSED] exact = Pendua tepat, near = Mungkin pendua, variant = Varian (allowed).',
})
export type IntakeDuplicateKind = z.infer<typeof IntakeDuplicateKindSchema>

export const INTAKE_DUPLICATE_KIND_LABELS = {
  exact: 'Pendua tepat',
  near: 'Mungkin pendua',
  variant: 'Varian',
} as const satisfies Record<IntakeDuplicateKind, string>

/** v2-question-bank AC-06.3 [Default] similarity threshold for "Mungkin pendua". */
export const INTAKE_DUPLICATE_NEAR_THRESHOLD = 0.85

export const IntakeDuplicateScopeSchema = z.enum(['bank', 'batch']).meta({
  id: 'IntakeDuplicateScope',
  description: '[PROPOSED] bank = a question already in the bank (Draf, Semakan, Lulus, Terbit); batch = another item of the same upload (AC-06.1).',
})

export const IntakeDuplicateFlagSchema = z
  .strictObject({
    kind: IntakeDuplicateKindSchema,
    scope: IntakeDuplicateScopeSchema,
    similarity: z.number().min(0).max(1),
    matchedQuestionId: IdSchema.nullable().meta({ description: 'Set when scope is bank.' }),
    matchedItemId: IdSchema.nullable().meta({ description: 'Set when scope is batch.' }),
    dismissed: z.boolean().meta({ description: 'A reviewer chose "Bukan pendua": the flag is suppressed for this pair only (AC-06.5).' }),
  })
  .refine((f) => (f.scope === 'bank' ? f.matchedQuestionId !== null : f.matchedItemId !== null), {
    message: 'A bank flag needs matchedQuestionId and a batch flag needs matchedItemId.',
  })
  .meta({ id: 'IntakeDuplicateFlag', description: '[PROPOSED] Result of the duplicate check, with the matching id (card AC5).' })
export type IntakeDuplicateFlag = z.infer<typeof IntakeDuplicateFlagSchema>

/* ------------------------------------------------------------------------------------------ */
/* Actors, links, provenance, events                                                           */
/* ------------------------------------------------------------------------------------------ */

export const IntakeActorRefSchema = z
  .strictObject({
    id: IdSchema,
    name: z.string().min(1).max(200).meta({ description: 'Display name (users table). Never an IC number.' }),
  })
  .meta({ id: 'IntakeActorRef', description: '[PROPOSED] A user shown in the queue (uploader, decider).' })
export type IntakeActorRef = z.infer<typeof IntakeActorRefSchema>

/**
 * The question an accepted item created (card: "the item stores the question id and version"). `status`
 * is read through from the question, so the reviewer and the Guru see Draf, Semakan, Lulus, Diterbitkan
 * or Diarkib (D54a codes) without a second call. Submit, approve and publish are BE-10 endpoints.
 */
export const IntakeAcceptedQuestionSchema = z
  .strictObject({
    id: IdSchema,
    version: z.number().int().min(1),
    status: QuestionWorkflowStatusSchema,
  })
  .meta({ id: 'IntakeAcceptedQuestion', description: '[PROPOSED] Link to the Draf question created by accept, with its current D54a status.' })
export type IntakeAcceptedQuestion = z.infer<typeof IntakeAcceptedQuestionSchema>

export const INTAKE_SOURCE_TYPES = ['pdf', 'manual'] as const
export const IntakeSourceTypeSchema = z.enum(INTAKE_SOURCE_TYPES).meta({
  id: 'IntakeSourceType',
  description: 'Prototype IntakeSourceKind: pdf = an uploaded paper, manual = typed by hand (no file).',
})

/**
 * [PROPOSED] Provenance AS EXTRACTED (card: source paper, file, page, region, number label,
 * `source_type`, run id, model). Later edits of `label` or `page` on the item are not reflected here.
 */
export const IntakeProvenanceSchema = z
  .strictObject({
    sourceType: IntakeSourceTypeSchema,
    fileId: IdSchema.nullable().meta({ description: 'BE-37 stored file; null for a manual item.' }),
    sourcePaperId: IdSchema.nullable().meta({ description: 'BE-10 source_papers pointer on the batch; null until set.' }),
    page: z.number().int().min(1).max(10_000),
    region: IntakeRegionSchema.nullable(),
    numberLabel: z.string().max(32),
    runId: IdSchema.nullable().meta({ description: 'Extraction run (ai_extraction_runs); null for a manual item.' }),
    provider: z.string().max(64).nullable().meta({ description: 'Prototype IntakeBatch.provider (e.g. mock). Never a key or URL.' }),
    model: z.string().max(128).nullable().meta({ description: 'Prototype IntakeBatch.model.' }),
  })
  .meta({ id: 'IntakeProvenance', description: '[PROPOSED] Where the item came from (US-16).' })
export type IntakeProvenance = z.infer<typeof IntakeProvenanceSchema>

export const INTAKE_EVENT_ACTIONS = [
  'extracted',
  'added',
  'edited',
  'confirmed',
  'accepted',
  'rejected',
  'marked_duplicate',
  'cleared_duplicate',
] as const
export const IntakeEventActionSchema = z.enum(INTAKE_EVENT_ACTIONS).meta({ id: 'IntakeEventAction', description: '[PROPOSED] What happened to an item.' })
export type IntakeEventAction = z.infer<typeof IntakeEventActionSchema>

/**
 * [PROPOSED] One row of `intake_item_events` (card AC6): who, when, from, to, reason. For an edit the
 * previous text of the field is kept (`previous`, AC-08.2: the AI text stays in the history). `actor`
 * is null when the system or the extraction worker acted.
 */
export const IntakeItemEventSchema = z
  .strictObject({
    id: IdSchema,
    at: TimestampSchema,
    action: IntakeEventActionSchema,
    actor: IntakeActorRefSchema.nullable(),
    actorRole: z.string().min(1).max(32).nullable().meta({ description: 'RoleCode of the actor, kept as text in the audit row.' }),
    from: IntakeItemStateSchema.nullable(),
    to: IntakeItemStateSchema.nullable(),
    field: z.string().min(1).max(64).nullable().meta({ description: 'Edited or confirmed field, e.g. stem, tag.unit.' }),
    previous: z.string().max(20_000).nullable().meta({ description: 'Previous value of `field` as text (the AI text on the first human edit).' }),
    reason: z.string().max(500).nullable(),
  })
  .meta({ id: 'IntakeItemEvent', description: '[PROPOSED] Audit row of one change to an item.' })
export type IntakeItemEvent = z.infer<typeof IntakeItemEventSchema>

/* ------------------------------------------------------------------------------------------ */
/* Item (detail) and row (list)                                                                */
/* ------------------------------------------------------------------------------------------ */

/**
 * Fields every view of an item shares and that the prototype IntakeSummary / IntakeQuestion did not
 * have. All [PROPOSED] (card BE-38 Outputs and Endpoints).
 */
const itemCommon = {
  batchId: IdSchema.meta({ description: 'The intake batch (BE-37 intake_batches = the Submission, D53/OWN-1).' }),
  position: z.number().int().min(1).meta({ description: 'Order of the item in the paper. Items of one stimulus group stay contiguous.' }),
  state: IntakeItemStateSchema,
  confidenceBand: IntakeConfidenceBandSchema,
  uploader: IntakeActorRefSchema.meta({ description: 'Owner of the batch. A Guru only ever sees own items.' }),
  question: IntakeAcceptedQuestionSchema.nullable().meta({ description: 'Set once the item is accepted.' }),
  duplicate: IntakeDuplicateFlagSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
} as const

/** A row of the review queue (`GET /intake/items`, AC-07.1). */
export const IntakeItemRowSchema = z
  .strictObject({
    id: IdSchema,
    label: z.string().max(32).meta({ description: 'Number label as printed.' }),
    type: IntakeQuestionTypeSchema,
    stemPreview: z.string().max(300).meta({ description: 'Plain-text preview of the stem (first part prompt when the stem is empty). May hold `$latex$`.' }),
    marks: z.number().int().min(0).meta({ description: 'Question marks (sum of part marks for a structured question).' }),
    page: z.number().int().min(1),
    subject: z.string().min(1).max(32),
    stimulusId: IdSchema.optional(),
    lowCount: z.number().int().min(0).meta({ description: 'Low-confidence fields not yet confirmed (prototype IntakeSummary.lowCount, per item).' }),
    issueCount: z.number().int().min(0).meta({ description: 'Open quality-gate issues of this item.' }),
    needsManual: z.boolean(),
    ...itemCommon,
  })
  .meta({ id: 'IntakeItemRow', description: '[PROPOSED] One row of the review queue.' })
export type IntakeItemRow = z.infer<typeof IntakeItemRowSchema>

/**
 * One extracted item with everything the review screen shows (`GET /intake/items/{id}`): the prototype
 * `IntakeQuestion` fields (flattened, `id` = item id) plus review state, confidence, region, provenance,
 * the shared stimulus, the live gate issues and the history. Field edits go through `PATCH`.
 */
export const IntakeItemSchema = IntakeQuestionSchema.extend({
  ...itemCommon,
  fieldConfidence: IntakeFieldConfidenceSchema,
  region: IntakeRegionSchema.nullable().meta({ description: '[PROPOSED] Region of the question on `page`, to highlight it beside the extracted fields (AC-08.1).' }),
  humanEdited: z.array(z.string().min(1).max(64)).max(100).meta({
    description: '[PROPOSED] Fields a person edited: the UI marks them "Disunting oleh manusia" (AC-08.2). The AI text is in `events`.',
  }),
  issues: z.array(IntakeIssueSchema).meta({
    description: 'Quality-gate issues of this item right now (prototype validateBatch, per item). accept is refused with 422 while this list is not empty.',
  }),
  stimulus: IntakeStimulusSchema.nullable().meta({ description: 'The shared stimulus of `stimulusId`, or null.' }),
  rejectReason: z.string().max(500).nullable(),
  decidedBy: IntakeActorRefSchema.nullable().meta({ description: 'Who accepted or rejected the item.' }),
  decidedAt: TimestampSchema.nullable(),
  provenance: IntakeProvenanceSchema,
  events: z.array(IntakeItemEventSchema).meta({ description: 'Oldest first.' }),
}).meta({ id: 'IntakeItem', description: '[PROPOSED] Prototype IntakeQuestion plus review state and provenance, flattened.' })
export type IntakeItem = z.infer<typeof IntakeItemSchema>

/* ------------------------------------------------------------------------------------------ */
/* List query and meta                                                                         */
/* ------------------------------------------------------------------------------------------ */

export const INTAKE_ITEM_PAGE_SIZE_MAX = 100

/**
 * Filters of the review queue (card: status, batch, subject, uploader, confidence band, duplicate flag;
 * AC-07.2). `state` is the item review state (the card says "status"; the word is avoided so it is not
 * mistaken for a question status, D54a). A Guru sees own items whatever `uploaderId` says; an unknown
 * filter value matches nothing.
 */
export const IntakeItemListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(INTAKE_ITEM_PAGE_SIZE_MAX).default(20),
    state: IntakeItemStateSchema.optional(),
    batchId: IdSchema.optional(),
    subject: z.string().min(1).max(32).optional(),
    uploaderId: IdSchema.optional().meta({ description: 'Admin Pusat only; ignored for a Guru.' }),
    band: IntakeConfidenceBandSchema.optional(),
    duplicate: z.enum(['any', 'exact', 'near', 'variant', 'none']).optional().meta({
      description: 'any = an open (not dismissed) flag of any kind; none = no open flag.',
    }),
  })
  .meta({ id: 'IntakeItemListQuery', description: '[PROPOSED] Filters of GET /intake/items. Order: newest batch first, then paper order.' })
export type IntakeItemListQuery = z.infer<typeof IntakeItemListQuerySchema>

export const IntakeItemStateCountsSchema = z
  .strictObject({
    generated: z.number().int().min(0),
    needs_review: z.number().int().min(0),
    accepted: z.number().int().min(0),
    rejected: z.number().int().min(0),
    duplicate: z.number().int().min(0),
  })
  .meta({ id: 'IntakeItemStateCounts', description: '[PROPOSED] Items per review state within the caller scope and the filters other than `state` (for the status tabs).' })
export type IntakeItemStateCounts = z.infer<typeof IntakeItemStateCountsSchema>

export const IntakeItemListMetaSchema = ListMetaSchema.extend({ counts: IntakeItemStateCountsSchema }).meta({
  id: 'IntakeItemListMeta',
  description: '[PROPOSED] Standard list meta plus per-state counts computed from the same query (no stored counts).',
})
export type IntakeItemListMeta = z.infer<typeof IntakeItemListMetaSchema>

export const IntakeItemListResponseSchema = z
  .object({ data: z.array(IntakeItemRowSchema), meta: IntakeItemListMetaSchema })
  .meta({ id: 'IntakeItemListResponse' })
export type IntakeItemListResponse = z.infer<typeof IntakeItemListResponseSchema>
