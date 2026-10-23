/**
 * Snapshot-dims helper (BE-29, v2-data-migration.md 3.3): the one place that reads the archived question bank
 * (`archive_cloud`) for the practice-answer snapshot. For each legacy question id it returns the curriculum ids,
 * difficulty, type, source-paper key and the content hash (SHA-256 of the normalised stem and sorted options).
 * The stem and the option texts are read here only to be hashed: they never leave this function and are never
 * logged, stored or returned.
 */
import { ARCHIVE_SCHEMA } from '../ddl/spec'
import { quoteIdent } from '../kit/sql'
import type { SqlExecutor } from '../kit/types'
import { contentHash } from './content-hash'
import type { RawDims } from './dims'

export { contentHash, normaliseText } from './content-hash'
export { mapQuestionType, parseDifficulty, QUESTION_TYPE_MAP, resolveSnapshot, type DimMaps, type RawDims, type ResolvedDims } from './dims'

const A = quoteIdent(ARCHIVE_SCHEMA)

/**
 * One row per question that exists in the archive. The paper key and number label come from the canonical bridge
 * (`legacy_canonical_map` source `questions` -> `exam_questions`) and, for the key, the lowest-numbered canonical paper
 * that contains the question. Nothing here is a join on free text.
 */
export const SNAPSHOT_SQL = `
SELECT q.id::text AS id,
       q.subject_id::text AS subject_id, q.education_level_id::text AS education_level_id,
       q.chapter_id::text AS chapter_id, q.topic_id::text AS topic_id,
       q.difficulty_level::text AS difficulty, q.question_type::text AS qtype,
       q.body::text AS stem,
       coalesce((SELECT array_agg(o.body::text ORDER BY o.id) FROM ${A}."question_options" o WHERE o.question_id = q.id), ARRAY[]::text[]) AS options,
       k.natural_key AS natural_key, k.number_label AS number_label
FROM ${A}."questions" q
LEFT JOIN LATERAL (
  SELECT eq.number_label::text AS number_label,
         (SELECT sp.natural_key::text
          FROM ${A}."exam_paper_questions" epq
          JOIN ${A}."exam_papers" ep ON ep.id = epq.exam_paper_id
          JOIN ${A}."source_papers" sp ON sp.id = ep.source_paper_id
          WHERE epq.exam_question_id = eq.id
          ORDER BY ep.id LIMIT 1) AS natural_key
  FROM ${A}."legacy_canonical_map" m
  JOIN ${A}."exam_questions" eq ON eq.id = m.canonical_id
  WHERE m.source = 'questions' AND m.legacy_id = q.id::text AND m.canonical_type = 'exam_question'
  ORDER BY m.id LIMIT 1
) k ON true
WHERE q.id = ANY($1::bigint[])`

interface SnapshotRow {
  id: string
  subject_id: string | null
  education_level_id: string | null
  chapter_id: string | null
  topic_id: string | null
  difficulty: string | null
  qtype: string | null
  stem: string | null
  options: string[] | null
  natural_key: string | null
  number_label: string | null
}

/** Reads the dimensions of `questionIds` (.cloud ids as text); questions that are not in the archive are absent. */
export async function readSnapshotDims(db: SqlExecutor, questionIds: readonly string[]): Promise<Map<string, RawDims>> {
  const out = new Map<string, RawDims>()
  const ids = [...new Set(questionIds.filter((id) => /^\d{1,18}$/.test(id)))]
  if (ids.length === 0) return out
  const res = await db.query<SnapshotRow>(SNAPSHOT_SQL, [ids])
  for (const r of res.rows) {
    out.set(r.id, {
      legacyQuestionId: r.id,
      subjectId: r.subject_id,
      levelId: r.education_level_id,
      chapterId: r.chapter_id,
      topicId: r.topic_id,
      difficultyRaw: r.difficulty,
      typeRaw: r.qtype,
      // The text is hashed here and dropped; only the digest leaves the helper.
      contentHash: contentHash(r.stem, r.options ?? []),
      sourceNaturalKey: r.natural_key,
      numberLabel: r.number_label,
    })
  }
  return out
}
