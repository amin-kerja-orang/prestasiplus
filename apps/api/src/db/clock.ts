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
