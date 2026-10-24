import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { FileRefSchema, QUESTION_MESSAGES, SessionSchema, type FileRef } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type TestAgent from 'supertest/lib/agent'

import { makePng } from '../files/fixtures'
import { addAccount } from '../files/helpers'
import { DEMO_PASSWORD, bootQuestionsApp, expectError, type QuestionsTestApp } from './helpers'
import { countOf, mcqBody, refsOf, type Refs } from './http-helpers'

/**
 * SW12-01-A (Q-10): the question routes are JSON only. An image is uploaded first with `POST /files` and referenced by the
 * id that call returns (the public token). Real database, real upload route, real files rows.
 */

interface Actor {
  userId: string
  csrf: string
  agent: TestAgent
  post(url: string, body: unknown): ReturnType<TestAgent['post']>
  put(url: string, body: unknown): ReturnType<TestAgent['put']>
  get(url: string): ReturnType<TestAgent['get']>
  /** `POST /files` of a tiny valid PNG with `purpose`. */
  upload(purpose: string): Promise<FileRef>
}

async function sessionOf(t: QuestionsTestApp, identifier: string): Promise<Actor> {
  const agent = t.agent()
  const res = await agent.post('/api/auth/login').send({ identifier, password: DEMO_PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const session = SessionSchema.parse(res.body.data)
  const csrf = session.csrf
  return {
    userId: session.user.id,
    csrf,
    agent,
    post: (url, body) => agent.post(url).set('X-CSRF-Token', csrf).send(body as object),
    put: (url, body) => agent.put(url).set('X-CSRF-Token', csrf).send(body as object),
    get: (url) => agent.get(url),
    async upload(purpose) {
      const up = await agent.post(`/api/files?purpose=${purpose}`).set('X-CSRF-Token', csrf).attach('file', makePng(), { filename: 'gambar.png', contentType: 'image/png' })
      expect(up.status, JSON.stringify(up.body)).toBe(201)
      return FileRefSchema.parse(up.body.data)
    },
  }
}

describe('SW12-01-A: question images are referenced by the id POST /files returns', () => {
  let t: QuestionsTestApp
  let dir: string
  let admin: Actor
  let teacher: Actor
  let sameSchool: Actor
  let otherSchool: Actor
  let student: Actor
  let refs: Refs
  const url = (ref: FileRef): string => `/api/files/${ref.id}`
  const questions = (): Promise<number> => countOf(t.db, 'select count(*) as n from questions')
  const stimuli = (): Promise<number> => countOf(t.db, 'select count(*) as n from stimuli')

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pp-q-images-'))
    process.env.FILE_STORAGE_DIR = dir
    process.env.UPLOAD_RATE_PER_MINUTE = '1000'
    t = await bootQuestionsApp()
    await addAccount(t.db, 'guru.sama@demo.test', 'teacher', 'DEMO001')
    await addAccount(t.db, 'guru.lain@demo.test', 'teacher', 'DEMO002')
    admin = await sessionOf(t, 'admin@demo.test')
    teacher = await sessionOf(t, 'guru@demo.test')
    sameSchool = await sessionOf(t, 'guru.sama@demo.test')
    otherSchool = await sessionOf(t, 'guru.lain@demo.test')
    student = await sessionOf(t, 'pelajar@demo.test')
    refs = await refsOf(t.db)
  })
  afterAll(async () => {
    await t.close()
    await rm(dir, { recursive: true, force: true })
  })

  const guruBody = (over: Record<string, unknown> = {}) => ({
    educationLevelId: refs.t4Id,
    subjectId: refs.mathId,
    questionType: 'mcq',
    difficultyLevel: 'medium',
    questionText: 'Berapakah punca kuasa dua bagi 81?',
    options: ['7', '8', '9', '10'],
    correctAnswer: 2,
    ...over,
  })

  describe('admin create and edit', () => {
    it('creates an MCQ with an option image and a stem image by public id; the response and the detail carry the file URLs', async () => {
      const option = await admin.upload('question_image')
      const stem = await admin.upload('question_image')
      const res = await admin.post('/api/questions', mcqBody(refs, { optionImages: [null, option.id, null, null], questionImage: stem.id }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.data.optionImages).toEqual([null, url(option), null, null])
      expect(res.body.data.questionImage).toBe(url(stem))
      const id = res.body.data.id as string

      const detail = await admin.get(`/api/questions/${id}`)
      expect(detail.status).toBe(200)
      expect(detail.body.data.optionImages).toEqual([null, url(option), null, null])
      expect(detail.body.data.questionImage).toBe(url(stem))

      // Stored: the option keeps the internal file id; the stem image is a private `image` stimulus linked to the version.
      const opt = await t.db.query<{ ok: boolean }>(
        `select o.image_file_id = f.id as ok from part_options o join files f on f.public_id = $1 where o.label = 'B' and o.part_id in
           (select p.id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $2)`,
        [option.id, id],
      )
      expect(opt).toEqual([{ ok: true }])
      const link = await t.db.query<{ kind: string; reusable: boolean; same: boolean }>(
        `select s.kind, s.reusable, s.asset_file_id = f.id as same from question_version_stimuli l
           join stimuli s on s.id = l.stimulus_id join files f on f.public_id = $1
           join question_versions v on v.id = l.question_version_id where v.question_id = $2`,
        [stem.id, id],
      )
      expect(link).toEqual([{ kind: 'image', reusable: false, same: true }])
    })

    it('still accepts an internal file id on an option (existing callers)', async () => {
      const file = await admin.upload('question_image')
      const [row] = await t.db.query<{ id: string }>('select id::text from files where public_id = $1', [file.id])
      const res = await admin.post('/api/questions', mcqBody(refs, { optionImages: [row?.id, null, null, null] }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.data.optionImages[0]).toBe(url(file))
    })

    it('a part tree option may carry the public id too; it is stored as the internal id', async () => {
      const file = await admin.upload('question_image')
      const parts = [{
        label: '1', prompt: { ms: 'Pilih jawapan yang betul.' }, mode: 'mcq', marks: 1,
        options: ['A', 'B', 'C'].map((label) => ({ label, body: { ms: label }, imageId: label === 'B' ? file.id : null })),
        key: { kind: 'option', correct: 'A' },
      }]
      const res = await admin.post('/api/questions', mcqBody(refs, { questionType: 'essay', parts, options: undefined, correctAnswer: undefined }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const rows = await t.db.query<{ same: boolean }>(
        `select o.image_file_id = f.id as same from part_options o join files f on f.public_id = $1
           join question_parts p on p.id = o.part_id join question_versions v on v.id = p.question_version_id
          where v.question_id = $2 and o.image_file_id is not null`,
        [file.id, res.body.data.id],
      )
      expect(rows).toEqual([{ same: true }])
      const bad = await admin.post('/api/questions', mcqBody(refs, { questionType: 'essay', parts: [{ ...parts[0], options: parts[0]!.options.map((o) => ({ ...o, imageId: o.label === 'C' ? 'B'.repeat(22) : null })) }], options: undefined, correctAnswer: undefined }))
      expectError(bad, 'VALIDATION_ERROR')
      expect(bad.body.error.fields).toEqual({ 'optionImages.2': QUESTION_MESSAGES.image })
    })

    it('accepts the file URL of an image it read back (a form that posts what it got)', async () => {
      const file = await admin.upload('question_image')
      const created = await admin.post('/api/questions', mcqBody(refs, { optionImages: [url(file), null, null, null] }))
      expect(created.status, JSON.stringify(created.body)).toBe(201)
      expect(created.body.data.optionImages[0]).toBe(url(file))
    })

    it('edit: an absent image keeps the saved one, removeOptionImage clears one, a new id replaces one', async () => {
      const first = await admin.upload('question_image')
      const second = await admin.upload('question_image')
      const created = await admin.post('/api/questions', mcqBody(refs, { optionImages: [first.id, second.id, null, null] }))
      const id = created.body.data.id as string
      const base = { subjectId: refs.mathId, educationLevelId: refs.t4Id, difficultyLevel: 3, questionText: 'Berapakah hasil tambah 2 dan 3?' }

      const kept = await admin.put(`/api/questions/${id}`, base)
      expect(kept.status, JSON.stringify(kept.body)).toBe(200)
      expect(kept.body.data.optionImages).toEqual([url(first), url(second), null, null])

      const removed = await admin.put(`/api/questions/${id}`, { ...base, removeOptionImage: [false, true, false, false] })
      expect(removed.status).toBe(200)
      expect(removed.body.data.optionImages).toEqual([url(first), null, null, null])

      const replacement = await admin.upload('question_image')
      const replaced = await admin.put(`/api/questions/${id}`, { ...base, optionImages: [replacement.id, null, null, null] })
      expect(replaced.status, JSON.stringify(replaced.body)).toBe(200)
      expect(replaced.body.data.optionImages).toEqual([url(replacement), null, null, null])
      const detail = await admin.get(`/api/questions/${id}`)
      expect(detail.body.data.optionImages).toEqual([url(replacement), null, null, null])
    })

    it('edit: the stem image is replaced, removed or kept; a replaced private stimulus is not left behind', async () => {
      const first = await admin.upload('question_image')
      const created = await admin.post('/api/questions', mcqBody(refs, { questionImage: first.id }))
      const id = created.body.data.id as string
      const base = { subjectId: refs.mathId, educationLevelId: refs.t4Id, difficultyLevel: 3, questionText: 'Berapakah hasil tambah 2 dan 3?' }
      const before = await stimuli()

      const kept = await admin.put(`/api/questions/${id}`, base)
      expect(kept.body.data.questionImage).toBe(url(first))
      const same = await admin.put(`/api/questions/${id}`, { ...base, questionImage: first.id })
      expect(same.body.data.questionImage).toBe(url(first))
      expect(await stimuli()).toBe(before)

      const next = await admin.upload('question_image')
      const replaced = await admin.put(`/api/questions/${id}`, { ...base, questionImage: next.id })
      expect(replaced.status, JSON.stringify(replaced.body)).toBe(200)
      expect(replaced.body.data.questionImage).toBe(url(next))
      expect(await stimuli()).toBe(before)

      const removed = await admin.put(`/api/questions/${id}`, { ...base, removeQuestionImage: true })
      expect(removed.body.data.questionImage).toBeNull()
      expect(await stimuli()).toBe(before - 1)
    })

    it('edit of a published question keeps the live version image and writes the new one on version 2', async () => {
      const first = await admin.upload('question_image')
      const created = await admin.post('/api/questions', mcqBody(refs, { questionImage: first.id }))
      const id = created.body.data.id as string
      await t.db.query(`update question_versions set status = 'published', published_at = now() where question_id = $1 and version_no = 1`, [id])
      await t.db.query(`update questions set live_version_no = 1 where id = $1`, [id])
      const next = await admin.upload('question_image')
      const res = await admin.put(`/api/questions/${id}`, {
        subjectId: refs.mathId, educationLevelId: refs.t4Id, difficultyLevel: 3, questionText: 'Berapakah hasil tambah 2 dan 3?', questionImage: next.id,
      })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.questionImage).toBe(url(next))
      const rows = await t.db.query<{ version_no: number; public_id: string }>(
        `select v.version_no, f.public_id from question_versions v join question_version_stimuli l on l.question_version_id = v.id
           join stimuli s on s.id = l.stimulus_id join files f on f.id = s.asset_file_id where v.question_id = $1 order by v.version_no`,
        [id],
      )
      expect(rows).toEqual([{ version_no: 1, public_id: first.id }, { version_no: 2, public_id: next.id }])
    })
  })

  describe('teacher (guru contribution route)', () => {
    it('creates with the teacher own uploads and reads them back', async () => {
      const option = await teacher.upload('question_image')
      const stem = await teacher.upload('question_image')
      const res = await teacher.post('/api/guru/questions', guruBody({ optionImages: [option.id, null, null, null], questionImage: stem.id }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.data.optionImages).toEqual([url(option), null, null, null])
      expect(res.body.data.questionImage).toBe(url(stem))
      const detail = await teacher.get(`/api/guru/questions/${res.body.data.id as string}`)
      expect(detail.body.data.optionImages).toEqual([url(option), null, null, null])
      expect(detail.body.data.questionImage).toBe(url(stem))
    })

    it('edit: a new stem image replaces the saved one; options and their images stay', async () => {
      const option = await teacher.upload('question_image')
      const created = await teacher.post('/api/guru/questions', guruBody({ optionImages: [null, option.id, null, null] }))
      const id = created.body.data.id as string
      const stem = await teacher.upload('question_image')
      const res = await teacher.put(`/api/guru/questions/${id}`, { questionText: 'Berapakah punca kuasa dua bagi 100?', questionImage: stem.id })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.questionImage).toBe(url(stem))
      expect(res.body.data.optionImages).toEqual([null, url(option), null, null])
    })
  })

  describe('a file the writer may not use is a 422 and nothing is written', () => {
    const FIELD = QUESTION_MESSAGES.image

    it('another school teacher upload, on an option and on the stem (teacher route)', async () => {
      const foreign = await otherSchool.upload('question_image')
      const before = [await questions(), await stimuli()]
      const option = await teacher.post('/api/guru/questions', guruBody({ optionImages: [null, null, foreign.id, null] }))
      expectError(option, 'VALIDATION_ERROR')
      expect(option.body.error.fields).toEqual({ 'optionImages.2': FIELD })
      const stem = await teacher.post('/api/guru/questions', guruBody({ questionImage: foreign.id }))
      expectError(stem, 'VALIDATION_ERROR')
      expect(stem.body.error.fields).toEqual({ questionImage: FIELD })
      expect([await questions(), await stimuli()]).toEqual(before)
    })

    it('a teacher of the same school cannot use a colleague upload either (the file is the uploader own)', async () => {
      const colleague = await sameSchool.upload('question_image')
      const before = await questions()
      const res = await teacher.post('/api/guru/questions', guruBody({ optionImages: [colleague.id, null, null, null] }))
      expectError(res, 'VALIDATION_ERROR')
      expect(res.body.error.fields).toEqual({ 'optionImages.0': FIELD })
      expect(await questions()).toBe(before)
    })

    it('the same refusal on the admin edit leaves the saved question unchanged', async () => {
      const mine = await admin.upload('question_image')
      const created = await admin.post('/api/questions', mcqBody(refs, { optionImages: [mine.id, null, null, null] }))
      const id = created.body.data.id as string
      // An admin may use any question_image; a teacher may not reach this route, so the edit rule is shown on the Guru PUT.
      const guruMade = await teacher.post('/api/guru/questions', guruBody())
      const gid = guruMade.body.data.id as string
      const foreign = await otherSchool.upload('question_image')
      const res = await teacher.put(`/api/guru/questions/${gid}`, { questionText: 'Berapakah punca kuasa dua bagi 100?', questionImage: foreign.id })
      expectError(res, 'VALIDATION_ERROR')
      expect(res.body.error.fields).toEqual({ questionImage: FIELD })
      const after = await teacher.get(`/api/guru/questions/${gid}`)
      expect(after.body.data.questionText).toBe('Berapakah punca kuasa dua bagi 81?')
      expect(after.body.data.questionImage).toBeNull()
      expect((await admin.get(`/api/questions/${id}`)).body.data.optionImages[0]).toBe(url(mine))
    })

    it('an admin may reference any question_image', async () => {
      const foreign = await otherSchool.upload('question_image')
      const res = await admin.post('/api/questions', mcqBody(refs, { optionImages: [foreign.id, null, null, null] }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
    })

    it('an unknown id, a malformed id and an internal id of nobody all give the same message', async () => {
      const before = await questions()
      for (const ref of ['A'.repeat(22), 'x', '999999999', '../etc/passwd']) {
        const res = await admin.post('/api/questions', mcqBody(refs, { optionImages: [ref, null, null, null] }))
        expectError(res, 'VALIDATION_ERROR')
        expect(res.body.error.fields, ref).toEqual({ 'optionImages.0': FIELD })
        const stem = await admin.post('/api/questions', mcqBody(refs, { questionImage: ref }))
        expect(stem.body.error.fields, ref).toEqual({ questionImage: FIELD })
      }
      expect(await questions()).toBe(before)
    })

    it('a file of another purpose is refused', async () => {
      const avatar = await teacher.upload('avatar')
      const before = [await questions(), await stimuli()]
      const option = await teacher.post('/api/guru/questions', guruBody({ optionImages: [avatar.id, null, null, null] }))
      expectError(option, 'VALIDATION_ERROR')
      expect(option.body.error.fields).toEqual({ 'optionImages.0': FIELD })
      const stem = await admin.post('/api/questions', mcqBody(refs, { questionImage: (await admin.upload('cms_image')).id }))
      expect(stem.body.error.fields).toEqual({ questionImage: FIELD })
      expect([await questions(), await stimuli()]).toEqual(before)
    })

    it('a non-string image reference is refused on its key', async () => {
      const res = await admin.post('/api/questions', mcqBody(refs, { questionImage: 5, optionImages: [null, 7, null, null] }))
      expectError(res, 'VALIDATION_ERROR')
      expect(res.body.error.fields).toMatchObject({ questionImage: FIELD, 'optionImages.1': FIELD })
    })
  })

  describe('options and the key are read for an MCQ only', () => {
    it('a non-MCQ create with blank options and a blank key is accepted and the options are ignored', async () => {
      const before = await questions()
      const essay = await admin.post('/api/questions', mcqBody(refs, { questionType: 'essay', options: ['', '', '', ''], correctAnswer: '', modelAnswer: 'Jawapan model contoh.' }))
      expect(essay.status, JSON.stringify(essay.body)).toBe(201)
      expect(essay.body.data.options).toBeNull()
      expect(essay.body.data.correctAnswer).toBeNull()
      const tf = await admin.post('/api/questions', mcqBody(refs, { questionType: 'true_false', options: ['', '', '', ''], correctAnswer: '', tfAnswer: true }))
      expect(tf.status, JSON.stringify(tf.body)).toBe(201)
      const short = await admin.post('/api/questions', mcqBody(refs, { questionType: 'short_answer', options: ['', '', '', ''], correctAnswer: '', correctAnswerText: 'sepuluh' }))
      expect(short.status, JSON.stringify(short.body)).toBe(201)
      expect(await questions()).toBe(before + 3)
    })

    it('the teacher route ignores blank options of a non-MCQ too', async () => {
      const res = await teacher.post('/api/guru/questions', guruBody({ questionType: 'essay', options: ['', '', '', ''], correctAnswer: '' }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
    })

    it('an MCQ with a blank or null key is 422 on correctAnswer (never silently option A)', async () => {
      const before = await questions()
      for (const blank of ['', '  ', null]) {
        const res = await admin.post('/api/questions', mcqBody(refs, { correctAnswer: blank }))
        expectError(res, 'VALIDATION_ERROR')
        expect(res.body.error.fields, String(blank)).toEqual({ correctAnswer: QUESTION_MESSAGES.correctAnswer })
      }
      expect(await questions()).toBe(before)
    })

    it('an MCQ with a blank option is still 422 on options (create and edit)', async () => {
      const bad = await admin.post('/api/questions', mcqBody(refs, { options: ['4', '', '6', '7'] }))
      expectError(bad, 'VALIDATION_ERROR')
      expect(bad.body.error.fields).toEqual({ options: QUESTION_MESSAGES.options })
      const created = await admin.post('/api/questions', mcqBody(refs))
      const id = created.body.data.id as string
      const base = { subjectId: refs.mathId, educationLevelId: refs.t4Id, difficultyLevel: 3, questionText: 'Berapakah hasil tambah 2 dan 3?' }
      const edit = await admin.put(`/api/questions/${id}`, { ...base, options: ['4', '', '6', '7'] })
      expectError(edit, 'VALIDATION_ERROR')
      expect(edit.body.error.fields).toEqual({ options: QUESTION_MESSAGES.options })
      const blankKey = await admin.put(`/api/questions/${id}`, { ...base, correctAnswer: '' })
      expectError(blankKey, 'VALIDATION_ERROR')
      expect(blankKey.body.error.fields).toEqual({ correctAnswer: QUESTION_MESSAGES.correctAnswer })
      const unchanged = await admin.get(`/api/questions/${id}`)
      expect(unchanged.body.data).toMatchObject({ options: ['4', '5', '6', '7'], correctAnswer: 1 })
    })

    it('an edit of a non-MCQ ignores blank options', async () => {
      const created = await admin.post('/api/questions', mcqBody(refs, { questionType: 'essay', modelAnswer: 'Jawapan model contoh.' }))
      const id = created.body.data.id as string
      const res = await admin.put(`/api/questions/${id}`, {
        subjectId: refs.mathId, educationLevelId: refs.t4Id, difficultyLevel: 3, questionText: 'Terangkan hasil tambah 2 dan 3.', options: ['', '', '', ''], correctAnswer: '',
      })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
    })
  })

  describe('roles', () => {
    it('a student gets 403 and an anonymous caller 401 on the create routes', async () => {
      const file = await admin.upload('question_image')
      for (const [path, body] of [['/api/questions', mcqBody(refs, { optionImages: [file.id] })], ['/api/guru/questions', guruBody({ optionImages: [file.id] })]] as const) {
        expectError(await student.post(path, body), 'FORBIDDEN')
        const anonymous = await t.agent().post(path).send(body)
        expect([401, 403]).toContain(anonymous.status)
        expectError(anonymous, anonymous.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN')
      }
    })

    it('a teacher is 403 on the admin routes even with a valid image', async () => {
      const file = await teacher.upload('question_image')
      expectError(await teacher.post('/api/questions', mcqBody(refs, { optionImages: [file.id] })), 'FORBIDDEN')
    })
  })
})
