/**
 * SRS M14 v1.8 §7 #31–#43: the admin endpoints of S6–S10 (role `admin`, **AD**, BR-M14-01).
 *
 * | # | Route | Screen |
 * |---|---|---|
 * | 31–33 | teacher gamification: overview, badge `PUT`, reward `POST` (multipart) | S6 |
 * | 34, 35 | teacher redemptions: list, `PATCH` | S7 |
 * | 36, 37 | teacher cash requests: list, `PATCH` | S8 |
 * | 38, 39 | settings: list, `PUT` | S9 |
 * | 40–43 | reward control: overview, settings `PUT`, cost `PUT`, draw `POST` | S10 |
 *
 * Bank account numbers and holders are returned masked (SEC-M14-04). Status changes and settings
 * saves are validated before any write; a refusal of the repository rolls the request back.
 */

import { created, int, ok, queryString, route, validationError, type RouteDef } from '@/mock/define'

import {
  drawsRepo,
  rewardControlRepo,
  settingsRepo,
  teacherCashRepo,
  teacherGamificationRepo,
  teacherRewardsRepo,
} from '../repository'
import { isRealDate } from '../repository/social'
import type {
  CashStatus,
  Draw,
  RedemptionStatus,
  SettingKey,
  SyilingReward,
  TeacherRewardCategory,
} from '../repository/types'
import { adminOnly, guarded, MSG, nameOf } from './common'
import { bodyOf, boolOf, intOf, readFields } from './input'
import { redemptionViews } from './teacher'

const REDEMPTION_STATUSES: readonly string[] = ['PENDING', 'PROCESSING', 'DELIVERED', 'CANCELLED']
const CASH_STATUSES: readonly string[] = ['PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED']
const CATEGORIES: readonly string[] = ['general', 'digital', 'physical', 'voucher']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/** SEC-M14-10 (backend phase) replicated cheaply: images only, bounded size. */
const IMAGE_MAX_BYTES = 5 * 1024 * 1024
/** Raster formats only: SVG and anything else is refused (G4 F2). */
const IMAGE_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp']

const idParam = { params: { id: int() } }

/** The five economy keys that S9 and S10 share (BR-M14-32), in their camelCase API names. */
const ECONOMY_KEYS: Readonly<Record<string, SettingKey>> = {
  rewardBudgetSenSession: 'reward_budget_sen_session',
  rewardBudgetSenMonth: 'reward_budget_sen_month',
  flatQuizReward: 'flat_quiz_reward',
  currentSessionYear: 'current_session_year',
  gamesAwardSyiling: 'games_award_syiling',
}

function economySettings() {
  return Object.fromEntries(
    Object.entries(ECONOMY_KEYS).map(([camel, key]) => [camel, settingsRepo.get(key)]),
  )
}

function settingRows() {
  return settingsRepo.all().map((s) => ({
    key: s.key,
    label: s.label,
    value: s.value,
    kind: s.kind,
  }))
}

const costView = (r: SyilingReward) => ({ ...r, costRm: r.costValueSen / 100 })
const drawView = (d: Draw) => ({ ...d, ticketsSold: drawsRepo.ticketCount(d.id) })

/** A cash row with the teacher name S8 shows (the masked fields come from the repository). */
function cashRow<T extends { userId: number }>(r: T) {
  return { ...r, name: nameOf(r.userId) }
}

/**
 * V-M14-12: the prize pool as the JSON text the repository parses. A JSON text passes through; an
 * array of `{label, valueSen | value_sen, qty}` is serialised; anything else is `false` (invalid);
 * absent is `undefined`.
 */
function poolText(raw: unknown): string | undefined | false {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw === 'string') return raw
  if (!Array.isArray(raw)) return false
  return JSON.stringify(
    raw.map((p: unknown) => {
      const o = typeof p === 'object' && p !== null ? (p as Record<string, unknown>) : {}
      return { label: o.label, value_sen: o.valueSen ?? o.value_sen, qty: o.qty }
    }),
  )
}

/** A multipart image: a `File`/`Blob` or a `{name, size, type}` stand-in; `null` for none. */
function imageOf(value: unknown): { name: string; size: number; type: string } | null {
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    const name = (value as Blob & { name?: string }).name ?? ''
    return name === '' && value.size === 0
      ? null
      : { name: name === '' ? 'gambar' : name, size: value.size, type: value.type }
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const v = value as { name?: unknown; size?: unknown; type?: unknown }
    if (typeof v.name === 'string' && typeof v.size === 'number') {
      return { name: v.name, size: v.size, type: typeof v.type === 'string' ? v.type : '' }
    }
  }
  return null
}

