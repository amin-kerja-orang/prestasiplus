import { ACCOUNT_AUTH_MESSAGES, ACCOUNT_SECURITY_NOTIFICATIONS, ErrorBodySchema, SessionSchema } from '@pp/contract'
import { Logger } from '@nestjs/common'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { IcService } from '../../src/modules/users/credentials'
import { type AccountTestApp, bootAccountApp, cookieValue, DEMO_PASSWORD, errorOf, fieldsOf, login, userRow } from './account-helpers'
import { userIdOf } from '../auth/helpers'

const STUDENT = 'pelajar@demo.test'
const TEACHER = 'guru@demo.test'
const IC = '100101140077'

describe('password reset by e-mail link and by IC (AC2, AC3, D55a, D55b)', () => {
  let t: AccountTestApp
  let ic: IcService

  const link = (email: string) => t.http().post('/api/auth/password/email').send({ email })
  const redeem = (token: string, email: string, password = DEMO_PASSWORD) =>
    t.http().post('/api/auth/password/reset').send({ token, email, password, passwordConfirmation: password })
  const resetIc = (email: string, icNumber: string) => t.http().post('/api/auth/password/reset-ic').send({ email, icNumber })
  /** Requests a link and returns the raw token the mail port received. */
  const issue = async (email: string): Promise<string> => {
    const res = await link(email)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return t.mail.last().token
  }
  const strip = (body: unknown) => {
    const { error } = ErrorBodySchema.parse(body)
    return { code: error.code, message: error.message, fields: error.fields, retryAfter: error.retryAfter }
  }

  beforeAll(async () => {
    t = await bootAccountApp()
    ic = t.app.get(IcService, { strict: false })
    const parts = ic.parts(IC)
    await t.db.query(`update users set ic_hash = $1, ic_masked = $2 where email = $3`, [parts?.hash, parts?.masked, STUDENT])
  })
  beforeEach(() => {
    // Every counter window (60 s, 15 min) is over before each test.
    t.clock.advance(16 * 60_000)
    t.mail.sent.length = 0
    t.notices.pushed.length = 0
    t.mail.fail = false
    t.notices.fail = false
  })
  afterAll(async () => {
    await t.close()
  })

  describe('POST /auth/password/email', () => {
    it('answers 200 with the sent text and stores only a keyed hash of a 256-bit token valid 60 minutes', async () => {
      const res = await link(STUDENT)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { status: ACCOUNT_AUTH_MESSAGES.resetSent } })
      const mail = t.mail.last()
      expect(mail.to).toBe(STUDENT)
      expect(mail.link).toBe(`/password/reset#token=${mail.token}&email=${encodeURIComponent(STUDENT)}`)
      expect(Buffer.from(mail.token, 'base64url').length).toBeGreaterThanOrEqual(32)

      const rows = await t.db.query<{ token_hash: string; channel: string; expires_at: Date; created_at: Date; used_at: Date | null }>(
        `select token_hash, channel, expires_at, created_at, used_at from password_resets order by id desc limit 1`,
      )
      const row = rows[0]
      expect(row?.channel).toBe('email')
      expect(row?.token_hash).toMatch(/^[0-9a-f]{64}$/)
      expect(row?.token_hash).not.toBe(mail.token)
      expect((row?.expires_at.getTime() ?? 0) - (row?.created_at.getTime() ?? 0)).toBe(60 * 60_000)
      // The raw token is nowhere in the database.
      const dump = await t.db.query<{ hit: number }>(`select count(*)::int as hit from password_resets where token_hash = $1`, [mail.token])
      expect(dump[0]?.hit).toBe(0)
    })

    it('D55b: an unknown e-mail, an inactive account and a suspended one are answered exactly like a known one', async () => {
      const known = await link(STUDENT)
      const answers = [known]
      for (const email of ['tiada.siapa@ujian.test', 'tidakaktif@demo.test', 'digantung@demo.test']) {
        t.clock.advance(61_000)
        answers.push(await link(email))
      }
      for (const a of answers) {
        expect(a.status).toBe(200)
        expect(a.body).toEqual(known.body)
        expect(a.headers['content-type']).toBe(known.headers['content-type'])
      }
      // Only the known, active account got a mail and a token.
      expect(t.mail.sent.map((m) => m.to)).toEqual([STUDENT])
    })

    it('BR-11: a second request for the same e-mail within 60 s is 429 RATE_LIMITED with retryAfter; an unknown e-mail is throttled the same way', async () => {
      for (const email of [STUDENT, 'tiada.siapa@ujian.test']) {
        t.clock.advance(61_000)
        expect((await link(email)).status).toBe(200)
        t.clock.advance(20_000)
        const again = await link(email)
        const err = errorOf(again, 429, 'RATE_LIMITED')
        expect(err.message).toBe(ACCOUNT_AUTH_MESSAGES.resetThrottled)
        expect(err.fields).toEqual({ email: ACCOUNT_AUTH_MESSAGES.resetThrottled })
        expect(err.retryAfter).toBe(40)
        expect(again.headers['retry-after']).toBe('40')
      }
      t.clock.advance(61_000)
      expect((await link(STUDENT)).status).toBe(200)
      // The e-mail is compared in its normal form.
      t.clock.advance(5_000)
      errorOf(await link('  PELAJAR@demo.test '), 429, 'RATE_LIMITED')
    })

    it('20 requests per address per minute across all e-mails, then 429', async () => {
      for (let i = 0; i < 20; i++) expect((await link(`orang${i}@ujian.test`)).status).toBe(200)
      errorOf(await link('orang99@ujian.test'), 429, 'RATE_LIMITED')
    })

    it('validates the e-mail (422) before anything is counted', async () => {
      expect(fieldsOf(await link(''))).toEqual({ email: 'The email field is required.' })
      expect(fieldsOf(await link('bukan-emel'))).toEqual({ email: 'The email field must be a valid email address.' })
    })

    it('a failing mail port does not change the answer (no known/unknown oracle)', async () => {
      t.mail.fail = true
      const res = await link(STUDENT)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { status: ACCOUNT_AUTH_MESSAGES.resetSent } })
    })

    it('a new link spends the earlier one (one active token per user)', async () => {
      const first = await issue(STUDENT)
      t.clock.advance(61_000)
      const second = await issue(STUDENT)
      expect(first).not.toBe(second)
      const stale = await redeem(first, STUDENT)
      expect(fieldsOf(stale)).toEqual({ email: ACCOUNT_AUTH_MESSAGES.tokenInvalid })
      t.clock.advance(61_000)
      expect((await redeem(second, STUDENT)).status).toBe(200)
    })
  })

  describe('POST /auth/password/reset', () => {
    it('sets the password, logs in (cookie + session + status), is single use and ends the other sessions', async () => {
      const other = await login(t, STUDENT)
      await t.db.query(`update users set must_reset_password = true where email = $1`, [STUDENT])
      const token = await issue(STUDENT)

      const res = await redeem(token, STUDENT, 'Baharu123')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const session = SessionSchema.parse(res.body.data)
      expect(res.body.status).toBe(ACCOUNT_AUTH_MESSAGES.resetDone)
      expect(session.user.email).toBe(STUDENT)
      expect(cookieValue(res)).toBeTruthy()
      expect(res.headers['cache-control']).toBe('no-store')
      const row = await userRow(t.db, STUDENT)
      expect(row?.password_hash).toMatch(/^\$argon2id\$/)
      expect(row?.must_reset_password).toBe(false)

      // The old session is dead, the new password works, the old one does not.
      await other.agent.get('/api/session').expect(401)
      expect((await t.http().post('/api/auth/login').send({ identifier: STUDENT, password: 'Baharu123' })).status).toBe(200)
      expect((await t.http().post('/api/auth/login').send({ identifier: STUDENT, password: DEMO_PASSWORD })).status).toBe(401)

      // A second use of the same token gives the mock's text.
      const again = await redeem(token, STUDENT, 'Lain12345')
      expect(fieldsOf(again)).toEqual({ email: 'This password reset token is invalid.' })
      expect(ErrorBodySchema.parse(again.body).error.message).toBe('This password reset token is invalid.')
      // Put the demo password back for the other tests.
      t.clock.advance(61_000)
      const back = await issue(STUDENT)
      expect((await redeem(back, STUDENT, DEMO_PASSWORD)).status).toBe(200)
    })

    it('BR-10: a token expires after 60 minutes', async () => {
      const token = await issue(STUDENT)
      t.clock.advance(60 * 60_000 + 1000)
      expect(fieldsOf(await redeem(token, STUDENT))).toEqual({ email: ACCOUNT_AUTH_MESSAGES.tokenInvalid })
    })

    it('D55b: a token of another user, a wrong token and an unknown e-mail all answer the same text', async () => {
      const token = await issue(STUDENT)
      const answers = [
        await redeem(token, TEACHER), // bound to the e-mail it was issued for
        await redeem('x'.repeat(43), STUDENT),
        await redeem(token, 'tiada.siapa@ujian.test'),
      ]
      for (const a of answers) {
        expect(a.status).toBe(422)
        expect(strip(a.body)).toEqual(strip(answers[0]?.body))
        expect(fieldsOf(a)).toEqual({ email: ACCOUNT_AUTH_MESSAGES.tokenInvalid })
      }
      // The right token still works afterwards.
      t.clock.advance(61_000)
      expect((await redeem(token, STUDENT, DEMO_PASSWORD)).status).toBe(200)
    })

    it('validates token, e-mail and password like the mock', async () => {
      const res = await t.http().post('/api/auth/password/reset').send({ token: '', email: 'bukan', password: '123', passwordConfirmation: '456' })
      expect(fieldsOf(res)).toEqual({
        token: 'The token field is required.',
        email: 'The email field must be a valid email address.',
        password: 'The password field must be at least 6 characters.',
      })
      const token = await issue(STUDENT)
      const c = await t.http().post('/api/auth/password/reset').send({ token, email: STUDENT, password: 'Baharu123', passwordConfirmation: 'lain' })
      expect(fieldsOf(c)).toEqual({ password: 'The password field confirmation does not match.' })
    })

    it('BR-23: an inactive account with a real token is refused (403 ACCOUNT_INACTIVE) and nothing changes', async () => {
      const token = await issue(STUDENT)
      const before = (await userRow(t.db, STUDENT))?.password_hash
      await t.db.query(`update users set is_active = false where email = $1`, [STUDENT])
      try {
        const res = await redeem(token, STUDENT)
        errorOf(res, 403, 'ACCOUNT_INACTIVE')
        expect(ErrorBodySchema.parse(res.body).error.message).toBe(ACCOUNT_AUTH_MESSAGES.accountInactive)
        expect((await userRow(t.db, STUDENT))?.password_hash).toBe(before)
        const used = await t.db.query<{ n: string }>(`select count(*)::text as n from password_resets where used_at is null and token_hash is not null`)
        expect(Number(used[0]?.n)).toBeGreaterThan(0) // the token was not consumed
      } finally {
        await t.db.query(`update users set is_active = true where email = $1`, [STUDENT])
      }
    })

    it('two parallel redemptions of one token: exactly one wins (single use is atomic)', async () => {
      const token = await issue(STUDENT)
      const [a, b] = await Promise.all([redeem(token, STUDENT, DEMO_PASSWORD), redeem(token, STUDENT, DEMO_PASSWORD)])
      expect([a.status, b.status].sort()).toEqual([200, 422])
    })

    it('failed redemptions are counted: 5 per minute per e-mail and address, then 429 even for the right token', async () => {
      const token = await issue(STUDENT)
      for (let i = 0; i < 5; i++) expect((await redeem('y'.repeat(43), STUDENT)).status).toBe(422)
      const blocked = await redeem(token, STUDENT)
      const err = errorOf(blocked, 429, 'RATE_LIMITED')
      expect(err.retryAfter).toBeGreaterThan(0)
      expect(blocked.headers['retry-after']).toBeTruthy()
      t.clock.advance(61_000)
      expect((await redeem(token, STUDENT, DEMO_PASSWORD)).status).toBe(200)
    })

    it('notifies the owner and the school admins through the NotificationPort, naming no secret (D59a)', async () => {
      const token = await issue(STUDENT)
      expect((await redeem(token, STUDENT, DEMO_PASSWORD)).status).toBe(200)
      const studentId = await userIdOf(t.db, STUDENT)
      const owner = t.notices.pushed.filter((p) => p.userId === studentId)
      expect(owner.map((p) => p.notice)).toEqual([
        { type: ACCOUNT_SECURITY_NOTIFICATIONS.resetDone.type, title: ACCOUNT_SECURITY_NOTIFICATIONS.resetDone.title, body: ACCOUNT_SECURITY_NOTIFICATIONS.resetDone.body },
      ])
      const admins = [await userIdOf(t.db, 'adminsekolah@demo.test'), await userIdOf(t.db, 'guruadmin@demo.test')]
      const school = t.notices.pushed.filter((p) => admins.includes(p.userId))
      expect(school.map((p) => p.userId).sort()).toEqual([...admins].sort())
      for (const p of school) {
        expect(p.notice.type).toBe('student_password_reset')
        expect(p.notice.body).toBe(ACCOUNT_SECURITY_NOTIFICATIONS.schoolNotice.body.replace('{name}', 'Murid Demo'))
      }
      for (const p of t.notices.pushed) {
        expect(JSON.stringify(p)).not.toContain(token)
        expect(JSON.stringify(p)).not.toContain(STUDENT)
      }
    })

    it('the display name goes into the school notice literally (dollar sequences are not replacement patterns)', async () => {
      const name = 'Murid $& $1 $$ $`'
      await t.db.query('update users set name = $1 where email = $2', [name, STUDENT])
      try {
        const token = await issue(STUDENT)
        expect((await redeem(token, STUDENT, DEMO_PASSWORD)).status).toBe(200)
        const schoolNotice = t.notices.pushed.find((p) => p.notice.type === 'student_password_reset')
        expect(schoolNotice?.notice.body).toBe(ACCOUNT_SECURITY_NOTIFICATIONS.schoolNotice.body.split('{name}').join(name))
      } finally {
        await t.db.query('update users set name = $1 where email = $2', ['Murid Demo', STUDENT])
      }
    })

    it('a failing NotificationPort does not fail the reset', async () => {
      t.notices.fail = true
      const token = await issue(STUDENT)
      expect((await redeem(token, STUDENT, DEMO_PASSWORD)).status).toBe(200)
    })

    it('the audit log holds the event without the token, the password or the e-mail', async () => {
      const token = await issue(TEACHER)
      expect((await redeem(token, TEACHER, 'Rahsia12345')).status).toBe(200)
      const rows = await t.db.query<{ action: string; detail: unknown }>(`select action, detail from audit_events where action like 'account.password.%'`)
      expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(['account.password.reset_requested', 'account.password.reset_done']))
      const text = JSON.stringify(rows)
      for (const secret of [token, 'Rahsia12345', TEACHER]) expect(text).not.toContain(secret)
      t.clock.advance(61_000)
      expect((await redeem(await issue(TEACHER), TEACHER, DEMO_PASSWORD)).status).toBe(200)
    })
  })

  describe('POST /auth/password/reset-ic (D55a, D59a)', () => {
    it('a match returns a token (and only the token) that resets the password; the IC is never returned', async () => {
      const res = await resetIc(STUDENT, '100101-14-0077')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(Object.keys(res.body.data)).toEqual(['token'])
      expect(res.headers['cache-control']).toBe('no-store')
      expect(JSON.stringify(res.body)).not.toContain(IC)
      const stored = await t.db.query<{ channel: string; token_hash: string }>(`select channel, token_hash from password_resets order by id desc limit 1`)
      expect(stored[0]?.channel).toBe('ic')
      expect(stored[0]?.token_hash).not.toBe(res.body.data.token)
      t.clock.advance(61_000)
      expect((await redeem(res.body.data.token as string, STUDENT, DEMO_PASSWORD)).status).toBe(200)
      // The token is bound to that e-mail: no other account can use it.
      const second = await resetIc(STUDENT, IC)
      t.clock.advance(61_000)
      expect(fieldsOf(await redeem(second.body.data.token as string, TEACHER))).toEqual({ email: ACCOUNT_AUTH_MESSAGES.tokenInvalid })
    })

    describe('limits (M01 BUG-01)', () => {
      const wrong = '999999999999'
      const mail = (i: number) => `murid${String(i)}@sekolah.test`

      it('one address serves a whole class: 40 pupils, one wrong IC each, none is blocked', async () => {
        for (let i = 0; i < 40; i++) expect((await resetIc(mail(i), wrong)).status, `pupil ${String(i)}`).toBe(422)
      })

      it('the per-address ceiling is 45 failures per 15 minutes; the 46th is 429 with the unchanged BM body', async () => {
        for (let i = 0; i < 45; i++) expect((await resetIc(mail(i), wrong)).status, `attempt ${String(i)}`).toBe(422)
        const blocked = await resetIc(mail(99), wrong)
        expect(blocked.status).toBe(429)
        expect(blocked.body.error.code).toBe('RATE_LIMITED')
        expect(blocked.body.error.message).toBe(ACCOUNT_AUTH_MESSAGES.resetIcRateLimited)
        expect(blocked.body.error.retryAfter).toBeGreaterThan(0)
        expect(blocked.headers['retry-after']).toBeDefined()
      })

      it('warns once at 30 failures and on the per-address 429, with a hashed address and no PII', async () => {
        const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
        try {
          for (let i = 0; i < 45; i++) await resetIc(mail(i), wrong)
          await resetIc(mail(99), wrong)
          const events = warn.mock.calls.map((c) => c[0]).filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null && 'event' in m)
          expect(events.map((e) => [e.event, e.count])).toEqual([
            ['reset_ic.ip_failures_high', 30],
            ['reset_ic.ip_limited', 46],
          ])
          const text = JSON.stringify(events)
          expect(Object.keys(events[1] ?? {}).sort()).toEqual(['count', 'event', 'ipHash', 'windowEnd'])
          expect(events[1]?.ipHash).toMatch(/^[0-9a-f]{64}$/)
          for (const secret of ['sekolah.test', 'murid', wrong, '127.0.0.1', '::ffff:127.0.0.1', '::1']) expect(text).not.toContain(secret)
        } finally {
          warn.mockRestore()
        }
      })

      it('the per-account limit stays at 5: the 6th attempt on one e-mail is 429', async () => {
        for (let i = 0; i < 5; i++) expect((await resetIc(mail(1), wrong)).status).toBe(422)
        const sixth = await resetIc(mail(1), wrong)
        expect(sixth.status).toBe(429)
        expect(sixth.body.error.message).toBe(ACCOUNT_AUTH_MESSAGES.resetIcRateLimited)
      })

      it('successful resets do not consume the per-address budget', async () => {
        for (let i = 0; i < 70; i++) {
          // each success starts the 60 s e-mail interval only; the address budget is untouched
          expect((await resetIc(STUDENT, IC)).status, `success ${String(i)}`).toBe(200)
          t.clock.advance(16 * 60_000)
        }
        // 4 successes in one window (account budget 5), then failures from the same address
        for (let i = 0; i < 4; i++) expect((await resetIc(STUDENT, IC)).status).toBe(200)
        for (let i = 0; i < 45; i++) expect((await resetIc(mail(i), wrong)).status, `fail ${String(i)}`).toBe(422)
        expect((await resetIc(mail(99), wrong)).status).toBe(429)
      })
    })

    it('a wrong IC, no stored IC, an unknown e-mail, an inactive account and a malformed IC all fail alike', async () => {
      await t.db.query(`update users set ic_hash = $1 where email = 'tidakaktif@demo.test'`, [ic.hash(IC)])
      const cases: [string, string][] = [
        [STUDENT, '999999999999'],
        [STUDENT, 'abc'],
        [TEACHER, IC],
        ['tiada.siapa@ujian.test', IC],
        ['tidakaktif@demo.test', IC],
      ]
      const answers = []
      for (const [email, number] of cases) {
        t.clock.advance(16 * 60_000)
        answers.push(await resetIc(email, number))
      }
      for (const a of answers) {
        expect(a.status).toBe(422)
        expect(fieldsOf(a)).toEqual({ email: 'Email atau No Kad Pengenalan tidak sepadan.' })
        expect(strip(a.body)).toEqual(strip(answers[0]?.body))
      }
      await t.db.query(`update users set ic_hash = null where email = 'tidakaktif@demo.test'`)
      // No token was issued for the inactive account.
      const inactive = await t.db.query<{ n: string }>(
        `select count(*)::text as n from password_resets r join users u on u.id = r.user_id where u.email = 'tidakaktif@demo.test'`,
      )
      expect(inactive[0]?.n).toBe('0')
    })

    it('validates the body (email, ic number required and max 14)', async () => {
      const res = await t.http().post('/api/auth/password/reset-ic').send({ email: 'bukan', icNumber: '' })
      expect(fieldsOf(res)).toEqual({ email: 'The email field must be a valid email address.', icNumber: 'The ic number field is required.' })
      const long = await resetIc(STUDENT, '1'.repeat(15))
      expect(fieldsOf(long)).toEqual({ icNumber: 'The ic number field must not be greater than 14 characters.' })
    })

    it('D55a: 5 attempts per 15 minutes per account (match or not), then 429 with the BM message, even for the right IC', async () => {
      for (let i = 0; i < 5; i++) expect((await resetIc(STUDENT, '999999999999')).status).toBe(422)
      const blocked = await resetIc(STUDENT, IC)
      const err = errorOf(blocked, 429, 'RATE_LIMITED')
      expect(err.message).toBe(ACCOUNT_AUTH_MESSAGES.resetIcRateLimited)
      expect(err.retryAfter).toBeGreaterThan(0)
      expect(blocked.headers['retry-after']).toBe(String(err.retryAfter))
      // Unknown accounts are limited the same way (the limit does not reveal existence).
      t.clock.advance(16 * 60_000)
      for (let i = 0; i < 5; i++) await resetIc('tiada.siapa@ujian.test', IC)
      errorOf(await resetIc('tiada.siapa@ujian.test', IC), 429, 'RATE_LIMITED')
      t.clock.advance(16 * 60_000)
      expect((await resetIc(STUDENT, IC)).status).toBe(200)
    })

    it('D55a: 45 failed attempts per 15 minutes per address across different accounts (M01 BUG-01)', async () => {
      for (let i = 0; i < 45; i++) await resetIc(`orang${i}@ujian.test`, IC)
      const blocked = await resetIc('orang-lain@ujian.test', IC)
      expect(ErrorBodySchema.parse(blocked.body).error.message).toBe(ACCOUNT_AUTH_MESSAGES.resetIcRateLimited)
      expect(blocked.status).toBe(429)
    })

    it('every attempt, match or not, starts the 60 s link throttle for that e-mail (a 429 there is no match oracle)', async () => {
      await resetIc(STUDENT, '999999999999')
      errorOf(await link(STUDENT), 429, 'RATE_LIMITED')
      t.clock.advance(16 * 60_000)
      await resetIc(STUDENT, IC)
      errorOf(await link(STUDENT), 429, 'RATE_LIMITED')
    })

    it('D59a: a match notifies the owner and the school admins (display name only); a miss notifies nobody', async () => {
      await resetIc(STUDENT, '999999999999')
      expect(t.notices.pushed).toHaveLength(0)
      t.clock.advance(16 * 60_000)
      const res = await resetIc(STUDENT, IC)
      expect(res.status).toBe(200)
      const studentId = await userIdOf(t.db, STUDENT)
      const owner = t.notices.pushed.filter((p) => p.userId === studentId)
      expect(owner.map((p) => p.notice.type)).toEqual(['password_reset_ic'])
      const schoolNotices = t.notices.pushed.filter((p) => p.notice.type === 'student_password_reset')
      expect(schoolNotices).toHaveLength(2)
      for (const p of t.notices.pushed) {
        const text = JSON.stringify(p)
        for (const secret of [res.body.data.token as string, IC, STUDENT]) expect(text).not.toContain(secret)
      }
    })

    it('a failing NotificationPort does not fail the reset-ic', async () => {
      t.notices.fail = true
      expect((await resetIc(STUDENT, IC)).status).toBe(200)
    })
  })

  describe('token channels and concurrent issuing', () => {
    it('a request on one channel does not spend a valid token of the other (no token-spending DoS)', async () => {
      const icToken = (await resetIc(STUDENT, IC)).body.data.token as string
      t.clock.advance(61_000)
      // An attacker who knows only the e-mail asks for a link: the IC-channel token must stay valid.
      await issue(STUDENT)
      const live = await t.db.query<{ channel: string; n: string }>(
        `select channel, count(*)::text as n from password_resets r join users u on u.id = r.user_id
          where u.email = $1 and r.used_at is null group by channel order by channel`,
        [STUDENT],
      )
      expect(live).toEqual([
        { channel: 'email', n: '1' },
        { channel: 'ic', n: '1' },
      ])
      t.clock.advance(61_000)
      expect((await redeem(icToken, STUDENT, DEMO_PASSWORD)).status).toBe(200)
    })

    it('parallel issuing leaves at most one live token per channel', async () => {
      await Promise.all([resetIc(STUDENT, IC), resetIc(STUDENT, IC), resetIc(STUDENT, IC)])
      const live = await t.db.query<{ channel: string; n: string }>(
        `select channel, count(*)::text as n from password_resets r join users u on u.id = r.user_id
          where u.email = $1 and r.used_at is null group by channel`,
        [STUDENT],
      )
      for (const row of live) expect(Number(row.n), row.channel).toBe(1)
      expect(live.map((r) => r.channel)).toEqual(['ic'])
    })
  })
})
