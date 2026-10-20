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
 * SOURCE. The frontend intake prototype (branch `feature/student-prototype`, commit 9af43134,
 * `src/modules/m28-bijak-spm/`) is the spec: `admin/intake/types.ts` (`ExtractInput`, `PageText`,
 * `ExtractedPaper`, `IntakeQuestion`, `IntakePart`, `IntakeStimulus`), `admin/intake/ai/{registry,
 * providers,mock-extractor}.ts` (provider ids and labels, copy) and `domain/types.ts` (`SchemeDef`,
 * `StimulusDef`, `CurriculumTag`, `McqOption`, `LeafKind`, `PointDef`). Those shapes are copied
 * field for field; each is quoted in the doc comment of the schema that carries it. The prototype
 * has NO status, usage, settings or test-call surface and no per-field confidence, so those parts
 * (plus the card additions) stay [PROPOSED]. Every deliberate difference from the prototype is a
 * row in `docs/architecture/v2-backend-deviations.md`.
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

/**
 * Provider ids of the registry, in the prototype order (`admin/intake/ai/registry.ts` line 11,
 * `PROVIDER_IDS`). An unknown id is a start-up error, never a fallback (registry.ts lines 45-46).
 */
export const AI_PROVIDER_IDS = ['mock', 'anthropic', 'openai', 'gemini', 'openai-compatible'] as const
export const AiProviderIdSchema = z.enum(AI_PROVIDER_IDS).meta({
  id: 'AiProviderId',
  description: 'Provider adapter id; selected server-side by AI_PROVIDER (default mock).',
})
export type AiProviderId = z.infer<typeof AiProviderIdSchema>

/**
 * Display name of each provider, exactly as the prototype shows it (`QuestionExtractor.label`:
 * `mock-extractor.ts` line 309 and `registry.ts` lines 33-36). The upload screen prints the mock
 * label while extracting ("Mengekstrak soalan (Contoh (mock, tanpa AI))").
 */
export const AI_PROVIDER_LABELS = {
  mock: 'Contoh (mock, tanpa AI)',
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  'openai-compatible': 'Serasi OpenAI',
} as const satisfies Record<(typeof AI_PROVIDER_IDS)[number], string>

/** Model id the prototype mock reports (`mock-extractor.ts` line 304). */
export const AI_MOCK_MODEL_ID = 'heuristik-1'

/**
 * Machine codes of an AI failure. The prototype has no codes: a failure is a thrown `Error` whose
 * message the upload screen prints under "Pengekstrakan gagal" (`IntakeUploadPage.vue` lines
 * 122, 139, 199). The codes below are the contract's machine form of those failures. On the wire
 * (the 503 and 429 of the admin routes) only `AI_UNAVAILABLE`, `AI_BUDGET_EXHAUSTED` and
 * `RATE_LIMITED` appear; `AI_PROVIDER_ERROR` and `AI_TIMEOUT` are in-process only (they are stored
 * on a failed run and mapped to `AI_UNAVAILABLE` by any caller that answers HTTP).
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
    'AI_UNAVAILABLE: provider not configured (prototype message "Dikonfigurasi di pelayan") or unreachable (same code as BE-43). AI_BUDGET_EXHAUSTED: monthly cap reached, the caller may queue (AC-29.2, AC6). RATE_LIMITED: D57a. These three are the only codes on the wire. AI_PROVIDER_ERROR and AI_TIMEOUT [PROPOSED] are in-process only: the run failed after the retries with backoff on 429/5xx (AC4); a caller that answers HTTP maps them to AI_UNAVAILABLE.',
})
export type AiFailureCode = z.infer<typeof AiFailureCodeSchema>

/**
 * BM copy. `notConfigured`, `extractionFailed` and `noQuestions` are copied from the prototype and
 * are not [PROPOSED]. `unavailable`, `budgetExhausted` and `csrf` have no prototype source (the
 * prototype has no AI failure path beyond the stub message); they are [PROPOSED]. `unavailable`
 * follows the structure of the approved BE-43 sentence ("... tidak dapat menjawab sekarang. Sila
 * cuba sebentar lagi.") without the persona name.
 */
