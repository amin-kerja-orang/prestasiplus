import { Inject, Injectable } from '@nestjs/common'

import type { PrismaClient, TxClient } from '../../db/client'
import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import type { TierLike } from './rules'

/** A transaction handle or the plain client. Writes only make sense on a handle that is in a transaction. */
export type Db = TxClient | PrismaClient

export interface TierRow extends TierLike {
  labelMs: string
  icon: string
  color: string
  conversionRate: number
}

export interface WalletRow {
  id: string
  userId: string
  tierId: string | null
  currentSyiling: number
  totalSyilingEarned: number
  tokenBalance: number
  xp: number
  level: number
  createdAt: Date
}

export interface LedgerRow {
  id: string
  userId: string
  type: string
  source: string
  sourceId: string | null
  tokens: number | null
  amount: number
  balanceAfter: number
  description: string
  isTest: boolean
  createdAt: Date
}

export interface NewLedgerRow {
  userId: string
  type: string
  source: string
  sourceId: string | null
  tokens: number | null
  amount: number
  balanceAfter: number
  description: string
  isTest: boolean
  createdAt: Date
}

export interface StreakRow {
  current: number
  best: number
  /** Malaysia day `YYYY-MM-DD`. */
  lastActivityDate: string | null
  totalDays: number
}

export interface SessionCreditRow {
  sessionId: string
  userId: string
  coinsEarned: number
  pointsEarned: number
  streakCount: number
  totalBalance: number
  completedAt: Date
}

interface RawWallet {
  id: bigint
  userId: bigint
  tierId: bigint | null
  currentSyiling: number
  totalSyilingEarned: number
  tokenBalance: number
  xp: number
  level: number
  createdAt: Date
}

interface RawStreak {
  current: number
  best: number
  lastActivityDate: string | null
  totalDays: number
}

const toWallet = (r: RawWallet): WalletRow => ({
  id: idToString(r.id),
  userId: idToString(r.userId),
  tierId: r.tierId === null ? null : idToString(r.tierId),
  currentSyiling: r.currentSyiling,
  totalSyilingEarned: r.totalSyilingEarned,
  tokenBalance: r.tokenBalance,
  xp: r.xp,
  level: r.level,
  createdAt: r.createdAt,
})

const toLedger = (r: {
  id: bigint
  userId: bigint
  type: string
  source: string
  sourceId: string | null
  tokens: number | null
  amount: number
  balanceAfter: number
  description: string
  isTest: boolean
  createdAt: Date
}): LedgerRow => ({
  id: idToString(r.id),
  userId: idToString(r.userId),
  type: r.type,
  source: r.source,
  sourceId: r.sourceId,
  tokens: r.tokens,
  amount: r.amount,
  balanceAfter: r.balanceAfter,
  description: r.description,
  isTest: r.isTest,
  createdAt: r.createdAt,
})

const dayOf = (d: Date): string => d.toISOString().slice(0, 10)
/** A `date` column is read and written as UTC midnight of the calendar day. */
const dayDate = (day: string): Date => new Date(`${day}T00:00:00Z`)

/**
 * The only doorway to the wallet tables (ADR-0014). Every method takes the `Db` handle of the
 * caller's transaction, so a credit is atomic with the caller's other writes.
 *
 * `coin_ledger` is APPEND-ONLY: this class has `appendLedger` and reads, and no method that updates,
 * deletes or upserts a ledger row (test/wallet/append-only.spec.ts reads this file and the class to
 * keep it so). The database refuses the same statements with a trigger.
 */
