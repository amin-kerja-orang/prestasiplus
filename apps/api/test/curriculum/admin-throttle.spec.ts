import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootCurriculumApp, expectError, idOf, loginAs, type Client, type CurriculumTestApp } from './helpers'

/** BE-08 follow-up (LEAD 2026-10-20, D57a): every curriculum admin write is limited per user; reads are not. */
describe('curriculum write rate limit', () => {
  let t: CurriculumTestApp
  let admin: Client
  let student: Client
  let bm: string
  let d1: string
  const api = '/api/admin/curriculum'

  beforeAll(async () => {
    t = await bootCurriculumApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '6' } })
    admin = await loginAs(t, 'admin@demo.test')
    student = await loginAs(t, 'pelajar@demo.test')
    bm = await idOf(t.db, 'subjects', 'BM')
    d1 = await idOf(t.db, 'education_levels', 'D1')
  })
  afterAll(async () => {
    await t.close()
  })

  it('reads are never limited: 40 admin and learner reads in a minute all answer 200', async () => {
    for (let i = 0; i < 20; i++) {
      expect((await admin.get('/api/admin/subjects')).status).toBe(200)
      expect((await admin.get(`${api}?subjectId=${bm}&educationLevelId=${d1}`)).status).toBe(200)
      expect((await student.get('/api/subjects')).status).toBe(200)
    }
  })

  it('writes: the 7th in a minute is 429 with retryAfter and Retry-After, for create, update, toggle and delete alike', async () => {
    t.clock.advance(61_000)
    const created: string[] = []
    for (let i = 0; i < 3; i++) {
      const res = await admin.post(`${api}/chapters`, { subjectId: bm, educationLevelId: d1, name: `Bab ${i}`, chapterNumber: 80 + i })
      expect(res.status).toBe(201)
      created.push(res.body.data.id)
    }
    expect((await admin.put(`${api}/chapters/${created[0]}`, { subjectId: bm, educationLevelId: d1, name: 'Bab Baharu' })).status).toBe(200)
    expect((await admin.delete(`${api}/chapters/${created[1]}`)).status).toBe(200)
    expect((await admin.patch('/api/admin/subjects/' + bm + '/active', { isActive: true })).status).toBe(200)
    // Seventh call: over the ceiling of 6, whatever the route.
    const limited = await admin.delete(`${api}/chapters/${created[2]}`)
    const err = expectError(limited, 'RATE_LIMITED', 'Too Many Attempts.')
    expect(err.retryAfter).toBeGreaterThanOrEqual(1)
    expect(err.retryAfter).toBeLessThanOrEqual(60)
    expect(limited.headers['retry-after']).toBe(String(err.retryAfter))
    // The refused delete did nothing.
    expect((await admin.get(`${api}/chapters/${created[2]}`)).status).toBe(200)
    // Every write route shares the counter.
    for (const res of [
      await admin.post('/api/admin/education-levels', {}),
      await admin.put(`/api/admin/education-levels/${d1}`, {}),
      await admin.patch(`/api/admin/education-levels/${d1}/active`, { isActive: true }),
      await admin.delete(`/api/admin/education-levels/${d1}`),
      await admin.post('/api/admin/subjects', {}),
      await admin.put(`/api/admin/subjects/${bm}`, {}),
      await admin.delete(`/api/admin/subjects/${bm}`),
      await admin.post(`${api}/topics`, {}),
      await admin.put(`${api}/topics/1`, {}),
      await admin.delete(`${api}/topics/1`),
      await admin.post(`${api}/subtopics`, {}),
      await admin.put(`${api}/subtopics/1`, {}),
      await admin.delete(`${api}/subtopics/1`),
      await admin.put(`${api}/chapters/${created[2]}`, {}),
      await admin.post(`${api}/chapters`, {}),
    ]) {
      expect(res.status, JSON.stringify(res.body)).toBe(429)
      expect(res.headers['retry-after']).toBeTruthy()
    }
    // Reads still work while writes are limited.
    expect((await admin.get('/api/admin/subjects')).status).toBe(200)
  })

  it('the window resets after a minute', async () => {
    t.clock.advance(61_000)
    expect((await admin.post('/api/admin/subjects', { name: 'S', nameEn: 'S', code: 'thr1' })).status).toBe(201)
  })

  it('a refused request (CSRF, role) is not counted against the user', async () => {
    t.clock.advance(61_000)
    for (let i = 0; i < 10; i++) expect((await student.post('/api/admin/subjects', { name: 'S', nameEn: 'S', code: 'x' })).status).toBe(403)
    for (let i = 0; i < 10; i++) expect((await admin.noCsrf.post('/api/admin/subjects', { name: 'S', nameEn: 'S', code: 'x' })).status).toBe(403)
    expect((await admin.post('/api/admin/subjects', { name: 'S', nameEn: 'S', code: 'thr2' })).status).toBe(201)
  })
})
