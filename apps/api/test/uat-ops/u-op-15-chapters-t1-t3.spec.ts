import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { parseUatArgs } from '../../scripts/uat-ops/lib'
import { chapterLines, COUNTS_SQL, LOWER_LEVELS, SPEC, type ChapterCountRow } from '../../scripts/uat-ops/u-op-15-chapters-t1-t3'
import { createTestDatabase, type TestDatabase } from '../support/db'

/** S4-T08 U-OP-15: Tingkatan 1-3 Bab counts per offered subject (pure lines [CI], SQL on a real database [CI]). */
const row = (subject_code: string, level_code: string, total: number, in_tree: number, active: number): ChapterCountRow => ({ subject_code, level_code, total, in_tree, active })

describe('chapterLines', () => {
  it('passes a pair with active Bab in the tree and fails one with none', () => {
    const lines = chapterLines([row('MATH', 'T1', 4, 3, 3), row('MATH', 'T2', 2, 0, 0), row('SAINS', 'T3', 5, 5, 4)])
    expect(lines.map((l) => l.status)).toEqual(['PASS', 'FAIL', 'PASS', 'INFO'])
    expect(lines[0]?.text).toBe('MATH T1: 3 Bab (all rows 4, in tree 3)')
    expect(lines[1]?.text).toContain('0 Bab in the tree and active')
    expect(lines[3]?.text).toBe('3 subject x level pairs for 2 subjects; 2 with Bab, 1 without')
  })

  it('fails when no subject is offered at T1-T3', () => {
    expect(chapterLines([]).map((l) => l.status)).toEqual(['FAIL'])
  })

  it('is read-only and takes --subject', () => {
    expect(() => parseUatArgs(['--apply'], SPEC)).toThrow('read-only')
    expect(parseUatArgs(['--subject', 'math'], SPEC).values).toEqual({ subject: 'math' })
  })
})

describe('COUNTS_SQL (database)', () => {
  let db: TestDatabase
  let client: pg.Client
  beforeAll(async () => {
    db = await createTestDatabase()
    await db.query(`INSERT INTO education_levels(code,name,name_en,stage,curriculum,sort_order,is_active,grade) VALUES
      ('T1','Tingkatan 1','Form 1','lower_secondary','KSSM',7,true,7),('T2','Tingkatan 2','Form 2','lower_secondary','KSSM',8,true,8),
      ('T4','Tingkatan 4','Form 4','upper_secondary','KSSM',10,true,10),('D1','Darjah 1','Year 1','primary','KSSR',1,false,1)`)
    await db.query(`INSERT INTO subjects(code,name,name_en,color,sort_order) VALUES ('MATH','Matematik','Mathematics','#fff',1),('SAINS','Sains','Science','#fff',2),('OFF','Tidak aktif','Off','#fff',3)`)
    await db.query(`UPDATE subjects SET is_active = false WHERE code = 'OFF'`)
    await db.query(`INSERT INTO subject_levels(subject_id,education_level_id) SELECT s.id,l.id FROM subjects s, education_levels l`)
    // MATH T1: 3 Bab in the tree + 1 hidden + 1 inactive; SAINS T2: one Bab not in the tree only; OFF (inactive) has Bab but is never offered.
    await db.query(`INSERT INTO chapters(subject_id,education_level_id,name,in_tree,is_active) SELECT s.id,l.id,n,t,a FROM subjects s, education_levels l,
      (VALUES ('a',true,true),('b',true,true),('c',true,true),('d',false,true),('e',true,false)) AS v(n,t,a) WHERE s.code='MATH' AND l.code='T1'`)
    await db.query(`INSERT INTO chapters(subject_id,education_level_id,name,in_tree,is_active) SELECT s.id,l.id,'x',false,true FROM subjects s, education_levels l WHERE s.code='SAINS' AND l.code='T2'`)
    await db.query(`INSERT INTO chapters(subject_id,education_level_id,name) SELECT s.id,l.id,'y' FROM subjects s, education_levels l WHERE s.code='OFF' AND l.code='T1'`)
    client = new pg.Client({ connectionString: db.url })
    await client.connect()
  })
  afterAll(async () => {
    await client.end()
    await db.drop()
  })

  it('counts Bab per offered subject x T1-T3, ignoring T4, Darjah and inactive subjects', async () => {
    const rows = (await client.query<ChapterCountRow>(COUNTS_SQL, [[...LOWER_LEVELS], null])).rows
    expect(rows).toEqual([
      row('MATH', 'T1', 5, 4, 3),
      row('MATH', 'T2', 0, 0, 0),
      row('SAINS', 'T1', 0, 0, 0),
      row('SAINS', 'T2', 1, 0, 0),
    ])
    expect(chapterLines(rows).filter((l) => l.status === 'FAIL')).toHaveLength(3)
  })

  it('filters by subject code', async () => {
    const rows = (await client.query<ChapterCountRow>(COUNTS_SQL, [[...LOWER_LEVELS], 'SAINS'])).rows
    expect(rows.map((r) => `${r.subject_code} ${r.level_code}`)).toEqual(['SAINS T1', 'SAINS T2'])
  })

  it('cannot write: a read-only transaction refuses an insert (the script runs inside one)', async () => {
    await client.query('BEGIN READ ONLY')
    await expect(client.query(`INSERT INTO chapters(subject_id,name) VALUES (1,'z')`)).rejects.toThrow(/read-only/)
    await client.query('ROLLBACK')
  })
})
