/**
 * The M14 session-completion engine (BR-M14-03/04/05/08/12/13/14/16/24), pure: given the user's
 * state and the facts M05 knows about the day and the user's history, it returns every effect of
 * one completion in the order BR-M14-03 fixes (session credit, streak activity, challenge rewards,
 * achievement rewards), with running balances.
 *
 * The runtime `gamification.onSessionCompleted` feeds it from the stores and the M05 reads; the seed
 * feeds it the designed M05 sessions (§6.11.3) to compute the designed wallets, so the seeded
 * figures (370 / 916, 267 / 432) are produced by the same code the runtime runs.
 */

import { M14Error } from './errors'
import {
  PRACTICE_MODES,
  isSpmMode,
  localDate,
  pctText,
  sessionCredit,
  stepStreak,
  teacherMirrorLabel,
  upgradedTier,
  type StreakState,
} from './rules'
import type { Achievement, DailyChallenge, LedgerType, Tier, TierKey } from './types'

export interface EngineWallet {
  currentSyiling: number
  totalSyilingEarned: number
  tokenBalance: number
  xp: number
  level: number
  tierKey: TierKey
}

/** `gamification.onSessionCompleted` input (§7.1). */
export interface SessionCompletedInput {
  userId: number
  sessionId: string
  mode: string
  correct: number
  total: number
  /** Seconds. */
  timeSpent: number
  /** ISO 8601 or epoch ms. */
  completedAt: string | number
  /** XP handed by M05 (BR-09). */
  pointsEarned: number
  /** M05 passes 3 for `mission` sessions (BR-09). */
  coinsPerCorrect?: number
  /**
   * INFERRED extension: correct answers per difficulty level 1–5, used only when no rate is passed
   * and `flat_quiz_reward` is 0 (tier `quiz_reward_l{d}`). Without it every correct answer counts
   * at level 1.
   */
  correctByLevel?: Readonly<Partial<Record<1 | 2 | 3 | 4 | 5, number>>>
}

/** A session of today as BR-M14-12 needs it. */
export interface DaySession {
  sessionId: string
  mode: string
  correct: number
  total: number
  timeSpent: number
}

/** What BR-M14-12 reads for today (the current session included). */
export interface DayFacts {
  sessions: readonly DaySession[]
  /** Distinct M03 chapters of today's answered questions. */
  chapterIds: readonly number[]
}

/** What BR-M14-16 reads (lifetime, the current session included). */
export interface LifetimeFacts {
  /** Completed practice-mode sessions (`random`, `chapter`, `revision`). */
  practiceSessions: number
  /** Practice-mode sessions with accuracy ≥ 90 %. */
  accurateSessions: number
  /** Distinct subjects with practice answers. */
  subjects: number
  mathCorrect: number
  scienceCorrect: number
  /** Answers under 10 s (when recorded). */
  fastAnswers: number
  answers: number
  answersCorrect: number
  mysteryOpenings: number
  rewardedReferrals: number
  /** Challenge completions before this completion. */
  completionsBefore: number
  /** Consecutive days before today whose completions covered every active challenge. */
  perfectDaysBefore: number
}

export const EMPTY_LIFETIME: Readonly<LifetimeFacts> = Object.freeze({
  practiceSessions: 0,
  accurateSessions: 0,
  subjects: 0,
  mathCorrect: 0,
  scienceCorrect: 0,
  fastAnswers: 0,
  answers: 0,
  answersCorrect: 0,
  mysteryOpenings: 0,
  rewardedReferrals: 0,
  completionsBefore: 0,
  perfectDaysBefore: 0,
})

export interface EngineContext {
  tiers: readonly Tier[]
  /** Active challenges in (`sortOrder`, `id`) order. */
  challenges: readonly DailyChallenge[]
  achievements: readonly Achievement[]
  flatQuizReward: number
  /** M02 `coinsEnabled` (false for complimentary students): no syiling, XP still added. */
  coinsEnabled: boolean
  /** Role `teacher` or `admin` (BR-M14-24). */
  hasTeacherWallet: boolean
  /** A `spm` streak-activity row already exists today (first SPM session of the day). */
  spmRowToday: boolean
  /** An "Aktiviti harian: spm" teacher row already exists today. */
  teacherSpmRowToday: boolean
  /** Challenges already completed today. */
  completedToday: ReadonlySet<number>
  /** Achievements already unlocked. */
  unlocked: ReadonlySet<number>
}

export interface EngineRow {
  type: LedgerType
  source: string
  amount: number
  balanceAfter: number
  description: string
  refId: string | null
}

export interface EngineResult {
  /** `null` when nothing was credited and the user had no wallet (no row is created). */
  wallet: EngineWallet | null
  rows: EngineRow[]
  streak: StreakState
  /** Challenge ids completed now, in award order. */
  completions: number[]
  /** Achievement ids unlocked now. */
  unlocks: number[]
  teacherRows: { amount: number; description: string }[]
  /** The session credit (0 when none), returned to M05 as `coinsEarned`. */
  coinsEarned: number
  xpAdded: number
  date: string
}

