/**
 * SW7-01 (mirrors migration 0090): a migrated teacher class (`kind = 'classroom'`) whose source has NO school takes its teacher's
 * v2 school (`users.school_id`), counted in the core note `classrooms.school_from_teacher`. Pinned here, on planted staging rows:
 *   - teacher class, no source school, teacher with a school -> the teacher's school, counted;
 *   - teacher class, no source school, teacher without a school -> NULL, not counted;
 *   - school class (no teacher), no school -> NULL;
 *   - class with a source school -> keeps its own, even when the teacher's differs;
 *   - a source school that is set but not loaded stays an ORPHAN_PARENT reject (no fallback);
 *   - a second apply changes nothing and the note stays at the same count.
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
const NOTE = 'classrooms.school_from_teacher'
let env: StagingDb
let coreEnv: Record<string, string>

const q = async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> =>
  (await env.pool.query(sql, params)).rows as T[]
const run = async (mode: 'dry-run' | 'apply') => runCore({ pool: env.pool, env: coreEnv, source: 'cloud', asOf: AS_OF, mode, batchSize: 2, outDir: testOutDir() })
const apply = async () => {
  await run('dry-run')
  return run('apply')
}
/** The planted classes by legacy id (101..105) with their kind and the legacy key of their school. */
const planted = async () =>
  q<{ legacy_id: string; kind: string; school_legacy: string | null; teacher_legacy: string | null }>(
    `select c.legacy_id, c.kind, s.legacy_id as school_legacy, t.legacy_id as teacher_legacy
     from classrooms c left join schools s on s.id = c.school_id left join users t on t.id = c.teacher_id
     where c.legacy_source = 'cloud' and c.legacy_id::int between 101 and 105 order by c.legacy_id::int`,
  )

beforeAll(async () => {
  env = await createStagingDb()
  coreEnv = { NODE_ENV: 'test', IC_HASH_KEY: 'fixture-ic-key-0123456789', PP_ALLOW_MIGRATE_APPLY: '1' }
  await loadStaging(env.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(env.db) })
  await runSeeds([schoolPackagesSeed, curriculumSeed], { prisma: env.db.prisma })
  // Teacher 7 is at school 1, teacher 8 loses its school. The grade comes from the class name ("Darjah 4").
  await q(`update staging_cloud.users set school_id = null where id = 8`)
  await q(`delete from staging_cloud.classrooms`)
  await q(
    `insert into staging_cloud.classrooms (id, name, code, teacher_id, school_id, subject_id, session_year) values
       (101, 'Darjah 4 Satu', 'FB101', 7, null, 1, '2026'),
       (102, 'Darjah 4 Dua', 'FB102', 8, null, 1, '2026'),
       (103, 'Darjah 4 Tiga', 'FB103', null, null, 1, '2026'),
       (104, 'Darjah 4 Empat', 'FB104', 7, 2, 1, '2026'),
       (105, 'Darjah 4 Lima', 'FB105', 7, 999, 1, '2026')`,
  )
}, 300_000)
afterAll(async () => {
  await env.close()
})

describe('SW7-01 classrooms: teacher school fallback', () => {
  it('first apply: only the teacher class with no source school and a teacher with a school takes the teacher school', async () => {
    const { report, core } = await apply()
    expect(report.status).toBe('succeeded')
    expect(await planted()).toEqual([
      { legacy_id: '101', kind: 'classroom', school_legacy: '1', teacher_legacy: '7' },
      { legacy_id: '102', kind: 'classroom', school_legacy: null, teacher_legacy: '8' },
      { legacy_id: '103', kind: 'school_class', school_legacy: null, teacher_legacy: null },
      { legacy_id: '104', kind: 'classroom', school_legacy: '2', teacher_legacy: '7' },
    ])
    expect(core.notes.counters.get(NOTE)).toBe(1)
    // The class whose source school was never loaded is still an orphan: no fallback.
    const rejects = await q<{ legacy_id: string; column_name: string; reason: string }>(
      `select legacy_id, column_name, reason from etl_rejects where run_id = $1 and entity = 'classrooms'`,
      [report.runId],
    )
    expect(rejects).toEqual([expect.objectContaining({ legacy_id: '105', column_name: 'school_id', reason: 'ORPHAN_PARENT' })])
  }, 120_000)

  it('a second apply on the same input changes nothing', async () => {
    const before = await planted()
    const { report, core } = await apply()
    expect(report.counters.classrooms).toMatchObject({ inserted: 0, updated: 0 })
    expect(await planted()).toEqual(before)
    expect(core.notes.counters.get(NOTE)).toBe(1)
  }, 120_000)
})
