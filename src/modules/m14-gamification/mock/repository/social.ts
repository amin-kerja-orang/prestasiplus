/**
 * `referrals`, `learnerBadges`, `draws`, `settings` and `rewardControl` repositories (SRS M14 v1.7
 * §7.1, §6.13; BR-M14-18/19, 22, 29, 31, 32; DATA-M14-09, 16–20).
 */

import { formatDateKey, yearRange } from '@/lib/time'
import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'
import { users } from '@/modules/m01-authentication/mock'

import {
  REFERRAL_REWARD_REFEREE,
  REFERRAL_REWARD_REFERRER,
  TOGGLE_SETTING_KEYS,
} from '../data/catalogue'
import {
  drawTicketsTable,
  drawsTable,
  learnerBadgeHoldingsTable,
  learnerBadgesTable,
  referralCodesTable,
  referralsTable,
  rewardClaimsTable,
  settingsTable,
  syilingRewardsTable,
} from '../tables/tables'
import {
  M14Error,
  bindTx,
  creditSyilingOp,
  debitSyilingOp,
  isoAt,
  nowMs,
  settingValue,
  tx,
  walletState,
} from './ops'
import { ADMIN_REFERRAL_CODE, referralCodeFor } from './rules'
import type {
  Draw,
  DrawTicket,
  GamificationSetting,
  LearnerBadge,
  LearnerBadgeHolding,
  PrizeLine,
  Referral,
  SettingKey,
  SyilingReward,
} from './types'

// --- referrals --------------------------------------------------------------------------------

export const referralQueries = defineNamedQueries(referralsTable, {
  'Q-REFERRALS': {
    where: (userId: number) => ({ referrerId: userId }),
    expected: [{ args: [1], value: 0 }],
    source: 'M14 §6.10 (S16 "Rujukan")',
  },
})

function codeOf(userId: number): string {
  const stored = referralCodesTable.get(userId)
  if (stored) return stored.code
  // BR-M14-18: created on first read; unique (a clash takes the next salt).
  for (let salt = 0; ; salt++) {
    const code = userId === 1 ? ADMIN_REFERRAL_CODE : referralCodeFor(userId, salt)
    if (referralCodesTable.count({ code }) === 0) {
      referralCodesTable.insert({ id: userId, userId, code })
      return code
    }
  }
}

export const referralsRepo = defineRepository({
  owner: 'M14',
  name: 'referrals',
  store: referralsTable,
  stores: { codes: referralCodesTable },
  queries: referralQueries,
  methods: ({ transaction }) => {
    bindTx(transaction)
    return {
      /** BR-M14-18: the user's code (created on first read of S16). */
      codeOf(userId: number): string {
        return tx(() => codeOf(userId))
      },
      /** #11 statistics (BR-M14-19). */
      stats(userId: number): { referrals: number; rewarded: number; syilingEarned: number } {
        const rows = referralsTable.query({ where: { referrerId: userId } }).rows
        const rewarded = rows.filter((r) => r.rewarded).length
        return {
          referrals: rows.length,
          rewarded,
          syilingEarned: rewarded * REFERRAL_REWARD_REFERRER,
        }
      },
      /**
       * M01 register (XR-M14-02, BR-M14-19, provisional): a known code of another existing user,
       * and a referee not referred before → new user +25, referrer +50, a rewarded Referral row.
       * Otherwise nothing.
       */
      onRegistered(newUserId: number, code: string | null | undefined): Referral | null {
        const normalised = (code ?? '').trim().toUpperCase()
        if (normalised === '') return null
        const owner = referralCodesTable.query({ where: { code: normalised } }).rows[0]
        if (!owner || owner.userId === newUserId || !users.get(owner.userId)) return null
        if (referralsTable.count({ refereeId: newUserId }) > 0) return null
        const at = nowMs()
        return tx(() => {
          creditSyilingOp(
            newUserId,
            REFERRAL_REWARD_REFEREE,
            { type: 'bonus', source: 'referral', description: `Bonus rujukan: kod ${normalised}` },
            at,
          )
          creditSyilingOp(
            owner.userId,
            REFERRAL_REWARD_REFERRER,
            { type: 'bonus', source: 'referral', description: 'Rujukan kawan berjaya' },
            at,
          )
          return referralsTable.insert({
            referrerId: owner.userId,
            refereeId: newUserId,
            codeUsed: normalised,
            rewarded: true,
            createdAt: isoAt(at),
          })
        })
      },
      /** Seed: the codes of accounts 1–11 (admin "4JURJTT"; others deterministic). */
      seedCodes(userIds: readonly number[]): void {
        tx(() => userIds.forEach((id) => codeOf(id)))
      },
    }
  },
})

// --- learner badges ---------------------------------------------------------------------------

