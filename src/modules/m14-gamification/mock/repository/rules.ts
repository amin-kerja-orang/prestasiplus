/**
 * Pure M14 rules (SRS M14 v1.7 §4): formats, XP / level, titles, tiers, streak steps, session
 * labels. No store access; shared by the runtime repository and the designed replay of the seed.
 */

import { addDays, formatDateKey, toEpochMs, type DateInput } from '@/lib/time'

import { TITLES } from '../data/catalogue'
import type { Tier, TierKey } from './types'

/** BR-M14-04: correct ÷ total × 100, 2 decimals, trailing zeros and point dropped, + "%". */
export function pctText(correct: number, total: number): string {
  if (total <= 0) return '0%'
  const value = Math.round((correct / total) * 100 * 100) / 100
  return `${String(Number(value.toFixed(2)))}%`
}

/** BR-M14-05: xpNeeded(level) = 100 + 10 × (level − 1). */
export function xpNeeded(level: number): number {
  return 100 + 10 * (Math.max(1, level) - 1)
}

/** BR-M14-05: min(100, round(xp ÷ xpNeeded × 100)). */
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

/** BR-M14-09: the next title with the syiling still needed, or null after Mitos. */
export function nextTitleOf(
  totalSyilingEarned: number,
): (TitleInfo & { threshold: number; need: number }) | null {
  const next = TITLES.find((t) => t.threshold > totalSyilingEarned)
  return next
    ? {
        name: next.name,
        emoji: next.emoji,
        threshold: next.threshold,
        need: next.threshold - totalSyilingEarned,
      }
    : null
}

/** Active tiers by `minSyiling` then `sortOrder`. */
export function activeTiers(tiers: readonly Tier[]): Tier[] {
  return tiers
    .filter((t) => t.isActive)
    .sort((a, b) => a.minSyiling - b.minSyiling || a.sortOrder - b.sortOrder || a.id - b.id)
}

/** BR-M14-02: the default tier = the active tier with the lowest `minSyiling`. */
export function defaultTier(tiers: readonly Tier[]): Tier {
  const first = activeTiers(tiers)[0] ?? tiers[0]
  if (!first) throw new Error('M14: no tier is defined')
  return first
}

/**
 * BR-M14-08: after a credit, the highest active tier with `minSyiling` ≤ `currentSyiling`, if it is
 * higher than the current tier; never down.
 */
export function upgradedTier(
  tiers: readonly Tier[],
  currentKey: TierKey,
  currentSyiling: number,
): TierKey {
  const current = tiers.find((t) => t.tierName === currentKey)
  const floorMin = current ? current.minSyiling : Number.NEGATIVE_INFINITY
  let best: Tier | null = null
  for (const t of activeTiers(tiers)) {
    if (t.minSyiling <= currentSyiling && t.minSyiling > floorMin) best = t
  }
  return best ? best.tierName : currentKey
}

/** BR-M14-06: the active tier with the smallest `minSyiling` above the current tier's. */
export function nextTierOf(tiers: readonly Tier[], currentKey: TierKey): Tier | null {
  const current = tiers.find((t) => t.tierName === currentKey)
  const min = current ? current.minSyiling : Number.NEGATIVE_INFINITY
  return activeTiers(tiers).find((t) => t.minSyiling > min) ?? null
}

/** BR-M14-06: pct with 1 decimal, capped at 100. */
export function nextTierProgress(
  currentSyiling: number,
  next: Tier,
): { pct: number; need: number } {
  const raw = next.minSyiling > 0 ? (currentSyiling / next.minSyiling) * 100 : 100
  return {
    pct: Math.min(100, Math.round(raw * 10) / 10),
    need: Math.max(0, next.minSyiling - currentSyiling),
  }
}

/** Local date key `YYYY-MM-DD` (Asia/Kuala_Lumpur). */
export function localDate(at: DateInput): string {
  return formatDateKey(at)
}

/** The local date before `date` (`YYYY-MM-DD`). */
export function previousDate(date: string): string {
  return formatDateKey(addDays(toEpochMs(`${date}T12:00:00+08:00`), -1))
}

