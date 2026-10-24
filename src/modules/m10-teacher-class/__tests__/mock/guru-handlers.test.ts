/**
 * M10-T1: the teacher-class mock handlers (SRS M10 v1.18 §7 #1, #11–#17, #35–#38, #42–#44, #51–#58,
 * #73–#75) against the §6.11 anchors, over the real stores of M01–M05, M10 and M14 at the project
 * clock (2026-09-25 15:40 MYT). Tests run in order and share one runtime: a write made by an earlier
 * test is accounted for in the later expectations. #39–#41 are served by M04 and only read here.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import type { TransportResponse } from '@/api/transport'
import { setUser } from '@/mock/core-data/set-user'
import { listDisplayConstants } from '@/mock/dataset/display-constants'
import type { MockRuntime } from '@/mock/index'
import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { IMPORT_TEMPLATE_CSV, questions } from '@/modules/m04-question-bank/mock'
import { practice } from '@/modules/m05-practice/mock'
import { teacherWallet } from '@/modules/m14-gamification/mock'

import { classrooms, dskp, remedialTests, teacherProfiles } from '../../mock'
import { M10_DISPLAY_CONSTANTS } from '../../mock/constants/display'
import { crc32 } from '../../mock/handlers/docx'
import { m10Hooks } from '../../mock/hooks'
import { planImport, TEMPLATE_CSV } from '../../mock/handlers/csv'
import { bootM10 } from './helpers'

const ADMIN = 1
const PELAJAR = 2
const GURU = 5

let runtime: MockRuntime
/** The M04 id of the designed contributed MCQ of teacher 5 (R-M04-03: Bahasa Melayu T5, approved). */
let anchorId = 0

beforeAll(async () => {
  ;({ runtime } = await bootM10({ withPractice: true }))
  anchorId = questions.contributions(GURU).rows[0]?.id ?? 0
}, 240_000)

interface Answer<T = unknown> {
  status: number
  body: T
  res: TransportResponse
}

interface Call {
  as?: number | null
  body?: unknown
}

/** One request as user `as` (default the teacher; `null` = guest). */
async function call<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  options: Call = {},
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  const who = options.as === undefined ? GURU : options.as
  if (who !== null) headers.authorization = `Bearer ${setUser(who).token}`
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers['content-type'] = 'application/json'
  }
  const res = await runtime.transport.request({
    method,
    url,
    headers,
    ...(options.body !== undefined ? { body: options.body } : {}),
  })
  return { status: res.status, body: res.body as T, res }
}

interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> }
}
interface Data<T> {
  data: T
}

const fieldsOf = (a: Answer): Record<string, string> => (a.body as ErrorBody).error.fields ?? {}

/** The id of the class the #13 test creates (runtime ids start at 9,000,001). */
let newClassId = 0
let newClassCode = ''
/** The M04 id of the first question created through #53. */
let firstQuestionId = 0

// ---------------------------------------------------------------------------------------------
describe('guards (SRS §7 T and S, §9)', () => {
  it('answers 401 to a guest and 403 to a non-teacher on every T route', async () => {
    const routes: [string, string][] = [
      ['GET', '/api/guru/dashboard'],
      ['GET', '/api/guru/remedial-progress'],
      ['GET', '/api/guru/classes'],
      ['GET', '/api/guru/students'],
      ['GET', '/api/guru/chapters'],
      ['GET', '/api/guru/topics'],
      ['GET', '/api/guru/contributions'],
      ['GET', '/api/guru/questions'],
      ['GET', '/api/guru/questions/template'],
    ]
    for (const [method, url] of routes) {
      expect((await call(method as 'GET', url, { as: null })).status, `${url} guest`).toBe(401)
      expect((await call(method as 'GET', url, { as: PELAJAR })).status, `${url} pelajar`).toBe(403)
    }
    for (const url of [
      '/api/guru/classes',
      '/api/guru/chapters',
      '/api/guru/topics',
      '/api/guru/dskp/bidang',
      '/api/guru/dskp/sk',
      '/api/guru/dskp/sp',
      '/api/guru/questions',
      '/api/guru/questions/import',
    ]) {
      expect((await call('POST', url, { as: null, body: {} })).status, `${url} guest`).toBe(401)
      expect((await call('POST', url, { as: PELAJAR, body: {} })).status, `${url} pelajar`).toBe(
        403,
      )
    }
    for (const [method, url] of [
      ['GET', '/api/guru/classes/2001/qr-data'],
      ['PUT', '/api/guru/students/3001'],
      ['DELETE', '/api/guru/students/3001'],
      ['GET', `/api/guru/questions/${String(anchorId)}`],
      ['PUT', `/api/guru/questions/${String(anchorId)}`],
      ['DELETE', `/api/guru/questions/${String(anchorId)}`],
    ] as const) {
      expect((await call(method, url, { as: null })).status, `${url} guest`).toBe(401)
      expect((await call(method, url, { as: PELAJAR })).status, `${url} pelajar`).toBe(403)
    }
  })

  it('answers 401 to a guest on the S routes and 403 to a teacher joining a class', async () => {
    for (const [method, url] of [
      ['GET', '/api/kelas-saya'],
      ['POST', '/api/kelas-saya/join'],
      ['GET', '/api/set-soalan-saya'],
    ] as const) {
      expect((await call(method, url, { as: null, body: {} })).status, url).toBe(401)
    }
    expect((await call('POST', '/api/kelas-saya/join', { body: { classCode: 'X' } })).status).toBe(
      403,
    )
  })
})

// ---------------------------------------------------------------------------------------------
describe('#1 GET /api/guru/dashboard (S1; BR-M10-05, BR-M10-06)', () => {
  it('teacher 5: 3/3 checklist, 2 classes, 8 pupils, 1 / 1 questions, empty panels', async () => {
    const a = await call<Data<Record<string, unknown>>>('GET', '/api/guru/dashboard')
    expect(a.status).toBe(200)
    expect(a.body.data).toMatchObject({
      checklist: { hasClass: true, hasStudents: true, hasMission: true },
      stats: {
        activeClasses: 2,
        totalClasses: 2,
        students: 8,
        questions: 1,
        questionsApproved: 1,
        assignments: 0,
      },
      today: { students: [], topics: [], actions: [] },
      peerTutor: [],
      submissions: [],
    })
    const classes = (a.body.data.classes as { id: number; studentCount: number }[]).map((c) => [
      c.id,
      c.studentCount,
    ])
    expect(classes.sort()).toEqual([
      [2001, 8],
      [2002, 8],
    ])
  })

  it('the admin: 0/3 checklist and the observed constants 20,719 / 19,361', async () => {
    const a = await call<Data<Record<string, unknown>>>('GET', '/api/guru/dashboard', {
      as: ADMIN,
    })
    expect(a.body.data).toMatchObject({
      checklist: { hasClass: false, hasStudents: false, hasMission: false },
      stats: {
        activeClasses: 0,
        totalClasses: 0,
        students: 0,
        questions: 20719,
        questionsApproved: 19361,
        assignments: 0,
      },
      classes: [],
    })
  })
})

describe('#11 GET /api/guru/remedial-progress (S3; BR-M10-13)', () => {
  it('teacher 5: 2 tests, 1 completed, 2 pupils, +27, rows with their status', async () => {
    const a = await call<{
      stats: Record<string, number>
      rows: { id: number; studentName: string; subjectName: string; status: string }[]
    }>('GET', '/api/guru/remedial-progress')
    expect(a.status).toBe(200)
    expect(a.body.stats).toEqual({ total: 2, completed: 1, students: 2, avgImprovement: 27 })
    expect(a.body.rows.map((r) => [r.id, r.status, r.subjectName])).toEqual([
      [7601, 'active', 'Kimia'],
      [7602, 'completed', 'Kimia'],
    ])
    expect(a.body.rows[0]).toMatchObject({
      studentName: 'Murid Demo 08',
      beforeAccuracy: 12.5,
      afterAccuracy: null,
    })
  })

  it('the admin owns no test: zeros and no rows', async () => {
    const a = await call<{ stats: Record<string, number>; rows: unknown[] }>(
      'GET',
      '/api/guru/remedial-progress',
      { as: ADMIN },
    )
    expect(a.body).toEqual({
      stats: { total: 0, completed: 0, students: 0, avgImprovement: 0 },
      rows: [],
    })
  })

  it('a cancelled test leaves the counts but stays in the rows', async () => {
    const t = remedialTests.create(
      {
        teacherId: GURU,
        studentId: 3001,
        subjectId: 10,
        subjectCode: 'CHEM',
        subjectName: 'Kimia',
        questionIds: [700001, 700002],
        beforeAccuracy: 40,
      },
      '2026-09-25T10:00:00+08:00',
    )
    const before = await call<{ stats: Record<string, number> }>(
      'GET',
      '/api/guru/remedial-progress',
    )
    expect(before.body.stats).toMatchObject({ total: 3, students: 3 })
    remedialTests.cancel(t.id)
    const after = await call<{ stats: Record<string, number>; rows: { status: string }[] }>(
      'GET',
      '/api/guru/remedial-progress',
    )
    expect(after.body.stats).toMatchObject({ total: 2, completed: 1, students: 2 })
    expect(after.body.rows.map((r) => r.status)).toContain('cancelled')
  })
})

