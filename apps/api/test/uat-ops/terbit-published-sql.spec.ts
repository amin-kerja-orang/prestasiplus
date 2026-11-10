import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** terbit-published.sql (rebuild-db.sh step 14, only with --terbit): published / held / refused counts of the V2-published papers [CI, real database]. */
const SQL = readFileSync(join(resolve(__dirname, '../..'), 'scripts/uat-ops/terbit-published.sql'), 'utf8')

describe('terbit-published.sql', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
    await db.query(`CREATE SCHEMA staging_cloud; CREATE SCHEMA archive_cloud;
      CREATE TABLE staging_cloud.paper_statuses (id int PRIMARY KEY, slug text);
      CREATE TABLE archive_cloud.exam_papers (id bigint PRIMARY KEY, status_id int);
      INSERT INTO staging_cloud.paper_statuses VALUES (1, 'published'), (2, 'draft');
      INSERT INTO subjects(code,name,name_en,color,sort_order) VALUES ('MATH','Matematik','Mathematics','#fff',1)`)
  })
  afterAll(async () => {
    await db.drop()
  })

  const rows = async (): Promise<string[]> => (await db.query<{ '?column?': string }>(SQL)).map((r) => r['?column?'])
  const paper = (title: string, status: string, v2: number, v2status: number) =>
    db.query(
      `WITH p AS (INSERT INTO papers (kind, title, subject_id, kertas, printed_duration_min, surface, status, version, legacy_untimed)
         SELECT 'pilihan', $1, s.id, 1, 0, 'simulasi', $2, 1, true FROM subjects s WHERE s.code = 'MATH' RETURNING id),
       a AS (INSERT INTO archive_cloud.exam_papers (id, status_id) VALUES ($3, $4))
       INSERT INTO etl_id_map (legacy_source, entity, legacy_id, new_id) SELECT 'cloud', 'exam_papers', $3::text, id::text FROM p`,
      [title, status, v2, v2status],
    )

  it('FAILs when no V2-published paper is loaded (Terbit did not run or nothing mapped)', async () => {
    const out = await rows()
    expect(out[0]).toBe('T1 | V2-published papers loaded | 0 | > 0 | FAIL')
  })

  it('counts published, held and gate-refused papers; a V2 draft is not counted', async () => {
    await paper('P1', 'published', 101, 1)
    await paper('P2', 'published', 102, 1)
    await paper('P3', 'draft', 103, 1) // refused by the gate
    await paper('P4', 'draft', 104, 1) // held at load
    await paper('P5', 'draft', 105, 2) // a V2 draft: not part of the check
    await db.query(`INSERT INTO etl_id_map (legacy_source, entity, legacy_id, new_id) VALUES ('cloud', 'exam_paper_holds', '104', 'kertas_unknown')`)
    expect(await rows()).toEqual([
      'T1 | V2-published papers loaded | 4 | > 0 | info',
      'T2 | published in V3 after Terbit | 2 | 3 | FAIL',
      'T3 | still draft: held at load (group_split, kertas_unknown) | 1 | - | info',
      'T4 | still draft: refused by the Terbit gate | 1 | 0 | FAIL',
    ])
  })

  it('PASSes when everything not held is published', async () => {
    await db.query(`UPDATE papers SET status = 'published' WHERE title = 'P3'`)
    const out = await rows()
    expect(out[1]).toBe('T2 | published in V3 after Terbit | 3 | 3 | PASS')
    expect(out[3]).toBe('T4 | still draft: refused by the Terbit gate | 0 | 0 | PASS')
  })
})
