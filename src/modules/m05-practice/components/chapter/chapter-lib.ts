/**
 * Pure helpers of the chapter screens S4 / S5 / Q2 (SRS M05 v1.19 FR-M05-58…67, BR-16).
 */

import type { ChapterCard } from '../../api/types'

/** The four question counts of an open chapter (FR-M05-63). */
export const CHAPTER_COUNTS = [5, 10, 15, 20] as const

/** "Skor" with 1 decimal and a trailing ".0" dropped ("44.4", "60", "0"; BR-03, BR-16). */
export function formatScore(pct: number): string {
  return String(Number((Number.isFinite(pct) ? pct : 0).toFixed(1)))
}

/** The stats line of a chapter card (BR-16 format; counts without a separator, as live). */
export function chapterStats(
  c: Pick<ChapterCard, 'answered' | 'total' | 'scorePct' | 'remaining'>,
): string {
  return `${String(c.answered)}/${String(c.total)} soalan unik · Skor ${formatScore(c.scorePct)}% · ${String(c.remaining)} baki`
}

/** Bar width in percent: answered ÷ total, clamped to 0–100 (0 when the chapter has no question). */
export function progressWidth(c: Pick<ChapterCard, 'answered' | 'total'>): number {
  if (c.total <= 0) return 0
  return Math.min(100, Math.max(0, (c.answered / c.total) * 100))
}

/** Q2 link of an open chapter (FR-M05-63). */
export function chapterQuizHref(code: string, chapterId: number, count: number): string {
  return `/practice/chapter/${encodeURIComponent(code)}/${String(chapterId)}/quiz?count=${String(count)}`
}

/** S5 URL of a subject, with the level when known (FR-M05-60, 66). */
export function chapterListHref(code: string, levelId: number | null): string {
  const base = `/practice/chapter/${encodeURIComponent(code)}`
  return levelId === null ? base : `${base}?level=${String(levelId)}`
}

/** `?level=` of S5: a positive integer, else `null` (the first offered level). */
export function parseLevelParam(raw: unknown): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (typeof v !== 'string' || !/^\d{1,9}$/.test(v)) return null
  const n = Number.parseInt(v, 10)
  return n > 0 ? n : null
}

/** Q2 header title (FR-M05-52): "Bab {n}: {chapter}". */
export function chapterQuizTitle(
  chapter: { number: number | null; name: string | null } | undefined,
): string {
  if (!chapter) return ''
  const name = chapter.name ?? ''
  return chapter.number === null ? name : `Bab ${String(chapter.number)}: ${name}`
}
