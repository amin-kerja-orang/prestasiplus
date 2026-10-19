import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'

/**
 * BE-36 AI extraction service: wire types (D52, ADR 0019, plan section 15).
 *
 * Two kinds of type live here:
 *  1. In-process types exchanged between the intake worker (BE-38), the Cikgu Alesa service
 *     (BE-43) and the `ExtractionProvider` adapters. They never travel over HTTP ("extraction is
 *     invoked in-process by the intake worker, not by a public endpoint", card). They are
 *     registered as components so BE-38 and BE-43 import one definition.
 *  2. The HTTP bodies of the four admin routes `/ai/status`, `/ai/usage`, `/ai/settings`, `/ai/test`.
 *
 * Sources: the card (docs/plan/backend-tasks/BE-36-ai-extraction-service.md), plan 15.2, the
 * catalogue entry IN-08 (docs/architecture/v2-api-catalogue/learning-exam.md section 11: the
 * frontend `QuestionExtractor`, `ExtractInput`, `ExtractedPaper`, `IntakeQuestion`, `lowFields`).
 * The frontend intake code is NOT on this branch (local commit b2e1033, not pushed), so the draft
 * item fields below follow the catalogue summary of `types.ts`. Anything the catalogue does not
 * state is marked [PROPOSED] and listed in the PR.
 *
 * Hard rules encoded in the types:
 *  - No credential field exists anywhere (BE-NFR-32): no API key, no base URL, no provider config.
 *  - A draft has `status: 'draft'` and nothing else (AC-05.6, BE-NFR-35); there is no approval type.
 *  - Request types are strict objects: no user, student, teacher or school identifier can ride along
 *    (AC-04.8, BE-NFR-33). The caller identity for the cost log is a separate `AiCallContext` that
 *    is never forwarded to a provider.
 *  - Usage rows carry no content (AC5).
 */

/* ------------------------------------------------------------------------------------------ */
/* Constants and copy                                                                          */
/* ------------------------------------------------------------------------------------------ */

/** Provider ids of the registry (plan 15.2). An unknown id is a start-up error, never a fallback. */
export const AI_PROVIDER_IDS = ['mock', 'anthropic', 'openai', 'gemini', 'openai-compatible'] as const
export const AiProviderIdSchema = z.enum(AI_PROVIDER_IDS).meta({
  id: 'AiProviderId',
  description: 'Provider adapter id; selected server-side by AI_PROVIDER (default mock).',
})
export type AiProviderId = z.infer<typeof AiProviderIdSchema>

/**
 * Machine codes of an AI failure. On the wire (the 503 and 429 of the admin routes) only
 * `AI_UNAVAILABLE`, `AI_BUDGET_EXHAUSTED` and `RATE_LIMITED` appear; `AI_PROVIDER_ERROR` and
 * `AI_TIMEOUT` are in-process only (they are stored on a failed run and mapped to `AI_UNAVAILABLE`
 * by any caller that answers HTTP).
 */
export const AI_FAILURE_CODES = [
  'AI_UNAVAILABLE',
  'AI_BUDGET_EXHAUSTED',
  'RATE_LIMITED',
  'AI_PROVIDER_ERROR',
  'AI_TIMEOUT',
] as const
export const AiFailureCodeSchema = z.enum(AI_FAILURE_CODES).meta({
  id: 'AiFailureCode',
  description:
    'AI_UNAVAILABLE: provider not configured or unreachable (same code as BE-43). AI_BUDGET_EXHAUSTED: monthly cap reached, the caller may queue (AC-29.2, AC6). RATE_LIMITED: D57a. These three are the only codes on the wire. AI_PROVIDER_ERROR and AI_TIMEOUT [PROPOSED] are in-process only: the run failed after the retries with backoff on 429/5xx (AC4); a caller that answers HTTP maps them to AI_UNAVAILABLE.',
})
export type AiFailureCode = z.infer<typeof AiFailureCodeSchema>

/**
 * Admin-facing BM copy. `AI_UNAVAILABLE` follows the structure of the approved BE-43 sentence
 * ("... tidak dapat menjawab sekarang. Sila cuba sebentar lagi.") without the persona name. All
 * three are [PROPOSED] (no mock has an AI failure path); the LEAD aligns them at merge.
 */
