import {
  CIKGU_VALIDATION_MESSAGES as M,
  CikguRphListItemSchema,
  CikguRphSchema,
  ErrorBodySchema,
  ListMetaSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { activityMinutes, rphContent } from '../../src/modules/cikgu/rules'
import { ADMIN, STUDENT_1, TEACHER_A, TEACHER_B, bootCikguApp, client, idOfEmail, type CikguTestApp, type Client } from './helpers'

describe('RPH routes: POST/GET /cikgu/rph, GET /cikgu/rph/:id', () => {
  let t: CikguTestApp
  let teacher: Client
  let teacherB: Client
  let admin: Client
  let aId: string
  let bId: string

  beforeAll(async () => {
    t = await bootCikguApp()
    teacher = await client(t, TEACHER_A)
    teacherB = await client(t, TEACHER_B)
    admin = await client(t, ADMIN)
    aId = await idOfEmail(t, TEACHER_A)
    bId = await idOfEmail(t, TEACHER_B)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const valid = { subjectName: 'Matematik', level: 'T4', tajuk: 'Fungsi Kuadratik' }
  const fieldsOf = (res: { status: number; body: unknown }): Record<string, string> => {
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    const parsed = ErrorBodySchema.parse(res.body)
    expect(parsed.error.code).toBe('VALIDATION_ERROR')
    return parsed.error.fields ?? {}
  }

  it('AC8: creates an RPH: 201 {data}, status generated, source form, thread null, canned content for 60 minutes (6/15/15/15/9), defaults', async () => {
    const res = await teacher.post('/cikgu/rph', valid)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.headers['cache-control']).toBe('no-store')
    const rph = CikguRphSchema.parse(res.body.data)
    expect(rph).toMatchObject({
      userId: aId,
      subjectName: 'Matematik',
      level: 'T4',
      tajuk: 'Fungsi Kuadratik',
      className: null,
      lessonDate: '2026-10-19',
      durationMinutes: 60,
      timeSlot: null,
      tema: null,
      pengajaranKeperluan: null,
      status: 'generated',
      source: 'form',
      threadId: null,
      createdAt: '2026-10-19T09:00:00.000+08:00',
    })
    expect(rph.content.split('\n')).toEqual([
      'Matematik · Tingkatan 4',
      'Tarikh: 19/10/2026',
      'Tempoh: 60 minit',
      'Tajuk: Fungsi Kuadratik',
      '',
      'Standard Kandungan: rujuk DSKP Matematik Tingkatan 4 — Fungsi Kuadratik',
      'Standard Pembelajaran: rujuk DSKP Matematik Tingkatan 4 — Fungsi Kuadratik',
      '',
      'Objektif Pembelajaran',
      '1. Menyatakan konsep utama Fungsi Kuadratik dengan betul.',
      '2. Menerangkan Fungsi Kuadratik dengan contoh yang sesuai.',
      '3. Menyelesaikan sekurang-kurangnya 3 daripada 4 soalan berkaitan Fungsi Kuadratik.',
      '',
      'Aktiviti PdPc',
      'Set Induksi (6 minit)',
      'Aktiviti 1 (15 minit)',
      'Aktiviti 2 (15 minit)',
      'Aktiviti 3 (15 minit)',
      'Penutup (9 minit)',
      '',
      'BBM: buku teks, lembaran kerja, slaid ringkas',
      'EMK: kreativiti dan inovasi',
      'PBD Assessment plan: pemerhatian semasa Aktiviti 2 dan lembaran kerja (TP1–TP6)',
    ])
    // The stored row equals the response.
    const detail = await teacher.get(`/cikgu/rph/${rph.id}`)
    expect(CikguRphSchema.parse(detail.body.data)).toEqual(rph)
  })

  it('AC8: all optional fields and another duration (90 minutes: 9/22/22/23/14); text is trimmed; "Keperluan Khas" is last', async () => {
    const res = await teacher.post('/cikgu/rph', {
      subjectName: ' Kimia ',
      level: 'T5',
      tajuk: ' Elektrolisis ',
      className: ' 5 BESTARI ',
      lessonDate: ' 2026-10-25 ',
      durationMinutes: 90,
      timeSlot: '10.00-11.30',
      tema: 'Elektrokimia',
      pengajaranKeperluan: 'Projektor',
    })
    expect(res.status).toBe(201)
    const rph = CikguRphSchema.parse(res.body.data)
    expect(rph).toMatchObject({ subjectName: 'Kimia', tajuk: 'Elektrolisis', className: '5 BESTARI', lessonDate: '2026-10-25', durationMinutes: 90, timeSlot: '10.00-11.30', tema: 'Elektrokimia', pengajaranKeperluan: 'Projektor' })
    expect(activityMinutes(90)).toEqual([9, 22, 22, 23, 14])
    const lines = rph.content.split('\n')
    expect(lines.slice(0, 7)).toEqual(['Kimia · Tingkatan 5', 'Kelas: 5 BESTARI', 'Tarikh: 25/10/2026', 'Masa: 10.00-11.30', 'Tempoh: 90 minit', 'Tajuk: Elektrolisis', 'Tema: Elektrokimia'])
    const start = lines.indexOf('Set Induksi (9 minit)')
    expect(lines.slice(start, start + 5)).toEqual(['Set Induksi (9 minit)', 'Aktiviti 1 (22 minit)', 'Aktiviti 2 (22 minit)', 'Aktiviti 3 (23 minit)', 'Penutup (14 minit)'])
    expect(lines.at(-1)).toBe('Keperluan Khas: Projektor')
    expect(rph.content).toBe(
      rphContent({ subjectName: 'Kimia', level: 'T5', tajuk: 'Elektrolisis', className: '5 BESTARI', dateLabel: '25/10/2026', durationMinutes: 90, timeSlot: '10.00-11.30', tema: 'Elektrokimia', pengajaranKeperluan: 'Projektor' }),
    )
  })

  it('AC8: blank optional text becomes null; a non-string optional is null; unknown keys are ignored; durationMinutes null = 60', async () => {
    const res = await teacher.post('/cikgu/rph', { ...valid, className: '   ', timeSlot: '', tema: 5, pengajaranKeperluan: null, durationMinutes: null, lessonDate: '', extra: 'x' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data).toMatchObject({ className: null, timeSlot: null, tema: null, pengajaranKeperluan: null, durationMinutes: 60, lessonDate: '2026-10-19' })
    expect(res.body.data.extra).toBeUndefined()
  })

  it.each<[string, Record<string, unknown>, string, string]>([
    ['subjectName missing', { level: 'T4', tajuk: 'x' }, 'subjectName', M.required],
    ['subjectName blank', { subjectName: '  ', level: 'T4', tajuk: 'x' }, 'subjectName', M.required],
    ['subjectName not a string', { subjectName: 5, level: 'T4', tajuk: 'x' }, 'subjectName', M.required],
    ['subjectName 101 chars', { subjectName: 'a'.repeat(101), level: 'T4', tajuk: 'x' }, 'subjectName', M.tooLong(100)],
    ['subjectName 101 code points (emoji)', { subjectName: '🎤'.repeat(101), level: 'T4', tajuk: 'x' }, 'subjectName', M.tooLong(100)],
    ['level missing', { subjectName: 'Kimia', tajuk: 'x' }, 'level', M.required],
    ['level T6', { subjectName: 'Kimia', level: 'T6', tajuk: 'x' }, 'level', M.invalid],
    ['level D0', { subjectName: 'Kimia', level: 'D0', tajuk: 'x' }, 'level', M.invalid],
    ['level lower case', { subjectName: 'Kimia', level: 't4', tajuk: 'x' }, 'level', M.invalid],
    ['tajuk blank', { subjectName: 'Kimia', level: 'T4', tajuk: '  ' }, 'tajuk', M.required],
    ['tajuk 201 chars', { subjectName: 'Kimia', level: 'T4', tajuk: 'a'.repeat(201) }, 'tajuk', M.tooLong(200)],
    ['duration 14', { ...valid, durationMinutes: 14 }, 'durationMinutes', M.duration],
    ['duration 241', { ...valid, durationMinutes: 241 }, 'durationMinutes', M.duration],
    ['duration 60.5', { ...valid, durationMinutes: 60.5 }, 'durationMinutes', M.duration],
    ['duration "60" (string)', { ...valid, durationMinutes: '60' }, 'durationMinutes', M.duration],
    ['date 2026-02-30', { ...valid, lessonDate: '2026-02-30' }, 'lessonDate', M.date],
    ['date 25/10/2026', { ...valid, lessonDate: '25/10/2026' }, 'lessonDate', M.date],
    ['date 2026-1-5', { ...valid, lessonDate: '2026-1-5' }, 'lessonDate', M.date],
    ['pengajaranKeperluan 501', { ...valid, pengajaranKeperluan: 'a'.repeat(501) }, 'pengajaranKeperluan', M.tooLong(500)],
    ['className 101', { ...valid, className: 'a'.repeat(101) }, 'className', M.tooLong(100)],
    ['timeSlot 101', { ...valid, timeSlot: 'a'.repeat(101) }, 'timeSlot', M.tooLong(100)],
    ['tema 101', { ...valid, tema: 'a'.repeat(101) }, 'tema', M.tooLong(100)],
  ])('AC8: %s is 422 with the exact BM message on that field', async (_name, body, field, message) => {
    const before = (await t.db.query<{ n: number }>(`select count(*)::int n from rph_plans`))[0]?.n
    const res = await teacher.post('/cikgu/rph', body)
    expect(fieldsOf(res)[field]).toBe(message)
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from rph_plans`))[0]?.n).toBe(before)
  })

  it('AC8: limits are inclusive: 100/200/500 code points, 15 and 240 minutes, the 29th of February of a leap year', async () => {
    const res = await teacher.post('/cikgu/rph', { subjectName: '🎤'.repeat(100), level: 'D1', tajuk: 'a'.repeat(200), pengajaranKeperluan: 'b'.repeat(500), className: 'c'.repeat(100), durationMinutes: 15, lessonDate: '2028-02-29' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect((await teacher.post('/cikgu/rph', { ...valid, durationMinutes: 240 })).status).toBe(201)
  })

  it('AC8: several errors at once, in the fixed field order, and the top-level message is the first one plus "(and N more errors)"', async () => {
    const res = await teacher.post('/cikgu/rph', { level: 'X9', durationMinutes: 5, lessonDate: 'nope', tema: 'a'.repeat(101), className: 'a'.repeat(101) })
    const fields = fieldsOf(res)
    expect(Object.keys(fields)).toEqual(['subjectName', 'level', 'tajuk', 'durationMinutes', 'lessonDate', 'className', 'tema'])
    expect(fields).toEqual({
      subjectName: M.required,
      level: M.invalid,
      tajuk: M.required,
      durationMinutes: M.duration,
      lessonDate: M.date,
      className: M.tooLong(100),
      tema: M.tooLong(100),
    })
    expect(res.body.error.message).toBe(`${M.required} (and 6 more errors)`)
    const two = await teacher.post('/cikgu/rph', { subjectName: 'Kimia', level: 'T4', durationMinutes: 5 })
    expect(two.body.error.message).toBe(`${M.required} (and 1 more error)`)
    const one = await teacher.post('/cikgu/rph', { subjectName: 'Kimia', level: 'T4', tajuk: 'x', durationMinutes: 5 })
    expect(one.body.error.message).toBe(M.duration)
    // A body that is not an object is the same as an empty one.
    for (const body of [null, []]) {
      const r = await teacher.post('/cikgu/rph', body)
      expect(Object.keys(fieldsOf(r))).toEqual(['subjectName', 'level', 'tajuk'])
    }
  })

  it('AC2: missing CSRF on POST /cikgu/rph is 403 CSRF_INVALID', async () => {
    const res = await teacher.postNoCsrf('/cikgu/rph', valid)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('CSRF_INVALID')
  })

  it('AC9/10: the list is the caller\'s own, lesson date desc then id desc, 20 a page, a page beyond the last is empty and keeps the page; an invalid page is 1', async () => {
    // Fresh rows for teacher B: 45 plans over three dates (inserted directly), ids ascending within a date.
    for (let i = 0; i < 45; i++) {
      const date = ['2026-10-01', '2026-10-05', '2026-10-03'][i % 3]
      await t.db.query(
        `insert into rph_plans (user_id, subject_name, level, tajuk, lesson_date, source, content) values ($1, 'Sains', 'T2', $2, $3, 'form', 'x')`,
        [bId, `Bab ${String(i)}`, date],
      )
    }
    const first = await teacherB.get('/cikgu/rph')
    expect(first.status).toBe(200)
    expect(first.headers['cache-control']).toBe('no-store')
    expect(ListMetaSchema.parse(first.body.meta)).toEqual({ page: 1, pageSize: 20, totalItems: 45, totalPages: 3, from: 1, to: 20 })
    const items = first.body.data.map((x: unknown) => CikguRphListItemSchema.parse(x))
    expect(items).toHaveLength(20)
    expect(Object.keys(first.body.data[0]).sort()).toEqual(['id', 'lessonDate', 'level', 'status', 'subjectName', 'tajuk'])
    // 15 plans on 2026-10-05, newest id first, then 2026-10-03.
    expect(items.slice(0, 15).every((x: { lessonDate: string }) => x.lessonDate === '2026-10-05')).toBe(true)
    expect(items.slice(15).every((x: { lessonDate: string }) => x.lessonDate === '2026-10-03')).toBe(true)
    const ids = items.slice(0, 15).map((x: { id: string }) => BigInt(x.id))
    expect([...ids].sort((a, b) => (a < b ? 1 : -1))).toEqual(ids)
    const last = await teacherB.get('/cikgu/rph?page=3')
    expect(last.body.data).toHaveLength(5)
    expect(last.body.meta).toMatchObject({ page: 3, totalItems: 45, from: 41, to: 45 })
    const beyond = await teacherB.get('/cikgu/rph?page=9')
    expect(beyond.body.data).toEqual([])
    expect(beyond.body.meta).toMatchObject({ page: 9, totalItems: 45, totalPages: 3, from: null, to: null })
    for (const page of ['0', '-1', 'abc', '1.5', '', ' ']) {
      const r = await teacherB.get(`/cikgu/rph?page=${encodeURIComponent(page)}`)
      expect(r.status, page).toBe(200)
      expect(r.body.meta.page, page).toBe(1)
    }
    // The list of teacher A has none of B's rows, the admin has none of anybody's.
    const a = await teacher.get('/cikgu/rph')
    expect(a.body.meta.totalItems).toBeGreaterThan(0)
    expect(a.body.data.every((x: { tajuk: string }) => !x.tajuk.startsWith('Bab '))).toBe(true)
    const empty = await admin.get('/cikgu/rph')
    expect(empty.status).toBe(200)
    expect(empty.body.data).toEqual([])
    expect(empty.body.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 0, totalPages: 1, from: null, to: null })
  })

  it('AC9: the detail is the owner\'s only: a foreign, unknown, non-numeric or out-of-range id is the same 404 "Not Found."', async () => {
    const mine = await teacherB.get('/cikgu/rph')
    const id = mine.body.data[0].id as string
    const own = await teacherB.get(`/cikgu/rph/${id}`)
    expect(own.status).toBe(200)
    expect(CikguRphSchema.parse(own.body.data).id).toBe(id)
    for (const [who, path] of [
      [teacher, `/cikgu/rph/${id}`],
      [admin, `/cikgu/rph/${id}`],
      [teacherB, '/cikgu/rph/999999999'],
      [teacherB, '/cikgu/rph/abc'],
      [teacherB, '/cikgu/rph/1.5'],
      [teacherB, '/cikgu/rph/-1'],
      [teacherB, '/cikgu/rph/99999999999999999999999'],
    ] as const) {
      const r = await who.get(path)
      expect(r.status, path).toBe(404)
      expect(r.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Not Found.' })
    }
  })

  it('AC2: a student is 403 on the RPH routes', async () => {
    const student = await client(t, STUDENT_1)
    expect((await student.get('/cikgu/rph')).body.error).toMatchObject({ code: 'FORBIDDEN', message: 'This action is unauthorized.' })
    expect((await student.post('/cikgu/rph', valid)).status).toBe(403)
  })
})
