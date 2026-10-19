/**
 * Internal store operations shared by the M14 repositories. They write M14 stores directly, so they
 * must only run inside an M14 repository method (owner scope, D12 guard) — never from a handler or
 * another module. Every public write goes through `tx(...)` (one mock transaction, BR-M14-30).
 */

import { dayRange, toEpochMs, toIsoMyt, weekRange, type DateInput } from '@/lib/time'

import { primeM14Datasets } from '../datasets'
import { ledgerDataset } from '../datasets/ledger'
import { walletPrimeOrNull, ledgerPrimeOrNull } from '../datasets/prime'
import { walletsDataset } from '../datasets/wallets'
import {
  challengesTable,
  completionsTable,
  settingsTable,
  streaksTable,
  teacherLedgerTable,
  teacherWalletsTable,
  tiersTable,
  tokenMovementsTable,
} from '../tables/tables'
import type { EngineWallet } from './engine'
import { M14Error } from './errors'
import { m14Now } from './reads'
import {
  EMPTY_STREAK,
  STREAK_MULTIPLIER,
  defaultTier,
  levelProgressPct,
  localDate,
  nextTierOf,
  nextTierProgress,
  nextTitleOf,
  titleOf,
  upgradedTier,
  xpNeeded,
  type StreakState,
} from './rules'
import type {
  DailyChallenge,
  LedgerRow,
  LedgerType,
  SettingKey,
  StreakRow,
  TeacherWallet,
  Tier,
  WalletRow,
} from './types'

// --- errors ------------------------------------------------------------------------------------

export { M14Error, type M14ErrorCode } from './errors'

// --- transaction -------------------------------------------------------------------------------

let txRunner: (<T>(fn: () => T) => T) | null = null

/** Each M14 repository binds its `ctx.transaction` (they share one db). */
export function bindTx(runner: <T>(fn: () => T) => T): void {
  txRunner ??= runner
}

export function tx<T>(fn: () => T): T {
  return txRunner ? txRunner(fn) : fn()
}

// --- time --------------------------------------------------------------------------------------

/** ISO `+08:00` at whole seconds (keeps lexicographic order equal to time order). */
export function isoAt(at: DateInput): string {
  const ms = toEpochMs(at)
  return toIsoMyt(ms - (((ms % 1000) + 1000) % 1000))
}

export function nowMs(): number {
  return m14Now()
}

// --- priming -----------------------------------------------------------------------------------

/** Primes the datasets if the plugin's finalise did not (tests that compile them directly). */
export function ensurePrimed(): void {
  if (!walletPrimeOrNull() || !ledgerPrimeOrNull()) primeM14Datasets()
}

// --- catalogue reads ---------------------------------------------------------------------------

export function allTiers(): Tier[] {
  return tiersTable.query({ sort: ['sortOrder', 'id'] }).rows
}

export function tierByKey(key: string): Tier | undefined {
  return allTiers().find((t) => t.tierName === key)
}

export function activeChallenges(): DailyChallenge[] {
  return challengesTable.query({ where: { isActive: true }, sort: ['sortOrder', 'id'] }).rows
}

export function settingValue(key: SettingKey): number {
  return settingsTable.query({ where: { key } }).rows[0]?.value ?? 0
}

// --- wallets -----------------------------------------------------------------------------------

export function walletRow(userId: number): WalletRow | undefined {
  ensurePrimed()
  return walletsDataset.get(userId)
}

/** BR-M14-02 defaults for a user without a row. */
export function walletState(userId: number): EngineWallet {
  const row = walletRow(userId)
  if (row) {
    return {
      currentSyiling: row.currentSyiling,
      totalSyilingEarned: row.totalSyilingEarned,
      tokenBalance: row.tokenBalance,
      xp: row.xp,
      level: row.level,
      tierKey: row.tierKey,
    }
  }
  return {
    currentSyiling: 0,
    totalSyilingEarned: 0,
    tokenBalance: 0,
    xp: 0,
    level: 1,
    tierKey: defaultTier(allTiers()).tierName,
  }
}

/** Writes a wallet (creating it on the first credit, BR-M14-02). */
export function saveWallet(userId: number, next: EngineWallet, at: DateInput): WalletRow {
  ensurePrimed()
  const existing = walletsDataset.get(userId)
  if (existing) {
    return walletsDataset.update(userId, {
      currentSyiling: next.currentSyiling,
      totalSyilingEarned: next.totalSyilingEarned,
      tokenBalance: next.tokenBalance,
      xp: next.xp,
      level: next.level,
      tierKey: next.tierKey,
    })
  }
  return walletsDataset.insert({
    id: userId,
    userId,
    currentSyiling: next.currentSyiling,
    totalSyilingEarned: next.totalSyilingEarned,
    tokenBalance: next.tokenBalance,
    xp: next.xp,
    level: next.level,
    tierKey: next.tierKey,
    createdAt: isoAt(at),
  })
}

