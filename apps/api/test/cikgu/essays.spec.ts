import { CikguEssayListItemSchema, CikguEssayMarkingSchema, ListMetaSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, STUDENT_1, TEACHER_A, TEACHER_B, bootCikguApp, client, idOfEmail, type CikguTestApp, type Client } from './helpers'

describe('essay markings: GET /cikgu/essays and /cikgu/essays/:id', () => {
  let t: CikguTestApp
  let teacher: Client
  let teacherB: Client
  let admin: Client
  let aId: string
  let bId: string
  let threadA: string

  beforeAll(async () => {
    t = await bootCikguApp()
    teacher = await client(t, TEACHER_A)
    teacherB = await client(t, TEACHER_B)
    admin = await client(t, ADMIN)
    aId = await idOfEmail(t, TEACHER_A)
    bId = await idOfEmail(t, TEACHER_B)
    threadA = (await t.db.query<{ id: string }>(`insert into chat_threads (user_id) values ($1) returning id::text`, [aId]))[0]?.id as string
    const threadB = (await t.db.query<{ id: string }>(`insert into chat_threads (user_id) values ($1) returning id::text`, [bId]))[0]?.id as string
    // Teacher A: 25 markings; every 5th shares its time with the previous one (ties are broken by id, newest id first).
    for (let i = 0; i < 25; i++) {
      const at = new Date(Date.UTC(2026, 9, 1, 0, Math.floor(i / 2))).toISOString()
      await t.db.query(
        `insert into essay_markings (user_id, rubric_key, subject_name, level, student_name, essay_title, essay_text, marks, max_marks, comment, thread_id, created_at)
         values ($1, 'sejarah_essay', 'Sejarah', 'T5', $2, $3, 'Teks karangan rahsia', 14, 20, 'Markah: 14/20', $4, $5)`,
        [aId, `Murid ${String(i)}`, `Tajuk ${String(i)}`, threadA, at],
      )
    }
    await t.db.query(
      `insert into essay_markings (user_id, rubric_key, essay_text, marks, max_marks, comment, thread_id) values ($1, 'general', 'Milik guru lain', 70, 100, 'x', $2)`,
      [bId, threadB],
    )
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('AC10: newest first then id descending, 20 a page, meta correct, no-store; a page beyond the last is empty and keeps the page', async () => {
    const res = await teacher.get('/cikgu/essays')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(ListMetaSchema.parse(res.body.meta)).toEqual({ page: 1, pageSize: 20, totalItems: 25, totalPages: 2, from: 1, to: 20 })
    const items = res.body.data.map((x: unknown) => CikguEssayListItemSchema.parse(x))
    expect(items).toHaveLength(20)
    expect(items[0]).toMatchObject({ studentName: 'Murid 24', essayTitle: 'Tajuk 24', rubricKey: 'sejarah_essay', subjectName: 'Sejarah', marks: 14, maxMarks: 20 })
    // Ties on the minute are ordered by id descending: 24 before 23? No, 24 and 25 do not share; 23 and 22 do (i/2 equal): id 23 before 22.
    expect(items.slice(0, 4).map((x: { studentName: string }) => x.studentName)).toEqual(['Murid 24', 'Murid 23', 'Murid 22', 'Murid 21'])
    expect(Object.keys(res.body.data[0]).sort()).toEqual(['createdAt', 'essayTitle', 'id', 'marks', 'maxMarks', 'rubricKey', 'studentName', 'subjectName'])
    const second = await teacher.get('/cikgu/essays?page=2')
    expect(second.body.data).toHaveLength(5)
    expect(second.body.meta).toMatchObject({ page: 2, from: 21, to: 25 })
    const beyond = await teacher.get('/cikgu/essays?page=7')
    expect(beyond.body.data).toEqual([])
    expect(beyond.body.meta).toMatchObject({ page: 7, totalItems: 25, totalPages: 2, from: null, to: null })
    expect((await teacher.get('/cikgu/essays?page=abc')).body.meta.page).toBe(1)
  })

  it('AC9: lists show only the caller\'s own markings; the admin sees none', async () => {
    const b = await teacherB.get('/cikgu/essays')
    expect(b.body.data).toHaveLength(1)
    expect(b.body.data[0].studentName).toBeNull()
    expect((await admin.get('/cikgu/essays')).body.data).toEqual([])
  })

  it('the detail carries the essay text and comment, parses with the contract and is no-store', async () => {
    const list = await teacher.get('/cikgu/essays')
    const res = await teacher.get(`/cikgu/essays/${list.body.data[0].id as string}`)
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const e = CikguEssayMarkingSchema.parse(res.body.data)
    expect(e).toMatchObject({ userId: aId, rubricKey: 'sejarah_essay', level: 'T5', essayText: 'Teks karangan rahsia', comment: 'Markah: 14/20', threadId: threadA })
  })

  it('AC9: a foreign, unknown or non-numeric id is the same 404 "Not Found." and reveals nothing', async () => {
    const mine = (await teacher.get('/cikgu/essays')).body.data[0].id as string
    for (const [who, path] of [
      [teacherB, `/cikgu/essays/${mine}`],
      [admin, `/cikgu/essays/${mine}`],
      [teacher, '/cikgu/essays/987654321'],
      [teacher, '/cikgu/essays/abc'],
      [teacher, '/cikgu/essays/1e3'],
    ] as const) {
      const r = await who.get(path)
      expect(r.status, path).toBe(404)
      expect(r.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Not Found.' })
      expect(JSON.stringify(r.body)).not.toContain('Teks karangan rahsia')
    }
  })

  it('AC2: a student is 403 on both essay routes and a guest 401', async () => {
    const student = await client(t, STUDENT_1)
    expect((await student.get('/cikgu/essays')).status).toBe(403)
    expect((await student.get('/cikgu/essays/1')).status).toBe(403)
    expect((await t.http().get('/api/cikgu/essays')).status).toBe(401)
    expect((await t.http().get('/api/cikgu/essays/1')).status).toBe(401)
  })
})