// ---------------------------------------------------------------------------------------------
describe('#12–#14 classes (S4, S5; BR-M10-02, FR-M10-07)', () => {
  it('#12 lists the own classes in the list envelope; the admin has none', async () => {
    const a = await call<{
      data: { id: number; kind: string; studentCount: number; levelLabel: string }[]
      meta: { totalItems: number; totalPages: number }
    }>('GET', '/api/guru/classes')
    expect(a.status).toBe(200)
    expect(a.body.data.map((c) => c.id).sort()).toEqual([2001, 2002])
    expect(a.body.data.every((c) => c.kind === 'classroom' && c.studentCount === 8)).toBe(true)
    expect(a.body.meta).toMatchObject({ totalItems: 2, totalPages: 1 })
    const admin = await call<{ data: unknown[] }>('GET', '/api/guru/classes', { as: ADMIN })
    expect(admin.body.data).toEqual([])
  })

  it('#13 refuses a bad body with 422 and a field for each problem', async () => {
    const a = await call('POST', '/api/guru/classes', { body: {} })
    expect(a.status).toBe(422)
    expect(Object.keys(fieldsOf(a)).sort()).toEqual(['educationLevel', 'name', 'subjectId'])
    const b = await call('POST', '/api/guru/classes', {
      body: {
        name: 'X'.repeat(256),
        subjectId: 99999,
        educationLevel: 'tingkatan-9',
        schoolId: 99999999,
        description: 5,
      },
    })
    expect(b.status).toBe(422)
    expect(Object.keys(fieldsOf(b)).sort()).toEqual([
      'description',
      'educationLevel',
      'name',
      'schoolId',
      'subjectId',
    ])
    expect((await call('GET', '/api/guru/classes')).status).toBe(200)
  })

  it('#13 creates a class owned by the viewer with a unique 6-character code', async () => {
    const a = await call<
      Data<{
        id: number
        kind: string
        teacherId: number
        joinCode: string
        levelLabel: string
        studentCount: number
        schoolId: number | null
        subjectName: string
        isActive: boolean
        description: string | null
      }>
    >('POST', '/api/guru/classes', {
      body: {
        name: '  5 Kimia Cemerlang  ',
        subjectId: 10,
        educationLevel: 'tingkatan-5',
        schoolId: 900001,
        description: 'Kelas ujian',
      },
    })
    expect(a.status).toBe(201)
    const c = a.body.data
    expect(c).toMatchObject({
      kind: 'classroom',
      teacherId: GURU,
      levelLabel: 'Ting. 5',
      studentCount: 0,
      schoolId: 900001,
      subjectName: 'Kimia',
      isActive: true,
      description: 'Kelas ujian',
    })
    expect(c.id).toBeGreaterThanOrEqual(9_000_001)
    expect(c.joinCode).toMatch(/^[A-Z0-9]{6}$/)
    expect(classrooms.get('classroom', c.id)?.name).toBe('5 Kimia Cemerlang')
    newClassId = c.id
    newClassCode = c.joinCode
    // the mock clock stands still, so a later creation needs a later time to sort first
    runtime.clock.setNow('2026-09-25T15:41:00+08:00')
    const second = await call<Data<{ id: number; joinCode: string }>>('POST', '/api/guru/classes', {
      body: { name: 'Kelas dua', subjectId: 1, educationLevel: 'tahun-3' },
    })
    expect(second.body.data.joinCode).not.toBe(c.joinCode)
    expect(second.body.data.id).not.toBe(c.id)
    // newest first; the dashboard counts them
    const list = await call<{ data: { id: number }[] }>('GET', '/api/guru/classes')
    expect(list.body.data[0]?.id).toBe(second.body.data.id)
    expect(list.body.data).toHaveLength(4)
    const dash = await call<Data<{ stats: Record<string, number> }>>('GET', '/api/guru/dashboard')
    expect(dash.body.data.stats).toMatchObject({ activeClasses: 4, totalClasses: 4, students: 8 })
    runtime.clock.setNow('2026-09-25T15:40:00+08:00')
  })

  it('#14 gives the QR data of an own class and a generic 404 for any other', async () => {
    const a = await call<{ name: string; school: string | null; joinUrl: string }>(
      'GET',
      `/api/guru/classes/${String(newClassId)}/qr-data`,
    )
    expect(a.status).toBe(200)
    expect(a.body).toEqual({
      name: '5 Kimia Cemerlang',
      school: schools.get(900001)?.name,
      joinUrl: `https://prestasiplus.my/kelas-saya?kod=${newClassCode}`,
    })
    const noSchool = await call<{ school: string | null }>('GET', '/api/guru/classes/2001/qr-data')
    expect(noSchool.status).toBe(200)
    // not owned (the admin), unknown, a school-class number, a non-numeric id
    for (const [url, as] of [
      [`/api/guru/classes/${String(newClassId)}/qr-data`, ADMIN],
      ['/api/guru/classes/987654/qr-data', GURU],
      ['/api/guru/classes/abc/qr-data', GURU],
    ] as const) {
      const b = await call<ErrorBody>('GET', url, { as })
      expect(b.status, url).toBe(404)
      expect(b.body.error.code).toBe('NOT_FOUND')
      expect(JSON.stringify(b.body)).not.toContain('App\\Models')
    }
  })
})

// ---------------------------------------------------------------------------------------------
describe('#15–#17 students (S6; BR-M10-04, BR-M10-30)', () => {
  type Student = { id: number; name: string; levelName: string | null; classNames: string[] }
  type StudentList = { data: Student[]; meta: { count: number; schoolSet: boolean } }

  it('#15 mine: the 8 distinct pupils of the own active classes, by name, with class chips', async () => {
    const a = await call<StudentList>('GET', '/api/guru/students')
    expect(a.status).toBe(200)
    expect(a.body.meta).toEqual({ count: 8, schoolSet: true })
    expect(a.body.data.map((s) => s.id)).toEqual([3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008])
    expect(a.body.data[0]).toMatchObject({ name: 'Murid Demo 01', levelName: 'Tingkatan 5' })
    expect(a.body.data[0]?.classNames.sort()).toHaveLength(2)
    const found = await call<StudentList>('GET', '/api/guru/students?tab=mine&search=demo%2003')
    expect(found.body.data.map((s) => s.id)).toEqual([3003])
    expect(found.body.meta.count).toBe(1)
    const admin = await call<StudentList>('GET', '/api/guru/students', { as: ADMIN })
    expect(admin.body).toMatchObject({ data: [], meta: { count: 0, schoolSet: false } })
  })

  it('#15 school: the students of the profile school; "Sekolah belum ditetapkan" without one', async () => {
    const a = await call<StudentList>('GET', '/api/guru/students?tab=school')
    expect(a.status).toBe(200)
    expect(a.body.meta.schoolSet).toBe(true)
    const ids = a.body.data.map((s) => s.id)
    expect(ids).toContain(PELAJAR)
    expect(ids).toContain(3001)
    expect(a.body.data.length).toBeLessThanOrEqual(200)
    for (const s of a.body.data) {
      const u = users.get(s.id)
      expect(u?.role).toBe('student')
      expect(u?.schoolId).toBe(900001)
    }
    expect(a.body.data.find((s) => s.id === 3001)?.classNames).toHaveLength(2)
    expect(a.body.data.find((s) => s.id === PELAJAR)?.classNames).toEqual([])
    const search = await call<StudentList>('GET', '/api/guru/students?tab=school&search=Demo%2008')
    expect(search.body.data.map((s) => s.id)).toEqual([3008])
    expect(search.body.meta.count).toBe(1)
    const none = await call<StudentList>('GET', '/api/guru/students?tab=school', { as: ADMIN })
    expect(none.body).toMatchObject({ data: [], meta: { count: 0, schoolSet: false } })
  })

  it('#16 adds a student of the profile school to an own class; the refusals', async () => {
    const path = `/api/guru/students/${String(PELAJAR)}`
    expect((await call('PUT', path, { body: {} })).status).toBe(422)
    expect((await call('PUT', path, { body: { classroomId: 'x' } })).status).toBe(422)
    expect(
      (await call('PUT', '/api/guru/students/99999999', { body: { classroomId: newClassId } }))
        .status,
    ).toBe(404)
    expect(
      (await call('PUT', '/api/guru/students/5', { body: { classroomId: newClassId } })).status,
    ).toBe(404)
    expect((await call('PUT', path, { body: { classroomId: 98765 } })).status).toBe(404)
    // a class of another teacher: 403
    const other = classrooms.list({ kind: 'classroom', teacherId: 1699 })[0]
    expect(other).toBeDefined()
    expect((await call('PUT', path, { body: { classroomId: other?.classId } })).status).toBe(403)
    // a pupil of another school: 403
    const stranger = users
      .adminList({ role: 'student', pageSize: 200 })
      .rows.find((u) => u.schoolId !== 900001)
    expect(stranger).toBeDefined()
    const refused = await call('PUT', `/api/guru/students/${String(stranger?.id)}`, {
      body: { classroomId: newClassId },
    })
    expect(refused.status).toBe(403)

    const ok = await call<Data<Record<string, unknown>>>('PUT', path, {
      body: { classroomId: newClassId },
    })
    expect(ok.status).toBe(200)
    expect(ok.body.data).toMatchObject({
      classroomKind: 'classroom',
      classroomId: newClassId,
      studentId: PELAJAR,
      status: 'active',
      source: 'teacher',
    })
    expect((await call('PUT', path, { body: { classroomId: newClassId } })).status).toBe(409)
    const mine = await call<StudentList>('GET', '/api/guru/students')
    expect(mine.body.meta.count).toBe(9)
    expect(mine.body.data.find((s) => s.id === PELAJAR)?.classNames).toEqual(['5 Kimia Cemerlang'])
    // the admin owns no such class: 403
    expect((await call('PUT', path, { as: ADMIN, body: { classroomId: newClassId } })).status).toBe(
      403,
    )
  })

  it('#17 removes a student from an own class; the refusals', async () => {
    const path = `/api/guru/students/${String(PELAJAR)}`
    expect((await call('DELETE', path)).status).toBe(422)
    expect((await call('DELETE', `${path}?classroomId=98765`)).status).toBe(404)
    expect((await call('DELETE', `${path}?classroomId=2001`)).status).toBe(404)
    expect(
      (await call('DELETE', `${path}?classroomId=${String(newClassId)}`, { as: ADMIN })).status,
    ).toBe(403)
    const ok = await call<Data<{ removed: number }>>(
      'DELETE',
      `${path}?classroomId=${String(newClassId)}`,
    )
    expect(ok.status).toBe(200)
    expect(ok.body.data).toEqual({ removed: 1 })
    expect(classrooms.memberIds('classroom', newClassId)).toEqual([])
    expect((await call('DELETE', `${path}?classroomId=${String(newClassId)}`)).status).toBe(404)
    // the student can be added again (a `removed` row is reactivated)
    expect((await call('PUT', path, { body: { classroomId: newClassId } })).status).toBe(200)
    expect(classrooms.memberIds('classroom', newClassId)).toEqual([PELAJAR])
    await call('DELETE', `${path}?classroomId=${String(newClassId)}`)
  })
})

