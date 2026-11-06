import {
  BijakAttemptResultViewSchema,
  BijakAttemptSelfMarkResultSchema,
  PracticeReadStructuredAttemptResultSchema,
  PracticeReadStructuredDetailSchema,
  PracticeReadStructuredListResponseSchema,
  envelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { toMytTimestamp } from '../../../src/common/time/myt'
import { AttemptsRepository } from '../../../src/modules/bijak/attempts/attempts.repository'
import { QuestionsRepository } from '../../../src/modules/questions'
import {
  type Client,
  type WritesTestApp,
  bootWritesApp,
  expectCsrfInvalid,
  expectError,
  leaf,
  loginAs,
  loginModPelajar,
  publishStructured,
  seededQuestion,
  subjectIdOf,
  userIdOf,
} from './helpers'

const Detail = envelopeOf(PracticeReadStructuredDetailSchema)
const Attempt = envelopeOf(PracticeReadStructuredAttemptResultSchema)

let t: WritesTestApp
let student: Client
let tree: string
let ecf: string
let anyn: string

beforeAll(async () => {
  t = await bootWritesApp()
  tree = await seededQuestion(t.db, 'SEED-STR-TREE')
  ecf = await seededQuestion(t.db, 'SEED-STR-ECF')
  anyn = await seededQuestion(t.db, 'SEED-STR-ANYN')
  student = await loginAs(t, 'student')
}, 120_000)

afterAll(async () => {
  await t.close()
})

const list = async (c: Client, query = '') => {
  const res = await c.get(`/api/practice/structured${query}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return PracticeReadStructuredListResponseSchema.parse(res.body)
}

const attemptRows = (userId: string) =>
  t.db.query<{ id: string; question_id: string; question_version_no: number; scope: string | null; track: string | null; total_awarded: number; total_max: number; is_test: boolean; marks: unknown; answers: unknown }>(
    'select id::text, question_id::text, question_version_no, scope, track, total_awarded, total_max, is_test, marks, answers from structured_attempts where user_id = $1 order by id',
    [userId],
  )

/** S5-T11: the structured attempts of a user in `exam_attempts` (the new store; `structured_attempts` is no longer written). */
const examRows = (userId: string) =>
  t.db.query<{
    id: string
    paper_id: string | null
    paper_kind: string
    mode: string
    status: string
    duration_min: number
    deadline_at: Date | null
    submitted_at: Date | null
    is_test: boolean
    title: string
    subject: string
    composition: { questionIds: string[]; versions?: Record<string, number>; rule: { type: string } }[]
  }>(
    `select id::text, paper_id::text, paper_kind, mode, status, duration_min, deadline_at, submitted_at, is_test, title, subject, composition
       from exam_attempts where user_id = $1 and paper_kind = 'structured' order by started_at, id`,
    [userId],
  )

describe('AC9 authentication', () => {
  it('without a session every route is 401 UNAUTHORIZED', async () => {
    const http = t.http()
    for (const res of [
      await http.get('/api/practice/structured'),
      await http.get(`/api/practice/structured/${tree}`),
      await http.post(`/api/practice/structured/${tree}/attempts`).send({ answers: [] }),
    ]) {
      expectError(res, 'UNAUTHORIZED')
    }
  })

  it('every role with a session may read the list (guru, admin)', async () => {
    for (const who of ['teacher', 'admin'] as const) expect((await (await loginAs(t, who)).get('/api/practice/structured')).status).toBe(200)
  })
})

describe('AC1 GET /api/practice/structured', () => {
  it('lists the seeded published sets newest first with the card shape and parses with the contract', async () => {
    const out = await list(student)
    expect(out.data.map((c) => c.id).sort()).toEqual([tree, ecf, anyn].sort())
    expect(out.meta).toMatchObject({ page: 1, pageSize: 12, totalItems: 3, totalPages: 1, from: 1, to: 3, scope: null, track: null })
    const names = out.meta.subjectOptions.map((o) => o.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms')))
    expect(out.meta.subjectOptions.length).toBeGreaterThan(20)
    const card = out.data.find((c) => c.id === tree)
    expect(card).toMatchObject({
      subjectName: 'Matematik',
      levelName: 'Tingkatan 4',
      isTrial: false,
      topic: null,
      author: 'Guru Pakar',
      school: null,
      // (a), (a).(i), (a).(i).(A), (a).(i).(B), (a).(ii), (b): every part; 2 top-level parts; 1 + 1 + 3 + 2 marks.
      subQuestionCount: 6,
      parts: 2,
      marks: 7,
      estimatedMinutes: 7,
    })
    expect(card?.preview).toBe('Diberi fungsi kuadratik f(x) = x² − 4x + 3.')
    expect(card?.kbatLevel).toBeGreaterThanOrEqual(1)
    expect(card?.kbatLevel).toBeLessThanOrEqual(6)
  })

  it('the preview is cut at 200 characters plus "..."', async () => {
    const long = 'x'.repeat(250)
    const id = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: long })
    const card = (await list(student)).data.find((c) => c.id === id)
    expect(card?.preview).toBe(`${'x'.repeat(200)}...`)
    await t.db.query('update questions set is_active = false where id = $1', [id])
  })

  it('orders newest first (then id) and pages 12 at a time; a page past the end is empty and keeps the number', async () => {
    const made: string[] = []
    for (let i = 0; i < 12; i++) {
      t.clock.advance(1000)
      made.push(await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: `Set susulan ${String(i)}` }))
    }
    const p1 = await list(student)
    expect(p1.data).toHaveLength(12)
    expect(p1.meta).toMatchObject({ page: 1, pageSize: 12, totalItems: 15, totalPages: 2, from: 1, to: 12 })
    expect(p1.data.map((c) => c.id)).toEqual([...made].reverse())
    const p2 = await list(student, '?page=2')
    expect(p2.data.map((c) => c.id).sort()).toEqual([tree, ecf, anyn].sort())
    expect(p2.meta).toMatchObject({ page: 2, from: 13, to: 15 })
    const past = await list(student, '?page=9')
    expect(past.data).toEqual([])
    expect(past.meta).toMatchObject({ page: 9, from: null, to: null, totalItems: 15 })
    // An invalid page is page 1.
    expect((await list(student, '?page=abc')).meta.page).toBe(1)
    expect((await list(student, '?page=0')).meta.page).toBe(1)
    await t.db.query('update questions set is_active = false where id = any($1::bigint[])', [made])
  })

  it('hydrates only the page slice: 15 sets, page 1 asks the bank for 12 ids, page 2 for 3, and the total stays 15', async () => {
    const made: string[] = []
    for (let i = 0; i < 12; i++) {
      t.clock.advance(1000)
      made.push(await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: `Hidrat ${String(i)}` }))
    }
    const repo = t.app.get(QuestionsRepository)
    const sizes: number[] = []
    const original = repo.getMany.bind(repo)
    repo.getMany = (async (ids: readonly string[], view?: 'live' | 'latest') => {
      sizes.push(ids.length)
      return original(ids, view)
    }) as typeof repo.getMany
    try {
      const p1 = await list(student)
      const p2 = await list(student, '?page=2')
      expect(sizes).toEqual([12, 3])
      expect(p1.meta.totalItems).toBe(15)
      expect(p2.meta.totalItems).toBe(15)
    } finally {
      repo.getMany = original
      await t.db.query('update questions set is_active = false where id = any($1::bigint[])', [made])
    }
  })

  it('S5-T11 q: case-insensitive match on the stem or a linked stimulus, LIKE wildcards literal, 100 characters max', async () => {
    const a = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Kajian Fotosintesis Tumbuhan 100%' })
    const b = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Soalan lain sepenuhnya' })
    try {
      expect((await list(student, '?q=fotosintesis')).data.map((c) => c.id)).toEqual([a])
      expect((await list(student, `?q=${encodeURIComponent('  TUMBUHAN 100%  ')}`)).data.map((c) => c.id)).toEqual([a])
      expect((await list(student, '?q=100%25x')).data).toEqual([])
      expect((await list(student, '?q=%25')).data.map((c) => c.id)).toEqual([a])
      expect((await list(student, '?q=')).meta.totalItems).toBe((await list(student)).meta.totalItems)
      expect((await list(student, `?q=${'a'.repeat(100)}`)).data).toEqual([])
      expectError(await student.get(`/api/practice/structured?q=${'a'.repeat(101)}`), 'VALIDATION_ERROR')
      // A linked stimulus body is searched too.
      const stim = (await t.db.query<{ id: string }>(`insert into stimuli (kind, body_ms) values ('passage', 'Petikan tentang Gunung Kinabalu') returning id::text id`))[0]?.id as string
      const ver = (await t.db.query<{ id: string }>('select id::text id from question_versions where question_id = $1 and version_no = (select live_version_no from questions where id = $1)', [b]))[0]?.id as string
      await t.db.query('insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1, $2, 1)', [ver, stim])
      expect((await list(student, '?q=kinabalu')).data.map((c) => c.id)).toEqual([b])
    } finally {
      await t.db.query('update questions set is_active = false where id = any($1::bigint[])', [[a, b]])
    }
  })

  it('S5-T11 markable and pendingSchemeCount: a set whose leaf has no scheme still lists but is not markable', async () => {
    const good = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Set skema lengkap' })
    const bad = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Set skema tiada' })
    try {
      // The scheme of the first leaf is removed (no answer key): the set still lists but is not markable.
      await t.db.query(
        `delete from answer_keys where part_id = (select p.id from question_parts p join question_versions v on v.id = p.question_version_id
          where v.question_id = $1 and p.mode is not null order by p.id limit 1)`,
        [bad],
      )
      const all = await list(student, '?q=skema')
      expect(all.data.map((c) => c.id).sort()).toEqual([good, bad].sort())
      expect(all.meta.pendingSchemeCount).toBe(1)
      expect(all.data.find((c) => c.id === bad)).toBeDefined()
      const only = await list(student, '?q=skema&markable=1')
      expect(only.data.map((c) => c.id)).toEqual([good])
      expect(only.meta).toMatchObject({ totalItems: 1, pendingSchemeCount: 1 })
      expect(only.data[0]?.bestScore).toBeNull()
      expect((await list(student, '?q=skema&markable=true')).data.map((c) => c.id)).toEqual([good])
      expect((await list(student, '?q=tiada-padanan')).meta.pendingSchemeCount).toBe(0)
    } finally {
      await t.db.query('update questions set is_active = false where id = any($1::bigint[])', [[good, bad]])
    }
  })

  it('S5-T11 a present but invalid key never gives 500: listed unfiltered (200), dropped by markable=1', async () => {
    const good = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Kunci baik' })
    const bad = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Kunci rosak' })
    try {
      await t.db.query(
        `update answer_keys set kind = 'points', content = '{"points": []}'::jsonb where part_id = (select p.id from question_parts p join question_versions v on v.id = p.question_version_id
          where v.question_id = $1 and p.mode is not null order by p.id limit 1)`,
        [bad],
      )
      const all = await list(student, '?q=kunci')
      expect(all.data.map((c) => c.id).sort()).toEqual([good, bad].sort())
      const card = all.data.find((c) => c.id === bad)
      expect(card).toMatchObject({ subQuestionCount: 2, parts: 2, marks: 5, preview: 'Kunci rosak' })
      const only = await list(student, '?q=kunci&markable=1')
      expect(only.data.map((c) => c.id)).toEqual([good])
    } finally {
      await t.db.query('update questions set is_active = false where id = any($1::bigint[])', [[good, bad]])
    }
  })

  it('S5-T11 order: newest published first by published_at, not created_at', async () => {
    const older = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Susunan lama' })
    const newer = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Susunan baru' })
    try {
      // created order: older, newer; published order is the reverse.
      await t.db.query(`update question_versions set published_at = '2030-01-02T00:00:00Z' where question_id = $1`, [older])
      await t.db.query(`update question_versions set published_at = '2030-01-01T00:00:00Z' where question_id = $1`, [newer])
      expect((await list(student, '?q=susunan')).data.map((c) => c.id)).toEqual([older, newer])
    } finally {
      await t.db.query('update questions set is_active = false where id = any($1::bigint[])', [[older, newer]])
    }
  })

  it('S5-T11 bestScore tie-break: the highest awarded wins; equal awarded takes the latest attempt', async () => {
    const id = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Set seri skor' })
    const uid = await userIdOf(t.db, 'pelajar@demo.test')
    try {
      const ins = (awarded: number, max: number, at: string) =>
        t.db.query(
          `insert into structured_attempts (user_id, question_id, question_version_no, answers, marks, total_awarded, total_max, submitted_at, is_test)
           values ($1, $2, 1, '[]'::jsonb, '[]'::jsonb, $3, $4, $5::timestamptz, false)`,
          [uid, id, awarded, max, at],
        )
      await ins(2, 5, '2026-10-01T00:00:00Z')
      await ins(4, 5, '2026-10-02T00:00:00Z')
      await ins(4, 6, '2026-10-03T00:00:00Z')
      await ins(1, 5, '2026-10-04T00:00:00Z')
      expect((await list(student, '?q=seri+skor')).data[0]?.bestScore).toEqual({ awarded: 4, max: 6 })
    } finally {
      await t.db.query('update questions set is_active = false where id = $1', [id])
    }
  })

  it('S5-T11 bestScore: null without an attempt, then the best total of the caller only', async () => {
    const id = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Set skor terbaik' })
    try {
      const card = async (c: Client) => (await list(c, '?q=skor+terbaik')).data[0]
      expect((await card(student))?.bestScore).toBeNull()
      const body = (right: boolean) => ({
        answers: [{ subQuestionId: `${id}-(a)`, text: right ? 'jawapan (a)' : 'salah' }, { subQuestionId: `${id}-(b)`, text: right ? 'jawapan (b)' : 'salah' }],
      })
      const post = (right: boolean) => student.post(`/api/practice/structured/${id}/attempts`, body(right))
      expect((await post(true)).status).toBe(201)
      expect((await card(student))?.bestScore).toEqual({ awarded: 5, max: 5 })
      expect((await post(false)).status).toBe(201)
      expect((await card(student))?.bestScore).toEqual({ awarded: 5, max: 5 })
      expect((await card(await loginAs(t, 'teacher')))?.bestScore).toBeNull()
    } finally {
      await t.db.query('update questions set is_active = false where id = $1', [id])
    }
  })

  it('S5-T11 bestScore is the max of the legacy structured_attempts and the new structured exam_attempts, per question', async () => {
    const id = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Set skor gabungan' })
    const c = await loginAs(t, 'student2')
    const uid = c.userId
    const legacy = (awarded: number, max: number) =>
      t.db.query(
        `insert into structured_attempts (user_id, question_id, question_version_no, answers, marks, total_awarded, total_max, submitted_at, is_test)
         values ($1, $2, 1, '[]'::jsonb, '[]'::jsonb, $3, $4, '2026-10-01T00:00:00Z'::timestamptz, false)`,
        [uid, id, awarded, max],
      )
    try {
      const card = async () => (await list(c, '?q=skor+gabungan')).data[0]
      const post = (a: string, b: string) =>
        c.post(`/api/practice/structured/${id}/attempts`, { answers: [{ subQuestionId: `${id}-(a)`, text: a }, { subQuestionId: `${id}-(b)`, text: b }] })
      // new row only: 2 of 5
      expect((await post('jawapan (a)', 'salah')).status).toBe(201)
      expect((await card())?.bestScore).toEqual({ awarded: 2, max: 5 })
      // a better legacy row wins; a worse one does not
      await legacy(4, 5)
      expect((await card())?.bestScore).toEqual({ awarded: 4, max: 5 })
      await legacy(1, 5)
      expect((await card())?.bestScore).toEqual({ awarded: 4, max: 5 })
      // a better new row wins over the legacy best
      expect((await post('jawapan (a)', 'jawapan (b)')).status).toBe(201)
      expect((await card())?.bestScore).toEqual({ awarded: 5, max: 5 })
      // another pupil sees nothing of it
      expect((await list(student, '?q=skor+gabungan')).data[0]?.bestScore).toBeNull()
    } finally {
      await t.db.query('update questions set is_active = false where id = $1', [id])
      await t.db.query('delete from structured_attempts where user_id = $1 and question_id = $2', [uid, id])
    }
  })

  it('filters subjectId and kbatLevel (AND); empty values mean all; unknown values match nothing', async () => {
    const math = await subjectIdOf(t.db, 'MATH')
    const sci = await subjectIdOf(t.db, 'SCI')
    const only = await list(student, `?subjectId=${math}`)
    expect(only.data.map((c) => c.id).sort()).toEqual([tree, ecf].sort())
    expect((await list(student, `?subjectId=${sci}`)).data.map((c) => c.id)).toEqual([anyn])
    await t.db.query('update question_versions set cognitive_level = 5 where question_id = $1', [tree])
    await t.db.query('update question_versions set cognitive_level = 2 where question_id = any($1::bigint[])', [[ecf, anyn]])
    expect((await list(student, '?kbatLevel=5')).data.map((c) => c.id)).toEqual([tree])
    expect((await list(student, `?subjectId=${math}&kbatLevel=2`)).data.map((c) => c.id)).toEqual([ecf])
    expect((await list(student, '?subjectId=&kbatLevel=')).meta.totalItems).toBe(3)
    for (const q of ['?subjectId=abc', '?subjectId=999999', '?kbatLevel=7', '?kbatLevel=0', '?kbatLevel=x']) {
      const out = await list(student, q)
      expect(out.data, q).toEqual([])
      expect(out.meta.totalItems, q).toBe(0)
    }
  })

  it('scope=spm lists the Subjektif subjects in the FR-M05-134 order; track=bahasa lists BM then BI; an unknown scope is ignored', async () => {
    const spm = await list(student, '?scope=spm')
    expect(spm.meta).toMatchObject({ scope: 'spm', track: null })
    const codes = (
      await t.db.query<{ code: string }>('select code from subjects where id = any($1::bigint[])', [spm.meta.subjectOptions.map((o) => o.id)])
    ).map((r) => r.code)
    expect(codes).toHaveLength(15)
    const byId = new Map((await t.db.query<{ id: string; code: string }>('select id::text, code from subjects')).map((r) => [r.id, r.code]))
    expect(spm.meta.subjectOptions.map((o) => byId.get(o.id))).toEqual(['BM', 'BI', 'MATH', 'SCI', 'SEJ', 'BIO', 'EKON', 'PHY', 'GEO', 'CHEM', 'ADDMATH', 'PERNIAGA', 'AKAUN', 'SK', 'TI'])
    expect(spm.data.map((c) => c.id).sort()).toEqual([tree, ecf, anyn].sort())
    const bahasa = await list(student, '?scope=spm&track=bahasa')
    expect(bahasa.meta).toMatchObject({ scope: 'spm', track: 'bahasa' })
    expect(bahasa.meta.subjectOptions.map((o) => byId.get(o.id))).toEqual(['BM', 'BI'])
    expect(bahasa.data).toEqual([])
    // A subject outside the variant's list matches nothing.
    const hist = await subjectIdOf(t.db, 'PM')
    expect((await list(student, `?scope=spm&subjectId=${hist}`)).data).toEqual([])
    // Unknown scope is ignored; track needs scope=spm.
    expect((await list(student, '?scope=x')).meta).toMatchObject({ scope: null, track: null, totalItems: 3 })
    expect((await list(student, '?track=bahasa')).meta).toMatchObject({ scope: null, track: null })
  })

  it('BM sets precede BI sets across the whole bahasa list; the Subjektif list merges newest first', async () => {
    const bi = await subjectIdOf(t.db, 'BI')
    const bm = await subjectIdOf(t.db, 'BM')
    t.clock.advance(1000)
    const bmOld = await publishStructured(t, 'SEED-MCQ-BM-T4', { stem: 'BM lama' })
    t.clock.advance(1000)
    const biNew = await publishStructured(t, 'SEED-MCQ-BM-T4', { stem: 'BI baharu' })
    await t.db.query('update question_versions set subject_id = $1 where question_id = $2', [bi, biNew])
    t.clock.advance(1000)
    const bmNew = await publishStructured(t, 'SEED-MCQ-BM-T4', { stem: 'BM baharu' })
    const bahasa = await list(student, '?scope=spm&track=bahasa')
    expect(bahasa.data.map((c) => c.id)).toEqual([bmNew, bmOld, biNew])
    expect(bahasa.data.map((c) => c.subjectId)).toEqual([bm, bm, bi])
    const merged = await list(student, '?scope=spm')
    expect(merged.data.slice(0, 3).map((c) => c.id)).toEqual([bmNew, biNew, bmOld])
    expect((await list(student, `?scope=spm&track=bahasa&subjectId=${bi}`)).data.map((c) => c.id)).toEqual([biNew])
    await t.db.query('update questions set is_active = false where id = any($1::bigint[])', [[bmOld, biNew, bmNew]])
  })

  it('only published, active sets of Tingkatan 4 and 5 are listed', async () => {
    const t3 = (await t.db.query<{ id: string }>(`select id::text from education_levels where code = 'T3'`))[0]?.id
    await t.db.query('update question_versions set education_level_id = $1 where question_id = $2', [t3, anyn])
    expect((await list(student)).data.map((c) => c.id)).not.toContain(anyn)
    await t.db.query(`update question_versions set education_level_id = (select id from education_levels where code = 'T4') where question_id = $1`, [anyn])
    expect((await list(student)).data.map((c) => c.id)).toContain(anyn)
    await t.db.query('update questions set is_active = false where id = $1', [anyn])
    expect((await list(student)).data.map((c) => c.id)).not.toContain(anyn)
    await t.db.query('update questions set is_active = true where id = $1', [anyn])
    // Withdrawn (archived live version) leaves the list too.
    await t.db.query(`update question_versions set status = 'archived', archive_reason = 'withdrawn' where question_id = $1`, [anyn])
    expect((await list(student)).data.map((c) => c.id)).not.toContain(anyn)
    await t.db.query(`update question_versions set status = 'approved', archive_reason = null where question_id = $1`, [anyn])
    expect((await list(student)).data.map((c) => c.id)).toContain(anyn)
  })

  describe('S5-T11 learner visibility (NOT_FLAGGED_SQL, MEDIA_RESOLVED_SQL) applies to the page and the total alike', () => {
    const liveVersion = async (id: string) =>
      (await t.db.query<{ id: string }>('select v.id::text id from question_versions v join questions q on q.id = v.question_id and v.version_no = q.live_version_no where q.id = $1', [id]))[0]?.id as string

    it('a normal set is listed and counted', async () => {
      const ok = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'zzvis normal' })
      try {
        const out = await list(student, '?q=zzvis')
        expect(out.data.map((c) => c.id)).toEqual([ok])
        expect(out.meta.totalItems).toBe(1)
      } finally {
        await t.db.query('update questions set is_active = false where id = $1', [ok])
      }
    })

    it('a set whose live version is flagged (stimulus_missing) is not listed and not counted; a dismissed flag or stem_duplicated lists again', async () => {
      const ok = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'zzvis ok' })
      const flagged = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'zzvis flagged' })
      try {
        await t.db.query(`update question_versions set stimulus_flag = 'stimulus_missing', stimulus_flag_ref = 'numbered', stimulus_flag_at = now() where id = $1`, [await liveVersion(flagged)])
        const out = await list(student, '?q=zzvis')
        expect(out.data.map((c) => c.id)).toEqual([ok])
        expect(out.meta.totalItems).toBe(1)
        await t.db.query(`update question_versions set flag_dismissed_at = now() where id = $1`, [await liveVersion(flagged)])
        expect((await list(student, '?q=zzvis')).meta.totalItems).toBe(2)
        await t.db.query(`update question_versions set flag_dismissed_at = null, stimulus_flag = 'stem_duplicated' where id = $1`, [await liveVersion(flagged)])
        expect((await list(student, '?q=zzvis')).meta.totalItems).toBe(2)
      } finally {
        await t.db.query('update questions set is_active = false where id = any($1::bigint[])', [[ok, flagged]])
      }
    })

    it('a set with a picture stimulus without its file, or a legacy_image_unresolved import hold, is not listed and not counted; fixing both lists them', async () => {
      const ok = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'zzvis ok' })
      const noFile = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'zzvis nofile' })
      const held = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'zzvis held' })
      const sid = (await t.db.query<{ id: string }>(`insert into stimuli (kind, label) values ('diagram', 'Rajah zzvis') returning id::text id`))[0]?.id as string
      try {
        await t.db.query('insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1, $2, 1)', [await liveVersion(noFile), sid])
        await t.db.query(`update question_versions set import_issues = '[{"code": "legacy_image_unresolved"}]'::jsonb where id = $1`, [await liveVersion(held)])
        const out = await list(student, '?q=zzvis')
        expect(out.data.map((c) => c.id)).toEqual([ok])
        expect(out.meta.totalItems).toBe(1)
        await t.db.query(`update stimuli set kind = 'passage', body_ms = 'Petikan zzvis' where id = $1`, [sid])
        await t.db.query(`update question_versions set import_issues = null where id = $1`, [await liveVersion(held)])
        expect((await list(student, '?q=zzvis')).meta.totalItems).toBe(3)
      } finally {
        await t.db.query('update questions set is_active = false where id = any($1::bigint[])', [[ok, noFile, held]])
        await t.db.query('delete from question_version_stimuli where stimulus_id = $1', [sid])
        await t.db.query('delete from stimuli where id = $1', [sid])
      }
    })

    it('REQ-B-076: a set whose source paper is taken down is not listed and not counted; lifting the takedown lists it again', async () => {
      const ok = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'zzvis ok' })
      const taken = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'zzvis taken' })
      const src = (await t.db.query<{ id: string }>(`insert into source_papers (rights_status) values ('own') returning id::text id`))[0]?.id as string
      try {
        await t.db.query('update question_versions set source_paper_id = $1 where id = $2', [src, await liveVersion(taken)])
        expect((await list(student, '?q=zzvis')).meta.totalItems).toBe(2)
        await t.db.query('update source_papers set takedown_at = now() where id = $1', [src])
        const out = await list(student, '?q=zzvis')
        expect(out.data.map((c) => c.id)).toEqual([ok])
        expect(out.meta.totalItems).toBe(1)
        await t.db.query('update source_papers set takedown_at = null where id = $1', [src])
        expect((await list(student, '?q=zzvis')).meta.totalItems).toBe(2)
      } finally {
        await t.db.query('update questions set is_active = false where id = any($1::bigint[])', [[ok, taken]])
        await t.db.query('update question_versions set source_paper_id = null where id = $1', [await liveVersion(taken)])
        await t.db.query('delete from source_papers where id = $1', [src])
      }
    })

    it('a PKSK set (pksk_domain tag, M07 only) is not listed and not counted', async () => {
      const ok = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'zzvis ok' })
      const pksk = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'zzvis pksk' })
      try {
        await t.db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pksk_domain', 'zzvis')`, [pksk])
        const out = await list(student, '?q=zzvis')
        expect(out.data.map((c) => c.id)).toEqual([ok])
        expect(out.meta.totalItems).toBe(1)
      } finally {
        await t.db.query('update questions set is_active = false where id = any($1::bigint[])', [[ok, pksk]])
        await t.db.query(`delete from question_tags where question_id = $1 and kind = 'pksk_domain'`, [pksk])
      }
    })

    it('LEARNER_LEVEL: a set of an inactive level the pupil holds is not listed and not counted; active again lists it', async () => {
      const ok = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'zzvis ok' })
      const other = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'zzvis level' })
      const lvl = await liveVersion(other)
      const t4 = (await t.db.query<{ id: string }>(`select id::text id from education_levels where code = 'T4'`))[0]?.id as string
      const t5row = (await t.db.query<{ id: string; stage: string; is_active: boolean }>(`select id::text id, stage, is_active from education_levels where code = 'T5'`))[0] as { id: string; stage: string; is_active: boolean }
      const t5 = t5row.id
      try {
        await t.db.query('update question_versions set education_level_id = $1 where id = $2', [t5, lvl])
        expect((await list(student, '?q=zzvis')).meta.totalItems).toBe(2)
        await t.db.query('update education_levels set is_active = false where id = $1', [t5])
        const out = await list(student, '?q=zzvis')
        expect(out.data.map((c) => c.id)).toEqual([ok])
        expect(out.meta.totalItems).toBe(1)
        // (An active primary-stage level cannot exist: ck_education_levels_no_active_primary, so inactive is the reachable case.)
        await t.db.query('update education_levels set is_active = $2 where id = $1', [t5, t5row.is_active])
        expect((await list(student, '?q=zzvis')).meta.totalItems).toBe(2)
      } finally {
        await t.db.query(`update education_levels set is_active = $2, stage = $3 where id = $1`, [t5, t5row.is_active, t5row.stage])
        await t.db.query('update questions set is_active = false where id = any($1::bigint[])', [[ok, other]])
        await t.db.query('update question_versions set education_level_id = $1 where id = $2', [t4, lvl])
      }
    })
  })

  it('author and school: a teacher creator shows name and school, any other creator "Guru Pakar"', async () => {
    const teacherId = await userIdOf(t.db, 'guru@demo.test')
    const teacher = (await t.db.query<{ name: string; school: string | null }>(
      `select u.name, s.name as school from users u left join schools s on s.id = u.school_id where u.id = $1`,
      [teacherId],
    ))[0]
    expect(teacher?.school).not.toBeNull()
    await t.db.query('update questions set created_by_id = $1 where id = $2', [teacherId, ecf])
    const out = await list(student)
    expect(out.data.find((c) => c.id === ecf)).toMatchObject({ author: teacher?.name, school: teacher?.school })
    expect(out.data.find((c) => c.id === tree)).toMatchObject({ author: 'Guru Pakar', school: null })
  })
})

