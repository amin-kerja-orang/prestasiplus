import { CIKGU_BULK_IDS_TOO_MANY, CikguPbdQueueItemSchema, CikguRollupResultSchema, ErrorBodySchema, ListMetaSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, TEACHER_A, TEACHER_B, addAnswers, bootCikguApp, client, idOfEmail, makeClass, subjectIdOf, type CikguTestApp, type Client } from './helpers'

describe('PBD tags: roll-up, queue, bulk approve, CSV export', () => {
  let t: CikguTestApp
  let teacher: Client
  let teacherB: Client
  let admin: Client
  let aId: string
  let bId: string
  let kimia: string
  let sejarah: string
  let matematik: string

  /** A student user (no login). */
  const student = async (name: string): Promise<string> => (await t.db.query<{ id: string }>(`insert into users (name) values ($1) returning id::text`, [name]))[0]?.id as string
  const tags = async (userId: string) =>
    t.db.query<{ id: string; class_id: string; student_id: string; sp: string; skor: string; tp: number; status: string; created_at: string; approved_at: string | null }>(
      `select id::text, classroom_id::text class_id, student_id::text, sp, skor::text, tp, status, created_at::text, approved_at::text from pbd_tags where user_id = $1 order by id`,
      [userId],
    )
  const rollup = (who: Client, classroomId: unknown) => who.post('/cikgu/pbd/rollup', { classroomId })

  beforeAll(async () => {
    t = await bootCikguApp()
    teacher = await client(t, TEACHER_A)
    teacherB = await client(t, TEACHER_B)
    admin = await client(t, ADMIN)
    aId = await idOfEmail(t, TEACHER_A)
    bId = await idOfEmail(t, TEACHER_B)
    kimia = await subjectIdOf(t, 'Kimia')
    sejarah = await subjectIdOf(t, 'Sejarah')
    matematik = await subjectIdOf(t, 'Matematik')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  describe('POST /cikgu/pbd/rollup (AC11)', () => {
    let classId: string
    let s1: string
    let s2: string
    let s3: string
    let s4: string
    let sTest: string
    let sRemoved: string

    beforeAll(async () => {
      ;[s1, s2, s3, s4, sTest, sRemoved] = await Promise.all(['Roll Satu', 'Roll Dua', 'Roll Tiga', 'Roll Empat', 'Roll Ujian', 'Roll Keluar'].map(student)) as [string, string, string, string, string, string]
      classId = await makeClass(t, aId, kimia, 'Kimia 5 Contoh', [s1, s2, s3, s4, sTest, sRemoved])
      await t.db.query(`update enrolments set status = 'removed' where classroom_id = $1 and student_id = $2`, [classId, sRemoved])
      await addAnswers(t, s1, kimia, 8, 1) // 88.9 -> TP5
      await addAnswers(t, s2, kimia, 3, 5) // 37.5 -> TP2
      // s3: no answers in Kimia (only in another subject): no tag.
      await addAnswers(t, s3, matematik, 4, 0)
      await addAnswers(t, s4, kimia, 2, 7) // 22.2 -> TP2
      await addAnswers(t, s4, kimia, 0, 9, true) // Mod Pelajar answers are ignored
      await addAnswers(t, sTest, kimia, 5, 0, true) // only test answers: no tag
      await addAnswers(t, sRemoved, kimia, 9, 0) // removed from the class: no tag
    })

    it('creates a pending tag for each active member with answers in the class subject: skor, tp bands, sp 5.1.1 for Kimia', async () => {
      const res = await rollup(teacher, classId)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(CikguRollupResultSchema.parse(res.body.data)).toEqual({ created: 3, updated: 0, skipped: 0 })
      const rows = await tags(aId)
      expect(rows.map((r) => [r.student_id, r.sp, r.skor, r.tp, r.status, r.class_id, r.approved_at])).toEqual([
        [s1, '5.1.1', '88.9', 5, 'pending', classId, null],
        [s2, '5.1.1', '37.5', 2, 'pending', classId, null],
        [s4, '5.1.1', '22.2', 2, 'pending', classId, null],
      ])
    })

    it('accepts the class id as a digit string, a padded string or an integer; a re-run updates pending tags and sets the roll-up time to now', async () => {
      const before = (await tags(aId)).map((r) => r.created_at)
      t.clock.advance(60_000)
      const res = await rollup(teacher, ` ${classId} `)
      expect(res.body.data).toEqual({ created: 0, updated: 3, skipped: 0 })
      const after = (await tags(aId)).map((r) => r.created_at)
      expect(after.every((c, i) => new Date(c).getTime() === new Date(before[i] as string).getTime() + 60_000)).toBe(true)
      expect((await rollup(teacher, Number(classId))).body.data).toEqual({ created: 0, updated: 3, skipped: 0 })
    })

    it('new answers change the score of the pending tag and a new student with answers gets a new tag; an approved tag is left alone (skipped)', async () => {
      await addAnswers(t, s2, kimia, 5, 0) // 8/13 = 61.5 -> TP4
      await addAnswers(t, s3, kimia, 3, 0) // new tag: 100 -> TP6
      const approved = (await tags(aId)).find((r) => r.student_id === s1)!
      expect((await teacher.post('/cikgu/pbd/bulk-approve', { ids: [approved.id] })).body.data).toEqual({ approved: 1 })
      const res = await rollup(teacher, classId)
      expect(res.body.data).toEqual({ created: 1, updated: 2, skipped: 1 })
      const rows = await tags(aId)
      const by = (s: string) => rows.find((r) => r.student_id === s)!
      expect([by(s1).status, by(s1).skor, by(s1).tp]).toEqual(['approved', '88.9', 5])
      expect([by(s2).skor, by(s2).tp, by(s2).status]).toEqual(['61.5', 4, 'pending'])
      expect([by(s3).skor, by(s3).tp, by(s3).status]).toEqual(['100.0', 6, 'pending'])
      // Idempotent: no second tag for the same (teacher, class, student, sp).
      expect(rows).toHaveLength(4)
    })

    it('sp is 1.1.1 for Sejarah and for every other subject; the key includes the sp', async () => {
      const sej = await makeClass(t, aId, sejarah, 'Sejarah 4 Contoh', [s1])
      const mat = await makeClass(t, aId, matematik, 'Matematik 4 Contoh', [s3])
      await addAnswers(t, s1, sejarah, 1, 1)
      expect((await rollup(teacher, sej)).body.data).toEqual({ created: 1, updated: 0, skipped: 0 })
      expect((await rollup(teacher, mat)).body.data).toEqual({ created: 1, updated: 0, skipped: 0 })
      const rows = await tags(aId)
      expect(rows.filter((r) => r.class_id === sej || r.class_id === mat).map((r) => [r.sp, r.skor, r.tp])).toEqual([
        ['1.1.1', '50.0', 3],
        ['1.1.1', '100.0', 6],
      ])
    })

    it('a null, missing, malformed, unknown, foreign or subject-less class is 200 {0,0,0} and changes nothing (never 422, never reveals a foreign class)', async () => {
      const noSubject = await makeClass(t, aId, null, 'Tanpa Subjek', [s1])
      const before = JSON.stringify(await tags(aId)) + JSON.stringify(await tags(bId))
      const zero = { created: 0, updated: 0, skipped: 0 }
      for (const classroomId of [null, undefined, 'abc', '', ' ', -1, 1.5, true, [classId], { id: classId }, '9999999999', 99999999999999999999999n.toString(), noSubject]) {
        const res = await rollup(teacher, classroomId)
        expect(res.status, JSON.stringify(classroomId)).toBe(200)
        expect(res.body.data, JSON.stringify(classroomId)).toEqual(zero)
      }
      const bare = await teacher.post('/cikgu/pbd/rollup', {})
      expect(bare.body.data).toEqual(zero)
      // Teacher B and the admin do not own the class.
      expect((await rollup(teacherB, classId)).body.data).toEqual(zero)
      expect((await rollup(admin, classId)).body.data).toEqual(zero)
      expect(JSON.stringify(await tags(aId)) + JSON.stringify(await tags(bId))).toBe(before)
      expect(await tags(bId)).toEqual([])
    })

    it('AC2: missing CSRF is 403 CSRF_INVALID', async () => {
      const res = await teacher.postNoCsrf('/cikgu/pbd/rollup', { classroomId: classId })
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('CSRF_INVALID')
    })
  })

  describe('GET /cikgu/pbd (AC10)', () => {
    let classId: string
    const ids: Record<string, string> = {}

    beforeAll(async () => {
      // Teacher B: five pending tags on one roll-up time (names must sort case and diacritic insensitively, ties by id) and one later.
      const names = ['Zul', 'aini', 'Ben', 'ÁLIF', 'alif']
      const ss: string[] = []
      for (const n of names) {
        const id = await student(n)
        ids[n] = id
        ss.push(id)
      }
      const late = await student('Zubir Terkini')
      classId = await makeClass(t, bId, kimia, 'Kelas Giliran', [...ss, late])
      for (const [i, s] of ss.entries()) {
        await t.db.query(`insert into pbd_tags (user_id, classroom_id, student_id, sp, skor, tp, created_at) values ($1, $2, $3, '5.1.1', $4, 2, '2026-10-10T10:00:00Z')`, [bId, classId, s, 30 + i])
      }
      await t.db.query(`insert into pbd_tags (user_id, classroom_id, student_id, sp, skor, tp, created_at) values ($1, $2, $3, '5.1.1', 77.5, 5, '2026-10-11T10:00:00Z')`, [bId, classId, late])
      // An approved tag is not in the queue.
      const done = await student('Sudah Lulus')
      await t.db.query(`insert into pbd_tags (user_id, classroom_id, student_id, sp, skor, tp, status, approved_at) values ($1, $2, $3, '5.1.1', 90, 6, 'approved', now())`, [bId, classId, done])
    })

    it('lists only own pending tags: newest roll-up first, then name A-Z ignoring case and diacritics, then id', async () => {
      const res = await teacherB.get('/cikgu/pbd')
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(ListMetaSchema.parse(res.body.meta)).toMatchObject({ page: 1, pageSize: 20, totalItems: 6 })
      const items = res.body.data.map((x: unknown) => CikguPbdQueueItemSchema.parse(x))
      expect(items.map((x: { studentName: string }) => x.studentName)).toEqual(['Zubir Terkini', 'aini', 'ÁLIF', 'alif', 'Ben', 'Zul'])
      // The two spellings of "alif" are a tie: the lower id (inserted first) comes first.
      expect(items[2].studentId).toBe(ids['ÁLIF'])
      expect(items[0]).toMatchObject({ studentId: expect.any(String), classroomId: classId, sp: '5.1.1', skor: 77.5, tp: 5 })
      expect(typeof items[0].id).toBe('string')
      expect(Object.keys(res.body.data[0]).sort()).toEqual(['classroomId', 'id', 'skor', 'sp', 'studentId', 'studentName', 'tp'])
    })

    it('another teacher and the admin see none of them', async () => {
      const a = await teacher.get('/cikgu/pbd')
      expect(a.body.data.every((x: { classroomId: string }) => x.classroomId !== classId)).toBe(true)
      const empty = await admin.get('/cikgu/pbd')
      expect(empty.body.data).toEqual([])
      expect(empty.body.meta).toMatchObject({ totalItems: 0, totalPages: 1, from: null, to: null })
    })

    it('20 a page; a page beyond the last is empty and keeps the page; an invalid page is 1', async () => {
      const many = (await t.db.query<{ id: string }>(`insert into users (name) select 'Ramai ' || lpad(g::text, 2, '0') from generate_series(1, 44) g returning id::text`)).map((r) => r.id)
      const cls = await makeClass(t, bId, kimia, 'Kelas Ramai', many)
      for (const s of many) await t.db.query(`insert into pbd_tags (user_id, classroom_id, student_id, sp, skor, tp, created_at) values ($1, $2, $3, '1.1.1', 50, 3, '2026-10-12T10:00:00Z')`, [bId, cls, s])
      const p1 = await teacherB.get('/cikgu/pbd')
      expect(p1.body.meta).toEqual({ page: 1, pageSize: 20, totalItems: 50, totalPages: 3, from: 1, to: 20 })
      expect(p1.body.data.map((x: { studentName: string }) => x.studentName).slice(0, 3)).toEqual(['Ramai 01', 'Ramai 02', 'Ramai 03'])
      const p3 = await teacherB.get('/cikgu/pbd?page=3')
      expect(p3.body.data).toHaveLength(10)
      const beyond = await teacherB.get('/cikgu/pbd?page=8')
      expect(beyond.body.data).toEqual([])
      expect(beyond.body.meta).toMatchObject({ page: 8, totalItems: 50, from: null, to: null })
      expect((await teacherB.get('/cikgu/pbd?page=0')).body.meta.page).toBe(1)
    })
  })

  describe('POST /cikgu/pbd/bulk-approve (AC12)', () => {
    let classId: string
    let mine: string[] = []
    let foreign: string

    beforeAll(async () => {
      const ss = await Promise.all(['Lulus Satu', 'Lulus Dua', 'Lulus Tiga', 'Lulus Empat'].map(student))
      classId = await makeClass(t, aId, kimia, 'Kelas Lulus', ss)
      const add = async (user: string, s: string, status = 'pending') =>
        (
          await t.db.query<{ id: string }>(
            `insert into pbd_tags (user_id, classroom_id, student_id, sp, skor, tp, status, approved_at) values ($1, $2, $3, '9.9.9', 50, 3, $4, ${status === 'approved' ? 'now()' : 'null'}) returning id::text`,
            [user, classId, s, status],
          )
        )[0]?.id as string
      mine = [await add(aId, ss[0] as string), await add(aId, ss[1] as string), await add(aId, ss[2] as string, 'approved')]
      foreign = await add(bId, ss[3] as string)
    })

    it('approves only the caller\'s pending tags: digit strings and integers, duplicates once; foreign, approved, unknown and garbage ids are ignored', async () => {
      t.clock.set('2026-10-19T09:30:00+08:00')
      const who = await client(t, TEACHER_A)
      const res = await who.post('/cikgu/pbd/bulk-approve', {
        ids: [mine[0], ` ${mine[1] as string} `, Number(mine[0]), mine[2], foreign, '999999999', 'abc', '', null, true, 1.5, -3, {}, [1], '1e3', '0x10'],
      })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toEqual({ approved: 2 })
      expect(res.headers['cache-control']).toBe('no-store')
      const rows = await t.db.query<{ id: string; status: string; approved_at: string | null }>(`select id::text, status, approved_at::text from pbd_tags where id = any($1::bigint[]) order by id`, [[...mine, foreign]])
      const by = (id: string) => rows.find((r) => r.id === id)!
      expect([by(mine[0] as string).status, by(mine[1] as string).status, by(foreign).status]).toEqual(['approved', 'approved', 'pending'])
      expect(new Date(by(mine[0] as string).approved_at as string).getTime()).toBe(new Date('2026-10-19T09:30:00+08:00').getTime())
      // The foreign tag is still approvable by its owner, the approved ones are not approved twice.
      const again = await who.post('/cikgu/pbd/bulk-approve', { ids: mine })
      expect(again.body.data).toEqual({ approved: 0 })
    })

    it('a non-array, empty, missing or all-garbage ids is {approved: 0}; exactly 100 items are accepted; 101 is 422 fields.ids', async () => {
      const who = await client(t, TEACHER_A)
      for (const body of [{}, { ids: [] }, { ids: 'x' }, { ids: null }, { ids: { a: 1 } }, { ids: ['x', null] }]) {
        const res = await who.post('/cikgu/pbd/bulk-approve', body)
        expect(res.status, JSON.stringify(body)).toBe(200)
        expect(res.body.data).toEqual({ approved: 0 })
      }
      const hundred = Array.from({ length: 100 }, (_, i) => String(i + 1))
      expect((await who.post('/cikgu/pbd/bulk-approve', { ids: hundred })).status).toBe(200)
      const tooMany = await who.post('/cikgu/pbd/bulk-approve', { ids: [...hundred, '101'] })
      expect(tooMany.status).toBe(422)
      const err = ErrorBodySchema.parse(tooMany.body).error
      expect(err.code).toBe('VALIDATION_ERROR')
      expect(err.fields).toEqual({ ids: CIKGU_BULK_IDS_TOO_MANY })
      expect(err.message).toBe(CIKGU_BULK_IDS_TOO_MANY)
      // Duplicates count towards the cap (the cap is on the array as sent).
      expect((await who.post('/cikgu/pbd/bulk-approve', { ids: Array(101).fill('1') })).status).toBe(422)
    })

    it('the admin cannot approve a teacher\'s tag; AC2: missing CSRF is 403 CSRF_INVALID', async () => {
      const res = await admin.post('/cikgu/pbd/bulk-approve', { ids: [foreign] })
      expect(res.body.data).toEqual({ approved: 0 })
      const noCsrf = await teacher.postNoCsrf('/cikgu/pbd/bulk-approve', { ids: [foreign] })
      expect(noCsrf.status).toBe(403)
      expect(noCsrf.body.error.code).toBe('CSRF_INVALID')
      expect((await t.db.query<{ status: string }>(`select status from pbd_tags where id = $1`, [foreign]))[0]?.status).toBe('pending')
    })
  })

  describe('GET /cikgu/pbd/export.csv (AC12)', () => {
    let app2: CikguTestApp
    let who: Client
    let other: Client
    let userId: string

    beforeAll(async () => {
      app2 = await bootCikguApp()
      who = await client(app2, TEACHER_A)
      other = await client(app2, TEACHER_B)
      userId = await idOfEmail(app2, TEACHER_A)
    }, 120_000)
    afterAll(async () => {
      await app2.close()
    })

    it('an empty set is the header line only, with the attachment headers and no-store', async () => {
      const res = await who.get('/cikgu/pbd/export.csv')
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8')
      expect(res.headers['content-disposition']).toBe('attachment; filename="pbd-approved.csv"')
      expect(res.headers['cache-control']).toBe('no-store')
      expect(res.text).toBe('pelajar,kelas,sp,skor,tp,tarikh_lulus\n')
    })

    it('exports the layout, in approval order, with the spreadsheet guard and RFC 4180 quoting', async () => {
      const kim = await subjectIdOf(app2, 'Kimia')
      const mk = async (name: string) => (await app2.db.query<{ id: string }>(`insert into users (name) values ($1) returning id::text`, [name]))[0]?.id as string
      const names = ['Aina Contoh', '=SUM(1)', 'Tan, "Si" Contoh', '+60123', '-cmd', '@x', '\tTab', 'Rendah']
      const ss = await Promise.all(names.map(mk))
      const cls = await makeClass(app2, userId, kim, 'Kelas, "Kimia"', ss)
      const at = (i: number) => `2026-10-19T0${String(i)}:00:00Z`
      for (const [i, s] of ss.entries()) {
        await app2.db.query(
          `insert into pbd_tags (user_id, classroom_id, student_id, sp, skor, tp, status, created_at, approved_at) values ($1, $2, $3, '5.1.1', $4, $5, 'approved', '2026-10-01T00:00:00Z', $6)`,
          [userId, cls, s, i === 7 ? 5 : 88.9, i === 7 ? 1 : 5, at(Math.min(i, 8))],
        )
      }
      // The last pupil was approved at 16:30 UTC, which is 00:30 on the next Malaysia day.
      await app2.db.query(`update pbd_tags set approved_at = '2026-10-19T16:30:00Z' where student_id = $1`, [ss[7]])
      // A pending tag, another teacher's approved tag: not exported.
      await app2.db.query(`insert into pbd_tags (user_id, classroom_id, student_id, sp, skor, tp, status) values ($1, $2, $3, '5.1.1', 10, 1, 'pending')`, [userId, cls, (await mk('Belum Lulus'))])
      const res = await who.get('/cikgu/pbd/export.csv')
      expect(res.status).toBe(200)
      const kelas = '"Kelas, ""Kimia"""'
      expect(res.text).toBe(
        [
          'pelajar,kelas,sp,skor,tp,tarikh_lulus',
          `Aina Contoh,${kelas},5.1.1,88.9,5,2026-10-19`,
          `'=SUM(1),${kelas},5.1.1,88.9,5,2026-10-19`,
          `"Tan, ""Si"" Contoh",${kelas},5.1.1,88.9,5,2026-10-19`,
          `'+60123,${kelas},5.1.1,88.9,5,2026-10-19`,
          `'-cmd,${kelas},5.1.1,88.9,5,2026-10-19`,
          `'@x,${kelas},5.1.1,88.9,5,2026-10-19`,
          `'\tTab,${kelas},5.1.1,88.9,5,2026-10-19`,
          // 16:30 UTC is 00:30 the next day in Malaysia.
          `Rendah,${kelas},5.1.1,5.0,1,2026-10-20`,
          '',
        ].join('\n'),
      )
    })

    it('skor has one decimal and tarikh_lulus is the Malaysia date of approval; ordering is approval time, then name, then id', async () => {
      const kim = await subjectIdOf(app2, 'Kimia')
      const other2 = await idOfEmail(app2, TEACHER_B)
      const mk = async (name: string) => (await app2.db.query<{ id: string }>(`insert into users (name) values ($1) returning id::text`, [name]))[0]?.id as string
      const [x, y, z] = await Promise.all(['Zaini', 'Ali', 'Mira'].map(mk))
      const cls = await makeClass(app2, other2, kim, 'Kelas B', [x as string, y as string, z as string])
      const ins = (s: string, skor: number, at: string) =>
        app2.db.query(`insert into pbd_tags (user_id, classroom_id, student_id, sp, skor, tp, status, approved_at) values ($1, $2, $3, '1.1.1', $4, 3, 'approved', $5)`, [other2, cls, s, skor, at])
      await ins(x as string, 50, '2026-10-19T16:30:00Z') // 20 Oct 00:30 +08:00
      await ins(y as string, 7.25, '2026-10-19T15:30:00Z') // 19 Oct 23:30 +08:00
      await ins(z as string, 100, '2026-10-19T15:30:00Z') // same time as Ali: name order
      const res = await other.get('/cikgu/pbd/export.csv')
      expect(res.text).toBe(
        ['pelajar,kelas,sp,skor,tp,tarikh_lulus', 'Ali,Kelas B,1.1.1,7.3,3,2026-10-19', 'Mira,Kelas B,1.1.1,100.0,3,2026-10-19', 'Zaini,Kelas B,1.1.1,50.0,3,2026-10-20', ''].join('\n'),
      )
      // Only the caller's rows: the admin has none.
      const adm = await client(app2, ADMIN)
      expect((await adm.get('/cikgu/pbd/export.csv')).text).toBe('pelajar,kelas,sp,skor,tp,tarikh_lulus\n')
    })
  })
})
