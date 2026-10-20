/**
 * Pure rules of the overview reads (SRS M05 BR-02, BR-16, BR-25, M03 BR-19). No database, no clock:
 * the service passes the time in. Values are the mock's (`src/modules/m05-practice/mock/handlers/common.ts`,
 * `src/modules/m03-curriculum/mock/repository/rules.ts`).
 */

const MYT_OFFSET_MS = 8 * 3_600_000
const DAY_MS = 24 * 3_600_000

export type GreetingPeriod = 'Pagi' | 'Tengah Hari' | 'Petang' | 'Malam'

/** BR-02: greeting by the local hour (Asia/Kuala_Lumpur). */
export function greetingPeriod(now: Date): GreetingPeriod {
  const hour = Math.floor((((now.getTime() + MYT_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS / 3_600_000)
  if (hour < 12) return 'Pagi'
  if (hour < 15) return 'Tengah Hari'
  if (hour < 19) return 'Petang'
  return 'Malam'
}

/** Monday 00:00 (MYT) of the week of `at` (BR-25: the week is Monday to Sunday, local time). */
export function weekStartMyt(at: Date): Date {
  const local = at.getTime() + MYT_OFFSET_MS
  const day = Math.floor(local / DAY_MS) * DAY_MS
  const dow = new Date(day).getUTCDay() // 0 = Sunday
  return new Date(day - ((dow + 6) % 7) * DAY_MS - MYT_OFFSET_MS)
}

export const weekEndMyt = (start: Date): Date => new Date(start.getTime() + 7 * DAY_MS)

/** Rounds to `digits` decimals (half away from zero for the non-negative values used here). */
export function round(value: number, digits: number): number {
  const f = 10 ** digits
  return Math.round((value + Number.EPSILON) * f) / f
}

/** Percentage `part / whole * 100`, or 0 when `whole` is 0. */
export const pct = (part: number, whole: number): number => (whole === 0 ? 0 : (part / whole) * 100)

/** BR-19 (M03): progress % = min(100, round(100 x correct / 20)). */
export function topicProgressPercent(correct: number): number {
  return Math.min(100, Math.round((100 * correct) / 20))
}

/** BR-29: the question text of the "latest questions" list is cut at 100 characters. */
export const QUESTION_TEXT_LIMIT = 100
export const cutQuestionText = (text: string): string => (text.length > QUESTION_TEXT_LIMIT ? `${text.slice(0, QUESTION_TEXT_LIMIT)}...` : text)

/** Difficulty level of the wire (1 to 5) from a stored TP (1 to 6; 6 reads as 5). */
export const difficultyLevelOfTp = (tp: number): number => Math.min(5, Math.max(1, tp))

/** The five difficulty levels of the wire. */
export const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5] as const
/** Stored TP values; level 5 is TP 5 plus TP 6. */
export const STORED_TPS = [1, 2, 3, 4, 5, 6] as const

/** Banner audience of the caller role (admin sees every audience, other roles `ALL` plus their own). */
const AUDIENCE_OF_ROLE: Readonly<Record<string, string>> = { student: 'STUDENT', teacher: 'TEACHER' }
export function bannerAudiences(role: string): string[] | null {
  if (role === 'admin') return null
  const own = AUDIENCE_OF_ROLE[role]
  return own ? ['ALL', own] : ['ALL']
}