describe('AC1 GET /api/practice/structured/:id', () => {
  it('returns the stimulus and the sub-questions with marks, and no key or model answer', async () => {
    const res = await student.get(`/api/practice/structured/${tree}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const d = Detail.parse(res.body).data
    expect(d).toMatchObject({
      id: tree,
      subjectName: 'Matematik',
      levelName: 'Tingkatan 4',
      stimulus: 'Diberi fungsi kuadratik f(x) = x² − 4x + 3.',
      stimulusImage: null,
      backUrl: '/latihan-berstruktur',
    })
    expect(d.subQuestions.map((s) => [s.label, s.marks])).toEqual([
      ['(a)', 0],
      ['(a).(i)', 0],
      ['(a).(i).(A)', 1],
      ['(a).(i).(B)', 1],
      ['(a).(ii)', 3],
      ['(b)', 2],
    ])
    expect(d.subQuestions[2]?.id).toBe(`${tree}-(a).(i).(A)`)
    expect(JSON.stringify(res.body)).not.toMatch(/modelAnswer|"key"|accept|y = 3/)
  })

  it('backUrl follows scope and track (FR-M05-137)', async () => {
    const math = await subjectIdOf(t.db, 'MATH')
    const backUrl = async (q: string) => Detail.parse((await student.get(`/api/practice/structured/${tree}${q}`)).body).data.backUrl
    expect(await backUrl('?scope=spm')).toBe(`/latihan-berstruktur?subject_id=${math}&scope=spm`)
    expect(await backUrl('?scope=spm&track=bahasa')).toBe(`/latihan-berstruktur?subject_id=${math}&scope=spm&track=bahasa`)
    expect(await backUrl('?track=bahasa')).toBe('/latihan-berstruktur')
    expect(await backUrl('?scope=x')).toBe('/latihan-berstruktur')
  })

  it('is 404 "Rekod tidak dijumpai." for an unknown id, a non-numeric id, an objective question and an inactive set', async () => {
    const mcq = await seededQuestion(t.db, 'SEED-MCQ-MATH-T4')
    for (const id of ['999999999', 'abc', mcq]) expectError(await student.get(`/api/practice/structured/${id}`), 'NOT_FOUND', 'Rekod tidak dijumpai.')
    await t.db.query('update questions set is_active = false where id = $1', [ecf])
    expectError(await student.get(`/api/practice/structured/${ecf}`), 'NOT_FOUND')
    await t.db.query('update questions set is_active = true where id = $1', [ecf])
    expect((await student.get(`/api/practice/structured/${ecf}`)).status).toBe(200)
  })
})

describe('AC7 POST /api/practice/structured/:id/attempts', () => {
  const subs = (id: string) => [`${id}-(a).(i).(A)`, `${id}-(a).(i).(B)`, `${id}-(a).(ii)`, `${id}-(b)`]
  const post = (c: Client, body: unknown, id = tree) => c.post(`/api/practice/structured/${id}/attempts`, body)
  const resultOf = async (c: Client, attemptId: string) => {
    const res = await c.get(`/api/bijak/attempts/${attemptId}/result`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return BijakAttemptResultViewSchema.parse(res.body.data)
  }

  it('S5-T11 grades with the one grader: auto parts by their key, the shape plus attemptId, the model answers', async () => {
    const [a, b, c, d] = subs(tree) as [string, string, string, string]
    const res = await post(student, {
      answers: [
        { subQuestionId: a, text: '3' },
        { subQuestionId: b, text: 'tidak tahu' },
        { subQuestionId: c, text: '(x-1)(x-3) x = 1 x = 3' },
        { subQuestionId: d, text: '-1' },
      ],
      scope: 'spm',
      track: null,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const out = Attempt.parse(res.body).data
    expect(out).toMatchObject({ userId: student.userId, structuredQuestionId: tree, scope: 'spm', track: null })
    expect(out.attemptId).toBe(out.id)
    expect(out.submittedAt).toBe(toMytTimestamp(t.clock.now()))
    const byId = new Map(out.marks.map((m) => [m.subQuestionId, m]))
    // (A) numeric 3 = key; (B) short_text wrong; (b) numeric -1 = key: the grader's mark, not a length rule.
    expect(byId.get(a)).toEqual({ subQuestionId: a, awarded: 1, max: 1 })
    expect(byId.get(b)).toEqual({ subQuestionId: b, awarded: 0, max: 1 })
    expect(byId.get(d)).toEqual({ subQuestionId: d, awarded: 2, max: 2 })
    expect(byId.get(c)?.max).toBe(3)
    // One mark entry per sub-question of the set, branches included (max 0), in the detail order.
    const detail = Detail.parse((await student.get(`/api/practice/structured/${tree}`)).body).data
    expect(out.marks.map((m) => m.subQuestionId)).toEqual(detail.subQuestions.map((s) => s.id))
    expect(out.totalMax).toBe(7)
    expect(out.totalAwarded).toBe(out.marks.reduce((n, m) => n + m.awarded, 0))
    expect(out.modelAnswers.map((m) => m.subQuestionId)).toEqual(detail.subQuestions.map((s) => s.id))
    expect(out.modelAnswers.find((m) => m.subQuestionId === a)?.text).toBe('3')
    expect(out.answers).toEqual([
      { subQuestionId: a, text: '3' },
      { subQuestionId: b, text: 'tidak tahu' },
      { subQuestionId: c, text: '(x-1)(x-3) x = 1 x = 3' },
      { subQuestionId: d, text: '-1' },
    ])
    // The stored result is the grader's: the same marks as the response.
    const view = await resultOf(student, out.attemptId)
    expect(view.result.score).toBe(out.totalAwarded)
    expect(view.result.max).toBe(out.totalMax)
  })

  it('S5-T11 the row: paper_kind structured, no paper, latihan, untimed, closed, one section holding the question pinned to its version', async () => {
    const c = await loginAs(t, 'student2')
    const legacyBefore = (await attemptRows(c.userId)).length
    const out = Attempt.parse((await post(c, { answers: [{ subQuestionId: subs(tree)[3], text: '-1' }] })).body).data
    const row = (await examRows(c.userId)).find((r) => r.id === out.attemptId)
    expect(row).toMatchObject({ paper_id: null, paper_kind: 'structured', mode: 'latihan', status: 'submitted', duration_min: 0, deadline_at: null, is_test: false, subject: 'MAT' })
    expect(row?.submitted_at).not.toBeNull()
    expect(row?.title).toBe('Diberi fungsi kuadratik f(x) = x² − 4x + 3.')
    expect(row?.composition).toHaveLength(1)
    expect(row?.composition[0]).toMatchObject({ rule: { type: 'all' }, questionIds: [tree], versions: { [tree]: 1 } })
    const answers = await t.db.query<{ part_id: string; answer: unknown }>('select part_id, answer from attempt_answers where attempt_id = $1', [out.attemptId])
    expect(answers).toEqual([{ part_id: `${tree}.b`, answer: { final: '-1' } }])
    // Ruling R1: nothing is written to structured_attempts any more.
    expect(await attemptRows(c.userId)).toHaveLength(legacyBefore)
  })

  it('S5-T11 a part the grader cannot mark is belum_dimarkah and provisional (0 until the pupil marks it); an auto part is not', async () => {
    const id = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Set bahagian belum dimarkah' })
    try {
      const c = await loginAs(t, 'student2')
      // (a) is the key: marked now. (b) is a wrong answer of several words: the grader cannot tell it from an unreadable one, so a person decides.
      const out = Attempt.parse((await post(c, { answers: [{ subQuestionId: `${id}-(a)`, text: 'jawapan (a)' }, { subQuestionId: `${id}-(b)`, text: 'jawapan yang salah sekali' }] }, id)).body).data
      expect(out.marks).toEqual([
        { subQuestionId: `${id}-(a)`, awarded: 2, max: 2 },
        { subQuestionId: `${id}-(b)`, awarded: 0, max: 3 },
      ])
      expect([out.totalAwarded, out.totalMax]).toEqual([2, 5])
      const view = await resultOf(c, out.attemptId)
      expect(view.result).toMatchObject({ provisional: true, pendingReview: 1, score: 2, max: 5 })
      const parts = view.result.questions[0]?.parts ?? []
      expect(parts.map((p) => [p.status, p.awarded, p.marks])).toEqual([['betul', 2, 2], ['belum_dimarkah', 0, 3]])
      const stored = await t.db.query<{ provisional: boolean; pending_review: number }>('select provisional, pending_review from attempt_results where attempt_id = $1', [out.attemptId])
      expect(stored).toEqual([{ provisional: true, pending_review: 1 }])
    } finally {
      await t.db.query('update questions set is_active = false where id = $1', [id])
    }
  })

  it('S5-T11 self-mark (API-BIJAK-05) works on the attempt unchanged: a pending part takes the pupil mark, an auto part is 409', async () => {
    const id = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Set semak kendiri' })
    try {
      const c = await loginAs(t, 'student2')
      const made = Attempt.parse((await post(c, { answers: [{ subQuestionId: `${id}-(a)`, text: 'jawapan (a)' }, { subQuestionId: `${id}-(b)`, text: 'jawapan yang salah sekali' }] }, id)).body).data
      const [auto, pending] = (await resultOf(c, made.attemptId)).result.questions[0]?.parts.map((p) => p.partId) as [string, string]
      const url = `/api/bijak/attempts/${made.attemptId}/self-mark`
      const mark = await c.post(url, { partId: pending, mark: 2 })
      expect(mark.status, JSON.stringify(mark.body)).toBe(200)
      expect(BijakAttemptSelfMarkResultSchema.parse(mark.body.data)).toMatchObject({ partId: pending, awarded: 2, max: 3, attemptScore: 4, attemptMax: 5, provisional: false, pendingReview: 0 })
      // the list takes the self-marked total as the best
      expect((await list(c, '?q=semak+kendiri')).data.find((x) => x.id === id)?.bestScore).toEqual({ awarded: 4, max: 5 })
      // an automatically marked part answers 409
      expectError(await c.post(url, { partId: auto, mark: 1 }), 'CONFLICT')
      // someone else's attempt is 403
      expect((await student.post(url, { partId: pending, mark: 1 })).status).toBe(403)
    } finally {
      await t.db.query('update questions set is_active = false where id = $1', [id])
    }
  })

  it('S5-T11 a visible set the bridge refuses (two sibling parts share an id) is 422 "Tiada soalan layak untuk kertas ini." and nothing is stored', async () => {
    const bad = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Set label berlanggar' })
    try {
      // Publishing refuses such a set, so the clash is made after it: "(b)" is renamed "a", which collides with "(a)" once the bridge strips the brackets.
      await t.db.query(
        `update question_parts set label = 'a' where label = '(b)' and question_version_id in (select id from question_versions where question_id = $1)`,
        [bad],
      )
      const c = await loginAs(t, 'teacher')
      // Practice still shows it (getVisible passes) and the detail lists both parts.
      const detail = Detail.parse((await c.get(`/api/practice/structured/${bad}`)).body).data
      expect(detail.subQuestions.map((x) => x.label)).toEqual(['(a)', 'a'])
      const err = expectError(await post(c, { answers: [{ subQuestionId: `${bad}-(a)`, text: 'jawapan (a)' }] }, bad), 'VALIDATION_ERROR')
      expect(err.message).toBe('Tiada soalan layak untuk kertas ini.')
      expect(err.fields).toBeUndefined()
      for (const [table, sql] of [
        ['exam_attempts', `select count(*)::int n from exam_attempts where user_id = $1`],
        ['attempt_answers', `select count(*)::int n from attempt_answers x join exam_attempts a on a.id = x.attempt_id where a.user_id = $1`],
        ['attempt_results', `select count(*)::int n from attempt_results r join exam_attempts a on a.id = r.attempt_id where a.user_id = $1`],
        ['structured_attempts', `select count(*)::int n from structured_attempts where user_id = $1`],
      ] as const) {
        expect((await t.db.query<{ n: number }>(sql, [c.userId]))[0]?.n, table).toBe(0)
      }
    } finally {
      await t.db.query('update questions set is_active = false where id = $1', [bad])
    }
  })

  it('S5-T11 a second submit of the same set is an independent attempt (Cuba Lagi): two ids, two rows, the best score is the max', async () => {
    const id = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Set cuba lagi' })
    try {
      const c = await loginAs(t, 'student2')
      const body = (a: string) => ({ answers: [{ subQuestionId: `${id}-(a)`, text: a }, { subQuestionId: `${id}-(b)`, text: 'jawapan (b)' }] })
      const first = Attempt.parse((await post(c, body('jawapan (a)'), id)).body).data
      const second = Attempt.parse((await post(c, body('salah'), id)).body).data
      expect(second.attemptId).not.toBe(first.attemptId)
      expect([first.totalAwarded, second.totalAwarded]).toEqual([5, 3])
      const rows = await t.db.query<{ id: string }>(`select id::text from exam_attempts where user_id = $1 and paper_kind = 'structured' and composition -> 0 -> 'questionIds' ->> 0 = $2`, [c.userId, id])
      expect(rows.map((r) => r.id).sort()).toEqual([first.attemptId, second.attemptId].sort())
      expect((await list(c, '?q=cuba+lagi')).data.find((x) => x.id === id)?.bestScore).toEqual({ awarded: 5, max: 5 })
    } finally {
      await t.db.query('update questions set is_active = false where id = $1', [id])
    }
  })

  it('S5-T11 the Bijak retry (Cuba Lagi of a paper) on a structured attempt is 409: it has no paper, a pupil retries through this POST', async () => {
    const c = await loginAs(t, 'student2')
    const made = Attempt.parse((await post(c, { answers: [] })).body).data
    expectError(await c.post(`/api/bijak/attempts/${made.attemptId}/retry`, {}), 'CONFLICT')
  })

  it('S5-T11 one transaction: a failure while saving the result leaves no attempt, no answers and no result', async () => {
    const id = await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: 'Set atomik' })
    const spy = vi.spyOn(t.app.get(AttemptsRepository), 'saveResult').mockRejectedValueOnce(new Error('boom'))
    try {
      const c = await loginAs(t, 'student2')
      const res = await post(c, { answers: [{ subQuestionId: `${id}-(a)`, text: 'jawapan (a)' }] }, id)
      expect(res.status).toBe(500)
      const n = await t.db.query<{ n: number }>(
        `select count(*)::int n from exam_attempts where user_id = $1 and composition -> 0 -> 'questionIds' ->> 0 = $2`,
        [c.userId, id],
      )
      expect(n[0]?.n).toBe(0)
      const stray = await t.db.query<{ n: number }>(`select count(*)::int n from attempt_answers x where not exists (select 1 from exam_attempts a where a.id = x.attempt_id)`)
      expect(stray[0]?.n).toBe(0)
    } finally {
      spy.mockRestore()
      await t.db.query('update questions set is_active = false where id = $1', [id])
    }
  })

  it('stores scope spm + track bahasa; missing answers score 0; scope and track default to null; each call is a new attempt', async () => {
    const c = await loginAs(t, 'student2')
    const before = { exam: (await examRows(c.userId)).length, legacy: (await attemptRows(c.userId)).length }
    const r1 = Attempt.parse((await post(c, { answers: [], scope: 'spm', track: 'bahasa' })).body).data
    expect(r1).toMatchObject({ scope: 'spm', track: 'bahasa', totalAwarded: 0, totalMax: 7, answers: [] })
    const r2 = Attempt.parse((await post(c, { answers: [] })).body).data
    expect(r2).toMatchObject({ scope: null, track: null })
    expect(r2.id).not.toBe(r1.id)
    expect(await examRows(c.userId)).toHaveLength(before.exam + 2)
    expect(await attemptRows(c.userId)).toHaveLength(before.legacy)
  })

  it('is 422 VALIDATION_ERROR for a malformed body, and nothing is stored', async () => {
    const c = await loginAs(t, 'teacher')
    const sub = subs(tree)[0] as string
    const cases: [string, unknown, string][] = [
      ['no answers', {}, 'answers'],
      ['answers not an array', { answers: 'x' }, 'answers'],
      ['unknown sub-question', { answers: [{ subQuestionId: 'nope', text: 'abc' }] }, 'answers.0'],
      ['sub-question of another set', { answers: [{ subQuestionId: subs(ecf)[0], text: 'abc' }] }, 'answers.0'],
      ['text not a string', { answers: [{ subQuestionId: sub, text: 5 }] }, 'answers.0'],
      ['id not a string', { answers: [{ subQuestionId: 5, text: 'a' }] }, 'answers.0'],
      ['entry not an object', { answers: ['x'] }, 'answers.0'],
      ['duplicate sub-question', { answers: [{ subQuestionId: sub, text: 'a' }, { subQuestionId: sub, text: 'b' }] }, 'answers.1'],
      ['too long', { answers: [{ subQuestionId: sub, text: 'x'.repeat(5001) }] }, 'answers.0'],
      ['unknown scope', { answers: [], scope: 'x' }, 'scope'],
      ['track without scope', { answers: [], track: 'bahasa' }, 'track'],
      ['unknown track', { answers: [], scope: 'spm', track: 'x' }, 'track'],
    ]
    for (const [name, body, field] of cases) {
      const err = expectError(await post(c, body), 'VALIDATION_ERROR')
      expect(Object.keys(err.fields ?? {}), name).toEqual([field])
    }
    expect(expectError(await post(c, { answers: [{ subQuestionId: sub, text: 'x'.repeat(5001) }] }), 'VALIDATION_ERROR').message).toBe('Jawapan tidak boleh melebihi 5000 aksara.')
    expect(expectError(await post(c, { answers: 'x' }), 'VALIDATION_ERROR').message).toBe('Jawapan tidak sah.')
    expect(expectError(await post(c, { answers: [], scope: 'x' }), 'VALIDATION_ERROR').message).toBe('Skop tidak sah.')
    expect(await examRows(c.userId)).toHaveLength(0)
    expect(await attemptRows(c.userId)).toHaveLength(0)
  })

  it('is 404 for an unknown, non-numeric, objective or inactive set', async () => {
    const c = await loginAs(t, 'teacher')
    const mcq = await seededQuestion(t.db, 'SEED-MCQ-MATH-T4')
    for (const id of ['999999999', 'abc', mcq]) expectError(await post(c, { answers: [] }, id), 'NOT_FOUND')
    await t.db.query('update questions set is_active = false where id = $1', [anyn])
    expectError(await post(c, { answers: [] }, anyn), 'NOT_FOUND')
    await t.db.query('update questions set is_active = true where id = $1', [anyn])
    expect(await examRows(c.userId)).toHaveLength(0)
  })

  it('AC4: attempts are the caller own; the body cannot name another user', async () => {
    const a = await loginAs(t, 'student')
    const b = await loginAs(t, 'student2')
    const before = (await examRows(b.userId)).length
    const out = Attempt.parse((await post(a, { answers: [], userId: b.userId })).body).data
    expect(out.userId).toBe(a.userId)
    expect(await examRows(b.userId)).toHaveLength(before)
    expect((await examRows(a.userId)).some((r) => r.id === out.attemptId)).toBe(true)
  })

  it('AC9: without the CSRF token it is 403 CSRF_INVALID and nothing is stored', async () => {
    const c = await loginAs(t, 'teacher')
    expectCsrfInvalid(await c.noCsrf.post(`/api/practice/structured/${tree}/attempts`, { answers: [] }))
    expect(await examRows(c.userId)).toHaveLength(0)
  })

  it('an attempt made in Mod Pelajar is stored with is_test, and still returned to its owner', async () => {
    const pelajar = await loginModPelajar(t, 'admin@demo.test')
    const out = Attempt.parse((await post(pelajar, { answers: [] })).body).data
    const rows = await examRows(pelajar.userId)
    expect(rows.map((r) => [r.id, r.is_test])).toEqual([[out.attemptId, true]])
    // No other user's attempt is flagged.
    const others = await t.db.query<{ n: string }>(`select count(*)::text n from exam_attempts where paper_kind = 'structured' and user_id <> $1 and is_test`, [pelajar.userId])
    expect(others[0]?.n).toBe('0')
  })

  it('a new live version is the version recorded; sub-question ids stay addressable while labels stay', async () => {
    const id = await publishStructured(t, 'SEED-MCQ-SCI-T4', { stem: 'Versi', parts: [{ label: '(a)', prompt: { ms: 'Bahagian' }, children: [leaf('(i)', 2)] }] as never })
    const c = await loginAs(t, 'student2')
    const out = Attempt.parse((await post(c, { answers: [{ subQuestionId: `${id}-(a).(i)`, text: 'jawapan (i)' }] }, id)).body).data
    expect(out).toMatchObject({ totalAwarded: 2, totalMax: 2 })
    const row = (await examRows(c.userId)).find((r) => r.id === out.attemptId)
    expect(row?.composition[0]?.versions).toEqual({ [id]: 1 })
  })
})

describe('AC9 rate limit', () => {
  it('the attempt POST is limited per user: the 3rd is 429 RATE_LIMITED with Retry-After; another user and the reads are unaffected', async () => {
    const limited = await bootWritesApp({ env: { THROTTLE_STRUCTURED_ATTEMPT_PER_MINUTE: '2' } })
    try {
      const id = await seededQuestion(limited.db, 'SEED-STR-ECF')
      const a = await loginAs(limited, 'student')
      const b = await loginAs(limited, 'student2')
      const url = `/api/practice/structured/${id}/attempts`
      expect((await a.noCsrf.post(url, { answers: [] })).status).toBe(403) // a refused request does not count
      expect((await a.post(url, { answers: [] })).status).toBe(201)
      expect((await a.post(url, { answers: 'x' })).status).toBe(422) // a refused body counts: the limit sits before validation
      const res = await a.post(url, { answers: [] })
      const err = expectError(res, 'RATE_LIMITED')
      expect(typeof err.retryAfter).toBe('number')
      expect(res.headers['retry-after']).toBe(String(err.retryAfter))
      expect((await a.get('/api/practice/structured')).status).toBe(200)
      expect((await b.post(url, { answers: [] })).status).toBe(201)
      limited.clock.advance(61_000)
      expect((await a.post(url, { answers: [] })).status).toBe(201)
    } finally {
      await limited.close()
    }
  }, 120_000)
})

describe('table constraints (migration 0022)', () => {
  it('has the scope/track checks, the totals check and the legacy unique pair', async () => {
    const uid = await userIdOf(t.db, 'guru@demo.test')
    const base = `insert into structured_attempts (user_id, question_id, question_version_no, scope, track, total_awarded, total_max, submitted_at, legacy_source, legacy_id) values ($1, $2, 1, $3, $4, $5, $6, now(), $7, $8)`
    await expect(t.db.query(base, [uid, tree, 'x', null, 0, 1, null, null])).rejects.toThrow(/ck_structured_attempts_scope/)
    await expect(t.db.query(base, [uid, tree, null, 'bahasa', 0, 1, null, null])).rejects.toThrow(/ck_structured_attempts_track/)
    await expect(t.db.query(base, [uid, tree, 'spm', null, 3, 2, null, null])).rejects.toThrow(/ck_structured_attempts_totals/)
    await t.db.query(base, [uid, tree, 'spm', 'bahasa', 1, 2, 'cloud', 'sa1'])
    await expect(t.db.query(base, [uid, tree, null, null, 0, 0, 'cloud', 'sa1'])).rejects.toThrow(/uq_structured_attempts_legacy/)
    await t.db.query('delete from structured_attempts where user_id = $1', [uid])
  })
})
