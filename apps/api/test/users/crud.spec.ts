import {
  CreatedUserSchema,
  DeletedResultSchema,
  UpdatedUserSchema,
  UserFiltersSchema,
  UserListMetaSchema,
  UserToggleResultSchema,
  USER_MESSAGES,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, apiOf, bootUsersApp, detailOf, expectError, fieldsOf, login, schoolIdOf, teacherBody, type Api, type UsersTestApp } from './helpers'

describe('admin users: create, read, update, toggle, delete (AC 1, 2, 4, 7, 8)', () => {
  let t: UsersTestApp
  let api: Api
  let school1: string
  let school2: string

  beforeAll(async () => {
    t = await bootUsersApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '100000', THROTTLE_ADMIN_READ_PER_MINUTE: '100000' } })
    api = apiOf(await login(t, ADMIN))
    school1 = await schoolIdOf(t.db, 'DEMO001')
    school2 = await schoolIdOf(t.db, 'DEMO002')
  })
  afterAll(async () => {
    await t.close()
  })

  describe('create', () => {
    it('creates a teacher: 201, status text, generated password once, must change password', async () => {
      const res = await api.post('/admin/users', teacherBody(school1, { email: 'baharu@ujian.test', phone: '0123456789' }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(res.body.status).toBe(USER_MESSAGES.created)
      const data = CreatedUserSchema.parse(res.body.data)
      expect(data.roles).toEqual(['teacher'])
      expect(data.isActive).toBe(true)
      expect(data.mustChangePassword).toBe(true)
      expect(data.generatedPassword.length).toBeGreaterThanOrEqual(12)
      expect(data.school?.id).toBe(school1)
      // The detail never returns the password again.
      const again = await api.get(`/admin/users/${data.id}`)
      expect(JSON.stringify(again.body)).not.toContain(data.generatedPassword)
      // The new account can sign in with the generated password.
      const s = await login(t, 'baharu@ujian.test', { password: data.generatedPassword })
      expect(s.session.user.email).toBe('baharu@ujian.test')
    })

    it('creates an inactive user when isActive is off; that user is refused at login', async () => {
      const res = await api.post('/admin/users', teacherBody(school1, { email: 'tidak.aktif@ujian.test', isActive: false }))
      const data = CreatedUserSchema.parse(res.body.data)
      expect(data.isActive).toBe(false)
      const refused = await t.http().post('/api/auth/login').send({ identifier: 'tidak.aktif@ujian.test', password: data.generatedPassword })
      expect(refused.status).toBeGreaterThanOrEqual(400)
    })

    it('creates a student with a grade and an IC; only the masked value comes back', async () => {
      const res = await api.post('/admin/users', {
        roles: ['student'],
        name: 'Murid Ujian',
        email: 'murid.ujian@ujian.test',
        schoolId: school1,
        grade: 5,
        icNumber: '990101-01-5555',
      })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const data = CreatedUserSchema.parse(res.body.data)
      expect(data.icMasked).toBe('xxxxxx-xx-xx55')
      expect(data.grade).toBe(5)
      expect(JSON.stringify(res.body)).not.toContain('990101')
    })

    it('ignores the IC and the grade of a role that does not use them', async () => {
      const res = await api.post('/admin/users', teacherBody(school1, { grade: 5, icNumber: '990101015555' }))
      const data = CreatedUserSchema.parse(res.body.data)
      expect(data.grade).toBeNull()
      expect(data.icMasked).toBeNull()
    })

    it('creates a school_admin; the JPN and PPD come from the school', async () => {
      const res = await api.post('/admin/users', { roles: ['school_admin'], name: 'Admin Ujian', email: 'admin.ujian@ujian.test', schoolId: school2 })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const data = CreatedUserSchema.parse(res.body.data)
      expect(data.ppdState).toBe('Selangor')
      expect(data.ppdDistrict).toBe('Gombak')
    })

    it('creates a ppd_officer with a district scope (and the officer can hold a session)', async () => {
      const res = await api.post('/admin/users', {
        roles: ['ppd_officer'],
        name: 'Pegawai Ujian',
        email: 'pegawai.ujian@ujian.test',
        ppdState: 'Johor',
        ppdDistrict: 'PPD JOHOR BAHRU',
      })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const data = CreatedUserSchema.parse(res.body.data)
      expect(data.ppdState).toBe('Johor')
      expect(data.ppdDistrict).toBe('PPD JOHOR BAHRU')
      const s = await login(t, 'pegawai.ujian@ujian.test', { password: data.generatedPassword })
      expect(s.session.active.scope.level).toBe('district')
    })

    it('creates an admin with a national scope', async () => {
      const res = await api.post('/admin/users', { roles: ['admin'], name: 'Admin Dua', email: 'admin.dua@ujian.test' })
      const data = CreatedUserSchema.parse(res.body.data)
      const s = await login(t, 'admin.dua@ujian.test', { password: data.generatedPassword })
      expect(s.session.active.scope.level).toBe('national')
    })

    it('a parent with linked students: every id must be a student', async () => {
      const students = await t.db.query<{ id: string }>(`select u.id::text from users u join user_roles r on r.user_id = u.id where r.role = 'student' limit 1`)
      const teacher = await t.db.query<{ id: string }>(`select u.id::text from users u join user_roles r on r.user_id = u.id where r.role = 'teacher' limit 1`)
      const ok = await api.post('/admin/users', { roles: ['parent'], name: 'Ibu Ujian', email: 'ibu@ujian.test', linkedStudentIds: [students[0]?.id] })
      expect(ok.status, JSON.stringify(ok.body)).toBe(201)
      const bad = await api.post('/admin/users', { roles: ['parent'], name: 'Ibu Dua', email: 'ibu2@ujian.test', linkedStudentIds: [teacher[0]?.id] })
      expect(fieldsOf(bad)).toEqual({ linkedStudentIds: 'The selected linked student ids is invalid.' })
      const missing = await api.post('/admin/users', { roles: ['parent'], name: 'Ibu Tiga', email: 'ibu3@ujian.test', linkedStudentIds: ['9999999'] })
      expect(fieldsOf(missing).linkedStudentIds).toBe('The selected linked student ids is invalid.')
    })

    it('a refused create writes nothing', async () => {
      const before = await t.db.query<{ n: number }>(`select count(*)::int n from users`)
      await api.post('/admin/users', { roles: ['parent'], name: 'Tak Jadi', email: 'takjadi@ujian.test', linkedStudentIds: ['9999999'] })
      const after = await t.db.query<{ n: number }>(`select count(*)::int n from users`)
      expect(after[0]?.n).toBe(before[0]?.n)
    })
  })

  describe('validation (422, the copy of the mock)', () => {
    const post = (over: Record<string, unknown>) => api.post('/admin/users', over)

    it('an empty body reports the roles and the e-mail', async () => {
      const f = fieldsOf(await post({}))
      expect(f.roles ?? f.role).toBeTruthy()
      expect(f.name).toBe('The name field is required.')
      expect(Object.keys(f)).toEqual(expect.arrayContaining(['name']))
    })

    it('rejects a bad e-mail and a taken e-mail (any case)', async () => {
      expect(fieldsOf(await post(teacherBody(school1, { email: 'bukan-emel' }))).email).toBe('The email field must be a valid email address.')
      expect(fieldsOf(await post(teacherBody(school1, { email: 'Pelajar@Demo.TEST' }))).email).toBe('The email has already been taken.')
    })

    it('rejects a long name and a long phone', async () => {
      expect(fieldsOf(await post(teacherBody(school1, { name: 'x'.repeat(256) }))).name).toBe('The name field must not be greater than 255 characters.')
      expect(fieldsOf(await post(teacherBody(school1, { phone: '0'.repeat(15) }))).phone).toBe('The phone field must not be greater than 14 characters.')
    })

    it('requires a grade for a student, and a school for a school admin', async () => {
      expect(fieldsOf(await post({ roles: ['student'], name: 'A', email: 'a1@ujian.test' })).grade).toBe('The grade field is required when role is student.')
      expect(fieldsOf(await post({ roles: ['school_admin'], name: 'A', email: 'a2@ujian.test' })).schoolId).toBe(
        'The school id field is required when role is school_admin.',
      )
    })

    it('limits the IC to 14 characters, requires a real IC shape and checks that the school exists', async () => {
      const long = fieldsOf(await post({ roles: ['student'], name: 'A', email: 'a3@ujian.test', grade: 5, icNumber: '1'.repeat(15) }))
      expect(long.icNumber).toBe('The ic number field must not be greater than 14 characters.')
      const shape = await post({ roles: ['student'], name: 'A', email: 'a4@ujian.test', grade: 5, icNumber: 'abc123' })
      expect(fieldsOf(shape).icNumber).toBe('The ic number field format is invalid.')
      expect(JSON.stringify(shape.body)).not.toContain('abc123')
      expect(fieldsOf(await post(teacherBody('7777777'))).schoolId).toBe('The selected school id is invalid.')
    })

    it('requires the JPN and the PPD for a ppd_officer, and checks both', async () => {
      const none = fieldsOf(await post({ roles: ['ppd_officer'], name: 'A', email: 'p1@ujian.test' }))
      expect(none.ppdState).toBe('The ppd state field is required.')
      expect(none.ppdDistrict).toBe('The ppd district field is required when role is ppd_officer.')
      const state = await post({ roles: ['ppd_officer'], name: 'A', email: 'p2@ujian.test', ppdState: 'Atlantis', ppdDistrict: 'PPD GOMBAK' })
      expect(fieldsOf(state).ppdState).toBe('The selected ppd state is invalid.')
      const district = await post({ roles: ['ppd_officer'], name: 'A', email: 'p3@ujian.test', ppdState: 'Johor', ppdDistrict: 'PPD GOMBAK' })
      expect(fieldsOf(district).ppdDistrict).toBe('The selected ppd district is invalid.')
    })

    it('rejects an invalid role combination and an unknown role (422)', async () => {
      expect(Object.keys(fieldsOf(await post(teacherBody(school1, { roles: ['student', 'teacher'] }))))).toContain('roles')
      expect(Object.keys(fieldsOf(await post(teacherBody(school1, { roles: ['admin', 'teacher'] }))))).toContain('roles')
      expect(Object.keys(fieldsOf(await post(teacherBody(school1, { roles: ['hacker'] }))))).toContain('roles.0')
      expect(Object.keys(fieldsOf(await post(teacherBody(school1, { roles: [] }))))).toContain('roles')
    })

    it('rejects unknown keys (strict body): icHash, joinCode, password, role', async () => {
      for (const key of ['icHash', 'joinCode', 'password', 'role', 'mustChangePassword']) {
        const res = await post(teacherBody(school1, { [key]: 'x' }))
        expect(res.status, key).toBe(422)
      }
    })

    it('the username is unique within a school but may repeat in another', async () => {
      const first = await post(teacherBody(school1, { username: 'cikgu.satu' }))
      expect(first.status, JSON.stringify(first.body)).toBe(201)
      const same = await post(teacherBody(school1, { username: 'CIKGU.SATU' }))
      expect(fieldsOf(same).username).toBe('The username has already been taken.')
      const other = await post(teacherBody(school2, { username: 'cikgu.satu' }))
      expect(other.status, JSON.stringify(other.body)).toBe(201)
    })
  })

  describe('list, filters and detail', () => {
    it('lists newest first with the contract shape and exact meta (AC 8)', async () => {
      const res = await api.get('/admin/users')
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const meta = UserListMetaSchema.parse(res.body.meta)
      const [{ n }] = (await t.db.query<{ n: number }>(`select count(*)::int n from users`)) as [{ n: number }]
      expect(meta.totalItems).toBe(n)
      expect(meta.pageSize).toBe(25)
      expect(meta.page).toBe(1)
      expect(meta.totalPages).toBe(Math.max(1, Math.ceil(n / 25)))
      expect(meta.from).toBe(1)
      expect(meta.to).toBe(Math.min(25, n))
      expect(res.body.data).toHaveLength(Math.min(25, n))
      // Newest first: created_at is not ascending.
      const times = res.body.data.map((u: { createdAt: string }) => u.createdAt)
      expect([...times].sort().reverse()).toEqual(times)
      for (const row of res.body.data) {
        expect(row).not.toHaveProperty('passwordHash')
        expect(row).not.toHaveProperty('icHash')
      }
    })

    it('roleCounts equal the rows of user_roles, ignoring the filters (AC 8)', async () => {
      const rows = await t.db.query<{ role: string; n: number }>(`select role, count(*)::int n from user_roles group by role`)
      const want = Object.fromEntries(rows.map((r) => [r.role, r.n]))
      const res = await api.get('/admin/users?role=teacher&search=zzzzzz')
      const counts = UserListMetaSchema.parse(res.body.meta).roleCounts
      expect(counts).toEqual({
        student: want.student ?? 0,
        teacher: want.teacher ?? 0,
        parent: want.parent ?? 0,
        sponsor: want.sponsor ?? 0,
        schoolAdmin: want.school_admin ?? 0,
        ppdOfficer: want.ppd_officer ?? 0,
        admin: want.admin ?? 0,
      })
      expect(res.body.data).toEqual([])
      expect(res.body.meta.totalItems).toBe(0)
      expect(res.body.meta.from).toBeNull()
    })

    it('pages: page 2 starts at 26, an out-of-range page is empty, a bad page is page 1', async () => {
      // Add enough users for a second page.
      for (let i = 0; i < 20; i++) await api.post('/admin/users', teacherBody(school1, { email: `halaman${i}@ujian.test` }))
      const [{ n }] = (await t.db.query<{ n: number }>(`select count(*)::int n from users`)) as [{ n: number }]
      expect(n).toBeGreaterThan(25)
      const p2 = await api.get('/admin/users?page=2')
      expect(p2.body.meta.from).toBe(26)
      expect(p2.body.meta.to).toBe(Math.min(50, n))
      const far = await api.get('/admin/users?page=9999')
      expect(far.body.data).toEqual([])
      expect(far.body.meta.from).toBeNull()
      const bad = await api.get('/admin/users?page=abc')
      expect(bad.body.meta.page).toBe(1)
      const zero = await api.get('/admin/users?page=0')
      expect(zero.body.meta.page).toBe(1)
    })

    it('filters by role, school and status with AND; search is case-insensitive and trimmed', async () => {
      const teachers = await api.get(`/admin/users?role=teacher&schoolId=${school2}`)
      expect(teachers.body.data.length).toBeGreaterThan(0)
      for (const u of teachers.body.data) {
        expect(u.roles).toContain('teacher')
        expect(u.school.id).toBe(school2)
      }
      const inactive = await api.get('/admin/users?isActive=0')
      for (const u of inactive.body.data) expect(u.isActive).toBe(false)
      const found = await api.get('/admin/users?search=%20MURID%20UJIAN%20')
      expect(found.body.data.map((u: { name: string }) => u.name)).toContain('Murid Ujian')
      const byMail = await api.get('/admin/users?search=PELAJARMAJU')
      expect(byMail.body.data).toHaveLength(1)
    })

    it('a role outside the codes, or a non-numeric school, matches nothing', async () => {
      for (const q of ['role=unmapped', 'role=hacker', 'schoolId=abc']) {
        const res = await api.get(`/admin/users?${q}`)
        expect(res.status).toBe(200)
        expect(res.body.data).toEqual([])
        expect(res.body.meta.totalItems).toBe(0)
      }
    })

    it('filters lists the schools with at least one user, by name', async () => {
      const res = await api.get('/admin/users/filters')
      expect(res.status).toBe(200)
      const data = UserFiltersSchema.parse(res.body.data)
      const rows = await t.db.query<{ id: string }>(`select distinct school_id::text id from users where school_id is not null`)
      expect(data.schools.map((s) => s.id).sort()).toEqual(rows.map((r) => r.id).sort())
      const names = data.schools.map((s) => s.name.toLowerCase())
      expect([...names].sort()).toEqual(names)
    })

    it('detail: contract shape, landing path, masked IC, never a password', async () => {
      const id = (await t.db.query<{ id: string }>(`select id::text from users where email = 'murid.ujian@ujian.test'`))[0]?.id as string
      const res = await api.get(`/admin/users/${id}`)
      const d = detailOf(res)
      expect(d.landingPath).toBe('/dashboard')
      expect(d.icMasked).toBe('xxxxxx-xx-xx55')
      expect(d.school?.name).toBe('SMK Demo Satu')
      expect(d.createdAt).toMatch(/\+08:00$/)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|generatedPassword|icHash|990101/)
    })

    it('detail of an admin has /admin as landing path; unknown and malformed ids are 404', async () => {
      const id = (await t.db.query<{ id: string }>(`select id::text from users where email = 'admin@demo.test'`))[0]?.id as string
      expect(detailOf(await api.get(`/admin/users/${id}`)).landingPath).toBe('/admin')
      expectError(await api.get('/admin/users/987654321'), 'NOT_FOUND', 'Not Found.')
      expectError(await api.get('/admin/users/abc'), 'NOT_FOUND', 'Not Found.')
    })
  })

  describe('update', () => {
    let id: string
    beforeAll(async () => {
      const res = await api.post('/admin/users', {
        roles: ['student'],
        name: 'Murid Kemaskini',
        email: 'kemaskini@ujian.test',
        schoolId: school1,
        grade: 4,
        icNumber: '010203040506',
      })
      id = CreatedUserSchema.parse(res.body.data).id
    })

    it('updates the common fields and stamps updated_at', async () => {
      t.clock.advance(60_000)
      const res = await api.put(`/admin/users/${id}`, { roles: ['student'], name: 'Murid Baharu', phone: '0111111111' })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.status).toBe(USER_MESSAGES.updated)
      const d = UpdatedUserSchema.parse(res.body.data)
      expect(d.name).toBe('Murid Baharu')
      expect(d.phone).toBe('0111111111')
      expect(d.email).toBe('kemaskini@ujian.test') // absent key keeps the value
      expect(d.grade).toBe(4)
      expect(d.icMasked).toBe('xxxxxx-xx-xx06')
      expect(d.updatedAt > d.createdAt).toBe(true)
      expect(d).not.toHaveProperty('generatedPassword')
    })

    it('null clears phone, IC and school; the grade stays', async () => {
      const res = await api.put(`/admin/users/${id}`, { roles: ['student'], name: 'Murid Baharu', phone: null, icNumber: null, schoolId: null })
      const d = UpdatedUserSchema.parse(res.body.data)
      expect(d.phone).toBeNull()
      expect(d.icMasked).toBeNull()
      expect(d.schoolId).toBeNull()
      expect(d.grade).toBe(4)
      await api.put(`/admin/users/${id}`, { roles: ['student'], name: 'Murid Baharu', schoolId: school1 })
    })

    it('validates like create, with the user itself excluded from "taken"', async () => {
      expect(fieldsOf(await api.put(`/admin/users/${id}`, { roles: ['student'], name: 'A', email: 'Pelajar@demo.test' })).email).toBe('The email has already been taken.')
      const same = await api.put(`/admin/users/${id}`, { roles: ['student'], name: 'A', email: 'KEMASKINI@ujian.test' })
      expect(same.status, JSON.stringify(same.body)).toBe(200)
    })

    it('answers 404 for an unknown user', async () => {
      expectError(await api.put('/admin/users/987654321', { roles: ['student'], name: 'A' }), 'NOT_FOUND', 'Not Found.')
    })

    it('requires a school for a user made school_admin without one, and the school must exist', async () => {
      const res = await api.post('/admin/users', { roles: ['teacher'], name: 'Tanpa Sekolah', email: 'tanpa@ujian.test' })
      const uid = CreatedUserSchema.parse(res.body.data).id
      expect(fieldsOf(await api.put(`/admin/users/${uid}`, { roles: ['school_admin'], name: 'X' })).schoolId).toBe(
        'The school id field is required when role is school_admin.',
      )
      expect(fieldsOf(await api.put(`/admin/users/${uid}`, { roles: ['teacher'], name: 'X', schoolId: '7777777' })).schoolId).toBe(
        'The selected school id is invalid.',
      )
    })

    it('a student made to have no grade is refused', async () => {
      const res = await api.post('/admin/users', { roles: ['teacher'], name: 'Jadi Murid', email: 'jadimurid@ujian.test', schoolId: school1 })
      const uid = CreatedUserSchema.parse(res.body.data).id
      expect(fieldsOf(await api.put(`/admin/users/${uid}`, { roles: ['student'], name: 'X' })).grade).toBe('The grade field is required when role is student.')
      expect(fieldsOf(await api.put(`/admin/users/${uid}`, { roles: ['student'], name: 'X', grade: 12 })).grade).toBeTruthy()
    })

    it('rejects unknown keys, including the old newPassword', async () => {
      const res = await api.put(`/admin/users/${id}`, { roles: ['student'], name: 'A', newPassword: 'rahsia123', newPasswordConfirmation: 'rahsia123' })
      expect(res.status).toBe(422)
    })

    it('a refused update changes nothing', async () => {
      const before = (await t.db.query<{ name: string }>(`select name from users where id = $1`, [id]))[0]?.name
      await api.put(`/admin/users/${id}`, { roles: ['student'], name: 'Patut Tidak Berubah', email: 'bukan-emel' })
      const after = (await t.db.query<{ name: string }>(`select name from users where id = $1`, [id]))[0]?.name
      expect(after).toBe(before)
    })

    it('parent links are only checked (BE-25 stores them): linkedStudents stays empty', async () => {
      const p = await api.post('/admin/users', { roles: ['parent'], name: 'Ibu Pautan', email: 'pautan@ujian.test' })
      const pid = CreatedUserSchema.parse(p.body.data).id
      const res = await api.put(`/admin/users/${pid}`, { roles: ['parent'], name: 'Ibu Pautan', linkedStudentIds: [id] })
      expect(UpdatedUserSchema.parse(res.body.data).linkedStudents).toEqual([])
      const bad = await api.put(`/admin/users/${pid}`, { roles: ['parent'], name: 'Ibu Pautan', linkedStudentIds: ['9999999'] })
      expect(fieldsOf(bad).linkedStudentIds).toBe('The selected linked student ids is invalid.')
    })
  })

  describe('toggle and delete', () => {
    async function make(email: string, roles: string[] = ['teacher']) {
      const res = await api.post('/admin/users', teacherBody(school1, { email, roles }))
      return CreatedUserSchema.parse(res.body.data)
    }

    it('toggle flips the status and answers the new state; 404 for an unknown user', async () => {
      const u = await make('togol@ujian.test')
      const off = await api.post(`/admin/users/${u.id}/toggle-active`)
      expect(off.status).toBe(200)
      expect(off.body.status).toBe(USER_MESSAGES.toggled)
      expect(UserToggleResultSchema.parse(off.body.data)).toEqual({ isActive: false })
      expect(UserToggleResultSchema.parse((await api.post(`/admin/users/${u.id}/toggle-active`)).body.data)).toEqual({ isActive: true })
      expectError(await api.post('/admin/users/987654321/toggle-active'), 'NOT_FOUND', 'Not Found.')
    })

    it('the inactive filter total moves by one (computed, not stored)', async () => {
      const u = await make('togol2@ujian.test')
      const before = (await api.get('/admin/users?isActive=0')).body.meta.totalItems as number
      await api.post(`/admin/users/${u.id}/toggle-active`)
      expect((await api.get('/admin/users?isActive=0')).body.meta.totalItems).toBe(before + 1)
    })

    it('delete removes the user for good: 200 with a body, roles and scopes gone', async () => {
      const u = await make('padam@ujian.test')
      const res = await api.del(`/admin/users/${u.id}`)
      expect(res.status).toBe(200)
      expect(res.body.status).toBe(USER_MESSAGES.deleted)
      expect(DeletedResultSchema.parse(res.body.data)).toEqual({ deleted: 1 })
      expect((await t.db.query(`select 1 from users where id = $1`, [u.id])).length).toBe(0)
      expect((await t.db.query(`select 1 from user_roles where user_id = $1`, [u.id])).length).toBe(0)
      expectError(await api.del(`/admin/users/${u.id}`), 'NOT_FOUND', 'Not Found.')
    })

    it('refuses to delete the own account (422 fields.id)', async () => {
      const me = (await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [ADMIN]))[0]?.id as string
      const res = await api.del(`/admin/users/${me}`)
      expect(fieldsOf(res).id).toBe('Anda tidak boleh memadam akaun sendiri.')
      expect((await t.db.query(`select 1 from users where id = $1`, [me])).length).toBe(1)
    })

    it('bulk delete removes the selection, skips unknown ids, counts what was deleted', async () => {
      const a = await make('pukal1@ujian.test')
      const b = await make('pukal2@ujian.test')
      const res = await api.post('/admin/users/bulk-delete', { ids: [a.id, b.id, a.id, '987654321'] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(DeletedResultSchema.parse(res.body.data)).toEqual({ deleted: 2 })
      expect(res.body.status).toBe('2 pengguna berjaya dipadam.')
    })

    it('bulk delete: 422 without ids, a non-id, too many ids, or the own id', async () => {
      const empty = await api.post('/admin/users/bulk-delete', { ids: [] })
      expect(fieldsOf(empty).ids).toBe('The ids field is required.')
      expect(fieldsOf(await api.post('/admin/users/bulk-delete', {})).ids).toBeTruthy()
      expect(fieldsOf(await api.post('/admin/users/bulk-delete', { ids: ['x', '3'] })).ids).toBe('The ids field must be an array of integers.')
      expect(fieldsOf(await api.post('/admin/users/bulk-delete', { ids: Array.from({ length: 501 }, (_, i) => String(i + 1)) })).ids).toBe(
        'The ids field must not have more than 500 items.',
      )
      const d = await make('pukal3@ujian.test')
      const me = (await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [ADMIN]))[0]?.id as string
      expect(fieldsOf(await api.post('/admin/users/bulk-delete', { ids: [d.id, me] })).ids).toBe('Anda tidak boleh memadam akaun sendiri.')
      expect((await t.db.query(`select 1 from users where id = $1`, [d.id])).length).toBe(1)
    })

    it('AC 7: a RESTRICT reference from another table blocks the delete (409, nothing deleted)', async () => {
      const u = await make('sekat@ujian.test')
      await t.db.query(`create table zz_dependent (user_id bigint not null references users(id))`)
      await t.db.query(`insert into zz_dependent (user_id) values ($1)`, [u.id])
      const res = await api.del(`/admin/users/${u.id}`)
      expectError(res, 'CONFLICT')
      expect((await t.db.query(`select 1 from users where id = $1`, [u.id])).length).toBe(1)
      expect((await t.db.query(`select 1 from user_roles where user_id = $1`, [u.id])).length).toBe(1)
      await t.db.query(`delete from zz_dependent`)
      expect((await api.del(`/admin/users/${u.id}`)).status).toBe(200)
      await t.db.query(`drop table zz_dependent`)
    })

    it('AC 7: roles, scopes and sessions cascade; audit actors become null; created_by of others becomes null', async () => {
      const creator = await make('pencipta@ujian.test', ['school_admin'])
      const csess = await login(t, 'pencipta@ujian.test', { password: creator.generatedPassword })
      const made = await apiOf(csess).post('/admin/users', teacherBody(school1, { email: 'dicipta@ujian.test' }))
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      const createdId = CreatedUserSchema.parse(made.body.data).id
      expect((await t.db.query(`select created_by_id::text c from users where id = $1`, [createdId]))[0]).toEqual({ c: creator.id })
      expect((await api.del(`/admin/users/${creator.id}`)).status).toBe(200)
      expect((await t.db.query(`select created_by_id c from users where id = $1`, [createdId]))[0]).toEqual({ c: null })
      expect((await t.db.query(`select 1 from sessions where user_id = $1`, [creator.id])).length).toBe(0)
      const audits = await t.db.query(`select 1 from audit_events where action = 'users.created' and actor_user_id is null`)
      expect(audits.length).toBeGreaterThan(0)
      // The old session cookie no longer resolves.
      expect((await csess.agent.get('/api/session')).status).toBe(401)
    })
  })

  it('the detail response parses with the contract (a smoke over every created user)', async () => {
    const res = await api.get('/admin/users?page=1')
    for (const row of res.body.data) {
      detailOf(await api.get(`/admin/users/${row.id}`))
    }
  })
})
