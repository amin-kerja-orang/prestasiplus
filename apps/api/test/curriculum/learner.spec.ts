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
    // Secondary-only (D72): the learner catalogue holds only the 29 Tingkatan 4 and 5 topics of the seed (19 + 10); the 96 Darjah and
    // Tingkatan 1 topics stay in the table but are never served.
    it('lists the 29 Tingkatan 4 and 5 topics unpaged in sequence order with the card shape, and no Darjah topic', async () => {
      const res = await student.get('/api/topics')
      const items = parseList(res, CurriculumTopicCardSchema)
      expect(items).toHaveLength(29)
      expect(res.body.meta).toMatchObject({ totalItems: 29, page: 1, pageSize: 29, totalPages: 1 })
      expect(items.every((c) => c.gradeLevel === 'TINGKATAN_4' || c.gradeLevel === 'TINGKATAN_5')).toBe(true)
      expect(items[0]).toEqual({
        id: items[0]!.id,
        gradeLevel: 'TINGKATAN_4',
        subject: 'BAHASA_MELAYU',
        subjectLabel: 'BAHASA MELAYU',
        name: 'Kemahiran Bahasa Tingkatan 4',
        description: null,
        subtopicCount: 2,
        subtopicsPreview: ['Penulisan karangan lanjutan', 'Tatabahasa lanjutan'],
      })
      // Ordered by sequence, then id (ids are decimal strings; compare as bigint).
      const rows = await t.db.query<{ id: string }>(`select id::text from legacy_topics where grade_level in ('TINGKATAN_4', 'TINGKATAN_5') order by sequence, id`)
      expect(items.map((c) => c.id)).toEqual(rows.map((r) => r.id))
    })

    it('filters by gradeLevel and subject, AND, case-insensitive', async () => {
      expect(await topics('?gradeLevel=TINGKATAN_4')).toHaveLength(19)
      expect(await topics('?gradeLevel=tingkatan_4')).toHaveLength(19)
      expect(await topics('?gradeLevel=TINGKATAN_4&subject=SAINS')).toHaveLength(12)
      expect(await topics('?gradeLevel=tingkatan_4&subject=sains')).toHaveLength(12)
      const counts: [string, number][] = [
        ['MATEMATIK', 3], ['SAINS', 21], ['BAHASA_MELAYU', 2], ['PENDIDIKAN_MORAL', 1],
        ['SEJARAH', 1], ['PENDIDIKAN_ISLAM', 0], ['BAHASA_INGGERIS', 0], ['GEOGRAFI', 1],
      ]
      for (const [subject, n] of counts) expect(await topics(`?subject=${subject}`), subject).toHaveLength(n)
      expect(await topics('?subject=geografi')).toHaveLength(1)
    })

    it('Darjah, Tingkatan 1 to 3, empty grades and unknown codes return an empty list, not an error', async () => {
      for (const [gradeLevel, n] of [['TINGKATAN_1', 0], ['TINGKATAN_2', 0], ['TINGKATAN_3', 0], ['TINGKATAN_4', 19], ['TINGKATAN_5', 10], ['DARJAH_1', 0], ['DARJAH_2', 0], ['DARJAH_6', 0]] as const) {
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
      expect(all.reduce((n, c) => n + c.subtopicCount, 0)).toBe(84)
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
      const card = await find('TINGKATAN_4', 'SAINS', 'Alat pemadam api')
      const detail = parseData(await student.get(`/api/topics/${card.id}`), CurriculumTopicDetailLearnerSchema)
      expect(detail).toMatchObject({
        id: card.id,
        gradeLevel: 'TINGKATAN_4',
        subject: 'SAINS',
        subjectLabel: 'SAINS',
        practiceCode: 'SCI',
        name: 'Alat pemadam api',
        description: null,
        icon: null,
        sequence: 56,
        progress: { questionsAnswered: 0, progress: 0 },
      })
      expect(detail.subtopics.map((s) => [s.name, s.description, s.progress])).toEqual([
        ['Peralatan perlindungan diri', null, 0],
        ['Pelupusan bahan buangan', null, 0],
        ['Alat pemadam api', null, 0],
      ])
    })

    it('a topic that is not Tingkatan 4 or 5 (a Darjah or Tingkatan 1 row in the table) is 404 "Topik tidak dijumpai."', async () => {
      const rows = await t.db.query<{ id: string }>(`select id::text from legacy_topics where grade_level not in ('TINGKATAN_4', 'TINGKATAN_5') order by id limit 3`)
      expect(rows.length).toBeGreaterThan(0)
      for (const r of rows) expectError(await student.get(`/api/topics/${r.id}`), 'NOT_FOUND', 'Topik tidak dijumpai.')
    })

    it('the practice code map covers all 8 subjects (BR-16); a subject with no Tingkatan 4 or 5 topic lists empty', async () => {
      const map: Record<string, string> = {
        MATEMATIK: 'MATH', BAHASA_MELAYU: 'BM', BAHASA_INGGERIS: 'BI', SAINS: 'SCI',
        PENDIDIKAN_ISLAM: 'PI', PENDIDIKAN_MORAL: 'PM', SEJARAH: 'SEJ', GEOGRAFI: 'GEO',
      }
      // Secondary-only seed: Islam and Inggeris have no T4/T5 topic (0 each), so there is no detail page to read their code from.
      const noTopics = new Set(['PENDIDIKAN_ISLAM', 'BAHASA_INGGERIS'])
      for (const [subject, code] of Object.entries(map)) {
        const list = await topics(`?subject=${subject}`)
        if (noTopics.has(subject)) {
          expect(list, subject).toEqual([])
          continue
        }
        const detail = parseData(await student.get(`/api/topics/${list[0]!.id}`), CurriculumTopicDetailLearnerSchema)
        expect(detail.practiceCode, subject).toBe(code)
      }
    })

    it('keeps a null description and a topic with 6 subtopics', async () => {
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

    it('defaults to MATEMATIK and TINGKATAN_4; with the default provider the first two topics are open and the rest locked', async () => {
      const d = await map()
      expect(d.subject).toBe('MATEMATIK')
      expect(d.subjectLabel).toBe('Matematik')
      expect(d.grade).toBe('TINGKATAN_4')
      expect(d.gradeOptions).toEqual(['TINGKATAN_4', 'TINGKATAN_5'])
      expect(d.topics.map((x) => x.name)).toEqual(['Fungsi dan Persamaan Kuadratik', 'Sistem Persamaan', 'Indeks, Surd dan Logaritma'])
      expect(d.topics.map((x) => x.icon)).toEqual([null, null, null])
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

    it('accepts only TINGKATAN_4 and TINGKATAN_5; anything else (a Darjah included) is served as TINGKATAN_4 (BR-15, D72)', async () => {
      for (const grade of ['DARJAH_1', 'DARJAH_4', 'DARJAH_6', 'TINGKATAN_1', 'tingkatan_5', 'xyz', '']) {
        expect((await map(`?grade=${grade}`)).grade, grade).toBe('TINGKATAN_4')
      }
      for (const grade of ['TINGKATAN_4', 'TINGKATAN_5']) expect((await map(`?grade=${grade}`)).grade).toBe(grade)
    })

    it('a grade with no topics for the subject is an empty, well-formed map (never Darjah content)', async () => {
      const d = await map('?subject=MATEMATIK&grade=TINGKATAN_5')
      expect(d.grade).toBe('TINGKATAN_5')
      expect(d.topics).toEqual([])
      expect(d.stats).toEqual({ done: 0, total: 0, progress: 0 })
      expect(d.gradeOptions).toEqual(['TINGKATAN_4', 'TINGKATAN_5'])
    })

    it('subject labels: pills, GEOGRAFI, an unknown code title-cased and kept as typed', async () => {
      expect((await map('?subject=PENDIDIKAN_ISLAM')).subjectLabel).toBe('Pend. Islam')
      const geo = await map('?subject=GEOGRAFI')
      // The default grade is TINGKATAN_4, which has one Geografi topic in the seed ("Geografi Tingkatan 4").
      expect([geo.subjectLabel, geo.subject, geo.topics.map((x) => x.name)]).toEqual(['Geografi', 'GEOGRAFI', ['Geografi Tingkatan 4']])
      const zzz = await map('?subject=ZZZ')
      expect([zzz.subjectLabel, zzz.subject, zzz.topics]).toEqual(['Zzz', 'ZZZ', []])
      expect(zzz.stats).toEqual({ done: 0, total: 0, progress: 0 })
      // The S14 filter is exact: a lower-case code is unknown. An empty subject is the default.
      expect((await map('?subject=matematik')).topics).toEqual([])
      expect((await map('?subject=')).subject).toBe('MATEMATIK')
    })

    it('serves other combinations (Tingkatan 5 Sains has 9 topics, the first open ones in sequence order)', async () => {
      const d = await map('?subject=SAINS&grade=TINGKATAN_5')
      expect(d.stats.total).toBe(9)
      expect(d.topics.map((x) => x.state)).toEqual(['unlocked', 'unlocked', ...Array<'locked'>(7).fill('locked')])
      expect(d.topics.map((x) => x.name)[0]).toBe('Dunia mikroorganisma')
      expect(d.topics.map((x) => x.name)).toContain('Satelit')
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
      const d1 = (await topics('?gradeLevel=TINGKATAN_4&subject=MATEMATIK')).map((c) => c.id)
      progress.set(d1[0]!, { progress: 95, sessions: 3, questionsAnswered: 23 })
      progress.set(d1[1]!, { progress: 15, sessions: 2, questionsAnswered: 7 })
      progress.set(d1[2]!, { progress: 20, sessions: 2, questionsAnswered: 7 })
    })
    afterAll(async () => {
      await stubbed.app.close()
    })

    it('derives the island states and stats from the provider (mastered, started, unlocked, locked)', async () => {
      const res = await client.get('/api/learning-map?subject=MATEMATIK&grade=TINGKATAN_4')
      const d = parseData(res, CurriculumLearningMapSchema)
      expect(d.topics.map((x) => x.name)).toEqual(['Fungsi dan Persamaan Kuadratik', 'Sistem Persamaan', 'Indeks, Surd dan Logaritma'])
      expect(d.topics.map((x) => x.state)).toEqual(['mastered', 'started', 'started'])
      expect(d.topics.map((x) => x.progress)).toEqual([95, 15, 20])
      expect(d.topics[0]).toMatchObject({ sessions: 3, questionsAnswered: 23 })
      expect(d.topics[2]!.practiceUrl).toBe(`/practice?topic_id=${d.topics[2]!.id}`)
      // done = mastered; progress = round(avg(95, 15, 20)) = 43. (Tingkatan 4 Matematik has 3 topics in the seed, so no locked island here.)
      expect(d.stats).toEqual({ done: 1, total: 3, progress: 43 })
    })

    it('the topic detail shows the progress on every subtopic bar, and the provider is asked for the current user', async () => {
      const first = (await topics('?gradeLevel=TINGKATAN_4&subject=MATEMATIK'))[0]!
      asked.length = 0
      const d = parseData(await client.get(`/api/topics/${first.id}`), CurriculumTopicDetailLearnerSchema)
      expect(d.progress).toEqual({ questionsAnswered: 23, progress: 95 })
      expect(d.subtopics.map((s) => s.progress)).toEqual([95, 95])
      expect(asked).toEqual([client.userId])
    })
  })
})
