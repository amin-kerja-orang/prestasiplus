import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../db/generated/client'
import type { PrismaClient, TxClient } from '../../db/client'
import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'

/** A transaction handle or the plain client. */
export type Db = TxClient | PrismaClient

/** A `date` column is read and written as UTC midnight of the calendar day. */
const dayDate = (day: string): Date => new Date(`${day}T00:00:00Z`)
const dayOf = (d: Date): string => d.toISOString().slice(0, 10)
const num = (v: bigint | number | null | undefined): number => (v === null || v === undefined ? 0 : Number(v))

export interface TierRecord {
  id: string
  tierName: string
  labelMs: string
  icon: string
  color: string
  minSyiling: number
  conversionRate: number
  sortOrder: number
  perks: string[]
  quizRewardL1: number
  quizRewardL2: number
  quizRewardL3: number
  quizRewardL4: number
  quizRewardL5: number
  pkskRewardCorrect: number
  boardGameRewardCorrect: number
  boardGameRewardWin: number
  isActive: boolean
}

export type TierInput = Omit<TierRecord, 'id' | 'isActive'>

export interface ChallengeRecord {
  id: string
  title: string
  description: string
  icon: string
  challengeType: string
  metric: string | null
  targetValue: number
  rewardSyiling: number
  rewardXp: number
  difficulty: string
  sortOrder: number
  isActive: boolean
}

export interface ChallengeInput {
  title: string
  description: string
  icon: string
  challengeType: string
  targetValue: number
  rewardSyiling: number
  rewardXp: number
  difficulty: string
  sortOrder: number
}

export interface AchievementRecord {
  id: string
  name: string
  description: string
  icon: string
  rarity: string
  rewardSyiling: number
  rewardXp: number
  criterionKind: string | null
  criterionMin: number | null
  criterionAccuracy: number | null
  progressTarget: number | null
}

export interface LedgerRecord {
  id: string
  userId: string
  type: string
  amount: number
  balanceAfter: number
  source: string
  sourceId: string | null
  tokens: number | null
  description: string
  createdAt: Date
}

export interface PrizeLine {
  label: string
  valueSen: number
  qty: number
}

export interface DrawRecord {
  id: string
  title: string
  description: string
  ticketCostSyiling: number
  maxTicketsPerStudent: number
  closesAt: Date | null
  status: string
  winnerUserId: string | null
  drawnAt: Date | null
  createdAt: Date
  prizes: PrizeLine[]
  ticketsSold: number
}

export interface SyilingRewardRecord {
  id: string
  name: string
  type: string
  priceSyiling: number
  costValueSen: number
}

export interface RankedWallet {
  userId: string
  name: string
  tierKey: string
  tierLabel: string
  tierIcon: string
  tierColor: string
  level: number
  total: number
}

export interface AdminStudentRow {
  userId: string
  name: string
  email: string
  tierKey: string
  tierColor: string
  level: number
  currentSyiling: number
  tokenBalance: number
  totalSyilingEarned: number
  xp: number
}

export interface LockedWallet {
  userId: string
  tierId: string | null
  currentSyiling: number
  tokenBalance: number
}

const toTier = (t: {
  id: bigint
  tierName: string
  labelMs: string
  icon: string
  color: string
  minSyiling: number
  conversionRate: Prisma.Decimal
  sortOrder: number
  perks: string[]
  quizRewardL1: number
  quizRewardL2: number
  quizRewardL3: number
  quizRewardL4: number
  quizRewardL5: number
  pkskRewardCorrect: number
  boardGameRewardCorrect: number
  boardGameRewardWin: number
  isActive: boolean
}): TierRecord => ({
  id: idToString(t.id),
  tierName: t.tierName,
  labelMs: t.labelMs,
  icon: t.icon,
  color: t.color,
  minSyiling: t.minSyiling,
  conversionRate: t.conversionRate.toNumber(),
  sortOrder: t.sortOrder,
  perks: t.perks,
  quizRewardL1: t.quizRewardL1,
  quizRewardL2: t.quizRewardL2,
  quizRewardL3: t.quizRewardL3,
  quizRewardL4: t.quizRewardL4,
  quizRewardL5: t.quizRewardL5,
  pkskRewardCorrect: t.pkskRewardCorrect,
  boardGameRewardCorrect: t.boardGameRewardCorrect,
  boardGameRewardWin: t.boardGameRewardWin,
  isActive: t.isActive,
})

