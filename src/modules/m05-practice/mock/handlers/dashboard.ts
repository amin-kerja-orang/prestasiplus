/**
 * SRS M05 v1.17 §7 #1 `GET /api/dashboard` (S1). Any session (A): every role may open it.
 *
 * One read model assembled from the owners, at call time (nothing is stored here):
 * - M14 `wallet.summary`, `streak.get`, `challenges.today`, `learnerBadges.forUser` (BR-08, BR-10,
 *   BR-25, FR-M05-149);
 * - M09 `banners.activeFor(user)` and `articles.latest(5)` (XL2-30);
 * - M01 `users.trial` (BR-07);
 * - M04 named queries for every question count (BR-05, FR-M05-128);
 * - M05 `practice.history` / `practice.answers` / `practice.queue` (BR-25 week figures, BR-14 badge).
 */

import { ok, requireAuth, route, type RouteDef } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { articles, banners } from '@/modules/m09-content/mock'
import { challenges, learnerBadges, streak, wallet } from '@/modules/m14-gamification/mock'

import type { Dashboard, DashboardSubjectStat, GreetingPeriod } from '../../api/types'
import { DAY_MS } from '../datasets/calendar'
import { practiceRepo } from '../repository/practice'
import { userQueue } from '../repository/reads'
import { round, practiceSubjects, subjectView, userIdOf, weekStartOf, pct } from './common'

/** BR-02: greeting by the local hour (Asia/Kuala_Lumpur). */
export function greetingPeriod(now: number): GreetingPeriod {
  const hour = Math.floor(((((now + 8 * 3_600_000) % DAY_MS) + DAY_MS) % DAY_MS) / 3_600_000)
  if (hour < 12) return 'Pagi'
  if (hour < 15) return 'Tengah Hari'
  if (hour < 19) return 'Petang'
  return 'Malam'
}

const QUESTION_LIMIT = 100
const cut = (text: string) =>
  text.length > QUESTION_LIMIT ? `${text.slice(0, QUESTION_LIMIT)}...` : text

/**
 * BR-29: mean `difficultyLevel` of each subject's active questions, 2 decimals (0 when none).
 * One pass: Q-DIFFICULTY(d) grouped by subject for d = 1…5 (5 facet aggregates, not one count per
 * subject × difficulty). PKSK rows have no subject, so they never enter a subject's mean.
 */
function averageDifficulties(): Map<number, number> {
  const acc = new Map<number, { n: number; sum: number }>()
  for (const d of [1, 2, 3, 4, 5]) {
    for (const [subjectId, count] of questions.groupCount('Q-DIFFICULTY', 'subjectId', d)) {
      if (subjectId === null) continue
      const a = acc.get(subjectId) ?? { n: 0, sum: 0 }
      a.n += count
      a.sum += count * d
      acc.set(subjectId, a)
    }
  }
  return new Map([...acc].map(([id, a]) => [id, round(a.sum / a.n, 2)]))
}

function dashboard(userId: number, now: number): Dashboard {
  const user = users.get(userId)
  const subjects = practiceSubjects()
  const levels = curriculum.levels({ active: true })

  // BR-25: week = Monday–Sunday (local); accuracy = correct ÷ answered this week, an integer.
  const from = weekStartOf(now)
  const window = { from, to: from + 7 * DAY_MS }
  const weekAnswers = practiceRepo.answers(userId, window)
  const weekCorrect = weekAnswers.filter((a) => a.isCorrect).length

  const summary = wallet.summary(userId)
  const streakView = streak.get(userId)
  const today = challenges.today(userId)
  const activeQ = questions.count('Q-ACTIVE')
  const eligibleQ = questions.count('Q-ELIGIBLE')
  const pkskQ = questions.count('Q-PKSK')

  const subjectViews = subjects.map(subjectView)
  const avgDifficulty = averageDifficulties()
  const subjectStats: DashboardSubjectStat[] = subjectViews
    .map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      color: s.color,
      bankCount: s.bankCount,
      avgDifficulty: avgDifficulty.get(s.id) ?? 0,
      usedCount: practiceRepo.subjectUsage(s.id),
    }))
    // FR-M05-28: by `bankCount` descending, ties by id.
    .sort((a, b) => b.bankCount - a.bankCount || a.id - b.id)

  return {
    user: { id: userId, name: user?.name ?? '', role: user?.role ?? '' },
    greetingPeriod: greetingPeriod(now),
    trial: users.trial(userId, now),
    streak: { count: streakView.current, practisedToday: streakView.practisedToday },
    wallet: {
      coins: summary.currentSyiling,
      points: summary.xp,
      level: summary.level,
      levelProgressPct: summary.levelProgressPct,
    },
    week: {
      sessions: practiceRepo.history(userId, window).length,
      accuracyPct: Math.round(pct(weekCorrect, weekAnswers.length)),
    },
    banners: banners
      .activeFor({ role: user?.role ?? '' })
      .map((b) => ({ type: b.type, title: b.title, body: b.description })),
    quests: today.items.map((c) => ({
      key: String(c.id),
      emoji: c.icon,
      title: c.title,
      difficulty: c.difficulty,
      description: c.description,
      target: c.target,
      reward: c.rewardSyiling,
      progress: c.progress,
      completed: c.completed,
    })),
    questsCompleted: today.completed,
    badges: learnerBadges.forUser(userId).map((b) => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      rarityLabel: b.rarityLabel,
      awardedAt: b.awardedAt,
    })),
    revisionTotal: userQueue(userId).length,
    articles: articles.latest(5).map((a) => ({
      slug: a.slug,
      title: a.title,
      category: a.categoryLabel,
      publishedAt: a.publishedAt,
    })),
    subjects: subjectViews,
    stats: {
      // BR-05: Q-ACTIVE + Q-PKSK and Q-ELIGIBLE + Q-PKSK.
      totalQuestions: activeQ + pkskQ,
      activeSubjects: subjects.length,
      activeLevels: levels.length,
      approvedQuestions: eligibleQ + pkskQ,
    },
    levelPills: levels.map((l) => ({
      code: l.code,
      name: l.name,
      stage: l.stage,
      count: questions.count('Q-ACTIVE', undefined, l.id),
    })),
    // BR-29: the 5 newest approved objective questions, text cut at 100 characters.
    recentQuestions: questions
      .adminList({ status: 'approved', page: 1, pageSize: 5 })
      .rows.map((q) => ({
        id: q.id,
        subjectName:
          (q.subjectId !== null ? curriculum.subject(q.subjectId)?.name : undefined) ?? '',
        difficulty: q.difficultyLevel,
        text: cut(q.questionText),
        createdAt: q.createdAt,
        levelCode:
          (q.educationLevelId !== null ? curriculum.level(q.educationLevelId)?.code : undefined) ??
          '',
      })),
    // FR-M05-27: Q-DIFFICULTY(1..5); Σ = Total Soalan.
    difficultyChart: [1, 2, 3, 4, 5].map((level) => ({
      level,
      count: questions.count('Q-DIFFICULTY', level),
    })),
    subjectStats,
  }
}

export const dashboardRoutes: RouteDef[] = [
  route('GET', '/api/dashboard', [requireAuth()], (req, ctx) =>
    ok(dashboard(userIdOf(req), ctx.clock.now())),
  ),
]
