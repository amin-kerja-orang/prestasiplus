/**
 * The one clock shared by the UI and the mock (overview §6.12, ADR-0006 §4).
 *
 * `clock.now() = source() + offset`, where `source` is `Date.now` by default.
 * - Development and demo: the boot code sets the offset so that now equals
 *   `CLOCK_ANCHOR_ISO` on first boot and persists it (F-05 / mock side).
 * - E2E: the offset stays 0 and the Playwright clock drives `Date.now`.
 * - Unit tests: `createClock({ at })` gives an isolated, frozen clock whose time
 *   is changed only by `setNow` / `advance`.
 */

import { type DateInput, toEpochMs } from './zone'

/** The anchor every SRS seed is written against: Friday 25 Sep 2026, 15:40 MYT. */
export const CLOCK_ANCHOR_ISO = '2026-09-25T15:40:00+08:00'
export const CLOCK_ANCHOR_MS = Date.parse(CLOCK_ANCHOR_ISO)

export type ClockListener = (offset: number) => void

export interface Clock {
  /** Current time in epoch ms. */
  now(): number
  /** Current time as a new `Date`. */
  date(): Date
  getOffset(): number
  setOffset(offset: number): void
  /** Moves the clock so that `now()` equals `target` (time keeps running from there). */
  setNow(target: DateInput): void
  /** Moves the clock forward (or back, if negative) by `ms`. */
  advance(ms: number): void
  /** Offset back to 0. */
  reset(): void
  /** Called with the new offset whenever it changes (e.g. to persist it). Returns an unsubscribe function. */
  subscribe(listener: ClockListener): () => void
}

export interface ClockOptions {
  /** Base time source. Defaults to `Date.now`. */
  source?: () => number
  /** Initial offset in ms. */
  offset?: number
  /** Creates a frozen clock at this time (a fixed `source`); overrides `source` and `offset`. */
  at?: DateInput
}

export function createClock(options: ClockOptions = {}): Clock {
  const source =
    options.at === undefined ? (options.source ?? (() => Date.now())) : fixed(options.at)
  let offset = options.at === undefined ? (options.offset ?? 0) : 0
  const listeners = new Set<ClockListener>()

  const setOffset = (next: number) => {
    if (!Number.isFinite(next)) throw new RangeError(`Invalid clock offset: ${String(next)}`)
    if (next === offset) return
    offset = next
    for (const listener of listeners) {
      // One failing listener must not stop the others from being notified.
      try {
        listener(offset)
      } catch (error) {
        console.error('clock listener failed', error)
      }
    }
  }

  return {
    now: () => source() + offset,
    date: () => new Date(source() + offset),
    getOffset: () => offset,
    setOffset,
    setNow: (target) => setOffset(toEpochMs(target) - source()),
    advance: (ms) => setOffset(offset + ms),
    reset: () => setOffset(0),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function fixed(at: DateInput): () => number {
  const ms = toEpochMs(at)
  return () => ms
}

/** Offset that makes `now()` equal the anchor, given the real time `realNow`. */
export function anchorOffset(realNow: number = Date.now()): number {
  return CLOCK_ANCHOR_MS - realNow
}

/** The shared application clock (UI and mock). */
export const clock: Clock = createClock()
