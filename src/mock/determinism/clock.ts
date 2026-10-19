/**
 * The mock side of the one clock (overview §6.12, ADR-0006 §4).
 *
 * `src/lib/time/clock.ts` (F-03) owns the `Clock` itself (`now = source() + offset`). This file
 * decides the **offset at boot** and exposes the time controls the test hooks map onto:
 *
 * | Build | Offset at boot |
 * |---|---|
 * | development, demo (`anchored`) | the persisted offset if there is one (time is continuous across reloads), otherwise the offset that makes now = 2026-09-25T15:40:00+08:00 |
 * | e2e (`passthrough`) | 0 — the Playwright clock drives `Date.now` |
 *
 * In every build an explicit pre-boot time (`window.__MOCK_INIT__.now`) wins.
 * Persisting the offset is F-07's job: it subscribes to `clock.subscribe(...)`.
 */

import { CLOCK_ANCHOR_MS, type Clock, type DateInput } from '@/lib/time'

export type MockClockPolicy = 'anchored' | 'passthrough'

/** `import.meta.env.MODE` → policy. Only the e2e build lets the browser (Playwright) clock through. */
export function mockClockPolicyForMode(mode: string): MockClockPolicy {
  return mode === 'e2e' ? 'passthrough' : 'anchored'
}

export interface MockClockInit {
  policy: MockClockPolicy
  /** Offset restored from persistence (F-07); used by the `anchored` policy only. */
  persistedOffset?: number | null
  /** Explicit start time (`__MOCK_INIT__.now`); overrides the policy. */
  now?: DateInput | null
}

export type MockClockStart = 'init' | 'persisted' | 'anchor' | 'passthrough'

/**
 * Sets the boot offset of `clock` and returns how it was chosen.
 * The clock's listeners are notified only when the offset actually changes.
 */
export function initMockClock(clock: Clock, init: MockClockInit): MockClockStart {
  if (init.now !== undefined && init.now !== null) {
    clock.setNow(init.now)
    return 'init'
  }
  if (init.policy === 'passthrough') {
    clock.setOffset(0)
    return 'passthrough'
  }
  if (typeof init.persistedOffset === 'number' && Number.isFinite(init.persistedOffset)) {
    clock.setOffset(init.persistedOffset)
    return 'persisted'
  }
  clock.setNow(CLOCK_ANCHOR_MS)
  return 'anchor'
}

/**
 * The clock controls behind `mock.setNow` / `mock.advanceTime` (overview §6.13) for the
 * `anchored` policy (development, demo): they move the shared clock's offset.
 *
 * In the e2e `passthrough` policy the offset stays 0 and these controls are **not** used for
 * `setNow`/`advanceTime`: F-08 wires those hooks to the Playwright clock (`context.clock`), which
 * drives `Date.now` and therefore both UI timers and mock time (overview §6.12).
 */
export interface MockClockControls {
  setNow(target: DateInput): void
  advanceTime(ms: number): void
  now(): number
}

export function mockClockControls(clock: Clock): MockClockControls {
  return {
    setNow: (target) => clock.setNow(target),
    advanceTime(ms) {
      if (!Number.isFinite(ms)) throw new RangeError(`advanceTime: invalid ms ${String(ms)}`)
      clock.advance(ms)
    },
    now: () => clock.now(),
  }
}