export const AI_MESSAGES = {
  unavailable: 'Perkhidmatan AI tidak dapat dihubungi sekarang. Sila cuba sebentar lagi.',
  budgetExhausted: 'Had bajet AI bulanan telah dicapai. Pengekstrakan baharu ditunda sehingga had dinaikkan.',
  csrf: 'Sesi tidak sah. Sila muat semula halaman dan cuba lagi.',
} as const

/** Bounds (all [PROPOSED]; the limits are wire sanity caps, not business rules). */
export const AI_MAX_PAGES = 200
export const AI_MAX_PAGE_TEXT_CHARS = 100_000
export const AI_MAX_TEXT_CHARS = 200_000
export const AI_MAX_BUDGET_SEN = 100_000_000
export const AI_PAGE_SIZE_MAX = 100

const money = z.number().int().min(0).max(AI_MAX_BUDGET_SEN)

/* ------------------------------------------------------------------------------------------ */
/* Provider capabilities and health                                                            */
/* ------------------------------------------------------------------------------------------ */

export const AiCapabilitiesSchema = z
  .object({
    vision: z.boolean().meta({ description: 'The adapter accepts page images.' }),
    jsonMode: z.boolean().meta({ description: 'The adapter can be asked for a JSON-only reply.' }),
    maxPagesPerCall: z.number().int().min(1).meta({ description: 'Pages the adapter accepts in one call.' }),
  })
  .strict()
  .meta({ id: 'AiCapabilities', description: 'Plan 15.2 `capabilities` of an ExtractionProvider.' })
export type AiCapabilities = z.infer<typeof AiCapabilitiesSchema>

export const AiHealthSchema = z
  .object({
    ok: z.boolean(),
    latencyMs: z.number().int().min(0),
    checkedAt: TimestampSchema,
  })
  .strict()
  .meta({ id: 'AiHealth', description: 'Result of `ExtractionProvider.healthCheck()`.' })
export type AiHealth = z.infer<typeof AiHealthSchema>

/* ------------------------------------------------------------------------------------------ */
/* Usage and cost                                                                              */
/* ------------------------------------------------------------------------------------------ */

/** What one provider call was for. One `ai_usage_logs` row per call (AC5, AC9). */
export const AI_CALL_PURPOSES = ['extract_paper', 'suggest_tags', 'generate_text', 'health_check'] as const
export const AiCallPurposeSchema = z.enum(AI_CALL_PURPOSES).meta({
  id: 'AiCallPurpose',
  description: 'Operation of the ExtractionProvider interface that produced a usage row.',
})
export type AiCallPurpose = z.infer<typeof AiCallPurposeSchema>

export const AiUsageSchema = z
  .object({
    provider: AiProviderIdSchema,
    model: z.string().min(1).max(128).meta({ description: 'Model id reported by the adapter (the mock reports its own id).' }),
    pages: z.number().int().min(0).meta({ description: 'Pages sent; 0 for text-only operations.' }),
    tokensIn: z.number().int().min(0),
    tokensOut: z.number().int().min(0),
    costSen: z.number().int().min(0).meta({
      description: 'Cost in sen from the configured price table (AI_PRICE_TABLE_JSON); 0 for the mock provider.',
    }),
  })
  .strict()
  .meta({ id: 'AiUsage', description: 'Cost summary of one call. No content, no identifier of a person.' })
export type AiUsage = z.infer<typeof AiUsageSchema>

/* ------------------------------------------------------------------------------------------ */
/* Redaction                                                                                   */
/* ------------------------------------------------------------------------------------------ */

/** Categories masked before a provider call (NFR-04: names, school, contacts on a paper cover). */
export const AI_REDACTION_FLAGS = ['person_name', 'school_name', 'phone', 'email', 'ic_number', 'address'] as const
export const AiRedactionFlagSchema = z.enum(AI_REDACTION_FLAGS).meta({
  id: 'AiRedactionFlag',
  description:
    'Kind of personal detail that the redaction step masked. [PROPOSED] list: the card names names, school and contacts; IC number and address are added as the obvious cover-page contact details.',
})
export type AiRedactionFlag = z.infer<typeof AiRedactionFlagSchema>

