import {
  AmaranSchoolRiskSchema,
  ErrorBodySchema,
  SchoolAdminClassListResponseSchema,
  SchoolAdminDashboardSchema,
  SchoolAdminPendingTeacherListResponseSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  ADMIN,
  apiOf,
  bootSchoolAdminApp,
  emptyView,
  FakePerformance,
  insertPendingTeacher,
  login,
  SCHOOL_ADMIN,
  schoolIdOf,
  STUDENT,
  TEACHER,
  type Api,
  type SchoolAdminTestApp,
} from './helpers'
import { AmaranService } from '../../src/modules/school-admin/amaran/amaran.service'
import { addClassroom, addLevel, addPupil, addSession, addSubject } from './reports-fixtures'

describe('GET /admin-sekolah/dashboard with no BE-19 / BE-17 provider (fail-closed defaults)', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let s1: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    admin = apiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
  })
  afterAll(async () => {
    await t.close()
  })

  it('answers the empty aggregate, parsed with the contract, no-store, with the own school and real counts', async () => {
    const res = await admin.get('/admin-sekolah/dashboard')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const d = SchoolAdminDashboardSchema.parse(res.body.data)
    expect(d.school).toMatchObject({ id: s1, name: 'SMK Demo Satu', code: 'DEMO001', ppd: 'Petaling', state: 'Selangor' })
    expect(d.roleLabel).toBe('Admin Sekolah')
    expect(d.cards.pupils).toBeGreaterThan(0)
    expect(d.cards.teachers).toBeGreaterThan(0)
    expect(d.cards.activeClasses).toBe(0)
    expect(d.cards.subscription).toEqual({ status: 'none', label: 'Belum Ada' })
    expect(d.performance.practice).toEqual({ accuracy: null, sessions: 0, questions: 0 })
    // S6-T13 A: the Amaran Awal tally of the school. The seeded pupils have no practice, so since S6-T04 (#650, FR-X4-3)
    // they are "Belum Bermula": outside Hijau / Kuning / Merah, so the panel shows 0 in every group.
    const amaran = AmaranSchoolRiskSchema.parse((await admin.get(`/amaran/schools/${s1}`)).body.data)
    expect(d.performance.risk).toEqual({ safe: 0, watch: 0, high: 0, total: 0 })
    expect(d.performance.risk?.total).toBe(amaran.tally.total)
    expect(amaran.tally.notStarted).toBeGreaterThan(0)
    expect(d.performance.total).toBe(0)
    expect(d.perutusan.length).toBeLessThanOrEqual(3)
  })

  it('a schoolId in the query is ignored: the dashboard is always the own school', async () => {
    const s2 = await schoolIdOf(t.db, 'DEMO002')
    const d = SchoolAdminDashboardSchema.parse((await admin.get(`/admin-sekolah/dashboard?schoolId=${s2}`)).body.data)
    expect(d.school.id).toBe(s1)
  })

  it('401 without a session; 403 for admin, teacher and student', async () => {
    expect((await t.http().get('/api/admin-sekolah/dashboard')).status).toBe(401)
    for (const who of [ADMIN, TEACHER, STUDENT]) {
      const res = await apiOf(await login(t, who)).get('/admin-sekolah/dashboard')
      expect(res.status, who).toBe(403)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('FORBIDDEN')
    }
  })

  it('a school admin without a school has no session at all (exactly 401): never "all schools"; the controller 403 is defence in depth', async () => {
    const id = (await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [SCHOOL_ADMIN]))[0]?.id as string
    const who = apiOf(await login(t, SCHOOL_ADMIN))
    await t.db.query(`update users set school_id = null where id = $1::bigint`, [id])
    try {
      const res = await who.get('/admin-sekolah/dashboard')
      // buildGrants() cannot derive a scope for a school-less school_admin, so the session is refused before the controller.
      expect(res.status).toBe(401)
    } finally {
      await t.db.query(`update users set school_id = $1::bigint where id = $2::bigint`, [s1, id])
    }
  })
})

