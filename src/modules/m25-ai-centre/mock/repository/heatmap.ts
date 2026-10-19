/**
 * M25 heatmap read model (SRS M25 v1.2 §6.4; build-plan M25-T1). No storage: every call recomputes
 * from M05 `practice.answers(userId)` and M03 (FR-M25-29).
 *
 * Q-M25-HM-ROWS(userId): the viewer's answers with a chapter link, grouped by chapter id (never by
 * name). Q-M25-HM-CELLS: the rows with `answered >= K-M25-01`, name and subject from M03, percent and
 * band per BR-M25-03, order per BR-M25-04 (subjects by M03 order; cells by accuracy ascending, then
 * topic name, then chapter id). Q-M25-HM-HIDDEN: the viewer's answers that appear in no cell.
 */

import { curriculum } from '@/modules/m03-curriculum/mock'
import { practice } from '@/modules/m05-practice/mock'

import { HEATMAP_MIN_ATTEMPTS, bandOf, percentOf } from '../../api/settings'
import type { HeatmapSubject, HeatmapTopic } from '../../api/types'

export interface HeatmapRow {
  chapterId: number
  attempts: number
  correct: number
}

export interface HiddenTotals {
  answers: number
  correct: number
}

/** Q-M25-HM-ROWS: first-seen order of the chapter ids. */
function rowsFor(userId: number): { rows: HeatmapRow[]; total: HiddenTotals } {
  const byChapter = new Map<number, HeatmapRow>()
  const total: HiddenTotals = { answers: 0, correct: 0 }
  for (const a of practice.answers(userId)) {
    total.answers += 1
    if (a.isCorrect) total.correct += 1
    if (a.chapterId === null) continue
    let row = byChapter.get(a.chapterId)
    if (!row) {
      row = { chapterId: a.chapterId, attempts: 0, correct: 0 }
      byChapter.set(a.chapterId, row)
    }
    row.attempts += 1
    if (a.isCorrect) row.correct += 1
  }
  return { rows: [...byChapter.values()], total }
}

function cellsFor(userId: number): { subjects: HeatmapSubject[]; total: HiddenTotals } {
  const { rows, total } = rowsFor(userId)
  const shown = rows.filter((r) => r.attempts >= HEATMAP_MIN_ATTEMPTS)
  const chapters = new Map(
    curriculum.chaptersByIds(shown.map((r) => r.chapterId)).map((c) => [c.id, c]),
  )
  const bySubject = new Map<number, HeatmapTopic[]>()
  for (const r of shown) {
    const chapter = chapters.get(r.chapterId)
    if (!chapter) continue
    const percent = percentOf(r.correct, r.attempts)
    const topic: HeatmapTopic = {
      chapterId: r.chapterId,
      name: chapter.name,
      attempts: r.attempts,
      correct: r.correct,
      percent,
      band: bandOf(percent),
    }
    const list = bySubject.get(chapter.subjectId)
    if (list) list.push(topic)
    else bySubject.set(chapter.subjectId, [topic])
  }
  const subjects: HeatmapSubject[] = []
  for (const [subjectId, topics] of bySubject) {
    const subject = curriculum.subject(subjectId)
    if (!subject) continue
    topics.sort(
      (a, b) =>
        a.correct * b.attempts - b.correct * a.attempts ||
        (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
        a.chapterId - b.chapterId,
    )
    subjects.push({ subjectId, name: subject.name, topics })
  }
  subjects.sort(
    (a, b) =>
      (curriculum.subject(a.subjectId)?.order ?? 0) -
        (curriculum.subject(b.subjectId)?.order ?? 0) || a.subjectId - b.subjectId,
  )
  return { subjects, total }
}

export const heatmap = {
  /** Q-M25-HM-CELLS grouped by subject (API #1 body `subjects`). */
  forUser(userId: number): HeatmapSubject[] {
    return cellsFor(userId).subjects
  },
  /** Q-M25-HM-HIDDEN (tests only): answers and correct answers of the viewer that appear in no cell. */
  hiddenForUser(userId: number): HiddenTotals {
    const { subjects, total } = cellsFor(userId)
    let answers = total.answers
    let correct = total.correct
    for (const s of subjects) {
      for (const t of s.topics) {
        answers -= t.attempts
        correct -= t.correct
      }
    }
    return { answers, correct }
  },
  /** Q-M25-HM-ROWS (tests only). */
  rowsForUser(userId: number): HeatmapRow[] {
    return rowsFor(userId).rows
  },
}