export const AiRedactionSummarySchema = z
  .object({
    applied: z.literal(true).meta({ description: 'The redaction step ran before the call (always true on a success).' }),
    masked: z
      .array(
        z
          .object({
            flag: AiRedactionFlagSchema,
            count: z.number().int().min(1).meta({ description: 'Number of spans masked.' }),
          })
          .strict(),
      )
      .meta({ description: 'One entry per flag that matched at least once. Never the masked text.' }),
  })
  .strict()
  .meta({
    id: 'AiRedactionSummary',
    description: 'What was masked, as counts only. The masked text is never returned or stored (BE-NFR-33).',
  })
export type AiRedactionSummary = z.infer<typeof AiRedactionSummarySchema>

/* ------------------------------------------------------------------------------------------ */
/* Input: what the caller hands to the service                                                 */
/* ------------------------------------------------------------------------------------------ */

/**
 * Who is calling and for which run, for the cost log and audit only. It is NEVER forwarded to a
 * provider (AC-04.8); it is a separate type so that it cannot be mistaken for request content.
 */
export const AiCallContextSchema = z
  .object({
    actorId: IdSchema.meta({ description: 'Admin or Guru who triggered the call (logged in ai_usage_logs).' }),
    batchId: IdSchema.optional().meta({ description: 'Intake batch (BE-38), when the call belongs to one.' }),
    runId: IdSchema.optional().meta({ description: 'ai_extraction_runs id, when the call belongs to a run.' }),
  })
  .strict()
  .meta({ id: 'AiCallContext', description: 'Audit context of a call. Never sent to a provider.' })
export type AiCallContext = z.infer<typeof AiCallContextSchema>

/** Text of one page, from the text layer or from OCR (frontend `PageText`). */
export const AiPageTextSchema = z
  .object({
    page: z.number().int().min(1),
    text: z.string().max(AI_MAX_PAGE_TEXT_CHARS),
    source: z.enum(['text-layer', 'ocr']),
    confidence: z.number().min(0).max(100).optional().meta({ description: 'OCR confidence 0..100 (frontend PageText.confidence).' }),
  })
  .strict()
  .meta({ id: 'AiPageText', description: 'Page text before redaction.' })
export type AiPageText = z.infer<typeof AiPageTextSchema>

/**
 * A page image is passed BY REFERENCE: a stored file id (BE-04 FileStorage page image), never a
 * data URL and never bytes (the frontend `PageImage.dataUrl` stays in the browser). The service
 * loads, redacts and sends the image; the id itself is not sent to the provider.
 */
export const AiPageImageRefSchema = z
  .object({
    page: z.number().int().min(1),
    fileId: IdSchema.meta({ description: 'FileStorage id of the rendered page image.' }),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
  })
  .strict()
  .meta({ id: 'AiPageImageRef', description: 'Reference to a stored page image (never inline bytes).' })
export type AiPageImageRef = z.infer<typeof AiPageImageRefSchema>

/** Curriculum taxonomy handed to the model so that it can only pick known units (AC-05.2). */
export const AiTaxonomyUnitSchema = z
  .object({
    code: z.string().min(1).max(64),
    label: z.string().min(1).max(200),
  })
  .strict()
  .meta({ id: 'AiTaxonomyUnit' })
export type AiTaxonomyUnit = z.infer<typeof AiTaxonomyUnitSchema>

/** Optional structure hints from the blueprint (section layout of the expected paper). [PROPOSED] */
export const AiStructureHintSchema = z
  .object({
    label: z.string().min(1).max(100).meta({ description: 'Section label, e.g. "Bahagian A".' }),
    type: z.enum(['mcq', 'structured', 'short', 'essay']),
    questionCount: z.number().int().min(1).max(500).optional(),
    marks: z.number().int().min(0).max(1000).optional(),
  })
  .strict()
  .meta({ id: 'AiStructureHint' })
export type AiStructureHint = z.infer<typeof AiStructureHintSchema>

/**
 * Input of `extractPaper` (frontend `ExtractInput`: pages, images?, subject, kertas) plus the
 * taxonomy and structure hints named in plan 15.2. Strict: only these fields exist, so no user,
 * student, teacher or school identifier can be added (AC-04.8).
 */