describe('GET /admin-sekolah/dashboard cards are XS-1 and XS-3 (S6-T03)', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let s1: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    admin = apiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
  })
  afterAll(async () => {
    await t.close()
  })

  const countRole = async (role: string, extra = ''): Promise<number> =>
    Number(
      (await t.db.query<{ n: string }>(
        `select count(*)::text as n from users u where u.school_id = $1::bigint
           and exists (select 1 from user_roles r where r.user_id = u.id and r.role = $2) ${extra}`,
        [s1, role],
      ))[0]?.n,
    )

  it('JUMLAH GURU is XS-3 (a peer school_admin teacher is not counted) and JUMLAH PELAJAR is XS-1 (active, not suspended, Tingkatan 1-5)', async () => {
    // The seed holds both a plain teacher and a teacher who is also a school_admin (guruadmin@demo.test) in DEMO001.
    const peers = await countRole('teacher', `and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'school_admin')`)
    const plain = await countRole('teacher', `and not exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'school_admin')`)
    // Every teacher holding a role a school admin may not see (school_admin or any other), as managedBase drops them.
    const hidden = await countRole('teacher', `and exists (select 1 from user_roles r where r.user_id = u.id and r.role not in ('student', 'teacher'))`)
    expect(peers).toBeGreaterThanOrEqual(1)
    expect(plain).toBeGreaterThanOrEqual(1)

    const d = SchoolAdminDashboardSchema.parse((await admin.get('/admin-sekolah/dashboard')).body.data)
    const guru = await admin.get('/admin-sekolah/guru')
    const pelajar = await admin.get('/admin-sekolah/pelajar')
    expect(guru.status, JSON.stringify(guru.body)).toBe(200)
    expect(pelajar.status, JSON.stringify(pelajar.body)).toBe(200)

    // The seed has only student / teacher / school_admin roles, so the managed teacher list total equals XS-3 here.
    expect(d.cards.teachers).toBe(guru.body.meta.counts.total)
    // The raw teacher count includes the peers; the card must not.
    expect(d.cards.teachers).toBe((await countRole('teacher')) - hidden)
    expect(d.cards.teachers).toBe(plain)
    // Changed from `= pelajar.counts.total`: the list still counts every pupil with its status; the card counts XS-1 only.
    const xs1 = await countRole('student', 'and u.is_active and not u.is_suspended and u.grade between 7 and 11')
    expect(d.cards.pupils).toBe(xs1)
    expect(d.cards.pupils).toBeLessThanOrEqual(pelajar.body.meta.counts.total)
  })
})

describe('GET /admin-sekolah/dashboard with a BE-19-shaped provider', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let s1: string
  const fake = new FakePerformance(
    emptyView({
      stats: { students: 12, sessions: 40, answered: 500, accuracy: 68.4 },
      gps: { value: 2.6, band: 'Baik', entries: 12 },
      levels: [
        { code: 't4', accuracy: 71.2, students: 9 },
        { code: 't5', accuracy: 64.9, students: 3 },
      ],
      distribution: [
        { grade: 'A', count: 6, pct: 50 },
        { grade: 'B', count: 4, pct: 33 },
        { grade: 'C', count: 2, pct: 17 },
      ],
    }),
  )

  beforeAll(async () => {
    t = await bootSchoolAdminApp({ performance: fake, classes: { activeClasses: async () => 7 } })
    admin = apiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
  })
  afterAll(async () => {
    await t.close()
  })

  it('maps the BE-19 figures, shows small groups too (no minimum cohort), and asks BE-19 with the own school scope', async () => {
    const res = await admin.get('/admin-sekolah/dashboard')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const d = SchoolAdminDashboardSchema.parse(res.body.data)
    expect(d.cards.activeClasses).toBe(7)
    // S6-T03: `sessions` is the S10 view's (40); `questions` and `accuracy` are XS-4 / XS-5 of the school (no answer rows in this DB: 0 and null, never 0 %).
    expect(d.performance.practice).toEqual({ accuracy: null, sessions: 40, questions: 0 })
    // Staff screen, no minimum cohort (PO decision 2026-11-05, #503 batch 3): t5 (3 pupils) is shown, and so are the small grades.
    expect(d.performance.levels).toEqual([
      { code: 't4', name: 'Tingkatan 4', accuracy: 71.2 },
      { code: 't5', name: 'Tingkatan 5', accuracy: 64.9 },
    ])
    expect(d.performance.distribution).toEqual([
      { grade: 'A', count: 6, pct: 50 },
      { grade: 'B', count: 4, pct: 33 },
      { grade: 'C', count: 2, pct: 17 },
    ])
    expect(d.performance.total).toBe(12)
    expect(d.performance.gps).toEqual({ value: 2.6, grade: 'B+', band: 'Baik', entries: 12 })

    const ctx = fake.calls.at(-1)
    expect(ctx?.role).toBe('school_admin')
    expect(ctx?.scope).toMatchObject({ level: 'school', schoolId: s1 })
  })

  it('shows no pupil name: no seeded student name appears anywhere in the body', async () => {
    const names = (await t.db.query<{ name: string }>(
      `select u.name from users u join user_roles r on r.user_id = u.id where r.role = 'student'`,
    )).map((r) => r.name)
    expect(names.length).toBeGreaterThan(0)
    const text = (await admin.get('/admin-sekolah/dashboard')).text
    for (const name of names) expect(text).not.toContain(name)
  })

  it('a school under the cohort size still shows its practice block (no minimum cohort for staff)', async () => {
    fake.view = emptyView({ stats: { students: 4, sessions: 9, answered: 90, accuracy: 55 } })
    const d = SchoolAdminDashboardSchema.parse((await admin.get('/admin-sekolah/dashboard')).body.data)
    // Changed from { null, 0, 0 }: sessions are the view's; no answer rows in this DB, so questions 0 and accuracy null.
    expect(d.performance.practice).toEqual({ accuracy: null, sessions: 9, questions: 0 })
  })
})

