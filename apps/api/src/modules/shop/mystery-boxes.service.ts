import { Inject, Injectable } from '@nestjs/common'
import {
  GAMIFICATION_BOX_PRIZE_KINDS,
  GAMIFICATION_MESSAGES as MSG,
  REWARD_MESSAGES,
  type GamificationBoxOpeningsDay,
  type GamificationBoxPrize,
  type GamificationBoxPrizeKind,
  type GamificationMysteryBox,
  type GamificationMysteryBoxesAdmin,
} from '@pp/contract'

import { AUDIT_ACTIONS, AuditService } from '../../common/audit'
import { ApiError } from '../../common/errors/api-error'
import type { PrismaClient, TxClient } from '../../db/client'
import { CLOCK, type Clock, mytDay, startOfMytDay } from '../../db/clock'
import { Prisma } from '../../db/generated/client'
import { idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { GameSettingsService } from '../games/core/game-settings.service'
import { MAX_AMOUNT_PER_CALL } from '../wallet'
import type { ShopActor } from './actor'
import { plainNotFound } from './shop.errors'

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

/**
 * Kotak Misteri admin side (S7-T07 part P7, DM-37, API-GAME-09): the boxes and their prize rows, the daily limit
 * (`mystery_box_daily_max`, read through the games settings reader) and the openings per day. The cost lives only in
 * `mystery_boxes.cost_syiling` (ruling R2). There is no create route (ruling R1): ids 1 to 4 are the four old boxes,
 * kept inactive without prizes, and id 5 is the one active box. The pupil opening flow is unchanged here (part P8).
 */
@Injectable()
export class MysteryBoxesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(GameSettingsService) private readonly settings: GameSettingsService,
  ) {}

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
    // TODO-P8: an active box whose every prize has stock 0 is saved as is (no existing catalogue text fits a refusal, and
    // none is invented here). P8 must answer an empty box at draw time: 409 "Kotak tidak tersedia buat masa ini." (N5)
    // before any debit.
    const total = prizes.reduce((sum, p) => sum + p.weight, 0)
    const isActive = b.isActive as boolean
    if ((isActive || prizes.length > 0) && total !== MYSTERY_BOX_LIMITS.weightTotal) throw fieldError({ prizes: MSG.boxOddsTotal }, MSG.boxOddsTotal)
    return { label, costSyiling: cost, isActive, prizes, dailyMax }
  }
}
