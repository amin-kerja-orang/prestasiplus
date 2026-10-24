/**
 * `gamification` (events), `streak`, `challenges`, `achievements` and `tiers` repositories
 * (SRS M14 v1.7 §7.1; BR-M14-03/04/05/08/12/13/14/15/16/21/24).
 *
 * `gamification.onSessionCompleted` runs in one transaction (joining M05's BR-31 transaction) and
 * reads M05 at call time (`./reads.ts`): today's sessions and answers for the challenge metrics,
 * the lifetime practice sessions and mastery for the achievement criteria. The current session is
 * merged by id, so the rules hold before F-26 exists (the M05 reads are then empty).
 */

import { dayRange, formatDateKey } from '@/lib/time'
import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'

import { DEFAULT_METRIC_BY_TYPE, RARITY_COLORS, RARITY_LABELS } from '../data/catalogue'
import {
  achievementsTable,
  challengesTable,
  completionsTable,
  dailyLoginMarksTable,
  referralsTable,
  sessionCreditsTable,
  streaksTable,
  tiersTable,
  userAchievementsTable,
} from '../tables/tables'
import {
  challengeProgress,
  dayMetrics,
  settleSession,
  type DaySession,
  type LifetimeFacts,
  type SessionCompletedInput,
  validateSessionInput,
} from './engine'
import {
  M14Error,
  activeChallenges,
  addCompletion,
  addLedgerRow,
  addXpOp,
  allTiers,
  bindTx,
  completionsOn,
  creditSyilingOp,
  ensurePrimed,
  hasSourceRowOn,
  hasTeacherRowOn,
  isoAt,
  nowMs,
  saveStreak,
  saveWallet,
  settingValue,
  streakState,
  teacherCreditOp,
  tierByKey,
  tx,
  walletRow,
  walletState,
} from './ops'
import { coinsEnabled, hasTeacherRole, mysteryOpenings, practiceReads, userOf } from './reads'
import { PRACTICE_MODES, STREAK_MULTIPLIER, localDate, previousDate, stepStreak } from './rules'
import type {
  Achievement,
  ChallengeType,
  DailyChallenge,
  Difficulty,
  Rarity,
  SessionCredit,
  StreakRow,
  Tier,
} from './types'
import { bindSessionHook } from './wallet'

const SUBJECT_MATH = 3
const SUBJECT_SCIENCE = 4

// --- facts -------------------------------------------------------------------------------------

function dayFacts(
  userId: number,
  date: string,
  current?: DaySession & { chapterIds?: readonly number[] },
) {
  const reads = practiceReads()
  const sessions: DaySession[] = reads
    .sessionsOn(userId, date)
    .filter((s) => !current || s.id !== current.sessionId)
    .map((s) => ({
      sessionId: s.id,
      mode: s.mode,
      correct: s.correct,
      total: s.total,
      timeSpent: s.timeSpent,
    }))
  if (current) sessions.push(current)
  const chapterIds = reads
    .answersOn(userId, date)
    .map((a) => a.chapterId)
    .filter((c): c is number => c !== null)
  return { sessions, chapterIds }
}

/** Consecutive days before `date` whose completions covered every active challenge. */
function perfectDaysBefore(
  userId: number,
  date: string,
  active: readonly DailyChallenge[],
): number {
  if (active.length === 0) return 0
  const byDate = new Map<string, Set<number>>()
  for (const c of completionsTable.query({ where: { userId } }).rows) {
    const set = byDate.get(c.date) ?? new Set<number>()
    set.add(c.challengeId)
    byDate.set(c.date, set)
  }
  let n = 0
  for (let d = previousDate(date); ; d = previousDate(d)) {
    const set = byDate.get(d)
    if (!set || !active.every((c) => set.has(c.id))) return n
    n++
  }
}