@Injectable()
export class WalletRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** The handle to use when the caller gave none: the ambient transaction, else the plain client. */
  handle(db?: Db): Db {
    return db ?? this.prisma.client
  }

  // --- tiers -------------------------------------------------------------------------------------

  async tiers(db: Db): Promise<TierRow[]> {
    const rows = await db.tier.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] })
    return rows.map((t) => ({
      id: idToString(t.id),
      tierName: t.tierName,
      labelMs: t.labelMs,
      icon: t.icon,
      color: t.color,
      minSyiling: t.minSyiling,
      conversionRate: t.conversionRate.toNumber(),
      sortOrder: t.sortOrder,
      isActive: t.isActive,
    }))
  }

  // --- wallets -----------------------------------------------------------------------------------

  /** Plain read, no lock. */
  async wallet(db: Db, userId: string): Promise<WalletRow | null> {
    const r = await db.wallet.findUnique({ where: { userId: idFromString(userId) } })
    return r ? toWallet(r) : null
  }

  /** Set-based read of the current syiling balance of many users (no wallet row: absent from the map). One query per call. */
  async balancesOf(db: Db, userIds: readonly string[]): Promise<Map<string, number>> {
    const rows = await db.wallet.findMany({
      where: { userId: { in: userIds.map((u) => idFromString(u)) } },
      select: { userId: true, currentSyiling: true },
    })
    return new Map(rows.map((r) => [idToString(r.userId), r.currentSyiling]))
  }

  /** Creates the wallet when it does not exist (BR-M14-02: the first credit creates it). Safe under a race. */
  async ensureWallet(db: Db, userId: string, tierId: string | null, at: Date): Promise<void> {
    await db.$executeRaw`
      INSERT INTO wallets (user_id, tier_id, created_at, updated_at)
      VALUES (${idFromString(userId)}, ${tierId === null ? null : idFromString(tierId)}::bigint, ${at}::timestamptz, ${at}::timestamptz)
      ON CONFLICT (user_id) DO NOTHING`
  }

  /** Reads the wallet and locks its row until the transaction ends: every balance change of a user is serialised here. */
  async lockWallet(db: Db, userId: string): Promise<WalletRow | null> {
    const rows = await db.$queryRaw<RawWallet[]>`
      SELECT id, user_id AS "userId", tier_id AS "tierId", current_syiling AS "currentSyiling",
             total_syiling_earned AS "totalSyilingEarned", token_balance AS "tokenBalance", xp, level::int AS level,
             created_at AS "createdAt"
        FROM wallets WHERE user_id = ${idFromString(userId)} FOR UPDATE`
    return rows[0] ? toWallet(rows[0]) : null
  }

  async saveWallet(
    db: Db,
    userId: string,
    patch: { currentSyiling?: number; totalSyilingEarned?: number; tokenBalance?: number; xp?: number; tierId?: string | null },
    at: Date,
  ): Promise<void> {
    await db.wallet.update({
      where: { userId: idFromString(userId) },
      data: {
        ...(patch.currentSyiling !== undefined ? { currentSyiling: patch.currentSyiling } : {}),
        ...(patch.totalSyilingEarned !== undefined ? { totalSyilingEarned: patch.totalSyilingEarned } : {}),
        ...(patch.tokenBalance !== undefined ? { tokenBalance: patch.tokenBalance } : {}),
        ...(patch.xp !== undefined ? { xp: patch.xp } : {}),
        ...(patch.tierId !== undefined ? { tierId: patch.tierId === null ? null : idFromString(patch.tierId) } : {}),
        updatedAt: at,
      },
    })
  }

  // --- ledger (append-only) ----------------------------------------------------------------------

  async appendLedger(db: Db, row: NewLedgerRow): Promise<LedgerRow> {
    const r = await db.coinLedger.create({
      data: {
        userId: idFromString(row.userId),
        type: row.type,
        source: row.source,
        sourceId: row.sourceId,
        tokens: row.tokens,
        amount: row.amount,
        balanceAfter: row.balanceAfter,
        description: row.description,
        isTest: row.isTest,
        createdAt: row.createdAt,
      },
    })
    return toLedger(r)
  }

  /** The row that already holds this idempotency key, if any. */
  async ledgerByKey(db: Db, userId: string, source: string, sourceId: string): Promise<LedgerRow | null> {
    const r = await db.coinLedger.findFirst({ where: { userId: idFromString(userId), source, sourceId } })
    return r ? toLedger(r) : null
  }

  /** Newest first (`created_at` desc, then `id` desc, BR-M14-33), at most `limit` rows. `type` null = all types. */
  async ledgerOf(db: Db, userId: string, type: string | null, limit: number): Promise<LedgerRow[]> {
    const rows = await db.coinLedger.findMany({
      where: { userId: idFromString(userId), ...(type ? { type } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })
    return rows.map(toLedger)
  }

  /** BR-M14-07: the sum of the user's positive amounts with `created_at` in `[from, to)`. */
  async earnedBetween(db: Db, userId: string, from: Date, to: Date): Promise<number> {
    const r = await db.coinLedger.aggregate({
      _sum: { amount: true },
      where: { userId: idFromString(userId), amount: { gt: 0 }, createdAt: { gte: from, lt: to } },
    })
    return r._sum.amount ?? 0
  }

  // --- token movements ---------------------------------------------------------------------------

  async appendTokenMovement(
    db: Db,
    row: { userId: string; delta: number; source: string; refId: string | null; isTest: boolean; createdAt: Date },
  ): Promise<void> {
    await db.tokenMovement.create({
      data: { userId: idFromString(row.userId), delta: row.delta, source: row.source, refId: row.refId, isTest: row.isTest, createdAt: row.createdAt },
    })
  }

  /** The movement that already holds this idempotency key `(user, source, ref_id)`, if any. */
  async tokenMovementByKey(db: Db, userId: string, source: string, refId: string): Promise<{ delta: number } | null> {
    const r = await db.tokenMovement.findFirst({ where: { userId: idFromString(userId), source, refId }, select: { delta: true } })
    return r ? { delta: r.delta } : null
  }

  // --- streak ------------------------------------------------------------------------------------

  async streak(db: Db, userId: string): Promise<StreakRow | null> {
    const r = await db.streak.findUnique({ where: { userId: idFromString(userId) } })
    return r ? { current: r.current, best: r.best, lastActivityDate: r.lastActivityDate ? dayOf(r.lastActivityDate) : null, totalDays: r.totalDays } : null
  }

  async ensureStreak(db: Db, userId: string, at: Date): Promise<void> {
    await db.$executeRaw`
      INSERT INTO streaks (user_id, created_at, updated_at)
      VALUES (${idFromString(userId)}, ${at}::timestamptz, ${at}::timestamptz)
      ON CONFLICT (user_id) DO NOTHING`
  }

  async lockStreak(db: Db, userId: string): Promise<StreakRow | null> {
    const rows = await db.$queryRaw<RawStreak[]>`
      SELECT "current", "best", last_activity_date::text AS "lastActivityDate", total_days AS "totalDays"
        FROM streaks WHERE user_id = ${idFromString(userId)} FOR UPDATE`
    return rows[0] ?? null
  }

  async saveStreak(db: Db, userId: string, s: StreakRow, at: Date): Promise<void> {
    await db.streak.update({
      where: { userId: idFromString(userId) },
      data: {
        current: s.current,
        best: s.best,
        lastActivityDate: s.lastActivityDate === null ? null : dayDate(s.lastActivityDate),
        totalDays: s.totalDays,
        updatedAt: at,
      },
    })
  }

  /** True when this call wrote the mark (the first login of the Malaysia day), false when it already existed. */
  async insertDailyLoginMark(db: Db, userId: string, day: string, at: Date): Promise<boolean> {
    const rows = await db.$queryRaw<{ id: bigint }[]>`
      INSERT INTO daily_login_marks (user_id, mark_date, created_at)
      VALUES (${idFromString(userId)}, ${day}::date, ${at}::timestamptz)
      ON CONFLICT (user_id, mark_date) DO NOTHING
      RETURNING id`
    return rows.length === 1
  }

  // --- session credits ---------------------------------------------------------------------------

  /** True when this call stored the result, false when the session already had one (the stored one is kept). */
  async insertSessionCredit(db: Db, row: SessionCreditRow & { isTest: boolean }, at: Date): Promise<boolean> {
    const rows = await db.$queryRaw<{ id: bigint }[]>`
      INSERT INTO session_credits (session_id, user_id, coins_earned, points_earned, streak_count, total_balance, completed_at, is_test, created_at)
      VALUES (${row.sessionId}::uuid, ${idFromString(row.userId)}, ${row.coinsEarned}, ${row.pointsEarned}, ${row.streakCount}, ${row.totalBalance},
              ${row.completedAt}::timestamptz, ${row.isTest}, ${at}::timestamptz)
      ON CONFLICT (session_id) DO NOTHING
      RETURNING id`
    return rows.length === 1
  }

  async sessionCredit(db: Db, sessionId: string): Promise<SessionCreditRow | null> {
    const r = await db.sessionCredit.findUnique({ where: { sessionId } })
    return r
      ? {
          sessionId: r.sessionId,
          userId: idToString(r.userId),
          coinsEarned: r.coinsEarned,
          pointsEarned: r.pointsEarned,
          streakCount: r.streakCount,
          totalBalance: r.totalBalance,
          completedAt: r.completedAt,
        }
      : null
  }
}
