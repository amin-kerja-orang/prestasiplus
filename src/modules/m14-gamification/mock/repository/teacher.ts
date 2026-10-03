/**
 * Teacher side (SRS M14 v1.7 §7.1; BR-M14-23, 25–28; DATA-M14-10…15): `teacherGamification`
 * (contributions and badges), `teacherWallet` (S19 summary, leaderboard), `teacherCash` (S20 / S8)
 * and `teacherRewards` (S21 / S6 / S7).
 */

import { monthRange } from '@/lib/time'
import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'
import { schools } from '@/modules/m02-users-schools/mock'
import { users } from '@/modules/m01-authentication/mock'

import { CASH_BANKS } from '../data/catalogue'
import {
  cashWithdrawalsTable,
  teacherBadgeAwardsTable,
  teacherBadgesTable,
  teacherLedgerTable,
  teacherRedemptionsTable,
  teacherRewardsTable,
  teacherWalletsTable,
} from '../tables/tables'
import {
  M14Error,
  bindTx,
  isoAt,
  nowMs,
  settingValue,
  teacherCreditOp,
  teacherWalletOf,
  tx,
} from './ops'
import { cashSenOf, maskAccount, maskHolder } from './rules'
import type {
  CashStatus,
  CashWithdrawal,
  RedemptionStatus,
  TeacherBadge,
  TeacherRedemption,
  TeacherReward,
  TeacherRewardCategory,
  TeacherTransaction,
  TeacherWallet,
} from './types'

const HOLD_CASH: readonly CashStatus[] = ['PENDING', 'APPROVED', 'PROCESSING']
const HOLD_REDEMPTION: readonly RedemptionStatus[] = ['PENDING', 'PROCESSING']
/** BR-M14-27: the forward-only redemption status moves (#35). */
const REDEMPTION_TRANSITIONS: Record<RedemptionStatus, readonly RedemptionStatus[]> = {
  PENDING: ['PROCESSING', 'DELIVERED', 'CANCELLED'],
  PROCESSING: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
}

function badges(): TeacherBadge[] {
  return teacherBadgesTable.query({ sort: 'id' }).rows
}

/** Coins held by open cash requests and open redemptions (BR-M14-26/27). */
function heldOf(userId: number): { cash: number; redemptions: number } {
  const cash = cashWithdrawalsTable
    .query({ where: { userId } })
    .rows.filter((r) => HOLD_CASH.includes(r.status))
    .reduce((s, r) => s + r.coins, 0)
  const redemptions = teacherRedemptionsTable
    .query({ where: { userId } })
    .rows.filter((r) => HOLD_REDEMPTION.includes(r.status))
    .reduce((s, r) => s + r.costCoins, 0)
  return { cash, redemptions }
}

function availableOf(userId: number): number {
  const w = teacherWalletOf(userId)
  const held = heldOf(userId)
  return Math.max(0, (w?.balance ?? 0) - held.cash - held.redemptions)
}

// --- teacherGamification ----------------------------------------------------------------------

export const teacherBadgeQueries = defineNamedQueries(teacherBadgesTable, {
  'Q-TEACHER-BADGES': { expected: 8, source: 'M14 §6.10 (S6 "Lencana")' },
  'Q-TEACHER-BADGES-ACTIVE': {
    where: { isActive: true },
    expected: 8,
    source: 'M14 §6.10 (S19 "7/8")',
  },
})

