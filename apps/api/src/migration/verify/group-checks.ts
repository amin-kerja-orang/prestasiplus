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
export async function readGroupFindings(pool: pg.Pool, source: LegacySource, asOf = ''): Promise<GroupFindings> {
  // The plan is a pure function of the archive and the curriculum id maps (it reads no date); the same `QuestionsContext` the loader builds, with the
  // run's source and as-of, gives exactly the plan the load used.
  if (source !== 'cloud') throw new Error(`stimulus group check: the rajah plan exists for the cloud source only, not ${source}`)
  const ctx = new QuestionsContext({ pool, env: {}, source, asOf })
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

export interface CanonicalFindings {
  /** Loaded canonical-only questions with at least one V2 stimulus link. */
  questions: number
  /** Questions with no group and no own stimulus link at all although V2 links a stimulus. */
  noStimulus: number
  /** Questions that show a stimulus V2 does not link to them (own link or group stimulus). */
  foreignLink: number
  /** Questions that show fewer stimuli than V2 links (up to 3 own plus the group stimulus). */
  tooFewLinks: number
  /** Canonical groups whose exam-question members are not in V2 order (`exam_questions.position`, id), and groups above 40 members. */
  groupOrder: number
  groupOver40: number
  groups: number
}

/**
 * The canonical bank (V2 `exam_questions` that are not projections of a legacy question), compared with V2 `question_stimulus` and a part's
 * `stimulus_id`: every such question that V2 links to a stimulus shows exactly the stimuli V2 links (its own links, up to 3, plus the stimulus of its
 * group), and the canonical groups keep V2 order. Aggregates only.
 */
export async function readCanonicalFindings(pool: pg.Pool, source: LegacySource): Promise<CanonicalFindings> {
  const res = await pool.query<CanonicalFindings>(
    `WITH v2links AS (
        SELECT DISTINCT u.exam_question_id AS eq, u.stimulus_id AS sid FROM (
          SELECT exam_question_id, stimulus_id FROM archive_cloud.question_stimulus
          UNION ALL SELECT exam_question_id, stimulus_id FROM archive_cloud.question_parts WHERE stimulus_id IS NOT NULL) u
         WHERE NOT EXISTS (SELECT 1 FROM archive_cloud.legacy_canonical_map m WHERE m.canonical_type = 'exam_question' AND m.canonical_id = u.exam_question_id)),
      loaded AS (SELECT m.legacy_id::bigint AS eq, m.new_id::bigint AS qid FROM etl_id_map m JOIN questions q ON q.id = m.new_id::bigint
                  WHERE m.legacy_source = $1 AND m.entity = 'exam_questions'),
      expd AS (SELECT DISTINCT l.qid, s.new_id::bigint AS stim FROM v2links v JOIN loaded l ON l.eq = v.eq
                 JOIN etl_id_map s ON s.legacy_source = $1 AND s.entity = 'canonical_stimuli' AND s.legacy_id = v.sid::text),
      act AS (SELECT DISTINCT x.qid, x.stim FROM (
                SELECT ver.question_id AS qid, qvs.stimulus_id AS stim FROM question_version_stimuli qvs JOIN question_versions ver ON ver.id = qvs.question_version_id AND ver.version_no = 1
                UNION ALL SELECT q.id, gs.stimulus_id FROM questions q JOIN stimulus_group_stimuli gs ON gs.group_id = q.group_id) x
               WHERE x.qid IN (SELECT qid FROM expd)),
      per AS (SELECT e.qid, count(*)::int AS exp_n,
                     (SELECT count(*) FROM act a WHERE a.qid = e.qid)::int AS act_n,
                     (SELECT count(*) FROM act a WHERE a.qid = e.qid AND NOT EXISTS (SELECT 1 FROM expd d WHERE d.qid = a.qid AND d.stim = a.stim))::int AS foreign_n,
                     (EXISTS (SELECT 1 FROM questions q WHERE q.id = e.qid AND q.group_id IS NOT NULL))::int AS in_group
                FROM expd e GROUP BY e.qid),
      cg AS (SELECT sg.id AS gid FROM etl_id_map m JOIN stimulus_groups sg ON sg.id = m.new_id::bigint WHERE m.legacy_source = $1 AND m.entity = 'canonical_stimulus_groups'),
      ranked AS (SELECT q.id, q.group_id,
                        row_number() OVER (PARTITION BY q.group_id ORDER BY q.group_position) AS by_pos,
                        row_number() OVER (PARTITION BY q.group_id ORDER BY (eq.id IS NULL), coalesce(eq."position"::text::int, 0), eq.id::bigint, q.group_position, q.id) AS by_v2
                   FROM questions q JOIN cg ON cg.gid = q.group_id
                   LEFT JOIN etl_id_map em ON em.new_id::bigint = q.id AND em.entity = 'exam_questions' AND em.legacy_source = $1
                   LEFT JOIN archive_cloud.exam_questions eq ON eq.id = em.legacy_id::bigint)
      SELECT (SELECT count(*) FROM per)::int AS questions,
             (SELECT count(*) FROM per WHERE act_n = 0)::int AS "noStimulus",
             (SELECT count(*) FROM per WHERE foreign_n > 0)::int AS "foreignLink",
             (SELECT count(*) FROM per WHERE act_n > 0 AND act_n < LEAST(exp_n, 3 + in_group))::int AS "tooFewLinks",
             (SELECT count(DISTINCT group_id) FROM ranked WHERE by_pos <> by_v2)::int AS "groupOrder",
             (SELECT count(*) FROM (SELECT group_id FROM ranked GROUP BY group_id HAVING count(*) > 40) o)::int AS "groupOver40",
             (SELECT count(*) FROM cg)::int AS groups`,
    [source],
  )
  return res.rows[0] ?? { questions: 0, noStimulus: 0, foreignLink: 0, tooFewLinks: 0, groupOrder: 0, groupOver40: 0, groups: 0 }
}

export const canonicalTotal = (f: CanonicalFindings): number => f.noStimulus + f.foreignLink + f.tooFewLinks + f.groupOrder + f.groupOver40

export const canonicalDetail = (f: CanonicalFindings): string =>
  `${f.questions} canonical-only questions with a V2 stimulus link in ${f.groups} canonical groups: ${f.noStimulus} show no stimulus, ${f.foreignLink} show a stimulus V2 does not link, ` +
  `${f.tooFewLinks} show fewer stimuli than V2 links, ${f.groupOrder} groups out of V2 order, ${f.groupOver40} groups above 40 members`