export const AI_MESSAGES = {
  /** Prototype `NOT_CONFIGURED_MESSAGE` (`providers.ts` line 8): a real provider without server configuration. */
  notConfigured: 'Dikonfigurasi di pelayan',
  /** Prototype fallback when the thrown value is not an Error (`IntakeUploadPage.vue` lines 122, 139). */
  extractionFailed: 'Pengekstrakan gagal.',
  /** Prototype paper-level warning when no question was found (`mock-extractor.ts` line 212). */
  noQuestions: 'Tiada soalan dikesan dalam teks kertas.',
  /** [PROPOSED] */
  unavailable: 'Perkhidmatan AI tidak dapat dihubungi sekarang. Sila cuba sebentar lagi.',
  /** [PROPOSED] */
  budgetExhausted: 'Had bajet AI bulanan telah dicapai. Pengekstrakan baharu ditunda sehingga had dinaikkan.',
  /** [PROPOSED] */
  csrf: 'Sesi tidak sah. Sila muat semula halaman dan cuba lagi.',
} as const

/**
 * Prototype start-up error for an unknown provider id (`registry.ts` line 46). Never sent over
 * HTTP (the server refuses to start); kept here so the server and the prototype print one sentence.
 */
export const aiUnknownProviderMessage = (id: string): string => `Penyedia AI tidak dikenali: ${id}`

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

/**
 * Text of one page, from the text layer or from OCR. Prototype `PageText`
 * (`admin/intake/types.ts` lines 17-24): page, text, source, confidence?.
 */
export const AiPageTextSchema = z
  .object({
    page: z.number().int().min(1),
    text: z.string().max(AI_MAX_PAGE_TEXT_CHARS),
    source: z.enum(['text-layer', 'ocr']).meta({
      description: '`text-layer` = digital-born PDF, `ocr` = scanned page read by Tesseract.',
    }),
    confidence: z.number().min(0).max(100).optional().meta({ description: 'Mean OCR confidence 0-100 (OCR pages only).' }),
  })
  .strict()
  .meta({ id: 'AiPageText', description: 'Page text before redaction (prototype PageText).' })
export type AiPageText = z.infer<typeof AiPageTextSchema>

/**
 * A page image is passed BY REFERENCE: a stored file id (BE-04 FileStorage page image), never a
 * data URL and never bytes. The prototype `PageImage` is `{page, dataUrl, width, height}`
 * (`types.ts` lines 26-31); `dataUrl` stays in the browser and is replaced by `fileId` (deviation
 * row in v2-backend-deviations.md). The service loads, redacts and sends the image; the id itself
 * is not sent to the provider.
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

/**
 * Curriculum taxonomy handed to the model so that it can only pick known units (AC-05.2). The
 * prototype keeps the list inside the mock (`DskpUnit`, `admin/intake/lib/dskp.ts` lines 7-14:
 * code, label, subject, form, keywords). `subject` is the request subject and `keywords` is mock
 * internal, so the wire carries `code`, `label` and `form`. The unit list as a request field is
 * [PROPOSED] (plan 15.2).
 */
