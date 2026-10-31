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
 * D54(a): the four QUESTION lifecycle codes (`draft`, `review`, `approved`, `archived`; ADR-0027)
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
    '[PROPOSED] Review state of an extracted item (card BE-38): generated = Dijana (nothing needs attention), needs_review = Perlu semakan (any unconfirmed low field, needsManual, or an open exact or near duplicate entry), accepted = Diterima (a Draf question exists), rejected = Ditolak (never becomes a question, kept with a reason), duplicate = Pendua (a person linked it as a duplicate). NOT a question status (D54a).',
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
 * [PROPOSED] The state machine, exactly (the prototype has none; it only has the batch states `draf`
 * and `semakan`):
 *  - The extraction worker and the automatic duplicate check write ONLY `generated` or `needs_review`
 *    (card AC2, AC-05.6). The automatic check adds `duplicates[]` entries with status `open`; it never
 *    sets `duplicate`, `accepted` or `rejected` and never confirms a low field. Only a human decision
 *    sets `duplicate`.
 *  - An open item (not accepted, not rejected) is `duplicate` when a person linked at least one exact or
 *    near entry (`status: linked`); otherwise `needs_review` when ANY of: an unconfirmed low field
 *    (`lowFields` minus `confirmed`), `needsManual`, or an `open` exact or near entry; otherwise
 *    `generated`. The server recomputes it after every edit and decision, so confirming the last low
 *    field moves `needs_review` back to `generated`. `intakeOpenState` is that rule as a function.
 *  - `variant` entries are informational and never change the state.
 *  - `accepted` and `rejected` are final and are set only by a human call (accept, reject, bulk).
 */
export const INTAKE_AI_SETTABLE_STATES = ['generated', 'needs_review'] as const satisfies readonly IntakeItemState[]

/** States from which a person can still edit, reject or decide a duplicate. `accepted` and `rejected` are final. A `duplicate` item cannot be accepted (409). */
export const INTAKE_OPEN_STATES = ['generated', 'needs_review', 'duplicate'] as const satisfies readonly IntakeItemState[]

/** The inputs of the state rule (a subset of an item). */
export interface IntakeStateInput {
  lowFields: readonly string[]
  confirmed: readonly string[]
  needsManual?: boolean | undefined
  duplicates: readonly { kind: 'exact' | 'near' | 'variant'; status: 'open' | 'linked' | 'dismissed' }[]
}

/** State of an OPEN item by the rule above. */
export function intakeOpenState(input: IntakeStateInput): 'generated' | 'needs_review' | 'duplicate' {
  const counts = (d: { kind: string }) => d.kind === 'exact' || d.kind === 'near'
  if (input.duplicates.some((d) => counts(d) && d.status === 'linked')) return 'duplicate'
  const unconfirmed = input.lowFields.some((f) => !input.confirmed.includes(f))
  if (unconfirmed || input.needsManual === true || input.duplicates.some((d) => counts(d) && d.status === 'open')) return 'needs_review'
  return 'generated'
}

/** BM labels the prototype shows next to a field or question (AC-08.2, AC-04.5). */
export const INTAKE_HUMAN_EDITED_LABEL = 'Disunting oleh manusia'
export const INTAKE_NEEDS_MANUAL_LABEL = 'Perlu semak manual'

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
 * (open flag: the BE-10 submit gate wants it resolved), near = "Mungkin pendua" (similarity >= 0.85,
 * reviewer decides), variant = same structure with different numbers or figure (allowed, not a
 * duplicate; informational, never changes the item state).
 */
export const INTAKE_DUPLICATE_KINDS = ['exact', 'near', 'variant'] as const
export const IntakeDuplicateKindSchema = z.enum(INTAKE_DUPLICATE_KINDS).meta({
  id: 'IntakeDuplicateKind',
  description: '[PROPOSED] exact = Pendua tepat, near = Mungkin pendua, variant = Varian (informational).',
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
  description: '[PROPOSED] bank = a question already in the bank (Draf, Semakan, Lulus, Terbit); batch = another item of the SAME batch (AC-06.1).',
})

/** open = found by the check, no decision yet; linked = a person linked it; dismissed = "Bukan pendua" (AC-06.5). */
export const INTAKE_DUPLICATE_STATUSES = ['open', 'linked', 'dismissed'] as const
export const IntakeDuplicateStatusSchema = z.enum(INTAKE_DUPLICATE_STATUSES).meta({
  id: 'IntakeDuplicateStatus',
  description: '[PROPOSED] open = found by the check, linked = a person linked it, dismissed = "Bukan pendua" for this pair only (AC-06.5).',
})
export type IntakeDuplicateStatus = z.infer<typeof IntakeDuplicateStatusSchema>

/**
 * One duplicate finding or decision of an item (`duplicate_links`). An item has a list of them.
 * Visibility (IDOR): `batch` entries point at an item of the same batch, always visible to the owner.
 * A `bank` entry carries `matchedQuestionId` only when the caller may read that question under BE-09
 * scope; otherwise the id is withheld (`null`) and `restricted` is true, so a Guru cannot learn another
 * teacher's question ids from a flag.
 */
export const IntakeDuplicateEntrySchema = z
  .strictObject({
    id: IdSchema.meta({ description: 'Entry id; `not_duplicate` names the entry it dismisses.' }),
    kind: IntakeDuplicateKindSchema,
    scope: IntakeDuplicateScopeSchema,
    similarity: z.number().min(0).max(1).nullable().meta({ description: 'Null when a person linked it without a check result.' }),
    matchedQuestionId: IdSchema.nullable().meta({ description: 'Scope bank, and only when the caller may read the question.' }),
    matchedItemId: IdSchema.nullable().meta({ description: 'Scope batch: an item of the same batch.' }),
    restricted: z.boolean().meta({ description: 'True when the matched bank question exists but the caller may not read it (id withheld).' }),
    status: IntakeDuplicateStatusSchema,
  })
  .refine(
    (f) =>
      f.scope === 'bank'
        ? f.matchedItemId === null && (f.restricted ? f.matchedQuestionId === null : f.matchedQuestionId !== null)
        : f.matchedQuestionId === null && !f.restricted && f.matchedItemId !== null,
    { message: 'A bank entry has matchedQuestionId (null only when restricted); a batch entry has matchedItemId and no matchedQuestionId.' },
  )
  .meta({ id: 'IntakeDuplicateEntry', description: '[PROPOSED] One duplicate finding or decision, with the matching id (card AC5).' })
export type IntakeDuplicateEntry = z.infer<typeof IntakeDuplicateEntrySchema>

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
  'linked_variant',
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
    previous: z.unknown().meta({
      description:
        'Previous JSON value of `field`, typed by the field (string for stem, array for options and parts, object for scheme and tag; null when there was none). The AI value on the first human edit (AC-08.2). Not truncated, so edits of parts, scheme and options fit.',
    }),
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
  duplicates: z.array(IntakeDuplicateEntrySchema).max(50).meta({ description: 'Findings and decisions, oldest first. `variant` entries do not affect `state`.' }),
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
      description: 'An entry with status `open` of that kind. any = an open exact or near entry (variants excluded); none = no open entry of any kind.',
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
