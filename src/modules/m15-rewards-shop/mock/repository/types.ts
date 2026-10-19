/**
 * M15 row types (SRS M15 v1.4 §6.2–§6.5). Owned by M15 (D12); other modules read them only through
 * the repositories exported by `../index.ts`. Dates are ISO 8601 (+08:00). The shared contract
 * types live in `api/types.ts`.
 */

import type { CancelledBy, HadiahReward, MysteryBoxView, RedemptionStatus } from '../../api/types'

export type { CancelledBy, HadiahReward, RedemptionStatus }
export type { DeliveryMethod, HadiahCategory } from '../../api/types'

/** The writable fields of a reward after defaults (BR-M15-13): what the repository stores. */
export type HadiahFields = Omit<HadiahReward, 'id' | 'createdAt' | 'updatedAt'>

/** DATA-M15-02. */
export interface HadiahRedemption {
  id: number
  userId: number
  rewardId: number
  rewardTitle: string
  rewardVendor: string
  rewardIcon: string | null
  denominationRm: number
  tokenCost: number
  status: RedemptionStatus
  stockReserved: boolean
  parentDecisionBy: number | null
  parentDecidedAt: string | null
  voucherCode: string | null
  deliveredAt: string | null
  expiresAt: string | null
  cancelledAt: string | null
  cancelledBy: CancelledBy | null
  createdAt: string
}

/** DATA-M15-03 (constants). */
export type MysteryBox = MysteryBoxView

/** DATA-M15-04. */
export interface MysteryBoxOpening {
  id: number
  userId: number
  boxId: number
  coins: number
  xp: number
  createdAt: string
}

/** Refusal of an M15 write; handlers map `code` to the §7 error response (nothing was written). */
export type M15ErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'OUT_OF_STOCK'
  | 'MONTHLY_CAP'
  | 'INSUFFICIENT_TOKENS'
  | 'DRAW_CLOSED'
  | 'TICKET_LIMIT'
  | 'INSUFFICIENT_BALANCE'

export class M15Error extends Error {
  readonly code: M15ErrorCode
  constructor(code: M15ErrorCode, message: string) {
    super(message)
    this.name = 'M15Error'
    this.code = code
  }
}
