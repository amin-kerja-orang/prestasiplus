import { ErrorBodySchema, SchoolAdminClassListResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { apiOf, bootSchoolAdminApp, login, SCHOOL_ADMIN, schoolIdOf, STUDENT, TEACHER, type Api, type SchoolAdminTestApp } from './helpers'
import { addClassroom, addLevel, addPupil, addSchoolAdmin, addSubject, addTeacher, enrol, suspend } from './reports-fixtures'

/** DB spec: needs Docker/Testcontainers. */
describe('GET /admin-sekolah/kelas', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let adminB: Api
  let s1: string
  let s2: string
  let amanah: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    const t4 = await addLevel(t.db, 'T4', 'Tingkatan 4', 10)
    const d1 = await addLevel(t.db, 'D1', 'Darjah 1', 1)
    const mat = await addSubject(t.db, 'MATKLS', 'Matematik Ujian')
    const guru = await addTeacher(t.db, s1, 'Guru Kelas Satu')
    amanah = await addClassroom(t.db, { schoolId: s1, name: 'Kelas 4 Amanah', levelId: t4, teacherId: guru, subjectId: mat, joinCode: 'AMANAH1' })
    await addClassroom(t.db, { schoolId: s1, name: 'Kelas 1 Bestari', levelId: d1 })
    await addClassroom(t.db, { schoolId: s1, name: 'Kelas Tidak Aktif', levelId: t4, active: false })
    await addClassroom(t.db, { schoolId: s1, name: 'Kelas Sekolah Bukan Bilik', levelId: t4, kind: 'school_class' })
    await addClassroom(t.db, { schoolId: s2, name: 'Kelas Sekolah Lain', levelId: t4 })
    for (let i = 1; i <= 2; i++) await enrol(t.db, amanah, await addPupil(t.db, s1, `Murid Kelas ${i}`))
    for (let i = 10; i <= 40; i++) await addClassroom(t.db, { schoolId: s1, name: `Kelas Halaman ${i}`, levelId: d1 })
    await addSchoolAdmin(t.db, s2, 'admin.b@report.test')
    admin = apiOf(await login(t, SCHOOL_ADMIN))
    adminB = apiOf(await login(t, 'admin.b@report.test'))
  })
  afterAll(async () => {
    await t.close()
  })

  it('lists the active classes (both kinds) of the own school, A to Z, 25 per page, parsed with the contract and no-store', async () => {
    const res = await admin.get('/admin-sekolah/kelas')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const r = SchoolAdminClassListResponseSchema.parse(res.body)
    expect(r.data).toHaveLength(25)
    const names = r.data.map((c) => c.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms', { sensitivity: 'base' })))
    expect(r.meta).toMatchObject({ page: 1, pageSize: 25, totalItems: 34, totalPages: 2, displayed: 34 })
    // FR-AS-53-1: rows = the tile = active classes of BOTH kinds (33 classrooms + the school_class); the inactive one is hidden.
    expect(r.tiles.activeClasses).toBe(34)
    expect(r.tiles.activeClasses).toBe(r.meta.displayed)
    expect(r.levels).toEqual([
      { code: 'tahun-1', label: 'Darjah 1' },
      { code: 'tingkatan-4', label: 'Tingkatan 4' },
    ])
    expect(JSON.stringify(r)).not.toContain('Kelas Tidak Aktif')
  })

  it('a school_class row is listed with its own kind, key and no page link, and the inactive classroom is absent', async () => {
    const r = SchoolAdminClassListResponseSchema.parse((await admin.get('/admin-sekolah/kelas?search=bukan%20bilik')).body)
    expect(r.data).toHaveLength(1)
    expect(r.data[0]).toMatchObject({ kind: 'school_class', name: 'Kelas Sekolah Bukan Bilik', levelLabel: 'Tingkatan 4', members: 0, isActive: true })
    expect(r.data[0]?.key).toBe(`school_class:${r.data[0]?.id}`)
    // A school_class has no class dashboard (canOpenClassDashboard refuses it), so it carries no link.
    expect(r.data[0]?.link).toBeNull()
    expect((await admin.get('/admin-sekolah/kelas?search=tidak%20aktif')).body.data).toEqual([])
  })

  it('a row has the subject, level label, teacher, member count and link; no join code', async () => {
    const r = SchoolAdminClassListResponseSchema.parse((await admin.get('/admin-sekolah/kelas?search=amanah')).body)
    expect(r.data).toEqual([
      {
        key: `classroom:${amanah}`,
        kind: 'classroom',
        id: amanah,
        name: 'Kelas 4 Amanah',
        subject: { id: expect.any(String), name: 'Matematik Ujian' },
        levelLabel: 'Tingkatan 4',
        teacherName: 'Guru Kelas Satu',
        members: 2,
        isActive: true,
        link: `/prestasi/kelas/${amanah}`,
      },
    ])
  })

  it('joinCode is absent from the payload, even for a class that has one (FR-AS-53-5)', async () => {
    const res = await admin.get('/admin-sekolah/kelas?search=amanah')
    expect(JSON.stringify(res.body)).not.toContain('joinCode')
    expect(JSON.stringify(res.body)).not.toContain('AMANAH1')
    const bestari = SchoolAdminClassListResponseSchema.parse((await admin.get('/admin-sekolah/kelas?search=bestari')).body)
    expect(bestari.data[0]).toMatchObject({ name: 'Kelas 1 Bestari', subject: null, teacherName: null, levelLabel: 'Darjah 1' })
    expect(bestari.data[0]).not.toHaveProperty('joinCode')
  })

  it('level filter: a known slug narrows, an unknown slug means all levels', async () => {
    const t4 = SchoolAdminClassListResponseSchema.parse((await admin.get('/admin-sekolah/kelas?level=tingkatan-4')).body)
    expect(t4.meta.displayed).toBe(2)
    const unknown = SchoolAdminClassListResponseSchema.parse((await admin.get('/admin-sekolah/kelas?level=tingkatan-9')).body)
    expect(unknown.meta.displayed).toBe(34)
  })

  it('page: 2 has the rest; beyond the last page is the last page; invalid is page 1', async () => {
    const p2 = SchoolAdminClassListResponseSchema.parse((await admin.get('/admin-sekolah/kelas?page=2')).body)
    expect(p2.data).toHaveLength(9)
    expect(p2.meta.page).toBe(2)
    expect(SchoolAdminClassListResponseSchema.parse((await admin.get('/admin-sekolah/kelas?page=99')).body).meta.page).toBe(2)
    expect(SchoolAdminClassListResponseSchema.parse((await admin.get('/admin-sekolah/kelas?page=abc')).body).meta.page).toBe(1)
  })

  it('"Murid" per class is XS-1: pending, suspended, grade-less and other-school pupils are not counted (FR-AS-53-2)', async () => {
    const lain = (await adminB.get('/admin-sekolah/kelas')).body.data[0].id as string
    const ok = await addPupil(t.db, s2, 'Murid Dikira Satu')
    const pending = await addPupil(t.db, s2, 'Murid Menunggu', { active: false })
    const suspended = await addPupil(t.db, s2, 'Murid Digantung')
    const noGrade = await addPupil(t.db, s2, 'Murid Tanpa Gred')
    await t.db.query(`update users set grade = null where id = $1::bigint`, [noGrade])
    await suspend(t.db, suspended)
    const foreign = await addPupil(t.db, s1, 'Murid Sekolah Lain')
    for (const id of [ok, pending, suspended, noGrade, foreign]) await enrol(t.db, lain, id)
    const r = SchoolAdminClassListResponseSchema.parse((await adminB.get('/admin-sekolah/kelas')).body)
    expect(r.data.find((c) => c.id === lain)?.members).toBe(1)
  })

  it('a school-B admin sees only school B classes, whatever the query says', async () => {
    const r = SchoolAdminClassListResponseSchema.parse((await adminB.get(`/admin-sekolah/kelas?schoolId=${s1}`)).body)
    expect(r.data.map((c) => c.name)).toEqual(['Kelas Sekolah Lain'])
    expect(r.tiles.activeClasses).toBe(1)
    expect(JSON.stringify(r)).not.toContain('Amanah')
    expect(JSON.stringify(r)).not.toContain('AMANAH1')
  })

  it('401 without a session; 403 for teacher and student (admin: see admin-central-read.spec.ts)', async () => {
    expect((await t.http().get('/api/admin-sekolah/kelas')).status).toBe(401)
    for (const who of [TEACHER, STUDENT]) {
      const res = await apiOf(await login(t, who)).get('/admin-sekolah/kelas')
      expect(res.status, who).toBe(403)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('FORBIDDEN')
    }
  })
})