export const AiTaxonomyUnitSchema = z
  .object({
    code: z.string().min(1).max(64),
    label: z.string().min(1).max(200),
    form: z.enum(['T4', 'T5']).optional().meta({ description: 'Tingkatan of the unit (DskpUnit.form); lets the model set the tag level.' }),
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
 * Input of `extractPaper`. Prototype `ExtractInput` (`types.ts` lines 100-105): pages, images?,
 * subject, kertas. `taxonomy` and `structure` are the extra inputs named in plan 15.2 [PROPOSED].
 * Strict: only these fields exist, so no user, student, teacher or school identifier can be added
 * (AC-04.8). `pages` may be empty as in the prototype (its `parsePaper` then answers with the
 * warning "Tiada soalan dikesan dalam teks kertas."); a caller with neither text nor images gets
 * that same empty result from the service without a provider call.
 */
export const AiExtractRequestSchema = z
  .object({
    pages: z.array(AiPageTextSchema).max(AI_MAX_PAGES).meta({ description: 'Page text, in page order.' }),
    images: z.array(AiPageImageRefSchema).max(AI_MAX_PAGES).optional().meta({ description: 'Page images by reference, for vision-capable adapters.' }),
    subject: z.string().min(1).max(32).meta({ description: 'Subject code (SubjectCode, an open dictionary), e.g. MAT.', example: 'MAT' }),
    kertas: z.union([z.literal(1), z.literal(2)]),
    taxonomy: z.array(AiTaxonomyUnitSchema).max(500).optional(),
    structure: z.array(AiStructureHintSchema).max(50).optional(),
  })
  .strict()
  .meta({ id: 'AiExtractRequest', description: 'Provider-neutral input of extractPaper (in-process, no HTTP route).' })
export type AiExtractRequest = z.infer<typeof AiExtractRequestSchema>

/* ------------------------------------------------------------------------------------------ */
/* Output: drafts only                                                                         */
/* ------------------------------------------------------------------------------------------ */

/** Confidence of a field, 0 (guess) to 1 (certain). [PROPOSED scale; the prototype only lists `lowFields`] */
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
  .meta({ id: 'AiRegion', description: 'Source region of a field or figure, as page fractions. [PROPOSED]' })
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
  description: '[PROPOSED] codes of per-item warnings; the prototype has no per-item warning, only `lowFields` and `needsManual`.',
})
export type AiWarningCode = z.infer<typeof AiWarningCodeSchema>

export const AiItemWarningSchema = z
  .object({
    code: AiWarningCodeSchema,
    field: z.string().min(1).max(64).optional().meta({ description: 'Draft field the warning is about, e.g. "marks".' }),
    message: z.string().min(1).max(500).meta({ description: 'BM message for the reviewer.' }),
  })
  .strict()
  .meta({ id: 'AiItemWarning', description: '[PROPOSED] per-item warning.' })
export type AiItemWarning = z.infer<typeof AiItemWarningSchema>

/** Prototype `IntakeQType` (`types.ts` line 35). */
export const AI_DRAFT_QUESTION_TYPES = ['mcq', 'structured', 'short', 'essay'] as const
export const AiDraftQuestionTypeSchema = z.enum(AI_DRAFT_QUESTION_TYPES).meta({
  id: 'AiDraftQuestionType',
  description: 'Prototype IntakeQType.',
})
export type AiDraftQuestionType = z.infer<typeof AiDraftQuestionTypeSchema>

/**
 * Leaf answer modes (prototype `LeafKind`, `domain/types.ts` lines 39-40; exam schema D2).
 * `table_fill` is a typed stub in the prototype (no widget yet).
 */
export const AI_LEAF_KINDS = ['working', 'numeric', 'short_text', 'match_letter', 'essay', 'drawing', 'table_fill'] as const
export const AiLeafKindSchema = z.enum(AI_LEAF_KINDS).meta({ id: 'AiLeafKind', description: 'Prototype LeafKind.' })
export type AiLeafKind = z.infer<typeof AiLeafKindSchema>

/** `wordRange` of a leaf (`IntakeQuestion.wordRange`, `IntakePart.wordRange`, `types.ts` lines 47 and 69). */
export const AiWordRangeSchema = z
  .object({ min: z.number().int().min(0).max(5000), max: z.number().int().min(0).max(5000) })
  .strict()
  .refine((r) => r.min <= r.max, { message: 'min must not exceed max.' })
  .meta({ id: 'AiWordRange', description: 'Word range of an essay leaf.' })
export type AiWordRange = z.infer<typeof AiWordRangeSchema>

