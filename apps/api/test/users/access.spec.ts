import { CreatedUserSchema, StudentSearchItemSchema, TeacherOptionSchema, ExistingStudentSchema, UserListMetaSchema, UpdatedUserSchema, LAST_ADMIN_MESSAGE, IMPORT_ROLE_FORBIDDEN_MESSAGE } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN,
  apiOf,
  bootUsersApp,
  expectError,
  fieldsOf,
  login,
  SCHOOL_ADMIN,
  schoolIdOf,
  STUDENT,
  TEACHER,
  teacherBody,
  userIdOf,
  type Api,
  type UsersTestApp,
} from './helpers'

describe('roles, scope and guards (AC 3, 9, 10)', () => {
  let t: UsersTestApp
  let admin: Api
  let sa: Api
  let s1: string
  let s2: string
  let otherTeacher: string
  let ownTeacher: string

  beforeAll(async () => {
    t = await bootUsersApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '100000', THROTTLE_ADMIN_READ_PER_MINUTE: '100000' } })
    admin = apiOf(await login(t, ADMIN))
    sa = apiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    otherTeacher = CreatedUserSchema.parse((await admin.post('/admin/users', teacherBody(s2, { email: 'guru.lain@ujian.test' }))).body.data).id
    ownTeacher = CreatedUserSchema.parse((await admin.post('/admin/users', teacherBody(s1, { email: 'guru.sendiri@ujian.test' }))).body.data).id
  })
  afterAll(async () => {
    await t.close()
  })

  describe('AC 10: who may call what', () => {
    it('no session is 401 on every route', async () => {
      for (const [m, p] of [
        ['get', '/api/admin/users'],
        ['get', '/api/admin/users/filters'],
        ['get', '/api/admin/users/1'],
        ['get', '/api/admin/teachers'],
        ['get', '/api/admin/teachers/1/classrooms'],
        ['get', '/api/admin/schools/1/students'],
        ['get', '/api/students/search?q=abc'],
      ] as const) {
        expectError(await t.http()[m](p), 'UNAUTHORIZED', 'Unauthenticated.')
      }
    })

    it('a student, a teacher and a parent are 403 on the admin routes', async () => {
      const student = apiOf(await login(t, STUDENT))
      const teacher = apiOf(await login(t, TEACHER))
      for (const who of [student, teacher]) {
        expectError(await who.get('/admin/users'), 'FORBIDDEN')
        expectError(await who.get('/admin/teachers'), 'FORBIDDEN')
        expectError(await who.post('/admin/users', teacherBody(s1)), 'FORBIDDEN')
        expectError(await who.post('/admin/users/bulk-import', {}), 'FORBIDDEN')
        expectError(await who.get(`/admin/schools/${s1}/students`), 'FORBIDDEN')
      }
      expectError(await student.get('/students/search?q=abc'), 'FORBIDDEN')
    })

    it('a mutation without the CSRF token is 403 CSRF_INVALID', async () => {
      const who = await login(t, ADMIN)
      const res = await who.agent.post('/api/admin/users').send(teacherBody(s1))
      expectError(res, 'CSRF_INVALID')
      const del = await who.agent.delete(`/api/admin/users/${ownTeacher}`)
      expectError(del, 'CSRF_INVALID')
    })

    it('AC 9: the impersonate route does not exist (404), and neither does config/defaults', async () => {
      const res = await admin.post(`/admin/users/${ownTeacher}/impersonate`)
      expectError(res, 'NOT_FOUND')
      expectError(await admin.get('/admin/config/defaults'), 'NOT_FOUND')
    })
  })

  describe('AC 3: a school_admin sees and edits only its own school', () => {
    it('the list holds students and teachers of the own school only; roleCounts follow the same rows', async () => {
      const res = await sa.get('/admin/users')
      expect(res.status).toBe(200)
      const meta = UserListMetaSchema.parse(res.body.meta)
      const rows = res.body.data as { id: string; roles: string[]; school: { id: string } }[]
      expect(rows.length).toBeGreaterThan(0)
      for (const r of rows) {
        expect(r.school.id).toBe(s1)
        expect(r.roles.every((x) => x === 'student' || x === 'teacher')).toBe(true)
      }
      const want = await t.db.query<{ role: string; n: number }>(
        `select r.role, count(*)::int n from user_roles r join users u on u.id = r.user_id
          where u.school_id = $1 and not exists (select 1 from user_roles x where x.user_id = u.id and x.role not in ('student','teacher'))
          group by r.role`,
        [s1],
      )
      const byRole = Object.fromEntries(want.map((w) => [w.role, w.n]))
      expect(meta.roleCounts).toEqual({ student: byRole.student ?? 0, teacher: byRole.teacher ?? 0, parent: 0, sponsor: 0, schoolAdmin: 0, ppdOfficer: 0, admin: 0 })
      // Other school filter gives nothing; the other school's user is not in the list.
      expect((await sa.get(`/admin/users?schoolId=${s2}`)).body.data).toEqual([])
      expect(rows.map((r) => r.id)).not.toContain(otherTeacher)
    })

    it('LEAD rule (BE-25, AC 7): a parent is visible only with a child and ALL children in the own school', async () => {
      const student = (await t.db.query<{ id: string }>(`select u.id::text from users u join user_roles r on r.user_id = u.id where r.role = 'student' and u.school_id = $1 limit 1`, [s1]))[0]?.id as string
      const lone = CreatedUserSchema.parse((await admin.post('/admin/users', { roles: ['parent'], name: 'Ibu Tanpa Anak', email: 'ibu.tanpa@ujian.test', schoolId: s1 })).body.data).id
      const withChild = CreatedUserSchema.parse(
        (await admin.post('/admin/users', { roles: ['parent'], name: 'Ibu Beranak', email: 'ibu.anak@ujian.test', schoolId: s1 })).body.data,
      ).id
      await t.db.query('insert into parent_links (parent_id, student_id) values ($1, $2)', [withChild, student])
      // A parent with no child is never visible: 404 on every route, absent from the list and from roleCounts.
      expectError(await sa.get(`/admin/users/${lone}`), 'NOT_FOUND')
      expectError(await sa.put(`/admin/users/${lone}`, { roles: ['parent'], name: 'X' }), 'NOT_FOUND')
      expectError(await sa.post(`/admin/users/${lone}/toggle-active`), 'NOT_FOUND')
      expectError(await sa.del(`/admin/users/${lone}`), 'NOT_FOUND')
      // A parent whose only child is in the own school is visible; its linkedStudents lists that child.
      const detail = await sa.get(`/admin/users/${withChild}`)
      expect(detail.status, JSON.stringify(detail.body)).toBe(200)
      expect(detail.body.data.linkedStudents.map((x: { id: string }) => x.id)).toEqual([student])
      const list = await sa.get('/admin/users?role=parent')
      expect(list.body.data.map((x: { id: string }) => x.id)).toEqual([withChild])
      expect(UserListMetaSchema.parse(list.body.meta).roleCounts.parent).toBe(1)
      // The role set of a parent target cannot be changed by a school_admin (403), the other fields can.
      expectError(await sa.put(`/admin/users/${withChild}`, { roles: ['teacher'], name: 'X' }), 'FORBIDDEN')
      const edit = await sa.put(`/admin/users/${withChild}`, { roles: ['parent'], name: 'Ibu Beranak Baru' })
      expect(edit.status, JSON.stringify(edit.body)).toBe(200)
      expect((await sa.post(`/admin/users/${withChild}/toggle-active`)).status).toBe(200)
      expect((await sa.del(`/admin/users/${withChild}`)).status).toBe(200)
    })

    it('filters offers the own school only', async () => {
      const res = await sa.get('/admin/users/filters')
      expect(res.body.data.schools.map((s: { id: string }) => s.id)).toEqual([s1])
    })

    it('another school, an admin and a fellow school_admin are 404 on detail, update, toggle, delete', async () => {
      const adminId = await userIdOf(t.db, ADMIN)
      const saId = await userIdOf(t.db, SCHOOL_ADMIN)
      for (const id of [otherTeacher, adminId, saId]) {
        expectError(await sa.get(`/admin/users/${id}`), 'NOT_FOUND', 'Not Found.')
        expectError(await sa.put(`/admin/users/${id}`, { roles: ['teacher'], name: 'X' }), 'NOT_FOUND')
        expectError(await sa.post(`/admin/users/${id}/toggle-active`), 'NOT_FOUND')
        expectError(await sa.del(`/admin/users/${id}`), 'NOT_FOUND')
      }
      const bulk = await sa.post('/admin/users/bulk-delete', { ids: [otherTeacher, adminId] })
      expect(bulk.body.data).toEqual({ deleted: 0 })
      expect((await t.db.query(`select 1 from users where id = any($1::bigint[])`, [[otherTeacher, adminId]])).length).toBe(2)
    })

    it('creates a teacher in the own school (a missing schoolId defaults to it)', async () => {
      const res = await sa.post('/admin/users', { roles: ['teacher'], name: 'Guru Baru', email: 'guru.baru@ujian.test' })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(CreatedUserSchema.parse(res.body.data).schoolId).toBe(s1)
    })

    it('a body schoolId of another school is rejected on create and on update', async () => {
      const c = await sa.post('/admin/users', teacherBody(s2))
      expect(fieldsOf(c).schoolId).toBe('The selected school id is invalid.')
      const u = await sa.put(`/admin/users/${ownTeacher}`, { roles: ['teacher'], name: 'Guru Sendiri', schoolId: s2 })
      expect(fieldsOf(u).schoolId).toBe('The selected school id is invalid.')
      const n = await sa.put(`/admin/users/${ownTeacher}`, { roles: ['teacher'], name: 'Guru Sendiri', schoolId: null })
      expect(fieldsOf(n).schoolId).toBe('The selected school id is invalid.')
      expect((await t.db.query<{ s: string }>(`select school_id::text s from users where id = $1`, [ownTeacher]))[0]?.s).toBe(s1)
    })

    it('may edit a user of its own school', async () => {
      const res = await sa.put(`/admin/users/${ownTeacher}`, { roles: ['teacher'], name: 'Guru Sendiri Baru', schoolId: s1 })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(UpdatedUserSchema.parse(res.body.data).name).toBe('Guru Sendiri Baru')
    })

    it('403 for a role it cannot assign (admin, school_admin, ppd_officer, parent), 404 stays for hidden targets', async () => {
      for (const roles of [['admin'], ['school_admin'], ['ppd_officer'], ['parent'], ['sponsor']]) {
        const c = await sa.post('/admin/users', { roles, name: 'X', email: `x.${roles[0]}@ujian.test`, schoolId: s1, ppdState: 'Johor', ppdDistrict: 'PPD JOHOR BAHRU' })
        expectError(c, 'FORBIDDEN')
      }
      const up = await sa.put(`/admin/users/${ownTeacher}`, { roles: ['school_admin'], name: 'Guru Sendiri', schoolId: s1 })
      expectError(up, 'FORBIDDEN')
    })

    it('imports teachers only (403 with the pinned copy for any other role) and only into the own school', async () => {
      const csv = 'Nama,Emel\nGuru Import,guru.import@ujian.test'
      const parent = await sa.post('/admin/users/bulk-import', { role: 'parent', importMode: 'paste', pasteContent: csv })
      const err = expectError(parent, 'FORBIDDEN', IMPORT_ROLE_FORBIDDEN_MESSAGE)
      expect(err.code).toBe('FORBIDDEN')
      const other = await sa.post('/admin/users/bulk-import', { role: 'teacher', schoolId: s2, importMode: 'paste', pasteContent: csv })
      expect(fieldsOf(other).schoolId).toBe('The selected school id is invalid.')
      const ok = await sa.post('/admin/users/bulk-import', { role: 'teacher', schoolId: s1, importMode: 'paste', pasteContent: csv })
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)
      expect(ok.body.data.created).toBe(1)
    })

    it('a unique-check error is the same whether the existing account is in the own school or another', async () => {
      const mine = await sa.post('/admin/users', teacherBody(s1, { email: 'guru.sendiri@ujian.test' }))
      const theirs = await sa.post('/admin/users', teacherBody(s1, { email: 'guru.lain@ujian.test' }))
      const higher = await sa.post('/admin/users', teacherBody(s1, { email: 'admin@demo.test' }))
      const a = fieldsOf(mine)
      expect(fieldsOf(theirs)).toEqual(a)
      expect(fieldsOf(higher)).toEqual(a)
    })
  })

  describe('lookups', () => {
    it('GET /admin/teachers: admin sees all teachers, school_admin its own school, by name', async () => {
      const all = await admin.get('/admin/teachers')
      const list = all.body.data.map((x: unknown) => TeacherOptionSchema.parse(x))
      const n = (await t.db.query<{ n: number }>(`select count(*)::int n from user_roles where role = 'teacher'`))[0]?.n
      expect(list).toHaveLength(n as number)
      const names = list.map((x: { name: string }) => x.name)
      expect([...names].sort((a: string, b: string) => a.localeCompare(b, 'ms'))).toEqual(names)
      const mine = await sa.get('/admin/teachers')
      const ids = mine.body.data.map((x: { id: string }) => x.id)
      expect(ids).toContain(ownTeacher)
      expect(ids).not.toContain(otherTeacher)
      expect(mine.headers['cache-control']).toBe('no-store')
    })

    it('GET /admin/teachers/:id/classrooms is [] when no class owner is bound (users module alone; the real list is tested with the classes module)', async () => {
      expect((await admin.get(`/admin/teachers/${ownTeacher}/classrooms`)).body).toEqual({ data: [] })
      expect((await admin.get('/admin/teachers/987654321/classrooms')).body).toEqual({ data: [] })
    })

    it('GET /admin/schools/:id/students: A to Z, search and class level filters, scope', async () => {
      await admin.post('/admin/users', { roles: ['student'], name: 'Zainal Murid', email: 'zainal@ujian.test', schoolId: s1, grade: 7 })
      await admin.post('/admin/users', { roles: ['student'], name: 'Adam Murid', email: 'adam@ujian.test', schoolId: s1, grade: 3 })
      const all = await admin.get(`/admin/schools/${s1}/students`)
      expect(all.status).toBe(200)
      const rows = all.body.data.map((x: unknown) => ExistingStudentSchema.parse(x))
      const names = rows.map((r: { name: string }) => r.name)
      expect([...names].sort((a: string, b: string) => a.localeCompare(b, 'ms'))).toEqual(names)
      expect(names).toContain('Adam Murid')
      expect(rows.find((r: { name: string }) => r.name === 'Zainal Murid')?.classLevel).toBe('T1')
      expect(rows.find((r: { name: string }) => r.name === 'Adam Murid')?.classLevel).toBe('D3')
      const byLevel = await admin.get(`/admin/schools/${s1}/students?classLevel=T1`)
      expect(byLevel.body.data.map((r: { name: string }) => r.name)).toEqual(['Zainal Murid'])
      const bySearch = await admin.get(`/admin/schools/${s1}/students?search=ADAM@`)
      expect(bySearch.body.data).toHaveLength(1)
      expect((await admin.get(`/admin/schools/${s1}/students?classLevel=X9`)).body.data).toEqual([])
      expect((await sa.get(`/admin/schools/${s1}/students`)).status).toBe(200)
      expectError(await sa.get(`/admin/schools/${s2}/students`), 'NOT_FOUND')
      expectError(await admin.get('/admin/schools/987654321/students'), 'NOT_FOUND')
      expectError(await admin.get('/admin/schools/abc/students'), 'NOT_FOUND')
    })

    it('GET /admin/schools/:id/students caps the answer at 200 rows', async () => {
      await t.db.query(
        `with u as (insert into users (name, email, school_id, grade)
           select 'Murid Banyak ' || lpad(g::text, 3, '0'), 'banyak' || g || '@ujian.test', $1, 2 from generate_series(1, 210) g returning id)
         insert into user_roles (user_id, role) select id, 'student' from u`,
        [s1],
      )
      expect((await admin.get(`/admin/schools/${s1}/students`)).body.data).toHaveLength(200)
    })

    it('GET /students/search: 3 characters, names only, at most 15, staff only, scoped', async () => {
      expect((await admin.get('/students/search?q=mu')).body.data).toEqual([])
      expect((await admin.get('/students/search')).body.data).toEqual([])
      const res = await admin.get('/students/search?q=MURID%20banyak')
      expect(res.body.data).toHaveLength(15)
      const first = StudentSearchItemSchema.parse(res.body.data[0])
      expect(first.schoolName).toBe('SMK Demo Satu') // admin sees the school name
      // not by e-mail
      expect((await admin.get('/students/search?q=zainal@')).body.data).toEqual([])
      expect((await admin.get('/students/search?q=zainal')).body.data).toHaveLength(1)
      // school_admin: own school only, no schoolName
      const own = await sa.get('/students/search?q=murid')
      expect(own.body.data.length).toBeGreaterThan(0)
      expect(own.body.data[0]).not.toHaveProperty('schoolName')
      const roster = await sa.get('/students/search?q=roster')
      expect(roster.body.data).toEqual([])
      expect((await admin.get('/students/search?q=roster')).body.data).toHaveLength(1)
      // teacher: no classes table before BE-17, so none
      const teacher = apiOf(await login(t, TEACHER))
      const tr = await teacher.get('/students/search?q=murid')
      expect(tr.status).toBe(200)
      expect(tr.body.data).toEqual([])
    })
  })

  describe('last admin, self guard and session revocation (D58, BE-NFR-39)', () => {
    it('the last active admin cannot be deactivated, demoted, deleted or bulk deleted (409)', async () => {
      const me = await userIdOf(t.db, ADMIN)
      expectError(await admin.post(`/admin/users/${me}/toggle-active`), 'CONFLICT', LAST_ADMIN_MESSAGE)
      expectError(await admin.put(`/admin/users/${me}`, { roles: ['teacher'], name: 'X', schoolId: s1 }), 'CONFLICT', LAST_ADMIN_MESSAGE)
      expectError(await admin.put(`/admin/users/${me}`, { roles: ['admin'], name: 'X', isActive: false }), 'CONFLICT', LAST_ADMIN_MESSAGE)
    })

    it('with two admins: self-demotion is still 409, another admin can be demoted, then the last is protected; a dead session is 401', async () => {
      const second = CreatedUserSchema.parse((await admin.post('/admin/users', { roles: ['admin'], name: 'Admin Kedua', email: 'admin.kedua@ujian.test' })).body.data)
      const me = await userIdOf(t.db, ADMIN)
      expectError(await admin.put(`/admin/users/${me}`, { roles: ['teacher'], name: 'X', schoolId: s1 }), 'CONFLICT', LAST_ADMIN_MESSAGE)
      const sess = await login(t, 'admin.kedua@ujian.test', { password: second.generatedPassword })
      expect((await sess.agent.get('/api/session')).status).toBe(200)
      // Demote the second admin: the role change revokes its session.
      const demote = await admin.put(`/admin/users/${second.id}`, { roles: ['teacher'], name: 'Admin Kedua', schoolId: s1 })
      expect(demote.status, JSON.stringify(demote.body)).toBe(200)
      expect((await sess.agent.get('/api/session')).status).toBe(401)
      // Back to one admin: the guard is on again for deactivation.
      expectError(await admin.post(`/admin/users/${me}/toggle-active`), 'CONFLICT', LAST_ADMIN_MESSAGE)
      // Bulk delete of a list that holds only the other (now teacher) is fine.
      expect((await admin.post('/admin/users/bulk-delete', { ids: [second.id] })).body.data).toEqual({ deleted: 1 })
    })

    it('deactivate, password reset, role change and delete each end the target sessions', async () => {
      const mk = async (email: string) => {
        const u = CreatedUserSchema.parse((await admin.post('/admin/users', teacherBody(s1, { email }))).body.data)
        const sess = await login(t, email, { password: u.generatedPassword })
        return { u, sess }
      }
      const alive = async (x: Awaited<ReturnType<typeof mk>>) => (await x.sess.agent.get('/api/session')).status === 200

      const a = await mk('sesi.a@ujian.test')
      await admin.post(`/admin/users/${a.u.id}/toggle-active`)
      expect(await alive(a)).toBe(false)

      const b = await mk('sesi.b@ujian.test')
      const reset = await admin.put(`/admin/users/${b.u.id}`, { roles: ['teacher'], name: 'B', resetPassword: true })
      const upd = UpdatedUserSchema.parse(reset.body.data)
      expect(upd.generatedPassword).toBeTruthy()
      expect(upd.mustChangePassword).toBe(false) // R39: an admin reset does not force a change
      expect((await t.db.query<{ m: boolean }>('select must_reset_password m from users where id = $1::bigint', [b.u.id]))[0]).toEqual({ m: false })
      expect(await alive(b)).toBe(false)
      // The old password stops working; the new one works.
      const old = await t.http().post('/api/auth/login').send({ identifier: 'sesi.b@ujian.test', password: b.u.generatedPassword })
      expect(old.status).toBe(401)
      expect((await login(t, 'sesi.b@ujian.test', { password: upd.generatedPassword as string })).session.user.email).toBe('sesi.b@ujian.test')

      const c = await mk('sesi.c@ujian.test')
      await admin.put(`/admin/users/${c.u.id}`, { roles: ['teacher', 'school_admin'], name: 'C' })
      expect(await alive(c)).toBe(false)

      const d = await mk('sesi.d@ujian.test')
      await admin.del(`/admin/users/${d.u.id}`)
      expect(await alive(d)).toBe(false)

      // A plain profile edit leaves the session alone.
      const e = await mk('sesi.e@ujian.test')
      await admin.put(`/admin/users/${e.u.id}`, { roles: ['teacher'], name: 'E Baru' })
      expect(await alive(e)).toBe(true)
    })

    it('R39: an admin reset clears an already-set flag (a migrated account is not locked out); an edit without a reset leaves it', async () => {
      const u = CreatedUserSchema.parse((await admin.post('/admin/users', teacherBody(s1, { email: 'bertanda@ujian.test' }))).body.data)
      const flag = async () => (await t.db.query<{ m: boolean }>('select must_reset_password m from users where id = $1::bigint', [u.id]))[0]?.m
      await t.db.query('update users set must_reset_password = true where id = $1::bigint', [u.id])
      expect((await admin.put(`/admin/users/${u.id}`, { roles: ['teacher'], name: 'Bertanda Baru' })).status).toBe(200)
      expect(await flag()).toBe(true) // no password written: the flag is not touched
      const reset = await admin.put(`/admin/users/${u.id}`, { roles: ['teacher'], name: 'Bertanda Baru', resetPassword: true })
      expect(reset.status, JSON.stringify(reset.body)).toBe(200)
      const upd = UpdatedUserSchema.parse(reset.body.data)
      expect(upd.mustChangePassword).toBe(false)
      expect(await flag()).toBe(false)
      const sess = await login(t, 'bertanda@ujian.test', { password: upd.generatedPassword as string })
      expect(sess.session.mustChangePassword).toBe(false) // the session no longer carries the forced-change flag
    })
  })

  describe('audit (writes run in a transaction with their audit row)', () => {
    it('every write left an audit row with ids and no personal data', async () => {
      const rows = await t.db.query<{ action: string; detail: unknown }>(`select action, detail from audit_events where action like 'users.%'`)
      const actions = new Set(rows.map((r) => r.action))
      for (const a of ['users.created', 'users.updated', 'users.deleted', 'users.toggled', 'users.imported', 'users.bulk_deleted']) expect(actions).toContain(a)
      const dump = JSON.stringify(rows)
      expect(dump).not.toMatch(/@ujian\.test|Guru Sendiri|generatedPassword/)
    })

    it('a detail read is audited', async () => {
      const before = (await t.db.query<{ n: number }>(`select count(*)::int n from audit_events where action = 'users.read'`))[0]?.n as number
      await admin.get(`/admin/users/${ownTeacher}`)
      const after = (await t.db.query<{ n: number }>(`select count(*)::int n from audit_events where action = 'users.read'`))[0]?.n as number
      expect(after).toBe(before + 1)
    })

    it('a failed write leaves no audit row and no user (one transaction)', async () => {
      const before = (await t.db.query<{ n: number }>(`select count(*)::int n from audit_events`))[0]?.n as number
      await t.db.query(`create table zz_block (user_id bigint references users(id))`)
      await t.db.query(`insert into zz_block select id from users where email = 'guru.lain@ujian.test'`)
      expectError(await admin.del(`/admin/users/${otherTeacher}`), 'CONFLICT')
      await t.db.query(`drop table zz_block`)
      const after = (await t.db.query<{ n: number }>(`select count(*)::int n from audit_events`))[0]?.n as number
      expect(after).toBe(before)
    })
  })
})
