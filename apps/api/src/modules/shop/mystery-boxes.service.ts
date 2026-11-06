import { Inject, Injectable } from '@nestjs/common'
import {
  ClientUuidSchema,
  GAMIFICATION_BOX_PRIZE_KINDS,
  GAMIFICATION_MESSAGES as MSG,
  REWARD_MESSAGES,
  REWARD_VALIDATION_MESSAGES,
  type RewardMysteryBoxOpened,
  type RewardMysteryBoxesView,
  type GamificationBoxOpeningsDay,
  type GamificationBoxPrize,
  type GamificationBoxPrizeKind,
  type GamificationMysteryBox,
  type GamificationMysteryBoxesAdmin,
} from '@pp/contract'

import { AUDIT_ACTIONS, AuditService } from '../../common/audit'
import { ApiError } from '../../common/errors/api-error'
import { toMytTimestamp } from '../../common/time/myt'
import type { PrismaClient, TxClient } from '../../db/client'
import { CLOCK, type Clock, mytDay, startOfMytDay } from '../../db/clock'
import { Prisma } from '../../db/generated/client'
import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { GameSettingsService } from '../games/core/game-settings.service'
import { MAX_AMOUNT_PER_CALL, WalletService } from '../wallet'
import type { ShopActor } from './actor'
import { BOX_RANDOM, type BoxRandom, type BoxStream } from './box-random'
import { SOURCES } from './shop.constants'
import { boxNotFound, modPelajarRefused, plainNotFound, rewardError, validation } from './shop.errors'
import { ShopRepository } from './shop.repository'

/** Kotak Misteri admin rules (48 GAME-23, DM-37). The odds are integer percents and total 100. */
export const MYSTERY_BOX_LIMITS = {
  labelMax: 120,
  costMin: 1,
  costMax: 500,
  prizesMax: 20,
  weightTotal: 100,
  stockMax: 1_000_000,
  dailyMaxKey: 'mystery_box_daily_max',
  dailyMaxLabel: 'Had kotak sehari',
  dailyMaxMin: 1,
  dailyMaxMax: 20,
  /** Days in `openingsPerDay`: the last 7 Malaysia days, oldest first, today last (ruling N3). */
  openingsDays: 7,
} as const

const DIGITS = /^\d{1,9}$/
const INT4_MAX = 2_147_483_647
const DAY_MS = 86_400_000

interface PrizeRow {
  label: string
  kind: GamificationBoxPrizeKind
  amount: number
  weight: number
  stock: number | null
}

