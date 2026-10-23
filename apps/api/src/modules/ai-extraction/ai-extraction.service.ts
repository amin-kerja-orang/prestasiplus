import { Inject, Injectable } from '@nestjs/common'
import {
  AI_MESSAGES,
  AiExtractRequestSchema,
  AiGenerateTextRequestSchema,
  AiSuggestTagsRequestSchema,
  type AiExtractedPaper,
  type AiExtractRequest,
  type AiGenerateTextRequest,
  type AiGenerateTextResult,
  type AiRedactionSummary,
  type AiSuggestTagsRequest,
  type AiSuggestTagsResult,
  type AiTestResult,
} from '@pp/contract'

import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock } from '../../db/clock'
import { AiCallPipeline } from './ai-call.pipeline'
import { AiError } from './ai.errors'
import type { AiCallerContext } from './ai.types'
import { redactExtractRequest, redactGenerateTextRequest, redactSuggestTagsRequest } from './redaction/redact-request'
import { maskEchoes } from './redaction/redactor'

const EMPTY_REDACTION: AiRedactionSummary = { applied: true, masked: [] }

/**
 * Draft-only (AC7, BE-NFR-35): every question this service returns is `status: 'draft'` with an empty `confirmed` list.
 * This is the runtime half of the guarantee (the type of `AiQuestionDraft.status` is the literal `draft`, and the service
 * has no approve, accept, confirm or publish operation). A provider cannot change it: the adapters' parsers set it, and
 * this check refuses anything else.
 */
export function assertDraftsOnly(paper: Pick<AiExtractedPaper, 'questions'>): void {
  for (const q of paper.questions) {
    if (q.status !== 'draft' || q.confirmed.length !== 0) throw AiError.provider({ retryable: false, attempts: 1 })
  }
}

/**
 * The AI service the rest of the API calls in-process (never a public route): `extractPaper` and `suggestTags` for the
 * intake worker (BE-38), `generateText` for Cikgu Alesa (BE-43), `healthCheck` for the admin test. Each call is
 * validated against its strict contract schema (so no user, student or school identifier can ride along, AC-04.8),
 * redacted, and run through `AiCallPipeline` (budget, limits, retry, one usage row).
 *
 * The call context (`AiCallerContext`) is for the cost log and the rate limits only and is never forwarded to a provider.
 */
@Injectable()
export class AiExtractionService {
  constructor(
    @Inject(AiCallPipeline) private readonly pipeline: AiCallPipeline,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  get providerId() {
    return this.pipeline.provider.id
  }

  async extractPaper(req: AiExtractRequest, ctx: AiCallerContext = {}, signal?: AbortSignal): Promise<AiExtractedPaper> {
    const parsed = AiExtractRequestSchema.parse(req)
    const provider = this.pipeline.provider
    const hasText = parsed.pages.some((p) => p.text.trim() !== '')
    if (!hasText) {
      // Nothing to read: the prototype's own answer, without a provider call (and so without cost).
      return {
        provider: provider.id,
        model: provider.model || 'none',
        questions: [],
        stimuli: [],
        unmatched: [],
        warnings: [AI_MESSAGES.noQuestions],
        usage: { provider: provider.id, model: provider.model || 'none', pages: 0, tokensIn: 0, tokensOut: 0, costSen: 0 },
        redaction: EMPTY_REDACTION,
      }
    }
    // The one redaction of an extraction (#189): callers (BE-38's intake job) hand over the unredacted request, and only
    // this output reaches the provider. It is text only: `redactExtractRequest` never copies `images`.
    const { request, summary, spans } = redactExtractRequest(parsed)
    const { value, usage } = await this.pipeline.execute({
      purpose: 'extract_paper',
      ctx,
      signal,
      pages: request.pages.length,
      run: 'extract_paper',
      call: (o) => provider.extractPaper(request, o),
    })
    // A provider that echoes a masked value gets it masked again, before the answer leaves this service.
    const answer = maskEchoes(value.paper, spans)
    const paper: AiExtractedPaper = { ...answer, provider: provider.id, model: provider.model, usage, redaction: summary }
    assertDraftsOnly(paper)
    return paper
  }

  async suggestTags(req: AiSuggestTagsRequest, ctx: AiCallerContext = {}, signal?: AbortSignal): Promise<AiSuggestTagsResult> {
    const parsed = AiSuggestTagsRequestSchema.parse(req)
    const provider = this.pipeline.provider
    const { request, summary, refs } = redactSuggestTagsRequest(parsed)
    const { value, usage } = await this.pipeline.execute({
      purpose: 'suggest_tags',
      ctx,
      signal,
      pages: 0,
      run: 'suggest_tags',
      call: (o) => provider.suggestTags(request, o),
    })
    // Back to the caller's keys; a suggestion for a key that was not asked about is dropped.
    const suggestions = value.suggestions.flatMap((s) => {
      const idx = Number(/^q(\d+)$/.exec(s.ref)?.[1]) - 1
      const ref = refs[idx]
      return ref === undefined ? [] : [{ ...s, ref }]
    })
    return { suggestions, usage, redaction: summary }
  }

  async generateText(req: AiGenerateTextRequest, ctx: AiCallerContext = {}, signal?: AbortSignal): Promise<AiGenerateTextResult> {
    const parsed = AiGenerateTextRequestSchema.parse(req)
    const provider = this.pipeline.provider
    const { request } = redactGenerateTextRequest(parsed)
    const { value } = await this.pipeline.execute({
      purpose: 'generate_text',
      ctx,
      signal,
      pages: 0,
      call: (o) => provider.generateText(request, o),
    })
    return value
  }

  /** The admin health check (`POST /ai/test`): a built-in sample, the same guards and one usage row (`health_check`). */
  async healthCheck(ctx: AiCallerContext = {}, signal?: AbortSignal): Promise<AiTestResult> {
    const provider = this.pipeline.provider
    const { value, usage } = await this.pipeline.execute({
      purpose: 'health_check',
      ctx,
      signal,
      pages: 0,
      call: (o) => provider.healthCheck(o),
    })
    // A 200 means the provider answered; an answer that is not "ok" is a failed check, never a 200 with ok false.
    if (!value.ok) throw new AiError('AI_UNAVAILABLE', { message: AI_MESSAGES.unavailable, retryable: true })
    return { ok: true, provider: provider.id, model: provider.model, latencyMs: value.latencyMs, checkedAt: toMytTimestamp(this.clock.now()), usage }
  }
}
