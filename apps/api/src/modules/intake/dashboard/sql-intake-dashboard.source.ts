import { Inject, Injectable, Logger } from '@nestjs/common'
import type { AiProviderId } from '@pp/contract'

import { Prisma } from '../../../db/generated/client'
import { PrismaService } from '../../../db/prisma.service'
import type { IntakeDashboardSource, IntakeRaw, UsageRaw, UsageTotalsRaw } from './intake-dashboard.ports'
import type { MonthRange } from './month'

/**
 * Default adapter of `IntakeDashboardSource`: read-only SQL over the BE-36/BE-37/BE-38 tables, by the column names of
 * `docs/architecture/v2-data-model.md` section 3.5 (intake_batches as created by BE-37's migration: `status` text, `is_test`).
 *
 * Fail-soft per store, by design (BE-40 "degrade" rule): a table that does not exist yet (its card is not merged), or a
 * column whose final name differs (SQLSTATE 42P01 / 42703), makes that store `available: false` with the empty
 * aggregate and one warning log line; every other database error is thrown (500). No content is ever read: counts,
 * timestamps, ids, provider codes and cost only.
 */

/** Review states of an item still in the queue (contract INTAKE_OPEN_STATES). */
const OPEN_ITEM_STATES = ['generated', 'needs_review', 'duplicate'] as const
/** Edit events of an item field (an edit of the whole `tag` object counts as an edit of every tag field). `edited` is the contract action (BE-38 IntakeEventAction); `field_edited` the data-model enum. */
const EDIT_EVENTS = ['edited', 'field_edited'] as const
/** Duplicate kinds that count (variant is informational). `near` is the contract code, `possible` the data-model one. */
const DUPLICATE_KINDS = ['exact', 'near', 'possible'] as const
/** A duplicate finding a person dismissed ("Bukan pendua") does not count. */
const DISMISSED_DECISIONS = ['not_duplicate', 'dismissed'] as const

const MISSING_OBJECT = new Set(['42P01', '42703'])

/** True when the error (or a nested cause/meta) is "relation/column does not exist". */
export function isMissingObjectError(err: unknown, depth = 0): boolean {
  if (err === null || typeof err !== 'object' || depth > 4) return false
  const e = err as Record<string, unknown>
  for (const key of ['code', 'originalCode', 'sqlState']) {
    const v = e[key]
    if (typeof v === 'string' && MISSING_OBJECT.has(v)) return true
  }
  const msg = typeof e.message === 'string' ? e.message : ''
  if (/(relation|column) "?[\w.]+"? (of relation "?\w+"? )?does not exist/i.test(msg)) return true
  return isMissingObjectError(e.cause, depth + 1) || isMissingObjectError(e.meta, depth + 1) || isMissingObjectError(e.originalError, depth + 1)
}

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v))
const list = (values: readonly string[]) => Prisma.join(values.map((v) => Prisma.sql`${v}`))

/** Provider code as on the wire (`openai_compatible` in the data model, `openai-compatible` in the contract). */
const PROVIDER = Prisma.sql`replace(u.provider::text, '_', '-')`
/** Card AC3: the mock provider costs 0 whatever was logged. */
const COST = Prisma.sql`(CASE WHEN u.provider::text = 'mock' THEN 0 ELSE coalesce(u.cost_sen, 0) END)`

const emptyIntake = (paths: readonly string[]): IntakeRaw => ({
  sources: { batches: false, items: false, duplicates: false },
  batchesByStatus: {},
  pending: { count: 0, oldestAt: null },
  queue: { count: 0, oldestAt: null },
  accepted: 0,
  unchangedByPath: Object.fromEntries(paths.map((p) => [p, 0])),
  itemsCreated: 0,
  duplicateItems: 0,
})

@Injectable()
export class SqlIntakeDashboardSource implements IntakeDashboardSource {
  private readonly logger = new Logger(SqlIntakeDashboardSource.name)

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  /** Runs `fn`; a missing table or column degrades to `fallback` with one warning (the store name only). */
  private async soft<T>(store: string, fn: () => Promise<T>, fallback: T): Promise<{ ok: boolean; value: T }> {
    try {
      return { ok: true, value: await fn() }
    } catch (err) {
      if (!isMissingObjectError(err)) throw err
      this.logger.warn(`intake dashboard: store ${store} is not readable (missing table or column); empty aggregate used`)
      return { ok: false, value: fallback }
    }
  }