export const learnerBadgesRepo = defineRepository({
  owner: 'M14',
  name: 'learnerBadges',
  store: learnerBadgeHoldingsTable,
  stores: { badges: learnerBadgesTable },
  methods: ({ transaction }) => {
    bindTx(transaction)
    return {
      /** DATA-M14-20 holdings of a user, with the badge (M08 FR-126, M10 BR-M10-16, M05 FR-16). */
      forUser(userId: number): (LearnerBadge & { awardedAt: string })[] {
        return learnerBadgeHoldingsTable
          .query({ where: { userId }, sort: ['awardedAt', 'id'] })
          .rows.flatMap((h) => {
            const b = learnerBadgesTable.get(h.badgeId)
            return b ? [{ ...b, awardedAt: h.awardedAt }] : []
          })
      },
      catalogue(): LearnerBadge[] {
        return learnerBadgesTable.query({ sort: 'id' }).rows
      },
      seed(
        badges: readonly LearnerBadge[],
        holdings: readonly Omit<LearnerBadgeHolding, 'id'>[],
      ): void {
        tx(() => {
          badges.forEach((b) => learnerBadgesTable.insert({ ...b }))
          holdings.forEach((h) => learnerBadgeHoldingsTable.insert({ ...h }))
        })
      },
    }
  },
})

// --- draws ------------------------------------------------------------------------------------

export interface DrawInput {
  title: string
  description?: string
  ticketCostSyiling?: number
  maxTicketsPerStudent?: number
  prizePool?: readonly PrizeLine[] | string | null
  closesAt?: string | null
  openNow?: boolean
}

/** V-M14-12: empty, or a JSON array of `{label, value_sen, qty}`. */
function parsePool(pool: DrawInput['prizePool']): PrizeLine[] {
  if (pool === undefined || pool === null) return []
  if (typeof pool !== 'string') return pool.map((p) => ({ ...p }))
  if (pool.trim() === '') return []
  const invalid = () => new M14Error('VALIDATION_ERROR', 'Format JSON kolam hadiah tidak sah.')
  let parsed: unknown
  try {
    parsed = JSON.parse(pool)
  } catch {
    throw invalid()
  }
  if (!Array.isArray(parsed)) throw invalid()
  return parsed.map((p: unknown) => {
    const o = p as { label?: unknown; value_sen?: unknown; qty?: unknown }
    if (typeof o.label !== 'string' || typeof o.value_sen !== 'number' || typeof o.qty !== 'number')
      throw invalid()
    return { label: o.label, valueSen: o.value_sen, qty: o.qty }
  })
}

export const drawsRepo = defineRepository({
  owner: 'M14',
  name: 'draws',
  store: drawsTable,
  stores: { tickets: drawTicketsTable },
  methods: ({ transaction }) => {
    bindTx(transaction)
    return {
      /** #43 (BR-M14-29): `open` when "Buka serta-merta", else `draft` (PROPOSED). */
      create(input: DrawInput): Draw {
        if (input.title.trim() === '')
          throw new M14Error('VALIDATION_ERROR', 'Sila lengkapkan semua medan wajib.')
        const prizePool = parsePool(input.prizePool)
        const at = nowMs()
        return tx(() =>
          drawsTable.insert({
            title: input.title.trim(),
            description: input.description ?? '',
            ticketCostSyiling: input.ticketCostSyiling ?? 50,
            maxTicketsPerStudent: input.maxTicketsPerStudent ?? 10,
            prizePool,
            closesAt: input.closesAt ?? null,
            status: input.openNow ? 'open' : 'draft',
            createdAt: isoAt(at),
          }),
        )
      },
      list(): Draw[] {
        return drawsTable.query({ sort: [{ field: 'id', dir: 'desc' }] }).rows
      },
      /** M15 S7: status `open` and `closesAt` ≥ today (local date). */
      listOpenDraws(today: string | number = nowMs()): Draw[] {
        const date =
          typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)
            ? today
            : formatDateKey(today)
        return drawsTable
          .query({ where: { status: 'open' }, sort: 'id' })
          .rows.filter((d) => d.closesAt === null || d.closesAt >= date)
      },
      ticketsOf(drawId: number, userId: number): DrawTicket[] {
        return drawTicketsTable.query({ where: { drawId, userId }, sort: 'id' }).rows
      },
      ticketCount(drawId: number): number {
        return drawTicketsTable.count({ drawId })
      },
      /** BR-M14-29: one ticket; `DRAW_CLOSED`, `TICKET_LIMIT`, `INSUFFICIENT_BALANCE`. */
      buyTicket(drawId: number, userId: number): { ticket: DrawTicket; currentSyiling: number } {
        const draw = drawsTable.get(drawId)
        const at = nowMs()
        const today = formatDateKey(at)
        if (!draw || draw.status !== 'open' || (draw.closesAt !== null && draw.closesAt < today)) {
          throw new M14Error('DRAW_CLOSED', 'Cabutan ditutup.')
        }
        if (drawTicketsTable.count({ drawId, userId }) >= draw.maxTicketsPerStudent) {
          throw new M14Error('TICKET_LIMIT', 'Had tiket dicapai.')
        }
        if (walletState(userId).currentSyiling < draw.ticketCostSyiling) {
          throw new M14Error('INSUFFICIENT_BALANCE', 'Baki syiling tidak mencukupi.')
        }
        return tx(() => {
          const { wallet } = debitSyilingOp(
            userId,
            draw.ticketCostSyiling,
            {
              source: 'cabutan_ticket',
              description: `Tiket Cabutan: ${draw.title}`,
              refId: `draw:${String(drawId)}`,
            },
            at,
          )
          const ticket = drawTicketsTable.insert({ drawId, userId, createdAt: isoAt(at) })
          return { ticket, currentSyiling: wallet.currentSyiling }
        })
      },
    }
  },
})

