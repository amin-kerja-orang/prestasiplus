import { createHash, randomBytes } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { withDatabase } from '../support/global-setup'

const MIGRATIONS_DIR = fileURLToPath(new URL('../../prisma/migrations/', import.meta.url))
const HASH = createHash('sha256').update('x').digest('hex')

/** BJS-02: the raw SQL of migration 0092_bijak_standards against the migrated template (checks, keys, indexes, trigger). */
describe('bijak standards schema (migration 0092_bijak_standards)', () => {
  let db: TestDatabase
  let sid: string
  let uid: string
  let unitId: string
  let n = 0
  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, curriculumSeed], { prisma: db.prisma })
    sid = (await db.query<{ id: string }>(`select id::text from subjects where code = 'MATH'`))[0]?.id as string
    uid = (await db.query<{ id: string }>(`select id::text from users order by id limit 1`))[0]?.id as string
    unitId = (await db.query<{ id: string }>(`select id::text from curriculum_nodes where kind = 'unit' limit 1`))[0]?.id as string
  })
  afterAll(async () => {
    await db.drop()
  })

  const rejects = async (sql: string, params: unknown[] = []) => {
    await expect(db.query(sql, params)).rejects.toThrow()
  }
  const one = async (sql: string, params: unknown[] = []): Promise<string> => {
    const row = (await db.query<{ id: string }>(sql, params))[0]
    if (!row) throw new Error('no row returned')
    return row.id
  }
  const newBlueprint = (cols = '', vals = '', hash: string | null = HASH) =>
    one(
      `insert into blueprints (subject_id, kertas, code, duration_min, structure_hash${cols}) values (${sid}, 1, $1, 60, $2${vals}) returning id::text`,
      [`BS/${String((n += 1))}`, hash],
    )
  const newVerification = (blueprintId: string) =>
    one(
      `insert into blueprint_verifications (blueprint_id, verified_by_id, verifier_role, structure_hash, check_result, evidence_snapshot)
       values ($1, $2, 'admin', $3, '[]', '[]') returning id::text`,
      [blueprintId, uid, HASH],
    )

  it('topic_weights is gone; the new columns and tables exist; cognitive_mix is kept (design 3.2)', async () => {
    const cols = async (t: string) => (await db.query<{ c: string }>(`select column_name c from information_schema.columns where table_name = $1`, [t])).map((r) => r.c)
    expect(await cols('blueprint_sections')).not.toContain('topic_weights')
    expect(await cols('blueprint_sections')).toEqual(expect.arrayContaining(['profile', 'quota', 'kbat_marks', 'kbat_reviewed']))
    expect(await cols('blueprints')).toEqual(
      expect.arrayContaining(['notes', 'sub_part_ramp', 'kbat_marks', 'level_share', 'serves_students', 'structure_hash', 'verification_id', 'cognitive_mix']),
    )
    expect(await cols('question_parts')).toEqual(expect.arrayContaining(['difficulty_tp', 'cognitive_level', 'unit_node_id', 'form_origin']))
    expect(await cols('papers')).toContain('standard_report')
    expect(await cols('blueprint_evidence')).toEqual(expect.arrayContaining(['blueprint_id', 'kind', 'body', 'values', 'origin', 'created_by_id']))
    expect(await cols('blueprint_verifications')).toEqual(expect.arrayContaining(['verified_by_id', 'check_result', 'evidence_snapshot']))
  })

  it('structure_hash is mandatory and must be 64 lowercase hex characters', async () => {
    await rejects(`insert into blueprints (subject_id, kertas, code, duration_min) values (${sid}, 1, 'NOHASH', 60)`)
    await rejects(`insert into blueprints (subject_id, kertas, code, duration_min, structure_hash) values (${sid}, 1, 'BADHASH', 60, 'abc')`)
    await newBlueprint()
  })

  it('source = verified needs a verification, and a verification only exists on a verified row', async () => {
    await rejects(`insert into blueprints (subject_id, kertas, code, duration_min, structure_hash, source) values (${sid}, 1, 'V0', 60, '${HASH}', 'verified')`)
    const spec = await newBlueprint()
    const ver = await newVerification(spec)
    await rejects(`update blueprints set verification_id = ${ver} where id = ${spec}`) // spec row cannot hold a verification
    await db.query(`update blueprints set source = 'verified', verification_id = ${ver} where id = ${spec}`) // the verify service does both at once
    await rejects(`update blueprints set verification_id = null where id = ${spec}`) // and cannot drop it again
  })

  it('serves_students: only a verified row, and at most one per subject and kertas', async () => {
    const spec = await newBlueprint()
    await rejects(`update blueprints set serves_students = true where id = ${spec}`)
    const a = await newBlueprint()
    await db.query(`update blueprints set source = 'verified', verification_id = ${await newVerification(a)}, serves_students = true where id = ${a}`)
    const b = await newBlueprint()
    await db.query(`update blueprints set source = 'verified', verification_id = ${await newVerification(b)} where id = ${b}`)
    await rejects(`update blueprints set serves_students = true where id = ${b}`) // second serving row, same subject and kertas
    await db.query(`update blueprints set serves_students = false where id = ${a}`)
    await db.query(`update blueprints set serves_students = true where id = ${b}`) // the flag moves
  })

  it('blueprint and section kbat_marks are >= 0 (0 is a value)', async () => {
    await rejects(`insert into blueprints (subject_id, kertas, code, duration_min, structure_hash, kbat_marks) values (${sid}, 1, 'K-1', 60, '${HASH}', -1)`)
    const bp = await newBlueprint(', kbat_marks', ', 0')
    await db.query(`insert into blueprint_sections (blueprint_id, position, label, question_count, kbat_marks) values (${bp}, 1, 'A', 5, 0)`)
    await rejects(`insert into blueprint_sections (blueprint_id, position, label, question_count, kbat_marks) values (${bp}, 2, 'B', 5, -1)`)
    const s = (await db.query<{ kbat_reviewed: boolean }>(`select kbat_reviewed from blueprint_sections where blueprint_id = ${bp}`))[0]
    expect(s?.kbat_reviewed).toBe(true) // default true (hand-made values)
    await db.query(`update blueprint_sections set profile = '{"kind":"ladder","groups":[]}', quota = '{"basis":"questions","lines":[]}' where blueprint_id = ${bp}`)
  })

  it('evidence: kind, body (lowercase snake_case, 1-64), origin and year are checked; rows go with the version', async () => {
    const bp = await newBlueprint()
    const ins = (kind: string, body: string, origin = 'admin', year = 2024) =>
      db.query(
        `insert into blueprint_evidence (blueprint_id, kind, body, year, paper_code, values, origin) values ($1, $2, $3, $4, '1449/2', '{}', $5)`,
        [bp, kind, body, year, origin],
      )
    await ins('trial_paper', 'sbp')
    await ins('skema', 'selangor_mpsm', 'study')
    await ins('lpm_format', 'lpm')
    await rejects(`insert into blueprint_evidence (blueprint_id, kind, body, year, paper_code, values) values (${bp}, 'other', 'sbp', 2024, 'x', '{}')`)
    await expect(ins('trial_paper', 'SBP')).rejects.toThrow()
    await expect(ins('trial_paper', 'sb p')).rejects.toThrow()
    await expect(ins('trial_paper', '')).rejects.toThrow()
    await expect(ins('trial_paper', 'a'.repeat(65))).rejects.toThrow()
    await ins('trial_paper', 'a'.repeat(64))
    await expect(ins('trial_paper', 'sbp', 'import')).rejects.toThrow()
    await expect(ins('trial_paper', 'sbp', 'admin', 1800)).rejects.toThrow()
    await db.query(`delete from blueprints where id = ${bp}`)
    expect(await db.query(`select 1 from blueprint_evidence where blueprint_id = ${bp}`)).toHaveLength(0)
  })

  it('verifications: only the admin role, insert-only (no update, no delete), and a verified version cannot be deleted', async () => {
    await rejects(
      `insert into blueprint_verifications (blueprint_id, verified_by_id, verifier_role, structure_hash, check_result, evidence_snapshot)
       values (${await newBlueprint()}, ${uid}, 'guru', '${HASH}', '[]', '[]')`,
    )
    const bp = await newBlueprint()
    const ver = await newVerification(bp)
    await rejects(`update blueprint_verifications set note = 'edit' where id = ${ver}`)
    await rejects(`delete from blueprint_verifications where id = ${ver}`)
    await rejects(`delete from blueprints where id = ${bp}`) // restrict
    await rejects(`delete from users where id = ${uid}`) // restrict (verifier stays)
  })

  it('question_parts: leaf-only TP, cognitive level, unit and form, values 1..6 and t1_t3/t4/t5', async () => {
    const q = await one(`insert into questions (source_type) values ('manual') returning id::text`)
    const v = await one(`insert into question_versions (question_id, version_no, status, type, stem_ms) values ($1, 1, 'draft', 'structured', 'Soalan') returning id::text`, [q])
    const part = (pos: number, extra: string) =>
      db.query(`insert into question_parts (question_version_id, position, depth, label, prompt_ms, marks, mode${extra ? ', ' + extra.split('=')[0] : ''})
                values ($1, $2, 1, 'a', 'x', 2, 'short_text'${extra ? ', ' + extra.split('=')[1] : ''})`, [v, pos])
    await part(1, '') // inherits everything
    await part(2, `difficulty_tp=${'6'}`)
    await db.query(
      `insert into question_parts (question_version_id, position, depth, label, prompt_ms, marks, mode, difficulty_tp, cognitive_level, unit_node_id, form_origin)
       values ($1, 3, 1, 'c', 'x', 2, 'short_text', 3, 4, $2, 't5')`,
      [v, unitId],
    )
    for (const bad of ['difficulty_tp=0', 'difficulty_tp=7', 'cognitive_level=0', 'cognitive_level=7', `form_origin='t6'`, 'unit_node_id=999999999']) {
      await expect(part(9, bad)).rejects.toThrow()
    }
    // a branch part (mode and marks NULL) never carries the standard tags
    const branch = (col: string, val: string) =>
      db.query(`insert into question_parts (question_version_id, position, depth, label, prompt_ms, ${col}) values ($1, 8, 1, 'b', 'x', ${val})`, [v])
    await expect(branch('difficulty_tp', '3')).rejects.toThrow()
    await expect(branch('cognitive_level', '3')).rejects.toThrow()
    await expect(branch('form_origin', `'t4'`)).rejects.toThrow()
    await expect(branch('unit_node_id', unitId)).rejects.toThrow()
  })

  it('papers.standard_report is nullable JSONB', async () => {
    const p = await one(`insert into papers (kind, title, subject_id, kertas, printed_duration_min) values ('pilihan', 'p', ${sid}, 1, 60) returning id::text`)
    expect((await db.query<{ r: unknown }>(`select standard_report r from papers where id = ${p}`))[0]?.r).toBeNull()
    await db.query(`update papers set standard_report = '{"solverVersion":"1"}' where id = ${p}`)
  })
})

