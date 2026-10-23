import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

const INDEX = 'ix_practice_answers_answered_at_id'

/** The newest-answers feed of CommandCenterRepository.latestAnswers, platform scope (no school filter). */
const FEED = `
  SELECT a.id, a.answered_at FROM practice_answers a JOIN users u ON u.id = a.user_id
   WHERE a.is_test = false AND a.answered_at <= now() ORDER BY a.answered_at DESC, a.id DESC LIMIT 10`

describe('practice_answers time index (migration 0040_practice_answers_answered_at_index, AZ-13)', () => {
  let db: TestDatabase

  beforeAll(async () => {
    db = await createTestDatabase()
    const [u] = await db.query<{ id: string }>(`insert into users (name) values ('Murid indeks') returning id::text`)
    const [s] = await db.query<{ id: string }>(`insert into subjects (code, name, name_en, color) values ('IDX', 'Subjek', 'Subject', '#fff') returning id::text`)
    await db.query(
      `insert into practice_answers (user_id, subject_id, is_correct, answered_at, is_test)
       select $1::bigint, $2::bigint, g % 2 = 0, now() - g * interval '1 minute', g % 50 = 0 from generate_series(1, 2000) g`,
      [u!.id, s!.id],
    )
    await db.query(`analyze practice_answers`)
  })
  afterAll(async () => {
    await db.drop()
  })

  it('exists as a partial index on (answered_at DESC, id DESC) WHERE NOT is_test, with a name Postgres does not truncate', async () => {
    expect(INDEX.length).toBeLessThanOrEqual(63)
    const rows = await db.query<{ indexdef: string }>(`select indexdef from pg_indexes where tablename = 'practice_answers' and indexname = $1`, [INDEX])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.indexdef).toMatch(/USING btree \(answered_at DESC, id DESC\) WHERE \(NOT is_test\)$/)
  })

  it('serves the platform newest-answers feed (planner picks it once a sequential scan is not an option)', async () => {
    // the pool has one connection, so the SET holds for the next statement
    await db.query(`set enable_seqscan = off`)
    const plan = (await db.query<{ 'QUERY PLAN': string }>(`explain ${FEED}`)).map((r) => r['QUERY PLAN']).join('\n')
    await db.query(`reset enable_seqscan`)
    expect(plan).toContain(INDEX)
  })

  it('excludes is_test rows from the feed (the index is partial on NOT is_test)', async () => {
    const rows = await db.query<{ id: string }>(FEED)
    expect(rows).toHaveLength(10)
    const test = await db.query<{ n: string }>(`select count(*)::text as n from practice_answers where id = any($1::bigint[]) and is_test`, [rows.map((r) => r.id)])
    expect(test[0]!.n).toBe('0')
  })
})
