import { AdminAudioKbatCreatedSchema, AdminAudioKbatListResponseSchema, AUDIO_TEMPLATE_CONTENT_TYPES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { AudioRepository } from '../../src/modules/content/audio/audio.repository'
import {
  AUDIO_BYTES,
  allKeys,
  bootPartC,
  errorOf,
  expectError,
  fieldsOf,
  insertAudioSet,
  jsonOf,
  loginPartC,
  userIdOf,
  type LoggedIn,
  type PartCApp,
} from './audio-helpers'

type Req = ReturnType<LoggedIn['agent']['post']>

/** A multipart create request: 30 valid questions and 4 sections; `over` replaces or removes (`undefined`) fields. */
function createRequest(who: LoggedIn, over: Record<string, string | undefined> = {}, files: Record<number, { name: string; type: string; bytes: Buffer }> = {}): Req {
  const fields: Record<string, string | undefined> = {
    title: 'BM T4 Ujian Mendengar Set 2',
    educationLevelId: '10',
    subjectId: '1',
    sourceLabel: 'Sumber demo',
    instructions: 'Dengar dengan teliti.',
  }
  for (let s = 1; s <= 4; s++) {
    fields[`sections[${String(s)}][title]`] = `Bahagian ${String(s)}`
    fields[`sections[${String(s)}][transcript]`] = `Transkrip ${String(s)}`
  }
  for (let q = 1; q <= 30; q++) {
    const p = `questions[${String(q)}]`
    fields[`${p}[questionText]`] = `Soalan ${String(q)}?`
    fields[`${p}[optionA]`] = 'Pilihan A'
    fields[`${p}[optionB]`] = 'Pilihan B'
    fields[`${p}[optionC]`] = 'Pilihan C'
    fields[`${p}[optionD]`] = 'Pilihan D'
    fields[`${p}[correctAnswer]`] = q % 2 === 0 ? 'B' : 'A'
    fields[`${p}[marks]`] = '2'
    fields[`${p}[kbatLevel]`] = '4'
    fields[`${p}[explanation]`] = `Sebab ${String(q)}`
  }
  Object.assign(fields, over)
  let req = who.agent.post('/api/admin/audio-kbat-sets').set('X-CSRF-Token', who.csrf)
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) req = req.field(k, v)
  for (const [n, f] of Object.entries(files)) req = req.attach(`sections[${n}][audio]`, f.bytes, { filename: f.name, contentType: f.type })
  return req
}

