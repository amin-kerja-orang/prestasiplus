import { MISSION_DAILY_CAP, MISSION_MESSAGES, TeacherMissionListResponseSchema, TeacherMissionResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  STUDENT_1, STUDENT_2, TEACHER_A, TEACHER_B,
  bootMissionsApp, client, count, errorIs, insertMission, insertSession, loadWorld, makeClass,
  type Client, type MissionsTestApp, type World,
} from './helpers'

// The test clock is 2026-10-19 09:00 +08:00.
const TODAY = '2026-10-19'

describe('API-GUR-11 teacher Misi Harian: GET, POST, DELETE /api/guru/missions (S6-T07)', () => {
  let t: MissionsTestApp
  let w: World
  let teacherA: Client
  let teacherB: Client
  let student: Client
  let classA: string

  const payload = (over: Record<string, unknown> = {}) => ({ title: 'Jawab 20 soalan', targetQuestions: 20, rewardCoins: 15, date: TODAY, subjectId: w.tag.subjectId, ...over })

  beforeAll(async () => {
    t = await bootMissionsApp()
    w = await loadWorld(t)
    teacherA = await client(t, TEACHER_A)
    teacherB = await client(t, TEACHER_B)
    student = await client(t, STUDENT_1)
    classA = await makeClass(t, w, w.teacherA, [w.student1], 'Kelas Misi A')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('401 anonymous and 403 for a pupil on all three routes', async () => {
    for (const [method, path] of [['get', '/guru/missions'], ['post', '/guru/missions'], ['delete', '/guru/missions/1']] as const) {
      const anon = await (t.http() as never as Record<string, (p: string) => Promise<{ status: number; body: never }>>)[method]!(`/api${path}`)
      expect(anon.status).toBe(401)
    }
    errorIs(await student.get('/guru/missions'), 403, 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
    errorIs(await student.post('/guru/missions', payload()), 403, 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
  })

  it('POST 201 creates a harian mission for one class and snapshots its pupils; a pupil enrolled later is not added', async () => {
    const res = await teacherA.post('/guru/missions', payload({ classroomId: classA, description: 'Fokus Bab 3' }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const m = TeacherMissionResponseSchema.parse(res.body).data
    expect(m).toMatchObject({ title: 'Jawab 20 soalan', description: 'Fokus Bab 3', targetQuestions: 20, rewardCoins: 15, date: TODAY, classroomId: classA, global: false, completedCount: 0 })
    expect(await count(t, 'missions where id = $1 and mission_type = $2', [m.id, 'harian'])).toBe(1)
    const items = (await t.db.query<{ student_id: string }>(`select student_id::text from mission_items where mission_id = $1`, [m.id])).map((r) => r.student_id)
    expect(items).toEqual([w.student1])
    await t.get((await import('../../src/modules/classes')).ClassesRepository).enrol({ classroomId: classA, studentId: w.student2, source: 'teacher', now: new Date() })
    expect(await count(t, 'mission_items where mission_id = $1', [m.id])).toBe(1)
    // The pupil reads it with description and reward.
    const today = (await student.get('/missions/today')).body.data as { id: string; description: string; rewardCoins: number }[]
    expect(today.find((r) => r.id === m.id)).toMatchObject({ description: 'Fokus Bab 3', rewardCoins: 15 })
    expect(((await (await client(t, STUDENT_2)).get('/missions/today')).body.data as { id: string }[]).some((r) => r.id === m.id)).toBe(false)
  })

  it('POST with no class snapshots the pupils of all own active classes', async () => {
    const res = await teacherA.post('/guru/missions', payload({ title: 'Semua kelas' }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const m = TeacherMissionResponseSchema.parse(res.body).data
    expect(m.classroomId).toBeNull()
    const items = (await t.db.query<{ student_id: string }>(`select student_id::text from mission_items where mission_id = $1`, [m.id])).map((r) => r.student_id)
    expect(items).toContain(w.student1)
    expect(items).toContain(w.student2)
  })

  it('POST 422 with fields: past date (MYT), empty title, unknown subject; reward 101 is ERR-GAME-17 and rides along', async () => {
    const res = await teacherA.post('/guru/missions', payload({ date: '2026-10-18', rewardCoins: 101, title: ' ', subjectId: '99999999' }))
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('MISSION_REWARD_TOO_HIGH')
    expect(res.body.error.message).toBe('Ganjaran misi melebihi had.')
    expect(res.body.error.fields).toEqual({
      title: MISSION_MESSAGES.titleRequired,
      rewardCoins: 'Ganjaran misi melebihi had.',
      date: MISSION_MESSAGES.datePast,
      subjectId: MISSION_MESSAGES.subjectRequired,
    })
    const only = await teacherA.post('/guru/missions', payload({ date: '2026-10-18', subjectId: '99999999', title: ' ' }))
    expect(only.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('POST with another teacher\'s class is the generic 404', async () => {
    const classB = await makeClass(t, w, w.teacherC, [], 'Kelas Guru C')
    errorIs(await teacherA.post('/guru/missions', payload({ classroomId: classB })), 404, 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
  })

  it('POST: the 6th mission of the creation day is 422 without fields', async () => {
    const have = await count(t, 'missions where teacher_id = $1', [w.teacherA])
    for (let i = have; i < MISSION_DAILY_CAP; i++) expect((await teacherA.post('/guru/missions', payload({ title: `Isi ${String(i)}` }))).status).toBe(201)
    const res = await teacherA.post('/guru/missions', payload({ title: 'Keenam' }))
    errorIs(res, 422, 'VALIDATION_ERROR', MISSION_MESSAGES.capReached)
    expect(res.body.error.fields).toBeUndefined()
    // Another teacher is not affected.
    expect((await teacherB.post('/guru/missions', payload({ title: 'Guru B' }))).status).toBe(201)
  })

  it('GET lists the teacher\'s own missions (global false), newest date first, with the completed pupils of the teacher\'s classes', async () => {
    const own = (await teacherA.get('/guru/missions')).body.data as { id: string }[]
    const ownId = own[0]?.id as string
    await insertSession(t, w.student1, { missionId: ownId }, 'completed')
    await insertSession(t, w.student1, { missionId: ownId }, 'completed')
    await insertSession(t, w.studentOther, { missionId: ownId }, 'completed')
    await insertSession(t, w.student2, { missionId: ownId }, 'in_progress')
    const res = await teacherA.get('/guru/missions')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const rows = TeacherMissionListResponseSchema.parse(res.body).data
    expect(rows.find((r) => r.id === ownId)?.completedCount).toBe(1)
    expect(rows.every((r) => !r.global && r.title !== 'Guru B')).toBe(true)
    const dates = rows.map((r) => r.date)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('GET appends the active S7 challenges as Global rows after the own missions; their count is over the teacher\'s pupils; DELETE of one is 404', async () => {
    const ch = (
      await t.db.query<{ id: string }>(
        `insert into challenges (title, description, challenge_type, metric, target_value, reward_syiling, reward_xp, difficulty, sort_order, is_active)
         values ('Cabaran DB', 'Selesaikan kuiz', 'quiz_count', 'sessions', 3, 15, 20, 'easy', 1, true) returning id::text`,
      )
    )[0]?.id as string
    await t.db.query(`insert into challenge_completions (user_id, challenge_id, completion_date) values ($1, $2, $3), ($4, $2, $3)`, [w.student1, ch, TODAY, w.studentOther])
    const rows = TeacherMissionListResponseSchema.parse((await teacherA.get('/guru/missions')).body).data
    const globals = rows.filter((r) => r.global)
    const row = globals.find((r) => r.id === `challenge-${ch}`)
    expect(row).toMatchObject({ title: 'Cabaran DB', description: 'Selesaikan kuiz', targetQuestions: 3, rewardCoins: 15, date: TODAY, classroomId: null, subjectId: null, subjectName: null, completedCount: 1 })
    expect(rows.findIndex((r) => r.global)).toBe(rows.filter((r) => !r.global).length) // own missions first
    expect((await teacherA.del(`/guru/missions/challenge-${ch}`)).status).toBe(404)
    expect(await count(t, 'challenges where id = $1', [ch])).toBe(1)
  })

  it('DELETE: own 200 { deleted: 1 } with its recipients; another teacher\'s and unknown 404', async () => {
    const own = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1], type: 'harian', title: 'Padam saya', day: TODAY, createdAt: '2026-10-10T09:00:00+08:00' })
    const res = await teacherA.del(`/guru/missions/${own}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body).toEqual({ data: { deleted: 1 } })
    expect(await count(t, 'mission_items where mission_id = $1', [own])).toBe(0)

    const theirs = await insertMission(t, w, { teacherId: w.teacherC, recipients: [], type: 'harian', title: 'Guru C', day: TODAY, createdAt: '2026-10-10T09:00:00+08:00' })
    for (const id of [theirs, '987654321']) expect((await teacherA.del(`/guru/missions/${id}`)).status).toBe(404)
    expect(await count(t, 'missions where id = $1', [theirs])).toBe(1)
  })
})

describe('S6-T07 cap race (DB)', () => {
  let t: MissionsTestApp
  let w: World

  beforeAll(async () => {
    t = await bootMissionsApp()
    w = await loadWorld(t)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('two parallel creates with 4 missions already today: exactly one 201, one cap 422, 5 rows', async () => {
    const teacher = await client(t, TEACHER_A)
    for (let i = 0; i < MISSION_DAILY_CAP - 1; i++) await insertMission(t, w, { teacherId: w.teacherA, recipients: [], type: 'harian', title: `Sedia ${String(i)}`, day: TODAY })
    const body = (title: string) => ({ title, targetQuestions: 5, rewardCoins: 5, date: TODAY, subjectId: w.tag.subjectId })
    const results = await Promise.all([teacher.post('/guru/missions', body('Lumba A')), teacher.post('/guru/missions', body('Lumba B'))])
    expect(results.map((r) => r.status).sort()).toEqual([201, 422])
    const refused = results.find((r) => r.status === 422)
    errorIs(refused as NonNullable<typeof refused>, 422, 'VALIDATION_ERROR', MISSION_MESSAGES.capReached)
    expect(await count(t, 'missions where teacher_id = $1', [w.teacherA])).toBe(MISSION_DAILY_CAP)
  })
})
