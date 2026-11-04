import { Inject, Injectable } from '@nestjs/common'
import {
  ACCOUNT_PROFILE_ACTIVITY_ROLE,
  ACCOUNT_PROFILE_CALENDAR_DAYS,
  ACCOUNT_PROFILE_MODE_LABELS,
  ACCOUNT_PROFILE_RECENT_MAX,
  PRACTICE_MODES,
  type AccountProfileActivity,
} from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import type { AuthContext } from '../../common/scope/auth-context'
import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock } from '../../db/clock'
import { GamificationService } from '../gamification'
import { PracticeRepository } from '../practice'
import { StreakService, WalletService } from '../wallet'

const DAY_MS = 86_400_000
const MYT_OFFSET_MS = 8 * 3_600_000

/** `YYYY-MM-DD` of an instant on the Malaysia calendar. */
const mytDay = (at: number): string => new Date(at + MYT_OFFSET_MS).toISOString().slice(0, 10)
/** The instant a Malaysia day starts. */
const mytDayStart = (day: string): number => Date.parse(`${day}T00:00:00+08:00`)

/** Accuracy on the wire: one decimal, `null` with nothing answered (R1-START-HERE decision 11). */
export const accuracyOne = (correct: number, answered: number): number | null => (answered <= 0 ? null : Math.round((correct / answered) * 1000) / 10)

/**
 * `GET /me/profile-activity` (API-MUR-02): the pupil's own tiles, 30-day calendar, badge collection and newest sessions.
 * Nothing is computed from SQL here: it only assembles the existing reads of M14 (wallet, streak, achievements) and M05
 * (`PracticeRepository`). The caller is always the session user (no user id parameter) and only a `student` role may read it.
 */
@Injectable()
export class ProfileActivityService {
  constructor(
    @Inject(PracticeRepository) private readonly practice: PracticeRepository,
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(StreakService) private readonly streaks: StreakService,
    @Inject(GamificationService) private readonly gamification: GamificationService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async get(auth: AuthContext): Promise<AccountProfileActivity> {
    if (auth.active.role !== ACCOUNT_PROFILE_ACTIVITY_ROLE) throw ApiError.of('FORBIDDEN')
    const userId = auth.userId
    const now = this.clock.now().getTime()
    const today = mytDay(now)
    const firstDay = mytDay(now - (ACCOUNT_PROFILE_CALENDAR_DAYS - 1) * DAY_MS)
    const window = { from: new Date(mytDayStart(firstDay)), to: new Date(mytDayStart(today) + DAY_MS) }

    const [facts, wallet, streak, achievements, recent] = await Promise.all([
      this.practice.profileFacts(userId, window),
      this.wallet.summary(userId),
      this.streaks.get(userId),
      this.gamification.achievements(userId, ''),
      this.practice.history(userId, { modes: PRACTICE_MODES, includeTest: false, take: ACCOUNT_PROFILE_RECENT_MAX }),
    ])

    const perDay = new Map(facts.days.map((d) => [d.day, d]))
    const calendar30d = Array.from({ length: ACCOUNT_PROFILE_CALENDAR_DAYS }, (_, i) => {
      const date = mytDay(mytDayStart(firstDay) + i * DAY_MS)
      const d = perDay.get(date)
      return { date, answered: d?.answered ?? 0, sessions: d?.sessions ?? 0 }
    })

    return {
      tiles: {
        coins: wallet.currentSyiling,
        streakDays: streak.current,
        level: wallet.level,
        practiceDays: facts.practiceDays,
        sessions: facts.sessions,
        accuracy: accuracyOne(facts.correct, facts.answered),
        streakBest: streak.best,
        streakToday: streak.lastActivityDate === today ? streak.current : 0,
      },
      calendar30d,
      badges: achievements.items.map((a) => ({ code: a.id, name: a.name, unlocked: a.unlocked, earnedAt: a.unlockedAt })),
      recentSessions: recent.map((s) => ({
        id: s.id,
        mode: s.mode,
        modeLabel: ACCOUNT_PROFILE_MODE_LABELS[s.mode],
        questions: s.questionCount,
        correct: s.correctCount,
        accuracy: accuracyOne(s.correctCount, s.questionCount),
        coins: s.coinsEarned,
        at: toMytTimestamp(s.completedAt ?? s.startedAt),
      })),
      publicProfilePath: `/pelajar/${userId}`,
    }
  }
}
