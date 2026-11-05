/**
 * Pure rules of the M25 Heatmap Topik Lemah read model (BE-48; reshaped by S10-T05 to API-DSKP-08, FR-MUR-14-1..8).
 * No I/O here: `HeatmapService` feeds these functions with the answer counts and the curriculum.
 *
 * - No minimum number of attempts. A chapter without an attempt is a `belum-cuba` tile.
 * - A subject is listed only when the caller has at least one attempt on a Bab-linked question of it; its block
 *   then lists every chapter the curriculum read gave (active, Tingkatan 1 to 5).
 * - Subjects: Subjek Teras first, then name ascending. Chapters: Bab number ascending.
 * - SP fallback (part 3, FR-MUR-14-3, per subject and Tingkatan): a Tingkatan of a subject that has Bab data lists Bab tiles
 *   only; any other Tingkatan lists SP (Standard Pembelajaran) tiles in the same `chapters[]` with `number: null`. Every
 *   other rule above (no minimum, bands, `belum-cuba`, pooled accuracy) is the same for an SP tile.
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
  /** Tingkatan code `T1`..`T5` (part 3: decides Bab or SP tiles per subject and Tingkatan). Optional for older callers. */
  levelCode?: string
}

/** Attempts and right answers of one question, grouped on the answer rows' `question_id` (input of the SP fallback). */
export interface QuestionCount {
  questionId: string
  attempts: number
  correct: number
}

/** A curriculum SP node as the heatmap needs it (Tingkatan 1 to 5). */
export interface HeatmapSpRef {
  id: string
  subjectId: string
  /** Printed SP code (for example `1.1.3`). */
  code: string
  /** The SP text. */
  title: string
  /** Printed order of the node inside its subject and Tingkatan. */
  sortOrder: number
  levelCode: string
  levelOrder: number
}

/** Input of the SP fallback. */
export interface HeatmapSpInput {
  /** `levelKey(subjectId, levelCode)` of every subject and Tingkatan that has Bab data (those keep Bab tiles). */
  babLevels: ReadonlySet<string>
  /** Candidate SP tiles: the SP tags of approved questions plus those of the answered questions. */
  nodes: readonly HeatmapSpRef[]
  /** The caller's answers per question. */
  questionRows: readonly QuestionCount[]
  /** SP tags per question id. */
  nodesByQuestion: ReadonlyMap<string, readonly HeatmapSpRef[]>
}

