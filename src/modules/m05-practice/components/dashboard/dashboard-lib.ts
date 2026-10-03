/**
 * Small pure helpers of the S1 dashboard blocks (M05-T3; SRS M05 v1.17 FR-M05-02…28, §6.10).
 */

import type { DashboardBanner, PracticeSubject, QuestDifficulty } from '../../api/types'

/** FR-M05-12 / 14: the widget counts out of 10 quests (the M14 catalogue). */
export const QUEST_TOTAL = 10

/** FR-M05-08: the carousel advances every 5,000 ms. */
export const CAROUSEL_INTERVAL_MS = 5000

/** FR-M05-12: the difficulty chip text and colours (DV-M05-11: 12 px, `text-xs`). */
export const QUEST_DIFFICULTY: Record<QuestDifficulty, { label: string; chip: string }> = {
  easy: { label: 'Mudah', chip: 'bg-green-100 text-green-700' },
  medium: { label: 'Sederhana', chip: 'bg-amber-100 text-amber-700' },
  hard: { label: 'Sukar', chip: 'bg-red-100 text-red-700' },
}

/** FR-M05-27: five rows, difficulty 1–5, with the live star colours. */
export const DIFFICULTY_ROWS: readonly { level: number; label: string; color: string }[] = [
  { level: 1, label: 'Sangat Mudah', color: '#10B981' },
  { level: 2, label: 'Mudah', color: '#84CC16' },
  { level: 3, label: 'Sederhana', color: '#F59E0B' },
  { level: 4, label: 'Sukar', color: '#F97316' },
  { level: 5, label: 'Sangat Sukar', color: '#EF4444' },
]

/** FR-M05-27: the bar of row `i` grows after 150, 300, 450, 600, 750 ms. */
export const DIFFICULTY_BAR_DELAY_MS = 150

/** FR-M05-25: the three level groups, by `DashboardLevelPill.stage`. */
export const LEVEL_GROUPS = [
  { stage: 'primary', emoji: '🏫', label: 'Sekolah Rendah (KSSR)' },
  { stage: 'lower_secondary', emoji: '🎒', label: 'Sekolah Menengah Rendah (KSSM)' },
  { stage: 'upper_secondary', emoji: '🎓', label: 'Sekolah Menengah Atas (KSSM)' },
] as const

/** FR-M05-04 / §6.10: the carousel type icon and the live slide colours. */
export type BannerKind = 'HERO' | 'FEATURE' | 'PROMOTIONAL' | 'ANNOUNCEMENT'

export interface BannerStyle {
  card: string
  tile: string
  badge: string
  toggle: string
}

const BANNER_STYLES: Record<BannerKind, BannerStyle> = {
  HERO: {
    card: 'from-indigo-50 to-purple-100 border-indigo-300',
    tile: 'from-indigo-500 to-purple-500',
    badge: 'bg-indigo-100 text-indigo-700',
    toggle: 'text-indigo-600 hover:text-indigo-800',
  },
  FEATURE: {
    card: 'from-amber-50 to-yellow-100 border-amber-300',
    tile: 'from-amber-400 to-yellow-500',
    badge: 'bg-amber-100 text-amber-700',
    toggle: 'text-amber-600 hover:text-amber-800',
  },
  PROMOTIONAL: {
    card: 'from-pink-50 to-rose-100 border-pink-300',
    tile: 'from-pink-500 to-rose-500',
    badge: 'bg-pink-100 text-pink-700',
    toggle: 'text-pink-600 hover:text-pink-800',
  },
  ANNOUNCEMENT: {
    card: 'from-blue-50 to-blue-100 border-blue-300',
    tile: 'from-blue-500 to-blue-600',
    badge: 'bg-blue-100 text-blue-700',
    toggle: 'text-blue-600 hover:text-blue-800',
  },
}

