/**
 * `useRoomPolling(tick, ms)`: the M16 polling loop of SRS M16 v1.6 §7.1 (the room poll #26 and the Papan
 * Bijak quick-match poll #30, both every `BATTLE_POLL_MS`).
 *
 * - `tick` runs every `ms` on a plain `setInterval`, so the Playwright clock controls it (NFR-M16-01);
 * - a tick is skipped while the previous request is still in flight;
 * - each tick receives an `AbortSignal`; `stop()` and the owning scope's disposal abort the request in
 *   flight and clear the timer, so nothing keeps running after the page is left;
 * - errors thrown by `tick` are swallowed (the caller decides what a failed poll means).
 */

import { getCurrentScope, onScopeDispose, readonly, ref, type Ref } from 'vue'

import { BATTLE_POLL_MS } from '../api'

export interface RoomPolling {
  /** `true` while the interval is ticking. */
  running: Readonly<Ref<boolean>>
  /** Starts the interval (the first tick comes after `ms`). Does nothing while already running. */
  start: () => void
  /** Stops the interval and aborts the request in flight. */
  stop: () => void
  /** Aborts the request in flight only (e.g. before the caller sends its own action). */
  abortInFlight: () => void
}

export function useRoomPolling(
  tick: (signal: AbortSignal) => Promise<void> | void,
  ms: number = BATTLE_POLL_MS,
): RoomPolling {
  let timer: ReturnType<typeof setInterval> | null = null
  let inFlight = false
  let controller: AbortController | null = null
  const running = ref(false)

  async function run(): Promise<void> {
    if (inFlight) return
    inFlight = true
    const current = new AbortController()
    controller = current
    try {
      await tick(current.signal)
    } catch {
      /* the caller's tick handles its own failures; a throw only ends this tick */
    } finally {
      if (controller === current) controller = null
      inFlight = false
    }
  }

  function abortInFlight(): void {
    controller?.abort()
  }

  function start(): void {
    if (timer !== null) return
    timer = setInterval(() => void run(), ms)
    running.value = true
  }

  function stop(): void {
    if (timer !== null) clearInterval(timer)
    timer = null
    running.value = false
    abortInFlight()
  }

  if (getCurrentScope()) onScopeDispose(stop)

  return { running: readonly(running), start, stop, abortInFlight }
}
