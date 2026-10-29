/**
 * Catalogue group of `migrate:activity` (BE-29 Part B): tiers, achievements, platform challenges and the
 * gamification settings. Runs first, so the ids exist when the wallets and the completions look them up.
 *
 * Also holds the small helpers Part B's other step files share: the lookup of a mapped foreign key and the
 * resumable reader for source rows that expand to several target rows.
 */
import type pg from 'pg'

import { columnNames, findTable, STAGING_SCHEMA } from '../../ddl/spec'
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { assertSurrogateLegacyId, quoteIdent } from '../../kit/sql'
import type { LegacyRow } from '../../kit/upsert'
import {
  challengeDifficulty,
  isPlatformChallenge,
  SETTING_KEYS,
  settingEntries,
  tierMatchKey,
  transformAchievement,
  transformChallenge,
  transformSetting,
  type AchievementValues,
  type SettingEntry,
} from '../../transform/gamification'
import { excludedResult, sumBatch } from '../../transform/activity-common'
import { claimSeeded, dropConflicts } from '../claim'
import { rejectRow, upsertAndMap } from '../helpers'
import { readById, type StagedRow } from '../source'
import type { ActivityContext } from './context'

const idOf = (row: StagedRow): string => {
  const id = row.id ?? ''
  assertSurrogateLegacyId(id, 'migrate:activity')
  return id
}

const toRow = <V extends object>(i: { legacyId: string; values: V }): LegacyRow => ({
  legacyId: i.legacyId,
  values: i.values as unknown as Record<string, unknown>,
})

// ---------------------------------------------------------------- shared helpers of Part B

/** The mapped id of a staged foreign key value (undefined when the value is blank or its parent was not loaded). */
export function lookup(map: ReadonlyMap<string, string>, value: string | null | undefined): string | undefined {
  return value === null || value === undefined ? undefined : map.get(value.trim())
}

export interface Expanded<E> {
  /** Resume key: `<source id>:<position inside the source row>`. */
  key: string
  row: StagedRow
  entry: E
}

/**
 * Keyset reader for a table with an `id` whose rows each expand to zero or more target rows (a pivot such as
 * `reward_settings`, or a JSON list). The resume key carries the position, so a checkpoint in the middle of one
 * source row neither repeats nor skips the rest of it. `where` is static loader text, never data.
 */
export async function* readExpanded<E>(
  pool: pg.Pool,
  options: { table: string; columns: readonly string[]; where?: string },
  afterKey: string | null,
  pageSize: number,
  expand: (row: StagedRow) => E[],
): AsyncGenerator<Expanded<E>> {
  const spec = findTable(options.table)
  if (!spec || spec.group !== 'staging') throw new RangeError(`Table "${options.table}" is not a staging table.`)
  const known = new Set(columnNames(spec))
  for (const c of options.columns) if (!known.has(c)) throw new RangeError(`Column "${c}" is not in the staging spec of "${options.table}".`)
  const select = ['id', ...options.columns].map((c) => `t.${quoteIdent(c)}::text AS ${quoteIdent(c)}`).join(', ')
  const from = `${quoteIdent(STAGING_SCHEMA)}.${quoteIdent(options.table)}`
  let afterId: string | null = null
  let afterPos = -1
  if (afterKey !== null) {
    const [id, pos] = afterKey.split(':')
    afterId = id ?? null
    afterPos = Number(pos ?? -1)
  }
  let first = true
  for (;;) {
    const res: pg.QueryResult<StagedRow> = await pool.query<StagedRow>(
      // `t."id"` is the bigint column; a bare `ORDER BY "id"` would bind to the text output alias of the same name.
      `SELECT ${select} FROM ${from} t WHERE ($1::bigint IS NULL OR t."id" ${first ? '>=' : '>'} $1::bigint)${options.where ? ` AND (${options.where})` : ''} ORDER BY t."id" LIMIT $2`,
      [afterId, pageSize],
    )
    for (const row of res.rows) {
      const entries = expand(row)
      for (let pos = 0; pos < entries.length; pos++) {
        if (first && row.id === afterId && pos <= afterPos) continue
        yield { key: `${row.id}:${pos}`, row, entry: entries[pos] as E }
      }
    }
    if (res.rows.length < pageSize) return
    afterId = (res.rows[res.rows.length - 1] as StagedRow).id ?? null
    first = false
  }
}

// ---------------------------------------------------------------- tiers

/**
 * Adopts the seeded tiers (LEAD decision): a staged tier takes over the seeded `tiers` row whose `label_ms` (else
 * `tier_name`) equals its label, case-insensitively. The v2 tier needs a name, icon, colour, threshold and rate that
 * the staged tier does not carry (Perlu pengesahan), so those stay the seed's values; a staged tier with no seeded
 * match is rejected UNSUPPORTED and never invented. The ids are registered under entity `tiers` for the wallets.
 */
