import { Inject, Injectable } from '@nestjs/common'
import type {
  GamificationAchievements,
  GamificationChallengeProgress,
  GamificationChallengesResponse,
  GamificationConvertResult,
  GamificationConvertView,
  GamificationDashboard,
  GamificationLeaderboard,
  GamificationMasteryRow,
  GamificationReferral,
  GamificationShareCards,
} from '@pp/contract'
import { GAMIFICATION_MESSAGES as MSG } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import type { TxClient } from '../../db/client'
import { CLOCK, type Clock, mytDay } from '../../db/clock'
import { idFromString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { toMytTimestamp } from '../../common/time/myt'
import { MAX_AMOUNT_PER_CALL, WalletService, walletLockOrder } from '../wallet'
import { titleOf } from '../wallet/rules'
import {
  LEADERBOARD_SIZE,
  PUBLIC_HOST,
  RARITY_COLORS,
  RARITY_LABELS,
  REFERRAL_REWARD_REFEREE,
  REFERRAL_REWARD_REFERRER,
} from './gamification.constants'
import { GamificationRepository, type ChallengeRecord, type Db } from './gamification.repository'
import { GamificationPorts } from './ports'
import { activeTiers, defaultTier, initialOf, initialsOf, masteryLevel, masteryMultiplier, masteryNextTarget, masteryStage, round, shareEncode, tierView } from './helpers'
import { validationFailure } from './validation'

/** Who is calling: the signed-in user and whether an admin is in Mod Pelajar (`isTestActor`). */
export interface Viewer {
  userId: string
  isTest: boolean
}

/** Options of the entry points other modules call inside their own transaction. */
export interface EntryOptions {
  /** The caller's transaction; omitted = the ambient one, else a new one. */
  tx?: TxClient
  /** REQUIRED: true while an admin is in Mod Pelajar; every wallet call is stamped with it. */
  isTest: boolean
  /** The event time (default the clock); decides the Malaysia day of a completion. */
  at?: Date
}

export interface GameResultInput {
  game: string
  event: string
  /** Syiling to credit; absent = the tier rate for `papan_bijak`, 0 for other games. */
  coins?: number
  xp: number
  correct?: number
  total?: number
  detail?: Record<string, unknown>
  /**
   * The natural key of this result (a match id, a round id). With it the syiling credit is idempotent per
   * `(user, source, key)`; without it the credit has no key and a retry would pay twice.
   */
  key?: string
}

/** BR-M14-21 wording by game and event (observed rows; mock `gameRow`). */
function gameRow(game: string, event: string, p: { correct?: number; detail?: Record<string, unknown> }): { source: string; description: string } {
  const d = p.detail ?? {}
  const n = (v: unknown, f = 0) => (typeof v === 'number' ? v : f)
  const correct = String(p.correct ?? 0)
  switch (game) {
    case 'papan_bijak':
      return event === 'win' ? { source: 'papan_bijak_win', description: 'Menang Papan Bijak! 🏆🎲' } : { source: 'papan_bijak', description: 'Jawab betul dalam Papan Bijak 🎲' }
    case 'benteng':
    case 'benteng_ilmu':
      if (event === 'win') return { source: 'benteng_win', description: 'Juara Benteng Ilmu!' }
      if (event === 'forfeit_win') return { source: 'benteng_win', description: 'Menang Benteng Ilmu (lawan menyerah)' }
      return { source: 'benteng_play', description: 'Penyertaan Benteng Ilmu' }
    case 'perang_fakta':
      return { source: 'perang_fakta_win', description: 'Menang Perang Fakta (lawan menyerah)' }
    case 'mathrace':
      return { source: 'mathrace_play', description: `#${String(n(d.rank, 1))} Perlumbaan Matematik` }
    case 'jutawan':
    case 'jutawan_ilmu':
      return { source: 'jutawan_ilmu', description: `Jutawan Ilmu (${typeof d.subject === 'string' ? d.subject : 'Bahasa Melayu'}): Level ${String(n(d.level, 1))}` }
    case 'cabaran_kilat':
      return { source: 'cabaran_kilat', description: `Cabaran Kilat: ${correct} betul, combo ${String(n(d.maxCombo, 1))}x` }
    case 'betul_salah':
      return { source: 'betul_salah', description: `Betul/Salah: ${correct} betul, streak ${String(n(d.maxStreak, 1))}` }
    default:
      return { source: game, description: `${game}: ${correct} betul` }
  }
}

/** BR-M14-12 metric values for one Malaysia day. */
export function dayMetrics(day: { sessions: readonly { correct: number; total: number; timeSpent: number }[]; chapterIds: readonly string[] }, streakCurrent: number): Record<string, number> {
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
    best_accuracy: bestAccuracy,
    best_correct_in_session: bestCorrect,
    chapters: new Set(day.chapterIds).size,
    minutes: Math.floor(seconds / 60),
    streak: streakCurrent,
  }
}