function lifetimeFacts(
  userId: number,
  input: SessionCompletedInput,
  date: string,
  active: readonly DailyChallenge[],
): LifetimeFacts {
  const reads = practiceReads()
  const practice = reads.practiceSessions(userId).filter((s) => s.id !== input.sessionId)
  const current = PRACTICE_MODES.includes(input.mode)
    ? [{ correct: input.correct, total: input.total }]
    : []
  const all = [...practice.map((s) => ({ correct: s.correct, total: s.total })), ...current]
  const mastery = reads.mastery(userId)
  const answered = mastery.reduce((a, m) => a + m.answered, 0)
  const correct = mastery.reduce((a, m) => a + m.correct, 0)
  return {
    practiceSessions: all.length,
    accurateSessions: all.filter((s) => s.total > 0 && s.correct / s.total >= 0.9).length,
    subjects: mastery.filter((m) => m.answered > 0).length,
    mathCorrect: mastery.find((m) => m.subjectId === SUBJECT_MATH)?.correct ?? 0,
    scienceCorrect: mastery.find((m) => m.subjectId === SUBJECT_SCIENCE)?.correct ?? 0,
    // Answer times per answer are not read yet (BR-M14-16 "when recorded"): 0 (INFERRED).
    fastAnswers: 0,
    answers: answered,
    answersCorrect: correct,
    mysteryOpenings: mysteryOpenings(userId),
    rewardedReferrals: referralsTable.count({ referrerId: userId, rewarded: true }),
    completionsBefore: completionsTable.count({ userId }),
    perfectDaysBefore: perfectDaysBefore(userId, date, active),
  }
}

function catalogue(): Achievement[] {
  return achievementsTable.query({ sort: 'id' }).rows
}

function unlockedSet(userId: number): Set<number> {
  return new Set(
    userAchievementsTable.query({ where: { userId } }).rows.map((u) => u.achievementId),
  )
}

export interface SessionCompletedResult {
  coinsEarned: number
  pointsEarned: number
  streakCount: number
  totalBalance: number
}

function storedResult(sessionId: string): SessionCompletedResult | null {
  const row = sessionCreditsTable.query({ where: { sessionId } }).rows[0]
  return row
    ? {
        coinsEarned: row.coinsEarned,
        pointsEarned: row.pointsEarned,
        streakCount: row.streakCount,
        totalBalance: row.totalBalance,
      }
    : null
}

/**
 * M05 BR-31 step 6. Idempotent per `sessionId`: a session already credited returns its stored
 * result and writes nothing (a retried or duplicated submit never pays twice).
 */
function onSessionCompleted(input: SessionCompletedInput): SessionCompletedResult {
  validateSessionInput(input)
  const stored = storedResult(input.sessionId)
  if (stored) return stored
  ensurePrimed()
  const { userId } = input
  const at = input.completedAt
  const date = localDate(at)
  const active = activeChallenges()
  return tx(() => {
    const result = settleSession(
      input,
      { wallet: walletRow(userId) ? walletState(userId) : null, streak: streakState(userId) },
      dayFacts(userId, date, {
        sessionId: input.sessionId,
        mode: input.mode,
        correct: input.correct,
        total: input.total,
        timeSpent: input.timeSpent,
      }),
      lifetimeFacts(userId, input, date, active),
      {
        tiers: allTiers(),
        challenges: active,
        achievements: catalogue(),
        flatQuizReward: settingValue('flat_quiz_reward'),
        coinsEnabled: coinsEnabled(userId),
        hasTeacherWallet: hasTeacherRole(userId),
        spmRowToday: hasSourceRowOn(userId, 'spm', date),
        teacherSpmRowToday: hasTeacherRowOn(userId, 'Aktiviti harian: spm', date),
        completedToday: completionsOn(userId, date),
        unlocked: unlockedSet(userId),
      },
    )
    if (result.wallet) saveWallet(userId, result.wallet, at)
    for (const row of result.rows) addLedgerRow(userId, row, at)
    saveStreak(userId, result.streak)
    for (const id of result.completions) addCompletion(userId, id, at)
    for (const achievementId of result.unlocks) {
      userAchievementsTable.insert({ userId, achievementId, unlockedAt: isoAt(at) })
    }
    for (const t of result.teacherRows) teacherCreditOp(userId, t.amount, t.description, at)
    const out: SessionCompletedResult = {
      coinsEarned: result.coinsEarned,
      pointsEarned: input.pointsEarned,
      streakCount: result.streak.current,
      totalBalance: result.wallet?.currentSyiling ?? walletState(userId).currentSyiling,
    }
    sessionCreditsTable.insert({
      userId,
      sessionId: input.sessionId,
      completedAt: isoAt(at),
      ...out,
    })
    return out
  })
}

