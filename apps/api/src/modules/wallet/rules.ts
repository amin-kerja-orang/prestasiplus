import { TITLES } from './wallet.constants'

/**
 * Pure M14 rules (SRS M14 v1.9 section 4; mock `repository/rules.ts`). No store access, no clock:
 * the services feed them rows and dates, so every rule is unit-testable on its own.
 */

/** A tier as the rules need it (the row of `tiers`, with the rate as a number). */
export interface TierLike {
  id: string
  tierName: string
  minSyiling: number
  sortOrder: number
  isActive: boolean
}

/** BR-M14-05: xpNeeded(level) = 100 + 10 x (level - 1). */
export function xpNeeded(level: number): number {
  return 100 + 10 * (Math.max(1, level) - 1)
}

/** BR-M14-05: min(100, round(xp / xpNeeded x 100)). */
export function levelProgressPct(xp: number, level: number): number {
  return Math.min(100, Math.round((xp / xpNeeded(level)) * 100))
}

export interface TitleInfo {
  name: string
  emoji: string
}

/** BR-M14-09: the title of a lifetime total. */
export function titleOf(totalSyilingEarned: number): TitleInfo {
  let current = TITLES[0] as (typeof TITLES)[number]
  for (const t of TITLES) if (totalSyilingEarned >= t.threshold) current = t
  return { name: current.name, emoji: current.emoji }
}

/** BR-M14-09: the next title with the syiling still needed, or null after the last. */
export function nextTitleOf(totalSyilingEarned: number): (TitleInfo & { threshold: number; need: number }) | null {
  const next = TITLES.find((t) => t.threshold > totalSyilingEarned)
  return next ? { name: next.name, emoji: next.emoji, threshold: next.threshold, need: next.threshold - totalSyilingEarned } : null
}

const byThreshold = (a: TierLike, b: TierLike): number =>
  a.minSyiling - b.minSyiling || a.sortOrder - b.sortOrder || (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0)

/** Active tiers by `minSyiling`, then `sortOrder`, then id. */
export function activeTiers<T extends TierLike>(tiers: readonly T[]): T[] {
  return tiers.filter((t) => t.isActive).sort(byThreshold)
}

/** BR-M14-02: the default tier is the active tier with the lowest `minSyiling` (any tier when none is active). */
export function defaultTier<T extends TierLike>(tiers: readonly T[]): T | undefined {
  return activeTiers(tiers)[0] ?? [...tiers].sort(byThreshold)[0]
}

/**
 * BR-M14-08: after a credit, the highest ACTIVE tier whose `minSyiling` is at most the CURRENT syiling,
 * if it is higher than the current tier; never down. Returns the tier id to keep or move to (null when
 * the wallet has none and no tier qualifies).
 */
export function upgradedTierId<T extends TierLike>(tiers: readonly T[], currentTierId: string | null, currentSyiling: number): string | null {
  const current = tiers.find((t) => t.id === currentTierId)
  const floor = current ? current.minSyiling : Number.NEGATIVE_INFINITY
  let best: T | null = null
  for (const t of activeTiers(tiers)) {
    if (t.minSyiling <= currentSyiling && t.minSyiling > floor) best = t
  }
  return best ? best.id : currentTierId
}

/** BR-M14-06: the active tier with the smallest `minSyiling` above the current tier's. */
export function nextTierOf<T extends TierLike>(tiers: readonly T[], currentTierId: string): T | null {
  const current = tiers.find((t) => t.id === currentTierId)
  const min = current ? current.minSyiling : Number.NEGATIVE_INFINITY
  return activeTiers(tiers).find((t) => t.minSyiling > min) ?? null
}

/** BR-M14-06: pct with 1 decimal, capped at 100; `need` is the syiling still missing. */
export function nextTierProgress(currentSyiling: number, next: { minSyiling: number }): { pct: number; need: number } {
  const raw = next.minSyiling > 0 ? (currentSyiling / next.minSyiling) * 100 : 100
  return { pct: Math.min(100, Math.round(raw * 10) / 10), need: Math.max(0, next.minSyiling - currentSyiling) }
}

export interface StreakState {
  current: number
  best: number
  /** Malaysia calendar day `YYYY-MM-DD`, or null before the first activity. */
  lastActivityDate: string | null
  totalDays: number
}

export const EMPTY_STREAK: Readonly<StreakState> = Object.freeze({ current: 0, best: 0, lastActivityDate: null, totalDays: 0 })

/** The calendar day before `date` (`YYYY-MM-DD`). Pure date arithmetic on UTC midnight, no time zone involved. */
export function previousDay(date: string): string {
  const ms = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(ms)) throw new RangeError('invalid day')
  return new Date(ms - 86_400_000).toISOString().slice(0, 10)
}

/**
 * BR-M14-14 (mock `stepStreak`) for an activity on Malaysia day `date`: the same day changes nothing;
 * the day after the last activity adds 1; any other gap restarts at 1. `best` is the maximum and
 * `totalDays` grows by 1 on each new streak day.
 */
export function stepStreak(state: StreakState, date: string): StreakState {
  if (state.lastActivityDate === date) return state
  const current = state.lastActivityDate === previousDay(date) ? state.current + 1 : 1
  return { current, best: Math.max(state.best, current), lastActivityDate: date, totalDays: state.totalDays + 1 }
}
