import type { ConfigService } from '@nestjs/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { IcService } from '../../src/modules/users/credentials'
import { maskEmail } from '../../src/modules/account/ports'
import { LogCapture } from '../support/app'
import { type AccountTestApp, bootAccountApp, DEMO_PASSWORD, login, put, runResetFlow } from './account-helpers'

// One log-capturing app per file: the pino root logger of nestjs-pino is shared by every app in a worker.
const STUDENT = 'pelajar@demo.test'

describe('NODE_ENV=test: the reset token, IC, faith and passwords never reach the log or the audit table', () => {
  let t: AccountTestApp
  const logs = new LogCapture()

  beforeAll(async () => {
    // The dev flag is set on purpose: outside NODE_ENV=development it must have no effect.
    t = await bootAccountApp({ logStream: logs, teeMail: true, env: { LOG_LEVEL: 'debug', MAIL_LOG_RESET_LINKS: 'true' } })
  })
  afterAll(async () => {
    await t.close()
  })

  it('a full reset flow logs the masked address and the reset id, never the token, the link or a password', async () => {
    const secrets = await runResetFlow(t)
    const all = logs.lines.join('\n')
    expect(logs.lines.length).toBeGreaterThan(0)
    expect(all).toContain('password reset mail not sent')
    expect(all).toContain(maskEmail(STUDENT))
    for (const secret of [...secrets, '/password/reset#', 'token=', STUDENT]) expect(all, secret).not.toContain(secret)
  })

  it('personal and credential responses are no-store; faith, IC and password are in neither the log nor the audit table', async () => {
    t.clock.advance(120_000)
    const who = await login(t, 'pelajar2@demo.test')
    const settings = await put(who, '/me/settings', { faith: 'hindu', spiritualMode: true })
    expect(settings.status).toBe(200)
    expect(settings.headers['cache-control']).toBe('no-store')
    const me = await who.agent.get('/api/me')
    expect(me.headers['cache-control']).toBe('no-store')
    expect(JSON.stringify(me.body)).not.toContain('faith')

    const ic = new IcService({ get: (k: string) => (k === 'SESSION_SECRET' ? 'test-secret-0123456789abcdef' : undefined) } as unknown as ConfigService)
    const parts = ic.parts('100101140077')
    await t.db.query(`update users set ic_hash = $1 where email = $2`, [parts?.hash, 'pelajar2@demo.test'])
    t.clock.advance(120_000)
    const icRes = await t.http().post('/api/auth/password/reset-ic').send({ email: 'pelajar2@demo.test', icNumber: '100101-14-0077' })
    expect(icRes.status, JSON.stringify(icRes.body)).toBe(200)
    expect(icRes.headers['cache-control']).toBe('no-store')
    const reg = await t.http().post('/api/auth/register').send({ name: 'Baharu', email: 'b@ujian.test', role: 'parent', password: 'Rahsia123', passwordConfirmation: 'Rahsia123' })
    expect(reg.headers['cache-control']).toBe('no-store')
    const bad = await t.http().post('/api/auth/password/reset').send({ token: 'x', email: STUDENT, password: 'Rahsia123', passwordConfirmation: 'Rahsia123' })
    expect(bad.status).toBe(422)
    expect(bad.headers['cache-control']).toBe('no-store')

    const all = logs.lines.join('\n')
    const audit = JSON.stringify(await t.db.query(`select action, detail from audit_events`))
    for (const secret of ['hindu', '100101140077', '100101-14-0077', 'Rahsia123', DEMO_PASSWORD, icRes.body.data.token as string]) {
      expect(all, secret).not.toContain(secret)
      expect(audit, secret).not.toContain(secret)
    }
  })
})
