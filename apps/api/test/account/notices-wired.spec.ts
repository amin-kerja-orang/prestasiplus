import { ACCOUNT_SECURITY_NOTIFICATIONS } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { IcService } from '../../src/modules/users/credentials'
import { userIdOf } from '../auth/helpers'
import { type AccountTestApp, bootAccountApp } from './account-helpers'

const STUDENT = 'pelajar@demo.test'

describe('NOTIFICATION_PORT is wired to the inbox (D59a)', () => {
  let t: AccountTestApp

  beforeAll(async () => {
    t = await bootAccountApp({ realNotices: true })
    const parts = t.app.get(IcService, { strict: false }).parts('100101140077')
    await t.db.query(`update users set ic_hash = $1 where email = $2`, [parts?.hash, STUDENT])
  })
  afterAll(async () => {
    await t.close()
  })

  const rows = (userId: string) =>
    t.db.query<{ type: string; category: string; title: string; body: string }>(
      `select type, category, title, body from notifications where user_id = $1::bigint`,
      [userId],
    )

  it('a reset-ic match writes one notification row for the owner and one for each school_admin of the school', async () => {
    const res = await t.http().post('/api/auth/password/reset-ic').send({ email: STUDENT, icNumber: '100101140077' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)

    const owner = await rows(await userIdOf(t.db, STUDENT))
    expect(owner).toEqual([
      { type: 'password_reset_ic', category: 'system', title: ACCOUNT_SECURITY_NOTIFICATIONS.resetIcIssued.title, body: ACCOUNT_SECURITY_NOTIFICATIONS.resetIcIssued.body },
    ])
    for (const admin of ['adminsekolah@demo.test', 'guruadmin@demo.test']) {
      const got = await rows(await userIdOf(t.db, admin))
      expect(got).toHaveLength(1)
      expect(got[0]).toMatchObject({ type: 'student_password_reset', category: 'system' })
      expect(got[0]?.body).toContain('Murid Demo')
      expect(JSON.stringify(got)).not.toContain(res.body.data.token)
    }
    // A user of another school gets nothing.
    expect(await rows(await userIdOf(t.db, 'guru@demo.test'))).toHaveLength(0)
  })

  it('a miss writes no notification', async () => {
    t.clock.advance(16 * 60_000)
    const before = await t.db.query<{ n: string }>(`select count(*)::text as n from notifications`)
    const res = await t.http().post('/api/auth/password/reset-ic').send({ email: STUDENT, icNumber: '999999999999' })
    expect(res.status).toBe(422)
    const after = await t.db.query<{ n: string }>(`select count(*)::text as n from notifications`)
    expect(after[0]?.n).toBe(before[0]?.n)
  })
})
