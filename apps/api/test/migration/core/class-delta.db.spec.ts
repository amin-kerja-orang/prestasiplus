/**
 * BE-28 classroom level in a delta run. The level of a classroom has no .cloud column: it is DERIVED (T-09, `deriveClassGrade`,
 * `load/class-steps.ts`) from the pupils in staging. Pinned here:
 *   - a class whose pupils still exist follows them (the level moves in place, same row and id);
 *   - a class that never loaded and has no pupil is rejected (INVALID_VALUE education_level_id), as before;
 *   - a class that is ALREADY LOADED and loses all its pupils at the source keeps its v2 row and its level (counted in the note
 *     `classrooms.level_kept_no_pupils`), no reject; the enrolments of the deleted pupils are not propagated (source deletes never are);
 *   - a run on unchanged input changes nothing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../../prisma/seed'
import { schoolPackagesSeed } from '../../../prisma/seed/core/school-packages'
import { curriculumSeed } from '../../../prisma/seed/curriculum'
import { runCore } from '../../../src/migration/load'
import { loadStaging } from '../../../src/migration/staging/load'
import { DirReader } from '../../../src/migration/staging/readers'
import { createStagingDb, FIXTURE_DIR, stagingEnv, testOutDir, type StagingDb } from '../staging/helpers'

const AS_OF = '2026-06-01'
const NOTE = 'classrooms.level_kept_no_pupils'
let env: StagingDb
let coreEnv: Record<string, string>

const q = async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> =>
  (await env.pool.query(sql, params)).rows as T[]
const run = async (mode: 'dry-run' | 'apply') => runCore({ pool: env.pool, env: coreEnv, source: 'cloud', asOf: AS_OF, mode, batchSize: 2, outDir: testOutDir() })
/** A delta apply: the dry-run of the same input first, as the operator does. */
const apply = async () => {
  await run('dry-run')
  return run('apply')
}
const classRows = async () =>
  q<{ legacy_id: string; id: string; code: string; name: string }>(
    `select c.legacy_id, c.id::text, l.code, c.name from classrooms c join education_levels l on l.id = c.education_level_id
     where c.legacy_source = 'cloud' order by c.legacy_id::int`,
  )
const count = async (table: string): Promise<number> => Number((await q<{ n: string }>(`select count(*)::text n from ${table}`))[0]?.n)
const classRejects = (runId: string) =>
  q<{ legacy_id: string; column_name: string }>(
    `select legacy_id, column_name from etl_rejects where run_id = $1 and entity = 'classrooms' order by legacy_id::int`,
    [runId],
  )

beforeAll(async () => {
  env = await createStagingDb()
  coreEnv = { NODE_ENV: 'test', IC_HASH_KEY: 'fixture-ic-key-0123456789', PP_ALLOW_MIGRATE_APPLY: '1' }
  await loadStaging(env.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(env.db) })
  await runSeeds([schoolPackagesSeed, curriculumSeed], { prisma: env.db.prisma })
  await q(`update staging_cloud.education_levels set name_bm = 'Darjah 1' where id = 1`)
  // Pupil grades (a "Tingkatan N" label gives its grade whatever the school type):
  //   class 1 = users 1, 2 (Darjah 4) and 3 (Darjah 1) -> most common grade 4 (D4)
  //   class 2 = users 3 (Darjah 1), 5 and 6 (Tingkatan 2) -> grade 8 (T2)
  //   class 3 = no pupil
  await q(`update staging_cloud.users set kelas = '4 A' where id in (1, 2)`)
  await q(`update staging_cloud.users set kelas = '1 A' where id = 3`)
  await q(`update staging_cloud.users set kelas = 'Tingkatan 2 A' where id in (5, 6)`)
  await q(`insert into staging_cloud.classroom_student (classroom_id, student_id) values (1, 3), (2, 5), (2, 6)`)
  // The v2 curriculum has no level for grade 8, like the rehearsal database (levels 1, 6, 7, 10 only).
  await q(`update education_levels set grade = null where code = 'T2'`)
}, 300_000)
afterAll(async () => {
  await env.close()
})

