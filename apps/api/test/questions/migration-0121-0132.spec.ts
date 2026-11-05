import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S1-T07, DM-05 / DM-53, migrations 0121_s1_servability_flags and 0132_s1_stimulus_flag_ref. The test database already ran them, so this spec
 * reads the catalogue and proves the constraints and the partial index on real rows.
 */
describe('migrations 0121 and 0132 stimulus flag columns', () => {
  let db: TestDatabase
  let versionId: string
  let userId: string

  const setFlag = (sql: string) => db.query(`update question_versions set ${sql} where id = $1::bigint`, [versionId])

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed], { prisma: db.prisma })
    const q = (await db.query<{ id: string }>(`insert into questions (source_type, latest_version_no) values ('manual', 1) returning id::text`))[0]!.id
    versionId = (await db.query<{ id: string }>(`insert into question_versions (question_id, version_no, type, stem_ms) values ($1::bigint, 1, 'mcq', 'Soalan') returning id::text`, [q]))[0]!.id
    userId = (await db.query<{ id: string }>(`select id::text id from users limit 1`))[0]!.id
  })
  afterAll(async () => {
    await db.drop()
  })

  it('[CI] the four DM-05 columns and the DM-53 column exist, nullable, with the right types', async () => {
    const cols = await db.query<{ column_name: string; data_type: string; is_nullable: string }>(
      `select column_name, data_type, is_nullable from information_schema.columns where table_name = 'question_versions'
        and column_name in ('stimulus_flag', 'stimulus_flag_at', 'flag_dismissed_at', 'flag_dismissed_by', 'stimulus_flag_ref') order by column_name`,
    )
    expect(cols).toEqual([
      { column_name: 'flag_dismissed_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      { column_name: 'flag_dismissed_by', data_type: 'bigint', is_nullable: 'YES' },
      { column_name: 'stimulus_flag', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'stimulus_flag_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      { column_name: 'stimulus_flag_ref', data_type: 'text', is_nullable: 'YES' },
    ])
  })

  it('[CI] stimulus_flag accepts the three values and NULL, and refuses anything else (check 23514)', async () => {
    for (const v of ['stimulus_missing', 'figure_only', 'stem_duplicated']) await setFlag(`stimulus_flag = '${v}'`)
    await setFlag('stimulus_flag = null')
    await expect(setFlag(`stimulus_flag = 'other'`)).rejects.toMatchObject({ code: '23514' })
  })

  it('[CI] stimulus_flag_ref accepts numbered, unnumbered and NULL, and refuses anything else (check 23514)', async () => {
    await setFlag(`stimulus_flag_ref = 'numbered'`)
    await setFlag(`stimulus_flag_ref = 'unnumbered'`)
    await setFlag('stimulus_flag_ref = null')
    await expect(setFlag(`stimulus_flag_ref = 'maybe'`)).rejects.toMatchObject({ code: '23514' })
  })

  it('[CI] both checks are validated and flag_dismissed_by is a foreign key to users that sets null', async () => {
    const checks = await db.query<{ conname: string; convalidated: boolean }>(
      `select conname, convalidated from pg_constraint where conrelid = 'question_versions'::regclass and conname in ('ck_question_versions_stimulus_flag', 'ck_question_versions_stimulus_flag_ref') order by conname`,
    )
    expect(checks).toEqual([
      { conname: 'ck_question_versions_stimulus_flag', convalidated: true },
      { conname: 'ck_question_versions_stimulus_flag_ref', convalidated: true },
    ])
    const fk = await db.query<{ confdeltype: string; confrelid: string }>(
      `select confdeltype::text, confrelid::regclass::text confrelid from pg_constraint where conname = 'fk_question_versions_flag_dismissed_by' and conrelid = 'question_versions'::regclass`,
    )
    expect(fk).toEqual([{ confdeltype: 'n', confrelid: 'users' }])
    await expect(setFlag(`flag_dismissed_by = 999999999`)).rejects.toMatchObject({ code: '23503' })
    await setFlag(`flag_dismissed_by = ${userId}`)
    await setFlag('flag_dismissed_by = null')
  })

  it('[CI] the partial index covers (subject_id, education_level_id) for open flags only', async () => {
    const [idx] = await db.query<{ def: string }>(`select indexdef def from pg_indexes where indexname = 'ix_question_versions_open_flag'`)
    expect(idx?.def).toContain('(subject_id, education_level_id)')
    expect(idx?.def).toMatch(/WHERE \(\(stimulus_flag IS NOT NULL\) AND \(flag_dismissed_at IS NULL\)\)/)
  })

  it('[CI] existing rows keep no flag (no backfill in the migration)', async () => {
    const [n] = await db.query<{ n: string }>(`select count(*)::text n from question_versions where stimulus_flag is not null or stimulus_flag_ref is not null or stimulus_flag_at is not null`)
    expect(n!.n).toBe('0')
  })
})