interface UpdateInput {
  label: string
  costSyiling: number
  isActive: boolean
  prizes: PrizeRow[]
  dailyMax: number | undefined
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** A whole number from a JSON number only (the admin form posts JSON); anything else is `undefined`. */
const wholeOf = (v: unknown): number | undefined => (typeof v === 'number' && Number.isSafeInteger(v) ? v : undefined)

const fieldError = (fields: Record<string, string>, message: string = MSG.summary): ApiError => ApiError.of('VALIDATION_ERROR', { message, fields })

/** A prize row as read under its lock. */
interface PrizeLock {
  id: bigint
  label: string
  kind: GamificationBoxPrizeKind
  amount: number
  weight: number
  stock: number | null
}

/** The box row as read under its share lock. */
interface BoxLock {
  id: number
  label: string
  costSyiling: number
  isActive: boolean
}

/** A prize can be won when it has weight and its stock is unlimited (null) or above 0 (AC-GM-23.6). */
const winnable = (p: { weight: number; stock: number | null }): boolean => p.weight > 0 && (p.stock === null || p.stock > 0)

/** One weighted draw: `rng.int(1, totalWeight)` walked over the prizes that can be won (FR-GM-23.2). `prizes` is not empty. */
export function pickPrize<T extends { weight: number }>(prizes: readonly T[], rng: BoxStream): T {
  const total = prizes.reduce((sum, p) => sum + p.weight, 0)
  let pick = rng.int(1, total)
  return prizes.find((p) => (pick -= p.weight) <= 0) ?? (prizes[prizes.length - 1] as T)
}

/**
 * Kotak Misteri (S7-T07, DM-37, API-GAME-08 and API-GAME-09).
 *
 * Admin side (part P7): the boxes and their prize rows, the daily limit (`mystery_box_daily_max`, read through the
 * games settings reader) and the openings per day. The cost lives only in `mystery_boxes.cost_syiling` (ruling R2).
 * There is no create route (ruling R1): ids 1 to 4 are the four old boxes, kept inactive without prizes, and id 5 is the
 * one active box.
 *
 * Pupil side (part P8): `boxes()` shows the one active box and never draws; `open()` runs in ONE transaction.
 * Locking: the user's shop lock first, then the box row FOR SHARE, then its prize rows FOR UPDATE. The admin save takes
 * every box row FOR UPDATE and only then rewrites the prizes, so the two orders never cycle. Checks, in order: Mod
 * Pelajar (403), a repeat of the same `clientUuid` (the stored opening, nothing moves), box exists and is active (404),
 * no prize can be won (409 `BOX_UNAVAILABLE`, N5), daily limit (429 `MYSTERY_DAILY_LIMIT`), syiling balance (409
 * `INSUFFICIENT_BALANCE`); only then the cost is debited (key `opening:{id}:cost`), the prize is drawn by weight among
 * the prizes that can be won, a limited stock drops by 1 and the prize is credited (key `opening:{id}:prize`).
 */
@Injectable()
export class MysteryBoxesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(GameSettingsService) private readonly settings: GameSettingsService,
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(ShopRepository) private readonly repo: ShopRepository,
    @Inject(BOX_RANDOM) private readonly random: BoxRandom,
  ) {}

  // --- pupil: GET /gamification/mystery-boxes -----------------------------------------------------------

  /** The one active box with the chances of the prizes still in stock (one decimal, renormalised); never draws (FR-MUR-35-5). */
  async boxes(userId: string): Promise<RewardMysteryBoxesView> {
    const uid = idFromString(userId)
    const day = startOfMytDay(this.clock.now())
    const [box, summary, dailyMax, openedToday, openings] = await Promise.all([
      this.prisma.client.mysteryBox.findFirst({ where: { isActive: true }, include: { prizes: { orderBy: { id: 'asc' } } } }),
      this.wallet.summary(userId),
      this.settings.get(MYSTERY_BOX_LIMITS.dailyMaxKey),
      this.repo.countOpeningsBetween(uid, day, new Date(day.getTime() + DAY_MS)),
      this.repo.recentOpenings(uid, 10),
    ])
    const eligible = box ? box.prizes.filter(winnable) : []
    const total = eligible.reduce((sum, p) => sum + p.weight, 0)
    return {
      box: box
        ? {
            id: idToString(box.id),
            label: box.label,
            costSyiling: box.costSyiling,
            prizes: eligible.map((p) => ({ label: p.label, kind: p.kind as GamificationBoxPrizeKind, amount: p.amount, chance: Math.round((p.weight / total) * 1000) / 10 })),
          }
        : null,
      available: eligible.length > 0,
      syilingBalance: summary.currentSyiling,
      dailyMax,
      openedToday,
      history: openings.map((o) => ({
        id: idToString(o.id),
        boxId: String(o.boxId),
        boxName: o.box.label,
        prizeLabel: o.prizeLabel,
        prizeKind: o.prizeKind as GamificationBoxPrizeKind | null,
        prizeAmount: o.prizeAmount,
        createdAt: toMytTimestamp(o.createdAt),
      })),
    }
  }

  // --- pupil: POST /gamification/mystery-boxes/:id/open -------------------------------------------------

  async open(actor: ShopActor, idText: string, body: unknown): Promise<RewardMysteryBoxOpened> {
    if (actor.isTest) throw modPelajarRefused()
    const raw = isRecord(body) ? body.clientUuid : undefined
    if (typeof raw !== 'string' || !ClientUuidSchema.safeParse(raw).success) throw validation({ clientUuid: REWARD_VALIDATION_MESSAGES.clientUuidInvalid })
    const clientUuid = raw.toLowerCase()
    if (!DIGITS.test(idText)) throw plainNotFound()
    const boxId = Number(idText)
    const userId = idFromString(actor.userId)
    return this.prisma.transaction(async (tx) => {
      await this.repo.lockUser(actor.userId)
      // A repeat answers before any other check and moves nothing; the user lock above makes the read safe against a double tap.
      const first = await this.repo.openingByClientUuid(userId, clientUuid)
      if (first) {
        // The key belongs to the box it opened: on another box it is no repeat.
        if (first.boxId !== boxId) throw validation({ clientUuid: REWARD_VALIDATION_MESSAGES.clientUuidInvalid })
        const summary = await this.wallet.summary(actor.userId, { tx })
        const kind = (first.prizeKind ?? 'syiling') as GamificationBoxPrizeKind
        const stored = await tx.mysteryBox.findUnique({ where: { id: first.boxId }, select: { label: true } })
        return {
          openingId: idToString(first.id),
          boxId: String(first.boxId),
          boxName: stored?.label ?? '',
          prize: { label: first.prizeLabel ?? '', kind, amount: first.prizeAmount ?? first.coins },
          tokenBalance: summary.tokenBalance,
          syilingBalance: summary.currentSyiling,
        }
      }
      if (boxId < 1 || boxId > INT4_MAX) throw boxNotFound()
      const boxes = await tx.$queryRaw<BoxLock[]>`SELECT id, label, cost_syiling AS "costSyiling", is_active AS "isActive" FROM mystery_boxes WHERE id = ${boxId} FOR SHARE`
      const box = boxes[0]
      if (!box?.isActive) throw boxNotFound()
      const prizes = await tx.$queryRaw<PrizeLock[]>`
        SELECT id, label, kind, amount, weight, stock FROM mystery_box_prizes WHERE box_id = ${boxId} ORDER BY id FOR UPDATE`
      const eligible = prizes.filter(winnable)
      // N5: nothing is debited and no opening row is written when no prize can be won.
      if (eligible.length === 0) throw rewardError('BOX_UNAVAILABLE')
      const at = this.clock.now()
      const day = startOfMytDay(at)
      const dailyMax = await this.settings.get(MYSTERY_BOX_LIMITS.dailyMaxKey, tx)
      if ((await this.repo.countOpeningsBetween(userId, day, new Date(day.getTime() + DAY_MS))) >= dailyMax) throw rewardError('MYSTERY_DAILY_LIMIT')
      if ((await this.wallet.summary(actor.userId, { tx })).currentSyiling < box.costSyiling) throw rewardError('INSUFFICIENT_BALANCE')

      // The outcome comes from the injected source: a CSPRNG in production, the seeded stream (key = user + opening number) in tests.
      const rng = this.random.stream(`m15-mystery:${actor.userId}:${String(await this.repo.countOpenings(userId))}`)
      const prize = pickPrize(eligible, rng)

      const opening = await this.repo.insertOpening({
        userId,
        boxId,
        coins: prize.kind === 'syiling' ? prize.amount : 0,
        prizeLabel: prize.label,
        prizeKind: prize.kind,
        prizeAmount: prize.amount,
        clientUuid,
        at,
      })
      const ref = `opening:${idToString(opening.id)}`
      await this.wallet.debit({ userId: actor.userId, amount: box.costSyiling, source: SOURCES.box, sourceId: `${ref}:cost`, description: `Kotak Misteri: ${box.label}`, type: 'spend', isTest: false }, { tx })
      if (prize.stock !== null) await tx.$executeRaw`UPDATE mystery_box_prizes SET stock = stock - 1, updated_at = ${at}::timestamptz WHERE id = ${prize.id} AND stock > 0`
      if (prize.kind === 'syiling') {
        await this.wallet.credit({ userId: actor.userId, amount: prize.amount, source: SOURCES.box, sourceId: `${ref}:prize`, description: `Kotak Misteri: ${prize.label}`, type: 'earn', isTest: false }, { tx })
      } else {
        await this.wallet.creditTokens({ userId: actor.userId, amount: prize.amount, source: SOURCES.box, refId: `${ref}:prize`, isTest: false }, { tx })
      }
      const after = await this.wallet.summary(actor.userId, { tx })
      return {
        openingId: idToString(opening.id),
        boxId: String(box.id),
        boxName: box.label,
        prize: { label: prize.label, kind: prize.kind, amount: prize.amount },
        tokenBalance: after.tokenBalance,
        syilingBalance: after.currentSyiling,
      }
    })
  }

  // --- admin ----------------------------------------------------------------------------------------------

  /** `GET /admin/reward-control/mystery-boxes`. */
  async adminView(db: TxClient | PrismaClient = this.prisma.client): Promise<GamificationMysteryBoxesAdmin> {
    const [boxes, dailyMax, openingsPerDay] = await Promise.all([
      db.mysteryBox.findMany({ orderBy: { id: 'asc' }, include: { prizes: { orderBy: { id: 'asc' } } } }),
      this.settings.get(MYSTERY_BOX_LIMITS.dailyMaxKey, db),
      this.openingsPerDay(db),
    ])
    return {
      boxes: boxes.map(
        (b): GamificationMysteryBox => ({
          id: idToString(b.id),
          label: b.label,
          costSyiling: b.costSyiling,
          isActive: b.isActive,
          prizes: b.prizes.map((p): GamificationBoxPrize => ({ label: p.label, kind: p.kind as GamificationBoxPrizeKind, amount: p.amount, weight: p.weight, stock: p.stock })),
        }),
      ),
      dailyMax,
      openingsPerDay,
    }
  }

  /**
   * `PUT /admin/reward-control/mystery-boxes/:id`: replaces the label, cost, active flag and prize rows of one box in
   * one transaction, saves `dailyMax` when posted, and records one audit row. A box that is active, or has prizes,
   * needs weights that total 100 ("Jumlah peluang mesti 100%."). Answers the same view as the GET.
   */
  async adminUpdate(actor: ShopActor, rawId: string, body: unknown): Promise<GamificationMysteryBoxesAdmin> {
    if (!DIGITS.test(rawId)) throw plainNotFound()
    const id = Number(rawId)
    const input = this.parse(body)
    return this.prisma.transaction(async (tx) => {
      // Every box row is locked in ascending id order, so two saves (for example two activations) never deadlock and
      // run one after the other.
      const locked = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM mystery_boxes ORDER BY id FOR UPDATE`
      if (!locked.some((r) => r.id === id)) throw ApiError.of('NOT_FOUND', { message: REWARD_MESSAGES.boxNotFound })
      // One active box at most (uq_mystery_boxes_one_active): activating this box deactivates the others first.
      let deactivated: number[] = []
      if (input.isActive) {
        const others = await tx.mysteryBox.findMany({ where: { isActive: true, id: { not: id } }, select: { id: true }, orderBy: { id: 'asc' } })
        deactivated = others.map((o) => o.id)
        if (deactivated.length > 0) await tx.mysteryBox.updateMany({ where: { id: { in: deactivated } }, data: { isActive: false } })
      }
      await tx.mysteryBox.update({ where: { id }, data: { label: input.label, costSyiling: input.costSyiling, isActive: input.isActive } })
      await tx.mysteryBoxPrize.deleteMany({ where: { boxId: id } })
      if (input.prizes.length > 0) {
        await tx.mysteryBoxPrize.createMany({ data: input.prizes.map((p) => ({ boxId: id, label: p.label, kind: p.kind, amount: p.amount, weight: p.weight, stock: p.stock })) })
      }
      if (input.dailyMax !== undefined) {
        await tx.gamificationSetting.upsert({
          where: { key: MYSTERY_BOX_LIMITS.dailyMaxKey },
          update: { value: input.dailyMax },
          create: { key: MYSTERY_BOX_LIMITS.dailyMaxKey, value: input.dailyMax, label: MYSTERY_BOX_LIMITS.dailyMaxLabel },
        })
      }
      await this.audit.record({
        action: AUDIT_ACTIONS.SHOP_MYSTERY_BOX_UPDATED,
        actorUserId: actor.userId,
        actorRole: actor.role,
        requestId: actor.requestId,
        ip: actor.ip,
        isTest: actor.isTest,
        targetType: 'mystery_box',
        targetId: String(id),
        details: { costSyiling: input.costSyiling, isActive: input.isActive, prizeRows: input.prizes.length, deactivatedBoxIds: deactivated, ...(input.dailyMax === undefined ? {} : { dailyMax: input.dailyMax }) },
        tx,
      })
      return this.adminView(tx)
    })
  }

  /** The openings of the last 7 Malaysia days (all boxes), oldest first, a day with none reads 0. */
  private async openingsPerDay(db: TxClient | PrismaClient): Promise<GamificationBoxOpeningsDay[]> {
    const today = startOfMytDay(this.clock.now())
    const first = new Date(today.getTime() - (MYSTERY_BOX_LIMITS.openingsDays - 1) * DAY_MS)
    const rows = await db.$queryRaw<{ day: string; n: number }[]>(Prisma.sql`
      SELECT to_char(created_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD') AS day, count(*)::int AS n
      FROM mystery_box_openings
      WHERE created_at >= ${first}
      GROUP BY 1`)
    const byDay = new Map(rows.map((r) => [r.day, r.n]))
    return Array.from({ length: MYSTERY_BOX_LIMITS.openingsDays }, (_, i) => {
      const day = mytDay(new Date(first.getTime() + i * DAY_MS))
      return { day, count: byDay.get(day) ?? 0 }
    })
  }

  /** Reads the PUT body; every failing field is reported (the first problem of each), keyed as `prizes.{i}.{field}`. */
  private parse(body: unknown): UpdateInput {
    const b = isRecord(body) ? body : {}
    const fields: Record<string, string> = {}
    const text = (v: unknown, name: string, max: number): string => {
      if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) fields[name] = MSG.required
      else if (typeof v !== 'string' || v.trim().length > max) fields[name] = MSG.invalid
      return typeof v === 'string' ? v.trim() : ''
    }
    const label = text(b.label, 'label', MYSTERY_BOX_LIMITS.labelMax)

    const cost = wholeOf(b.costSyiling)
    if (b.costSyiling === undefined || b.costSyiling === null) fields.costSyiling = MSG.required
    else if (cost === undefined || cost < MYSTERY_BOX_LIMITS.costMin || cost > MYSTERY_BOX_LIMITS.costMax) fields.costSyiling = MSG.invalid

    if (b.isActive === undefined || b.isActive === null) fields.isActive = MSG.required
    else if (typeof b.isActive !== 'boolean') fields.isActive = MSG.invalid

    let dailyMax: number | undefined
    if (b.dailyMax !== undefined && b.dailyMax !== null) {
      dailyMax = wholeOf(b.dailyMax)
      if (dailyMax === undefined || dailyMax < MYSTERY_BOX_LIMITS.dailyMaxMin || dailyMax > MYSTERY_BOX_LIMITS.dailyMaxMax) {
        fields.dailyMax = MSG.invalid
        dailyMax = undefined
      }
    }

    const prizes: PrizeRow[] = []
    if (b.prizes === undefined || b.prizes === null) fields.prizes = MSG.required
    else if (!Array.isArray(b.prizes) || b.prizes.length > MYSTERY_BOX_LIMITS.prizesMax) fields.prizes = MSG.invalid
    else {
      b.prizes.forEach((raw: unknown, i) => {
        const row = isRecord(raw) ? raw : {}
        const at = (f: string) => `prizes.${String(i)}.${f}`
        const pl = text(row.label, at('label'), MYSTERY_BOX_LIMITS.labelMax)
        const kind = (GAMIFICATION_BOX_PRIZE_KINDS as readonly unknown[]).includes(row.kind) ? (row.kind as GamificationBoxPrizeKind) : undefined
        if (row.kind === undefined || row.kind === null) fields[at('kind')] = MSG.required
        else if (kind === undefined) fields[at('kind')] = MSG.invalid
        const amount = wholeOf(row.amount)
        if (row.amount === undefined || row.amount === null) fields[at('amount')] = MSG.required
        else if (amount === undefined || amount < 1 || amount > MAX_AMOUNT_PER_CALL) fields[at('amount')] = MSG.invalid
        const weight = wholeOf(row.weight)
        if (row.weight === undefined || row.weight === null) fields[at('weight')] = MSG.required
        else if (weight === undefined || weight < 0 || weight > 100) fields[at('weight')] = MSG.invalid
        let stock: number | null = null
        if (row.stock !== undefined && row.stock !== null) {
          const s = wholeOf(row.stock)
          if (s === undefined || s < 0 || s > MYSTERY_BOX_LIMITS.stockMax) fields[at('stock')] = MSG.invalid
          else stock = s
        }
        if (kind !== undefined && amount !== undefined && weight !== undefined) prizes.push({ label: pl, kind, amount, weight, stock })
      })
    }

    if (Object.keys(fields).length > 0 || cost === undefined) throw fieldError(fields)
    // Rows are complete here. A box with prizes, or an active one, must total 100 (AC-GM-23.5).
    // An active box whose every prize has stock 0 is saved as is; the pupil side answers it at open time with 409
    // BOX_UNAVAILABLE (N5), before any debit.
    const total = prizes.reduce((sum, p) => sum + p.weight, 0)
    const isActive = b.isActive as boolean
    if ((isActive || prizes.length > 0) && total !== MYSTERY_BOX_LIMITS.weightTotal) throw fieldError({ prizes: MSG.boxOddsTotal }, MSG.boxOddsTotal)
    return { label, costSyiling: cost, isActive, prizes, dailyMax }
  }
}
