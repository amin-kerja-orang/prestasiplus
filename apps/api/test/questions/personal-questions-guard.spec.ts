import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { PersonalQuestionsRepository } from '../../src/modules/classes/teacher-tools/personal-questions.repository'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { tagOf, userIdOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * S6-T16 (ADD-21, security M2/M3): the SQL of the in-use guard of a personal question. "Active Misi" = the mission date is today (Malaysia) or
 * later AND a session of that mission holds the question; plus any OPEN session. Needs Docker (testcontainers). The service rules with fakes
 * are in `test/classes/personal-questions.spec.ts`.
 */
describe('personal question in-use guard (DB)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: PersonalQuestionsRepository
  let tag: Tag
  let teacher: string
  let pupil: string
  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

  const question = () =>
    svc.createPersonal({ subjectId: tag.subjectId, educationLevelId: tag.levelId, difficulty: 3, text: 'Soalan pengawal', options: [{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' }], correctIndex: 0 }, teacher)
  const mission = async (date: string) =>
    (await q(`insert into missions (teacher_id, title, mission_type, mission_date, subject_id, question_count) values ($1, 'M', 'latih_tubi', $2::date, $3, 5) returning id::text id`, [teacher, date, tag.subjectId]))[0]!.id
  const session = async (missionId: string | null, status: 'in_progress' | 'completed', questionId: string) => {
    const [s] = await q(
      `insert into practice_sessions (user_id, mode, mission_id, question_count, status, started_at) values ($1, $2, $3, 1, $4, now()) returning id::text id`,
      [pupil, missionId === null ? 'random' : 'mission', missionId, status],
    )
    await q(`insert into practice_session_questions (session_id, position, question_id, question_version_no) values ($1::uuid, 1, $2, 1)`, [s!.id, questionId])
  }

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = new PersonalQuestionsRepository(t.app.get(PrismaService), t.app.get(QuestionsRepository))
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    teacher = await userIdOf(t.db, 'admin@demo.test')
    pupil = (await q(`select id::text id from users where id <> $1 order by id limit 1`, [teacher]))[0]!.id
  })

  afterAll(async () => {
    await t.close()
  })

  it('a mission dated today holds the question (the date boundary is inclusive), tomorrow too, yesterday does not', async () => {
    const today = '2026-11-05'
    const held = await question()
    await session(await mission(today), 'completed', held)
    expect(await repo.usedByActiveMission(held, today)).toBe(true)
    expect(await repo.usedByActiveMission(held, '2026-11-06')).toBe(false) // the mission date is now in the past

    const past = await question()
    await session(await mission('2026-11-04'), 'completed', past)
    expect(await repo.usedByActiveMission(past, today)).toBe(false)

    const future = await question()
    await session(await mission('2026-11-06'), 'completed', future)
    expect(await repo.usedByActiveMission(future, today)).toBe(true)
  })

  it('pool membership alone does not block (no session holds it)', async () => {
    const free = await question()
    await mission('2026-11-05')
    expect(await repo.usedByActiveMission(free, '2026-11-05')).toBe(false)
    expect(await repo.heldByOpenSession(free)).toBe(false)
  })

  it('an open session blocks, a submitted one does not', async () => {
    const open = await question()
    await session(null, 'in_progress', open)
    expect(await repo.heldByOpenSession(open)).toBe(true)
    const done = await question()
    await session(null, 'completed', done)
    expect(await repo.heldByOpenSession(done)).toBe(false)
  })

  it('a delete cleans the Ulang Kaji rows of the question in the same transaction and refuses while held', async () => {
    const id = await question()
    await q(`insert into revision_queue (user_id, question_id, subject_id, wrong_times, last_wrong_at) values ($1, $2, $3, 1, now())`, [pupil, id, tag.subjectId])
    await expect(svc.removePersonal(id, { guard: () => Promise.reject(new Error('in use')) })).rejects.toThrow('in use')
    expect((await q(`select count(*)::text id from revision_queue where question_id = $1`, [id]))[0]!.id).toBe('1')
    expect(await svc.removePersonal(id, { guard: () => repo.heldByOpenSession(id), cleanup: () => repo.dropRevisionRows(id) })).toBe(true)
    expect((await q(`select count(*)::text id from revision_queue where question_id = $1`, [id]))[0]!.id).toBe('0')
  })
})
