/**
 * Streak step of `migrate:activity` (BE-29, T-05): `streaks` is RECOMPUTED from the migrated practice sessions,
 * not copied. `student_wallets.streak_days` is only compared with the recomputed run and reported as drift.
 *
 * Per user, from the distinct Malaysia calendar days of the migrated sessions (the day is computed in SQL with
 * `klDateSql`, never in JavaScript):
 *   total_days          number of distinct days
 *   best                longest run of consecutive days
 *   current             the run that ends on the as-of day or the day before it, else 0
 *   last_activity_date  the latest day
 * One row per migrated wallet (legacy id = the wallet id); a wallet that was not migrated gets no streak.
 */
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import type { LegacyRow } from '../../kit/upsert'
import { dropConflicts } from '../claim'
import { upsertAndMap } from '../helpers'
import { distinctValues, readById, resolveFk, type StagedRow } from '../source'
import { excludedResult, klDateSql, sumBatch } from '../../transform/activity-common'
import { stamps } from '../../transform/common'
import type { ActivityContext } from './context'
import { idOf } from './wallet-steps'

const STREAK_COLUMNS = ['user_id', 'current', 'best', 'last_activity_date', 'total_days', 'created_at', 'updated_at'] as const

/** Gaps-and-islands over the distinct days; `$1` source, `$2` v2 user ids, `$3` as-of day. */
export const STREAK_SQL = `
WITH d AS (
  SELECT DISTINCT s.user_id, ${klDateSql('s.started_at')} AS day
  FROM practice_sessions s
  WHERE s.legacy_source = $1 AND s.user_id = ANY($2::bigint[])
), g AS (
  SELECT user_id, day, day - (row_number() OVER (PARTITION BY user_id ORDER BY day))::int AS grp FROM d
), runs AS (
  SELECT user_id, count(*)::int AS len, max(day) AS last_day FROM g GROUP BY user_id, grp
)
SELECT user_id::text AS user_id,
       sum(len)::int AS total_days,
       max(len)::int AS best,
       coalesce(max(len) FILTER (WHERE last_day >= $3::date - 1 AND last_day <= $3::date), 0)::int AS cur,
       max(last_day)::text AS last_activity_date
FROM runs GROUP BY user_id`

interface StreakRow {
  user_id: string
  total_days: number
  best: number
  cur: number
  last_activity_date: string
}

export function streaksStep(a: ActivityContext): AnyEntityStep {
  const entity = 'streaks'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'student_wallets', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const users = await ctx.idMap.resolveMany('users', distinctValues(rows, 'user_id'))
      const migrated = await ctx.db.query<{ legacy_id: string }>(
        `SELECT legacy_id FROM wallets WHERE legacy_source = $1 AND legacy_id = ANY($2::text[])`,
        [ctx.source, rows.map((r) => idOf(r))],
      )
      const hasWallet = new Set(migrated.rows.map((r) => r.legacy_id))
      // A wallet that was rejected or not loaded has no streak (its reject is already on the `wallets` entity).
      const live = rows.filter((r) => hasWallet.has(idOf(r)) && resolveFk(r.user_id, users))
      const excluded = rows.length - live.length
      const userIds = live.map((r) => resolveFk(r.user_id, users) as string)
      const computed = new Map<string, StreakRow>()
      if (userIds.length > 0) {
        const res = await ctx.db.query<StreakRow>(STREAK_SQL, [ctx.source, userIds, a.asOf])
        for (const r of res.rows) computed.set(r.user_id, r)
      }
      let items: { legacyId: string; user: string; values: Record<string, unknown> }[] = []
      for (const row of live) {
        const user = resolveFk(row.user_id, users) as string
        const s = computed.get(user)
        const old = row.streak_days === null ? null : Number(row.streak_days)
        const current = s?.cur ?? 0
        // The old counter is not migrated; a difference from the recomputed run is reported (ids only).
        if (old !== null && Number.isFinite(old) && old !== current && row.user_id) a.drift.addId('streak_days_mismatch', row.user_id)
        items.push({
          legacyId: idOf(row),
          user,
          values: {
            user_id: user,
            current,
            best: s?.best ?? 0,
            last_activity_date: s?.last_activity_date ?? null,
            total_days: s?.total_days ?? 0,
            ...stamps(row),
          },
        })
      }
      items = await dropConflicts(ctx.db, items, {
        entity, table: 'streaks', column: 'user_id', expr: 'user_id::text', source: ctx.source, rejects: ctx.rejects,
        legacyIdOf: (i) => i.legacyId, valueOf: (i) => i.user,
      })
      const res = await upsertAndMap(
        ctx, entity, 'streaks', STREAK_COLUMNS,
        items.map((i): LegacyRow => ({ legacyId: i.legacyId, values: i.values })),
        { register: false },
      )
      return sumBatch(res, excludedResult(excluded))
    },
  }
}
