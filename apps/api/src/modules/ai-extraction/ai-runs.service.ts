import { Inject, Injectable } from '@nestjs/common'
import type { AiProviderId } from '@pp/contract'

import { CLOCK, type Clock } from '../../db/clock'
import { toDbProvider } from './ai.constants'
import { AiRepository } from './ai.repository'

export interface CreateRunInput {
  kind: 'extract_paper' | 'suggest_tags'
  provider: AiProviderId
  model: string
  batchId?: string | null
  intakeFileId?: string | null
  jobId?: string | null
  requestedById?: string | null
}

/**
 * Lifecycle of `ai_extraction_runs`: queued -> running -> succeeded | failed | cancelled. A caller that wants the file and
 * job references on the run (the intake worker, BE-38) creates it here and hands the id over in the call context; any other
 * caller gets a run created by the service. A run row holds counts, codes and timing only: no content, no message.
 */
@Injectable()
export class AiRunsService {
  constructor(
    @Inject(AiRepository) private readonly repo: AiRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Creates a run in `queued` and returns its id. */
  create(input: CreateRunInput): Promise<string> {
    return this.repo.createRun({
      kind: input.kind,
      provider: toDbProvider(input.provider),
      model: input.model,
      batchId: input.batchId ?? null,
      intakeFileId: input.intakeFileId ?? null,
      jobId: input.jobId ?? null,
      requestedById: input.requestedById ?? null,
      status: 'queued',
      startedAt: null,
    })
  }

  /**
   * Starts a run: the caller's `runId` when it exists, else a new one. Returns the id of the run that is now `running`.
   */
  async begin(input: CreateRunInput & { runId?: string | null }): Promise<string> {
    if (input.runId && (await this.repo.startRun(input.runId, toDbProvider(input.provider), input.model, this.clock.now()))) return input.runId
    return this.repo.createRun({
      kind: input.kind,
      provider: toDbProvider(input.provider),
      model: input.model,
      batchId: input.batchId ?? null,
      intakeFileId: input.intakeFileId ?? null,
      jobId: input.jobId ?? null,
      requestedById: input.requestedById ?? null,
      status: 'running',
      startedAt: this.clock.now(),
    })
  }

  succeed(runId: string, totals: { pages: number; tokensIn: number; tokensOut: number; costSen: number }): Promise<void> {
    return this.repo.finishRun(runId, { status: 'succeeded', finishedAt: this.clock.now(), ...totals })
  }

  fail(runId: string, errorCode: string, totals?: { pages: number; tokensIn: number; tokensOut: number; costSen: number }): Promise<void> {
    return this.repo.finishRun(runId, { status: 'failed', finishedAt: this.clock.now(), errorCode, ...(totals ?? {}) })
  }

  cancel(runId: string): Promise<void> {
    return this.repo.finishRun(runId, { status: 'cancelled', finishedAt: this.clock.now(), errorCode: 'CANCELLED' })
  }
}
