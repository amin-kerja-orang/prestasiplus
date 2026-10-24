import { SessionSchema } from '@pp/contract'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { gamificationSeed } from '../../prisma/seed/gamification'
import { walletSeed } from '../../prisma/seed/wallet'
import { AuthPorts, type LoginHook } from '../../src/modules/auth'
import { GamificationModule } from '../../src/modules/gamification'
import { WalletModule } from '../../src/modules/wallet'
import { bootAccountApp, cookieValue, DEMO_PASSWORD, REGISTER_STUDENT, type AccountTestApp } from '../account/account-helpers'
import { schoolIdOf, userIdOf } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * LOGINHOOK-AUTO / FR-M01-69 / BR-26: the auto-login of a PUPIL registration and of a password reset fires the same login
 * hook as a form login (streak + the first +2 `daily_login` of the Malaysia day), AFTER the transaction committed, with the
 * wait capped at 2 s and every error swallowed. A pending teacher registration issues no session, so it fires nothing.
 */
describe('registration and reset auto-login fire the login hook after commit (FR-M01-69)', () => {
  let db: TestDatabase
  let t: AccountTestApp
  let ports: AuthPorts
  let realHook: LoginHook
  let schoolId: string
  let n = 0

  const register = (over: Record<string, unknown> = {}) =>
    t.http().post('/api/auth/register').send({ ...REGISTER_STUDENT, email: `murid.auto${++n}@ujian.test`, schoolId, ...over })
  const link = (email: string) => t.http().post('/api/auth/password/email').send({ email })
  /** Requests a link and redeems it: the reset auto-login. Each call starts in a fresh throttle window. */
  const reset = async (email: string) => {
    t.clock.advance(16 * 60_000)
    expect((await link(email)).status).toBe(200)
    const token = t.mail.last().token
    return t.http().post('/api/auth/password/reset').send({ token, email, password: DEMO_PASSWORD, passwordConfirmation: DEMO_PASSWORD })
  }
  const dailyRows = (userId: string) =>
    db.query<{ source_id: string; amount: number; type: string; description: string }>(
      `select source_id, amount, type, description from coin_ledger where user_id = $1 and source = 'daily_login' order by id`,
      [userId],
    )
  const idByEmail = async (email: string) => userIdOf(db, email)
  const sessionCount = async (userId: string) => Number((await db.query<{ n: string }>(`select count(*)::text as n from sessions where user_id = $1::bigint`, [userId]))[0]?.n)

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, walletSeed, gamificationSeed], { prisma: db.prisma })
    t = await bootAccountApp({ db, modules: [WalletModule, GamificationModule] })
    ports = t.app.get(AuthPorts, { strict: false })
    realHook = ports.loginHook as LoginHook // bound by the gamification module on init
    schoolId = await schoolIdOf(db, 'DEMO001')
  }, 120_000)
  afterAll(async () => {
    await t.close()
    await db.drop()
  })
  beforeEach(() => {
    t.mail.sent.length = 0
    t.clock.advance(61_000)
  })
  afterEach(() => {
    ports.overrideLoginHook(realHook)
    vi.restoreAllMocks()
  })

  it('the real hook is plugged into the port (the other tests depend on it)', () => {
    expect(realHook).toBeTruthy()
  })

  describe('registration', () => {
    it('a pupil registration (which auto-logs in) credits +2 daily_login exactly once and starts the streak', async () => {
      const email = 'murid.kredit@ujian.test'
      const res = await register({ email })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(SessionSchema.parse(res.body.data).active.role).toBe('student')
      const id = await idByEmail(email)
      expect(await dailyRows(id)).toEqual([
        expect.objectContaining({ type: 'earn', source_id: 'daily_login:2026-10-19', amount: 2, description: 'Streak activity (daily_login)' }),
      ])
      const wallet = await db.query<{ current_syiling: number }>(`select current_syiling from wallets where user_id = $1`, [id])
      expect(wallet[0]?.current_syiling).toBe(2)
      const streak = await db.query<{ current: number; last: string | null }>(`select current, last_activity_date::text as last from streaks where user_id = $1`, [id])
      expect(streak[0]).toEqual({ current: 1, last: '2026-10-19' })
    })

    it('the hook runs AFTER the commit: the user and the session are already visible on another connection when it is called', async () => {
      const email = 'murid.selepas@ujian.test'
      const seen: { users: number; sessions: number }[] = []
      const double: LoginHook = {
        onPasswordLogin: async (event) => {
          const users = Number((await db.query<{ n: string }>(`select count(*)::text as n from users where id = $1::bigint`, [event.userId]))[0]?.n)
          seen.push({ users, sessions: await sessionCount(event.userId) })
          expect(event.role).toBe('student')
          expect(event.at).toEqual(t.clock.now())
        },
      }
      ports.overrideLoginHook(double)
      const res = await register({ email })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(seen).toEqual([{ users: 1, sessions: 1 }])
    })

    it.each([
      ['rejects', () => Promise.reject(new Error('gamification is down'))],
      [
        'throws synchronously',
        () => {
          throw new Error('gamification is down')
        },
      ],
    ])('a hook that %s leaves the 201 and the session unchanged', async (_name, behaviour) => {
      const onPasswordLogin = vi.fn(behaviour as () => Promise<void>)
      ports.overrideLoginHook({ onPasswordLogin })
      const email = `murid.rosak${++n}@ujian.test`
      const res = await register({ email })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(onPasswordLogin).toHaveBeenCalledTimes(1)
      const session = SessionSchema.parse(res.body.data)
      expect(session.user.email).toBe(email)
      expect(cookieValue(res)).toBeTruthy()
      expect(res.headers['cache-control']).toBe('no-store')
      expect(await dailyRows(await idByEmail(email))).toEqual([])
    })

    it('a hook that hangs past the cap answers the same 201 after the 2 s cap, not later', async () => {
      const onPasswordLogin = vi.fn(() => new Promise<void>(() => undefined))
      ports.overrideLoginHook({ onPasswordLogin })
      const email = `murid.tergantung${++n}@ujian.test`
      const started = Date.now()
      const res = await register({ email })
      const took = Date.now() - started
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(onPasswordLogin).toHaveBeenCalledTimes(1)
      expect(SessionSchema.parse(res.body.data).user.email).toBe(email)
      expect(cookieValue(res)).toBeTruthy()
      expect(took).toBeGreaterThanOrEqual(1_900)
      expect(took).toBeLessThan(8_000)
    }, 15_000)

    it('a pending teacher registration issues no session and fires no hook', async () => {
      const onPasswordLogin = vi.fn(async () => undefined)
      ports.overrideLoginHook({ onPasswordLogin })
      const email = 'cikgu.menunggu@ujian.test'
      const res = await register({ email, role: 'teacher', grade: null, icNumber: undefined })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(cookieValue(res)).toBeUndefined()
      expect(onPasswordLogin).not.toHaveBeenCalled()
      expect(await sessionCount(await idByEmail(email))).toBe(0)
    })

    it('a refused registration (validation error) fires no hook', async () => {
      const onPasswordLogin = vi.fn(async () => undefined)
      ports.overrideLoginHook({ onPasswordLogin })
      const res = await register({ grade: null })
      expect(res.status).toBe(422)
      expect(onPasswordLogin).not.toHaveBeenCalled()
    })
  })

  describe('password reset', () => {
    const PUPIL = 'pelajar2@demo.test'

    it('the reset auto-login on a new Malaysia day credits +2; the same day pays nothing extra', async () => {
      const id = await idByEmail(PUPIL)
      expect(await dailyRows(id)).toEqual([])

      const first = await reset(PUPIL)
      expect(first.status, JSON.stringify(first.body)).toBe(200)
      expect(await dailyRows(id)).toEqual([expect.objectContaining({ type: 'earn', source_id: 'daily_login:2026-10-19', amount: 2 })])

      const sameDay = await reset(PUPIL) // 16 min later, still 2026-10-19
      expect(sameDay.status, JSON.stringify(sameDay.body)).toBe(200)
      expect(await dailyRows(id)).toHaveLength(1)

      t.clock.set('2026-10-20T00:00:30+08:00')
      const nextDay = await reset(PUPIL)
      expect(nextDay.status, JSON.stringify(nextDay.body)).toBe(200)
      expect((await dailyRows(id)).map((r) => r.source_id)).toEqual(['daily_login:2026-10-19', 'daily_login:2026-10-20'])
      const wallet = await db.query<{ current_syiling: number }>(`select current_syiling from wallets where user_id = $1`, [id])
      expect(wallet[0]?.current_syiling).toBe(4)
      const streak = await db.query<{ current: number; last: string | null }>(`select current, last_activity_date::text as last from streaks where user_id = $1`, [id])
      expect(streak[0]).toEqual({ current: 2, last: '2026-10-20' })
    })

    it('the hook runs AFTER the commit: the new session is already visible on another connection when it is called', async () => {
      const seen: number[] = []
      ports.overrideLoginHook({
        onPasswordLogin: async (event) => {
          seen.push(await sessionCount(event.userId))
        },
      })
      const res = await reset('pelajarmaju@demo.test')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(seen).toEqual([1]) // the reset revoked every older session and issued exactly one
    })

    it.each([
      ['rejects', () => Promise.reject(new Error('gamification is down'))],
      [
        'throws synchronously',
        () => {
          throw new Error('gamification is down')
        },
      ],
    ])('a hook that %s leaves the 200 and the session unchanged', async (_name, behaviour) => {
      const onPasswordLogin = vi.fn(behaviour as () => Promise<void>)
      ports.overrideLoginHook({ onPasswordLogin })
      const res = await reset('pelajarmaju@demo.test')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(onPasswordLogin).toHaveBeenCalledTimes(1)
      expect(SessionSchema.parse(res.body.data).user.email).toBe('pelajarmaju@demo.test')
      expect(cookieValue(res)).toBeTruthy()
    })

    it('a hook that hangs past the cap answers the same 200 after the 2 s cap, not later', async () => {
      const onPasswordLogin = vi.fn(() => new Promise<void>(() => undefined))
      ports.overrideLoginHook({ onPasswordLogin })
      t.clock.advance(16 * 60_000)
      expect((await link('pelajarmaju@demo.test')).status).toBe(200)
      const token = t.mail.last().token
      const started = Date.now()
      const res = await t.http().post('/api/auth/password/reset').send({ token, email: 'pelajarmaju@demo.test', password: DEMO_PASSWORD, passwordConfirmation: DEMO_PASSWORD })
      const took = Date.now() - started
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(onPasswordLogin).toHaveBeenCalledTimes(1)
      expect(cookieValue(res)).toBeTruthy()
      expect(took).toBeGreaterThanOrEqual(1_900)
      expect(took).toBeLessThan(8_000)
    }, 15_000)

    it('a refused reset (bad token) fires no hook', async () => {
      const onPasswordLogin = vi.fn(async () => undefined)
      ports.overrideLoginHook({ onPasswordLogin })
      t.clock.advance(16 * 60_000)
      const res = await t.http().post('/api/auth/password/reset').send({ token: 'x'.repeat(43), email: PUPIL, password: DEMO_PASSWORD, passwordConfirmation: DEMO_PASSWORD })
      expect(res.status).toBe(422)
      expect(onPasswordLogin).not.toHaveBeenCalled()
    })
  })
})
