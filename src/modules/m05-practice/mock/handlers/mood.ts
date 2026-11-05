/**
 * S5-T04 API-MUR-11 `POST /api/me/mood` and `GET /api/me/mood/today` (R1-MUR-2, FR-MUR-2-12, DM-84).
 * Mock parity with `apps/api/src/modules/account/mood.controller.ts`: student only (403 otherwise); one check-in per pupil
 * per Malaysia calendar day; the first answers `200 {mood, checkedOn}`, a second the same day answers
 * `409 ALREADY_CHECKED_IN` "Anda sudah merekodkan perasaan hari ini." and the stored row is unchanged; a value outside the four
 * is `422 VALIDATION_ERROR` on `mood`.
 */

import { conflict, defineTable, ok, opaque, requireRole, route, validationError, type RouteDef } from '@/mock/define'

import type { MoodValue } from '../../api/types'
import { userIdOf } from './common'

export const MOOD_VALUES: readonly MoodValue[] = ['gembira', 'okay', 'sedih', 'tertekan']
/** The 409 text and code (60 API-MUR-11, 10 AC-MUR-2-10). */
export const MOOD_ALREADY_CHECKED_IN = 'Anda sudah merekodkan perasaan hari ini.'
export const MOOD_INVALID = 'The selected mood is invalid.'

export interface MoodCheckinRow {
  /** `userId:YYYY-MM-DD` (the unique key of DM-84). */
  id: string
  userId: number
  mood: MoodValue
  checkedOn: string
}

/** `practice.moodCheckins`: a small table of the M05 plugin, so `mock.reset()` clears it with the rest. */
export const moodCheckinsTable = defineTable<MoodCheckinRow>({
  name: 'practice.moodCheckins',
  ids: opaque('k_', 'practice:mood-checkins', 12),
  indexes: ['userId'],
})

const MYT_MS = 8 * 3_600_000
/** `YYYY-MM-DD` of the Malaysia day holding `at` (a fixed UTC+8). */
const mytDay = (at: number): string => new Date(at + MYT_MS).toISOString().slice(0, 10)

export const moodRoutes: RouteDef[] = [
  route('GET', '/api/me/mood/today', [requireRole('student')], (req, ctx) => {
    const row = moodCheckinsTable.get(`${String(userIdOf(req))}:${mytDay(ctx.clock.now())}`)
    return ok({ mood: row?.mood ?? null })
  }),

  route('POST', '/api/me/mood', [requireRole('student')], (req, ctx) => {
    const body = typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {}
    const mood = body.mood
    if (typeof mood !== 'string' || !MOOD_VALUES.includes(mood as MoodValue)) {
      return validationError({ mood: MOOD_INVALID })
    }
    const userId = userIdOf(req)
    const checkedOn = mytDay(ctx.clock.now())
    const id = `${String(userId)}:${checkedOn}`
    if (moodCheckinsTable.get(id)) return conflict(MOOD_ALREADY_CHECKED_IN, 'ALREADY_CHECKED_IN')
    moodCheckinsTable.insert({ id, userId, mood: mood as MoodValue, checkedOn })
    return ok({ mood, checkedOn })
  }),
]
