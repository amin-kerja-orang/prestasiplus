import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { PRACTICE_SESSIONS, practiceSeed } from '../../prisma/seed/practice'
import { createTestDatabase, type TestDatabase } from '../support/db'

const MODULES = [identitySeed, curriculumSeed, practiceSeed]
let db: TestDatabase

beforeAll(async () => {
  db = await createTestDatabase()
  await runSeeds(MODULES, { prisma: db.prisma })
}, 120_000)

afterAll(async () => {
  await db.drop()
})

const n = async (table: string, where = 'true') => Number((await db.query<{ n: string }>(`select count(*)::text n from ${table} where ${where}`))[0]?.n)

/** Everything the seed wrote, without database ids. */
async function snapshot() {
  return {
    sessions: await db.query(
      `select u.email, s.client_uuid::text, s.mode, sub.code subject, l.code level, c.chapter_number, s.question_count, s.correct_count, s.time_spent_sec,
              s.points_earned, s.coins_earned, s.status, s.started_at, s.completed_at, s.is_test, s.legacy_source, s.legacy_id, s.legacy_hash
         from practice_sessions s join users u on u.id = s.user_id join subjects sub on sub.id = s.subject_id
         left join education_levels l on l.id = s.education_level_id left join chapters c on c.id = s.chapter_id order by s.client_uuid`,
    ),
    answers: await db.query(
      `select a.client_uuid::text, a.selected_label, a.is_correct, a.answered_at, a.question_id, sub.code subject, a.question_type, a.historical, a.is_test, a.legacy_source, a.legacy_id
         from practice_answers a join subjects sub on sub.id = a.subject_id order by a.client_uuid, a.answered_at`,
    ),
    mastery: await db.query(
      `select u.email, sub.code subject, m.correct, m.answered, m.last_answered_at from mastery m join users u on u.id = m.user_id join subjects sub on sub.id = m.subject_id order by u.email, sub.code`,
    ),
  }
}

describe('practice demo seed (BE-12)', () => {
  it('is registered last, after identity and curriculum', () => {
    const names = seedModules.map((m) => m.name)
    expect(names.indexOf('practice')).toBe(names.length - 1)
    expect(names.indexOf('practice')).toBeGreaterThan(names.indexOf('curriculum'))
    expect(practiceSeed.kind ?? 'demo').toBe('demo')
  })

  it('writes the planned completed sessions for the two demo students and none for pelajar2', async () => {
    expect(await n('practice_sessions')).toBe(PRACTICE_SESSIONS.length)
    const perUser = await db.query<{ email: string; sessions: string }>(
      `select u.email, count(*)::text sessions from practice_sessions s join users u on u.id = s.user_id group by u.email order by u.email`,
    )
    expect(perUser).toEqual([
      { email: 'pelajar@demo.test', sessions: '2' },
      { email: 'pelajarmaju@demo.test', sessions: '2' },
    ])
    expect(await n('practice_sessions', "status <> 'completed'")).toBe(0)
    expect(await n('practice_session_questions')).toBe(0)
    expect(await n('practice_checks')).toBe(0)
  })

  it('the answers match the session figures and carry the curriculum dimensions with question_id NULL', async () => {
    expect(await n('practice_answers')).toBe(PRACTICE_SESSIONS.reduce((sum, s) => sum + s.questions, 0))
    for (const plan of PRACTICE_SESSIONS) {
      const rows = await db.query<{ is_correct: boolean; question_id: string | null; subject_id: string; education_level_id: string | null; chapter_id: string | null }>(
        `select a.is_correct, a.question_id::text, a.subject_id::text, a.education_level_id::text, a.chapter_id::text from practice_answers a where a.client_uuid = $1 order by a.answered_at`,
        [plan.clientUuid],
      )
      expect(rows).toHaveLength(plan.questions)
      expect(rows.filter((r) => r.is_correct)).toHaveLength(plan.correct)
      expect(rows.every((r) => r.question_id === null && r.subject_id !== null)).toBe(true)
      expect(rows.every((r) => (plan.level === null) === (r.education_level_id === null))).toBe(true)
      expect(rows.every((r) => (plan.mode === 'chapter') === (r.chapter_id !== null))).toBe(true)
      const session = await db.query<{ correct_count: number; points_earned: number; coins_earned: number }>(
        'select correct_count, points_earned, coins_earned from practice_sessions where client_uuid = $1',
        [plan.clientUuid],
      )
      expect(session[0]).toEqual({ correct_count: plan.correct, points_earned: plan.correct * 10, coins_earned: plan.correct })
    }
  })

  it('the mastery counters equal the answer log per user and subject', async () => {
    const fromLog = await db.query(
      `select user_id::text, subject_id::text, count(*) filter (where is_correct)::int correct, count(*)::int answered from practice_answers group by user_id, subject_id order by user_id, subject_id`,
    )
    const stored = await db.query(`select user_id::text, subject_id::text, correct, answered from mastery order by user_id, subject_id`)
    expect(stored).toEqual(fromLog)
    expect(stored.length).toBeGreaterThan(0)
  })

  it('never sets legacy_* and never flags test data', async () => {
    expect(await n('practice_sessions', 'legacy_source is not null or legacy_id is not null or legacy_hash is not null or is_test')).toBe(0)
    expect(await n('practice_answers', 'legacy_source is not null or legacy_id is not null or legacy_hash is not null or is_test or historical')).toBe(0)
  })

  it('is idempotent: a second run changes nothing, not even the counters', async () => {
    const before = await snapshot()
    await runSeeds(MODULES, { prisma: db.prisma })
    await runSeeds([practiceSeed], { prisma: db.prisma })
    expect(await snapshot()).toEqual(before)
  })

  it('is deterministic: a fresh database gets the same rows', async () => {
    const other = await createTestDatabase()
    try {
      await runSeeds(MODULES, { prisma: other.prisma })
      const mine = await snapshot()
      const rows = await other.query(
        `select u.email, s.client_uuid::text, s.mode, sub.code subject, l.code level, c.chapter_number, s.question_count, s.correct_count, s.time_spent_sec,
                s.points_earned, s.coins_earned, s.status, s.started_at, s.completed_at, s.is_test, s.legacy_source, s.legacy_id, s.legacy_hash
           from practice_sessions s join users u on u.id = s.user_id join subjects sub on sub.id = s.subject_id
           left join education_levels l on l.id = s.education_level_id left join chapters c on c.id = s.chapter_id order by s.client_uuid`,
      )
      expect(rows).toEqual(mine.sessions)
    } finally {
      await other.drop()
    }
  })

  it('skips quietly when the curriculum or an account is missing', async () => {
    const bare = await createTestDatabase()
    try {
      await runSeeds([practiceSeed], { prisma: bare.prisma })
      expect((await bare.query('select 1 from practice_sessions')).length).toBe(0)
      await runSeeds([identitySeed, practiceSeed], { prisma: bare.prisma })
      expect((await bare.query('select 1 from practice_sessions')).length).toBe(0)
    } finally {
      await bare.drop()
    }
  })

  it('the seed folder keeps its rules: no Math.random, Date.now or new Date() in practice.ts', () => {
    const dir = fileURLToPath(new URL('../../prisma/seed/', import.meta.url))
    expect(readdirSync(dir)).toContain('practice.ts')
    const source = readFileSync(`${dir}practice.ts`, 'utf8')
    expect(source).not.toMatch(/Math\.random|Date\.now\(|new Date\(\)/)
  })
})
