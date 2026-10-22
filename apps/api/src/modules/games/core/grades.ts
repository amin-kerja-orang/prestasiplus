import { GAMES_GRADE_LEVELS, type GamesGradeLevel, type GamesMatchMode } from '@pp/contract'

/**
 * Grade helpers. `users.grade` is 1..11 (1 to 6 Darjah 1 to 6, 7 to 11 Tingkatan 1 to 5); the room enum is
 * `DARJAH_n` / `TINGKATAN_n`; the display name is "Darjah n" / "Tingkatan n". Level side: primary (1..6) or secondary.
 */

/** `DARJAH_4` / `TINGKATAN_2` -> 4 / 8; anything else -> null. */
export function gradeOfEnum(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const i = (GAMES_GRADE_LEVELS as readonly string[]).indexOf(value)
  return i < 0 ? null : i + 1
}

/** Grade 1..11 -> `DARJAH_n` / `TINGKATAN_n`; null for no (or an invalid) grade. */
export function enumOfGrade(grade: number | null | undefined): GamesGradeLevel | null {
  if (grade === null || grade === undefined || !Number.isInteger(grade) || grade < 1 || grade > 11) return null
  return GAMES_GRADE_LEVELS[grade - 1] as GamesGradeLevel
}

/** Grade 1..11 -> "Darjah n" / "Tingkatan n"; null for no grade. */
export function gradeName(grade: number | null | undefined): string | null {
  if (grade === null || grade === undefined || !Number.isInteger(grade) || grade < 1 || grade > 11) return null
  return grade <= 6 ? `Darjah ${String(grade)}` : `Tingkatan ${String(grade - 6)}`
}

/** `gradeName` for a player list: "" without a grade (contract `GamesRoomPlayer.grade`). */
export const gradeLabel = (grade: number | null | undefined): string => gradeName(grade) ?? ''

export const isPrimary = (grade: number): boolean => grade <= 6

/** Education-level code of a grade: D1..D6, T1..T5 (league class levels). */
export function levelCodeOfGrade(grade: number): string | null {
  if (!Number.isInteger(grade) || grade < 1 || grade > 11) return null
  return grade <= 6 ? `D${String(grade)}` : `T${String(grade - 6)}`
}

export interface RoomGradeRule {
  gradeLevel: string
  matchMode: GamesMatchMode | string
  gradeMin: number | null
  gradeMax: number | null
}

/**
 * Whether a user's grade fits a room's match mode (BR-M16-18): `same_grade` equal to the room grade level,
 * `same_level` the same primary/secondary side, `custom` inside `gradeMin..gradeMax`. A user without a grade fits.
 */
export function gradeFits(room: RoomGradeRule, grade: number | null): boolean {
  if (grade === null) return true
  const roomGrade = gradeOfEnum(room.gradeLevel)
  if (roomGrade === null) return false
  if (room.matchMode === 'same_grade') return grade === roomGrade
  if (room.matchMode === 'same_level') return isPrimary(grade) === isPrimary(roomGrade)
  return grade >= (room.gradeMin ?? 1) && grade <= (room.gradeMax ?? 11)
}
