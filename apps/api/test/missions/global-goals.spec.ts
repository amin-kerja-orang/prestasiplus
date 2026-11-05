import { MissionTodayResponseSchema, TeacherMissionListResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { MissionsService } from '../../src/modules/classes/missions/missions.service'
import { START, TEACHER_A, STUDENT_1, bootMissionsApp, client, count, loadWorld, makeClass, type Client, type MissionsTestApp, type World } from './helpers'

const DAY = '2026-10-19'
const AT = new Date(START)

// S6-T07 Global goals against the real database: completion computed from practice_sessions and practice_answers of the day.
describe('S6-T07 Global goals (DB)', () => {
  let t: MissionsTestApp
  let w: World
  let service: MissionsService
  let prisma: PrismaService
  let pupil: Client
  let teacher: Client

  beforeAll(async () => {
    t = await bootMissionsApp()
    w = await loadWorld(t)
    service = t.get(MissionsService)
    prisma = t.get(PrismaService)
    pupil = await client(t, STUDENT_1)
    teacher = await client(t, TEACHER_A)
    await makeClass(t, w, w.teacherA, [w.student1], 'Kelas Matlamat')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const globalGoal = async (title: string, kind: string, target: number, reward: number, day = DAY): Promise<string> =>
    (
      await t.db.query<{ id: string }>(
        `insert into missions (scope, goal_kind, title, description, mission_type, mission_date, question_count, reward_coins, created_at)
         values ('global', $1, $2, 'Penerangan', 'harian', $3, $4, $5, now()) returning id::text`,
        [kind, title, day, target, reward],
      )
    )[0]?.id as string

  /** A session completed at `completedAt` with `answers` answer rows (correct for the first `correct`), each on `topicId`. */
  const session = async (completedAt: string, correct: number, answers: number, topicId: string | null, seconds = 60): Promise<string> => {
    const row = (
      await t.db.query<{ id: string }>(
        `insert into practice_sessions (user_id, mode, question_count, status, correct_count, time_spent_sec, completed_at, started_at)
         values ($1, 'random', $2, 'completed', $3, $4, $5, $5) returning id`,
        [w.student1, answers, correct, seconds, completedAt],
      )
    )[0] as { id: string }
    for (let i = 0; i < answers; i++) {
      await t.db.query(`insert into practice_answers (session_id, user_id, topic_id, is_correct, answered_at) values ($1, $2, $3, $4, $5)`, [row.id, w.student1, topicId, i < correct, completedAt])
    }
    return row.id
  }

  const evaluate = () => prisma.transaction((tx) => service.evaluateGlobalGoals({ userId: w.student1, day: DAY, isTest: false, at: AT, sessionId: null }, tx))

  it('pays a reached goal once and the pupil and the teacher list reflect it', async () => {
    const id = await globalGoal('Rajin DB', 'sessions_per_day', 2, 15)
    await session('2026-10-19T08:00:00+08:00', 1, 2, null)
    expect(await evaluate()).toEqual([])
    const row = MissionTodayResponseSchema.parse((await pupil.get('/missions/today')).body).data.find((m) => m.id === id)
    expect(row).toMatchObject({ global: true, goalKind: 'sessions_per_day', target: 2, progress: 1, completed: false })
    await session('2026-10-19T08:30:00+08:00', 1, 2, null)
    expect(await evaluate()).toEqual([{ missionId: id, coins: 15 }])
    expect(await evaluate()).toEqual([])
    expect(await count(t, 'mission_rewards where mission_id = $1 and student_id = $2', [id, w.student1])).toBe(1)
    const after = MissionTodayResponseSchema.parse((await pupil.get('/missions/today')).body).data.find((m) => m.id === id)
    expect(after).toMatchObject({ progress: 2, completed: true, status: 'completed' })
    const listed = TeacherMissionListResponseSchema.parse((await teacher.get('/guru/missions')).body).data.find((m) => m.id === id)
    expect(listed).toMatchObject({ global: true, goalKind: 'sessions_per_day', completedCount: 1 })
  })

  it('the Malaysia midnight boundary: a session at 23:59 the day before does not count, 00:00 does', async () => {
    const id = await globalGoal('Pagi DB', 'sessions_per_day', 1, 10)
    await t.db.query(`delete from practice_sessions where user_id = $1`, [w.student1])
    await session('2026-10-18T23:59:59+08:00', 1, 1, null)
    expect(await evaluate()).toEqual([])
    await session('2026-10-19T00:00:00+08:00', 1, 1, null)
    expect((await evaluate()).map((r) => r.missionId)).toContain(id)
  })

  it('minutes and distinct topics are computed from the stored rows', async () => {
    const minutes = await globalGoal('Minit DB', 'minutes_per_day', 10, 20)
    const topics = await globalGoal('Topik DB', 'topics_per_day', 2, 25)
    await t.db.query(`delete from practice_sessions where user_id = $1`, [w.student1])
    const topicIds = (await t.db.query<{ id: string }>(`select id::text from topics order by id limit 2`)).map((r) => r.id)
    await session('2026-10-19T10:00:00+08:00', 1, 1, topicIds[0] ?? null, 599)
    expect(await evaluate()).toEqual([])
    await session('2026-10-19T10:30:00+08:00', 1, 1, topicIds[1] ?? null, 1)
    const paid = (await evaluate()).map((r) => r.missionId).sort()
    expect(paid).toEqual([minutes, topics].sort())
  })
})
