import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { gamificationSeed } from '../../prisma/seed/gamification'
import { walletSeed } from '../../prisma/seed/wallet'
import { AccountPorts, type RegistrationHook } from '../../src/modules/account'
import { AuthPorts } from '../../src/modules/auth'
import { GamificationModule, GamificationService } from '../../src/modules/gamification'
import { WalletModule } from '../../src/modules/wallet'
import { schoolIdOf, userIdOf } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { type AccountTestApp, bootAccountApp, errorOf, REGISTER_STUDENT, userRow } from './account-helpers'

/** XR-M14-02(b) / BR-M14-19: the register call hands its `referralCode` to M14, inside the registration transaction. */

interface LedgerRow {
  type: string
  source: string
  source_id: string | null
  amount: number
  description: string | null
  is_test: boolean
}

const ledger = (db: TestDatabase, userId: string) =>
  db.query<LedgerRow>(`select type, source, source_id, amount, description, is_test from coin_ledger where user_id = $1::bigint order by id`, [userId])
const referrals = (db: TestDatabase) =>
  db.query<{ referrer_id: string; referee_id: string; code_used: string; rewarded: boolean }>(
    `select referrer_id::text, referee_id::text, code_used, rewarded from referrals order by id`,
  )
const syiling = async (db: TestDatabase, userId: string): Promise<number | undefined> =>
  (await db.query<{ current_syiling: number }>(`select current_syiling from wallets where user_id = $1::bigint`, [userId]))[0]?.current_syiling
const count = async (db: TestDatabase, table: string): Promise<number> => Number((await db.query<{ n: string }>(`select count(*)::text as n from ${table}`))[0]?.n)