describe('GET /admin-sekolah/dashboard agrees with the pages it links to (S6-T13 A)', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let s1: string
  let s2: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    admin = apiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const dashboard = async () => SchoolAdminDashboardSchema.parse((await admin.get('/admin-sekolah/dashboard')).body.data)
  const pendingList = async () =>
    SchoolAdminPendingTeacherListResponseSchema.parse((await admin.get('/admin-sekolah/guru/pending')).body)

  it('pendingTeachers equals the length of GET /admin-sekolah/guru/pending (0, then 2, own school only, suspended not counted)', async () => {
    expect((await dashboard()).pendingTeachers).toBe(0)
    expect((await pendingList()).data).toHaveLength(0)

    await insertPendingTeacher(t.db, 'tunggu1@ujian.test', s1, 'Guru Tunggu Satu')
    await insertPendingTeacher(t.db, 'tunggu2@ujian.test', s1, 'Guru Tunggu Dua')
    await insertPendingTeacher(t.db, 'tunggu3@ujian.test', s2, 'Guru Sekolah Lain')
    const suspended = await insertPendingTeacher(t.db, 'tunggu4@ujian.test', s1, 'Guru Digantung')
    await t.db.query(`update users set is_suspended = true where id = $1::bigint`, [suspended])

    const d = await dashboard()
    const list = await pendingList()
    expect(d.pendingTeachers).toBe(2)
    expect(d.pendingTeachers).toBe(list.data.length)
    expect(JSON.stringify(d)).not.toContain('Guru Tunggu')
  })

  it('cards.activeClasses equals the /admin-sekolah/kelas tile = the number of list rows (both kinds; inactive and other schools not counted)', async () => {
    const level = await addLevel(t.db, 'T4', 'Tingkatan 4', 10)
    for (let i = 1; i <= 3; i++) await addClassroom(t.db, { schoolId: s1, name: `Kelas Sepadan ${i}`, levelId: level })
    await addClassroom(t.db, { schoolId: s1, name: 'Kelas Tidak Aktif', levelId: level, active: false })
    await addClassroom(t.db, { schoolId: s1, name: 'Kelas Sekolah Sepadan', levelId: level, kind: 'school_class' })
    await addClassroom(t.db, { schoolId: s2, name: 'Kelas Sekolah Lain', levelId: level })
    const list = SchoolAdminClassListResponseSchema.parse((await admin.get('/admin-sekolah/kelas')).body)
    const tile = list.tiles.activeClasses
    expect(tile).toBe(4)
    expect(list.data).toHaveLength(tile)
    expect((await dashboard()).cards.activeClasses).toBe(tile)
  })
})

