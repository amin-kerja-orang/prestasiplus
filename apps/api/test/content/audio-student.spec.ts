import { AudioKbatAttemptResultSchema, AudioKbatPlaySetSchema, AudioKbatSetListItemSchema, ListMetaSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { AUDIO_READ_CONCURRENCY, AudioReadGate } from '../../src/modules/content/audio/audio-read-gate'

import {
  AUDIO_BYTES,
  allKeys,
  bootPartC,
  errorOf,
  expectError,
  fieldsOf,
  insertAudioSet,
  storeAudio,
  jsonOf,
  loginPartC,
  userIdOf,
  type Choice,
  type LoggedIn,
  type PartCApp,
} from './audio-helpers'

const ListBody = z.object({ data: z.array(AudioKbatSetListItemSchema), meta: ListMetaSchema })

describe('audio KBAT student play (AC 8, AC 9)', () => {
  let t: PartCApp
  let student: LoggedIn
  let adminId: string
  let FILE_ID: string
  let approvedId: string
  let draftId: string
  let pendingId: string
  let archivedId: string
  let otherLevelId: string

  beforeAll(async () => {
    t = await bootPartC()
    student = await loginPartC(t, 'pelajar@demo.test')
    adminId = await userIdOf(t.db, 'admin@demo.test')
    FILE_ID = await storeAudio(t, adminId, AUDIO_BYTES.mp3)
    approvedId = await insertAudioSet(t.db, { createdById: adminId, audioFileId: (n) => (n === 1 ? FILE_ID : null), correct: (n) => (n <= 10 ? 'A' : 'B'), marks: 2 })
    draftId = await insertAudioSet(t.db, { createdById: adminId, status: 'draft', title: 'Draf', levelId: 11, subjectId: 2, audioFileId: () => FILE_ID })
    pendingId = await insertAudioSet(t.db, { createdById: adminId, status: 'pending_review', title: 'Menunggu' })
    archivedId = await insertAudioSet(t.db, { createdById: adminId, status: 'archived', title: 'Arkib' })
    otherLevelId = await insertAudioSet(t.db, { createdById: adminId, title: 'BI T5 Set 1', levelId: 11, subjectId: 2 })
  })
  afterAll(async () => {
    await t.close()
  })

  const s = () => jsonOf(student)

  describe('session and CSRF', () => {
    it.each([
      ['GET', '/audio-kbat-sets'],
      ['GET', '/audio-kbat-sets/1'],
      ['GET', '/audio-kbat-sets/1/sections/1/audio'],
      ['POST', '/audio-kbat-sets/1/attempts'],
    ] as const)('%s %s is 401 without a session', async (method, path) => {
      const res = method === 'GET' ? await t.http().get(`/api${path}`) : await t.http().post(`/api${path}`).send({})
      expectError(res, 'UNAUTHORIZED')
    })

    it('a missing CSRF token on the attempt is 403 CSRF_INVALID', async () => {
      expectError(await s().postNoCsrf(`/audio-kbat-sets/${approvedId}/attempts`, { answers: [{ no: 1, choice: 'A' }] }), 'CSRF_INVALID')
    })
  })

  describe('GET /api/audio-kbat-sets', () => {
    it('lists approved sets only (no draft, pending, archived), newest first, no-store', async () => {
      const res = await s().get('/audio-kbat-sets')
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const body = ListBody.parse(res.body)
      expect(body.data.map((r) => r.id)).toEqual([otherLevelId, approvedId])
      expect(body.meta).toMatchObject({ page: 1, totalItems: 2, totalPages: 1 })
      expect(body.data.find((r) => r.id === approvedId)).toMatchObject({ title: 'BM T4 Ujian Mendengar Set 1', educationLevel: { id: '10', name: 'Tingkatan 4' }, subject: { id: '1', name: 'Bahasa Melayu' } })
      const ids = body.data.map((r) => r.id)
      for (const hidden of [draftId, pendingId, archivedId]) expect(ids).not.toContain(hidden)
    })

    it('filters by educationLevelId and subjectId; a malformed filter id is ignored', async () => {
      const level = ListBody.parse((await s().get('/audio-kbat-sets?educationLevelId=11')).body)
      expect(level.data.map((r) => r.id)).toEqual([otherLevelId])
      const subject = ListBody.parse((await s().get('/audio-kbat-sets?subjectId=1')).body)
      expect(subject.data.map((r) => r.id)).toEqual([approvedId])
      const none = ListBody.parse((await s().get('/audio-kbat-sets?educationLevelId=10&subjectId=2')).body)
      expect(none.data).toEqual([])
      expect(none.meta.pageSize).toBeGreaterThanOrEqual(1)
      const junk = ListBody.parse((await s().get('/audio-kbat-sets?educationLevelId=abc')).body)
      expect(junk.data).toHaveLength(2)
    })
  })

  describe('GET /api/audio-kbat-sets/:id', () => {
    it('returns the title, instructions and 4 sections with 8/8/8/6 questions, matching the strict contract', async () => {
      const res = await s().get(`/audio-kbat-sets/${approvedId}`)
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const set = AudioKbatPlaySetSchema.parse(res.body.data)
      expect(set).toMatchObject({ id: approvedId, title: 'BM T4 Ujian Mendengar Set 1', instructions: 'Dengar dengan teliti.' })
      expect(set.sections.map((x) => x.questions.length)).toEqual([8, 8, 8, 6])
      expect(set.sections[0]?.questions[0]).toEqual({
        no: 1,
        questionText: 'Soalan contoh 1',
        options: { A: 'Pilihan A 1', B: 'Pilihan B 1', C: 'Pilihan C 1', D: 'Pilihan D 1' },
        marks: 2,
      })
      expect(set.sections[0]?.audioUrl).toBe(`/api/audio-kbat-sets/${approvedId}/sections/1/audio`)
      expect(set.sections[1]?.audioUrl).toBeNull()
    })

    it('never carries the answer key: a recursive key scan finds no answer, explanation, level or DSKP key', async () => {
      const body = (await s().get(`/audio-kbat-sets/${approvedId}`)).body as unknown
      const keys = [...allKeys(body)]
      for (const forbidden of ['correctAnswer', 'correct_answer', 'answer', 'explanation', 'kbatLevel', 'dskpSpId', 'optionA']) {
        expect(keys, forbidden).not.toContain(forbidden)
      }
      const text = JSON.stringify(body)
      expect(text).not.toContain('Penjelasan rahsia')
      // the seeded DSKP link is a number under a key that must not exist
      expect([...allKeys(body)].join(' ')).not.toMatch(/dskp|kbat|correct|explan/i)
    })

    it('a draft, pending, archived, unknown or malformed set is 404 "Not Found."', async () => {
      for (const id of [draftId, pendingId, archivedId, '999999', 'abc', '0', '99999999999999999999']) {
        const res = await s().get(`/audio-kbat-sets/${id}`)
        expectError(res, 'NOT_FOUND', 'Not Found.')
      }
    })
  })

  describe('GET /api/audio-kbat-sets/:id/sections/:no/audio', () => {
    it('serves the stored audio to a signed-in user with a safe header set', async () => {
      const res = await s().get(`/audio-kbat-sets/${approvedId}/sections/1/audio`).buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = []
        r.on('data', (c: Buffer) => chunks.push(c))
        r.on('end', () => cb(null, Buffer.concat(chunks)))
      })
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('audio/mpeg')
      expect(res.headers['x-content-type-options']).toBe('nosniff')
      expect(res.headers['cache-control']).toBe('private, no-store')
      expect(res.headers['accept-ranges']).toBe('bytes')
      expect(Buffer.from(res.body as Buffer).equals(AUDIO_BYTES.mp3)).toBe(true)
    })

    it('answers a Range request with 206 and a bad range with 416', async () => {
      const part = await student.agent.get(`/api/audio-kbat-sets/${approvedId}/sections/1/audio`).set('Range', 'bytes=0-9')
      expect(part.status).toBe(206)
      expect(part.headers['content-range']).toBe(`bytes 0-9/${String(AUDIO_BYTES.mp3.length)}`)
      const bad = await student.agent.get(`/api/audio-kbat-sets/${approvedId}/sections/1/audio`).set('Range', 'bytes=9999-')
      expect(bad.status).toBe(416)
    })

    it('is 404 for a section without audio, a bad section number, a draft set, or a missing object', async () => {
      for (const path of [`/audio-kbat-sets/${approvedId}/sections/2/audio`, `/audio-kbat-sets/${approvedId}/sections/9/audio`, `/audio-kbat-sets/${approvedId}/sections/x/audio`, `/audio-kbat-sets/${draftId}/sections/1/audio`]) {
        expectError(await s().get(path), 'NOT_FOUND')
      }
      const key = (await t.db.query<{ storage_key: string }>(`select storage_key from files where public_id = $1`, [FILE_ID]))[0]?.storage_key as string
      await t.storage.delete(key)
      expectError(await s().get(`/audio-kbat-sets/${approvedId}/sections/1/audio`), 'NOT_FOUND')
      await t.storage.put(key, AUDIO_BYTES.mp3)
    })

    it('an audioFileId that points at a file of another purpose is never served', async () => {
      const other = await t.db.query<{ public_id: string }>(`insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ('Zk3Qx9vB2mLw7TnRa1YpUg', 'cms_image', 'image/png', 1, $1, 'cms-image/x.png') returning public_id`, ['a'.repeat(64)])
      const id = await insertAudioSet(t.db, { createdById: adminId, title: 'Lain tujuan', audioFileId: () => other[0]?.public_id ?? null })
      expectError(await s().get(`/audio-kbat-sets/${id}/sections/1/audio`), 'NOT_FOUND')
    })

    it('at most 8 audio reads run at once: the 9th is 429 with Retry-After until a slot frees', async () => {
      const gate = t.app.get(AudioReadGate)
      const held = Array.from({ length: AUDIO_READ_CONCURRENCY }, () => gate.acquire())
      const res = await student.agent.get(`/api/audio-kbat-sets/${approvedId}/sections/1/audio`)
      expectError(res, 'RATE_LIMITED', 'Too Many Attempts.')
      expect(res.headers['retry-after']).toBe('1')
      held[0]?.()
      expect((await student.agent.get(`/api/audio-kbat-sets/${approvedId}/sections/1/audio`)).status).toBe(200)
      for (const release of held) release()
      expect(gate.active).toBe(0) // the finished request freed its slot
      // a 404 frees its slot too
      expectError(await s().get(`/audio-kbat-sets/${approvedId}/sections/2/audio`), 'NOT_FOUND')
      expect(gate.active).toBe(0)
    })

    it('a malformed Range (end before start) is ignored: the whole body with 200', async () => {
      const res = await student.agent.get(`/api/audio-kbat-sets/${approvedId}/sections/1/audio`).set('Range', 'bytes=5-2')
      expect(res.status).toBe(200)
      expect(res.headers['content-length']).toBe(String(AUDIO_BYTES.mp3.length))
    })

    it('a stored audioFileId that is not a files public id is never used', async () => {
      const evil = await insertAudioSet(t.db, { createdById: adminId, title: 'Jahat', audioFileId: () => '../../files/avatar/x.mp3' })
      const detail = AudioKbatPlaySetSchema.parse((await s().get(`/audio-kbat-sets/${evil}`)).body.data)
      expect(detail.sections.every((x) => x.audioUrl === null)).toBe(true)
      expectError(await s().get(`/audio-kbat-sets/${evil}/sections/1/audio`), 'NOT_FOUND')
    })
  })

  describe('POST /api/audio-kbat-sets/:id/attempts', () => {
    const all = (pick: (n: number) => Choice) => Array.from({ length: 30 }, (_, i) => ({ no: i + 1, choice: pick(i + 1) }))

    async function attemptRows() {
      return t.db.query<{ user_id: string; set_id: string; score: number; total_marks: number; is_test: boolean; answers: { no: number; choice: string }[] }>(
        `select user_id::text, set_id::text, score, total_marks, is_test, answers from audio_kbat_attempts order by id`,
      )
    }

    it('marks on the server from the stored key: 10 correct of 30 questions at 2 marks each, one row per submit', async () => {
      const before = (await attemptRows()).length
      const res = await s().post(`/audio-kbat-sets/${approvedId}/attempts`, { answers: all((n) => (n <= 10 ? 'A' : 'B')) })
      expect(res.status).toBe(201)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(AudioKbatAttemptResultSchema.parse(res.body.data)).toEqual({ score: 60, totalMarks: 60 })
      // wrong on purpose: every answer 'C'
      const wrong = await s().post(`/audio-kbat-sets/${approvedId}/attempts`, { answers: all(() => 'C') })
      expect(wrong.body.data).toEqual({ score: 0, totalMarks: 60 })
      // a partial attempt is allowed: only the first 5 answered, all right
      const partial = await s().post(`/audio-kbat-sets/${approvedId}/attempts`, { answers: all(() => 'A').slice(0, 5) })
      expect(partial.body.data).toEqual({ score: 10, totalMarks: 60 })
      const rows = await attemptRows()
      expect(rows).toHaveLength(before + 3)
      const last = rows.at(-1)
      expect(last).toMatchObject({ set_id: approvedId, score: 10, total_marks: 60, is_test: false })
      expect(last?.answers).toHaveLength(5)
    })

    it('the user comes from the session; a userId in the body is ignored and the result carries no key', async () => {
      const mine = await userIdOf(t.db, 'pelajar@demo.test')
      const other = await userIdOf(t.db, 'guru@demo.test')
      const res = await s().post(`/audio-kbat-sets/${approvedId}/attempts`, { userId: other, answers: [{ no: 1, choice: 'A' }] })
      expect(res.status).toBe(201)
      expect(Object.keys(res.body.data as object).sort()).toEqual(['score', 'totalMarks'])
      expect([...allKeys(res.body)].sort()).toEqual(['data', 'score', 'totalMarks'])
      const rows = await attemptRows()
      expect(rows.at(-1)?.user_id).toBe(mine)
    })

    it('is_test is stamped under Mod Pelajar', async () => {
      const admin = await loginPartC(t, 'admin@demo.test')
      const entered = await admin.agent.post('/api/session/mode').set('X-CSRF-Token', admin.csrf).send({ mode: 'mod_pelajar' })
      expect(entered.status).toBe(200)
      const csrf = (entered.body as { data: { csrf: string } }).data.csrf
      const res = await admin.agent.post(`/api/audio-kbat-sets/${approvedId}/attempts`).set('X-CSRF-Token', csrf).send({ answers: [{ no: 1, choice: 'A' }] })
      expect(res.status).toBe(201)
      const rows = await attemptRows()
      expect(rows.at(-1)).toMatchObject({ is_test: true, user_id: adminId })
    })

    it('answers missing or empty is 422 fields.answers "Medan ini diperlukan."', async () => {
      for (const body of [{}, { answers: [] }, { answers: null }]) {
        const fields = fieldsOf(await s().post(`/audio-kbat-sets/${approvedId}/attempts`, body))
        expect(fields).toEqual({ answers: 'Medan ini diperlukan.' })
      }
    })

    it.each([
      ['not an array', { answers: 'A' }],
      ['an object', { answers: { no: 1, choice: 'A' } }],
      ['no below 1', { answers: [{ no: 0, choice: 'A' }] }],
      ['no above 30', { answers: [{ no: 31, choice: 'A' }] }],
      ['a fractional no', { answers: [{ no: 1.5, choice: 'A' }] }],
      ['a string no', { answers: [{ no: '1', choice: 'A' }] }],
      ['a duplicate no', { answers: [{ no: 1, choice: 'A' }, { no: 1, choice: 'B' }] }],
      ['a choice outside A to D', { answers: [{ no: 1, choice: 'E' }] }],
      ['a lower case choice', { answers: [{ no: 1, choice: 'a' }] }],
      ['an extra key in an answer', { answers: [{ no: 1, choice: 'A', correct: true }] }],
      ['a null entry', { answers: [null] }],
    ])('%s is 422 fields.answers "Medan ini tidak sah."', async (_name, body) => {
      const res = await s().post(`/audio-kbat-sets/${approvedId}/attempts`, body)
      expect(fieldsOf(res)).toEqual({ answers: 'Medan ini tidak sah.' })
      expect(errorOf(res).message).toBe('Medan ini tidak sah.')
    })

    it('a draft or unknown set is 404 before the body is judged (even with an invalid body)', async () => {
      const rowsBefore = (await attemptRows()).length
      expectError(await s().post(`/audio-kbat-sets/${draftId}/attempts`, { answers: [{ no: 1, choice: 'A' }] }), 'NOT_FOUND', 'Not Found.')
      expectError(await s().post(`/audio-kbat-sets/${draftId}/attempts`, {}), 'NOT_FOUND', 'Not Found.')
      expectError(await s().post('/audio-kbat-sets/424242/attempts', { answers: [{ no: 1, choice: 'A' }] }), 'NOT_FOUND', 'Not Found.')
      expect((await attemptRows()).length).toBe(rowsBefore)
    })

    it('writes an audit row without the answers', async () => {
      const rows = await t.db.query<{ action: string; detail: unknown }>(`select action, detail from audit_events where action = 'content.audio_attempt.submitted' order by id desc limit 1`)
      expect(rows[0]?.action).toBe('content.audio_attempt.submitted')
      expect(JSON.stringify(rows[0]?.detail)).not.toContain('choice')
    })
  })
})