/** The upgrade path: data that exists BEFORE 0092 (backfill, downgrade, guard). Runs 0001..0091, seeds rows, then applies 0092. */
describe('migration 0092 upgrade on existing rows', () => {
  const adminUrl = inject('testDbAdminUrl')
  const names: string[] = []
  const dirs = () =>
    readdirSync(MIGRATIONS_DIR)
      .filter((d) => statSync(join(MIGRATIONS_DIR, d)).isDirectory())
      .sort()
  const sql0092 = readFileSync(join(MIGRATIONS_DIR, '0092_bijak_standards', 'migration.sql'), 'utf8')

  async function preMigratedDb(): Promise<pg.Client> {
    const name = `t_up_${randomBytes(5).toString('hex')}`
    const admin = new pg.Client({ connectionString: adminUrl })
    await admin.connect()
    await admin.query(`CREATE DATABASE "${name}"`)
    await admin.end()
    names.push(name)
    const c = new pg.Client({ connectionString: withDatabase(adminUrl, name) })
    await c.connect()
    for (const d of dirs().filter((x) => x < '0092')) await c.query(readFileSync(join(MIGRATIONS_DIR, d, 'migration.sql'), 'utf8'))
    return c
  }
  afterAll(async () => {
    const admin = new pg.Client({ connectionString: adminUrl })
    await admin.connect()
    for (const n of names) await admin.query(`DROP DATABASE IF EXISTS "${n}" WITH (FORCE)`)
    await admin.end()
  })

  it('downgrades verified rows to spec, backfills a 64-hex hash that changes with structure, then enforces NOT NULL', async () => {
    const c = await preMigratedDb()
    try {
      const sub = (await c.query(`insert into subjects (code, name, name_en, color) values ('UP', 'Up', 'Up', '#000') returning id::text`)).rows[0].id as string
      const mk = async (code: string, source: string, kertas: number) =>
        (await c.query(`insert into blueprints (subject_id, kertas, code, source, duration_min, total_marks) values ($1, $2, $3, $4, 90, 40) returning id::text`, [sub, kertas, code, source])).rows[0].id as string
      const a = await mk('UP/1', 'verified', 1)
      const b = await mk('UP/2', 'spec', 2)
      const b2 = await mk('UP/3', 'spec', 3)
      await c.query(`insert into blueprint_sections (blueprint_id, position, label, question_count, mark_budget) values ($1, 1, 'A', 5, 5), ($2, 1, 'A', 5, 5), ($3, 1, 'A', 6, 6)`, [a, b, b2])

      await c.query(sql0092)

      const rows = (await c.query(`select id::text, source, structure_hash, serves_students, verification_id from blueprints order by id`)).rows as {
        id: string
        source: string
        structure_hash: string
        serves_students: boolean
        verification_id: string | null
      }[]
      expect(rows.map((r) => r.source)).toEqual(['spec', 'spec', 'spec'])
      for (const r of rows) {
        expect(r.structure_hash).toMatch(/^[0-9a-f]{64}$/)
        expect(r.serves_students).toBe(false)
        expect(r.verification_id).toBeNull()
      }
      expect(new Set(rows.map((r) => r.structure_hash)).size).toBe(3) // different code/kertas/sections give different hashes
      const col = (await c.query(`select is_nullable from information_schema.columns where table_name = 'blueprints' and column_name = 'structure_hash'`)).rows[0]
      expect(col.is_nullable).toBe('NO')
      const sec = (await c.query(`select kbat_reviewed, profile, quota, kbat_marks from blueprint_sections limit 1`)).rows[0]
      expect(sec).toEqual({ kbat_reviewed: true, profile: null, quota: null, kbat_marks: null })
    } finally {
      await c.end()
    }
  })

  it('the hash ignores cosmetic content (notes-like columns, label) and tracks the section structure', async () => {
    const c = await preMigratedDb()
    try {
      const sub = (await c.query(`insert into subjects (code, name, name_en, color) values ('UP', 'Up', 'Up', '#000') returning id::text`)).rows[0].id as string
      const mk = async (version: number, label: string, qc: number) => {
        const id = (
          await c.query(`insert into blueprints (subject_id, kertas, code, version, duration_min) values ($1, 1, 'SAME', $2, 60) returning id::text`, [sub, version])
        ).rows[0].id as string
        await c.query(`insert into blueprint_sections (blueprint_id, position, label, instruction, question_count, mark_budget) values ($1, 1, $2, $2, $3, 10)`, [id, label, qc])
        return id
      }
      const a = await mk(1, 'Bahagian A', 5)
      const b = await mk(2, 'Lain label', 5)
      const d = await mk(3, 'Bahagian A', 6)
      await c.query(sql0092)
      const h = Object.fromEntries((await c.query(`select id::text, structure_hash from blueprints`)).rows.map((r: { id: string; structure_hash: string }) => [r.id, r.structure_hash]))
      expect(h[a]).toBe(h[b]) // label and instruction are cosmetic... version is not hashed either (it is the row identity)
      expect(h[a]).not.toBe(h[d]) // question_count is structural
    } finally {
      await c.end()
    }
  })

  it('aborts, changing nothing, when a section still holds topic_weights', async () => {
    const c = await preMigratedDb()
    try {
      const sub = (await c.query(`insert into subjects (code, name, name_en, color) values ('UP', 'Up', 'Up', '#000') returning id::text`)).rows[0].id as string
      const bp = (await c.query(`insert into blueprints (subject_id, kertas, code, duration_min) values ($1, 1, 'TW', 60) returning id::text`, [sub])).rows[0].id as string
      await c.query(`insert into blueprint_sections (blueprint_id, position, label, question_count, topic_weights) values ($1, 1, 'A', 5, '{"3.1": 2}')`, [bp])
      await expect(c.query(sql0092)).rejects.toThrow(/topic_weights/)
      // one multi-statement query is a single implicit transaction: the failed migration left the old shape intact
      const cols = (await c.query(`select column_name from information_schema.columns where table_name = 'blueprints'`)).rows.map((r: { column_name: string }) => r.column_name)
      expect(cols).not.toContain('structure_hash')
    } finally {
      await c.end()
    }
  })
})