/**
 * MCQ option, prototype `McqOption` (`domain/types.ts` lines 29-33): `{ id, text }`; `text` may
 * contain `$latex$` spans. `id` is the option letter ("A") and is what an `option` scheme's
 * `correct` names.
 */
export const AiMcqOptionSchema = z
  .object({
    id: z.string().min(1).max(16).meta({ description: 'Option letter, e.g. "A".' }),
    text: z.string().max(5000).meta({ description: 'May contain `$latex$` spans.' }),
  })
  .strict()
  .meta({ id: 'AiMcqOption', description: 'Prototype McqOption.' })
export type AiMcqOption = z.infer<typeof AiMcqOptionSchema>

/* SchemeDef (prototype `domain/types.ts` lines 90-175), field for field ---------------------- */

/** `PointCode` (`domain/types.ts` line 122): K/N/P maths, M sciences, F/C Sejarah and BI, B independent. */
export const AI_POINT_CODES = ['K', 'N', 'P', 'B', 'M', 'F', 'C'] as const
export const AiPointCodeSchema = z.enum(AI_POINT_CODES).meta({ id: 'AiPointCode', description: 'Prototype PointCode.' })
export type AiPointCode = z.infer<typeof AiPointCodeSchema>

const matchText = z.string().max(2000)

/** `PointMatch` (lines 104-113): how a mark point is recognised in a student answer. */
export const AiPointMatchSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('step'), accept: z.array(matchText).max(50) }).strict(),
    z.object({ type: z.literal('all_of'), items: z.array(matchText).max(50) }).strict(),
    z.object({ type: z.literal('final') }).strict(),
    z.object({ type: z.literal('unit') }).strict(),
    z.object({ type: z.literal('keywords'), anyOf: z.array(matchText).max(50) }).strict(),
    z.object({ type: z.literal('manual') }).strict(),
  ])
  .meta({ id: 'AiPointMatch', description: 'Prototype PointMatch.' })
export type AiPointMatch = z.infer<typeof AiPointMatchSchema>

const ecfK = z.number().min(-1_000_000).max(1_000_000)
/** `EcfRule` (lines 115-120): own figure carried forward, expected = f(previous final). */
export const AiEcfRuleSchema = z
  .discriminatedUnion('op', [
    z.object({ op: z.literal('same') }).strict(),
    z.object({ op: z.literal('sub_from'), k: ecfK }).strict(),
    z.object({ op: z.literal('add'), k: ecfK }).strict(),
    z.object({ op: z.literal('mul'), k: ecfK }).strict(),
  ])
  .meta({ id: 'AiEcfRule', description: 'Prototype EcfRule.' })
export type AiEcfRule = z.infer<typeof AiEcfRuleSchema>

/** `PointDef` (lines 124-137). The shown tag is `code` plus its sequence in the part (K1, K2, M1, F3). */
export const AiPointDefSchema = z
  .object({
    id: z.string().min(1).max(64),
    code: AiPointCodeSchema,
    marks: z.number().int().min(0).max(100).meta({ description: 'Explicit marks: the digit of a tag is a sequence number, never the marks.' }),
    label: matchText,
    match: AiPointMatchSchema,
    requires: z.array(z.string().min(1).max(64)).max(50).optional().meta({ description: 'Only awarded when every one of these other points was hit.' }),
    ecf: z
      .object({
        fromPart: z.string().min(1).max(64),
        rule: AiEcfRuleSchema,
        note: z.string().max(200),
      })
      .strict()
      .optional()
      .meta({ description: 'Own figure carried forward from an earlier part.' }),
  })
  .strict()
  .meta({ id: 'AiPointDef', description: 'Prototype PointDef.' })
export type AiPointDef = z.infer<typeof AiPointDefSchema>

/** `PointGroup` (lines 139-143): "[mana-mana n x k m]", at most `anyN` of these points count. */
export const AiPointGroupSchema = z
  .object({
    id: z.string().min(1).max(64),
    anyN: z.number().int().min(1).max(50),
    pointIds: z.array(z.string().min(1).max(64)).max(50),
  })
  .strict()
  .meta({ id: 'AiPointGroup', description: 'Prototype PointGroup.' })
