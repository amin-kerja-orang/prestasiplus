import type { TestDatabase } from '../support/db'

/** What `bulkMcqs` inserts: one published, active, single-part MCQ (4 text options, key A) per row, one version each. */
export interface BulkSpec {
  count: number
  subjectId: string
  levelId: string
  chapterId?: string | null
  /** Difficulty TP cycles through these values by row (default 1..4). */
  tps?: readonly (number | null)[]
  /** Rows whose index (0-based) is divisible by this get the `pool/spm` tag; 0 or absent = none. */
  poolEvery?: number
  /** Every n-th row is inserted with `is_active = false` (held); 0 or absent = none. */
  heldEvery?: number
  /** Every n-th row is a draft (not published, no live version); 0 or absent = none. */
  draftEvery?: number
  /** Options per question (default 4, labels A..). */
  optionCount?: number
  /** 1-based index of the correct option (default 1 = `A`). */
  keyIndex?: number
  /** `number_label` prefix (also how a fixture is found again). */
  label: string
}

/**
 * Bulk fixture for the draw-path performance tests: a few thousand questions in a handful of SQL statements, so a test can
 * prove a path reads O(n) rows from a bank far bigger than the draw. Returns the ids of the rows that are eligible
 * (published, active) in ascending order.
 */
export async function bulkMcqs(db: TestDatabase, s: BulkSpec): Promise<string[]> {
  const tps = s.tps ?? [1, 2, 3, 4]
  await db.query(
    `WITH rows AS (
       SELECT g AS i FROM generate_series(0, $1::int - 1) g
     ),
     q AS (
       INSERT INTO questions (live_version_no, latest_version_no, is_active)
       SELECT CASE WHEN $8::int > 0 AND i % $8::int = $8::int - 1 THEN NULL ELSE 1 END, 1, NOT ($7::int > 0 AND i % $7::int = $7::int - 1) FROM rows ORDER BY i
       RETURNING id
     ),
     numbered AS (SELECT id, row_number() OVER (ORDER BY id) - 1 AS i FROM q),
     v AS (
       INSERT INTO question_versions (question_id, version_no, status, type, stem_ms, number_label, subject_id, education_level_id, chapter_id, difficulty_tp, published_at)
       SELECT n.id, 1, CASE WHEN $8::int > 0 AND n.i % $8::int = $8::int - 1 THEN 'draft' ELSE 'approved' END, 'mcq',
              'Soalan pukal nombor ' || n.i || ' (' || $2::text || ')', $2::text || '-' || n.i, $3::bigint, $4::bigint, $5::bigint,
              ($6::int[])[1 + (n.i % cardinality($6::int[]))], now()
         FROM numbered n
       RETURNING id, number_label
     ),
     p AS (
       INSERT INTO question_parts (question_version_id, position, depth, label, prompt_ms, marks, mode)
       SELECT id, 1, 1, '1', 'Pilih jawapan yang betul.', 1, 'mcq' FROM v
       RETURNING id
     ),
     o AS (
       INSERT INTO part_options (part_id, label, body_ms, position)
       SELECT p.id, chr(64 + l.pos), 'Pilihan ' || chr(64 + l.pos), l.pos FROM p CROSS JOIN generate_series(1, $10::int) AS l(pos)
       RETURNING 1
     ),
     k AS (
       INSERT INTO answer_keys (part_id, kind, content) SELECT id, 'option', jsonb_build_object('kind', 'option', 'correct', chr(64 + $11::int)) FROM p RETURNING 1
     ),
     t AS (
       INSERT INTO question_tags (question_id, kind, code)
       SELECT n.id, 'pool', 'spm' FROM numbered n WHERE $9::int > 0 AND n.i % $9::int = 0
       RETURNING 1
     )
     SELECT (SELECT count(*) FROM o) + (SELECT count(*) FROM k) + (SELECT count(*) FROM t) AS done`,
    [s.count, s.label, s.subjectId, s.levelId, s.chapterId ?? null, tps, s.heldEvery ?? 0, s.draftEvery ?? 0, s.poolEvery ?? 0, s.optionCount ?? 4, s.keyIndex ?? 1],
  )
  const rows = await db.query<{ id: string }>(
    `SELECT q.id::text FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = 1
      WHERE v.number_label LIKE $1 AND q.is_active AND v.status = 'approved' ORDER BY q.id`,
    [`${s.label}-%`],
  )
  return rows.map((r) => r.id)
}
