/**
 * S4 "Tetapan Kuiz" logic (SRS M06 FR-M06-25…31; the live `quizConfig()` script).
 * Difficulty buttons are bound to keys 2–5 of the site-wide 1–5 scale, as live (DV-M06-02 withdrawn).
 */

import type { LatihTubiConfig, TargetType } from '../api'

export type LevelKey = 10 | 11
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

export const LEVEL_OPTIONS: readonly { key: LevelKey; label: string }[] = [
  { key: 10, label: 'Tingkatan 4' },
  { key: 11, label: 'Tingkatan 5' },
]

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
  return config.difficultyByLevel[String(level) as '10' | '11'][k] || 0
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
  questionId: number | null
}

/** The Q2 query string: `count`, `level` (10|11), `difficulty` (2–5), `question_id`. */
export function parseLatihTubiQuery(query: Record<string, unknown>): LatihTubiQuery {
  const level = toInt(query.level)
  const difficulty = toInt(query.difficulty)
  return {
    count: toInt(query.count),
    levelId: level === 10 || level === 11 ? level : null,
    difficulty:
      difficulty !== null && difficulty >= 2 && difficulty <= 5
        ? (difficulty as DifficultyKey)
        : null,
    questionId: toInt(query.question_id),
  }
}
