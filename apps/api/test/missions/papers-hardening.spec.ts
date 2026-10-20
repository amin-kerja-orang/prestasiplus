import { EventEmitter } from 'node:events'

import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { QUESTION_SET_PAPER_MESSAGES as M, QuestionSetStudentListSchema, type QuestionSetPaper } from '@pp/contract'
import { of } from 'rxjs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { AuditService } from '../../src/common/audit'
import { ApiError } from '../../src/common/errors/api-error'
import { AUTH_CONTEXT_KEY } from '../../src/common/scope/auth-context'
import { PaperUploadInterceptor } from '../../src/modules/classes/question-sets/paper-upload.interceptor'
import { PaperUploadSlots } from '../../src/modules/classes/question-sets/paper-upload.slots'
import { cleanName } from '../../src/modules/classes/question-sets/question-papers'
import { PAPER_MAX_BODY_BYTES } from '../../src/modules/classes/question-sets/question-sets.constants'
import { QuestionSetsPorts, type PaperSubmission } from '../../src/modules/classes/question-sets'
import { STUDENT_1, TEACHER_A, bootQsApp, bytes, classWith, client, eligibleQuestionIds, idOfEmail, insertSession, insertSet, type Client, type QsTestApp } from './qs-helpers'

const FIELDS = { jenisSoalan: 'Trial Paper', subject: 'Matematik' }

function upload(c: Client, fields: Record<string, string>, files: { name: string; size: number }[] = []) {
  let req = c.who.agent.post('/api/guru/question-papers').set('X-CSRF-Token', c.who.csrf)
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v)
  for (const f of files) req = req.attach('files', bytes(f.size), f.name)
  return req
}

const paperOf = (s: PaperSubmission): QuestionSetPaper => ({
  id: '5', teacherId: s.teacherId, subjectText: s.declaration.subjectText, levelCode: null, year: 2026, paperType: s.declaration.paperType,
  authorCredit: '', note: null, files: s.files.map((f) => ({ index: f.index, name: f.name, size: f.size, mime: 'application/pdf' })),
  status: 'pending', adminNotes: null, createdAt: '2026-10-19T09:00:00+08:00',
})

