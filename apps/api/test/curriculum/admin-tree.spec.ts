import {
  CURRICULUM_FLASH_MESSAGES as FLASH,
  CurriculumChapterDeletedSchema,
  CurriculumChapterDetailSchema,
  CurriculumChapterSchema,
  CurriculumSubtopicSchema,
  CurriculumTopicDeletedSchema,
  CurriculumTopicDetailSchema,
  CurriculumTopicSchema,
  CurriculumTreeSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootCurriculumApp, count, expectError, idOf, loginAs, parseData, parseStatus, type Client, type CurriculumTestApp } from './helpers'

/** Port of mock `admin-handlers.test.ts` #13 to #24: tree, chapters, topics, subtopics (AC1, AC3, AC4). */
describe('admin curriculum tree', () => {
  let t: CurriculumTestApp
  let admin: Client
  let bm: string
  let d1: string
  let d2: string
  let sains: string
  beforeAll(async () => {
    t = await bootCurriculumApp()
    admin = await loginAs(t, 'admin@demo.test')
    bm = await idOf(t.db, 'subjects', 'BM')
    d1 = await idOf(t.db, 'education_levels', 'D1')
    d2 = await idOf(t.db, 'education_levels', 'D2')
    sains = await idOf(t.db, 'subjects', 'SCI')
  })
  afterAll(async () => {
    await t.close()
  })

  const tree = (subjectId: string, levelId: string) => admin.get(`/api/admin/curriculum?subjectId=${subjectId}&educationLevelId=${levelId}`)
  const chapterBody = (over: Record<string, unknown> = {}) => ({ subjectId: bm, educationLevelId: d1, name: 'Bab Ujian', nameEn: 'Test Chapter', chapterNumber: 99, description: 'Penerangan', ...over })

  describe('#13 tree', () => {
    it('returns subject, level, stats (inactive included) and in-tree chapters in order with topics and subtopics', async () => {
      const data = parseData(await tree(bm, d1), CurriculumTreeSchema)
      expect(data.subject).toEqual({ id: bm, name: expect.any(String) })
      expect(data.level.id).toBe(d1)
      expect(data.chapters.length).toBeGreaterThan(0)
      expect(data.chapters.every((c) => c.inTree && c.subjectId === bm && c.educationLevelId === d1)).toBe(true)
      const numbers = data.chapters.map((c) => c.chapterNumber ?? Number.MAX_SAFE_INTEGER)
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
      expect(data.stats).toEqual({
        chapters: data.chapters.length,
        topics: data.chapters.reduce((n, c) => n + c.topics.length, 0),
        subtopics: data.chapters.reduce((n, c) => n + c.topics.reduce((m, x) => m + x.subtopics.length, 0), 0),
      })
      expect(data.stats.chapters).toBe(await count(t.db, 'select count(*) n from chapters where subject_id = $1 and education_level_id = $2 and in_tree', [bm, d1]))
    })

    it('counts inactive records in the stats and keeps them in the lists (BR-06)', async () => {
      const before = parseData(await tree(bm, d1), CurriculumTreeSchema)
      const chapter = before.chapters.find((c) => c.topics.length > 0)!
      await admin.put(`/api/admin/curriculum/chapters/${chapter.id}`, chapterBody({ name: chapter.name, chapterNumber: chapter.chapterNumber, isActive: false }))
      await admin.put(`/api/admin/curriculum/topics/${chapter.topics[0]!.id}`, { name: chapter.topics[0]!.name, isActive: false })
      const after = parseData(await tree(bm, d1), CurriculumTreeSchema)
      expect(after.stats).toEqual(before.stats)
      const same = after.chapters.find((c) => c.id === chapter.id)!
      expect(same.isActive).toBe(false)
      expect(same.topics[0]!.isActive).toBe(false)
      // Restore.
      await admin.put(`/api/admin/curriculum/chapters/${chapter.id}`, chapterBody({ name: chapter.name, chapterNumber: chapter.chapterNumber, isActive: true }))
      await admin.put(`/api/admin/curriculum/topics/${chapter.topics[0]!.id}`, { name: chapter.topics[0]!.name, isActive: true })
    })

    it('an empty combination returns zero stats and no chapters', async () => {
      const id = await idOf(t.db, 'subjects', 'SS')
      const data = parseData(await tree(id, d1), CurriculumTreeSchema)
      expect(data.stats).toEqual({ chapters: 0, topics: 0, subtopics: 0 })
      expect(data.chapters).toEqual([])
    })

    it('never returns out-of-tree chapters', async () => {
      const ids = (await t.db.query<{ id: string }>('select id::text from chapters where not in_tree')).map((r) => r.id)
      expect(ids.length).toBe(60)
      const all = parseData(await tree(bm, d1), CurriculumTreeSchema).chapters.map((c) => c.id)
      expect(all.some((id) => ids.includes(id))).toBe(false)
    })

    it('422 when the query is missing or not an integer, 404 for an unknown subject or level (422 first)', async () => {
      expect(expectError(await admin.get('/api/admin/curriculum'), 'VALIDATION_ERROR').fields).toEqual({
        subjectId: 'The subject id field is required.',
        educationLevelId: 'The education level id field is required.',
      })
      expect(expectError(await admin.get(`/api/admin/curriculum?subjectId=abc&educationLevelId=${d1}`), 'VALIDATION_ERROR').fields).toEqual({
        subjectId: 'The subject id field must be an integer.',
      })
      expect(expectError(await admin.get(`/api/admin/curriculum?subjectId=${bm}&educationLevelId=1.5`), 'VALIDATION_ERROR').fields).toEqual({
        educationLevelId: 'The education level id field must be an integer.',
      })
      expectError(await admin.get(`/api/admin/curriculum?subjectId=99999999&educationLevelId=${d1}`), 'NOT_FOUND', 'Subjek tidak dijumpai.')
      expectError(await admin.get(`/api/admin/curriculum?subjectId=${bm}&educationLevelId=99999999`), 'NOT_FOUND', 'Tahap Pendidikan tidak dijumpai.')
    })
  })

  describe('chapters #14 to #17', () => {
    let chapterId: string

    it('#15 creates a chapter (active, in tree, strand and dskpCode null) and it shows in the tree', async () => {
      const res = await admin.post('/api/admin/curriculum/chapters', chapterBody())
      const { data, status } = parseStatus(res, CurriculumChapterSchema, 201)
      expect(status).toBe('Bab berjaya ditambah.')
      expect(data).toMatchObject({ subjectId: bm, educationLevelId: d1, name: 'Bab Ujian', chapterNumber: 99, isActive: true, inTree: true, strand: null, dskpCode: null })
      chapterId = data.id
      const inTree = parseData(await tree(bm, d1), CurriculumTreeSchema).chapters.map((c) => c.id)
      expect(inTree).toContain(chapterId)
      expect(parseData(await tree(bm, d1), CurriculumTreeSchema).chapters.at(-1)!.id).toBe(chapterId)
    })

    it('#15 ignores mass assignment of isActive, inTree, strand and dskpCode on create', async () => {
      const res = await admin.post('/api/admin/curriculum/chapters', chapterBody({ name: 'Bab Jisim', chapterNumber: 98, isActive: false, inTree: false, strand: 'X', dskpCode: '1.1.1' }))
      const { data } = parseStatus(res, CurriculumChapterSchema, 201)
      expect(data).toMatchObject({ isActive: true, inTree: true, strand: null, dskpCode: null })
    })

    it('#14 returns the chapter with its subject and level', async () => {
      const data = parseData(await admin.get(`/api/admin/curriculum/chapters/${chapterId}`), CurriculumChapterDetailSchema)
      expect(data.id).toBe(chapterId)
      expect(data.subject.id).toBe(bm)
      expect(data.level).toEqual({ id: d1, name: expect.any(String) })
    })

    it('#14/#16/#17 an unknown, malformed or out-of-tree chapter id is 404 "Bab tidak dijumpai."', async () => {
      const outOfTree = (await t.db.query<{ id: string }>('select id::text from chapters where not in_tree limit 1'))[0]!.id
      for (const id of ['99999999', 'abc', outOfTree]) {
        expectError(await admin.get(`/api/admin/curriculum/chapters/${id}`), 'NOT_FOUND', 'Bab tidak dijumpai.')
        expectError(await admin.put(`/api/admin/curriculum/chapters/${id}`, chapterBody()), 'NOT_FOUND', 'Bab tidak dijumpai.')
        expectError(await admin.delete(`/api/admin/curriculum/chapters/${id}`), 'NOT_FOUND', 'Bab tidak dijumpai.')
      }
      expect(await count(t.db, 'select count(*) n from chapters where id = $1', [outOfTree])).toBe(1)
    })

    it('#15/#16 validate: required, types, lengths, unknown references', async () => {
      const empty = expectError(await admin.post('/api/admin/curriculum/chapters', {}), 'VALIDATION_ERROR')
      expect(empty.fields).toEqual({
        subjectId: 'The subject id field is required.',
        educationLevelId: 'The education level id field is required.',
        name: 'The name field is required.',
      })
      const bad = expectError(
        await admin.post('/api/admin/curriculum/chapters', chapterBody({ subjectId: '99999999', educationLevelId: '99999999', name: 'x'.repeat(256), chapterNumber: 0 })),
        'VALIDATION_ERROR',
      )
      expect(bad.fields).toEqual({
        subjectId: 'The selected subject id is invalid.',
        educationLevelId: 'The selected education level id is invalid.',
        name: 'The name field must not be greater than 255 characters.',
        chapterNumber: 'The chapter number field must be at least 1.',
      })
      expect(expectError(await admin.post('/api/admin/curriculum/chapters', chapterBody({ chapterNumber: 'abc' })), 'VALIDATION_ERROR').fields).toEqual({
        chapterNumber: 'The chapter number field must be an integer.',
      })
    })

    it('#16 updates and moves the chapter to another pair keeping its topics; an absent isActive keeps the stored value', async () => {
      const topic = parseStatus(await admin.post('/api/admin/curriculum/topics', { chapterId, name: 'Topik Bab Ujian', topicNumber: 1 }), CurriculumTopicSchema, 201).data
      await admin.put(`/api/admin/curriculum/chapters/${chapterId}`, chapterBody({ isActive: false }))
      const res = await admin.put(`/api/admin/curriculum/chapters/${chapterId}`, chapterBody({ educationLevelId: d2, subjectId: sains, name: 'Bab Ujian 2', nameEn: '', description: null }))
      const { data, status } = parseStatus(res, CurriculumChapterSchema, 200)
      expect(status).toBe('Bab berjaya dikemaskini.')
      expect(data).toMatchObject({ subjectId: sains, educationLevelId: d2, name: 'Bab Ujian 2', nameEn: null, description: null, isActive: false })
      expect(await count(t.db, 'select count(*) n from topics where chapter_id = $1 and id = $2', [chapterId, topic.id])).toBe(1)
      const moved = parseData(await tree(sains, d2), CurriculumTreeSchema).chapters.find((c) => c.id === chapterId)!
      expect(moved.topics.map((x) => x.id)).toEqual([topic.id])
      expect(parseData(await tree(bm, d1), CurriculumTreeSchema).chapters.map((c) => c.id)).not.toContain(chapterId)
      // isActive true sets it again.
      expect(parseStatus(await admin.put(`/api/admin/curriculum/chapters/${chapterId}`, chapterBody({ subjectId: sains, educationLevelId: d2, isActive: '1' })), CurriculumChapterSchema, 200).data.isActive).toBe(true)
    })

    it('#16 strand and dskpCode are read-only: an update never changes them', async () => {
      await t.db.query(`update chapters set strand = 'Strand A', dskp_code = '1.1.1' where id = $1`, [chapterId])
      const { data } = parseStatus(
        await admin.put(`/api/admin/curriculum/chapters/${chapterId}`, chapterBody({ subjectId: sains, educationLevelId: d2, strand: 'Lain', dskpCode: '9.9.9' })),
        CurriculumChapterSchema,
        200,
      )
      expect(data).toMatchObject({ strand: 'Strand A', dskpCode: '1.1.1' })
    })

    it('#16 422 comes after the 404 check and an invalid update leaves the row untouched', async () => {
      expectError(await admin.put('/api/admin/curriculum/chapters/99999999', {}), 'NOT_FOUND', 'Bab tidak dijumpai.')
      expectError(await admin.put(`/api/admin/curriculum/chapters/${chapterId}`, {}), 'VALIDATION_ERROR')
      const row = parseData(await admin.get(`/api/admin/curriculum/chapters/${chapterId}`), CurriculumChapterDetailSchema)
      expect(row.name).toBe('Bab Ujian')
    })

    it('#17 deletes the chapter with the topic and subtopic cascade, counted before and after', async () => {
      const topicId = (await t.db.query<{ id: string }>('select id::text from topics where chapter_id = $1', [chapterId]))[0]!.id
      await admin.post('/api/admin/curriculum/subtopics', { topicId, name: 'S1' })
      await admin.post('/api/admin/curriculum/subtopics', { topicId, name: 'S2' })
      const topicsBefore = await count(t.db, 'select count(*) n from topics')
      const subsBefore = await count(t.db, 'select count(*) n from subtopics')
      const res = await admin.delete(`/api/admin/curriculum/chapters/${chapterId}`)
      const { data, status } = parseStatus(res, CurriculumChapterDeletedSchema, 200)
      expect(status).toBe('Bab berjaya dipadam.')
      expect(data).toEqual({ deleted: { chapters: 1, topics: 1, subtopics: 2 } })
      expect(await count(t.db, 'select count(*) n from topics')).toBe(topicsBefore - 1)
      expect(await count(t.db, 'select count(*) n from subtopics')).toBe(subsBefore - 2)
      expect(await count(t.db, 'select count(*) n from chapters where id = $1', [chapterId])).toBe(0)
      expectError(await admin.delete(`/api/admin/curriculum/chapters/${chapterId}`), 'NOT_FOUND', 'Bab tidak dijumpai.')
    })
  })

  describe('topics #18 to #21', () => {
    let chapterId: string
    let topicId: string
    beforeAll(async () => {
      chapterId = parseStatus(await admin.post('/api/admin/curriculum/chapters', chapterBody({ name: 'Bab Topik', chapterNumber: 97 })), CurriculumChapterSchema, 201).data.id
    })

    it('#19 creates a topic: number read as text, active, in the tree; fields trimmed, empty to null', async () => {
      const res = await admin.post('/api/admin/curriculum/topics', { chapterId, name: ' Topik A ', nameEn: '  ', topicNumber: 12, description: 'd', learningStandard: 'ls' })
      const { data, status } = parseStatus(res, CurriculumTopicSchema, 201)
      expect(status).toBe('Topik berjaya ditambah.')
      expect(data).toMatchObject({ chapterId, name: 'Topik A', nameEn: null, topicNumber: '12', description: 'd', learningStandard: 'ls', isActive: true })
      topicId = data.id
      const node = parseData(await tree(bm, d1), CurriculumTreeSchema).chapters.find((c) => c.id === chapterId)!
      expect(node.topics.map((x) => x.id)).toContain(topicId)
    })

    it('#19 ignores isActive on create and a text topicNumber is kept as is', async () => {
      const { data } = parseStatus(await admin.post('/api/admin/curriculum/topics', { chapterId, name: 'B', topicNumber: '1.2a', isActive: false }), CurriculumTopicSchema, 201)
      expect(data).toMatchObject({ topicNumber: '1.2a', isActive: true })
    })

    it('#18 returns the topic with its chapter, subject and level', async () => {
      const data = parseData(await admin.get(`/api/admin/curriculum/topics/${topicId}`), CurriculumTopicDetailSchema)
      expect(data.id).toBe(topicId)
      expect(data.chapter).toMatchObject({ id: chapterId, subject: { id: bm }, level: { id: d1 } })
    })

    it('#18/#20/#21 an unknown or malformed topic id is 404 "Topik tidak dijumpai."', async () => {
      for (const id of ['99999999', 'x1']) {
        expectError(await admin.get(`/api/admin/curriculum/topics/${id}`), 'NOT_FOUND', 'Topik tidak dijumpai.')
        expectError(await admin.put(`/api/admin/curriculum/topics/${id}`, { name: 'a' }), 'NOT_FOUND', 'Topik tidak dijumpai.')
        expectError(await admin.delete(`/api/admin/curriculum/topics/${id}`), 'NOT_FOUND', 'Topik tidak dijumpai.')
      }
    })

    it('#19 validates: required, unknown chapter, lengths', async () => {
      expect(expectError(await admin.post('/api/admin/curriculum/topics', {}), 'VALIDATION_ERROR').fields).toEqual({
        chapterId: 'The chapter id field is required.',
        name: 'The name field is required.',
      })
      expect(
        expectError(await admin.post('/api/admin/curriculum/topics', { chapterId: '99999999', name: 'a'.repeat(256), topicNumber: 'n'.repeat(21) }), 'VALIDATION_ERROR').fields,
      ).toEqual({
        chapterId: 'The selected chapter id is invalid.',
        name: 'The name field must not be greater than 255 characters.',
        topicNumber: 'The topic number field must not be greater than 20 characters.',
      })
      const outOfTree = (await t.db.query<{ id: string }>('select id::text from chapters where not in_tree limit 1'))[0]!.id
      expect(expectError(await admin.post('/api/admin/curriculum/topics', { chapterId: outOfTree, name: 'a' }), 'VALIDATION_ERROR').fields).toEqual({
        chapterId: 'The selected chapter id is invalid.',
      })
    })

    it('#20 updates; chapterId in the body is ignored; absent isActive keeps the stored value', async () => {
      await admin.put(`/api/admin/curriculum/topics/${topicId}`, { name: 'Topik A', isActive: false })
      const other = parseStatus(await admin.post('/api/admin/curriculum/chapters', chapterBody({ name: 'Bab Lain', chapterNumber: 96 })), CurriculumChapterSchema, 201).data.id
      const res = await admin.put(`/api/admin/curriculum/topics/${topicId}`, { chapterId: other, name: 'Topik A2', topicNumber: 3.5, learningStandard: null })
      const { data, status } = parseStatus(res, CurriculumTopicSchema, 200)
      expect(status).toBe('Topik berjaya dikemaskini.')
      expect(data).toMatchObject({ chapterId, name: 'Topik A2', topicNumber: '3.5', learningStandard: null, isActive: false })
      expect(expectError(await admin.put(`/api/admin/curriculum/topics/${topicId}`, {}), 'VALIDATION_ERROR').fields).toEqual({ name: 'The name field is required.' })
    })

    it('#18 orders topics naturally by topic number (1 < 1.1 < 2 < 10) inside the tree', async () => {
      const c = parseStatus(await admin.post('/api/admin/curriculum/chapters', chapterBody({ name: 'Bab Urutan', chapterNumber: 95 })), CurriculumChapterSchema, 201).data.id
      for (const n of ['10', '2', '1.1', '1']) await admin.post('/api/admin/curriculum/topics', { chapterId: c, name: `T${n}`, topicNumber: n })
      const node = parseData(await tree(bm, d1), CurriculumTreeSchema).chapters.find((x) => x.id === c)!
      expect(node.topics.map((x) => x.topicNumber)).toEqual(['1', '1.1', '2', '10'])
    })

    it('#21 deletes with the subtopic cascade counted; subtopics are gone', async () => {
      await admin.post('/api/admin/curriculum/subtopics', { topicId, name: 'S1' })
      await admin.post('/api/admin/curriculum/subtopics', { topicId, name: 'S2' })
      await admin.post('/api/admin/curriculum/subtopics', { topicId, name: 'S3' })
      const subsBefore = await count(t.db, 'select count(*) n from subtopics')
      const { data, status } = parseStatus(await admin.delete(`/api/admin/curriculum/topics/${topicId}`), CurriculumTopicDeletedSchema, 200)
      expect(status).toBe('Topik berjaya dipadam.')
      expect(data).toEqual({ deleted: { topics: 1, subtopics: 3 } })
      expect(await count(t.db, 'select count(*) n from subtopics')).toBe(subsBefore - 3)
      expect(await count(t.db, 'select count(*) n from subtopics where topic_id = $1', [topicId])).toBe(0)
      expectError(await admin.get(`/api/admin/curriculum/topics/${topicId}`), 'NOT_FOUND', 'Topik tidak dijumpai.')
    })
  })

  describe('subtopics #22 to #24', () => {
    let topicId: string
    let subtopicId: string
    beforeAll(async () => {
      const chapterId = parseStatus(await admin.post('/api/admin/curriculum/chapters', chapterBody({ name: 'Bab Subtopik', chapterNumber: 94 })), CurriculumChapterSchema, 201).data.id
      topicId = parseStatus(await admin.post('/api/admin/curriculum/topics', { chapterId, name: 'Topik S' }), CurriculumTopicSchema, 201).data.id
    })

    it('#22 creates a subtopic that appears under its topic in the tree', async () => {
      const { data, status } = parseStatus(
        await admin.post('/api/admin/curriculum/subtopics', { topicId, name: ' Sub A ', nameEn: 'Sub A en', learningObjective: 'Objektif' }),
        CurriculumSubtopicSchema,
        201,
      )
      expect(status).toBe(FLASH.subtopic.created)
      expect(data).toMatchObject({ topicId, name: 'Sub A', nameEn: 'Sub A en', learningObjective: 'Objektif' })
      subtopicId = data.id
      const nodes = parseData(await tree(bm, d1), CurriculumTreeSchema).chapters.flatMap((c) => c.topics)
      expect(nodes.find((x) => x.id === topicId)!.subtopics.map((s) => s.id)).toEqual([subtopicId])
    })

    it('#22 validates: required and unknown topic', async () => {
      expect(expectError(await admin.post('/api/admin/curriculum/subtopics', {}), 'VALIDATION_ERROR').fields).toEqual({
        topicId: 'The topic id field is required.',
        name: 'The name field is required.',
      })
      expect(expectError(await admin.post('/api/admin/curriculum/subtopics', { topicId: '99999999', name: 'x' }), 'VALIDATION_ERROR').fields).toEqual({
        topicId: 'The selected topic id is invalid.',
      })
    })

    it('#23 updates (topic fixed, topicId ignored); 404 "Subtopik tidak dijumpai." for an unknown id', async () => {
      const { data, status } = parseStatus(await admin.put(`/api/admin/curriculum/subtopics/${subtopicId}`, { topicId: '1', name: 'Sub B', nameEn: null, learningObjective: '' }), CurriculumSubtopicSchema, 200)
      expect(status).toBe(FLASH.subtopic.updated)
      expect(data).toMatchObject({ topicId, name: 'Sub B', nameEn: null, learningObjective: null })
      expect(expectError(await admin.put(`/api/admin/curriculum/subtopics/${subtopicId}`, {}), 'VALIDATION_ERROR').fields).toEqual({ name: 'The name field is required.' })
      for (const id of ['99999999', 'zz']) {
        expectError(await admin.put(`/api/admin/curriculum/subtopics/${id}`, { name: 'a' }), 'NOT_FOUND', 'Subtopik tidak dijumpai.')
        expectError(await admin.delete(`/api/admin/curriculum/subtopics/${id}`), 'NOT_FOUND', 'Subtopik tidak dijumpai.')
      }
    })

    it('#24 deletes the subtopic only', async () => {
      const topicsBefore = await count(t.db, 'select count(*) n from topics')
      const res = await admin.delete(`/api/admin/curriculum/subtopics/${subtopicId}`)
      expect(res.body).toEqual({ data: { deleted: 1 }, status: FLASH.subtopic.deleted })
      expect(await count(t.db, 'select count(*) n from topics')).toBe(topicsBefore)
      expect(await count(t.db, 'select count(*) n from subtopics where id = $1', [subtopicId])).toBe(0)
    })
  })
})
