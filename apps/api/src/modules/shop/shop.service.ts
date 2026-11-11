import { Inject, Injectable } from '@nestjs/common'
import {
  ClientUuidSchema,
  REWARD_CATEGORIES,
  REWARD_VALIDATION_MESSAGES,
  type RewardCabutanView,
  type RewardMysteryBoxOpened,
  type RewardMysteryBoxesView,
  type RewardRedeemResult,
  type RewardTicketBought,
  type ShopDigitalItemsResponse,
  type ShopDigitalRedemptionsResponse,
} from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { listMeta } from '../../common/http/respond'
import { CLOCK, type Clock, mytDay } from '../../db/clock'
import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { WalletService } from '../wallet'
import { MysteryBoxesService } from './mystery-boxes.service'
import { RewardSettingsService } from './reward-settings.service'
import { SOURCES } from './shop.constants'
import { modPelajarRefused, plainNotFound, rewardError, rewardNotFound, validation } from './shop.errors'
import { ShopPorts } from './shop.ports'
import { ShopRepository, idOrNull } from './shop.repository'
import { drawStillOpen, mytMonthRange, mytYearRange } from './shop.time'
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

/** The optional `clientUuid` of a redeem or ticket body (DM-78); an unusable value is the same 422 on both routes. */
function clientUuidOf(body: unknown): string | null {
  const raw = typeof body === 'object' && body !== null ? (body as { clientUuid?: unknown }).clientUuid : undefined
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'string' || !ClientUuidSchema.safeParse(raw).success) throw validation({ clientUuid: REWARD_VALIDATION_MESSAGES.clientUuidInvalid })
  return raw.toLowerCase()
}

const DIGITS = /^\d+$/

/** "Keputusan Cabutan" lists this many drawn draws (ruling N6). */
const RESULTS_LIMIT = 10

/** The first given name only: no surname, school or class (48 rule 8; `10-murid.md` 4.3). */
function firstGivenName(name: string): string {
  // "Pelajar" is the V3 fallback for a pupil without a usable name (battle/queue/invitations.service.ts).
  return name.trim().split(/\s+/)[0] || 'Pelajar'
}

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
 * (the monthly cap and the ticket limit are counted one request at a time), and the order never cycles. A non-digital
 * redeem also takes the global budget lock (`ShopRepository.lockBudget`) between the reward row and the wallet row.
 */
@Injectable()
export class ShopService {
  constructor(
    @Inject(ShopRepository) private readonly repo: ShopRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(MysteryBoxesService) private readonly mysteryBoxes: MysteryBoxesService,
    @Inject(RewardSettingsService) private readonly rewardSettings: RewardSettingsService,
    @Inject(ShopPorts) private readonly ports: ShopPorts,
  ) {}

  // --- #9 redeem --------------------------------------------------------------------------------------