export const teacherGamificationRepo = defineRepository({
  owner: 'M14',
  name: 'teacherGamification',
  store: teacherBadgesTable,
  stores: {
    awards: teacherBadgeAwardsTable,
    wallets: teacherWalletsTable,
    ledger: teacherLedgerTable,
  },
  queries: teacherBadgeQueries,
  methods: ({ transaction }) => {
    bindTx(transaction)
    return {
      /**
       * M10 (BR-M14-23, provisional): +1 question, + `coins_per_question` "Sumbang Soalan #{id}",
       * then each active badge newly reached, once: "Badge: {name} ({threshold} soalan)" +bonus.
       */
      onQuestionContributed(
        teacherId: number,
        questionId: number,
        at: number | string = nowMs(),
      ): TeacherWallet {
        return tx(() => {
          let wallet = teacherCreditOp(
            teacherId,
            settingValue('coins_per_question'),
            `Sumbang Soalan #${String(questionId)}`,
            at,
            { questionsDelta: 1 },
          )
          const earned = new Set(
            teacherBadgeAwardsTable
              .query({ where: { userId: teacherId } })
              .rows.map((a) => a.badgeId),
          )
          for (const b of badges()) {
            if (!b.isActive || earned.has(b.id) || b.threshold > wallet.questionsCount) continue
            teacherBadgeAwardsTable.insert({
              userId: teacherId,
              badgeId: b.id,
              awardedAt: isoAt(at),
            })
            wallet = teacherCreditOp(
              teacherId,
              b.bonusCoins,
              `Badge: ${b.name} (${String(b.threshold)} soalan)`,
              at,
            )
          }
          return wallet
        })
      },
      badges,
      /** #32 (editing a threshold never revokes an earned badge). */
      updateBadge(id: number, input: Partial<Omit<TeacherBadge, 'id'>>): TeacherBadge {
        if (!teacherBadgesTable.get(id)) throw new M14Error('NOT_FOUND', 'Lencana tidak dijumpai.')
        if (input.name !== undefined && input.name.trim() === '') {
          throw new M14Error('VALIDATION_ERROR', 'Sila lengkapkan semua medan wajib.')
        }
        if (
          (input.threshold !== undefined && input.threshold < 1) ||
          (input.bonusCoins !== undefined && input.bonusCoins < 0)
        ) {
          throw new M14Error('VALIDATION_ERROR', 'Sila lengkapkan semua medan wajib.')
        }
        return tx(() => teacherBadgesTable.update(id, input))
      },
      seedBadges(rows: readonly TeacherBadge[]): void {
        tx(() => rows.forEach((r) => teacherBadgesTable.insert({ ...r })))
      },
    }
  },
})

// --- teacherWallet ----------------------------------------------------------------------------

export interface TeacherSummary {
  userId: number
  balance: number
  totalEarned: number
  questionsCount: number
  coinsPerQuestion: number
  badges: (TeacherBadge & { earned: boolean })[]
  badgesEarned: number
  badgesActive: number
  nextBadge: (TeacherBadge & { need: number }) | null
  transactions: TeacherTransaction[]
}

export const teacherWalletRepo = defineRepository({
  owner: 'M14',
  name: 'teacherWallet',
  store: teacherWalletsTable,
  stores: { ledger: teacherLedgerTable, awards: teacherBadgeAwardsTable },
  methods: ({ transaction }) => {
    bindTx(transaction)
    return {
      /** #12 body without the catalogue (FR-M14-98/99/101): earned = questionsCount ≥ threshold. */
      summary(userId: number): TeacherSummary {
        const w = teacherWalletOf(userId)
        const questions = w?.questionsCount ?? 0
        const all = badges().map((b) => ({ ...b, earned: questions >= b.threshold }))
        const active = all.filter((b) => b.isActive)
        const next = active.find((b) => !b.earned) ?? null
        return {
          userId,
          balance: w?.balance ?? 0,
          totalEarned: w?.totalEarned ?? 0,
          questionsCount: questions,
          coinsPerQuestion: settingValue('coins_per_question'),
          badges: all,
          badgesEarned: active.filter((b) => b.earned).length,
          badgesActive: active.length,
          nextBadge: next ? { ...next, need: next.threshold - questions } : null,
          transactions: teacherLedgerTable.query({
            where: { userId },
            sort: [
              { field: 'createdAt', dir: 'desc' },
              { field: 'id', dir: 'desc' },
            ],
          }).rows,
        }
      },
      get(userId: number): TeacherWallet | undefined {
        return teacherWalletOf(userId)
      },
      /**
       * Q-TEACHER-LB (BR-M14-28): teachers only; `sekolah` = the viewer's school when the viewer is a
       * teacher, else every teacher; `questionsCount` desc, id asc; top 50; syiling = balance.
       */
      leaderboard(tab: string, viewerId: number) {
        const viewer = users.get(viewerId)
        const scope = tab === 'global' ? 'global' : 'sekolah'
        const teachers = users
          .query('U-ROLE', { sort: 'id' }, 'teacher')
          .rows.filter(
            (t) =>
              scope === 'global' || viewer?.role !== 'teacher' || t.schoolId === viewer.schoolId,
          )
        return {
          tab: scope,
          rows: teachers
            .map((t) => {
              const w = teacherWalletOf(t.id)
              return {
                userId: t.id,
                name: t.name,
                schoolId: t.schoolId,
                questions: w?.questionsCount ?? 0,
                syiling: w?.balance ?? 0,
              }
            })
            .sort((a, b) => b.questions - a.questions || a.userId - b.userId)
            .slice(0, 50)
            .map((r, i) => ({
              rank: i + 1,
              ...r,
              schoolName:
                scope === 'global' && r.schoolId !== null
                  ? (schools.get(r.schoolId)?.name ?? null)
                  : null,
            })),
        }
      },
      /** Test hook `setTeacherWallet` (no ledger row). */
      setFields(
        userId: number,
        fields: { balance?: number; questionsCount?: number },
      ): TeacherWallet {
        const at = nowMs()
        return tx(() => {
          const w = teacherWalletOf(userId)
          if (w) return teacherWalletsTable.update(userId, fields)
          return teacherWalletsTable.insert({
            id: userId,
            userId,
            balance: fields.balance ?? 0,
            totalEarned: fields.balance ?? 0,
            questionsCount: fields.questionsCount ?? 0,
            createdAt: isoAt(at),
          })
        })
      },
      /** Seed: a wallet with its badge awards (no ledger rows) and optional ledger rows. */
      seedWallet(
        wallet: TeacherWallet,
        options: {
          awardBadgesAt?: string
          ledger?: readonly Omit<TeacherTransaction, 'id' | 'userId'>[]
        } = {},
      ): void {
        tx(() => {
          teacherWalletsTable.insert({ ...wallet })
          if (options.awardBadgesAt) {
            for (const b of badges()) {
              if (b.threshold <= wallet.questionsCount) {
                teacherBadgeAwardsTable.insert({
                  userId: wallet.userId,
                  badgeId: b.id,
                  awardedAt: options.awardBadgesAt,
                })
              }
            }
          }
          for (const row of options.ledger ?? [])
            teacherLedgerTable.insert({ ...row, userId: wallet.userId })
        })
      },
    }
  },
})

