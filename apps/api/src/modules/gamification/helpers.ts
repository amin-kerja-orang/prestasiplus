import { toMytTimestamp } from '../../common/time/myt'
import { MASTERY_LABELS, MASTERY_THRESHOLDS } from './gamification.constants'
import type { TierRecord } from './gamification.repository'

export const round = (n: number, decimals: number): number => {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

/** Avatar initials: the first letter of the first two words (FN-M14-5.1.5). */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0] ?? '')
    .join('')
    .toUpperCase()
}

/** The single initial of the share cards. */
export const initialOf = (name: string): string => [...name.trim()][0]?.toUpperCase() ?? ''

/** Share-link text as the live hrefs carry it: spaces become `%20`, everything else is raw. */
export const shareEncode = (s: string): string => s.replace(/ /g, '%20')

/** The level reached with `correct` correct answers (M05 BR-20 scale). */
export function masteryLevel(correct: number): number {
  let level = 0
  for (const [i, t] of MASTERY_THRESHOLDS.entries()) if (correct >= t) level = i
  return level
}

/** x{1 + 0.05 * (L - 1)} from L2; 1 below. */
export const masteryMultiplier = (level: number): number => (level >= 2 ? Math.round((1 + 0.05 * (level - 1)) * 100) / 100 : 1)

/** Correct answers of the next level, or null at the top level. */
export const masteryNextTarget = (level: number): number | null => (level >= MASTERY_THRESHOLDS.length - 1 ? null : (MASTERY_THRESHOLDS[level + 1] as number))

export const masteryStage = (level: number): string => MASTERY_LABELS[level] as string

const byThreshold = (a: TierRecord, b: TierRecord): number =>
  a.minSyiling - b.minSyiling || a.sortOrder - b.sortOrder || (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0)

/** Active tiers by `minSyiling`, then `sortOrder`, then id (mock `activeTiers`). */
export const activeTiers = (tiers: readonly TierRecord[]): TierRecord[] => tiers.filter((t) => t.isActive).sort(byThreshold)

/** BR-M14-02: the default tier is the active tier with the lowest `minSyiling` (any tier when none is active). */
export const defaultTier = (tiers: readonly TierRecord[]): TierRecord | undefined => activeTiers(tiers)[0] ?? [...tiers].sort(byThreshold)[0]

export const tierView = (t: TierRecord) => ({
  key: t.tierName,
  labelMs: t.labelMs,
  icon: t.icon,
  color: t.color,
  minSyiling: t.minSyiling,
  conversionRate: t.conversionRate,
})

export const stamp = toMytTimestamp
