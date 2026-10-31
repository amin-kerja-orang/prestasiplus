import { QUESTION_MESSAGES, QuestionDetailSchema, QuestionSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, expectError, loginAs, parseData, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'
import { chapterIdOf } from '../curriculum/helpers'

/** R1 "Bab field" (D89): the admin picks the Bab of a question; it is stored in `question_versions.chapter_id`. */
describe('admin question Bab (curriculumChapterId)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let c1: string
  let c2: string
  let otherLevelChapter: string
  let otherSubjectChapter: string

  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    c1 = await chapterIdOf(t.db, 'MATH', 'T4', 1)
    c2 = await chapterIdOf(t.db, 'MATH', 'T4', 2)
    otherLevelChapter = (await t.db.query<{ id: string }>(`select id::text id from chapters where subject_id = $1 and education_level_id <> $2 and in_tree order by id limit 1`, [refs.mathId, refs.t4Id]))[0]?.id as string
    otherSubjectChapter = (await t.db.query<{ id: string }>(`select id::text id from chapters where subject_id <> $1 and education_level_id = $2 and in_tree order by id limit 1`, [refs.mathId, refs.t4Id]))[0]?.id as string
    expect(otherLevelChapter && otherSubjectChapter).toBeTruthy()
  })
  afterAll(async () => {
    await t.close()
  })

  const create = async (over: Record<string, unknown> = {}) => {
    const res = await admin.post('/api/questions', mcqBody(refs, over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(QuestionSchema).parse(res.body).data
  }
  const put = (id: string, over: Record<string, unknown>) => admin.put(`/api/questions/${id}`, mcqBody(refs, over))
  const storedChapter = async (id: string, versionNo = 1): Promise<string | null> =>
    (await t.db.query<{ c: string | null }>(`select chapter_id::text c from question_versions where question_id = $1 and version_no = $2`, [id, versionNo]))[0]?.c ?? null

  it('create with a chapter stores chapter_id and returns the id and the chapter label', async () => {
    const q = await create({ curriculumChapterId: c1 })
    expect(q.curriculumChapterId).toBe(c1)
    expect(q.chapterLabel).toEqual(expect.any(String))
    expect(await storedChapter(q.id)).toBe(c1)
    const detail = parseData(await admin.get(`/api/questions/${q.id}`), QuestionDetailSchema)
    expect(detail.curriculumChapterId).toBe(c1)
    expect(detail.chapterLabel).toBe(q.chapterLabel)
  })

  it('create without a chapter leaves it null (label null)', async () => {
    const q = await create()
    expect(q.curriculumChapterId).toBeNull()
    expect(q.chapterLabel).toBeNull()
  })

  it('update changes the chapter, an omitted key keeps it, null and "" clear it', async () => {
    const q = await create({ curriculumChapterId: c1 })
    expect((await put(q.id, { curriculumChapterId: c2 })).status).toBe(200)
    expect(await storedChapter(q.id)).toBe(c2)
    expect((await put(q.id, { questionText: 'Berapakah hasil tambah 4 dan 5?' })).status).toBe(200)
    expect(await storedChapter(q.id)).toBe(c2)
    expect((await put(q.id, { curriculumChapterId: null })).status).toBe(200)
    expect(await storedChapter(q.id)).toBeNull()
    await put(q.id, { curriculumChapterId: c1 })
    expect((await put(q.id, { curriculumChapterId: '' })).status).toBe(200)
    expect(await storedChapter(q.id)).toBeNull()
  })

  it('a chapter of another subject or another level is 422 on curriculumChapterId; nothing is stored', async () => {
    for (const bad of [otherSubjectChapter, otherLevelChapter]) {
      const error = expectError(await admin.post('/api/questions', mcqBody(refs, { curriculumChapterId: bad })), 'VALIDATION_ERROR')
      expect(error.fields?.curriculumChapterId).toBe(QUESTION_MESSAGES.chapterMismatch)
    }
    const q = await create({ curriculumChapterId: c1 })
    const error = expectError(await put(q.id, { curriculumChapterId: otherLevelChapter }), 'VALIDATION_ERROR')
    expect(error.fields?.curriculumChapterId).toBe('Bab tidak sepadan dengan subjek dan tahap.')
    expect(await storedChapter(q.id)).toBe(c1)
  })

  it('an unknown chapter id is 422 "Bab tidak sah."', async () => {
    const error = expectError(await admin.post('/api/questions', mcqBody(refs, { curriculumChapterId: '99999999' })), 'VALIDATION_ERROR')
    expect(error.fields?.curriculumChapterId).toBe(QUESTION_MESSAGES.guruChapter)
  })

  it('changing the subject drops a kept chapter that no longer belongs; a sent chapter is validated against the new pair', async () => {
    const q = await create({ curriculumChapterId: c1 })
    expect((await put(q.id, { subjectId: refs.sciId })).status).toBe(200)
    expect(await storedChapter(q.id)).toBeNull()
  })

  it('editing a published question keeps the live version (with its chapter) and writes the new chapter on the draft version 2', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const q = await create({ status: 'published', tag, curriculumChapterId: c1 })
    expect(q.status).toBe('published')
    expect((await put(q.id, { tag, curriculumChapterId: c2 })).status).toBe(200)
    expect(await storedChapter(q.id, 1)).toBe(c1)
    expect(await storedChapter(q.id, 2)).toBe(c2)
    const admin2 = parseData(await admin.get(`/api/questions/${q.id}`), QuestionDetailSchema)
    expect(admin2.status).toBe('draft')
    expect(admin2.curriculumChapterId).toBe(c2)
  })

  it('editing an approved question drops it to draft and writes the chapter in place', async () => {
    const q = await create({ status: 'approved', curriculumChapterId: c1 })
    expect((await put(q.id, { curriculumChapterId: c2 })).status).toBe(200)
    expect(await storedChapter(q.id, 1)).toBe(c2)
    expect(parseData(await admin.get(`/api/questions/${q.id}`), QuestionDetailSchema).status).toBe('draft')
  })
})
