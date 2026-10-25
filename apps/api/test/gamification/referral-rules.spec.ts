import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { gamificationSeed } from '../../prisma/seed/gamification'
import { walletSeed } from '../../prisma/seed/wallet'
import { AuthPorts } from '../../src/modules/auth'
import { GamificationModule, GamificationService } from '../../src/modules/gamification'
import { REFERRAL_MAX_PER_REFERRER_PER_DAY } from '../../src/modules/gamification/gamification.constants'
import { WalletModule } from '../../src/modules/wallet'
import { type AccountTestApp, bootAccountApp, REGISTER_STUDENT, userRow } from '../account/account-helpers'
import { schoolIdOf } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'

/** Follow-up rules of BR-M14-19 on `applyReferral`: the per-referrer daily cap and `coinsEnabled` (deviations log, REFERRAL). */

const syiling = async (db: TestDatabase, userId: string): Promise<number | undefined> =>
  (await db.query<{ current_syiling: number }>(`select current_syiling from wallets where user_id = $1::bigint`, [userId]))[0]?.current_syiling
const referralRows = (db: TestDatabase) =>
  db.query<{ referrer_id: string; referee_id: string; rewarded: boolean }>(`select referrer_id::text, referee_id::text, rewarded from referrals order by id`)
const referralCount = async (db: TestDatabase): Promise<number> => (await referralRows(db)).length