export const adminOpsRoutes: RouteDef[] = [
  // #31 (S6)
  route('GET', '/api/admin/gamification/guru', [adminOnly], () => {
    return ok({
      cards: {
        rewards: teacherRewardsRepo.count('Q-TEACHER-REWARDS'),
        activeRewards: teacherRewardsRepo.count('Q-TEACHER-REWARDS-ACTIVE'),
        badges: teacherGamificationRepo.count('Q-TEACHER-BADGES'),
        pendingRedemptions: teacherRewardsRepo.redemptionCount('PENDING'),
      },
      pendingCash: teacherCashRepo.count('Q-CASH', 'PENDING'),
      badges: teacherGamificationRepo.badges(),
      rewards: teacherRewardsRepo.list(),
    })
  }),

  // #32 (S6): V-M14-07 (name required, threshold ≥ 1, bonus ≥ 0).
  route(
    'PUT',
    '/api/admin/gamification/guru/badges/:id',
    [adminOnly],
    (req) => {
      const parsed = readFields(bodyOf(req), {
        name: { kind: 'text', max: 80 },
        icon: { kind: 'text', max: 60, optional: true },
        threshold: { kind: 'int', min: 1 },
        bonusCoins: { kind: 'int', min: 0 },
        isActive: { kind: 'bool', optional: true },
      })
      if (!parsed.ok) return parsed.response
      const { icon, isActive, ...rest } = parsed.value
      const patch = {
        ...rest,
        ...(icon !== undefined ? { icon } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      }
      return ok(guarded(() => teacherGamificationRepo.updateBadge(Number(req.params.id), patch)))
    },
    idParam,
  ),

  // #33 (S6): multipart; the image is kept as a mock reference (D22: nothing is stored).
  route('POST', '/api/admin/gamification/guru/rewards', [adminOnly], (req) => {
    const body = bodyOf(req)
    const parsed = readFields(body, {
      name: { kind: 'text', max: 120 },
      category: { kind: 'enum', values: CATEGORIES },
      costCoins: { kind: 'int', min: 1 },
      stock: { kind: 'int', min: 0, optional: true },
      maxPerUser: { kind: 'int', min: 1, optional: true },
      maxPerMonth: { kind: 'int', min: 1, optional: true },
      description: { kind: 'text', max: 1000, optional: true },
      isActive: { kind: 'bool', optional: true },
    })
    if (!parsed.ok) return parsed.response
    const image = imageOf(body.image)
    if (image && (!IMAGE_TYPES.includes(image.type) || image.size > IMAGE_MAX_BYTES)) {
      return validationError({ image: MSG.imageType }, MSG.summary)
    }
    const v = parsed.value
    return created(
      guarded(() =>
        teacherRewardsRepo.create({
          name: v.name,
          category: v.category as TeacherRewardCategory,
          costCoins: v.costCoins,
          stock: v.stock ?? null,
          maxPerUser: v.maxPerUser ?? null,
          maxPerMonth: v.maxPerMonth ?? null,
          description: v.description ?? '',
          imageUrl: image
            ? `blob:mock/m14-teacher-rewards/${encodeURIComponent(image.name)}`
            : null,
          isActive: v.isActive ?? true,
        }),
      ),
    )
  }),

  // #34 (S7): `status` default PENDING; an unknown value lists nothing.
  route('GET', '/api/admin/gamification/guru/redemptions', [adminOnly], (req) => {
    const asked = queryString(req.query, 'status') ?? 'PENDING'
    const rows =
      asked === 'all' || REDEMPTION_STATUSES.includes(asked)
        ? teacherRewardsRepo.redemptions(asked as RedemptionStatus | 'all')
        : []
    return ok(redemptionViews(rows))
  }),

  // #35 (S7, PROPOSED): BR-M14-27.
  route(
    'PATCH',
    '/api/admin/gamification/guru/redemptions/:id',
    [adminOnly],
    (req) => {
      const parsed = readFields(bodyOf(req), {
        status: { kind: 'enum', values: REDEMPTION_STATUSES },
      })
      if (!parsed.ok) return parsed.response
      const row = guarded(() =>
        teacherRewardsRepo.setRedemptionStatus(
          Number(req.params.id),
          parsed.value.status as RedemptionStatus,
        ),
      )
      return ok(redemptionViews([row])[0])
    },
    idParam,
  ),

  // #36 (S8): masked bank fields; `status` default PENDING, `all` lists every request.
  route('GET', '/api/admin/gamification/guru/cash', [adminOnly], (req) => {
    const asked = queryString(req.query, 'status') ?? 'PENDING'
    const view = teacherCashRepo.adminList(asked as CashStatus | 'all')
    return ok({ cards: view.cards, rows: view.rows.map(cashRow) })
  }),

  // #37 (S8): BR-M14-26, any status; PAID debits once, leaving PAID credits back.
  route(
    'PATCH',
    '/api/admin/gamification/guru/cash/:id',
    [adminOnly],
    (req) => {
      const body = bodyOf(req)
      const parsed = readFields(body, {
        status: { kind: 'enum', values: CASH_STATUSES },
        adminNote: { kind: 'text', max: 500, optional: true },
      })
      if (!parsed.ok) return parsed.response
      // An explicitly blank note clears it; an absent one keeps it.
      const note = parsed.value.adminNote ?? (typeof body.adminNote === 'string' ? null : undefined)
      const row = guarded(() =>
        teacherCashRepo.setStatus(Number(req.params.id), parsed.value.status as CashStatus, note),
      )
      return ok(cashRow(row))
    },
    idParam,
  ),

  // #38 (S9)
  route('GET', '/api/admin/gamification/settings', [adminOnly], () => ok(settingRows())),

  // #39 (S9): only the posted keys change; unknown key or a value below 0 is 422.
  route('PUT', '/api/admin/gamification/settings', [adminOnly], (req) => {
    const list = bodyOf(req).settings
    if (!Array.isArray(list) || list.length === 0) {
      return validationError({ settings: MSG.required }, MSG.summary)
    }
    const values: { key: string; value: number }[] = []
    const fields: Record<string, string> = {}
    list.forEach((item: unknown, i) => {
      const o = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {}
      const value = intOf(o.value)
      if (typeof o.key !== 'string' || o.key === '')
        fields[`settings.${String(i)}.key`] = MSG.required
      else if (value === undefined) fields[`settings.${String(i)}.value`] = MSG.invalid
      else values.push({ key: o.key, value })
    })
    if (Object.keys(fields).length > 0) return validationError(fields, MSG.summary)
    guarded(() => settingsRepo.update(values), 'settings')
    return ok(settingRows())
  }),

  // #40 (S10)
  route('GET', '/api/admin/reward-control', [adminOnly], () =>
    ok({
      tiles: rewardControlRepo.claimTiles(),
      settings: economySettings(),
      rewards: rewardControlRepo.rewards().map(costView),
      draws: drawsRepo.list().map(drawView),
    }),
  ),

  // #41 (S10): the five shared keys, camelCase (snake_case accepted); only the posted ones change.
  route('PUT', '/api/admin/reward-control/settings', [adminOnly], (req) => {
    const body = bodyOf(req)
    const values: { key: string; value: number }[] = []
    const fields: Record<string, string> = {}
    for (const [camel, key] of Object.entries(ECONOMY_KEYS)) {
      const raw = body[camel] ?? body[key]
      if (raw === undefined || raw === null || raw === '') continue
      const value = intOf(raw)
      if (value === undefined) fields[camel] = MSG.invalid
      else values.push({ key, value })
    }
    if (Object.keys(fields).length > 0) return validationError(fields, MSG.summary)
    if (values.length === 0) return validationError({ settings: MSG.required }, MSG.summary)
    guarded(() => settingsRepo.update(values))
    return ok(economySettings())
  }),

  // #42 (S10): V-M14-13, `costValueSen` an integer ≥ 0.
  route(
    'PUT',
    '/api/admin/reward-control/rewards/:id/cost',
    [adminOnly],
    (req) => {
      const parsed = readFields(bodyOf(req), { costValueSen: { kind: 'int', min: 0 } })
      if (!parsed.ok) return parsed.response
      return ok(
        costView(
          guarded(() =>
            rewardControlRepo.setCost(Number(req.params.id), parsed.value.costValueSen),
          ),
        ),
      )
    },
    idParam,
  ),

  // #43 (S10): V-M14-12; `draft` unless "Buka serta-merta".
  route('POST', '/api/admin/reward-control/draws', [adminOnly], (req) => {
    const body = bodyOf(req)
    const parsed = readFields(body, {
      title: { kind: 'text', max: 150 },
      description: { kind: 'text', max: 1000, optional: true },
      ticketCostSyiling: { kind: 'int', min: 1 },
      maxTicketsPerStudent: { kind: 'int', min: 1 },
      closesAt: { kind: 'text', max: 10, pattern: DATE_RE, optional: true },
      openNow: { kind: 'bool', optional: true },
    })
    if (!parsed.ok) return parsed.response
    const pool = poolText(body.prizePool)
    if (pool === false) return validationError({ prizePool: MSG.poolInvalid }, MSG.poolInvalid)
    const v = parsed.value
    if (v.closesAt !== undefined && !isRealDate(v.closesAt)) {
      return validationError({ closesAt: MSG.invalid }, MSG.summary)
    }
    const draw = guarded(
      () =>
        drawsRepo.create({
          title: v.title,
          ...(v.description !== undefined ? { description: v.description } : {}),
          ticketCostSyiling: v.ticketCostSyiling,
          maxTicketsPerStudent: v.maxTicketsPerStudent,
          ...(pool !== undefined ? { prizePool: pool } : {}),
          closesAt: v.closesAt ?? null,
          openNow: v.openNow ?? boolOf(body.openNow) ?? false,
        }),
      'prizePool',
    )
    return created(drawView(draw))
  }),
]
