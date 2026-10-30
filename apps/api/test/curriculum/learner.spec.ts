import {
  CurriculumEducationLevelLookupSchema,
  CurriculumLearningMapSchema,
  CurriculumSubjectLookupSchema,
  CurriculumTopicCardSchema,
  CurriculumTopicDetailLearnerSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { TopicProgress } from '../../src/modules/curriculum/rules'
import { bootCurriculumApp, expectError, loginAs, parseData, parseList, type Client, type CurriculumTestApp } from './helpers'

type Card = ReturnType<typeof CurriculumTopicCardSchema.parse>

describe('learner reads (AC1, AC7, AC8, AC9)', () => {
  let t: CurriculumTestApp
  let student: Client
  let teacher: Client
  let admin: Client
  let schoolAdmin: Client
  beforeAll(async () => {
    t = await bootCurriculumApp()
    ;[student, teacher, admin, schoolAdmin] = await Promise.all([
      loginAs(t, 'pelajar@demo.test'),
      loginAs(t, 'guru@demo.test'),
      loginAs(t, 'admin@demo.test'),
      loginAs(t, 'adminsekolah@demo.test'),
    ])
  })
  afterAll(async () => {
    await t.close()
  })

  const topics = async (query = '') => parseList(await student.get(`/api/topics${query}`), CurriculumTopicCardSchema)

  describe('AC9: a session is required, any role may read', () => {
    for (const url of ['/api/education-levels', '/api/subjects', '/api/topics', '/api/topics/1', '/api/learning-map']) {
      it(`GET ${url} without a session is 401`, async () => {
        expectError(await t.http().get(url), 'UNAUTHORIZED')
      })
    }
    it('every role gets 200', async () => {
      for (const c of [student, teacher, admin, schoolAdmin]) {
        for (const url of ['/api/education-levels', '/api/subjects', '/api/topics', '/api/learning-map']) {
          expect((await c.get(url)).status, url).toBe(200)
        }
      }
    })
  })

  describe('GET /education-levels and /subjects', () => {
    it('lists the 5 active levels (Tingkatan 1 to 5; Darjah is hidden) in order with the lookup shape', async () => {
      const res = await student.get('/api/education-levels')
      const items = parseList(res, CurriculumEducationLevelLookupSchema)
      expect(items).toHaveLength(5)
      expect(res.body.meta).toMatchObject({ page: 1, pageSize: 5, totalItems: 5, totalPages: 1, from: 1, to: 5 })
      expect(items.map((l) => l.code)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5'])
      expect(items.map((l) => l.grade)).toEqual([7, 8, 9, 10, 11])
      expect(items[0]).toMatchObject({ name: 'Tingkatan 1', nameEn: 'Form 1', stage: 'lower_secondary' })
      expect(items[4]).toMatchObject({ code: 'T5', stage: 'upper_secondary' })
      expect(typeof items[0]!.id).toBe('string')
    })

    it('lists the 31 active subjects (the inactive DSKP-only ones are hidden) in BR-08 order', async () => {
      const items = parseList(await student.get('/api/subjects'), CurriculumSubjectLookupSchema)
      expect(items).toHaveLength(31)
      expect(items.slice(0, 3).map((s) => s.code)).toEqual(['BM', 'BI', 'MATH'])
      expect(items.some((s) => s.code === 'LNR' || s.code === 'KNP')).toBe(false)
      const math = items.find((s) => s.code === 'MATH')!
      expect(math).toMatchObject({ name: 'Matematik', nameEn: 'Mathematics', icon: 'calculator', isCore: true })
      expect(math.educationLevelIds).toHaveLength(5)
      expect(items.find((s) => s.code === 'SS')!.educationLevelIds).toEqual([])
    })

    it('filters by educationLevelId; an unknown or non-numeric id is ignored (no filter)', async () => {
      const levels = parseList(await student.get('/api/education-levels'), CurriculumEducationLevelLookupSchema)
      const t4 = levels.find((l) => l.code === 'T4')!
      const filtered = parseList(await student.get(`/api/subjects?educationLevelId=${t4.id}`), CurriculumSubjectLookupSchema)
      expect(filtered).toHaveLength(25)
      expect(filtered.every((s) => s.educationLevelIds.includes(t4.id))).toBe(true)
      for (const bad of ['999999', 'abc', '']) {
        expect(parseList(await student.get(`/api/subjects?educationLevelId=${bad}`), CurriculumSubjectLookupSchema), bad).toHaveLength(31)
      }
    })

    it('a deactivated subject and level leave the lookups', async () => {
      await t.db.query(`update subjects set is_active = false where code = 'PN'`)
      await t.db.query(`update education_levels set is_active = false where code = 'T5'`)
      try {
        expect(parseList(await student.get('/api/subjects'), CurriculumSubjectLookupSchema).some((s) => s.code === 'PN')).toBe(false)
        expect(parseList(await student.get('/api/education-levels'), CurriculumEducationLevelLookupSchema)).toHaveLength(4)
      } finally {
        await t.db.query(`update subjects set is_active = true where code = 'PN'`)
        await t.db.query(`update education_levels set is_active = true where code = 'T5'`)
      }
    })
  })

  describe('GET /topics (AC7, BR-13)', () => {
    it('lists all 125 topics unpaged in sequence order with the card shape', async () => {
      const res = await student.get('/api/topics')
      const items = parseList(res, CurriculumTopicCardSchema)
      expect(items).toHaveLength(125)
      expect(res.body.meta).toMatchObject({ totalItems: 125, page: 1, pageSize: 125, totalPages: 1 })
      expect(items[0]).toEqual({
        id: items[0]!.id,
        gradeLevel: 'DARJAH_1',
        subject: 'MATEMATIK',
        subjectLabel: 'MATEMATIK',
        name: 'Nombor',
        description: 'Belajar nombor 1 hingga 100',
        subtopicCount: 3,
        subtopicsPreview: ['Tambah 1-10', 'Tolak 1-10', 'Kiraan 1-100'],
      })
      // Ordered by sequence, then id (ids are decimal strings; compare as bigint).
      const rows = await t.db.query<{ id: string }>('select id::text from legacy_topics order by sequence, id')
      expect(items.map((c) => c.id)).toEqual(rows.map((r) => r.id))
    })

    it('filters by gradeLevel and subject, AND, case-insensitive', async () => {
      expect(await topics('?gradeLevel=DARJAH_1')).toHaveLength(17)
      expect(await topics('?gradeLevel=darjah_1')).toHaveLength(17)
      expect(await topics('?gradeLevel=DARJAH_1&subject=SAINS')).toHaveLength(4)
      expect(await topics('?gradeLevel=darjah_1&subject=sains')).toHaveLength(4)
      const counts: [string, number][] = [
        ['MATEMATIK', 34], ['SAINS', 35], ['BAHASA_MELAYU', 15], ['PENDIDIKAN_MORAL', 12],
        ['SEJARAH', 11], ['PENDIDIKAN_ISLAM', 7], ['BAHASA_INGGERIS', 6], ['GEOGRAFI', 5],
      ]
      for (const [subject, n] of counts) expect(await topics(`?subject=${subject}`), subject).toHaveLength(n)
      expect(await topics('?subject=geografi')).toHaveLength(5)
    })

    it('Tingkatan filters, empty grades and unknown codes return an empty list, not an error', async () => {
      for (const [gradeLevel, n] of [['TINGKATAN_1', 34], ['TINGKATAN_2', 0], ['TINGKATAN_3', 0], ['TINGKATAN_4', 19], ['TINGKATAN_5', 10], ['DARJAH_2', 11], ['DARJAH_6', 8]] as const) {
        expect(await topics(`?gradeLevel=${gradeLevel}`), gradeLevel).toHaveLength(n)
      }
      const res = await student.get('/api/topics?subject=ZZZ')
      expect(parseList(res, CurriculumTopicCardSchema)).toEqual([])
      expect(res.body.meta.totalItems).toBe(0)
      expect(await topics('?gradeLevel=NOPE&subject=SAINS')).toEqual([])
    })

    it('a card label has "_" as a space and the preview holds at most 3 of the subtopics', async () => {
      const bm = await topics('?subject=BAHASA_MELAYU')
      expect(bm.every((c) => c.subjectLabel === 'BAHASA MELAYU')).toBe(true)
      const all = await topics()
      expect(all.every((c) => c.subtopicCount >= 1 && c.subtopicCount <= 6 && c.subtopicsPreview.length <= 3)).toBe(true)
      expect(all.reduce((n, c) => n + c.subtopicCount, 0)).toBe(335)
      expect(all.some((c) => c.subtopicCount === 6 && c.subtopicsPreview.length === 3)).toBe(true)
    })

    it('rejects a repeated query key with the validation error', async () => {
      expectError(await student.get('/api/topics?subject=SAINS&subject=SEJARAH'), 'VALIDATION_ERROR')
    })
  })

  describe('GET /topics/:id (AC7)', () => {
    const find = async (gradeLevel: string, subject: string, name: string): Promise<Card> => {
      const hit = (await topics(`?gradeLevel=${gradeLevel}&subject=${subject}`)).find((c) => c.name === name)
      if (!hit) throw new Error(`topic ${name} not found`)
      return hit
    }

    it('returns the topic with subtopics, the practice code and zero progress without history', async () => {
      const card = await find('DARJAH_1', 'SAINS', 'Haiwan')
      const detail = parseData(await student.get(`/api/topics/${card.id}`), CurriculumTopicDetailLearnerSchema)
      expect(detail).toMatchObject({
        id: card.id,
        gradeLevel: 'DARJAH_1',
        subject: 'SAINS',
        subjectLabel: 'SAINS',
        practiceCode: 'SCI',
        name: 'Haiwan',
        description: 'Mengenal jenis-jenis haiwan',
        icon: '🐾',
        sequence: 3,
        progress: { questionsAnswered: 0, progress: 0 },
      })
      expect(detail.subtopics.map((s) => [s.name, s.description, s.progress])).toEqual([
        ['Haiwan Peliharaan', 'Mengenal haiwan peliharaan seperti kucing, anjing', 0],
        ['Haiwan Liar', 'Mengenal haiwan liar seperti harimau, gajah', 0],
      ])
    })

    it('the practice code map covers all 8 subjects (BR-16)', async () => {
      const map: Record<string, string> = {
        MATEMATIK: 'MATH', BAHASA_MELAYU: 'BM', BAHASA_INGGERIS: 'BI', SAINS: 'SCI',
        PENDIDIKAN_ISLAM: 'PI', PENDIDIKAN_MORAL: 'PM', SEJARAH: 'SEJ', GEOGRAFI: 'GEO',
      }
      for (const [subject, code] of Object.entries(map)) {
        const first = (await topics(`?subject=${subject}`))[0]!
        const detail = parseData(await student.get(`/api/topics/${first.id}`), CurriculumTopicDetailLearnerSchema)
        expect(detail.practiceCode, subject).toBe(code)
      }
    })

    it('keeps a null description and a Tingkatan topic with 6 subtopics', async () => {
      const six = (await topics()).find((c) => c.subtopicCount === 6)!
      const detail = parseData(await student.get(`/api/topics/${six.id}`), CurriculumTopicDetailLearnerSchema)
      expect(detail.subtopics).toHaveLength(6)
      expect(detail.subtopics.some((s) => s.description === null)).toBe(true)
    })

    it('an unknown, zero, oversized or non-numeric id is 404 "Topik tidak dijumpai."', async () => {
      for (const id of ['99999999', '0', 'abc', '9223372036854775808', '-1', '1.5']) {
        expectError(await student.get(`/api/topics/${id}`), 'NOT_FOUND', 'Topik tidak dijumpai.')
      }
    })
  })

  describe('GET /learning-map (AC8, BR-14, BR-15)', () => {
    const map = async (query = '') => parseData(await student.get(`/api/learning-map${query}`), CurriculumLearningMapSchema)

    it('defaults to MATEMATIK and DARJAH_4; with the default provider the first two topics are open and the rest locked', async () => {
      const d = await map()
      expect(d.subject).toBe('MATEMATIK')
      expect(d.subjectLabel).toBe('Matematik')
      expect(d.grade).toBe('DARJAH_4')
      expect(d.gradeOptions).toEqual(['DARJAH_1', 'DARJAH_2', 'DARJAH_3', 'DARJAH_4'])
      expect(d.topics.map((x) => x.name)).toEqual(['Nombor Hingga 100 000', 'Perpuluhan', 'Geometri'])
      expect(d.topics.map((x) => x.icon)).toEqual(['🔢', '🔣', null])
      expect(d.topics.map((x) => x.state)).toEqual(['unlocked', 'unlocked', 'locked'])
      expect(d.topics.map((x) => x.practiceUrl)).toEqual([`/practice?topic_id=${d.topics[0]!.id}`, `/practice?topic_id=${d.topics[1]!.id}`, null])
      expect(d.stats).toEqual({ done: 0, total: 3, progress: 0 })
      expect(d.topics[0]).toMatchObject({ progress: 0, sessions: 0, questionsAnswered: 0 })
    })

    it('lists the 7 subject pills with the observed colours; Geografi is not a pill', async () => {
      const d = await map()
      expect(d.subjects.map((s) => [s.code, s.label, s.emoji, s.color])).toEqual([
        ['MATEMATIK', 'Matematik', '🔢', '#3B82F6'],
        ['BAHASA_MELAYU', 'Bahasa Melayu', '📝', '#10B981'],
        ['BAHASA_INGGERIS', 'Bahasa Inggeris', '🇬🇧', '#8B5CF6'],
        ['SAINS', 'Sains', '🔬', '#F59E0B'],
        ['PENDIDIKAN_ISLAM', 'Pend. Islam', '☪️', '#14B8A6'],
        ['PENDIDIKAN_MORAL', 'Pend. Moral', '🤝', '#F97316'],
        ['SEJARAH', 'Sejarah', '🏛️', '#EF4444'],
      ])
    })

    it('accepts only DARJAH_1 to DARJAH_4; anything else is served as DARJAH_4 (BR-15)', async () => {
      for (const grade of ['DARJAH_5', 'DARJAH_6', 'TINGKATAN_1', 'darjah_2', 'xyz', '']) {
        expect((await map(`?grade=${grade}`)).grade, grade).toBe('DARJAH_4')
      }
      for (const grade of ['DARJAH_1', 'DARJAH_2', 'DARJAH_3', 'DARJAH_4']) expect((await map(`?grade=${grade}`)).grade).toBe(grade)
    })

    it('subject labels: pills, GEOGRAFI, an unknown code title-cased and kept as typed', async () => {
      expect((await map('?subject=PENDIDIKAN_ISLAM')).subjectLabel).toBe('Pend. Islam')
      const geo = await map('?subject=GEOGRAFI')
      expect([geo.subjectLabel, geo.subject, geo.topics]).toEqual(['Geografi', 'GEOGRAFI', []])
      const zzz = await map('?subject=ZZZ')
      expect([zzz.subjectLabel, zzz.subject, zzz.topics]).toEqual(['Zzz', 'ZZZ', []])
      expect(zzz.stats).toEqual({ done: 0, total: 0, progress: 0 })
      // The S14 filter is exact: a lower-case code is unknown. An empty subject is the default.
      expect((await map('?subject=matematik')).topics).toEqual([])
      expect((await map('?subject=')).subject).toBe('MATEMATIK')
    })

    it('serves other combinations (Darjah 1 Sains has 4 topics, the first named Haiwan is the third)', async () => {
      const d = await map('?subject=SAINS&grade=DARJAH_1')
      expect(d.stats.total).toBe(4)
      expect(d.topics.map((x) => x.state)).toEqual(['unlocked', 'unlocked', 'locked', 'locked'])
      expect(d.topics.map((x) => x.name)).toContain('Haiwan')
    })
  })

  describe('AC8: progress comes through the provider interface', () => {
    let stubbed: CurriculumTestApp
    let client: Client
    const asked: string[] = []
    const progress = new Map<string, TopicProgress>()
    beforeAll(async () => {
      stubbed = await bootCurriculumApp({
        db: t.db,
        progress: {
          async topicProgress(userId: string) {
            asked.push(userId)
            return progress
          },
        },
      })
      client = await loginAs(stubbed, 'pelajarmaju@demo.test')
      const d1 = (await topics('?gradeLevel=DARJAH_1&subject=MATEMATIK')).map((c) => c.id)
      progress.set(d1[0]!, { progress: 95, sessions: 3, questionsAnswered: 23 })
      progress.set(d1[1]!, { progress: 15, sessions: 2, questionsAnswered: 7 })
      progress.set(d1[2]!, { progress: 20, sessions: 2, questionsAnswered: 7 })
    })
    afterAll(async () => {
      await stubbed.app.close()
    })

    it('derives the island states and stats from the provider (mastered, started, unlocked, locked)', async () => {
      const res = await client.get('/api/learning-map?subject=MATEMATIK&grade=DARJAH_1')
      const d = parseData(res, CurriculumLearningMapSchema)
      expect(d.topics.map((x) => x.name)).toEqual(['Nombor', 'Nombor Bulat Hingga 100', 'Bentuk', 'Operasi Tambah dan Tolak', 'Bentuk dan Ruang'])
      expect(d.topics.map((x) => x.state)).toEqual(['mastered', 'started', 'started', 'unlocked', 'locked'])
      expect(d.topics.map((x) => x.progress)).toEqual([95, 15, 20, 0, 0])
      expect(d.topics[0]).toMatchObject({ sessions: 3, questionsAnswered: 23 })
      expect(d.topics[4]!.practiceUrl).toBeNull()
      expect(d.topics[3]!.practiceUrl).toBe(`/practice?topic_id=${d.topics[3]!.id}`)
      // done = mastered; progress = round(avg(95, 15, 20, 0, 0)) = 26.
      expect(d.stats).toEqual({ done: 1, total: 5, progress: 26 })
    })

    it('the topic detail shows the progress on every subtopic bar, and the provider is asked for the current user', async () => {
      const first = (await topics('?gradeLevel=DARJAH_1&subject=MATEMATIK'))[0]!
      asked.length = 0
      const d = parseData(await client.get(`/api/topics/${first.id}`), CurriculumTopicDetailLearnerSchema)
      expect(d.progress).toEqual({ questionsAnswered: 23, progress: 95 })
      expect(d.subtopics.map((s) => s.progress)).toEqual([95, 95, 95])
      expect(asked).toEqual([client.userId])
    })
  })
})
