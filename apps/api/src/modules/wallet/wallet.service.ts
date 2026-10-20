import { Inject, Injectable } from '@nestjs/common'
import type {
  WalletGamificationSummary,
  WalletLedgerEntry,
  WalletLedgerType,
  WalletSummary,
  WalletTransactionsResponse,
} from '@pp/contract'
import { WALLET_LEDGER_TYPES } from '@pp/contract'

import { toMytTimestamp } from '../../common/time/myt'
import type { TxClient } from '../../db/client'
import { CLOCK, type Clock, startOfMytDay } from '../../db/clock'
import { isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { insufficientBalance } from './errors'
import { levelProgressPct, nextTierOf, nextTierProgress, nextTitleOf, titleOf, upgradedTierId, defaultTier, xpNeeded } from './rules'
import {
  CREDIT_TYPES,
  DEBIT_TYPES,
  DESCRIPTION_MAX,
  INT_MAX,
  SOURCE_ID_MAX,
  SOURCE_MAX,
  STREAK_MULTIPLIER,
  type CreditType,
  type DebitType,
} from './wallet.constants'
import { WalletRepository, type Db, type LedgerRow, type TierRow, type WalletRow } from './wallet.repository'
import type { CreditInput, DebitInput, LedgerOutcome, SessionCreditInput, SessionCreditResult, TokenInput } from './wallet.types'

const DAY_MS = 86_400_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** BR-M14-02 defaults for a user without a wallet row. */
const EMPTY_WALLET = { currentSyiling: 0, totalSyilingEarned: 0, tokenBalance: 0, xp: 0, level: 1 } as const

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0

function assertUser(userId: string): void {
  if (!isIdString(userId)) throw new RangeError('WalletService: invalid user id')
}

function assertText(value: string, max: number, what: string): void {
  if (typeof value !== 'string' || value.length < 1 || value.length > max) throw new RangeError(`WalletService: ${what} must be 1 to ${String(max)} characters`)
}

function assertKey(source: string, sourceId: string | null | undefined, description: string): void {
  assertText(source, SOURCE_MAX, 'source')
  if (sourceId !== undefined && sourceId !== null) assertText(sourceId, SOURCE_ID_MAX, 'sourceId')
  assertText(description, DESCRIPTION_MAX, 'description')
}

/** Monday 00:00 of the Malaysia week that contains `at`, as an instant (the week is Monday to Sunday, BR-M14-07). */
function startOfMytWeek(at: Date): Date {
  const day = startOfMytDay(at)
  const weekday = new Date(day.getTime() + 8 * 3_600_000).getUTCDay() // 0 = Sunday ... 6 = Saturday, read on the Malaysia calendar day
  return new Date(day.getTime() - ((weekday + 6) % 7) * DAY_MS)
}

const tierView = (t: TierRow) => ({
  key: t.tierName,
  labelMs: t.labelMs,
  icon: t.icon,
  color: t.color,
  minSyiling: t.minSyiling,
  conversionRate: t.conversionRate,
})

export const toLedgerEntry = (r: LedgerRow): WalletLedgerEntry => ({
  id: r.id,
  type: r.type as WalletLedgerType,
  amount: r.amount,
  balanceAfter: r.balanceAfter,
  source: r.source,
  description: r.description,
  createdAt: toMytTimestamp(r.createdAt),
})

/**
 * The owner of the M14 wallet (ADR-0014): the ONLY writer of `wallets`, `coin_ledger`, `token_movements` and
 * `session_credits`. Other modules (practice, Bijak SPM, missions, games, the shop) call it and never touch
 * those tables.
 *
 * TRANSACTIONS. Every write method runs in the caller's transaction so that it is atomic with the caller's
 * other work: it uses the `tx` handle when one is passed, else the ambient transaction opened by
 * `PrismaService.transaction(...)` (the same one), else it opens its own. Writes of one user are serialised by
 * a row lock on the user's wallet, so `balance_after` is always the running balance and two concurrent
 * credits with the same key write one row.
 *
 * LEDGER. `coin_ledger` is append-only: a movement is a new row, never an edit. The wallet row is a stored
 * balance kept in step with the ledger inside the same transaction (card open question 2): for rows born in
 * v2, `wallets.current_syiling` equals the sum of the user's ledger amounts (test/wallet/reconcile.spec.ts).
 *
 * MOD PELAJAR. Pass `isTest: true` when `auth.mode !== null`. The row is stamped `is_test` (it still moves the
 * balance, so the balance and the ledger agree). RULE FOR EVERY TOTAL SHOWN TO OTHERS (leaderboards, class and
 * school reports, BE-19/BE-23): sum `coin_ledger` rows with `is_test = false` only, and never show a wallet
 * whose owner is only a test actor; the owner's own wallet and ledger screens show everything.
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly repo: WalletRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // --- writes --------------------------------------------------------------------------------------

  /**
   * Adds syiling (BR-M14-22): one ledger row, balance and lifetime up, the tier moved up when a higher active
   * tier is reached (BR-M14-08, never down). Creates the wallet on the first credit (BR-M14-02).
   * Idempotent per `(userId, source, sourceId)`: a replay returns the first result and writes nothing.
   * The lifetime total grows with every credit type, as the mock does (a `refund` too).
   */
  async credit(input: CreditInput, options: { tx?: TxClient } = {}): Promise<LedgerOutcome> {
    assertUser(input.userId)
    assertKey(input.source, input.sourceId, input.description)
    const type: CreditType = input.type ?? 'earn'
    if (!(CREDIT_TYPES as readonly string[]).includes(type)) throw new RangeError('WalletService.credit: type must be earn, bonus or refund')
    if (!isPositive(input.amount)) throw new RangeError('WalletService.credit: amount must be a positive integer')
    return this.run(options.tx, async (db) => {
      const at = this.clock.now()
      const tiers = await this.repo.tiers(db)
      await this.repo.ensureWallet(db, input.userId, defaultTier(tiers)?.id ?? null, at)
      const wallet = await this.lockedWallet(db, input.userId)
      const replay = await this.replayOf(db, wallet, input.source, input.sourceId)
      if (replay) return replay
      const balance = wallet.currentSyiling + input.amount
      const lifetime = wallet.totalSyilingEarned + input.amount
      if (balance > INT_MAX || lifetime > INT_MAX) throw new RangeError('WalletService.credit: the balance would exceed the integer range')
      const tierId = upgradedTierId(tiers, wallet.tierId, balance)
      const row = await this.repo.appendLedger(db, {
        userId: input.userId,
        type,
        source: input.source,
        sourceId: input.sourceId ?? null,
        tokens: null,
        amount: input.amount,
        balanceAfter: balance,
        description: input.description,
        isTest: input.isTest ?? false,
        createdAt: at,
      })
      await this.repo.saveWallet(db, input.userId, { currentSyiling: balance, totalSyilingEarned: lifetime, tierId }, at)
      return this.outcome(row, false, { ...wallet, currentSyiling: balance, totalSyilingEarned: lifetime, tierId }, tiers)
    })
  }

  /**
   * Removes syiling (BR-M14-22, BR-M14-30): one `spend` or `convert` row with a negative amount. Refused with
   * 409 `INSUFFICIENT_BALANCE` ("Baki syiling tidak mencukupi.") when the balance is smaller than `amount`;
   * nothing is written then. Lifetime total and tier do not change. A `convert` also pays `tokens` into the
   * token balance. Idempotent per `(userId, source, sourceId)` like `credit`.
   */
  async debit(input: DebitInput, options: { tx?: TxClient } = {}): Promise<LedgerOutcome> {
    assertUser(input.userId)
    assertKey(input.source, input.sourceId, input.description)
    const type: DebitType = input.type ?? 'spend'
    if (!(DEBIT_TYPES as readonly string[]).includes(type)) throw new RangeError('WalletService.debit: type must be spend or convert')
    if (!isPositive(input.amount)) throw new RangeError('WalletService.debit: amount must be a positive integer')
    if (type === 'convert' && !isPositive(input.tokens)) throw new RangeError('WalletService.debit: a convert needs a positive integer tokens')
    if (type === 'spend' && input.tokens !== undefined) throw new RangeError('WalletService.debit: tokens belong to a convert')
    return this.run(options.tx, async (db) => {
      const at = this.clock.now()
      const wallet = await this.repo.lockWallet(db, input.userId)
      if (wallet) {
        const replay = await this.replayOf(db, wallet, input.source, input.sourceId)
        if (replay) return replay
      }
      if (!wallet || wallet.currentSyiling < input.amount) throw insufficientBalance('syiling')
      const balance = wallet.currentSyiling - input.amount
      const tokens = type === 'convert' ? (input.tokens as number) : null
      const tokenBalance = wallet.tokenBalance + (tokens ?? 0)
      if (tokenBalance > INT_MAX) throw new RangeError('WalletService.debit: the token balance would exceed the integer range')
      const row = await this.repo.appendLedger(db, {
        userId: input.userId,
        type,
        source: input.source,
        sourceId: input.sourceId ?? null,
        tokens,
        amount: -input.amount,
        balanceAfter: balance,
        description: input.description,
        isTest: input.isTest ?? false,
        createdAt: at,
      })
      await this.repo.saveWallet(db, input.userId, { currentSyiling: balance, ...(tokens === null ? {} : { tokenBalance }) }, at)
      return this.outcome(row, false, { ...wallet, currentSyiling: balance, tokenBalance }, await this.repo.tiers(db))
    })
  }

  /** Adds tokens (BR-M14-22, for example `hadiah_refund`): the token balance goes up and a `token_movements` row is logged. No ledger row. */
  async creditTokens(input: TokenInput, options: { tx?: TxClient } = {}): Promise<{ tokenBalance: number }> {
    this.assertTokenInput(input)
    return this.run(options.tx, async (db) => {
      const at = this.clock.now()
      const tiers = await this.repo.tiers(db)
      await this.repo.ensureWallet(db, input.userId, defaultTier(tiers)?.id ?? null, at)
      const wallet = await this.lockedWallet(db, input.userId)
      const tokenBalance = wallet.tokenBalance + input.amount
      if (tokenBalance > INT_MAX) throw new RangeError('WalletService.creditTokens: the token balance would exceed the integer range')
      await this.moveTokens(db, input, input.amount, tokenBalance, at)
      return { tokenBalance }
    })
  }

  /** Removes tokens (`hadiah_redeem`, `mystery_box`): 409 `INSUFFICIENT_BALANCE` ("Baki token tidak mencukupi.") when short; no ledger row. */
  async debitTokens(input: TokenInput, options: { tx?: TxClient } = {}): Promise<{ tokenBalance: number }> {
    this.assertTokenInput(input)
    return this.run(options.tx, async (db) => {
      const at = this.clock.now()
      const wallet = await this.repo.lockWallet(db, input.userId)
      if (!wallet || wallet.tokenBalance < input.amount) throw insufficientBalance('token')
      const tokenBalance = wallet.tokenBalance - input.amount
      await this.moveTokens(db, input, -input.amount, tokenBalance, at)
      return { tokenBalance }
    })
  }

  /** Adds XP without a ledger row (BR-M14-22). 0 changes nothing. `level` never changes at runtime (FR-M14-62). */
  async addXp(input: { userId: string; amount: number; isTest?: boolean }, options: { tx?: TxClient } = {}): Promise<{ xp: number }> {
    assertUser(input.userId)
    if (!isCount(input.amount)) throw new RangeError('WalletService.addXp: amount must be a non-negative integer')
    return this.run(options.tx, async (db) => {
      if (input.amount === 0) return { xp: (await this.repo.wallet(db, input.userId))?.xp ?? 0 }
      const at = this.clock.now()
      const tiers = await this.repo.tiers(db)
      await this.repo.ensureWallet(db, input.userId, defaultTier(tiers)?.id ?? null, at)
      const wallet = await this.lockedWallet(db, input.userId)
      const xp = wallet.xp + input.amount
      if (xp > INT_MAX) throw new RangeError('WalletService.addXp: xp would exceed the integer range')
      await this.repo.saveWallet(db, input.userId, { xp }, at)
      return { xp }
    })
  }

  /**
   * Stores the result of one credited session (idempotency of the session credit, mock `sessionCredits`).
   * Returns `recorded: true` the first time; a second call for the same session writes nothing and returns the
   * stored result (a retried submit never pays twice).
   */
  async recordSessionCredit(input: SessionCreditInput, options: { tx?: TxClient } = {}): Promise<{ recorded: boolean; result: SessionCreditResult }> {
    assertUser(input.userId)
    if (!UUID.test(input.sessionId)) throw new RangeError('WalletService.recordSessionCredit: sessionId must be a uuid')
    for (const key of ['coinsEarned', 'pointsEarned', 'streakCount', 'totalBalance'] as const) {
      if (!isCount(input[key])) throw new RangeError(`WalletService.recordSessionCredit: ${key} must be a non-negative integer`)
    }
    return this.run(options.tx, async (db) => {
      const recorded = await this.repo.insertSessionCredit(db, { ...input, isTest: input.isTest ?? false }, this.clock.now())
      const stored = await this.repo.sessionCredit(db, input.sessionId)
      if (!stored) throw new Error('WalletService.recordSessionCredit: the stored result is missing')
      const { coinsEarned, pointsEarned, streakCount, totalBalance } = stored
      return { recorded, result: { sessionId: stored.sessionId, coinsEarned, pointsEarned, streakCount, totalBalance } }
    })
  }

  /** The stored result of a session, or null when it has not been credited. */
  async sessionCredit(sessionId: string, options: { tx?: TxClient } = {}): Promise<SessionCreditResult | null> {
    if (!UUID.test(sessionId)) return null
    const r = await this.repo.sessionCredit(this.repo.handle(options.tx), sessionId)
    return r ? { sessionId: r.sessionId, coinsEarned: r.coinsEarned, pointsEarned: r.pointsEarned, streakCount: r.streakCount, totalBalance: r.totalBalance } : null
  }

  // --- reads (contract: packages/contract/src/wallet) -----------------------------------------------

  /** `GET /api/gamification/wallet` (mock `walletSummaryOp`): a user without a row reads the BR-M14-02 defaults; nothing is created. */
  async summary(userId: string, options: { tx?: TxClient } = {}): Promise<WalletSummary> {
    assertUser(userId)
    const db = this.repo.handle(options.tx)
    const [tiers, row, streak] = await Promise.all([this.repo.tiers(db), this.repo.wallet(db, userId), this.repo.streak(db, userId)])
    const w = row ?? EMPTY_WALLET
    const tier = (row?.tierId ? tiers.find((t) => t.id === row.tierId) : undefined) ?? defaultTier(tiers)
    if (!tier) throw new Error('M14: no tier is defined')
    const next = nextTierOf(tiers, tier.id)
    const now = this.clock.now()
    const dayStart = startOfMytDay(now)
    const weekStart = startOfMytWeek(now)
    const [earnedToday, earnedThisWeek] = row
      ? await Promise.all([
          this.repo.earnedBetween(db, userId, dayStart, new Date(dayStart.getTime() + DAY_MS)),
          this.repo.earnedBetween(db, userId, weekStart, new Date(weekStart.getTime() + 7 * DAY_MS)),
        ])
      : [0, 0]
    return {
      userId,
      currentSyiling: w.currentSyiling,
      totalSyilingEarned: w.totalSyilingEarned,
      tokenBalance: w.tokenBalance,
      xp: w.xp,
      level: w.level,
      xpNeeded: xpNeeded(w.level),
      levelProgressPct: levelProgressPct(w.xp, w.level),
      tier: tierView(tier),
      nextTier: next ? { ...tierView(next), ...nextTierProgress(w.currentSyiling, next) } : null,
      title: titleOf(w.totalSyilingEarned),
      nextTitle: nextTitleOf(w.totalSyilingEarned),
      earnedToday,
      earnedThisWeek,
      streak: { current: streak?.current ?? 0, best: streak?.best ?? 0, multiplier: STREAK_MULTIPLIER },
    }
  }

  /**
   * `GET /api/gamification/transactions`: every ledger row of the user, newest first (`created_at` desc, `id`
   * desc, BR-M14-33), not paginated (contract OQ-API-B4-2). `type` empty = all; a value outside the five
   * types is not an error and gives no rows (FR-M14-08). `meta.type` echoes the query.
   */
  async transactions(userId: string, type: string, options: { tx?: TxClient } = {}): Promise<WalletTransactionsResponse> {
    assertUser(userId)
    const db = this.repo.handle(options.tx)
    const known = type === '' || (WALLET_LEDGER_TYPES as readonly string[]).includes(type)
    const [rows, wallet] = await Promise.all([known ? this.repo.ledgerOf(db, userId, type || null) : Promise.resolve([]), this.repo.wallet(db, userId)])
    return { data: rows.map(toLedgerEntry), meta: { currentSyiling: wallet?.currentSyiling ?? 0, type } }
  }

  /** `GET /api/me/gamification-summary` (app shell chips): coins, points (xp) and streak days; 0 / 0 / 0 without rows. */
  async gamificationSummary(userId: string, options: { tx?: TxClient } = {}): Promise<WalletGamificationSummary> {
    assertUser(userId)
    const db = this.repo.handle(options.tx)
    const [wallet, streak] = await Promise.all([this.repo.wallet(db, userId), this.repo.streak(db, userId)])
    return { coins: wallet?.currentSyiling ?? 0, points: wallet?.xp ?? 0, streakDays: streak?.current ?? 0 }
  }

  // --- internals -----------------------------------------------------------------------------------

  private run<T>(tx: TxClient | undefined, fn: (db: Db) => Promise<T>): Promise<T> {
    return tx ? fn(tx) : this.prisma.transaction((t) => fn(t))
  }

  private async lockedWallet(db: Db, userId: string): Promise<WalletRow> {
    const wallet = await this.repo.lockWallet(db, userId)
    if (!wallet) throw new Error('WalletService: the wallet row is missing after it was ensured')
    return wallet
  }

  /** The first result of an idempotency key, or null when the key is new (or there is none). */
  private async replayOf(db: Db, wallet: WalletRow, source: string, sourceId: string | null | undefined): Promise<LedgerOutcome | null> {
    if (sourceId === undefined || sourceId === null) return null
    const first = await this.repo.ledgerByKey(db, wallet.userId, source, sourceId)
    return first ? this.outcome(first, true, wallet, await this.repo.tiers(db)) : null
  }

  private outcome(row: LedgerRow, replayed: boolean, wallet: Pick<WalletRow, 'currentSyiling' | 'totalSyilingEarned' | 'tokenBalance' | 'tierId'>, tiers: TierRow[]): LedgerOutcome {
    return {
      replayed,
      entryId: row.id,
      type: row.type,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      currentSyiling: wallet.currentSyiling,
      totalSyilingEarned: wallet.totalSyilingEarned,
      tokenBalance: wallet.tokenBalance,
      tierKey: (wallet.tierId ? tiers.find((t) => t.id === wallet.tierId) : undefined)?.tierName ?? null,
    }
  }

  private assertTokenInput(input: TokenInput): void {
    assertUser(input.userId)
    assertText(input.source, SOURCE_MAX, 'source')
    if (input.refId !== undefined && input.refId !== null) assertText(input.refId, SOURCE_ID_MAX, 'refId')
    if (!isPositive(input.amount)) throw new RangeError('WalletService: token amount must be a positive integer')
  }

  private async moveTokens(db: Db, input: TokenInput, delta: number, tokenBalance: number, at: Date): Promise<void> {
    await this.repo.saveWallet(db, input.userId, { tokenBalance }, at)
    await this.repo.appendTokenMovement(db, { userId: input.userId, delta, source: input.source, refId: input.refId ?? null, isTest: input.isTest ?? false, createdAt: at })
  }
}