export interface LedgerInput {
  type: LedgerType
  source: string
  amount: number
  balanceAfter: number
  description: string
  refId?: string | null
  tokens?: number | null
}

export function addLedgerRow(userId: number, input: LedgerInput, at: DateInput): LedgerRow {
  ensurePrimed()
  return ledgerDataset.insert({
    userId,
    type: input.type,
    source: input.source,
    tokens: input.tokens ?? null,
    amount: input.amount,
    balanceAfter: input.balanceAfter,
    description: input.description,
    refId: input.refId ?? null,
    createdAt: isoAt(at),
  })
}

/** BR-M14-33 order: `createdAt` desc, then `id` desc. */
export const LEDGER_ORDER = [
  { field: 'createdAt', dir: 'desc' },
  { field: 'id', dir: 'desc' },
] as const

export function ledgerOf(userId: number, type?: string): LedgerRow[] {
  ensurePrimed()
  return ledgerDataset.query({
    where: type ? { userId, type: type as LedgerType } : { userId },
    sort: LEDGER_ORDER,
  }).rows
}

/** BR-M14-07: Σ of the user's positive amounts in `[start, end)`. */
export function earnedBetween(userId: number, start: number, end: number): number {
  ensurePrimed()
  const rows = ledgerDataset.query({
    where: { userId, createdAt: { gte: isoAt(start), lte: isoAt(end - 1000) } },
  }).rows
  return rows.reduce((sum, r) => sum + (r.amount > 0 ? r.amount : 0), 0)
}

/** Whether the user has a ledger row of `source` on local day `date`. */
export function hasSourceRowOn(userId: number, source: string, date: string): boolean {
  const range = dayRange(`${date}T12:00:00+08:00`)
  ensurePrimed()
  return (
    ledgerDataset.count({
      userId,
      source,
      createdAt: { gte: isoAt(range.start), lte: isoAt(range.end - 1000) },
    }) > 0
  )
}

/**
 * Credits syiling (BR-M14-22 / BR-M14-20 / BR-M14-19): one row, balance and lifetime up, tier
 * re-assigned (BR-M14-08). Creates the wallet when missing.
 */
export function creditSyilingOp(
  userId: number,
  amount: number,
  row: { type?: LedgerType; source: string; description: string; refId?: string | null },
  at: DateInput,
): { wallet: WalletRow; row: LedgerRow } {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new M14Error(
      'VALIDATION_ERROR',
      `amount must be a positive integer, got ${String(amount)}`,
    )
  }
  const w = walletState(userId)
  w.currentSyiling += amount
  w.totalSyilingEarned += amount
  w.tierKey = upgradedTier(allTiers(), w.tierKey, w.currentSyiling)
  const wallet = saveWallet(userId, w, at)
  const ledger = addLedgerRow(
    userId,
    {
      type: row.type ?? 'earn',
      source: row.source,
      amount,
      balanceAfter: w.currentSyiling,
      description: row.description,
      refId: row.refId ?? null,
    },
    at,
  )
  return { wallet, row: ledger }
}

/** Debits syiling (`spend` or `convert`); refuses below the balance (BR-M14-30). */
export function debitSyilingOp(
  userId: number,
  amount: number,
  row: {
    type?: LedgerType
    source: string
    description: string
    refId?: string | null
    tokens?: number | null
  },
  at: DateInput,
): { wallet: WalletRow; row: LedgerRow } {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new M14Error(
      'VALIDATION_ERROR',
      `amount must be a positive integer, got ${String(amount)}`,
    )
  }
  const w = walletState(userId)
  if (w.currentSyiling < amount) {
    throw new M14Error('INSUFFICIENT_BALANCE', 'Baki syiling tidak mencukupi.')
  }
  w.currentSyiling -= amount
  const wallet = saveWallet(userId, w, at)
  const ledger = addLedgerRow(
    userId,
    {
      type: row.type ?? 'spend',
      source: row.source,
      amount: -amount,
      balanceAfter: w.currentSyiling,
      description: row.description,
      refId: row.refId ?? null,
      tokens: row.tokens ?? null,
    },
    at,
  )
  return { wallet, row: ledger }
}

/** Token movement (BR-M14-22): no coin-ledger row; the TokenMovement log only. */
export function moveTokensOp(
  userId: number,
  delta: number,
  meta: { source: string; refId?: string | null },
  at: DateInput,
): WalletRow {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new M14Error(
      'VALIDATION_ERROR',
      `token delta must be a non-zero integer, got ${String(delta)}`,
    )
  }
  const w = walletState(userId)
  if (delta < 0 && w.tokenBalance < -delta) {
    throw new M14Error('INSUFFICIENT_BALANCE', 'Baki token tidak mencukupi.')
  }
  w.tokenBalance += delta
  const wallet = saveWallet(userId, w, at)
  tokenMovementsTable.insert({
    userId,
    delta,
    source: meta.source,
    refId: meta.refId ?? null,
    createdAt: isoAt(at),
  })
  return wallet
}