/** Key of one subject and Tingkatan. */
export function levelKey(subjectId: string, levelCode: string): string {
  return `${subjectId}:${levelCode}`
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

/** SP tiles by printed order: Tingkatan, then the node's sort position, then code, then numeric id. */
export function compareSpRefs(a: HeatmapSpRef, b: HeatmapSpRef): number {
  return a.levelOrder - b.levelOrder || a.sortOrder - b.sortOrder || compareNames(a.code, b.code) || compareIds(a.id, b.id)
}

/** The tile of one SP: same shape as a Bab tile, `number: null`, name = SP code and text. */
export function spTile(sp: HeatmapSpRef, count: { attempts: number; correct: number } | undefined): HeatmapChapter {
  return chapterTile(
    { id: sp.id, name: sp.code === '' ? sp.title : `${sp.code} ${sp.title}`, subjectId: sp.subjectId, number: null, levelOrder: sp.levelOrder },
    count,
  )
}

/** One SP is one tile across DSKP editions: the key is subject, Tingkatan and printed code. */
export function spKey(sp: HeatmapSpRef): string {
  return `${sp.subjectId}:${sp.levelCode}:${sp.code}`
}

/**
 * Pooled attempts and right answers per SP key (`spKey`): an answered question counts once for each distinct SP it carries,
 * even when it is tagged with the same SP of two editions.
 */
export function spCounts(
  questionRows: readonly QuestionCount[],
  nodesByQuestion: ReadonlyMap<string, readonly HeatmapSpRef[]>,
): Map<string, { attempts: number; correct: number }> {
  const out = new Map<string, { attempts: number; correct: number }>()
  const seen = new Set<string>()
  for (const r of questionRows) {
    if (seen.has(r.questionId)) continue
    seen.add(r.questionId)
    for (const key of new Set((nodesByQuestion.get(r.questionId) ?? []).map(spKey))) {
      const c = out.get(key) ?? { attempts: 0, correct: 0 }
      c.attempts += r.attempts
      c.correct += r.correct
      out.set(key, c)
    }
  }
  return out
}

/**
 * The heatmap body. `attempted` maps the answered chapter ids to their subject (a Bab-linked attempt makes the
 * subject practised); `chapters` are the listable chapters of those subjects. Chapters or subjects the curriculum
 * does not know are skipped; a practised subject with no listable chapter has no block.
 *
 * With `sp` (part 3) the rule is per subject and Tingkatan: a chapter is listed only when its Tingkatan has Bab data
 * (`sp.babLevels`), an SP tile only when it does not; a subject is practised by a Bab-linked attempt in a Bab Tingkatan
 * or an SP-tagged attempt in an SP Tingkatan. Bab tiles come first, then SP tiles. Without `sp` the behaviour is part 1.
 */
export function buildHeatmap(
  rows: readonly ChapterCount[],
  attempted: readonly AttemptedChapterRef[],
  chapters: readonly HeatmapChapterRef[],
  subjects: readonly HeatmapSubjectRef[],
  sp?: HeatmapSpInput,
): HeatmapSubject[] {
  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  const countById = new Map<string, ChapterCount>()
  for (const r of rows) if (!countById.has(r.chapterId)) countById.set(r.chapterId, r)
  const chapterById = new Map(chapters.map((c) => [c.id, c]))
  const isBabLevel = (subjectId: string, levelCode: string): boolean => !sp || sp.babLevels.has(levelKey(subjectId, levelCode))
  const practised = new Set<string>()
  for (const c of attempted) {
    const count = countById.get(c.id)
    if (!count || count.attempts === 0 || !subjectById.has(c.subjectId)) continue
    // A chapter the curriculum read does not list (inactive) keeps the part 1 meaning: it still makes the subject practised.
    const listed = chapterById.get(c.id)
    if (listed && sp && !sp.babLevels.has(levelKey(c.subjectId, listed.levelCode ?? ''))) continue
    practised.add(c.subjectId)
  }
  const spCount = sp ? spCounts(sp.questionRows, sp.nodesByQuestion) : new Map<string, { attempts: number; correct: number }>()
  // Editions: one SP is one tile. The node with the highest numeric id represents it (edition text has no reliable order).
  const spRep = new Map<string, HeatmapSpRef>()
  if (sp) {
    for (const n of sp.nodes) {
      if (!subjectById.has(n.subjectId) || sp.babLevels.has(levelKey(n.subjectId, n.levelCode))) continue
      const key = spKey(n)
      const cur = spRep.get(key)
      if (!cur || compareIds(n.id, cur.id) > 0) spRep.set(key, n)
    }
  }
  const spNodes = [...spRep.values()]
  for (const n of spNodes) if ((spCount.get(spKey(n))?.attempts ?? 0) > 0) practised.add(n.subjectId)
  const bySubject = new Map<string, HeatmapChapterRef[]>()
  const seen = new Set<string>()
  for (const c of chapters) {
    if (!practised.has(c.subjectId) || seen.has(c.id) || !isBabLevel(c.subjectId, c.levelCode ?? '')) continue
    seen.add(c.id)
    const list = bySubject.get(c.subjectId)
    if (list) list.push(c)
    else bySubject.set(c.subjectId, [c])
  }
  const spBySubject = new Map<string, HeatmapSpRef[]>()
  for (const n of spNodes) {
    if (!practised.has(n.subjectId)) continue
    const list = spBySubject.get(n.subjectId)
    if (list) list.push(n)
    else spBySubject.set(n.subjectId, [n])
  }
  const ordered = [...new Set([...bySubject.keys(), ...spBySubject.keys()])]
    .map((id) => subjectById.get(id) as HeatmapSubjectRef)
    .sort(compareSubjectRefs)
  return ordered.map((ref) => ({
    id: ref.id,
    code: ref.code,
    name: ref.name,
    chapters: [
      ...(bySubject.get(ref.id) ?? []).sort(compareChapterRefs).map((c) => chapterTile(c, countById.get(c.id))),
      ...(spBySubject.get(ref.id) ?? []).sort(compareSpRefs).map((n) => spTile(n, spCount.get(spKey(n)))),
    ],
  }))
}