/** A minimal execution context for the interceptor's early checks. */
function fakeCtx(headers: Record<string, string>, userId = '1') {
  const res = new EventEmitter()
  const req = { headers, [AUTH_CONTEXT_KEY]: { userId } }
  const ctx = { switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as unknown as ExecutionContext
  return { ctx, res, req }
}

describe('BE-18 B: paper upload memory guards (unit)', () => {
  it('a Content-Length over the cap is refused with the tooMany message before anything is read', async () => {
    const slots = new PaperUploadSlots()
    const i = new PaperUploadInterceptor(slots)
    const { ctx } = fakeCtx({ 'content-length': String(PAPER_MAX_BODY_BYTES + 1) })
    const err = await i.intercept(ctx, { handle: () => of(null) } as CallHandler).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('VALIDATION_ERROR')
    expect((err as ApiError).fields).toEqual({ files: M.tooMany })
    expect(slots.inFlight).toBe(0)
  })

  it('the cap is 5 x 20 MB plus an overhead allowance', () => {
    expect(PAPER_MAX_BODY_BYTES).toBeGreaterThan(100 * 1024 * 1024)
    expect(PAPER_MAX_BODY_BYTES).toBeLessThan(110 * 1024 * 1024)
  })

  it('slots: one per user, a global cap, 429 with Retry-After, release is idempotent', () => {
    const slots = new PaperUploadSlots()
    slots.maxTotal = 3
    const a = slots.acquire('1')
    const refused = (u: string) => {
      try {
        slots.acquire(u)
      } catch (e) {
        return e as ApiError
      }
      throw new Error('expected a refusal')
    }
    const err = refused('1')
    expect(err.code).toBe('RATE_LIMITED')
    expect(err.getStatus()).toBe(429)
    expect(err.retryAfter).toBeGreaterThan(0)
    const b = slots.acquire('2')
    const c = slots.acquire('3')
    expect(refused('4').code).toBe('RATE_LIMITED') // global cap
    a()
    a() // second release does nothing
    expect(slots.inFlight).toBe(2)
    const d = slots.acquire('4')
    b()
    c()
    d()
    expect(slots.inFlight).toBe(0)
  })

  it('the slot is released when the response closes, and when the parser fails', async () => {
    const slots = new PaperUploadSlots()
    const i = new PaperUploadInterceptor(slots)
    const first = fakeCtx({})
    ;(i as unknown as { inner: unknown }).inner = { intercept: () => Promise.resolve(of(1)) }
    await i.intercept(first.ctx, { handle: () => of(1) } as CallHandler)
    expect(slots.inFlight).toBe(1)
    first.res.emit('close')
    expect(slots.inFlight).toBe(0)
    ;(i as unknown as { inner: unknown }).inner = { intercept: () => Promise.reject(new Error('boom')) }
    await expect(i.intercept(fakeCtx({}).ctx, { handle: () => of(1) } as CallHandler)).rejects.toThrow('boom')
    expect(slots.inFlight).toBe(0)
  })

  it('multer "Too many parts" maps to the tooMany message', async () => {
    const { BadRequestException } = await import('@nestjs/common')
    const i = new PaperUploadInterceptor(new PaperUploadSlots())
    ;(i as unknown as { inner: unknown }).inner = { intercept: () => Promise.reject(new BadRequestException('Too many parts')) }
    const err = await i.intercept(fakeCtx({}).ctx, { handle: () => of(1) } as CallHandler).catch((e: unknown) => e)
    expect((err as ApiError).fields).toEqual({ files: M.tooMany })
  })

  it('cleanName keeps the last path part, drops control characters, never returns empty', () => {
    expect(cleanName('../../x.pdf')).toBe('x.pdf')
    expect(cleanName('..\\..\\evil.docx')).toBe('evil.docx')
    expect(cleanName('/etc/passwd.pdf')).toBe('passwd.pdf')
    expect(cleanName('a\u0001b\u007f.pdf')).toBe('ab.pdf')
    expect(cleanName('a\nb.pdf')).toBe('ab.pdf')
    expect(cleanName('..')).toBe('file')
    expect(cleanName('')).toBe('file')
    expect(cleanName('\u0000\u0001')).toBe('file')
    expect(cleanName('Soalan Ujian (1).pdf')).toBe('Soalan Ujian (1).pdf')
  })
})

describe('BE-18 B: paper upload guards (integration)', () => {
  let t: QsTestApp
  let teacher: Client
  const seen: PaperSubmission[] = []
  let gate: Promise<void> = Promise.resolve()
  let entered: () => void = () => undefined

  beforeAll(async () => {
    t = await bootQsApp()
    teacher = await client(t, TEACHER_A)
    t.get(QuestionSetsPorts).provideIntake({
      async submit(s) {
        seen.push(s)
        entered()
        await gate
        return paperOf(s)
      },
    })
  })
  afterAll(async () => {
    await t.close()
  })

  it('only one upload per user is in flight: a second is 429 with Retry-After, and the slot frees afterwards', async () => {
    let open: () => void = () => undefined
    gate = new Promise<void>((r) => (open = r))
    const started = new Promise<void>((r) => (entered = r))
    const first = upload(teacher, FIELDS, [{ name: 'a.pdf', size: 5 }]).then((r) => r)
    await started
    const second = await upload(teacher, FIELDS, [{ name: 'b.pdf', size: 5 }])
    expect(second.status).toBe(429)
    expect(second.body.error.code).toBe('RATE_LIMITED')
    expect(Number(second.headers['retry-after'])).toBeGreaterThan(0)
    open()
    expect((await first).status).toBe(201)
    gate = Promise.resolve()
    entered = () => undefined
    expect((await upload(teacher, FIELDS, [{ name: 'c.pdf', size: 5 }])).status).toBe(201)
    expect(t.get(PaperUploadSlots).inFlight).toBe(0)
  })

  it('a refused (422) upload also frees its slot', async () => {
    for (let i = 0; i < 3; i++) expect((await upload(teacher, {}, [])).status).toBe(422)
    expect(t.get(PaperUploadSlots).inFlight).toBe(0)
  })

  it('the intake gets the cleaned basename, never the raw client name', async () => {
    const res = await upload(teacher, FIELDS, [{ name: '../../x.pdf', size: 4 }])
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(seen.at(-1)?.files.map((f) => f.name)).toEqual(['x.pdf'])
    expect(res.body.data.files.map((f: { name: string }) => f.name)).toEqual(['x.pdf'])
  })

  it('control characters in a raw multipart file name are removed', async () => {
    const boundary = 'BOUNDARYxyz'
    const part = (head: string, body: string) => `--${boundary}\r\n${head}\r\n\r\n${body}\r\n`
    const body = Buffer.from(
      part('Content-Disposition: form-data; name="jenisSoalan"', 'Trial Paper') +
        part('Content-Disposition: form-data; name="subject"', 'Matematik') +
        part('Content-Disposition: form-data; name="files"; filename="a\tb\u0085.docx"\r\nContent-Type: application/pdf', 'data') +
        `--${boundary}--\r\n`,
      'latin1',
    )
    const res = await teacher.who.agent
      .post('/api/guru/question-papers')
      .set('X-CSRF-Token', teacher.who.csrf)
      .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
      .send(body)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(seen.at(-1)?.files.map((f) => f.name)).toEqual(['ab.docx'])
  })

  it('more text fields than the parser allows is the tooMany message', async () => {
    const fields: Record<string, string> = { ...FIELDS }
    for (let i = 0; i < 25; i++) fields[`extra${String(i)}`] = 'x'
    const res = await upload(teacher, fields, [{ name: 'a.pdf', size: 3 }])
    expect(res.status).toBe(422)
    expect(res.body.error.fields).toEqual({ files: M.tooMany })
  })

  it('a failing audit write does not turn a created submission into a 500', async () => {
    const spy = vi.spyOn(t.get(AuditService), 'record').mockRejectedValue(new Error('audit down'))
    try {
      const res = await upload(teacher, FIELDS, [{ name: 'a.pdf', size: 3 }])
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(spy).toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})

describe('BE-18 B: the paper route has its own tighter bucket', () => {
  let t: QsTestApp
  beforeAll(async () => {
    t = await bootQsApp({ env: { THROTTLE_CLASSES_WRITE_PER_MINUTE: undefined } })
  })
  afterAll(async () => {
    await t.close()
  })

  it('5 a minute by default (the DSKP writes keep 30), 429 with Retry-After on the 6th', async () => {
    const teacher = await client(t, TEACHER_A)
    for (let i = 0; i < 5; i++) expect((await upload(teacher, {}, [])).status).toBe(422)
    const res = await upload(teacher, {}, [])
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
    expect((await teacher.post('/guru/dskp/bidang', {})).status).toBe(200)
  })
})

describe('BE-18 B: list attempts for many sets', () => {
  let t: QsTestApp
  beforeAll(async () => {
    t = await bootQsApp()
  })
  afterAll(async () => {
    await t.close()
  })

  it('attemptsLeft is right for more sets than one lookup batch', async () => {
    const teacher = await client(t, TEACHER_A)
    const student = await client(t, STUDENT_1)
    const teacherId = await idOfEmail(t, TEACHER_A)
    const studentId = await idOfEmail(t, STUDENT_1)
    const cls = await classWith(t, teacher, [student])
    const qs = await eligibleQuestionIds(t, 2)
    const ids: string[] = []
    for (let i = 0; i < 20; i++) {
      ids.push(await insertSet(t, { teacherId, classroomId: cls.id, title: `Set ${String(i)}`, maxAttempts: i % 4 === 0 ? 0 : 3, questionIds: qs, createdAt: `2026-10-01T10:${String(i).padStart(2, '0')}:00+08:00` }))
    }
    for (let i = 0; i < 20; i++) for (let k = 0; k < i % 4; k++) await insertSession(t, { userId: studentId, setId: ids[i] as string, status: 'completed' })
    const res = await student.get('/set-soalan-saya')
    const rows = QuestionSetStudentListSchema.parse(res.body).data
    expect(rows.map((r) => r.id)).toEqual(ids)
    expect(rows.map((r) => r.attemptsLeft)).toEqual(ids.map((_, i) => (i % 4 === 0 ? null : 3 - (i % 4))))
  })
})
