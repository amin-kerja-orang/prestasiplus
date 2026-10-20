import { Injectable } from '@nestjs/common'
import type { AiExtractRequest } from '@pp/contract'

import { JobError } from '../../jobs'

/** DI token of the AI adapter that BE-38's extraction job calls. */
export const AI_EXTRACTOR = Symbol('AI_EXTRACTOR')

/**
 * The seam between the intake files module and an AI provider (BE-36/BE-38 provide the real one). The request is
 * built by `IntakeExtractionInput` from stored page text only.
 */
export interface AiExtractor {
  readonly id: string
  extractPaper(req: AiExtractRequest, signal?: AbortSignal): Promise<unknown>
}

/** Default extractor: no provider is configured. Fails without retry so a job does not loop. */
@Injectable()
export class DisabledAiExtractor implements AiExtractor {
  readonly id = 'disabled'

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extractPaper(_req: AiExtractRequest, _signal?: AbortSignal): Promise<unknown> {
    return Promise.reject(new JobError('AI_UNAVAILABLE', false))
  }
}
