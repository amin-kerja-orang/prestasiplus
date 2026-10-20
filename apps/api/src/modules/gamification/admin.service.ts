import { Inject, Injectable } from '@nestjs/common'
import type {
  GamificationAdminAwardResult,
  GamificationAdminChallenge,
  GamificationAdminOverview,
  GamificationAdminTier,
  GamificationAdminTransactionRow,
  GamificationAdminStudentRow,
  GamificationDraw,
  GamificationEconomySettings,
  GamificationRewardControl,
  GamificationSetting,
  GamificationSyilingReward,
} from '@pp/contract'
import { GAMIFICATION_AWARD_MAX, GAMIFICATION_DEFAULT_TIER_COLOR, GAMIFICATION_MESSAGES as MSG, GAMIFICATION_SETTING_KEYS } from '@pp/contract'

import { AUDIT_ACTIONS, AuditService } from '../../common/audit'
import { ApiError } from '../../common/errors/api-error'
import { toMytTimestamp } from '../../common/time/myt'
import type { TxClient } from '../../db/client'
import { CLOCK, type Clock, mytDay } from '../../db/clock'
import { Prisma } from '../../db/generated/client'
import { idFromString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { MAX_AMOUNT_PER_CALL, WalletService } from '../wallet'
import type { AuditActor } from './actor'
import {
  DEFAULT_METRIC_BY_TYPE,
  ECONOMY_KEYS,
  MAX_PRIZE_LINES,
  MAX_PRIZE_QTY,
  STUDENTS_PAGE_SIZE,
  TOGGLE_SETTING_KEYS,
  TRANSACTIONS_PAGE_SIZE,
} from './gamification.constants'
import { GamificationPorts } from './ports'
import { GamificationRepository, type ChallengeRecord, type DrawRecord, type Db, isStudentSort, type PrizeLine, type StudentSort, type SyilingRewardRecord, type TierInput, type TierRecord } from './gamification.repository'
import { bodyOf, boolOf, idParam, intOf, isRealDate, notFoundError, pageOf, queryText, readFields, validationFailure, type FieldSpec } from './validation'

const PERSONAL_DATA_REASON = 'Sebab tidak boleh mengandungi maklumat peribadi.'
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/
const IC_RE = /(?<!\d)\d{6}-?\d{2}-?\d{4}(?!\d)/
/** A phone-number-like run: nine or more digits once spaces, dashes, dots, brackets and a leading plus are ignored. */
function containsPersonalData(text: string): boolean {
  if (EMAIL_RE.test(text) || IC_RE.test(text)) return true
  return /\d(?:[\s().-]*\d){8,}/.test(text)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const COLOR_RE = /^#[0-9a-fA-F]{6}$/
const LEDGER_TYPES: readonly string[] = ['earn', 'spend', 'convert', 'bonus', 'refund']
const MYT_OFFSET_MS = 8 * 3_600_000

const INT_MAX = 2_147_483_647
/** Upper bounds (nothing may reach a DB overflow or a WalletService RangeError): syiling/xp rewards <= one wallet call, other ints <= int4. */
const reward: FieldSpec = { kind: 'int', min: 0, max: MAX_AMOUNT_PER_CALL }
const CONVERSION_RATE_MAX = 999_999
const TIER_FIELDS = {
  labelMs: { kind: 'text', max: 60 },
  icon: { kind: 'text', max: 16 },
  color: { kind: 'text', max: 7, pattern: COLOR_RE, optional: true },
  minSyiling: { kind: 'int', min: 0, max: INT_MAX },
  conversionRate: { kind: 'int', min: 1, max: CONVERSION_RATE_MAX },
  sortOrder: { kind: 'int', min: 0, max: INT_MAX },
  quizRewardL1: reward,
  quizRewardL2: reward,
  quizRewardL3: reward,
  quizRewardL4: reward,
  quizRewardL5: reward,
  pkskRewardCorrect: reward,
  boardGameRewardCorrect: reward,
  boardGameRewardWin: reward,
} as const satisfies Record<string, FieldSpec>

const CHALLENGE_FIELDS = {
  title: { kind: 'text', max: 120 },
  description: { kind: 'text', max: 255 },
  icon: { kind: 'text', max: 16 },
  challengeType: { kind: 'enum', values: Object.keys(DEFAULT_METRIC_BY_TYPE) },
  targetValue: { kind: 'int', min: 1, max: INT_MAX },
  rewardSyiling: reward,
  rewardXp: reward,
  difficulty: { kind: 'enum', values: ['easy', 'medium', 'hard'] },
  sortOrder: { kind: 'int', min: 0, max: INT_MAX },
} as const satisfies Record<string, FieldSpec>

/** `perks`: a JSON array (the hidden field of S2), a list of strings, or one text (S2 add form); `undefined` keeps the stored list. */
function perksOf(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined
  const clean = (list: unknown[]) =>
    list
      .filter((p): p is string => typeof p === 'string')
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 50)
  if (Array.isArray(raw)) return clean(raw)
  if (typeof raw !== 'string') return undefined
  const text = raw.trim()
  if (text === '') return []
  if (text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text)
      if (Array.isArray(parsed)) return clean(parsed)
    } catch {
      /* a plain text that starts with "[" */
    }
  }
  return [text]
}