describe('referral rules (per-referrer daily cap, coinsEnabled)', () => {
  let db: TestDatabase
  let t: AccountTestApp
  let schoolId: string
  let seq = 0

  const register = async (code: string) => {
    seq += 1
    const email = `peraturan${String(seq)}@ujian.test`
    const res = await t.http().post('/api/auth/register').send({ ...REGISTER_STUDENT, icNumber: undefined, email, schoolId, referralCode: code })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return (await userRow(db, email))!.id
  }
  /** A fresh referrer (a student of the seeded school) and its code, so tests do not share a referrer. */
  const newReferrer = async (): Promise<{ id: string; code: string }> => {
    seq += 1
    const rows = await db.query<{ id: string }>(
      `insert into users (name, email, school_id, grade, created_at) values ('Perujuk Ujian', $1, $2, 4, '2020-01-01') returning id::text`,
      [`perujuk${String(seq)}@ujian.test`, schoolId],
    )
    const id = rows[0]!.id
    await db.query(`insert into user_roles (user_id, role, created_at) values ($1::bigint, 'student', now())`, [id])
    return { id, code: (await t.app.get(GamificationService).referral(id)).code }
  }

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, walletSeed, gamificationSeed], { prisma: db.prisma })
    t = await bootAccountApp({ db, modules: [WalletModule, GamificationModule] })
    t.app.get(AuthPorts).overrideLoginHook(null) // no +2 daily_login on a registration's auto-login
    schoolId = await schoolIdOf(db, 'DEMO001')
  })
  beforeEach(() => {
    t.clock.advance(61_000) // the register bucket starts fresh for every test
  })
  afterAll(async () => {
    await t.close()
    await db.drop()
  })

  it('the cap is 10 referrals per referrer in a rolling 24 hours', () => {
    expect(REFERRAL_MAX_PER_REFERRER_PER_DAY).toBe(10)
  })

  it('the 11th referral within 24 h pays nothing and stores no row; one more after 24 h pays again', async () => {
    const referrer = await newReferrer()
    for (let i = 0; i < REFERRAL_MAX_PER_REFERRER_PER_DAY; i++) {
      const id = await register(referrer.code)
      expect(await syiling(db, id)).toBe(25)
    }
    expect(await syiling(db, referrer.id)).toBe(50 * REFERRAL_MAX_PER_REFERRER_PER_DAY)
    expect(await referralCount(db)).toBe(REFERRAL_MAX_PER_REFERRER_PER_DAY)

    // The 11th, still inside the 24 hours: registered normally, but nothing is stored or paid.
    t.clock.advance(23 * 60 * 60 * 1000)
    const eleventh = await register(referrer.code)
    expect(await syiling(db, eleventh)).toBeUndefined()
    expect(await db.query(`select 1 from coin_ledger where user_id = $1::bigint`, [eleventh])).toEqual([])
    expect(await syiling(db, referrer.id)).toBe(50 * REFERRAL_MAX_PER_REFERRER_PER_DAY)
    expect(await referralCount(db)).toBe(REFERRAL_MAX_PER_REFERRER_PER_DAY)

    // Past 24 hours from the first ten: the window has emptied and the next referral pays again.
    t.clock.advance(2 * 60 * 60 * 1000)
    const twelfth = await register(referrer.code)
    expect(await syiling(db, twelfth)).toBe(25)
    expect(await syiling(db, referrer.id)).toBe(50 * (REFERRAL_MAX_PER_REFERRER_PER_DAY + 1))
    expect(await referralCount(db)).toBe(REFERRAL_MAX_PER_REFERRER_PER_DAY + 1)
  })

  it('the cap is per referrer: another referrer is not affected by a full one', async () => {
    const full = await newReferrer()
    const other = await newReferrer()
    const before = await referralCount(db)
    for (let i = 0; i < REFERRAL_MAX_PER_REFERRER_PER_DAY; i++) await register(full.code)
    const viaOther = await register(other.code)
    expect(await syiling(db, viaOther)).toBe(25)
    expect(await syiling(db, other.id)).toBe(50)
    expect(await referralCount(db)).toBe(before + REFERRAL_MAX_PER_REFERRER_PER_DAY + 1)
  })

  it('a referrer with coins disabled gets no credit, the referee still gets 25, and the referral row exists (rewarded = false)', async () => {
    const referrer = await newReferrer()
    await db.query(`update users set is_complimentary = true where id = $1::bigint`, [referrer.id])
    await db.query(`insert into comp_students (user_id, coins_enabled, package_expires_on, created_at) values ($1::bigint, false, '2099-12-31', '2020-01-01')`, [referrer.id])
    expect(await t.app.get(GamificationService).coinsEnabled(referrer.id)).toBe(false)

    const referee = await register(referrer.code)
    expect(await syiling(db, referee)).toBe(25)
    expect(await syiling(db, referrer.id)).toBeUndefined()
    expect(await db.query(`select 1 from coin_ledger where user_id = $1::bigint`, [referrer.id])).toEqual([])
    expect((await referralRows(db)).filter((r) => r.referrer_id === referrer.id)).toEqual([{ referrer_id: referrer.id, referee_id: referee, rewarded: false }])
  })

  it('a referrer with coins enabled is credited and the row is rewarded = true', async () => {
    const referrer = await newReferrer()
    const referee = await register(referrer.code)
    expect(await syiling(db, referrer.id)).toBe(50)
    expect((await referralRows(db)).filter((r) => r.referrer_id === referrer.id)).toEqual([{ referrer_id: referrer.id, referee_id: referee, rewarded: true }])
  })

  it('a referee with coins disabled gets nothing while the referrer is paid (applyReferral called directly)', async () => {
    const referrer = await newReferrer()
    seq += 1
    const rows = await db.query<{ id: string }>(`insert into users (name, email, school_id, grade, created_at) values ('Rakan Ujian', $1, $2, 4, '2020-01-01') returning id::text`, [
      `rakan${String(seq)}@ujian.test`,
      schoolId,
    ])
    const referee = rows[0]!.id
    await db.query(`insert into comp_students (user_id, coins_enabled, package_expires_on, created_at) values ($1::bigint, false, '2099-12-31', '2020-01-01')`, [referee])
    expect(await t.app.get(GamificationService).applyReferral(referee, referrer.code, { isTest: false })).toEqual({ applied: true })
    expect(await syiling(db, referee)).toBeUndefined()
    expect(await syiling(db, referrer.id)).toBe(50)
    expect((await referralRows(db)).filter((r) => r.referee_id === referee)).toEqual([{ referrer_id: referrer.id, referee_id: referee, rewarded: true }])
  })
})