/** BR-M14-12: progress = min(target, metric); a challenge without a mapped metric (migrated row) never progresses. */
const progressOf = (c: ChallengeRecord, metrics: Record<string, number>): number => Math.min(c.targetValue, c.metric === null ? 0 : (metrics[c.metric] ?? 0))

/**
 * M14 student side and the entry points other modules call (BE-23).
 *
 * WALLET. Every syiling or token movement goes through `WalletService` (`credit`, `debit`, `addXp`) inside the
 * caller's transaction with a stable idempotency key `(source, sourceId)`. This class never writes `wallets`,
 * `coin_ledger` or `token_movements`.
 *
 * MOD PELAJAR. `isTest` is REQUIRED on every entry point and passed to every wallet call, so an admin who
 * impersonates a student can read everything but the rows they write are stamped `is_test`. Totals shown to
 * others (leaderboard, admin overview) leave `is_test` rows out and never show a test-only actor (see
 * `VISIBLE_WALLETS` in the repository and the header of `wallet.service.ts`).
 */
@Injectable()
export class GamificationService {
  constructor(
    private readonly repo: GamificationRepository,
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly ports: GamificationPorts,
  ) {}

  private run<T>(tx: TxClient | undefined, fn: (db: Db) => Promise<T>): Promise<T> {
    return tx ? fn(tx) : this.prisma.transaction((t) => fn(t))
  }

  // --- reads ---------------------------------------------------------------------------------------

  /** `GET /gamification/dashboard` (S11). */
  async dashboard(userId: string): Promise<GamificationDashboard> {
    const db = this.repo.handle()
    const [wallet, challenges, recent, mastery, tiers] = await Promise.all([
      this.wallet.summary(userId),
      this.challengesToday(userId),
      this.repo.ledgerRecent(db, userId, 6),
      this.masteryRows(userId),
      this.repo.tiers(db),
    ])
    return {
      wallet,
      challenges: challenges.data.slice(0, 4),
      recent: recent.map((r) => ({
        id: r.id,
        type: r.type as 'earn',
        amount: r.amount,
        balanceAfter: r.balanceAfter,
        source: r.source,
        description: r.description,
        createdAt: toMytTimestamp(r.createdAt),
      })),
      mastery: mastery.map((m) => ({
        subjectId: m.subjectId,
        subjectName: m.subjectName,
        level: m.level,
        stage: m.stage,
        correct: m.correct,
        nextTarget: m.nextTarget,
        accuracy: m.accuracy,
        multiplier: m.multiplier,
      })),
      tiers: activeTiers(tiers).map((t) => ({ ...tierView(t), isMine: t.tierName === wallet.tier.key })),
    }
  }

  /** `GET /gamification/convert` (S12). */
  async convertView(userId: string): Promise<GamificationConvertView> {
    const db = this.repo.handle()
    const [s, tiers] = await Promise.all([this.wallet.summary(userId), this.repo.tiers(db)])
    const rate = s.tier.conversionRate
    return {
      currentSyiling: s.currentSyiling,
      tokenBalance: s.tokenBalance,
      rate,
      tierLabel: s.tier.labelMs,
      quick: [rate, 5 * rate, s.currentSyiling],
      tiers: activeTiers(tiers).map((t) => ({ ...tierView(t), isMine: t.tierName === s.tier.key })),
    }
  }

