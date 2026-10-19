import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SubscriptionService, TRIAL_LIMIT } from '../../src/modules/subscriptions'
import { addStudents, addSubscription, bootSubApp, schoolIdOf, userIdOf, type SubTestApp } from './sub-helpers'

const at = (iso: string): Date => new Date(iso)

describe('SubscriptionService (AC 5)', () => {
  let t: SubTestApp
  let service: SubscriptionService
  let s1: string
  let s2: string

  beforeAll(async () => {
    t = await bootSubApp()
    service = t.get(SubscriptionService)
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
  })
  afterAll(async () => {
    await t.close()
  })

  const fresh = async (school: string | null, role = 'student'): Promise<string> => {
    const [u] = await t.db.query<{ id: string }>(`insert into users (name, school_id) values ('Pengguna Ujian', $1) returning id::text`, [school])
    await t.db.query(`insert into user_roles (user_id, role) values ($1, $2)`, [u?.id, role])
    return u?.id as string
  }

  it('the trial limit is the one constant, 50', () => {
    expect(TRIAL_LIMIT).toBe(50)
  })

  describe('isSubscribed', () => {
    it('is false for an unknown user, a malformed id and a user with no school and no complimentary package', async () => {
      expect(await service.isSubscribed('99999999', at('2026-10-19T09:00:00+08:00'))).toBe(false)
      expect(await service.isSubscribed('abc', at('2026-10-19T09:00:00+08:00'))).toBe(false)
      expect(await service.isSubscribed(await fresh(null), at('2026-10-19T09:00:00+08:00'))).toBe(false)
    })

    it('is true for a user of a school with an active subscription covering the Malaysian day, both end days included', async () => {
      const user = await fresh(s1)
      expect(await service.isSubscribed(user, at('2026-10-19T09:00:00+08:00'))).toBe(false) // no subscription yet
      await addSubscription(t.db, { schoolId: s1, status: 'active', starts: '2026-10-01', ends: '2026-12-31' })
      expect(await service.isSubscribed(user, at('2026-09-30T23:59:00+08:00'))).toBe(false)
      expect(await service.isSubscribed(user, at('2026-10-01T00:00:00+08:00'))).toBe(true)
      expect(await service.isSubscribed(user, at('2026-10-19T09:00:00+08:00'))).toBe(true)
      expect(await service.isSubscribed(user, at('2026-12-31T23:59:59+08:00'))).toBe(true)
      expect(await service.isSubscribed(user, at('2027-01-01T00:00:00+08:00'))).toBe(false)
      // 2026-12-31T16:30Z is already 1 January in Malaysia.
      expect(await service.isSubscribed(user, at('2026-12-31T16:30:00Z'))).toBe(false)
    })

    it('only a STUDENT is covered by the school subscription: a parent or a teacher of the school is not', async () => {
      const school = (await t.db.query<{ id: string }>(`insert into schools (name, code) values ('SK Peranan', 'PERAN1') returning id::text`))[0]?.id as string
      await addSubscription(t.db, { schoolId: school, status: 'active', starts: '2026-01-01', ends: '2027-12-31' })
      expect(await service.isSubscribed(await fresh(school, 'student'), at('2026-10-19T09:00:00+08:00'))).toBe(true)
      for (const role of ['parent', 'teacher', 'school_admin']) expect(await service.isSubscribed(await fresh(school, role), at('2026-10-19T09:00:00+08:00'))).toBe(false)
    })

    it('a subscription of another school, or one that is grace, expired or cancelled, does not count', async () => {
      const user = await fresh(s2)
      for (const status of ['grace', 'expired', 'cancelled'] as const) await addSubscription(t.db, { schoolId: s2, status, starts: '2026-01-01', ends: '2027-12-31' })
      expect(await service.isSubscribed(user, at('2026-10-19T09:00:00+08:00'))).toBe(false)
      // s1 has an active subscription (previous test); the user of s2 is unaffected by it.
      expect(await service.isSubscribed(user, at('2026-10-19T09:00:00+08:00'))).toBe(false)
    })

    it('a complimentary student is subscribed until the end of the package day (Malaysia time, that day included)', async () => {
      const user = await fresh(null)
      await t.db.query(`update users set is_complimentary = true where id = $1`, [user])
      await t.db.query(`insert into comp_students (user_id, package_expires_on) values ($1, '2026-12-31')`, [user])
      expect(await service.isSubscribed(user, at('2026-10-19T09:00:00+08:00'))).toBe(true)
      expect(await service.isSubscribed(user, at('2026-12-31T23:59:59+08:00'))).toBe(true)
      expect(await service.isSubscribed(user, at('2027-01-01T00:00:00+08:00'))).toBe(false)
    })
  })

  describe('trial', () => {
    it('returns { active, used, limit: 50, remaining } with active = !subscribed', async () => {
      const user = await fresh(null)
      expect(await service.trial(user, at('2026-10-19T09:00:00+08:00'))).toEqual({ active: true, used: 0, limit: 50, remaining: 50 })
      await t.db.query(`update users set trial_questions_used = 12 where id = $1`, [user])
      expect(await service.trial(user, at('2026-10-19T09:00:00+08:00'))).toEqual({ active: true, used: 12, limit: 50, remaining: 38 })
      await t.db.query(`update users set trial_questions_used = 70 where id = $1`, [user])
      expect(await service.trial(user, at('2026-10-19T09:00:00+08:00'))).toEqual({ active: true, used: 70, limit: 50, remaining: 0 })
    })

    it('is not active for a subscribed user and an unknown user has used 0', async () => {
      const student = await userIdOf(t.db, 'pelajar@demo.test')
      expect(await service.trial(student, at('2026-10-19T09:00:00+08:00'))).toMatchObject({ active: false, limit: 50 })
      expect(await service.trial('99999999', at('2026-10-19T09:00:00+08:00'))).toEqual({ active: true, used: 0, limit: 50, remaining: 50 })
    })
  })

  describe('incrementTrialUsed', () => {
    it('adds exactly 1 and returns the new value', async () => {
      const user = await fresh(null)
      expect(await service.incrementTrialUsed(user)).toBe(1)
      expect(await service.incrementTrialUsed(user)).toBe(2)
      expect((await t.db.query<{ n: number }>(`select trial_questions_used n from users where id = $1`, [user]))[0]?.n).toBe(2)
    })

    it('is atomic: 25 parallel calls add exactly 25', async () => {
      const user = await fresh(null)
      const results = await Promise.all(Array.from({ length: 25 }, () => service.incrementTrialUsed(user)))
      expect([...results].sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_v, i) => i + 1))
      expect((await service.trial(user, at('2026-10-19T09:00:00+08:00'))).used).toBe(25)
    })

    it('is 404 for an unknown or malformed user and touches nobody else', async () => {
      const students = await addStudents(t.db, s1, 1)
      await expect(service.incrementTrialUsed('99999999')).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(service.incrementTrialUsed('abc')).rejects.toMatchObject({ code: 'NOT_FOUND' })
      expect((await t.db.query<{ n: number }>(`select trial_questions_used n from users where id = $1`, [students[0]]))[0]?.n).toBe(0)
    })
  })
})