export const AiExtractRequestSchema = z
  .object({
    pages: z.array(AiPageTextSchema).max(AI_MAX_PAGES).meta({ description: 'Page text, in page order.' }),
    images: z.array(AiPageImageRefSchema).max(AI_MAX_PAGES).optional().meta({ description: 'Page images by reference, for vision-capable adapters.' }),
    subject: z.string().min(1).max(32).meta({ description: 'Subject code, e.g. MAT.', example: 'MAT' }),
    kertas: z.union([z.literal(1), z.literal(2)]),
    taxonomy: z.array(AiTaxonomyUnitSchema).max(500).optional(),
    structure: z.array(AiStructureHintSchema).max(50).optional(),
  })
  .strict()
  .refine((v) => v.pages.length > 0 || (v.images?.length ?? 0) > 0, {
    message: 'Provide page text, page images or both.',
  })
  .meta({ id: 'AiExtractRequest', description: 'Provider-neutral input of extractPaper (in-process, no HTTP route).' })
export type AiExtractRequest = z.infer<typeof AiExtractRequestSchema>

/* ------------------------------------------------------------------------------------------ */
/* Output: drafts only                                                                         */
/* ------------------------------------------------------------------------------------------ */

/** Confidence of a field, 0 (guess) to 1 (certain). [PROPOSED scale; the mock only lists `lowFields`] */
export const AiConfidenceSchema = z.number().min(0).max(1).meta({ id: 'AiConfidence', description: 'Confidence 0..1.' })
export type AiConfidence = z.infer<typeof AiConfidenceSchema>

/** Source region on a page as fractions of the page (0..1), so it survives re-rendering. [PROPOSED] */
export const AiRegionSchema = z
  .object({
    page: z.number().int().min(1),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  })
  .strict()
  .refine((r) => r.x + r.w <= 1 && r.y + r.h <= 1, {
    message: 'Region must lie inside the page (x + w <= 1 and y + h <= 1).',
  })
  .meta({ id: 'AiRegion', description: 'Source region of a field or figure, as page fractions.' })
export type AiRegion = z.infer<typeof AiRegionSchema>

export const AI_WARNING_CODES = [
  'low_confidence',
  'no_stem',
  'no_marks',
  'unmatched_scheme',
  'figure_missing',
  'redacted_content',
  'truncated',
] as const
export const AiWarningCodeSchema = z.enum(AI_WARNING_CODES).meta({
  id: 'AiWarningCode',
  description: '[PROPOSED] codes of per-item warnings; the mock expresses them as free BM strings and `lowFields`.',
})
export type AiWarningCode = z.infer<typeof AiWarningCodeSchema>

export const AiItemWarningSchema = z
  .object({
    code: AiWarningCodeSchema,
    field: z.string().min(1).max(64).optional().meta({ description: 'Draft field the warning is about, e.g. "marks".' }),
    message: z.string().min(1).max(500).meta({ description: 'BM message for the reviewer.' }),
  })
  .strict()
  .meta({ id: 'AiItemWarning' })
export type AiItemWarning = z.infer<typeof AiItemWarningSchema>

export const AI_DRAFT_QUESTION_TYPES = ['mcq', 'structured', 'short', 'essay'] as const
export const AiDraftQuestionTypeSchema = z.enum(AI_DRAFT_QUESTION_TYPES).meta({
  id: 'AiDraftQuestionType',
  description: 'Frontend IntakeQuestion.type.',
})
export type AiDraftQuestionType = z.infer<typeof AiDraftQuestionTypeSchema>

export const AiDraftOptionSchema = z
  .object({
    key: z.string().min(1).max(8).meta({ description: 'Option label, e.g. "A".' }),
    text: z.string().max(5000),
  })
  .strict()
  .meta({ id: 'AiDraftOption', description: 'MCQ option. [PROPOSED] shape (frontend McqOption not on this branch).' })
export type AiDraftOption = z.infer<typeof AiDraftOptionSchema>

