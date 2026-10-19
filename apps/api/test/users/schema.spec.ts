import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

describe('users schema for M02 (BE-03 columns + migration 0004_schools_import)', () => {
  let db: TestDatabase

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('has every column the BE-05 card lists and no plaintext IC or faith', async () => {
    const cols = (
      await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = 'users'`)
    ).map((c) => c.column_name)
    expect(cols).toEqual(
      expect.arrayContaining([
        'name', 'email', 'username', 'phone', 'school_id', 'grade', 'class_label', 'bio', 'id_delima',
        'is_active', 'is_suspended', 'ic_hash', 'ic_masked', 'trial_questions_used',
      ]),
    )
    expect(cols).not.toContain('ic')
    expect(cols).not.toContain('ic_number')
    expect(cols).not.toContain('faith')
  })

  it('defaults trial_questions_used to 0 and refuses a negative value', async () => {
    const [u] = await db.query<{ trial_questions_used: number; is_active: boolean; is_suspended: boolean }>(
      `insert into users (name) values ('Percubaan') returning trial_questions_used, is_active, is_suspended`,
    )
    expect(u).toEqual({ trial_questions_used: 0, is_active: true, is_suspended: false })
    await expect(db.query(`insert into users (name, trial_questions_used) values ('Salah', -1)`)).rejects.toThrow(
      /ck_users_trial_questions_used/,
    )
  })

  it('has the list search and filter indexes', async () => {
    const idx = (
      await db.query<{ indexname: string }>(`select indexname from pg_indexes where tablename in ('users','user_roles','schools')`)
    ).map((i) => i.indexname)
    for (const n of [
      'ix_users_name_lower', 'uq_users_email', 'ix_users_username_lower', 'ix_users_school_id',
      'ix_user_roles_role_user_id', 'ix_schools_name_lower', 'ix_schools_state_district',
    ]) {
      expect(idx).toContain(n)
    }
  })
})
