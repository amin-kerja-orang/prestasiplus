/**
 * The set-based `SNAPSHOT_SQL` (AM-08c) against the correlated form it replaced, on a real PostgreSQL: for planted
 * archive rows with ties, NULLs and rows the joins must ignore, both queries return the same rows, and
 * `readSnapshotDims` returns the same dims with and without its per-run cache. Fictitious values; ids from 9201 up.
 *
 * Planted questions:
 *   9201  two options (inserted out of id order); two canonical rows (the lower map id wins); its exam question is on
 *         two papers (the lower paper id wins)
 *   9202  no options; a canonical row of another type and one of another source (both ignored)
 *   9203  canonical exam question on no paper (natural key null, number label kept)
 *   9204  canonical exam question with a null number label, on a paper whose source paper has a null key
 *   9205  canonical row pointing at an exam question that does not exist (dropped by the inner join)
 *   9299  not in the archive (absent)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ARCHIVE_SCHEMA } from '../../../src/migration/ddl/spec'
import { quoteIdent } from '../../../src/migration/kit/sql'
import { readSnapshotDims, SNAPSHOT_SQL, type RawDims } from '../../../src/migration/snapshot-dims'
import { bootActivity, type ActivityHarness } from './helpers'

const A = quoteIdent(ARCHIVE_SCHEMA)

/** The correlated form before AM-08c, kept here as the reference. */
const REFERENCE_SQL = `
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

const IDS = ['9201', '9202', '9203', '9204', '9205', '9299']

let h: ActivityHarness

beforeAll(async () => {
  h = await bootActivity()
  await h.q(
    `insert into archive_cloud.questions (id, subject_id, education_level_id, chapter_id, topic_id, difficulty_level, question_type, status, body) values
       (9201, 1, 1, 1, 1, '3', 'objektif', 'diluluskan', 'Soalan penanda 9201'),
       (9202, 2, 2, null, null, null, 'objektif', 'diluluskan', 'Soalan penanda 9202'),
       (9203, 1, 2, 1, null, '2', 'objektif', 'diluluskan', 'Soalan penanda 9203'),
       (9204, null, null, null, null, null, 'objektif', 'diluluskan', 'Soalan penanda 9204'),
       (9205, 1, 1, null, null, '1', 'objektif', 'diluluskan', 'Soalan penanda 9205')`,
  )
  await h.q(
    `insert into archive_cloud.question_options (id, question_id, label, body, is_correct) values
       (9212, 9201, 'B', 'Pilihan kedua', '0'), (9211, 9201, 'A', 'Pilihan pertama', '1')`,
  )
  await h.q(
    `insert into archive_cloud.source_papers (id, natural_key, content_hash, year) values
       (9401, 'KERTAS-B', null, 2024), (9402, 'KERTAS-A', null, 2023), (9403, null, null, 2022)`,
  )
  await h.q(
    `insert into archive_cloud.exam_papers (id, source_paper_id, status, title) values
       (9502, 9401, 'diterbitkan', 'Kertas kemudian'), (9501, 9402, 'diterbitkan', 'Kertas awal'),
       (9503, 9403, 'diterbitkan', 'Kertas tanpa kunci')`,
  )
  await h.q(
    `insert into archive_cloud.exam_questions (id, status, number_label) values
       (9601, 'diterbitkan', '1(a)'), (9602, 'diterbitkan', '9'), (9603, 'diterbitkan', '3'), (9604, 'diterbitkan', null)`,
  )
  await h.q(
    `insert into archive_cloud.exam_paper_questions (id, exam_paper_id, exam_question_id, paper_section_id) values
       (9701, 9502, 9601, null), (9702, 9501, 9601, null), (9703, 9503, 9604, null)`,
  )
  await h.q(
    `insert into archive_cloud.legacy_canonical_map (id, source, legacy_id, canonical_type, canonical_id) values
       (9802, 'questions', '9201', 'exam_question', 9602),
       (9801, 'questions', '9201', 'exam_question', 9601),
       (9803, 'questions', '9202', 'other_type', 9601),
       (9804, 'other_source', '9202', 'exam_question', 9601),
       (9805, 'questions', '9203', 'exam_question', 9603),
       (9806, 'questions', '9204', 'exam_question', 9604),
       (9807, 'questions', '9205', 'exam_question', 9699)`,
  )
}, 300_000)

afterAll(async () => {
  await h?.close()
})

const sorted = (rows: Record<string, unknown>[]): Record<string, unknown>[] =>
  [...rows].sort((x, y) => String(x.id).localeCompare(String(y.id)))

describe('SNAPSHOT_SQL (set-based) against the correlated reference', () => {
  it('returns the same rows, with the documented tie-breaks and NULLs', async () => {
    const now = sorted(await h.q(SNAPSHOT_SQL, [IDS]))
    const ref = sorted(await h.q(REFERENCE_SQL, [IDS]))
    expect(now).toEqual(ref)
    const byId = new Map(now.map((r) => [String(r.id), r]))
    expect([...byId.keys()]).toEqual(['9201', '9202', '9203', '9204', '9205'])
    expect(byId.get('9201')).toMatchObject({ options: ['Pilihan pertama', 'Pilihan kedua'], natural_key: 'KERTAS-A', number_label: '1(a)' })
    expect(byId.get('9202')).toMatchObject({ options: [], natural_key: null, number_label: null })
    expect(byId.get('9203')).toMatchObject({ natural_key: null, number_label: '3' })
    expect(byId.get('9204')).toMatchObject({ natural_key: null, number_label: null })
    expect(byId.get('9205')).toMatchObject({ natural_key: null, number_label: null })
  })

  it('readSnapshotDims gives the same dims with and without the per-run cache', async () => {
    const cache = new Map<string, RawDims | null>()
    const plain = await readSnapshotDims(h.env.pool, IDS)
    const first = await readSnapshotDims(h.env.pool, IDS.slice(0, 3), cache)
    const second = await readSnapshotDims(h.env.pool, IDS, cache)
    expect(new Map([...second].sort())).toEqual(new Map([...plain].sort()))
    expect([...first.keys()].sort()).toEqual(['9201', '9202', '9203'])
    expect(cache.get('9299')).toBeNull()
  })
})
