import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadEnv } from '../../src/common/config/env.schema'
import { LogCapture } from '../support/app'
import { type AccountTestApp, bootAccountApp, PROD_ENV, runResetFlow } from './account-helpers'

const STUDENT = 'pelajar@demo.test'
const originalNodeEnv = process.env.NODE_ENV

describe('NODE_ENV=production: no token, link, password or clear e-mail in the log', () => {
  let t: AccountTestApp
  const logs = new LogCapture()

  beforeAll(async () => {
    t = await bootAccountApp({ logStream: logs, teeMail: true, env: { ...PROD_ENV, LOG_LEVEL: 'debug' } })
  })
  afterAll(async () => {
    await t.close()
    process.env.NODE_ENV = originalNodeEnv
  })

  it('a full reset flow in production mode logs the masked address and the reset id only', async () => {
    const secrets = await runResetFlow(t)
    const all = logs.lines.join('\n')
    expect(logs.lines.length).toBeGreaterThan(0)
    expect(all).toContain('password reset mail not sent')
    for (const secret of [...secrets, '/password/reset#', 'token=', STUDENT]) expect(all, secret).not.toContain(secret)
  })

  it('refuses to start with MAIL_LOG_RESET_LINKS=true; other environments are not refused', () => {
    const base = { ...PROD_ENV, DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/x' }
    expect(() => loadEnv({ ...base, MAIL_LOG_RESET_LINKS: 'true' })).toThrow(/MAIL_LOG_RESET_LINKS/)
    expect(() => loadEnv({ ...base, MAIL_LOG_RESET_LINKS: 'false' })).not.toThrow()
    expect(() => loadEnv({ ...base })).not.toThrow()
    expect(() => loadEnv({ ...base, NODE_ENV: 'development', MAIL_LOG_RESET_LINKS: 'true' })).not.toThrow()
  })
})