export function addXpOp(userId: number, n: number, at: DateInput): WalletRow | undefined {
  if (!Number.isInteger(n) || n < 0) {
    throw new M14Error('VALIDATION_ERROR', `xp must be a non-negative integer, got ${String(n)}`)
  }
  if (n === 0) return walletRow(userId)
  const w = walletState(userId)
  w.xp += n
  return saveWallet(userId, w, at)
}

// --- wallet summary (#2) -----------------------------------------------------------------------

export interface TierView {
  key: string
  labelMs: string
  icon: string
  color: string
  minSyiling: number
  conversionRate: number
}

export interface WalletSummary {
  userId: number
  currentSyiling: number
  totalSyilingEarned: number
  tokenBalance: number
  xp: number
  level: number
  xpNeeded: number
  levelProgressPct: number
  tier: TierView
  nextTier: (TierView & { pct: number; need: number }) | null
  title: { name: string; emoji: string }
  nextTitle: { name: string; emoji: string; threshold: number; need: number } | null
  earnedToday: number
  earnedThisWeek: number
  streak: { current: number; best: number; multiplier: number }
  /** A wallet row exists (Q-WALLETS). */
  hasWallet: boolean
}

export function tierView(t: Tier): TierView {
  return {
    key: t.tierName,
    labelMs: t.labelMs,
    icon: t.icon,
    color: t.color,
    minSyiling: t.minSyiling,
    conversionRate: t.conversionRate,
  }
}

export function walletSummaryOp(userId: number): WalletSummary {
  const tiers = allTiers()
  const row = walletRow(userId)
  const w = walletState(userId)
  const tier = tiers.find((t) => t.tierName === w.tierKey) ?? defaultTier(tiers)
  const next = nextTierOf(tiers, tier.tierName)
  const now = nowMs()
  const today = dayRange(now)
  const week = weekRange(now)
  const streak = streakState(userId)
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
    earnedToday: row ? earnedBetween(userId, today.start, today.end) : 0,
    earnedThisWeek: row ? earnedBetween(userId, week.start, week.end) : 0,
    streak: { current: streak.current, best: streak.best, multiplier: STREAK_MULTIPLIER },
    hasWallet: row !== undefined,
  }
}

// --- streaks -----------------------------------------------------------------------------------

export function streakState(userId: number): StreakState {
  const row = streaksTable.get(userId)
  return row
    ? {
        current: row.current,
        best: row.best,
        lastActivityDate: row.lastActivityDate,
        totalDays: row.totalDays,
      }
    : { ...EMPTY_STREAK }
}

export function saveStreak(userId: number, s: StreakState): StreakRow {
  const patch = {
    current: s.current,
    best: s.best,
    lastActivityDate: s.lastActivityDate,
    totalDays: s.totalDays,
  }
  return streaksTable.get(userId)
    ? streaksTable.update(userId, patch)
    : streaksTable.insert({ id: userId, userId, ...patch })
}

// --- challenge completions ---------------------------------------------------------------------

export function completionsOn(userId: number, date: string): Set<number> {
  return new Set(completionsTable.query({ where: { userId, date } }).rows.map((c) => c.challengeId))
}

export function addCompletion(userId: number, challengeId: number, at: DateInput): void {
  const date = localDate(at)
  if (completionsTable.count({ userId, challengeId, date }) > 0) return
  completionsTable.insert({ userId, challengeId, date, completedAt: isoAt(at) })
}

// --- teacher wallets ---------------------------------------------------------------------------

export function teacherWalletOf(userId: number): TeacherWallet | undefined {
  return teacherWalletsTable.get(userId)
}

/** Adds a teacher-ledger row (amount may be 0) and moves the balance; creates the wallet. */
export function teacherCreditOp(
  userId: number,
  amount: number,
  description: string,
  at: DateInput,
  options: { questionsDelta?: number } = {},
): TeacherWallet {
  const existing = teacherWalletsTable.get(userId)
  const base = existing ?? {
    id: userId,
    userId,
    balance: 0,
    totalEarned: 0,
    questionsCount: 0,
    createdAt: isoAt(at),
  }
  const next = {
    balance: base.balance + amount,
    totalEarned: base.totalEarned + Math.max(0, amount),
    questionsCount: base.questionsCount + (options.questionsDelta ?? 0),
  }
  const wallet = existing
    ? teacherWalletsTable.update(userId, next)
    : teacherWalletsTable.insert({ ...base, ...next })
  teacherLedgerTable.insert({ userId, amount, description, createdAt: isoAt(at) })
  return wallet
}

export function hasTeacherRowOn(userId: number, description: string, date: string): boolean {
  return teacherLedgerTable
    .query({ where: { userId } })
    .rows.some((r) => r.description === description && localDate(r.createdAt) === date)
}
