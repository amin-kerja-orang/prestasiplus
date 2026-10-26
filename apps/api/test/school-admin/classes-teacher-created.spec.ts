import { SchoolAdminClassListResponseSchema, SchoolAdminDashboardSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ClassesModule } from '../../src/modules/classes'
import { AuthModule } from '../../src/modules/auth'
import { SchoolAdminModule } from '../../src/modules/school-admin'
import { UsersModule } from '../../src/modules/users'
import { apiOf, bootSchoolAdminApp, login, SCHOOL_ADMIN, schoolIdOf, TEACHER, type Api, type SchoolAdminTestApp } from './helpers'
import { addLevel, addSubject } from './reports-fixtures'

/** SW7-01: a class a teacher creates without picking a school belongs to the teacher's school, so the school admin sees it. */
describe('a class created by a teacher without a schoolId (SW7-01)', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let teacher: Api
  let s1: string
  let subjectId: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp({
      modules: [AuthModule, UsersModule, ClassesModule, SchoolAdminModule],
      env: { THROTTLE_CLASSES_READ_PER_MINUTE: '100000', THROTTLE_CLASSES_WRITE_PER_MINUTE: '100000' },
    })
    s1 = await schoolIdOf(t.db, 'DEMO001')
    await addLevel(t.db, 'T4', 'Tingkatan 4', 10)
    subjectId = await addSubject(t.db, 'MATSW7', 'Matematik Ujian')
    admin = apiOf(await login(t, SCHOOL_ADMIN))
    teacher = apiOf(await login(t, TEACHER))
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('shows in the school admin class list, the tiles and the dashboard Kelas Aktif', async () => {
    const before = SchoolAdminClassListResponseSchema.parse((await admin.get('/admin-sekolah/kelas')).body)
    expect(before.data).toHaveLength(0)
    expect(SchoolAdminDashboardSchema.parse((await admin.get('/admin-sekolah/dashboard')).body.data).cards.activeClasses).toBe(0)

    const made = await teacher.post('/guru/classes', { name: 'Kelas Tanpa Pilihan Sekolah', subjectId, educationLevel: 'tingkatan-4' })
    expect(made.status, JSON.stringify(made.body)).toBe(201)
    expect(made.body.data.schoolId).toBe(s1)

    const list = SchoolAdminClassListResponseSchema.parse((await admin.get('/admin-sekolah/kelas')).body)
    expect(list.data.map((c) => c.name)).toEqual(['Kelas Tanpa Pilihan Sekolah'])
    expect(list.meta.totalItems).toBe(1)
    expect(list.tiles.activeClasses).toBe(1)
    expect(SchoolAdminDashboardSchema.parse((await admin.get('/admin-sekolah/dashboard')).body.data).cards.activeClasses).toBe(1)
  })
})
