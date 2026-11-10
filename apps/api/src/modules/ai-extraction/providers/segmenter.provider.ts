import type { AiExtractRequest } from '@pp/contract'

import type { ExtractedDraftPaper, ProviderCallOptions, Tokens } from '../ai.types'
import { estimateTokens } from './http-provider'
import { MockProvider } from './mock/mock.provider'
import { SEGMENTER_MODEL_ID, segmentPaper } from './paper-segmenter'

/**
 * The extractor of a deployment that reads papers with real OCR (`OCR_ENGINE=tesseract`, decision KP-3) and has no
 * paid AI provider (`AI_PROVIDER=mock`). It splits real page text into questions, options A to E, answer key and
 * stimulus groups (`segmentPaper`). It keeps the contract id `mock` (the closed `AI_PROVIDER_IDS` list; no key, no
 * network, cost 0) but reports its own model, so a draft is no longer labelled `heuristik-1`.
 * The prototype-layout mock stays the default for tests and dev (`OCR_ENGINE` unset or `none`).
 */
export class SegmenterProvider extends MockProvider {
  override readonly model: string = SEGMENTER_MODEL_ID

  override extractPaper(input: AiExtractRequest, _options: ProviderCallOptions): Promise<{ paper: ExtractedDraftPaper } & Tokens> {
    void _options
    const paper = segmentPaper(input)
    const tokensIn = input.pages.reduce((n, p) => n + estimateTokens(p.text), 0)
    return Promise.resolve({ paper, tokensIn, tokensOut: estimateTokens(JSON.stringify(paper)) })
  }
}