export type AiPointGroup = z.infer<typeof AiPointGroupSchema>

/** `FinalDef` (lines 90-102): the accepted final answer of a points scheme. */
export const AiFinalDefSchema = z
  .object({
    accept: z.array(matchText).max(50).meta({ description: 'Accepted equivalent forms (plain or LaTeX); any one matches.' }),
    tolerance: z.number().min(0).optional().meta({ description: 'Absolute tolerance for numeric answers.' }),
    unit: z.string().max(32).optional(),
    mustContain: z.string().max(200).optional().meta({ description: 'The answer must contain this text, else it is wrong.' }),
    formHint: z.string().max(500).optional().meta({ description: 'Reason shown when `mustContain` fails.' }),
    display: z.string().max(2000).meta({ description: 'LaTeX shown in the revealed scheme.' }),
  })
  .strict()
  .meta({ id: 'AiFinalDef', description: 'Prototype FinalDef.' })
export type AiFinalDef = z.infer<typeof AiFinalDefSchema>

/** `RubricBand` (lines 145-150). */
export const AiRubricBandSchema = z
  .object({
    name: z.string().max(100),
    range: z.tuple([z.number().min(0).max(1000), z.number().min(0).max(1000)]),
    descriptor: z.string().max(2000),
  })
  .strict()
  .meta({ id: 'AiRubricBand', description: 'Prototype RubricBand.' })
export type AiRubricBand = z.infer<typeof AiRubricBandSchema>

const schemeMarks = z.number().int().min(0).max(1000)

/**
 * Answer key, prototype `SchemeDef` (`domain/types.ts` lines 152-175, exam schema D3): a union on
 * `kind` (option, mapping, accepted, points, rubric). Field for field; only string and array
 * length caps are added. The mock extractor emits `option` and `points` (`mock-extractor.ts`
 * lines 232-239 and 258).
 */
export const AiSchemeDefSchema = z
  .discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('option'),
        marks: schemeMarks,
        correct: z.string().max(16).meta({ description: 'Id of the correct McqOption (e.g. "B").' }),
        reason: z.string().max(2000),
      })
      .strict(),
    z
      .object({
        kind: z.literal('mapping'),
        marks: schemeMarks,
        map: z.record(z.string().max(64), z.string().max(500)),
      })
      .strict(),
    z
      .object({
        kind: z.literal('accepted'),
        marks: schemeMarks,
        values: z
          .array(
            z
              .object({
                v: z.string().max(500),
                tol: z.number().min(0).optional(),
                unit: z.string().max(32).optional(),
              })
              .strict(),
          )
          .max(50),
        caseSensitive: z.boolean().optional(),
      })
      .strict(),
    z
      .object({
        kind: z.literal('points'),
        marks: schemeMarks,
        points: z.array(AiPointDefSchema).max(50),
        groups: z.array(AiPointGroupSchema).max(20).optional(),
        final: AiFinalDefSchema.optional(),
        model: z.string().max(5000).optional(),
      })
      .strict(),
    z
      .object({
        kind: z.literal('rubric'),
        marks: schemeMarks,
        criteria: z.array(z.object({ id: z.string().min(1).max(64), name: z.string().max(200) }).strict()).max(20),
        bands: z.array(AiRubricBandSchema).max(20),
        notes: z.array(z.string().max(2000)).max(20).optional(),
      })
      .strict(),
  ])
  .meta({ id: 'AiSchemeDef', description: 'Prototype SchemeDef (answer key and mark-scheme points).' })
export type AiSchemeDef = z.infer<typeof AiSchemeDefSchema>

