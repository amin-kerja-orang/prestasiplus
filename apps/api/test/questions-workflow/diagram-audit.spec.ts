import { DIAGRAM_AUDIT_MESSAGES, DiagramAuditMutationSchema, DiagramAuditResponseSchema, type DiagramAuditResponse } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DiagramCandidate } from '../../src/modules/questions/workflow/ports'
import { makePng } from '../files/fixtures'
import { bootWorkflowApp, count, expectCsrfInvalid, expectError, loginAll, type Client, type WorkflowTestApp } from './helpers'
import { loginRaw, tempStorageDir, type RawClient } from './misc-support'

type Roles = Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>

describe('diagram audit (BE-10 AC 7 area, BR-M04-19)', () => {
  let t: WorkflowTestApp
  let c: Roles
  let raw: RawClient
  let schoolId: string
  let subjectIds: string[]

  const candidate = (id: string, kind: 'mcq' | 'structured', extra: Partial<DiagramCandidate> = {}): void => {
    t.fake.seed({
      id,
      diagram: {
        id, kind, text: `Teks ${id}`, subjectId: subjectIds[0]!, subjectName: 'Matematik',
        createdBy: { id: c.teacher.userId, name: 'Guru Demo', schoolId }, sourceFile: 'kertas.pdf', sourcePage: 3, ...extra,
      },
    })
  }
  const list = async (query = ''): Promise<DiagramAuditResponse> => {
    const res = await c.admin.get(`/api/diagram-audit${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return DiagramAuditResponseSchema.parse(res.body)
  }
  const upload = (r: RawClient, path: string, file?: { data: Buffer; name: string; type: string }, csrf = true) => {
    let req = r.agent.post(path)
    if (csrf) req = req.set('X-CSRF-Token', r.csrf)
    return file ? req.attach('image', file.data, { filename: file.name, contentType: file.type }) : req.field('note', 'x')
  }
  const png = { data: makePng(), name: 'rajah.png', type: 'image/png' }

  beforeAll(async () => {
    t = await bootWorkflowApp({ env: { FILE_STORAGE_DIR: tempStorageDir() } })
    c = await loginAll(t)
    raw = await loginRaw(t, 'admin')
    schoolId = (await t.db.query<{ s: string }>('select school_id::text s from users where id = $1::bigint', [c.teacher.userId]))[0]!.s
    subjectIds = (await t.db.query<{ id: string }>('select id::text from subjects order by id limit 2')).map((r) => r.id)
    for (let i = 1; i <= 23; i += 1) candidate(String(200 + i), 'mcq')
    candidate('300', 'mcq', { subjectId: subjectIds[1]!, subjectName: 'Sains', createdBy: { id: '99999', name: null, schoolId: '77777' } })
    candidate('401', 'structured', { text: 'x'.repeat(450) })
    candidate('402', 'structured', { subjectId: subjectIds[1]!, subjectName: 'Sains' })
  })
  afterAll(async () => {
    await t.close()
  })

  describe('roles', () => {
    it('401 without a session and 403 for teacher, school admin and student on every route', async () => {
      expectError(await t.http().get('/api/diagram-audit'), 'UNAUTHORIZED')
      expectError(await t.http().post('/api/diagram-audit/mcq/201/dismiss'), 'UNAUTHORIZED')
      for (const who of [c.teacher, c.schoolAdmin, c.student]) {
        expectError(await who.get('/api/diagram-audit'), 'FORBIDDEN')
        expectError(await who.post('/api/diagram-audit/mcq/201/dismiss'), 'FORBIDDEN')
        expectError(await who.post('/api/diagram-audit/mcq/201/image'), 'FORBIDDEN')
      }
    })

    it('a write without CSRF is 403 CSRF_INVALID', async () => {
      expectCsrfInvalid(await c.admin.noCsrf.post('/api/diagram-audit/mcq/201/dismiss'))
      expectCsrfInvalid(await upload(raw, '/api/diagram-audit/mcq/201/image', png, false))
    })

    it('an unknown kind or id is 404', async () => {
      expectError(await c.admin.post('/api/diagram-audit/essay/201/dismiss'), 'NOT_FOUND')
      expectError(await c.admin.post('/api/diagram-audit/mcq/999999/dismiss'), 'NOT_FOUND')
      expectError(await c.admin.post('/api/diagram-audit/mcq/abc/dismiss'), 'NOT_FOUND')
      expectError(await c.admin.post('/api/diagram-audit/structured/201/dismiss'), 'NOT_FOUND') // 201 is an MCQ
      expectError(await upload(raw, '/api/diagram-audit/mcq/999999/image', png), 'NOT_FOUND')
    })
  })

  describe('list', () => {
    it('both lists, id descending, 20 per page, with the aggregates', async () => {
      const r = await list()
      expect(r.data.mcq.items).toHaveLength(20)
      expect(r.data.mcq.items[0]!.id).toBe('300')
      expect(r.data.mcq.meta).toEqual({ page: 1, pageSize: 20, totalItems: 24, totalPages: 2, from: 1, to: 20 })
      expect(r.data.structured.meta.totalItems).toBe(2)
      expect(r.meta.stats).toEqual({ mcq: 24, structured: 2, total: 26 })
      expect(r.meta.unfilteredMcq).toBe(24)
      expect(r.meta.bySubject).toEqual([{ name: 'Matematik', count: 23 }, { name: 'Sains', count: 1 }])
      expect(r.data.mcq.items[1]).toMatchObject({ id: '223', questionText: 'Teks 223', sourceFile: 'kertas.pdf', sourcePage: 3, createdBy: { id: c.teacher.userId } })
    })

    it('page 2 holds the rest and an out-of-range or invalid page is empty or page 1', async () => {
      const p2 = await list('?mcqPage=2')
      expect(p2.data.mcq.items).toHaveLength(4)
      expect(p2.data.mcq.meta).toMatchObject({ page: 2, from: 21, to: 24 })
      expect((await list('?mcqPage=9')).data.mcq.meta).toMatchObject({ page: 9, from: null, to: null, totalPages: 2 })
      expect((await list('?mcqPage=abc')).data.mcq.meta.page).toBe(1)
    })

    it('a structured text over 400 characters is cut with "..."', async () => {
      const r = await list()
      const long = r.data.structured.items.find((i) => i.id === '401')!
      expect(long.stimulusExcerpt).toBe(`${'x'.repeat(400)}...`)
    })

    it('the subject filter applies to both lists, the school filter to MCQ only, pills stay global', async () => {
      const bySubject = await list(`?subjectId=${subjectIds[1]}`)
      expect(bySubject.meta.stats).toEqual({ mcq: 1, structured: 1, total: 2 })
      expect(bySubject.meta.bySubject).toHaveLength(2)
      expect(bySubject.meta.unfilteredMcq).toBe(24)
      const bySchool = await list(`?schoolId=${schoolId}`)
      expect(bySchool.meta.stats).toMatchObject({ mcq: 23, structured: 2 })
    })

    it('a malformed or unknown filter matches nothing', async () => {
      expect((await list('?subjectId=abc')).meta.stats.total).toBe(0)
      expect((await list('?subjectId=987654')).meta.stats.total).toBe(0)
      expect((await list('?schoolId=987654')).meta.stats.mcq).toBe(0)
    })
  })

  describe('dismiss', () => {
    it('removes the question from the list and records a resolution', async () => {
      const res = await c.admin.post('/api/diagram-audit/mcq/300/dismiss')
      expect(res.status).toBe(200)
      expect(DiagramAuditMutationSchema.parse(res.body)).toEqual({ data: { id: '300', needsDiagram: false }, status: DIAGRAM_AUDIT_MESSAGES.dismissed })
      expect(await count(t.db, "select count(*) n from diagram_audit_resolutions where kind = 'mcq' and question_id = 300 and resolution = 'dismissed' and file_id is null")).toBe(1)
      const r = await list()
      expect(r.meta.stats.mcq).toBe(23)
      expect(r.data.mcq.items.some((i) => i.id === '300')).toBe(false)
      expect(r.meta.bySubject).toEqual([{ name: 'Matematik', count: 23 }])
    })

    it('dismissing again is accepted and keeps one row', async () => {
      expect((await c.admin.post('/api/diagram-audit/mcq/300/dismiss')).status).toBe(200)
      expect(await count(t.db, 'select count(*) n from diagram_audit_resolutions where question_id = 300')).toBe(1)
    })

    it('a structured question is dismissed in its own list', async () => {
      expect((await c.admin.post('/api/diagram-audit/structured/402/dismiss')).status).toBe(200)
      expect((await list()).meta.stats.structured).toBe(1)
    })
  })

  describe('image upload', () => {
    it('stores the file through the files module, attaches it and resolves the question', async () => {
      const res = await upload(raw, '/api/diagram-audit/mcq/201/image', png)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(DiagramAuditMutationSchema.parse(res.body)).toEqual({ data: { id: '201', needsDiagram: false }, status: DIAGRAM_AUDIT_MESSAGES.uploaded })
      const [file] = await t.db.query<{ id: string; purpose: string; mime: string; owner: string }>("select id::text, purpose, mime, owner_user_id::text owner from files where purpose = 'question_image'")
      expect(file).toMatchObject({ purpose: 'question_image', mime: 'image/png', owner: raw.userId })
      expect(t.fake.questions.get('201')!.diagramFileId).toBe(file!.id)
      expect(await count(t.db, "select count(*) n from diagram_audit_resolutions where question_id = 201 and resolution = 'image' and file_id = $1::bigint", [file!.id])).toBe(1)
      expect((await list()).data.mcq.items.some((i) => i.id === '201')).toBe(false)
    })

    it('a structured question accepts an image too', async () => {
      expect((await upload(raw, '/api/diagram-audit/structured/401/image', png)).status).toBe(200)
      expect(t.fake.questions.get('401')!.diagramFileId).not.toBeNull()
    })

    it('no file part is 422 "Sila pilih fail gambar."', async () => {
      const res = await upload(raw, '/api/diagram-audit/mcq/202/image')
      expectError(res, 'VALIDATION_ERROR')
      expect(res.body.error.fields).toEqual({ image: DIAGRAM_AUDIT_MESSAGES.fileRequired })
    })

    it('a file that is not an image is 422 "Sila pilih fail gambar."', async () => {
      const res = await upload(raw, '/api/diagram-audit/mcq/202/image', { data: Buffer.from('abc'), name: 'nota.txt', type: 'text/plain' })
      expect(res.body.error.fields).toEqual({ image: DIAGRAM_AUDIT_MESSAGES.fileRequired })
    })

    it('SVG, GIF, a wrong extension, a disguised file and an image over 2 MB are 422 with the type message', async () => {
      const cases: [string, { data: Buffer; name: string; type: string }][] = [
        ['svg', { data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), name: 'rajah.svg', type: 'image/svg+xml' }],
        ['gif', { data: Buffer.from('GIF89a\u0001\u0000\u0001\u0000', 'latin1'), name: 'rajah.gif', type: 'image/gif' }],
        ['extension', { data: makePng(), name: 'rajah.bmp', type: 'image/png' }],
        ['bytes', { data: Buffer.from('bukan gambar sebenar'), name: 'rajah.png', type: 'image/png' }],
        ['svg as png', { data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), name: 'rajah.png', type: 'image/png' }],
        ['html as png', { data: Buffer.from('<html><script>alert(1)</script></html>'), name: 'rajah.png', type: 'image/png' }],
        ['size', { data: makePng({ padTo: 2 * 1024 * 1024 + 4096 }), name: 'besar.png', type: 'image/png' }],
      ]
      for (const [label, file] of cases) {
        const res = await upload(raw, '/api/diagram-audit/mcq/202/image', file)
        expect(res.status, label).toBe(422)
        expect(res.body.error.fields, label).toEqual({ image: DIAGRAM_AUDIT_MESSAGES.fileType })
      }
      expect(await count(t.db, 'select count(*) n from diagram_audit_resolutions where question_id = 202')).toBe(0)
      expect(t.fake.questions.get('202')!.diagramFileId).toBeNull()
    })
  })
})