const challengeView = (c: ChallengeRecord): GamificationAdminChallenge => ({
  id: c.id,
  title: c.title,
  description: c.description,
  icon: c.icon,
  challengeType: c.challengeType as 'quiz_count',
  targetValue: c.targetValue,
  rewardSyiling: c.rewardSyiling,
  rewardXp: c.rewardXp,
  difficulty: c.difficulty as 'easy',
  sortOrder: c.sortOrder,
  isActive: c.isActive,
})

const tierView = (t: TierRecord): GamificationAdminTier => ({ ...t })

const rewardView = (r: SyilingRewardRecord): GamificationSyilingReward => ({
  id: r.id,
  name: r.name,
  type: r.type.toUpperCase() as 'VOUCHER',
  priceSyiling: r.priceSyiling,
  costValueSen: r.costValueSen,
  costRm: r.costValueSen / 100,
})

const drawView = (d: DrawRecord): GamificationDraw => ({
  id: d.id,
  title: d.title,
  description: d.description,
  ticketCostSyiling: d.ticketCostSyiling,
  maxTicketsPerStudent: d.maxTicketsPerStudent,
  prizePool: d.prizes.map((p) => ({ label: p.label, valueSen: p.valueSen, qty: p.qty })),
  closesAt: d.closesAt === null ? null : mytDay(d.closesAt),
  status: d.status as 'draft',
  createdAt: toMytTimestamp(d.createdAt),
  ticketsSold: d.ticketsSold,
})

const isUniqueViolation = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'

/**
 * V-M14-12: the prize pool as ordered lines. Absent or blank is an empty pool; a JSON text or an array of
 * `{label, value_sen | valueSen, qty}` otherwise. Anything else, and a line the `draw_prizes` checks would
 * refuse (negative value, quantity below 1), is "Format JSON kolam hadiah tidak sah.".
 */
export function parsePrizePool(raw: unknown): PrizeLine[] {
  const invalid = () => validationFailure({ prizePool: MSG.prizePoolInvalid }, MSG.prizePoolInvalid)
  if (raw === undefined || raw === null) return []
  let list: unknown
  if (typeof raw === 'string') {
    if (raw.trim() === '') return []
    try {
      list = JSON.parse(raw)
    } catch {
      throw invalid()
    }
  } else list = raw
  if (!Array.isArray(list) || list.length > MAX_PRIZE_LINES) throw invalid()
  return list.map((p: unknown) => {
    const o = typeof p === 'object' && p !== null ? (p as Record<string, unknown>) : {}
    const value = o.value_sen ?? o.valueSen
    if (typeof o.label !== 'string' || [...o.label].length > 200) throw invalid()
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) throw invalid()
    if (typeof o.qty !== 'number' || !Number.isSafeInteger(o.qty) || o.qty < 1 || o.qty > MAX_PRIZE_QTY) throw invalid()
    return { label: o.label, valueSen: value, qty: o.qty }
  })
}

