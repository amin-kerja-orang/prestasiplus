import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { LogCapture } from '../support/app'
import { type AuthTestApp, bootAuthApp, cookieValue, DEMO_PASSWORD, loginAs } from './helpers'

describe('AC9 logs hold no password, cookie value or IC number', () => {
  let t: AuthTestApp
  const logs = new LogCapture()

  beforeAll(async () => {
    process.env.LOG_LEVEL = 'debug'
    t = await bootAuthApp({ logStream: logs })
  })
  afterAll(async () => {
    process.env.LOG_LEVEL = 'silent'
    await t.close()
  })

  it('does not log secrets across login, failure, session calls, role switch and logout', async () => {
    const secrets: string[] = []
    const wrongPassword = 'Marker-Salah-7731'
    const ic = '020304-05-0607'

    const failed = await t.http().post('/api/auth/login').send({ identifier: 'guruadmin@demo.test', password: wrongPassword })
    expect(failed.status).toBe(401)
    const icLogin = await t.http().post('/api/auth/login').send({ identifier: ic, password: ic })
    expect(icLogin.status).toBe(401)

    t.clock.advance(120_000)
    const me = await loginAs(t, 'guruadmin@demo.test')
    secrets.push(me.token, me.csrf)
    await me.agent.get('/api/session').expect(200)
    const sw = await me.agent.post('/api/session/role').set('X-CSRF-Token', me.csrf).send({ role: 'teacher' })
    const token2 = cookieValue(sw) as string
    secrets.push(token2, sw.body.data.csrf)
    await me.agent.post('/api/auth/logout').set('X-CSRF-Token', sw.body.data.csrf).expect(204)

    const all = logs.lines.join('\n')
    expect(logs.lines.length).toBeGreaterThan(0) // the capture really saw the requests
    for (const secret of [wrongPassword, DEMO_PASSWORD, ic, ...secrets]) expect(all).not.toContain(secret)
    expect(all).not.toMatch(/\b\d{6}-\d{2}-\d{4}\b/)
    expect(all).not.toMatch(/\$argon2|\$2y\$/)
  })
})