// ---------------------------------------------------------------------------------------------
describe('#35–#38 chapters and topics (M03 lookups, FN-M10-11.1)', () => {
  type Chapter = { id: number; chapterNumber: number | null; name: string }
  type Topic = { id: number; topicNumber: string | null; name: string }
  let chapterId = 0

  it('#35 gives a bare array; a missing or unknown pair gives []', async () => {
    const a = await call<Chapter[]>('GET', '/api/guru/chapters?subjectId=10&educationLevelId=11')
    expect(a.status).toBe(200)
    expect(Array.isArray(a.body)).toBe(true)
    expect(a.body.length).toBeGreaterThan(0)
    expect(a.body[0]).toEqual({
      id: expect.any(Number) as number,
      chapterNumber: expect.anything() as number | null,
      name: expect.any(String) as string,
    })
    expect(a.body.map((c) => c.id)).toEqual(
      curriculum
        .chapters(10, 11)
        .filter((c) => c.isActive)
        .map((c) => c.id),
    )
    for (const url of [
      '/api/guru/chapters',
      '/api/guru/chapters?subjectId=10',
      '/api/guru/chapters?subjectId=x&educationLevelId=11',
      '/api/guru/chapters?subjectId=99999&educationLevelId=11',
    ]) {
      const b = await call('GET', url)
      expect(b.status, url).toBe(200)
      expect(b.body, url).toEqual([])
    }
  })

  it('#36 creates a chapter (201) or answers 200 {error}', async () => {
    const body = { subjectId: 10, educationLevelId: 11, name: ' Bab Uji ', chapterNumber: 77 }
    const a = await call<Chapter>('POST', '/api/guru/chapters', { body })
    expect(a.status).toBe(201)
    expect(a.body).toMatchObject({ chapterNumber: 77, name: 'Bab Uji' })
    chapterId = a.body.id
    expect(a.body.id).toBeGreaterThan(0)
    const list = await call<Chapter[]>('GET', '/api/guru/chapters?subjectId=10&educationLevelId=11')
    expect(list.body.map((c) => c.id)).toContain(chapterId)
    for (const bad of [
      { ...body, name: '  ' },
      { ...body, chapterNumber: 0 },
      { ...body, chapterNumber: 100 },
      { ...body, chapterNumber: 'x' },
      { ...body, subjectId: 99999 },
      { ...body, educationLevelId: undefined },
    ]) {
      const b = await call<{ error: string }>('POST', '/api/guru/chapters', { body: bad })
      expect(b.status, JSON.stringify(bad)).toBe(200)
      expect(typeof b.body.error).toBe('string')
    }
  })

  it('#37/#38 lists the topics, creates the next numbered one, refuses with {error}', async () => {
    expect((await call('GET', '/api/guru/topics')).body).toEqual([])
    expect((await call('GET', '/api/guru/topics?chapterId=987654')).body).toEqual([])
    expect((await call('GET', `/api/guru/topics?chapterId=${String(chapterId)}`)).body).toEqual([])
    const a = await call<Topic>('POST', '/api/guru/topics', {
      body: { chapterId, name: 'Topik satu' },
    })
    expect(a.status).toBe(201)
    expect(a.body).toMatchObject({ topicNumber: '1', name: 'Topik satu' })
    const b = await call<Topic>('POST', '/api/guru/topics', {
      body: { chapterId, name: 'Topik dua' },
    })
    expect(b.body.topicNumber).toBe('2')
    const list = await call<Topic[]>('GET', `/api/guru/topics?chapterId=${String(chapterId)}`)
    expect(list.body.map((t) => t.name)).toEqual(['Topik satu', 'Topik dua'])
    // a dotted number counts by its leading integer ("1.1" → next "2")
    curriculum.createTopic({ chapterId, name: 'Topik 5.2', topicNumber: '5.2' }, 0)
    const dotted = await call<Topic>('POST', '/api/guru/topics', {
      body: { chapterId, name: 'Topik enam' },
    })
    expect(dotted.body.topicNumber).toBe('6')
    for (const bad of [{ chapterId, name: '' }, { chapterId: 987654, name: 'X' }, {}]) {
      const e = await call<{ error: string }>('POST', '/api/guru/topics', { body: bad })
      expect(e.status).toBe(200)
      expect(typeof e.body.error).toBe('string')
    }
  })
})

describe('#42–#44 DSKP creates (S18, S22; #39–#41 are served by M04)', () => {
  type Bidang = { id: number; code: string | null; name: string }
  type Sk = { id: number; code: string; description: string }
  let bidangId = 0
  let skId = 0

  it('#42 creates a Bidang the M04 cascade then lists', async () => {
    const a = await call<Bidang>('POST', '/api/guru/dskp/bidang', {
      body: { subjectId: 10, educationLevelId: 11, code: '7.0', name: 'Bidang Uji' },
    })
    expect(a.status).toBe(201)
    expect(a.body).toMatchObject({ code: '7.0', name: 'Bidang Uji' })
    bidangId = a.body.id
    expect(a.body.id).toBeGreaterThanOrEqual(9_000_001)
    expect(dskp.getBidang(bidangId)?.createdBy).toBe(GURU)
    const list = await call<Bidang[]>(
      'GET',
      '/api/guru/dskp/bidang?subjectId=10&educationLevelId=11',
    )
    expect(list.status).toBe(200)
    expect(list.body.map((b) => b.id)).toContain(bidangId)
    const blank = await call<Bidang>('POST', '/api/guru/dskp/bidang', {
      body: { subjectId: 10, educationLevelId: 11, code: '', name: 'Tanpa kod' },
    })
    expect(blank.body.code).toBeNull()
    for (const bad of [
      { subjectId: 10, educationLevelId: 11, code: '1', name: '' },
      { subjectId: 99999, educationLevelId: 11, code: '1', name: 'X' },
      { subjectId: 10, educationLevelId: 99999, code: '1', name: 'X' },
      { code: '1', name: 'X' },
    ]) {
      const e = await call<{ error: string }>('POST', '/api/guru/dskp/bidang', { body: bad })
      expect(e.status, JSON.stringify(bad)).toBe(200)
      expect(typeof e.body.error).toBe('string')
    }
  })

  it('#43/#44 create an SK under the Bidang and an SP under the SK', async () => {
    const sk = await call<Sk>('POST', '/api/guru/dskp/sk', {
      body: { bidangId, code: '7.1', description: 'SK ujian' },
    })
    expect(sk.status).toBe(201)
    expect(sk.body).toMatchObject({ code: '7.1', description: 'SK ujian' })
    skId = sk.body.id
    const sp = await call<Sk>('POST', '/api/guru/dskp/sp', {
      body: { skId, code: '7.1.1', description: 'SP ujian' },
    })
    expect(sp.status).toBe(201)
    expect(dskp.hasSp(sp.body.id)).toBe(true)
    const cascade = await call<Sk[]>('GET', `/api/guru/dskp/sk?bidangId=${String(bidangId)}`)
    expect(cascade.body.map((s) => s.id)).toEqual([skId])
    const sps = await call<Sk[]>('GET', `/api/guru/dskp/sp?skId=${String(skId)}`)
    expect(sps.body.map((s) => s.id)).toEqual([sp.body.id])
    for (const [url, bad] of [
      ['/api/guru/dskp/sk', { bidangId, code: '', description: 'X' }],
      ['/api/guru/dskp/sk', { bidangId, code: '1', description: '' }],
      ['/api/guru/dskp/sk', { bidangId: 987654, code: '1', description: 'X' }],
      ['/api/guru/dskp/sp', { skId, code: '', description: 'X' }],
      ['/api/guru/dskp/sp', { skId, code: '1', description: ' ' }],
      ['/api/guru/dskp/sp', { skId: 987654, code: '1', description: 'X' }],
    ] as const) {
      const e = await call<{ error: string }>('POST', url, { body: bad })
      expect(e.status, `${url} ${JSON.stringify(bad)}`).toBe(200)
      expect(typeof e.body.error).toBe('string')
    }
  })
})

