import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { parseUatArgs } from '../../scripts/uat-ops/lib'
import { collectLeftovers, leftoverLines, MAX_IDS_SHOWN, SPEC, type Found } from '../../scripts/uat-ops/u-op-14-uji-leftovers'
import { createTestDatabase, type TestDatabase } from '../support/db'

/** S4-T08 U-OP-14: leftover `UJI ` rows (pure lines [CI], queries on a real database [CI]). */
const none = (label: string): Found => ({ label, ids: [] })

describe('leftoverLines', () => {
  it('passes when nothing is found', () => {
    expect(leftoverLines([none('papers')], [none('questions')]).map((l) => l.status)).toEqual(['PASS', 'PASS'])
  })

  it('lists ids per source and fails once for the prefix and once for the QA rows', () => {
    const lines = leftoverLines([{ label: 'chapters (Bab)', ids: ['9'] }, none('papers'), { label: 'users', ids: ['4', '5'] }], [{ label: 'papers', ids: ['6', '7'] }])
    expect(lines.map((l) => l.status)).toEqual(['INFO', 'INFO', 'FAIL', 'INFO', 'FAIL'])
    expect(lines[0]?.text).toBe('chapters (Bab): 1 with the "UJI" prefix, ids 9')
    expect(lines[2]?.text).toContain('3 "UJI" records in 2 places')
    expect(lines[3]?.text).toContain('QA papers still present, ids 6, 7')
  })

  it('caps the id list', () => {
    const ids = Array.from({ length: MAX_IDS_SHOWN + 5 }, (_, i) => String(i + 1))
    expect(leftoverLines([{ label: 'topics', ids }], [])[0]?.text).toContain(`... (+5)`)
  })

  it('is read-only', () => {
    expect(() => parseUatArgs(['--apply'], SPEC)).toThrow('read-only')
  })
})

describe('collectLeftovers (database)', () => {
  let db: TestDatabase
  let client: pg.Client
  beforeAll(async () => {
    db = await createTestDatabase()
    await db.query(`INSERT INTO subjects(code,name,name_en,color) VALUES ('MATH','Matematik','Mathematics','#fff')`)
    await db.query(`INSERT INTO education_levels(code,name,name_en,stage,curriculum,grade) VALUES ('T4','Tingkatan 4','Form 4','upper_secondary','KSSM',10)`)
    // chapters: a UJI Bab, a Bab that merely contains "UJI " later, a Bab with "UJIAN" (no space), a lower-case "uji ".
    await db.query(`INSERT INTO chapters(subject_id,education_level_id,name) SELECT s.id,l.id,n FROM subjects s, education_levels l,
      (VALUES ('UJI Rantaian'),('Bab UJI di tengah'),('UJIAN akhir'),('uji kecil')) AS v(n) WHERE s.code='MATH' AND l.code='T4'`)
    await db.query(`INSERT INTO schools(name,type) VALUES ('UJI Sekolah Ujian Fiksyen','SMK'),('Sekolah Biasa','SMK')`)
    client = new pg.Client({ connectionString: db.url })
    await client.connect()
  })
  afterAll(async () => {
    await client.end()
    await db.drop()
  })

  it('finds only names that start with "UJI " and reports ids, never names', async () => {
    const { uji, qa } = await collectLeftovers(client)
    const by = (label: string): string[] => uji.find((f) => f.label === label)?.ids ?? ['missing']
    expect(by('chapters (Bab)')).toHaveLength(1)
    expect(by('schools')).toHaveLength(1)
    expect(by('papers')).toEqual([])
    expect(by('users')).toEqual([])
    expect(qa.every((f) => f.ids.length === 0)).toBe(true)
    const text = leftoverLines(uji, qa).map((l) => l.text).join('\n')
    expect(text).not.toContain('Rantaian')
    expect(text).not.toContain('Sekolah')
  })

  it('finds a known QA paper id when it exists', async () => {
    const found = await db.query<{ id: string }>(`SELECT id::text FROM subjects LIMIT 1`)
    expect(found).toHaveLength(1)
    await db.query(`INSERT INTO papers(id, kind, title, subject_id, kertas, printed_duration_min) OVERRIDING SYSTEM VALUE VALUES (7, 'pilihan', 'Kertas ujian', ${found[0]!.id}, 1, 60)`)
    const { qa } = await collectLeftovers(client)
    expect(qa.find((f) => f.label === 'papers')?.ids).toEqual(['7'])
  })
})