// --- teacherCash --------------------------------------------------------------------------------

export const cashQueries = defineNamedQueries(cashWithdrawalsTable, {
  'Q-CASH': {
    where: (status: CashStatus) => ({ status }),
    expected: [
      { args: ['PENDING'], value: 2 },
      { args: ['APPROVED'], value: 0 },
      { args: ['PROCESSING'], value: 0 },
      { args: ['PAID'], value: 0 },
      { args: ['REJECTED'], value: 0 },
    ],
    source: 'M14 §6.10 (S8 cards, S6 badge)',
  },
})

export interface CashRequestInput {
  coinsAmount: number
  bankName: string
  bankAccount: string
  accountHolder: string
}

function maskedCash(r: CashWithdrawal) {
  return {
    id: r.id,
    userId: r.userId,
    coins: r.coins,
    cash: r.cashSen / 100,
    bankName: r.bankName,
    bankAccountMasked: maskAccount(r.bankAccount),
    accountHolderMasked: maskHolder(r.accountHolder),
    status: r.status,
    adminNote: r.adminNote,
    createdAt: r.createdAt,
  }
}

export const teacherCashRepo = defineRepository({
  owner: 'M14',
  name: 'teacherCash',
  store: cashWithdrawalsTable,
  queries: cashQueries,
  methods: ({ transaction }) => {
    bindTx(transaction)
    return {
      /** #13 (BR-M14-25/26). */
      view(userId: number) {
        const w = teacherWalletOf(userId)
        const balance = w?.balance ?? 0
        const held = heldOf(userId)
        const available = availableOf(userId)
        const rateCoins = settingValue('cash_rate_coins')
        const rateSen = settingValue('cash_rate_sen')
        return {
          balance,
          available,
          held: held.cash,
          cashValue: cashSenOf(balance, rateCoins, rateSen) / 100,
          minWithdrawal: settingValue('min_cash_withdrawal'),
          maxWithdrawal: available,
          rateCoins,
          rateSen,
          enabled: settingValue('cash_withdrawal_enabled') === 1,
          banks: [...CASH_BANKS],
          history: cashWithdrawalsTable
            .query({
              where: { userId },
              sort: [
                { field: 'createdAt', dir: 'desc' },
                { field: 'id', dir: 'desc' },
              ],
            })
            .rows.map(maskedCash),
        }
      },
      /** #14 (BR-M14-26): `CASH_DISABLED`; min ≤ coins ≤ available; PENDING. */
      request(userId: number, input: CashRequestInput) {
        if (settingValue('cash_withdrawal_enabled') !== 1) {
          throw new M14Error('CASH_DISABLED', 'Tebus tunai tidak aktif buat masa ini.')
        }
        const min = settingValue('min_cash_withdrawal')
        const coins = input.coinsAmount
        const fields = [input.bankName, input.bankAccount, input.accountHolder].map((s) => s.trim())
        if (
          !Number.isInteger(coins) ||
          coins < min ||
          coins > availableOf(userId) ||
          fields.some((s) => s === '')
        ) {
          throw new M14Error('VALIDATION_ERROR', 'Sila lengkapkan semua medan wajib.')
        }
        const at = nowMs()
        return tx(() =>
          maskedCash(
            cashWithdrawalsTable.insert({
              userId,
              coins,
              cashSen: cashSenOf(
                coins,
                settingValue('cash_rate_coins'),
                settingValue('cash_rate_sen'),
              ),
              bankName: fields[0] as string,
              bankAccount: fields[1] as string,
              accountHolder: fields[2] as string,
              status: 'PENDING',
              adminNote: null,
              createdAt: isoAt(at),
              paidDebited: false,
            }),
          ),
        )
      },
      /** #36: rows (masked) and cards (PENDING, APPROVED, PAID counts, Σ cash of PAID). */
      adminList(status: CashStatus | 'all' = 'PENDING') {
        const all = cashWithdrawalsTable.query({
          sort: [
            { field: 'createdAt', dir: 'desc' },
            { field: 'id', dir: 'desc' },
          ],
        }).rows
        const paid = all.filter((r) => r.status === 'PAID')
        return {
          cards: {
            pending: all.filter((r) => r.status === 'PENDING').length,
            approved: all.filter((r) => r.status === 'APPROVED').length,
            paid: paid.length,
            paidTotal: paid.reduce((s, r) => s + r.cashSen, 0) / 100,
          },
          rows: all.filter((r) => status === 'all' || r.status === status).map(maskedCash),
        }
      },
      /**
       * #37 (BR-M14-26): any status; entering PAID debits once ("Tebus Tunai #{id}", PROPOSED);
       * leaving PAID credits it back ("Tebus Tunai #{id} dibatalkan", INFERRED wording).
       */
      setStatus(id: number, status: CashStatus, adminNote?: string | null) {
        const row = cashWithdrawalsTable.get(id)
        if (!row) throw new M14Error('NOT_FOUND', 'Permohonan tidak dijumpai.')
        const at = nowMs()
        return tx(() => {
          let paidDebited = row.paidDebited
          if (status === 'PAID' && !row.paidDebited) {
            teacherCreditOp(row.userId, -row.coins, `Tebus Tunai #${String(id)}`, at)
            paidDebited = true
          } else if (status !== 'PAID' && row.paidDebited) {
            teacherCreditOp(row.userId, row.coins, `Tebus Tunai #${String(id)} dibatalkan`, at)
            paidDebited = false
          }
          return maskedCash(
            cashWithdrawalsTable.update(id, {
              status,
              adminNote: adminNote === undefined ? row.adminNote : adminNote,
              paidDebited,
            }),
          )
        })
      },
      seed(rows: readonly CashWithdrawal[]): void {
        tx(() => rows.forEach((r) => cashWithdrawalsTable.insert({ ...r })))
      },
    }
  },
})