/** M14 admin side (BE-23): economy (S1-S5) and operations (S9-S10). Every write records an `audit_events` row in the same transaction. */
@Injectable()
export class GamificationAdminService {
  constructor(
    private readonly repo: GamificationRepository,
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(GamificationPorts) private readonly ports: GamificationPorts,
  ) {}

  private async write<T>(actor: AuditActor, action: string, target: { type: string; id: string | null }, details: Record<string, unknown>, fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.prisma.transaction(async (tx) => {
      const out = await fn(tx)
      await this.audit.record({
        action,
        actorUserId: actor.userId,
        actorRole: actor.role,
        requestId: actor.requestId,
        ip: actor.ip,
        isTest: actor.isTest,
        targetType: target.type,
        targetId: target.id,
        details,
        tx,
      })
      return out
    })
  }

  // --- S1 overview ---------------------------------------------------------------------------------

  async overview(): Promise<GamificationAdminOverview> {
    const db = this.repo.handle()
    const day = mytDay(this.clock.now())
    const [figures, conv, tiers, active, finishers, top, recent] = await Promise.all([
      this.repo.nationalFigures(db),
      this.repo.conversionFigures(db),
      this.repo.tiers(db),
      this.repo.challenges(db, true),
      this.repo.dailyFinishers(db, day),
      this.repo.leaderboard(db, 10),
      this.repo.recentLedger(db, 10),
    ])
    const total = figures.wallets
    return {
      cards: {
        activeStudents: total,
        syilingGenerated: figures.syilingGenerated,
        tokensConverted: conv.tokens,
        conversions: conv.conversions,
        activeChallenges: active.length,
        completedToday: active.length === 0 ? 0 : finishers,
      },
      tierDistribution: [...tiers]
        .sort((a, b) => a.tierName.localeCompare(b.tierName))
        .map((t) => {
          const count = figures.byTier.get(t.id) ?? 0
          return { key: t.tierName, count, pct: total > 0 ? Math.round((count / total) * 100) : 0, widthPct: total > 0 ? Math.round((count / total) * 10000) / 100 : 0, color: t.color }
        }),
      top10: top.map((w, i) => ({ rank: i + 1, name: w.name, tierKey: w.tierKey, level: w.level, totalSyilingEarned: w.total })),
      recent: recent.map((r) => ({ name: r.name, type: r.type as 'earn', amount: r.amount, source: r.source, createdAt: toMytTimestamp(r.createdAt) })),
    }
  }

  // --- S2 tiers ------------------------------------------------------------------------------------

  async tiers(): Promise<GamificationAdminTier[]> {
    return (await this.repo.tiers(this.repo.handle())).map(tierView)
  }

  /**
   * Updates a tier's own row. Wallets are NOT touched (AC8, BR-M14-08): a holder keeps the tier, the tier of a wallet
   * is re-evaluated by `WalletService.credit` at the next credit and never goes down.
   */
  async updateTier(actor: AuditActor, rawId: string, body: unknown): Promise<GamificationAdminTier> {
    const id = idParam(rawId)
    const parsed = readFields(body, TIER_FIELDS)
    const { color, ...rest } = parsed
    const perks = perksOf(bodyOf(body).perks)
    const patch: Omit<Partial<TierInput>, 'tierName'> = { ...rest, ...(color !== undefined ? { color } : {}), ...(perks !== undefined ? { perks } : {}) }
    return this.write(actor, AUDIT_ACTIONS.GAMIFICATION_TIER_UPDATED, { type: 'tier', id: rawId }, { fields: Object.keys(patch) }, async (tx) => {
      if (!(await this.repo.tier(tx, id))) throw notFoundError(MSG.tierNotFound)
      return tierView(await this.repo.updateTier(tx, id, patch, this.clock.now()))
    })
  }