const toChallenge = (c: {
  id: bigint
  title: string
  description: string
  icon: string
  challengeType: string
  metric: string | null
  targetValue: number
  rewardSyiling: number
  rewardXp: number
  difficulty: string
  sortOrder: number
  isActive: boolean
}): ChallengeRecord => ({
  id: idToString(c.id),
  title: c.title,
  description: c.description,
  icon: c.icon,
  challengeType: c.challengeType,
  metric: c.metric,
  targetValue: c.targetValue,
  rewardSyiling: c.rewardSyiling,
  rewardXp: c.rewardXp,
  difficulty: c.difficulty,
  sortOrder: c.sortOrder,
  isActive: c.isActive,
})

const toAchievement = (a: {
  id: bigint
  name: string
  description: string
  icon: string
  rarity: string
  rewardSyiling: number
  rewardXp: number
  criterionKind: string | null
  criterionMin: number | null
  criterionAccuracy: Prisma.Decimal | null
  progressTarget: number | null
}): AchievementRecord => ({
  id: idToString(a.id),
  name: a.name,
  description: a.description,
  icon: a.icon,
  rarity: a.rarity,
  rewardSyiling: a.rewardSyiling,
  rewardXp: a.rewardXp,
  criterionKind: a.criterionKind,
  criterionMin: a.criterionMin,
  criterionAccuracy: a.criterionAccuracy === null ? null : a.criterionAccuracy.toNumber(),
  progressTarget: a.progressTarget,
})

const toDraw = (
  d: {
    id: bigint
    title: string
    description: string
    ticketCostSyiling: number
    maxTicketsPerStudent: number
    closesAt: Date | null
    status: string
    winnerUserId: bigint | null
    drawnAt: Date | null
    createdAt: Date
    prizes: { label: string; valueSen: number; qty: number }[]
  },
  ticketsSold: number,
): DrawRecord => ({
  id: idToString(d.id),
  title: d.title,
  description: d.description,
  ticketCostSyiling: d.ticketCostSyiling,
  maxTicketsPerStudent: d.maxTicketsPerStudent,
  closesAt: d.closesAt,
  status: d.status,
  winnerUserId: d.winnerUserId === null ? null : idToString(d.winnerUserId),
  drawnAt: d.drawnAt,
  createdAt: d.createdAt,
  prizes: d.prizes.map((p) => ({ label: p.label, valueSen: p.valueSen, qty: p.qty })),
  ticketsSold,
})

/**
 * The wallets as OTHER people may see them (leaderboards, admin overview figures): MOD PELAJAR rule of
 * `wallet.service.ts`. A wallet's shown lifetime total is its stored total minus the positive `is_test` ledger
 * rows (money an admin moved while impersonating a student), and a wallet whose owner is ONLY a test actor
 * (it has test credits and nothing else) is dropped. The owner's own screens show everything.
 */
const VISIBLE_WALLETS = Prisma.sql`
  WITH tsum AS (SELECT user_id, SUM(amount)::bigint AS t FROM coin_ledger WHERE is_test AND amount > 0 GROUP BY user_id),
  vw AS (
    SELECT w.id, w.user_id, w.tier_id, w.level, w.created_at,
           (w.total_syiling_earned - COALESCE(ts.t, 0))::bigint AS shown_total
      FROM wallets w LEFT JOIN tsum ts ON ts.user_id = w.user_id
     WHERE NOT (COALESCE(ts.t, 0) > 0 AND w.total_syiling_earned - COALESCE(ts.t, 0) <= 0)
  )`

const escapeLike = (term: string): string => term.replace(/[\\%_]/g, (c) => `\\${c}`)

const SORT_COLUMN = {
  total_syiling_earned: 'w.total_syiling_earned',
  current_syiling: 'w.current_syiling',
  token_balance: 'w.token_balance',
  level: 'w.level',
} as const
export type StudentSort = keyof typeof SORT_COLUMN
export const isStudentSort = (v: string): v is StudentSort => Object.prototype.hasOwnProperty.call(SORT_COLUMN, v)

/**
 * Data access of M14 beyond the wallet core. It READS the wallet tables (`wallets`, `coin_ledger`, `tiers`,
 * `streaks`) and WRITES `tiers` (admin tier maintenance, BE-23 owns it) and the gamification tables. It never
 * writes `wallets`, `coin_ledger` or `token_movements`: every movement goes through `WalletService`.
 */
