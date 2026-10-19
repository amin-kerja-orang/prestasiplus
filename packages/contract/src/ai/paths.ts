import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { envelopeOf, listEnvelopeOf } from '../common/envelope'
import { registerRoute } from './rate-limit'
import {
  AI_MESSAGES,
  AiBudgetStateSchema,
  AiCallContextSchema,
  AiCallPurposeSchema,
  AiCapabilitiesSchema,
  AiConfidenceSchema,
  AiDraftOptionSchema,
  AiDraftPartSchema,
  AiDraftQuestionTypeSchema,
  AiDraftTagSchema,
  AiExtractRequestSchema,
  AiExtractedPaperSchema,
  AiFailureCodeSchema,
  AiFailureSchema,
  AiGenerateTextRequestSchema,
  AiGenerateTextResultSchema,
  AiHealthSchema,
  AiItemWarningSchema,
  AiMonthSchema,
  AiPageImageRefSchema,
  AiPageTextSchema,
  AiProviderIdSchema,
  AiQuestionDraftSchema,
  AiRedactionFlagSchema,
  AiRedactionSummarySchema,
  AiRegionSchema,
  AiSchemeDraftSchema,
  AiSchemePointCodeSchema,
  AiSettingsSchema,
  AiSettingsUpdateSchema,
  AiStatusSchema,
  AiStimulusDraftSchema,
  AiStructureHintSchema,
  AiSuggestTagsRequestSchema,
  AiSuggestTagsResultSchema,
  AiTagSuggestItemSchema,
  AiTagSuggestionSchema,
  AiTaxonomyUnitSchema,
  AiTestRequestSchema,
  AiTestResultSchema,
  AiUsageQuerySchema,
  AiUsageRowSchema,
  AiUsageSchema,
  AiWarningCodeSchema,
} from './schema'

/**
 * Components contributed by BE-36 (appended to COMPONENT_SCHEMAS in openapi.ts). All ids are
 * prefixed `Ai`. The first group is in-process only (no HTTP route uses it); it is registered so
 * BE-38 (intake worker) and BE-43 (Cikgu Alesa) import one definition. The second group is the
 * wire of the four admin routes.
 */
export const AI_COMPONENT_SCHEMAS = {
  // In-process wire types (adapter interface)
  AiProviderId: AiProviderIdSchema,
  AiFailureCode: AiFailureCodeSchema,
  AiFailure: AiFailureSchema,
  AiCapabilities: AiCapabilitiesSchema,
  AiHealth: AiHealthSchema,
  AiCallPurpose: AiCallPurposeSchema,
  AiUsage: AiUsageSchema,
  AiRedactionFlag: AiRedactionFlagSchema,
  AiRedactionSummary: AiRedactionSummarySchema,
  AiCallContext: AiCallContextSchema,
  AiPageText: AiPageTextSchema,
  AiPageImageRef: AiPageImageRefSchema,
  AiTaxonomyUnit: AiTaxonomyUnitSchema,
  AiStructureHint: AiStructureHintSchema,
  AiExtractRequest: AiExtractRequestSchema,
  AiConfidence: AiConfidenceSchema,
  AiRegion: AiRegionSchema,
  AiWarningCode: AiWarningCodeSchema,
  AiItemWarning: AiItemWarningSchema,
  AiDraftQuestionType: AiDraftQuestionTypeSchema,
  AiDraftOption: AiDraftOptionSchema,
  AiSchemePointCode: AiSchemePointCodeSchema,
  AiSchemeDraft: AiSchemeDraftSchema,
  AiDraftPart: AiDraftPartSchema,
  AiDraftTag: AiDraftTagSchema,
  AiQuestionDraft: AiQuestionDraftSchema,
  AiStimulusDraft: AiStimulusDraftSchema,
  AiExtractedPaper: AiExtractedPaperSchema,
  AiTagSuggestItem: AiTagSuggestItemSchema,
  AiSuggestTagsRequest: AiSuggestTagsRequestSchema,
  AiTagSuggestion: AiTagSuggestionSchema,
  AiSuggestTagsResult: AiSuggestTagsResultSchema,
  AiGenerateTextRequest: AiGenerateTextRequestSchema,
  AiGenerateTextResult: AiGenerateTextResultSchema,
  // HTTP wire (admin routes)
  AiMonth: AiMonthSchema,
  AiBudgetState: AiBudgetStateSchema,
  AiSettings: AiSettingsSchema,
  AiStatus: AiStatusSchema,
  AiUsageQuery: AiUsageQuerySchema,
  AiUsageRow: AiUsageRowSchema,
  AiSettingsUpdate: AiSettingsUpdateSchema,
  AiTestRequest: AiTestRequestSchema,
  AiTestResult: AiTestResultSchema,
} as const

export const AI_TAG = 'ai'

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

/** Provider and budget figures are admin configuration: never cached by the browser or a proxy. */
const NO_STORE_HEADERS = {
  'Cache-Control': {
    description: 'no-store: provider and budget configuration of the platform (D57b applied conservatively).',
    schema: { type: 'string' as const, enum: ['no-store'] },
  },
}
const noStore = (schema: z.ZodType, description: string) => ({
  description,
  headers: NO_STORE_HEADERS,
  content: { 'application/json': { schema } },
})

