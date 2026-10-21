import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { LogCapture } from '../support/app'
import { bootSecurityApp, type SecurityApp } from './helpers'

/** ops-edge-client-ip: the shared edge secret (X-PP-Edge-Secret) never reaches the logs. Own file: it needs the log stream of the first app booted in the process. */
const SECRET = 'x'.repeat(40)

describe('the edge secret never reaches the logs', () => {
  let t: SecurityApp
  const logs = new LogCapture()
  let start = 0
  beforeAll(async () => {
    t = await bootSecurityApp({
      env: { CLIENT_IP_HEADER: 'x-pp-client-ip', EDGE_PROXY_SECRET: SECRET, TRUST_PROXY_HOPS: '2', LOG_LEVEL: 'info' },
      logStream: logs,
    })
    start = logs.lines.length
  })
  afterAll(async () => {
    await t.close()
  })

  it('a login and a public read through the edge headers leave no secret value in the log lines', async () => {
    const h = { 'X-PP-Client-IP': '203.0.113.60', 'X-PP-Edge-Secret': SECRET }
    await t.http().post('/api/auth/login').set(h).send({ identifier: 'guru@demo.test', password: 'Salah-Sentiasa-1' })
    await t.http().get('/api/schools/jpn').set({ ...h, 'X-PP-Client-IP': '203.0.113.61' })
    const text = logs.lines.slice(start).join('\n')
    expect(logs.lines.length - start, 'the capture saw the requests').toBeGreaterThanOrEqual(2)
    expect(text).toContain('/api/auth/login')
    expect(text).not.toContain(SECRET)
    expect(text.toLowerCase()).not.toMatch(/x-pp-edge-secret/)
  })

  it('warns once (no secret, no header values) when the client-ip header arrives with a wrong or missing secret', async () => {
    const from = logs.lines.length
    const bad = 'y'.repeat(40)
    await t.http().get('/api/schools/jpn').set({ 'X-PP-Client-IP': '203.0.113.70', 'X-PP-Edge-Secret': bad })
    await t.http().get('/api/schools/jpn').set({ 'X-PP-Client-IP': '203.0.113.71' })
    const text = logs.lines.slice(from).join('\n')
    expect(text.match(/edge secret is missing or does not match/g)).toHaveLength(1)
    expect(text).toContain('socket peer')
    for (const v of [SECRET, bad, '203.0.113.70', '203.0.113.71'].map((x) => `"msg":"[^"]*${x}`)) expect(text).not.toMatch(new RegExp(v))
    expect(text).not.toContain(SECRET)
    expect(text).not.toContain(bad)
  })
})
