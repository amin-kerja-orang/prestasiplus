import { setTimeout as sleep } from 'node:timers/promises'

import { CURRICULUM_CONFLICT_MESSAGES as CF } from '@pp/contract'
import pg from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { CurriculumRepository } from '../../src/modules/curriculum/curriculum.repository'
import { bootCurriculumApp, count, expectError, idOf, loginAs, type Client, type CurriculumTestApp } from './helpers'

/**
 * BE-08 follow-up (LEAD 2026-10-20): a delete answers 409 and deletes nothing while the entity still
 * has children; the check runs under a row lock in the delete transaction, so a concurrent child
 * insert cannot slip through. FKs stay `ON DELETE CASCADE` (migration 0008), so every case is also
 * checked against the database, not only the response.
 */
describe('curriculum delete with children: 409', () => {
  let t: CurriculumTestApp
  let admin: Client
  let bm: string
  const api = '/api/admin/curriculum'
  let n = 0

  beforeAll(async () => {
    t = await bootCurriculumApp()
    admin = await loginAs(t, 'admin@demo.test')
    bm = await idOf(t.db, 'subjects', 'BM')
  })
  afterAll(async () => {
    await t.close()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const newLevel = async (): Promise<string> =>
    (await admin.post('/api/admin/education-levels', { name: 'Tahap C', nameEn: 'Level C', code: `c${++n}`, stage: 'primary', curriculum: 'KSSR' })).body.data.id
  const newSubject = async (): Promise<string> =>
    (await admin.post('/api/admin/subjects', { name: 'Subjek C', nameEn: 'Subject C', code: `s${++n}` })).body.data.id
  const newChapter = async (subjectId: string, educationLevelId: string): Promise<string> =>
    (await admin.post(`${api}/chapters`, { subjectId, educationLevelId, name: 'Bab C', chapterNumber: ++n })).body.data.id
  const newTopic = async (chapterId: string): Promise<string> => (await admin.post(`${api}/topics`, { chapterId, name: 'Topik C' })).body.data.id
  const newSubtopic = async (topicId: string): Promise<string> => (await admin.post(`${api}/subtopics`, { topicId, name: 'Subtopik C' })).body.data.id

  const deletes = () => count(t.db, "select count(*) n from audit_events where action like 'curriculum.%.deleted'")
  const exists = async (table: string, id: string) => (await count(t.db, `select count(*) n from ${table} where id = $1`, [id])) === 1

  describe('education level', () => {
    it('subject link only: 409, level and link kept; deleted once the link is gone', async () => {
      const level = await newLevel()
      const subject = await newSubject()
      await t.db.query('insert into subject_levels (subject_id, education_level_id) values ($1, $2)', [subject, level])
      const audit = await deletes()
      expectError(await admin.delete(`/api/admin/education-levels/${level}`), 'CONFLICT', CF.level)
      expect(await exists('education_levels', level)).toBe(true)
      expect(await count(t.db, 'select count(*) n from subject_levels where education_level_id = $1', [level])).toBe(1)
      expect(await deletes()).toBe(audit)
      await t.db.query('delete from subject_levels where education_level_id = $1', [level])
      expect((await admin.delete(`/api/admin/education-levels/${level}`)).status).toBe(200)
      expect(await exists('education_levels', level)).toBe(false)
    })

    it('chapter only, including a chapter outside the tree: 409 and everything kept', async () => {
      const level = await newLevel()
      const chapter = await newChapter(bm, level)
      const topic = await newTopic(chapter)
      expectError(await admin.delete(`/api/admin/education-levels/${level}`), 'CONFLICT', CF.level)
      expect(await exists('chapters', chapter)).toBe(true)
      expect(await exists('topics', topic)).toBe(true)
      await t.db.query('update chapters set in_tree = false where id = $1', [chapter])
      expectError(await admin.delete(`/api/admin/education-levels/${level}`), 'CONFLICT', CF.level)
      expect(await exists('chapters', chapter)).toBe(true)
    })

    it('DSKP node only: 409 and the node is kept', async () => {
      const level = await newLevel()
      await t.db.query(
        `insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, edition) values ($1, $2, 'unit', '1', 'Unit', 'test')`,
        [bm, level],
      )
      expectError(await admin.delete(`/api/admin/education-levels/${level}`), 'CONFLICT', CF.level)
      expect(await count(t.db, 'select count(*) n from curriculum_nodes where education_level_id = $1', [level])).toBe(1)
    })
  })

  describe('subject', () => {
    it('level link only: 409 and the link is kept; deleted once the link is gone', async () => {
      const level = await newLevel()
      const subject = (await admin.post('/api/admin/subjects', { name: 'S', nameEn: 'S', code: `s${++n}`, educationLevelIds: [level] })).body.data.id as string
      expectError(await admin.delete(`/api/admin/subjects/${subject}`), 'CONFLICT', CF.subject)
      expect(await count(t.db, 'select count(*) n from subject_levels where subject_id = $1', [subject])).toBe(1)
      await admin.put(`/api/admin/subjects/${subject}`, { name: 'S', nameEn: 'S', code: `s${++n}`, educationLevelIds: [] })
      expect((await admin.delete(`/api/admin/subjects/${subject}`)).status).toBe(200)
      expect(await exists('subjects', subject)).toBe(false)
    })

    it('chapter only (no level link): 409 and the chapter with its topic and subtopic are kept', async () => {
      const level = await newLevel()
      const subject = await newSubject()
      const chapter = await newChapter(subject, level)
      const topic = await newTopic(chapter)
      const sub = await newSubtopic(topic)
      expectError(await admin.delete(`/api/admin/subjects/${subject}`), 'CONFLICT', CF.subject)
      for (const [table, id] of [['subjects', subject], ['chapters', chapter], ['topics', topic], ['subtopics', sub]] as const) {
        expect(await exists(table, id), table).toBe(true)
      }
    })

    it('TP descriptor only: 409 and the descriptor is kept (DSKP reference data)', async () => {
      const subject = await newSubject()
      await t.db.query(`insert into curriculum_tp_descriptors (subject_id, tp, descriptor) values ($1, 1, 'Deskriptor')`, [subject])
      expectError(await admin.delete(`/api/admin/subjects/${subject}`), 'CONFLICT', CF.subject)
      expect(await count(t.db, 'select count(*) n from curriculum_tp_descriptors where subject_id = $1', [subject])).toBe(1)
    })

    it('the DSKP-only subject (LNR, no links, no chapters) still has nodes: 409', async () => {
      const lnr = await idOf(t.db, 'subjects', 'LNR')
      const nodes = await count(t.db, 'select count(*) n from curriculum_nodes where subject_id = $1', [lnr])
      expect(nodes).toBeGreaterThan(0)
      expectError(await admin.delete(`/api/admin/subjects/${lnr}`), 'CONFLICT', CF.subject)
      expect(await count(t.db, 'select count(*) n from curriculum_nodes where subject_id = $1', [lnr])).toBe(nodes)
    })
  })

  describe('chapter and topic', () => {
    it('a chapter with topics is 409; a topic with subtopics is 409; the chain is deleted child first', async () => {
      const level = await newLevel()
      const chapter = await newChapter(bm, level)
      const topic = await newTopic(chapter)
      const sub = await newSubtopic(topic)
      const audit = await deletes()
      expectError(await admin.delete(`${api}/chapters/${chapter}`), 'CONFLICT', CF.chapter)
      expectError(await admin.delete(`${api}/topics/${topic}`), 'CONFLICT', CF.topic)
      expect(await deletes()).toBe(audit)
      expect((await admin.delete(`${api}/subtopics/${sub}`)).status).toBe(200)
      expect((await admin.delete(`${api}/topics/${topic}`)).body).toEqual({ data: { deleted: { topics: 1, subtopics: 0 } }, status: 'Topik berjaya dipadam.' })
      expect((await admin.delete(`${api}/chapters/${chapter}`)).body).toEqual({
        data: { deleted: { chapters: 1, topics: 0, subtopics: 0 } },
        status: 'Bab berjaya dipadam.',
      })
      expect(await deletes()).toBe(audit + 3)
    })

    it('a chapter without topics, a topic without subtopics and a subtopic delete as before', async () => {
      const level = await newLevel()
      const chapter = await newChapter(bm, level)
      expect((await admin.delete(`${api}/chapters/${chapter}`)).status).toBe(200)
      const c2 = await newChapter(bm, level)
      const topic = await newTopic(c2)
      expect((await admin.delete(`${api}/topics/${topic}`)).status).toBe(200)
      expect(await exists('chapters', c2)).toBe(true)
    })

    it('404 still comes before the child check, and an unknown parent is never 409', async () => {
      expectError(await admin.delete(`${api}/chapters/99999999`), 'NOT_FOUND', 'Bab tidak dijumpai.')
      expectError(await admin.delete(`${api}/topics/99999999`), 'NOT_FOUND', 'Topik tidak dijumpai.')
      expectError(await admin.delete('/api/admin/subjects/99999999'), 'NOT_FOUND', 'Subjek tidak dijumpai.')
      expectError(await admin.delete('/api/admin/education-levels/99999999'), 'NOT_FOUND', 'Tahap Pendidikan tidak dijumpai.')
    })
  })

  describe('races: a child insert against the delete', () => {
    const connect = async () => {
      const c = new pg.Client({ connectionString: t.db.url })
      await c.connect()
      return c
    }

    it('child insert in flight (uncommitted) first: the delete waits for it, then sees the child and answers 409', async () => {
      const level = await newLevel()
      const subject = await newSubject()
      const c = await connect()
      try {
        await c.query('begin')
        await c.query('insert into subject_levels (subject_id, education_level_id) values ($1, $2)', [subject, level])
        let settled = false
        const del = Promise.resolve(admin.delete(`/api/admin/education-levels/${level}`)).finally(() => {
          settled = true
        })
        await sleep(400)
        expect(settled, 'the delete must wait on the key-share lock of the insert').toBe(false)
        await c.query('commit')
        expectError(await del, 'CONFLICT', CF.level)
      } finally {
        await c.end()
      }
      expect(await exists('education_levels', level)).toBe(true)
      expect(await count(t.db, 'select count(*) n from subject_levels where education_level_id = $1', [level])).toBe(1)
    })

    it('delete holds the lock after its child check: the concurrent insert waits, then fails; no orphan is left', async () => {
      const level = await newLevel()
      const subject = await newSubject()
      const repo = t.app.get(CurriculumRepository)
      const original = repo.levelHasChildren.bind(repo)
      let reached!: () => void
      const reachedP = new Promise<void>((r) => (reached = r))
      let release!: () => void
      const gate = new Promise<void>((r) => (release = r))
      vi.spyOn(repo, 'levelHasChildren').mockImplementation(async (id) => {
        const has = await original(id)
        reached()
        await gate
        return has
      })
      const c = await connect()
      try {
        const del = Promise.resolve(admin.delete(`/api/admin/education-levels/${level}`))
        await reachedP // the check found no children; the row lock is still held
        let insertDone = false
        const insert = c
          .query('insert into subject_levels (subject_id, education_level_id) values ($1, $2)', [subject, level])
          .then(() => 'inserted', (e: { code?: string }) => e.code)
          .finally(() => {
            insertDone = true
          })
        await sleep(400)
        expect(insertDone, 'the insert must wait for the delete').toBe(false)
        release()
        expect((await del).status).toBe(200)
        expect(await insert).toBe('23503') // foreign_key_violation: the level is gone
      } finally {
        release()
        await c.end()
      }
      expect(await exists('education_levels', level)).toBe(false)
      expect(await count(t.db, 'select count(*) n from subject_levels where education_level_id = $1', [level])).toBe(0)
    })

    it('chapter: a topic inserted while the delete holds the lock cannot be orphaned', async () => {
      const level = await newLevel()
      const chapter = await newChapter(bm, level)
      const repo = t.app.get(CurriculumRepository)
      const original = repo.chapterHasTopics.bind(repo)
      let reached!: () => void
      const reachedP = new Promise<void>((r) => (reached = r))
      let release!: () => void
      const gate = new Promise<void>((r) => (release = r))
      vi.spyOn(repo, 'chapterHasTopics').mockImplementation(async (id) => {
        const has = await original(id)
        reached()
        await gate
        return has
      })
      const c = await connect()
      try {
        const del = Promise.resolve(admin.delete(`${api}/chapters/${chapter}`))
        await reachedP
        const insert = c.query(`insert into topics (chapter_id, name) values ($1, 'Topik')`, [chapter]).then(() => 'inserted', (e: { code?: string }) => e.code)
        await sleep(300)
        release()
        expect((await del).status).toBe(200)
        expect(await insert).toBe('23503')
      } finally {
        release()
        await c.end()
      }
      expect(await exists('chapters', chapter)).toBe(false)
      expect(await count(t.db, 'select count(*) n from topics where chapter_id = $1', [chapter])).toBe(0)
    })

    it('API-level: a topic created while its chapter is being deleted ends as 422 or 404, never a server error, and no orphan', async () => {
      const level = await newLevel()
      const chapter = await newChapter(bm, level)
      const results = await Promise.all([
        admin.delete(`${api}/chapters/${chapter}`),
        ...Array.from({ length: 4 }, () => admin.post(`${api}/topics`, { chapterId: chapter, name: 'Topik Serentak' })),
      ])
      for (const r of results) expect(r.status, JSON.stringify(r.body)).toBeLessThan(500)
      expect(await count(t.db, 'select count(*) n from topics t where not exists (select 1 from chapters c where c.id = t.chapter_id)')).toBe(0)
      const chapterGone = !(await exists('chapters', chapter))
      const topics = await count(t.db, 'select count(*) n from topics where chapter_id = $1', [chapter])
      expect(chapterGone ? topics === 0 : topics > 0).toBe(true)
    })
  })
})
