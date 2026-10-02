/**
 * M15 test hooks (`window.__mock`, dev and e2e builds; SRS M15 v1.4 §6.9; hook names are global).
 * Test-only fixtures never enter the default or demo seed; `mock.reset()` discards them.
 *
 * | Hook | Effect |
 * |---|---|
 * | `m15LoadFixture(name)` | `'queue'`: the three §6.9 redemptions (15101–15103, loaded without wallet effects), reward 40 stock 4, wallets student 2 → 20 tokens and student 4 → 15 tokens; `'draw'`: M14 draw "Cabutan Demo" (id 1 on a fresh seed). Loading again changes nothing more. |
 * | `m15Redeem({userId, rewardId})` | runs the #9 rule as that user; `{ok: true, data}` with the #9 body, or `{ok: false, code, message}` on a refusal |
 * | `m15SetReward(id, patch)` | patches a reward directly (e.g. `{isActive: true}`, `{stockQuantity: 0}`); returns the row |
 * | `m15MysteryNext({coins, xp})` | fixes the next successful opening's result (`coins` >= 1, `xp` >= 0) |
 *
 * Input is validated; a bad call throws a `RangeError` (the hook promise rejects).
 */

import { toIsoMyt } from '@/lib/time'

import type { RedeemResult } from '../api/types'
import { hadiahRepo } from './repository/hadiah'
import { findOrCreateDraw, setTokens } from './repository/m14-seam'
import { setNextMysteryResult } from './repository/mystery-box'
import { M15Error, type HadiahFields, type HadiahRedemption } from './repository/types'

const base = {
  rewardIcon: null,
  parentDecisionBy: null,
  parentDecidedAt: null,
  voucherCode: null,
  deliveredAt: null,
  expiresAt: null,
  cancelledAt: null,
  cancelledBy: null,
} as const

/** §6.9 fixture `queue`. Delivered row: code "DEMO-MCD-0001", delivered 2026-09-20T10:00, expires +90 days. */
export function queueFixtureRows(): HadiahRedemption[] {
  const delivered = Date.parse('2026-09-20T10:00:00+08:00')
  return [
    {
      ...base,
      id: 15101,
      userId: 2,
      rewardId: 40,
      rewardTitle: 'TnG eWallet RM10',
      rewardVendor: 'Touch n Go',
      rewardIcon: '💳',
      denominationRm: 10,
      tokenCost: 10,
      status: 'pending_admin',
      stockReserved: true,
      createdAt: '2026-09-24T20:15:00+08:00',
    },
    {
      ...base,
      id: 15102,
      userId: 4,
      rewardId: 1,
      rewardTitle: 'Roblox Gift Card RM10',
      rewardVendor: 'Roblox',
      rewardIcon: '🎮',
      denominationRm: 10,
      tokenCost: 10,
      status: 'pending_parent_consent',
      stockReserved: false,
      createdAt: '2026-09-25T09:30:00+08:00',
    },
    {
      ...base,
      id: 15103,
      userId: 2,
      rewardId: 26,
      rewardTitle: 'McD e-Voucher RM10',
      rewardVendor: "McDonald's",
      rewardIcon: '🍔',
      denominationRm: 10,
      tokenCost: 10,
      status: 'delivered',
      stockReserved: false,
      voucherCode: 'DEMO-MCD-0001',
      deliveredAt: toIsoMyt(delivered),
      expiresAt: toIsoMyt(delivered + 90 * 86_400_000),
      createdAt: '2026-09-19T21:00:00+08:00',
    },
  ]
}

function m15LoadFixture(name: string): { loaded: string } {
  if (name === 'queue') {
    hadiahRepo.loadRedemptionFixture(queueFixtureRows(), { 40: 4 })
    setTokens(2, 20)
    setTokens(4, 15)
    return { loaded: name }
  }
  if (name === 'draw') {
    // The M14 S10 form defaults and placeholder pool (SRS §6.9).
    findOrCreateDraw({
      title: 'Cabutan Demo',
      description: 'Cabutan ujian.',
      ticketCostSyiling: 50,
      maxTicketsPerStudent: 10,
      prizePool: [
        { label: 'Baucar Topup RM50', valueSen: 5000, qty: 1 },
        { label: 'Baucar RM5', valueSen: 500, qty: 10 },
      ],
      closesAt: '2026-09-30',
      openNow: true,
    })
    return { loaded: name }
  }
  throw new RangeError(`m15LoadFixture: unknown fixture '${name}' (queue | draw)`)
}

type RedeemOutcome = { ok: true; data: RedeemResult } | { ok: false; code: string; message: string }

function m15Redeem(input: { userId: number; rewardId: number }): RedeemOutcome {
  if (!Number.isInteger(input.userId) || !Number.isInteger(input.rewardId)) {
    throw new RangeError('m15Redeem: userId and rewardId are integers')
  }
  try {
    const { redemption, tokenBalance } = hadiahRepo.redeem(input.userId, input.rewardId)
    return { ok: true, data: { id: redemption.id, status: redemption.status, tokenBalance } }
  } catch (e) {
    if (e instanceof M15Error) return { ok: false, code: e.code, message: e.message }
    throw e
  }
}

function m15SetReward(id: number, patch: Partial<HadiahFields>) {
  const row = hadiahRepo.patch(id, patch)
  if (!row) throw new RangeError(`m15SetReward: no reward ${String(id)}`)
  return row
}

function m15MysteryNext(result: { coins: number; xp: number }): void {
  if (
    !Number.isInteger(result.coins) ||
    result.coins < 1 ||
    !Number.isInteger(result.xp) ||
    result.xp < 0
  ) {
    throw new RangeError('m15MysteryNext: coins is an integer >= 1 and xp an integer >= 0')
  }
  setNextMysteryResult({ coins: result.coins, xp: result.xp })
}

/** The plugin's `hooks` field. */
export const m15Hooks = { m15LoadFixture, m15Redeem, m15SetReward, m15MysteryNext }
