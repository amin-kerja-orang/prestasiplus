import { Inject, Injectable } from '@nestjs/common'
import {
  REWARD_CATEGORIES,
  REWARD_REDEMPTION_STATUSES,
  type RewardBulkResult,
  type RewardCancelResult,
  type RewardCategory,
  type RewardDeliverResult,
  type RewardItem,
  type RewardListResponse,
  type RewardRedemptionListResponse,
  type RewardRedemptionStatus,
} from '@pp/contract'

import { AUDIT_ACTIONS, AuditService } from '../../common/audit'
import { listMeta } from '../../common/http/respond'
import { toMytTimestamp } from '../../common/time/myt'
import type { TxClient } from '../../db/client'
import { CLOCK, type Clock } from '../../db/clock'
import type { Reward } from '../../db/generated/client'
import { idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { WalletService } from '../wallet'
import type { ShopActor } from './actor'
import { parseBulk, parseHadiahInput, parseVoucherCode } from './hadiah.input'
import { ADMIN_PAGE_SIZE, CATEGORY_TABLE_LABELS, SOURCES } from './shop.constants'
import { notPending, plainNotFound, redemptionNotFound, validation } from './shop.errors'
import { ShopRepository, idOrNull } from './shop.repository'
import { mytMonthRange } from './shop.time'

const DAY_MS = 86_400_000
const DIGITS = /^\d+$/

/** The id of a path segment: digits that fit a bigint, else null (answered as the default 404). */
const idOf = (text: string): bigint | null => (DIGITS.test(text) ? idOrNull(text.replace(/^0+(?=\d)/, '') || '0') : null)

/** `?page=`: a positive integer, anything else reads as 1. */
function pageOf(raw: unknown): number {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (typeof v !== 'string' || !/^\d{1,9}$/.test(v)) return 1
  return Math.max(1, Number(v))
}

const firstString = (raw: unknown): string | undefined => {
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' ? v : undefined
}

export const rewardView = (r: Reward): RewardItem => ({
  id: idToString(r.id),
  category: r.category as RewardCategory,
  vendor: r.vendor,
  title: r.title,
  description: r.description,
  denominationRm: r.denominationRm.toNumber(),
  tokenCost: r.tokenCost,
  iconEmoji: r.iconEmoji,
  stockQuantity: r.stockQuantity,
  maxPerMonthPerStudent: r.maxPerMonthPerStudent,
  voucherValidityDays: r.voucherValidityDays,
  deliveryMethod: r.deliveryMethod as RewardItem['deliveryMethod'],
  vendorSku: r.vendorSku,
  displayOrder: r.displayOrder,
  imageUrl: r.imageUrl,
  termsText: r.termsText,
  isActive: r.isActive,
  requiresParentConsent: r.requiresParentConsent,
  createdAt: toMytTimestamp(r.createdAt),
  updatedAt: toMytTimestamp(r.updatedAt),
})

/**
 * Admin side of M15 (SRS M15 section 7 #1 to #8): the Hadiah catalogue, the bulk actions and the redemption queue.
 * Every write runs in one transaction with its audit row (actor, target and counts; never a voucher code).
 * A cancel refunds the tokens through `WalletService` (key `hadiah_refund` / `redemption:{id}`, so a retry is a replay
 * and can never refund twice) and gives the stock back only when it was reserved.
 */
@Injectable()
export class ShopAdminService {
  constructor(
    @Inject(ShopRepository) private readonly repo: ShopRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private record(actor: ShopActor, action: string, targetType: string, targetId: string | null, details?: Record<string, unknown>) {
    return this.audit.record({
      action,
      actorUserId: actor.userId,
      actorRole: actor.role,
      targetType,
      targetId,
      requestId: actor.requestId,
      ip: actor.ip,
      isTest: actor.isTest,
      ...(details ? { details } : {}),
    })
  }

  // --- #1, #2 reads -----------------------------------------------------------------------------------

  async list(query: { cat?: unknown; page?: unknown }): Promise<RewardListResponse> {
    const cat = firstString(query.cat)
    const page = pageOf(query.page)
    const known = cat === undefined || cat === 'all' || (REWARD_CATEGORIES as readonly string[]).includes(cat)
    const activeCat: RewardListResponse['meta']['activeCat'] = cat === undefined || cat === 'all' ? 'all' : known ? (cat as RewardCategory) : null
    const category = cat === undefined || cat === 'all' ? undefined : cat
    const total = known ? await this.repo.countRewards(category ? { category } : {}) : 0
    const start = (page - 1) * ADMIN_PAGE_SIZE
    const rows = known && start < total ? await this.repo.rewardsPage(category, start, ADMIN_PAGE_SIZE) : []
    const counts = await this.repo.redemptionCounts(rows.map((r) => r.id))
    const { from, to } = mytMonthRange(this.clock.now())
    const [all, active, redemptionsThisMonth, pendingAdmin] = await Promise.all([
      this.repo.countRewards(),
      this.repo.countRewards({ isActive: true }),
      this.repo.countRedemptionsBetween(from, to),
      this.repo.countRedemptionsWithStatus('pending_admin'),
    ])
    return {
      data: rows.map((r) => ({
        id: idToString(r.id),
        category: r.category as RewardCategory,
        categoryLabel: CATEGORY_TABLE_LABELS[r.category as RewardCategory],
        vendor: r.vendor,
        title: r.title,
        iconEmoji: r.iconEmoji,
        denominationRm: r.denominationRm.toNumber(),
        tokenCost: r.tokenCost,
        stockQuantity: r.stockQuantity,
        redemptionCount: counts.get(r.id) ?? 0,
        isActive: r.isActive,
      })),
      meta: { ...listMeta(page, ADMIN_PAGE_SIZE, total), activeCat, cards: { total: all, active, redemptionsThisMonth, pendingAdmin } },
    }
  }

  async get(idText: string): Promise<RewardItem> {
    const id = idOf(idText)
    const row = id === null ? null : await this.repo.reward(id)
    if (!row) throw plainNotFound()
    return rewardView(row)
  }

  // --- #3, #4 create and replace ----------------------------------------------------------------------

  async create(actor: ShopActor, body: unknown): Promise<RewardItem> {
    const parsed = parseHadiahInput(body)
    if (!parsed.ok) throw validation(parsed.fields)
    return this.prisma.transaction(async () => {
      const row = await this.repo.createReward(parsed.value, this.clock.now())
      await this.record(actor, AUDIT_ACTIONS.SHOP_REWARD_CREATED, 'reward', idToString(row.id))
      return rewardView(row)
    })
  }

  async update(actor: ShopActor, idText: string, body: unknown): Promise<RewardItem> {
    const id = idOf(idText)
    if (id === null || !(await this.repo.reward(id))) throw plainNotFound()
    const parsed = parseHadiahInput(body)
    if (!parsed.ok) throw validation(parsed.fields)
    return this.prisma.transaction(async () => {
      // The row may have been deleted between the check and the write: that is the same 404.
      if (!(await this.repo.lockRewards([id])).length) throw plainNotFound()
      const row = await this.repo.updateReward(id, parsed.value, this.clock.now())
      await this.record(actor, AUDIT_ACTIONS.SHOP_REWARD_UPDATED, 'reward', idToString(row.id))
      return rewardView(row)
    })
  }

  // --- #5 bulk ----------------------------------------------------------------------------------------

  async bulk(actor: ShopActor, body: unknown): Promise<RewardBulkResult> {
    const parsed = parseBulk(body)
    if (!parsed.ok) throw validation(parsed.fields)
    const { change } = parsed
    const ids = [...new Set(parsed.ids)].map((t) => idOrNull(t)).filter((i): i is bigint => i !== null)
    return this.prisma.transaction(async () => {
      const at = this.clock.now()
      const rows = await this.repo.lockRewards(ids)
      const keptIds: string[] = []
      let affected = 0
      for (const row of rows) {
        switch (change.action) {
          case 'activate':
            await this.repo.patchReward(row.id, { isActive: true }, at)
            break
          case 'deactivate':
            await this.repo.patchReward(row.id, { isActive: false }, at)
            break
          case 'set_stock':
            await this.repo.patchReward(row.id, { stockQuantity: change.value }, at)
            break
          case 'set_max_per_month':
            await this.repo.patchReward(row.id, { maxPerMonthPerStudent: change.value }, at)
            break
          case 'set_token_cost': {
            // Half up, clamped to 1..10000; denominationRm is unchanged.
            const next = Math.floor(row.tokenCost * (1 + change.pct / 100) + 0.5)
            await this.repo.patchReward(row.id, { tokenCost: Math.max(1, Math.min(10000, next)) }, at)
            break
          }
          case 'delete':
            if ((await this.repo.redemptionCountOf(row.id)) > 0) {
              keptIds.push(idToString(row.id))
              continue
            }
            await this.repo.deleteReward(row.id)
            break
        }
        affected += 1
      }
      await this.record(actor, AUDIT_ACTIONS.SHOP_REWARD_BULK_ACTION, 'reward', null, { action: change.action, requested: ids.length, affected })
      return change.action === 'delete' ? { affected, keptIds } : { affected }
    })
  }

  // --- #6 queue ---------------------------------------------------------------------------------------

  async queue(query: { status?: unknown; page?: unknown }): Promise<RewardRedemptionListResponse> {
    const raw = firstString(query.status)
    const status = raw === undefined ? 'pending_admin' : raw
    const page = pageOf(query.page)
    const known = status === 'all' || (REWARD_REDEMPTION_STATUSES as readonly string[]).includes(status)
    const activeStatus: RewardRedemptionListResponse['meta']['activeStatus'] = status === 'all' ? 'all' : known ? (status as RewardRedemptionStatus) : null
    const start = (page - 1) * ADMIN_PAGE_SIZE
    const { rows, total } = known ? await this.repo.queue(status, start, ADMIN_PAGE_SIZE) : { rows: [], total: 0 }
    return {
      data: rows.map((r) => ({
        id: idToString(r.id),
        user: { id: idToString(r.userId), name: r.userName, email: r.userEmail },
        rewardId: r.rewardId === null ? '' : idToString(r.rewardId),
        rewardTitle: r.rewardTitle,
        rewardVendor: r.rewardVendor,
        denominationRm: r.denominationRm.toNumber(),
        tokenCost: r.tokenCost,
        status: r.status as RewardRedemptionStatus,
        createdAt: toMytTimestamp(r.createdAt),
      })),
      meta: { ...listMeta(page, ADMIN_PAGE_SIZE, total), activeStatus },
    }
  }

  // --- #7 deliver, #8 cancel --------------------------------------------------------------------------

  async deliver(actor: ShopActor, idText: string, body: unknown): Promise<RewardDeliverResult> {
    const id = idOf(idText)
    // The id is checked before the body (contract): an unknown id is 404 whatever the body says.
    if (id === null || !(await this.prisma.client.rewardRedemption.findUnique({ where: { id }, select: { id: true } }))) throw plainNotFound()
    const parsed = parseVoucherCode(body)
    if (!parsed.ok) throw validation(parsed.fields)
    return this.prisma.transaction(async () => {
      const row = await this.repo.lockRedemption(id)
      if (!row) throw plainNotFound()
      if (row.status !== 'pending_admin') throw notPending()
      const reward = row.rewardId === null ? null : await this.repo.reward(row.rewardId)
      const now = this.clock.now()
      const deliveredAt = new Date(now.getTime() - (now.getTime() % 1000))
      const expiresAt = new Date(deliveredAt.getTime() + (reward?.voucherValidityDays ?? 365) * DAY_MS)
      await this.repo.updateRedemption(id, { status: 'delivered', voucherCode: parsed.code, deliveredAt, expiresAt }, now)
      await this.record(actor, AUDIT_ACTIONS.SHOP_REDEMPTION_DELIVERED, 'reward_redemption', idToString(id))
      return { id: idToString(id), status: 'delivered', deliveredAt: toMytTimestamp(deliveredAt), expiresAt: toMytTimestamp(expiresAt) }
    })
  }

  async cancel(actor: ShopActor, idText: string): Promise<RewardCancelResult> {
    const id = idOf(idText)
    if (id === null) throw plainNotFound()
    return this.prisma.transaction(async (tx: TxClient) => {
      const row = await this.repo.lockRedemption(id)
      if (!row) throw redemptionNotFound()
      if (row.status !== 'pending_admin') throw notPending()
      const at = this.clock.now()
      if (row.tokenCost > 0) {
        await this.wallet.creditTokens({ userId: idToString(row.userId), amount: row.tokenCost, source: SOURCES.refund, refId: `redemption:${idToString(row.id)}`, isTest: false }, { tx })
      }
      if (row.stockReserved && row.rewardId !== null) await this.repo.returnStock(row.rewardId, at)
      await this.repo.updateRedemption(id, { status: 'cancelled', cancelledAt: at, cancelledBy: 'admin', stockReserved: false }, at)
      await this.record(actor, AUDIT_ACTIONS.SHOP_REDEMPTION_CANCELLED, 'reward_redemption', idToString(id), { refund: row.tokenCost })
      return { id: idToString(id), status: 'cancelled', refundedTokens: row.tokenCost }
    })
  }
}
