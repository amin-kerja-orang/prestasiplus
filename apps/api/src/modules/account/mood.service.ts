import { Inject, Injectable } from '@nestjs/common'
import {
  ACCOUNT_MOOD_ALREADY_CHECKED_IN,
  ACCOUNT_MOOD_MESSAGES,
  AccountMoodRequestSchema,
  type AccountMood,
  type AccountMoodCheckin,
  type AccountMoodToday,
} from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import type { AuthContext } from '../../common/scope/auth-context'
import { CLOCK, type Clock, mytDay } from '../../db/clock'
import { idFromString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { fieldsOf, invalid } from './account.errors'

/**
 * The pupil's daily mood check-in (S5-T04, API-MUR-11, DM-84, FR-MUR-2-12). One row per pupil per Malaysia day, written once and never
 * updated: a second submit on the same day is a 409 ALREADY_CHECKED_IN and the stored row stays as it was. The role (student only) is
 * enforced by `@Roles('student')` on the controller. `reason` is never written in R1. While an admin is in Mod Pelajar the row is stamped
 * `is_test`, which the Command Center reads leave out.
 */
@Injectable()
export class MoodService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Today's stored choice, or null. */
  async today(auth: AuthContext): Promise<AccountMoodToday> {
    const rows = await this.prisma.client.$queryRaw<{ mood: AccountMood }[]>`
      SELECT mood FROM mood_checkins WHERE user_id = ${idFromString(auth.userId)}::bigint AND checked_on = ${mytDay(this.clock.now())}::date LIMIT 1`
    return { mood: rows[0]?.mood ?? null }
  }

  /** Records the first check-in of the day; the unique (user_id, checked_on) decides a race, so no row is ever overwritten. */
  async checkIn(auth: AuthContext, raw: unknown): Promise<AccountMoodCheckin> {
    const parsed = AccountMoodRequestSchema.safeParse(raw)
    if (!parsed.success) throw invalid(fieldsOf(parsed.error))
    const checkedOn = mytDay(this.clock.now())
    const inserted = await this.prisma.client.$queryRaw<{ id: bigint }[]>`
      INSERT INTO mood_checkins (user_id, mood, checked_on, is_test)
      VALUES (${idFromString(auth.userId)}::bigint, ${parsed.data.mood}, ${checkedOn}::date, ${auth.mode !== null})
      ON CONFLICT (user_id, checked_on) DO NOTHING
      RETURNING id`
    if (inserted.length === 0) {
      throw new ApiError({ code: ACCOUNT_MOOD_ALREADY_CHECKED_IN, status: 409, message: ACCOUNT_MOOD_MESSAGES.alreadyCheckedIn })
    }
    return { mood: parsed.data.mood, checkedOn }
  }
}
