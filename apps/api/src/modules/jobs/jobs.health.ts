/** Worker liveness for `GET /api/ready` (informational only; it never changes the HTTP status). */
export type WorkerHealth = 'ok' | 'down' | 'disabled'

/** A tick no older than this counts as alive. (The tick cadence rule is separate: ticks at most 15 s apart.) */
export const WORKER_OK_WINDOW_MS = 60_000

/** Time of the last jobs worker tick in this process. A module variable, no table. */
let lastTickAt: number | undefined

/** Stamp a tick. Called as the first statement of `JobsWorker.tick()`, before any early return. */
export function markTick(now: number = Date.now()): void {
  lastTickAt = now
}

export function getWorkerHealth(enabled: boolean, now: number = Date.now()): WorkerHealth {
  if (!enabled) return 'disabled'
  return lastTickAt !== undefined && now - lastTickAt <= WORKER_OK_WINDOW_MS ? 'ok' : 'down'
}

/** Test only: forget the last tick (a process that never ticked). */
export function resetWorkerHealthForTest(): void {
  lastTickAt = undefined
}
