import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makePng } from '../files/fixtures'
import { LogCapture } from '../support/app'
import { bootSecurityApp, cookieValue, COOKIE_NAME, DEMO_PASSWORD, loginAs, type SecurityApp } from './helpers'

/**
 * BE-33 AC8: a log-capture test over a login, a password reset and an upload proves the logs hold no
 * password, session cookie, reset token, CSRF token or IC number, and no cookie header values.
 *
 * The app logs at `info` (the level a deployment uses) through a capture stream. The fictitious IC number
 * travels in a JSON body field only (never in a query string).
 */

const IC = '990101145678'
const IC_DASHED = '990101-14-5678'

/** A bare 12-digit run: the shape of an IC number written without dashes. */
const BARE_IC = /(?<!\d)\d{12}(?!\d)/

/**
 * Removes the two random ids that can hold a run of 12 decimal digits by chance, for the bare-IC check only:
 * request-id UUIDs (the last group is 12 hex characters, all digits in about 0.4% of ids) and the upload's multipart
 * boundary in the logged content-type header (24 random hex characters; a 12-digit run in about 1 run in 120).
 * An IC is never written in either form.
 */
const withoutRandomIds = (text: string): string =>
  text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/boundary=-*[0-9a-z]+/gi, 'boundary=<b>')

describe('the bare-IC check ignores random ids only', () => {
  it('masks a boundary or a UUID that holds 12 digits, and still catches a real IC next to them', () => {
    const boundary = 'content-type: multipart/form-data; boundary=--------------------------eda024e92c578580993012ec'
    const uuid = 'reqId 1b4e28ba-2fa1-11d2-883f-016045123456'
    expect(boundary).toMatch(BARE_IC)
    expect(uuid).toMatch(BARE_IC)
    expect(withoutRandomIds(`${boundary} ${uuid}`)).not.toMatch(BARE_IC)
    expect(withoutRandomIds(`${boundary} ic ${IC} ${uuid}`)).toMatch(BARE_IC)
    expect(withoutRandomIds(`${boundary};ic=${IC}`)).toMatch(BARE_IC)
  })
})