// ---------------------------------------------------------------------------------------------
describe('#51–#52 contributions (S21; BR-M10-21, BR-M10-23)', () => {
  type Contrib = {
    stats: { total: number; approved: number; pending: number; used: number }
    tiers: { name: string; threshold: number; icon: string; reached: boolean }[]
    nextTier: { name: string; threshold: number } | null
    breakdown: { label: string; count: number }[]
  }

  it('#51 teacher 5: 1 / 1 / 0 / 0, no tier reached, next = Penyumbang Baru, one chip', async () => {
    const a = await call<Contrib>('GET', '/api/guru/contributions')
    expect(a.status).toBe(200)
    expect(a.body.stats).toEqual({ total: 1, approved: 1, pending: 0, used: 0 })
    expect(a.body.tiers).toHaveLength(8)
    expect(a.body.tiers.map((t) => t.threshold)).toEqual([
      10, 100, 500, 1000, 2500, 5000, 10000, 50000,
    ])
    expect(a.body.tiers[0]).toMatchObject({ name: 'Penyumbang Baru', icon: 'fa-seedling' })
    expect(a.body.tiers.some((t) => t.reached)).toBe(false)
    expect(a.body.nextTier).toEqual({ name: 'Penyumbang Baru', threshold: 10 })
    expect(a.body.breakdown).toEqual([{ label: 'Bahasa Melayu', count: 1 }])
  })

  it('#51 the admin: 16,817 contributions, seven tiers reached, next = Legenda Terulung', async () => {
    const a = await call<Contrib>('GET', '/api/guru/contributions', { as: ADMIN })
    expect(a.body.stats).toEqual({ total: 16817, approved: 16817, pending: 0, used: 0 })
    expect(a.body.tiers.filter((t) => t.reached)).toHaveLength(7)
    expect(a.body.nextTier).toEqual({ name: 'Legenda Terulung', threshold: 50000 })
    expect(a.body.breakdown.length).toBeLessThanOrEqual(11)
    const counts = a.body.breakdown.map((b) => b.count)
    expect(counts.slice(0, 10)).toEqual([...counts.slice(0, 10)].sort((x, y) => y - x))
    expect(a.body.breakdown.reduce((n, b) => n + b.count, 0)).toBe(16817)
  })

  it('#52 pages the own questions, ids ascending, 20 per page', async () => {
    const own = await call<{
      data: {
        id: number
        statusLabel: string
        subjectName: string
        levelName: string
        difficultyLabel: string
      }[]
      meta: { totalItems: number; pageSize: number }
    }>('GET', '/api/guru/questions')
    expect(own.status).toBe(200)
    expect(own.body.data.map((q) => q.id)).toEqual([anchorId])
    expect(own.body.data[0]).toMatchObject({
      statusLabel: 'Diluluskan',
      subjectName: 'Bahasa Melayu',
      difficultyLabel: 'Mudah',
    })
    expect(own.body.meta).toMatchObject({ totalItems: 1, pageSize: 20 })
    const admin = await call<{
      data: { id: number }[]
      meta: { totalItems: number; totalPages: number; page: number }
    }>('GET', '/api/guru/questions?page=2', { as: ADMIN })
    expect(admin.body.data).toHaveLength(20)
    expect(admin.body.meta).toMatchObject({ totalItems: 16817, totalPages: 841, page: 2 })
    const ids = admin.body.data.map((q) => q.id)
    expect(ids).toEqual([...ids].sort((x, y) => x - y))
  })
})