/** Mark-scheme point codes seen in the mock extractor: K, N, P, B, M, F, C (catalogue IN-08). */
export const AI_SCHEME_POINT_CODES = ['K', 'N', 'P', 'B', 'M', 'F', 'C'] as const
export const AiSchemePointCodeSchema = z.enum(AI_SCHEME_POINT_CODES).meta({ id: 'AiSchemePointCode' })
export type AiSchemePointCode = z.infer<typeof AiSchemePointCodeSchema>

export const AiSchemeDraftSchema = z
  .object({
    answer: z.string().max(5000).optional().meta({ description: 'Model answer or MCQ key (e.g. "B").' }),
    points: z
      .array(
        z
          .object({
            code: AiSchemePointCodeSchema,
            text: z.string().max(2000),
            marks: z.number().int().min(0).max(100),
          })
          .strict(),
      )
      .max(50)
      .optional(),
    anyOf: z.number().int().min(1).max(50).optional().meta({ description: 'Scheme line "mana-mana N": award any N of the points.' }),
  })
  .strict()
  .meta({ id: 'AiSchemeDraft', description: 'Answer key and mark-scheme points. [PROPOSED] shape of the Bijak SchemeDef.' })
export type AiSchemeDraft = z.infer<typeof AiSchemeDraftSchema>

export const AiDraftPartSchema = z
  .object({
    label: z.string().min(1).max(16).meta({ description: 'Printed part label, e.g. "(a)".' }),
    prompt: z.string().max(10_000),
    marks: z.number().int().min(0).max(100).nullable(),
    scheme: AiSchemeDraftSchema.optional(),
  })
  .strict()
  .meta({ id: 'AiDraftPart' })
export type AiDraftPart = z.infer<typeof AiDraftPartSchema>

export const AiDraftTagSchema = z
  .object({
    unit: z.string().min(1).max(64).optional().meta({ description: 'Curriculum unit code from the supplied taxonomy; never free text (AC-05.2).' }),
    unitLabel: z.string().max(200).optional(),
    level: z.enum(['T4', 'T5', 'T4+T5']).optional(),
    tp: z.number().int().min(1).max(6).optional().meta({ description: 'Tahap penguasaan 1..6.' }),
    sp: z.string().max(64).optional().meta({ description: 'Standard pembelajaran code.' }),
  })
  .strict()
  .meta({ id: 'AiDraftTag', description: 'Suggested curriculum tag (frontend CurriculumTag subset). [PROPOSED] fields.' })
export type AiDraftTag = z.infer<typeof AiDraftTagSchema>

/**
 * One extracted question. `status` is the literal `draft`: the service cannot produce any other
 * state and has no approval operation (AC-05.6, BE-NFR-35). `lowFields` mirrors the frontend and
 * lists the fields whose confidence is below the review threshold; the service cannot confirm a
 * low field (AC-05.6), so there is no `confirmed` here.
 */
export const AiQuestionDraftSchema = z
  .object({
    status: z.literal('draft'),
    label: z.string().max(32).meta({ description: 'Printed question number, e.g. "12".' }),
    type: AiDraftQuestionTypeSchema,
    stem: z.string().max(AI_MAX_PAGE_TEXT_CHARS),
    options: z.array(AiDraftOptionSchema).max(10),
    marks: z.number().int().min(0).max(1000).nullable().meta({ description: 'Null when not found on the paper.' }),
    parts: z.array(AiDraftPartSchema).max(50),
    scheme: AiSchemeDraftSchema.optional(),
    tag: AiDraftTagSchema,
    stimulusRef: z.string().min(1).max(64).optional().meta({
      description: 'Local key of an entry of `stimuli` in the same result (not an entity id).',
    }),
    page: z.number().int().min(1),
    region: AiRegionSchema.optional(),
    fieldConfidence: z.record(z.string(), AiConfidenceSchema).meta({ description: 'Field name to confidence.' }),
    lowFields: z.array(z.string().min(1).max(64)).meta({ description: 'Fields below the review threshold.' }),
    needsManual: z.boolean().optional().meta({ description: 'No stem and no parts were found (frontend needsManual).' }),
    warnings: z.array(AiItemWarningSchema),
  })
  .strict()
  .meta({ id: 'AiQuestionDraft', description: 'Extracted question draft. The only status is draft.' })
