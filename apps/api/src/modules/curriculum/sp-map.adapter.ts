import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../db/generated/client'
import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import type { SpMapPort, SpSubjectTree, SpTagRow } from '../reports/performance/ports/sp-map.port'

/**
 * The real `SpMapPort` of Analitik Adaptif (S10-T04 part 3, R1-MUR-5; #924). It is read-only: plain `$queryRaw`
 * reads, and it writes nothing.
 *
 * - `spTree`: every active subject that has `curriculum_nodes` of kind `sp` at the level, in the curriculum order
 *   (`subjects.sort_order`, then id). Its SP nodes come in DSKP order, which is the depth-first order of the node
 *   tree by `sort_order` then id, numbered 1..n per subject. The strand is the title of the SP's nearest `unit`
 *   ancestor (Tajuk DSKP, e.g. "Kemahiran Membaca", "Ubahan"), or else its nearest `sk`, or null. A level with no
 *   SP nodes (T1-T3 hold units only, D115) or a null level yields no subject.
 * - `spOf`: the SP tags (`question_version_sp_nodes`) of each question's latest approved version. A question
 *   tagged only to a Bab, or with no approved version, has no row (AC-MUR-DK-3). "Latest approved" is chosen on
 *   purpose, as the port documents it: it equals `questions.live_version_no` for normal data. `spOf` does not filter by
 *   level or subject; the consumer counts only tags whose SP is in the level's tree.
 *
 * Bound as `SP_MAP_PORT` by `CurriculumModule`. `PerformanceModule` imports that module, so `PerformancePorts`
 * picks the adapter up through its optional `SP_MAP_PORT` injection.
 */
@Injectable()
export class CurriculumSpMapAdapter implements SpMapPort {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  /** A malformed id matches nothing (0 is never a row id). */
  private one(id: string): bigint {
    try {
      return idFromString(id)
    } catch {
      return 0n
    }
  }

  async spTree(query: { levelId: string | null }): Promise<SpSubjectTree[]> {
    if (query.levelId === null) return []
    const level = this.one(query.levelId)
    const rows = await this.db.$queryRaw<
      { subjectId: bigint; subjectCode: string; subjectName: string; spNodeId: bigint; code: string; title: string; strand: string | null; ord: bigint }[]
    >`
      WITH RECURSIVE tree AS (
        SELECT n.id, n.subject_id, n.kind, n.code, n.title, n.parent_id,
               ARRAY[n.sort_order::bigint, n.id] AS path,
               CASE WHEN n.kind = 'unit' THEN n.title END AS unit_title,
               CASE WHEN n.kind = 'sk' THEN n.title END AS sk_title
          FROM curriculum_nodes n
         WHERE n.education_level_id = ${level} AND n.parent_id IS NULL
        UNION ALL
        SELECT c.id, c.subject_id, c.kind, c.code, c.title, c.parent_id,
               t.path || ARRAY[c.sort_order::bigint, c.id],
               CASE WHEN c.kind = 'unit' THEN c.title ELSE t.unit_title END,
               CASE WHEN c.kind = 'sk' THEN c.title ELSE t.sk_title END
          FROM curriculum_nodes c
          JOIN tree t ON t.id = c.parent_id
      )
      SELECT s.id AS "subjectId", s.code AS "subjectCode", s.name AS "subjectName",
             t.id AS "spNodeId", t.code, t.title, coalesce(t.unit_title, t.sk_title) AS strand,
             row_number() OVER (PARTITION BY t.subject_id ORDER BY t.path) AS ord
        FROM tree t
        JOIN subjects s ON s.id = t.subject_id
       WHERE t.kind = 'sp' AND s.is_active = true
       ORDER BY s.sort_order, s.id, ord`
    const out: SpSubjectTree[] = []
    for (const r of rows) {
      const subjectId = idToString(r.subjectId)
      let subject = out[out.length - 1]
      if (subject?.subjectId !== subjectId) {
        subject = { subjectId, subjectCode: r.subjectCode, subjectName: r.subjectName, nodes: [] }
        out.push(subject)
      }
      subject.nodes.push({ spNodeId: idToString(r.spNodeId), code: r.code, title: r.title, strand: r.strand, sortOrder: Number(r.ord) })
    }
    return out
  }

  async spOf(questionIds: readonly string[]): Promise<SpTagRow[]> {
    const ids = [...new Set(questionIds.map((q) => this.one(q)).filter((q) => q !== 0n))]
    if (ids.length === 0) return []
    const rows = await this.db.$queryRaw<{ questionId: bigint; spNodeId: bigint }[]>`
      SELECT v.question_id AS "questionId", qs.node_id AS "spNodeId"
        FROM (
          SELECT DISTINCT ON (question_id) id, question_id
            FROM question_versions
           WHERE question_id IN (${Prisma.join(ids)}) AND status = 'approved'
           ORDER BY question_id, version_no DESC
        ) v
        JOIN question_version_sp_nodes qs ON qs.question_version_id = v.id
        JOIN curriculum_nodes n ON n.id = qs.node_id AND n.kind = 'sp'
       ORDER BY v.question_id, qs.node_id`
    return rows.map((r) => ({ questionId: idToString(r.questionId), spNodeId: idToString(r.spNodeId) }))
  }
}