export function bannerKind(banner: Pick<DashboardBanner, 'type'>): BannerKind {
  const type = banner.type.toUpperCase()
  return type in BANNER_STYLES ? (type as BannerKind) : 'FEATURE'
}

export function bannerStyle(banner: Pick<DashboardBanner, 'type'>): BannerStyle {
  return BANNER_STYLES[bannerKind(banner)]
}

/** Width of a quest bar: progress ÷ target, clamped to 0–100 %. */
export function questPct(progress: number, target: number): number {
  if (target <= 0) return 0
  return Math.max(0, Math.min(100, (progress / target) * 100))
}

/** FR-M05-27: bar width = count ÷ max(count) × 100 %. */
export function barWidths(counts: readonly number[]): number[] {
  const max = Math.max(0, ...counts)
  return counts.map((count) => (max > 0 ? (count / max) * 100 : 0))
}

/** FR-M05-26 / 28: `filled` amber stars out of 5, the rest slate (clamped to 0–5). */
export function starStates(filled: number): boolean[] {
  const n = Math.max(0, Math.min(5, Math.round(filled)))
  return [0, 1, 2, 3, 4].map((i) => i < n)
}

/** FR-M05-14: the chest dots, `true` for a completed position (purple, INFERRED). */
export function chestDots(completed: number): boolean[] {
  return Array.from({ length: 10 }, (_, i) => i < completed)
}

/** FR-M05-10 / 11: the count-up rules of FN-M05-1.3.3 and 1.7.2. */
export interface CountUpRule {
  delayMs: number
  intervalMs: number
  /** Increment per tick for `target`. */
  step: (target: number) => number
}

export const COUNT_RULES = {
  coins: { delayMs: 100, intervalMs: 30, step: (t) => Math.ceil(t / 20) },
  points: { delayMs: 150, intervalMs: 30, step: (t) => Math.ceil(t / 20) },
  streak: { delayMs: 200, intervalMs: 50, step: () => 1 },
  sessions: { delayMs: 300, intervalMs: 60, step: () => 1 },
  accuracy: { delayMs: 400, intervalMs: 30, step: (t) => Math.ceil(t / 25) },
  totalQuestions: { delayMs: 100, intervalMs: 25, step: (t) => Math.ceil(t / 30) },
  activeSubjects: { delayMs: 200, intervalMs: 80, step: () => 1 },
  activeLevels: { delayMs: 300, intervalMs: 100, step: () => 1 },
  approvedQuestions: { delayMs: 400, intervalMs: 30, step: (t) => Math.ceil(t / 25) },
} as const satisfies Record<string, CountUpRule>

/** FR-M05-26: the colour of the level chip = the colour of the question's subject (looked up by name). */
export function subjectColorByName(
  subjects: readonly Pick<PracticeSubject, 'name' | 'color'>[],
  name: string,
): string {
  return subjects.find((s) => s.name === name)?.color ?? '#64748B'
}

/** FR-M05-18: the red badge on "Soalan Aku Salah" shows the count, none when 0 (INFERRED). */
export function revisionBadge(total: number): string | null {
  return total > 0 ? String(total) : null
}

/** FR-M05-09 (INFERRED condition): a streak of at least 1 day and no practice today. */
export function showKombo(streak: { count: number; practisedToday: boolean }): boolean {
  return streak.count >= 1 && !streak.practisedToday
}

/** FR-M05-02: the h1 text (the wave emoji is a separate animated span). */
export function greetingText(period: string, name: string): string {
  return `Selamat ${period}, ${name}`
}

/** FR-M05-15 (PROPOSED, SRS §8.3): a completed quest is drawn with a full bar. */
export function questBarPct(q: { progress: number; target: number; completed: boolean }): number {
  return q.completed ? 100 : questPct(q.progress, q.target)
}

/** FR-M05-26: the displayed text of a recent question, cut at 100 characters + "..." (BR-29). */
export function cutText(text: string, limit = 100): string {
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}