export type AiQuestionDraft = z.infer<typeof AiQuestionDraftSchema>

/** Rajah / Jadual / Petikan group shared by several questions (frontend IntakeStimulus). */
export const AiStimulusDraftSchema = z
  .object({
    ref: z.string().min(1).max(64).meta({ description: 'Local key, referenced by AiQuestionDraft.stimulusRef.' }),
    kind: z.enum(['rajah', 'jadual', 'petikan', 'lain']).meta({ description: '[PROPOSED] kinds from the Rajah/Jadual/Petikan groups of the mock.' }),
    title: z.string().max(300).optional(),
    text: z.string().max(AI_MAX_PAGE_TEXT_CHARS).optional(),
    page: z.number().int().min(1).optional(),
    region: AiRegionSchema.optional().meta({ description: 'Figure crop region (BE-37 crops it server-side).' }),
  })
  .strict()
  .meta({ id: 'AiStimulusDraft' })
export type AiStimulusDraft = z.infer<typeof AiStimulusDraftSchema>

/** Result of `extractPaper` (frontend `ExtractedPaper` plus `usage` and `redaction`). */
export const AiExtractedPaperSchema = z
  .object({
    provider: AiProviderIdSchema,
    model: z.string().min(1).max(128),
    questions: z.array(AiQuestionDraftSchema),
    stimuli: z.array(AiStimulusDraftSchema),
    unmatched: z.array(z.string()).meta({
      description: 'Scheme entries with no question, e.g. "Jawapan 1-5" or "Skema 3a" (frontend `unmatched`).',
    }),
    warnings: z.array(z.string()).meta({
      description: 'Paper-level BM warnings, e.g. "Tiada soalan dikesan dalam teks kertas." (frontend `warnings`).',
    }),
    usage: AiUsageSchema,
    redaction: AiRedactionSummarySchema,
  })
  .strict()
  .meta({ id: 'AiExtractedPaper', description: 'Drafts only. In-process result of extractPaper.' })
export type AiExtractedPaper = z.infer<typeof AiExtractedPaperSchema>

/* suggestTags -------------------------------------------------------------------------------- */

export const AiTagSuggestItemSchema = z
  .object({
    ref: z.string().min(1).max(64).meta({ description: 'Caller key echoed in the answer (not an entity id).' }),
    stem: z.string().max(AI_MAX_PAGE_TEXT_CHARS),
    type: AiDraftQuestionTypeSchema.optional(),
  })
  .strict()
  .meta({ id: 'AiTagSuggestItem' })

export const AiSuggestTagsRequestSchema = z
  .object({
    subject: z.string().min(1).max(32),
    items: z.array(AiTagSuggestItemSchema).min(1).max(200),
    taxonomy: z.array(AiTaxonomyUnitSchema).min(1).max(500),
  })
  .strict()
  .meta({ id: 'AiSuggestTagsRequest', description: 'Input of suggestTags (in-process). Question text and taxonomy only.' })
export type AiSuggestTagsRequest = z.infer<typeof AiSuggestTagsRequestSchema>

export const AiTagSuggestionSchema = z
  .object({
    ref: z.string().min(1).max(64),
    tag: AiDraftTagSchema,
    confidence: AiConfidenceSchema,
  })
  .strict()
  .meta({ id: 'AiTagSuggestion' })

export const AiSuggestTagsResultSchema = z
  .object({
    suggestions: z.array(AiTagSuggestionSchema),
    usage: AiUsageSchema,
    redaction: AiRedactionSummarySchema,
  })
  .strict()
  .meta({ id: 'AiSuggestTagsResult', description: 'Tag suggestions; a human confirms every tag (AC-05.6).' })
export type AiSuggestTagsResult = z.infer<typeof AiSuggestTagsResultSchema>

/* generateText ------------------------------------------------------------------------------- */

/**
 * `generateText({purpose, system, input})` (LEAD 2026-10-19 for BE-43, card AC9). Goes through the
 * same redaction, rate limit, retry and budget guard as extractPaper. `purpose` is a short
 * lower-case slug chosen by the caller (the mock returns canned text per purpose); the set is
 * open because BE-43 owns its purposes. [PROPOSED] slug format.
 */
