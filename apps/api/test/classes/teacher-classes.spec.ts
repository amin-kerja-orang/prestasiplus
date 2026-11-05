import {
  CLASS_MESSAGES,
  ClassUpsertRequestSchema,
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

describe('GET/POST/PUT /api/guru/classes (AC 1, 2, 7; S6-T14)', () => {
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
        ['put', '/api/guru/classes/1'],
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
      ] as const) {
        const res = await t.http()[method](path)
        errorIs(res, 401, 'UNAUTHORIZED', 'Sesi anda telah tamat. Sila log masuk semula.')
      }
    })

    it('a student, a school admin and the central admin are 403 on the teacher routes', async () => {
      for (const who of [STUDENT_1, SCHOOL_ADMIN, ADMIN]) {
        const api = await client(t, who)
        errorIs(await api.get('/guru/classes'), 403, 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
        errorIs(await api.post('/guru/classes', { name: 'X' }), 403, 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
        errorIs(await api.get('/guru/dashboard'), 403, 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
        errorIs(await api.get('/guru/students'), 403, 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
        errorIs(await api.put('/guru/classes/1', { name: 'X', educationLevel: 'tingkatan-4' }), 403, 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
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
        const res = await a.post('/guru/classes', { ...base, name: `Sekolah Lalai ${JSON.stringify(extra)}`, ...extra })
        expect(res.status, JSON.stringify(res.body)).toBe(201)
        expect(ClassEnvelope.parse(res.body).data.schoolId).toBe(school1)
        const [row] = await t.db.query<{ school_id: string | null }>(`select school_id::text from classrooms where id = $1`, [res.body.data.id])
        expect(row?.school_id).toBe(school1)
      }
    })

    it('SW7-01: an explicit own schoolId still works', async () => {
      const k = await createClass(t, a, { name: 'Sekolah Sendiri', schoolId: school1 })
      expect(k.schoolId).toBe(school1)
    })

    it('SW7-01: another school stays "Sekolah tidak sah." even though the default would be valid', async () => {
      const res = await a.post('/guru/classes', { name: 'Sekolah Lain', subjectId: subject.id, educationLevel: 'tingkatan-4', schoolId: school2 })
      expect(fieldsOf(res)).toEqual({ schoolId: CLASS_MESSAGES.school })
    })

    it('AC-GUR-8-9: a teacher without a school is refused (422 noSchool) on create and edit, nothing is written', async () => {
      // `buildGrants` refuses a teacher without a school at login, so this is the service contract with a hand-made actor.
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
      await expect(t.get(ClassesService).createClass(actor, { name: 'Tiada Sekolah', educationLevel: 'tingkatan-4' })).rejects.toMatchObject({
        fields: { schoolId: CLASS_MESSAGES.noSchool },
      })
      expect(await t.db.query(`select 1 from classrooms where name = 'Tiada Sekolah'`)).toHaveLength(0)
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
      expect(fieldsOf(res)).toEqual({ educationLevel: CLASS_MESSAGES.educationLevelRequired })
    })

    it('reports every failing field together with the R1 messages (subject is optional)', async () => {
      const res = await a.post('/guru/classes', {})
      expect(fieldsOf(res)).toEqual({
        name: CLASS_MESSAGES.nameRequired,
        educationLevel: CLASS_MESSAGES.educationLevelRequired,
      })
      expect(res.body.error.message).toBe('Sila isi nama kelas. (and 1 more error)')
      const base = { name: 'X', subjectId: subject.id, educationLevel: 'tingkatan-4' }
      expect(fieldsOf(await a.post('/guru/classes', { ...base, name: 'x'.repeat(101) }))).toEqual({ name: CLASS_MESSAGES.nameTooLong })
      expect(fieldsOf(await a.post('/guru/classes', { ...base, name: '   ' }))).toEqual({ name: CLASS_MESSAGES.nameRequired })
      expect(fieldsOf(await a.post('/guru/classes', { ...base, educationLevel: 'tingkatan-6' }))).toEqual({ educationLevel: CLASS_MESSAGES.educationLevelRequired })
      expect(fieldsOf(await a.post('/guru/classes', { ...base, year: 2019 }))).toEqual({ year: CLASS_MESSAGES.yearRange })
      expect(fieldsOf(await a.post('/guru/classes', { ...base, description: 'd'.repeat(2001) }))).toEqual({ description: CLASS_MESSAGES.invalid })
    })

    it('subject is optional (absent, null or blank = no subject); year defaults to the current MYT year', async () => {
      for (const extra of [{}, { subjectId: null }, { subjectId: '' }]) {
        const res = await a.post('/guru/classes', { name: `Tanpa Subjek ${JSON.stringify(extra)}`, educationLevel: 'tingkatan-3', ...extra })
        expect(res.status, JSON.stringify(res.body)).toBe(201)
        expect(ClassEnvelope.parse(res.body).data).toMatchObject({ subjectId: null, subjectName: null, academicYear: 2026, year: 2026 })
      }
      const y = await a.post('/guru/classes', { name: 'Tahun Lain', educationLevel: 'tingkatan-3', year: 2027 })
      expect(ClassEnvelope.parse(y.body).data).toMatchObject({ academicYear: 2027, year: 2027 })
    })

    it('AC-GUR-8-7: a duplicate name of the same teacher and year is 409 (case, edge spaces); another year or teacher saves', async () => {
      const ok = await a.post('/guru/classes', { name: '5 Bestari', educationLevel: 'tingkatan-5', year: 2026 })
      expect(ok.status, JSON.stringify(ok.body)).toBe(201)
      const dup = await a.post('/guru/classes', { name: ' 5 bestari ', educationLevel: 'tingkatan-5', year: 2026 })
      expect(dup.status).toBe(409)
      expect(dup.body.error.code).toBe('CONFLICT')
      expect(dup.body.error.fields).toEqual({ name: CLASS_MESSAGES.nameTaken })
      expect(dup.body.error.message).toBe(CLASS_MESSAGES.nameTaken)
      expect((await a.post('/guru/classes', { name: ' 5 bestari ', educationLevel: 'tingkatan-5', year: 2027 })).status).toBe(201)
      expect((await b.post('/guru/classes', { name: '5 Bestari', educationLevel: 'tingkatan-5', year: 2026 })).status).toBe(201)
      expect(await t.db.query(`select 1 from classrooms where lower(btrim(name)) = '5 bestari' and academic_year = 2026 and teacher_id = $1`, [await idOfEmail(t, TEACHER_A)])).toHaveLength(1)
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

  describe('PUT /api/guru/classes/:id (API-GUR-03)', () => {
    it('edits an own class with the same validation as create; join code and owner stay', async () => {
      const k = await createClass(t, a, { name: 'Sebelum Edit', educationLevel: 'tingkatan-4' })
      const res = await a.put(`/guru/classes/${k.id}`, { name: '  Selepas Edit ', educationLevel: 'tingkatan-5', subjectId: null, year: 2027, description: ' Baharu ' })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const cls = ClassEnvelope.parse(res.body).data
      expect(cls).toMatchObject({
        id: k.id,
        name: 'Selepas Edit',
        educationLevel: 'tingkatan-5',
        subjectId: null,
        academicYear: 2027,
        year: 2027,
        description: 'Baharu',
        joinCode: k.joinCode,
        teacherId: await idOfEmail(t, TEACHER_A),
      })
      expect(fieldsOf(await a.put(`/guru/classes/${k.id}`, { name: '', educationLevel: 'tingkatan-9' }))).toEqual({
        name: CLASS_MESSAGES.nameRequired,
        educationLevel: CLASS_MESSAGES.educationLevelRequired,
      })
    })

    it('saving a class with its own name is not a duplicate; another own class name is 409', async () => {
      const one = await createClass(t, a, { name: 'Kelas Satu Edit' })
      const two = await createClass(t, a, { name: 'Kelas Dua Edit' })
      const same = await a.put(`/guru/classes/${one.id}`, { name: 'kelas satu edit', educationLevel: 'tingkatan-4' })
      expect(same.status, JSON.stringify(same.body)).toBe(200)
      const clash = await a.put(`/guru/classes/${two.id}`, { name: ' KELAS SATU EDIT', educationLevel: 'tingkatan-4' })
      expect(clash.status).toBe(409)
      expect(clash.body.error.fields).toEqual({ name: CLASS_MESSAGES.nameTaken })
    })

    it('another teacher, a school class, an unknown or malformed id is a plain 404', async () => {
      const k = await createClass(t, a, { name: 'Milik A Edit', schoolId: school1 })
      const sc = (
        await t.db.query<{ id: string }>(
          `insert into classrooms (kind, name, school_id, education_level_id, academic_year, join_code) select 'school_class', 'KS Edit', $1, id, 2026, 'SCHEDT' from education_levels where stage <> 'primary' order by id limit 1 returning id::text`,
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
        errorIs(await who.put(`/guru/classes/${id}`, { name: 'Hack', educationLevel: 'tingkatan-4' }), 404, 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
      }
      const [row] = await t.db.query<{ name: string }>(`select name from classrooms where id = $1`, [k.id])
      expect(row?.name).toBe('Milik A Edit')
    })
  })

  describe('GET /api/guru/classes/:id/qr-data (API-GUR-04: removed)', () => {
    it('answers 404 NOT_FOUND for the owner, another teacher, a pupil and the admins', async () => {
      const k = await createClass(t, a, { name: 'Kelas QR Dibuang', schoolId: school1 })
      for (const who of [a, b, await client(t, STUDENT_1), await client(t, SCHOOL_ADMIN), await client(t, ADMIN)]) {
        errorIs(await who.get(`/guru/classes/${k.id}/qr-data`), 404, 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
      }
    })

    it('the class still carries joinCode (the column stays for the pupil join)', async () => {
      const k = await createClass(t, a, { name: 'Kod Masih Ada' })
      expect(k.joinCode).toMatch(/^[A-HJKMNP-Z2-9]{6}$/)
    })
  })

  it('the contract request schema accepts the documented body', () => {
    expect(ClassUpsertRequestSchema.safeParse({ name: 'A', subjectId: '1', educationLevel: 'tahun-1' }).success).toBe(true)
  })
})
