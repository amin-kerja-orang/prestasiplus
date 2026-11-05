/** Malaysia has no daylight saving: Asia/Kuala_Lumpur is a fixed UTC+8. */
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** The one source of "now" for the API (ADR-0006: tests and seeds never read the real clock). */
export interface Clock {
  now(): Date
}

export const CLOCK = Symbol('CLOCK')

export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }
}

/** A clock that only moves when told to (tests, seeds). */
export class FixedClock implements Clock {
  private ms: number

  constructor(at: Date | string | number) {
    this.ms = new Date(at).getTime()
    if (Number.isNaN(this.ms)) throw new RangeError('FixedClock: invalid time')
  }

  now(): Date {
    return new Date(this.ms)
  }

  set(at: Date | string | number): void {
    this.ms = new FixedClock(at).ms
  }

  advance(ms: number): void {
    this.ms += ms
  }
}

/** The calendar day (`YYYY-MM-DD`) of `at` in Asia/Kuala_Lumpur. */
export function mytDay(at: Date): string {
  return new Date(at.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 10)
}

/** The instant a Malaysian day starts (00:00 +08:00) as a `Date`. */
export function startOfMytDay(at: Date): Date {
  const local = at.getTime() + MYT_OFFSET_MS
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - MYT_OFFSET_MS)
}

/** Seed time: the anchor of ADR-0006 (2026-09-25T15:40:00+08:00). */
export const SEED_NOW = '2026-09-25T15:40:00+08:00'

/**
 * Seed profiles whose dates follow the seed run date (ADR-0006 Amendment 3). Explicit and minimal: every profile NOT listed here
 * (`uat-like`, `e2e`, any unknown name) keeps the fixed SEED_NOW calendar, so an unknown profile is reproducible by default.
 */
export const RUN_DATE_SEED_PROFILES: ReadonlySet<string> = new Set(['poc'])

/** The clock and date shift of one seed run (see {@link seedClockFor}). */
export interface SeedDates {
  /** `FixedClock(SEED_NOW + shiftMs)`: same time of day as SEED_NOW, on the run date in demo runs. */
  clock: Clock
  /** Whole days (in ms) between the SEED_NOW day and the run day; 0 for CI profiles. */
  shiftMs: number
  /** `new Date(Date.parse(iso) + shiftMs)`: equals `offsetDays(n)` from the clock for the fixed n of the literal; `new Date(iso)` when the shift is 0. */
  date(iso: string): Date
  /** Like `date`, but shifted by whole weeks only (keeps the weekday), for week-start keys; the week of `SEED_NOW` stays the week of the clock. */
  weekDate(iso: string): Date
}

/**
 * Builds the seed clock for a profile. `runAt` is the real run time, passed in by the entry point (the only place that reads the real
 * clock; `prisma/seed/**` may not). Without `runAt`, or for a CI profile, the shift is 0 and the result is identical to the pre-split seed.
 */
export function seedClockFor(profile: string, runAt?: Date): SeedDates {
  const anchor = new Date(SEED_NOW)
  let shiftMs = 0
  let weekShiftMs = 0
  if (runAt && RUN_DATE_SEED_PROFILES.has(profile)) {
    shiftMs = startOfMytDay(runAt).getTime() - startOfMytDay(anchor).getTime()
    const sinceMonday = (new Date(anchor.getTime() + MYT_OFFSET_MS).getUTCDay() + 6) % 7
    weekShiftMs = Math.floor((shiftMs / DAY_MS + sinceMonday) / 7) * 7 * DAY_MS
  }
  return {
    clock: new FixedClock(anchor.getTime() + shiftMs),
    shiftMs,
    date: (iso) => (shiftMs === 0 ? new Date(iso) : new Date(Date.parse(iso) + shiftMs)),
    weekDate: (iso) => (weekShiftMs === 0 ? new Date(iso) : new Date(Date.parse(iso) + weekShiftMs)),
  }
}
