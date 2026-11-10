/**
 * Stimulus group integrity versus V2 (M-D). The core DSKP rule: a rajah or stimulus is a GROUP stimulus, every member shows it, V2 order is kept and
 * a group is never split. The expectation is computed from the V2 archive through the same deterministic rajah plan the loader used
 * (`QuestionsContext.plan()`), never typed in:
 *  - member count: every planned group has exactly its loaded members (a planned member that is quarantined is absent from both sides);
 *  - order: the members of a group sit at `group_position` 1..n, no gap, in V2 order;
 *  - completeness: every loaded V2 question the plan puts in a group belongs to THAT group (not ungrouped, not another group), the group exists;
 *  - no split: all loaded members of a planned group share one `group_id`.
 * Every group in the id maps (the plan's and the canonical ones) also gets the positions test (1..n, no gap, no duplicate).
 * The comparison is a pure function (`compareGroups`) so it is unit tested without a database. Aggregates and keys only: no question text.
 */
import type pg from 'pg'

import { QuestionsContext } from '../load/questions/context'
import type { LegacySource } from '../kit/types'
import { capped } from './check-kit'

export interface ExpectedGroup {
  key: string
  /** Planned member legacy ids in V2 order (loaded or not). */
  members: readonly string[]
}
export interface ActualMember {
  legacyId: string | null
  position: number
}
export interface GroupComparisonInput {
  expected: readonly ExpectedGroup[]
  /** Planned member legacy id -> its `group_id` (null: loaded but in no group). A member not loaded is absent. */
  loaded: ReadonlyMap<string, string | null>
  /** Group key -> `group_id`, only when the id-map entry still points at a row. */
  groupIdOf: ReadonlyMap<string, string>
  /** `group_id` -> its members. */
  actual: ReadonlyMap<string, readonly ActualMember[]>
}
export interface GroupFindings {
  groups: number
  members: number
  missingGroup: string[]
  split: string[]
  countMismatch: string[]
  positionGaps: string[]
  orderMismatch: string[]
}

export const positionsAreContiguous = (positions: readonly number[]): boolean => [...positions].sort((a, b) => a - b).every((p, i) => p === i + 1)

export function compareGroups(input: GroupComparisonInput): GroupFindings {
  const out: GroupFindings = { groups: 0, members: 0, missingGroup: [], split: [], countMismatch: [], positionGaps: [], orderMismatch: [] }
  for (const g of input.expected) {
    const want = g.members.filter((m) => input.loaded.has(m))
    if (want.length === 0) continue
    out.groups += 1
    out.members += want.length
    const gid = input.groupIdOf.get(g.key)
    if (gid === undefined) {
      out.missingGroup.push(g.key)
      continue
    }
    if (want.some((m) => input.loaded.get(m) !== gid)) out.split.push(g.key)
    const have = [...(input.actual.get(gid) ?? [])].sort((a, b) => a.position - b.position)
    if (have.length !== want.length) out.countMismatch.push(`${g.key} (${have.length} of ${want.length})`)
    if (!positionsAreContiguous(have.map((m) => m.position))) out.positionGaps.push(g.key)
    else if (have.length === want.length && have.some((m, i) => m.legacyId !== want[i])) out.orderMismatch.push(g.key)
  }
  return out
}

export const findingsTotal = (f: GroupFindings): number => f.missingGroup.length + f.split.length + f.countMismatch.length + f.positionGaps.length + f.orderMismatch.length

export function findingsDetail(f: GroupFindings): string {
  const part = (label: string, xs: readonly string[]): string => (xs.length === 0 ? '' : `; ${label}: ${capped(xs)}`)
  return (
    `${f.groups} planned groups with ${f.members} loaded members compared with the V2 plan: ${f.missingGroup.length} without a group, ${f.split.length} split, ` +
    `${f.countMismatch.length} with the wrong member count, ${f.positionGaps.length} with a gap in group_position, ${f.orderMismatch.length} out of V2 order` +
    part('missing', f.missingGroup) + part('split', f.split) + part('count', f.countMismatch) + part('gaps', f.positionGaps) + part('order', f.orderMismatch)
  )
}

/** Reads the expectation (the plan) and the loaded state, and compares them. */
export async function readGroupFindings(pool: pg.Pool, source: LegacySource): Promise<GroupFindings> {
  const ctx = new QuestionsContext({ pool, env: {}, source: 'cloud', asOf: '' })
  const { plan } = await ctx.plan()
  const expected: ExpectedGroup[] = plan.groups.map((g) => ({ key: g.key, members: g.members }))
  const legacyIds = [...new Set(expected.flatMap((g) => g.members))]
  const loaded = new Map<string, string | null>()
  if (legacyIds.length > 0) {
    const res = await pool.query<{ legacy_id: string; group_id: string | null }>(
      `SELECT legacy_id, group_id::text AS group_id FROM questions WHERE legacy_source = $1 AND legacy_id = ANY($2::text[])`,
      [source, legacyIds],
    )
    for (const r of res.rows) loaded.set(r.legacy_id, r.group_id)
  }
  const ids = await pool.query<{ legacy_id: string; group_id: string }>(
    `SELECT m.legacy_id, sg.id::text AS group_id FROM etl_id_map m JOIN stimulus_groups sg ON sg.id = m.new_id::bigint WHERE m.legacy_source = $1 AND m.entity = 'stimulus_groups'`,
    [source],
  )
  const groupIdOf = new Map(ids.rows.map((r) => [r.legacy_id, r.group_id]))
  const actual = new Map<string, ActualMember[]>()
  const gids = [...new Set(ids.rows.map((r) => r.group_id))]
  if (gids.length > 0) {
    const res = await pool.query<{ group_id: string; legacy_id: string | null; group_position: number }>(
      `SELECT group_id::text AS group_id, legacy_id, group_position::int AS group_position FROM questions WHERE group_id = ANY($1::bigint[])`,
      [gids],
    )
    for (const r of res.rows) actual.set(r.group_id, [...(actual.get(r.group_id) ?? []), { legacyId: r.legacy_id, position: r.group_position }])
  }
  return compareGroups({ expected, loaded, groupIdOf, actual })
}

/** Groups of ANY id map (the plan's and the canonical ones) whose `group_position` is not 1..n without a gap or a duplicate. */
export async function positionGapGroups(pool: pg.Pool, source: LegacySource): Promise<{ groups: number; gaps: number }> {
  const res = await pool.query<{ groups: number; gaps: number }>(
    `SELECT count(*)::int AS groups,
            count(*) FILTER (WHERE s.n > 0 AND NOT (s.min_p = 1 AND s.max_p = s.n AND s.distinct_p = s.n))::int AS gaps
       FROM (SELECT g.id, count(q.id) AS n, min(q.group_position) AS min_p, max(q.group_position) AS max_p, count(DISTINCT q.group_position) AS distinct_p
               FROM etl_id_map m JOIN stimulus_groups g ON g.id = m.new_id::bigint
               LEFT JOIN questions q ON q.group_id = g.id
              WHERE m.legacy_source = $1 AND m.entity IN ('stimulus_groups', 'canonical_stimulus_groups') GROUP BY g.id) s`,
    [source],
  )
  return res.rows[0] ?? { groups: 0, gaps: 0 }
}