// ---------------------------------------------------------------------------------------------
describe('#53–#56 contributed questions (S22–S24; BR-M10-21, BR-M10-22, SEC-M10-07)', () => {
  type Q = {
    id: number
    status: string
    statusLabel: string
    isActive: boolean
    difficultyLevel: number
    options: string[] | null
    correctAnswer: number | null
    questionType: string
    explanation: string | null
    createdAt: string
    questionImage: string | null
    tfAnswer: boolean | null
    correctAnswerText: string | null
    curriculumChapterId: number | null
    dskpSpId: number | null
    usage: { attempts: number; correct: number; accuracy: number }
  }
  const mcq = {
    educationLevelId: 11,
    subjectId: 10,
    questionType: 'mcq',
    difficultyLevel: 'medium',
    questionText: 'Apakah hasil elektrolisis larutan natrium klorida pekat di anod?',
    options: ['Klorin', 'Hidrogen', 'Oksigen', 'Natrium'],
    correctAnswer: 0,
    explanation: 'Ion klorida dinyahcas.',
  }
  const count = () => teacherWallet.summary(GURU).questionsCount

  it('#53 refuses a bad body with a field for each problem', async () => {
    const empty = await call('POST', '/api/guru/questions', { body: {} })
    expect(empty.status).toBe(422)
    expect(Object.keys(fieldsOf(empty)).sort()).toEqual([
      'difficultyLevel',
      'educationLevelId',
      'questionText',
      'questionType',
      'subjectId',
    ])
    const cases: [Record<string, unknown>, string][] = [
      [{ options: ['A', 'B', '', 'D'] }, 'options'],
      [{ options: ['A', 'B'] }, 'options'],
      [{ options: ['A', 'B', 'C', 'X'.repeat(501)] }, 'options'],
      [{ correctAnswer: 4 }, 'correctAnswer'],
      [{ correctAnswer: undefined }, 'correctAnswer'],
      [{ difficultyLevel: 'extreme' }, 'difficultyLevel'],
      [{ difficultyLevel: 6 }, 'difficultyLevel'],
      [{ questionText: 'X'.repeat(2001) }, 'questionText'],
      [{ questionType: 'poem' }, 'questionType'],
      [{ scriptType: 'klingon' }, 'scriptType'],
      [{ dskpSpId: 987654 }, 'dskpSpId'],
      [{ curriculumChapterId: 987654 }, 'curriculumChapterId'],
      [{ curriculumChapterId: curriculum.chapters(1, 11)[0]?.id }, 'curriculumChapterId'],
      [{ curriculumTopicId: 1 }, 'curriculumTopicId'],
    ]
    for (const [patch, field] of cases) {
      const a = await call('POST', '/api/guru/questions', { body: { ...mcq, ...patch } })
      expect(a.status, JSON.stringify(patch)).toBe(422)
      expect(Object.keys(fieldsOf(a)), JSON.stringify(patch)).toContain(field)
    }
    const types: [Record<string, unknown>, string][] = [
      [{ questionType: 'true_false' }, 'tfAnswer'],
      [{ questionType: 'short_answer', correctAnswer: '' }, 'correctAnswer'],
      [{ questionType: 'fill_blank', correctAnswer: undefined }, 'correctAnswer'],
    ]
    for (const [patch, field] of types) {
      const a = await call('POST', '/api/guru/questions', { body: { ...mcq, ...patch } })
      expect(a.status, JSON.stringify(patch)).toBe(422)
      expect(Object.keys(fieldsOf(a))).toContain(field)
    }
    const png = new File(['x'], 'rajah.gif', { type: 'image/gif' })
    const form = new FormData()
    for (const [k, v] of Object.entries(mcq)) {
      if (Array.isArray(v)) v.forEach((o) => form.append(`${k}[]`, String(o)))
      else form.append(k, String(v))
    }
    form.append('questionImage', png)
    const bad = await call('POST', '/api/guru/questions', { body: form })
    expect(bad.status).toBe(422)
    expect(Object.keys(fieldsOf(bad))).toContain('questionImage')
  })

  it('#53 creates a pending, active question and runs the M14 hook', async () => {
    const before = count()
    const a = await call<Data<Q>>('POST', '/api/guru/questions', { body: mcq })
    expect(a.status).toBe(201)
    const q = a.body.data
    firstQuestionId = q.id
    expect(q).toMatchObject({
      status: 'pending_review',
      statusLabel: 'Menunggu Semakan',
      isActive: true,
      difficultyLevel: 3,
      questionType: 'mcq',
      options: mcq.options,
      correctAnswer: 0,
      explanation: 'Ion klorida dinyahcas.',
      questionImage: null,
    })
    expect(q.id).toBeGreaterThanOrEqual(9_000_001)
    const stored = questions.get(q.id)
    expect(stored).toMatchObject({ createdBy: GURU, status: 'pending_review', isActive: true })
    expect(count()).toBe(before + 1)
    // not practice-eligible until approved
    expect(questions.getEligible(q.id)).toBeNull()
    const s = await call<{ stats: Record<string, number> }>('GET', '/api/guru/contributions')
    expect(s.body.stats).toEqual({ total: 2, approved: 1, pending: 1, used: 0 })
    const list = await call<{ data: { id: number }[] }>('GET', '/api/guru/questions')
    expect(list.body.data.map((x) => x.id)).toEqual([anchorId, q.id])
    const dash = await call<Data<{ stats: Record<string, number> }>>('GET', '/api/guru/dashboard')
    expect(dash.body.data.stats).toMatchObject({ questions: 2, questionsApproved: 1 })
  })

  it('#53 maps easy / hard, accepts the other types, a chapter, a DSKP SP and an image (multipart)', async () => {
    const before = count()
    const easy = await call<Data<Q>>('POST', '/api/guru/questions', {
      body: { ...mcq, difficultyLevel: 'easy', correctAnswer: 'B' },
    })
    expect(easy.body.data).toMatchObject({ difficultyLevel: 2, correctAnswer: 1 })
    const hard = await call<Data<Q>>('POST', '/api/guru/questions', {
      body: { ...mcq, difficultyLevel: 'hard', correctAnswer: '3' },
    })
    expect(hard.body.data).toMatchObject({ difficultyLevel: 4, correctAnswer: 3 })
    const tf = await call<Data<Q>>('POST', '/api/guru/questions', {
      body: { ...mcq, questionType: 'true_false', tfAnswer: false, options: undefined },
    })
    expect(tf.status).toBe(201)
    expect(tf.body.data).toMatchObject({
      questionType: 'true_false',
      tfAnswer: false,
      options: null,
    })
    const short = await call<Data<Q>>('POST', '/api/guru/questions', {
      body: {
        ...mcq,
        questionType: 'short_answer',
        correctAnswer: 'Klorin',
        altAnswers: 'klor, chlorine',
      },
    })
    expect(short.body.data).toMatchObject({
      questionType: 'short_answer',
      correctAnswerText: 'Klorin',
    })
    const essay = await call<Data<Q>>('POST', '/api/guru/questions', {
      body: { ...mcq, questionType: 'essay', correctAnswer: undefined },
    })
    expect(essay.status).toBe(201)

    const chapter = curriculum.chapters(10, 11).find((c) => c.isActive)
    // SP 9001 "Sel Elektrolisis": Kimia T5, designed (SRS §6.9)
    const sp = dskp.getSp(9001)
    expect(chapter && sp).toBeTruthy()
    const form = new FormData()
    for (const [k, v] of Object.entries({
      ...mcq,
      curriculumChapterId: chapter?.id,
      dskpSpId: sp?.id,
      scriptType: 'rumi',
    })) {
      if (Array.isArray(v)) v.forEach((o) => form.append(`${k}[]`, String(o)))
      else form.append(k, String(v))
    }
    form.append('questionImage', new File(['png'], 'rajah elektrolisis.png', { type: 'image/png' }))
    const withImage = await call<Data<Q>>('POST', '/api/guru/questions', { body: form })
    expect(withImage.status, JSON.stringify(withImage.body)).toBe(201)
    expect(withImage.body.data).toMatchObject({
      curriculumChapterId: chapter?.id,
      dskpSpId: sp?.id,
      questionImage: 'blob:mock/question/rajah%20elektrolisis.png',
      options: mcq.options,
      correctAnswer: 0,
    })
    expect(count()).toBe(before + 6)
  })

  it('#54 gives the detail with usage to the owner and 404 to anyone else', async () => {
    const a = await call<Data<Q>>('GET', `/api/guru/questions/${String(firstQuestionId)}`)
    expect(a.status).toBe(200)
    expect(a.body.data).toMatchObject({
      id: firstQuestionId,
      usage: { attempts: 0, correct: 0, accuracy: 0 },
      curriculumChapterId: null,
    })
    const anchor = await call<Data<Q>>('GET', `/api/guru/questions/${String(anchorId)}`)
    expect(anchor.status).toBe(200)
    for (const [id, as] of [
      [firstQuestionId, ADMIN],
      [anchorId, ADMIN],
      [987654321, GURU],
      [1, GURU],
    ] as const) {
      const b = await call<ErrorBody>('GET', `/api/guru/questions/${String(id)}`, { as })
      expect(b.status, `${String(id)} as ${String(as)}`).toBe(404)
      expect(b.body.error.code).toBe('NOT_FOUND')
    }
  })

  it('#55 edits an own question; an empty difficulty keeps the saved one; refusals', async () => {
    const url = `/api/guru/questions/${String(firstQuestionId)}`
    const edit = {
      questionText: 'Apakah hasil di anod semasa elektrolisis NaCl pekat?',
      difficultyLevel: '',
      options: [
        { id: 0, optionText: 'Gas klorin' },
        { id: 1, optionText: 'Gas hidrogen' },
        { id: 2, optionText: 'Gas oksigen' },
        { id: 3, optionText: 'Logam natrium' },
      ],
      correctOptionId: 2,
      explanation: '',
    }
    const a = await call<Data<Q>>('PUT', url, { body: edit })
    expect(a.status).toBe(200)
    expect(a.body.data).toMatchObject({
      difficultyLevel: 3,
      options: ['Gas klorin', 'Gas hidrogen', 'Gas oksigen', 'Logam natrium'],
      correctAnswer: 2,
      explanation: null,
      status: 'pending_review',
      isActive: true,
    })
    const hard = await call<Data<Q>>('PUT', url, {
      body: { questionText: edit.questionText, difficultyLevel: 'hard' },
    })
    expect(hard.body.data).toMatchObject({ difficultyLevel: 4, correctAnswer: 2 })
    expect(questions.get(firstQuestionId)?.questionText).toBe(edit.questionText)

    expect((await call('PUT', url, { body: { questionText: ' ' } })).status).toBe(422)
    expect((await call('PUT', url, { body: { ...edit, difficultyLevel: 'x' } })).status).toBe(422)
    const reordered = { ...edit, options: edit.options.slice(0, 3), correctOptionId: 1 }
    expect(fieldsOf(await call('PUT', url, { body: reordered })).options).toBeDefined()
    expect(
      Object.keys(fieldsOf(await call('PUT', url, { body: { ...edit, correctOptionId: 9 } }))),
    ).toEqual(['correctOptionId'])
    const dupIds = { ...edit, options: edit.options.map((o) => ({ ...o, id: 0 })) }
    expect((await call('PUT', url, { body: dupIds })).status).toBe(422)

    expect((await call('PUT', url, { as: ADMIN, body: edit })).status).toBe(404)
    expect((await call('PUT', '/api/guru/questions/987654321', { body: edit })).status).toBe(404)
    expect(
      (await call('PUT', `/api/guru/questions/${String(anchorId)}`, { as: ADMIN, body: edit }))
        .status,
    ).toBe(404)
  })

  it('#56 deletes an own question, never another one, and keeps the M14 count', async () => {
    const before = count()
    const url = `/api/guru/questions/${String(firstQuestionId)}`
    expect((await call('DELETE', url, { as: ADMIN })).status).toBe(404)
    const a = await call<Data<{ removed: number }>>('DELETE', url)
    expect(a.status).toBe(200)
    expect(a.body.data).toEqual({ removed: 1 })
    expect(questions.get(firstQuestionId)).toBeNull()
    expect((await call('DELETE', url)).status).toBe(404)
    expect(
      (await call('DELETE', `/api/guru/questions/${String(anchorId)}`, { as: ADMIN })).status,
    ).toBe(404)
    expect(count()).toBe(before)
  })
})

