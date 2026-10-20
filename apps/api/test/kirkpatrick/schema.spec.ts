import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

describe('migration 0023 tables: constraints (feedback, interventions, monitoring_flags)', () => {
  let db: TestDatabase
  let user: string
  let other: string

  beforeAll(async () => {
    db = await createTestDatabase()
    user = (await db.query<{ id: string }>(`insert into users (name) values ('Pengguna Satu') returning id::text`))[0]?.id as string
    other = (await db.query<{ id: string }>(`insert into users (name) values ('Pengguna Dua') returning id::text`))[0]?.id as string
  }, 120_000)
  afterAll(async () => {
    await db.drop()
  })

  const rejects = async (sql: string, params: unknown[], constraint: string) => {
    await expect(db.query(sql, params)).rejects.toMatchObject({ constraint })
  }
  const feedback = `insert into feedback (user_id, role, month, nps, satisfaction) values ($1, $2, $3, $4, $5)`

  it('feedback: one row per user and month, nps 0..10 (null allowed), satisfaction 1..5, known roles', async () => {
    await db.query(feedback, [user, 'student', '2026-10-01', 10, 5])
    await rejects(feedback, [user, 'teacher', '2026-10-01', 3, 3], 'uq_feedback_user_id_month_is_test')
    // A test row (Mod Pelajar) of the same month does not collide with the real one.
    await db.query(`insert into feedback (user_id, role, month, nps, satisfaction, is_test) values ($1, 'student', '2026-10-01', 4, 4, true)`, [user])
    await db.query(feedback, [user, 'student', '2026-11-01', null, 1])
    await db.query(feedback, [user, 'student', '2026-12-01', 0, 5])
    await rejects(feedback, [other, 'student', '2026-10-01', 11, 3], 'ck_feedback_nps')
    await rejects(feedback, [other, 'student', '2026-10-01', -1, 3], 'ck_feedback_nps')
    await rejects(feedback, [other, 'student', '2026-10-01', 5, 0], 'ck_feedback_satisfaction')
    await rejects(feedback, [other, 'student', '2026-10-01', 5, 6], 'ck_feedback_satisfaction')
    await rejects(feedback, [other, 'pupil', '2026-10-01', 5, 3], 'ck_feedback_role')
    await rejects(`insert into feedback (user_id, role, month, satisfaction, legacy_source, legacy_id) values ($1, 'student', '2026-01-01', 3, 'other', '1')`, [other], 'ck_feedback_legacy_source')
  })

  it('feedback: the legacy pair is unique, the user must exist, and a deleted user takes the rows with them', async () => {
    const legacy = `insert into feedback (user_id, role, month, satisfaction, legacy_source, legacy_id) values ($1, 'student', $2, 3, 'cloud', 'fb-9')`
    await db.query(legacy, [other, '2026-01-01'])
    await rejects(legacy, [other, '2026-02-01'], 'uq_feedback_legacy')
    await rejects(feedback, ['999999999', 'student', '2026-10-01', 5, 3], 'fk_feedback_user_id')
    const doomed = (await db.query<{ id: string }>(`insert into users (name) values ('Dipadam') returning id::text`))[0]?.id as string
    await db.query(feedback, [doomed, 'student', '2026-10-01', 5, 3])
    await db.query(`delete from users where id = $1`, [doomed])
    expect((await db.query(`select 1 from feedback where user_id = $1`, [doomed])).length).toBe(0)
  })

  const intervention = `insert into interventions (student_id, alert_type, action_date, alert_description, action_taken, before_accuracy, before_mood, created_by_id)
    values ($1, $2, '2026-10-01', 'Huraian', 'Tindakan', $3, $4, $5)`

  it('interventions: alert type, mood and accuracy checks; the author is protected', async () => {
    await db.query(intervention, [user, 'mood', 50.5, 'sad', other])
    await db.query(intervention, [user, 'declining', null, null, other])
    await rejects(intervention, [user, 'wellbeing', 50, 'sad', other], 'ck_interventions_alert_type')
    await rejects(intervention, [user, 'mood', 50, 'angry', other], 'ck_interventions_before_mood')
    await rejects(intervention, [user, 'mood', 100.5, 'sad', other], 'ck_interventions_before_accuracy')
    await rejects(intervention, [user, 'mood', -1, 'sad', other], 'ck_interventions_before_accuracy')
    await rejects(intervention, ['999999999', 'mood', 50, 'sad', other], 'fk_interventions_student_id')
    await expect(db.query(`delete from users where id = $1`, [other])).rejects.toMatchObject({ constraint: 'fk_interventions_created_by_id' })
  })

  it('monitoring_flags: one flag per user, level review or excluded', async () => {
    const flag = `insert into monitoring_flags (user_id, level) values ($1, $2)`
    await db.query(flag, [user, 'review'])
    await rejects(flag, [user, 'excluded'], 'uq_monitoring_flags_user_id')
    await rejects(flag, [other, 'banned'], 'ck_monitoring_flags_level')
  })
})