/** BR-M14-12 metric values for today. */
export function dayMetrics(day: DayFacts, streakCurrent: number): Record<string, number> {
  let correct = 0
  let bestAccuracy = 0
  let bestCorrect = 0
  let seconds = 0
  for (const s of day.sessions) {
    correct += s.correct
    seconds += s.timeSpent
    bestCorrect = Math.max(bestCorrect, s.correct)
    if (s.total > 0) bestAccuracy = Math.max(bestAccuracy, Math.floor((s.correct / s.total) * 100))
  }
  return {
    sessions: day.sessions.length,
    correct,
    bestAccuracy,
    bestCorrectInSession: bestCorrect,
    chapters: new Set(day.chapterIds).size,
    minutes: Math.floor(seconds / 60),
    streak: streakCurrent,
  }
}

/** BR-M14-12: progress = min(target, metric). */
export function challengeProgress(
  challenge: DailyChallenge,
  metrics: Record<string, number>,
): number {
  return Math.min(challenge.targetValue, metrics[challenge.metric] ?? 0)
}

/** BR-M14-03: the session coins. */
export function sessionCoins(input: SessionCompletedInput, ctx: EngineContext, tier: Tier): number {
  if (input.correct <= 0) return 0
  if (input.coinsPerCorrect !== undefined) return input.correct * input.coinsPerCorrect
  if (ctx.flatQuizReward > 0) return input.correct * ctx.flatQuizReward
  if (input.mode === 'pksk') return input.correct * tier.pkskRewardCorrect
  const byLevel = input.correctByLevel
  if (!byLevel) return input.correct * tier.quizRewardL1
  const rate = [
    tier.quizRewardL1,
    tier.quizRewardL2,
    tier.quizRewardL3,
    tier.quizRewardL4,
    tier.quizRewardL5,
  ]
  let coins = 0
  for (let d = 1; d <= 5; d++) {
    coins += (byLevel[d as 1 | 2 | 3 | 4 | 5] ?? 0) * (rate[d - 1] as number)
  }
  return coins
}

function achieved(
  a: Achievement,
  facts: LifetimeFacts,
  live: {
    streak: number
    lifetime: number
    completions: number
    unlocked: number
    perfectDays: number
  },
): boolean {
  const c = a.criterion
  switch (c.kind) {
    case 'practiceSessions':
      return facts.practiceSessions >= c.min
    case 'streak':
      return live.streak >= c.min
    case 'lifetimeSyiling':
      return live.lifetime >= c.min
    case 'accurateSessions':
      return facts.accurateSessions >= c.min
    case 'subjects':
      return facts.subjects >= c.min
    case 'mysteryOpenings':
      return facts.mysteryOpenings >= c.min
    case 'completions':
      return live.completions >= c.min
    case 'mathCorrect':
      return facts.mathCorrect >= c.min
    case 'scienceCorrect':
      return facts.scienceCorrect >= c.min
    case 'fastAnswers':
      return facts.fastAnswers >= c.min
    case 'referrals':
      return facts.rewardedReferrals >= c.min
    case 'unlocked':
      return live.unlocked >= c.min
    case 'answersAccuracy':
      return (
        facts.answers >= c.min &&
        facts.answers > 0 &&
        (facts.answersCorrect / facts.answers) * 100 >= c.accuracy
      )
    case 'perfectDays':
      return live.perfectDays >= c.min
  }
}

const isCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0

/**
 * Input check: `correct`, `total`, `timeSpent`, `pointsEarned` (and a passed `coinsPerCorrect` or
 * per-level count) are finite non-negative integers, `correct ≤ total`, and `completedAt` is a
 * valid date. Otherwise `VALIDATION_ERROR` and nothing is written.
 */
export function validateSessionInput(input: SessionCompletedInput): void {
  const bad = (what: string) =>
    new M14Error(
      'VALIDATION_ERROR',
      `onSessionCompleted: ${what} (session ${String(input.sessionId)})`,
    )
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) throw bad('invalid userId')
  if (typeof input.sessionId !== 'string' || input.sessionId === '')
    throw bad('sessionId is required')
  if (typeof input.mode !== 'string' || input.mode === '') throw bad('mode is required')
  for (const key of ['correct', 'total', 'timeSpent', 'pointsEarned'] as const) {
    if (!isCount(input[key])) throw bad(`${key} must be a non-negative integer`)
  }
  if (input.correct > input.total) throw bad('correct exceeds total')
  if (input.coinsPerCorrect !== undefined && !isCount(input.coinsPerCorrect)) {
    throw bad('coinsPerCorrect must be a non-negative integer')
  }
  if (input.correctByLevel) {
    let sum = 0
    for (const v of Object.values(input.correctByLevel)) {
      if (!isCount(v)) throw bad('correctByLevel values must be non-negative integers')
      sum += v
    }
    if (sum > input.correct) throw bad('correctByLevel exceeds correct')
  }
  try {
    localDate(input.completedAt)
  } catch {
    throw bad('invalid completedAt')
  }
}