  async toggleTier(actor: AuditActor, rawId: string): Promise<{ isActive: boolean }> {
    const id = idParam(rawId)
    return this.write(actor, AUDIT_ACTIONS.GAMIFICATION_TIER_ACTIVE_CHANGED, { type: 'tier', id: rawId }, {}, async (tx) => {
      const cur = await this.repo.tier(tx, id)
      if (!cur) throw notFoundError(MSG.tierNotFound)
      await this.repo.setTierActive(tx, id, !cur.isActive, this.clock.now())
      return { isActive: !cur.isActive }
    })
  }

  async createTier(actor: AuditActor, body: unknown): Promise<GamificationAdminTier> {
    const parsed = readFields(body, { tierName: { kind: 'text', max: 40, pattern: /^[A-Za-z0-9_-]+$/ }, ...TIER_FIELDS })
    const { tierName, color, ...rest } = parsed
    const input: TierInput = { ...rest, tierName: tierName.toLowerCase(), color: color ?? GAMIFICATION_DEFAULT_TIER_COLOR, perks: perksOf(bodyOf(body).perks) ?? [] }
    const taken = () => validationFailure({ tierName: MSG.tierExists }, MSG.tierExists)
    try {
      return await this.write(actor, AUDIT_ACTIONS.GAMIFICATION_TIER_CREATED, { type: 'tier', id: null }, { tierName: input.tierName }, async (tx) => {
        if (await this.repo.tierNameTaken(tx, input.tierName)) throw taken()
        return tierView(await this.repo.createTier(tx, input, this.clock.now()))
      })
    } catch (e) {
      if (isUniqueViolation(e)) throw taken()
      throw e
    }
  }

  // --- S3 challenges -------------------------------------------------------------------------------

  async challenges(): Promise<GamificationAdminChallenge[]> {
    return (await this.repo.challenges(this.repo.handle(), false)).map(challengeView)
  }

  async createChallenge(actor: AuditActor, body: unknown): Promise<GamificationAdminChallenge> {
    const input = readFields(body, CHALLENGE_FIELDS)
    const metric = DEFAULT_METRIC_BY_TYPE[input.challengeType as keyof typeof DEFAULT_METRIC_BY_TYPE]
    return this.write(actor, AUDIT_ACTIONS.GAMIFICATION_CHALLENGE_CREATED, { type: 'challenge', id: null }, { title: input.title }, async (tx) =>
      challengeView(await this.repo.createChallenge(tx, { ...input, metric }, this.clock.now())),
    )
  }

  /** Full replace; the stored metric follows a change of type (BR-M14-12). */
  async updateChallenge(actor: AuditActor, rawId: string, body: unknown): Promise<GamificationAdminChallenge> {
    const id = idParam(rawId)
    const input = readFields(body, CHALLENGE_FIELDS)
    return this.write(actor, AUDIT_ACTIONS.GAMIFICATION_CHALLENGE_UPDATED, { type: 'challenge', id: rawId }, { title: input.title }, async (tx) => {
      const cur = await this.repo.challenge(tx, id)
      if (!cur) throw notFoundError(MSG.challengeNotFound)
      const metric = input.challengeType === cur.challengeType ? cur.metric : DEFAULT_METRIC_BY_TYPE[input.challengeType as keyof typeof DEFAULT_METRIC_BY_TYPE]
      return challengeView(await this.repo.updateChallenge(tx, id, { ...input, metric }, this.clock.now()))
    })
  }

  async toggleChallenge(actor: AuditActor, rawId: string): Promise<{ isActive: boolean }> {
    const id = idParam(rawId)
    return this.write(actor, AUDIT_ACTIONS.GAMIFICATION_CHALLENGE_ACTIVE_CHANGED, { type: 'challenge', id: rawId }, {}, async (tx) => {
      const cur = await this.repo.challenge(tx, id)
      if (!cur) throw notFoundError(MSG.challengeNotFound)
      await this.repo.setChallengeActive(tx, id, !cur.isActive, this.clock.now())
      return { isActive: !cur.isActive }
    })
  }

