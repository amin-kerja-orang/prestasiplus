import { Inject, Injectable } from '@nestjs/common'

import { Prisma, type Draw, type DrawPrize, type MysteryBoxOpening, type Reward, type RewardRedemption } from '../../db/generated/client'
import { idFromString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import type { HadiahFields } from './hadiah.input'

/** The columns of a reward the redemption reads under its row lock. */
export interface LockedReward {
  id: bigint
  title: string
  vendor: string
  iconEmoji: string | null
  denominationRm: number
  tokenCost: number
  costValueSen: number
  stockQuantity: number | null
  maxPerMonthPerStudent: number | null
  isActive: boolean
  requiresParentConsent: boolean
}

export type DrawWithPrizes = Draw & { prizes: DrawPrize[] }

export interface QueueRow extends RewardRedemption {
  userName: string
  userEmail: string
}

const NOT_CANCELLED = { not: 'cancelled' } as const

/**
 * The only doorway to the shop tables (`rewards`, `reward_redemptions`, `mystery_box_openings`) and the ticket side of
 * `draws` / `draw_tickets`. Every method uses the active transaction when there is one (`prisma.client`). The wallet
 * tables are NEVER touched here: every coin or token movement goes through `WalletService`.
 */
@Injectable()
export class ShopRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  // --- per-user serialisation -------------------------------------------------------------------------

  /**
   * Takes the user's shop lock until the transaction ends. Every spending write (redeem, ticket, box) takes it FIRST,
   * so the monthly cap and the ticket limit are counted by one request at a time per user; the wallet row lock
   * (`WalletService`) always comes after it, so no cycle is possible.
   */
  async lockUser(userId: string): Promise<void> {
    await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop:${userId}`}))`
  }

  /**
   * Serialises the check of the session budget, which is global: the user lock does not stop two pupils counting the
   * same sum. Only a non-digital redeem takes it, after the reward row and before the wallet row (cancel never needs it,
   * it only frees budget), so no cycle is possible. The two-key form cannot collide with a one-key user lock.
   */
  async lockBudget(): Promise<void> {
    await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('shop:redeem-budget'), 0)`
  }

  // --- rewards: admin ---------------------------------------------------------------------------------

  rewardsPage(category: string | undefined, skip: number, take: number): Promise<Reward[]> {
    return this.db.reward.findMany({ where: category ? { category } : {}, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }], skip, take })
  }

  countRewards(where: { category?: string; isActive?: boolean } = {}): Promise<number> {
    return this.db.reward.count({ where })
  }

  async redemptionCounts(rewardIds: bigint[]): Promise<Map<bigint, number>> {
    if (rewardIds.length === 0) return new Map()
    const rows = await this.db.rewardRedemption.groupBy({ by: ['rewardId'], where: { rewardId: { in: rewardIds }, status: NOT_CANCELLED }, _count: { _all: true } })
    return new Map(rows.filter((r) => r.rewardId !== null).map((r) => [r.rewardId as bigint, r._count._all]))
  }

  countRedemptionsBetween(from: Date, to: Date): Promise<number> {
    return this.db.rewardRedemption.count({ where: { status: NOT_CANCELLED, createdAt: { gte: from, lt: to } } })
  }

  countRedemptionsWithStatus(status: string): Promise<number> {
    return this.db.rewardRedemption.count({ where: { status } })
  }

  reward(id: bigint): Promise<Reward | null> {
    return this.db.reward.findUnique({ where: { id } })
  }

  createReward(f: HadiahFields, at: Date): Promise<Reward> {
    return this.db.reward.create({ data: { ...this.columns(f), createdAt: at, updatedAt: at } })
  }

  updateReward(id: bigint, f: HadiahFields, at: Date): Promise<Reward> {
    return this.db.reward.update({ where: { id }, data: { ...this.columns(f), updatedAt: at } })
  }

  private columns(f: HadiahFields) {
    return {
      category: f.category,
      vendor: f.vendor,
      title: f.title,
      description: f.description,
      denominationRm: f.denominationRm,
      tokenCost: f.tokenCost,
      iconEmoji: f.iconEmoji,
      stockQuantity: f.stockQuantity,
      maxPerMonthPerStudent: f.maxPerMonthPerStudent,
      voucherValidityDays: f.voucherValidityDays,
      deliveryMethod: f.deliveryMethod,
      vendorSku: f.vendorSku,
      displayOrder: f.displayOrder,
      imageUrl: f.imageUrl === null ? null : f.imageUrl.trim(),
      termsText: f.termsText,
      isActive: f.isActive,
      requiresParentConsent: f.requiresParentConsent,
    }
  }

  /** Locks the existing rows among `ids` (ascending, so two bulk calls never wait on each other in a cycle). */
  async lockRewards(ids: bigint[]): Promise<Reward[]> {
    if (ids.length === 0) return []
    const sorted = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    await this.db.$queryRaw`SELECT id FROM rewards WHERE id IN (${Prisma.join(sorted)}) ORDER BY id FOR UPDATE`
    return this.db.reward.findMany({ where: { id: { in: sorted } }, orderBy: { id: 'asc' } })
  }

  patchReward(id: bigint, data: { isActive?: boolean; stockQuantity?: number | null; maxPerMonthPerStudent?: number | null; tokenCost?: number }, at: Date): Promise<Reward> {
    return this.db.reward.update({ where: { id }, data: { ...data, updatedAt: at } })
  }

  async deleteReward(id: bigint): Promise<void> {
    await this.db.reward.delete({ where: { id } })
  }

  async redemptionCountOf(rewardId: bigint): Promise<number> {
    return this.db.rewardRedemption.count({ where: { rewardId } })
  }

  // --- rewards: redemption ----------------------------------------------------------------------------

  /** Reads one reward and locks its row until the transaction ends (null when absent). */
  async lockReward(id: bigint): Promise<LockedReward | null> {
    const rows = await this.db.$queryRaw<LockedReward[]>`
      SELECT id, title, vendor, icon_emoji AS "iconEmoji", denomination_rm::float8 AS "denominationRm", token_cost AS "tokenCost", cost_value_sen AS "costValueSen",
             stock_quantity AS "stockQuantity", max_per_month_per_student::int AS "maxPerMonthPerStudent",
             is_active AS "isActive", requires_parent_consent AS "requiresParentConsent"
        FROM rewards WHERE id = ${id} FOR UPDATE`
    return rows[0] ?? null
  }

  /** The race-safe unit of stock: zero rows updated means out of stock (or the reward was switched off). */
  async takeStock(id: bigint, at: Date): Promise<boolean> {
    const n = await this.db.$executeRaw`
      UPDATE rewards SET stock_quantity = stock_quantity - 1, updated_at = ${at}::timestamptz
       WHERE id = ${id} AND is_active AND stock_quantity IS NOT NULL AND stock_quantity > 0`
    return n === 1
  }

  /** Gives one unit back (cancel of a reserved redemption); an unlimited or deleted reward is left alone. */
  async returnStock(id: bigint, at: Date): Promise<void> {
    await this.db.$executeRaw`UPDATE rewards SET stock_quantity = stock_quantity + 1, updated_at = ${at}::timestamptz WHERE id = ${id} AND stock_quantity IS NOT NULL`
  }

  countMonthly(userId: bigint, rewardId: bigint, from: Date, to: Date): Promise<number> {
    return this.db.rewardRedemption.count({ where: { userId, rewardId, status: NOT_CANCELLED, createdAt: { gte: from, lt: to } } })
  }

  /**
   * The non-cancelled redemptions (`pending_admin`, `delivered`) of every pupil created in `[from, to)`: how many, by how many
   * pupils, and the sum of their real cost snapshots. This one sum is both the session budget check and the liability tile
   * (FR-ADM-P2-09.1); a digital redemption has snapshot 0, so it adds nothing to the sum.
   */
  async redemptionTotals(from: Date, to: Date): Promise<{ redemptions: number; students: number; costSen: number }> {
    const rows = await this.db.$queryRaw<{ redemptions: bigint; students: bigint; cost: bigint }[]>`
      SELECT count(*)::bigint AS redemptions, count(DISTINCT user_id)::bigint AS students, COALESCE(SUM(cost_value_sen_snapshot), 0)::bigint AS cost
        FROM reward_redemptions
       WHERE status IN ('pending_admin', 'delivered') AND created_at >= ${from}::timestamptz AND created_at < ${to}::timestamptz`
    const [row] = rows
    return { redemptions: Number(row?.redemptions ?? 0), students: Number(row?.students ?? 0), costSen: Number(row?.cost ?? 0) }
  }

  insertRedemption(data: {
    userId: bigint
    rewardId: bigint
    rewardTitle: string
    rewardVendor: string
    rewardIcon: string | null
    denominationRm: number
    tokenCost: number
    tokenCostSnapshot: number
    costValueSenSnapshot: number
    status: string
    stockReserved: boolean
    clientUuid: string | null
    at: Date
  }): Promise<RewardRedemption> {
    const { at, ...rest } = data
    return this.db.rewardRedemption.create({ data: { ...rest, createdAt: at, updatedAt: at } })
  }

  /** The first redemption of this key (DM-78). */
  redemptionByClientUuid(userId: bigint, clientUuid: string): Promise<RewardRedemption | null> {
    return this.db.rewardRedemption.findFirst({ where: { userId, clientUuid } })
  }

  /** Reads one redemption and locks its row until the transaction ends. */
  async lockRedemption(id: bigint): Promise<RewardRedemption | null> {
    await this.db.$queryRaw`SELECT id FROM reward_redemptions WHERE id = ${id} FOR UPDATE`
    return this.db.rewardRedemption.findUnique({ where: { id } })
  }

  updateRedemption(id: bigint, data: Partial<Pick<RewardRedemption, 'status' | 'voucherCode' | 'deliveredAt' | 'expiresAt' | 'cancelledAt' | 'cancelledBy' | 'stockReserved'>>, at: Date): Promise<RewardRedemption> {
    return this.db.rewardRedemption.update({ where: { id }, data: { ...data, updatedAt: at } })
  }

  async queue(status: string | 'all', skip: number, take: number): Promise<{ rows: QueueRow[]; total: number }> {
    const where = status === 'all' ? {} : { status }
    const [total, rows] = await Promise.all([
      this.db.rewardRedemption.count({ where }),
      this.db.rewardRedemption.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }),
    ])
    const ids = [...new Set(rows.map((r) => r.userId))]
    const users = ids.length ? await this.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : []
    const byId = new Map(users.map((u) => [u.id, u]))
    return { total, rows: rows.map((r) => ({ ...r, userName: byId.get(r.userId)?.name ?? '', userEmail: byId.get(r.userId)?.email ?? '' })) }
  }

  /**
   * Which of `ids` (one page of the queue) count as a double submission (FR-ADM-P2-08.3): the same pupil has another non-cancelled
   * redemption of the same reward within 60 seconds. Computed from `created_at` (ix_reward_redemptions_user_id_reward_id_created_at).
   * A redemption whose reward was deleted has no reward to compare, so it is never flagged.
   */
  async doubleSubmits(ids: bigint[]): Promise<Set<bigint>> {
    if (ids.length === 0) return new Set()
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`
      SELECT r.id FROM reward_redemptions r
       WHERE r.id IN (${Prisma.join(ids)}) AND r.reward_id IS NOT NULL AND EXISTS (
         SELECT 1 FROM reward_redemptions o
          WHERE o.user_id = r.user_id AND o.reward_id = r.reward_id AND o.id <> r.id AND o.status <> 'cancelled'
            AND o.created_at BETWEEN r.created_at - interval '60 seconds' AND r.created_at + interval '60 seconds')`
    return new Set(rows.map((r) => r.id))
  }

  // --- mystery boxes ----------------------------------------------------------------------------------

  countOpenings(userId: bigint): Promise<number> {
    return this.db.mysteryBoxOpening.count({ where: { userId } })
  }

  recentOpenings(userId: bigint, limit: number): Promise<MysteryBoxOpening[]> {
    return this.db.mysteryBoxOpening.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit })
  }

  insertOpening(userId: bigint, boxId: number, coins: number, xp: number, at: Date): Promise<MysteryBoxOpening> {
    return this.db.mysteryBoxOpening.create({ data: { userId, boxId, coins, xp, createdAt: at } })
  }

  // --- draws (ticket side) ----------------------------------------------------------------------------

  openDraws(): Promise<DrawWithPrizes[]> {
    return this.db.draw.findMany({ where: { status: 'open' }, include: { prizes: { orderBy: { position: 'asc' } } } })
  }

  draw(id: bigint): Promise<Draw | null> {
    return this.db.draw.findUnique({ where: { id } })
  }

  /** Share-locks the draw row until the transaction ends: a draw run (which takes the row FOR UPDATE) cannot interleave with a ticket sale. */
  async lockDrawShared(id: bigint): Promise<void> {
    await this.db.$queryRaw`SELECT id FROM draws WHERE id = ${id} FOR SHARE`
  }

  countTickets(drawId: bigint, userId: bigint): Promise<number> {
    return this.db.drawTicket.count({ where: { drawId, userId } })
  }

  async ticketCounts(userId: bigint, drawIds: bigint[]): Promise<Map<bigint, number>> {
    if (drawIds.length === 0) return new Map()
    const rows = await this.db.drawTicket.groupBy({ by: ['drawId'], where: { userId, drawId: { in: drawIds } }, _count: { _all: true } })
    return new Map(rows.map((r) => [r.drawId, r._count._all]))
  }

  /** The first ticket of this key (DM-78). */
  ticketByClientUuid(userId: bigint, clientUuid: string) {
    return this.db.drawTicket.findFirst({ where: { userId, clientUuid } })
  }

  insertTicket(drawId: bigint, userId: bigint, clientUuid: string | null, at: Date) {
    return this.db.drawTicket.create({ data: { drawId, userId, clientUuid, createdAt: at } })
  }
}

export const idOrNull = (text: string): bigint | null => {
  try {
    return idFromString(text)
  } catch {
    return null
  }
}
