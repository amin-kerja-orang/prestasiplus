import { Inject, Injectable } from '@nestjs/common'
import {
  REWARD_CATEGORIES,
  REWARD_VALIDATION_MESSAGES,
  type RewardCabutanView,
  type RewardMysteryBox,
  type RewardMysteryBoxOpened,
  type RewardMysteryBoxesView,
  type RewardRedeemResult,
  type RewardTicketBought,
  type ShopDigitalItemsResponse,
  type ShopDigitalRedemptionsResponse,
} from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { listMeta } from '../../common/http/respond'
import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock, mytDay } from '../../db/clock'
import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { WalletService } from '../wallet'
import { BOX_RANDOM, type BoxRandom } from './box-random'
import { MYSTERY_BOXES, SOURCES } from './shop.constants'
import { boxNotFound, modPelajarRefused, plainNotFound, rewardError, rewardNotFound, validation } from './shop.errors'
import { ShopRepository, idOrNull } from './shop.repository'
import { drawStillOpen, mytMonthRange } from './shop.time'
import type { ShopActor } from './actor'

/** An INSUFFICIENT_BALANCE of the wallet is the shop's own code and text for tokens (M15 `INSUFFICIENT_TOKENS`). */
async function tokensOr<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ApiError && e.code === 'INSUFFICIENT_BALANCE') throw rewardError('INSUFFICIENT_TOKENS')
    throw e
  }
}

/** The reward id of a redeem body: a positive integer as a number or a digit string; anything else is the mock's 422. */
function rewardIdOf(body: unknown): bigint | null {
  const raw = typeof body === 'object' && body !== null ? (body as { rewardId?: unknown }).rewardId : undefined
  const text = typeof raw === 'number' ? (Number.isSafeInteger(raw) ? String(raw) : '') : typeof raw === 'string' && /^\d+$/.test(raw) ? raw.replace(/^0+(?=\d)/, '') : ''
  if (text === '' || text === '0') return null
  return idOrNull(text)
}

const DIGITS = /^\d+$/

/**
 * Student side of M15 (SRS M15 section 7 #9 to #13, #19, #20). Every coin or token movement goes through
 * `WalletService` inside ONE transaction with the shop write, with a per-movement idempotency key.
 *
 * Mod Pelajar (an admin acting as a student, `actor.isTest`): the three spending writes are refused with 403 before
 * anything is read or written, so a test session never consumes real stock, coins or tokens and never creates a real
 * redemption, ticket or opening. Reads work normally.
 *
 * Locking: each spending write takes the user's advisory lock first (`ShopRepository.lockUser`), then the reward row
 * (`FOR UPDATE`), then the wallet row (inside `WalletService`). Two requests of one user are therefore serialised
 * (the monthly cap and the ticket limit are counted one request at a time), and the order never cycles.
 */
