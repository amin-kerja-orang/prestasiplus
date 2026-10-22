import type {
  CommandCenterGuruDrillGpsRowSchema,
  CommandCenterGuruDrillKirkRowSchema,
  CommandCenterHeadcountDetail,
  CommandCenterHeadcountRow,
  CommandCenterMood,
  CommandCenterMoodCounts,
  CommandCenterMoodDot,
} from '@pp/contract'
import type { z } from 'zod'

/**
 * Read ports for data that other cards own and that is not on this branch yet. Each has a fail-closed default adapter (empty,
 * zero or null), so every route answers a valid contract shape without the owner. The owner card (or a follow-up here) binds a
 * real adapter in `CommandCenterModule` with `{ provide: X_PORT, useClass: ... }`; nothing else changes. All are READ ONLY and
 * every adapter must exclude `is_test` rows. `studentIds` are decimal-string user ids; an empty list means "nobody", never "all".
 */

// --- Mood check-ins (OQ-24: no `mood_checkins` table exists) ---------------------------------------------------------------

export interface MoodWindow {
  from: Date
  to: Date
}

export interface MoodReadPort {
  /** Check-ins per mood over the window (no window = all time) for the given students (`null` = every student, platform view). */
  counts(studentIds: string[] | null, window?: MoodWindow): Promise<CommandCenterMoodCounts>
  /** The latest mood per student (students without a check-in are absent). */
  latest(studentIds: string[]): Promise<Map<string, CommandCenterMood>>
  /** One student's check-ins in the window, oldest first. */
  trend(studentId: string, window: MoodWindow): Promise<CommandCenterMoodDot[]>
  /** Guru drill "mood": one row per check-in of the students (any order). */
  rows(studentIds: string[]): Promise<{ studentId: string; mood: CommandCenterMood; date: string; reason: string | null }[]>
}
export const MOOD_PORT = Symbol('COMMAND_CENTER_MOOD_PORT')
export class NoMood implements MoodReadPort {
  async counts(): Promise<CommandCenterMoodCounts> {
    return { happy: 0, okay: 0, sad: 0, stressed: 0 }
  }
  async latest(): Promise<Map<string, CommandCenterMood>> {
    return new Map()
  }
  async trend(): Promise<CommandCenterMoodDot[]> {
    return []
  }
  async rows(): Promise<{ studentId: string; mood: CommandCenterMood; date: string; reason: string | null }[]> {
    return []
  }
}

// --- Kirkpatrick T1 feedback (BE-20, no `feedback` table yet) ----------------------------------------------------------------

export type KirkRow = z.infer<typeof CommandCenterGuruDrillKirkRowSchema>

export interface FeedbackReadPort {
  /** Mean reaction score and number of responses for the students (`null` = every student). `value` is on `scale` (5). */
  t1(studentIds: string[] | null): Promise<{ value: number; scale: 5; count: number }>
  /** Guru drill "kirk t1" rows. */
  rows(studentIds: string[]): Promise<KirkRow[]>
}
export const FEEDBACK_PORT = Symbol('COMMAND_CENTER_FEEDBACK_PORT')
export class NoFeedback implements FeedbackReadPort {
  async t1(): Promise<{ value: number; scale: 5; count: number }> {
    return { value: 0, scale: 5, count: 0 }
  }
  async rows(): Promise<KirkRow[]> {
    return []
  }
}

// --- Headcount, GPS (BE-19 headcount tables are not merged) ------------------------------------------------------------------

export type GpsRow = z.infer<typeof CommandCenterGuruDrillGpsRowSchema>

export interface HeadcountReadPort {
  /** Mean subject GPS (3 dp) of the students' graded headcount entries; null when none (guru live-data `gpsOverall`). */
  gpsOverall(studentIds: string[]): Promise<number | null>
  /** Mean subject GPS of one school's SPM history of the year (board `gpsOverall`, `kirk.t4Gps`); 0 when none. */
  schoolGps(schoolId: string | null): Promise<number>
  /** Guru drill "gps" rows. */
  gpsRows(studentIds: string[]): Promise<GpsRow[]>
  /** A student's headcount rows (student page). */
  ofStudent(studentId: string): Promise<CommandCenterHeadcountRow[]>
  /** Detail of one config with its owning class id (scope is checked by the caller via the class); null = unknown config. */
  config(configId: string): Promise<{ classId: string; detail: CommandCenterHeadcountDetail } | null>
}
export const HEADCOUNT_PORT = Symbol('COMMAND_CENTER_HEADCOUNT_PORT')
export class NoHeadcount implements HeadcountReadPort {
  async gpsOverall(): Promise<number | null> {
    return null
  }
  async schoolGps(): Promise<number> {
    return 0
  }
  async gpsRows(): Promise<GpsRow[]> {
    return []
  }
  async ofStudent(): Promise<CommandCenterHeadcountRow[]> {
    return []
  }
  async config(): Promise<null> {
    return null
  }
}

// --- Learner badges (BE-23, PR #52 not merged) ------------------------------------------------------------------------------

export interface BadgeCatalogueRow {
  id: string
  name: string
  icon: string
}
export interface BadgeAward {
  userId: string
  badgeId: string
  awardedAt: Date
}

export interface BadgeReadPort {
  /** The whole learner-badge catalogue. */
  catalogue(): Promise<BadgeCatalogueRow[]>
  /** Awards held by the students, optionally of one badge and/or inside a window; ordered by `awardedAt` then badge id. */
  awards(studentIds: string[] | null, opts?: { badgeId?: string; from?: Date; to?: Date }): Promise<BadgeAward[]>
}
export const BADGE_READ_PORT = Symbol('COMMAND_CENTER_BADGE_READ_PORT')
/** Empty catalogue: every badge id is unknown (404 "Lencana tidak dijumpai."), every panel is empty. */
export class NoBadges implements BadgeReadPort {
  async catalogue(): Promise<BadgeCatalogueRow[]> {
    return []
  }
  async awards(): Promise<BadgeAward[]> {
    return []
  }
}

// --- Question sets created (BE-18) ------------------------------------------------------------------------------------------

export interface QuizSetReadPort {
  /** Question sets created in the window by the users of the school (`null` = platform). */
  createdCount(schoolId: string | null, window: { from: Date; to: Date }): Promise<number>
}
export const QUIZ_SET_PORT = Symbol('COMMAND_CENTER_QUIZ_SET_PORT')
export class NoQuizSets implements QuizSetReadPort {
  async createdCount(): Promise<number> {
    return 0
  }
}
