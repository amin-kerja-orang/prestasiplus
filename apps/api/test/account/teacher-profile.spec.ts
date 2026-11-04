import { ACCOUNT_TEACHER_PROFILE_MESSAGES, AccountTeacherProfileSchema, AccountTeacherPublicSchema, type AccountTeacherProfile } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { identitySeed } from '../../prisma/seed/core/identity'
import { runSeeds } from '../../prisma/seed'
import { createTestDatabase } from '../support/db'
import { type AccountTestApp, bootAccountApp, errorOf, fieldsOf, get, login, put, userRow } from './account-helpers'

/** API-GUR-22 `GET/PUT /api/account/teacher-profile` and `GET /api/public/teachers/:id` (S5-T05, issue 458 decisions 6 and 7). */
const TEACHER = 'guru@demo.test'
const OTHER_TEACHER = 'guruadmin@demo.test'
const SCHOOL_ADMIN = 'adminsekolah@demo.test'
const ADMIN = 'admin@demo.test'
const STUDENT = 'pelajar@demo.test'
const IC = '860101015432'
const OTHER_IC = '900202025678'

const BODY = {
  name: 'Guru Demo Dikemaskini',
  bio: 'Pendidik Sains.',
  ic: IC,
  subject: 'Matematik',
  qualification: 'Ijazah Sarjana Pendidikan',
  experienceYears: 7,
}

