import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ClassesPorts } from '../../src/modules/classes'
import { PracticePorts } from '../../src/modules/practice'
import { PracticeAssignmentsAdapter } from '../../src/modules/classes/missions/practice-assignments.adapter'
import { STUDENT_1, STUDENT_2, bootMissionsApp, client, insertMission, insertRemedial, loadWorld, publishedMcq, type Client, type MissionsTestApp, type World } from './helpers'

const START_URL = '/practice/sessions'

describe('the real application has the BE-18 assignment source bound (all feature modules)', () => {
  let t: MissionsTestApp
  let w: World
  let s1: Client
  let s2: Client

  beforeAll(async () => {
    t = await bootMissionsApp({ full: true })
    w = await loadWorld(t)
    // Subscribed pupils: the start path checks the trial first (BR-07), which is not what is tested here.
    for (const id of [w.student1, w.student2]) await t.db.query(`insert into comp_students (user_id, package_expires_on) values ($1, '2027-12-31') on conflict do nothing`, [id])
    s1 = await client(t, STUDENT_1)
    s2 = await client(t, STUDENT_2)
    for (let i = 0; i < 6; i++) await publishedMcq(t, w, { text: `Soalan wiring ${String(i)}` })
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  it('PracticePorts.assignments is the BE-18 adapter, not the "not ready" default', () => {
    expect(t.get(PracticePorts).assignments).toBeInstanceOf(PracticeAssignmentsAdapter)
  })

  it('mission: a pupil who is not a recipient gets the mock\'s 404; a recipient gets past the resolution', async () => {
    const id = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1] })
    const denied = await s2.post(START_URL, { mode: 'mission', missionId: id })
    expect(denied.status, JSON.stringify(denied.body)).toBe(404)
    expect(denied.body.error.code).toBe('NOT_FOUND')
    const allowed = await s1.post(START_URL, { mode: 'mission', missionId: id })
    // Past resolution: no 404 and never the old default 422 SET_NOT_READY. Without a question source bound by
    // BE-09 the draw is empty (422 NOT_ENOUGH_QUESTIONS); once it is bound the start succeeds (201).
    expect([201, 422], JSON.stringify(allowed.body)).toContain(allowed.status)
    if (allowed.status === 422) expect(allowed.body.error.code).toBe('NOT_ENOUGH_QUESTIONS')
  })

  it('mission: an unknown id or a mission of another day is 404', async () => {
    const past = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1], day: '2026-10-01' })
    for (const missionId of ['987654321', past]) expect((await s1.post(START_URL, { mode: 'mission', missionId })).status).toBe(404)
  })

  it('remedial: only the test\'s own pupil resolves it; another pupil, a cancelled test and an unknown id are 404', async () => {
    const [q] = [await publishedMcq(t, w)]
    const own = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, questionIds: [q] })
    const cancelled = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, status: 'cancelled', questionIds: [q] })
    expect((await s2.post(START_URL, { mode: 'remedial', remedialTestId: own })).status).toBe(404)
    for (const remedialTestId of [cancelled, '987654321']) expect((await s1.post(START_URL, { mode: 'remedial', remedialTestId })).status).toBe(404)
    const allowed = await s1.post(START_URL, { mode: 'remedial', remedialTestId: own })
    expect([201, 422], JSON.stringify(allowed.body)).toContain(allowed.status)
    if (allowed.status === 422) expect(allowed.body.error.code).toBe('NOT_ENOUGH_QUESTIONS')
  })

  it('question_set: an unknown id is 404 (no longer the old default 422 SET_NOT_READY)', async () => {
    const res = await s1.post(START_URL, { mode: 'question_set', questionSetId: '987654321' })
    expect(res.status, JSON.stringify(res.body)).toBe(404)
  })
})

describe('a port that is already bound (a test fake) is kept, never overwritten', () => {
  it('the app boots and the fakes stay in place', async () => {
    const fakeAssignments = { resolve: () => Promise.resolve({ status: 'not_found' as const }), remedialCompleted: () => Promise.resolve() }
    const fakeMissions = { hasMission: () => Promise.resolve(true) }
    const t = await bootMissionsApp({
      beforeInit: (app) => {
        app.get(PracticePorts).provideAssignments(fakeAssignments)
        app.get(ClassesPorts).provideMissions(fakeMissions)
      },
    })
    try {
      expect(t.get(PracticePorts).assignments).toBe(fakeAssignments)
      expect(t.get(ClassesPorts).missions).toBe(fakeMissions)
    } finally {
      await t.close()
    }
  }, 120_000)
})
