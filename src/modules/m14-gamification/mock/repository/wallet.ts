/**
 * `wallet` (primary store `wallets`) and `coinLedger` (primary store `coinLedger`) repositories
 * (SRS M14 v1.7 §7.1, §6.10; BR-M14-02, 05–11, 17, 20, 22, 30, 33, 34, 36).
 *
 * Contract used by other modules: `wallet.summary(userId)` (shell #1, M05, M08, M15), the token and
 * syiling movements `wallet.debitTokens / creditTokens / creditSyiling / debitSyiling / addXp`
 * (M15, M16) and the provisional shim `wallet.credit`. The rest serves the M14 handlers (#2–#43).
 */

import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'
import type { Where } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import { AWARD_MAX } from '../data/catalogue'
import { ledgerDataset } from '../datasets/ledger'
import { LEDGER_TYPE_TOTALS, LEDGER_TOTAL, Q_CONVERSIONS } from '../datasets/ledger-spec'
import { walletsDataset } from '../datasets/wallets'
import { WALLET_TIER_COUNTS, WALLET_TOTAL } from '../datasets/wallets-spec'
import {
  M14Error,
  LEDGER_ORDER,
  addXpOp,
  allTiers,
  bindTx,
  creditSyilingOp,
  debitSyilingOp,
  ensurePrimed,
  isoAt,
  ledgerOf,
  moveTokensOp,
  nowMs,
  tierView,
  tx,
  walletRow,
  walletState,
  walletSummaryOp,
  saveWallet,
  type WalletSummary,
} from './ops'
import { activeTiers, defaultTier } from './rules'
import type { LedgerRow, LedgerType, WalletRow } from './types'

// --- named queries (§6.10) ---------------------------------------------------------------------

export const walletQueries = defineNamedQueries(walletsDataset, {
  'Q-WALLETS': { expected: WALLET_TOTAL, source: 'M14 §6.10 (S1 "Pelajar Aktif", S4 total)' },
  'Q-TIER': {
    where: (tierKey: string) => ({ tierKey }),
    expected: Object.entries(WALLET_TIER_COUNTS).map(([k, value]) => ({ args: [k], value })),
    source: 'M14 §6.10 (S1 distribution, S4 ?tier=)',
  },
})

/** Q-TX(type?, from?, to?): ISO bounds, inclusive (S5). */
function txWhere(type?: LedgerType | '', from?: string, to?: string): Where<LedgerRow> {
  const where: Where<LedgerRow> = {}
  if (type) where.type = type
  if (from || to) {
    where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
  }
  return where
}

export const ledgerQueries = defineNamedQueries(ledgerDataset, {
  'Q-TX': {
    where: txWhere,
    expected: [
      { args: [], value: LEDGER_TOTAL },
      ...Object.entries(LEDGER_TYPE_TOTALS).map(([type, value]) => ({ args: [type], value })),
    ],
    source: 'M14 §6.10 (S5 totals and pager)',
  },
  'Q-CONVERSIONS': {
    where: { source: 'token_conversion' },
    expected: Q_CONVERSIONS,
    source: 'M14 §6.10 (S1 "Penukaran")',
  },
})

// --- helpers -----------------------------------------------------------------------------------

/** S4 / S14 / S1 ranking order (BR-M14-17; DV-M14-14 for the other sort fields). */
export type WalletSort = 'total_syiling_earned' | 'current_syiling' | 'token_balance' | 'level'
const SORT_FIELD: Record<WalletSort, keyof WalletRow> = {
  total_syiling_earned: 'totalSyilingEarned',
  current_syiling: 'currentSyiling',
  token_balance: 'tokenBalance',
  level: 'level',
}

function rankingSort(sort: WalletSort = 'total_syiling_earned') {
  const field = SORT_FIELD[sort]
  const keys = [{ field, dir: 'desc' as const }]
  if (field !== 'totalSyilingEarned') keys.push({ field: 'totalSyilingEarned', dir: 'desc' })
  return [
    ...keys,
    { field: 'createdAt' as const, dir: 'asc' as const },
    { field: 'id' as const, dir: 'asc' as const },
  ]
}

