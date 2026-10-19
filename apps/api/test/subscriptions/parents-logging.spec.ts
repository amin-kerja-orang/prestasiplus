import { ParentInviteGeneratedSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { redactUrl } from '../../src/common/logging/logging'
import { LogCapture } from '../support/app'
import { ADMIN, STUDENT, apiOf, bootParentsApp, login, newParent, type UsersTestApp } from './parents-helpers'

const HEX64 = 'a'.repeat(31) + 'B' + 'c'.repeat(32)

describe('the parent invite token never reaches the access log (security review H1)', () => {
  let t: UsersTestApp
  const logs = new LogCapture()
  let previousLevel: string | undefined

  beforeAll(async () => {
    previousLevel = process.env.LOG_LEVEL
    process.env.LOG_LEVEL = 'debug'
    t = await bootParentsApp({ LOG_LEVEL: 'debug' }, logs)
  })
  afterAll(async () => {
    if (previousLevel === undefined) delete process.env.LOG_LEVEL
    else process.env.LOG_LEVEL = previousLevel
    await t.close()
  })

  it('rewrites the token in every URL form (unit)', () => {
    const token = '0123456789abcdef'.repeat(4)
    expect(redactUrl(`/api/parent-invites/${token}`)).toBe('/api/parent-invites/[redacted]')
    expect(redactUrl(`/api/parent-invites/${token.toUpperCase()}/accept?x=1`)).toBe('/api/parent-invites/[redacted]/accept?x=1')
    expect(redactUrl(`https://app.test/jemput/parent-invites/${token}#frag`)).toBe('https://app.test/jemput/parent-invites/[redacted]#frag')
    expect(redactUrl('/api/me/parent-invite')).toBe('/api/me/parent-invite')
  })

  it('does not log a real token on preview, accept, a Referer, an upper-case path or a 404', async () => {
    const admin = apiOf(await login(t, ADMIN))
    const student = apiOf(await login(t, STUDENT))
    const generated = await student.post('/me/parent-invite')
    expect(generated.status, JSON.stringify(generated.body)).toBe(200)
    const token = ParentInviteGeneratedSchema.parse(generated.body.data).token

    const referer = `https://app.example.test/jemput/parent-invites/${token}`
    expect((await t.http().get(`/api/parent-invites/${token}?utm=1`).set('Referer', referer)).status).toBe(200)
    expect((await t.http().get(`/api/parent-invites/${token.toUpperCase()}`)).status).toBe(200)
    expect((await t.http().get(`/api/parent-invites/${HEX64}`).set('Referer', referer)).status).toBe(404) // error path

    const parent = await newParent(t, admin, 'ibu.log@ujian.test')
    const accepted = await parent.who.agent
      .post(`/api/parent-invites/${token}/accept`)
      .set('X-CSRF-Token', parent.who.csrf)
      .set('Referer', referer)
      .send({})
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200)
    expect((await parent.who.agent.post(`/api/parent-invites/${token}/accept`).set('X-CSRF-Token', parent.who.csrf).send({})).status).toBe(404) // replay

    const all = logs.lines.join('\n')
    expect(logs.lines.length).toBeGreaterThan(0) // the capture really saw the requests
    for (const secret of [token, token.toUpperCase(), HEX64, HEX64.toLowerCase(), HEX64.toUpperCase()]) expect(all).not.toContain(secret)
    expect(all).not.toContain('app.example.test') // the Referer is not logged at all
    expect(all).toContain('/api/parent-invites/[redacted]')
    expect(all).toContain('/api/parent-invites/[redacted]/accept')
    // The request line is still logged for the 404 (so the case above is not vacuous).
    expect(logs.lines.some((l) => l.includes('"statusCode":404') && l.includes('[redacted]'))).toBe(true)
  })
})
