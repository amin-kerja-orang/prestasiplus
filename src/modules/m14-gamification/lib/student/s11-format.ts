/**
 * Formatting helpers for the M14 student screens S11, S12, S13 and S17 (SRS M14 BR-M14-04, 05, 06,
 * 35; FN-M14-13.1.4). Shared by the four screens; names are prefixed `gam`.
 */

import { clock } from '@/lib/time/clock'
import { diffForHumans } from '@/lib/time/relative'
import { toEpochMs, type DateInput } from '@/lib/time/zone'
import { formatCount, roundHalfUp } from '@/lib/number'

/** BR-M14-35: under a minute "baru sahaja" (INFERRED), else the Carbon pattern in BM. */
export function gamRelativeTime(date: DateInput, now: DateInput = clock.now()): string {
  const diff = toEpochMs(now) - toEpochMs(date)
  if (diff >= 0 && diff < 60_000) return 'baru sahaja'
  return diffForHumans(date, now)
}

/** Percentage text of BR-M14-04: 2 decimals, trailing zeros and point dropped ("48.94", "35"). */
export function gamTrimNumber(value: number, decimals = 2): string {
  return String(roundHalfUp(value, decimals))
}

/** BR-M14-06: pct = current ÷ next.minSyiling × 100, 1 decimal, capped at 100. */
export function gamNextTierPct(currentSyiling: number, nextMin: number): number {
  if (nextMin <= 0) return 100
  return Math.min(100, roundHalfUp((currentSyiling / nextMin) * 100, 1))
}

/** Bar width 0..100 from any number. */
export function gamClampPct(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/** Difficulty badge label (upper-cased by CSS, FN-M14-2.1.6): "easy"/"medium"/"hard" and the BM forms. */
export function gamDifficultyLabel(difficulty: string): string {
  const key = difficulty.trim().toLowerCase()
  if (key === 'easy' || key === 'mudah') return 'Mudah'
  if (key === 'medium' || key === 'sederhana') return 'Sederhana'
  if (key === 'hard' || key === 'sukar' || key === 'susah') return 'Sukar'
  return difficulty
}

/** Difficulty badge colours (live: green / amber / red 100 + 700). */
export function gamDifficultyClass(difficulty: string): string {
  switch (gamDifficultyLabel(difficulty)) {
    case 'Mudah':
      return 'bg-emerald-100 text-emerald-700'
    case 'Sederhana':
      return 'bg-amber-100 text-amber-800'
    case 'Sukar':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

/** Ledger type icon (FN-M14-2.2.3: 💰 observed; the others PROPOSED from the S17 pills). */
export function gamLedgerIcon(type: string): string {
  switch (type) {
    case 'spend':
      return '🛍️'
    case 'convert':
      return '🔄'
    case 'bonus':
      return '🎁'
    case 'refund':
      return '↩️'
    default:
      return '💰'
  }
}

/** Signed amount "+25" / "−250" (U+2212 for the minus, FN-M14-2.2.3 "−n"). */
export function gamSignedAmount(amount: number): string {
  if (amount > 0) return `+${formatCount(amount)}`
  if (amount < 0) return `−${formatCount(Math.abs(amount))}`
  return '0'
}

export function gamAmountClass(amount: number): string {
  return amount < 0 ? 'text-red-500' : 'text-green-600'
}

/** Tier colours by key, for the screens whose payload carries none (#5 `tiers`, A.2 of the discovery). */
export const GAM_TIER_COLORS: Readonly<Record<string, string>> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  platinum: '#e5e4e2',
}
export const GAM_TIER_FALLBACK_COLOR = '#3b82f6'

export function gamTierColor(key: string, color?: string | null): string {
  return color || GAM_TIER_COLORS[key] || GAM_TIER_FALLBACK_COLOR
}

/**
 * DV-M14-15 (D9 unreadable text, consistent with DV-M14-06): the gold, silver and platinum tier colours
 * (#ffd700, #c0c0c0, #e5e4e2) are unreadable as text on their own light tint, so tier LABEL text uses
 * slate-800 for those three; bronze keeps its live colour and swatches, borders and tints keep the live
 * colours.
 */
export const GAM_LIGHT_TIER_TEXT_COLOR = '#1e293b'
const GAM_LIGHT_TIER_KEYS = new Set(['gold', 'silver', 'platinum'])

export function gamTierTextColor(key: string, color?: string | null): string {
  return GAM_LIGHT_TIER_KEYS.has(key) ? GAM_LIGHT_TIER_TEXT_COLOR : gamTierColor(key, color)
}

/** Tier background = colour + "20" alpha (A.2). */
export function gamTierTint(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}20` : color
}

/** Stage label of a mastery row ("Aktif", "Mula Belajar"); unknown keys are shown as given. */
export function gamStageLabel(stage: string): string {
  const key = stage.trim().toLowerCase()
  if (key === 'active' || key === 'aktif') return 'Aktif'
  if (key === 'starting' || key === 'beginner' || key === 'mula_belajar' || key === 'mula belajar')
    return 'Mula Belajar'
  return stage
}