/** BR-M14-21 wording by game and event (observed rows; PROPOSED for the rest). */
function gameRow(
  game: string,
  event: string,
  p: { correct?: number; total?: number; detail?: Record<string, unknown> },
): { source: string; description: string } {
  const d = p.detail ?? {}
  const n = (v: unknown, f = 0) => (typeof v === 'number' ? v : f)
  const correct = String(p.correct ?? 0)
  switch (game) {
    case 'papan_bijak':
      return event === 'win'
        ? { source: 'papan_bijak_win', description: 'Menang Papan Bijak! 🏆🎲' }
        : { source: 'papan_bijak', description: 'Jawab betul dalam Papan Bijak 🎲' }
    case 'benteng':
    case 'benteng_ilmu':
      if (event === 'win') return { source: 'benteng_win', description: 'Juara Benteng Ilmu!' }
      if (event === 'forfeit_win')
        return { source: 'benteng_win', description: 'Menang Benteng Ilmu (lawan menyerah)' }
      return { source: 'benteng_play', description: 'Penyertaan Benteng Ilmu' }
    case 'perang_fakta':
      return { source: 'perang_fakta_win', description: 'Menang Perang Fakta (lawan menyerah)' }
    case 'mathrace':
      return {
        source: 'mathrace_play',
        description: `#${String(n(d.rank, 1))} Perlumbaan Matematik`,
      }
    case 'jutawan':
    case 'jutawan_ilmu':
      return {
        source: 'jutawan_ilmu',
        description: `Jutawan Ilmu (${typeof d.subject === 'string' ? d.subject : 'Bahasa Melayu'}): Tahap ${String(n(d.level, 1))}`,
      }
    case 'cabaran_kilat':
      return {
        source: 'cabaran_kilat',
        description: `Cabaran Kilat: ${correct} betul, combo ${String(n(d.maxCombo, 1))}x`,
      }
    case 'betul_salah':
      return {
        source: 'betul_salah',
        description: `Betul/Salah: ${correct} betul, streak ${String(n(d.maxStreak, 1))}`,
      }
    default:
      return { source: game, description: `${game}: ${correct} betul` }
  }
}

function canEarnSyiling(userId: number): boolean {
  return settingValue('games_award_syiling') === 1 && coinsEnabled(userId)
}