export const AiGenerateTextRequestSchema = z
  .object({
    purpose: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9_.-]*$/, 'purpose must be a lower-case slug')
      .meta({ example: 'cikgu.chat' }),
    system: z.string().max(AI_MAX_TEXT_CHARS),
    input: z.string().min(1).max(AI_MAX_TEXT_CHARS),
  })
  .strict()
  .meta({ id: 'AiGenerateTextRequest', description: 'Input of generateText (in-process, no HTTP route).' })
export type AiGenerateTextRequest = z.infer<typeof AiGenerateTextRequestSchema>

export const AiGenerateTextResultSchema = z
  .object({
    text: z.string(),
    tokensIn: z.number().int().min(0),
    tokensOut: z.number().int().min(0),
  })
  .strict()
  .meta({ id: 'AiGenerateTextResult', description: 'Exactly the shape approved for BE-43. Cost goes to ai_usage_logs, not to the caller.' })
export type AiGenerateTextResult = z.infer<typeof AiGenerateTextResultSchema>

/* failure ------------------------------------------------------------------------------------ */

/**
 * What a service call throws or what a failed run stores. `message` is safe: never the key, the
 * prompt, the page text or the provider's raw reply (AC3, AC9).
 */
export const AiFailureSchema = z
  .object({
    code: AiFailureCodeSchema,
    message: z.string().min(1).max(500).meta({ description: 'BM message, no secret and no content.' }),
    retryAfter: z.number().int().min(0).optional().meta({ description: 'Seconds, on RATE_LIMITED only.' }),
    attempts: z.number().int().min(1).optional().meta({ description: 'Attempts made before giving up (AC4).' }),
  })
  .strict()
  .meta({ id: 'AiFailure', description: 'In-process failure of an AI call.' })
export type AiFailure = z.infer<typeof AiFailureSchema>

/* ------------------------------------------------------------------------------------------ */
/* HTTP: GET /ai/status                                                                        */
/* ------------------------------------------------------------------------------------------ */

const monthRe = /^\d{4}-(0[1-9]|1[0-2])$/
export const AiMonthSchema = z
  .string()
  .regex(monthRe, 'Month must be YYYY-MM')
  .meta({ id: 'AiMonth', description: 'Calendar month in Malaysia time (Asia/Kuala_Lumpur), YYYY-MM.', example: '2026-10' })

export const AiSettingsSchema = z
  .object({
    monthlyBudgetSen: money.meta({
      description: 'Monthly cap in sen. Initial value comes from AI_MONTHLY_BUDGET_SEN; 0 means every new extraction is queued.',
    }),
    notifyAt80: z.boolean().meta({ description: 'Notify every active Admin Pusat once per month at 80% (AC6).' }),
    notifyAt100: z.boolean().meta({ description: 'Notify every active Admin Pusat once per month at 100%. [PROPOSED] second toggle.' }),
    updatedAt: TimestampSchema.nullable().meta({ description: 'Null until the first PUT.' }),
  })
  .strict()
  .meta({ id: 'AiSettings', description: 'ai_settings. Contains no credential.' })
export type AiSettings = z.infer<typeof AiSettingsSchema>

export const AI_BUDGET_STATES = ['ok', 'warning', 'exhausted'] as const
export const AiBudgetStateSchema = z.enum(AI_BUDGET_STATES).meta({
  id: 'AiBudgetState',
  description: 'ok below 80%, warning from 80% to below 100%, exhausted at 100% or more (new extractions refused).',
})
export type AiBudgetState = z.infer<typeof AiBudgetStateSchema>

/**
 * `GET /ai/status`. `configured` is the only statement about the credentials (BE-NFR-32): it is
 * true when the selected provider has what it needs (the mock always has). The key, the base URL
 * and any provider setting are never returned.
 */