/** Applies one session completion (pure). */
export function settleSession(
  input: SessionCompletedInput,
  state: { wallet: EngineWallet | null; streak: StreakState },
  day: DayFacts,
  lifetime: LifetimeFacts,
  ctx: EngineContext,
): EngineResult {
  validateSessionInput(input)
  const date = localDate(input.completedAt)
  const base = state.wallet
  const tier =
    ctx.tiers.find((t) => t.tierName === (base?.tierKey ?? '')) ??
    ctx.tiers.filter((t) => t.isActive).sort((a, b) => a.minSyiling - b.minSyiling)[0]
  if (!tier) throw new Error('M14: no tier is defined')
  const w: EngineWallet = base
    ? { ...base }
    : {
        currentSyiling: 0,
        totalSyilingEarned: 0,
        tokenBalance: 0,
        xp: 0,
        level: 1,
        tierKey: tier.tierName,
      }
  const rows: EngineRow[] = []
  const earn = (source: string, amount: number, description: string, refId: string | null) => {
    if (!ctx.coinsEnabled || amount <= 0) return
    w.currentSyiling += amount
    w.totalSyilingEarned += amount
    rows.push({ type: 'earn', source, amount, balanceAfter: w.currentSyiling, description, refId })
  }
  let xpAdded = Math.max(0, input.pointsEarned)

  // (1) Session credit (BR-M14-03, BR-M14-04).
  const coins = sessionCoins(input, ctx, tier)
  const credit = sessionCredit(input.mode)
  const pct = pctText(input.correct, input.total)
  earn(
    credit.source,
    coins,
    `${credit.prefix}: ${String(input.correct)} betul — ${pct}`,
    input.sessionId,
  )
  const coinsEarned = ctx.coinsEnabled ? coins : 0

  // (2) Streak and its activity row (BR-M14-14).
  const streak = stepStreak(state.streak, date)
  const spm = isSpmMode(input.mode)
  if (spm && !ctx.spmRowToday) earn('spm', 7, 'Streak activity (spm)', null)

  // (3) Challenges (BR-M14-12/13).
  const metrics = dayMetrics(day, streak.current)
  const completions: number[] = []
  for (const ch of ctx.challenges) {
    if (ctx.completedToday.has(ch.id)) continue
    if (challengeProgress(ch, metrics) < ch.targetValue) continue
    completions.push(ch.id)
    earn(
      'daily_challenge',
      ch.rewardSyiling,
      `Cabaran selesai: ${ch.title}`,
      `challenge:${String(ch.id)}`,
    )
    xpAdded += ch.rewardXp
  }

  // (4) Achievements, practice modes only (BR-M14-16).
  const unlocks: number[] = []
  if (PRACTICE_MODES.includes(input.mode)) {
    const doneToday = new Set([...ctx.completedToday, ...completions])
    const perfectToday =
      ctx.challenges.length > 0 && ctx.challenges.every((c) => doneToday.has(c.id))
    let unlockedCount = ctx.unlocked.size
    for (const a of ctx.achievements) {
      if (ctx.unlocked.has(a.id)) continue
      const live = {
        streak: streak.current,
        lifetime: w.totalSyilingEarned,
        completions: lifetime.completionsBefore + completions.length,
        unlocked: unlockedCount,
        perfectDays: perfectToday ? lifetime.perfectDaysBefore + 1 : 0,
      }
      if (!achieved(a, lifetime, live)) continue
      unlocks.push(a.id)
      unlockedCount++
      earn('achievement', a.rewardSyiling, `Pencapaian: ${a.name}`, `achievement:${String(a.id)}`)
      xpAdded += a.rewardXp
    }
  }

  // (5) Teacher mirror (BR-M14-24).
  const teacherRows: { amount: number; description: string }[] = []
  if (ctx.hasTeacherWallet) {
    teacherRows.push({
      amount: Math.max(0, input.correct),
      description: `${teacherMirrorLabel(input.mode)} - ${pct} ketepatan`,
    })
    if (spm && !ctx.teacherSpmRowToday)
      teacherRows.push({ amount: 7, description: 'Aktiviti harian: spm' })
  }

  w.xp += xpAdded
  w.tierKey = upgradedTier(ctx.tiers, w.tierKey, w.currentSyiling)
  const touched = rows.length > 0 || xpAdded > 0
  return {
    wallet: base || touched ? w : null,
    rows,
    streak,
    completions,
    unlocks,
    teacherRows,
    coinsEarned,
    xpAdded,
    date,
  }
}