  async deleteChallenge(actor: AuditActor, rawId: string): Promise<{ deleted: 1 }> {
    const id = idParam(rawId)
    return this.write(actor, AUDIT_ACTIONS.GAMIFICATION_CHALLENGE_DELETED, { type: 'challenge', id: rawId }, {}, async (tx) => {
      if (!(await this.repo.challenge(tx, id))) throw notFoundError(MSG.challengeNotFound)
      await this.repo.deleteChallenge(tx, id)
      return { deleted: 1 as const }
    })
  }

  // --- S4 students and award, S5 transactions ------------------------------------------------------

  async students(query: Record<string, unknown>): Promise<{ rows: GamificationAdminStudentRow[]; total: number; page: number }> {
    const sort = queryText(query.sort)
    const page = pageOf(query.page)
    const r = await this.repo.adminStudents(this.repo.handle(), {
      search: queryText(query.search),
      tier: queryText(query.tier),
      sort: (isStudentSort(sort) ? sort : 'total_syiling_earned') as StudentSort,
      page,
      pageSize: STUDENTS_PAGE_SIZE,
    })
    return { rows: r.rows, total: r.total, page }
  }

  /**
   * BR-M14-20: a `bonus` / `admin_award` ledger row through `WalletService.credit` (creates the wallet if missing,
   * re-assigns the tier upward). The award has no natural key, so it is the explicit opt-out: a retry awards again.
   * The `reason` is the ledger description, as the contract fixes it.
   */
  /**
   * Manual award. PDPA: the contract makes `reason` the ledger description, which the student sees for good (see the
   * wallet PDPA rule in `wallet.types.ts`), so a reason that carries personal data (an e-mail address, a Malaysian IC
   * number or a phone-number-like run of digits) is refused with 422 `fields.reason`.
   *
   * IDEMPOTENCY. An optional `Idempotency-Key` makes the ledger key `(admin_award, award:<key>)`: a repeat with the same
   * key and amount returns the first result and writes nothing (no second credit, no second audit row). Without a key
   * every call is a new award (the mock's behaviour).
   */
  async award(actor: AuditActor, body: unknown, idempotencyKey: string | null = null): Promise<GamificationAdminAwardResult> {
    const { userId, amount, reason } = readFields(body, {
      userId: { kind: 'id' },
      amount: { kind: 'int', min: 1, max: Math.min(GAMIFICATION_AWARD_MAX, MAX_AMOUNT_PER_CALL) },
      reason: { kind: 'text', max: 255 },
    })
    if (containsPersonalData(reason)) throw validationFailure({ reason: PERSONAL_DATA_REASON })
    const sourceId = idempotencyKey === null ? null : `award:${idempotencyKey}`
    if (sourceId !== null) {
      const prior = await this.repo.ledgerByKey(this.repo.handle(), userId, 'admin_award', sourceId)
      if (prior !== null && prior.amount === amount) return { userId, currentSyiling: prior.balanceAfter, transactionId: prior.id }
    }
    const key = sourceId === null ? { sourceId: null, noKeyReason: 'a manual admin award without an Idempotency-Key has no natural key' } : { sourceId }
    return this.write(actor, AUDIT_ACTIONS.GAMIFICATION_AWARD_GRANTED, { type: 'user', id: userId }, { amount }, async (tx) => {
      if (!(await this.repo.userBasics(tx, userId))) throw notFoundError(MSG.userNotFound)
      const out = await this.wallet.credit({ userId, amount, type: 'bonus', source: 'admin_award', description: reason, isTest: actor.isTest, ...key }, { tx })
      return { userId, currentSyiling: out.currentSyiling, transactionId: out.entryId }
    })
  }