export const gamificationRepo = defineRepository({
  owner: 'M14',
  name: 'gamification',
  store: completionsTable,
  stores: {
    userAchievements: userAchievementsTable,
    dailyLoginMarks: dailyLoginMarksTable,
    sessionCredits: sessionCreditsTable,
  },
  methods: ({ transaction }) => {
    bindTx(transaction)
    const api = {
      /** M05 BR-31 step 6 (every mode, M06 and M07 included). */
      onSessionCompleted,

      /**
       * M01 password login (BR-M14-14): for a `student`, the streak step and, on the first login of
       * the day, `earn` +2 "Streak activity (daily_login)" (none for complimentary students). Other
       * roles: nothing. `setUser` never calls it.
       */
      onLogin(userId: number, at: number | string): { credited: boolean; streakCount: number } {
        const user = userOf(userId)
        if (user?.role !== 'student')
          return { credited: false, streakCount: streakState(userId).current }
        const date = localDate(at)
        return tx(() => {
          const streak = stepStreak(streakState(userId), date)
          saveStreak(userId, streak)
          if (dailyLoginMarksTable.count({ userId, date }) > 0) {
            return { credited: false, streakCount: streak.current }
          }
          dailyLoginMarksTable.insert({ userId, date })
          if (!coinsEnabled(userId)) return { credited: false, streakCount: streak.current }
          creditSyilingOp(
            userId,
            2,
            { source: 'daily_login', description: 'Streak activity (daily_login)' },
            at,
          )
          return { credited: true, streakCount: streak.current }
        })
      },

      /** BR-M14-21 (XL3-26): `games_award_syiling` = 1 and the user's `coinsEnabled`. */
      canEarnSyiling,

      /** BR-M14-21 (XL3-29): XP always; syiling only while `canEarnSyiling`. */
      onGameResult(
        userId: number,
        p: {
          game: string
          event: string
          coins?: number
          xp: number
          correct?: number
          total?: number
          detail?: Record<string, unknown>
        },
      ): { coinsCredited: number; xpAdded: number } {
        const at = nowMs()
        return tx(() => {
          let coins = 0
          if (canEarnSyiling(userId)) {
            if (p.coins !== undefined) coins = p.coins
            else if (p.game === 'papan_bijak') {
              const tier = tierByKey(walletState(userId).tierKey)
              coins =
                p.event === 'win'
                  ? (tier?.boardGameRewardWin ?? 0)
                  : (tier?.boardGameRewardCorrect ?? 0)
            }
          }
          if (coins > 0) creditSyilingOp(userId, coins, gameRow(p.game, p.event, p), at)
          const xp = Math.max(0, Math.floor(p.xp))
          if (xp > 0) addXpOp(userId, xp, at)
          return { coinsCredited: coins > 0 ? coins : 0, xpAdded: xp }
        })
      },

      /** Q-DAILY-FINISHERS: users whose completions today cover every active challenge. */
      dailyFinishers(at: number = nowMs()): number {
        const date = localDate(at)
        const active = activeChallenges()
        if (active.length === 0) return 0
        const byUser = new Map<number, Set<number>>()
        for (const c of completionsTable.query({ where: { date } }).rows) {
          const set = byUser.get(c.userId) ?? new Set<number>()
          set.add(c.challengeId)
          byUser.set(c.userId, set)
        }
        let n = 0
        for (const set of byUser.values()) if (active.every((c) => set.has(c.id))) n++
        return n
      },

      /** Seed / fixtures: a completion row (idempotent per user, challenge and day). */
      seedCompletion(userId: number, challengeId: number, at: string): void {
        tx(() => addCompletion(userId, challengeId, at))
      },

      /** Seed: the stored result of a designed session (so M05 cannot pay it again). */
      seedSessionCredit(row: Omit<SessionCredit, 'id'>): void {
        tx(() => sessionCreditsTable.insert({ ...row }))
      },
    }
    bindSessionHook((input) => api.onSessionCompleted(input as unknown as SessionCompletedInput))
    return api
  },
})

// --- streak -----------------------------------------------------------------------------------

export interface StreakView {
  current: number
  best: number
  lastActivityDate: string | null
  totalDays: number
  /** M05 FR-09: a completed session today (read from M05). */
  practisedToday: boolean
  multiplier: number
}

export const streakRepo = defineRepository({
  owner: 'M14',
  name: 'streak',
  store: streaksTable,
  methods: ({ transaction }) => {
    bindTx(transaction)
    const view = (userId: number): StreakView => {
      const s = streakState(userId)
      const today = formatDateKey(nowMs())
      return {
        ...s,
        practisedToday: practiceReads().sessionsOn(userId, today).length > 0,
        multiplier: STREAK_MULTIPLIER,
      }
    }
    return {
      /** DATA-M14-08; reads never decay (BR-M14-14). */
      get: view,
      /** M18 aggregates: stored rows only (users without a row read 0 / 0). */
      forUsers(userIds: readonly number[]): StreakRow[] {
        return userIds.map(
          (id) =>
            streaksTable.get(id) ?? {
              id,
              userId: id,
              current: 0,
              best: 0,
              lastActivityDate: null,
              totalDays: 0,
            },
        )
      },
      /** Test hook `setStreak` and seeds. */
      set(
        userId: number,
        s: { current: number; best: number; lastActivityDate: string | null; totalDays?: number },
      ): StreakRow {
        return tx(() =>
          saveStreak(userId, { ...s, totalDays: s.totalDays ?? streakState(userId).totalDays }),
        )
      },
    }
  },
})

// --- challenges -------------------------------------------------------------------------------

export const challengeQueries = defineNamedQueries(challengesTable, {
  'Q-CHALLENGES-ACTIVE': { where: { isActive: true }, expected: 10, source: 'M14 §6.10' },
})

export interface ChallengeInput {
  title: string
  description: string
  icon: string
  challengeType: ChallengeType
  targetValue: number
  rewardSyiling: number
  rewardXp: number
  difficulty: Difficulty
  sortOrder: number
}