@Injectable()
export class GamificationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** The handle to use when the caller gave none: the ambient transaction, else the plain client. */
  handle(db?: Db): Db {
    return db ?? this.prisma.client
  }

  // --- tiers ---------------------------------------------------------------------------------------

  async tiers(db: Db): Promise<TierRecord[]> {
    const rows = await db.tier.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] })
    return rows.map(toTier)
  }

  async tier(db: Db, id: bigint): Promise<TierRecord | null> {
    const r = await db.tier.findUnique({ where: { id } })
    return r ? toTier(r) : null
  }

  async tierNameTaken(db: Db, tierName: string): Promise<boolean> {
    return (await db.tier.count({ where: { tierName } })) > 0
  }

  async createTier(db: Db, input: TierInput, at: Date): Promise<TierRecord> {
    const r = await db.tier.create({ data: { ...input, conversionRate: input.conversionRate, isActive: true, createdAt: at, updatedAt: at } })
    return toTier(r)
  }

  /** Never touches `tier_name` (the key cannot change) and never touches any wallet (AC8). */
  async updateTier(db: Db, id: bigint, patch: Omit<Partial<TierInput>, 'tierName'>, at: Date): Promise<TierRecord> {
    const r = await db.tier.update({ where: { id }, data: { ...patch, updatedAt: at } })
    return toTier(r)
  }

  async setTierActive(db: Db, id: bigint, isActive: boolean, at: Date): Promise<void> {
    await db.tier.update({ where: { id }, data: { isActive, updatedAt: at } })
  }

  // --- challenges ----------------------------------------------------------------------------------

  async challenges(db: Db, activeOnly: boolean): Promise<ChallengeRecord[]> {
    const rows = await db.challenge.findMany({ where: activeOnly ? { isActive: true } : {}, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] })
    return rows.map(toChallenge)
  }

  async challenge(db: Db, id: bigint): Promise<ChallengeRecord | null> {
    const r = await db.challenge.findUnique({ where: { id } })
    return r ? toChallenge(r) : null
  }

  async createChallenge(db: Db, input: ChallengeInput & { metric: string }, at: Date): Promise<ChallengeRecord> {
    const r = await db.challenge.create({ data: { ...input, isActive: true, createdAt: at, updatedAt: at } })
    return toChallenge(r)
  }

  async updateChallenge(db: Db, id: bigint, input: ChallengeInput & { metric: string | null }, at: Date): Promise<ChallengeRecord> {
    const r = await db.challenge.update({ where: { id }, data: { ...input, updatedAt: at } })
    return toChallenge(r)
  }

  async setChallengeActive(db: Db, id: bigint, isActive: boolean, at: Date): Promise<void> {
    await db.challenge.update({ where: { id }, data: { isActive, updatedAt: at } })
  }

  /** Completions cascade with the challenge (foreign key `ON DELETE CASCADE`, migration 0019). */
  async deleteChallenge(db: Db, id: bigint): Promise<void> {
    await db.challenge.delete({ where: { id } })
  }

  /** Challenge ids the user completed on the Malaysia day `day` (test completions included: the owner sees all). */
  async completedOn(db: Db, userId: string, day: string): Promise<Set<string>> {
    const rows = await db.challengeCompletion.findMany({ where: { userId: idFromString(userId), completionDate: dayDate(day) }, select: { challengeId: true } })
    return new Set(rows.map((r) => idToString(r.challengeId)))
  }

  /**
   * `INSERT ... ON CONFLICT DO NOTHING` on the unique (user, challenge, day). True only for the call that wrote
   * the row: the reward is credited by that call alone (AC2).
   */
  async insertCompletion(db: Db, row: { userId: string; challengeId: string; day: string; at: Date; isTest: boolean }): Promise<boolean> {
    const rows = await db.$queryRaw<{ id: bigint }[]>`
      INSERT INTO challenge_completions (user_id, challenge_id, completion_date, completed_at, is_test, created_at, updated_at)
      VALUES (${idFromString(row.userId)}, ${idFromString(row.challengeId)}, ${row.day}::date, ${row.at}::timestamptz, ${row.isTest}, ${row.at}::timestamptz, ${row.at}::timestamptz)
      ON CONFLICT (user_id, challenge_id, completion_date) DO NOTHING
      RETURNING id`
    return rows.length === 1
  }

  async completionCount(db: Db, userId: string): Promise<number> {
    return db.challengeCompletion.count({ where: { userId: idFromString(userId) } })
  }

  // --- achievements --------------------------------------------------------------------------------

  async achievements(db: Db): Promise<AchievementRecord[]> {
    const rows = await db.achievement.findMany({ orderBy: { id: 'asc' } })
    return rows.map(toAchievement)
  }

  async achievement(db: Db, id: bigint): Promise<AchievementRecord | null> {
    const r = await db.achievement.findUnique({ where: { id } })
    return r ? toAchievement(r) : null
  }

  async unlocksOf(db: Db, userId: string): Promise<Map<string, Date>> {
    const rows = await db.userAchievement.findMany({ where: { userId: idFromString(userId) } })
    return new Map(rows.map((r) => [idToString(r.achievementId), r.unlockedAt]))
  }

  async insertUnlock(db: Db, row: { userId: string; achievementId: string; at: Date; isTest: boolean }): Promise<boolean> {
    const rows = await db.$queryRaw<{ id: bigint }[]>`
      INSERT INTO user_achievements (user_id, achievement_id, unlocked_at, is_test, created_at, updated_at)
      VALUES (${idFromString(row.userId)}, ${idFromString(row.achievementId)}, ${row.at}::timestamptz, ${row.isTest}, ${row.at}::timestamptz, ${row.at}::timestamptz)
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING id`
    return rows.length === 1
  }

  // --- referrals -----------------------------------------------------------------------------------

  async referralCodeOf(db: Db, userId: string): Promise<string | null> {
    const r = await db.referralCode.findUnique({ where: { userId: idFromString(userId) } })
    return r ? r.code : null
  }

  /** Tries to store `code` for the user; a clash on the user or on the code writes nothing (the caller re-reads). */
  async insertReferralCode(db: Db, userId: string, code: string, at: Date): Promise<void> {
    await db.referralCode.createMany({ data: [{ userId: idFromString(userId), code, createdAt: at, updatedAt: at }], skipDuplicates: true })
  }

  async referralOwner(db: Db, code: string): Promise<string | null> {
    const r = await db.referralCode.findUnique({ where: { code } })
    return r ? idToString(r.userId) : null
  }

  async referralStats(db: Db, userId: string): Promise<{ referrals: number; rewarded: number }> {
    const referrerId = idFromString(userId)
    const [referrals, rewarded] = await Promise.all([db.referral.count({ where: { referrerId } }), db.referral.count({ where: { referrerId, rewarded: true } })])
    return { referrals, rewarded }
  }

  async rewardedReferralCount(db: Db, userId: string): Promise<number> {
    return db.referral.count({ where: { referrerId: idFromString(userId), rewarded: true } })
  }

  /** True when this call stored the referral (a person is referred once: unique referee). */
  async insertReferral(db: Db, row: { referrerId: string; refereeId: string; code: string; at: Date }): Promise<boolean> {
    const rows = await db.$queryRaw<{ id: bigint }[]>`
      INSERT INTO referrals (referrer_id, referee_id, code_used, rewarded, created_at, updated_at)
      VALUES (${idFromString(row.referrerId)}, ${idFromString(row.refereeId)}, ${row.code}, true, ${row.at}::timestamptz, ${row.at}::timestamptz)
      ON CONFLICT (referee_id) DO NOTHING
      RETURNING id`
    return rows.length === 1
  }

  async mysteryOpenings(db: Db, userId: string): Promise<number> {
    return db.mysteryBoxOpening.count({ where: { userId: idFromString(userId) } })
  }

  // --- users, wallets (read), streak ---------------------------------------------------------------

  async userBasics(db: Db, userId: string): Promise<{ id: string; name: string; email: string | null; isComplimentary: boolean } | null> {
    const u = await db.user.findUnique({ where: { id: idFromString(userId) }, select: { id: true, name: true, email: true, isComplimentary: true } })
    return u ? { id: idToString(u.id), name: u.name, email: u.email, isComplimentary: u.isComplimentary } : null
  }

  async coinsEnabledRow(db: Db, userId: string): Promise<boolean | null> {
    const r = await db.compStudent.findUnique({ where: { userId: idFromString(userId) }, select: { coinsEnabled: true } })
    return r ? r.coinsEnabled : null
  }

  async streakOf(db: Db, userId: string): Promise<{ current: number; best: number; lastActivityDate: string | null }> {
    const r = await db.streak.findUnique({ where: { userId: idFromString(userId) } })
    return r ? { current: r.current, best: r.best, lastActivityDate: r.lastActivityDate ? dayOf(r.lastActivityDate) : null } : { current: 0, best: 0, lastActivityDate: null }
  }

  /** Read plus row lock: serialises the conversions of one wallet while the caller validates the amount against the balance. */
  async lockWallet(db: Db, userId: string): Promise<LockedWallet | null> {
    const rows = await db.$queryRaw<{ userId: bigint; tierId: bigint | null; currentSyiling: number; tokenBalance: number }[]>`
      SELECT user_id AS "userId", tier_id AS "tierId", current_syiling AS "currentSyiling", token_balance AS "tokenBalance"
        FROM wallets WHERE user_id = ${idFromString(userId)} FOR UPDATE`
    const r = rows[0]
    return r ? { userId: idToString(r.userId), tierId: r.tierId === null ? null : idToString(r.tierId), currentSyiling: r.currentSyiling, tokenBalance: r.tokenBalance } : null
  }

  async walletTierId(db: Db, userId: string): Promise<string | null> {
    const w = await db.wallet.findUnique({ where: { userId: idFromString(userId) }, select: { tierId: true } })
    return w?.tierId === null || w?.tierId === undefined ? null : idToString(w.tierId)
  }

  async ledgerRecent(db: Db, userId: string, take: number): Promise<LedgerRecord[]> {
    const rows = await db.coinLedger.findMany({ where: { userId: idFromString(userId) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take })
    return rows.map((r) => ({
      id: idToString(r.id),
      userId: idToString(r.userId),
      type: r.type,
      amount: r.amount,
      balanceAfter: r.balanceAfter,
      source: r.source,
      sourceId: r.sourceId,
      tokens: r.tokens,
      description: r.description,
      createdAt: r.createdAt,
    }))
  }

  async ledgerByKey(db: Db, userId: string, source: string, sourceId: string): Promise<LedgerRecord | null> {
    const r = await db.coinLedger.findFirst({ where: { userId: idFromString(userId), source, sourceId } })
    return r
      ? { id: idToString(r.id), userId: idToString(r.userId), type: r.type, amount: r.amount, balanceAfter: r.balanceAfter, source: r.source, sourceId: r.sourceId, tokens: r.tokens, description: r.description, createdAt: r.createdAt }
      : null
  }

  // --- rankings and national figures (rows other people may see) -----------------------------------

  /** Top `limit` visible wallets by lifetime syiling (ties: oldest wallet, then id), BR-M14-17. */
  async leaderboard(db: Db, limit: number): Promise<RankedWallet[]> {
    const rows = await db.$queryRaw<
      { userId: bigint; name: string; tierKey: string | null; tierLabel: string | null; tierIcon: string | null; tierColor: string | null; level: number; total: bigint }[]
    >`${VISIBLE_WALLETS}
      SELECT vw.user_id AS "userId", u.name, t.tier_name AS "tierKey", t.label_ms AS "tierLabel", t.icon AS "tierIcon", t.color AS "tierColor",
             vw.level::int AS level, vw.shown_total AS total
        FROM vw JOIN users u ON u.id = vw.user_id LEFT JOIN tiers t ON t.id = vw.tier_id
       ORDER BY vw.shown_total DESC, vw.created_at ASC, vw.id ASC
       LIMIT ${limit}`
    return rows.map((r) => ({
      userId: idToString(r.userId),
      name: r.name,
      tierKey: r.tierKey ?? '',
      tierLabel: r.tierLabel ?? r.tierKey ?? '',
      tierIcon: r.tierIcon ?? '',
      tierColor: r.tierColor ?? '',
      level: r.level,
      total: num(r.total),
    }))
  }

  async nationalFigures(db: Db): Promise<{ wallets: number; syilingGenerated: number; byTier: Map<string, number> }> {
    const totals = await db.$queryRaw<{ n: bigint; sum: bigint | null }[]>`${VISIBLE_WALLETS} SELECT count(*)::bigint AS n, COALESCE(SUM(shown_total), 0)::bigint AS sum FROM vw`
    const tiers = await db.$queryRaw<{ tierId: bigint | null; n: bigint }[]>`${VISIBLE_WALLETS} SELECT tier_id AS "tierId", count(*)::bigint AS n FROM vw GROUP BY tier_id`
    const byTier = new Map<string, number>()
    for (const t of tiers) if (t.tierId !== null) byTier.set(idToString(t.tierId), num(t.n))
    return { wallets: num(totals[0]?.n), syilingGenerated: num(totals[0]?.sum), byTier }
  }

  /** Conversions and the tokens paid by them (real rows only). */
  async conversionFigures(db: Db): Promise<{ conversions: number; tokens: number }> {
    const rows = await db.$queryRaw<{ n: bigint; tokens: bigint | null }[]>`
      SELECT count(*)::bigint AS n, COALESCE(SUM(tokens), 0)::bigint AS tokens FROM coin_ledger WHERE source = 'token_conversion' AND NOT is_test`
    return { conversions: num(rows[0]?.n), tokens: num(rows[0]?.tokens) }
  }

  /** Users whose real completions of `day` cover every active challenge. */
  async dailyFinishers(db: Db, day: string): Promise<number> {
    const rows = await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM (
        SELECT cc.user_id FROM challenge_completions cc JOIN challenges c ON c.id = cc.challenge_id AND c.is_active
         WHERE cc.completion_date = ${day}::date AND NOT cc.is_test
         GROUP BY cc.user_id
        HAVING count(DISTINCT cc.challenge_id) = (SELECT count(*) FROM challenges WHERE is_active)) x`
    return num(rows[0]?.n)
  }

  async recentLedger(db: Db, take: number): Promise<{ name: string; type: string; amount: number; source: string; createdAt: Date }[]> {
    const rows = await db.$queryRaw<{ name: string; type: string; amount: number; source: string; createdAt: Date }[]>`
      SELECT u.name, l.type, l.amount, l.source, l.created_at AS "createdAt"
        FROM coin_ledger l JOIN users u ON u.id = l.user_id
       WHERE NOT l.is_test
       ORDER BY l.created_at DESC, l.id DESC LIMIT ${take}`
    return rows
  }

  // --- admin lists (every wallet and every ledger row: the audit view) ------------------------------

  async adminStudents(db: Db, filter: { search: string; tier: string; sort: StudentSort; page: number; pageSize: number }): Promise<{ rows: AdminStudentRow[]; total: number }> {
    const conds: Prisma.Sql[] = []
    if (filter.tier) conds.push(Prisma.sql`t.tier_name = ${filter.tier}`)
    const term = filter.search.trim()
    if (term !== '') {
      const like = `%${escapeLike(term)}%`
      conds.push(Prisma.sql`(u.name ILIKE ${like} ESCAPE '\\' OR u.email ILIKE ${like} ESCAPE '\\')`)
    }
    const where = conds.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.empty
    const column = SORT_COLUMN[filter.sort]
    const second = filter.sort === 'total_syiling_earned' ? Prisma.empty : Prisma.sql`w.total_syiling_earned DESC,`
    const from = Prisma.sql`FROM wallets w JOIN users u ON u.id = w.user_id LEFT JOIN tiers t ON t.id = w.tier_id ${where}`
    const totalRows = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n ${from}`
    const rows = await db.$queryRaw<
      { userId: bigint; name: string; email: string | null; tierKey: string | null; tierColor: string | null; level: number; currentSyiling: number; tokenBalance: number; totalSyilingEarned: number; xp: number }[]
    >`SELECT w.user_id AS "userId", u.name, u.email, t.tier_name AS "tierKey", t.color AS "tierColor", w.level::int AS level,
             w.current_syiling AS "currentSyiling", w.token_balance AS "tokenBalance", w.total_syiling_earned AS "totalSyilingEarned", w.xp
        ${from}
       ORDER BY ${Prisma.raw(column)} DESC, ${second} w.created_at ASC, w.id ASC
       LIMIT ${filter.pageSize} OFFSET ${(filter.page - 1) * filter.pageSize}`
    return {
      total: num(totalRows[0]?.n),
      rows: rows.map((r) => ({
        userId: idToString(r.userId),
        name: r.name,
        email: r.email ?? '',
        tierKey: r.tierKey ?? '',
        tierColor: r.tierColor ?? '',
        level: r.level,
        currentSyiling: r.currentSyiling,
        tokenBalance: r.tokenBalance,
        totalSyilingEarned: r.totalSyilingEarned,
        xp: r.xp,
      })),
    }
  }

  async adminTransactions(
    db: Db,
    filter: { type: string; from: Date | null; toExclusive: Date | null; page: number; pageSize: number },
  ): Promise<{ rows: (LedgerRecord & { name: string })[]; total: number }> {
    const conds: Prisma.Sql[] = []
    if (filter.type) conds.push(Prisma.sql`l.type = ${filter.type}`)
    if (filter.from) conds.push(Prisma.sql`l.created_at >= ${filter.from}::timestamptz`)
    if (filter.toExclusive) conds.push(Prisma.sql`l.created_at < ${filter.toExclusive}::timestamptz`)
    const where = conds.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.empty
    const totalRows = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM coin_ledger l ${where}`
    const rows = await db.$queryRaw<
      { id: bigint; userId: bigint; name: string; type: string; amount: number; balanceAfter: number; source: string; sourceId: string | null; tokens: number | null; description: string; createdAt: Date }[]
    >`SELECT l.id, l.user_id AS "userId", u.name, l.type, l.amount, l.balance_after AS "balanceAfter", l.source, l.source_id AS "sourceId", l.tokens, l.description, l.created_at AS "createdAt"
        FROM coin_ledger l JOIN users u ON u.id = l.user_id ${where}
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT ${filter.pageSize} OFFSET ${(filter.page - 1) * filter.pageSize}`
    return {
      total: num(totalRows[0]?.n),
      rows: rows.map((r) => ({ ...r, id: idToString(r.id), userId: idToString(r.userId) })),
    }
  }

  // --- settings, syiling rewards, claims, draws ----------------------------------------------------

  async settings(db: Db): Promise<{ key: string; label: string; value: number }[]> {
    const rows = await db.gamificationSetting.findMany()
    return rows.map((r) => ({ key: r.key, label: r.label, value: r.value.toNumber() }))
  }

  async settingValue(db: Db, key: string): Promise<number> {
    const r = await db.gamificationSetting.findUnique({ where: { key } })
    return r ? r.value.toNumber() : 0
  }

  async saveSetting(db: Db, key: string, value: number, at: Date): Promise<boolean> {
    const r = await db.gamificationSetting.updateMany({ where: { key }, data: { value, updatedAt: at } })
    return r.count === 1
  }

  async syilingRewards(db: Db): Promise<SyilingRewardRecord[]> {
    const rows = await db.syilingReward.findMany({ orderBy: { id: 'asc' } })
    return rows.map((r) => ({ id: idToString(r.id), name: r.name, type: r.type, priceSyiling: r.priceSyiling, costValueSen: r.costValueSen }))
  }

  async setRewardCost(db: Db, id: bigint, costValueSen: number, at: Date): Promise<SyilingRewardRecord | null> {
    const r = await db.syilingReward.updateMany({ where: { id }, data: { costValueSen, updatedAt: at } })
    if (r.count === 0) return null
    const row = await db.syilingReward.findUnique({ where: { id } })
    return row ? { id: idToString(row.id), name: row.name, type: row.type, priceSyiling: row.priceSyiling, costValueSen: row.costValueSen } : null
  }

  /** Claims whose `claimed_at` falls in `[from, to)`: count, distinct students and the summed cost snapshot (G-18). */
  async claimTiles(db: Db, from: Date, to: Date): Promise<{ claims: number; students: number; costSen: number }> {
    const rows = await db.$queryRaw<{ claims: bigint; students: bigint; cost: bigint | null }[]>`
      SELECT count(*)::bigint AS claims, count(DISTINCT user_id)::bigint AS students, COALESCE(SUM(cost_value_sen), 0)::bigint AS cost
        FROM reward_claims WHERE claimed_at >= ${from}::timestamptz AND claimed_at < ${to}::timestamptz`
    return { claims: num(rows[0]?.claims), students: num(rows[0]?.students), costSen: num(rows[0]?.cost) }
  }

  async draws(db: Db): Promise<DrawRecord[]> {
    const rows = await db.draw.findMany({ orderBy: { id: 'desc' }, include: { prizes: { orderBy: { position: 'asc' } }, _count: { select: { tickets: true } } } })
    return rows.map((d) => toDraw(d, d._count.tickets))
  }

  /** Row lock on the draw (`FOR UPDATE`): a ticket purchase (`FOR SHARE`) cannot slip in between the ticket read and the close. */
  async lockDraw(db: Db, id: bigint): Promise<void> {
    await db.$queryRaw(Prisma.sql`SELECT id FROM draws WHERE id = ${id} FOR UPDATE`)
  }

  async draw(db: Db, id: bigint): Promise<DrawRecord | null> {
    const d = await db.draw.findUnique({ where: { id }, include: { prizes: { orderBy: { position: 'asc' } }, _count: { select: { tickets: true } } } })
    return d ? toDraw(d, d._count.tickets) : null
  }

  /** The draw and its ordered prize rows (position 0..n-1), in one go; the caller owns the transaction. */
  async createDraw(
    db: Db,
    input: { title: string; description: string; ticketCostSyiling: number; maxTicketsPerStudent: number; closesAt: Date | null; status: string; prizes: readonly PrizeLine[] },
    at: Date,
  ): Promise<DrawRecord> {
    const draw = await db.draw.create({
      data: {
        title: input.title,
        description: input.description,
        ticketCostSyiling: input.ticketCostSyiling,
        maxTicketsPerStudent: input.maxTicketsPerStudent,
        closesAt: input.closesAt,
        status: input.status,
        createdAt: at,
        updatedAt: at,
      },
    })
    if (input.prizes.length > 0) {
      await db.drawPrize.createMany({ data: input.prizes.map((p, position) => ({ drawId: draw.id, label: p.label, valueSen: p.valueSen, qty: p.qty, position, createdAt: at, updatedAt: at })) })
    }
    const created = await this.draw(db, draw.id)
    if (!created) throw new Error('GamificationRepository: the draw is missing after it was created')
    return created
  }

  /** Tickets of a draw as one entry per ticket row (ticket id, user), oldest first. */
  async ticketsOf(db: Db, drawId: bigint): Promise<{ id: string; userId: string }[]> {
    const rows = await db.drawTicket.findMany({ where: { drawId }, orderBy: { id: 'asc' }, select: { id: true, userId: true } })
    return rows.map((r) => ({ id: idToString(r.id), userId: idToString(r.userId) }))
  }

  /** Closes a draw: only an `open` draw closes (zero rows = somebody else did). */
  async closeDraw(db: Db, id: bigint, winnerUserId: string | null, at: Date): Promise<boolean> {
    const r = await db.draw.updateMany({
      where: { id, status: 'open' },
      data: { status: 'closed', drawnAt: at, winnerUserId: winnerUserId === null ? null : idFromString(winnerUserId), updatedAt: at },
    })
    return r.count === 1
  }

  // --- reads for BE-19's reports (PerformanceGamificationAdapter) ---------------------------------

  /** Wallet level, syiling and cached tier of many users in one read; users without a wallet row are absent. */
  async levelsOf(db: Db, userIds: readonly string[]): Promise<Map<string, { level: number; syiling: number; tierId: string | null }>> {
    const out = new Map<string, { level: number; syiling: number; tierId: string | null }>()
    const ids = userIds.flatMap((id) => {
      try {
        return [idFromString(id)]
      } catch {
        return []
      }
    })
    if (ids.length === 0) return out
    const rows = await db.wallet.findMany({ where: { userId: { in: ids } }, select: { userId: true, level: true, currentSyiling: true, tierId: true } })
    for (const r of rows) out.set(idToString(r.userId), { level: r.level, syiling: r.currentSyiling, tierId: r.tierId === null ? null : idToString(r.tierId) })
    return out
  }

  /** Streaks of many users in one read; users without a row are absent. */
  async streaksOf(db: Db, userIds: readonly string[]): Promise<Map<string, { current: number; best: number }>> {
    const out = new Map<string, { current: number; best: number }>()
    const ids = userIds.flatMap((id) => {
      try {
        return [idFromString(id)]
      } catch {
        return []
      }
    })
    if (ids.length === 0) return out
    const rows = await db.streak.findMany({ where: { userId: { in: ids } }, select: { userId: true, current: true, best: true } })
    for (const r of rows) out.set(idToString(r.userId), { current: r.current, best: r.best })
    return out
  }

  /** The achievements a user has unlocked for real (not under Mod Pelajar), oldest first. */
  async badgesOf(db: Db, userId: string): Promise<{ key: string; name: string; earnedAt: Date }[]> {
    const rows = await db.userAchievement.findMany({
      where: { userId: idFromString(userId), isTest: false },
      include: { achievement: { select: { name: true } } },
      orderBy: [{ unlockedAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((r) => ({ key: idToString(r.achievementId), name: r.achievement.name, earnedAt: r.unlockedAt }))
  }
}
