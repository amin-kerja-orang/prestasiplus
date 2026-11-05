import { readFileSync } from 'node:fs'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { LoadReport } from '../../src/modules/curriculum/dskp/dskp-load'
import { parseUatArgs } from '../../scripts/uat-ops/lib'
import {
  collectVerification,
  loadLines,
  SPEC,
  verificationLines,
  type CountRow,
  type SanityResult,
} from '../../scripts/uat-ops/u-op-01-dskp-dry-run'
import { createTestDatabase, type TestDatabase } from '../support/db'

/** S4-T08 U-OP-01: the DSKP loader wrapper (pure lines [CI], SELECTs on a real database [CI]); the loader itself is covered by its own specs. */
const nodes = (inserted: number, unchanged = 0, drift = 0) => ({ inserted, updated: 0, unchanged, drift })
const subject = (code: string, over: Partial<LoadReport['subjects'][number]> = {}): LoadReport['subjects'][number] => ({
  code,
  name: code,
  files: [`${code.toLowerCase()}.json`],
  status: 'ok',
  error: null,
  levels: [{ level: 'T4', nodes: nodes(10, 1, 2), tps: { inserted: 5, unchanged: 3 } }],
  rejected: [],
  ignored: [],
  notes: [],
  createdSubject: false,
  ...over,
})
const report = (over: Partial<LoadReport> = {}): LoadReport => ({ dryRun: true, sources: [{ file: 'a.json', sha256: 'x' }], subjects: [subject('MATH')], unassigned: [], ...over })

describe('loadLines', () => {
  it('prints one INFO line per subject x level and a PASS summary', () => {
    const lines = loadLines(report({ subjects: [subject('MATH'), subject('SAINS', { levels: [{ level: 'T5', nodes: nodes(0, 8), tps: { inserted: 0, unchanged: 4 } }] })] }))
    expect(lines[0]).toEqual({ status: 'INFO', text: 'MATH T4: nodes insert 10 / same 1 / drift 2, TP descriptors insert 5 / same 3' })
    expect(lines[1]?.text).toBe('SAINS T5: nodes insert 0 / same 8 / drift 0, TP descriptors insert 0 / same 4')
    expect(lines.filter((l) => l.status === 'FAIL')).toEqual([])
    expect(lines.find((l) => l.status === 'PASS')?.text).toBe('loader dry run: 2 subjects from 1 files, none failed')
    expect(lines.at(-1)?.text).toBe('would insert 10 nodes and 5 TP descriptors (0 on a second run after the real load)')
  })

  it('fails a failed subject and an unassigned file', () => {
    const lines = loadLines(report({ subjects: [subject('MATH', { status: 'failed', error: 'level T9 missing', levels: [] })], unassigned: [{ file: 'x.json', error: 'no subject' }] }))
    expect(lines.filter((l) => l.status === 'FAIL').map((l) => l.text)).toEqual([
      'MATH: the dry run failed, nothing would be written (level T9 missing)',
      'x.json: not assigned to a subject (no subject)',
      'loader dry run: 1 subjects failed, 1 files unassigned',
    ])
  })
})

describe('verificationLines', () => {
  const row = (subject_code: string, level_code: string, n: number): CountRow => ({ subject_code, level_code, nodes: n, bab: n ? 2 : 0, sk: n ? 3 : 0, sp: n ? 5 : 0, tp: n ? 7 : 0, tp_general: 0 })
  const clean: SanityResult = { orphans: 0, emptyEdition: 0, tpOutside: 0, levels: ['T4', 'T5'] }

  it('lists dimuatkan and belum dimuatkan pairs as INFO and passes a clean database', () => {
    const lines = verificationLines([row('MATH', 'T4', 10), row('MATH', 'T1', 0)], clean)
    expect(lines.slice(0, 2).map((l) => l.text)).toEqual([
      'MATH T4: dimuatkan, nodes 10 (Bab 2, SK 3, SP 5), TP descriptors 7, general TP 0',
      'MATH T1: belum dimuatkan (no DSKP nodes yet)',
    ])
    expect(lines[2]?.text).toBe('2 offered subject x level pairs: 1 dimuatkan, 1 belum dimuatkan')
    expect(lines.filter((l) => l.status === 'FAIL')).toEqual([])
    expect(lines.filter((l) => l.status === 'PASS')).toHaveLength(4)
  })

  it('fails each sanity check that is not 0 and a level outside T1-T5', () => {
    const lines = verificationLines([], { orphans: 1, emptyEdition: 2, tpOutside: 3, levels: ['T4', 'D1'] })
    expect(lines.filter((l) => l.status === 'FAIL').map((l) => l.text)).toEqual([
      'nodes whose parent is missing: 1, expected 0',
      'nodes with an empty edition: 2, expected 0',
      'TP descriptors outside TP 1-6: 3, expected 0',
      'nodes exist at levels outside T1, T2, T3, T4, T5: D1',
    ])
  })

  it('accepts T1-T3 nodes (the runbook line "T4, T5 only" is stale after S4-T09)', () => {
    expect(verificationLines([], { ...clean, levels: ['T1', 'T2', 'T3', 'T4', 'T5'] }).some((l) => l.status === 'FAIL')).toBe(false)
  })
})