  /**
   * `GET /gamification/challenges` (S13, BR-M14-12): the active challenges in (`sortOrder`, `id`) order with the
   * progress of the current Malaysia day; a completed challenge shows its full bar. The streak metric counts only
   * when the last streak activity is today.
   */
  async challengesToday(userId: string): Promise<GamificationChallengesResponse> {
    const db = this.repo.handle()
    const day = mytDay(this.clock.now())
    const [active, done, streak, facts] = await Promise.all([
      this.repo.challenges(db, true),
      this.repo.completedOn(db, userId, day),
      this.repo.streakOf(db, userId),
      this.ports.practiceFacts.dayFacts(userId, day),
    ])
    const metrics = dayMetrics(facts, streak.lastActivityDate === day ? streak.current : 0)
    const data = active.map((c): GamificationChallengeProgress => {
      const completed = done.has(c.id)
      const progress = completed ? c.targetValue : progressOf(c, metrics)
      return {
        id: c.id,
        icon: c.icon,
        title: c.title,
        description: c.description,
        difficulty: c.difficulty as 'easy',
        rewardSyiling: c.rewardSyiling,
        rewardXp: c.rewardXp,
        target: c.targetValue,
        progress,
        pct: c.targetValue > 0 ? Math.round((progress / c.targetValue) * 100) : 0,
        completed,
      }
    })
    return { data, meta: { completed: data.filter((i) => i.completed).length, active: active.length } }
  }

  /** `GET /gamification/leaderboard` (S14): top 50 by lifetime syiling, global; rows other people may see only. */
  async leaderboard(): Promise<GamificationLeaderboard> {
    const ranked = (await this.repo.leaderboard(this.repo.handle(), LEADERBOARD_SIZE)).map((w, i) => ({ w, rank: i + 1 }))
    return {
      podium: ranked.slice(0, 3).map(({ w, rank }) => ({
        rank,
        userId: w.userId,
        name: w.name,
        initials: initialsOf(w.name),
        totalSyilingEarned: w.total,
        tier: { key: w.tierKey, labelMs: w.tierLabel, icon: w.tierIcon },
      })),
      rows: ranked.slice(3).map(({ w, rank }) => ({
        rank,
        userId: w.userId,
        name: w.name,
        initials: initialsOf(w.name),
        title: titleOf(w.total).name,
        level: w.level,
        totalSyilingEarned: w.total,
        tierIcon: w.tierIcon,
      })),
    }
  }

  /** `GET /gamification/achievements` (S15): an unknown `rarity` answers `items: []`. */
  async achievements(userId: string, rarity: string): Promise<GamificationAchievements> {
    const db = this.repo.handle()
    const [catalogue, unlocked, counts, streak] = await Promise.all([
      this.repo.achievements(db),
      this.repo.unlocksOf(db, userId),
      this.ports.practiceFacts.sessionCounts(userId),
      this.repo.streakOf(db, userId),
    ])
    const items = catalogue
      .filter((a) => rarity === '' || a.rarity === rarity)
      .map((a) => ({
        id: a.id,
        icon: a.icon,
        name: a.name,
        description: a.description,
        rarity: a.rarity as 'common',
        rarityLabel: RARITY_LABELS[a.rarity as keyof typeof RARITY_LABELS] ?? '',
        rarityColor: RARITY_COLORS[a.rarity as keyof typeof RARITY_COLORS] ?? '',
        rewardSyiling: a.rewardSyiling,
        rewardXp: a.rewardXp,
        progress: a.progressTarget === null ? null : { value: unlocked.has(a.id) ? a.progressTarget : Math.min(a.progressTarget, counts.practice), target: a.progressTarget },
        unlocked: unlocked.has(a.id),
        unlockedAt: unlocked.has(a.id) ? toMytTimestamp(unlocked.get(a.id) as Date) : null,
      }))
    return { unlocked: unlocked.size, total: catalogue.length, streak: { current: streak.current, best: streak.best, multiplier: 1 }, items }
  }

