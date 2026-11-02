import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
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

import type { Env } from '../../common/config/env.schema'
import { publicBaseUrl } from '../../common/config/public-base-url'
import { ApiError } from '../../common/errors/api-error'
import type { TxClient } from '../../db/client'
import { CLOCK, type Clock, mytDay } from '../../db/clock'
import { idFromString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { toMytTimestamp } from '../../common/time/myt'
import { ClassesRepository } from '../classes/classes.repository'
import { MAX_AMOUNT_PER_CALL, StreakService, WalletService, walletLockOrder } from '../wallet'
import { titleOf } from '../wallet/rules'
import {
  ACCURATE_SESSION_PCT,
  LEADERBOARD_SIZE,
  MATH_SUBJECT_NAME,
  SCIENCE_SUBJECT_NAME,
  RARITY_COLORS,
  RARITY_LABELS,
  DAILY_LOGIN_DESCRIPTION,
  DAILY_LOGIN_REWARD,
  REFERRAL_MAX_PER_REFERRER_PER_DAY,
  REFERRAL_REWARD_REFEREE,
  REFERRAL_REWARD_REFERRER,
} from './gamification.constants'
import { GamificationRepository, type AchievementRecord, type ChallengeRecord, type Db } from './gamification.repository'
import { RANKING_REDACTED_ID, canSeeRankedName, shortName, type NameScope, type RankingViewer } from './name-privacy'
import { GamificationPorts, type PracticeMasteryFact } from './ports'
import { activeTiers, defaultTier, initialOf, initialsOf, masteryLevel, masteryMultiplier, masteryNextTarget, masteryStage, previousDay, round, shareEncode, tierView } from './helpers'
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
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(StreakService) private readonly streaks: StreakService,
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

  /**
   * `GET /gamification/leaderboard` (S14): top 50 by lifetime syiling, global; rows other people may see only.
   * Names (#76, LEAD): the full name and the user id only within the viewer's scope (see `canSeeRankedName`); every
   * other row shows first name + initial and the redacted id. Ranks and figures are the same for everyone.
   */
  async leaderboard(viewer: RankingViewer): Promise<GamificationLeaderboard> {
    const [wallets, scope] = await Promise.all([this.repo.leaderboard(this.repo.handle(), LEADERBOARD_SIZE), this.nameScope(viewer)])
    const ranked = wallets.map((w, i) => {
      const visible = canSeeRankedName(viewer, scope, w.userId, w.schoolId)
      const name = visible ? w.name : shortName(w.name)
      return { w, rank: i + 1, userId: visible ? w.userId : RANKING_REDACTED_ID, name, initials: initialsOf(name) }
    })
    return {
      podium: ranked.slice(0, 3).map(({ w, rank, userId, name, initials }) => ({
        rank,
        userId,
        name,
        initials,
        totalSyilingEarned: w.total,
        tier: { key: w.tierKey, labelMs: w.tierLabel, icon: w.tierIcon },
      })),
      rows: ranked.slice(3).map(({ w, rank, userId, name, initials }) => ({
        rank,
        userId,
        name,
        initials,
        title: titleOf(w.total).name,
        level: w.level,
        totalSyilingEarned: w.total,
        tierIcon: w.tierIcon,
      })),
    }
  }

  /** A teacher's pupils (active, real members of the own active classes, read through the classes owner) and a school admin's school. */
  private async nameScope(viewer: RankingViewer): Promise<NameScope> {
    if (viewer.role === 'school_admin') return { ownPupils: new Set(), schoolId: viewer.schoolId }
    if (viewer.role !== 'teacher') return { ownPupils: new Set(), schoolId: null }
    const classes = (await this.classes.forTeacher(viewer.userId)).filter((c) => c.isActive)
    const rosters = await this.classes.memberIdsOf(classes.map((c) => c.id))
    return { ownPupils: new Set([...rosters.values()].flat()), schoolId: null }
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
      profileUrl: `${publicBaseUrl(this.config)}/pelajar/${userId}`,
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
    const registerUrl = `${publicBaseUrl(this.config)}/register?ref=${code}`
    const text = `Jom belajar matematik di PRESTASIPLUS! Guna kod ${code} untuk dapat ${String(REFERRAL_REWARD_REFEREE)} syiling PERCUMA! ${registerUrl}`
    return {
      code,
      rewardReferrer: REFERRAL_REWARD_REFERRER,
      rewardReferee: REFERRAL_REWARD_REFEREE,
      registerUrl,
      // As on live: only spaces are encoded; `:/?=&!` stay raw.
      whatsappUrl: `https://wa.me/?text=${shareEncode(text)}`,
      telegramUrl: `https://t.me/share/url?url=${encodeURIComponent(registerUrl)}&text=${shareEncode(`Jom belajar matematik di PRESTASIPLUS! Guna kod ${code}`)}`,
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

  /**
   * XR-M14-02(a) / BR-M14-14 / FR-M14-64 (called by the login hook after a STUDENT's successful password login; the
   * caller filters the role, so an admin or teacher login never reaches it): moves the streak (a qualifying event;
   * the same Malaysia day changes nothing) and, on the FIRST login of the Malaysia day, credits +2 syiling
   * (`earn`, source `daily_login`, "Streak activity (daily_login)", key `daily_login:<day>`). Idempotent: the day mark
   * is unique per (user, day), so a second login the same day writes nothing, and the ledger key stops a replay.
   * A complimentary student (`coinsEnabled` false) gets the streak but no row. The streak is locked before the wallet
   * (BE-11 lock order). Never `is_test`: a login is not Mod Pelajar.
   */
  async onLogin(userId: string, opts: { tx?: TxClient } = {}): Promise<{ firstToday: boolean; credited: number; streak: number }> {
    return this.run(opts.tx, async (db) => {
      const tx = db as TxClient
      // ONE time source for both: the server clock (BE-11: `markDailyLogin` takes no caller time, so a login cannot be marked for another
      // day), so the streak day and the daily mark day always agree, also when the call straddles midnight.
      const streak = await this.streaks.touch(userId, { tx })
      const mark = await this.streaks.markDailyLogin(userId, { tx })
      if (!mark.firstToday || !(await this.coinsEnabled(userId, { tx }))) return { firstToday: mark.firstToday, credited: 0, streak: streak.current }
      await this.wallet.credit(
        { userId, amount: DAILY_LOGIN_REWARD, source: 'daily_login', sourceId: `daily_login:${mark.day}`, description: DAILY_LOGIN_DESCRIPTION, isTest: false },
        { tx },
      )
      return { firstToday: true, credited: DAILY_LOGIN_REWARD, streak: streak.current }
    })
  }

  /** Unlocks one achievement once (unique user + achievement) and pays its reward only on the inserting call (ledger key `achievement` / `achievement:<id>`). */
  async unlockAchievement(userId: string, achievementId: string, opts: EntryOptions): Promise<{ unlocked: boolean; syiling: number; xp: number }> {
    return this.run(opts.tx, async (db) => {
      const a = await this.repo.achievement(db, idFromString(achievementId))
      if (!a) throw ApiError.of('NOT_FOUND')
      return this.unlockRecord(db, userId, a, opts)
    })
  }

  private async unlockRecord(db: Db, userId: string, a: AchievementRecord, opts: EntryOptions): Promise<{ unlocked: boolean; syiling: number; xp: number }> {
    const at = opts.at ?? this.clock.now()
    if (!(await this.repo.insertUnlock(db, { userId, achievementId: a.id, at, isTest: opts.isTest }))) return { unlocked: false, syiling: 0, xp: 0 }
    let syiling = 0
    if (a.rewardSyiling > 0 && (await this.coinsEnabled(userId, { tx: db as TxClient }))) {
      await this.wallet.credit(
        { userId, amount: a.rewardSyiling, source: 'achievement', sourceId: `achievement:${a.id}`, description: `Pencapaian: ${a.name}`, isTest: opts.isTest },
        { tx: db as TxClient },
      )
      syiling = a.rewardSyiling
    }
    if (a.rewardXp > 0) await this.wallet.addXp({ userId, amount: a.rewardXp, isTest: opts.isTest }, { tx: db as TxClient })
    return { unlocked: true, syiling, xp: a.rewardXp }
  }

  /**
   * BR-M14-16 / FR-M14-51 (called after a practice-mode session completes, BE-12 binding, after the challenges):
   * every locked achievement whose criterion is now met is unlocked, in catalogue (`id`) order. Idempotent: the
   * unlock row is unique per (user, achievement) and the reward is credited only by the call that inserted it
   * (`unlockRecord`), so a replay or a concurrent session unlocks and pays once. The criteria counters are read
   * at call time (lazily, only for the kinds still locked); a reward changes `lifetime_syiling` and `unlocked`
   * for the achievements after it in the same pass (the mock engine's live counters). Only a `student` account is evaluated.
   * Returns the ids unlocked by THIS call.
   */
  async evaluateAchievements(userId: string, opts: EntryOptions): Promise<{ unlockedIds: string[]; syiling: number; xp: number }> {
    return this.run(opts.tx, async (db) => {
      const out = { unlockedIds: [] as string[], syiling: 0, xp: 0 }
      // BR-M14-16 is the pupil's: a teacher or an admin (also in Mod Pelajar, where the ACTOR keeps their own role) unlocks and earns nothing.
      if (!(await this.repo.isStudent(db, userId))) return out
      const [catalogue, unlocks] = await Promise.all([this.repo.achievements(db), this.repo.unlocksOf(db, userId)])
      if (catalogue.every((a) => unlocks.has(a.id))) return out
      const at = opts.at ?? this.clock.now()
      const day = mytDay(at)
      const memo = new Map<string, number>()
      const count = async (key: string, read: () => Promise<number>): Promise<number> => {
        const hit = memo.get(key)
        if (hit !== undefined) return hit
        const value = await read()
        memo.set(key, value)
        return value
      }
      let masteryRows: readonly PracticeMasteryFact[] | null = null
      const masteryOnce = async (): Promise<readonly PracticeMasteryFact[]> => (masteryRows ??= await this.ports.practiceFacts.mastery(userId))
      const subjectCorrect = async (name: string): Promise<number> => (await masteryOnce()).filter((m) => m.subjectName === name).reduce((a, m) => a + m.correct, 0)
      const metric = async (a: AchievementRecord): Promise<number> => {
        switch (a.criterionKind) {
          case 'practice_sessions':
            return count('practice_sessions', async () => (await this.ports.practiceFacts.sessionCounts(userId)).practice)
          case 'streak':
            return count('streak', async () => (await this.repo.streakOf(db, userId)).current)
          case 'lifetime_syiling':
            return count('lifetime_syiling', async () => (await this.wallet.summary(userId, { tx: db as TxClient })).totalSyilingEarned)
          case 'accurate_sessions':
            return count('accurate_sessions', () => this.ports.practiceFacts.accurateSessions(userId, ACCURATE_SESSION_PCT))
          case 'subjects':
            return (await masteryOnce()).filter((m) => m.answered > 0).length
          case 'mystery_openings':
            return count('mystery_openings', () => this.repo.mysteryOpenings(db, userId))
          case 'completions':
            return count('completions', () => this.repo.completionCount(db, userId))
          case 'math_correct':
            return subjectCorrect(MATH_SUBJECT_NAME)
          case 'science_correct':
            return subjectCorrect(SCIENCE_SUBJECT_NAME)
          // BR-M14-16 "when recorded": the practice submit does not store per-answer times yet, so this stays 0 (as the mock engine).
          case 'fast_answers':
            return 0
          case 'referrals':
            return count('referrals', () => this.repo.rewardedReferralCount(db, userId))
          case 'unlocked':
            return unlocks.size
          case 'answers_accuracy': {
            const rows = await masteryOnce()
            const answered = rows.reduce((n, m) => n + m.answered, 0)
            const correct = rows.reduce((n, m) => n + m.correct, 0)
            // The count of answers, but only while the overall accuracy holds; below it the criterion is not met at any count.
            return answered > 0 && (correct / answered) * 100 >= (a.criterionAccuracy ?? 0) ? answered : 0
          }
          case 'perfect_days':
            return count('perfect_days', () => this.perfectDays(db, userId, day, a.criterionMin ?? 0))
          default:
            return 0
        }
      }
      for (const a of catalogue) {
        if (unlocks.has(a.id) || a.criterionKind === null || a.criterionMin === null) continue
        if ((await metric(a)) < a.criterionMin) continue
        const r = await this.unlockRecord(db, userId, a, { ...opts, tx: db as TxClient, at })
        if (!r.unlocked) continue
        unlocks.set(a.id, at)
        memo.delete('lifetime_syiling')
        out.unlockedIds.push(a.id)
        out.syiling += r.syiling
        out.xp += r.xp
      }
      return out
    })
  }

  /**
   * BR-M14-16 "Wira JomBelajar": consecutive Malaysia days on which EVERY active challenge was completed, ending today
   * (today counts only when all are done now). Looks back at most `need` days.
   */
  private async perfectDays(db: Db, userId: string, day: string, need: number): Promise<number> {
    const active = await this.repo.challenges(db, true)
    if (active.length === 0 || need < 1) return 0
    const byDay = await this.repo.completionsByDay(db, userId, day, need)
    const complete = (d: string): boolean => active.every((c) => byDay.get(d)?.has(c.id))
    if (!complete(day)) return 0
    let n = 1
    for (let d = previousDay(day); n < need && complete(d); d = previousDay(d)) n++
    return n
  }

  /** Papan Bijak coins per correct answer / per win of the user's wallet tier (the lowest tier without a wallet). */
  async boardGameRates(userId: string, options: { tx?: TxClient } = {}): Promise<{ correct: number; win: number }> {
    const db = this.repo.handle(options.tx)
    const tiers = await this.repo.tiers(db)
    const walletTier = (await this.repo.walletTierId(db, userId)) ?? null
    const tier = (walletTier ? tiers.find((t) => t.id === walletTier) : undefined) ?? defaultTier(tiers)
    return { correct: tier?.boardGameRewardCorrect ?? 0, win: tier?.boardGameRewardWin ?? 0 }
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
          const rates = await this.boardGameRates(userId, { tx })
          coins = input.event === 'win' ? rates.win : rates.correct
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
   * and stores a referral. Otherwise nothing. The two wallets are written in ascending user id order.
   *
   * Follow-up rules: a referrer with `REFERRAL_MAX_PER_REFERRER_PER_DAY` referrals in the 24 hours up to `at` earns
   * nothing more (no row, no credit). Each party is credited only when `coinsEnabled` (the row is stored either way;
   * `rewarded` records whether the referrer was credited).
   */
  async applyReferral(newUserId: string, code: string | null | undefined, opts: EntryOptions): Promise<{ applied: boolean }> {
    const normalised = (code ?? '').trim().toUpperCase()
    if (normalised === '') return { applied: false }
    return this.run(opts.tx, async (db) => {
      const tx = db as TxClient
      const referrerId = await this.repo.referralOwner(tx, normalised)
      if (!referrerId || referrerId === newUserId || !(await this.repo.userBasics(tx, referrerId))) return { applied: false }
      await this.repo.lockReferrer(tx, referrerId) // per-referrer lock: the cap's count-then-insert is race-free
      const at = opts.at ?? this.clock.now()
      if ((await this.repo.referralsInLastDay(tx, referrerId, at)) >= REFERRAL_MAX_PER_REFERRER_PER_DAY) return { applied: false }
      const refereeCoins = await this.coinsEnabled(newUserId, { tx })
      const referrerCoins = await this.coinsEnabled(referrerId, { tx })
      if (!(await this.repo.insertReferral(tx, { referrerId, refereeId: newUserId, code: normalised, rewarded: referrerCoins, at }))) return { applied: false }
      for (const id of walletLockOrder([newUserId, referrerId])) {
        const isReferee = id === newUserId
        if (!(isReferee ? refereeCoins : referrerCoins)) continue
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