// ---------------------------------------------------------------------------------------------
describe('#57–#58 CSV template and import (S21; BR-M10-24, DV-M10-08)', () => {
  const header =
    'question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level,marks,explanation'

  /** A multipart post of `text` as `name`. */
  const upload = (text: string, name = 'soalan.csv') => {
    const form = new FormData()
    form.append('csvFile', new File([text], name, { type: 'text/csv' }))
    return call<Data<{ imported: number; failed: { row: number; message: string }[] }>>(
      'POST',
      '/api/guru/questions/import',
      { body: form },
    )
  }

  it('#57 serves the M04 import template as a CSV file', async () => {
    const a = await call('GET', '/api/guru/questions/template')
    expect(a.status).toBe(200)
    expect(a.res.headers['content-type']).toContain('text/csv')
    expect(a.res.headers['content-disposition']).toContain('template-import-soalan.csv')
    const text = await (a.body as Blob).text()
    expect(text).toBe(IMPORT_TEMPLATE_CSV)
    expect(TEMPLATE_CSV).toBe(IMPORT_TEMPLATE_CSV)
    expect(text.split('\r\n')[0]).toBe(header)
    // one store, one format: the same file as M04 #11
    const m04 = await call('GET', '/api/question-imports/template', { as: ADMIN })
    expect(m04.status).toBe(200)
    expect(await (m04.body as Blob).text()).toBe(text)
  })

  it('#58 plan: M04 rules without defaults, plus the M10 caps', () => {
    // The shared parser and the template are M04's (thin check that the wrapper keeps them).
    const planned = planImport(TEMPLATE_CSV)
    expect(planned.rows).toHaveLength(2)
    expect(planned.failures).toEqual([])
    expect(planned.dataRows).toBe(2)
    // No defaults: the S21 form has none, so a missing subject / level / difficulty fails the row.
    const row = (cells: string) => planImport(header + '\n' + cells).failures[0]?.message
    expect(row('"Soalan",A,B,C,D,A,,4,1,1,')).toBe('Subjek tidak sah.')
    expect(row('"Soalan",A,B,C,D,A,1,,1,1,')).toBe('Tahap pendidikan tidak sah.')
    expect(row('"Soalan",A,B,C,D,A,1,4,,1,')).toBe('Tahap kesukaran mesti 1 hingga 5.')
    // M10 caps (SRS §5): question 2000, option 500; failures stay in line order.
    const long = 'x'.repeat(2001)
    expect(row('"' + long + '",A,B,C,D,A,1,4,1,1,')).toBe(
      'Soalan tidak boleh melebihi 2000 aksara.',
    )
    expect(row('"Soalan",' + 'o'.repeat(501) + ',B,C,D,A,1,4,1,1,')).toBe(
      'Pilihan jawapan tidak boleh melebihi 500 aksara.',
    )
    const mixed = planImport(
      [
        header,
        '"' + long + '",A,B,C,D,A,1,4,1,1,',
        ',A,B,C,D,A,1,4,1,1,',
        '"ok",A,B,C,D,A,1,4,1,1,',
      ].join('\n'),
    )
    expect(mixed.rows).toHaveLength(1)
    expect(mixed.failures.map((f) => f.row)).toEqual([2, 3])
    const edge = planImport(header + '\n"' + 'x'.repeat(2000) + '",A,B,C,D,A,1,4,1,1,')
    expect(edge.rows).toHaveLength(1)
  })

  it('#58 keeps the valid rows, reports the bad ones by line and runs the hook per row', async () => {
    const before = teacherWallet.summary(GURU).questionsCount
    const total = (
      await call<Data<{ stats: Record<string, number> }>>('GET', '/api/guru/dashboard')
    ).body.data.stats.questions as number
    const csv = [
      header,
      '"Apakah ibu negara Malaysia?",Kuala Lumpur,Putrajaya,Johor Bahru,Ipoh,A,1,4,1,1,"Kuala Lumpur."',
      '"2 + 3 = ?",4,5,6,7,B,3,1,2,1,',
      ',A,B,C,D,A,1,4,1,1,',
      '"Soalan jawapan salah",A,B,C,D,E,1,4,1,1,',
      '"Soalan subjek salah",A,B,C,D,A,9999,4,1,1,',
      '"Soalan tahap salah",A,B,C,D,A,1,9999,1,1,',
      '"Soalan kesukaran salah",A,B,C,D,A,1,4,9,1,',
      '"Soalan markah salah",A,B,C,D,A,1,4,1,0,',
      '"Pilihan kosong",A,B,,,C,1,4,1,1,',
      '"Soalan berbaris',
      'baru",A,B,,,B,1,4,3,2,penjelasan',
      '',
    ].join('\n')
    const a = await upload(csv)
    expect(a.status, JSON.stringify(a.body)).toBe(200)
    expect(a.body.data.imported).toBe(3)
    expect(a.body.data.failed.map((f) => f.row)).toEqual([4, 5, 6, 7, 8, 9, 10])
    expect(a.body.data.failed[0]?.message).toBe('Baris tidak lengkap.')
    expect(a.body.data.failed[1]?.message).toBe('Jawapan betul mesti A, B, C atau D.')
    expect(teacherWallet.summary(GURU).questionsCount).toBe(before + 3)
    const dash = await call<Data<{ stats: Record<string, number> }>>('GET', '/api/guru/dashboard')
    expect(dash.body.data.stats.questions).toBe(total + 3)
    const mine = await call<{
      data: {
        questionText: string
        status: string
        isActive: boolean
        explanation: string | null
        difficultyLevel: number
        subjectId: number
      }[]
      meta: { totalItems: number }
    }>('GET', '/api/guru/questions')
    const added = mine.body.data.filter((q) => q.status === 'pending_review').slice(-3)
    expect(added.map((q) => q.questionText)).toEqual([
      'Apakah ibu negara Malaysia?',
      '2 + 3 = ?',
      'Soalan berbaris\nbaru',
    ])
    expect(added.every((q) => q.isActive)).toBe(true)
    expect(added[2]).toMatchObject({ explanation: 'penjelasan', difficultyLevel: 3, subjectId: 1 })
  })

  it('#58 refuses a missing or wrong file, a missing column or an empty file with 422', async () => {
    const none = await call('POST', '/api/guru/questions/import', { body: new FormData() })
    expect(none.status).toBe(422)
    expect(Object.keys(fieldsOf(none))).toEqual(['csvFile'])
    expect((await upload('a,b', 'soalan.xlsx')).status).toBe(422)
    expect((await upload('question_text,option_a\n"x",y')).status).toBe(422)
    const noData = await upload(`${header}\n`)
    expect(noData.status).toBe(422)
    expect(Object.keys(fieldsOf(noData))).toEqual(['csvFile'])
    expect((await upload('', 'kosong.txt')).status).toBe(422)
    const big = await upload(`${header}\n${'x'.repeat(5 * 1024 * 1024 + 1)}`)
    expect(big.status).toBe(422)
    const text = await call('POST', '/api/guru/questions/import', {
      body: { csvFile: `${header}\n"Soalan teks",A,B,C,D,A,1,4,1,1,` },
    })
    expect(text.status).toBe(200)
    expect((text.body as Data<{ imported: number }>).data.imported).toBe(1)
  })
})