export const AiStatusSchema = z
  .object({
    provider: AiProviderIdSchema,
    model: z.string().min(1).max(128).nullable().meta({ description: 'Configured model id; null when none is set.' }),
    configured: z.boolean(),
    capabilities: AiCapabilitiesSchema.nullable().meta({ description: 'Null when the provider is not configured.' }),
    month: AiMonthSchema.meta({ description: 'Current Malaysia month the figures below belong to.' }),
    monthToDateCostSen: z.number().int().min(0),
    budgetSen: z.number().int().min(0),
    remainingSen: z.number().int().min(0).meta({ description: 'max(0, budgetSen - monthToDateCostSen).' }),
    percentUsed: z.number().min(0).meta({ description: 'monthToDateCostSen / budgetSen * 100; 0 when budgetSen is 0 and cost is 0, 100 when budgetSen is 0 and cost > 0.' }),
    budgetState: AiBudgetStateSchema,
    settings: AiSettingsSchema,
  })
  .strict()
  .meta({ id: 'AiStatus', description: 'Provider and budget status for Admin Pusat. No credential, no base URL.' })
export type AiStatus = z.infer<typeof AiStatusSchema>

/* ------------------------------------------------------------------------------------------ */
/* HTTP: GET /ai/usage                                                                         */
/* ------------------------------------------------------------------------------------------ */

export const AiUsageQuerySchema = z
  .object({
    month: AiMonthSchema.optional().meta({ description: 'Defaults to the current Malaysia month.' }),
    batchId: IdSchema.optional().meta({ description: 'Intake batch id.' }),
    provider: AiProviderIdSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(AI_PAGE_SIZE_MAX).default(20),
  })
  .meta({ id: 'AiUsageQuery', description: 'Filters of GET /ai/usage. Newest row first.' })
export type AiUsageQuery = z.infer<typeof AiUsageQuerySchema>

export const AiUsageRowSchema = z
  .object({
    id: IdSchema,
    createdAt: TimestampSchema,
    purpose: AiCallPurposeSchema,
    provider: AiProviderIdSchema,
    model: z.string().min(1).max(128),
    runId: IdSchema.nullable(),
    batchId: IdSchema.nullable(),
    actorId: IdSchema.nullable().meta({ description: 'Caller id; the log stores no name.' }),
    pages: z.number().int().min(0),
    tokensIn: z.number().int().min(0),
    tokensOut: z.number().int().min(0),
    costSen: z.number().int().min(0),
  })
  .strict()
  .meta({ id: 'AiUsageRow', description: 'One ai_usage_logs row. No document text, no prompt (AC5).' })
export type AiUsageRow = z.infer<typeof AiUsageRowSchema>

/* ------------------------------------------------------------------------------------------ */
/* HTTP: PUT /ai/settings                                                                      */
/* ------------------------------------------------------------------------------------------ */

/** Strict: an unknown key is 422 (as BE-05, D58d). All keys required: a full replace of the two toggles and the cap. */
export const AiSettingsUpdateSchema = z
  .object({
    monthlyBudgetSen: money,
    notifyAt80: z.boolean(),
    notifyAt100: z.boolean(),
  })
  .strict()
  .meta({ id: 'AiSettingsUpdate', description: 'Body of PUT /ai/settings. Audit-logged (actor, old and new value).' })
export type AiSettingsUpdate = z.infer<typeof AiSettingsUpdateSchema>

/* ------------------------------------------------------------------------------------------ */
/* HTTP: POST /ai/test                                                                         */
/* ------------------------------------------------------------------------------------------ */

/** Empty body (the sample is built in; user content is never accepted). Strict so a content field is a 422. */
export const AiTestRequestSchema = z
  .object({})
  .strict()
  .meta({ id: 'AiTestRequest', description: 'Empty object. The health check uses a built-in sample, never user content.' })
export type AiTestRequest = z.infer<typeof AiTestRequestSchema>

export const AiTestResultSchema = z
  .object({
    ok: z.literal(true).meta({
      description: 'Always true: a 200 means the provider answered. A failed check is 503 AI_UNAVAILABLE or AI_BUDGET_EXHAUSTED, never a 200 with ok false.',
    }),
    provider: AiProviderIdSchema,
    model: z.string().min(1).max(128),
    latencyMs: z.number().int().min(0),
    checkedAt: TimestampSchema,
    usage: AiUsageSchema,
  })
  .strict()
  .meta({ id: 'AiTestResult', description: 'Outcome of the admin health check on the built-in sample.' })
export type AiTestResult = z.infer<typeof AiTestResultSchema>