describe('BE-33 AC8: logs hold no secrets across login, password reset and upload', () => {
  let t: SecurityApp
  const logs = new LogCapture()
  let start = 0 // the boot logs (route mapping) are not part of the evidence

  beforeAll(async () => {
    t = await bootSecurityApp({ env: { LOG_LEVEL: 'info', COOKIE_SECURE: 'false' }, logStream: logs })
    start = logs.lines.length
  })
  afterAll(async () => {
    await t.close()
  })

  const text = () => logs.lines.slice(start).join('\n')
  /** A header key may be logged, but only with the censor as its value. */
  const unredacted = (key: string) => new RegExp(`"${key}"\\s*:\\s*(?!"\\[Redacted\\]")`, 'i')

  it('login, reset (request and completion) and upload leave no password, cookie, token, CSRF or IC in the logs', async () => {
    const secrets: string[] = []
    const wrongPassword = 'Marker-Salah-8841'
    const newPassword = 'Baharu-Log-7715'

    // 1. Login: a failure, then a success.
    const failed = await t.http().post('/api/auth/login').set('X-Forwarded-For', '10.40.0.1').send({ identifier: 'guru@demo.test', password: wrongPassword })
    expect(failed.status).toBe(401)
    const me = await loginAs(t, 'guru@demo.test', { ip: '10.40.0.2' })
    secrets.push(me.token, me.csrf)

    // 2. Upload as that user.
    const up = await me.agent.post('/api/files?purpose=avatar').set('X-CSRF-Token', me.csrf).attach('file', makePng(), { filename: 'gambar.png', contentType: 'image/png' })
    expect(up.status).toBe(201)

    // 3. Reset by e-mail link: request, then completion with the mailed token. The IC goes in the body of the IC reset.
    const email = 'pelajar@demo.test'
    const ask = await t.http().post('/api/auth/password/email').set('X-Forwarded-For', '10.40.0.3').send({ email })
    expect(ask.status).toBe(200)
    const token = t.mail.last().token
    secrets.push(token)
    const done = await t
      .http()
      .post('/api/auth/password/reset')
      .set('X-Forwarded-For', '10.40.0.3')
      .send({ token, email, password: newPassword, passwordConfirmation: newPassword })
    expect(done.status, JSON.stringify(done.body)).toBeLessThan(300)
    const doneCookie = cookieValue(done)
    if (doneCookie) secrets.push(doneCookie)
    const csrfDone = (done.body as { data?: { csrf?: string } }).data?.csrf
    if (csrfDone) secrets.push(csrfDone)

    // 4. IC in a JSON body field (reset by IC, the answer does not matter) and in a registration body.
    await t.http().post('/api/auth/password/reset-ic').set('X-Forwarded-For', '10.40.0.4').send({ email: 'pelajar2@demo.test', icNumber: IC })
    await t
      .http()
      .post('/api/auth/register')
      .set('X-Forwarded-For', '10.40.0.5')
      .send({ name: 'Pelajar Log', email: 'log.ic@ujian.test', role: 'student', grade: 4, icNumber: IC, password: newPassword, passwordConfirmation: newPassword })
    await me.agent.post('/api/tiket').set('X-CSRF-Token', me.csrf).send({ subject: 'Soalan log', body: `Nombor ${IC_DASHED} dalam badan tiket.` })

    const all = text()
    expect(logs.lines.length - start).toBeGreaterThan(5) // the capture really saw the requests
    expect(all).toContain('/api/auth/login')
    expect(all).toContain('/api/files')
    expect(all).toContain('/api/auth/password/reset')

    for (const secret of [wrongPassword, DEMO_PASSWORD, newPassword, IC, IC_DASHED, ...secrets]) {
      expect(secret.length).toBeGreaterThanOrEqual(8)
      expect(all, `logs contain a secret starting ${secret.slice(0, 4)}`).not.toContain(secret)
    }
    expect(withoutRandomIds(all)).not.toMatch(BARE_IC)
    expect(all).not.toMatch(/\b\d{6}-\d{2}-\d{4}\b/)
    expect(all).not.toMatch(/\$argon2|\$2[aby]\$/)
    // No cookie header values, request or response.
    for (const key of ['set-cookie', 'cookie', 'authorization', 'x-csrf-token']) expect(all).not.toMatch(unredacted(key))
    expect(all).not.toContain(`${COOKIE_NAME}=`)
  })

  it('redaction canary: unique markers in a password field, the Cookie, Authorization and X-CSRF-Token headers never reach the logs', async () => {
    const from = logs.lines.length // only the lines this test produced
    const canary = {
      password: 'CANARY-PASSWORD-1f3a9c',
      cookie: 'CANARY-COOKIE-77be21',
      authorization: 'CANARY-AUTH-90d4e5',
      csrf: 'CANARY-CSRF-4c0a18',
      body: 'CANARY-BODY-TOKEN-5e6f70',
    }
    // A public route (login) with every header and a password field...
    const login = await t
      .http()
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.41.0.1')
      .set('Cookie', `${COOKIE_NAME}=${canary.cookie}; other=${canary.cookie}`)
      .set('Authorization', `Bearer ${canary.authorization}`)
      .set('X-CSRF-Token', canary.csrf)
      .send({ identifier: 'tiada@demo.test', password: canary.password })
    expect(login.status).toBe(401)
    // ...and a protected mutating route (the CSRF check fails) with the same headers, a secret in the body.
    const protectedRoute = await t
      .http()
      .post('/api/tiket')
      .set('X-Forwarded-For', '10.41.0.1')
      .set('Cookie', `${COOKIE_NAME}=${canary.cookie}`)
      .set('Authorization', `Bearer ${canary.authorization}`)
      .set('X-CSRF-Token', canary.csrf)
      .send({ subject: 'x', body: canary.body, password: canary.password, token: canary.body })
    expect(protectedRoute.status).toBe(401)
    // And a failed password change shape on the reset route (a password in the body of a 4xx).
    const reset = await t.http().post('/api/auth/password/reset').send({ token: canary.body, email: 'a@b.my', password: canary.password, passwordConfirmation: canary.password })
    expect(reset.status).toBeGreaterThanOrEqual(400)

    const all = logs.lines.slice(from).join('\n')
    expect(logs.lines.length - from).toBeGreaterThan(2)
    expect(all).toContain('/api/auth/login') // the requests were logged
    for (const value of Object.values(canary)) expect(all, `canary ${value} leaked`).not.toContain(value)
    expect(all).not.toMatch(/CANARY/)
  })
})
