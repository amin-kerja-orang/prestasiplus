import { CurriculumTopicsQuerySchema } from '@pp/contract'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { AuditService } from '../../src/common/audit'
import { CurriculumRepository } from '../../src/modules/curriculum/curriculum.repository'
import { translateDbError } from '../../src/modules/curriculum/errors'
import { CurriculumPorts } from '../../src/modules/curriculum/providers'
import { BoundedQueryPipe } from '../../src/modules/curriculum/validation'
import { bootCurriculumApp, chapterIdOf, count, expectError, idOf, loginAs, type Client, type CurriculumTestApp } from './helpers'

/**
 * Pre-LEAD review fixes on the admin writes: strict bodies (BE-NFR-05), audit trail (BE-NFR-08),
 * Prisma race errors mapped to 404 and 422, bounded inputs (BE-NFR-25), the `{active}` chapter filter
 * and the provider ports.
 */
describe('curriculum write hardening', () => {
  let t: CurriculumTestApp
  let admin: Client
  let repo: CurriculumRepository
  let bm: string
  let d1: string
  let chapterId: string
  let topicId: string
  let subtopicId: string
  const api = '/api/admin/curriculum'

  beforeAll(async () => {
    t = await bootCurriculumApp()
    admin = await loginAs(t, 'admin@demo.test')
    repo = t.app.get(CurriculumRepository)
    bm = await idOf(t.db, 'subjects', 'BM')
    d1 = await idOf(t.db, 'education_levels', 'D1')
    const chapter = await admin.post(`${api}/chapters`, { subjectId: bm, educationLevelId: d1, name: 'Bab Kukuh', chapterNumber: 90 })
    chapterId = chapter.body.data.id
    const topic = await admin.post(`${api}/topics`, { chapterId, name: 'Topik Kukuh', topicNumber: '1' })
    topicId = topic.body.data.id
    const sub = await admin.post(`${api}/subtopics`, { topicId, name: 'Subtopik Kukuh' })
    subtopicId = sub.body.data.id
  })
  afterAll(async () => {
    await t.close()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const levelId = async () => (await t.db.query<{ id: string }>(`select id::text from education_levels where code = 'T4'`))[0]!.id

  describe('strict bodies: an unknown key is a 422 on every write route', () => {
    const cases = async () => {
      const t4 = await levelId()
      return [
        ['post', '/api/admin/education-levels', { name: 'a', nameEn: 'b', code: 'sx1', stage: 'primary', curriculum: 'KSSR' }],
        ['put', `/api/admin/education-levels/${t4}`, { name: 'a', nameEn: 'b', code: 'T4', stage: 'upper_secondary', curriculum: 'KSSM' }],
        ['patch', `/api/admin/education-levels/${t4}/active`, { isActive: true }],
        ['post', '/api/admin/subjects', { name: 'a', nameEn: 'b', code: 'sx2' }],
        ['put', `/api/admin/subjects/${bm}`, { name: 'a', nameEn: 'b', code: 'BM' }],
        ['patch', `/api/admin/subjects/${bm}/active`, { isActive: true }],
        ['post', `${api}/chapters`, { subjectId: bm, educationLevelId: d1, name: 'x' }],
        ['put', `${api}/chapters/${chapterId}`, { subjectId: bm, educationLevelId: d1, name: 'x' }],
        ['post', `${api}/topics`, { chapterId, name: 'x' }],
        ['put', `${api}/topics/${topicId}`, { name: 'x' }],
        ['post', `${api}/subtopics`, { topicId, name: 'x' }],
        ['put', `${api}/subtopics/${subtopicId}`, { name: 'x' }],
      ] as const
    }

    it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])('route %i: valid body plus an unknown key is 422 and changes nothing', async (i) => {
      const [method, url, body] = (await cases())[i]!
      const before = {
        levels: await count(t.db, 'select count(*) n from education_levels'),
        subjects: await count(t.db, 'select count(*) n from subjects'),
        chapters: await count(t.db, 'select count(*) n from chapters'),
        topics: await count(t.db, 'select count(*) n from topics'),
        subtopics: await count(t.db, 'select count(*) n from subtopics'),
        audits: await count(t.db, `select count(*) n from audit_events where action like 'curriculum.%'`),
      }
      const res = await admin[method](url, { ...body, bogus: 1 })
      expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ bogus: 'The bogus field is prohibited.' })
      expect({
        levels: await count(t.db, 'select count(*) n from education_levels'),
        subjects: await count(t.db, 'select count(*) n from subjects'),
        chapters: await count(t.db, 'select count(*) n from chapters'),
        topics: await count(t.db, 'select count(*) n from topics'),
        subtopics: await count(t.db, 'select count(*) n from subtopics'),
        audits: await count(t.db, `select count(*) n from audit_events where action like 'curriculum.%'`),
      }).toEqual(before)
    })

    it('reports at most 20 unknown keys and cuts a long key name', async () => {
      const junk = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, 1]))
      const many = expectError(await admin.post(`${api}/topics`, { chapterId, name: 'x', ...junk }), 'VALIDATION_ERROR')
      expect(Object.keys(many.fields!)).toHaveLength(20)
      const long = expectError(await admin.post(`${api}/topics`, { chapterId, name: 'x', ['z'.repeat(500)]: 1 }), 'VALIDATION_ERROR')
      expect(Object.keys(long.fields!)[0]).toHaveLength(64)
    })

    it('a prototype-pollution style key is just an unknown key', async () => {
      const res = await admin.noCsrf.post(`${api}/topics`).set('X-CSRF-Token', admin.csrf).type('json').send('{"chapterId":"' + chapterId + '","name":"x","__proto__":{"isAdmin":true},"constructor":{"a":1}}')
      expect(expectError(res, 'VALIDATION_ERROR').fields).toMatchObject({ constructor: 'The constructor field is prohibited.' })
    })

    it('topic PUT keeps the one exception: chapterId (BR-07, ignored by the mock) is accepted and not applied', async () => {
      const other = (await admin.post(`${api}/chapters`, { subjectId: bm, educationLevelId: d1, name: 'Bab Lain', chapterNumber: 91 })).body.data.id
      const res = await admin.put(`${api}/topics/${topicId}`, { chapterId: other, name: 'Topik Kukuh' })
      expect(res.status).toBe(200)
      expect(res.body.data.chapterId).toBe(chapterId)
      expect(await count(t.db, 'select count(*) n from topics where id = $1 and chapter_id = $2', [topicId, chapterId])).toBe(1)
    })

    it('an empty body on an active toggle is a normal required-field 422, an array body is the body-shape 422', async () => {
      expect(expectError(await admin.patch(`/api/admin/subjects/${bm}/active`, {}), 'VALIDATION_ERROR').fields).toEqual({ isActive: 'The is active field is required.' })
      const res = await admin.noCsrf.patch(`/api/admin/subjects/${bm}/active`).set('X-CSRF-Token', admin.csrf).type('json').send('[]')
      expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ _: 'The request body must be a JSON object.' })
    })
  })

  describe('audit trail (BE-NFR-08)', () => {
    const rows = (action: string) =>
      t.db.query<{ actor_user_id: string; actor_role: string; target_type: string; target_id: string; request_id: string | null; detail: unknown }>(
        'select actor_user_id::text, actor_role, target_type, target_id, request_id, detail from audit_events where action = $1 order by id',
        [action],
      )

    it('every create, update, active toggle and delete writes one row: actor, role, target, request id, no content', async () => {
      const level = (await admin.post('/api/admin/education-levels', { name: 'Tahap Audit', nameEn: 'Audit', code: 'au1', stage: 'primary', curriculum: 'KSSR' })).body.data.id as string
      await admin.put(`/api/admin/education-levels/${level}`, { name: 'Tahap Audit 2', nameEn: 'Audit', code: 'au1', stage: 'primary', curriculum: 'KSSR' })
      await admin.patch(`/api/admin/education-levels/${level}/active`, { isActive: false })
      const subject = (await admin.post('/api/admin/subjects', { name: 'Subjek Audit', nameEn: 'Audit', code: 'aud1' })).body.data.id as string
      await admin.put(`/api/admin/subjects/${subject}`, { name: 'Subjek Audit 2', nameEn: 'Audit', code: 'aud1' })
      await admin.patch(`/api/admin/subjects/${subject}/active`, { isActive: false })
      const chapter = (await admin.post(`${api}/chapters`, { subjectId: subject, educationLevelId: level, name: 'Bab Audit' })).body.data.id as string
      await admin.put(`${api}/chapters/${chapter}`, { subjectId: subject, educationLevelId: level, name: 'Bab Audit 2' })
      const topic = (await admin.post(`${api}/topics`, { chapterId: chapter, name: 'Topik Audit' })).body.data.id as string
      await admin.put(`${api}/topics/${topic}`, { name: 'Topik Audit 2' })
      const sub = (await admin.post(`${api}/subtopics`, { topicId: topic, name: 'Sub Audit' })).body.data.id as string
      await admin.put(`${api}/subtopics/${sub}`, { name: 'Sub Audit 2' })
      await admin.delete(`${api}/subtopics/${sub}`)
      await admin.delete(`${api}/topics/${topic}`)
      await admin.delete(`${api}/chapters/${chapter}`)
      await admin.delete(`/api/admin/subjects/${subject}`)
      await admin.delete(`/api/admin/education-levels/${level}`)

      const expected: [string, string, string][] = [
        ['curriculum.level.created', 'education_level', level],
        ['curriculum.level.updated', 'education_level', level],
        ['curriculum.level.active_changed', 'education_level', level],
        ['curriculum.level.deleted', 'education_level', level],
        ['curriculum.subject.created', 'subject', subject],
        ['curriculum.subject.updated', 'subject', subject],
        ['curriculum.subject.active_changed', 'subject', subject],
        ['curriculum.subject.deleted', 'subject', subject],
        ['curriculum.chapter.created', 'chapter', chapter],
        ['curriculum.chapter.updated', 'chapter', chapter],
        ['curriculum.chapter.deleted', 'chapter', chapter],
        ['curriculum.topic.created', 'topic', topic],
        ['curriculum.topic.updated', 'topic', topic],
        ['curriculum.topic.deleted', 'topic', topic],
        ['curriculum.subtopic.created', 'subtopic', sub],
        ['curriculum.subtopic.updated', 'subtopic', sub],
        ['curriculum.subtopic.deleted', 'subtopic', sub],
      ]
      for (const [action, type, id] of expected) {
        const hits = (await rows(action)).filter((r) => r.target_id === id)
        expect(hits, action).toHaveLength(1)
        expect(hits[0]).toMatchObject({ actor_user_id: admin.userId, actor_role: 'admin', target_type: type })
        expect(hits[0]!.request_id, action).toBeTruthy()
        // No content: nothing of the request body (names, codes, descriptions) is kept.
        expect(hits[0]!.detail ?? {}, action).toEqual({})
      }
      const all = JSON.stringify(await t.db.query(`select * from audit_events where action like 'curriculum.%'`))
      expect(all).not.toContain('Tahap Audit')
      expect(all).not.toContain('Bab Audit')
    })

    it('a refused write (422, 404, 403) leaves no audit row', async () => {
      const before = await count(t.db, `select count(*) n from audit_events where action like 'curriculum.%'`)
      await admin.post(`${api}/topics`, { name: 'x' })
      await admin.put(`${api}/topics/99999999`, { name: 'x' })
      await admin.delete(`${api}/chapters/99999999`)
      const student = await loginAs(t, 'pelajar@demo.test')
      await student.post(`${api}/topics`, { chapterId, name: 'x' })
      expect(await count(t.db, `select count(*) n from audit_events where action like 'curriculum.%'`)).toBe(before)
    })

    it('the change and its audit row commit together: a failing audit write rolls the change back', async () => {
      vi.spyOn(t.app.get(AuditService), 'record').mockRejectedValueOnce(new Error('audit down'))
      const before = await count(t.db, 'select count(*) n from topics')
      const res = await admin.post(`${api}/topics`, { chapterId, name: 'Tidak Berjaya' })
      expect(res.status).toBe(500)
      expect(await count(t.db, 'select count(*) n from topics')).toBe(before)
    })
  })

  describe('check-then-write races (Prisma P2025 to 404, P2003 to 422)', () => {
    it('translateDbError maps the codes and rethrows everything else', () => {
      const e = (code: string) => Object.assign(new Error(code), { code })
      expect(() => translateDbError(e('P2025'), { notFound: () => Object.assign(new Error('nf'), { code: 'NF' }) })).toThrow('nf')
      expect(() => translateDbError(e('P2025'), {})).toThrow('P2025')
      expect(() => translateDbError(e('P2003'), { fkField: 'chapterId' })).toThrow(/Validation|invalid|VALIDATION/i)
      expect(() => translateDbError(e('P2002'), { uniqueField: 'code' })).toThrow()
      expect(() => translateDbError(new Error('boom'), { notFound: () => new Error('x') })).toThrow('boom')
    })

    const gone = async (table: string, id: string) => {
      await t.db.query(`delete from ${table} where id = $1`, [id])
    }
    const fresh = async (kind: 'chapter' | 'topic' | 'subtopic') => {
      const c = (await admin.post(`${api}/chapters`, { subjectId: bm, educationLevelId: d1, name: `Bab ${kind}`, chapterNumber: 80 })).body.data.id as string
      if (kind === 'chapter') return { c }
      const tp = (await admin.post(`${api}/topics`, { chapterId: c, name: `Topik ${kind}` })).body.data.id as string
      if (kind === 'topic') return { c, tp }
      const s = (await admin.post(`${api}/subtopics`, { topicId: tp, name: 'Sub' })).body.data.id as string
      return { c, tp, s }
    }

    it('a chapter deleted after the 404 check: PUT and DELETE answer "Bab tidak dijumpai."', async () => {
      const { c } = await fresh('chapter')
      const stale = (await repo.chapter(BigInt(c)))!
      await gone('chapters', c)
      vi.spyOn(repo, 'chapter').mockResolvedValue(stale)
      expectError(await admin.put(`${api}/chapters/${c}`, { subjectId: bm, educationLevelId: d1, name: 'x' }), 'NOT_FOUND', 'Bab tidak dijumpai.')
      expectError(await admin.delete(`${api}/chapters/${c}`), 'NOT_FOUND', 'Bab tidak dijumpai.')
    })

    it('a topic deleted after the check: PUT and DELETE answer "Topik tidak dijumpai."', async () => {
      const { tp } = await fresh('topic')
      const stale = (await repo.topic(BigInt(tp!)))!
      await gone('topics', tp!)
      vi.spyOn(repo, 'topic').mockResolvedValue(stale)
      expectError(await admin.put(`${api}/topics/${tp}`, { name: 'x' }), 'NOT_FOUND', 'Topik tidak dijumpai.')
      expectError(await admin.delete(`${api}/topics/${tp}`), 'NOT_FOUND', 'Topik tidak dijumpai.')
    })

    it('a subtopic deleted after the check: PUT and DELETE answer "Subtopik tidak dijumpai."', async () => {
      const { s } = await fresh('subtopic')
      const stale = (await repo.subtopic(BigInt(s!)))!
      await gone('subtopics', s!)
      vi.spyOn(repo, 'subtopic').mockResolvedValue(stale)
      expectError(await admin.put(`${api}/subtopics/${s}`, { name: 'x' }), 'NOT_FOUND', 'Subtopik tidak dijumpai.')
      expectError(await admin.delete(`${api}/subtopics/${s}`), 'NOT_FOUND', 'Subtopik tidak dijumpai.')
    })

    it('a level and a subject deleted after the check: PUT, PATCH and DELETE answer the 404 copy', async () => {
      const lv = (await admin.post('/api/admin/education-levels', { name: 'L', nameEn: 'L', code: 'race1', stage: 'primary', curriculum: 'KSSR' })).body.data.id as string
      const sj = (await admin.post('/api/admin/subjects', { name: 'S', nameEn: 'S', code: 'race2' })).body.data.id as string
      const staleLevel = (await repo.level(BigInt(lv)))!
      const staleSubject = (await repo.subject(BigInt(sj)))!
      await gone('education_levels', lv)
      await gone('subjects', sj)
      vi.spyOn(repo, 'level').mockResolvedValue(staleLevel)
      vi.spyOn(repo, 'subject').mockResolvedValue(staleSubject)
      const level = { name: 'L2', nameEn: 'L', code: 'race1', stage: 'primary', curriculum: 'KSSR' }
      expectError(await admin.put(`/api/admin/education-levels/${lv}`, level), 'NOT_FOUND', 'Tahap Pendidikan tidak dijumpai.')
      expectError(await admin.patch(`/api/admin/education-levels/${lv}/active`, { isActive: false }), 'NOT_FOUND', 'Tahap Pendidikan tidak dijumpai.')
      expectError(await admin.delete(`/api/admin/education-levels/${lv}`), 'NOT_FOUND', 'Tahap Pendidikan tidak dijumpai.')
      const subject = { name: 'S2', nameEn: 'S', code: 'race2' }
      expectError(await admin.put(`/api/admin/subjects/${sj}`, subject), 'NOT_FOUND', 'Subjek tidak dijumpai.')
      expectError(await admin.patch(`/api/admin/subjects/${sj}/active`, { isActive: false }), 'NOT_FOUND', 'Subjek tidak dijumpai.')
      expectError(await admin.delete(`/api/admin/subjects/${sj}`), 'NOT_FOUND', 'Subjek tidak dijumpai.')
    })

    it('the parent vanished after the exists check: topic and subtopic creates are a 422 on the reference', async () => {
      const { c, tp } = await fresh('topic')
      const chapter = (await repo.chapter(BigInt(c)))!
      const topic = (await repo.topic(BigInt(tp!)))!
      await gone('chapters', c)
      vi.spyOn(repo, 'chapter').mockResolvedValue(chapter)
      vi.spyOn(repo, 'topic').mockResolvedValue(topic)
      expect(expectError(await admin.post(`${api}/topics`, { chapterId: c, name: 'x' }), 'VALIDATION_ERROR').fields).toEqual({ chapterId: 'The selected chapter id is invalid.' })
      expect(expectError(await admin.post(`${api}/subtopics`, { topicId: tp, name: 'x' }), 'VALIDATION_ERROR').fields).toEqual({ topicId: 'The selected topic id is invalid.' })
    })

    it('the level or subject vanished before a chapter write: 422 on the right reference', async () => {
      const lv = (await admin.post('/api/admin/education-levels', { name: 'L', nameEn: 'L', code: 'race3', stage: 'primary', curriculum: 'KSSR' })).body.data.id as string
      const sj = (await admin.post('/api/admin/subjects', { name: 'S', nameEn: 'S', code: 'race4' })).body.data.id as string
      const staleLevel = (await repo.level(BigInt(lv)))!
      const staleSubject = (await repo.subject(BigInt(sj)))!
      await gone('education_levels', lv)
      vi.spyOn(repo, 'level').mockResolvedValue(staleLevel)
      expect(expectError(await admin.post(`${api}/chapters`, { subjectId: bm, educationLevelId: lv, name: 'x' }), 'VALIDATION_ERROR').fields).toEqual({
        educationLevelId: 'The selected education level id is invalid.',
      })
      await gone('subjects', sj)
      vi.spyOn(repo, 'subject').mockResolvedValue(staleSubject)
      vi.spyOn(repo, 'level').mockRestore()
      expect(expectError(await admin.post(`${api}/chapters`, { subjectId: sj, educationLevelId: d1, name: 'x' }), 'VALIDATION_ERROR').fields).toEqual({
        subjectId: 'The selected subject id is invalid.',
      })
    })

    it('a level linked to a subject vanished before the subject write: 422 on educationLevelIds', async () => {
      const lv = (await admin.post('/api/admin/education-levels', { name: 'L', nameEn: 'L', code: 'race5', stage: 'primary', curriculum: 'KSSR' })).body.data.id as string
      const stale = (await repo.level(BigInt(lv)))!
      await gone('education_levels', lv)
      vi.spyOn(repo, 'levels').mockResolvedValue([stale])
      const res = await admin.post('/api/admin/subjects', { name: 'S', nameEn: 'S', code: 'race6', educationLevelIds: [lv] })
      expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ educationLevelIds: 'The selected education level ids is invalid.' })
      expect(await count(t.db, `select count(*) n from subjects where code = 'RACE6'`)).toBe(0)
    })
  })

  describe('bounded inputs (BE-NFR-25)', () => {
    it('description, learningStandard and learningObjective: 2000 characters pass, 2001 is a 422', async () => {
      const ok = 'a'.repeat(2000)
      const bad = 'a'.repeat(2001)
      expect((await admin.post(`${api}/chapters`, { subjectId: bm, educationLevelId: d1, name: 'x', description: ok })).status).toBe(201)
      expect(expectError(await admin.post(`${api}/chapters`, { subjectId: bm, educationLevelId: d1, name: 'x', description: bad }), 'VALIDATION_ERROR').fields).toEqual({
        description: 'The description field must not be greater than 2000 characters.',
      })
      expect((await admin.post(`${api}/topics`, { chapterId, name: 'x', learningStandard: ok, description: ok })).status).toBe(201)
      expect(expectError(await admin.post(`${api}/topics`, { chapterId, name: 'x', learningStandard: bad, description: bad }), 'VALIDATION_ERROR').fields).toEqual({
        description: 'The description field must not be greater than 2000 characters.',
        learningStandard: 'The learning standard field must not be greater than 2000 characters.',
      })
      expect(expectError(await admin.put(`${api}/topics/${topicId}`, { name: 'x', learningStandard: bad }), 'VALIDATION_ERROR').fields).toHaveProperty('learningStandard')
      expect((await admin.post(`${api}/subtopics`, { topicId, name: 'x', learningObjective: ok })).status).toBe(201)
      expect(expectError(await admin.post(`${api}/subtopics`, { topicId, name: 'x', learningObjective: bad }), 'VALIDATION_ERROR').fields).toEqual({
        learningObjective: 'The learning objective field must not be greater than 2000 characters.',
      })
      expect(expectError(await admin.put(`${api}/subtopics/${subtopicId}`, { name: 'x', learningObjective: bad }), 'VALIDATION_ERROR').fields).toHaveProperty('learningObjective')
      expect(expectError(await admin.put(`${api}/chapters/${chapterId}`, { subjectId: bm, educationLevelId: d1, name: 'x', description: bad }), 'VALIDATION_ERROR').fields).toHaveProperty('description')
    })

    it('educationLevelIds: at most 50 items (a 422 before any lookup)', async () => {
      const ids = Array.from({ length: 51 }, (_, i) => String(i + 1))
      const res = await admin.post('/api/admin/subjects', { name: 'S', nameEn: 'S', code: 'many1', educationLevelIds: ids })
      expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ educationLevelIds: 'The education level ids field must not have more than 50 items.' })
      expect(expectError(await admin.put(`/api/admin/subjects/${bm}`, { name: 'S', nameEn: 'S', code: 'BM', educationLevelIds: ids }), 'VALIDATION_ERROR').fields).toHaveProperty('educationLevelIds')
    })

    it('order and chapterNumber stay inside a 32-bit integer (no 500 from the database)', async () => {
      const big = 2147483648
      expect(expectError(await admin.post('/api/admin/subjects', { name: 'S', nameEn: 'S', code: 'big1', order: big }), 'VALIDATION_ERROR').fields).toEqual({
        order: 'The order field must not be greater than 2147483647.',
      })
      expect(expectError(await admin.post('/api/admin/education-levels', { name: 'S', nameEn: 'S', code: 'big2', stage: 'primary', curriculum: 'K', order: big }), 'VALIDATION_ERROR').fields).toHaveProperty('order')
      expect(expectError(await admin.post(`${api}/chapters`, { subjectId: bm, educationLevelId: d1, name: 'x', chapterNumber: big }), 'VALIDATION_ERROR').fields).toEqual({
        chapterNumber: 'The chapter number field must not be greater than 2147483647.',
      })
      expect((await admin.post('/api/admin/subjects', { name: 'S', nameEn: 'S', code: 'big3', order: 2147483647 })).status).toBe(201)
    })

    it('query strings: 64 characters pass, 65 is a 422 on the learner and the tree routes', async () => {
      const s64 = 'a'.repeat(64)
      const s65 = 'a'.repeat(65)
      const learner = await loginAs(t, 'pelajar@demo.test')
      expect((await learner.get(`/api/topics?subject=${s64}`)).status).toBe(200)
      expect(expectError(await learner.get(`/api/topics?subject=${s65}`), 'VALIDATION_ERROR').fields).toEqual({ subject: 'The subject field must not be greater than 64 characters.' })
      expect(expectError(await learner.get(`/api/topics?gradeLevel=${s65}`), 'VALIDATION_ERROR').fields).toHaveProperty('gradeLevel')
      expect(expectError(await learner.get(`/api/learning-map?grade=${s65}`), 'VALIDATION_ERROR').fields).toHaveProperty('grade')
      expect(expectError(await learner.get(`/api/subjects?educationLevelId=${s65}`), 'VALIDATION_ERROR').fields).toHaveProperty('educationLevelId')
      expect(expectError(await learner.get(`/api/topics?subject=ok&subject=${s65}`), 'VALIDATION_ERROR').fields).toHaveProperty('subject')
      expect(expectError(await admin.get(`${api}?subjectId=${s65}&educationLevelId=${d1}`), 'VALIDATION_ERROR').fields).toHaveProperty('subjectId')
      expect(CurriculumTopicsQuerySchema).toBeDefined()
      expect(() => new BoundedQueryPipe().transform({ a: 'b' })).not.toThrow()
    })
  })

  describe('repository `{ active }` filter on chapters', () => {
    it('chapters(), chapter(), chaptersByIds() and tree() can be limited to active chapters', async () => {
      const id = BigInt(await chapterIdOf(t.db, 'BM', 'D1', 90))
      await admin.put(`${api}/chapters/${id}`, { subjectId: bm, educationLevelId: d1, name: 'Bab Kukuh', chapterNumber: 90, isActive: false })
      const [subject, level] = [BigInt(bm), BigInt(d1)]
      expect((await repo.chapters(subject, level)).map((c) => c.id)).toContain(id)
      expect((await repo.chapters(subject, level, { active: true })).map((c) => c.id)).not.toContain(id)
      expect((await repo.chapters(subject, level, { active: false })).map((c) => c.id)).toContain(id)
      expect(await repo.chapter(id)).not.toBeNull()
      expect(await repo.chapter(id, { active: true })).toBeNull()
      expect((await repo.chaptersByIds([id])).map((c) => c.id)).toEqual([id])
      expect(await repo.chaptersByIds([id], { active: true })).toEqual([])
      expect((await repo.tree(subject, level, { active: true })).map((c) => c.id)).not.toContain(id)
      expect((await repo.tree(subject, level)).map((c) => c.id)).toContain(id)
      await admin.put(`${api}/chapters/${id}`, { subjectId: bm, educationLevelId: d1, name: 'Bab Kukuh', chapterNumber: 90, isActive: true })
      expect((await repo.chapters(subject, level, { active: true })).map((c) => c.id)).toContain(id)
    })
  })

  describe('provider ports', () => {
    it('start with the "nothing yet" defaults and accept one implementation each', async () => {
      const ports = new CurriculumPorts()
      expect((await ports.questionCounts.activeByLevel()).size).toBe(0)
      expect((await ports.topicProgress.topicProgress('1')).size).toBe(0)
      const counts = { activeByLevel: async () => new Map([['1', 3]]), activeBySubject: async () => new Map() }
      ports.provideQuestionCounts(counts)
      expect(ports.questionCounts).toBe(counts)
      expect(() => ports.provideQuestionCounts(counts)).toThrow(/already set/)
      const progress = { topicProgress: async () => new Map() }
      ports.provideTopicProgress(progress)
      expect(ports.topicProgress).toBe(progress)
      expect(() => ports.provideTopicProgress(progress)).toThrow(/already set/)
    })

    it('a later module plugs in from its own onModuleInit without touching CurriculumModule', async () => {
      const stub = { activeByLevel: async () => new Map([[d1, 9]]), activeBySubject: async () => new Map() }
      const other = await bootCurriculumApp({ db: t.db, questionCounts: stub })
      try {
        expect(other.app.get(CurriculumPorts).questionCounts).toBe(stub)
        const c = await loginAs(other, 'admin@demo.test')
        const levels = (await c.get('/api/admin/education-levels')).body.data as { id: string; questionCount: number }[]
        expect(levels.find((l) => l.id === d1)!.questionCount).toBe(9)
      } finally {
        await other.app.close()
      }
    })
  })
})
