import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { SchoolsRepository } from '../../src/modules/schools'
import { bootSchoolsApp, expectError, loginAs, schoolIdOf, type LoggedIn, type SchoolsTestApp } from './helpers'

const VALID = { name: 'SK Backstop', code: 'BACK001', type: 'SK', state: 'Selangor', district: 'Gombak', city: 'Gombak' }

/**
 * The advisory lock and the app check make the unique violation unreachable in normal use. These
 * tests blind the app check (`findByCode` answers "free") so the write itself hits the
 * `uq_schools_code_lower` index, and show the P2002 is mapped to the 422 "taken" message.
 */
describe('lower(code) unique index as the backstop (P2002 mapped to 422)', () => {
  let t: SchoolsTestApp
  let admin: LoggedIn

  beforeAll(async () => {
    t = await bootSchoolsApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '1000', THROTTLE_ADMIN_READ_PER_MINUTE: '1000' } })
    admin = await loginAs(t, 'admin@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  const blind = () => {
    const repo = t.app.get(SchoolsRepository)
    return vi.spyOn(repo, 'findByCode').mockResolvedValueOnce(null).mockResolvedValueOnce(null)
  }

  it('create: a conflicting code in another case gives 422 "taken" and nothing is written', async () => {
    const before = await t.db.query(`select 1 from schools`)
    const spy = blind()
    const res = await admin.agent.post('/api/admin/schools').set('X-CSRF-Token', admin.csrf).send({ ...VALID, code: 'demo001' })
    spy.mockRestore()
    expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ code: 'The code has already been taken.' })
    expect(await t.db.query(`select 1 from schools`)).toHaveLength(before.length)
    expect(await t.db.query(`select 1 from audit_events where action = 'school.created'`)).toEqual([])
  })

  it('update: the same, and the row keeps its old values', async () => {
    const id = await schoolIdOf(t.db, 'DEMO003')
    const spy = blind()
    const res = await admin.agent.put(`/api/admin/schools/${id}`).set('X-CSRF-Token', admin.csrf).send({ ...VALID, code: 'Demo004' })
    spy.mockRestore()
    expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ code: 'The code has already been taken.' })
    const row = await t.db.query<{ code: string; name: string }>(`select code, name from schools where id = $1`, [id])
    expect(row[0]).toEqual({ code: 'DEMO003', name: 'SK Demo Tiga' })
    expect(await t.db.query(`select 1 from audit_events where action = 'school.updated'`)).toEqual([])
  })

  it('the lock is not needed for correctness: with lockCodeWrites a no-op, two parallel creates still give one 201 and one 422', async () => {
    const repo = t.app.get(SchoolsRepository)
    const spy = vi.spyOn(repo, 'lockCodeWrites').mockResolvedValue(undefined)
    const post = (code: string) => admin.agent.post('/api/admin/schools').set('X-CSRF-Token', admin.csrf).send({ ...VALID, code })
    const [a, b] = await Promise.all([post('NOLOCK1'), post('nolock1')])
    spy.mockRestore()
    expect([a.status, b.status].sort()).toEqual([201, 422])
    expect(await t.db.query(`select 1 from schools where lower(code) = 'nolock1'`)).toHaveLength(1)
  })
})
