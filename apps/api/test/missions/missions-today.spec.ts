import { MISSION_TYPE_LABELS, MissionTodayResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN, START, STUDENT_1, STUDENT_2, TEACHER_A,
  bootMissionsApp, client, errorIs, insertMission, insertSession, loadWorld,
  type Client, type MissionsTestApp, type World,
} from './helpers'

describe('GET /api/missions/today (M05 #21, BR-M10-17)', () => {
  let t: MissionsTestApp
  let w: World
  let s1: Client
  let s2: Client

  beforeAll(async () => {
    t = await bootMissionsApp()
    w = await loadWorld(t)
    s1 = await client(t, STUDENT_1)
    s2 = await client(t, STUDENT_2)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('401 "Unauthenticated." for an anonymous caller', async () => {
    const res = await t.http().get('/api/missions/today')
    errorIs(res, 401, 'UNAUTHORIZED', 'Unauthenticated.')
  })

  it('answers an empty single-page list, no-store, when there is no mission', async () => {
    const res = await s1.get('/missions/today')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const body = MissionTodayResponseSchema.parse(res.body)
    expect(body.data).toEqual([])
    expect(body.meta).toMatchObject({ page: 1, totalItems: 0, from: null, to: null })
  })

  it('lists only the missions the caller is a stored recipient of (BR-M10-17); other roles get an empty list too', async () => {
    const own = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1], title: 'Hanya Pelajar Satu' })
    const other = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student2], title: 'Hanya Pelajar Dua' })
    const mine = MissionTodayResponseSchema.parse((await s1.get('/missions/today')).body)
    expect(mine.data.map((m) => m.id)).toEqual([own])
    const theirs = MissionTodayResponseSchema.parse((await s2.get('/missions/today')).body)
    expect(theirs.data.map((m) => m.id)).toEqual([other])
    // The launching teacher and an admin are not recipients: no role check, an empty list.
    for (const who of [TEACHER_A, ADMIN]) {
      const res = await (await client(t, who)).get('/missions/today')
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
    }
  })

  it('returns the mock row shape: type label, subject name, 3 coins, resource fields', async () => {
    const id = await insertMission(t, w, {
      teacherId: w.teacherA,
      recipients: [w.student1],
      type: 'youtube',
      title: 'Misi Rujukan',
      questionCount: 8,
      resource: { title: 'Video Rujukan', url: 'https://example.test/video', note: 'Tonton dahulu' },
    })
    const row = MissionTodayResponseSchema.parse((await s1.get('/missions/today')).body).data.find((m) => m.id === id)
    expect(row).toEqual({
      id,
      title: 'Misi Rujukan',
      typeLabel: MISSION_TYPE_LABELS.youtube,
      subjectName: w.subjectName,
      questionCount: 8,
      coinsPerCorrect: 3,
      resourceTitle: 'Video Rujukan',
      resourceUrl: 'https://example.test/video',
      resourceNote: 'Tonton dahulu',
      status: 'new',
    })
  })

  it('lists the missions oldest first (created_at, then id)', async () => {
    const late = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1], title: 'Lewat', createdAt: '2026-10-19T08:00:00+08:00' })
    const early = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1], title: 'Awal', createdAt: '2026-10-01T08:00:00+08:00' })
    const ids = MissionTodayResponseSchema.parse((await s1.get('/missions/today')).body).data.map((m) => m.id)
    expect(ids.indexOf(early)).toBeLessThan(ids.indexOf(late))
    const created = ids.map((id) => Number(id))
    expect(created.length).toBeGreaterThan(2)
  })

  it('uses the Malaysia day: 00:00:00 +08:00 (still the previous day in UTC) starts it, the next midnight ends it', async () => {
    const day19 = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student2], day: '2026-10-19', title: 'Sembilan Belas' })
    const day20 = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student2], day: '2026-10-20', title: 'Dua Puluh' })
    const idsAt = async (at: string) => {
      t.clock.set(at)
      const who = await client(t, STUDENT_2)
      return (await who.get('/missions/today')).body.data.map((m: { id: string }) => m.id) as string[]
    }
    const first = await idsAt('2026-10-19T00:00:00+08:00') // 18 Oct 16:00 UTC
    expect(first).toContain(day19)
    expect(first).not.toContain(day20)
    const last = await idsAt('2026-10-19T23:59:59+08:00')
    expect(last).toContain(day19)
    expect(last).not.toContain(day20)
    const next = await idsAt('2026-10-20T00:00:00+08:00')
    expect(next).toContain(day20)
    expect(next).not.toContain(day19)
    t.clock.set(START)
  })

  it('status comes from the caller\'s linked sessions: new, in_progress, completed (completed beats in progress)', async () => {
    const a = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1, w.student2], title: 'Status A' })
    const b = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1, w.student2], title: 'Status B' })
    const c = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1, w.student2], title: 'Status C' })
    await insertSession(t, w.student1, { missionId: b }, 'in_progress')
    await insertSession(t, w.student1, { missionId: c }, 'in_progress')
    await insertSession(t, w.student1, { missionId: c }, 'completed')
    // Another pupil's session never counts for the caller.
    await insertSession(t, w.student2, { missionId: a }, 'completed')
    const status = async (who: Client) =>
      Object.fromEntries(MissionTodayResponseSchema.parse((await who.get('/missions/today')).body).data.filter((m) => [a, b, c].includes(m.id)).map((m) => [m.id, m.status]))
    expect(await status(s1)).toEqual({ [a]: 'new', [b]: 'in_progress', [c]: 'completed' })
    expect(await status(s2)).toEqual({ [a]: 'completed', [b]: 'new', [c]: 'new' })
  })

  it('leaves out missions of Mod Pelajar (is_test) for a real user', async () => {
    const hidden = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1], title: 'Data ujian', isTest: true })
    const ids = MissionTodayResponseSchema.parse((await s1.get('/missions/today')).body).data.map((m) => m.id)
    expect(ids).not.toContain(hidden)
  })
})
