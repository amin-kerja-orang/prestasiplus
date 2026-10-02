/**
 * S3 pre-start configuration logic (SRS M05 v1.19 FR-M05-39…47, BR-11, BR-12; the live `subjectConfig()`
 * script). Pure functions over the `SubjectConfig` of #3.
 */

import type { SubjectConfig } from '../../api/types'

export const COUNT_OPTIONS = [5, 10, 15, 20] as const
export const DEFAULT_COUNT = 10

/** Difficulty full names for the summary (FR-M05-42). */
export const DIFFICULTY_NAMES = ['', 'Sangat Mudah', 'Mudah', 'Sederhana', 'Sukar', 'Sangat Sukar']

export interface DifficultyOption {
  value: 1 | 2 | 3 | 4 | 5
  label: string
  /** Full class strings (Tailwind needs them literal): selected, idle hover, tile idle, icon idle, sub idle. */
  selected: string
  hover: string
  tile: string
  icon: string
  sub: string
}

/** FR-M05-40: labels and colours, copied from the live buttons. */
export const DIFFICULTY_OPTIONS: readonly DifficultyOption[] = [
  {
    value: 1,
    label: 'Sgt Mudah',
    selected: 'bg-green-500 text-white ring-2 ring-green-300 shadow-md',
    hover: 'hover:bg-green-50 hover:border-green-200',
    tile: 'bg-green-100',
    icon: 'text-green-600',
    sub: 'text-green-600',
  },
  {
    value: 2,
    label: 'Mudah',
    selected: 'bg-lime-500 text-white ring-2 ring-lime-300 shadow-md',
    hover: 'hover:bg-lime-50 hover:border-lime-200',
    tile: 'bg-lime-100',
    icon: 'text-lime-600',
    sub: 'text-lime-600',
  },
  {
    value: 3,
    label: 'Sederhana',
    selected: 'bg-yellow-500 text-white ring-2 ring-yellow-300 shadow-md',
    hover: 'hover:bg-yellow-50 hover:border-yellow-200',
    tile: 'bg-yellow-100',
    icon: 'text-yellow-600',
    sub: 'text-yellow-600',
  },
  {
    value: 4,
    label: 'Sukar',
    selected: 'bg-orange-500 text-white ring-2 ring-orange-300 shadow-md',
    hover: 'hover:bg-orange-50 hover:border-orange-200',
    tile: 'bg-orange-100',
    icon: 'text-orange-600',
    sub: 'text-orange-600',
  },
  {
    value: 5,
    label: 'Sgt Sukar',
    selected: 'bg-red-500 text-white ring-2 ring-red-300 shadow-md',
    hover: 'hover:bg-red-50 hover:border-red-200',
    tile: 'bg-red-100',
    icon: 'text-red-600',
    sub: 'text-red-600',
  },
]

type DiffKey = '1' | '2' | '3' | '4' | '5'
const key = (d: number): DiffKey => String(d) as DiffKey

/** Count of difficulty `d`: within the level when one is chosen, else over the offered levels. */
export function diffCount(config: SubjectConfig, level: number | null, d: number): number {
  if (level === null) return config.difficultyStats[key(d)] ?? 0
  return config.difficultyByLevel[String(level)]?.[key(d)] ?? 0
}

/** The "Semua"/"Campuran" count: the level total, or the subject total. */
export function currentTotal(config: SubjectConfig, level: number | null): number {
  if (level === null) return config.total
  return config.levels.find((l) => l.id === level)?.count ?? 0
}

/** BR-12: the questions available for the chosen level and difficulty. */
export function availableQuestions(
  config: SubjectConfig,
  level: number | null,
  difficulty: number | null,
): number {
  if (level === null && difficulty === null) return config.total
  if (level !== null && difficulty !== null) return diffCount(config, level, difficulty)
  if (level !== null) return currentTotal(config, level)
  return diffCount(config, null, difficulty ?? 0)
}

/** "Semua Tahap", the level name, or "Tahap {id}" (FR-M05-43). */
export function levelName(config: SubjectConfig, level: number | null): string {
  if (level === null) return 'Semua Tahap'
  return config.levels.find((l) => l.id === level)?.name ?? `Tahap ${String(level)}`
}

/** "Mula Kuiz" href: `level`, `difficulty`, `count` in that order (FR-M05-46). */
export function quizUrl(
  code: string,
  level: number | null,
  difficulty: number | null,
  count: number,
): string {
  const params = new URLSearchParams()
  if (level !== null) params.append('level', String(level))
  if (difficulty !== null) params.append('difficulty', String(difficulty))
  params.append('count', String(count))
  return `/practice/${encodeURIComponent(code)}/quiz?${params.toString()}`
}

export interface QuizQuery {
  levelId: number | null
  difficulty: number | null
  count: number
}

const asInt = (v: unknown): number | null => {
  const raw = Array.isArray(v) ? v[0] : v
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null
  return Number.parseInt(raw, 10)
}

/**
 * Reads the Q1 query (INFERRED, live never opened): `level` a positive integer, `difficulty` 1–5,
 * `count` one of 5/10/15/20 (else the default 10). Anything else is ignored.
 */
export function parseQuizQuery(query: Record<string, unknown>): QuizQuery {
  const level = asInt(query.level)
  const difficulty = asInt(query.difficulty)
  const count = asInt(query.count)
  return {
    levelId: level !== null && level > 0 ? level : null,
    difficulty: difficulty !== null && difficulty >= 1 && difficulty <= 5 ? difficulty : null,
    count:
      count !== null && (COUNT_OPTIONS as readonly number[]).includes(count)
        ? count
        : DEFAULT_COUNT,
  }
}
