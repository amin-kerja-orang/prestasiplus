import {
  QUESTION_SET_PAPER_MESSAGES as M,
  QuestionSetPaperSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionSetsPorts, type PaperSubmission } from '../../src/modules/classes/question-sets'
import { ADMIN, STUDENT_1, TEACHER_A, bootQsApp, bytes, client, expectNoStore, idOfEmail, type Client, type QsTestApp } from './qs-helpers'

const OK_FIELDS = { paperType: 'trial', subject: 'Matematik', levelId: '4', year: '2025', preparedBy: 'Cikgu Ujian', note: 'Nota', answerSchemeConfirmed: 'true' }

/** A multipart request builder: text fields plus (name, size) file parts under `key`. */
function upload(c: Client, fields: Record<string, string>, files: { name: string; size: number }[] = [], key = 'files', csrf = true) {
  let req = c.who.agent.post('/api/guru/question-papers')
  if (csrf) req = req.set('X-CSRF-Token', c.who.csrf)
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v)
  for (const f of files) req = req.attach(key, bytes(f.size), f.name)
  return req
}

describe('BE-18 B: POST /guru/question-papers', () => {
  let t: QsTestApp
  let teacher: Client
  let teacherId: string
  const seen: PaperSubmission[] = []

  beforeAll(async () => {
    t = await bootQsApp()
    teacher = await client(t, TEACHER_A)
    teacherId = await idOfEmail(t, TEACHER_A)
  })
  afterAll(async () => {
    await t.close()
  })

  describe('validation (422, every failing field at once)', () => {
    const run = async (fields: Record<string, string>, files: { name: string; size: number }[], key = 'files') => {
      const res = await upload(teacher, fields, files, key)
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      return res.body.error as { message: string; fields: Record<string, string> }
    }
    const good = [{ name: 'a.pdf', size: 5 }]

    it('reports each field message', async () => {
      expect((await run({ ...OK_FIELDS, paperType: 'Soalan Umum' }, good)).fields).toEqual({ paperType: M.type })
      expect((await run({ ...OK_FIELDS, paperType: '' }, good)).fields).toEqual({ paperType: M.type })
      expect((await run({ ...OK_FIELDS, subject: '   ' }, good)).fields).toEqual({ subject: M.subject })
      expect((await run({ ...OK_FIELDS, subject: 'x'.repeat(101) }, good)).fields).toEqual({ subject: M.subjectLong })
      expect((await run({ ...OK_FIELDS, levelId: '6' }, good)).fields).toEqual({ levelId: M.level })
      expect((await run({ ...OK_FIELDS, levelId: 'T0' }, good)).fields).toEqual({ levelId: M.level })
      expect((await run({ ...OK_FIELDS, levelId: 'abc' }, good)).fields).toEqual({ levelId: M.level })
      expect((await run({ ...OK_FIELDS, year: '1999' }, good)).fields).toEqual({ year: M.year })
      expect((await run({ ...OK_FIELDS, year: '2100' }, good)).fields).toEqual({ year: M.year })
      expect((await run({ ...OK_FIELDS, preparedBy: 'x'.repeat(151) }, good)).fields).toEqual({ preparedBy: M.author })
      expect((await run({ ...OK_FIELDS, note: 'x'.repeat(1001) }, good)).fields).toEqual({ note: M.note })
      expect((await run({ ...OK_FIELDS, answerSchemeConfirmed: 'false' }, good)).fields).toEqual({ answerSchemeConfirmed: M.confirm })
      expect((await run({ ...OK_FIELDS, answerSchemeConfirmed: '' }, good)).fields).toEqual({ answerSchemeConfirmed: M.confirm })
    })

    it('counts code points, not UTF-16 units, and trims', async () => {
      // 100 emoji = 200 UTF-16 units but 100 code points: allowed; the failure here can only be the file
      const err = await run({ ...OK_FIELDS, subject: '\u{1F600}'.repeat(100) }, [{ name: 'a.txt', size: 5 }])
      expect(err.fields).toEqual({ files: M.fileType })
    })

    it('reports all failing fields at once, in form order, with the Laravel summary of the first', async () => {
      const err = await run({ paperType: 'x', subject: '', levelId: '9', year: '5', preparedBy: 'x'.repeat(151), note: 'x'.repeat(1001) }, [])
      expect(Object.keys(err.fields)).toEqual(['paperType', 'subject', 'levelId', 'year', 'preparedBy', 'note', 'answerSchemeConfirmed', 'files'])
      expect(err.fields.files).toBe(M.files)
      expect(err.message).toBe(`${M.type} (and 7 more errors)`)
      const two = await run({ ...OK_FIELDS, subject: '' }, [])
      expect(two.message).toBe(`${M.subject} (and 1 more error)`)
    })

    it('files: none, more than 5, bad extension, too large', async () => {
      expect((await run(OK_FIELDS, [])).fields).toEqual({ files: M.files })
      const six = Array.from({ length: 6 }, (_, i) => ({ name: `f${String(i)}.pdf`, size: 3 }))
      expect((await run(OK_FIELDS, six)).fields).toEqual({ files: M.tooMany })
      const seven = Array.from({ length: 7 }, (_, i) => ({ name: `f${String(i)}.pdf`, size: 3 }))
      expect((await run(OK_FIELDS, seven)).fields).toEqual({ files: M.tooMany })
      expect((await run(OK_FIELDS, [{ name: 'a.pdf', size: 3 }, { name: 'virus.exe', size: 3 }])).fields).toEqual({ files: M.fileType })
      expect((await run(OK_FIELDS, [{ name: 'noext', size: 3 }])).fields).toEqual({ files: M.fileType })
      expect((await run(OK_FIELDS, [{ name: 'a.pdf.png', size: 3 }])).fields).toEqual({ files: M.fileType })
      // the old Office formats and images are not accepted; one bad file rejects the whole submission
      for (const bad of ['soalan.doc', 'soalan.xls', 'rajah.png', 'rajah.jpg', 'rajah.jpeg']) {
        expect((await run(OK_FIELDS, [{ name: 'a.pdf', size: 3 }, { name: bad, size: 3 }])).fields, bad).toEqual({ files: M.fileType })
      }
      const big = await run(OK_FIELDS, [{ name: 'kecil.pdf', size: 3 }, { name: 'besar.xlsx', size: 20 * 1024 * 1024 + 1 }])
      expect(big.fields).toEqual({ files: M.fileSize })
    })

    it('the PRD 44-F4 texts are exact', () => {
      expect(M.confirm).toBe('Sila sahkan skema jawapan disertakan.')
      expect(M.files).toBe('Sila pilih fail.')
      expect(M.tooMany).toBe('Maksimum 5 fail, saiz maksimum 20MB setiap fail')
      expect(M.fileType).toBe('Jenis fail tidak disokong. Format dibenarkan: PDF, DOCX, XLSX.')
      expect(M.fileSize).toBe('Fail melebihi saiz maksimum 20 MB.')
      expect(M.scanned).toBe('PDF imbasan imej tidak diterima — teks mesti boleh disalin.')
      expect(M.note).toBe('Catatan tambahan tidak boleh melebihi 1000 aksara.')
    })

    it('a request without any multipart body is a files failure plus the field failures', async () => {
      const res = await teacher.post('/guru/question-papers', {})
      expect(res.status).toBe(422)
      expect(Object.keys(res.body.error.fields)).toEqual(['paperType', 'subject', 'answerSchemeConfirmed', 'files'])
    })

    it('validation runs before the port is called', async () => {
      // the stub intake rejects when called; a 422 proves nothing reached it
      const res = await upload(teacher, { ...OK_FIELDS, subject: '' }, good)
      expect(res.status).toBe(422)
    })
  })

  describe('guards', () => {
    it('anonymous is 401', async () => {
      const res = await t.http().post('/api/guru/question-papers').field('subject', 'x')
      expect(res.status).toBe(401)
      expect(res.body.error).toMatchObject({ code: 'UNAUTHORIZED', message: 'Sesi anda telah tamat. Sila log masuk semula.' })
    })

    it('a student is 403 and the body is not read', async () => {
      const s = await client(t, STUDENT_1)
      const res = await upload(s, OK_FIELDS, [{ name: 'a.pdf', size: 3 }])
      expect(res.status).toBe(403)
      expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: 'Anda tidak dibenarkan melakukan tindakan ini.' })
    })

    it('a missing CSRF token is 403 CSRF_INVALID', async () => {
      const res = await upload(teacher, OK_FIELDS, [{ name: 'a.pdf', size: 3 }], 'files', false)
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('CSRF_INVALID')
    })
  })

  describe('with a bound intake port', () => {
    beforeAll(() => {
      t.intake.handler = async (s) => {
        seen.push(s)
        void s
        return { batchId: '77' }
      }
    })

    it('201 {data: {batchId}} only; the port gets the declaration and the buffers', async () => {
      const res = await upload(teacher, OK_FIELDS, [{ name: 'a.pdf', size: 12 }, { name: 'b.docx', size: 7 }])
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expectNoStore(res)
      expect(res.body).toEqual({ data: { batchId: '77' } })
      expect(QuestionSetPaperSchema.parse(res.body.data)).toEqual({ batchId: '77' })
      const call = seen.at(-1) as PaperSubmission
      expect(call.declaration).toEqual({ paperType: 'trial', subjectText: 'Matematik', levelCode: 'T4', year: 2025, authorCredit: 'Cikgu Ujian', note: 'Nota' })
      expect(call).toMatchObject({ teacherId, role: 'teacher', isTest: false, requestId: expect.any(String) })
      expect(call.auth.userId).toBe(teacherId)
      expect(call.files.map((f) => [f.index, f.name, f.size])).toEqual([[0, 'a.pdf', 12], [1, 'b.docx', 7]])
      expect(call.files[0]?.buffer.equals(bytes(12))).toBe(true)
    })

    it('reads the key files[] too; normalises T-level, empty year and note, blank author', async () => {
      const res = await upload(teacher, { paperType: ' dskp ', subject: ' Sains ', levelId: 'T2', year: '', preparedBy: '', note: '  ', answerSchemeConfirmed: 'on' }, [{ name: 'X.XLSX', size: 4 }], 'files[]')
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(seen.at(-1)?.declaration).toEqual({ paperType: 'dskp', subjectText: 'Sains', levelCode: 'T2', year: 2026, authorCredit: '', note: null })
    })

    it('an empty level is null; a file of exactly 20 MB is accepted; five files are accepted', async () => {
      const five = Array.from({ length: 5 }, (_, i) => ({ name: `f${String(i)}.docx`, size: i === 0 ? 20 * 1024 * 1024 : 2 }))
      const res = await upload(teacher, { paperType: 'lain', subject: 'BM', answerSchemeConfirmed: 'true' }, five)
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(seen.at(-1)?.declaration.levelCode).toBeNull()
      expect(seen.at(-1)?.files).toHaveLength(5)
    })

    it('an admin may upload too', async () => {
      const admin = await client(t, ADMIN)
      const res = await upload(admin, OK_FIELDS, [{ name: 'a.pdf', size: 3 }])
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(seen.at(-1)?.role).toBe('admin')
    })

    it('binding a second port is a wiring error', () => {
      expect(() => t.get(QuestionSetsPorts).provideIntake({ submit: () => Promise.reject(new Error('x')) })).toThrow(/already set/)
    })
  })
})

describe('BE-18 B: question paper upload rate limit (D57)', () => {
  let t: QsTestApp
  beforeAll(async () => {
    t = await bootQsApp({ env: { THROTTLE_CLASSES_WRITE_PER_MINUTE: '2' } })
  })
  afterAll(async () => {
    await t.close()
  })

  it('429 RATE_LIMITED with Retry-After on the third write in a minute', async () => {
    const teacher = await client(t, TEACHER_A)
    for (let i = 0; i < 2; i++) expect((await upload(teacher, {}, [])).status).toBe(422)
    const res = await upload(teacher, {}, [])
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
  })
})
