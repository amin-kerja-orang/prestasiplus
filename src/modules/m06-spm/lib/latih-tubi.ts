/**
 * S4 "Tetapan Kuiz" logic (SRS M06 FR-M06-25…31; the live `quizConfig()` script).
 * Difficulty buttons are bound to keys 2–5 of the site-wide 1–5 scale, as live (DV-M06-02 withdrawn).
 */

import { isHttpMode } from '@/api/mode'

import type { EducationLevel, LatihTubiConfig, TargetType, WireId } from '../api'
import { queryId } from './wire-id'

/** A level id: 10 or 11 in the mock, the `education_levels` id string on the real API (BE-41). */
export type LevelKey = WireId
export type DifficultyKey = 2 | 3 | 4 | 5

export interface DifficultyOption {
  key: DifficultyKey
  label: string
  /** Nuxt UI colour of the selected state (success / info / warning / error). */
  color: 'success' | 'info' | 'warning' | 'error'
}

export const DIFFICULTY_OPTIONS: readonly DifficultyOption[] = [
  { key: 2, label: 'Asas', color: 'success' },
  { key: 3, label: 'Pertengahan', color: 'info' },
  { key: 4, label: 'Sukar', color: 'warning' },
  { key: 5, label: 'Sangat Sukar', color: 'error' },
]

export interface LevelOption {
  key: LevelKey
  label: string
}

const LEVEL_LABELS = ['Tingkatan 4', 'Tingkatan 5'] as const

export const LEVEL_OPTIONS: readonly LevelOption[] = [
  { key: 10, label: LEVEL_LABELS[0] },
  { key: 11, label: LEVEL_LABELS[1] },
]

/** Orders decimal id strings by value (ids are bigint identities; never `Number()`). */
const byIdValue = (a: string, b: string): number =>
  a.length !== b.length ? a.length - b.length : a < b ? -1 : a > b ? 1 : 0

/** SPM grade of the curriculum level -> button label (grade 10 = Tingkatan 4, 11 = Tingkatan 5). */
const GRADE_LABELS: Record<number, string> = { 10: LEVEL_LABELS[0], 11: LEVEL_LABELS[1] }

/**
 * The Tingkatan buttons of S4. Mock: `LEVEL_OPTIONS`. Real API: the keys of `levelCounts` (the
 * Tingkatan 4 and 5 level ids, BE-41 open question 7), labelled from the level's `grade` in
 * `GET /api/education-levels` (`levels`), in grade order. Without that lookup the labels fall back to
 * id order, but only when exactly two keys came back (a JSON object cannot keep the server order of
 * integer-like keys); any other key count is ambiguous and yields no options (the page then shows
 * its load-error state).
 */
export function levelOptions(
  config: Pick<LatihTubiConfig, 'levelCounts'>,
  levels: readonly EducationLevel[] | null = null,
): readonly LevelOption[] {
  if (!isHttpMode()) return LEVEL_OPTIONS
  const keys = Object.keys(config.levelCounts)
  if (levels) {
    const graded = keys
      .map((key) => {
        const grade = levels.find((l) => String(l.id) === key)?.grade
        return { key, grade, label: grade == null ? undefined : GRADE_LABELS[grade] }
      })
      .filter((o): o is { key: string; grade: number; label: string } => o.label !== undefined)
      .sort((a, b) => a.grade - b.grade)
    if (graded.length > 0) return graded.map(({ key, label }) => ({ key, label }))
  }
  if (keys.length !== LEVEL_LABELS.length) return []
  return keys.sort(byIdValue).map((key, i) => ({ key, label: LEVEL_LABELS[i]! }))
}

const TARGET_NAMES: Record<TargetType, string> = {
  spm: 'SPM',
  custom: 'Custom',
  latihan: 'Latihan',
}

/** "SPM" | "Custom" | "Latihan". */
export const targetName = (type: TargetType): string => TARGET_NAMES[type]

/** `getDiffCount(k)`: the level's count when a level is selected, else the subject's (0 when absent). */
export function diffCount(
  config: LatihTubiConfig,
  level: LevelKey | null,
  key: DifficultyKey,
): number {
  const k = String(key) as '2' | '3' | '4' | '5'
  if (level === null) return config.difficultyStats[k] || 0
  return config.difficultyByLevel[String(level)]?.[k] || 0
}

/** `quizUrl()`: updated on every change. */
export function quizHref(
  code: string,
  count: number,
  level: LevelKey | null,
  difficulty: DifficultyKey | null,
): string {
  let url = `/spm/latih-tubi/${encodeURIComponent(code)}/quiz?count=${String(count)}`
  if (level !== null) url += `&level=${String(level)}`
  if (difficulty !== null) url += `&difficulty=${String(difficulty)}`
  return url
}

const toInt = (v: unknown): number | null => {
  const raw = Array.isArray(v) ? v[0] : v
  if (typeof raw !== 'string' || !/^\d{1,9}$/.test(raw)) return null
  return Number.parseInt(raw, 10)
}

export interface LatihTubiQuery {
  /** `null` when absent or not a number (the server then rules, M05 #4). */
  count: number | null
  levelId: LevelKey | null
  difficulty: DifficultyKey | null
  questionId: WireId | null
}

/** `level`: 10 or 11 in the mock; on the real API any level id string (the server rules, M05 #4). */
function parseLevel(v: unknown): LevelKey | null {
  if (isHttpMode()) return queryId(v)
  const level = toInt(v)
  return level === 10 || level === 11 ? level : null
}

/** The Q2 query string: `count`, `level` (a level id), `difficulty` (2–5), `question_id`. */
export function parseLatihTubiQuery(query: Record<string, unknown>): LatihTubiQuery {
  const difficulty = toInt(query.difficulty)
  return {
    count: toInt(query.count),
    levelId: parseLevel(query.level),
    difficulty:
      difficulty !== null && difficulty >= 2 && difficulty <= 5
        ? (difficulty as DifficultyKey)
        : null,
    questionId: queryId(query.question_id),
  }
}