  async transactions(query: Record<string, unknown>): Promise<{ rows: GamificationAdminTransactionRow[]; total: number; page: number }> {
    const page = pageOf(query.page)
    const type = queryText(query.type)
    if (type !== '' && !LEDGER_TYPES.includes(type)) return { rows: [], total: 0, page }
    const from = queryText(query.dateFrom)
    const to = queryText(query.dateTo)
    const day = (s: string): number | null => (DATE_RE.test(s) && isRealDate(s) ? Date.parse(`${s}T00:00:00Z`) - MYT_OFFSET_MS : null)
    const fromMs = day(from)
    const toMs = day(to)
    const r = await this.repo.adminTransactions(this.repo.handle(), {
      type,
      from: fromMs === null ? null : new Date(fromMs),
      toExclusive: toMs === null ? null : new Date(toMs + 86_400_000),
      page,
      pageSize: TRANSACTIONS_PAGE_SIZE,
    })
    return {
      total: r.total,
      page,
      rows: r.rows.map((x) => ({
        id: x.id,
        userId: x.userId,
        name: x.name,
        type: x.type as 'earn',
        amount: x.amount,
        balanceAfter: x.balanceAfter,
        source: x.source,
        description: x.description,
        createdAt: toMytTimestamp(x.createdAt),
      })),
    }
  }

  // --- S9 settings ---------------------------------------------------------------------------------

  async settings(db: Db = this.repo.handle()): Promise<GamificationSetting[]> {
    const rows = new Map((await this.repo.settings(db)).map((r) => [r.key, r]))
    return GAMIFICATION_SETTING_KEYS.flatMap((key) => {
      const r = rows.get(key)
      return r ? [{ key, label: r.label, value: r.value, kind: TOGGLE_SETTING_KEYS.includes(key) ? ('toggle' as const) : ('number' as const) }] : []
    })
  }

  /** `PUT /admin/gamification/settings`: only the posted keys change (BR-M14-32). */
  async saveSettings(actor: AuditActor, body: unknown): Promise<GamificationSetting[]> {
    const list = bodyOf(body).settings
    if (!Array.isArray(list) || list.length === 0) throw validationFailure({ settings: MSG.required })
    const values: { key: string; value: number }[] = []
    const fields: Record<string, string> = {}
    list.forEach((item: unknown, i) => {
      const o = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {}
      const value = intOf(o.value)
      if (typeof o.key !== 'string' || o.key === '') fields[`settings.${String(i)}.key`] = MSG.required
      else if (value === undefined) fields[`settings.${String(i)}.value`] = MSG.invalid
      else values.push({ key: o.key, value })
    })
    if (Object.keys(fields).length > 0) throw validationFailure(fields)
    return this.write(actor, AUDIT_ACTIONS.GAMIFICATION_SETTINGS_UPDATED, { type: 'gamification_settings', id: null }, { keys: values.map((v) => v.key) }, async (tx) => {
      await this.applySettings(tx, values, 'settings')
      return this.settings(tx)
    })
  }

  /** Every key must exist, be an integer >= 0 (a toggle: 0 or 1); one refusal rolls the whole save back. */
  private async applySettings(tx: TxClient, values: readonly { key: string; value: number }[], field: string | undefined): Promise<void> {
    const known = new Set((await this.repo.settings(tx)).map((s) => s.key))
    const refuse = () => validationFailure(field === undefined ? {} : { [field]: MSG.summary }, MSG.summary)
    for (const { key, value } of values) {
      const toggle = TOGGLE_SETTING_KEYS.includes(key)
      if (!known.has(key) || !Number.isInteger(value) || value < 0 || value > (key === ECONOMY_KEYS.flatQuizReward ? MAX_AMOUNT_PER_CALL : INT_MAX) || (toggle && value > 1)) throw refuse()
    }
    const at = this.clock.now()
    for (const { key, value } of values) await this.repo.saveSetting(tx, key, value, at)
  }

  // --- S10 reward control and lucky draws ----------------------------------------------------------

  private async economy(db: Db): Promise<GamificationEconomySettings> {
    const rows = new Map((await this.repo.settings(db)).map((r) => [r.key, r.value]))
    const get = (k: string) => rows.get(k) ?? 0
    return {
      rewardBudgetSenSession: get(ECONOMY_KEYS.rewardBudgetSenSession),
      rewardBudgetSenMonth: get(ECONOMY_KEYS.rewardBudgetSenMonth),
      flatQuizReward: get(ECONOMY_KEYS.flatQuizReward),
      currentSessionYear: get(ECONOMY_KEYS.currentSessionYear),
      gamesAwardSyiling: get(ECONOMY_KEYS.gamesAwardSyiling),
    }
  }

