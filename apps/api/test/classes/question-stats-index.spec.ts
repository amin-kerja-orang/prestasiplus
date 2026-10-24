/**
 * SW12-02: the teacher `used` counter must not scan the answer log. Migration 0091 adds the partial index
 * `ix_practice_answers_question_id_real`; `usedCountQuery` probes it once per owned question.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { questionsSeed } from '../../prisma/seed/questions'
import { usedCountQuery } from '../../src/modules/classes/question-bridge/teacher-question-stats.provider'
import { createTestDatabase, type TestDatabase } from '../support/db'

const INDEX = 'ix_practice_answers_question_id_real'

describe('practice_answers question index and the used query (migration 0091_practice_answers_question_id_index, SW12-02)', () => {
  let db: TestDatabase
  let owner: string
  let ownedQuestion: string

  const plan = async (): Promise<string> => {
    const q = usedCountQuery(BigInt(owner))
    const rows = await db.query<{ 'QUERY PLAN': string }>(`explain ${q.text}`, q.values as unknown[])
    return rows.map((r) => r['QUERY PLAN']).join('\n')
  }

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, curriculumSeed, questionsSeed], { prisma: db.prisma })
    owner = (await db.query<{ id: string }>(`select id::text from users where email = 'guru@demo.test'`))[0]!.id
    const admin = (await db.query<{ id: string }>(`select id::text from users where email = 'admin@demo.test'`))[0]!.id
    const student = (await db.query<{ id: string }>(`select id::text from users where email = 'pelajar@demo.test'`))[0]!.id
    const subject = (await db.query<{ id: string }>(`select id::text from subjects order by id limit 1`))[0]!.id
    await db.query(`update questions set created_by_id = $1 where id in (select id from questions where created_by_id = $2 order by id limit 7)`, [owner, admin])
    ownedQuestion = (await db.query<{ id: string }>(`select id::text from questions where created_by_id = $1 order by id limit 1`, [owner]))[0]!.id
    // A few thousand answers: real ones on other questions, test traffic, migrated history without a question link, and one on an owned question.
    await db.query(
      `insert into practice_answers (user_id, question_id, is_correct, answered_at, is_test)
       select $1::bigint, 1000000 + g, true, now(), g % 7 = 0 from generate_series(1, 6000) g`,
      [student],
    )
    await db.query(
      `insert into practice_answers (user_id, subject_id, is_correct, answered_at, historical)
       select $1::bigint, $2::bigint, true, now(), true from generate_series(1, 3000) g`,
      [student, subject],
    )
    await db.query(`insert into practice_answers (user_id, question_id, is_correct, answered_at) values ($1, $2, true, now())`, [student, ownedQuestion])
    await db.query(`analyze practice_answers`)
  }, 180_000)
  afterAll(async () => {
    await db.drop()
  })

  it('exists as a partial index on (question_id) WHERE question_id IS NOT NULL AND NOT is_test, with a name Postgres does not truncate', async () => {
    expect(INDEX.length).toBeLessThanOrEqual(63)
    const rows = await db.query<{ indexdef: string }>(`select indexdef from pg_indexes where tablename = 'practice_answers' and indexname = $1`, [INDEX])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.indexdef).toMatch(/USING btree \(question_id\) WHERE \(\(question_id IS NOT NULL\) AND \(NOT is_test\)\)$/)
  })

  it('the used query probes the index per owned question and never scans practice_answers', async () => {
    const text = await plan()
    expect(text).toContain(INDEX)
    expect(text).not.toMatch(/Seq Scan on practice_answers/)
    expect(text).not.toMatch(/Seq Scan on structured_attempts/)
  })

  it('still no hashed SubPlan when structured_attempts has rows but no statistics yet', async () => {
    const student = (await db.query<{ id: string }>(`select id::text from users where email = 'pelajar@demo.test'`))[0]!.id
    await db.query(
      `insert into structured_attempts (user_id, question_id, question_version_no, total_awarded, total_max, submitted_at)
       select $1::bigint, 3000000 + g, 1, 1, 2, now() from generate_series(1, 3000) g`,
      [student],
    )
    const text = await plan()
    expect(text).not.toMatch(/hashed SubPlan/)
    expect(text).not.toMatch(/Seq Scan on (practice_answers|structured_attempts)/)
  })

  it('counts the owned question that has a real answer', async () => {
    const q = usedCountQuery(BigInt(owner))
    const rows = await db.query<{ n: number }>(q.text, q.values as unknown[])
    expect(rows[0]!.n).toBe(1)
  })
})