describe('BE-28 classroom level in a delta run', () => {
  let class1: { legacy_id: string; id: string; code: string; name: string }
  let enrolmentsAfterFirst = 0

  it('first apply: class 1 is placed (D4); class 3 (never loaded, no pupil) and class 2 (grade 8 has no level) are rejected', async () => {
    const { report, core } = await apply()
    expect(report.status).toBe('succeeded')
    const rows = await classRows()
    expect(rows).toEqual([expect.objectContaining({ legacy_id: '1', code: 'D4' })])
    class1 = rows[0]!
    expect(await classRejects(report.runId)).toEqual([
      expect.objectContaining({ legacy_id: '2', column_name: 'education_level_id' }),
      expect.objectContaining({ legacy_id: '3', column_name: 'education_level_id' }),
    ])
    expect(core.notes.counters.get(NOTE)).toBeUndefined()
    enrolmentsAfterFirst = await count('enrolments')
  }, 120_000)

  it('pupils changed: the level of the loaded class follows its remaining pupils, same row and id, no note', async () => {
    await q(`delete from staging_cloud.users where id in (1, 2)`)
    const { report, core } = await apply()
    expect(report.status).toBe('succeeded')
    expect(await classRows()).toEqual([{ ...class1, code: 'D1' }])
    expect(core.notes.counters.get(NOTE)).toBeUndefined()
    expect((await classRejects(report.runId)).map((r) => r.legacy_id)).toEqual(['2', '3'])
  }, 120_000)

  it('all pupils deleted at the source: the loaded class is kept with its level, counted, not rejected; its enrolments stay', async () => {
    await q(`delete from staging_cloud.users where id in (3, 5, 6)`)
    expect(await q(`select 1 from staging_cloud.users u join staging_cloud.classroom_student cs on cs.student_id = u.id where cs.classroom_id = 1`)).toHaveLength(0)
    const { report, core } = await apply()
    expect(report.status).toBe('succeeded')
    // Same row, same id, same level (D1 from the previous delta), still loaded.
    expect(await classRows()).toEqual([{ ...class1, code: 'D1' }])
    expect(core.notes.counters.get(NOTE)).toBe(1)
    // No reject for the kept class; class 3 (never loaded) and class 2 (grade 8 has no level; its pupils are gone, never loaded) still are.
    expect((await classRejects(report.runId)).map((r) => r.legacy_id)).toEqual(['2', '3'])
    // Source deletes are not propagated: the enrolments already loaded are untouched.
    expect(await count('enrolments')).toBe(enrolmentsAfterFirst)
  }, 120_000)

  it('a class with other changed columns is updated while its level is kept', async () => {
    await q(`update staging_cloud.classrooms set name = 'Kelas Pertama Baharu' where id = 1`)
    const { report, core } = await apply()
    expect(report.counters.classrooms).toMatchObject({ inserted: 0, updated: 1 })
    expect(core.notes.counters.get(NOTE)).toBe(1)
    expect(await classRows()).toEqual([{ ...class1, code: 'D1', name: 'Kelas Pertama Baharu' }])
  }, 120_000)

  it('a second apply on the same input changes nothing', async () => {
    const before = [await count('classrooms'), await count('enrolments')]
    const rowsBefore = await classRows()
    const { report, core } = await apply()
    expect(report.counters.classrooms).toMatchObject({ inserted: 0, updated: 0 })
    expect(report.counters.enrolments).toMatchObject({ inserted: 0, updated: 0 })
    expect(core.notes.counters.get(NOTE)).toBe(1)
    expect([await count('classrooms'), await count('enrolments')]).toEqual(before)
    expect(await classRows()).toEqual(rowsBefore)
  }, 120_000)
})
