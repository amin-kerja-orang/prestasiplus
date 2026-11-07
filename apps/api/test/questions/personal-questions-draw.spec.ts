import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { MissionsRepository } from '../../src/modules/classes/missions/missions.repository'
import { PracticeAssignmentsAdapter } from '../../src/modules/classes/missions/practice-assignments.adapter'
import { QuestionPool } from '../../src/modules/classes/missions/question-pool'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { adminActor, tagOf, userIdOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * S6-T16 (DM-42, FR-GUR-44a-10, AC-GUR-44a-10): the personal question writes of `QuestionsService` and the mission pool of
 * `QuestionsRepository` (`ownerPrivateUserId`). Needs Docker (testcontainers); the SQL and service rules are also covered without a database
 * by `test/classes/personal-questions.spec.ts`.
 */
describe('personal questions in the mission pool (DM-42)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let tag: Tag
  let ownerA: string
  let ownerB: string
  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

  const personal = (userId: string, text: string, level: string = tag.levelId) =>
    svc.createPersonal(
      { subjectId: tag.subjectId, educationLevelId: level, difficulty: 3, text, options: [{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' }], correctIndex: 1, referenceUrl: 'https://example.org/r' },
      userId,
    )

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    ownerA = await userIdOf(t.db, 'admin@demo.test')
    ownerB = (await q(`select id::text id from users where id <> $1 order by id limit 1`, [ownerA]))[0]!.id
  })

  afterAll(async () => {
    await t.close()
  })

  it('creates an approved, live, private question with the owner, no creator and the link', async () => {
    const id = await personal(ownerA, 'Soalan peribadi A1')
    const [row] = await t.db.query<{ visibility: string; owner: string; created_by: string | null; status: string; live: number; url: string }>(
      `select v.visibility, v.owner_user_id::text owner, q.created_by_id::text created_by, v.status, q.live_version_no live, v.reference_url url
         from questions q join question_versions v on v.question_id = q.id and v.version_no = q.latest_version_no where q.id = $1`,
      [id],
    )
    expect(row).toMatchObject({ visibility: 'teacher_private', owner: ownerA, created_by: null, status: 'approved', live: 1, url: 'https://example.org/r' })
  })

  it('the pool is the bank plus ONLY the owner\'s private questions of the Subjek + Tingkatan, at equal weight', async () => {
    const mine = await personal(ownerA, 'Soalan peribadi A2')
    const theirs = await personal(ownerB, 'Soalan peribadi B1')
    const base = { subjectId: tag.subjectId, educationLevelIds: [tag.levelId] }
    const withOwner = await repo.sampleIds({ ...base, ownerPrivateUserId: ownerA }, 500, 1)
    expect(withOwner).toContain(mine)
    expect(withOwner).not.toContain(theirs)
    const bankOnly = await repo.sampleIds(base, 500, 1)
    expect(bankOnly).not.toContain(mine)
    // Equal weight: the draw is one seeded hash order over the union, so asking for the whole pool returns exactly bank + the owner's personal
    // ones. The size comes from `count` (the same scope), not from `eligibleIds`, so it does not depend on ELIGIBLE_IDS_MAX.
    const size = await repo.count({ ...base, status: 'approved', active: true, ownerPrivateUserId: ownerA })
    const bankSize = await repo.count({ ...base, status: 'approved', active: true })
    expect(size).toBeGreaterThan(bankSize)
    expect((await repo.sampleIds({ ...base, ownerPrivateUserId: ownerA }, size, 7)).length).toBe(Math.min(size, 500))
  })

  it('another Tingkatan of the same owner is not in the pool', async () => {
    const other = (await q(`select id::text id from education_levels where id <> $1 and stage <> 'primary' and is_active order by id limit 1`, [tag.levelId]))[0]!.id
    const id = await personal(ownerA, 'Soalan peribadi tingkatan lain', other)
    const pool = await repo.sampleIds({ subjectId: tag.subjectId, educationLevelIds: [tag.levelId], ownerPrivateUserId: ownerA }, 500, 1)
    expect(pool).not.toContain(id)
  })

  it('rewrites in place without changing owner or visibility, and removes', async () => {
    const id = await personal(ownerA, 'Soalan peribadi untuk disunting')
    await svc.rewritePersonal(id, 1, { subjectId: tag.subjectId, educationLevelId: tag.levelId, difficulty: 4, text: 'Teks baharu', options: [{ text: 'w' }, { text: 'x' }, { text: 'y' }, { text: 'z' }], correctIndex: 2, referenceUrl: null }, ownerA)
    const [row] = await t.db.query<{ stem: string; visibility: string; owner: string; url: string | null }>(
      `select v.stem_ms stem, v.visibility, v.owner_user_id::text owner, v.reference_url url from question_versions v where v.question_id = $1`,
      [id],
    )
    expect(row).toMatchObject({ stem: 'Teks baharu', visibility: 'teacher_private', owner: ownerA, url: null })
    expect(await svc.removePersonal(id)).toBe(true)
    expect(await svc.removePersonal(id)).toBe(false)
  })

  it('the admin actor is not needed: a personal question never enters Semakan or a bank count', async () => {
    const before = await repo.count({})
    await personal(ownerA, 'Soalan peribadi untuk kiraan')
    expect(await repo.count({})).toBe(before)
    expect((await adminActor(t.db)).role).toBe('admin')
  })

  describe('the mission draw by Tingkatan (lead ruling: no T4/T5 top-up for a T1-T3 class)', () => {
    const makeMission = async (teacher: string, level: string, pupil: string, chapterId: string | null = null) => {
      const [cls] = await q(`insert into classrooms (kind, name, teacher_id, education_level_id, academic_year) values ('classroom', 'Kelas T16', $1, $2, 2026) returning id::text id`, [teacher, level])
      await q(`insert into enrolments (classroom_id, student_id) values ($1, $2)`, [cls!.id, pupil])
      return { id: '1', teacherId: teacher, classroomId: cls!.id, missionType: 'latih_tubi', subjectId: tag.subjectId, chapterId, questionCount: 10, coinsPerCorrect: 3 } as never
    }
    const draw = async (mission: never, pupil: string): Promise<string[]> => {
      const prisma = t.app.get(PrismaService)
      const adapter = new PracticeAssignmentsAdapter(new MissionsRepository(prisma), new QuestionPool(repo), {} as never)
      return (adapter as unknown as { missionQuestionIds(m: unknown, u: string): Promise<string[]> }).missionQuestionIds(mission, pupil)
    }
    let pupil: string
    let t2: string

    beforeAll(async () => {
      pupil = (await q(`select id::text id from users where id not in ($1, $2) order by id limit 1`, [ownerA, ownerB]))[0]!.id
      t2 = (await q(`select id::text id from education_levels where code in ('T1', 'T2', 'T3') and is_active order by code limit 1`))[0]!.id
    })

    it('a T1-T3 class mission gets ONLY the owner\'s personal questions of that Tingkatan (the bank serves T4/T5 only)', async () => {
      const mine = await personal(ownerA, 'Soalan peribadi T-rendah', t2)
      const ids = await draw(await makeMission(ownerA, t2, pupil), pupil)
      expect(ids).toEqual([mine])
    })

    it('a T1-T3 class mission with no personal question draws nothing (the existing empty-mission state)', async () => {
      const ids = await draw(await makeMission(ownerB, t2, pupil), pupil)
      expect(ids).toEqual([])
    })

    it('a T4 class mission draws bank + the owner\'s T4 personal questions, never another teacher\'s', async () => {
      const mine = await personal(ownerA, 'Soalan peribadi T4 untuk misi')
      const theirs = await personal(ownerB, 'Soalan peribadi T4 guru lain')
      const ids = await draw(await makeMission(ownerA, tag.levelId, pupil), pupil)
      expect(ids).toContain(mine)
      expect(ids).not.toContain(theirs)
    })

    it('a Bab with no bank question falls back to the SPM pool of the SAME Tingkatan only', async () => {
      const emptyBab = (await q(`select c.id::text id from chapters c where c.subject_id = $1 and c.education_level_id <> $2 limit 1`, [tag.subjectId, tag.levelId]))[0]?.id ?? null
      const ids = await draw(await makeMission(ownerA, t2, pupil, emptyBab), pupil)
      // The class is T1-T3: the SPM pool (T4/T5) must not top it up, whatever the Bab holds.
      const levels = ids.length === 0 ? [] : (await q(`select distinct v.education_level_id::text id from question_versions v join questions qq on qq.id = v.question_id and qq.live_version_no = v.version_no where qq.id = any($1::bigint[])`, [ids]))
      for (const l of levels) expect(l.id).toBe(t2)
    })
  })
})
