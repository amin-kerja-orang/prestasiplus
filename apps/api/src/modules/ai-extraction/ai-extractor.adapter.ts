import { Inject, Injectable } from '@nestjs/common'
import type { AiExtractRequest } from '@pp/contract'

import { JobError } from '../jobs'
import type { AiExtractor } from '../intake/files/ai-extractor'
import { currentAiContext } from './ai-context'
import { AiExtractionService } from './ai-extraction.service'
import { AiCancelledError, AiError } from './ai.errors'

/**
 * Maps an AI failure to the `JobError` the job runner understands (it stores the code, never a message):
 *  - `AI_BUDGET_EXHAUSTED` and `RATE_LIMITED`: retryable, the job is queued again with backoff (AC-29.2);
 *  - `AI_PROVIDER_ERROR` / `AI_TIMEOUT`: the retries inside the service are used up; retryable only for transient causes;
 *  - `AI_UNAVAILABLE` (provider not configured): not retryable, a job would only loop;
 *  - a cancelled call: `CANCELLED`, not retryable.
 */
export function toJobError(err: unknown): JobError | unknown {
  if (err instanceof AiCancelledError) return new JobError('CANCELLED', false)
  if (err instanceof AiError) return new JobError(err.code, err.retryable)
  return err
}

/**
 * The real implementation of the BE-37 `AI_EXTRACTOR` port (`intake/files/ai-extractor.ts`, interface unchanged):
 * `extractPaper(req, signal)` delegates to `AiExtractionService`. The port has no room for the caller identity, so the
 * job handler (BE-38) wraps the call in `runWithAiContext({ actorId, batchId, runId }, ...)`; without it the call is a
 * system call (no actor: only the global rate limit applies, the usage row has no actor).
 */
@Injectable()
export class AiExtractorAdapter implements AiExtractor {
  constructor(@Inject(AiExtractionService) private readonly service: AiExtractionService) {}

  get id(): string {
    return this.service.providerId
  }

  async extractPaper(req: AiExtractRequest, signal?: AbortSignal): Promise<unknown> {
    try {
      return await this.service.extractPaper(req, currentAiContext(), signal)
    } catch (err) {
      throw toJobError(err)
    }
  }
}
