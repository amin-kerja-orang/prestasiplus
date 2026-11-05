import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, apiOf, bootSchoolAdminApp, expectError, login, SCHOOL_ADMIN, schoolIdOf, STUDENT, TEACHER, type Api, type SchoolAdminTestApp } from './helpers'
import { addClassroom, addLevel, addPupilsWithSessions, addSchoolAdmin } from './reports-fixtures'

/** API-ADM-22: Admin Pusat reads the five school reports with `?schoolId=`. DB spec: needs Docker/Testcontainers. */
const ROUTES = ['usage', 'laporan-aktiviti', 'laporan-bulanan', 'dskp-heatmap', 'kelas'] as const

describe('API-ADM-22 central read of the school reports', () => {
  let t: SchoolAdminTestApp
  let central: Api
  let sa1: Api
  let saB: Api
  let teacher: Api
  let pupil: Api
  let s1: string
  let s2: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    const t4 = await addLevel(t.db, 'T4', 'Tingkatan 4', 10)
    await addClassroom(t.db, { schoolId: s1, name: 'Kelas 4 Pusat', levelId: t4 })
    await addPupilsWithSessions(t.db, s1, 3, { mode: 'chapter', questions: 10, correct: 7, completedAt: '2026-10-19T08:00:00+08:00' })
    await addSchoolAdmin(t.db, s2, 'admin.b@report.test')
    central = apiOf(await login(t, ADMIN))
    sa1 = apiOf(await login(t, SCHOOL_ADMIN))
    saB = apiOf(await login(t, 'admin.b@report.test'))
    teacher = apiOf(await login(t, TEACHER))
    pupil = apiOf(await login(t, STUDENT))
  })
  afterAll(async () => {
    await t.close()
  })

  describe.each(ROUTES)('GET /admin-sekolah/%s', (route) => {
    it('admin with a valid schoolId gets 200 and the same body as the school admin of that school', async () => {
      const a = await central.get(`/admin-sekolah/${route}?schoolId=${s1}`)
      const b = await sa1.get(`/admin-sekolah/${route}`)
      expect(a.status, JSON.stringify(a.body)).toBe(200)
      expect(a.headers['cache-control']).toBe('no-store')
      expect(a.body).toEqual(b.body)
      const other = await central.get(`/admin-sekolah/${route}?schoolId=${s2}`)
      expect(other.status).toBe(200)
      expect(other.body).toEqual((await saB.get(`/admin-sekolah/${route}`)).body)
    })

    it('admin without schoolId, with an empty, malformed or repeated one: 422 fields.schoolId', async () => {
      for (const q of ['', '?schoolId=', '?schoolId=abc', '?schoolId=0', '?schoolId=01', '?schoolId=-3', `?schoolId=${s1}&schoolId=${s2}`, '?schoolId=99999999999999999999']) {
        const res = await central.get(`/admin-sekolah/${route}${q}`)
        const e = expectError(res, 'VALIDATION_ERROR')
        expect(Object.keys(e.fields ?? {}), q).toEqual(['schoolId'])
        expect(e.fields?.schoolId, q).toBe('Sila pilih sekolah.')
        expect(e.message, q).toBe('Sila pilih sekolah.')
      }
    })

    it('admin with an unknown school id: 404', async () => {
      expectError(await central.get(`/admin-sekolah/${route}?schoolId=987654321`), 'NOT_FOUND')
    })

    it('school_admin passing another school id still gets the own school', async () => {
      const own = await sa1.get(`/admin-sekolah/${route}`)
      const forced = await sa1.get(`/admin-sekolah/${route}?schoolId=${s2}`)
      expect(forced.status).toBe(200)
      expect(forced.body).toEqual(own.body)
      const junk = await sa1.get(`/admin-sekolah/${route}?schoolId=abc`)
      expect(junk.body).toEqual(own.body)
    })

    it('teacher and pupil are 403', async () => {
      expectError(await teacher.get(`/admin-sekolah/${route}?schoolId=${s1}`), 'FORBIDDEN')
      expectError(await pupil.get(`/admin-sekolah/${route}?schoolId=${s1}`), 'FORBIDDEN')
    })
  })

  describe('everything else of /admin-sekolah stays school_admin only (lead ruling, doc defect 7)', () => {
    it('admin is 403 on the pupil and teacher lists, exports, detail, form-options, dashboard and writes', async () => {
      for (const path of ['pelajar', 'guru', 'pelajar/export.csv', 'guru/export.csv', 'pelajar/form-options', 'pelajar/1', 'guru/1', 'dashboard', 'guru/pending']) {
        expectError(await central.get(`/admin-sekolah/${path}?schoolId=${s1}`), 'FORBIDDEN')
      }
      expectError(await central.post(`/admin-sekolah/pelajar?schoolId=${s1}`, { name: 'Murid Ujian Pusat' }), 'FORBIDDEN')
      expectError(await central.post(`/admin-sekolah/guru?schoolId=${s1}`, { name: 'Guru Ujian Pusat' }), 'FORBIDDEN')
    })

    it('the school admin still reaches its own lists', async () => {
      expect((await sa1.get('/admin-sekolah/pelajar')).status).toBe(200)
      expect((await sa1.get('/admin-sekolah/guru')).status).toBe(200)
    })
  })
})