/** `wallet.credit` reason (provisional architecture shim). */
export type CreditReason =
  | ({ kind: 'session' } & Record<string, unknown>)
  | { kind?: string; source?: string; description?: string; refId?: string | null }

export interface WalletAdminFilter {
  search?: string
  tier?: string
  sort?: WalletSort
  page?: number
  pageSize?: number
}

let sessionHook: ((input: Record<string, unknown>) => unknown) | null = null

/** `gamification.onSessionCompleted`, bound by the gamification repository (shim target). */
export function bindSessionHook(fn: (input: Record<string, unknown>) => unknown): void {
  sessionHook = fn
}

export const walletRepo = defineRepository({
  owner: 'M14',
  name: 'wallet',
  store: walletsDataset,
  stores: { ledger: ledgerDataset },
  queries: walletQueries,
  methods: ({ transaction }) => {
    bindTx(transaction)
    return {
      /** #2 body; BR-M14-02 defaults for a missing row (no row is created by a read). */
      summary(userId: number): WalletSummary {
        return walletSummaryOp(userId)
      },

      /** The stored row, or undefined (defaults are `summary`'s job). */
      get(userId: number): WalletRow | undefined {
        return walletRow(userId)
      },

      /** Whether the M14 stores are booted in the current runtime (the core's chip read). */
      ready(): boolean {
        return walletsDataset.compiled
      },

      /**
       * Provisional shim (architecture §6.7): a session reason delegates to
       * `gamification.onSessionCompleted`; any other credits syiling and XP.
       */
      credit(
        userId: number,
        amounts: { coins: number; points: number },
        reason: CreditReason = {},
      ) {
        if (reason.kind === 'session') {
          if (!sessionHook) throw new Error('M14: gamification repository not loaded')
          // `amounts.points` is the XP M05 hands over (`pointsEarned`); `amounts.coins` is ignored:
          // the session coins are M14 rules (BR-M14-03).
          return sessionHook({ ...reason, userId, pointsEarned: amounts.points })
        }
        const r = reason as { source?: string; description?: string; refId?: string | null }
        const at = nowMs()
        return tx(() => {
          if (amounts.coins > 0) {
            creditSyilingOp(
              userId,
              amounts.coins,
              {
                source: r.source ?? 'legacy',
                description: r.description ?? 'Kredit syiling',
                refId: r.refId ?? null,
              },
              at,
            )
          }
          if (amounts.points > 0) addXpOp(userId, amounts.points, at)
          return walletSummaryOp(userId)
        })
      },

      /** BR-M14-22: `earn` row (e.g. "Kotak Misteri: {name}", source `mystery_box`). */
      creditSyiling(
        userId: number,
        n: number,
        meta: { source: string; description: string; refId?: string | null },
      ): { currentSyiling: number; transactionId: number } {
        const at = nowMs()
        return tx(() => {
          const { wallet, row } = creditSyilingOp(userId, n, meta, at)
          return { currentSyiling: wallet.currentSyiling, transactionId: row.id }
        })
      },

      /** BR-M14-22: `spend` row; `INSUFFICIENT_BALANCE` when `currentSyiling` < n. */
      debitSyiling(
        userId: number,
        n: number,
        meta: { source: string; description: string; refId?: string | null },
      ): { currentSyiling: number; transactionId: number } {
        const at = nowMs()
        return tx(() => {
          const { wallet, row } = debitSyilingOp(userId, n, { ...meta, type: 'spend' }, at)
          return { currentSyiling: wallet.currentSyiling, transactionId: row.id }
        })
      },

      /** BR-M14-22: XP without a ledger row. */
      addXp(userId: number, n: number, meta: { source: string }): { xp: number } {
        void meta
        const at = nowMs()
        return tx(() => ({ xp: addXpOp(userId, n, at)?.xp ?? 0 }))
      },

      /** BR-M14-22: token debit (`hadiah_redeem`, `mystery_box`); refuses below the balance. */
      debitTokens(
        userId: number,
        n: number,
        meta: { source: string; refId?: string | null },
      ): { tokenBalance: number } {
        const at = nowMs()
        return tx(() => ({ tokenBalance: moveTokensOp(userId, -n, meta, at).tokenBalance }))
      },

      /** BR-M14-22: token credit (`hadiah_refund`). */
      creditTokens(
        userId: number,
        n: number,
        meta: { source: string; refId?: string | null },
      ): { tokenBalance: number } {
        const at = nowMs()
        return tx(() => ({ tokenBalance: moveTokensOp(userId, n, meta, at).tokenBalance }))
      },

      /** #5: the convert page data (BR-M14-10). */
      convertView(userId: number) {
        const s = walletSummaryOp(userId)
        const rate = s.tier.conversionRate
        return {
          currentSyiling: s.currentSyiling,
          tokenBalance: s.tokenBalance,
          rate,
          tierLabel: s.tier.labelMs,
          quick: [rate, 5 * rate, s.currentSyiling],
          tiers: activeTiers(allTiers()).map((t) => ({
            ...tierView(t),
            isMine: t.tierName === s.tier.key,
          })),
        }
      },

      /**
       * #6 (BR-M14-10/11): rate ≤ s ≤ currentSyiling (integer) else `VALIDATION_ERROR`; atomic
       * debit, floor(s ÷ rate) tokens, `convert` row "Tukar {s} syiling → {t} token".
       */
      convert(userId: number, syilingAmount: number) {
        const at = nowMs()
        return tx(() => {
          const w = walletState(userId)
          const tier = allTiers().find((t) => t.tierName === w.tierKey) ?? defaultTier(allTiers())
          const rate = tier.conversionRate
          if (
            !Number.isInteger(syilingAmount) ||
            syilingAmount < rate ||
            syilingAmount > w.currentSyiling
          ) {
            throw new M14Error('VALIDATION_ERROR', 'Jumlah syiling tidak sah.')
          }
          const tokens = Math.floor(syilingAmount / rate)
          const { row } = debitSyilingOp(
            userId,
            syilingAmount,
            {
              type: 'convert',
              source: 'token_conversion',
              description: `Tukar ${String(syilingAmount)} syiling → ${String(tokens)} token`,
              tokens,
            },
            at,
          )
          const after = walletState(userId)
          after.tokenBalance += tokens
          const wallet = saveWallet(userId, after, at)
          return {
            syilingDebited: syilingAmount,
            tokensCredited: tokens,
            currentSyiling: wallet.currentSyiling,
            tokenBalance: wallet.tokenBalance,
            transactionId: row.id,
          }
        })
      },

      /** #29 (BR-M14-20): admin award, `bonus` / `admin_award`, description = reason. */
      award(userId: number, amount: number, reason: string) {
        if (!users.get(userId)) throw new M14Error('NOT_FOUND', 'Pengguna tidak dijumpai.')
        const text = reason.trim()
        if (
          !Number.isInteger(amount) ||
          amount < 1 ||
          amount > AWARD_MAX ||
          text === '' ||
          text.length > 255
        ) {
          throw new M14Error('VALIDATION_ERROR', 'Sila lengkapkan semua medan wajib.')
        }
        const at = nowMs()
        return tx(() => {
          const { wallet, row } = creditSyilingOp(
            userId,
            amount,
            { type: 'bonus', source: 'admin_award', description: text },
            at,
          )
          return { userId, currentSyiling: wallet.currentSyiling, transactionId: row.id }
        })
      },

      /** Q-LEADERBOARD (BR-M14-17): top `limit` wallets (default 50). */
      leaderboard(limit = 50): WalletRow[] {
        ensurePrimed()
        return walletsDataset.query({ sort: rankingSort(), page: 1, pageSize: limit }).rows
      },

      /** #28 (S4): filters, name / e-mail search (M01 users), 20 a page, DV-M14-14 sorts. */
      adminList(filter: WalletAdminFilter = {}): { rows: WalletRow[]; total: number } {
        ensurePrimed()
        const where: Where<WalletRow> = {}
        if (filter.tier) where.tierKey = filter.tier
        const term = filter.search?.trim() ?? ''
        if (term !== '') {
          const ids = users
            .adminList({ search: term, page: 1, pageSize: 1_000_000 })
            .rows.map((u) => u.id)
          where.id = ids
        }
        return walletsDataset.query({
          where,
          sort: rankingSort(filter.sort),
          page: filter.page ?? 1,
          pageSize: filter.pageSize ?? 20,
        })
      },

      /** Q-SYILING-DIJANA: Σ `totalSyilingEarned` over wallets. */
      syilingGenerated(): number {
        ensurePrimed()
        return walletsDataset.query({}).rows.reduce((s, w) => s + w.totalSyilingEarned, 0)
      },

      /** Test hook `setWallet` (§6.14): sets fields directly, writes no ledger row. */
      setFields(
        userId: number,
        fields: {
          syiling?: number
          tokens?: number
          xp?: number
          level?: number
          tierKey?: string
        },
      ): WalletRow {
        const at = nowMs()
        return tx(() => {
          const w = walletState(userId)
          if (fields.syiling !== undefined) w.currentSyiling = fields.syiling
          if (fields.tokens !== undefined) w.tokenBalance = fields.tokens
          if (fields.xp !== undefined) w.xp = fields.xp
          if (fields.level !== undefined) w.level = fields.level
          if (fields.tierKey !== undefined) w.tierKey = fields.tierKey
          return saveWallet(userId, w, at)
        })
      },
    }
  },
})

