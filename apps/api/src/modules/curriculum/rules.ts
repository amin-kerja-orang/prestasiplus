/**
 * M03 business rules as pure functions (SRS BR-08 ordering, BR-13 grade codes, BR-14 island states,
 * BR-16 practice codes, BR-17 grade mapping and the derived subject-level pivot). No database, no
 * clock: the repository and services call these, and the unit tests cover them directly.
 */
import type { CurriculumLearningMap } from '@pp/contract'

import type { GradeCode, LegacySubjectCode, TopicState } from './types'

// --- Codes (BR-13, BR-16, BR-17) -----------------------------------------------------------------

/** BR-16: learner subject code to the admin subject practice code. */
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

export const LEGACY_SUBJECT_CODES = Object.freeze(
  Object.keys(PRACTICE_CODE) as LegacySubjectCode[],
)

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

/** BR-17: `DARJAH_n` is grade n, `TINGKATAN_n` is grade n + 6; anything else is null. */
export function gradeOfCode(code: string): number | null {
  const i = GRADE_CODES.indexOf(code as GradeCode)
  return i < 0 ? null : i + 1
}

/** Code with "_" replaced by a space (S12, S13). */
export const subjectLabelOf = (code: string): string => code.replaceAll('_', ' ')

// --- Ordering (BR-08) ----------------------------------------------------------------------------

/** Subjects and levels: `sortOrder`, then id. */
export function byOrderThenId<T extends { sortOrder: number; id: bigint }>(a: T, b: T): number {
  return a.sortOrder - b.sortOrder || compareIds(a.id, b.id)
}

export function compareIds(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Chapters: `chapterNumber` ascending (null last), then id (creation order). */
export function chapterOrder<T extends { chapterNumber: number | null; id: bigint }>(a: T, b: T): number {
  if (a.chapterNumber !== b.chapterNumber) {
    if (a.chapterNumber === null) return 1
    if (b.chapterNumber === null) return -1
    return a.chapterNumber - b.chapterNumber
  }
  return compareIds(a.id, b.id)
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
      const dx = BigInt(x) - BigInt(y)
      if (dx !== 0n) return dx < 0n ? -1 : 1
    } else if (xn !== yn) {
      return xn ? -1 : 1
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return pa.length - pb.length
}

/** Topics: `topicNumber` in natural order (null last), then id. */
export function topicOrder<T extends { topicNumber: string | null; id: bigint }>(a: T, b: T): number {
  if (a.topicNumber !== b.topicNumber) {
    if (a.topicNumber === null) return 1
    if (b.topicNumber === null) return -1
    const d = compareTopicNumbers(a.topicNumber, b.topicNumber)
    if (d !== 0) return d
  }
  return compareIds(a.id, b.id)
}

// --- Derived subject-level pivot (data migration 4.2, plan 14.7 T-09) -------------------------------

export interface PivotSource {
  subjectId: bigint
  educationLevelId: bigint | null
  inTree?: boolean
}

/**
 * `subject_levels` has no .cloud source. Rule: the distinct (subject, level) pairs of the chapters
 * that belong to the tree (a chapter without a level cannot form a pair). The seed and the ETL
 * (BE-28) add these pairs next to the links an admin ticks on the subject form; a pair derived from
 * a chapter always exists in the pivot, so a subject never has chapters at a level it is not linked
 * to. Returned in first-seen order.
 */
export function deriveSubjectLevelPairs(chapters: readonly PivotSource[]): [bigint, bigint][] {
  const seen = new Set<string>()
  const out: [bigint, bigint][] = []
  for (const c of chapters) {
    if (c.inTree === false || c.educationLevelId === null) continue
    const key = `${c.subjectId}:${c.educationLevelId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push([c.subjectId, c.educationLevelId])
  }
  return out
}

// --- Peta Belajar (BR-14, BR-15) -----------------------------------------------------------------

/** S14 subject pills (Geografi is not rendered, DV-M03-08). Colours observed (SRS 6.8). */
export const MAP_SUBJECTS: readonly CurriculumLearningMap['subjects'][number][] = Object.freeze([
  { code: 'MATEMATIK', label: 'Matematik', emoji: '🔢', color: '#3B82F6' },
  { code: 'BAHASA_MELAYU', label: 'Bahasa Melayu', emoji: '📝', color: '#10B981' },
  { code: 'BAHASA_INGGERIS', label: 'Bahasa Inggeris', emoji: '🇬🇧', color: '#8B5CF6' },
  { code: 'SAINS', label: 'Sains', emoji: '🔬', color: '#F59E0B' },
  { code: 'PENDIDIKAN_ISLAM', label: 'Pend. Islam', emoji: '☪️', color: '#14B8A6' },
  { code: 'PENDIDIKAN_MORAL', label: 'Pend. Moral', emoji: '🤝', color: '#F97316' },
  { code: 'SEJARAH', label: 'Sejarah', emoji: '🏛️', color: '#EF4444' },
])

export const MAP_GRADES = Object.freeze(['DARJAH_1', 'DARJAH_2', 'DARJAH_3', 'DARJAH_4'] as const)
export const DEFAULT_MAP_SUBJECT = 'MATEMATIK'
export const DEFAULT_MAP_GRADE = 'DARJAH_4'

/** BR-14: `mastered` from this progress percentage (inferred threshold). */
export const MASTERED_FROM = 80
/** BR-14: the first two topics are open with no history. */
export const OPEN_FROM_START = 2

/** BR-15: the pill label, or the code title-cased ("Geografi"). */
export function mapSubjectLabel(code: string): string {
  const pill = MAP_SUBJECTS.find((s) => s.code === code)
  if (pill) return pill.label
  const text = subjectLabelOf(code)
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

/** What the answer log says about one learner topic (BR-19); all zero means no history. */
export interface TopicProgress {
  sessions: number
  questionsAnswered: number
  /** 0 to 100. */
  progress: number
}

export const NO_PROGRESS: TopicProgress = Object.freeze({ sessions: 0, questionsAnswered: 0, progress: 0 })

/** BR-14: the island state of every topic, in `sequence` order (input order). */
export function islandStates(progress: readonly TopicProgress[]): TopicState[] {
  const states: TopicState[] = []
  progress.forEach((p, i) => {
    const prev = states[i - 1]
    let state: TopicState
    if (p.progress >= MASTERED_FROM) state = 'mastered'
    else if (p.sessions >= 1 || p.questionsAnswered >= 1) state = 'started'
    else if (i < OPEN_FROM_START || prev === 'started' || prev === 'mastered') state = 'unlocked'
    else state = 'locked'
    states.push(state)
  })
  return states
}
