/**
 * BJS-07 (v2-bijak-spm-standards 4.2, 14, 15.5): candidate facts of the Bijak standard pool, read from the
 * question bank (M04 owns the tables; Bijak reads them only through this class).
 *
 * One candidate = one active question whose LIVE version is `approved` and tagged with the subject, not PKSK, and not of a
 * Darjah or inactive level (R1-B21, secondary-only D72/D86: the shared `LEARNER_LEVEL_SQL`).
 * `tag_review` questions are returned too: they are counted as excluded by exam-core (`eligibilityOf`), never silently dropped,
 * so `publishedTotal = eligibleTotal + excluded.total`. The effective per-leaf values come from
 * `effective-leaf.ts` (BJS-06), the only place the coalesce rule lives; this class adds what exam-core
 * needs on top: leaf mode, key presence, unit level/code, pool tags and stimulus group size.
 *
 * Cost: 4 round trips independent of pool size plus one effective-values query per 5000 versions
 * (bound parameters stay far below the driver limit). Nothing is read per question.
 */
import { Inject, Injectable } from '@nestjs/common'
import type { FormOrigin, LeafFact, QuestionFacts, UnitFact } from '@pp/exam-core'

import { idFromString, idToString, isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { loadEffectiveLeaves, type EffectiveLeaf } from './effective-leaf'
import { LEARNER_LEVEL_SQL, NOT_PKSK_SQL } from './learner-visibility'

const CHUNK = 5000

interface QuestionRow {
  question_id: bigint
  group_id: bigint | null
  group_position: number | null
  version_id: bigint
  version_no: number
  tag_review: boolean
  unit_node_id: bigint | null
  form_origin: string | null
  pools: string[] | null
}

interface PartRow {
  part_id: bigint
  mode: string | null
  has_key: boolean
}

interface UnitRow {
  id: bigint
  code: string
  level: string
}

const formOriginOf = (v: string | null): FormOrigin => (v === 't1_t3' || v === 't5' ? v : 't4')

function chunked<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

@Injectable()
export class QuestionsBijakPoolSource {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Facts of every published, active question of a curriculum subject (decimal-string id), in question id order. */
  async candidatesOf(subjectId: string): Promise<QuestionFacts[]> {
    if (!isIdString(subjectId)) return []
    const db = this.prisma.client
    const rows = await db.$queryRaw<QuestionRow[]>`
      SELECT q.id AS question_id, q.group_id, q.group_position,
             v.id AS version_id, v.version_no, v.tag_review, v.unit_node_id, v.form_origin,
             (SELECT array_agg(t.code ORDER BY t.code) FROM question_tags t WHERE t.question_id = q.id AND t.kind = 'pool') AS pools
        FROM questions q
        JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
       WHERE q.is_active AND v.status = 'approved' AND v.subject_id = ${idFromString(subjectId)}
         AND ${NOT_PKSK_SQL} AND ${LEARNER_LEVEL_SQL}
       ORDER BY q.id`
    if (rows.length === 0) return []

    const versionIds = rows.map((r) => r.version_id)
    const groupIds = [...new Set(rows.flatMap((r) => (r.group_id === null ? [] : [r.group_id])))]

    const leaves: EffectiveLeaf[] = []
    const parts: PartRow[] = []
    for (const ids of chunked(versionIds, CHUNK)) {
      leaves.push(...(await loadEffectiveLeaves(db, ids)))
      parts.push(
        ...(await db.$queryRaw<PartRow[]>`
          SELECT p.id AS part_id, p.mode, EXISTS (SELECT 1 FROM answer_keys k WHERE k.part_id = p.id) AS has_key
            FROM question_parts p
           WHERE p.mode IS NOT NULL AND p.question_version_id = ANY(${ids}::bigint[])`),
      )
    }
    const unitIds = [
      ...new Set([
        ...rows.flatMap((r) => (r.unit_node_id === null ? [] : [r.unit_node_id])),
        ...leaves.flatMap((l) => (l.unitNodeId === null ? [] : [BigInt(l.unitNodeId)])),
      ]),
    ]
    const [unitRows, sizeRows] = await Promise.all([
      unitIds.length === 0
        ? Promise.resolve<UnitRow[]>([])
        : db.$queryRaw<UnitRow[]>`
            SELECT n.id, n.code, l.code AS level
              FROM curriculum_nodes n JOIN education_levels l ON l.id = n.education_level_id
             WHERE n.id = ANY(${unitIds}::bigint[])`,
      groupIds.length === 0
        ? Promise.resolve<{ group_id: bigint; n: number }[]>([])
        : db.$queryRaw<{ group_id: bigint; n: number }[]>`
            SELECT q.group_id, count(*)::int AS n
              FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
             WHERE q.group_id = ANY(${groupIds}::bigint[]) AND v.status <> 'archived' GROUP BY q.group_id`,
    ])

    // A unit is a DSKP unit of Tingkatan 4 or 5; anything else (a missing node, another level) counts as no unit.
    const units = new Map<string, UnitFact>()
    for (const u of unitRows) {
      if (u.level === 'T4' || u.level === 'T5') units.set(idToString(u.id), { nodeId: idToString(u.id), level: u.level, code: u.code })
    }
    const unitOf = (id: bigint | string | null): UnitFact | null => (id === null ? null : (units.get(typeof id === 'string' ? id : idToString(id)) ?? null))
    const partInfo = new Map(parts.map((p) => [idToString(p.part_id), p]))
    const leavesByVersion = new Map<string, EffectiveLeaf[]>()
    for (const l of leaves) {
      const list = leavesByVersion.get(l.versionId)
      if (list) list.push(l)
      else leavesByVersion.set(l.versionId, [l])
    }
    const groupSize = new Map(sizeRows.map((r) => [idToString(r.group_id), r.n]))

    return rows.map((r): QuestionFacts => {
      const leafFacts = (leavesByVersion.get(idToString(r.version_id)) ?? []).map((l): LeafFact => {
        const info = partInfo.get(l.partId)
        return {
          marks: l.marks,
          mode: info?.mode ?? null,
          tp: l.tp,
          kbat: l.kbat !== null,
          hasKey: info?.has_key ?? false,
          unit: unitOf(l.unitNodeId),
          ...(l.formOrigin ? { formOrigin: l.formOrigin } : {}),
        }
      })
      const groupId = r.group_id === null ? null : idToString(r.group_id)
      return {
        id: idToString(r.question_id),
        groupId,
        groupPosition: r.group_position,
        ...(groupId !== null ? { groupSize: groupSize.get(groupId) ?? 1 } : {}),
        versionNo: r.version_no,
        tagReview: r.tag_review,
        unit: unitOf(r.unit_node_id),
        formOrigin: formOriginOf(r.form_origin),
        pools: r.pools ?? [],
        leaves: leafFacts,
      }
    })
  }
}
