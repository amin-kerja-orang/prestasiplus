/**
 * M04-T2: structured questions (S8/S9, #18–#19), teacher question papers (S10, #20–#22), the diagram
 * audit (S11, #23–#25) and master notes (S12, #26–#27): admin guards, unknown ids (404), validation
 * (422), the simulated files and the observed anchor counts (SRS §4.1, §6.11).
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { users } from '@/modules/m01-authentication/mock'

import type { DiagramAudit, DiagramMutation } from '../../api/diagram-audit'
import type { MasterNoteListMeta, MasterNoteRow } from '../../api/master-notes'
import type { StructuredDetail, StructuredListMeta, StructuredRow } from '../../api/structured'
import type {
  QuestionSubmission,
  SubmissionListMeta,
  SubmissionMutation,
} from '../../api/submissions'
import { masterNotes, questions, structured, submissions } from '../../mock'
import {
  DIAGRAM_DISMISSED_TEXT,
  DIAGRAM_FILE_REQUIRED,
  DIAGRAM_FILE_TYPE,
  DIAGRAM_UPLOADED_TEXT,
} from '../../mock/handlers/diagram-audit'
import {
  SUBMISSION_NOTES_MESSAGE,
  SUBMISSION_SAVED_TEXT,
  SUBMISSION_STATUS_MESSAGE,
} from '../../mock/handlers/submissions'
import { CANNED_NOTES } from '../../mock/repository/master-notes'
import { defaultMasterNotes, SEED_SUBMISSIONS } from '../../mock/seeds/workflow'
import {
  ADMIN,
  bootM04,
  callAs,
  form,
  GURU,
  IBU_BAPA,
  ADMIN_SEKOLAH,
  pngFile,
  PELAJAR,
  type Call,
  type ErrorBody,
} from './workflow-helpers'

interface Page<T, M extends object = Record<never, never>> {
  data: T[]
  meta: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    from: number | null
    to: number | null
  } & M
}

let runtime: MockRuntime
let call: Call
let dirty = false

beforeAll(async () => {
  runtime = await bootM04()
  call = callAs(runtime)
}, 180_000)

afterEach(async () => {
  if (dirty) await runtime.reset()
  dirty = false
}, 180_000)

afterAll(async () => {
  await runtime.reset()
})

const fieldsOf = (r: { body: unknown }) => (r.body as ErrorBody).error.fields
const errorCode = (r: { body: unknown }) => (r.body as ErrorBody).error.code

describe('admin guards (SEC-M04-01, SEC-M04-07, SEC-M04-09)', () => {
  const endpoints: ['GET' | 'POST' | 'PATCH', string][] = [
    ['GET', '/api/structured-questions'],
    ['GET', '/api/structured-questions/3698'],
    ['GET', '/api/question-submissions'],
    ['PATCH', '/api/question-submissions/4/status'],
    ['GET', '/api/question-submissions/4/files/0'],
    ['GET', '/api/diagram-audit'],
    ['POST', '/api/diagram-audit/mcq/563393/image'],
    ['POST', '/api/diagram-audit/mcq/563393/dismiss'],
    ['GET', '/api/master-notes'],
    ['POST', '/api/master-notes/1/approve'],
  ]

  it.each(endpoints)('%s %s: 401 without a session', async (method, url) => {
    expect((await call(method, url, null)).status).toBe(401)
  })

  it.each(endpoints)('%s %s: 403 for a student and a teacher', async (method, url) => {
    expect((await call(method, url, PELAJAR)).status).toBe(403)
    expect((await call(method, url, GURU)).status).toBe(403)
    expect((await call(method, url, IBU_BAPA)).status).toBe(403)
    expect((await call(method, url, ADMIN_SEKOLAH)).status).toBe(403)
  })

  it('a refused mutation changes nothing', async () => {
    await call('PATCH', '/api/question-submissions/4/status', PELAJAR, { status: 'rejected' })
    await call('POST', '/api/master-notes/1/approve', GURU)
    await call('POST', '/api/diagram-audit/mcq/563393/dismiss', PELAJAR)
    expect(submissions.get(4)?.status).toBe('done')
    expect(masterNotes.get(1)?.teacherApproved).toBe(false)
    expect(questions.get(563_393)?.needsDiagram).toBe(true)
  })
})

describe('#18 S8 structured list (BR-M04-26, E2E-M04-45/46)', () => {
  const list = (query = '') =>
    call<Page<StructuredRow, StructuredListMeta>>('GET', `/api/structured-questions${query}`, ADMIN)

  it('page 1: 25 rows, the newest first (4454, 4455, 4456), the observed anchors and the stats', async () => {
    const r = await list()
    expect(r.status).toBe(200)
    expect(r.body.meta).toMatchObject({
      page: 1,
      pageSize: 25,
      totalItems: 4064,
      totalPages: 163,
      from: 1,
      to: 25,
    })
    expect(r.body.data).toHaveLength(25)
    expect(r.body.data.slice(0, 3).map((x) => x.id)).toEqual([4454, 4455, 4456])
    expect(r.body.data[0]).toMatchObject({
      id: 4454,
      subject: { id: 23, name: 'Perniagaan' },
      level: { id: 11, name: 'Tingkatan 5' },
      kbatLevel: 3,
      totalMarks: 8,
      subCount: 1,
    })
    expect(r.body.data[0]?.stimulusExcerpt.startsWith('Soalan Oleh: Guru Pakar')).toBe(true)
    const { stats } = r.body.meta
    expect(stats.total).toBe(4064)
    expect(stats.published).toBe(4064)
    // Subject pills: alphabetical, count ≥ 1, the live counts.
    const names = stats.bySubject.map((s) => s.name)
    expect([...names].sort((a, b) => a.localeCompare(b, 'ms'))).toEqual(names)
    expect(stats.bySubject).toHaveLength(15)
    expect(stats.bySubject.find((s) => s.name === 'Bahasa Inggeris')?.count).toBe(774)
    expect(stats.bySubject.find((s) => s.name === 'Perniagaan')?.count).toBe(763)
    expect(stats.bySubject.reduce((n, s) => n + s.count, 0)).toBe(4064)
    expect(structured.count('Q-STRUCT-ALL')).toBe(4064)
    expect(structured.count('Q-STRUCT-VISIBLE')).toBe(4059)
  })

  it('cuts the stimulus at 100 characters', async () => {
    const r = await list()
    for (const row of r.body.data) {
      expect(row.stimulusExcerpt.length).toBeLessThanOrEqual(103)
    }
  })

  it('filters: KBAT 5 = 483, subject and level filters, page 2, the stats stay global', async () => {
    const kbat = await list('?kbatLevel=5')
    expect(kbat.body.meta).toMatchObject({ totalItems: 483, totalPages: 20 })
    expect(kbat.body.meta.stats.total).toBe(4064)
    const s3 = await list('?subjectId=3')
    expect(s3.body.meta.totalItems).toBe(299)
    const s1k6 = await list('?subjectId=1&kbatLevel=6')
    expect(s1k6.body.meta.totalItems).toBe(3)
    const level = await list('?educationLevelId=10')
    expect(level.body.data.every((x) => x.level?.id === 10)).toBe(true)
    const p2 = await list('?page=2')
    expect(p2.body.meta).toMatchObject({ page: 2, from: 26, to: 50 })
    expect(p2.body.data[0]?.id).not.toBe(4454)
    const last = await list('?page=163')
    expect(last.body.data).toHaveLength(14)
  })

  it('a subject with no structured question, an unknown or malformed filter and an empty page show nothing', async () => {
    const none = await list('?subjectId=18')
    expect(none.status).toBe(200)
    expect(none.body.data).toEqual([])
    expect(none.body.meta).toMatchObject({ totalItems: 0, totalPages: 1, from: null, to: null })
    expect((await list('?subjectId=abc')).body.data).toEqual([])
    expect((await list('?kbatLevel=99')).body.data).toEqual([])
    expect((await list('?page=999')).body.data).toEqual([])
    // Unknown keys are ignored; an empty value is no filter.
    expect((await list('?sort=x&subjectId=')).body.meta.totalItems).toBe(4064)
  })
})

describe('#19 S9 structured detail (BR-M04-27)', () => {
  const detail = (id: number) =>
    call<{ data: StructuredDetail }>('GET', `/api/structured-questions/${String(id)}`, ADMIN)

  it('3698: the sub-questions 2 + 4 + 4 = 10 marks, names and the creator', async () => {
    const r = await detail(3698)
    expect(r.status).toBe(200)
    const q = r.body.data
    expect(q).toMatchObject({
      id: 3698,
      subject: { id: 5, name: 'Sejarah' },
      level: { id: 11, name: 'Tingkatan 5' },
      kbatLevel: 3,
      status: 'published',
      isActive: true,
      questionNumber: 3,
      totalMarks: 10,
      visibility: 'public',
    })
    expect(q.subQuestions.map((s) => s.marks)).toEqual([2, 4, 4])
    expect(q.subQuestions.map((s) => s.partLabel.toUpperCase())).toEqual(['A', 'B', 'C'])
    expect(q.subQuestions.reduce((n, s) => n + s.marks, 0)).toBe(q.totalMarks)
    expect(q.subQuestions.map((s) => s.order)).toEqual(
      [...q.subQuestions.map((s) => s.order)].sort((a, b) => a - b),
    )
    expect(q.createdBy).toMatchObject({ id: expect.any(Number) as number })
    expect(typeof q.createdBy.name).toBe('string')
    // The store's count-only facets are not part of the API shape.
    expect(q).not.toHaveProperty('createdAtMs')
    expect(q).not.toHaveProperty('contribSchoolId')
  })

  it('4454: no question number, one sub-question "A" of 8 marks', async () => {
    const q = (await detail(4454)).body.data
    expect(q).toMatchObject({
      questionNumber: null,
      totalMarks: 8,
      topic: 'Merancang Pengendalian Perniagaan',
    })
    expect(q.subQuestions).toHaveLength(1)
    expect(q.subQuestions[0]).toMatchObject({ marks: 8 })
  })

  it('an inactive row is still served to the admin (3699), an unknown id is 404', async () => {
    expect((await detail(3699)).body.data.isActive).toBe(false)
    const missing = await detail(99_999_999)
    expect(missing.status).toBe(404)
    expect(errorCode(missing)).toBe('NOT_FOUND')
    expect((await call('GET', '/api/structured-questions/abc', ADMIN)).status).toBe(404)
  })
})

describe('#20–#22 S10 question papers (BR-M04-18, E2E-M04-48/49)', () => {
  const list = (query = '') =>
    call<Page<QuestionSubmission, SubmissionListMeta>>(
      'GET',
      `/api/question-submissions${query}`,
      ADMIN,
    )
  const patch = (id: number, body: unknown) =>
    call<SubmissionMutation | ErrorBody>(
      'PATCH',
      `/api/question-submissions/${String(id)}/status`,
      ADMIN,
      body,
    )

  it('lists the 6 papers, id descending, with the teacher name, e-mail and school and the global counts', async () => {
    const r = await list()
    expect(r.status).toBe(200)
    expect(r.body.data.map((s) => s.id)).toEqual([6, 5, 4, 3, 2, 1])
    expect(r.body.meta.counts).toEqual({ all: 6, pending: 1, processing: 3, done: 1, rejected: 1 })
    const four = r.body.data.find((s) => s.id === 4)
    expect(four).toMatchObject({
      subjectText: 'Perniagaan',
      levelCode: 'T4',
      year: 2026,
      status: 'done',
      files: [{ index: 0, name: 'PPSA K1 T4 2026.docx' }],
    })
    expect(four?.teacher).toEqual({
      id: 4504,
      name: 'Cikgu Demo 4504',
      email: 'cikgu4504@demo.test',
      school: expect.any(String) as string,
    })
    expect(r.body.data.find((s) => s.id === 1)).toMatchObject({
      note: 'Latih tubi kelas 5 Alfa pada 13 Mac 2026',
      files: [{ name: 'GEAR UP 1 TINGKATAN 5.pdf' }],
    })
    expect(r.body.data.find((s) => s.id === 3)?.files[0]?.name).toBe(
      'HIMPUNAN_SOALAN_SEJARAH_K1_IKUT_BAB_PERUBAAN_SPM_NEGERI_2024_TINGKATAN copy.pdf',
    )
    // Every teacher and every paper type is a seeded, fictitious account / a DATA-M04-05 value.
    for (const s of r.body.data) {
      expect(users.get(s.teacherId)?.role).toBe('teacher')
      expect(s.teacher.name).toMatch(/Demo/)
    }
    expect(
      r.body.data
        .filter((s) => s.files.length === 2)
        .map((s) => s.id)
        .sort(),
    ).toEqual([5, 6])
    expect(SEED_SUBMISSIONS).toHaveLength(6)
  })

  it('filters by status; the counts stay global; an unknown status is an empty list', async () => {
    const processing = await list('?status=processing')
    expect(processing.body.data.map((s) => s.id)).toEqual([3, 2, 1])
    expect(processing.body.meta.counts.all).toBe(6)
    expect((await list('?status=rejected')).body.data.map((s) => s.id)).toEqual([6])
    expect((await list('?status=pending')).body.data.map((s) => s.id)).toEqual([5])
    expect((await list('?status=done')).body.data.map((s) => s.id)).toEqual([4])
    expect((await list('?status=zzz')).body.data).toEqual([])
    expect((await list('?status=')).body.data).toHaveLength(6)
  })

  it('#21 saves status and note, answers the flash, recounts and lets any status follow any other', async () => {
    dirty = true
    const r = await patch(4, { status: 'done', adminNotes: 'Sudah diproses ke bank soalan.' })
    expect(r.status).toBe(200)
    expect((r.body as SubmissionMutation).status).toBe(SUBMISSION_SAVED_TEXT)
    expect(SUBMISSION_SAVED_TEXT).toBe('Status kertas soalan berjaya dikemaskini.')
    expect((r.body as SubmissionMutation).data).toMatchObject({
      id: 4,
      status: 'done',
      adminNotes: 'Sudah diproses ke bank soalan.',
      teacher: { id: 4504 },
    })
    const back = await patch(4, { status: 'pending' })
    expect((back.body as SubmissionMutation).data).toMatchObject({
      status: 'pending',
      // An omitted note is kept (INFERRED).
      adminNotes: 'Sudah diproses ke bank soalan.',
    })
    expect((await list()).body.meta.counts).toEqual({
      all: 6,
      pending: 2,
      processing: 3,
      done: 0,
      rejected: 1,
    })
    // An empty note clears it.
    const cleared = await patch(4, { status: 'rejected', adminNotes: '' })
    expect((cleared.body as SubmissionMutation).data.adminNotes).toBeNull()
    expect((await list()).body.meta.counts).toEqual({
      all: 6,
      pending: 1,
      processing: 3,
      done: 0,
      rejected: 2,
    })
  })

  it('#21 refuses an unknown or missing status and a note over 1,000 characters (422 with fields)', async () => {
    const bad = await patch(4, { status: 'archived' })
    expect(bad.status).toBe(422)
    expect(errorCode(bad)).toBe('VALIDATION_ERROR')
    expect(fieldsOf(bad)).toEqual({ status: SUBMISSION_STATUS_MESSAGE })
    expect(fieldsOf(await patch(4, {}))).toEqual({ status: SUBMISSION_STATUS_MESSAGE })
    expect(fieldsOf(await patch(4, { status: 'done', adminNotes: 'x'.repeat(1001) }))).toEqual({
      adminNotes: SUBMISSION_NOTES_MESSAGE,
    })
    expect(SUBMISSION_NOTES_MESSAGE).toContain('1000')
    // Exactly 1,000 is allowed.
    dirty = true
    expect((await patch(4, { status: 'done', adminNotes: 'x'.repeat(1000) })).status).toBe(200)
    expect(submissions.get(4)?.adminNotes).toHaveLength(1000)
  })

  it('#21 answers 404 for an unknown id (before validating the body)', async () => {
    const r = await patch(99_999, { status: 'zzz' })
    expect(r.status).toBe(404)
    expect(errorCode(r)).toBe('NOT_FOUND')
  })

  it('#22 downloads a placeholder text file that carries the file name', async () => {
    const r = await call<Blob>('GET', '/api/question-submissions/4/files/0', ADMIN)
    expect(r.status).toBe(200)
    expect(r.headers['content-type']).toBe('text/plain')
    expect(r.headers['content-disposition']).toContain('PPSA K1 T4 2026.docx')
    expect(await r.body.text()).toContain('PPSA K1 T4 2026.docx')
    const second = await call<Blob>('GET', '/api/question-submissions/5/files/1', ADMIN)
    expect(await second.body.text()).toContain('SKEMA MATEMATIK K1 T4 2026.pdf')
  })

  it('#22 answers 404 for an unknown paper or file index', async () => {
    expect((await call('GET', '/api/question-submissions/4/files/1', ADMIN)).status).toBe(404)
    expect((await call('GET', '/api/question-submissions/99999/files/0', ADMIN)).status).toBe(404)
    expect((await call('GET', '/api/question-submissions/4/files/-1', ADMIN)).status).toBe(404)
  })

  it('M10 uploads a paper through the repository: it starts pending and gets the next id', async () => {
    dirty = true
    const row = submissions.create(
      {
        teacherId: 4501,
        subjectText: 'Sains',
        levelCode: 'T5',
        year: 2026,
        paperType: 'Trial Paper',
        authorCredit: 'Oleh: Cikgu Demo 4501',
        files: [{ name: 'a.pdf', size: 10, mime: 'application/pdf' }],
      },
      Date.parse('2026-09-25T15:40:00+08:00'),
    )
    expect(row).toMatchObject({
      id: 7,
      status: 'pending',
      adminNotes: null,
      files: [{ index: 0, name: 'a.pdf' }],
    })
    expect((await list()).body.meta.counts).toMatchObject({ all: 7, pending: 2 })
    expect(() => submissions.create({ ...row, files: [] }, 0)).toThrow()
  })
})

describe('#23 S11 diagram audit (BR-M04-19, E2E-M04-50)', () => {
  const audit = (query = '') => call<DiagramAudit>('GET', `/api/diagram-audit${query}`, ADMIN)

  it('unfiltered: 6,144 MCQ + 522 structured = 6,666, the live top-10 subject pills, 20 per page, id descending', async () => {
    const r = await audit()
    expect(r.status).toBe(200)
    expect(r.body.meta.stats).toEqual({ mcq: 6144, structured: 522, total: 6666 })
    expect(r.body.meta.unfilteredMcq).toBe(6144)
    expect(r.body.meta.bySubject).toEqual([
      { name: 'Biologi', count: 1587 },
      { name: 'Kimia', count: 1077 },
      { name: 'Fizik', count: 718 },
      { name: 'Sains', count: 662 },
      { name: 'Ekonomi', count: 570 },
      { name: 'Prinsip Perakaunan', count: 393 },
      { name: 'Matematik', count: 336 },
      { name: 'Geografi', count: 320 },
      { name: 'Perniagaan', count: 249 },
      { name: 'Pendidikan Moral', count: 60 },
    ])
    const { mcq, structured: str } = r.body.data
    expect(mcq.meta).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 6144,
      totalPages: 308,
      from: 1,
      to: 20,
    })
    expect(mcq.items).toHaveLength(20)
    const ids = mcq.items.map((i) => i.id)
    expect([...ids].sort((a, b) => b - a)).toEqual(ids)
    expect(mcq.items[0]).toMatchObject({
      id: expect.any(Number) as number,
      subject: { id: expect.any(Number) as number },
      createdBy: { id: expect.any(Number) as number },
    })
    expect(str.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 522, totalPages: 27 })
    expect(str.items).toHaveLength(20)
    for (const i of str.items) expect(i.stimulusExcerpt.length).toBeLessThanOrEqual(403)
    const strIds = str.items.map((i) => i.id)
    expect([...strIds].sort((a, b) => b - a)).toEqual(strIds)
  })

  it('the observed flagged anchors are in the list with their subject, file and page', async () => {
    const r = await audit('?subjectId=11&mcqPage=1')
    expect(r.body.meta.stats.mcq).toBe(1587)
    const row =
      (await call<Page<never>>('GET', '/api/diagram-audit', ADMIN)) && questions.get(563_393)
    expect(row).toMatchObject({
      needsDiagram: true,
      sourceFile: 'T5-BT-BIO---BIOLOGI.pdf',
      sourcePage: 1,
    })
  })

  it('subjectId filters both lists and the stat cards; the pills stay global (DV-M04-11)', async () => {
    const r = await audit('?subjectId=9')
    expect(r.body.meta.stats).toEqual({ mcq: 718, structured: 6, total: 724 })
    expect(r.body.data.mcq.meta.totalItems).toBe(718)
    expect(r.body.data.structured.meta.totalItems).toBe(6)
    expect(r.body.data.mcq.items.every((i) => i.subject?.id === 9)).toBe(true)
    expect(r.body.data.structured.items.every((i) => i.subject?.id === 9)).toBe(true)
    expect(r.body.meta.bySubject).toHaveLength(10)
    expect(r.body.meta.bySubject[0]).toEqual({ name: 'Biologi', count: 1587 })
    expect(r.body.meta.unfilteredMcq).toBe(6144)
  })

  it('pages each list on its own key: mcqPage and strPage', async () => {
    const p2 = await audit('?mcqPage=2')
    expect(p2.body.data.mcq.meta).toMatchObject({ page: 2, from: 21, to: 40 })
    expect(p2.body.data.structured.meta.page).toBe(1)
    const s2 = await audit('?strPage=2')
    expect(s2.body.data.structured.meta).toMatchObject({ page: 2, from: 21, to: 40 })
    expect(s2.body.data.mcq.meta.page).toBe(1)
    const first = (await audit('?subjectId=9')).body.data.mcq.items[0]?.id
    const second = (await audit('?subjectId=9&mcqPage=2')).body.data.mcq.items[0]?.id
    expect(second).not.toBe(first)
    const beyond = await audit('?mcqPage=99999')
    expect(beyond.body.data.mcq.items).toEqual([])
  })

  it('schoolId filters the MCQ list only (BR-M04-19): a school with no flagged MCQ leaves the structured list unfiltered', async () => {
    const r = await audit('?schoolId=380')
    expect(r.body.meta.stats).toEqual({ mcq: 0, structured: 522, total: 522 })
    expect(r.body.data.mcq.items).toEqual([])
    expect(r.body.data.mcq.meta.totalItems).toBe(0)
    expect(r.body.data.structured.meta.totalItems).toBe(522)
    // The subject pills still show the global figures.
    expect(r.body.meta.bySubject[0]).toEqual({ name: 'Biologi', count: 1587 })
    // The school of the seeded question creators: every flagged generated MCQ has one creator.
    const schoolId = users.get(5801)?.schoolId
    if (schoolId !== null && schoolId !== undefined) {
      const own = await audit(`?schoolId=${String(schoolId)}`)
      expect(own.body.meta.stats.mcq).toBeGreaterThan(0)
      expect(own.body.meta.stats.mcq).toBeLessThanOrEqual(6144)
      expect(own.body.meta.stats.structured).toBe(522)
    }
  })

  it('subjects without a flagged question show neither section (Bahasa Cina, E2E-M04-50)', async () => {
    const r = await audit('?subjectId=19')
    expect(r.body.meta.stats).toEqual({ mcq: 0, structured: 0, total: 0 })
    expect(r.body.data.mcq.items).toEqual([])
    expect(r.body.data.structured.items).toEqual([])
    // Bahasa Arab: MCQ only.
    const arab = await audit('?subjectId=18')
    expect(arab.body.meta.stats.mcq).toBe(5)
    expect(arab.body.meta.stats.structured).toBe(0)
    expect((await audit('?subjectId=abc')).body.meta.stats.total).toBe(0)
  })

  it('#24 an uploaded diagram clears the flag, stores the image reference and moves the counts (E2E-M04-51)', async () => {
    dirty = true
    const r = await call<DiagramMutation>(
      'POST',
      '/api/diagram-audit/mcq/563393/image',
      ADMIN,
      form({}, { image: pngFile('rajah.png') }),
    )
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual({ id: 563_393, needsDiagram: false })
    expect(r.body.status).toBe(DIAGRAM_UPLOADED_TEXT)
    expect(DIAGRAM_UPLOADED_TEXT).toBe('Gambar rajah berjaya dimuat naik.')
    expect(questions.get(563_393)).toMatchObject({ needsDiagram: false })
    expect(questions.get(563_393)?.questionImage).toMatch(/^blob:/)
    expect(questions.count('Q-FLAGGED-MCQ')).toBe(6143)
    const after = await audit()
    expect(after.body.meta.stats.mcq).toBe(6143)
    expect(after.body.meta.unfilteredMcq).toBe(6143)
    expect(after.body.meta.bySubject[0]).toEqual({ name: 'Biologi', count: 1586 })
    expect(after.body.data.mcq.items.map((i) => i.id)).not.toContain(563_393)
  })

  it('#24 a structured upload sets its stimulus image', async () => {
    dirty = true
    const before = await audit()
    const id = before.body.data.structured.items[0]?.id as number
    const r = await call<DiagramMutation>(
      'POST',
      `/api/diagram-audit/structured/${String(id)}/image`,
      ADMIN,
      form({}, { image: pngFile('struktur.webp', 'image/webp') }),
    )
    expect(r.status).toBe(200)
    expect(structured.get(id)).toMatchObject({ needsDiagram: false })
    expect(structured.get(id)?.stimulusImage).toMatch(/^blob:/)
    expect((await audit()).body.meta.stats.structured).toBe(521)
  })

  it('#24 refuses a missing file, a non-image, SVG and a file over 2 MB (422, image field)', async () => {
    const url = '/api/diagram-audit/mcq/563393/image'
    const missing = await call('POST', url, ADMIN, form({}))
    expect(missing.status).toBe(422)
    expect(fieldsOf(missing)).toEqual({ image: DIAGRAM_FILE_REQUIRED })
    expect(DIAGRAM_FILE_REQUIRED).toBe('Sila pilih fail gambar.')
    expect(fieldsOf(await call('POST', url, ADMIN, {}))).toEqual({ image: DIAGRAM_FILE_REQUIRED })
    const pdf = await call(
      'POST',
      url,
      ADMIN,
      form({}, { image: pngFile('a.pdf', 'application/pdf') }),
    )
    expect(fieldsOf(pdf)).toEqual({ image: DIAGRAM_FILE_REQUIRED })
    const svg = await call(
      'POST',
      url,
      ADMIN,
      form({}, { image: pngFile('a.svg', 'image/svg+xml') }),
    )
    expect(svg.status).toBe(422)
    expect(fieldsOf(svg)).toEqual({ image: DIAGRAM_FILE_TYPE })
    // The browser may send no type: the extension is still checked.
    expect(
      fieldsOf(await call('POST', url, ADMIN, form({}, { image: pngFile('b.svg', '') }))),
    ).toEqual({
      image: DIAGRAM_FILE_TYPE,
    })
    const bmp = await call('POST', url, ADMIN, form({}, { image: pngFile('a.bmp', 'image/bmp') }))
    expect(fieldsOf(bmp)).toEqual({ image: DIAGRAM_FILE_TYPE })
    const big = await call(
      'POST',
      url,
      ADMIN,
      form({}, { image: pngFile('big.png', 'image/png', 2 * 1024 * 1024 + 1) }),
    )
    expect(fieldsOf(big)).toEqual({ image: DIAGRAM_FILE_TYPE })
    expect(questions.get(563_393)?.needsDiagram).toBe(true)
    // 2 MB exactly is fine.
    dirty = true
    const exact = await call(
      'POST',
      url,
      ADMIN,
      form({}, { image: pngFile('ok.jpg', 'image/jpeg', 2 * 1024 * 1024) }),
    )
    expect(exact.status).toBe(200)
  })

  it('#25 dismiss clears the flag only and answers the flash', async () => {
    dirty = true
    const r = await call<DiagramMutation>('POST', '/api/diagram-audit/mcq/562177/dismiss', ADMIN)
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual({ id: 562_177, needsDiagram: false })
    expect(r.body.status).toBe(DIAGRAM_DISMISSED_TEXT)
    expect(DIAGRAM_DISMISSED_TEXT).toBe('Soalan telah dikeluarkan daripada senarai audit.')
    expect(questions.get(562_177)).toMatchObject({ needsDiagram: false, questionImage: null })
    expect(questions.count('Q-FLAGGED-MCQ')).toBe(6143)
    const id = (await audit()).body.data.structured.items[0]?.id as number
    const s = await call<DiagramMutation>(
      'POST',
      `/api/diagram-audit/structured/${String(id)}/dismiss`,
      ADMIN,
    )
    expect(s.body.data).toEqual({ id, needsDiagram: false })
    expect(structured.count('Q-FLAGGED-STR')).toBe(521)
  })

  it('memoised pills and school creators are identical when warm and dropped by every write', async () => {
    dirty = true
    const now = Date.parse('2026-09-25T15:40:00+08:00')
    const cold = await audit()
    const warm = await audit()
    expect(warm.body).toEqual(cold.body)
    expect(warm.body.meta.bySubject[0]).toEqual({ name: 'Biologi', count: 1587 })

    // Question update (a flag moves to another subject): the pills follow.
    questions.update(563_393, { subjectId: 3 }, now)
    const moved = await audit()
    expect(moved.body.meta.bySubject.find((p) => p.name === 'Biologi')?.count).toBe(1586)
    expect(moved.body.meta.bySubject.find((p) => p.name === 'Matematik')?.count).toBe(337)

    // Question create + delete and a dismiss through the endpoint.
    const made = questions.create(
      {
        subjectId: 11,
        educationLevelId: 11,
        difficultyLevel: 1,
        questionText: 'Soalan baharu yang ditanda perlu gambar rajah.',
        options: ['a', 'b', 'c', 'd'],
        correctAnswer: 0,
      },
      { createdBy: ADMIN, now },
    )
    questions.update(made.id, { needsDiagram: true }, now)
    expect((await audit()).body.meta.bySubject[0]).toEqual({ name: 'Biologi', count: 1587 })
    questions.remove(made.id)
    expect((await audit()).body.meta.bySubject[0]).toEqual({ name: 'Biologi', count: 1586 })
    await call('POST', '/api/diagram-audit/mcq/562177/dismiss', ADMIN)
    expect(
      (await audit()).body.meta.bySubject.find((p) => p.name === 'Pendidikan Moral')?.count,
    ).toBe(59)

    // The creators of a school: a user edit is a write too.
    expect((await audit('?schoolId=380')).body.meta.stats.mcq).toBe(0)
    users.update(5801, { schoolId: 380 }, now)
    expect((await audit('?schoolId=380')).body.meta.stats.mcq).toBeGreaterThan(0)
  })

  it('#24/#25 answer 404 for an unknown id, a PKSK row and an unknown kind', async () => {
    const img = form({}, { image: pngFile() })
    expect((await call('POST', '/api/diagram-audit/mcq/99999999/image', ADMIN, img)).status).toBe(
      404,
    )
    expect(
      (await call('POST', '/api/diagram-audit/structured/99999999/image', ADMIN, img)).status,
    ).toBe(404)
    expect((await call('POST', '/api/diagram-audit/mcq/178460/image', ADMIN, img)).status).toBe(404)
    expect((await call('POST', '/api/diagram-audit/mcq/99999999/dismiss', ADMIN)).status).toBe(404)
    expect(
      (await call('POST', '/api/diagram-audit/structured/99999999/dismiss', ADMIN)).status,
    ).toBe(404)
    expect((await call('POST', '/api/diagram-audit/mcq/178460/dismiss', ADMIN)).status).toBe(404)
    expect((await call('POST', '/api/diagram-audit/essay/563393/dismiss', ADMIN)).status).toBe(404)
    expect((await call('POST', '/api/diagram-audit/essay/563393/image', ADMIN, img)).status).toBe(
      404,
    )
    expect(questions.get(563_393)?.needsDiagram).toBe(true)
  })
})

describe('#26–#27 S12 master notes (BR-M04-23, E2E-M04-52/53)', () => {
  const list = (query = '') =>
    call<Page<MasterNoteRow, MasterNoteListMeta>>('GET', `/api/master-notes${query}`, ADMIN)
  const act = (id: number, action: string) =>
    call<{ ok: boolean } | ErrorBody>('POST', `/api/master-notes/${String(id)}/${action}`, ADMIN)

  it('the default set: 525 notes, none flagged, none approved; the flagged tab is empty', async () => {
    const r = await list()
    expect(r.status).toBe(200)
    expect(r.body.meta.activeTab).toBe('flagged')
    expect(r.body.meta.summary).toEqual({ flagged: 0, teacherApproved: 0, total: 525 })
    expect(r.body.data).toEqual([])
    expect(r.body.meta).toMatchObject({ totalItems: 0, totalPages: 1 })
    expect((await list('?tab=approved')).body.data).toEqual([])
    const seeded = defaultMasterNotes(() => true)
    expect(seeded).toHaveLength(525)
    expect(seeded.map((n) => n.id)).toEqual(Array.from({ length: 525 }, (_, i) => i + 1))
    expect(seeded.some((n) => n.flagged || n.teacherApproved)).toBe(false)
  })

  it('"Semua": 15 per page, id descending, 35 pages, the observed S12 samples first', async () => {
    const r = await list('?tab=all')
    expect(r.body.meta).toMatchObject({
      page: 1,
      pageSize: 15,
      totalItems: 525,
      totalPages: 35,
      from: 1,
      to: 15,
    })
    expect(r.body.data.map((n) => n.id)).toEqual(Array.from({ length: 15 }, (_, i) => 525 - i))
    expect(r.body.data.slice(0, 3)).toMatchObject([
      {
        questionId: 122_411,
        subjectName: 'Fizik',
        chapter: 'Fizik Tingkatan 5',
        model: 'gpt-4o-mini',
        tokens: 730,
        confidence: 85,
      },
      {
        questionId: 560_001,
        subjectName: 'Matematik',
        chapter: 'Fungsi dan Persamaan Kuadratik',
        tokens: 812,
        confidence: 85,
      },
      {
        questionId: 559_916,
        subjectName: 'Matematik',
        chapter: 'Kebarangkalian Peristiwa Bergabung',
        tokens: 790,
        confidence: 85,
      },
    ])
    expect(r.body.data[0]?.questionText).toBe(
      'Apakah yang berlaku dalam litar apabila berlaku litar pintas (short circuit)?',
    )
    expect(r.body.data[0]?.trapText).toBe('Salah faham tentang arus dalam litar pintas.')
    // 129732, 129650, 129614: Bahasa Inggeris pool rows, subject and text read from the question.
    expect(r.body.data.slice(3, 6).map((n) => n.questionId)).toEqual([129_732, 129_650, 129_614])
    for (const n of r.body.data.slice(3, 6)) {
      expect(n.subjectName).toBe('Bahasa Inggeris')
      expect(n.chapter).toBeNull()
      expect(n.questionText).toBe(questions.get(n.questionId)?.questionText)
    }
    const last = await list('?tab=all&page=35')
    expect(last.body.data).toHaveLength(15)
    expect(last.body.data.at(-1)?.id).toBe(1)
    expect((await list('?tab=all&page=36')).body.data).toEqual([])
    // Every filler note points at an existing question and reads its subject.
    for (const n of (await list('?tab=all&page=10')).body.data) {
      expect(questions.get(n.questionId), `note ${String(n.id)}`).not.toBeNull()
      expect(n.subjectName).not.toBe('—')
      expect(n.tokens).toBeGreaterThanOrEqual(700)
      expect(n.tokens).toBeLessThanOrEqual(1400)
      expect([70, 85, 90]).toContain(n.confidence)
    }
  })

  it('an unknown tab shows the default flagged tab', async () => {
    dirty = true
    await runtime.reset({ masterNotes: { flagged: [1, 2, 3], approved: [4, 5] } })
    const r = await list('?tab=zzz')
    expect(r.body.meta.activeTab).toBe('flagged')
    expect(r.body.data.map((n) => n.id)).toEqual([3, 2, 1])
  })

  it('override reset({masterNotes:{flagged:[1,2,3], approved:[4,5]}}): the summary and the tabs (E2E-M04-52)', async () => {
    dirty = true
    await runtime.reset({ masterNotes: { flagged: [1, 2, 3], approved: [4, 5] } })
    const r = await list()
    expect(r.body.meta.summary).toEqual({ flagged: 3, teacherApproved: 2, total: 525 })
    expect(r.body.data.map((n) => n.id)).toEqual([3, 2, 1])
    expect(r.body.data.every((n) => n.flagged)).toBe(true)
    const approved = await list('?tab=approved')
    expect(approved.body.data.map((n) => n.id)).toEqual([5, 4])
    expect(approved.body.data.every((n) => n.teacherApproved)).toBe(true)
    expect((await list('?tab=all')).body.meta.totalItems).toBe(525)
  })

  it('an override with an unknown note or another shape is refused at seed time', async () => {
    dirty = true
    await expect(runtime.reset({ masterNotes: { flagged: [9999] } })).rejects.toThrow(
      /unknown note/,
    )
    await expect(runtime.reset({ masterNotes: { nope: [1] } })).rejects.toThrow(/unknown key/)
    await expect(runtime.reset({ masterNotes: { approved: 'x' } })).rejects.toThrow(/array/)
  })

  it('#27 approve: approved and unflagged; unflag: unflagged; the response is HTTP 200 {ok:true}', async () => {
    dirty = true
    await runtime.reset({ masterNotes: { flagged: [1, 2, 3], approved: [4, 5] } })
    const a = await act(1, 'approve')
    expect(a.status).toBe(200)
    expect(a.body).toEqual({ ok: true })
    expect(masterNotes.get(1)).toMatchObject({ teacherApproved: true, flagged: false })
    expect((await act(2, 'unflag')).status).toBe(200)
    expect(masterNotes.get(2)).toMatchObject({ teacherApproved: false, flagged: false })
    const r = await list()
    expect(r.body.meta.summary).toEqual({ flagged: 1, teacherApproved: 3, total: 525 })
    expect(r.body.data.map((n) => n.id)).toEqual([3])
    expect((await list('?tab=approved')).body.data.map((n) => n.id)).toEqual([5, 4, 1])
  })

  it('#27 regen: the next canned note replaces text, trap and tokens and keeps the flags; 3 texts cycle', async () => {
    dirty = true
    await runtime.reset({ masterNotes: { flagged: [3], approved: [4] } })
    const seen: string[] = []
    for (let i = 0; i < 4; i++) {
      const r = await act(3, 'regen')
      expect(r.status).toBe(200)
      expect(r.body).toEqual({ ok: true })
      const n = masterNotes.get(3)
      expect(n).toMatchObject({ flagged: true, teacherApproved: false })
      seen.push(n?.noteText ?? '')
    }
    expect(seen.slice(0, 3)).toEqual(CANNED_NOTES.map((c) => c.noteText))
    expect(seen[3]).toBe(seen[0])
    expect(masterNotes.get(3)).toMatchObject({
      trapText: CANNED_NOTES[0]?.trapText,
      tokens: CANNED_NOTES[0]?.tokens,
    })
    // A reload shows the canned note.
    const row = (await list('?tab=flagged')).body.data.find((n) => n.id === 3)
    expect(row?.noteText).toBe(CANNED_NOTES[0]?.noteText)
    expect(new Set(CANNED_NOTES.map((c) => c.noteText)).size).toBe(3)
  })

  it('#27 answers 404 for an unknown note or action (the page judges by the status)', async () => {
    const missing = await act(99_999, 'approve')
    expect(missing.status).toBe(404)
    expect(errorCode(missing)).toBe('NOT_FOUND')
    expect((await act(1, 'delete')).status).toBe(404)
    expect((await act(0, 'regen')).status).toBe(404)
    expect(masterNotes.get(1)).toMatchObject({ teacherApproved: false })
  })

  it('an injected failure answers a non-2xx status and changes nothing', async () => {
    dirty = true
    await runtime.reset({ masterNotes: { flagged: [7] } })
    runtime.faults.failNext('/api/master-notes/7/unflag', 500)
    const failed = await act(7, 'unflag')
    expect(failed.status).toBe(500)
    expect(masterNotes.get(7)?.flagged).toBe(true)
    expect((await act(7, 'unflag')).status).toBe(200)
  })
})
