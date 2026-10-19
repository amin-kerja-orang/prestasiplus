import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { LogCapture } from '../support/app'
import { type AccountTestApp, bootAccountApp } from './account-helpers'

const originalNodeEnv = process.env.NODE_ENV

describe('NODE_ENV=development with MAIL_LOG_RESET_LINKS=true', () => {
  let t: AccountTestApp
  const logs = new LogCapture()

  beforeAll(async () => {
    t = await bootAccountApp({ logStream: logs, teeMail: true, env: { NODE_ENV: 'development', MAIL_LOG_RESET_LINKS: 'true', LOG_LEVEL: 'debug' } })
  })
  afterAll(async () => {
    await t.close()
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
  })

  it('prints the link on the dev logger only: the one place a developer can read it, and nowhere else', async () => {
    const res = await t.http().post('/api/auth/password/email').send({ email: 'pelajar@demo.test' })
    expect(res.status).toBe(200)
    const token = t.mail.last().token
    const hits = logs.lines.filter((l) => l.includes(token))
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain('MailPort.dev')
    expect(hits[0]).toContain('DEV ONLY')
    // The access log line of the request does not carry it (the token is never in the URL).
    expect(logs.lines.filter((l) => l.includes('request completed')).join('\n')).not.toContain(token)
  })
})
