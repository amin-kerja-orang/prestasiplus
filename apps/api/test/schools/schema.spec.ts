import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { SCHOOL_TYPES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

const MODELS_JSON = fileURLToPath(new URL('../../prisma/migratable-models.json', import.meta.url))

describe('schools schema (migration 0003_schools_import)', () => {
  let db: TestDatabase
  let jpnId: string
  let ppdId: string

  beforeAll(async () => {
    db = await createTestDatabase()
    const [j] = await db.query<{ id: string }>(`insert into jpns (code, name) values ('UJI', 'Negeri Ujian') returning id::text`)
    jpnId = j!.id
    const [p] = await db.query<{ id: string }>(
      `insert into ppds (jpn_id, code, name) values ($1, 'PPD UJIAN', 'PPD Ujian') returning id::text`,
      [jpnId],
    )
    ppdId = p!.id
  })
  afterAll(async () => {
    await db.drop()
  })

  const rejects = async (sql: string, params: unknown[] = []): Promise<string> => {
    try {
      await db.query(sql, params)
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error(`Expected the statement to be rejected: ${sql}`)
  }

  it('lists jpns, ppds and schools as migratable, alphabetical, with the legacy pair unique', async () => {
    const models = JSON.parse(readFileSync(MODELS_JSON, 'utf8')) as string[]
    expect([...models].sort()).toEqual(models)
    for (const t of ['jpns', 'ppds', 'schools']) {
      expect(models).toContain(t)
      const cols = await db.query<{ column_name: string }>(
        `select column_name from information_schema.columns where table_name = $1`,
        [t],
      )
      expect(cols.map((c) => c.column_name)).toEqual(expect.arrayContaining(['legacy_source', 'legacy_id']))
      expect(await db.query(`select 1 from pg_indexes where indexname = $1`, [`uq_${t}_legacy`])).toHaveLength(1)
    }
    expect(models).not.toContain('import_jobs')
  })

  it('extends schools with type, city, join_code and the jpn/ppd references', async () => {
    const cols = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'schools'`,
    )
    expect(cols.map((c) => c.column_name)).toEqual(
      expect.arrayContaining(['type', 'city', 'join_code', 'jpn_id', 'ppd_id', 'state', 'district', 'is_active']),
    )
  })

  it('accepts the contract school types and rejects any other', async () => {
    let n = 0
    for (const type of SCHOOL_TYPES) {
      await db.query(`insert into schools (name, code, type) values ('Sekolah', $1, $2)`, [`T${n++}`, type])
    }
    await db.query(`insert into schools (name, code) values ('Tanpa jenis', 'T99')`)
    expect(await rejects(`insert into schools (name, code, type) values ('X', 'TX', 'KOLEJ')`)).toMatch(/ck_schools_type/)
  })

  it('keeps school code and join code unique, many NULLs allowed', async () => {
    await db.query(`insert into schools (name, code, join_code) values ('A', 'J1', 'JOIN0001')`)
    expect(await rejects(`insert into schools (name, code) values ('B', 'J1')`)).toMatch(/uq_schools_code/)
    expect(await rejects(`insert into schools (name, code, join_code) values ('C', 'J3', 'JOIN0001')`)).toMatch(
      /uq_schools_join_code/,
    )
    await db.query(`insert into schools (name) values ('Tanpa kod A'), ('Tanpa kod B')`)
  })

  it('references jpns and ppds with restrict', async () => {
    await db.query(`insert into schools (name, code, jpn_id, ppd_id) values ('Berpaut', 'R1', $1, $2)`, [jpnId, ppdId])
    expect(await rejects(`insert into schools (name, code, jpn_id) values ('Yatim', 'R2', 999999)`)).toMatch(/fk_schools_jpn_id/)
    expect(await rejects(`insert into schools (name, code, ppd_id) values ('Yatim', 'R3', 999999)`)).toMatch(/fk_schools_ppd_id/)
    expect(await rejects(`insert into ppds (jpn_id, code, name) values (999999, 'PPD X', 'X')`)).toMatch(/fk_ppds_jpn_id/)
    expect(await rejects(`delete from ppds where id = $1`, [ppdId])).toMatch(/fk_schools_ppd_id/)
    expect(await rejects(`delete from jpns where id = $1`, [jpnId])).toMatch(/(fk_ppds_jpn_id|fk_schools_jpn_id)/)
  })

  it('keeps jpns.code and ppds.code unique', async () => {
    expect(await rejects(`insert into jpns (code, name) values ('UJI', 'Lain')`)).toMatch(/uq_jpns_code/)
    expect(await rejects(`insert into ppds (jpn_id, code, name) values ($1, 'PPD UJIAN', 'Lain')`, [jpnId])).toMatch(
      /uq_ppds_code/,
    )
  })

  it('enforces the legacy row convention on jpns and ppds', async () => {
    await db.query(`insert into jpns (code, name, legacy_source, legacy_id) values ('L1', 'Lama', 'cloud', '1')`)
    expect(
      await rejects(`insert into jpns (code, name, legacy_source, legacy_id) values ('L2', 'Lama', 'cloud', '1')`),
    ).toMatch(/uq_jpns_legacy/)
    expect(await rejects(`insert into jpns (code, name, legacy_source, legacy_id) values ('L3', 'Lama', 'x', '2')`)).toMatch(
      /ck_jpns_legacy_source/,
    )
    await db.query(
      `insert into ppds (jpn_id, code, name, legacy_source, legacy_id) values ($1, 'PPD L1', 'L', 'my', '1')`,
      [jpnId],
    )
    expect(
      await rejects(`insert into ppds (jpn_id, code, name, legacy_source, legacy_id) values ($1, 'PPD L2', 'L', 'my', '1')`, [
        jpnId,
      ]),
    ).toMatch(/uq_ppds_legacy/)
    expect(
      await rejects(`insert into ppds (jpn_id, code, name, legacy_source, legacy_id) values ($1, 'PPD L3', 'L', 'z', '3')`, [
        jpnId,
      ]),
    ).toMatch(/ck_ppds_legacy_source/)
  })

  it('uses GENERATED ALWAYS identity keys on the new tables', async () => {
    const ident = await db.query<{ table_name: string; identity_generation: string }>(
      `select table_name, identity_generation from information_schema.columns
        where table_schema = 'public' and column_name = 'id' and is_identity = 'YES'
          and table_name in ('jpns', 'ppds', 'import_jobs')`,
    )
    expect(ident.map((r) => r.table_name).sort()).toEqual(['import_jobs', 'jpns', 'ppds'])
    expect(new Set(ident.map((r) => r.identity_generation))).toEqual(new Set(['ALWAYS']))
  })

  it('stores import_jobs with per-row results, checks and no legacy columns', async () => {
    const [u] = await db.query<{ id: string }>(`insert into users (name) values ('Pengimport') returning id::text`)
    const [row] = await db.query<{ id: string; failures: unknown }>(
      `insert into import_jobs (kind, mode, created_by_id, total_rows, imported_count, failed_count, failures)
       values ('users', 'csv', $1, 3, 2, 1, '[{"row":2,"message":"E-mel tidak sah."}]') returning id::text, failures`,
      [u!.id],
    )
    expect(row!.failures).toEqual([{ row: 2, message: 'E-mel tidak sah.' }])
    const [d] = await db.query<{ failures: unknown }>(
      `insert into import_jobs (kind, mode) values ('students', 'paste') returning failures`,
    )
    expect(d!.failures).toEqual([])
    expect(await rejects(`insert into import_jobs (kind, mode) values ('teachers', 'csv')`)).toMatch(/ck_import_jobs_kind/)
    expect(await rejects(`insert into import_jobs (kind, mode) values ('users', 'xlsx')`)).toMatch(/ck_import_jobs_mode/)
    expect(await rejects(`insert into import_jobs (kind, mode, failed_count) values ('users', 'csv', -1)`)).toMatch(
      /ck_import_jobs_counts/,
    )
    expect(await rejects(`insert into import_jobs (kind, mode, failures) values ('users', 'csv', '{}')`)).toMatch(
      /ck_import_jobs_failures/,
    )
    expect(await rejects(`insert into import_jobs (kind, mode, school_id) values ('users', 'csv', 999999)`)).toMatch(
      /fk_import_jobs_school_id/,
    )
    const legacy = await db.query(
      `select 1 from information_schema.columns where table_name = 'import_jobs' and column_name like 'legacy_%'`,
    )
    expect(legacy).toHaveLength(0)
    await db.query(`delete from users where id = $1`, [u!.id])
    const kept = await db.query(`select 1 from import_jobs where id = $1`, [row!.id])
    expect(kept).toHaveLength(1)
  })
})
