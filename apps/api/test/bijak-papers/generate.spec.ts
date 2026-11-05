import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootBuilderApp, count, expectError, loginAs, type BuilderTestApp, type Client } from '../exam-builder/helpers'
import { matBank } from '../exam-builder/fakes'
import { serveSeededBlueprints, setPocMarkBudgets } from '../support/serve-blueprints'

/**
 * S3-T07 (FR-MUR-13-20, AC-MUR-13-26, AC-PA-32, API-BIJAK-03): there is no pupil Jana Kertas. `POST /api/bijak/papers/generate`
 * is removed, so every caller gets the framework 404 NOT_FOUND envelope; the only generator is the admin
 * `POST /api/admin/papers/generate` (builder card), which creates a Draf paper.
 */
describe('POST /api/bijak/papers/generate is removed (404 for every caller); the admin generate route stays', () => {
  let t: BuilderTestApp
  let student: Client
  let admin: Client

  beforeAll(async () => {
    t = await bootBuilderApp({ builderSource: matBank(), papersSource: matBank(), pool: 'builder-source' })
    await setPocMarkBudgets(t.db)
    await serveSeededBlueprints(t.db)
    student = await loginAs(t, ACCOUNTS.student)
    admin = await loginAs(t, ACCOUNTS.admin)
  })
  afterAll(async () => {
    await t.close()
  })

  const papers = () => count(t.db, `select count(*) n from papers`)

  it('a pupil gets 404 NOT_FOUND for a valid body and for an invalid one (no validation runs), and no paper is created', async () => {
    const before = await papers()
    expectError(await student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 2 }), 'NOT_FOUND', 404)
    expectError(await student.post('/api/bijak/papers/generate', {}), 'NOT_FOUND', 404)
    expect(await papers()).toBe(before)
  })

  it('Admin Pusat and Admin Sekolah in Mod Pelajar get 404 too (they use only the admin route)', async () => {
    const before = await papers()
    for (const who of [ACCOUNTS.admin, 'adminsekolah@demo.test']) {
      const c = await loginAs(t, who)
      await c.enterMod()
      expectError(await c.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 2 }), 'NOT_FOUND', 404)
    }
    expect(await papers()).toBe(before)
  })

  it('the reads of the pupil list are untouched: GET /api/bijak/papers and /api/bijak/subjects answer 200', async () => {
    expect((await student.get('/api/bijak/papers')).status).toBe(200)
    expect((await student.get('/api/bijak/subjects')).status).toBe(200)
  })

  it('the admin route is still there: POST /api/admin/papers/generate is not 404 (201 Draf, or 422 SHORTAGE from the pool), and a pupil is refused 403', async () => {
    const res = await admin.post('/api/admin/papers/generate', { subject: 'MAT', kertas: 2 })
    expect([201, 422], JSON.stringify(res.body)).toContain(res.status)
    if (res.status === 201) {
      const id = (res.body.data as { paperId: string }).paperId
      expect((await t.db.query<{ status: string }>(`select status from papers where id = $1`, [id]))[0]?.status).toBe('draft')
    } else expect(res.body.error.code).toBe('SHORTAGE')
    expect((await student.post('/api/admin/papers/generate', { subject: 'MAT', kertas: 2 })).status).toBe(403)
  })
})