  /** `GET /gamification/share-cards` (S18): the caller's own profile; accuracies have 1 decimal. */
  async shareCards(userId: string): Promise<GamificationShareCards> {
    const db = this.repo.handle()
    const [user, wallet, mastery, counts, streak] = await Promise.all([
      this.repo.userBasics(db, userId),
      this.wallet.summary(userId),
      this.masteryRows(userId),
      this.ports.practiceFacts.sessionCounts(userId),
      this.repo.streakOf(db, userId),
    ])
    const name = user?.name ?? ''
    const answered = mastery.reduce((a, m) => a + m.answered, 0)
    const correct = mastery.reduce((a, m) => a + m.correct, 0)
    const accuracy = answered > 0 ? round((correct / answered) * 100, 1) : 0
    return {
      name,
      initial: initialOf(name),
      profileUrl: `${PUBLIC_HOST}/pelajar/${userId}`,
      profile: { answered, accuracy, sessions: counts.all, tierKey: wallet.tier.key, tierIcon: wallet.tier.icon, level: wallet.level, currentSyiling: wallet.currentSyiling },
      kombo: { current: streak.current, best: streak.best, multiplier: 1 },
      mastery: mastery.map((m) => ({ subjectName: m.subjectName, level: m.level, stage: m.stage, accuracy: m.accuracy1, correct: m.correct })),
      ranking: { accuracy, correct, answered },
    }
  }

  /** `GET /gamification/referral` (S16): the first read creates the caller's code (BR-M14-18). */
  async referral(userId: string): Promise<GamificationReferral> {
    const code = await this.referralCodeOf(userId)
    const stats = await this.repo.referralStats(this.repo.handle(), userId)
    const registerUrl = `${PUBLIC_HOST}/register?ref=${code}`
    const text = `Jom belajar matematik di PRESTASIPLUS! Guna kod ${code} untuk dapat ${String(REFERRAL_REWARD_REFEREE)} syiling PERCUMA! ${registerUrl}`
    return {
      code,
      rewardReferrer: REFERRAL_REWARD_REFERRER,
      rewardReferee: REFERRAL_REWARD_REFEREE,
      registerUrl,
      // As on live: only spaces are encoded; `:/?=&!` stay raw.
      whatsappUrl: `https://wa.me/?text=${shareEncode(text)}`,
      telegramUrl: `https://t.me/share/url?url=${registerUrl}&text=${shareEncode(`Jom belajar matematik di PRESTASIPLUS! Guna kod ${code}`)}`,
      stats: { referrals: stats.referrals, rewarded: stats.rewarded, syilingEarned: stats.rewarded * REFERRAL_REWARD_REFERRER },
    }
  }

  /** BR-M14-18: 7 characters of [A-Z0-9], deterministic from the user id; a clash takes the next salt. */
  private async referralCodeOf(userId: string): Promise<string> {
    const db = this.repo.handle()
    const existing = await this.repo.referralCodeOf(db, userId)
    if (existing) return existing
    const at = this.clock.now()
    for (let salt = 0; salt < 50; salt++) {
      await this.repo.insertReferralCode(db, userId, referralCodeFor(userId, salt), at)
      const stored = await this.repo.referralCodeOf(db, userId)
      if (stored) return stored // ours, or the one a concurrent first read stored
    }
    throw new Error('GamificationService: no free referral code')
  }

  private async masteryRows(userId: string): Promise<(GamificationMasteryRow & { answered: number; accuracy1: number })[]> {
    const facts = await this.ports.practiceFacts.mastery(userId)
    return facts
      .filter((m) => m.answered > 0)
      .sort((a, b) => a.subjectOrder - b.subjectOrder || (BigInt(a.subjectId) < BigInt(b.subjectId) ? -1 : 1))
      .map((m) => {
        const level = masteryLevel(m.correct)
        const accuracy = (m.correct / m.answered) * 100
        return {
          subjectId: m.subjectId,
          subjectName: m.subjectName,
          level,
          stage: masteryStage(level),
          correct: m.correct,
          answered: m.answered,
          nextTarget: masteryNextTarget(level),
          accuracy: round(accuracy, 2),
          accuracy1: round(accuracy, 1),
          multiplier: masteryMultiplier(level),
        }
      })
  }

  // --- convert -------------------------------------------------------------------------------------