describe('self-registration applies the referral code (XR-M14-02, BR-M14-19)', () => {
  let db: TestDatabase
  let t: AccountTestApp
  let schoolId: string
  let referrerId: string
  let code: string
  let seq = 0

  const body = (extra: object = {}) => {
    seq += 1
    return { ...REGISTER_STUDENT, icNumber: undefined, email: `rujuk${String(seq)}@ujian.test`, schoolId, ...extra }
  }
  const register = (payload: object) => t.http().post('/api/auth/register').send(payload)

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, walletSeed, gamificationSeed], { prisma: db.prisma })
    t = await bootAccountApp({ db, modules: [WalletModule, GamificationModule] })
    // The referral is under test: the M14 login hook is switched off, so a registration's auto-login (FR-M01-69,
    // LOGINHOOK-AUTO) adds no +2 daily_login to these balances. A no-op while no registration path fires it.
    t.app.get(AuthPorts).overrideLoginHook(null)
    schoolId = await schoolIdOf(db, 'DEMO001')
    referrerId = await userIdOf(db, 'pelajar@demo.test')
    code = (await t.app.get(GamificationService).referral(referrerId)).code
  })
  beforeEach(() => {
    // The register bucket (30 per minute per address) starts fresh for every test.
    t.clock.advance(61_000)
  })
  afterAll(async () => {
    await t.close()
    await db.drop()
  })

  it('a known code pays the new user 25 and the referrer 50, once each, with one referral row', async () => {
    const referrerBefore = (await syiling(db, referrerId)) ?? 0
    const referrerLedgerBefore = (await ledger(db, referrerId)).length

    const res = await register(body({ email: 'b.rujuk@ujian.test', referralCode: code }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const b = (await userRow(db, 'b.rujuk@ujian.test'))!.id

    expect(await ledger(db, b)).toEqual([
      { type: 'bonus', source: 'referral', source_id: `referral:${b}`, amount: 25, description: `Bonus rujukan: kod ${code}`, is_test: false },
    ])
    expect(await syiling(db, b)).toBe(25)
    const referrerLedger = await ledger(db, referrerId)
    expect(referrerLedger).toHaveLength(referrerLedgerBefore + 1)
    expect(referrerLedger.at(-1)).toEqual({ type: 'bonus', source: 'referral', source_id: `referral:${b}`, amount: 50, description: 'Rujukan kawan berjaya', is_test: false })
    expect(await syiling(db, referrerId)).toBe(referrerBefore + 50)
    expect(await referrals(db)).toEqual([{ referrer_id: referrerId, referee_id: b, code_used: code, rewarded: true }])
  })

  it('the response is the plain registration answer (nothing about the referral)', async () => {
    const res = await register(body({ referralCode: code }))
    expect(res.status).toBe(201)
    expect(JSON.stringify(res.body)).not.toMatch(/referral|syiling|bonus/i)
  })

  it('a second user with the same code is paid too (one reward per referee); replaying the first referee pays nothing', async () => {
    const before = await referrals(db)
    const referrerBefore = await syiling(db, referrerId)

    const res = await register(body({ email: 'c.rujuk@ujian.test', referralCode: ` ${code.toLowerCase()} ` }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const c = (await userRow(db, 'c.rujuk@ujian.test'))!.id
    expect(await syiling(db, c)).toBe(25)
    expect(await syiling(db, referrerId)).toBe((referrerBefore ?? 0) + 50)
    expect(await referrals(db)).toHaveLength(before.length + 1)
    expect((await referrals(db)).at(-1)).toMatchObject({ referrer_id: referrerId, referee_id: c, code_used: code })

    // The same referee again (the entry point a retry would take): the unique referee row and the ledger key hold.
    const b = (await userRow(db, 'b.rujuk@ujian.test'))!.id
    const again = await t.app.get(GamificationService).applyReferral(b, code, { isTest: false })
    expect(again).toEqual({ applied: false })
    expect(await ledger(db, b)).toHaveLength(1)
    expect(await syiling(db, b)).toBe(25)
    expect(await syiling(db, referrerId)).toBe((referrerBefore ?? 0) + 50)
    expect(await referrals(db)).toHaveLength(before.length + 1)
    // And a second sign-up with the same e-mail is refused before anything is paid.
    errorOf(await register(body({ email: 'c.rujuk@ujian.test', referralCode: code })), 422, 'VALIDATION_ERROR')
    expect(await referrals(db)).toHaveLength(before.length + 1)
  })

  it.each([
    ['an unknown code', { referralCode: 'ZZZZZZZ' }],
    ['an empty code', { referralCode: '' }],
    ['a blank code', { referralCode: '   ' }],
    ['a null code', { referralCode: null }],
    ['no code', {}],
  ])('%s: registration succeeds and nothing is paid', async (_label, extra) => {
    const referrerBefore = await syiling(db, referrerId)
    const referralsBefore = await count(db, 'referrals')
    const ledgerBefore = await count(db, 'coin_ledger')
    const email = body().email
    const res = await register(body({ email, ...extra }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = (await userRow(db, email))!.id
    expect(await ledger(db, id)).toEqual([])
    expect(await syiling(db, referrerId)).toBe(referrerBefore)
    expect(await count(db, 'referrals')).toBe(referralsBefore)
    expect(await count(db, 'coin_ledger')).toBe(ledgerBefore)
  })

  it('a pending teacher with a known code is created inactive and earns no referral (no row, no credit for anyone)', async () => {
    const referrerBefore = await syiling(db, referrerId)
    const referralsBefore = await count(db, 'referrals')
    const ledgerBefore = await count(db, 'coin_ledger')
    const res = await register({ name: 'Guru Rujuk', email: 'guru.rujuk@ujian.test', role: 'teacher', schoolId, password: 'rahsia1', passwordConfirmation: 'rahsia1', referralCode: code })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const row = (await userRow(db, 'guru.rujuk@ujian.test'))!
    expect(row.school_id).toBeNull()
    expect(await syiling(db, row.id)).toBeUndefined()
    expect(await ledger(db, row.id)).toEqual([])
    expect(await syiling(db, referrerId)).toBe(referrerBefore)
    expect(await count(db, 'referrals')).toBe(referralsBefore)
    expect(await count(db, 'coin_ledger')).toBe(ledgerBefore)
  })

  it('the referral is written in the registration transaction: a failure of the host after it rolls the new user and the credits back', async () => {
    const ports = t.app.get(AccountPorts)
    const real = ports.registrationHook as RegistrationHook
    ports.overrideRegistrationHook({
      async onRegistered(event) {
        await real.onRegistered(event)
        expect(await syiling(db, event.userId)).toBeUndefined() // not visible outside the transaction yet
        throw new Error('boom after the referral')
      },
    })
    try {
      const referrerBefore = await syiling(db, referrerId)
      const referralsBefore = await count(db, 'referrals')
      const ledgerBefore = await count(db, 'coin_ledger')
      const res = await register(body({ email: 'batal.rujuk@ujian.test', referralCode: code }))
      expect(res.status).toBe(500)
      expect(await userRow(db, 'batal.rujuk@ujian.test')).toBeUndefined()
      expect(await syiling(db, referrerId)).toBe(referrerBefore)
      expect(await count(db, 'referrals')).toBe(referralsBefore)
      expect(await count(db, 'coin_ledger')).toBe(ledgerBefore)
    } finally {
      ports.overrideRegistrationHook(real)
    }
  })

  describe('M14 failure never aborts a registration (savepoint `referral_apply`)', () => {
    const sessionsOf = async (userId: string): Promise<number> =>
      Number((await db.query<{ n: string }>('select count(*)::text as n from sessions where user_id = $1::bigint', [userId]))[0]?.n)

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('applyReferral throws: still 201, user and session exist (read from another connection), no referral or wallet rows', async () => {
      vi.spyOn(t.app.get(GamificationService), 'applyReferral').mockRejectedValueOnce(new Error('boom'))
      const referrerBefore = await syiling(db, referrerId)
      const referralsBefore = await count(db, 'referrals')
      const ledgerBefore = await count(db, 'coin_ledger')
      const email = body().email
      const res = await register(body({ email, referralCode: code }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      // `db` is a separate pool from the app: this read sees only what the registration COMMITTED.
      const row = await userRow(db, email)
      expect(row).toBeDefined()
      const id = row!.id
      expect(await sessionsOf(id)).toBe(1)
      expect(await ledger(db, id)).toEqual([])
      expect(await syiling(db, id)).toBeUndefined()
      expect(await syiling(db, referrerId)).toBe(referrerBefore)
      expect(await count(db, 'referrals')).toBe(referralsBefore)
      expect(await count(db, 'coin_ledger')).toBe(ledgerBefore)
    })

    it('a database error inside the hook after real referral writes: the savepoint is rolled back, the registration commits without them', async () => {
      const service = t.app.get(GamificationService)
      const real = service.applyReferral.bind(service)
      vi.spyOn(service, 'applyReferral').mockImplementationOnce(async (newUserId, c, opts) => {
        const out = await real(newUserId, c, opts) // writes the referral row and both credits ...
        expect(out.applied).toBe(true)
        await opts.tx!.$executeRawUnsafe('select * from table_that_does_not_exist') // ... then PG aborts the transaction
        return out
      })
      const referrerBefore = await syiling(db, referrerId)
      const referralsBefore = await count(db, 'referrals')
      const ledgerBefore = await count(db, 'coin_ledger')
      const email = body().email
      const res = await register(body({ email, referralCode: code }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const row = await userRow(db, email)
      expect(row).toBeDefined()
      expect(await sessionsOf(row!.id)).toBe(1)
      expect(await ledger(db, row!.id)).toEqual([])
      expect(await syiling(db, referrerId)).toBe(referrerBefore)
      expect(await count(db, 'referrals')).toBe(referralsBefore)
      expect(await count(db, 'coin_ledger')).toBe(ledgerBefore)
    })

    it('the next registration with the same code still pays (the failure left no state behind)', async () => {
      const referrerBefore = (await syiling(db, referrerId)) ?? 0
      const email = body().email
      const res = await register(body({ email, referralCode: code }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(await syiling(db, (await userRow(db, email))!.id)).toBe(25)
      expect(await syiling(db, referrerId)).toBe(referrerBefore + 50)
    })
  })
})

describe('REGISTRATION_OPEN=false: a referral code changes nothing', () => {
  let db: TestDatabase
  let t: AccountTestApp
  let schoolId: string

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, walletSeed, gamificationSeed], { prisma: db.prisma })
    t = await bootAccountApp({ db, env: { REGISTRATION_OPEN: 'false' }, modules: [WalletModule, GamificationModule] })
    schoolId = await schoolIdOf(db, 'DEMO001')
  })
  afterAll(async () => {
    await t.close()
    await db.drop()
  })

  it('403 REGISTRATION_CLOSED, no user, no referral, no ledger row', async () => {
    const referrerId = await userIdOf(db, 'pelajar@demo.test')
    const code = (await t.app.get(GamificationService).referral(referrerId)).code
    const users = await count(db, 'users')
    const ledgerBefore = await count(db, 'coin_ledger')
    const res = await t.http().post('/api/auth/register').send({ ...REGISTER_STUDENT, icNumber: undefined, email: 'tutup.rujuk@ujian.test', schoolId, referralCode: code })
    errorOf(res, 403, 'REGISTRATION_CLOSED')
    expect(await count(db, 'users')).toBe(users)
    expect(await count(db, 'referrals')).toBe(0)
    expect(await count(db, 'coin_ledger')).toBe(ledgerBefore)
  })
})