// --- settings ---------------------------------------------------------------------------------

export const settingsRepo = defineRepository({
  owner: 'M14',
  name: 'settings',
  store: settingsTable,
  methods: ({ transaction }) => {
    bindTx(transaction)
    return {
      /** DATA-M14-16: the value of a key (0 when unknown). */
      get(key: SettingKey): number {
        return settingValue(key)
      },
      /** #38 rows in the S9 order. */
      all(): (GamificationSetting & { kind: 'number' | 'toggle' })[] {
        return settingsTable.query({ sort: 'id' }).rows.map((s) => ({
          ...s,
          kind: (TOGGLE_SETTING_KEYS as readonly string[]).includes(s.key) ? 'toggle' : 'number',
        }))
      },
      /** #39 / #41 (BR-M14-32): only the posted keys; integers ≥ 0 (toggles 0 / 1). */
      update(values: readonly { key: string; value: number }[]): GamificationSetting[] {
        for (const { key, value } of values) {
          const row = settingsTable.query({ where: { key: key as SettingKey } }).rows[0]
          const toggle = (TOGGLE_SETTING_KEYS as readonly string[]).includes(key)
          if (!row || !Number.isInteger(value) || value < 0 || (toggle && value > 1)) {
            throw new M14Error('VALIDATION_ERROR', 'Sila lengkapkan semua medan wajib.')
          }
        }
        return tx(() =>
          values.map(({ key, value }) => {
            const row = settingsTable.query({ where: { key: key as SettingKey } })
              .rows[0] as GamificationSetting
            return settingsTable.update(row.id, { value })
          }),
        )
      },
      seed(rows: readonly GamificationSetting[]): void {
        tx(() => rows.forEach((r) => settingsTable.insert({ ...r })))
      },
    }
  },
})

// --- reward control (S10) ---------------------------------------------------------------------

export const rewardControlRepo = defineRepository({
  owner: 'M14',
  name: 'rewardControl',
  store: syilingRewardsTable,
  stores: { claims: rewardClaimsTable },
  methods: ({ transaction }) => {
    bindTx(transaction)
    return {
      /** Q-RC-CLAIMS (BR-M14-31) over claims in `current_session_year`. */
      claimTiles(): { sessionYear: number; liabilityRm: number; students: number; claims: number } {
        const year = settingValue('current_session_year')
        const range = yearRange(`${String(year)}-06-01T00:00:00+08:00`)
        const rows = rewardClaimsTable.query({}).rows.filter((c) => {
          const t = Date.parse(c.claimedAt)
          return t >= range.start && t < range.end
        })
        return {
          sessionYear: year,
          liabilityRm: rows.reduce((s, c) => s + c.costValueSen, 0) / 100,
          students: new Set(rows.map((c) => c.userId)).size,
          claims: rows.length,
        }
      },
      rewards(): SyilingReward[] {
        return syilingRewardsTable.query({ sort: 'id' }).rows
      },
      /** #42. */
      setCost(id: number, costValueSen: number): SyilingReward {
        if (!syilingRewardsTable.get(id)) throw new M14Error('NOT_FOUND', 'Hadiah tidak dijumpai.')
        if (!Number.isInteger(costValueSen) || costValueSen < 0) {
          throw new M14Error('VALIDATION_ERROR', 'Sila lengkapkan semua medan wajib.')
        }
        return tx(() => syilingRewardsTable.update(id, { costValueSen }))
      },
      seed(rows: readonly SyilingReward[]): void {
        tx(() => rows.forEach((r) => syilingRewardsTable.insert({ ...r })))
      },
    }
  },
})
