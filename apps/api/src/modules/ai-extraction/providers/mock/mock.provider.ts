import type { AiCapabilities, AiExtractRequest, AiGenerateTextRequest, AiGenerateTextResult, AiProviderId, AiSuggestTagsRequest } from '@pp/contract'

import type { AiTagSuggestion, ExtractedDraftPaper, ExtractionProvider, ProviderCallOptions, ProviderHealth, Tokens } from '../../ai.types'
import { estimateTokens } from '../http-provider'
import { MOCK_MODEL_ID, parsePaper } from './mock-parser'
import { candidateUnits, emptyTag, guessUnit, tagWithUnit } from './mock-units'

/**
 * The `mock` provider (default in dev, test and CI): deterministic, no network, no key. `extractPaper` returns the same
 * `ExtractedPaper` as the frontend mock extractor for the same input (golden test). Its tokens are estimates and its cost
 * is always 0.
 */
export class MockProvider implements ExtractionProvider {
  readonly id: AiProviderId = 'mock'
  readonly model = MOCK_MODEL_ID
  readonly capabilities: AiCapabilities = { vision: false, jsonMode: true, maxPagesPerCall: 200 }

  isConfigured(): boolean {
    return true
  }

  extractPaper(input: AiExtractRequest, _options: ProviderCallOptions): Promise<{ paper: ExtractedDraftPaper } & Tokens> {
    void _options
    const paper = parsePaper(input)
    const tokensIn = input.pages.reduce((n, p) => n + estimateTokens(p.text), 0)
    return Promise.resolve({ paper, tokensIn, tokensOut: estimateTokens(JSON.stringify(paper)) })
  }

  suggestTags(input: AiSuggestTagsRequest, _options: ProviderCallOptions): Promise<{ suggestions: AiTagSuggestion[] } & Tokens> {
    void _options
    const units = candidateUnits(input.subject, input.taxonomy)
    const suggestions: AiTagSuggestion[] = input.items.map((item) => {
      const unit = guessUnit(units, item.stem)
      return { ref: item.ref, tag: tagWithUnit(emptyTag(input.subject), unit), confidence: unit ? 0.6 : 0.3 }
    })
    return Promise.resolve({ suggestions, tokensIn: input.items.reduce((n, i) => n + estimateTokens(i.stem), 0), tokensOut: estimateTokens(JSON.stringify(suggestions)) })
  }

  generateText(input: AiGenerateTextRequest, _options: ProviderCallOptions): Promise<AiGenerateTextResult> {
    void _options
    // Canned text per purpose: the same purpose always gets the same answer, and the input text is never echoed.
    const text = `[mock:${input.purpose}] Ini ialah jawapan contoh tanpa AI.`
    return Promise.resolve({ text, tokensIn: estimateTokens(input.system) + estimateTokens(input.input), tokensOut: estimateTokens(text) })
  }

  healthCheck(_options: ProviderCallOptions): Promise<ProviderHealth> {
    void _options
    return Promise.resolve({ ok: true, latencyMs: 0, tokensIn: 4, tokensOut: 1 })
  }
}