// --- teacherRewards -----------------------------------------------------------------------------

export const teacherRewardQueries = defineNamedQueries(teacherRewardsTable, {
  'Q-TEACHER-REWARDS': { expected: 0, source: 'M14 §6.10 (S6 "Jumlah Ganjaran")' },
  'Q-TEACHER-REWARDS-ACTIVE': {
    where: { isActive: true },
    expected: 0,
    source: 'M14 §6.10 (S6 "Aktif")',
  },
})

export interface TeacherRewardInput {
  name: string
  category: TeacherRewardCategory
  costCoins: number
  stock?: number | null
  maxPerUser?: number | null
  maxPerMonth?: number | null
  description?: string
  imageUrl?: string | null
  isActive: boolean
}

export const teacherRewardsRepo = defineRepository({
  owner: 'M14',
  name: 'teacherRewards',
  store: teacherRewardsTable,
  stores: { redemptions: teacherRedemptionsTable },
  queries: teacherRewardQueries,
  methods: ({ transaction }) => {
    bindTx(transaction)
    return {
      list(options: { activeOnly?: boolean } = {}): TeacherReward[] {
        return teacherRewardsTable.query({
          ...(options.activeOnly ? { where: { isActive: true } } : {}),
          sort: 'id',
        }).rows
      },
      /** #33 (V-M14-08). */
      create(input: TeacherRewardInput): TeacherReward {
        if (input.name.trim() === '' || !Number.isInteger(input.costCoins) || input.costCoins < 1) {
          throw new M14Error('VALIDATION_ERROR', 'Sila lengkapkan semua medan wajib.')
        }
        const at = nowMs()
        return tx(() =>
          teacherRewardsTable.insert({
            name: input.name.trim(),
            category: input.category,
            costCoins: input.costCoins,
            stock: input.stock ?? null,
            maxPerUser: input.maxPerUser ?? null,
            maxPerMonth: input.maxPerMonth ?? null,
            description: input.description ?? '',
            imageUrl: input.imageUrl ?? null,
            isActive: input.isActive,
            createdAt: isoAt(at),
          }),
        )
      },
      /** Test fixture `m14-teacher-reward` (own id, e.g. 1001). */
      createFixture(row: TeacherReward): TeacherReward {
        return tx(() => teacherRewardsTable.insert({ ...row }))
      },
      /** #16 (BR-M14-27, PROPOSED): PENDING redemption that holds the cost. */
      redeem(userId: number, rewardId: number): TeacherRedemption {
        const reward = teacherRewardsTable.get(rewardId)
        if (!reward || !reward.isActive) throw new M14Error('NOT_FOUND', 'Ganjaran tidak dijumpai.')
        if (reward.stock !== null && reward.stock < 1)
          throw new M14Error('OUT_OF_STOCK', 'Stok habis.')
        const mine = teacherRedemptionsTable
          .query({ where: { userId } })
          .rows.filter((r) => r.rewardId === rewardId && r.status !== 'CANCELLED')
        const at = nowMs()
        const month = monthRange(at)
        const thisMonth = mine.filter((r) => {
          const t = Date.parse(r.createdAt)
          return t >= month.start && t < month.end
        })
        if (
          (reward.maxPerUser !== null && mine.length >= reward.maxPerUser) ||
          (reward.maxPerMonth !== null && thisMonth.length >= reward.maxPerMonth)
        ) {
          throw new M14Error('LIMIT_REACHED', 'Had tebusan dicapai.')
        }
        if (availableOf(userId) < reward.costCoins) {
          throw new M14Error('INSUFFICIENT_BALANCE', 'Baki syiling tidak mencukupi.')
        }
        return tx(() =>
          teacherRedemptionsTable.insert({
            userId,
            rewardId,
            costCoins: reward.costCoins,
            status: 'PENDING',
            debited: false,
            createdAt: isoAt(at),
            updatedAt: isoAt(at),
          }),
        )
      },
      /** #34. */
      redemptions(status: RedemptionStatus | 'all' = 'PENDING'): TeacherRedemption[] {
        return teacherRedemptionsTable
          .query({
            sort: [
              { field: 'createdAt', dir: 'desc' },
              { field: 'id', dir: 'desc' },
            ],
          })
          .rows.filter((r) => status === 'all' || r.status === status)
      },
      /** Q-TEACHER-REDEMPTIONS(status). */
      redemptionCount(status: RedemptionStatus): number {
        return teacherRedemptionsTable.count({ status })
      },
      /**
       * #35 (BR-M14-27): forward transitions only (PENDING → PROCESSING → DELIVERED, and
       * PENDING | PROCESSING → CANCELLED; any other is a 422). DELIVERED debits "Tebusan: {name}"
       * and takes one from stock exactly once (`debited`), refusing when the balance or the stock
       * no longer covers it. CANCELLED just releases the hold (nothing was debited).
       */
      setRedemptionStatus(id: number, status: RedemptionStatus): TeacherRedemption {
        const row = teacherRedemptionsTable.get(id)
        if (!row) throw new M14Error('NOT_FOUND', 'Tebusan tidak dijumpai.')
        if (!REDEMPTION_TRANSITIONS[row.status].includes(status)) {
          throw new M14Error('VALIDATION_ERROR', 'Status tebusan tidak boleh ditukar.')
        }
        const at = nowMs()
        return tx(() => {
          let debited = row.debited
          if (status === 'DELIVERED' && !row.debited) {
            const reward = teacherRewardsTable.get(row.rewardId)
            if (reward && reward.stock !== null && reward.stock < 1)
              throw new M14Error('OUT_OF_STOCK', 'Stok habis.')
            if ((teacherWalletOf(row.userId)?.balance ?? 0) < row.costCoins)
              throw new M14Error('INSUFFICIENT_BALANCE', 'Baki syiling tidak mencukupi.')
            teacherCreditOp(row.userId, -row.costCoins, `Tebusan: ${reward?.name ?? ''}`, at)
            if (reward && reward.stock !== null)
              teacherRewardsTable.update(reward.id, { stock: reward.stock - 1 })
            debited = true
          }
          return teacherRedemptionsTable.update(id, { status, debited, updatedAt: isoAt(at) })
        })
      },
    }
  },
})
