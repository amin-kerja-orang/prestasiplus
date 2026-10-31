import { KIRKPATRICK_PDF, KirkpatrickMeSchema, KirkpatrickStudentSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN,
  SCHOOL_ADMIN_A,
  SCHOOL_ADMIN_B,
  STUDENT_1,
  STUDENT_2,
  TEACHER_A,
  TEACHER_B,
  TEACHER_C,
  type Client,
  type KirkpatrickTestApp,
  type World,
  bootKirkpatrickApp,
  buildWorld,
  client,
  errorIs,
} from './helpers'

function binary(res: { on: (e: string, cb: (c?: Buffer) => void) => void; setEncoding?: (e: string) => void }, cb: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = []
  res.on('data', (c) => chunks.push(Buffer.from(c as Buffer)))
  res.on('end', () => cb(null, Buffer.concat(chunks)))
}

describe('pupil views S8 and S9, and the PDF export (AC 2, 3, 5)', () => {
  let t: KirkpatrickTestApp
  let w: World
  let admin: Client
  let teacherA: Client
  let teacherB: Client
  let teacherC: Client
  let adminA: Client
  let adminB: Client
  let p1: Client
  let p2: Client

  beforeAll(async () => {
    t = await bootKirkpatrickApp()
    w = await buildWorld(t)
    admin = await client(t, ADMIN)
    teacherA = await client(t, TEACHER_A)
    teacherB = await client(t, TEACHER_B)
    teacherC = await client(t, TEACHER_C)
    adminA = await client(t, SCHOOL_ADMIN_A)
    adminB = await client(t, SCHOOL_ADMIN_B)
    p1 = await client(t, STUDENT_1)
    p2 = await client(t, STUDENT_2)
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  describe('GET /api/kirkpatrick/students/:id', () => {
    it('admin opens any pupil: totals, subjects by accuracy, strongest, weakest and the day streak', async () => {
      const res = await admin.get(`/kirkpatrick/students/${w.ids.p1}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.headers['cache-control']).toContain('no-store')
      const data = envelopeOf(KirkpatrickStudentSchema).parse(res.body).data
      expect(data.student).toEqual({ id: w.ids.p1, name: 'Murid Demo', schoolName: 'SMK Demo Satu', grade: 10 })
      // Practice: 8 answered 6 correct (10 Sep), 10 answered 5 correct (5 Oct); the test and in-progress sessions do not count.
      expect(data).toMatchObject({ activeDays: 2, answers: 18, accuracy: 61.1, streak: 1 })
      // One active day (5 Oct) of the last 30 (20 Sep to 19 Oct): 1 / 30.
      expect(data.konsistensi).toBe(3.3)
      const names = await t.db.query<{ id: string; name: string }>(`select id::text, name from subjects where id = any($1::bigint[])`, [w.subjects])
      const nameOf = (id: string) => names.find((n) => n.id === id)?.name
      expect(data.strongest).toEqual({ subjectName: nameOf(w.subjects[0]), accuracy: 75 })
      expect(data.weakest).toEqual({ subjectName: nameOf(w.subjects[1]), accuracy: 50 })
      expect(data.platform).toEqual([
        { subjectName: nameOf(w.subjects[0]), accuracy: 75, answers: 8 },
        { subjectName: nameOf(w.subjects[1]), accuracy: 50, answers: 10 },
      ])
      expect(data.headcount).toEqual({ year: 2026, rows: [] })
    })

    it('a pupil with no sessions gets the zero state', async () => {
      const data = envelopeOf(KirkpatrickStudentSchema).parse((await admin.get(`/kirkpatrick/students/${w.ids.p2}`)).body).data
      expect(data).toMatchObject({ activeDays: 0, answers: 0, accuracy: 0, konsistensi: 0, streak: 0, strongest: null, weakest: null, platform: [] })
    })

    it('a teacher opens only pupils of the own active classes; school_admin the pupils of the own school', async () => {
      // Teacher A and teacher B are in the same school: neither opens the other's pupil.
      expect((await teacherA.get(`/kirkpatrick/students/${w.ids.p1}`)).status).toBe(200)
      errorIs(await teacherA.get(`/kirkpatrick/students/${w.ids.maju}`), 403, 'FORBIDDEN', 'This action is unauthorized.')
      errorIs(await teacherA.get(`/kirkpatrick/students/${w.ids.susp}`), 403, 'FORBIDDEN', 'This action is unauthorized.')
      errorIs(await teacherA.get(`/kirkpatrick/students/${w.ids.pb}`), 403, 'FORBIDDEN', 'This action is unauthorized.')
      expect((await teacherB.get(`/kirkpatrick/students/${w.ids.maju}`)).status).toBe(200)
      errorIs(await teacherB.get(`/kirkpatrick/students/${w.ids.p1}`), 403, 'FORBIDDEN')
      // DEMO002 is a primary school (SK): its pupils are hidden (secondary-only, D72) until the school is made secondary
      errorIs(await teacherC.get(`/kirkpatrick/students/${w.ids.pb}`), 403, 'FORBIDDEN', 'This action is unauthorized.')
      await t.db.query(`update schools set type = 'SMK' where code = 'DEMO002'`)
      try {
        expect((await teacherC.get(`/kirkpatrick/students/${w.ids.pb}`)).status).toBe(200)
        errorIs(await teacherC.get(`/kirkpatrick/students/${w.ids.p1}`), 403, 'FORBIDDEN')
      } finally {
        await t.db.query(`update schools set type = 'SK' where code = 'DEMO002'`)
      }

      expect((await adminA.get(`/kirkpatrick/students/${w.ids.maju}`)).status).toBe(200)
      errorIs(await adminA.get(`/kirkpatrick/students/${w.ids.pb}`), 403, 'FORBIDDEN', 'This action is unauthorized.')
      expect((await adminB.get(`/kirkpatrick/students/${w.ids.pb}`)).status).toBe(200)
      errorIs(await adminB.get(`/kirkpatrick/students/${w.ids.p1}`), 403, 'FORBIDDEN')
    })

    it('one uniform 403 for an unknown id, a non-pupil and an id that can never exist; a non-numeric id is 404', async () => {
      for (const id of ['987654321', w.ids.teacherA, '0', '007', '99999999999999999999']) {
        errorIs(await admin.get(`/kirkpatrick/students/${id}`), 403, 'FORBIDDEN', 'This action is unauthorized.')
      }
      errorIs(await admin.get('/kirkpatrick/students/abc'), 404, 'NOT_FOUND', 'Not Found.')
      errorIs(await teacherA.get('/kirkpatrick/students/1x'), 404, 'NOT_FOUND', 'Not Found.')
    })
  })

  describe('GET /api/kirkpatrick/me', () => {
    it('any role gets 30 squares ending today, own answers only, test rows left out', async () => {
      const res = await p1.get('/kirkpatrick/me')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.headers['cache-control']).toContain('no-store')
      const data = envelopeOf(KirkpatrickMeSchema).parse(res.body).data
      expect(data.headcount).toBeNull()
      expect(data.days).toHaveLength(30)
      expect(data.days[0]).toEqual({ date: '20/09', answers: 0 })
      expect(data.days[29]).toEqual({ date: '19/10', answers: 0 })
      expect(data.days.find((d) => d.date === '05/10')).toEqual({ date: '05/10', answers: 10 })
      // The 20-answer test session of 18 October is not counted; the 4 answers of the other session of that day are.
      expect(data.days.find((d) => d.date === '18/10')?.answers).toBe(4)
    })

    it('a pupil with no practice has all zeros; teachers and admins are served too', async () => {
      const own = envelopeOf(KirkpatrickMeSchema).parse((await p2.get('/kirkpatrick/me')).body).data
      expect(own.days.every((d) => d.answers === 0)).toBe(true)
      for (const who of [teacherA, adminA, admin]) expect((await who.get('/kirkpatrick/me')).status).toBe(200)
    })
  })

  describe('GET /api/kirkpatrick/export-pdf', () => {
    const fetchPdf = (who: Client) =>
      who.who.agent.get('/api/kirkpatrick/export-pdf').buffer(true).parse(binary as never)

    it('admin, teacher and school_admin get a PDF with the contract file name', async () => {
      for (const who of [admin, teacherA, adminA]) {
        const res = await fetchPdf(who)
        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toContain(KIRKPATRICK_PDF.contentType)
        expect(res.headers['content-disposition']).toBe(`attachment; filename="${KIRKPATRICK_PDF.filename}"`)
        expect(res.headers['cache-control']).toContain('no-store')
        const bytes = res.body as Buffer
        expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF')
        expect(bytes.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true)
        expect(Number(res.headers['content-length'])).toBe(bytes.length)
      }
    })

    it('the report holds the chain figures of the viewer: platform for admin, own school for a teacher', async () => {
      const text = async (who: Client) => ((await fetchPdf(who)).body as Buffer).toString('latin1')
      expect(await text(admin)).toContain('Soalan Dijawab: 73')
      expect(await text(teacherA)).toContain('Soalan Dijawab: 68')
      expect(await text(teacherC)).toContain('Soalan Dijawab: 5')
      expect(await text(admin)).toContain('(Model Kirkpatrick - Rantaian Impak)')
    })

    it('a student is 403 and no session is 401', async () => {
      errorIs(await p1.get('/kirkpatrick/export-pdf'), 403, 'FORBIDDEN')
      errorIs(await t.http().get('/api/kirkpatrick/export-pdf'), 401, 'UNAUTHORIZED')
    })
  })
})