/**
 * Curriculum tag, prototype `CurriculumTag` (`domain/types.ts` lines 67-76, exam schema D9), field
 * for field. All fields are required; the mock fills what it cannot determine with `emptyTag`
 * (`lib/dskp.ts` line 45: level `T4+T5`, `unit` null, `unitLabel` "", `sp` [], `tp` 3, `formOrigin`
 * `T4`) and lists the doubtful ones in `lowFields`. `tp` is a number in the prototype; the gate
 * (`domain/validation.ts`: "Tahap Penguasaan (TP) mesti antara 1 dan 6.") limits it to 1..6, which
 * the contract enforces as an integer range.
 */
export const AiCurriculumTagSchema = z
  .object({
    subject: z.string().min(1).max(32).meta({ description: 'SubjectCode (open dictionary), e.g. MAT.' }),
    level: z.enum(['T4', 'T5', 'T4+T5']),
    unit: z.string().min(1).max(64).nullable().meta({
      description: 'Unit code from the supplied taxonomy (never free text, AC-05.2), or null when the content lies outside it.',
    }),
    unitLabel: z.string().max(200).meta({ description: 'Display name of the unit.' }),
    sp: z.array(z.string().min(1).max(64)).max(20).meta({ description: 'Standard pembelajaran codes.' }),
    tp: z.number().int().min(1).max(6).meta({ description: 'Tahap penguasaan 1..6.' }),
    formOrigin: z.enum(['T1-T3', 'T4', 'T5']),
  })
  .strict()
  .meta({ id: 'AiCurriculumTag', description: 'Prototype CurriculumTag.' })
export type AiCurriculumTag = z.infer<typeof AiCurriculumTagSchema>

/**
 * Part of a structured question, prototype `IntakePart` (`types.ts` lines 37-53): id, label, prompt,
 * marks, mode, scheme?, unit?, wordRange?. `lead` (ancestors of a nested part of a bank question
 * being edited) is not part of an extraction result and is left out: the extractor emits a flat list
 * with labels such as "(a)" and "(a)(i)" (`mock-extractor.ts` lines 147-159).
 */
export const AiDraftPartSchema = z
  .object({
    id: z.string().min(1).max(64).meta({ description: 'Local key within the result (not an entity id).' }),
    label: z.string().min(1).max(16).meta({ description: 'Printed part label, e.g. "(a)" or "(a)(i)".' }),
    prompt: z.string().max(10_000),
    marks: z.number().int().min(0).max(100).meta({ description: '0 when the paper shows none (the gate then asks for it).' }),
    mode: AiLeafKindSchema,
    scheme: AiSchemeDefSchema.optional(),
    unit: z.string().max(32).optional().meta({ description: 'Unit shown after a numeric answer.' }),
    wordRange: AiWordRangeSchema.optional(),
  })
  .strict()
  .meta({ id: 'AiDraftPart', description: 'Prototype IntakePart (extractor output).' })
export type AiDraftPart = z.infer<typeof AiDraftPartSchema>

/**
 * One extracted question: the prototype `IntakeQuestion` (`types.ts` lines 55-83) plus the
 * [PROPOSED] server additions `status`, `fieldConfidence`, `region` and `warnings`.
 *
 * `status` is the literal `draft`: the service cannot produce any other state and has no approval
 * operation (AC-05.6, BE-NFR-35). `lowFields` is the prototype list of fields whose confidence is
 * below the review threshold (names seen: `stem`, `marks`, `scheme`, `tag.unit`, `tag.sp`; the
 * list is open, `domain/validation.ts` `fieldName`); a person confirms each one in the review
 * screen. The service cannot confirm a low field (AC-05.6), so `confirmed` is the prototype key
 * but is always empty here.
 */