// ---------------------------------------------------------------------------------------------
describe('#73–#75 student classes and sets (S33, S34; BR-M10-02, BR-M10-18)', () => {
  type Joined = {
    id: number
    name: string
    subjectName: string | null
    teacherName: string | null
    levelLabel: string
  }

  it('#73 lists nothing for a student with no class', async () => {
    const a = await call<{ data: Joined[]; meta: { totalItems: number } }>(
      'GET',
      '/api/kelas-saya',
      {
        as: PELAJAR,
      },
    )
    expect(a.status).toBe(200)
    expect(a.body.data).toEqual([])
    expect(a.body.meta.totalItems).toBe(0)
    const members = await call<{ data: Joined[] }>('GET', '/api/kelas-saya', { as: 3001 })
    expect(members.body.data.map((c) => c.id).sort()).toEqual([2001, 2002])
    expect(members.body.data[0]).toMatchObject({
      subjectName: expect.any(String) as string,
      teacherName: 'Guru Demo',
      levelLabel: 'Ting. 5',
    })
  })

  it('#74 joins by code (trimmed, any case, any stored length); refusals 422 / 404 / 409', async () => {
    const blank = await call('POST', '/api/kelas-saya/join', {
      as: PELAJAR,
      body: { classCode: '  ' },
    })
    expect(blank.status).toBe(422)
    expect(Object.keys(fieldsOf(blank))).toEqual(['classCode'])
    expect((await call('POST', '/api/kelas-saya/join', { as: PELAJAR, body: {} })).status).toBe(422)
    const unknown = await call<ErrorBody>('POST', '/api/kelas-saya/join', {
      as: PELAJAR,
      body: { classCode: 'ZZZ999' },
    })
    expect(unknown.status).toBe(404)
    expect(unknown.body.error.code).toBe('NOT_FOUND')

    const joined = await call<{ data: { classroomId: number }; message: string }>(
      'POST',
      '/api/kelas-saya/join',
      { as: PELAJAR, body: { classCode: ` ${newClassCode.toLowerCase()} ` } },
    )
    expect(joined.status).toBe(201)
    expect(joined.body.data).toEqual({ classroomId: newClassId })
    expect(joined.body.message).toContain('5 Kimia Cemerlang')
    expect(classrooms.memberIds('classroom', newClassId)).toEqual([PELAJAR])
    expect(classrooms.enrolmentsOf(PELAJAR).find((e) => e.classroomId === newClassId)?.source).toBe(
      'code',
    )
    const again = await call('POST', '/api/kelas-saya/join', {
      as: PELAJAR,
      body: { classCode: newClassCode },
    })
    expect(again.status).toBe(409)

    // the observed 7-character code "DEMO-4S" of class 516 (longer than the S33 maxlength)
    const demo = await call<{ data: { classroomId: number } }>('POST', '/api/kelas-saya/join', {
      as: 3,
      body: { classCode: 'demo-4s' },
    })
    expect(demo.status).toBe(201)
    expect(demo.body.data.classroomId).toBe(516)

    const list = await call<{ data: Joined[] }>('GET', '/api/kelas-saya', { as: PELAJAR })
    expect(list.body.data).toEqual([
      {
        id: newClassId,
        name: '5 Kimia Cemerlang',
        subjectName: 'Kimia',
        teacherName: 'Guru Demo',
        levelLabel: 'Ting. 5',
      },
    ])
    // the admin has the screen too
    expect((await call('GET', '/api/kelas-saya', { as: ADMIN })).status).toBe(200)
  })

  it('#75 lists the visible sets with the attempts left; draft and other classes stay hidden', async () => {
    expect(
      (await call<{ data: unknown[] }>('GET', '/api/set-soalan-saya', { as: PELAJAR })).body.data,
    ).toEqual([])
    const a = await call<{
      data: {
        id: number
        title: string
        teacherName: string | null
        questionCount: number
        timeLimitMinutes: number | null
        attemptsLeft: number | null
      }[]
    }>('GET', '/api/set-soalan-saya', { as: 3001 })
    expect(a.status).toBe(200)
    // 7401 is a draft (class 2001): only 7402 of class 2002 is visible
    expect(a.body.data).toEqual([
      {
        id: 7402,
        title: 'Sejarah Bab 1 - Set 1',
        teacherName: 'Guru Demo',
        questionCount: 10,
        timeLimitMinutes: null,
        attemptsLeft: 1,
      },
    ])
  })

  it('#75 counts the completed attempts of M05 against maxAttempts', async () => {
    const token = setUser(3001).token
    const send = (method: 'POST', url: string, body: unknown) =>
      runtime.transport.request({
        method,
        url,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body,
      })
    const start = await send('POST', '/api/practice/sessions', {
      mode: 'question_set',
      questionSetId: 7402,
    })
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    const data = (start.body as { data: { sessionId: string; questions: { id: number }[] } }).data
    for (const q of data.questions) {
      await send('POST', `/api/practice/sessions/${data.sessionId}/check-answer`, {
        questionId: q.id,
        selectedOptionId: questions.get(q.id)?.correctAnswer ?? 0,
      })
    }
    const submit = await send('POST', `/api/practice/sessions/${data.sessionId}/submit`, {
      answers: [],
      timeSpent: 60,
    })
    expect(submit.status).toBe(200)
    expect(
      practice.history(3001, { modes: ['question_set'] }).filter((s) => s.questionSetId === 7402),
    ).toHaveLength(1)
    const a = await call<{ data: { id: number; attemptsLeft: number | null }[] }>(
      'GET',
      '/api/set-soalan-saya',
      { as: 3001 },
    )
    expect(a.body.data.find((s) => s.id === 7402)?.attemptsLeft).toBe(0)
    // another member of the class still has the attempt
    const other = await call<{ data: { id: number; attemptsLeft: number | null }[] }>(
      'GET',
      '/api/set-soalan-saya',
      { as: 3002 },
    )
    expect(other.body.data.find((s) => s.id === 7402)?.attemptsLeft).toBe(1)
  })
})

describe('M08 teacher cards (F-30 invariants) through the handlers', () => {
  it('teacher 1699 owns classes 653 + 69 and teaches 76 distinct pupils; 4186 teaches 89', async () => {
    for (const [id, classes, pupils] of [
      [1699, [69, 653], 76],
      [4186, [28, 507, 977], 89],
    ] as const) {
      const list = await call<{ data: { id: number }[] }>('GET', '/api/guru/classes', { as: id })
      expect(list.body.data.map((c) => c.id).sort((a, b) => a - b)).toEqual([...classes])
      const dash = await call<Data<{ stats: Record<string, number> }>>(
        'GET',
        '/api/guru/dashboard',
        {
          as: id,
        },
      )
      expect(dash.body.data.stats.students).toBe(pupils)
      const mine = await call<{ data: unknown[]; meta: { count: number } }>(
        'GET',
        '/api/guru/students',
        { as: id },
      )
      expect(mine.body.data).toHaveLength(pupils)
      expect(mine.body.meta.count).toBe(pupils)
    }
  })

  it('declares the three admin display constants of DATA-M10-11', () => {
    expect(M10_DISPLAY_CONSTANTS.map((c) => [c.name, c.value])).toEqual([
      ['adminDashboardQuestions', 20719],
      ['adminDashboardQuestionsApproved', 19361],
      ['adminCommandCenterGps', 4.69],
    ])
    expect(listDisplayConstants().filter((c) => c.module === 'M10')).toHaveLength(3)
  })
})

/** A minimal well-formedness check: declaration, balanced and correctly nested tags. */
function wellFormed(xml: string): boolean {
  const stack: string[] = []
  const body = xml.replace(/<\?[\s\S]*?\?>/g, '')
  for (const m of body.matchAll(/<(\/?)([\w:.-]+)[^>]*?(\/?)>/g)) {
    if (m[3] === '/') continue
    if (m[1] === '/') {
      if (stack.pop() !== m[2]) return false
    } else stack.push(m[2] as string)
  }
  return stack.length === 0 && !/<[^>]*$/.test(xml)
}