@Injectable()
export class ShopService {
  constructor(
    @Inject(ShopRepository) private readonly repo: ShopRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BOX_RANDOM) private readonly random: BoxRandom,
  ) {}

  // --- #9 redeem --------------------------------------------------------------------------------------

  async redeem(actor: ShopActor, body: unknown): Promise<RewardRedeemResult> {
    if (actor.isTest) throw modPelajarRefused()
    const rewardId = rewardIdOf(body)
    if (rewardId === null) throw validation({ rewardId: REWARD_VALIDATION_MESSAGES.rewardIdRequired })
    const userId = idFromString(actor.userId)
    return this.prisma.transaction(async (tx) => {
      await this.repo.lockUser(actor.userId)
      const reward = await this.repo.lockReward(rewardId)
      if (!reward?.isActive) throw rewardNotFound()
      const at = this.clock.now()
      const reserved = reward.stockQuantity !== null
      if (reserved && !(await this.repo.takeStock(rewardId, at))) throw rewardError('OUT_OF_STOCK')
      if (reward.maxPerMonthPerStudent !== null) {
        const { from, to } = mytMonthRange(at)
        if ((await this.repo.countMonthly(userId, rewardId, from, to)) >= reward.maxPerMonthPerStudent) throw rewardError('MONTHLY_CAP')
      }
      const row = await this.repo.insertRedemption({
        userId,
        rewardId,
        rewardTitle: reward.title,
        rewardVendor: reward.vendor,
        rewardIcon: reward.iconEmoji,
        denominationRm: reward.denominationRm,
        tokenCost: reward.tokenCost,
        status: reward.requiresParentConsent ? 'pending_parent_consent' : 'pending_admin',
        stockReserved: reserved,
        at,
      })
      const { tokenBalance } = await tokensOr(() =>
        this.wallet.debitTokens({ userId: actor.userId, amount: reward.tokenCost, source: SOURCES.redeem, refId: `redemption:${idToString(row.id)}`, isTest: false }, { tx }),
      )
      return { id: idToString(row.id), status: row.status as RewardRedeemResult['status'], tokenBalance }
    })
  }

  // --- #10, #11 mystery boxes -------------------------------------------------------------------------

  async boxes(userId: string): Promise<RewardMysteryBoxesView> {
    const [{ tokenBalance }, openings] = await Promise.all([this.wallet.summary(userId), this.repo.recentOpenings(idFromString(userId), 10)])
    return {
      tokenBalance,
      boxes: MYSTERY_BOXES.map((b) => ({ ...b })),
      history: openings.map((o) => ({
        id: idToString(o.id),
        boxId: String(o.boxId),
        boxName: MYSTERY_BOXES.find((b) => b.id === String(o.boxId))?.name ?? '',
        coins: o.coins,
        xp: o.xp,
        createdAt: toMytTimestamp(o.createdAt),
      })),
    }
  }

  async openBox(actor: ShopActor, idText: string): Promise<RewardMysteryBoxOpened> {
    if (actor.isTest) throw modPelajarRefused()
    if (!DIGITS.test(idText)) throw plainNotFound()
    const box: RewardMysteryBox | undefined = MYSTERY_BOXES.find((b) => b.id === idText.replace(/^0+(?=\d)/, ''))
    if (!box) throw boxNotFound()
    const userId = idFromString(actor.userId)
    return this.prisma.transaction(async (tx) => {
      await this.repo.lockUser(actor.userId)
      // The outcome comes from the injected source: a CSPRNG in production, the seeded stream (key = user + opening number, like the mock) in tests.
      const rng = this.random.stream(`m15-mystery:${actor.userId}:${String(await this.repo.countOpenings(userId))}`)
      const coins = rng.int(box.coinMin, box.coinMax)
      const xp = rng.int(box.xpMin, box.xpMax)
      const opening = await this.repo.insertOpening(userId, Number(box.id), coins, xp, this.clock.now())
      const ref = `opening:${idToString(opening.id)}`
      const { tokenBalance } = await tokensOr(() => this.wallet.debitTokens({ userId: actor.userId, amount: box.costTokens, source: SOURCES.box, refId: ref, isTest: false }, { tx }))
      const credited = await this.wallet.credit(
        { userId: actor.userId, amount: coins, source: SOURCES.box, sourceId: ref, description: `Kotak Misteri: ${box.name}`, type: 'earn', isTest: false },
        { tx },
      )
      if (xp > 0) await this.wallet.addXp({ userId: actor.userId, amount: xp, isTest: false }, { tx })
      return { openingId: idToString(opening.id), boxId: box.id, boxName: box.name, icon: box.icon, coins, xp, tokenBalance, syilingBalance: credited.currentSyiling }
    })
  }

  // --- #12, #13 Cabutan Bertuah -----------------------------------------------------------------------

  async cabutan(userId: string): Promise<RewardCabutanView> {
    const now = this.clock.now()
    const [{ currentSyiling }, all] = await Promise.all([this.wallet.summary(userId), this.repo.openDraws()])
    const open = all
      .filter((d) => drawStillOpen(d.closesAt, now))
      .sort((a, b) => {
        if (a.closesAt === null && b.closesAt === null) return a.id < b.id ? -1 : 1
        if (a.closesAt === null) return 1
        if (b.closesAt === null) return -1
        const da = mytDay(a.closesAt)
        const db = mytDay(b.closesAt)
        return da === db ? (a.id < b.id ? -1 : 1) : da < db ? -1 : 1
      })
    const owned = await this.repo.ticketCounts(idFromString(userId), open.map((d) => d.id))
    return {
      syilingBalance: currentSyiling,
      draws: open.map((d) => ({
        id: idToString(d.id),
        title: d.title,
        description: d.description,
        ticketCostSyiling: d.ticketCostSyiling,
        maxTicketsPerStudent: d.maxTicketsPerStudent,
        ticketsOwned: owned.get(d.id) ?? 0,
        closesAt: d.closesAt === null ? null : mytDay(d.closesAt),
        prizePool: d.prizes.map((p) => ({ label: p.label, valueSen: p.valueSen, qty: p.qty })),
      })),
    }
  }

  async buyTicket(actor: ShopActor, drawIdText: string): Promise<RewardTicketBought> {
    if (actor.isTest) throw modPelajarRefused()
    if (!DIGITS.test(drawIdText)) throw plainNotFound()
    const drawId = idOrNull(drawIdText.replace(/^0+(?=\d)/, '') || '0')
    const userId = idFromString(actor.userId)
    return this.prisma.transaction(async (tx) => {
      await this.repo.lockUser(actor.userId)
      const now = this.clock.now()
      // Share-lock the draw row first, then read it: a draw run cannot start between the check and the ticket.
      if (drawId !== null) await this.repo.lockDrawShared(drawId)
      const draw = drawId === null ? null : await this.repo.draw(drawId)
      if (!draw || draw.status !== 'open' || !drawStillOpen(draw.closesAt, now)) throw rewardError('DRAW_CLOSED')
      const owned = await this.repo.countTickets(draw.id, userId)
      if (owned >= draw.maxTicketsPerStudent) throw rewardError('TICKET_LIMIT')
      const ticket = await this.repo.insertTicket(draw.id, userId, now)
      let syilingBalance: number
      if (draw.ticketCostSyiling > 0) {
        // A ticket needs its own key: the draw id alone would turn the second ticket into a replay of the first.
        const debited = await this.wallet.debit(
          { userId: actor.userId, amount: draw.ticketCostSyiling, source: SOURCES.ticket, sourceId: `draw:${idToString(draw.id)}:ticket:${idToString(ticket.id)}`, description: `Tiket Cabutan: ${draw.title}`, type: 'spend', isTest: false },
          { tx },
        )
        syilingBalance = debited.currentSyiling
      } else {
        syilingBalance = (await this.wallet.summary(actor.userId, { tx })).currentSyiling
      }
      return { drawId: idToString(draw.id), ticketsOwned: owned + 1, syilingBalance }
    })
  }

  // --- #19, #20 Kedai Hadiah Digital (empty for every account) ---------------------------------------

  digitalItems(cat: unknown): ShopDigitalItemsResponse {
    const activeCat =
      cat === undefined ? 'all' : typeof cat !== 'string' ? null : cat === 'all' || (REWARD_CATEGORIES as readonly string[]).includes(cat) ? (cat as ShopDigitalItemsResponse['meta']['activeCat']) : null
    return { data: [], meta: { ...listMeta(1, 1, 0), activeCat } }
  }

  digitalRedemptions(): ShopDigitalRedemptionsResponse {
    return { data: [], meta: listMeta(1, 1, 0) }
  }
}