  async redeem(actor: ShopActor, body: unknown): Promise<RewardRedeemResult> {
    if (actor.isTest) throw modPelajarRefused()
    const rewardId = rewardIdOf(body)
    if (rewardId === null) throw validation({ rewardId: REWARD_VALIDATION_MESSAGES.rewardIdRequired })
    const clientUuid = clientUuidOf(body)
    const userId = idFromString(actor.userId)
    return this.prisma.transaction(async (tx) => {
      await this.repo.lockUser(actor.userId)
      // A repeat answers before any check and moves nothing; the user lock above makes the read safe against a double tap.
      const first = clientUuid === null ? null : await this.repo.redemptionByClientUuid(userId, clientUuid)
      if (first) {
        const { tokenBalance } = await this.wallet.summary(actor.userId, { tx })
        return { id: idToString(first.id), status: first.status as RewardRedeemResult['status'], tokenBalance }
      }
      const reward = await this.repo.lockReward(rewardId)
      if (!reward?.isActive) throw rewardNotFound()
      const at = this.clock.now()
      const reserved = reward.stockQuantity !== null
      if (reserved && !(await this.repo.takeStock(rewardId, at))) throw rewardError('OUT_OF_STOCK')
      if (reward.maxPerMonthPerStudent !== null) {
        const { from, to } = mytMonthRange(at)
        if ((await this.repo.countMonthly(userId, rewardId, from, to)) >= reward.maxPerMonthPerStudent) throw rewardError('MONTHLY_CAP')
      }
      // Step 4 of 48 GAME-21. A digital gift (real cost 0) never uses the budget and never waits for its lock.
      if (reward.costValueSen > 0) {
        await this.repo.lockBudget()
        const { redeemBudgetSen, sessionYear } = await this.rewardSettings.read(tx)
        const { from, to } = mytYearRange(sessionYear)
        const { costSen } = await this.repo.redemptionTotals(from, to)
        if (costSen + reward.costValueSen > redeemBudgetSen) throw rewardError('REDEEM_BUDGET')
      }
      const row = await this.repo.insertRedemption({
        userId,
        rewardId,
        rewardTitle: reward.title,
        rewardVendor: reward.vendor,
        rewardIcon: reward.iconEmoji,
        denominationRm: reward.denominationRm,
        tokenCost: reward.tokenCost,
        tokenCostSnapshot: reward.tokenCost,
        costValueSenSnapshot: reward.costValueSen,
        status: 'pending_admin',
        stockReserved: reserved,
        clientUuid,
        at,
      })
      const { tokenBalance } = await tokensOr(() =>
        this.wallet.debitTokens({ userId: actor.userId, amount: reward.tokenCost, source: SOURCES.redeem, refId: `redemption:${idToString(row.id)}`, isTest: false }, { tx }),
      )
      return { id: idToString(row.id), status: row.status as RewardRedeemResult['status'], tokenBalance }
    })
  }

  // --- #10, #11 mystery boxes -------------------------------------------------------------------------

  /** Delegates to `MysteryBoxesService` (S7-T07 P8): the one active box on the 0222 tables. */
  boxes(userId: string): Promise<RewardMysteryBoxesView> {
    return this.mysteryBoxes.boxes(userId)
  }

  async openBox(actor: ShopActor, idText: string, body: unknown): Promise<RewardMysteryBoxOpened> {
    const opened = await this.mysteryBoxes.open(actor, idText, body)
    // FR-GM-25.2 "Kotak Misteri": the opening is committed; the badges it unlocks are evaluated after it, in their own transaction
    // and ledger rows (`achievement:<id>`), so a badge can never undo or fail the opening. The hook never throws.
    const unlocked = await this.ports.afterBoxOpened(actor.userId)
    if (unlocked.length === 0) return opened
    // A badge reward is paid after the opening: the balances answered are the current ones, as a replay of the same clientUuid answers them.
    const now = await this.wallet.summary(actor.userId)
    return { ...opened, tokenBalance: now.tokenBalance, syilingBalance: now.currentSyiling, achievementsUnlocked: unlocked.map((b) => ({ code: b.code, name: b.name })) }
  }

  // --- #12, #13 Cabutan Bertuah -----------------------------------------------------------------------

  async cabutan(userId: string): Promise<RewardCabutanView> {
    const now = this.clock.now()
    const [{ currentSyiling }, all, drawn] = await Promise.all([this.wallet.summary(userId), this.repo.openDraws(), this.repo.drawnDraws(RESULTS_LIMIT)])
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
    const me = idFromString(userId)
    const [owned, sold, names] = await Promise.all([
      this.repo.ticketCounts(me, open.map((d) => d.id)),
      this.repo.ticketTotals(open.map((d) => d.id)),
      this.repo.userNames([...new Set(drawn.flatMap((d) => d.winners.map((w) => w.userId)))]),
    ])
    return {
      syilingBalance: currentSyiling,
      draws: open.map((d) => ({
        id: idToString(d.id),
        title: d.title,
        description: d.description,
        ticketCostSyiling: d.ticketCostSyiling,
        maxTicketsPerStudent: d.maxTicketsPerStudent,
        ticketsOwned: owned.get(d.id) ?? 0,
        ticketsSold: sold.get(d.id) ?? 0,
        closesAt: d.closesAt === null ? null : mytDay(d.closesAt),
        prizePool: d.prizes.map((p) => ({ label: p.label, valueSen: p.valueSen, qty: p.qty })),
      })),
      results: drawn.map((d) => ({
        id: idToString(d.id),
        title: d.title,
        winners: d.winners.map((w) => ({ prize: w.drawPrize.label, name: firstGivenName(names.get(w.userId) ?? ''), isYou: w.userId === me })),
      })),
    }
  }