describe('#59, #60, #63 gallery, question papers, Audio KBAT templates (S21, S22)', () => {
  const pdf = (name = 'kertas.pdf', size = 10) =>
    new File([new Uint8Array(size)], name, { type: 'application/pdf' })
  const paper = (fields: Record<string, string>, files: File[] = [pdf()]) => {
    const form = new FormData()
    for (const [k, v] of Object.entries(fields)) form.append(k, v)
    for (const f of files) form.append('files[]', f)
    return call<Data<Record<string, unknown>>>('POST', '/api/guru/question-papers', { body: form })
  }
  const valid = { jenisSoalan: 'Kertas Percubaan', subject: 'SEJARAH SPM' }

  it('guards: 401 to a guest, 403 to a pupil', async () => {
    for (const [method, url] of [
      ['GET', '/api/guru/galeri-rajah'],
      ['POST', '/api/guru/question-papers'],
      ['GET', '/api/guru/audio-kbat/template'],
      ['GET', '/api/guru/audio-kbat/template-word'],
    ] as const) {
      expect((await call(method, url, { as: null })).status, url).toBe(401)
      expect((await call(method, url, { as: PELAJAR })).status, url).toBe(403)
    }
  })

  it('#59 the gallery is always empty', async () => {
    expect((await call('GET', '/api/guru/galeri-rajah')).body).toEqual({ folders: [] })
    expect((await call('GET', '/api/guru/galeri-rajah?folder=Kimia')).body).toEqual({ images: [] })
  })

  it('#60 refuses a bad paper with a field for each problem', async () => {
    const empty = await call('POST', '/api/guru/question-papers', { body: new FormData() })
    expect(empty.status).toBe(422)
    expect(Object.keys(fieldsOf(empty)).sort()).toEqual(['files', 'jenisSoalan', 'subject'])
    const cases: [Record<string, string>, File[], string][] = [
      [{ ...valid, jenisSoalan: 'Lain' }, [pdf()], 'jenisSoalan'],
      [{ ...valid, subject: 'x'.repeat(101) }, [pdf()], 'subject'],
      [{ ...valid, tingkatan: '6' }, [pdf()], 'tingkatan'],
      [{ ...valid, tahun: '1999' }, [pdf()], 'tahun'],
      [{ ...valid, tahun: '2100' }, [pdf()], 'tahun'],
      [{ ...valid, disediakanOleh: 'x'.repeat(151) }, [pdf()], 'disediakanOleh'],
      [{ ...valid, catatan: 'x'.repeat(1001) }, [pdf()], 'catatan'],
      [valid, [], 'files'],
      [valid, Array.from({ length: 6 }, () => pdf()), 'files'],
      [valid, [pdf('gambar.png')], 'files'],
      [valid, [pdf('besar.pdf', 20 * 1024 * 1024 + 1)], 'files'],
    ]
    for (const [fields, files, field] of cases) {
      const a = await paper(fields, files)
      expect(a.status, field).toBe(422)
      expect(Object.keys(fieldsOf(a)), field).toContain(field)
    }
  })

  it('#60 stores an M04 submission as pending with the level code and the files', async () => {
    const a = await paper(
      {
        ...valid,
        tingkatan: '4',
        tahun: '2024',
        disediakanOleh: 'Guru Demo',
        catatan: 'Dengan skema',
      },
      [pdf('kertas.pdf', 1000), pdf('skema.docx', 500), pdf('data.xlsx', 5)],
    )
    expect(a.status).toBe(201)
    expect(a.body.data).toMatchObject({
      teacherId: GURU,
      subjectText: 'SEJARAH SPM',
      levelCode: 'T4',
      year: 2024,
      paperType: 'Kertas Percubaan',
      authorCredit: 'Guru Demo',
      note: 'Dengan skema',
      status: 'pending',
    })
    expect((a.body.data.files as { name: string }[]).map((f) => f.name)).toEqual([
      'kertas.pdf',
      'skema.docx',
      'data.xlsx',
    ])
    const m04 = await call<{ data: { id: number; status: string }[] }>(
      'GET',
      '/api/question-submissions',
      { as: ADMIN },
    )
    expect(m04.body.data.map((s) => s.id)).toContain(a.body.data.id as number)
  })

  it('#60 an empty level, year and note are optional (the year falls back to the clock)', async () => {
    const a = await paper({ ...valid, tingkatan: '', tahun: '' })
    expect(a.status).toBe(201)
    expect(a.body.data).toMatchObject({
      levelCode: null,
      year: new Date(runtime.clock.now()).getUTCFullYear(),
      authorCredit: '',
      note: null,
    })
  })

  it('#63 /template is the server CSV (BOM, four columns, one example row)', async () => {
    const a = await call('GET', '/api/guru/audio-kbat/template')
    expect(a.status).toBe(200)
    expect(a.res.headers['content-disposition']).toContain('template-audio-kbat.csv')
    expect(a.res.headers['content-type']).toContain('text/csv')
    const bytes = new Uint8Array(await (a.body as Blob).arrayBuffer())
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe(
      '﻿tajuk,kod_subjek,kod_tingkatan,nama_fail_audio\n"Contoh: KBAT Sains Bab 1",SCI,T4,kbat-sains-1.mp3\n',
    )
  })

  it('#63 /template-word is a valid .docx with the four-column table', async () => {
    const a = await call('GET', '/api/guru/audio-kbat/template-word')
    expect(a.status).toBe(200)
    expect(a.res.headers['content-disposition']).toContain('template-audio-kbat.docx')
    expect(a.res.headers['content-type']).toContain('wordprocessingml.document')
    const bytes = new Uint8Array(await (a.body as Blob).arrayBuffer())
    const dv = new DataView(bytes.buffer)
    // end of central directory: 3 entries
    expect(dv.getUint32(bytes.length - 22, true)).toBe(0x06054b50)
    expect(dv.getUint16(bytes.length - 12, true)).toBe(3)
    const cdOffset = dv.getUint32(bytes.length - 6, true)
    const dec = new TextDecoder()
    const parts = new Map<string, string>()
    let at = cdOffset
    for (let i = 0; i < 3; i++) {
      expect(dv.getUint32(at, true)).toBe(0x02014b50)
      const crc = dv.getUint32(at + 16, true)
      const size = dv.getUint32(at + 24, true)
      const nameLen = dv.getUint16(at + 28, true)
      const local = dv.getUint32(at + 42, true)
      const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen))
      expect(dv.getUint32(local, true)).toBe(0x04034b50)
      const start = local + 30 + dv.getUint16(local + 26, true)
      const data = bytes.subarray(start, start + size)
      expect(crc32(data), name).toBe(crc)
      parts.set(name, dec.decode(data))
      at += 46 + nameLen
    }
    expect([...parts.keys()]).toEqual(['[Content_Types].xml', '_rels/.rels', 'word/document.xml'])
    for (const [name, xml] of parts) {
      expect(wellFormed(xml), name).toBe(true)
    }
    const xml = parts.get('word/document.xml') ?? ''
    const rows = [...xml.matchAll(/<w:tr>([\s\S]*?)<\/w:tr>/g)].map((tr) =>
      [...(tr[1] ?? '').matchAll(/<w:t [^>]*>([^<]*)<\/w:t>/g)].map((x) => x[1]),
    )
    expect(rows).toEqual([
      ['Tajuk', 'Kod Subjek', 'Kod Tingkatan', 'Nama Fail Audio'],
      ['KBAT Sains Bab 1', 'SCI', 'T4', 'kbat-sains-1.mp3'],
    ])
  })
})

describe('#53 / #55 multipart images', () => {
  const base = {
    educationLevelId: '11',
    subjectId: '10',
    questionType: 'mcq',
    difficultyLevel: 'easy',
    questionText: 'Apakah unsur dengan simbol Na?',
    correctAnswer: '1',
  }
  const png = (name: string) => new File(['p'], name, { type: 'image/png' })

  it('#53 stores option images by index and refuses a bad one', async () => {
    const form = new FormData()
    for (const [k, v] of Object.entries(base)) form.append(k, v)
    for (const o of ['Kalium', 'Natrium', 'Litium', 'Kalsium']) form.append('options[]', o)
    form.append('optionImages[1]', png('b.png'))
    form.append('optionImages[3]', png('d.png'))
    const a = await call<Data<{ optionImages: (string | null)[] }>>('POST', '/api/guru/questions', {
      body: form,
    })
    expect(a.status, JSON.stringify(a.body)).toBe(201)
    expect(a.body.data.optionImages).toEqual([
      null,
      'blob:mock/option/b.png',
      null,
      'blob:mock/option/d.png',
    ])
    const bad = new FormData()
    for (const [k, v] of Object.entries(base)) bad.append(k, v)
    for (const o of ['A', 'B', 'C', 'D']) bad.append('options[]', o)
    bad.append('optionImages[2]', new File(['x'], 'c.gif', { type: 'image/gif' }))
    const b = await call('POST', '/api/guru/questions', { body: bad })
    expect(b.status).toBe(422)
    expect(Object.keys(fieldsOf(b))).toContain('optionImages.2')
  })

  it('#55 accepts one multipart PUT with an image', async () => {
    const made = await call<Data<{ id: number }>>('POST', '/api/guru/questions', {
      body: {
        ...base,
        educationLevelId: 11,
        subjectId: 10,
        correctAnswer: 0,
        options: ['A', 'B', 'C', 'D'],
      },
    })
    const form = new FormData()
    form.append('questionText', 'Soalan yang disunting dengan rajah.')
    form.append('difficultyLevel', 'hard')
    for (let i = 0; i < 4; i++) {
      form.append(`options[${String(i)}][id]`, String(i))
      form.append(`options[${String(i)}][optionText]`, `Pilihan ${String(i)}`)
    }
    form.append('correctOptionId', '2')
    form.append('questionImage', png('rajah.png'))
    const a = await call<Data<Record<string, unknown>>>(
      'PUT',
      `/api/guru/questions/${String(made.body.data.id)}`,
      { body: form },
    )
    expect(a.status, JSON.stringify(a.body)).toBe(200)
    expect(a.body.data).toMatchObject({
      questionText: 'Soalan yang disunting dengan rajah.',
      difficultyLevel: 4,
      options: ['Pilihan 0', 'Pilihan 1', 'Pilihan 2', 'Pilihan 3'],
      correctAnswer: 2,
      questionImage: 'blob:mock/question/rajah.png',
    })
  })
})

describe('seeds and hooks (SRS §6.11, §6.12)', () => {
  it('seeds the admin profile 3 and the teacher profile 4 only', () => {
    expect(teacherProfiles.forUser(ADMIN)).toMatchObject({
      id: 3,
      schoolId: null,
      experienceYears: 0,
    })
    expect(teacherProfiles.forUser(GURU)).toMatchObject({
      id: 4,
      schoolId: 900001,
      bio: 'Guru Kimia dan Bahasa Melayu.',
      subject: 'Kimia, Bahasa Melayu',
      qualification: 'Ijazah Sarjana Muda Pendidikan',
      experienceYears: 8,
    })
    expect(teacherProfiles.forUser(PELAJAR)).toBeUndefined()
    expect(teacherProfiles.schoolOf(4402)).toBeNull()
  })

  it('the enrol hook joins by code and refuses a typo', () => {
    const code = classrooms.get('classroom', 2001)?.joinCode ?? ''
    expect(code).not.toBe('')
    expect(m10Hooks.enrol(4, code)).toEqual({ classroomId: 2001 })
    expect(classrooms.memberIds('classroom', 2001)).toContain(4)
    expect(() => m10Hooks.enrol(4, code)).toThrow(RangeError)
    expect(() => m10Hooks.enrol(4, 'NOPE00')).toThrow(RangeError)
    expect(() => m10Hooks.enrol(99999999, code)).toThrow(RangeError)
    expect(() => m10Hooks.enrol(4, '')).toThrow(TypeError)
  })
})
