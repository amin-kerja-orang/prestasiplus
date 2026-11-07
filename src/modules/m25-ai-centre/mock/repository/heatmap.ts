/**
 * M25 heatmap read model (S10-T05, API-DSKP-08; FR-MUR-14-1..8). No storage: every call recomputes from M05
 * `practice.answers(userId)` and M03. Same rules as the BE (`heatmap.rules.ts`), so mock and http mode agree:
 * - no minimum number of attempts;
 * - a subject is listed when the viewer has at least one Bab-linked attempt on it (Q-4), and then lists every
 *   active in-tree chapter of Tingkatan 1 to 5 (T1-T5, never a Darjah); a chapter without an attempt is a
 *   grey `belum-cuba` tile;
 * - inactive subjects are dropped;
 * - bands on the whole percent: red below 50, amber 50-79, green from 80;
 * - subjects Subjek Teras first, then name; chapters by Bab number (none last), then Tingkatan, then id.
 */

import { curriculum } from '@/modules/m03-curriculum/mock'
import { practice } from '@/modules/m05-practice/mock'

import { bandOf, percentOf } from '../../api/settings'
import type { HeatmapChapter, HeatmapSubject } from '../../api/types'

export interface HeatmapRow {
  chapterId: number
  attempts: number
  correct: number
}

/** Q-M25-HM-ROWS: the viewer's answers with a chapter link, grouped by chapter id; first-seen order. */
function rowsFor(userId: number): HeatmapRow[] {
  const byChapter = new Map<number, HeatmapRow>()
  for (const a of practice.answers(userId)) {
    if (a.chapterId === null) continue
    let row = byChapter.get(a.chapterId)
    if (!row) {
      row = { chapterId: a.chapterId, attempts: 0, correct: 0 }
      byChapter.set(a.chapterId, row)
    }
    row.attempts += 1
    if (a.isCorrect) row.correct += 1
  }
  return [...byChapter.values()]
}

const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

function tile(
  id: number,
  number: number | null,
  name: string,
  count: HeatmapRow | undefined,
): HeatmapChapter {
  const attempts = count?.attempts ?? 0
  const correct = count?.correct ?? 0
  return {
    id: String(id),
    number,
    name,
    attempts,
    correct,
    // One decimal, half up, in integers (60 section 4.6).
    accuracy: attempts <= 0 ? null : Math.floor((2000 * correct + attempts) / (2 * attempts)) / 10,
    state: attempts === 0 ? 'belum-cuba' : bandOf(percentOf(correct, attempts)),
  }
}

function subjectsFor(userId: number): HeatmapSubject[] {
  const rows = rowsFor(userId)
  const countById = new Map(rows.map((r) => [r.chapterId, r]))
  const practised = new Set<number>()
  for (const c of curriculum.chaptersByIds(rows.map((r) => r.chapterId))) practised.add(c.subjectId)
  const forms = curriculum.levels({ active: true }).filter((l) => /^T[1-5]$/.test(l.code))
  const out: HeatmapSubject[] = []
  for (const subjectId of practised) {
    const subject = curriculum.subject(subjectId)
    if (!subject?.isActive) continue
    const refs = forms.flatMap((level) =>
      curriculum
        .chapters(subjectId, level.id)
        .filter((c) => c.isActive && c.name !== null)
        .map((c) => ({ c, levelOrder: level.order })),
    )
    if (refs.length === 0) continue
    refs.sort((a, b) => {
      const x = a.c.chapterNumber
      const y = b.c.chapterNumber
      if (x !== y) return x === null ? 1 : y === null ? -1 : x - y
      return a.levelOrder - b.levelOrder || a.c.id - b.c.id
    })
    out.push({
      id: String(subjectId),
      code: subject.code,
      name: subject.name,
      chapters: refs.map(({ c }) =>
        tile(c.id, c.chapterNumber, c.name as string, countById.get(c.id)),
      ),
    })
  }
  const core = new Map(out.map((s) => [s.id, curriculum.subject(Number(s.id))?.isCore === true]))
  return out.sort(
    (a, b) =>
      Number(core.get(b.id)) - Number(core.get(a.id)) ||
      byName(a.name, b.name) ||
      Number(a.id) - Number(b.id),
  )
}

export const heatmap = {
  /** API #1 body `subjects`. */
  forUser(userId: number): HeatmapSubject[] {
    return subjectsFor(userId)
  },
  /** Q-M25-HM-ROWS (tests only). */
  rowsForUser(userId: number): HeatmapRow[] {
    return rowsFor(userId)
  },
}