describe('GET /admin-sekolah/kelas: rows equal the Kelas Aktif tile (FR-AS-53-1)', () => {
  let t: SchoolAdminTestApp
  let admin: Api

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    const s1 = await schoolIdOf(t.db, 'DEMO001')
    const t4 = await addLevel(t.db, 'T4', 'Tingkatan 4', 10)
    await addClassroom(t.db, { schoolId: s1, name: 'Aktif Satu', levelId: t4 })
    await addClassroom(t.db, { schoolId: s1, name: 'Aktif Dua', levelId: t4 })
    await addClassroom(t.db, { schoolId: s1, name: 'Tidak Aktif', levelId: t4, active: false })
    await addClassroom(t.db, { schoolId: s1, name: 'Aktif Sekolah', levelId: t4, kind: 'school_class' })
    admin = apiOf(await login(t, SCHOOL_ADMIN))
  })
  afterAll(async () => {
    await t.close()
  })

  it('2 active classrooms + 1 inactive + 1 active school_class: 3 rows, tile 3, the inactive one absent', async () => {
    const r = SchoolAdminClassListResponseSchema.parse((await admin.get('/admin-sekolah/kelas')).body)
    expect(r.data.map((c) => c.name)).toEqual(['Aktif Dua', 'Aktif Satu', 'Aktif Sekolah'])
    expect(r.data.map((c) => c.kind)).toEqual(['classroom', 'classroom', 'school_class'])
    expect(r.tiles.activeClasses).toBe(3)
    expect(r.meta).toMatchObject({ totalItems: 3, displayed: 3 })
    expect(r.data).toHaveLength(r.tiles.activeClasses)
  })

  it('link: a classroom row keeps /prestasi/kelas/{id}; the school_class row has link null (no class dashboard, D106)', async () => {
    const r = SchoolAdminClassListResponseSchema.parse((await admin.get('/admin-sekolah/kelas')).body)
    for (const c of r.data) expect(c.link).toBe(c.kind === 'classroom' ? `/prestasi/kelas/${c.id}` : null)
    expect(r.data.find((c) => c.kind === 'school_class')?.link).toBeNull()
    // That a classroom id really opens is covered by canOpenClassDashboard (test/reports/performance/unit/policy-and-reduce.spec.ts).
  })
})
