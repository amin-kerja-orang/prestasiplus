/**
 * The M01 auth handlers' reads and hand-offs into other modules, in one place (D12: only through
 * `@/modules/<slug>/mock`). Every function is used at request time, never at import time, so the
 * import cycles between the mock entries (M01 → M02/M03/M04/M14 → M01) stay harmless.
 */

import {
  ACCOUNT_PROFILE_CALENDAR_DAYS,
  ACCOUNT_PROFILE_MODE_LABELS,
  ACCOUNT_PROFILE_RECENT_MAX,
  type AccountProfileActivity,
} from '@pp/contract'

import { formatDateKey } from '@/lib/time'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { gamification, learnerBadges, referrals, streak, wallet } from '@/modules/m14-gamification/mock'
import { practice } from '@/modules/m05-practice/mock'
import { schools } from '@/modules/m02-users-schools/mock'

import type { PlatformStats } from '../../api/types'

/** M02 `schools.get`: does school `id` exist (BR-04 / BR-14 "must exist")? */
export function schoolExists(id: number): boolean {
  return schools.get(id) !== undefined
}

/**
 * DATA-M01-07 / FR-M01-11 / BR-21: derived per request, never stored (DV-05, D11).
 * `questionCount` = the M04 named query Q-ELIGIBLE (status approved ∧ active, 128,989),
 * `subjectCount` / `levelCount` = the active M03 subjects (31) and education levels (11), the
 * same sets as `/api/subjects` and `/api/education-levels`.
 */
export function platformStats(): PlatformStats {
  return {
    questionCount: questions.count('Q-ELIGIBLE'),
    subjectCount: curriculum.subjects({ active: true }).length,
    levelCount: curriculum.levels({ active: true }).length,
  }
}

/**
 * FR-M01-69 / BR-26: M14 `gamification.onLogin(userId, at)` after every successful **password**
 * login (login, register, token reset / IC reset auto-login), once, with the time written to
 * `lastLoginAt`. A failure inside the hook never blocks the login.
 */
export function notifyLogin(userId: number, at: number): void {
  try {
    gamification.onLogin(userId, at)
  } catch {
    // FR-M01-69: the login goes on.
  }
}

/**
 * FR-M01-70 (provisional): M14 `referrals.onRegistered(newUserId, code)` after the user is
 * created. An unknown code is ignored by M14; a failure never blocks the registration.
 */
export function notifyRegistered(newUserId: number, referralCode: string | null): void {
  try {
    referrals.onRegistered(newUserId, referralCode)
  } catch {
    // FR-M01-70: the registration goes on.
  }
}

const DAY_MS = 86_400_000
const round1 = (correct: number, answered: number): number | null =>
  answered <= 0 ? null : Math.round((correct / answered) * 1000) / 10

/**
 * API-MUR-02 (S5-T05): `GET /api/me/profile-activity` of the mock, from the same stores as the other
 * pupil reads (M05 sessions, M14 wallet, streak and badges). The mock keeps no badge catalogue with an
 * unlocked flag, so every learner badge is listed and the held ones are unlocked.
 */
export function profileActivityOf(userId: number, nowMs: number): AccountProfileActivity {
  const sessions = practice.history(userId, {})
  const today = formatDateKey(nowMs)
  const days = Array.from({ length: ACCOUNT_PROFILE_CALENDAR_DAYS }, (_, i) =>
    formatDateKey(nowMs - (ACCOUNT_PROFILE_CALENDAR_DAYS - 1 - i) * DAY_MS),
  )
  const calendar30d = days.map((date) => {
    const of = sessions.filter((s) => s.completedAt !== null && formatDateKey(s.completedAt) === date)
    return { date, answered: of.reduce((n, s) => n + s.questionCount, 0), sessions: of.length }
  })
  const answered = sessions.reduce((n, s) => n + s.questionCount, 0)
  const correct = sessions.reduce((n, s) => n + s.correctCount, 0)
  const held = new Map(learnerBadges.forUser(userId).map((b) => [b.id, b.awardedAt]))
  const streakView = streak.get(userId)
  return {
    tiles: {
      coins: wallet.summary(userId).currentSyiling,
      streakDays: streakView.current,
      level: wallet.summary(userId).level,
      practiceDays: new Set(sessions.map((s) => formatDateKey(s.completedAt ?? ''))).size,
      sessions: sessions.length,
      accuracy: round1(correct, answered),
      streakBest: streakView.best,
      streakToday: streakView.lastActivityDate === today ? streakView.current : 0,
    },
    calendar30d,
    badges: learnerBadges.catalogue().map((b) => ({
      code: String(b.id),
      name: b.name,
      unlocked: held.has(b.id),
      earnedAt: held.get(b.id) ?? null,
    })),
    recentSessions: sessions.slice(0, ACCOUNT_PROFILE_RECENT_MAX).map((s) => ({
      id: s.id,
      mode: s.mode,
      modeLabel: ACCOUNT_PROFILE_MODE_LABELS[s.mode],
      questions: s.questionCount,
      correct: s.correctCount,
      accuracy: round1(s.correctCount, s.questionCount),
      coins: s.coinsEarned,
      at: s.completedAt ?? s.startedAt,
    })),
    publicProfilePath: `/pelajar/${userId}`,
  }
}