describe('GET /admin-sekolah/dashboard: Amaran Awal panel and Kelas Aktif tile (S6-T13 A)', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let s1: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    admin = apiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    const subject = await addSubject(t.db, 'DSHR1', 'Matematik Ujian')
    // Mixed pupils (fictitious): strong, middling and weak practice, plus pupils who never started.
    const recent = '2026-10-17T10:00:00+08:00'
    const profiles: Array<[string, number, number, number]> = [
      ['Murid Cemerlang', 10, 10, 90],
      ['Murid Baik', 10, 9, 70],
      ['Murid Sederhana', 10, 5, 30],
      ['Murid Lemah', 10, 1, 5],
    ]
    for (const [name, questions, correct, correctMastery] of profiles) {
      const id = await addPupil(t.db, s1, name, { grade: 10 })
      await addSession(t.db, id, { mode: 'chapter', questions, correct, completedAt: recent, subjectId: subject })
      await t.db.query(`insert into mastery (user_id, subject_id, correct, answered, last_answered_at) values ($1::bigint, $2::bigint, $3, 100, $4::timestamptz)`, [id, subject, correctMastery, recent])
    }
    await addPupil(t.db, s1, 'Murid Belum Mula Satu', { grade: 10 })
    await addPupil(t.db, s1, 'Murid Belum Mula Dua', { grade: 10 })
    const t4 = await addLevel(t.db, 'DT4', 'Tingkatan 4', 10)
    await addClassroom(t.db, { schoolId: s1, name: 'Kelas Bilik Aktif', levelId: t4 })
    await addClassroom(t.db, { schoolId: s1, name: 'Kelas Sekolah Aktif', levelId: t4, kind: 'school_class' })
    await addClassroom(t.db, { schoolId: s1, name: 'Kelas Bilik Tidak Aktif', levelId: t4, active: false })
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  it('an Amaran failure only hides the panel: the dashboard is 200 with risk null (review on #822)', async () => {
    const amaranService = t.app.get(AmaranService, { strict: false })
    const spy = vi.spyOn(amaranService, 'schoolTally').mockRejectedValueOnce(new Error('amaran down'))
    try {
      const res = await admin.get('/admin-sekolah/dashboard')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(SchoolAdminDashboardSchema.parse(res.body.data).performance.risk).toBeNull()
    } finally {
      spy.mockRestore()
    }
  })

  it('performance.risk equals the tally of GET /amaran/schools/:id (safe = green, watch = yellow, high = red, total = their sum)', async () => {
    const d = SchoolAdminDashboardSchema.parse((await admin.get('/admin-sekolah/dashboard')).body.data)
    const amaran = AmaranSchoolRiskSchema.parse((await admin.get(`/amaran/schools/${s1}`)).body.data)
    expect(d.performance.risk).toEqual({ safe: amaran.tally.green, watch: amaran.tally.yellow, high: amaran.tally.red, total: amaran.tally.total })
    const risk = d.performance.risk!
    expect(risk.total).toBe(risk.safe + risk.watch + risk.high)
    // The panel counts the three AS-49 groups only; Belum Bermula pupils are listed by Amaran but are in none of them (S6-T04).
    expect(risk.total).toBe(amaran.pupils.filter((p) => p.status !== 'not_started').length)
    expect(risk.total + (amaran.tally.notStarted ?? 0)).toBe(amaran.pupils.length)
    // The mixed pupils really spread over the groups, so the equality is not trivially 0 = 0.
    expect(risk.safe).toBeGreaterThan(0)
    expect(risk.high).toBeGreaterThan(0)
  })

  it('cards.activeClasses equals the /admin-sekolah/kelas tile and counts both kinds, active only', async () => {
    const d = SchoolAdminDashboardSchema.parse((await admin.get('/admin-sekolah/dashboard')).body.data)
    const list = SchoolAdminClassListResponseSchema.parse((await admin.get('/admin-sekolah/kelas')).body)
    expect(d.cards.activeClasses).toBe(2)
    expect(list.tiles.activeClasses).toBe(d.cards.activeClasses)
  })
})
