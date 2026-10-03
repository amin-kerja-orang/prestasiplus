/**
 * S15 `/gamification/achievements` helpers (SRS M14 FR-M14-44..51, FN-M14-6.1.*): copy, the rarity
 * pills, the share-card gradients (live `rarityGradients`), the progress width and the WhatsApp text.
 */

import type { AchievementItem, Rarity } from '../../api'

export const ACHIEVEMENTS_PATH = '/gamification/achievements'

export const ACHIEVEMENTS_COPY = {
  title: '🏅 Pencapaian Anda',
  streakLabel: 'Hari berturut-turut',
  prestasiplus: '🎓 PRESTASIPLUS',
  download: 'Muat Turun',
  whatsapp: 'WhatsApp',
  close: 'Tutup',
  loadError: 'Maaf, berlaku ralat. Sila cuba semula.',
  retry: 'Cuba Semula',
} as const

/** "Kumpul lencana dan capai pencapaian — {unlocked}/{total} dicapai" (FN-M14-6.1.1). */
export const achievementsSubtitle = (unlocked: number, total: number): string =>
  `Kumpul lencana dan capai pencapaian — ${String(unlocked)}/${String(total)} dicapai`

export const streakBonusLabel = (multiplier: number): string => `${multiplier.toFixed(1)}x Bonus`
export const streakBestLabel = (best: number): string => `Terbaik: ${String(best)} hari`

export interface RarityPill {
  /** Query value; `null` is "Semua" (no query). */
  value: Rarity | null
  label: string
}

export const RARITY_PILLS: readonly RarityPill[] = [
  { value: null, label: 'Semua' },
  { value: 'common', label: 'Biasa' },
  { value: 'rare', label: 'Jarang' },
  { value: 'epic', label: 'Epik' },
  { value: 'legendary', label: 'Legenda' },
]

/** The raw `?rarity=` of the route (first value), or `null`. Unknown values are kept (no card, no message). */
export function readRarity(raw: unknown): string | null {
  const value = Array.isArray(raw) ? (raw[0] as unknown) : raw
  return typeof value === 'string' && value !== '' ? value : null
}

/** Live `rarityGradients` (135deg): common #6b7280 to #9ca3af, rare #2563eb to #60a5fa, epic #7c3aed to #a78bfa, legendary #d97706, #fbbf24, #f59e0b. */
export const RARITY_GRADIENT: Record<Rarity, string> = {
  common: 'bg-linear-to-br from-gray-500 to-gray-400',
  rare: 'bg-linear-to-br from-blue-600 to-blue-400',
  epic: 'bg-linear-to-br from-violet-600 to-violet-400',
  legendary: 'bg-linear-to-br from-amber-600 via-amber-400 to-amber-500',
}

export const rarityGradient = (rarity: string): string =>
  RARITY_GRADIENT[rarity as Rarity] ?? RARITY_GRADIENT.common

/** Progress bar width in percent (0–100) of a kuiz-count badge. */
export function progressPct(progress: NonNullable<AchievementItem['progress']>): number {
  if (progress.target <= 0) return 0
  return Math.max(0, Math.min(100, (progress.value / progress.target) * 100))
}

/** File name of the downloaded card: `pencapaian-{name lower-case, spaces → hyphens}.png` (FN-M14-6.1.6). */
export const achievementFileName = (name: string): string =>
  `pencapaian-${name.toLowerCase().replace(/\s+/g, '-')}.png`

/** WhatsApp text (FN-M14-6.1.7; DV-M14-02 the viewer's own profile link). */
export const achievementShareText = (name: string, profileUrl: string): string =>
  `🏅 Saya baru capai "${name}" di PRESTASIPLUS! 🎉\n\nJom latih tubi sama-sama:\n${profileUrl}`