  /**
   * `POST /gamification/convert` (S12, BR-M14-10/11): tokens = floor(syiling / rate), the rate read from the
   * caller's tier in the database; the amount must be an integer, at least the rate and at most the balance
   * (else 422 `fields.syilingAmount`). One transaction: the wallet row is locked, the amount is checked against
   * the locked balance, then `WalletService.debit` (type `convert`) writes the ledger row and pays the tokens.
   * Parallel conversions of one wallet therefore queue on the lock and can never drive the balance below zero.
   *
   * IDEMPOTENCY. The mock has no key and there is no daily cap, so two legitimate conversions in a row must both
   * run. A client MAY send `Idempotency-Key`: the ledger key is then `(token_conversion, convert:<key>)` and a
   * repeat with the same key and amount returns the first result without a second debit (a different amount
   * under the same key is a 409). Without the header the debit has no key (`noKeyReason`).
   */
  async convert(viewer: Viewer, syilingAmount: number, idempotencyKey: string | null): Promise<GamificationConvertResult> {
    const invalid = () => validationFailure({ syilingAmount: MSG.amountInvalid }, MSG.amountInvalid)
    if (!Number.isSafeInteger(syilingAmount) || syilingAmount < 1 || syilingAmount > MAX_AMOUNT_PER_CALL) throw invalid()
    const sourceId = idempotencyKey === null ? null : `convert:${idempotencyKey}`
    return this.prisma.transaction(async (tx) => {
      const locked = await this.repo.lockWallet(tx, viewer.userId)
      const tiers = await this.repo.tiers(tx)
      const tier = (locked?.tierId ? tiers.find((t) => t.id === locked.tierId) : undefined) ?? defaultTier(tiers)
      if (!tier) throw new Error('M14: no tier is defined')
      const rate = tier.conversionRate

      // A repeat of a keyed conversion is answered from the first row (the balance may have changed since).
      const prior = sourceId === null ? null : await this.repo.ledgerByKey(tx, viewer.userId, 'token_conversion', sourceId)
      if (prior === null && (syilingAmount < rate || syilingAmount > (locked?.currentSyiling ?? 0))) throw invalid()
      const tokens = prior?.tokens ?? Math.floor(syilingAmount / rate)

      const description = `Tukar ${String(syilingAmount)} syiling → ${String(tokens)} token`
      const key = sourceId === null ? { sourceId: null, noKeyReason: 'a conversion has no natural key: the client repeats legitimately' } : { sourceId }
      const out = await this.wallet.debit(
        { userId: viewer.userId, amount: syilingAmount, source: 'token_conversion', description, type: 'convert', tokens, isTest: viewer.isTest, ...key },
        { tx },
      )
      return { syilingDebited: syilingAmount, tokensCredited: tokens, currentSyiling: out.currentSyiling, tokenBalance: out.tokenBalance, transactionId: out.entryId }
    })
  }

  // --- entry points of other modules ---------------------------------------------------------------

  /** M02 `coinsEnabled`: the per-student toggle of a complimentary student, else everybody but complimentary accounts. */
  async coinsEnabled(userId: string, options: { tx?: TxClient } = {}): Promise<boolean> {
    const db = this.repo.handle(options.tx)
    const row = await this.repo.coinsEnabledRow(db, userId)
    if (row !== null) return row
    return (await this.repo.userBasics(db, userId))?.isComplimentary !== true
  }

  /** BR-M14-21: `games_award_syiling` = 1 and the user's `coinsEnabled` (XP is always allowed). */
  async canEarnSyiling(userId: string, options: { tx?: TxClient } = {}): Promise<boolean> {
    const db = this.repo.handle(options.tx)
    if ((await this.repo.settingValue(db, 'games_award_syiling')) !== 1) return false
    return this.coinsEnabled(userId, options)
  }

