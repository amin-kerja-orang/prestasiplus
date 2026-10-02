/**
 * Helpers shared by the M05-T1 read handlers (#1–#3, #7–#14): the caller, rounding, the MYT week
 * and month windows, the practice-subject view (BR-01, BR-05), the offered levels (BR-11) and the
 * chapter list with its unlock state (BR-15, BR-16). Nothing here writes.
 */

import type { MockRequest } from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'

import type { PracticeSubject } from '../../api/types'
import { DAY_MS, startOfMytDay } from '../datasets/calendar'
import { chapterStats, type ChapterStats } from '../repository/reads'
import { OFFERED_LEVEL_IDS, UNLOCK_SCORE } from '../repository/rules'

export type SubjectRecord = NonNullable<ReturnType<typeof curriculum.subject>>

export function userIdOf(req: MockRequest): number {
  if (!req.session) throw new Error('requireAuth() must run first')
  return req.session.userId
}

/** Rounds to `digits` decimals (half away from zero for the non-negative values used here). */
export function round(value: number, digits: number): number {
  const f = 10 ** digits
  return Math.round((value + Number.EPSILON) * f) / f
}

/** Percentage `part ÷ whole × 100`, or 0 when `whole` is 0. */
export const pct = (part: number, whole: number): number => (whole === 0 ? 0 : (part / whole) * 100)

// ---------------------------------------------------------------------------------------------
// Time windows (MYT)
// ---------------------------------------------------------------------------------------------

/** Monday 00:00 (MYT) of the week of `ms`, epoch ms (BR-25 week = Monday–Sunday). */
export function weekStartOf(ms: number): number {
  const day = startOfMytDay(ms)
  // `getUTCDay` of the MYT wall clock: 0 = Sunday.
  const dow = new Date(day + 8 * 3_600_000).getUTCDay()
  return day - ((dow + 6) % 7) * DAY_MS
}

/** `[from, to)` of the current calendar month / year in MYT. */
export function monthWindow(ms: number): { from: number; to: number } {
  const d = new Date(ms + 8 * 3_600_000)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  return { from: Date.UTC(y, m, 1) - 8 * 3_600_000, to: Date.UTC(y, m + 1, 1) - 8 * 3_600_000 }
}

export function yearWindow(ms: number): { from: number; to: number } {
  const y = new Date(ms + 8 * 3_600_000).getUTCFullYear()
  return { from: Date.UTC(y, 0, 1) - 8 * 3_600_000, to: Date.UTC(y + 1, 0, 1) - 8 * 3_600_000 }
}

// ---------------------------------------------------------------------------------------------
// Subjects and levels
// ---------------------------------------------------------------------------------------------

/** BR-01: the active M03 subjects in BR-08 order. */
export function practiceSubjects(): SubjectRecord[] {
  return curriculum.subjects({ active: true })
}

/** BR-05: the two counts every subject card carries. */
export function subjectView(s: SubjectRecord): PracticeSubject {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    nameEn: s.nameEn,
    icon: s.icon,
    color: s.color,
    isCore: s.isCore,
    approvedCount: questions.count('Q-ELIGIBLE', s.id),
    bankCount: questions.count('Q-ACTIVE', s.id),
  }
}

/** BR-11: the subject's M03 level links with level id 1–4 (Darjah 1–4), in level order. */
export function offeredLevelIds(s: SubjectRecord): number[] {
  return s.educationLevelIds.filter((l) => (OFFERED_LEVEL_IDS as readonly number[]).includes(l))
}

/** Active subject by code (case-insensitive), or `undefined` (unknown or inactive). */
export function activeSubjectByCode(code: string): SubjectRecord | undefined {
  const s = curriculum.subjectByCode(code)
  return s && s.isActive ? s : undefined
}

// ---------------------------------------------------------------------------------------------
// Chapters (BR-15, BR-16)
// ---------------------------------------------------------------------------------------------

/** BR-15: the active chapters of a pair with ≥ 1 chapter question, in `chapterNumber` order. */
export function practiceChapters(subjectId: number, levelId: number) {
  return curriculum
    .chapters(subjectId, levelId)
    .filter((c) => c.isActive && questions.count('Q-CHAPTER', c.id) > 0)
}

export interface ChapterEntry {
  chapter: ReturnType<typeof practiceChapters>[number]
  stats: ChapterStats
  open: boolean
}

/**
 * The chapters of a pair with the viewer's stats and BR-16 state: chapter 1 is open; chapter k is
 * open ⇔ chapter k − 1 is complete and its score ≥ 70.
 */
export function chapterEntries(userId: number, subjectId: number, levelId: number): ChapterEntry[] {
  const list = practiceChapters(subjectId, levelId)
  const out: ChapterEntry[] = []
  for (const [i, chapter] of list.entries()) {
    const stats = chapterStats(userId, chapter.id)
    const prev = out[i - 1]
    const open =
      i === 0 || (prev !== undefined && prev.stats.complete && prev.stats.scorePct >= UNLOCK_SCORE)
    out.push({ chapter, stats, open })
  }
  return out
}
