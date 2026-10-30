/**
 * BJS-06 (v2-bijak-spm-standards 3.1, 3.1a): effective per-leaf values. A leaf part's TP, unit and form origin
 * are its own override, else the question version's value (`coalesce(part, version)`). The question TP is the
 * maximum over its leaves and marks per unit are summed per leaf; nothing here is stored (no drift).
 * Cognitive level / KBAT is intentionally absent until the KBAT encoding is decided (decision A9).
 */
import { Prisma } from '../../db/generated/client'
import { idToString } from '../../db/ids'

export interface EffectiveLeaf {
  partId: string
  versionId: string
  marks: number
  /** Effective TP 1..6, or null when neither the part nor the version has one. */
  tp: number | null
  /** Effective unit node id (decimal string), or null. */
  unitNodeId: string | null
  formOrigin: 't1_t3' | 't4' | 't5' | null
}

/**
 * The effective-value SQL: one row per leaf part (a leaf is a part with a `mode`) of the given versions.
 * The only place the coalesce rule lives in SQL; pool sources join or reuse this fragment.
 */
export function effectiveLeavesSql(versionIds: readonly bigint[]): Prisma.Sql {
  return Prisma.sql`
    SELECT p.id AS part_id,
           p.question_version_id AS version_id,
           p.marks AS marks,
           coalesce(p.difficulty_tp, v.difficulty_tp) AS tp,
           coalesce(p.unit_node_id, v.unit_node_id) AS unit_node_id,
           coalesce(p.form_origin, v.form_origin) AS form_origin
      FROM question_parts p
      JOIN question_versions v ON v.id = p.question_version_id
     WHERE p.mode IS NOT NULL
       AND p.question_version_id IN (${Prisma.join(versionIds.length > 0 ? [...versionIds] : [BigInt(-1)])})
     ORDER BY p.question_version_id, p.id`
}

/**
 * Bank filter `missing` (15.7): the question has a leaf part lacking the EFFECTIVE value (after inheritance).
 * `unit`: no effective unit and an effective form origin other than t1_t3 (that bucket needs no unit).
 */
export function missingLeafSql(missing: 'unit' | 'tp' | 'marks' | 'key'): Prisma.Sql {
  const lacking =
    missing === 'unit'
      ? Prisma.sql`coalesce(p.unit_node_id, v.unit_node_id) IS NULL AND coalesce(p.form_origin, v.form_origin) IS DISTINCT FROM 't1_t3'`
      : missing === 'tp'
        ? Prisma.sql`coalesce(p.difficulty_tp, v.difficulty_tp) IS NULL`
        : missing === 'marks'
          ? Prisma.sql`(p.marks IS NULL OR p.marks < 1)`
          : Prisma.sql`NOT EXISTS (SELECT 1 FROM answer_keys k WHERE k.part_id = p.id)`
  return Prisma.sql`EXISTS (SELECT 1 FROM question_parts p WHERE p.question_version_id = v.id AND p.mode IS NOT NULL AND ${lacking})`
}

interface EffectiveRow {
  part_id: bigint
  version_id: bigint
  marks: number | null
  tp: number | null
  unit_node_id: bigint | null
  form_origin: string | null
}

export const effectiveLeafOf = (r: EffectiveRow): EffectiveLeaf => ({
  partId: idToString(r.part_id),
  versionId: idToString(r.version_id),
  marks: r.marks ?? 0,
  tp: r.tp,
  unitNodeId: r.unit_node_id === null ? null : idToString(r.unit_node_id),
  formOrigin: r.form_origin === 't1_t3' || r.form_origin === 't4' || r.form_origin === 't5' ? r.form_origin : null,
})

/** Runs the helper against any Prisma client / transaction. */
export async function loadEffectiveLeaves(
  db: Pick<Prisma.TransactionClient, '$queryRaw'>,
  versionIds: readonly bigint[],
): Promise<EffectiveLeaf[]> {
  if (versionIds.length === 0) return []
  const rows = await db.$queryRaw<EffectiveRow[]>(effectiveLeavesSql(versionIds))
  return rows.map(effectiveLeafOf)
}

/** Question TP = maximum effective TP over its leaves; null when no leaf has one. */
export function questionTp(leaves: readonly EffectiveLeaf[]): number | null {
  let best: number | null = null
  for (const l of leaves) if (l.tp !== null && (best === null || l.tp > best)) best = l.tp
  return best
}

/** Marks per effective unit (marks-basis quota); leaves without a unit land under the key `null`. */
export function unitMarks(leaves: readonly EffectiveLeaf[]): Map<string | null, number> {
  const out = new Map<string | null, number>()
  for (const l of leaves) out.set(l.unitNodeId, (out.get(l.unitNodeId) ?? 0) + l.marks)
  return out
}