export function tiersStep(a: ActivityContext): AnyEntityStep {
  const entity = 'tiers'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'gamification_tiers', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const keyed: { legacyId: string; key: string }[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const key = tierMatchKey(row.label_ms)
        if (key === null) rejectRow(ctx, entity, legacyId, { reason: 'INVALID_VALUE', column: 'label_ms' })
        else keyed.push({ legacyId, key })
      }
      let claimed = await claimSeeded(ctx.db, 'tiers', ctx.source, 'lower(btrim(t.label_ms))', keyed)
      claimed += await claimSeeded(ctx.db, 'tiers', ctx.source, 'lower(btrim(t.tier_name))', keyed)
      const found = new Map<string, string>()
      if (keyed.length > 0) {
        const res = await ctx.db.query<{ legacy_id: string; id: string }>(
          `SELECT legacy_id, id::text AS id FROM tiers WHERE legacy_source = $1 AND legacy_id = ANY($2::text[])`,
          [ctx.source, keyed.map((k) => k.legacyId)],
        )
        for (const r of res.rows) found.set(r.legacy_id, r.id)
      }
      for (const k of keyed) {
        if (!found.has(k.legacyId)) rejectRow(ctx, entity, k.legacyId, { reason: 'UNSUPPORTED', column: 'label_ms' })
      }
      await ctx.idMap.registerMany(entity, found)
      return { inserted: 0, updated: claimed, unchanged: found.size - claimed }
    },
  }
}

// ---------------------------------------------------------------- achievements

export function achievementsStep(a: ActivityContext): AnyEntityStep {
  const entity = 'achievements'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'achievements', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const items: { legacyId: string; values: AchievementValues }[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const out = transformAchievement(row)
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value })
      }
      // Seeded achievements are adopted by upper-cased name; the seed keeps its own spelling and structured criterion.
      await claimSeeded(ctx.db, 'achievements', ctx.source, 'upper(btrim(t.name))', items.map((i) => ({ legacyId: i.legacyId, key: i.values.name.toUpperCase() })))
      if (items.length > 0) {
        const res = await ctx.db.query<{ legacy_id: string; name: string }>(
          `SELECT legacy_id, name FROM achievements WHERE legacy_source = $1 AND legacy_id = ANY($2::text[])`,
          [ctx.source, items.map((i) => i.legacyId)],
        )
        const existing = new Map(res.rows.map((r) => [r.legacy_id, r.name]))
        for (const i of items) i.values = { ...i.values, name: existing.get(i.legacyId) ?? i.values.name }
      }
      return upsertAndMap(ctx, entity, 'achievements', ['name', 'legacy_criteria_text', 'created_at', 'updated_at'], items.map(toRow))
    },
  }
}

// ---------------------------------------------------------------- challenges

export function challengesStep(a: ActivityContext): AnyEntityStep {
  const entity = 'challenges'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'challenges', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      let teacher = 0
      let difficultyUnmapped = 0
      let sortOrderNegative = 0
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        if (!isPlatformChallenge(row)) {
          teacher++
          continue
        }
        const out = transformChallenge(row)
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else {
          // A difficulty word outside easy/medium/hard keeps the default `medium`; only the count is reported, never the word.
          if (challengeDifficulty(row.difficulty).unmapped) difficultyUnmapped++
          // Kept as staged (fidelity); the v2 admin form takes 0 and up, so a re-save of such a challenge needs a new order.
          if ((out.value as { sort_order: number }).sort_order < 0) sortOrderNegative++
          items.push({ legacyId, values: out.value as unknown as Record<string, unknown> })
        }
      }
      a.notes.count('challenges.teacher_excluded', teacher)
      if (difficultyUnmapped > 0) a.notes.count('challenges.difficulty_unmapped', difficultyUnmapped)
      if (sortOrderNegative > 0) a.notes.count('challenges.sort_order_negative', sortOrderNegative)
      const res = await upsertAndMap(
        ctx, entity, 'challenges',
        ['title', 'challenge_type', 'metric', 'target_value', 'reward_syiling', 'reward_xp', 'difficulty', 'sort_order', 'is_active', 'created_at', 'updated_at'],
        items,
      )
      return sumBatch(res, excludedResult(teacher))
    },
  }
}

// ---------------------------------------------------------------- gamification settings

/** The single `reward_settings` row becomes one key/value row per non-empty column; legacy id `<row id>:<key>`. */
export function settingsStep(a: ActivityContext): AnyEntityStep {
  const entity = 'gamification_settings'
  const columns = [...SETTING_KEYS, 'created_at', 'updated_at']
  return {
    entity,
    source: a.source,
    extract: (after) => readExpanded<SettingEntry>(a.pool, { table: 'reward_settings', columns }, after, a.pageSize, (row) => settingEntries(row)),
    keyOf: (e: Expanded<SettingEntry>) => e.key,
    async load(rows: Expanded<SettingEntry>[], ctx: BatchContext): Promise<BatchResult> {
      let items: { legacyId: string; key: string; values: Record<string, unknown> }[] = []
      for (const e of rows) {
        const legacyId = `${e.row.id}:${e.entry.key}`
        assertSurrogateLegacyId(legacyId, 'migrate:activity')
        const out = transformSetting(e.row, e.entry)
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, key: out.value.key, values: out.value as unknown as Record<string, unknown> })
      }
      await claimSeeded(ctx.db, 'gamification_settings', ctx.source, 't.key', items.map((i) => ({ legacyId: i.legacyId, key: i.key })))
      items = await dropConflicts(ctx.db, items, {
        entity, table: 'gamification_settings', column: 'key', expr: 'key', source: ctx.source, rejects: ctx.rejects,
        legacyIdOf: (i) => i.legacyId, valueOf: (i) => i.key,
      })
      return upsertAndMap(
        ctx, entity, 'gamification_settings', ['key', 'value', 'label', 'created_at', 'updated_at'],
        items.map((i) => ({ legacyId: i.legacyId, values: i.values })),
        { register: false },
      )
    },
  }
}