export interface StreakState {
  current: number
  best: number
  lastActivityDate: string | null
  totalDays: number
}

export const EMPTY_STREAK: Readonly<StreakState> = Object.freeze({
  current: 0,
  best: 0,
  lastActivityDate: null,
  totalDays: 0,
})

/**
 * BR-M14-14 on a qualifying event on local date `date`: same day → no change; the next day → +1;
 * otherwise 1. `best` = max; `totalDays` +1 on each new streak day (DATA-M14-08, INFERRED).
 */
export function stepStreak(state: StreakState, date: string): StreakState {
  if (state.lastActivityDate === date) return state
  const current = state.lastActivityDate === previousDate(date) ? state.current + 1 : 1
  return {
    current,
    best: Math.max(state.best, current),
    lastActivityDate: date,
    totalDays: state.totalDays + 1,
  }
}

/** BR-M14-15: the only observed multiplier step. */
export const STREAK_MULTIPLIER = 1

/** Session modes (M05 DATA-M05-01 v1.12). */
export type SessionMode =
  | 'random'
  | 'chapter'
  | 'revision'
  | 'mission'
  | 'remedial'
  | 'question_set'
  | 'pksk'
  | 'past_year'
  | 'latih_tubi'
  | 'ramalan'

export const SPM_MODES: readonly string[] = ['past_year', 'latih_tubi', 'ramalan']
/** BR-M14-16: achievements are evaluated after these modes only. */
export const PRACTICE_MODES: readonly string[] = ['random', 'chapter', 'revision']

export function isSpmMode(mode: string): boolean {
  return SPM_MODES.includes(mode)
}

/**
 * BR-M14-03 ledger source and description prefix of a session credit. `remedial` and
 * `question_set` are not named by BR-M14-03: they take the practice wording (INFERRED).
 */
export function sessionCredit(mode: string): { source: string; prefix: string } {
  switch (mode) {
    case 'past_year':
      return { source: 'quiz_spm', prefix: 'SPM Tahun Lepas' }
    case 'latih_tubi':
      return { source: 'quiz_spm', prefix: 'Latih Tubi SPM' }
    case 'ramalan':
      return { source: 'quiz_spm', prefix: 'Ramalan SPM' }
    case 'pksk':
      return { source: 'quiz_pksk', prefix: 'PKSK' }
    default:
      return { source: 'quiz_practice', prefix: 'Latih Tubi' }
  }
}

/** BR-M14-24 teacher-mirror label (`pksk` INFERRED: "PKSK"). */
export function teacherMirrorLabel(mode: string): string {
  switch (mode) {
    case 'latih_tubi':
      return 'Latih Tubi SPM'
    case 'past_year':
      return 'SPM Tahun Lepas'
    case 'ramalan':
      return 'Ramalan SPM'
    case 'pksk':
      return 'PKSK'
    default:
      return 'Latihan'
  }
}

/** BR-M14-18: 7 characters of [A-Z0-9], deterministic from the user id (seed). */
export function referralCodeFor(userId: number, salt = 0): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let h = (Math.imul(userId ^ 0x5bd1e995, 0x27d4eb2d) + Math.imul(salt + 1, 0x165667b1)) >>> 0
  let out = ''
  for (let i = 0; i < 7; i++) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0
    h = (h ^ (h >>> 12)) >>> 0
    out += alphabet[h % alphabet.length]
  }
  return out
}

/** The admin's observed referral code (§6.11.2). */
export const ADMIN_REFERRAL_CODE = '4JURJTT'

/** NFR-M14-04 masking: "•••" + the last 3 digits of the account. */
export function maskAccount(account: string): string {
  const digits = account.replace(/\D/g, '')
  return `•••${digits.slice(-3)}`
}

/** NFR-M14-04 masking: the holder's initials. */
export function maskHolder(holder: string): string {
  return holder
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${(w[0] as string).toUpperCase()}.`)
    .join(' ')
}

/** BR-M14-25: cash in sen for `coins`. */
export function cashSenOf(coins: number, rateCoins: number, rateSen: number): number {
  const rc = rateCoins > 0 ? rateCoins : 10
  return Math.round((coins / rc) * rateSen)
}