export interface ChallengeToday {
  id: number
  icon: string
  title: string
  description: string
  difficulty: Difficulty
  rewardSyiling: number
  rewardXp: number
  target: number
  progress: number
  pct: number
  completed: boolean
}

export const challengesRepo = defineRepository({
  owner: 'M14',
  name: 'challenges',
  store: challengesTable,
  queries: challengeQueries,
  methods: ({ transaction }) => {
    bindTx(transaction)
    return {
      /**
       * #7 body (BR-M14-12): the active challenges in order with today's progress (M05 reads +
       * the M14 streak); a completed challenge shows its full bar.
       */
      today(userId: number): { items: ChallengeToday[]; completed: number; active: number } {
        const now = nowMs()
        const date = localDate(now)
        const active = activeChallenges()
        // The streak metric is today-only: the stored streak counts only when the last activity
        // is today (AC-09.1 / AC-10.3). Other readers keep the stored value (BR-M14-14).
        const st = streakState(userId)
        const metrics = dayMetrics(
          dayFacts(userId, date),
          st.lastActivityDate === date ? st.current : 0,
        )
        const done = completionsOn(userId, date)
        const items = active.map((c) => {
          const completed = done.has(c.id)
          const progress = completed ? c.targetValue : challengeProgress(c, metrics)
          return {
            id: c.id,
            icon: c.icon,
            title: c.title,
            description: c.description,
            difficulty: c.difficulty,
            rewardSyiling: c.rewardSyiling,
            rewardXp: c.rewardXp,
            target: c.targetValue,
            progress,
            pct: c.targetValue > 0 ? Math.round((progress / c.targetValue) * 100) : 0,
            completed,
          }
        })
        return { items, completed: items.filter((i) => i.completed).length, active: active.length }
      },
      /** #23: every challenge by (`sortOrder`, `id`). */
      list(): DailyChallenge[] {
        return challengesTable.query({ sort: ['sortOrder', 'id'] }).rows
      },
      get(id: number): DailyChallenge | undefined {
        return challengesTable.get(id)
      },
      /** #24 (the stored metric follows a type change, BR-M14-12). */
      update(id: number, input: ChallengeInput): DailyChallenge {
        const cur = challengesTable.get(id)
        if (!cur) throw new M14Error('NOT_FOUND', 'Cabaran tidak dijumpai.')
        const metric =
          input.challengeType === cur.challengeType
            ? cur.metric
            : DEFAULT_METRIC_BY_TYPE[input.challengeType]
        return tx(() => challengesTable.update(id, { ...input, metric }))
      },
      /** #25. */
      toggle(id: number): { isActive: boolean } {
        const cur = challengesTable.get(id)
        if (!cur) throw new M14Error('NOT_FOUND', 'Cabaran tidak dijumpai.')
        return tx(() => ({
          isActive: challengesTable.update(id, { isActive: !cur.isActive }).isActive,
        }))
      },
      /** #26. */
      remove(id: number): { deleted: number } {
        if (!challengesTable.get(id)) throw new M14Error('NOT_FOUND', 'Cabaran tidak dijumpai.')
        tx(() => challengesTable.remove(id))
        return { deleted: 1 }
      },
      /** #27 (the metric = the type's default). */
      create(input: ChallengeInput): DailyChallenge {
        return tx(() =>
          challengesTable.insert({
            ...input,
            metric: DEFAULT_METRIC_BY_TYPE[input.challengeType],
            isActive: true,
          }),
        )
      },
      /** Seed: the catalogue rows (live ids). */
      seed(rows: readonly DailyChallenge[]): void {
        tx(() => rows.forEach((r) => challengesTable.insert({ ...r })))
      },
    }
  },
})

// --- achievements -----------------------------------------------------------------------------

export interface AchievementItem {
  id: number
  icon: string
  name: string
  description: string
  rarity: Rarity
  rarityLabel: string
  rarityColor: string
  rewardSyiling: number
  rewardXp: number
  progress: { value: number; target: number } | null
  unlocked: boolean
  unlockedAt: string | null
}