const ROLE_NOTE =
  'Admin Pusat only (role code `admin`); Guru, Admin Sekolah, Pegawai PPD/JPN, Murid, Ibu Bapa and Penaja get 403.'
const KEY_NOTE =
  'The response never contains an API key, a base URL or any provider setting (BE-NFR-32); `configured` is the only statement about credentials.'

const UNAUTHORIZED = err('UNAUTHORIZED (no valid session).')
const FORBIDDEN_READ = err('FORBIDDEN (the active role is not Admin Pusat).')
const FORBIDDEN_WRITE = err(
  `FORBIDDEN (the active role is not Admin Pusat) or CSRF_INVALID "${AI_MESSAGES.csrf}" (missing or wrong X-CSRF-Token).`,
)

const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})
const body = (schema: z.ZodType) => ({ required: true as const, content: { 'application/json': { schema } } })

/**
 * Registers the four admin routes of BE-36. Extraction itself (`extractPaper`, `suggestTags`,
 * `generateText`) is invoked in-process by the intake worker (BE-38) and by BE-43; it has no
 * public route, and so the matching request and result schemas are components only.
 *
 * No mock route exists for any of these (catalogue OQ-API-B2-29): every shape is authored here
 * from the card and every BM string is [PROPOSED].
 *
 * D57(a): `PUT /ai/settings` and `POST /ai/test` answer 429 RATE_LIMITED with retryAfter and
 * Retry-After (added by `registerRoute`). D57(b): no credential is ever returned; the figures are
 * still sent `Cache-Control: no-store`.
 */
export function registerAiPaths(registry: OpenAPIRegistry): void {
  registerRoute(registry, {
    method: 'get',
    path: '/ai/status',
    tags: [AI_TAG],
    summary: 'AI service status: provider, model, configured, month-to-date cost, budget',
    description: `Provider id, model id, \`configured\` yes/no, the Malaysia month, month-to-date cost, budget, remaining, percent used, budget state (ok below 80%, warning from 80%, exhausted at 100%) and the current settings. ${KEY_NOTE} ${ROLE_NOTE}`,
    responses: {
      200: noStore(envelopeOf(AiStatusSchema), 'Current status.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/ai/usage',
    tags: [AI_TAG],
    summary: 'AI usage log (paged, no content)',
    description: `Rows of ai_usage_logs, newest first, filtered by month (default the current Malaysia month), intake batch and provider. A row has provider, model, purpose, run id, batch id, actor id, pages, tokens in and out and cost in sen; it never has document text or a prompt (AC5). Mock-provider rows are included and carry cost 0, so a caller can filter by provider. ${ROLE_NOTE}`,
    request: { query: AiUsageQuerySchema },
    responses: {
      200: noStore(listEnvelopeOf(AiUsageRowSchema), 'Usage rows (paged).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_READ,
      422: err('VALIDATION_ERROR (month is not YYYY-MM, unknown provider, page or pageSize out of range).'),
    },
  })

  registerRoute(registry, {
    method: 'put',
    path: '/ai/settings',
    tags: [AI_TAG],
    summary: 'Set the monthly AI budget and the notification toggles',
    description: `Full replace of \`monthlyBudgetSen\`, \`notifyAt80\` and \`notifyAt100\`; unknown keys are 422 (strict body). Audit-logged (actor, old and new value). Raising the cap at or above the month-to-date cost lets queued extractions run (AC-29.2). Provider, model and key are environment configuration and cannot be set here. ${ROLE_NOTE}`,
    request: { headers: [csrf], body: body(AiSettingsUpdateSchema) },
    responses: {
      200: noStore(envelopeOf(AiSettingsSchema), 'The stored settings.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      422: err('VALIDATION_ERROR (negative or non-integer budget, budget above the sanity cap, non-boolean toggle, unknown key).'),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/ai/test',
    tags: [AI_TAG],
    summary: 'Admin health check of the configured provider on a built-in sample',
    description: `Sends a fixed built-in sample (never user content) through the same redaction, rate limit, retry and budget guard as a real call, and writes one usage row (purpose health_check; cost 0 for the mock). 200 means the provider answered; an unreachable or unconfigured provider is 503 AI_UNAVAILABLE "${AI_MESSAGES.unavailable}" and a reached cap is 503 AI_BUDGET_EXHAUSTED "${AI_MESSAGES.budgetExhausted}". The body is an empty object; any field is 422. ${KEY_NOTE} ${ROLE_NOTE}`,
    request: { headers: [csrf], body: body(AiTestRequestSchema) },
    responses: {
      200: noStore(envelopeOf(AiTestResultSchema), 'The provider answered.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      422: err('VALIDATION_ERROR (the body is not an empty object).'),
      503: err(
        `AI_UNAVAILABLE "${AI_MESSAGES.unavailable}" (provider not configured, unreachable or still failing after the retries) or AI_BUDGET_EXHAUSTED "${AI_MESSAGES.budgetExhausted}".`,
      ),
    },
  })
}
