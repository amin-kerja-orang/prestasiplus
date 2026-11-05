/**
 * Pure helpers of the chapter screens S4 / S5 / Q2 (SRS M05 v1.19 FR-M05-58…67, BR-16).
 */

import type { EntityId } from '@/api'

import type { ChapterCard } from '../../api/types'

/** The four question counts of an open chapter (FR-M05-63). */
export const CHAPTER_COUNTS = [5, 10, 15, 20] as const

/** The title of a count button above the available number (FR-MUR-9-12). */
export function onlyAvailableTitle(total: number): string {
  return `Hanya ${String(total)} soalan tersedia.`
}

/** `UserMe.grade` 7-11 = Tingkatan 1-5 → level code `T1`..`T5`; anything else → `null` (FR-MUR-9-5, D101). */
export function levelCodeOfGrade(grade: number | null | undefined): string | null {
  return typeof grade === 'number' && grade >= 7 && grade <= 11 ? `T${String(grade - 6)}` : null
}

/** One entry of the "Pilih Tahap" select of the subject index. */
export interface ChapterLevelOption {
  code: string
  id: EntityId
  name: string
  questionCount: number
}

/** The levels over all subjects (by code, level order T1..T5), summing the servable questions (FR-MUR-9-5). */
export function chapterLevelOptions(
  subjects: readonly { levels: readonly { id: EntityId; code: string; name: string; questionCount: number }[] }[],
): ChapterLevelOption[] {
  const byCode = new Map<string, ChapterLevelOption>()
  for (const s of subjects) {
    for (const l of s.levels) {
      const o = byCode.get(l.code)
      if (o) o.questionCount += l.questionCount
      else byCode.set(l.code, { code: l.code, id: l.id, name: l.name, questionCount: l.questionCount })
    }
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code))
}

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
export function chapterQuizHref(code: string, chapterId: EntityId, count: number): string {
  return `/practice/chapter/${encodeURIComponent(code)}/${String(chapterId)}/quiz?count=${String(count)}`
}

/** S5 URL of a subject, with the level when known (FR-M05-60, 66). */
export function chapterListHref(code: string, levelId: EntityId | null): string {
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