  /**
   * Claims one daily challenge for the Malaysia day of `opts.at` (AC2). Idempotent: the completion row is
   * `INSERT ... ON CONFLICT DO NOTHING` on the unique (user, challenge, day), and the reward is credited ONLY by
   * the call that inserted the row (ledger key `daily_challenge` / `challenge:<id>:<yyyy-mm-dd>`). A second call
   * the same day adds nothing. The caller decides that the target is met (see `settleChallenges`).
   */
  async claimChallenge(userId: string, challengeId: string, opts: EntryOptions): Promise<{ claimed: boolean; syiling: number; xp: number }> {
    return this.run(opts.tx, async (db) => {
      const challenge = await this.repo.challenge(db, idFromString(challengeId))
      if (!challenge) throw ApiError.of('NOT_FOUND', { message: MSG.challengeNotFound })
      if (!challenge.isActive) return { claimed: false, syiling: 0, xp: 0 }
      const at = opts.at ?? this.clock.now()
      const day = mytDay(at)
      if (!(await this.repo.insertCompletion(db, { userId, challengeId, day, at, isTest: opts.isTest }))) return { claimed: false, syiling: 0, xp: 0 }
      let syiling = 0
      if (challenge.rewardSyiling > 0 && (await this.coinsEnabled(userId, { tx: db as TxClient }))) {
        await this.wallet.credit(
          { userId, amount: challenge.rewardSyiling, source: 'daily_challenge', sourceId: `challenge:${challengeId}:${day}`, description: `Cabaran selesai: ${challenge.title}`, isTest: opts.isTest },
          { tx: db as TxClient },
        )
        syiling = challenge.rewardSyiling
      }
      if (challenge.rewardXp > 0) await this.wallet.addXp({ userId, amount: challenge.rewardXp, isTest: opts.isTest }, { tx: db as TxClient })
      return { claimed: true, syiling, xp: challenge.rewardXp }
    })
  }

  /**
   * Called after a practice session completes (BE-12/BE-18, inside their transaction, after the streak step):
   * every active challenge whose progress of the day reached its target and is not completed yet is claimed, in
   * (`sortOrder`, `id`) order (BR-M14-12/13). Returns the ids claimed by THIS call.
   */
  async settleChallenges(userId: string, opts: EntryOptions): Promise<{ claimedIds: string[]; syiling: number; xp: number }> {
    return this.run(opts.tx, async (db) => {
      const at = opts.at ?? this.clock.now()
      const day = mytDay(at)
      const [active, done, streak, facts] = await Promise.all([
        this.repo.challenges(db, true),
        this.repo.completedOn(db, userId, day),
        this.repo.streakOf(db, userId),
        this.ports.practiceFacts.dayFacts(userId, day),
      ])
      const metrics = dayMetrics(facts, streak.lastActivityDate === day ? streak.current : 0)
      const out = { claimedIds: [] as string[], syiling: 0, xp: 0 }
      for (const c of active) {
        if (done.has(c.id) || progressOf(c, metrics) < c.targetValue) continue
        const r = await this.claimChallenge(userId, c.id, { ...opts, tx: db as TxClient, at })
        if (!r.claimed) continue
        out.claimedIds.push(c.id)
        out.syiling += r.syiling
        out.xp += r.xp
      }
      return out
    })
  }

  /** Unlocks one achievement once (unique user + achievement) and pays its reward only on the inserting call (ledger key `achievement` / `achievement:<id>`). */
  async unlockAchievement(userId: string, achievementId: string, opts: EntryOptions): Promise<{ unlocked: boolean; syiling: number; xp: number }> {
    return this.run(opts.tx, async (db) => {
      const a = await this.repo.achievement(db, idFromString(achievementId))
      if (!a) throw ApiError.of('NOT_FOUND')
      const at = opts.at ?? this.clock.now()
      if (!(await this.repo.insertUnlock(db, { userId, achievementId, at, isTest: opts.isTest }))) return { unlocked: false, syiling: 0, xp: 0 }
      let syiling = 0
      if (a.rewardSyiling > 0 && (await this.coinsEnabled(userId, { tx: db as TxClient }))) {
        await this.wallet.credit(
          { userId, amount: a.rewardSyiling, source: 'achievement', sourceId: `achievement:${achievementId}`, description: `Pencapaian: ${a.name}`, isTest: opts.isTest },
          { tx: db as TxClient },
        )
        syiling = a.rewardSyiling
      }
      if (a.rewardXp > 0) await this.wallet.addXp({ userId, amount: a.rewardXp, isTest: opts.isTest }, { tx: db as TxClient })
      return { unlocked: true, syiling, xp: a.rewardXp }
    })
  }