export const achievementQueries = defineNamedQueries(userAchievementsTable, {
  'Q-ACH-UNLOCKED': {
    where: (userId: number) => ({ userId }),
    expected: [{ args: [1], value: 0 }],
    source: 'M14 §6.10 (S15 "{n}/25")',
  },
})

export const achievementsRepo = defineRepository({
  owner: 'M14',
  name: 'achievements',
  store: userAchievementsTable,
  stores: { catalogue: achievementsTable },
  queries: achievementQueries,
  methods: ({ transaction }) => {
    bindTx(transaction)
    return {
      /** #9 body; unknown `rarity` → `items: []`. */
      forUser(userId: number, rarity?: string) {
        const unlocked = new Map(
          userAchievementsTable
            .query({ where: { userId } })
            .rows.map((u) => [u.achievementId, u.unlockedAt]),
        )
        const practiceCount = practiceReads().practiceSessions(userId).length
        const s = streakState(userId)
        const items: AchievementItem[] = catalogue()
          .filter((a) => rarity === undefined || rarity === '' || a.rarity === rarity)
          .map((a) => ({
            id: a.id,
            icon: a.icon,
            name: a.name,
            description: a.description,
            rarity: a.rarity,
            rarityLabel: RARITY_LABELS[a.rarity],
            rarityColor: RARITY_COLORS[a.rarity],
            rewardSyiling: a.rewardSyiling,
            rewardXp: a.rewardXp,
            progress:
              a.progressTarget === null
                ? null
                : {
                    value: unlocked.has(a.id)
                      ? a.progressTarget
                      : Math.min(a.progressTarget, practiceCount),
                    target: a.progressTarget,
                  },
            unlocked: unlocked.has(a.id),
            unlockedAt: unlocked.get(a.id) ?? null,
          }))
        return {
          unlocked: unlocked.size,
          total: catalogue().length,
          streak: { current: s.current, best: s.best, multiplier: STREAK_MULTIPLIER },
          items,
        }
      },
      catalogue(): Achievement[] {
        return catalogue()
      },
      /** Seed: the catalogue and designed unlocks. */
      seedCatalogue(rows: readonly Achievement[]): void {
        tx(() => rows.forEach((r) => achievementsTable.insert({ ...r })))
      },
      seedUnlock(userId: number, achievementId: number, unlockedAt: string): void {
        tx(() => userAchievementsTable.insert({ userId, achievementId, unlockedAt }))
      },
    }
  },
})

// --- tiers ------------------------------------------------------------------------------------

export type TierInput = Omit<Tier, 'id' | 'isActive' | 'tierName'>

export const tiersRepo = defineRepository({
  owner: 'M14',
  name: 'tiers',
  store: tiersTable,
  methods: ({ transaction }) => {
    bindTx(transaction)
    return {
      /** #19 (and S11 / S12 grids: filter `isActive`). */
      list(): Tier[] {
        return allTiers()
      },
      /** #20. */
      update(id: number, input: Partial<TierInput>): Tier {
        if (!tiersTable.get(id)) throw new M14Error('NOT_FOUND', 'Tier tidak dijumpai.')
        return tx(() => tiersTable.update(id, input))
      },
      /** #21 (a deactivated tier keeps its holders, BR-M14-08). */
      toggle(id: number): { isActive: boolean } {
        const cur = tiersTable.get(id)
        if (!cur) throw new M14Error('NOT_FOUND', 'Tier tidak dijumpai.')
        return tx(() => ({ isActive: tiersTable.update(id, { isActive: !cur.isActive }).isActive }))
      },
      /** #22 (V-M14-03: unique `tierName`). */
      create(input: TierInput & { tierName: string }): Tier {
        if (allTiers().some((t) => t.tierName === input.tierName)) {
          throw new M14Error('VALIDATION_ERROR', 'Nama tier sudah wujud.')
        }
        return tx(() => tiersTable.insert({ ...input, isActive: true }))
      },
      seed(rows: readonly Tier[]): void {
        tx(() => rows.forEach((r) => tiersTable.insert({ ...r, perks: [...r.perks] })))
      },
    }
  },
})

/** Local day bounds, for handlers. */
export function todayRange(at: number = nowMs()) {
  return dayRange(at)
}
