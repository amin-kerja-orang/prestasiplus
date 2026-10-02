/**
 * The runtime the core's test hooks work against. Hooks are plain functions registered in the
 * plugin (`hooks`) and receive no context, so the core seed binds the clock of the runtime being
 * seeded (every boot and every `reset`). The core's stores are module singletons attached to that
 * runtime's db, so hooks reach them through the repositories.
 */

import type { Clock } from '@/lib/time'

let boundClock: Clock | null = null

/** Called from the core `seed(ctx)`. */
export function bindCoreRuntime(clock: Clock): void {
  boundClock = clock
}

/** The clock of the most recently seeded runtime. Throws before the mock has booted. */
export function coreClock(): Clock {
  if (!boundClock) throw new Error('mock core: not booted yet (no runtime is bound)')
  return boundClock
}