export interface LedgerAdminFilter {
  type?: LedgerType | ''
  /** `YYYY-MM-DD`, inclusive. */
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export const coinLedgerRepo = defineRepository({
  owner: 'M14',
  name: 'coinLedger',
  store: ledgerDataset,
  queries: ledgerQueries,
  methods: ({ transaction }) => {
    bindTx(transaction)
    return {
      /** #4 / S17 (BR-M14-33): the user's rows, newest first, no pager. */
      forUser(userId: number, type?: LedgerType | ''): LedgerRow[] {
        return ledgerOf(userId, type || undefined)
      },

      /** #30 / S5: 25 a page, newest first; dates inclusive (provisional). */
      adminList(filter: LedgerAdminFilter = {}): { rows: LedgerRow[]; total: number } {
        ensurePrimed()
        const from = filter.dateFrom ? isoAt(`${filter.dateFrom}T00:00:00+08:00`) : undefined
        const to = filter.dateTo ? isoAt(`${filter.dateTo}T23:59:59+08:00`) : undefined
        return ledgerDataset.query({
          where: txWhere(filter.type, from, to),
          sort: LEDGER_ORDER,
          page: filter.page ?? 1,
          pageSize: filter.pageSize ?? 25,
        })
      },

      /** S1 "Transaksi Terkini" (10) / S11 (6 of the viewer's rows). */
      recent(limit = 10): LedgerRow[] {
        ensurePrimed()
        return ledgerDataset.query({ sort: LEDGER_ORDER, page: 1, pageSize: limit }).rows
      },

      get(id: number): LedgerRow | undefined {
        ensurePrimed()
        return ledgerDataset.get(id)
      },

      /** Q-TOKENS-CONVERTED: Σ `tokens` over Q-CONVERSIONS (O(cells)). */
      tokensConverted(): number {
        let sum = 0
        for (const [tokens, n] of ledgerDataset.groupCount('tokens', {
          source: 'token_conversion',
        })) {
          sum += (tokens ?? 0) * n
        }
        return sum
      },
    }
  },
})