describe('teacher profile (API-GUR-22)', () => {
  let t: AccountTestApp
  let teacherId: string
  let otherTeacherId: string

  beforeAll(async () => {
    const db = await createTestDatabase()
    await runSeeds([identitySeed], { prisma: db.prisma })
    t = await bootAccountApp({ db })
    teacherId = (await userRow(t.db, TEACHER))?.id as string
    otherTeacherId = (await userRow(t.db, OTHER_TEACHER))?.id as string
  })
  afterAll(async () => {
    await t.close()
  })

  describe('GET /account/teacher-profile', () => {
    it('returns the own profile with the school name and no IC, e-mail or phone', async () => {
      const who = await login(t, TEACHER)
      const res = await get(who, '/account/teacher-profile')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const data = AccountTeacherProfileSchema.parse(res.body.data)
      expect(data.name).toBe('Guru Demo')
      expect(data.school?.name).toBeTruthy()
      expect(data.experienceYears).toBe(0)
      expect(data.subject).toBeNull()
      const text = JSON.stringify(res.body)
      expect(text).not.toContain(TEACHER)
      expect(Object.keys(res.body.data).sort()).toEqual(['bio', 'experienceYears', 'icMasked', 'name', 'qualification', 'school', 'subject'])
      expect(res.headers['cache-control']).toContain('no-store')
    })

    it('is for the teacher role only: a pupil and a school admin get 403', async () => {
      for (const email of [STUDENT, SCHOOL_ADMIN]) {
        const who = await login(t, email)
        errorOf(await get(who, '/account/teacher-profile'), 403, 'FORBIDDEN')
      }
    })

    it('needs a session', async () => {
      errorOf(await t.agent().get('/api/account/teacher-profile'), 401, 'UNAUTHORIZED')
    })
  })

  describe('PUT /account/teacher-profile', () => {
    it('saves name, bio, IC and the teaching details, and reads them back', async () => {
      const who = await login(t, TEACHER)
      const res = await put(who, '/account/teacher-profile', BODY)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.status).toBe(ACCOUNT_TEACHER_PROFILE_MESSAGES.saved)
      const data: AccountTeacherProfile = AccountTeacherProfileSchema.parse(res.body.data)
      expect(data).toMatchObject({ name: BODY.name, bio: BODY.bio, subject: 'Matematik', qualification: BODY.qualification, experienceYears: 7, icMasked: 'xxxxxx-xx-xx32' })

      const again = AccountTeacherProfileSchema.parse((await get(who, '/account/teacher-profile')).body.data)
      expect(again).toEqual(data)
      const rows = await t.db.query<{ subject: string; qualification: string; experience_years: number }>('select subject, qualification, experience_years from teacher_profiles where user_id = $1::bigint', [teacherId])
      expect(rows).toEqual([{ subject: 'Matematik', qualification: BODY.qualification, experience_years: 7 }])
    })

    it('never returns the full IC and stores it only as hash and mask', async () => {
      const who = await login(t, TEACHER)
      const res = await put(who, '/account/teacher-profile', BODY)
      expect(JSON.stringify(res.body)).not.toContain(IC)
      expect(JSON.stringify((await get(who, '/me')).body)).not.toContain(IC)
      const row = await userRow(t.db, TEACHER)
      expect(row?.ic_masked).toBe('xxxxxx-xx-xx32')
      expect(row?.ic_hash).toMatch(/^[0-9a-f]{64}$/)
      expect(row?.ic_hash).not.toContain(IC)
      const columns = await t.db.query<{ v: string }>('select (to_jsonb(u)::text) as v from users u where u.id = $1::bigint', [teacherId])
      expect(columns[0]?.v).not.toContain(IC)
    })

    it('keeps the stored IC when ic is blank or absent', async () => {
      const who = await login(t, TEACHER)
      const before = await userRow(t.db, TEACHER)
      for (const ic of [undefined, '', null]) {
        const res = await put(who, '/account/teacher-profile', { ...BODY, ic })
        expect(res.status, JSON.stringify(res.body)).toBe(200)
      }
      const after = await userRow(t.db, TEACHER)
      expect(after?.ic_hash).toBe(before?.ic_hash)
      expect(after?.ic_masked).toBe('xxxxxx-xx-xx32')
    })

    it('does not write the school, the phone or the e-mail', async () => {
      const who = await login(t, TEACHER)
      const before = await userRow(t.db, TEACHER)
      const res = await put(who, '/account/teacher-profile', { ...BODY, schoolId: '999999', phone: '0123456789', email: 'baharu@demo.test', role: 'admin' })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const after = await userRow(t.db, TEACHER)
      expect(after?.school_id).toBe(before?.school_id)
      expect(after?.phone).toBe(before?.phone)
      expect(await userRow(t.db, 'baharu@demo.test')).toBeUndefined()
      expect((await get(who, '/me')).body.data.role).toBe('teacher')
    })

    it('clears subject, qualification and bio with blank text and keeps experience when absent', async () => {
      const who = await login(t, TEACHER)
      const res = await put(who, '/account/teacher-profile', { ...BODY, experienceYears: undefined, bio: '  ', subject: '', qualification: null })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toMatchObject({ bio: null, subject: null, qualification: null, experienceYears: 7 })
      await put(who, '/account/teacher-profile', BODY)
    })

    it('accepts experience 0 and 60 and refuses 61, -1 and 2.5', async () => {
      const who = await login(t, TEACHER)
      for (const years of [0, 60]) expect((await put(who, '/account/teacher-profile', { ...BODY, experienceYears: years })).status).toBe(200)
      for (const years of [61, -1, 2.5]) {
        expect(fieldsOf(await put(who, '/account/teacher-profile', { ...BODY, experienceYears: years }))).toEqual({ experienceYears: ACCOUNT_TEACHER_PROFILE_MESSAGES.experienceRange })
      }
      await put(who, '/account/teacher-profile', BODY)
      const rows = await t.db.query<{ experience_years: number }>('select experience_years from teacher_profiles where user_id = $1::bigint', [teacherId])
      expect(rows[0]?.experience_years).toBe(7)
    })

    it('answers the exact BM messages of the field table and saves nothing', async () => {
      const who = await login(t, TEACHER)
      const before = await userRow(t.db, TEACHER)
      const res = await put(who, '/account/teacher-profile', {
        name: ' ',
        bio: 'b'.repeat(1001),
        ic: '12345678901',
        subject: 's'.repeat(101),
        qualification: 'q'.repeat(151),
        experienceYears: 61,
      })
      expect(fieldsOf(res)).toEqual({
        name: ACCOUNT_TEACHER_PROFILE_MESSAGES.nameRequired,
        bio: ACCOUNT_TEACHER_PROFILE_MESSAGES.bioMax,
        ic: ACCOUNT_TEACHER_PROFILE_MESSAGES.icFormat,
        subject: ACCOUNT_TEACHER_PROFILE_MESSAGES.subjectMax,
        qualification: ACCOUNT_TEACHER_PROFILE_MESSAGES.qualificationMax,
        experienceYears: ACCOUNT_TEACHER_PROFILE_MESSAGES.experienceRange,
      })
      expect((await userRow(t.db, TEACHER))?.name).toBe(before?.name)
      expect(fieldsOf(await put(who, '/account/teacher-profile', { ...BODY, name: 'n'.repeat(256) }))).toEqual({ name: ACCOUNT_TEACHER_PROFILE_MESSAGES.nameMax })
      expect(fieldsOf(await put(who, '/account/teacher-profile', { ...BODY, ic: '860101-01-5432' }))).toEqual({ ic: ACCOUNT_TEACHER_PROFILE_MESSAGES.icFormat })
    })

    it('refuses an IC that another account holds', async () => {
      const who = await login(t, TEACHER)
      expect((await put(who, '/account/teacher-profile', { ...BODY, ic: IC })).status).toBe(200)
      // Another account (the second teacher) ends up with the same IC hash.
      await t.db.query('update users set ic_hash = (select ic_hash from users where id = $1::bigint) where id = $2::bigint', [teacherId, otherTeacherId])
      expect(fieldsOf(await put(who, '/account/teacher-profile', { ...BODY, ic: IC }))).toEqual({ ic: ACCOUNT_TEACHER_PROFILE_MESSAGES.icTaken })
      await t.db.query('update users set ic_hash = null where id = $1::bigint', [otherTeacherId])
      expect((await put(who, '/account/teacher-profile', { ...BODY, ic: IC })).status).toBe(200)
      // A different, free IC is accepted and the own old one is replaced.
      expect((await put(who, '/account/teacher-profile', { ...BODY, ic: OTHER_IC })).body.data.icMasked).toBe('xxxxxx-xx-xx78')
      await put(who, '/account/teacher-profile', { ...BODY, ic: IC })
    })

    it('is for the teacher role only and needs the CSRF token', async () => {
      const pupil = await login(t, STUDENT)
      errorOf(await put(pupil, '/account/teacher-profile', BODY), 403, 'FORBIDDEN')
      const admin = await login(t, ADMIN)
      errorOf(await put(admin, '/account/teacher-profile', BODY), 403, 'FORBIDDEN')
      const who = await login(t, TEACHER)
      const noCsrf = await who.agent.put('/api/account/teacher-profile').send(BODY)
      expect(noCsrf.status).toBe(403)
    })
  })

  describe('GET /public/teachers/:id', () => {
    beforeAll(async () => {
      await t.db.query('update users set bio = $2 where id = $1::bigint', [otherTeacherId, 'Bio guru lain.'])
      await t.db.query(
        `insert into teacher_profiles (user_id, subject, qualification, experience_years) values ($1::bigint, 'Sains', 'Ijazah Sarjana Muda', 12)
         on conflict (user_id) do update set subject = excluded.subject, qualification = excluded.qualification, experience_years = excluded.experience_years`,
        [otherTeacherId],
      )
    })

    it('shows another teacher card to a teacher: name, subject, bio, qualification, experience; no IC, e-mail or phone', async () => {
      const who = await login(t, TEACHER)
      const res = await get(who, `/public/teachers/${otherTeacherId}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(AccountTeacherPublicSchema.parse(res.body.data)).toEqual({ name: 'Guru Admin Demo', subject: 'Sains', bio: 'Bio guru lain.', qualification: 'Ijazah Sarjana Muda', experienceYears: 12 })
      const text = JSON.stringify(res.body)
      expect(text).not.toContain(OTHER_TEACHER)
      expect(Object.keys(res.body.data).sort()).toEqual(['bio', 'experienceYears', 'name', 'qualification', 'subject'])
    })

    it('lets a teacher open the own card, an admin and a school admin open any card', async () => {
      for (const email of [TEACHER, ADMIN, SCHOOL_ADMIN]) {
        const who = await login(t, email)
        const res = await get(who, `/public/teachers/${teacherId}`)
        expect(res.status, `${email}: ${JSON.stringify(res.body)}`).toBe(200)
      }
    })

    it('answers a uniform 404 to a pupil, to an unknown id, to a malformed id and for a user who is not a teacher', async () => {
      const pupil = await login(t, STUDENT)
      errorOf(await get(pupil, `/public/teachers/${teacherId}`), 404, 'NOT_FOUND')
      const who = await login(t, TEACHER)
      const adminId = (await userRow(t.db, ADMIN))?.id as string
      const studentId = (await userRow(t.db, STUDENT))?.id as string
      for (const id of ['999999999', 'abc', adminId, studentId]) errorOf(await get(who, `/public/teachers/${id}`), 404, 'NOT_FOUND')
    })

    it('is not public: no session is 401', async () => {
      errorOf(await t.agent().get(`/api/public/teachers/${teacherId}`), 401, 'UNAUTHORIZED')
    })

    it('does not show an inactive teacher', async () => {
      const who = await login(t, TEACHER)
      await t.db.query('update users set is_active = false where id = $1::bigint', [otherTeacherId])
      errorOf(await get(who, `/public/teachers/${otherTeacherId}`), 404, 'NOT_FOUND')
      await t.db.query('update users set is_active = true where id = $1::bigint', [otherTeacherId])
    })
  })
})