  /**
   * BR-M14-21 (BE-44/BE-45): XP always; syiling only while `canEarnSyiling`. The syiling credit is idempotent per
   * `(user, <game source>, game:<key>)` when `input.key` is given. XP has no ledger row, so it cannot be keyed:
   * with a key it is added only when the syiling credit is new, or when no credit is made at all (XP-only
   * results are the caller's to de-duplicate).
   */
  async onGameResult(userId: string, input: GameResultInput, opts: EntryOptions): Promise<{ coinsCredited: number; xpAdded: number }> {
    return this.run(opts.tx, async (db) => {
      const tx = db as TxClient
      let coins = 0
      if (await this.canEarnSyiling(userId, { tx })) {
        if (input.coins !== undefined) coins = input.coins
        else if (input.game === 'papan_bijak') {
          const tiers = await this.repo.tiers(tx)
          const walletTier = (await this.repo.walletTierId(tx, userId)) ?? null
          const tier = (walletTier ? tiers.find((t) => t.id === walletTier) : undefined) ?? defaultTier(tiers)
          coins = input.event === 'win' ? (tier?.boardGameRewardWin ?? 0) : (tier?.boardGameRewardCorrect ?? 0)
        }
      }
      coins = Number.isSafeInteger(coins) && coins > 0 ? coins : 0
      let replayed = false
      if (coins > 0) {
        const row = gameRow(input.game, input.event, input)
        const key = input.key === undefined ? { sourceId: null, noKeyReason: 'the caller gave no result key' } : { sourceId: `game:${input.key}` }
        const out = await this.wallet.credit({ userId, amount: coins, source: row.source, description: row.description, isTest: opts.isTest, ...key }, { tx })
        replayed = out.replayed
      }
      const xp = Number.isFinite(input.xp) ? Math.max(0, Math.floor(input.xp)) : 0
      if (xp > 0 && !replayed) await this.wallet.addXp({ userId, amount: xp, isTest: opts.isTest }, { tx })
      return { coinsCredited: replayed ? 0 : coins, xpAdded: replayed ? 0 : xp }
    })
  }

  /**
   * XR-M14-02 / BR-M14-19 (called by registration): a known code of ANOTHER existing user, and a referee not
   * referred before, pays the new user 25 and the referrer 50 (`bonus` / `referral`, key `referral:<referee id>`)
   * and stores a rewarded referral. Otherwise nothing. The two wallets are written in ascending user id order.
   */
  async applyReferral(newUserId: string, code: string | null | undefined, opts: EntryOptions): Promise<{ applied: boolean }> {
    const normalised = (code ?? '').trim().toUpperCase()
    if (normalised === '') return { applied: false }
    return this.run(opts.tx, async (db) => {
      const tx = db as TxClient
      const referrerId = await this.repo.referralOwner(tx, normalised)
      if (!referrerId || referrerId === newUserId || !(await this.repo.userBasics(tx, referrerId))) return { applied: false }
      const at = opts.at ?? this.clock.now()
      if (!(await this.repo.insertReferral(tx, { referrerId, refereeId: newUserId, code: normalised, at }))) return { applied: false }
      for (const id of walletLockOrder([newUserId, referrerId])) {
        const isReferee = id === newUserId
        await this.wallet.credit(
          {
            userId: id,
            amount: isReferee ? REFERRAL_REWARD_REFEREE : REFERRAL_REWARD_REFERRER,
            type: 'bonus',
            source: 'referral',
            sourceId: `referral:${newUserId}`,
            description: isReferee ? `Bonus rujukan: kod ${normalised}` : 'Rujukan kawan berjaya',
            isTest: opts.isTest,
          },
          { tx },
        )
      }
      return { applied: true }
    })
  }
}

/** BR-M14-18: 7 characters of [A-Z0-9], deterministic from the user id and a salt. */
export function referralCodeFor(userId: string, salt = 0): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const id = Number(BigInt.asIntN(32, idFromString(userId)))
  let h = (Math.imul(id ^ 0x5bd1e995, 0x27d4eb2d) + Math.imul(salt + 1, 0x165667b1)) >>> 0
  let out = ''
  for (let i = 0; i < 7; i++) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0
    h = (h ^ (h >>> 12)) >>> 0
    out += alphabet[h % alphabet.length]
  }
  return out
}
