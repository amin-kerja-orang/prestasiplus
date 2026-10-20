/** A job the runner has claimed for this process. `payload` holds small ids only, never content. */
export interface ClaimedJob {
  id: string
  type: string
  entityType: string | null
  entityId: string | null
  payload: unknown
  /** Attempt number of this run (1 on the first run). */
  attempts: number
  maxAttempts: number
}

/** Runs one job. Must honour `signal` (cancel, timeout); throw `JobError` to control retries. */
export type JobHandler = (job: ClaimedJob, signal: AbortSignal) => Promise<void>

export interface RegisterOptions {
  /** Hard wall-clock limit per run; on expiry the signal is aborted and the run fails with `TIMEOUT` (retryable). */
  timeoutMs?: number
  /**
   * Called once when a job ends in `failed` for good (out of attempts, a non-retryable error, or swept as
   * `STUCK`), with the final error code. Lets the owner of the entity close what the job left open. Best
   * effort: an error thrown here is logged and swallowed.
   */
  onExhausted?: (job: ClaimedJob, code: string) => Promise<void>
}

export interface EnqueueInput {
  type: string
  idempotencyKey: string
  entityType?: string
  entityId?: string
  /** Small ids only; never content or personal data. */
  payload?: unknown
  maxAttempts?: number
  runAfter?: Date
}

/** Failure with a stable code (stored in `jobs.error_code`, max 64 chars). Messages are never persisted. */
export class JobError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(code)
    this.name = 'JobError'
  }
}

export const JOB_TYPE_PATTERN = /^[a-z][a-z0-9_.]{1,63}$/
export const MAX_ERROR_CODE_LENGTH = 64
