/**
 * Reward catalogue of `migrate:activity` (T-B8, KP-6): V2 `gifts` -> `rewards` (the M15 token catalogue) and V2
 * `gift_redemptions` -> `reward_redemptions`, with V2's own values (`price_token` is `token_cost`, OWN-9). Nothing is skipped
 * for "missing values" any more: the V2 rows carry them. See `transform/rewards.ts` for the two mapped columns.
 */
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { assertSurrogateLegacyId } from '../../kit/sql'
import type { LegacyRow } from '../../kit/upsert'
import { transformGift, transformHeadcount, transformRedemption, type RedemptionGift } from '../../transform/rewards'
import { rejectRow, upsertAndMap } from '../helpers'
import { distinctValues, readById, type StagedRow } from '../source'
import { lookup } from './catalogue-steps'
import type { ActivityContext } from './context'

const idOf = (row: StagedRow): string => {
  const id = row.id ?? ''
  assertSurrogateLegacyId(id, 'migrate:activity')
  return id
}

export function rewardsStep(a: ActivityContext): AnyEntityStep {
  const entity = 'rewards'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'gifts', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const out = transformGift(row, Number(legacyId))
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value as unknown as Record<string, unknown> })
      }
      return upsertAndMap(
        ctx, entity, 'rewards',
        ['category', 'vendor', 'title', 'description', 'denomination_rm', 'token_cost', 'cost_value_sen', 'stock_quantity', 'display_order', 'delivery_method', 'is_active', 'created_at', 'updated_at'],
        items,
      )
    },
  }
}

export function rewardRedemptionsStep(a: ActivityContext): AnyEntityStep {
  const entity = 'reward_redemptions'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'gift_redemptions', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const users = await ctx.idMap.resolveMany('users', distinctValues(rows, 'user_id'))
      const rewards = await ctx.idMap.resolveMany('rewards', distinctValues(rows, 'gift_id'))
      const gifts = new Map<string, RedemptionGift>()
      if (rewards.size > 0) {
        const res = await ctx.db.query<{ id: string; title: string; vendor: string; denomination_rm: string; cost_value_sen: number }>(
          `SELECT id::text AS id, title, vendor, denomination_rm::text AS denomination_rm, cost_value_sen FROM rewards WHERE id = ANY($1::bigint[])`,
          [[...rewards.values()]],
        )
        for (const r of res.rows) gifts.set(r.id, r)
      }
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const rewardId = lookup(rewards, row.gift_id)
        const out = transformRedemption(row, {
          userId: lookup(users, row.user_id),
          gift: rewardId === undefined ? undefined : gifts.get(rewardId),
        })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value as unknown as Record<string, unknown> })
      }
      return upsertAndMap(
        ctx, entity, 'reward_redemptions',
        ['user_id', 'reward_id', 'reward_title', 'reward_vendor', 'reward_icon', 'denomination_rm', 'token_cost', 'token_cost_snapshot', 'cost_value_sen_snapshot', 'status', 'stock_reserved', 'delivered_at', 'cancelled_at', 'created_at', 'updated_at'],
        items, { register: false },
      )
    },
  }
}

// ---------------------------------------------------------------- headcounts (T-B7)

/** `headcounts` -> `headcount_configs` (see `transformHeadcount`). The level is the one of the migrated class. */
export function headcountsStep(a: ActivityContext): AnyEntityStep {
  const entity = 'headcount_configs'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'headcounts', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const teachers = await ctx.idMap.resolveMany('users', distinctValues(rows, 'teacher_id'))
      const classes = await ctx.idMap.resolveMany('classrooms', distinctValues(rows, 'classroom_id'))
      const subjects = await ctx.idMap.resolveMany('subjects', distinctValues(rows, 'subject_id'))
      const levels = new Map<string, string>()
      if (classes.size > 0) {
        const res = await ctx.db.query<{ id: string; level: string }>(
          `SELECT id::text AS id, education_level_id::text AS level FROM classrooms WHERE id = ANY($1::bigint[]) AND education_level_id IS NOT NULL`,
          [[...classes.values()]],
        )
        for (const r of res.rows) levels.set(r.id, r.level)
      }
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const classroomId = lookup(classes, row.classroom_id)
        const out = transformHeadcount(row, {
          teacherId: lookup(teachers, row.teacher_id),
          classroomId,
          subjectId: lookup(subjects, row.subject_id),
          levelId: classroomId === undefined ? undefined : levels.get(classroomId),
        })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value as unknown as Record<string, unknown> })
      }
      return upsertAndMap(
        ctx, entity, 'headcount_configs',
        ['teacher_id', 'classroom_id', 'subject_id', 'education_level_id', 'academic_year', 'active_otrs', 'mode', 'legacy_tov', 'legacy_rs', 'default_tov', 'default_etr', 'created_at', 'updated_at'],
        items, { register: false },
      )
    },
  }
}