  async rewardControl(): Promise<GamificationRewardControl> {
    const db = this.repo.handle()
    const settings = await this.economy(db)
    const year = settings.currentSessionYear
    const valid = Number.isInteger(year) && year >= 1970 && year <= 9998
    const tiles = valid ? await this.repo.claimTiles(db, new Date(`${String(year).padStart(4, '0')}-01-01T00:00:00+08:00`), new Date(`${String(year + 1).padStart(4, '0')}-01-01T00:00:00+08:00`)) : { claims: 0, students: 0, costSen: 0 }
    const [rewards, draws] = await Promise.all([this.repo.syilingRewards(db), this.repo.draws(db)])
    return {
      tiles: { sessionYear: year, liabilityRm: tiles.costSen / 100, students: tiles.students, claims: tiles.claims },
      settings,
      rewards: rewards.map(rewardView),
      draws: draws.map(drawView),
    }
  }

  /** `PUT /admin/reward-control/settings`: the five shared keys, camelCase (snake_case accepted); only the posted ones change. */
  async saveEconomySettings(actor: AuditActor, body: unknown): Promise<GamificationEconomySettings> {
    const b = bodyOf(body)
    const values: { key: string; value: number }[] = []
    const fields: Record<string, string> = {}
    for (const [camel, key] of Object.entries(ECONOMY_KEYS)) {
      const raw = b[camel] ?? b[key]
      if (raw === undefined || raw === null || raw === '') continue
      const value = intOf(raw)
      if (value === undefined) fields[camel] = MSG.invalid
      else values.push({ key, value })
    }
    if (Object.keys(fields).length > 0) throw validationFailure(fields)
    if (values.length === 0) throw validationFailure({ settings: MSG.required })
    return this.write(actor, AUDIT_ACTIONS.GAMIFICATION_SETTINGS_UPDATED, { type: 'gamification_settings', id: null }, { keys: values.map((v) => v.key) }, async (tx) => {
      await this.applySettings(tx, values, undefined)
      return this.economy(tx)
    })
  }

  async setRewardCost(actor: AuditActor, rawId: string, body: unknown): Promise<GamificationSyilingReward> {
    const id = idParam(rawId)
    const { costValueSen } = readFields(body, { costValueSen: { kind: 'int', min: 0, max: INT_MAX } })
    return this.write(actor, AUDIT_ACTIONS.GAMIFICATION_REWARD_COST_UPDATED, { type: 'syiling_reward', id: rawId }, { costValueSen }, async (tx) => {
      const r = await this.repo.setRewardCost(tx, id, costValueSen, this.clock.now())
      if (!r) throw notFoundError(MSG.rewardNotFound)
      return rewardView(r)
    })
  }

  /**
   * V-M14-12 / OD-28: the draw and its prize pool as ordered `draw_prizes` rows (position 0..n-1) in one
   * transaction; `open` when "Buka serta-merta", else `draft`. A closing date is stored as the END of that Malaysia
   * day (23:59:59.999 +08:00), so the draw stays open through its last day and `mytDay(closes_at)` is the date shown.
   */
  async createDraw(actor: AuditActor, body: unknown): Promise<GamificationDraw> {
    const v = readFields(body, {
      title: { kind: 'text', max: 150 },
      description: { kind: 'text', max: 1000, optional: true },
      ticketCostSyiling: { kind: 'int', min: 1, max: INT_MAX },
      maxTicketsPerStudent: { kind: 'int', min: 1, max: 32_767 },
      closesAt: { kind: 'text', max: 10, pattern: DATE_RE, optional: true },
      openNow: { kind: 'bool', optional: true },
    })
    const raw = bodyOf(body)
    const prizes = parsePrizePool(raw.prizePool)
    if (v.closesAt !== undefined && !isRealDate(v.closesAt)) throw validationFailure({ closesAt: MSG.invalid })
    const closesAt = v.closesAt === undefined ? null : new Date(Date.parse(`${v.closesAt}T23:59:59.999Z`) - MYT_OFFSET_MS)
    const openNow = v.openNow ?? boolOf(raw.openNow) ?? false
    return this.write(actor, AUDIT_ACTIONS.GAMIFICATION_DRAW_CREATED, { type: 'draw', id: null }, { title: v.title, prizeLines: prizes.length, status: openNow ? 'open' : 'draft' }, async (tx) =>
      drawView(
        await this.repo.createDraw(
          tx,
          { title: v.title, description: v.description ?? '', ticketCostSyiling: v.ticketCostSyiling, maxTicketsPerStudent: v.maxTicketsPerStudent, closesAt, status: openNow ? 'open' : 'draft', prizes },
          this.clock.now(),
        ),
      ),
    )
  }

