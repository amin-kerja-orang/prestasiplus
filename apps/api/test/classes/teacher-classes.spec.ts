import {
  CLASS_MESSAGES,
  ClassCreateRequestSchema,
  ClassQrDataSchema,
  TeacherClassSchema,
  envelopeOf,
  listEnvelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN,
  SCHOOL_ADMIN,
  STUDENT_1,
  TEACHER_A,
  TEACHER_B,
  TEACHER_C,
  bootClassesApp,
  client,
  createClass,
  errorIs,
  fieldsOf,
  firstSubject,
  idOfEmail,
  schoolOfCode,
  type Client,
  type ClassesTestApp,
} from './helpers'
import { ClassesService } from '../../src/modules/classes/classes.service'
import type { ClassActor } from '../../src/modules/classes/actor'

const ClassEnvelope = envelopeOf(TeacherClassSchema)
const ClassList = listEnvelopeOf(TeacherClassSchema)

describe('GET/POST /api/guru/classes and qr-data (AC 1, 2, 7)', () => {
  let t: ClassesTestApp
  let a: Client
  let b: Client
  let c: Client
  let subject: { id: string; name: string }
  let school1: string
  let school2: string

  beforeAll(async () => {
    t = await bootClassesApp()
    a = await client(t, TEACHER_A)
    b = await client(t, TEACHER_B)
    c = await client(t, TEACHER_C)
    subject = await firstSubject(t)
    school1 = await schoolOfCode(t, 'DEMO001')
    school2 = await schoolOfCode(t, 'DEMO002')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  describe('guards', () => {
    it('no session is 401 on every teacher route', async () => {
      for (const [method, path] of [
        ['get', '/api/guru/classes'],
        ['post', '/api/guru/classes'],
        ['get', '/api/guru/classes/1/qr-data'],
        ['get', '/api/guru/students'],
        ['put', '/api/guru/students/1'],
        ['delete', '/api/guru/students/1'],
        ['get', '/api/guru/dashboard'],
        ['get', '/api/guru/chapters'],
        ['post', '/api/guru/chapters'],
        ['get', '/api/guru/topics'],
        ['post', '/api/guru/topics'],
        ['get', '/api/guru/contributions'],
        ['get', '/api/guru/galeri-rajah'],
        ['get', '/api/kelas-saya'],
        ['post', '/api/kelas-saya/join'],
      ] as const) {
        const res = await t.http()[method](path)
        errorIs(res, 401, 'UNAUTHORIZED', 'Unauthenticated.')
      }
    })

    it('a student, a school admin and the central admin are 403 on the teacher routes', async () => {
      for (const who of [STUDENT_1, SCHOOL_ADMIN, ADMIN]) {
        const api = await client(t, who)
        errorIs(await api.get('/guru/classes'), 403, 'FORBIDDEN', 'This action is unauthorized.')
        errorIs(await api.post('/guru/classes', { name: 'X' }), 403, 'FORBIDDEN', 'This action is unauthorized.')
        errorIs(await api.get('/guru/dashboard'), 403, 'FORBIDDEN', 'This action is unauthorized.')
        errorIs(await api.get('/guru/students'), 403, 'FORBIDDEN', 'This action is unauthorized.')
        errorIs(await api.get('/guru/classes/1/qr-data'), 403, 'FORBIDDEN', 'This action is unauthorized.')
      }
    })

    it('a write without the CSRF header is 403 CSRF_INVALID and writes nothing', async () => {
      const res = await a.who.agent.post('/api/guru/classes').send({ name: 'Kelas Tanpa CSRF', subjectId: subject.id, educationLevel: 'tingkatan-4' })
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('CSRF_INVALID')
      expect(await t.db.query(`select 1 from classrooms where name = 'Kelas Tanpa CSRF'`)).toHaveLength(0)
    })

    it('answers are no-store (they name minors)', async () => {
      const res = await a.get('/guru/classes')
      expect(res.headers['cache-control']).toMatch(/no-store/)
    })
  })

  describe('POST /api/guru/classes', () => {
    it('creates a class owned by the caller with a server generated join code', async () => {
      const res = await a.post('/guru/classes', {
        name: '  Kelas 4 Amanah  ',
        subjectId: subject.id,
        educationLevel: 'tingkatan-4',
        schoolId: school1,
        description: '  Nota  ',
      })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const cls = ClassEnvelope.parse(res.body).data
      expect(cls).toMatchObject({
        kind: 'classroom',
        name: 'Kelas 4 Amanah',
        teacherId: await idOfEmail(t, TEACHER_A),
        schoolId: school1,
        subjectId: subject.id,
        subjectName: subject.name,
        educationLevel: 'tingkatan-4',
        levelLabel: 'Ting. 4',
        academicYear: 2026,
        description: 'Nota',
        isActive: true,
        studentCount: 0,
      })
      expect(cls.joinCode).toMatch(/^[A-HJKMNP-Z2-9]{6}$/)
      expect(cls.createdAt).toBe('2026-10-19T09:00:00.000+08:00')
      const [row] = await t.db.query<{ legacy_source: string | null; legacy_id: string | null; kind: string }>(
        `select legacy_source, legacy_id, kind from classrooms where id = $1`,
        [cls.id],
      )
      expect(row).toEqual({ legacy_source: null, legacy_id: null, kind: 'classroom' })
      expect(JSON.stringify(res.body)).not.toMatch(/legacy/)
    })

    it('description is optional: absent, null and blank give null', async () => {
      const x = await createClass(t, a, { name: 'Tanpa Huraian' })
      expect(x.schoolId).toBe(school1)
      const y = await a.post('/guru/classes', { name: 'Kosong', subjectId: subject.id, educationLevel: 'tingkatan-2', schoolId: '', description: '   ' })
      expect(y.status).toBe(201)
      expect(y.body.data).toMatchObject({ schoolId: school1, description: null, levelLabel: 'Ting. 2', educationLevel: 'tingkatan-2' })
      const z = await a.post('/guru/classes', { name: 'Null', subjectId: subject.id, educationLevel: 'tingkatan-5', schoolId: null, description: null })
      expect(z.status).toBe(201)
    })

    // SW7-01: the school picker is optional in the SPA; a class without a school is invisible to the school admin.
    it('SW7-01: no schoolId (absent, null or blank) gives the class the teacher own school', async () => {
      const base = { name: 'Sekolah Lalai', subjectId: subject.id, educationLevel: 'tingkatan-4' }
      for (const extra of [{}, { schoolId: null }, { schoolId: '' }]) {
        const res = await a.post('/guru/classes', { ...base, ...extra })
        expect(res.status, JSON.stringify(res.body)).toBe(201)
        expect(ClassEnvelope.parse(res.body).data.schoolId).toBe(school1)
        const [row] = await t.db.query<{ school_id: string | null }>(`select school_id::text from classrooms where id = $1`, [res.body.data.id])
        expect(row?.school_id).toBe(school1)
      }
      // the QR payload names the school now
      const k = await createClass(t, a, { name: 'QR Lalai' })
      expect((await a.get(`/guru/classes/${k.id}/qr-data`)).body.school).toBe('SMK Demo Satu')
    })

    it('SW7-01: an explicit own schoolId still works', async () => {
      const k = await createClass(t, a, { name: 'Sekolah Sendiri', schoolId: school1 })
      expect(k.schoolId).toBe(school1)
    })

    it('SW7-01: another school stays "Sekolah tidak sah." even though the default would be valid', async () => {
      const res = await a.post('/guru/classes', { name: 'Sekolah Lain', subjectId: subject.id, educationLevel: 'tingkatan-4', schoolId: school2 })
      expect(fieldsOf(res)).toEqual({ schoolId: CLASS_MESSAGES.school })
    })

    it('SW7-01: an actor without a school (not reachable by login, which refuses a school-less teacher) still gets a class without a school', async () => {
      // `buildGrants` refuses a teacher without a school, so this is the service contract, called with a hand-made actor.
      const teacherId = await idOfEmail(t, TEACHER_A)
      const actor = {
        auth: { sessionRowId: null, active: { scope: { level: 'school' } } },
        userId: teacherId,
        role: 'teacher',
        schoolId: null,
        isTest: false,
        requestId: null,
        ip: null,
      } as unknown as ClassActor
      const made = await t.get(ClassesService).createClass(actor, { name: 'Tiada Sekolah', subjectId: subject.id, educationLevel: 'tingkatan-4' })
      expect(made.schoolId).toBeNull()
      // an explicit school is refused for them too: it is not their school
      await expect(
        t.get(ClassesService).createClass(actor, { name: 'Cuba', subjectId: subject.id, educationLevel: 'tingkatan-4', schoolId: school1 }),
      ).rejects.toMatchObject({ fields: { schoolId: CLASS_MESSAGES.school } })
    })

    it('every join code is unique and never taken from the client', async () => {
      const codes = new Set<string>()
      for (let i = 0; i < 25; i++) codes.add((await createClass(t, b, { name: `Kod ${String(i)}` })).joinCode)
      expect(codes.size).toBe(25)
      const res = await a.post('/guru/classes', { name: 'X', subjectId: subject.id, educationLevel: 'tingkatan-4', joinCode: 'MYCODE' })
      expect(fieldsOf(res)).toEqual({ joinCode: 'The joinCode field is not allowed.' })
      for (const key of ['teacherId', 'isActive', 'kind', 'academicYear']) {
        const r = await a.post('/guru/classes', { name: 'X', subjectId: subject.id, educationLevel: 'tingkatan-4', [key]: 1 })
        expect(Object.keys(fieldsOf(r))).toEqual([key])
      }
    })

    it('secondary-only: a Darjah class level (tahun-n) is refused with the level message and nothing is created', async () => {
      const res = await a.post('/guru/classes', { name: 'Kelas Darjah', subjectId: subject.id, educationLevel: 'tahun-3' })
      expect(res.status).toBe(422)
      expect(fieldsOf(res)).toEqual({ educationLevel: CLASS_MESSAGES.level })
    })

    it('reports every failing field together with the mock messages', async () => {
      const res = await a.post('/guru/classes', {})
      expect(fieldsOf(res)).toEqual({
        name: CLASS_MESSAGES.className,
        subjectId: CLASS_MESSAGES.subject,
        educationLevel: CLASS_MESSAGES.level,
      })
      expect(res.body.error.message).toBe('Sila isi nama kumpulan. (and 2 more errors)')
      const base = { name: 'X', subjectId: subject.id, educationLevel: 'tingkatan-4' }
      expect(fieldsOf(await a.post('/guru/classes', { ...base, name: 'x'.repeat(256) }))).toEqual({ name: CLASS_MESSAGES.invalid })
      expect(fieldsOf(await a.post('/guru/classes', { ...base, name: '   ' }))).toEqual({ name: CLASS_MESSAGES.className })
      expect(fieldsOf(await a.post('/guru/classes', { ...base, educationLevel: 'tingkatan-6' }))).toEqual({ educationLevel: CLASS_MESSAGES.level })
      expect(fieldsOf(await a.post('/guru/classes', { ...base, description: 'd'.repeat(2001) }))).toEqual({ description: CLASS_MESSAGES.invalid })
    })

    it('the subject must exist and be active; a malformed or zero id is the same refusal', async () => {
      for (const subjectId of ['999999', 'abc', '0', '-1', '1e3']) {
        expect(fieldsOf(await a.post('/guru/classes', { name: 'X', subjectId, educationLevel: 'tingkatan-4' }))).toEqual({ subjectId: CLASS_MESSAGES.subject })
      }
      await t.db.query(`update subjects set is_active = false where id = $1`, [subject.id])
      expect(fieldsOf(await a.post('/guru/classes', { name: 'X', subjectId: subject.id, educationLevel: 'tingkatan-4' }))).toEqual({ subjectId: CLASS_MESSAGES.subject })
      await t.db.query(`update subjects set is_active = true where id = $1`, [subject.id])
    })

    it('the school must be the teacher own school (another or unknown school is "Sekolah tidak sah.")', async () => {
      for (const schoolId of [school2, '987654321', 'abc']) {
        expect(
          fieldsOf(await a.post('/guru/classes', { name: 'X', subjectId: subject.id, educationLevel: 'tingkatan-4', schoolId })),
        ).toEqual({ schoolId: CLASS_MESSAGES.school })
      }
    })
  })

  describe('GET /api/guru/classes', () => {
    it('lists only the own classes, newest first, active and inactive, with the single page meta', async () => {
      const base = ClassList.parse((await a.get('/guru/classes')).body).data.length
      t.clock.advance(60_000)
      const older = await createClass(t, a, { name: 'Lebih Baru Satu' })
      t.clock.advance(60_000)
      const newer = await createClass(t, a, { name: 'Lebih Baru Dua' })
      await t.db.query(`update classrooms set is_active = false where id = $1`, [older.id])
      const list = ClassList.parse((await a.get('/guru/classes')).body)
      expect(list.data).toHaveLength(base + 2)
      expect(list.data.slice(0, 2).map((x) => x.id)).toEqual([newer.id, older.id])
      expect(list.data[1]?.isActive).toBe(false)
      expect(list.meta).toMatchObject({ page: 1, pageSize: list.data.length, totalItems: list.data.length, totalPages: 1, from: 1, to: list.data.length })
      // teacher C owns none of them
      const other = ClassList.parse((await c.get('/guru/classes')).body)
      expect(other.data).toHaveLength(0)
      expect(other.meta).toMatchObject({ page: 1, pageSize: 1, totalItems: 0, totalPages: 1, from: null, to: null })
      // a school class (no teacher) of the same school is not in the list
      await t.db.query(
        `insert into classrooms (kind, name, school_id, education_level_id, academic_year) select 'school_class', 'Kelas Sekolah', $1, id, 2026 from education_levels where stage <> 'primary' order by id limit 1`,
        [school1],
      )
      expect(ClassList.parse((await a.get('/guru/classes')).body).data.every((x) => x.kind === 'classroom')).toBe(true)
    })

    it('counts only active real enrolments as studentCount', async () => {
      const k = await createClass(t, a, { name: 'Dengan Murid' })
      const ids = [await idOfEmail(t, STUDENT_1), await idOfEmail(t, 'pelajar2@demo.test'), await idOfEmail(t, 'pelajarmaju@demo.test')]
      await t.db.query(
        `insert into enrolments (classroom_id, student_id, status, source, is_test) values ($1,$2,'active','code',false), ($1,$3,'removed','code',false), ($1,$4,'active','code',true)`,
        [k.id, ids[0], ids[1], ids[2]],
      )
      const mine = ClassList.parse((await a.get('/guru/classes')).body).data.find((x) => x.id === k.id)
      expect(mine?.studentCount).toBe(1)
    })
  })

  describe('GET /api/guru/classes/:id/qr-data', () => {
    it('answers the bare payload of an own class; the host comes from configuration', async () => {
      const k = await createClass(t, a, { name: 'Kelas QR', schoolId: school1 })
      const res = await a.get(`/guru/classes/${k.id}/qr-data`)
      expect(res.status).toBe(200)
      expect(ClassQrDataSchema.parse(res.body)).toEqual({
        name: 'Kelas QR',
        school: 'SMK Demo Satu',
        joinUrl: `https://app.example.test/kelas-saya?kod=${k.joinCode}`,
      })
    })

    it('another teacher (same school or not), a school class, an unknown or malformed id is a plain 404', async () => {
      const k = await createClass(t, a, { name: 'Milik A', schoolId: school1 })
      const sc = (
        await t.db.query<{ id: string }>(
          `insert into classrooms (kind, name, school_id, education_level_id, academic_year, join_code) select 'school_class', 'KS', $1, id, 2026, 'SCHCLS' from education_levels where stage <> 'primary' order by id limit 1 returning id::text`,
          [school1],
        )
      )[0]?.id as string
      for (const [who, id] of [
        [b, k.id],
        [c, k.id],
        [a, sc],
        [a, '99999999'],
        [a, 'abc'],
        [a, '0'],
      ] as const) {
        errorIs(await who.get(`/guru/classes/${id}/qr-data`), 404, 'NOT_FOUND', 'Not Found.')
      }
    })
  })

  it('the contract request schema accepts the documented body', () => {
    expect(ClassCreateRequestSchema.safeParse({ name: 'A', subjectId: '1', educationLevel: 'tahun-1' }).success).toBe(true)
  })
})
