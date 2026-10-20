import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { STUDENT_1, STUDENT_2, TEACHER_A, bootMissionsApp, client, errorIs, loadWorld, type Client, type MissionsTestApp, type World } from './helpers'

const CANCEL = '/guru/command-center/remedial/cancel'
const GEN = '/guru/command-center/remedial/generate'

describe('missions and remedial throttles (D57, 429)', () => {
  let t: MissionsTestApp
  let w: World
  let teacher: Client
  let student: Client
  let other: Client

  beforeAll(async () => {
    t = await bootMissionsApp({ env: { THROTTLE_CLASSES_READ_PER_MINUTE: '3', THROTTLE_CLASSES_WRITE_PER_MINUTE: '2' } })
    w = await loadWorld(t)
    teacher = await client(t, TEACHER_A)
    student = await client(t, STUDENT_1)
    other = await client(t, STUDENT_2)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('writes are limited per user: the 3rd cancel/generate in the window is 429 with Retry-After, then the window reopens', async () => {
    errorIs(await teacher.post(CANCEL, { quizId: '987654321' }), 404, 'NOT_FOUND', 'Ujian remedial tidak dijumpai.')
    errorIs(await teacher.post(GEN, { studentId: w.studentOther, subject: w.subjectName }), 403, 'FORBIDDEN', 'Pelajar ini bukan murid anda.')
    for (const [path, body] of [[CANCEL, { quizId: '987654321' }], [GEN, { studentId: w.student1, subject: w.subjectName }]] as const) {
      const res = await teacher.post(path, body)
      expect(res.status, path).toBe(429)
      expect(res.body.error.code).toBe('RATE_LIMITED')
      expect(res.body.error.retryAfter).toBeGreaterThan(0)
      expect(res.headers['retry-after']).toBeTruthy()
    }
    t.clock.advance(61_000)
    errorIs(await teacher.post(CANCEL, { quizId: '987654321' }), 404, 'NOT_FOUND', 'Ujian remedial tidak dijumpai.')
  })

  it('reads are limited per user across the three student routes and the teacher reads (one bucket per user)', async () => {
    t.clock.advance(61_000)
    expect((await student.get('/missions/today')).status).toBe(200)
    expect((await student.get('/remedial-tests/mine')).status).toBe(200)
    expect((await student.get('/remedial-tests/1')).status).toBe(404)
    const limited = await student.get('/missions/today')
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('RATE_LIMITED')
    // another user has an own bucket
    expect((await other.get('/missions/today')).status).toBe(200)
    // the teacher reads share the teacher's read bucket
    for (const path of ['/guru/remedial-progress', '/guru/command-center/remedial/scan', '/guru/remedial-progress']) expect((await teacher.get(path)).status).toBe(200)
    expect((await teacher.get('/guru/remedial-progress')).status).toBe(429)
    t.clock.advance(61_000)
    expect((await student.get('/missions/today')).status).toBe(200)
  })
})
