import { DSKP_MESSAGES as D, DskpBidangSchema, DskpSkSchema, DskpSpSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, STUDENT_1, TEACHER_A, bootQsApp, client, idOfEmail, type Client, type QsTestApp } from './qs-helpers'

describe('BE-18 B: teacher DSKP picks (bidang, SK, SP)', () => {
  let t: QsTestApp
  let teacher: Client
  let teacherId: string
  let subjectId: string
  let levelId: string

  beforeAll(async () => {
    t = await bootQsApp()
    teacher = await client(t, TEACHER_A)
    teacherId = await idOfEmail(t, TEACHER_A)
    subjectId = (await t.db.query<{ id: string }>(`select id::text id from subjects order by id limit 1`))[0]?.id as string
    levelId = (await t.db.query<{ id: string }>(`select id::text id from education_levels order by id limit 1`))[0]?.id as string
  })
  afterAll(async () => {
    await t.close()
  })

  const bidang = (body: object, c: Client = teacher) => c.post('/guru/dskp/bidang', body)
  const refused = (res: { status: number; body: unknown }, message: string) => {
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body).toEqual({ error: message })
  }
  const count = async (table: string) => Number((await t.db.query<{ n: string }>(`select count(*)::text n from ${table}`))[0]?.n)

  describe('POST /guru/dskp/bidang', () => {
    it('201 with the bare row; stores created_by_id and is_test; trims; blank code is null', async () => {
      const res = await bidang({ name: '  Nombor dan Operasi  ', subjectId, educationLevelId: levelId, code: ' A1 ' })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const row = DskpBidangSchema.parse(res.body)
      expect(res.body).toEqual({ id: row.id, code: 'A1', name: 'Nombor dan Operasi' })
      const stored = (await t.db.query(`select created_by_id::text c, is_test, subject_id::text s, education_level_id::text l from dskp_bidang where id = $1`, [row.id]))[0]
      expect(stored).toEqual({ c: teacherId, is_test: false, s: subjectId, l: levelId })
      const noCode = await bidang({ name: 'Tanpa Kod', subjectId: Number(subjectId), educationLevelId: Number(levelId), code: '   ' })
      expect(noCode.status).toBe(201)
      expect(noCode.body.code).toBeNull()
      const absent = await bidang({ name: 'Kod Tiada', subjectId, educationLevelId: levelId })
      expect(absent.status).toBe(201)
      expect(absent.body.code).toBeNull()
    })

    it('refuses a missing, blank or over-long name, and a code over 50 characters, with the name text (HTTP 200)', async () => {
      refused(await bidang({ subjectId, educationLevelId: levelId }), D.bidangName)
      refused(await bidang({ name: '   ', subjectId, educationLevelId: levelId }), D.bidangName)
      refused(await bidang({ name: 'x'.repeat(256), subjectId, educationLevelId: levelId }), D.bidangName)
      refused(await bidang({ name: 'x', subjectId, educationLevelId: levelId, code: 'c'.repeat(51) }), D.bidangName)
      expect((await bidang({ name: 'x'.repeat(255), subjectId, educationLevelId: levelId, code: 'c'.repeat(50) })).status).toBe(201)
    })

    it('refuses an unknown, missing or malformed subject or level with the parent text', async () => {
      refused(await bidang({ name: 'B', educationLevelId: levelId }), D.bidangParent)
      refused(await bidang({ name: 'B', subjectId }), D.bidangParent)
      refused(await bidang({ name: 'B', subjectId: '999999999', educationLevelId: levelId }), D.bidangParent)
      refused(await bidang({ name: 'B', subjectId, educationLevelId: '999999999' }), D.bidangParent)
      refused(await bidang({ name: 'B', subjectId: 'abc', educationLevelId: levelId }), D.bidangParent)
      refused(await bidang({ name: 'B', subjectId: 0, educationLevelId: levelId }), D.bidangParent)
      refused(await bidang({ name: 'B', subjectId: '99999999999999999999999', educationLevelId: levelId }), D.bidangParent)
    })

    it('check order: name, then parent, then code length', async () => {
      refused(await bidang({ name: '', subjectId: '999999999', educationLevelId: levelId }), D.bidangName)
      refused(await bidang({ name: 'B', subjectId: '999999999', educationLevelId: levelId, code: 'c'.repeat(51) }), D.bidangParent)
      refused(await bidang({}), D.bidangName)
    })

    it('a refusal writes nothing; a body that is not an object is a name refusal', async () => {
      const before = await count('dskp_bidang')
      refused(await bidang({ name: '' }), D.bidangName)
      // A NUL character is refused by the global NUL guard (common/security/nul-guard) before the handler: 422, nothing written.
      const nul = await bidang({ name: 'a\u0000b', subjectId, educationLevelId: levelId })
      expect(nul.status).toBe(422)
      expect((nul.body as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR')
      const res = await teacher.who.agent.post('/api/guru/dskp/bidang').set('X-CSRF-Token', teacher.who.csrf).send([1, 2])
      refused(res, D.bidangName)
      expect(await count('dskp_bidang')).toBe(before)
    })

    it('an admin in Mod Pelajar acts as a student, so the teacher route refuses (is_test is stamped from the actor when it is ever true)', async () => {
      const agent = t.agent()
      const login = await agent.post('/api/auth/login').send({ identifier: ADMIN, password: 'Demo1234', remember: false })
      const mode = await agent.post('/api/session/mode').set('X-CSRF-Token', login.body.data.csrf).send({ mode: 'mod_pelajar' })
      expect(mode.status, JSON.stringify(mode.body)).toBe(200)
      const csrf = (mode.body.data as { csrf?: string }).csrf ?? login.body.data.csrf
      const res = await agent.post('/api/guru/dskp/bidang').set('X-CSRF-Token', csrf).send({ name: 'Ujian Mod', subjectId, educationLevelId: levelId })
      expect(res.status).toBe(403)
    })
  })

  describe('POST /guru/dskp/sk', () => {
    let bidangId: string
    beforeAll(async () => {
      bidangId = (await bidang({ name: 'Induk SK', subjectId, educationLevelId: levelId })).body.id
    })
    const sk = (body: object, c: Client = teacher) => c.post('/guru/dskp/sk', body)

    it('201 with the bare row and created_by_id; a numeric bidangId is accepted', async () => {
      const res = await sk({ bidangId, code: ' 1.1 ', description: '  Memahami nombor  ' })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(DskpSkSchema.parse(res.body)).toEqual({ id: res.body.id, code: '1.1', description: 'Memahami nombor' })
      const stored = (await t.db.query(`select created_by_id::text c, bidang_id::text b from dskp_sk where id = $1`, [res.body.id]))[0]
      expect(stored).toEqual({ c: teacherId, b: bidangId })
      expect((await sk({ bidangId: Number(bidangId), code: '1.2', description: 'd' })).status).toBe(201)
      expect((await sk({ bidangId, code: 'c'.repeat(50), description: 'd'.repeat(2000) })).status).toBe(201)
    })

    it('refuses code or description that is missing, blank or too long with the fields text', async () => {
      refused(await sk({ bidangId, description: 'd' }), D.skFields)
      refused(await sk({ bidangId, code: 'c' }), D.skFields)
      refused(await sk({ bidangId, code: ' ', description: 'd' }), D.skFields)
      refused(await sk({ bidangId, code: 'c'.repeat(51), description: 'd' }), D.skFields)
      refused(await sk({ bidangId, code: 'c', description: 'd'.repeat(2001) }), D.skFields)
    })

    it('refuses an unknown, missing or malformed bidang with the parent text', async () => {
      refused(await sk({ code: 'c', description: 'd' }), D.skParent)
      refused(await sk({ bidangId: '999999999', code: 'c', description: 'd' }), D.skParent)
      refused(await sk({ bidangId: 'x', code: 'c', description: 'd' }), D.skParent)
    })

    it('check order: code and description before the parent', async () => {
      refused(await sk({ bidangId: '999999999', code: '', description: 'd' }), D.skFields)
      refused(await sk({}), D.skFields)
    })
  })

  describe('POST /guru/dskp/sp', () => {
    let skId: string
    beforeAll(async () => {
      const b = (await bidang({ name: 'Induk SP', subjectId, educationLevelId: levelId })).body.id
      skId = (await teacher.post('/guru/dskp/sk', { bidangId: b, code: '2.1', description: 'Induk' })).body.id
    })
    const sp = (body: object) => teacher.post('/guru/dskp/sp', body)

    it('201 with the bare row and created_by_id', async () => {
      const res = await sp({ skId, code: '2.1.1', description: 'Menyelesaikan masalah' })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(DskpSpSchema.parse(res.body)).toEqual({ id: res.body.id, code: '2.1.1', description: 'Menyelesaikan masalah' })
      const stored = (await t.db.query(`select created_by_id::text c, sk_id::text s, is_test from dskp_sp where id = $1`, [res.body.id]))[0]
      expect(stored).toEqual({ c: teacherId, s: skId, is_test: false })
    })

    it('refusals, texts and check order', async () => {
      refused(await sp({ skId, code: '', description: 'd' }), D.spFields)
      refused(await sp({ skId, code: 'c', description: 'd'.repeat(2001) }), D.spFields)
      refused(await sp({ skId, code: 'c'.repeat(51), description: 'd' }), D.spFields)
      refused(await sp({ code: 'c', description: 'd' }), D.spParent)
      refused(await sp({ skId: '999999999', code: 'c', description: 'd' }), D.spParent)
      refused(await sp({ skId: '999999999', code: '', description: 'd' }), D.spFields)
      refused(await sp({}), D.spFields)
    })

    it('the parent of an SP is an SK, not a bidang id that happens to match', async () => {
      const maxSk = Number((await t.db.query<{ m: string }>(`select max(id)::text m from dskp_sk`))[0]?.m)
      refused(await sp({ skId: String(maxSk + 1000), code: 'c', description: 'd' }), D.spParent)
    })
  })

  describe('guards (every route)', () => {
    const calls: [string, object][] = [
      ['/guru/dskp/bidang', { name: 'x' }],
      ['/guru/dskp/sk', { code: 'c' }],
      ['/guru/dskp/sp', { code: 'c' }],
    ]
    it('anonymous is 401', async () => {
      for (const [path, body] of calls) {
        const res = await t.http().post(`/api${path}`).send(body)
        expect(res.status, path).toBe(401)
        expect(res.body.error.message).toBe('Unauthenticated.')
      }
    })
    it('a student is 403 "This action is unauthorized."', async () => {
      const s = await client(t, STUDENT_1)
      for (const [path, body] of calls) {
        const res = await s.post(path, body)
        expect(res.status, path).toBe(403)
        expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: 'This action is unauthorized.' })
      }
    })
    it('a missing CSRF token is 403 CSRF_INVALID', async () => {
      for (const [path, body] of calls) {
        const res = await teacher.who.agent.post(`/api${path}`).send(body)
        expect(res.status, path).toBe(403)
        expect(res.body.error.code).toBe('CSRF_INVALID')
      }
    })
    it('an admin may create', async () => {
      const admin = await client(t, ADMIN)
      expect((await bidang({ name: 'Oleh Admin', subjectId, educationLevelId: levelId }, admin)).status).toBe(201)
    })
  })
})

describe('BE-18 B: DSKP picks rate limit (D57)', () => {
  let t: QsTestApp
  beforeAll(async () => {
    t = await bootQsApp({ env: { THROTTLE_CLASSES_WRITE_PER_MINUTE: '2' } })
  })
  afterAll(async () => {
    await t.close()
  })

  it('429 RATE_LIMITED with Retry-After on the third write, for each of the three routes sharing one bucket', async () => {
    const teacher = await client(t, TEACHER_A)
    expect((await teacher.post('/guru/dskp/bidang', {})).status).toBe(200)
    expect((await teacher.post('/guru/dskp/sk', {})).status).toBe(200)
    for (const path of ['/guru/dskp/bidang', '/guru/dskp/sk', '/guru/dskp/sp']) {
      const res = await teacher.post(path, {})
      expect(res.status, path).toBe(429)
      expect(res.body.error.code).toBe('RATE_LIMITED')
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
    }
  })
})