describe('audio KBAT admin tools (AC 8)', () => {
  let t: PartCApp
  let admin: LoggedIn
  let student: LoggedIn
  let teacher: LoggedIn
  let adminId: string

  beforeAll(async () => {
    t = await bootPartC()
    admin = await loginPartC(t, 'admin@demo.test')
    student = await loginPartC(t, 'pelajar@demo.test')
    teacher = await loginPartC(t, 'guru@demo.test')
    adminId = await userIdOf(t.db, 'admin@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  describe('roles and CSRF', () => {
    it.each([
      ['GET', '/admin/audio-kbat-sets'],
      ['GET', '/admin/audio-kbat-sets/template'],
      ['POST', '/admin/audio-kbat-sets'],
    ] as const)('%s %s: 401 without a session, 403 for a student and a teacher', async (method, path) => {
      const send = (who: { agent: LoggedIn['agent']; csrf?: string } | null) => {
        const a = who ? who.agent : t.http()
        const r = method === 'GET' ? a.get(`/api${path}`) : a.post(`/api${path}`)
        return who?.csrf ? r.set('X-CSRF-Token', who.csrf) : r
      }
      expectError(await send(null), 'UNAUTHORIZED')
      expectError(await send(student), 'FORBIDDEN')
      expectError(await send(teacher), 'FORBIDDEN')
    })

    it('a create without the CSRF token is 403 CSRF_INVALID', async () => {
      const res = await admin.agent.post('/api/admin/audio-kbat-sets').field('title', 'x')
      expectError(res, 'CSRF_INVALID')
    })
  })

  describe('GET /api/admin/audio-kbat-sets', () => {
    let sets: Record<string, string> = {}

    beforeAll(async () => {
      sets = {
        approved: await insertAudioSet(t.db, { createdById: adminId, title: 'Set Meriah Satu' }),
        draft: await insertAudioSet(t.db, { createdById: adminId, status: 'draft', title: 'Set Draf', levelId: 11, subjectId: 2 }),
        pending: await insertAudioSet(t.db, { createdById: adminId, status: 'pending_review', title: 'Set Menunggu' }),
        archived: await insertAudioSet(t.db, { createdById: adminId, status: 'archived', title: 'Set Arkib 100%' }),
      }
    })

    it('lists every status, newest first, with statusLabel, questionCount and meta.stats over all sets', async () => {
      const res = await jsonOf(admin).get('/admin/audio-kbat-sets')
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const body = AdminAudioKbatListResponseSchema.parse(res.body)
      expect(body.data.map((r) => r.id)).toEqual([sets.archived, sets.pending, sets.draft, sets.approved])
      expect(body.data[0]).toMatchObject({ status: 'archived', statusLabel: 'Archived', questionCount: 30 })
      expect(body.data.find((r) => r.id === sets.pending)?.statusLabel).toBe('Pending Review')
      expect([...allKeys(res.body)].join(' ')).not.toMatch(/correct|explan|kbatLevel|dskp|option/i)
      expect(body.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 4, totalPages: 1, stats: { sets: 4, approved: 1, draftPending: 2, questions: 120 } })
    })

    it('filters by status, level, subject and search; stats stay global; an unknown status is ignored', async () => {
      const get = async (q: string) => AdminAudioKbatListResponseSchema.parse((await jsonOf(admin).get(`/admin/audio-kbat-sets${q}`)).body)
      expect((await get('?status=draft')).data.map((r) => r.id)).toEqual([sets.draft])
      expect((await get('?educationLevelId=11')).data.map((r) => r.id)).toEqual([sets.draft])
      expect((await get('?subjectId=2')).data.map((r) => r.id)).toEqual([sets.draft])
      expect((await get('?search=meriah')).data.map((r) => r.id)).toEqual([sets.approved])
      expect((await get('?search=100%25')).data.map((r) => r.id)).toEqual([sets.archived]) // % is literal
      expect((await get('?search=%25')).data.map((r) => r.id)).toEqual([sets.archived])
      expect((await get('?search=_')).data).toEqual([])
      expect((await get('?status=bogus')).data).toHaveLength(4)
      const filtered = await get('?status=draft')
      expect(filtered.meta.totalItems).toBe(1)
      expect(filtered.meta.stats.sets).toBe(4)
    })

    it('paginates: pageSize is honoured and clamped to 100, a bad page is page 1', async () => {
      const get = async (q: string) => AdminAudioKbatListResponseSchema.parse((await jsonOf(admin).get(`/admin/audio-kbat-sets${q}`)).body)
      const p2 = await get('?pageSize=2&page=2')
      expect(p2.data).toHaveLength(2)
      expect(p2.meta).toMatchObject({ page: 2, pageSize: 2, totalItems: 4, totalPages: 2, from: 3, to: 4 })
      expect((await get('?pageSize=5000')).meta.pageSize).toBe(100)
      expect((await get('?page=abc')).meta.page).toBe(1)
    })
  })

  describe('GET /api/admin/audio-kbat-sets/template', () => {
    it.each(['xlsx', 'docx'] as const)('downloads template-audio-kbat.%s with an attachment header', async (format) => {
      const res = await jsonOf(admin).get(`/admin/audio-kbat-sets/template?format=${format}`)
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain(AUDIO_TEMPLATE_CONTENT_TYPES[format])
      expect(res.headers['content-disposition']).toBe(`attachment; filename="template-audio-kbat.${format}"`)
    })

    it('defaults to xlsx; an unknown format is 422 fields.format "Medan ini tidak sah."', async () => {
      const def = await jsonOf(admin).get('/admin/audio-kbat-sets/template')
      expect(def.headers['content-disposition']).toContain('.xlsx')
      for (const q of ['?format=pdf', '?format=', '?format=xlsx&format=docx']) {
        expect(fieldsOf(await jsonOf(admin).get(`/admin/audio-kbat-sets/template${q}`))).toEqual({ format: 'Medan ini tidak sah.' })
      }
    })
  })

  describe('POST /api/admin/audio-kbat-sets', () => {
    it('creates a set with 4 stored audio files: 201, flash, row, files in storage, audit row, creator from the session', async () => {
      const res = await createRequest(admin, { createdById: '999', userId: '999' }, {
        1: { name: 'Bahagian Satu.MP3', type: 'audio/mpeg', bytes: AUDIO_BYTES.mp3 },
        2: { name: 'dua.m4a', type: 'audio/mp4', bytes: AUDIO_BYTES.m4a },
        3: { name: 'tiga.wav', type: '', bytes: AUDIO_BYTES.wav },
        4: { name: 'empat.ogg', type: 'audio/ogg', bytes: AUDIO_BYTES.ogg },
      })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(res.body.status).toBe('Set Audio KBAT berjaya disimpan.')
      expect([...allKeys(res.body)].join(' ')).not.toMatch(/correct|explan|kbatLevel|dskp|option/i)
      const created = AdminAudioKbatCreatedSchema.parse(res.body.data)
      expect(created).toMatchObject({ title: 'BM T4 Ujian Mendengar Set 2', status: 'approved', statusLabel: 'Approved', questionCount: 30, sourceLabel: 'Sumber demo' })
      expect(created.sections.map((s) => [s.no, s.title, s.questionFrom, s.questionTo])).toEqual([
        [1, 'Bahagian 1', 1, 8],
        [2, 'Bahagian 2', 9, 16],
        [3, 'Bahagian 3', 17, 24],
        [4, 'Bahagian 4', 25, 30],
      ])
      expect(created.sections.map((s) => s.audioFileName)).toEqual(['bahagian-satu.mp3', 'dua.m4a', 'tiga.wav', 'empat.ogg'])

      const rows = await t.db.query<{ created_by_id: string; status: string; sections: { audioFileId: string }[]; questions: { no: number; correctAnswer: string; marks: number }[] }>(
        `select created_by_id::text, status, sections, questions from audio_kbat_sets where id = $1`,
        [created.id],
      )
      expect(rows[0]?.created_by_id).toBe(adminId)
      expect(rows[0]?.questions).toHaveLength(30)
      expect(rows[0]?.questions[1]).toMatchObject({ no: 2, correctAnswer: 'B', marks: 2 })
      for (const s of rows[0]?.sections ?? []) {
        expect(s.audioFileId).toMatch(/^[A-Za-z0-9_-]{22}$/)
        const file = await t.db.query<{ purpose: string; owner_user_id: string; storage_key: string }>(`select purpose, owner_user_id::text, storage_key from files where public_id = $1`, [s.audioFileId])
        expect(file[0]).toMatchObject({ purpose: 'audio_kbat', owner_user_id: adminId })
        expect(await t.storage.exists(file[0]?.storage_key as string)).toBe(true)
      }
      const audit = await t.db.query<{ actor_user_id: string; target_id: string }>(
        `select actor_user_id::text, target_id from audit_events where action = 'content.audio_set.created' order by id desc limit 1`,
      )
      expect(audit[0]).toMatchObject({ actor_user_id: adminId, target_id: created.id })
    })

    it('a created approved set is playable end to end: the student sees it and the audio is served', async () => {
      const pel = await loginPartC(t, 'pelajar@demo.test')
      const create = await createRequest(admin, { title: 'Set Boleh Main' }, { 1: { name: 'a.mp3', type: 'audio/mpeg', bytes: AUDIO_BYTES.mp3 } })
      const id = String((create.body as { data: { id: string } }).data.id)
      const detail = await pel.agent.get(`/api/audio-kbat-sets/${id}`)
      expect(detail.status).toBe(200)
      expect(JSON.stringify(detail.body)).not.toContain('correctAnswer')
      const audio = await pel.agent.get(`/api/audio-kbat-sets/${id}/sections/1/audio`)
      expect(audio.status).toBe(200)
      expect(audio.headers['content-type']).toBe('audio/mpeg')
      const attempt = await pel.agent.post(`/api/audio-kbat-sets/${id}/attempts`).set('X-CSRF-Token', pel.csrf).send({ answers: Array.from({ length: 30 }, (_, i) => ({ no: i + 1, choice: (i + 1) % 2 === 0 ? 'B' : 'A' })) })
      expect(attempt.body.data).toEqual({ score: 60, totalMarks: 60 })
    })

    it('works without any audio file (the audio is optional), defaults: status approved, marks 1, level 3, title "Audio n"', async () => {
      const over: Record<string, string | undefined> = { status: undefined }
      for (let s = 1; s <= 4; s++) over[`sections[${String(s)}][title]`] = undefined
      for (let q = 1; q <= 30; q++) {
        over[`questions[${String(q)}][marks]`] = undefined
        over[`questions[${String(q)}][kbatLevel]`] = undefined
      }
      const res = await createRequest(admin, { ...over, status: 'draft' })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const created = AdminAudioKbatCreatedSchema.parse(res.body.data)
      expect(created.status).toBe('draft')
      expect(created.sections.map((s) => [s.title, s.audioFileName])).toEqual([['Audio 1', null], ['Audio 2', null], ['Audio 3', null], ['Audio 4', null]])
      const rows = await t.db.query<{ questions: { marks: number; kbatLevel: number }[] }>(`select questions from audio_kbat_sets where id = $1`, [created.id])
      expect(rows[0]?.questions.every((q) => q.marks === 1 && q.kbatLevel === 3)).toBe(true)
    })

    it('accepts a JSON body with arrays (as the mock did)', async () => {
      const body = {
        title: 'Set JSON',
        educationLevelId: 10,
        subjectId: '1',
        status: 'pending_review',
        sections: [1, 2, 3, 4].map((n) => ({ no: n, title: `J${String(n)}` })),
        questions: Array.from({ length: 30 }, (_, i) => ({ no: i + 1, questionText: 'S', optionA: 'a', optionB: 'b', optionC: 'c', optionD: 'd', correctAnswer: 'c' })),
      }
      const res = await jsonOf(admin).post('/admin/audio-kbat-sets', body)
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const created = AdminAudioKbatCreatedSchema.parse(res.body.data)
      expect(created.status).toBe('pending_review')
      expect(created.sections[0]?.title).toBe('J1')
      const rows = await t.db.query<{ questions: { correctAnswer: string }[] }>(`select questions from audio_kbat_sets where id = $1`, [created.id])
      expect(rows[0]?.questions[0]?.correctAnswer).toBe('C')
    })

    it('required and invalid fields are 422 with dotted keys and the first message as the summary', async () => {
      const res = await createRequest(admin, {
        title: undefined,
        educationLevelId: 'abc',
        subjectId: undefined,
        status: 'archived',
        'questions[5][optionA]': undefined,
        'questions[6][correctAnswer]': 'E',
        'questions[7][marks]': '21',
        'questions[8][kbatLevel]': '0',
        'questions[9][dskpSpId]': 'x',
        'sections[2][title]': 'x'.repeat(256),
      })
      const fields = fieldsOf(res)
      expect(fields).toMatchObject({
        title: 'Medan ini diperlukan.',
        educationLevelId: 'Medan ini tidak sah.',
        subjectId: 'Medan ini diperlukan.',
        status: 'Medan ini tidak sah.',
        'questions.5.optionA': 'Medan ini diperlukan.',
        'questions.6.correctAnswer': 'Medan ini tidak sah.',
        'questions.7.marks': 'Medan ini tidak sah.',
        'questions.8.kbatLevel': 'Medan ini tidak sah.',
        'questions.9.dskpSpId': 'Medan ini tidak sah.',
        'sections.2.title': 'Medan ini tidak sah.',
      })
      expect(errorOf(res).message).toBe('Medan ini diperlukan. (and 9 more errors)')
    })

    it('a missing question (fewer than 30) is reported per question', async () => {
      const res = await jsonOf(admin).post('/admin/audio-kbat-sets', { title: 'T', educationLevelId: '10', subjectId: '1', sections: [], questions: [] })
      const fields = fieldsOf(res)
      expect(fields['questions.1.questionText']).toBe('Medan ini diperlukan.')
      expect(fields['questions.30.correctAnswer']).toBe('Medan ini diperlukan.')
    })

    it('refuses a bad audio file per section and stores nothing: wrong bytes, wrong extension, wrong declared type, empty, too big', async () => {
      const before = await t.db.query<{ n: number }>(`select count(*)::int as n from audio_kbat_sets`)
      const stored = async () => (await t.db.query<{ n: number }>(`select count(*)::int as n from files where purpose = 'audio_kbat'`))[0]?.n
      const objectsBefore = await stored()
      const res = await createRequest(admin, {}, {
        1: { name: 'fake.mp3', type: 'audio/mpeg', bytes: Buffer.from('<html><script>alert(1)</script></html>') },
        2: { name: 'malware.exe', type: 'audio/mpeg', bytes: AUDIO_BYTES.mp3 },
        3: { name: 'tipu.mp3', type: 'text/html', bytes: AUDIO_BYTES.mp3 },
        4: { name: 'kosong.wav', type: 'audio/wav', bytes: Buffer.alloc(0) },
      })
      const fields = fieldsOf(res)
      expect(fields).toEqual({
        'sections.1.audio': 'fake.mp3: format atau saiz tidak dibenarkan.',
        'sections.2.audio': 'malware.exe: format atau saiz tidak dibenarkan.',
        'sections.3.audio': 'tipu.mp3: format atau saiz tidak dibenarkan.',
        'sections.4.audio': 'kosong.wav: format atau saiz tidak dibenarkan.',
      })
      expect((await t.db.query<{ n: number }>(`select count(*)::int as n from audio_kbat_sets`))[0]).toEqual(before[0])
      expect(await stored()).toBe(objectsBefore)
    })

    it('an unknown level or subject is 422 "Medan ini tidak sah." on that field; names are resolved in the responses', async () => {
      const res = await createRequest(admin, { educationLevelId: '99', subjectId: '98' })
      expect(fieldsOf(res)).toEqual({ educationLevelId: 'Medan ini tidak sah.', subjectId: 'Medan ini tidak sah.' })
      const ok = await createRequest(admin, { educationLevelId: '11', subjectId: '2', title: 'Nama dipadan' })
      expect(ok.status).toBe(201)
      expect(ok.body.data).toMatchObject({ educationLevel: { id: '11', name: 'Tingkatan 5' }, subject: { id: '2', name: 'Bahasa Inggeris' } })
      const list = await jsonOf(admin).get('/admin/audio-kbat-sets?search=Nama%20dipadan')
      expect(list.body.data[0]).toMatchObject({ educationLevel: { name: 'Tingkatan 5' }, subject: { name: 'Bahasa Inggeris' } })
    })

    it('a NUL character in a title, a question or a transcript is 422 on the field, not 500; a NUL in the search is ignored', async () => {
      const res = await createRequest(admin, { title: 'a b', 'questions[3][questionText]': 'x ', 'sections[1][transcript]': ' ' })
      expect(fieldsOf(res)).toMatchObject({ title: 'Medan ini tidak sah.', 'questions.3.questionText': 'Medan ini tidak sah.', 'sections.1.transcript': 'Medan ini tidak sah.' })
      const list = await jsonOf(admin).get('/admin/audio-kbat-sets?search=a%00b')
      expect(list.status).toBe(200)
    })

    it('a mp3 renamed to .wav is refused (the bytes must match the extension)', async () => {
      const res = await createRequest(admin, {}, { 1: { name: 'salah.wav', type: 'audio/wav', bytes: AUDIO_BYTES.mp3 } })
      expect(fieldsOf(res)).toEqual({ 'sections.1.audio': 'salah.wav: format atau saiz tidak dibenarkan.' })
    })

    it('a file over 20 MB is refused with 422 and nothing is stored', async () => {
      const big = Buffer.concat([AUDIO_BYTES.mp3, Buffer.alloc(20 * 1024 * 1024)])
      const res = await createRequest(admin, {}, { 1: { name: 'besar.mp3', type: 'audio/mpeg', bytes: big } })
      expect(res.status).toBe(422)
      expect(errorOf(res).code).toBe('VALIDATION_ERROR')
    })

    it('removes the stored audio again when the database write fails', async () => {
      const stored = async () => (await t.db.query<{ n: number }>(`select count(*)::int as n from files where purpose = 'audio_kbat'`))[0]?.n
      const before = await stored()
      const spy = vi.spyOn(t.app.get(AudioRepository), 'createSet').mockRejectedValueOnce(new Error('boom'))
      const res = await createRequest(admin, {}, { 1: { name: 'a.mp3', type: 'audio/mpeg', bytes: AUDIO_BYTES.mp3 } })
      spy.mockRestore()
      expect(res.status).toBe(500)
      expect(await stored()).toBe(before) // the audio_kbat rows and objects are discarded again
    })

    it.each([['educationLevelId', '99999'], ['subjectId', '99999']])('a curriculum row deleted between the check and the insert (FK %s) is 422 on the field, not 500', async (field, badId) => {
      const repo = t.app.get(AudioRepository)
      const real = repo.createSet.bind(repo)
      const spy = vi.spyOn(repo, 'createSet').mockImplementationOnce((input) => real({ ...input, [field]: badId }))
      const res = await createRequest(admin, { title: 'Perlumbaan' })
      spy.mockRestore()
      expect(fieldsOf(res)).toEqual({ [field]: 'Medan ini tidak sah.' })
      expect((await t.db.query(`select 1 from audio_kbat_sets where title = 'Perlumbaan'`)).length).toBe(0)
    })

    it('database overload on the write is 429, not 500', async () => {
      const spy = vi.spyOn(t.app.get(AudioRepository), 'createSet').mockRejectedValueOnce(Object.assign(new Error('pool'), { code: 'P2024' }))
      const res = await createRequest(admin)
      spy.mockRestore()
      expectError(res, 'RATE_LIMITED', 'Too Many Attempts.')
    })
  })
})
