import type {
  AiCapabilities,
  AiExtractRequest,
  AiGenerateTextRequest,
  AiGenerateTextResult,
  AiProviderId,
  AiSuggestTagsRequest,
} from '@pp/contract'

import type { AiTagSuggestion, ExtractedDraftPaper, ExtractionProvider, ProviderCallOptions, ProviderHealth, Tokens } from '../ai.types'
import { parseExtractReply, parseTagsReply } from './model-output'
import { EXTRACT_SYSTEM, extractUserPrompt, HEALTH_INPUT, HEALTH_SYSTEM, TAGS_SYSTEM, tagsUserPrompt } from './prompts'

export interface CompleteRequest {
  system: string
  user: string
  /** Ask for a JSON-only reply where the vendor supports it. */
  json: boolean
  maxTokens: number
  signal: AbortSignal
}

export interface CompleteResult extends Tokens {
  text: string
}

/** Rough token count used only when a vendor omits `usage` (4 characters per token). */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4)

/**
 * Shared behaviour of the HTTP adapters (anthropic, openai, gemini, openai-compatible): the four provider operations are
 * the same prompt + parse on top of one vendor call, `complete`. A vendor adapter only knows its URL, headers, request
 * body and where its reply keeps the text and the token counts.
 */
export abstract class HttpExtractionProvider implements ExtractionProvider {
  abstract readonly id: AiProviderId
  abstract readonly model: string
  abstract isConfigured(): boolean
  protected abstract complete(req: CompleteRequest): Promise<CompleteResult>

  readonly capabilities: AiCapabilities = { vision: true, jsonMode: true, maxPagesPerCall: 40 }

  constructor(protected readonly maxOutputTokens: number) {}

  async extractPaper(input: AiExtractRequest, options: ProviderCallOptions): Promise<{ paper: ExtractedDraftPaper } & Tokens> {
    const r = await this.complete({ system: EXTRACT_SYSTEM, user: extractUserPrompt(input), json: true, maxTokens: this.maxOutputTokens, signal: options.signal })
    const parsed = parseExtractReply(r.text, input)
    return { paper: { provider: this.id, model: this.model, ...parsed }, tokensIn: r.tokensIn, tokensOut: r.tokensOut }
  }

  async suggestTags(input: AiSuggestTagsRequest, options: ProviderCallOptions): Promise<{ suggestions: AiTagSuggestion[] } & Tokens> {
    const r = await this.complete({ system: TAGS_SYSTEM, user: tagsUserPrompt(input), json: true, maxTokens: this.maxOutputTokens, signal: options.signal })
    return { suggestions: parseTagsReply(r.text, input), tokensIn: r.tokensIn, tokensOut: r.tokensOut }
  }

  async generateText(input: AiGenerateTextRequest, options: ProviderCallOptions): Promise<AiGenerateTextResult> {
    const r = await this.complete({ system: input.system, user: input.input, json: false, maxTokens: this.maxOutputTokens, signal: options.signal })
    return { text: r.text, tokensIn: r.tokensIn, tokensOut: r.tokensOut }
  }

  async healthCheck(options: ProviderCallOptions): Promise<ProviderHealth> {
    const started = Date.now()
    const r = await this.complete({ system: HEALTH_SYSTEM, user: HEALTH_INPUT, json: false, maxTokens: 16, signal: options.signal })
    return { ok: r.text.trim().length > 0, latencyMs: Math.max(0, Date.now() - started), tokensIn: r.tokensIn, tokensOut: r.tokensOut }
  }
}
