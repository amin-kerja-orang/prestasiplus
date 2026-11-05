import { AdminClassListResponseSchema, ErrorBodySchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, apiOf, bootSchoolAdminApp, login, SCHOOL_ADMIN, schoolIdOf, STUDENT, TEACHER, type Api, type SchoolAdminTestApp } from './helpers'
import { addClassroom, addLevel, addPupil, addSubject, addTeacher, enrol } from './reports-fixtures'

/** DB spec: needs Docker/Testcontainers. API-ADM-05 (S6-T11). */
describe('GET /admin/classes', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let s1: string
  let s2: string
  let teacher1: string
  let amanah: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    const t4 = await addLevel(t.db, 'T4', 'Tingkatan 4', 10)
    const t5 = await addLevel(t.db, 'T5', 'Tingkatan 5', 11)
    const d1 = await addLevel(t.db, 'D1', 'Darjah 1', 1)
    const mat = await addSubject(t.db, 'MATADM', 'Matematik Ujian')
    teacher1 = await addTeacher(t.db, s1, 'Guru Pusat Satu')
    amanah = await addClassroom(t.db, { schoolId: s1, name: 'Kelas 4 Amanah', levelId: t4, teacherId: teacher1, subjectId: mat, joinCode: 'AMANAH9' })
    await addClassroom(t.db, { schoolId: s1, name: 'Kelas 5 Bestari', levelId: t5 })
    await addClassroom(t.db, { schoolId: s1, name: 'Kelas Tidak Aktif', levelId: t4, active: false })
    await addClassroom(t.db, { schoolId: s1, name: 'Kelas Darjah', levelId: d1 })
    await addClassroom(t.db, { schoolId: s1, name: 'Kelas Sekolah Bukan Bilik', levelId: t4, kind: 'school_class' })
    await addClassroom(t.db, { schoolId: s2, name: 'Kelas 4 Dua Sekolah', levelId: t4 })
    for (let i = 1; i <= 3; i++) await enrol(t.db, amanah, await addPupil(t.db, s1, `Murid Pusat ${i}`))
    await enrol(t.db, amanah, await addPupil(t.db, s1, 'Murid Tidak Aktif', { active: false }))
    for (let i = 10; i <= 30; i++) await addClassroom(t.db, { schoolId: s2, name: `Kelas Halaman ${i}`, levelId: t5 })
    admin = apiOf(await login(t, ADMIN))
  })
  afterAll(async () => {
    await t.close()
  })

  it('role matrix: admin 200; school_admin, teacher and student 403; no session 401', async () => {
    expect((await admin.get('/admin/classes')).status).toBe(200)
    for (const who of [SCHOOL_ADMIN, TEACHER, STUDENT]) {
      const res = await apiOf(await login(t, who)).get('/admin/classes')
      expect(res.status).toBe(403)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('FORBIDDEN')
    }
    expect((await t.http().get('/api/admin/classes')).status).toBe(401)
  })

  it('lists classroom-kind classes of every school and level, no Darjah, A to Z, parsed with the contract, no-store', async () => {
    const res = await admin.get('/admin/classes?pageSize=100')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toContain('no-store')
    const r = AdminClassListResponseSchema.parse(res.body)
    const names = r.data.map((c) => c.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms', { sensitivity: 'base' })))
    expect(names).not.toContain('Kelas Darjah')
    expect(names).not.toContain('Kelas Sekolah Bukan Bilik')
    expect(names).toContain('Kelas 4 Dua Sekolah')
    expect(r.meta).toMatchObject({ page: 1, pageSize: 100, totalItems: 25 })
  })

  it('a row has level label, teacher, school, active pupils, join code and status', async () => {
    const r = AdminClassListResponseSchema.parse((await admin.get('/admin/classes?search=amanah')).body)
    expect(r.data).toEqual([
      {
        id: amanah,
        name: 'Kelas 4 Amanah',
        level: 'Tingkatan 4',
        teacher: { id: teacher1, name: 'Guru Pusat Satu' },
        school: { id: s1, name: expect.any(String) },
        pupils: 3,
        joinCode: 'AMANAH9',
        isActive: true,
      },
    ])
  })

  it('filters by school, level, teacher and search; a class without a teacher has teacher null', async () => {
    const bySchool = AdminClassListResponseSchema.parse((await admin.get(`/admin/classes?schoolId=${s2}&pageSize=100`)).body)
    expect(bySchool.data.every((c) => c.school?.id === s2)).toBe(true)
    expect(bySchool.meta.totalItems).toBe(22)

    const byLevel = AdminClassListResponseSchema.parse((await admin.get('/admin/classes?level=tingkatan-5&pageSize=100')).body)
    expect(byLevel.data.every((c) => c.level === 'Tingkatan 5')).toBe(true)
    expect(byLevel.meta.totalItems).toBe(22)

    const byTeacher = AdminClassListResponseSchema.parse((await admin.get(`/admin/classes?teacherId=${teacher1}`)).body)
    expect(byTeacher.data.map((c) => c.id)).toEqual([amanah])

    const bySearch = AdminClassListResponseSchema.parse((await admin.get('/admin/classes?search=BESTARI')).body)
    expect(bySearch.data.map((c) => c.name)).toEqual(['Kelas 5 Bestari'])
    expect(bySearch.data[0]?.teacher).toBeNull()

    const combined = AdminClassListResponseSchema.parse((await admin.get(`/admin/classes?schoolId=${s1}&level=tingkatan-4`)).body)
    expect(combined.data.map((c) => c.name)).toEqual(['Kelas 4 Amanah', 'Kelas Tidak Aktif'])
    expect(combined.data.find((c) => c.name === 'Kelas Tidak Aktif')?.isActive).toBe(false)
  })

  it('pages: default 20 per page, page two holds the rest, a page past the end is the last page', async () => {
    const p1 = AdminClassListResponseSchema.parse((await admin.get('/admin/classes')).body)
    expect(p1.data).toHaveLength(20)
    expect(p1.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 25, totalPages: 2 })
    const p2 = AdminClassListResponseSchema.parse((await admin.get('/admin/classes?page=2')).body)
    expect(p2.data).toHaveLength(5)
    const past = AdminClassListResponseSchema.parse((await admin.get('/admin/classes?page=9')).body)
    expect(past.meta.page).toBe(2)
  })

  it('a malformed level or paging is a 422 with fields; an unknown or malformed school or teacher id matches nothing', async () => {
    for (const q of ['pageSize=0', 'pageSize=101', 'page=0', 'level=tingkatan-9', `search=${'x'.repeat(101)}`]) {
      const res = await admin.get(`/admin/classes?${q}`)
      expect(res.status, q).toBe(422)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('VALIDATION_ERROR')
    }
    for (const q of ['schoolId=999999999', 'schoolId=abc', 'teacherId=abc']) {
      const none = AdminClassListResponseSchema.parse((await admin.get(`/admin/classes?${q}`)).body)
      expect(none.data, q).toEqual([])
      expect(none.meta.totalItems, q).toBe(0)
    }
  })
})
