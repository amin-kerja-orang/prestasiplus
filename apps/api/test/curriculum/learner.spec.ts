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

  // S4-T06 (DM-16): the learner Topik is a tree chapter of an offered level (Tingkatan 1 to 5) whose subject is one of the 8 legacy
  // codes; the expectations are computed from the tables, so they hold on any seed that has chapters for the levels.
  const LEGACY: Record<string, string> = {
    MATEMATIK: 'MATH', BAHASA_MELAYU: 'BM', BAHASA_INGGERIS: 'BI', SAINS: 'SCI',
    PENDIDIKAN_ISLAM: 'PI', PENDIDIKAN_MORAL: 'PM', SEJARAH: 'SEJ', GEOGRAFI: 'GEO',
  }
  const PRACTICE_CODES = Object.values(LEGACY)
  type Row = { id: string; name: string; code: string; level: string; chapter_number: number | null; description: string | null }
  /** Expected Topik rows in the served order: level order, subject order, chapter number (null last), id. */
  const expected = (level?: string, practiceCode?: string): Promise<Row[]> =>
    t.db.query<Row>(
      `select c.id::text, c.name, s.code, l.code as level, c.chapter_number, c.description
         from chapters c join subjects s on s.id = c.subject_id join education_levels l on l.id = c.education_level_id
        where c.in_tree and c.is_active and s.is_active and l.is_active and l.stage <> 'primary'
          and s.code = any($1::text[]) and ($2::text is null or l.code = $2) and ($3::text is null or s.code = $3)
        order by l.sort_order, l.id, s.sort_order, s.id, c.chapter_number nulls last, c.id`,
      [PRACTICE_CODES, level ?? null, practiceCode ?? null],
    )

  describe('GET /topics (AC7, BR-13)', () => {
    it('lists the chapters of Tingkatan 1 to 5 unpaged in order with the card shape, and no Darjah chapter', async () => {
      const res = await student.get('/api/topics')
      const items = parseList(res, CurriculumTopicCardSchema)
      const rows = await expected()
      expect(rows.length).toBeGreaterThan(0)
      expect(items).toHaveLength(rows.length)
      expect(res.body.meta).toMatchObject({ totalItems: rows.length, page: 1, pageSize: rows.length, totalPages: 1 })
      expect(items.map((c) => c.id)).toEqual(rows.map((r) => r.id))
      expect(items.every((c) => /^TINGKATAN_[1-5]$/.test(c.gradeLevel))).toBe(true)
      const first = rows[0]!
      const subs = await t.db.query<{ name: string }>(
        `select name from topics where chapter_id = $1 and is_active order by id`,
        [first.id],
      )
      expect(items[0]).toEqual({
        id: first.id,
        gradeLevel: `TINGKATAN_${first.level.slice(1)}`,
        subject: Object.keys(LEGACY).find((k) => LEGACY[k] === first.code),
        subjectLabel: Object.keys(LEGACY).find((k) => LEGACY[k] === first.code)!.replaceAll('_', ' '),
        name: first.name,
        description: first.description,
        subtopicCount: subs.length,
        subtopicsPreview: items[0]!.subtopicsPreview,
      })
      expect(items[0]!.subtopicsPreview).toHaveLength(Math.min(3, subs.length))
    })

    it('Tingkatan 1 to 3 are served from chapters (no longer 0) and each grade count equals the chapters table', async () => {
      for (const level of ['T1', 'T2', 'T3', 'T4', 'T5']) {
        const n = (await expected(level)).length
        expect(n, level).toBeGreaterThan(0)
        expect(await topics(`?gradeLevel=TINGKATAN_${level.slice(1)}`), level).toHaveLength(n)
      }
    })

    it('filters by gradeLevel and subject, AND, case-insensitive', async () => {
      expect(await topics('?gradeLevel=tingkatan_4')).toHaveLength((await expected('T4')).length)
      expect(await topics('?gradeLevel=TINGKATAN_4&subject=SAINS')).toHaveLength((await expected('T4', 'SCI')).length)
      expect(await topics('?gradeLevel=tingkatan_1&subject=sains')).toHaveLength((await expected('T1', 'SCI')).length)
      for (const [subject, code] of Object.entries(LEGACY)) {
        expect(await topics(`?subject=${subject}`), subject).toHaveLength((await expected(undefined, code)).length)
      }
      expect(await topics('?subject=geografi')).toHaveLength((await expected(undefined, 'GEO')).length)
    })

    it('Darjah, empty grades and unknown codes return an empty list, not an error', async () => {
      for (const gradeLevel of ['DARJAH_1', 'DARJAH_2', 'DARJAH_6']) expect(await topics(`?gradeLevel=${gradeLevel}`), gradeLevel).toHaveLength(0)
      const res = await student.get('/api/topics?subject=ZZZ')
      expect(parseList(res, CurriculumTopicCardSchema)).toEqual([])
      expect(res.body.meta.totalItems).toBe(0)
      expect(await topics('?gradeLevel=NOPE&subject=SAINS')).toEqual([])
    })

    it('a subject outside the 8 legacy codes (Kimia, Fizik, ...) is not listed; the card count is the active topics of the chapter', async () => {
      const all = await topics()
      const ids = new Set(all.map((c) => c.id))
      const outside = await t.db.query<{ id: string }>(
        `select c.id::text from chapters c join subjects s on s.id = c.subject_id where c.in_tree and not (s.code = any($1::text[]))`,
        [PRACTICE_CODES],
      )
      expect(outside.length).toBeGreaterThan(0)
      expect(outside.some((r) => ids.has(r.id))).toBe(false)
      const total = await t.db.query<{ n: string }>(
        `select count(*)::text n from topics tp where tp.is_active and tp.chapter_id = any($1::bigint[])`,
        [all.map((c) => c.id)],
      )
      expect(all.reduce((n, c) => n + c.subtopicCount, 0)).toBe(Number(total[0]!.n))
      expect(all.every((c) => c.subtopicsPreview.length <= 3 && c.subtopicsPreview.length <= c.subtopicCount)).toBe(true)
      expect(all.filter((c) => c.subject === 'BAHASA_MELAYU').every((c) => c.subjectLabel === 'BAHASA MELAYU')).toBe(true)
    })

    it('a deactivated level leaves the list', async () => {
      const before = (await topics()).length
      const t5 = (await expected('T5')).length
      await t.db.query(`update education_levels set is_active = false where code = 'T5'`)
      try {
        expect(await topics()).toHaveLength(before - t5)
        expect(await topics('?gradeLevel=TINGKATAN_5')).toEqual([])
      } finally {
        await t.db.query(`update education_levels set is_active = true where code = 'T5'`)
      }
    })

    it('rejects a repeated query key with the validation error', async () => {
      expectError(await student.get('/api/topics?subject=SAINS&subject=SEJARAH'), 'VALIDATION_ERROR')
    })
  })

  describe('GET /topics/:id (AC7)', () => {
    it('returns the chapter as the topic: its topics as subtopics, the practice code, null icon, chapter number as sequence, zero progress', async () => {
      const row = (await expected('T4', 'MATH'))[0]!
      const card = (await topics('?gradeLevel=TINGKATAN_4&subject=MATEMATIK'))[0]!
      expect(card.id).toBe(row.id)
      const detail = parseData(await student.get(`/api/topics/${card.id}`), CurriculumTopicDetailLearnerSchema)
      expect(detail).toMatchObject({
        id: card.id,
        gradeLevel: 'TINGKATAN_4',
        subject: 'MATEMATIK',
        subjectLabel: 'MATEMATIK',
        practiceCode: 'MATH',
        name: row.name,
        description: row.description,
        icon: null,
        sequence: row.chapter_number ?? 0,
        progress: { questionsAnswered: 0, progress: 0 },
      })
      const subs = await t.db.query<{ name: string; description: string | null }>(
        `select name, description from topics where chapter_id = $1 and is_active order by id`,
        [card.id],
      )
      expect(detail.subtopics).toHaveLength(subs.length)
      expect(detail.subtopics.every((s) => s.progress === 0)).toBe(true)
      expect([...detail.subtopics.map((s) => s.name)].sort()).toEqual(subs.map((s) => s.name).sort())
    })

    it('a Tingkatan 1 chapter has a detail page now', async () => {
      const card = (await topics('?gradeLevel=TINGKATAN_1'))[0]!
      const detail = parseData(await student.get(`/api/topics/${card.id}`), CurriculumTopicDetailLearnerSchema)
      expect(detail.gradeLevel).toBe('TINGKATAN_1')
    })

    it('a Darjah chapter, a chapter of a subject outside the 8 codes, an out-of-tree or inactive chapter is 404 "Topik tidak dijumpai."', async () => {
      const rows = await t.db.query<{ id: string }>(
        `(select c.id::text from chapters c join education_levels l on l.id = c.education_level_id where l.stage = 'primary' order by c.id limit 1)
         union all
         (select c.id::text from chapters c join subjects s on s.id = c.subject_id where c.in_tree and not (s.code = any($1::text[])) order by c.id limit 1)`,
        [PRACTICE_CODES],
      )
      expect(rows.length).toBe(2)
      for (const r of rows) expectError(await student.get(`/api/topics/${r.id}`), 'NOT_FOUND', 'Topik tidak dijumpai.')
    })

    it('the practice code map covers all 8 subjects (BR-16)', async () => {
      for (const [subject, code] of Object.entries(LEGACY)) {
        const list = await topics(`?subject=${subject}`)
        expect(list.length, subject).toBeGreaterThan(0)
        const detail = parseData(await student.get(`/api/topics/${list[0]!.id}`), CurriculumTopicDetailLearnerSchema)
        expect(detail.practiceCode, subject).toBe(code)
      }
    })

    it('an unknown, zero, oversized or non-numeric id is 404 "Topik tidak dijumpai."', async () => {
      for (const id of ['99999999', '0', 'abc', '9223372036854775808', '-1', '1.5']) {
        expectError(await student.get(`/api/topics/${id}`), 'NOT_FOUND', 'Topik tidak dijumpai.')
      }
    })
  })

  describe('GET /learning-map (AC8, BR-14, BR-15)', () => {
    const map = async (query = '') => parseData(await student.get(`/api/learning-map${query}`), CurriculumLearningMapSchema)

    it('defaults to MATEMATIK and TINGKATAN_4 with the chapters as islands; with the default provider every topic is open (REQ-C-021, D98)', async () => {
      const d = await map()
      const rows = await expected('T4', 'MATH')
      expect(d.subject).toBe('MATEMATIK')
      expect(d.subjectLabel).toBe('Matematik')
      expect(d.grade).toBe('TINGKATAN_4')
      expect(d.gradeOptions).toEqual(['TINGKATAN_1', 'TINGKATAN_2', 'TINGKATAN_3', 'TINGKATAN_4', 'TINGKATAN_5'])
      expect(d.topics.map((x) => x.id)).toEqual(rows.map((r) => r.id))
      expect(d.topics.map((x) => x.name)).toEqual(rows.map((r) => r.name))
      expect(d.topics.every((x) => x.icon === null && x.state === 'unlocked')).toBe(true)
      expect(d.topics.map((x) => x.practiceUrl)).toEqual(d.topics.map((x) => `/practice?topic_id=${x.id}`))
      expect(d.stats).toEqual({ done: 0, total: rows.length, progress: 0 })
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

    it('accepts every offered grade (TINGKATAN_1 to 5); anything else (a Darjah included, or a lower-case code) is served as TINGKATAN_4 (BR-15, D72)', async () => {
      for (const grade of ['DARJAH_1', 'DARJAH_4', 'DARJAH_6', 'tingkatan_5', 'xyz', '']) {
        expect((await map(`?grade=${grade}`)).grade, grade).toBe('TINGKATAN_4')
      }
      for (const n of [1, 2, 3, 4, 5]) {
        const d = await map(`?grade=TINGKATAN_${n}`)
        expect(d.grade).toBe(`TINGKATAN_${n}`)
        expect(d.stats.total, `T${n}`).toBe((await expected(`T${n}`, 'MATH')).length)
      }
    })

    it('a level that is no longer offered leaves gradeOptions and is not accepted as the grade', async () => {
      await t.db.query(`update education_levels set is_active = false where code = 'T5'`)
      try {
        const d = await map('?subject=MATEMATIK&grade=TINGKATAN_5')
        expect(d.grade).toBe('TINGKATAN_4') // T5 is no longer offered, so it is not accepted
        expect(d.gradeOptions).toEqual(['TINGKATAN_1', 'TINGKATAN_2', 'TINGKATAN_3', 'TINGKATAN_4'])
      } finally {
        await t.db.query(`update education_levels set is_active = true where code = 'T5'`)
      }
    })

    it('subject labels: pills, GEOGRAFI, an unknown code title-cased and kept as typed', async () => {
      expect((await map('?subject=PENDIDIKAN_ISLAM')).subjectLabel).toBe('Pend. Islam')
      const geo = await map('?subject=GEOGRAFI')
      expect([geo.subjectLabel, geo.subject, geo.topics.map((x) => x.name)]).toEqual(['Geografi', 'GEOGRAFI', (await expected('T4', 'GEO')).map((r) => r.name)])
      const zzz = await map('?subject=ZZZ')
      expect([zzz.subjectLabel, zzz.subject, zzz.topics]).toEqual(['Zzz', 'ZZZ', []])
      expect(zzz.stats).toEqual({ done: 0, total: 0, progress: 0 })
      // The S14 filter is exact: a lower-case code is unknown. An empty subject is the default.
      expect((await map('?subject=matematik')).topics).toEqual([])
      expect((await map('?subject=')).subject).toBe('MATEMATIK')
    })

    it('an inherited property name (constructor, toString, __proto__, hasOwnProperty) is an unknown subject: 200 with no topics, kept as typed', async () => {
      for (const subject of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
        const res = await student.get(`/api/learning-map?subject=${subject}`)
        expect(res.status, subject).toBe(200)
        const d = parseData(res, CurriculumLearningMapSchema)
        expect([d.subject, d.topics, d.stats], subject).toEqual([subject, [], { done: 0, total: 0, progress: 0 }])
      }
      const topicsRes = await student.get('/api/topics?subject=constructor')
      expect(topicsRes.status).toBe(200)
      expect(topicsRes.body.data).toEqual([])
    })

    it('serves other combinations (Tingkatan 1 Sains), all open, in chapter order', async () => {
      const d = await map('?subject=SAINS&grade=TINGKATAN_1')
      const rows = await expected('T1', 'SCI')
      expect(rows.length).toBeGreaterThan(0)
      expect(d.stats.total).toBe(rows.length)
      expect(d.topics.map((x) => x.state)).toEqual(Array<'unlocked'>(rows.length).fill('unlocked'))
      expect(d.topics.map((x) => x.name)).toEqual(rows.map((r) => r.name))
    })
  })

  describe('AC8: progress comes through the provider interface', () => {
    let stubbed: CurriculumTestApp
    let client: Client
    const asked: string[] = []
    const progress = new Map<string, TopicProgress>()
    let total = 0
    let firstTopicCount = 0
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
      total = d1.length
      firstTopicCount = Number(
        (await t.db.query<{ n: string }>(`select count(*)::text n from topics where is_active and chapter_id = $1`, [d1[0]]))[0]!.n,
      )
    })
    afterAll(async () => {
      await stubbed.app.close()
    })

    it('derives the island states and stats from the provider (mastered, started, unlocked, locked)', async () => {
      const res = await client.get('/api/learning-map?subject=MATEMATIK&grade=TINGKATAN_4')
      const d = parseData(res, CurriculumLearningMapSchema)
      // The progress map is keyed by chapter id (S4-T06), the id the map serves.
      expect(d.topics).toHaveLength(total)
      expect(d.topics.slice(0, 3).map((x) => x.state)).toEqual(['mastered', 'started', 'started'])
      expect(d.topics.slice(0, 3).map((x) => x.progress)).toEqual([95, 15, 20])
      expect(d.topics[0]).toMatchObject({ sessions: 3, questionsAnswered: 23 })
      expect(d.topics[2]!.practiceUrl).toBe(`/practice?topic_id=${d.topics[2]!.id}`)
      // done = mastered; progress = round(sum(95, 15, 20) / total) (the other islands have no progress).
      expect(d.stats).toEqual({ done: 1, total, progress: Math.round(130 / total) })
    })

    it('the topic detail shows the progress on every subtopic bar, and the provider is asked for the current user', async () => {
      const first = (await topics('?gradeLevel=TINGKATAN_4&subject=MATEMATIK'))[0]!
      asked.length = 0
      const d = parseData(await client.get(`/api/topics/${first.id}`), CurriculumTopicDetailLearnerSchema)
      expect(d.progress).toEqual({ questionsAnswered: 23, progress: 95 })
      expect(d.subtopics.map((s) => s.progress)).toEqual(Array<number>(firstTopicCount).fill(95))
      expect(asked).toEqual([client.userId])
    })
  })
})
