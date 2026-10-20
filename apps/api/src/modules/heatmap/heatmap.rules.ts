/**
 * Pure rules of the M25 Heatmap Topik Lemah read model (BE-48; SRS M25 BR-M25-02 to BR-M25-04,
 * FR-M25-27/28). The mock (`src/modules/m25-ai-centre/mock/repository/heatmap.ts`) is the spec: the same
 * filter, percent, band and ordering, with decimal-string ids (UD-1) compared as bigints.
 * No I/O here: `HeatmapService` feeds these functions with the answer counts and the curriculum.
 */
import {
  HEATMAP_MIN_ATTEMPTS,
  type HeatmapSubject,
  type HeatmapTopic,
  heatmapBand,
  heatmapPercent,
} from '@pp/contract'

/** Attempts and right answers of one chapter, grouped on the answer rows' `chapter_id` (never by name). */
export interface ChapterCount {
  chapterId: string
  attempts: number
  correct: number
}

/** A curriculum chapter as the heatmap needs it (BE-08 `chaptersByIds`). */
export interface HeatmapChapterRef {
  id: string
  name: string
  subjectId: string
}

/** A curriculum subject as the heatmap needs it (BE-08 `subjects`). */
export interface HeatmapSubjectRef {
  id: string
  name: string
  sortOrder: number
}

/** Numeric order of two decimal-string bigint ids (`9` before `10`, never string order). */
export function compareIds(a: string, b: string): number {
  const x = BigInt(a)
  const y = BigInt(b)
  return x < y ? -1 : x > y ? 1 : 0
}

/** Code-unit comparison, as the mock (`a.name < b.name`); NOT ms-MY collation (card open question 2). */
export function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * BR-M25-04 order of the cells inside a subject: raw accuracy ascending with exact integers
 * (`correct_a x attempts_b` vs `correct_b x attempts_a`, never the rounded percent), then name, then id.
 */
export function compareTopics(a: HeatmapTopic, b: HeatmapTopic): number {
  const left = BigInt(a.correct) * BigInt(b.attempts)
  const right = BigInt(b.correct) * BigInt(a.attempts)
  if (left !== right) return left < right ? -1 : 1
  return compareNames(a.name, b.name) || compareIds(a.chapterId, b.chapterId)
}

/** True when the chapter is shown (K-M25-01: at least `HEATMAP_MIN_ATTEMPTS` answers). */
export const isShown = (row: ChapterCount): boolean => row.attempts >= HEATMAP_MIN_ATTEMPTS

/**
 * Q-M25-HM-CELLS grouped by subject. Rows below the minimum are dropped; a shown chapter whose chapter or
 * subject is not in the curriculum is skipped (rule 5); a subject with no shown chapter has no block
 * (rule 7). Subjects follow the curriculum order (`sort_order`), then the numeric subject id.
 */
export function buildHeatmap(
  rows: readonly ChapterCount[],
  chapters: readonly HeatmapChapterRef[],
  subjects: readonly HeatmapSubjectRef[],
): HeatmapSubject[] {
  const chapterById = new Map(chapters.map((c) => [c.id, c]))
  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  const bySubject = new Map<string, HeatmapTopic[]>()
  const seen = new Set<string>()
  for (const r of rows) {
    if (!isShown(r) || seen.has(r.chapterId)) continue
    seen.add(r.chapterId)
    const chapter = chapterById.get(r.chapterId)
    if (!chapter || !subjectById.has(chapter.subjectId)) continue
    const percent = heatmapPercent(r.correct, r.attempts)
    const topic: HeatmapTopic = {
      chapterId: r.chapterId,
      name: chapter.name,
      attempts: r.attempts,
      correct: r.correct,
      percent,
      band: heatmapBand(percent),
    }
    const list = bySubject.get(chapter.subjectId)
    if (list) list.push(topic)
    else bySubject.set(chapter.subjectId, [topic])
  }
  const out: { ref: HeatmapSubjectRef; block: HeatmapSubject }[] = []
  for (const [subjectId, topics] of bySubject) {
    const ref = subjectById.get(subjectId) as HeatmapSubjectRef
    out.push({ ref, block: { subjectId, name: ref.name, topics: topics.sort(compareTopics) } })
  }
  out.sort((a, b) => a.ref.sortOrder - b.ref.sortOrder || compareIds(a.ref.id, b.ref.id))
  return out.map((o) => o.block)
}