  async buyTicket(actor: ShopActor, drawIdText: string, body?: unknown): Promise<RewardTicketBought> {
    if (actor.isTest) throw modPelajarRefused()
    if (!DIGITS.test(drawIdText)) throw plainNotFound()
    const drawId = idOrNull(drawIdText.replace(/^0+(?=\d)/, '') || '0')
    const clientUuid = clientUuidOf(body)
    const userId = idFromString(actor.userId)
    return this.prisma.transaction(async (tx) => {
      await this.repo.lockUser(actor.userId)
      // A repeat answers before any check and moves nothing, even when the draw has closed since.
      const first = clientUuid === null ? null : await this.repo.ticketByClientUuid(userId, clientUuid)
      if (first) {
        // The key is unique per user (DM-78) and belongs to the draw it bought on: on another draw it is no repeat, so no first draw's ticket is answered.
        if (first.drawId !== drawId) throw validation({ clientUuid: REWARD_VALIDATION_MESSAGES.clientUuidInvalid })
        const ticketsOwned = await this.repo.countTickets(first.drawId, userId)
        const { currentSyiling } = await this.wallet.summary(actor.userId, { tx })
        return { drawId: idToString(first.drawId), ticketsOwned, syilingBalance: currentSyiling }
      }
      const now = this.clock.now()
      // Share-lock the draw row first, then read it: a draw run cannot start between the check and the ticket.
      if (drawId !== null) await this.repo.lockDrawShared(drawId)
      const draw = drawId === null ? null : await this.repo.draw(drawId)
      if (!draw || draw.status !== 'open' || !drawStillOpen(draw.closesAt, now)) throw rewardError('DRAW_CLOSED')
      const owned = await this.repo.countTickets(draw.id, userId)
      if (owned >= draw.maxTicketsPerStudent) throw rewardError('TICKET_LIMIT')
      const ticket = await this.repo.insertTicket(draw.id, userId, clientUuid, now)
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

  /**
   * #19 FD-MUR-33 (R-02, V2 parity): the active gifts of the shared `rewards` catalogue, by token cost then title. An unknown
   * `cat` gives `activeCat` null and the whole list (V2 ignores a category it does not know). A gift with 0 stock stays
   * listed and is flagged `inStock: false` ("Habis stok"); null stock is unlimited.
   */
  async digitalItems(cat: unknown): Promise<ShopDigitalItemsResponse> {
    const activeCat =
      cat === undefined ? 'all' : typeof cat !== 'string' ? null : cat === 'all' || (REWARD_CATEGORIES as readonly string[]).includes(cat) ? (cat as ShopDigitalItemsResponse['meta']['activeCat']) : null
    const rows = await this.repo.activeRewards(activeCat !== null && activeCat !== 'all' ? activeCat : undefined)
    const data: ShopDigitalItemsResponse['data'] = rows.map((r) => ({
      id: idToString(r.id),
      category: r.category as ShopDigitalItemsResponse['data'][number]['category'],
      vendor: r.vendor,
      title: r.title,
      description: r.description,
      iconEmoji: r.iconEmoji,
      imageUrl: r.imageUrl,
      denominationRm: r.denominationRm.toNumber(),
      tokenCost: r.tokenCost,
      stockQuantity: r.stockQuantity,
      inStock: r.stockQuantity === null || r.stockQuantity > 0,
      termsText: r.termsText,
      requiresParentConsent: r.requiresParentConsent,
    }))
    return { data, meta: { ...listMeta(1, Math.max(1, data.length), data.length), activeCat } }
  }

  digitalRedemptions(): ShopDigitalRedemptionsResponse {
    return { data: [], meta: listMeta(1, 1, 0) }
  }
}
