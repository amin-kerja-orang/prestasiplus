/**
 * `hadiah` repository (owner M15; primary store `hadiah.rewards`, plus `hadiah.redemptions`):
 * the rewards catalogue, the bulk actions and the redemption rule (SRS M15 v1.4 §4, §6.2, §6.3,
 * §6.8, §7). Wallet movements go through the M14 contract in `./m14-seam.ts`, inside the same mock
 * transaction as the M15 write (BR-M15-21), so a refusal changes nothing.
 *
 * Named queries of §6.8 are the `count*` / list methods below (the stores are small tables, not D11
 * datasets); every figure is computed from the rows.
 */

import { DAY_MS, formatDateKey, toIsoMyt } from '@/lib/time'
import { defineRepository } from '@/mock/repository'

import { nowMs } from './clock'
import { balanceOf, creditTokens, debitTokens } from './m14-seam'
import { redemptionsTable, rewardsTable } from './tables'
import {
  M15Error,
  type HadiahFields,
  type HadiahRedemption,
  type HadiahReward,
  type RedemptionStatus,
} from './types'

/** ISO +08:00 at whole seconds (lexicographic order = time order). */
function isoNow(): string {
  const ms = nowMs()
  return toIsoMyt(ms - (((ms % 1000) + 1000) % 1000))
}

/** BR-M15-25: the calendar month ("yyyy-MM") of the mock clock in Asia/Kuala_Lumpur. */
export function currentMonth(): string {
  return formatDateKey(nowMs()).slice(0, 7)
}

/** The parsed bulk change (#5; validated by the handler, BR-M15-11/12). */
export type BulkChange =
  | { action: 'activate' | 'deactivate' | 'delete' }
  | { action: 'set_stock'; value: number | null }
  | { action: 'set_max_per_month'; value: number | null }
  | { action: 'set_token_cost'; pct: number }

export interface CardsView {
  total: number
  active: number
  redemptionsThisMonth: number
  pendingAdmin: number
}

/** BR-M15-02: displayOrder ascending, then id ascending. */
const REWARD_ORDER = [
  { field: 'displayOrder' as const, dir: 'asc' as const },
  { field: 'id' as const, dir: 'asc' as const },
]

/** BR-M15-15 / S2: newest first, then id descending. */
const QUEUE_ORDER = [
  { field: 'createdAt' as const, dir: 'desc' as const },
  { field: 'id' as const, dir: 'desc' as const },
]

const NOT_CANCELLED = { ne: 'cancelled' } as const

