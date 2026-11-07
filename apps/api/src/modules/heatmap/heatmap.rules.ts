/**
 * Pure rules of the M25 Heatmap Topik Lemah read model (BE-48; reshaped by S10-T05 to API-DSKP-08, FR-MUR-14-1..8).
 * No I/O here: `HeatmapService` feeds these functions with the answer counts and the curriculum.
 *
 * - No minimum number of attempts. A chapter without an attempt is a `belum-cuba` tile.
 * - A subject is listed only when the caller has at least one attempt on a Bab-linked question of it; its block
 *   then lists every chapter the curriculum read gave (active, Tingkatan 1 to 5).
 * - Subjects: Subjek Teras first, then name ascending. Chapters: Bab number ascending.
 */
import {
  HEATMAP_NOT_TRIED,
  type HeatmapChapter,
  type HeatmapSubject,
  heatmapAccuracy,
  heatmapBand,
  heatmapPercent,
} from '@pp/contract'

/** Attempts and right answers of one chapter, grouped on the answer rows' `chapter_id` (never by name). */
export interface ChapterCount {
  chapterId: string
  attempts: number
  correct: number
}

/** A curriculum chapter as the heatmap needs it (active, Tingkatan 1 to 5). */
export interface HeatmapChapterRef {
  id: string
  name: string
  subjectId: string
  /** Bab number; null when the chapter has none. */
  number: number | null
  /** Sort position of the chapter's Tingkatan (tie-break after the Bab number). */
  levelOrder: number
}

/** The subject a Bab-linked answer belongs to (any tree chapter, active or not). */
export interface AttemptedChapterRef {
  id: string
  subjectId: string
}

/** A curriculum subject as the heatmap needs it. */
export interface HeatmapSubjectRef {
  id: string
  /** Subject code (the `:code` of `/practice/chapter/:code`). */
  code: string
  name: string
  /** Subjek Teras. */
  isCore: boolean
}

/** Numeric order of two decimal-string bigint ids (`9` before `10`, never string order). */
export function compareIds(a: string, b: string): number {
  const x = BigInt(a)
  const y = BigInt(b)
  return x < y ? -1 : x > y ? 1 : 0
}

/** Code-unit comparison; NOT ms-MY collation. */
export function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Chapters by Bab number ascending (no number last), then Tingkatan, then numeric id. */
export function compareChapterRefs(a: HeatmapChapterRef, b: HeatmapChapterRef): number {
  if (a.number !== b.number) {
    if (a.number === null) return 1
    if (b.number === null) return -1
    return a.number - b.number
  }
  return a.levelOrder - b.levelOrder || compareIds(a.id, b.id)
}

/** Subjek Teras first, then name ascending, then numeric id. */
export function compareSubjectRefs(a: HeatmapSubjectRef, b: HeatmapSubjectRef): number {
  if (a.isCore !== b.isCore) return a.isCore ? -1 : 1
  return compareNames(a.name, b.name) || compareIds(a.id, b.id)
}

/** The tile of one chapter: `belum-cuba` without attempts, otherwise a band on the whole percent. */
export function chapterTile(
  chapter: HeatmapChapterRef,
  count: { attempts: number; correct: number } | undefined,
): HeatmapChapter {
  const attempts = count?.attempts ?? 0
  const correct = count?.correct ?? 0
  return {
    id: chapter.id,
    number: chapter.number,
    name: chapter.name,
    attempts,
    correct,
    accuracy: heatmapAccuracy(correct, attempts),
    state: attempts === 0 ? HEATMAP_NOT_TRIED : heatmapBand(heatmapPercent(correct, attempts)),
  }
}

/**
 * The heatmap body. `attempted` maps the answered chapter ids to their subject (a Bab-linked attempt makes the
 * subject practised); `chapters` are the listable chapters of those subjects. Chapters or subjects the curriculum
 * does not know are skipped; a practised subject with no listable chapter has no block.
 */
export function buildHeatmap(
  rows: readonly ChapterCount[],
  attempted: readonly AttemptedChapterRef[],
  chapters: readonly HeatmapChapterRef[],
  subjects: readonly HeatmapSubjectRef[],
): HeatmapSubject[] {
  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  const countById = new Map<string, ChapterCount>()
  for (const r of rows) if (!countById.has(r.chapterId)) countById.set(r.chapterId, r)
  const practised = new Set<string>()
  for (const c of attempted) {
    const count = countById.get(c.id)
    if (count && count.attempts > 0 && subjectById.has(c.subjectId)) practised.add(c.subjectId)
  }
  const bySubject = new Map<string, HeatmapChapterRef[]>()
  const seen = new Set<string>()
  for (const c of chapters) {
    if (!practised.has(c.subjectId) || seen.has(c.id)) continue
    seen.add(c.id)
    const list = bySubject.get(c.subjectId)
    if (list) list.push(c)
    else bySubject.set(c.subjectId, [c])
  }
  const ordered = [...bySubject.keys()]
    .map((id) => subjectById.get(id) as HeatmapSubjectRef)
    .sort(compareSubjectRefs)
  return ordered.map((ref) => ({
    id: ref.id,
    code: ref.code,
    name: ref.name,
    chapters: (bySubject.get(ref.id) as HeatmapChapterRef[])
      .sort(compareChapterRefs)
      .map((c) => chapterTile(c, countById.get(c.id))),
  }))
}
