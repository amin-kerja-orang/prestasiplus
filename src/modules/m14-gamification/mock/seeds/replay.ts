/**
 * The designed replay (SRS M14 v1.7 §6.11.3): the M05 sessions P1–P4 and M1–M4 run through the
 * runtime engine (`settleSession`) with the seed catalogue, so the designed wallets, ledgers,
 * streaks, challenge completions and achievements are computed, not typed. Pure and deterministic;
 * evaluated once at module load (the ledger and wallet anchors must be literal before compilation).
 */

import { toIsoMyt } from '@/lib/time'

import { SEED_ACHIEVEMENTS, SEED_CHALLENGES, SEED_SETTINGS, SEED_TIERS } from '../data/catalogue'
import { DESIGNED_SESSIONS, DESIGNED_WALLETS } from '../data/designed'
import {
  EMPTY_LIFETIME,
  settleSession,
  type EngineWallet,
  type LifetimeFacts,
} from '../repository/engine'
import { EMPTY_STREAK, PRACTICE_MODES, localDate, type StreakState } from '../repository/rules'
import type { LedgerRow } from '../repository/types'

export interface ReplayResult {
  userId: number
  wallet: EngineWallet
  createdAt: string
  ledger: LedgerRow[]
  streak: StreakState
  completions: { challengeId: number; date: string; completedAt: string }[]
  unlocks: { achievementId: number; unlockedAt: string }[]
  /** The stored result of each designed session (idempotency of onSessionCompleted). */
  sessions: {
    sessionId: string
    completedAt: string
    coinsEarned: number
    pointsEarned: number
    streakCount: number
    totalBalance: number
  }[]
}

const ACTIVE_CHALLENGES = [...SEED_CHALLENGES]
  .filter((c) => c.isActive)
  .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
const FLAT = SEED_SETTINGS.find((s) => s.key === 'flat_quiz_reward')?.value ?? 0

function replayUser(userId: number): ReplayResult {
  const sessions = DESIGNED_SESSIONS.filter((s) => s.userId === userId)
  const designed = DESIGNED_WALLETS[userId]
  if (!designed || sessions.length === 0)
    throw new Error(`M14 replay: no design for ${String(userId)}`)
  let wallet: EngineWallet | null = null
  let streak: StreakState = { ...EMPTY_STREAK }
  const ledger: LedgerRow[] = []
  const completions: ReplayResult['completions'] = []
  const unlocks: ReplayResult['unlocks'] = []
  const credited: ReplayResult['sessions'] = []
  const facts: LifetimeFacts = { ...EMPTY_LIFETIME }
  let nextId = designed.ledgerIdStart
  let createdAt: string | null = null

  for (const [i, session] of sessions.entries()) {
    const date = localDate(session.completedAt)
    const today = sessions.slice(0, i + 1).filter((s) => localDate(s.completedAt) === date)
    const practice = PRACTICE_MODES.includes(session.mode)
    if (practice) {
      facts.practiceSessions++
      if (session.total > 0 && session.correct / session.total >= 0.9) facts.accurateSessions++
      // The designed practice sessions of account 4 are all MATH (M03 subject 3).
      facts.subjects = 1
      facts.mathCorrect += session.correct
    }
    facts.answers += session.total
    facts.answersCorrect += session.correct
    facts.completionsBefore = completions.length

    const result = settleSession(
      {
        userId,
        sessionId: session.sessionId,
        mode: session.mode,
        correct: session.correct,
        total: session.total,
        timeSpent: session.timeSpent,
        completedAt: session.completedAt,
        pointsEarned: session.pointsEarned,
      },
      { wallet, streak },
      { sessions: today, chapterIds: today.flatMap((s) => s.chapterIds) },
      facts,
      {
        tiers: SEED_TIERS,
        challenges: ACTIVE_CHALLENGES,
        achievements: SEED_ACHIEVEMENTS,
        flatQuizReward: FLAT,
        coinsEnabled: true,
        hasTeacherWallet: false,
        spmRowToday: ledger.some((r) => r.source === 'spm' && localDate(r.createdAt) === date),
        teacherSpmRowToday: false,
        completedToday: new Set(
          completions.filter((c) => c.date === date).map((c) => c.challengeId),
        ),
        unlocked: new Set(unlocks.map((u) => u.achievementId)),
      },
    )
    const at = toIsoMyt(session.completedAt)
    if (result.wallet && createdAt === null) createdAt = at
    wallet = result.wallet
    streak = result.streak
    for (const row of result.rows) {
      ledger.push({ id: nextId++, userId, tokens: null, createdAt: at, ...row })
    }
    for (const challengeId of result.completions)
      completions.push({ challengeId, date, completedAt: at })
    for (const achievementId of result.unlocks) unlocks.push({ achievementId, unlockedAt: at })
    credited.push({
      sessionId: session.sessionId,
      completedAt: at,
      coinsEarned: result.coinsEarned,
      pointsEarned: session.pointsEarned,
      streakCount: result.streak.current,
      totalBalance: result.wallet?.currentSyiling ?? 0,
    })
  }
  if (!wallet || createdAt === null) throw new Error(`M14 replay: ${String(userId)} has no wallet`)
  return {
    userId,
    wallet: { ...wallet, level: designed.level },
    createdAt,
    ledger,
    streak,
    completions,
    unlocks,
    sessions: credited,
  }
}

/** Accounts 2 and 4 (§6.11.3). */
export const DESIGNED_REPLAY: readonly ReplayResult[] = Object.freeze(
  [2, 4].map((userId) => replayUser(userId)),
)

export function designedReplay(userId: number): ReplayResult | undefined {
  return DESIGNED_REPLAY.find((r) => r.userId === userId)
}