  private async exists(tables: readonly string[]): Promise<Record<string, boolean>> {
    const rows = await this.db.$queryRaw<{ name: string; present: boolean }[]>`
      SELECT t.name, to_regclass(t.name) IS NOT NULL AS present
      FROM unnest(ARRAY[${list(tables)}]::text[]) AS t(name)`
    return Object.fromEntries(rows.map((r) => [r.name, r.present]))
  }

  async intake(range: MonthRange, paths: readonly string[]): Promise<IntakeRaw> {
    const out = emptyIntake(paths)
    const has = await this.exists(['intake_batches', 'intake_items', 'intake_item_events', 'duplicate_links'])
    if (!has.intake_batches) return out
    const { from, to } = range

    const batches = await this.soft(
      'intake_batches',
      async () => {
        const byStatus = await this.db.$queryRaw<{ status: string; n: number }[]>`
          SELECT b.status::text AS status, count(*)::int AS n
          FROM intake_batches b
          WHERE b.is_test = false AND b.created_at >= ${from} AND b.created_at < ${to}
          GROUP BY 1`
        const pending = await this.db.$queryRaw<{ n: number; oldest: Date | null }[]>`
          SELECT count(*)::int AS n, min(b.created_at) AS oldest
          FROM intake_batches b
          WHERE b.is_test = false AND b.status::text IN ('submitted', 'processing')`
        return { byStatus, pending: pending[0] }
      },
      null,
    )
    if (!batches.ok || batches.value === null) return out
    out.sources.batches = true
    for (const r of batches.value.byStatus) out.batchesByStatus[r.status] = num(r.n)
    out.pending = { count: num(batches.value.pending?.n), oldestAt: batches.value.pending?.oldest ?? null }

    if (!has.intake_items || !has.intake_item_events) return out
    const withDuplicates = has.duplicate_links === true

    const items = await this.soft(
      'intake_items',
      async () => {
        const queue = await this.db.$queryRaw<{ n: number; oldest: Date | null }[]>`
          SELECT count(*)::int AS n, min(i.created_at) AS oldest
          FROM intake_items i JOIN intake_batches b ON b.id = i.batch_id
          WHERE b.is_test = false AND i.review_state::text IN (${list(OPEN_ITEM_STATES)})`
        const unchangedCols = paths.map(
          (p, idx) => Prisma.sql`count(*) FILTER (WHERE NOT EXISTS (
              SELECT 1 FROM intake_item_events e
              WHERE e.item_id = a.id AND e.event::text IN (${list(EDIT_EVENTS)})
                AND (e.field = 'tag' OR e.field = ${p} OR e.field LIKE ${`${p}.%`} OR e.field LIKE ${`${p}[%`})))::int AS ${Prisma.raw(`u${idx}`)}`,
        )
        const accepted = await this.db.$queryRaw<Record<string, number>[]>`
          WITH a AS (
            SELECT i.id FROM intake_items i JOIN intake_batches b ON b.id = i.batch_id
            WHERE b.is_test = false AND EXISTS (
              SELECT 1 FROM intake_item_events e
              WHERE e.item_id = i.id AND e.event::text = 'accepted' AND e.created_at >= ${from} AND e.created_at < ${to}))
          SELECT count(*)::int AS accepted${paths.length > 0 ? Prisma.sql`, ${Prisma.join(unchangedCols)}` : Prisma.empty} FROM a`
        const dupFlag = withDuplicates
          ? Prisma.sql`i.review_state::text = 'duplicate' OR EXISTS (
              SELECT 1 FROM duplicate_links d
              WHERE d.item_id = i.id AND d.kind::text IN (${list(DUPLICATE_KINDS)})
                AND coalesce(d.decision::text, 'pending') NOT IN (${list(DISMISSED_DECISIONS)}))`
          : Prisma.sql`i.review_state::text = 'duplicate'`
        const created = await this.db.$queryRaw<{ n: number; dup: number }[]>`
          SELECT count(*)::int AS n, count(*) FILTER (WHERE ${dupFlag})::int AS dup
          FROM intake_items i JOIN intake_batches b ON b.id = i.batch_id
          WHERE b.is_test = false AND i.created_at >= ${from} AND i.created_at < ${to}`
        return { queue: queue[0], accepted: accepted[0] ?? {}, created: created[0] }
      },
      null,
    )
    if (!items.ok || items.value === null) return out
    out.sources.items = true
    out.sources.duplicates = withDuplicates
    out.queue = { count: num(items.value.queue?.n), oldestAt: items.value.queue?.oldest ?? null }
    out.accepted = num(items.value.accepted.accepted)
    paths.forEach((p, idx) => {
      out.unchangedByPath[p] = num(items.value?.accepted[`u${idx}`])
    })
    out.itemsCreated = num(items.value.created?.n)
    out.duplicateItems = num(items.value.created?.dup)
    return out
  }

  async usage(range: MonthRange, provider: AiProviderId | null, batchLimit: number): Promise<UsageRaw> {
    const empty: UsageRaw = { available: false, byDay: [], byProvider: [], byBatch: [] }
    const has = await this.exists(['ai_usage_logs'])
    if (!has.ai_usage_logs) return empty
    const where = Prisma.sql`u.created_at >= ${range.from} AND u.created_at < ${range.to}${
      provider === null ? Prisma.empty : Prisma.sql` AND ${PROVIDER} = ${provider}`
    }`
    const totals = Prisma.sql`count(*)::int AS calls, coalesce(sum(${COST}), 0)::bigint AS cost,
      coalesce(sum(u.pages), 0)::bigint AS pages, coalesce(sum(u.tokens_in), 0)::bigint AS tin, coalesce(sum(u.tokens_out), 0)::bigint AS tout`
    type T = { calls: number; cost: bigint; pages: bigint; tin: bigint; tout: bigint }
    const toTotals = (r: T): UsageTotalsRaw => ({
      calls: num(r.calls),
      costSen: num(r.cost),
      pages: num(r.pages),
      tokensIn: num(r.tin),
      tokensOut: num(r.tout),
    })
    const res = await this.soft(
      'ai_usage_logs',
      async () => {
        const byDay = await this.db.$queryRaw<{ day: string; calls: number; cost: bigint }[]>`
          SELECT to_char((u.created_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date, 'YYYY-MM-DD') AS day,
                 count(*)::int AS calls, coalesce(sum(${COST}), 0)::bigint AS cost
          FROM ai_usage_logs u WHERE ${where} GROUP BY 1 ORDER BY 1`
        const byProvider = await this.db.$queryRaw<({ provider: string | null } & T)[]>`
          SELECT ${PROVIDER} AS provider, ${totals}
          FROM ai_usage_logs u WHERE ${where} GROUP BY 1 ORDER BY cost DESC, provider ASC NULLS LAST`
        const byBatch = await this.db.$queryRaw<({ batch_id: string | null } & T)[]>`
          SELECT u.batch_id::text AS batch_id, ${totals}
          FROM ai_usage_logs u WHERE ${where} GROUP BY u.batch_id
          ORDER BY cost DESC, u.batch_id ASC NULLS LAST LIMIT ${batchLimit + 1}`
        return { byDay, byProvider, byBatch }
      },
      null,
    )
    if (!res.ok || res.value === null) return empty
    return {
      available: true,
      byDay: res.value.byDay.map((r) => ({ day: r.day, calls: num(r.calls), costSen: num(r.cost) })),
      byProvider: res.value.byProvider.map((r) => ({ provider: r.provider, ...toTotals(r) })),
      byBatch: res.value.byBatch.map((r) => ({ batchId: r.batch_id, ...toTotals(r) })),
    }
  }

  async monthCost(range: MonthRange): Promise<{ available: boolean; costSen: number }> {
    const has = await this.exists(['ai_usage_logs'])
    if (!has.ai_usage_logs) return { available: false, costSen: 0 }
    const res = await this.soft(
      'ai_usage_logs',
      async () =>
        this.db.$queryRaw<{ cost: bigint }[]>`
          SELECT coalesce(sum(${COST}), 0)::bigint AS cost
          FROM ai_usage_logs u WHERE u.created_at >= ${range.from} AND u.created_at < ${range.to}`,
      [],
    )
    return { available: res.ok, costSen: num(res.value[0]?.cost) }
  }

  async budgetSetting(): Promise<{ available: boolean; budgetSen: number | null }> {
    const has = await this.exists(['ai_settings'])
    if (!has.ai_settings) return { available: false, budgetSen: null }
    const res = await this.soft(
      'ai_settings',
      async () => this.db.$queryRaw<{ budget: number | bigint | null }[]>`SELECT s.monthly_budget_sen AS budget FROM ai_settings s ORDER BY s.id LIMIT 1`,
      [],
    )
    const v = res.value[0]?.budget
    return { available: res.ok, budgetSen: v === null || v === undefined ? null : Number(v) }
  }
}
