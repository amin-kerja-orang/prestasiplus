/**
 * M03 business rules the curriculum store applies (SRS v1.8 §4): BR-08 ordering, BR-16 practice
 * codes, BR-17 grade mapping, BR-19 topic progress formula. Pure functions, no store access.
 */

import type {
  ChapterRow,
  EducationLevelRow,
  GradeCode,
  LegacySubjectCode,
  LegacyTopicRow,
  SubjectRow,
  SubtopicRow,
  TopicRow,
} from './types'

/** Seed rows' `createdAt` / `updatedAt` (capture date; live values were not captured). */
export const SEED_TIMESTAMP = '2026-09-25T00:00:00.000+08:00'

/** BR-16: legacy subject → admin subject code (all OBSERVED). */
export const PRACTICE_CODE: Readonly<Record<LegacySubjectCode, string>> = Object.freeze({
  MATEMATIK: 'MATH',
  BAHASA_MELAYU: 'BM',
  BAHASA_INGGERIS: 'BI',
  SAINS: 'SCI',
  PENDIDIKAN_ISLAM: 'PI',
  PENDIDIKAN_MORAL: 'PM',
  SEJARAH: 'SEJ',
  GEOGRAFI: 'GEO',
})

export const LEGACY_SUBJECT_CODES = Object.freeze(Object.keys(PRACTICE_CODE) as LegacySubjectCode[])

export const GRADE_CODES: readonly GradeCode[] = Object.freeze([
  'DARJAH_1',
  'DARJAH_2',
  'DARJAH_3',
  'DARJAH_4',
  'DARJAH_5',
  'DARJAH_6',
  'TINGKATAN_1',
  'TINGKATAN_2',
  'TINGKATAN_3',
  'TINGKATAN_4',
  'TINGKATAN_5',
])

/** BR-17: grade 1–11 → `DARJAH_n` / `TINGKATAN_{n−6}`; anything else → `null`. */
export function gradeCodeOf(grade: number): GradeCode | null {
  return Number.isInteger(grade) && grade >= 1 && grade <= 11
    ? (GRADE_CODES[grade - 1] as GradeCode)
    : null
}

/** BR-17 / BR-19: `DARJAH_n` → n, `TINGKATAN_n` → n + 6 (the level id of the seeded levels). */
export function gradeOfCode(code: string): number | null {
  const i = GRADE_CODES.indexOf(code as GradeCode)
  return i < 0 ? null : i + 1
}

/** BR-17: grade 1–6 → `Dn`, 7–11 → `T{n−6}` (level `code`). */
export function levelCodeOfGrade(grade: number): string | null {
  if (!Number.isInteger(grade) || grade < 1 || grade > 11) return null
  return grade <= 6 ? `D${String(grade)}` : `T${String(grade - 6)}`
}

/** BR-19: progress % = min(100, round(100 × correct ÷ 20)). */
export function progressPercent(correct: number): number {
  return Math.min(100, Math.round((100 * correct) / 20))
}

// ---------------------------------------------------------------------------------------------
// BR-08 ordering (DV-M03-05)
// ---------------------------------------------------------------------------------------------

/** Subjects and levels: `order`, then id. */
export function byOrderThenId(
  a: Pick<SubjectRow | EducationLevelRow, 'order' | 'id'>,
  b: Pick<SubjectRow | EducationLevelRow, 'order' | 'id'>,
): number {
  return a.order - b.order || a.id - b.id
}

/** Chapters: `chapterNumber` ascending (null last), then `createdSeq`. */
export function chapterOrder(a: ChapterRow, b: ChapterRow): number {
  if (a.chapterNumber !== b.chapterNumber) {
    if (a.chapterNumber === null) return 1
    if (b.chapterNumber === null) return -1
    return a.chapterNumber - b.chapterNumber
  }
  return a.createdSeq - b.createdSeq
}

/**
 * Natural order of topic numbers: split on "."; numeric parts compare as numbers; a non-numeric
 * part sorts after numbers and compares as text; a shorter prefix comes first ("1" < "1.1").
 */
export function compareTopicNumbers(a: string, b: string): number {
  const pa = a.split('.')
  const pb = b.split('.')
  const n = Math.min(pa.length, pb.length)
  for (let i = 0; i < n; i++) {
    const x = (pa[i] as string).trim()
    const y = (pb[i] as string).trim()
    const xn = /^\d+$/.test(x)
    const yn = /^\d+$/.test(y)
    if (xn && yn) {
      const d = Number(x) - Number(y)
      if (d !== 0) return d
    } else if (xn !== yn) {
      return xn ? -1 : 1
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return pa.length - pb.length
}

/** Topics: `topicNumber` in natural order (null last), then `createdSeq`. */
export function topicOrder(a: TopicRow, b: TopicRow): number {
  if (a.topicNumber !== b.topicNumber) {
    if (a.topicNumber === null) return 1
    if (b.topicNumber === null) return -1
    const d = compareTopicNumbers(a.topicNumber, b.topicNumber)
    if (d !== 0) return d
  }
  return a.createdSeq - b.createdSeq
}

/** Subtopics: `createdSeq`. */
export function subtopicOrder(a: SubtopicRow, b: SubtopicRow): number {
  return a.createdSeq - b.createdSeq
}

/** Legacy topics: `sequence`, then id (OBSERVED). */
export function legacyTopicOrder(a: LegacyTopicRow, b: LegacyTopicRow): number {
  return a.sequence - b.sequence || a.id - b.id
}