  /**
   * Draws the winners of an OPEN draw (AC5, AC9). There is no HTTP route for it (the contract has none); the
   * method is the doorway for the draw run. Prize slots are the pool lines in order, each repeated `qty` times, so
   * the number of awards can never pass the sum of `qty` (nor the number of tickets). Tickets are shuffled
   * (Fisher-Yates) with the random source of `GamificationPorts` (the OS CSPRNG in production, so winners are
   * neither predictable nor choosable; tests override it with a seeded stream for the AC5 determinism). Each
   * ticket wins at most once, and the draw is closed (`status = closed`, first winner stored). The draw row is
   * locked `FOR UPDATE` before the tickets are read. The audit event (same transaction) holds what is needed to
   * audit the result: the ticket ids in ascending order, the shuffled order and the winning tickets in prize order.
   */
  async runDraw(drawId: string, actor: AuditActor | null): Promise<{ drawId: string; awards: { position: number; label: string; ticketId: string; userId: string }[] }> {
    const id = idFromString(drawId)
    return this.prisma.transaction(async (tx) => {
      await this.repo.lockDraw(tx, id)
      const draw = await this.repo.draw(tx, id)
      if (!draw) throw notFoundError()
      if (draw.status !== 'open') throw new ApiError({ code: 'DRAW_CLOSED', status: 409, message: 'Cabutan ditutup.' })
      const slots: { position: number; label: string }[] = []
      draw.prizes.forEach((p, position) => {
        for (let i = 0; i < p.qty; i++) slots.push({ position, label: p.label })
      })
      const tickets = await this.repo.ticketsOf(tx, id)
      const pick = this.ports.drawRandom(drawId)
      const pool = [...tickets]
      for (let i = pool.length - 1; i > 0; i--) {
        const j = pick(i)
        const t = pool[i] as (typeof pool)[number]
        pool[i] = pool[j] as (typeof pool)[number]
        pool[j] = t
      }
      const count = Math.min(slots.length, pool.length)
      const awards = slots.slice(0, count).map((s, i) => ({ position: s.position, label: s.label, ticketId: (pool[i] as (typeof pool)[number]).id, userId: (pool[i] as (typeof pool)[number]).userId }))
      const at = this.clock.now()
      if (!(await this.repo.closeDraw(tx, id, awards[0]?.userId ?? null, at))) throw new ApiError({ code: 'DRAW_CLOSED', status: 409, message: 'Cabutan ditutup.' })
      await this.audit.record({
        action: AUDIT_ACTIONS.GAMIFICATION_DRAW_DRAWN,
        actorUserId: actor?.userId ?? null,
        actorRole: actor?.role ?? null,
        requestId: actor?.requestId ?? null,
        ip: actor?.ip ?? null,
        isTest: actor?.isTest ?? false,
        targetType: 'draw',
        targetId: drawId,
        details: {
          ticketCount: tickets.length,
          ticketIds: tickets.map((x) => x.id),
          shuffledTicketIds: pool.map((x) => x.id),
          winningTicketIds: awards.map((a) => a.ticketId),
          awards: awards.map((a) => ({ position: a.position, ticketId: a.ticketId, userId: a.userId })),
        },
        tx,
      })
      return { drawId, awards }
    })
  }
}
