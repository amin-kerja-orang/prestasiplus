/**
 * M15 seed (SRS M15 v1.4 §6.7, §6.8): the 59 observed rewards (all Off), the 3 observed cancelled
 * redemptions (fictitious owners 3151/3152, DV-M15-15) and no openings. No balance is seeded (M14).
 * `finalise` checks the named-query seed values of §6.8 and stops the boot on a mismatch.
 */

import type { SeedContext } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import { REWARD_SEED } from '../data/rewards-seed'
import { bindM15Clock } from '../repository/clock'
import { hadiahRepo } from '../repository/hadiah'
import { setNextMysteryResult } from '../repository/mystery-box'
import type { HadiahRedemption, HadiahReward } from '../repository/types'

/** The snapshot date of the catalogue (SRS §6.7); `createdAt` / `updatedAt` are never displayed. */
const SEED_AT = '2026-09-26T11:46:00+08:00'

/** SRS §6.8 seeded redemptions (every visible value OBSERVED; the year is INFERRED). */
export const REDEMPTION_SEED: readonly HadiahRedemption[] = [
  seedRedemption(
    1,
    3152,
    16,
    'CelcomDigi Topup RM30',
    'CelcomDigi',
    30,
    '2026-04-30T04:54:00+08:00',
  ),
  seedRedemption(
    2,
    3152,
    16,
    'CelcomDigi Topup RM30',
    'CelcomDigi',
    30,
    '2026-04-30T04:54:00+08:00',
  ),
  seedRedemption(3, 3151, 10, 'Hotlink Topup RM10', 'Hotlink', 10, '2026-04-30T14:11:00+08:00'),
]

function seedRedemption(
  id: number,
  userId: number,
  rewardId: number,
  rewardTitle: string,
  rewardVendor: string,
  rm: number,
  createdAt: string,
): HadiahRedemption {
  return {
    id,
    userId,
    rewardId,
    rewardTitle,
    rewardVendor,
    rewardIcon: '📱',
    denominationRm: rm,
    tokenCost: rm,
    status: 'cancelled',
    stockReserved: false,
    parentDecisionBy: null,
    parentDecidedAt: null,
    voucherCode: null,
    deliveredAt: null,
    expiresAt: null,
    cancelledAt: null,
    cancelledBy: null,
    createdAt,
  }
}

export function seedRewards(ctx: SeedContext): void {
  bindM15Clock(ctx.clock)
  // The hook-fixed result is module state: a boot / reset never inherits it.
  setNextMysteryResult(null)
  const rewards: HadiahReward[] = REWARD_SEED.map(
    ([
      id,
      category,
      vendor,
      iconEmoji,
      title,
      description,
      denominationRm,
      tokenCost,
      stockQuantity,
      maxPerMonthPerStudent,
      voucherValidityDays,
      displayOrder,
      requiresParentConsent,
    ]) => ({
      id,
      category,
      vendor,
      title,
      description,
      denominationRm,
      tokenCost,
      iconEmoji,
      stockQuantity,
      maxPerMonthPerStudent,
      voucherValidityDays,
      deliveryMethod: 'manual' as const,
      vendorSku: null,
      displayOrder,
      imageUrl: null,
      termsText: null,
      isActive: false,
      requiresParentConsent,
      createdAt: SEED_AT,
      updatedAt: SEED_AT,
    }),
  )
  hadiahRepo.seedRewards(rewards)
  hadiahRepo.seedRedemptions(REDEMPTION_SEED)
}

/** §6.8 values at the default seed; every one must hold or the boot stops. */
export function checkSeed(): void {
  const issues: string[] = []
  const cards = hadiahRepo.cards()
  if (cards.total !== 59) issues.push(`Q-M15-TOTAL ${String(cards.total)} != 59`)
  if (cards.active !== 0) issues.push(`Q-M15-ACTIVE ${String(cards.active)} != 0`)
  if (cards.redemptionsThisMonth !== 0) issues.push('Q-M15-RED-MONTH != 0')
  if (cards.pendingAdmin !== 0) issues.push('Q-M15-PENDING-ADMIN != 0')
  const perCat: Record<string, number> = {
    flagship: 4,
    ewallet: 8,
    telco: 11,
    gaming: 8,
    streaming: 6,
    food_beverage: 8,
    ecommerce: 5,
    education: 6,
    entertainment: 3,
  }
  for (const [cat, n] of Object.entries(perCat)) {
    const got = hadiahRepo.list(cat).length
    if (got !== n) issues.push(`Q-M15-CAT(${cat}) ${String(got)} != ${String(n)}`)
  }
  if (hadiahRepo.queue('all').length !== 3) issues.push('Q-M15-QUEUE(all) != 3')
  if (hadiahRepo.queue('cancelled').length !== 3) issues.push('Q-M15-QUEUE(cancelled) != 3')
  if (hadiahRepo.queue('pending_admin').length !== 0) issues.push('Q-M15-QUEUE(pending_admin) != 0')
  if (hadiahRepo.historyCount(16) !== 2) issues.push('Q-M15-HISTORY-DELETE(16) != 2')
  if (hadiahRepo.historyCount(10) !== 1) issues.push('Q-M15-HISTORY-DELETE(10) != 1')
  for (const r of hadiahRepo.queue('all')) {
    if (!users.get(r.userId))
      issues.push(`redemption ${String(r.id)}: user ${String(r.userId)} missing`)
  }
  if (issues.length > 0) {
    throw new Error(`M15 seed check failed:\n${issues.map((m) => `- ${m}`).join('\n')}`)
  }
}