export const hadiahRepo = defineRepository({
  owner: 'M15',
  name: 'hadiah',
  store: rewardsTable,
  stores: { redemptions: redemptionsTable },
  methods: ({ store, stores, transaction }) => {
    const redemptions = stores.redemptions

    function monthlyCountOf(userId: number, rewardId: number): number {
      const month = currentMonth()
      return redemptions.count({ userId, rewardId, status: NOT_CANCELLED }, (r) =>
        r.createdAt.startsWith(month),
      )
    }

    /** BR-M15-09: status, refund, stock release; shared by admin cancel and parent reject. */
    function cancelRow(row: HadiahRedemption, by: 'admin' | 'parent', at: string): number {
      creditTokens(row.userId, row.tokenCost, 'hadiah_refund', `redemption:${String(row.id)}`)
      if (row.stockReserved) {
        const reward = store.get(row.rewardId)
        if (reward && reward.stockQuantity !== null) {
          store.update(reward.id, { stockQuantity: reward.stockQuantity + 1, updatedAt: at })
        }
      }
      redemptions.update(row.id, {
        status: 'cancelled',
        cancelledAt: at,
        cancelledBy: by,
        stockReserved: false,
      })
      return row.tokenCost
    }

    return {
      // --- rewards (S1–S4) ---------------------------------------------------------------

      get(id: number): HadiahReward | undefined {
        return store.get(id)
      },

      /** Q-M15-CAT: every reward in catalogue order; `category` filters (unknown key → none). */
      list(category?: string): HadiahReward[] {
        const all = store.query({ sort: REWARD_ORDER }).rows
        if (category === undefined || category === 'all') return all
        return all.filter((r) => r.category === category)
      },

      /** Q-M15-RED-REWARD for every reward id (cancelled rows excluded; BR-M15-04). */
      redemptionCounts(): Map<number, number> {
        return redemptions.groupCount('rewardId', { status: NOT_CANCELLED })
      },

      /** Q-M15-RED-REWARD(id). */
      redemptionCountOf(rewardId: number): number {
        return redemptions.count({ rewardId, status: NOT_CANCELLED })
      },

      /** Q-M15-TOTAL, Q-M15-ACTIVE, Q-M15-RED-MONTH, Q-M15-PENDING-ADMIN (independent of cat/page). */
      cards(): CardsView {
        const month = currentMonth()
        return {
          total: store.count(),
          active: store.count({ isActive: true }),
          redemptionsThisMonth: redemptions.count({ status: NOT_CANCELLED }, (r) =>
            r.createdAt.startsWith(month),
          ),
          pendingAdmin: redemptions.count({ status: 'pending_admin' }),
        }
      },

      create(input: HadiahFields): HadiahReward {
        const at = isoNow()
        return transaction(() => store.insert({ ...input, createdAt: at, updatedAt: at }))
      },

      /** `undefined` when the id is unknown. */
      update(id: number, input: HadiahFields): HadiahReward | undefined {
        return transaction(() => {
          if (!store.get(id)) return undefined
          return store.update(id, { ...input, updatedAt: isoNow() })
        })
      },

      /** Test hook `m15SetReward` (§6.9): a raw patch, no validation. */
      patch(id: number, patch: Partial<HadiahFields>): HadiahReward | undefined {
        return transaction(() => {
          if (!store.get(id)) return undefined
          return store.update(id, { ...patch, updatedAt: isoNow() })
        })
      },

      /**
       * #5 (BR-M15-11, BR-M15-24): unknown ids are ignored. `affected` = rewards changed (for
       * `delete`: removed); `keptIds` = the rewards `delete` kept because they have a redemption row.
       */
      bulk(change: BulkChange, ids: readonly number[]): { affected: number; keptIds: number[] } {
        return transaction(() => {
          const at = isoNow()
          const unique = [...new Set(ids)]
          const rows = unique.map((id) => store.get(id)).filter((r): r is HadiahReward => !!r)
          const keptIds: number[] = []
          let affected = 0
          for (const row of rows) {
            switch (change.action) {
              case 'activate':
                store.update(row.id, { isActive: true, updatedAt: at })
                break
              case 'deactivate':
                store.update(row.id, { isActive: false, updatedAt: at })
                break
              case 'set_stock':
                store.update(row.id, { stockQuantity: change.value, updatedAt: at })
                break
              case 'set_max_per_month':
                store.update(row.id, { maxPerMonthPerStudent: change.value, updatedAt: at })
                break
              case 'set_token_cost': {
                // BR-M15-11 (PROPOSED rounding): half up, clamped 1…10000; denominationRm unchanged.
                const next = Math.floor(row.tokenCost * (1 + change.pct / 100) + 0.5)
                store.update(row.id, {
                  tokenCost: Math.max(1, Math.min(10000, next)),
                  updatedAt: at,
                })
                break
              }
              case 'delete':
                if (redemptions.count({ rewardId: row.id }) > 0) {
                  keptIds.push(row.id)
                  continue
                }
                store.remove(row.id)
                break
            }
            affected += 1
          }
          return { affected, keptIds }
        })
      },

      /** Q-M15-HISTORY-DELETE(id): redemption rows of any status. */
      historyCount(rewardId: number): number {
        return redemptions.count({ rewardId })
      },

      // --- redemptions: admin queue (S2) ----------------------------------------------------

      getRedemption(id: number): HadiahRedemption | undefined {
        return redemptions.get(id)
      },

      /**
       * Q-M15-QUEUE(status) newest first (BR-M15-15). The caller resolves the filter: a status key,
       * `all`, or anything else (→ empty).
       */
      queue(status: string): HadiahRedemption[] {
        if (status === 'all') return redemptions.query({ sort: QUEUE_ORDER }).rows
        if (
          status !== 'pending_parent_consent' &&
          status !== 'pending_admin' &&
          status !== 'delivered' &&
          status !== 'cancelled'
        ) {
          return []
        }
        return redemptions.query({ where: { status }, sort: QUEUE_ORDER }).rows
      },

      /** BR-M15-10 (#7): `pending_admin` only (`CONFLICT` otherwise). */
      deliver(id: number, code: string): HadiahRedemption {
        return transaction(() => {
          const row = redemptions.get(id)
          if (!row) throw new M15Error('NOT_FOUND', 'Tebusan tidak dijumpai.')
          if (row.status !== 'pending_admin') {
            throw new M15Error('CONFLICT', 'Tebusan ini tidak lagi menunggu pemprosesan.')
          }
          const now = nowMs()
          const reward = store.get(row.rewardId)
          const days = reward?.voucherValidityDays ?? 365
          return redemptions.update(id, {
            status: 'delivered',
            voucherCode: code,
            deliveredAt: isoNow(),
            expiresAt: toIsoMyt(now - (now % 1000) + days * DAY_MS),
          })
        })
      },

      /** BR-M15-09 (#8): admin cancels a `pending_admin` row; tokens are refunded once. */
      cancelByAdmin(id: number): { row: HadiahRedemption; refundedTokens: number } {
        return transaction(() => {
          const row = redemptions.get(id)
          if (!row) throw new M15Error('NOT_FOUND', 'Tebusan tidak dijumpai.')
          if (row.status !== 'pending_admin') {
            throw new M15Error('CONFLICT', 'Tebusan ini tidak lagi menunggu pemprosesan.')
          }
          const refundedTokens = cancelRow(row, 'admin', isoNow())
          return { row: redemptions.get(id) as HadiahRedemption, refundedTokens }
        })
      },

      // --- redemption rule (#9, hook m15Redeem) -------------------------------------------

      /** Q-M15-CAP(user, reward): the user's non-cancelled redemptions of the reward this month. */
      monthlyCount(userId: number, rewardId: number): number {
        return monthlyCountOf(userId, rewardId)
      },

      /**
       * BR-M15-05…07, BR-M15-21: eligibility (in order), then one atomic step: the M14 token debit,
       * the stock, the snapshot row. Refusals: `NOT_FOUND`, `OUT_OF_STOCK`, `MONTHLY_CAP`,
       * `INSUFFICIENT_TOKENS`.
       */
      redeem(
        userId: number,
        rewardId: number,
      ): { redemption: HadiahRedemption; tokenBalance: number } {
        return transaction(() => {
          const reward = store.get(rewardId)
          if (!reward?.isActive) throw new M15Error('NOT_FOUND', 'Hadiah tidak dijumpai.')
          if (reward.stockQuantity !== null && reward.stockQuantity < 1) {
            throw new M15Error('OUT_OF_STOCK', 'Stok hadiah telah habis.')
          }
          if (
            reward.maxPerMonthPerStudent !== null &&
            monthlyCountOf(userId, rewardId) >= reward.maxPerMonthPerStudent
          ) {
            throw new M15Error('MONTHLY_CAP', 'Had tebusan bulanan dicapai.')
          }
          if (balanceOf(userId).tokenBalance < reward.tokenCost) {
            throw new M15Error('INSUFFICIENT_TOKENS', 'Token tidak mencukupi.')
          }
          const at = isoNow()
          const reserved = reward.stockQuantity !== null
          const row = redemptions.insert({
            userId,
            rewardId,
            rewardTitle: reward.title,
            rewardVendor: reward.vendor,
            rewardIcon: reward.iconEmoji,
            denominationRm: reward.denominationRm,
            tokenCost: reward.tokenCost,
            status: reward.requiresParentConsent ? 'pending_parent_consent' : 'pending_admin',
            stockReserved: reserved,
            parentDecisionBy: null,
            parentDecidedAt: null,
            voucherCode: null,
            deliveredAt: null,
            expiresAt: null,
            cancelledAt: null,
            cancelledBy: null,
            createdAt: at,
          })
          const tokenBalance = debitTokens(
            userId,
            reward.tokenCost,
            'hadiah_redeem',
            `redemption:${String(row.id)}`,
          )
          if (reserved) {
            store.update(rewardId, {
              stockQuantity: (reward.stockQuantity as number) - 1,
              updatedAt: at,
            })
          }
          return { redemption: row, tokenBalance }
        })
      },

      // --- parent consent (S8; BR-M15-20) ----------------------------------------------------

      /** Q-M15-CONSENT-PENDING rows: the children's `pending_parent_consent` rows, newest first. */
      pendingForChildren(childIds: readonly number[]): HadiahRedemption[] {
        if (childIds.length === 0) return []
        return redemptions.query({
          where: { userId: [...childIds], status: 'pending_parent_consent' },
          sort: QUEUE_ORDER,
        }).rows
      },

      /** Q-M15-CHILD-HISTORY rows: every other status, newest first. */
      historyForChildren(childIds: readonly number[]): HadiahRedemption[] {
        if (childIds.length === 0) return []
        return redemptions.query({
          where: { userId: [...childIds], status: { ne: 'pending_parent_consent' } },
          sort: QUEUE_ORDER,
        }).rows
      },

      /** #15: `pending_parent_consent` → `pending_admin` (404 when not a child's, 409 when settled). */
      parentApprove(parentId: number, childIds: readonly number[], id: number): HadiahRedemption {
        return transaction(() => {
          const row = redemptions.get(id)
          if (!row || !childIds.includes(row.userId)) {
            throw new M15Error('NOT_FOUND', 'Tebusan tidak dijumpai.')
          }
          if (row.status !== 'pending_parent_consent') {
            throw new M15Error('CONFLICT', 'Tebusan ini tidak lagi menunggu kelulusan.')
          }
          return redemptions.update(id, {
            status: 'pending_admin',
            parentDecisionBy: parentId,
            parentDecidedAt: isoNow(),
          })
        })
      },

      /** #16: `pending_parent_consent` → `cancelled` (BR-M15-09), tokens refunded once. */
      parentReject(
        parentId: number,
        childIds: readonly number[],
        id: number,
      ): { row: HadiahRedemption; refundedTokens: number } {
        return transaction(() => {
          const row = redemptions.get(id)
          if (!row || !childIds.includes(row.userId)) {
            throw new M15Error('NOT_FOUND', 'Tebusan tidak dijumpai.')
          }
          if (row.status !== 'pending_parent_consent') {
            throw new M15Error('CONFLICT', 'Tebusan ini tidak lagi menunggu kelulusan.')
          }
          const at = isoNow()
          const refundedTokens = cancelRow(row, 'parent', at)
          redemptions.update(id, { parentDecisionBy: parentId, parentDecidedAt: at })
          return { row: redemptions.get(id) as HadiahRedemption, refundedTokens }
        })
      },

      // --- seed and fixtures ----------------------------------------------------------------

      /** Seed phase: rows keep their fixed ids. */
      seedRewards(rows: readonly HadiahReward[]): void {
        transaction(() => {
          for (const r of rows) store.insert({ ...r })
        })
      },

      seedRedemptions(rows: readonly HadiahRedemption[]): void {
        transaction(() => {
          for (const r of rows) redemptions.insert({ ...r })
        })
      },

      /**
       * §6.9 fixture `queue`: loads the three rows directly (no wallet effects; replaces rows with
       * the same ids) and sets reward 40's stock to 4.
       */
      loadRedemptionFixture(
        rows: readonly HadiahRedemption[],
        stock: Record<number, number>,
      ): void {
        transaction(() => {
          for (const r of rows) {
            if (redemptions.get(r.id)) redemptions.remove(r.id)
            redemptions.insert({ ...r })
          }
          for (const [id, qty] of Object.entries(stock)) {
            if (store.get(Number(id))) {
              store.update(Number(id), { stockQuantity: qty, updatedAt: isoNow() })
            }
          }
        })
      },

      /** Count helper for tests and fixtures. */
      redemptionTotal(): number {
        return redemptions.count()
      },

      /** Statuses present (test helper). */
      statusCount(status: RedemptionStatus): number {
        return redemptions.count({ status })
      },
    }
  },
})