export const AiQuestionDraftSchema = z
  .object({
    status: z.literal('draft').meta({ description: '[PROPOSED] The only status. The prototype question has none.' }),
    id: z.string().min(1).max(64).meta({ description: 'Local key within the result (the prototype mock builds `q-<label>-<n>`); not an entity id.' }),
    label: z.string().max(32).meta({ description: 'Number label as printed on the paper, e.g. "12".' }),
    type: AiDraftQuestionTypeSchema,
    stem: z.string().max(AI_MAX_PAGE_TEXT_CHARS),
    options: z.array(AiMcqOptionSchema).max(10).meta({ description: 'MCQ options; empty for every other type.' }),
    marks: z.number().int().min(0).max(1000).meta({
      description: 'Question marks. For a structured question it is the sum of the part marks; 0 when not found on the paper (the field is then in `lowFields`).',
    }),
    mode: AiLeafKindSchema.meta({ description: 'Leaf mode of a question without parts.' }),
    unit: z.string().max(32).optional().meta({ description: 'Unit of a question without parts.' }),
    wordRange: AiWordRangeSchema.optional(),
    parts: z.array(AiDraftPartSchema).max(50),
    scheme: AiSchemeDefSchema.optional().meta({
      description: 'Answer key of a question without parts (MCQ key, short answer, essay points).',
    }),
    tag: AiCurriculumTagSchema,
    stimulusId: z.string().min(1).max(64).optional().meta({
      description: '`id` of an entry of `stimuli` in the same result (not an entity id).',
    }),
    page: z.number().int().min(1).meta({ description: 'Source page (1-based).' }),
    lowFields: z.array(z.string().min(1).max(64)).max(50).meta({
      description: 'Fields the extractor was unsure of; a person must confirm each (gate 4.8).',
    }),
    confirmed: z.array(z.string()).max(0).meta({
      description: 'Always empty from the service (AC-05.6); the review screen fills it. Kept so the shape equals the prototype IntakeQuestion.',
    }),
    needsManual: z.boolean().optional().meta({ description: 'Extractor could not parse it: "Perlu semak manual".' }),
    region: AiRegionSchema.optional().meta({ description: '[PROPOSED] Source region of the question.' }),
    fieldConfidence: z.record(z.string(), AiConfidenceSchema).meta({ description: '[PROPOSED] Field name to confidence.' }),
    warnings: z.array(AiItemWarningSchema).meta({ description: '[PROPOSED] Per-item warnings.' }),
  })
  .strict()
  .meta({ id: 'AiQuestionDraft', description: 'Extracted question draft (prototype IntakeQuestion). The only status is draft.' })
export type AiQuestionDraft = z.infer<typeof AiQuestionDraftSchema>

/**
 * Shared stimulus, prototype `StimulusDef` (`domain/types.ts` lines 15-27), field for field:
 * Rajah (`diagram`), Petikan (`passage`) or Jadual (`table`). `label` is the short heading
 * ("Rajah 2"), `alt` the accessible description (required string; the mock leaves it "" when the
 * paper has none and the quality gate then asks for it).
 *
 * `svg` is inline markup that the prototype treats as bundled and trusted. A provider reply is NOT
 * trusted: adapters never emit `svg` (the mock does not), and the intake worker must strip it from
 * a provider result before it is stored or rendered.
 */
export const AiStimulusDefSchema = z
  .object({
    id: z.string().min(1).max(64).meta({ description: 'Local key within the result (the prototype mock builds `stim-<n>`); referenced by `stimulusId`.' }),
    kind: z.enum(['diagram', 'passage', 'table']),
    label: z.string().max(100).meta({ description: 'Short label used in headings and chips, e.g. "Rajah 2".' }),
    caption: z.string().max(300).optional(),
    alt: z.string().max(1000).meta({ description: 'Accessible description of the diagram.' }),
    svg: z.string().max(AI_MAX_PAGE_TEXT_CHARS).optional().meta({
      description: 'Inline SVG markup (prototype, bundled and trusted). Never emitted by an adapter; stripped by the intake worker.',
    }),
    text: z.string().max(AI_MAX_PAGE_TEXT_CHARS).optional(),
    table: z
      .object({
        head: z.array(z.string().max(500)).max(50),
        rows: z.array(z.array(z.string().max(500)).max(50)).max(500),
      })
      .strict()
      .optional(),
  })
  .strict()
  .meta({ id: 'AiStimulusDef', description: 'Prototype StimulusDef.' })
