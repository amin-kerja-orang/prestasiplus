/**
 * MIG-07 problem C: a delta `migrate:core --apply` inserted classrooms and enrolments although no classroom or roster row
 * changed in the dump. Cause (pinned here, not a bug): the level of a classroom has no .cloud column, it is DERIVED (T-09,
 * `deriveClassGrade`, `load/class-steps.ts` `pupilGrades`) from the pupils that exist in staging at the time of the run. A delta
 * dump that deletes or changes pupils changes that derivation, so
 *   - a class that was rejected (INVALID_VALUE education_level_id: the derived grade has no v2 level) can become placeable and is
 *     then INSERTED with its roster (the roster rows were rejected ORPHAN_PARENT before), and
 *   - a class that was loaded keeps its identity (legacy_id = staging classroom id) and is UPDATED in place to the new level.
 * The identity of a classroom or an enrolment never depends on a mutable attribute: no duplicate row is ever made, and a run on
 * unchanged input changes nothing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../../prisma/seed'
import { schoolPackagesSeed } from '../../../prisma/seed/core/school-packages'
import { curriculumSeed } from '../../../prisma/seed/curriculum'
import { runCore } from '../../../src/migration/load'
import { loadStaging } from '../../../src/migration/staging/load'
import { DirReader } from '../../../src/migration/staging/readers'
import { createStagingDb, FIXTURE_DIR, stagingEnv, type StagingDb } from '../staging/helpers'

const AS_OF = '2026-06-01'
let env: StagingDb
let coreEnv: Record<string, string>

const q = async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> =>
  (await env.pool.query(sql, params)).rows as T[]
const run = async (mode: 'dry-run' | 'apply') => (await runCore({ pool: env.pool, env: coreEnv, source: 'cloud', asOf: AS_OF, mode, batchSize: 2 })).report
/** A delta apply: the dry-run of the same input first, as the operator does. */
const apply = async () => {
  await run('dry-run')
  return run('apply')
}
const classLevels = async () =>
  q<{ legacy_id: string; code: string }>(
    `select c.legacy_id, l.code from classrooms c join education_levels l on l.id = c.education_level_id where c.legacy_source = 'cloud' order by c.legacy_id::int`,
  )
const count = async (table: string): Promise<number> => Number((await q<{ n: string }>(`select count(*)::text n from ${table}`))[0]?.n)

beforeAll(async () => {
  env = await createStagingDb()
  coreEnv = { NODE_ENV: 'test', IC_HASH_KEY: 'fixture-ic-key-0123456789', PP_ALLOW_MIGRATE_APPLY: '1' }
  await loadStaging(env.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(env.db) })
  await runSeeds([schoolPackagesSeed, curriculumSeed], { prisma: env.db.prisma })
  await q(`update staging_cloud.education_levels set name_bm = 'Darjah 1' where id = 1`)
  // Pupil grades (a "Tingkatan N" label gives its grade whatever the school type):
  //   class 1 = users 1, 2 (Darjah 4) and 3 (Darjah 1)            -> most common grade 4 (D4)
  //   class 2 = users 3 (Darjah 1), 5 and 6 (Tingkatan 2)         -> most common grade 8 (T2)
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

describe('MIG-07 C: the derived classroom level follows the pupils in staging', () => {
  it('first apply: class 1 is placed (D4); class 2 is rejected, its grade 8 has no level, and so is its roster', async () => {
    const report = await apply()
    expect(report.status).toBe('succeeded')
    expect(await classLevels()).toEqual([{ legacy_id: '1', code: 'D4' }])
    const rejects = await q<{ legacy_id: string; column_name: string }>(
      `select legacy_id, column_name from etl_rejects where run_id = $1 and entity = 'classrooms' order by legacy_id::int`,
      [report.runId],
    )
    // Class 3 has no pupil at all (no grade, rejected for good); class 2 is the one that changes below.
    expect(rejects).toEqual([
      expect.objectContaining({ legacy_id: '2', column_name: 'education_level_id' }),
      expect.objectContaining({ legacy_id: '3', column_name: 'education_level_id' }),
    ])
    expect(await q(`select 1 from enrolments e join classrooms c on c.id = e.classroom_id where c.legacy_id = '2'`)).toHaveLength(0)
  }, 120_000)

  it('a second apply on the same input inserts and updates nothing', async () => {
    const report = await apply()
    expect(report.counters.classrooms).toMatchObject({ inserted: 0, updated: 0 })
    expect(report.counters.enrolments).toMatchObject({ inserted: 0, updated: 0 })
  }, 120_000)

  it('delta that only deletes pupils: the rejected class becomes placeable and is inserted with its roster; the loaded class is updated in place', async () => {
    const enrolmentsBefore = await count('enrolments')
    const classroomsBefore = await count('classrooms')
    const class1 = (await q<{ id: string }>(`select id::text from classrooms where legacy_id = '1'`))[0]
    // The delta dump: no classroom row and no roster row changes; users 1, 2, 5 and 6 are gone from staging.
    await q(`delete from staging_cloud.users where id in (1, 2, 5, 6)`)
    const report = await apply()
    expect(report.status).toBe('succeeded')
    // Class 2: grades of the remaining pupils = [1] -> D1, so it is INSERTED (this is the "unexplained" insert of the rehearsal).
    expect(report.counters.classrooms).toMatchObject({ inserted: 1, updated: 1 })
    expect(await count('classrooms')).toBe(classroomsBefore + 1)
    // Class 1 keeps its row and id and moves to D1 (remaining pupil: user 3, Darjah 1).
    expect(await classLevels()).toEqual([
      { legacy_id: '1', code: 'D1' },
      { legacy_id: '2', code: 'D1' },
    ])
    expect((await q<{ id: string }>(`select id::text from classrooms where legacy_id = '1'`))[0]).toEqual(class1)
    // The roster rows of class 2 that were ORPHAN_PARENT before are now loaded (users 3, 5 and 6 exist in v2 since the first apply).
    expect(report.counters.enrolments).toMatchObject({ inserted: 3, updated: 0 })
    expect(await count('enrolments')).toBe(enrolmentsBefore + 3)
  }, 120_000)

  it('converges: the next apply on the same input changes nothing and no row is duplicated', async () => {
    const before = [await count('classrooms'), await count('enrolments')]
    const report = await apply()
    expect(report.counters.classrooms).toMatchObject({ inserted: 0, updated: 0 })
    expect(report.counters.enrolments).toMatchObject({ inserted: 0, updated: 0 })
    expect([await count('classrooms'), await count('enrolments')]).toEqual(before)
    expect(await q(`select legacy_id from classrooms where legacy_source = 'cloud' group by legacy_id having count(*) > 1`)).toHaveLength(0)
  }, 120_000)
})