describe('the wrapper is dry-run only', () => {
  it('refuses --apply and unknown flags (so --dry-run cannot be turned off)', () => {
    expect(() => parseUatArgs(['--apply'], SPEC)).toThrow('u-op-01-dskp-dry-run is read-only: there is no --apply')
    expect(() => parseUatArgs(['--create-missing-subjects'], SPEC)).toThrow('unknown argument')
    expect(parseUatArgs(['--subject', 'MATH,SAINS', '--data-dir', '/tmp/x'], SPEC).values).toEqual({ subject: 'MATH,SAINS', 'data-dir': '/tmp/x' })
  })

  it('calls the loader with dryRun fixed to true, never through the CLI whose default is a real run', () => {
    const source = readFileSync(new URL('../../scripts/uat-ops/u-op-01-dskp-dry-run.ts', import.meta.url), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
      .join('\n')
    expect(source).toContain('dryRun: true')
    expect(source).not.toMatch(/dryRun:\s*(false|args|opts|!)/)
    expect(source).not.toMatch(/createMissingSubjects:\s*true/)
    expect(source).not.toMatch(/dskp\/cli/)
  })
})

describe('collectVerification (database)', () => {
  let db: TestDatabase
  let client: pg.Client
  beforeAll(async () => {
    db = await createTestDatabase()
    await db.query(`INSERT INTO education_levels(code,name,name_en,stage,curriculum,sort_order,is_active,grade) VALUES
      ('T4','Tingkatan 4','Form 4','upper_secondary','KSSM',10,true,10),('T5','Tingkatan 5','Form 5','upper_secondary','KSSM',11,true,11),
      ('D1','Darjah 1','Year 1','primary','KSSR',1,false,1)`)
    await db.query(`INSERT INTO subjects(code,name,name_en,color,sort_order) VALUES ('MATH','Matematik','Mathematics','#fff',1),('SAINS','Sains','Science','#fff',2)`)
    await db.query(`INSERT INTO subject_levels(subject_id,education_level_id) SELECT s.id,l.id FROM subjects s, education_levels l`)
    await db.query(`INSERT INTO curriculum_nodes(subject_id,education_level_id,kind,code,title,edition) SELECT s.id,l.id,'unit','1','Bab satu','2017' FROM subjects s, education_levels l WHERE s.code='MATH' AND l.code='T4'`)
    await db.query(`INSERT INTO curriculum_nodes(subject_id,education_level_id,kind,code,title,edition,parent_id) SELECT s.id,l.id,'sp','1.1','SP satu','2017',(SELECT id FROM curriculum_nodes LIMIT 1) FROM subjects s, education_levels l WHERE s.code='MATH' AND l.code='T4'`)
    await db.query(`INSERT INTO curriculum_tp_descriptors(subject_id,node_id,tp,descriptor,scope) SELECT subject_id,id,1,'TP satu','unit' FROM curriculum_nodes WHERE kind='unit'`)
    client = new pg.Client({ connectionString: db.url })
    await client.connect()
  })
  afterAll(async () => {
    await client.end()
    await db.drop()
  })

  it('counts per offered subject x level (Darjah left out) like API-DSKP-11 and runs the sanity SELECTs', async () => {
    const { rows, sanity } = await collectVerification(client)
    expect(rows.map((r) => `${r.subject_code} ${r.level_code} ${String(r.nodes)}`)).toEqual(['MATH T4 2', 'MATH T5 0', 'SAINS T4 0', 'SAINS T5 0'])
    expect(rows[0]).toMatchObject({ bab: 1, sk: 0, sp: 1, tp: 1, tp_general: 0 })
    expect(sanity).toEqual({ orphans: 0, emptyEdition: 0, tpOutside: 0, levels: ['T4'] })
    expect(verificationLines(rows, sanity).some((l) => l.status === 'FAIL')).toBe(false)
  })

  it('flags an empty edition', async () => {
    await db.query(`UPDATE curriculum_nodes SET edition = '' WHERE kind = 'sp'`)
    expect((await collectVerification(client)).sanity.emptyEdition).toBe(1)
  })
})