export type AiStimulusDef = z.infer<typeof AiStimulusDefSchema>

/**
 * Prototype `IntakeStimulus` (`types.ts` lines 85-88): `StimulusDef` plus the source `page`. The
 * `region` (figure crop for BE-37) is a [PROPOSED] addition.
 */
export const AiIntakeStimulusSchema = AiStimulusDefSchema.extend({
  page: z.number().int().min(1).optional().meta({ description: 'Source page the figure was cropped from.' }),
  region: AiRegionSchema.optional().meta({ description: '[PROPOSED] Figure crop region (BE-37 crops it server-side).' }),
}).meta({ id: 'AiIntakeStimulus', description: 'Prototype IntakeStimulus (StimulusDef plus page).' })
export type AiIntakeStimulus = z.infer<typeof AiIntakeStimulusSchema>

/**
 * Result of `extractPaper`: prototype `ExtractedPaper` (`types.ts` lines 90-98: provider, model,
 * questions, stimuli, unmatched, warnings) plus the [PROPOSED] `usage` and `redaction`.
 */
export const AiExtractedPaperSchema = z
  .object({
    provider: AiProviderIdSchema,
    model: z.string().min(1).max(128),
    questions: z.array(AiQuestionDraftSchema),
    stimuli: z.array(AiIntakeStimulusSchema),
    unmatched: z.array(z.string().max(200)).meta({
      description: 'Scheme entries whose question number was not found (AC-04.2), e.g. "Jawapan 1-B" or "Skema 9(a)" (`mock-extractor.ts` lines 259 and 270).',
    }),
    warnings: z.array(z.string().max(500)).meta({
      description: `Paper-level BM warnings, e.g. "${AI_MESSAGES.noQuestions}" (\`mock-extractor.ts\` line 212).`,
    }),
    usage: AiUsageSchema.meta({ description: '[PROPOSED] Cost summary of the call.' }),
    redaction: AiRedactionSummarySchema.meta({ description: '[PROPOSED] What was masked, counts only.' }),
  })
  .strict()
  .meta({ id: 'AiExtractedPaper', description: 'Drafts only. In-process result of extractPaper (prototype ExtractedPaper).' })
export type AiExtractedPaper = z.infer<typeof AiExtractedPaperSchema>

/* suggestTags -------------------------------------------------------------------------------- */

export const AiTagSuggestItemSchema = z
  .object({
    ref: z.string().min(1).max(64).meta({ description: 'Caller key echoed in the answer (not an entity id).' }),
    stem: z.string().max(AI_MAX_PAGE_TEXT_CHARS),
    type: AiDraftQuestionTypeSchema.optional(),
  })
  .strict()
  .meta({ id: 'AiTagSuggestItem', description: '[PROPOSED]' })

export const AiSuggestTagsRequestSchema = z
  .object({
    subject: z.string().min(1).max(32),
    items: z.array(AiTagSuggestItemSchema).min(1).max(200),
    taxonomy: z.array(AiTaxonomyUnitSchema).min(1).max(500),
  })
  .strict()
  .meta({ id: 'AiSuggestTagsRequest', description: '[PROPOSED] Input of suggestTags (in-process, plan 15.2). Question text and taxonomy only.' })
export type AiSuggestTagsRequest = z.infer<typeof AiSuggestTagsRequestSchema>

export const AiTagSuggestionSchema = z
  .object({
    ref: z.string().min(1).max(64),
    tag: AiCurriculumTagSchema.meta({
      description: 'Suggested tag in the prototype CurriculumTag shape; `unit` is a taxonomy code or null, never free text.',
    }),
    confidence: AiConfidenceSchema,
  })
  .strict()
  .meta({ id: 'AiTagSuggestion', description: '[PROPOSED] The prototype has no tag-suggestion call.' })

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
