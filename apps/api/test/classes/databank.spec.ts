/**
 * S6-T19 (API-GUR-27, R1-GUR-44d, AC-GUR-44d-1..5): the teacher Databank Soalan. Counts and list come from the one servable
 * set that pupils are drawn from (D11, D91), Tingkatan 1-5 only, whole stimulus groups as one unit, read-only, teacher only.
 */
import {
  DATABANK_MESSAGES,
  DatabankOverviewSchema,
  DatabankQuestionsResponseSchema,
  envelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { questionPoolSeed } from '../../prisma/seed/questions/pool'
import { questionsSeed } from '../../prisma/seed/questions'
import { QuestionsModule } from '../../src/modules/questions'
import {
  ADMIN,
  SCHOOL_ADMIN,
  STUDENT_1,
  TEACHER_A,
  bootClassesApp,
  client,
  errorIs,
  fieldsOf,
  type Client,
  type ClassesTestApp,
} from './helpers'

const Overview = envelopeOf(DatabankOverviewSchema)

describe('GET /api/guru/databank/overview and /questions (S6-T19)', () => {
  let t: ClassesTestApp
  let teacher: Client

  const overview = async () => {
    const res = await teacher.get('/guru/databank/overview')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return Overview.parse(res.body).data
  }
  const list = async (query = '') => {
    const res = await teacher.get(`/guru/databank/questions${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return DatabankQuestionsResponseSchema.parse(res.body)
  }
  const tiles = (o: Awaited<ReturnType<typeof overview>>) => [...o.teras, ...o.elektif]
  const tileOf = (o: Awaited<ReturnType<typeof overview>>, subjectId: string) => tiles(o).find((x) => x.subjectId === subjectId)
  const subjectOfRef = async (ref: string) =>
    (await t.db.query<{ s: string }>(`select subject_id::text s from question_versions where number_label = $1`, [ref]))[0]?.s as string
  const idOfRef = async (ref: string) =>
    (await t.db.query<{ id: string }>(`select question_id::text id from question_versions where number_label = $1`, [ref]))[0]?.id as string

  beforeAll(async () => {
    t = await bootClassesApp({ seeds: [questionsSeed, questionPoolSeed], modules: [QuestionsModule] })
    teacher = await client(t, TEACHER_A)
  }, 600_000)
  afterAll(async () => {
    await t.close()
  })

  describe('guards', () => {
    it('no session is 401; a student, a school admin and the admin are 403; the teacher is 200', async () => {
      for (const path of ['/api/guru/databank/overview', '/api/guru/databank/questions']) {
        errorIs(await t.http().get(path), 401, 'UNAUTHORIZED', 'Sesi anda telah tamat. Sila log masuk semula.')
      }
      for (const who of [STUDENT_1, SCHOOL_ADMIN, ADMIN]) {
        const other = await client(t, who)
        for (const path of ['/guru/databank/overview', '/guru/databank/questions']) {
          const res = await other.get(path)
          expect(res.status, `${who} ${path}`).toBe(403)
        }
      }
      expect((await teacher.get('/guru/databank/overview')).status).toBe(200)
      expect((await teacher.get('/guru/databank/questions')).status).toBe(200)
    })

    it('answers are no-store', async () => {
      expect((await teacher.get('/guru/databank/overview')).headers['cache-control']).toMatch(/no-store/)
    })
  })

  describe('overview (AC-GUR-44d-1, 44d-2)', () => {
    it('every tile count equals the dataset rows of its subject (Tingkatan 1-5, approved, active, whole groups)', async () => {
      const expected = await t.db.query<{ sid: string; n: number }>(
        `select v.subject_id::text sid, count(*)::int n
           from questions q
           join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
           join education_levels l on l.id = v.education_level_id
           join subjects s on s.id = v.subject_id
          where q.is_active and v.status = 'approved' and s.is_active and l.code in ('T1','T2','T3','T4','T5')
            and (v.stimulus_flag is null or v.stimulus_flag = 'stem_duplicated' or v.flag_dismissed_at is not null)
            and not exists (select 1 from question_tags pt where pt.question_id = q.id and pt.kind = 'pksk_domain')
            and (q.group_id is null or not exists (select 1 from questions m join question_versions mv on mv.question_id = m.id and mv.version_no = m.live_version_no
                                                    where m.group_id = q.group_id and mv.type <> 'mcq'))
          group by 1`,
      )
      const want = new Map(expected.map((r) => [r.sid, r.n]))
      const o = await overview()
      expect(want.size).toBeGreaterThan(0)
      for (const tile of tiles(o)) expect(tile.count, tile.nameMs).toBe(want.get(tile.subjectId) ?? 0)
      expect(o.totalQuestions).toBe([...want.values()].reduce((a, b) => a + b, 0))
    })

    it('Teras are the core subjects, Elektif the rest, by sort order then name, nothing hidden', async () => {
      const o = await overview()
      const rows = await t.db.query<{ id: string; is_core: boolean }>(`select id::text, is_core from subjects where is_active order by sort_order, name, id`)
      expect(o.teras.map((x) => x.subjectId)).toEqual(rows.filter((r) => r.is_core).map((r) => r.id))
      expect(o.elektif.map((x) => x.subjectId)).toEqual(rows.filter((r) => !r.is_core).map((r) => r.id))
      expect(o.teras.every((x) => x.nameMs.length > 0 && x.nameEn.length > 0)).toBe(true)
    })

    it('a subject with no question shows "count: 0" and is not an active subject', async () => {
      const o = await overview()
      const zero = tiles(o).filter((x) => x.count === 0)
      expect(zero.length).toBeGreaterThan(0)
      expect(o.activeSubjects).toBe(tiles(o).length - zero.length)
      expect(o.activeSubjects).toBe(tiles(o).filter((x) => x.count > 0).length)
    })

    it('primary-level (Darjah) pool questions are not counted', async () => {
      const primary = Number((await t.db.query<{ n: string }>(
        `select count(*)::text n from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
           join education_levels l on l.id = v.education_level_id where l.stage = 'primary' and q.is_active and v.status = 'approved'`,
      ))[0]?.n)
      expect(primary).toBeGreaterThan(0)
      const o = await overview()
      const all = Number((await t.db.query<{ n: string }>(
        `select count(*)::text n from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
          where q.is_active and v.status = 'approved'`,
      ))[0]?.n)
      expect(o.totalQuestions).toBeLessThanOrEqual(all - primary)
    })

    it('an unapproved (draft) question and a flagged stimulus_missing question are not counted; a dismissed flag counts again', async () => {
      const bm = await subjectOfRef('SEED-MCQ-BM-T4')
      const before = tileOf(await overview(), bm)?.count as number
      const qid = await idOfRef('SEED-MCQ-BM-T4')
      try {
        await t.db.query(`update question_versions set stimulus_flag = 'stimulus_missing', stimulus_flag_ref = 'numbered', stimulus_flag_at = now() where number_label = 'SEED-MCQ-BM-T4'`)
        expect(tileOf(await overview(), bm)?.count).toBe(before - 1)
        expect((await list(`?subjectId=${bm}`)).data.flatMap((u) => u.questions.map((q) => q.id))).not.toContain(qid)
        await t.db.query(`update question_versions set flag_dismissed_at = now() where number_label = 'SEED-MCQ-BM-T4'`)
        expect(tileOf(await overview(), bm)?.count).toBe(before)
      } finally {
        await t.db.query(`update question_versions set stimulus_flag = null, stimulus_flag_ref = null, stimulus_flag_at = null, flag_dismissed_at = null where number_label = 'SEED-MCQ-BM-T4'`)
      }
      // The draft row of the seed (BM, T4) never appears.
      const draftId = await idOfRef('SEED-DRAFT-BM-T4')
      const ids = (await list(`?subjectId=${bm}`)).data.flatMap((u) => u.questions.map((q) => q.id))
      expect(ids).not.toContain(draftId)
    })
  })

  describe('questions (AC-GUR-44d-3, 44d-4, 44d-5)', () => {
    it('a tile selected lists only that subject and its total equals the tile count', async () => {
      const o = await overview()
      const withQuestions = tiles(o).filter((x) => x.count > 0)
      expect(withQuestions.length).toBeGreaterThan(0)
      for (const tile of withQuestions) {
        const body = await list(`?subjectId=${tile.subjectId}`)
        expect(body.meta.totalQuestions, tile.nameMs).toBe(tile.count)
        expect(body.meta.totalItems).toBe(body.meta.totalUnits)
        for (const unit of body.data) for (const q of unit.questions) expect(q.subjectId).toBe(tile.subjectId)
      }
      const all = await list()
      expect(all.meta.totalQuestions).toBe(o.totalQuestions)
    })

    it('rows carry the stem, options without a key, the level label and the stars; newest unit first', async () => {
      const body = await list()
      const first = body.data[0]
      expect(first).toBeDefined()
      const q = first?.questions[0]
      expect(q?.levelLabel).toMatch(/^Tingkatan [1-5]$/)
      expect(q?.status).toBe('approved')
      expect(JSON.stringify(body)).not.toMatch(/correct|isCorrect/i)
      const newest = body.data.map((u) => Math.max(...u.questions.map((x) => Number(x.id))))
      expect(newest).toEqual([...newest].sort((a, b) => b - a))
    })

    it('a stimulus group is ONE unit: members in group order, the stimulus once, counted as its members', async () => {
      const body = await list('?q=Pasar%20tani')
      const groups = body.data.filter((u) => u.group !== null)
      expect(groups).toHaveLength(1)
      const unit = groups[0]!
      expect(unit.unitId).toBe(`g${unit.group?.id}`)
      expect(unit.group?.stimuli).toHaveLength(1)
      expect(unit.questions).toHaveLength(3)
      expect(unit.questions.map((q) => q.groupPosition)).toEqual([1, 2, 3])
      // The unit shows once in the unfiltered list too, and counts three questions in the totals.
      const everything = await list('?subjectId=' + unit.questions[0]?.subjectId)
      expect(everything.data.filter((u) => u.unitId === unit.unitId)).toHaveLength(1)
      const standalone = everything.data.filter((u) => u.group === null).length
      const grouped = everything.data.filter((u) => u.group !== null)
      expect(everything.meta.totalUnits).toBe(standalone + grouped.length)
      expect(everything.meta.totalQuestions).toBe(standalone + grouped.reduce((n, u) => n + u.questions.length, 0))
      expect(everything.meta.totalQuestions).toBeGreaterThan(everything.meta.totalUnits)
    })

    it('an incomplete group (a member not servable) is not listed at all', async () => {
      const unit = (await list('?q=Pasar%20tani')).data.find((u) => u.group !== null)!
      const member = unit.questions[1]!.id
      try {
        await t.db.query(`update questions set is_active = false where id = $1::bigint`, [member])
        const after = await list('?q=Pasar%20tani')
        expect(after.data.filter((u) => u.group !== null)).toHaveLength(0)
      } finally {
        await t.db.query(`update questions set is_active = true where id = $1::bigint`, [member])
      }
    })

    it('search: matches the stem text case-insensitively, a non-matching text lists nothing, wildcards are literal', async () => {
      const hit = await list('?q=PASAR%20TANI')
      expect(hit.data.length).toBeGreaterThan(0)
      const none = await list('?q=zzzz-tiada-padanan')
      expect(none.data).toEqual([])
      expect(none.meta.totalUnits).toBe(0)
      expect((await list('?q=%25%25')).data).toEqual([])
      expect((await list('?q=__')).data).toEqual([])
    })

    it('a search shorter than 2 characters is 422 with the GLB-4 copy; a blank search is no search', async () => {
      for (const q of ['x', '%20x%20', '1']) {
        const res = await teacher.get(`/guru/databank/questions?q=${q}`)
        expect(fieldsOf(res)).toEqual({ q: 'Taip sekurang-kurangnya 2 aksara.' })
        expect(DATABANK_MESSAGES.searchMin).toBe('Taip sekurang-kurangnya 2 aksara.')
      }
      expect((await list('?q=')).meta.totalQuestions).toBe((await list()).meta.totalQuestions)
    })

    it('a bad subjectId or page is 422; an unknown query key is 422', async () => {
      expect(Object.keys(fieldsOf(await teacher.get('/guru/databank/questions?subjectId=abc')))).toEqual(['subjectId'])
      expect(Object.keys(fieldsOf(await teacher.get('/guru/databank/questions?page=0')))).toEqual(['page'])
      expect(Object.keys(fieldsOf(await teacher.get('/guru/databank/questions?foo=1')))).toEqual(['foo'])
    })

    it('pages hold 20 units; the pages together hold every unit once; a page past the end is empty', async () => {
      const first = await list()
      expect(first.meta.pageSize).toBe(20)
      expect(first.meta.totalUnits).toBeGreaterThan(20)
      expect(first.data).toHaveLength(20)
      const seen = new Set(first.data.map((u) => u.unitId))
      const pages = first.meta.totalPages
      for (let page = 2; page <= pages; page += 1) {
        const body = await list(`?page=${page}`)
        expect(body.data.length).toBeLessThanOrEqual(20)
        if (page < pages) expect(body.data).toHaveLength(20)
        for (const u of body.data) {
          expect(seen.has(u.unitId)).toBe(false)
          seen.add(u.unitId)
        }
      }
      expect(seen.size).toBe(first.meta.totalUnits)
      const past = await list(`?page=${pages + 1}`)
      expect(past.data).toEqual([])
      expect(past.meta.totalUnits).toBe(first.meta.totalUnits)
    })

    it('read-only: no write route exists on the databank', async () => {
      for (const method of ['post', 'put', 'delete'] as const) {
        const res = await teacher[method === 'delete' ? 'del' : method]('/guru/databank/questions')
        expect(res.status).toBe(404)
      }
    })
  })
})
