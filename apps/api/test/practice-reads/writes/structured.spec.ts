import {
  PracticeReadStructuredAttemptResultSchema,
  PracticeReadStructuredDetailSchema,
  PracticeReadStructuredListResponseSchema,
  envelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { toMytTimestamp } from '../../../src/common/time/myt'
import { QuestionsRepository } from '../../../src/modules/questions'
import { MARK_MIN_CHARS, markStructured } from '../../../src/modules/practice/reads/writes/rules'
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
    expect(out.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 3, totalPages: 1, from: 1, to: 3, scope: null, track: null })
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

  it('orders newest first (then id) and pages 20 at a time; a page past the end is empty and keeps the number', async () => {
    const made: string[] = []
    for (let i = 0; i < 20; i++) {
      t.clock.advance(1000)
      made.push(await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: `Set susulan ${String(i)}` }))
    }
    const p1 = await list(student)
    expect(p1.data).toHaveLength(20)
    expect(p1.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 23, totalPages: 2, from: 1, to: 20 })
    expect(p1.data.map((c) => c.id)).toEqual([...made].reverse())
    const p2 = await list(student, '?page=2')
    expect(p2.data.map((c) => c.id).sort()).toEqual([tree, ecf, anyn].sort())
    expect(p2.meta).toMatchObject({ page: 2, from: 21, to: 23 })
    const past = await list(student, '?page=9')
    expect(past.data).toEqual([])
    expect(past.meta).toMatchObject({ page: 9, from: null, to: null, totalItems: 23 })
    // An invalid page is page 1.
    expect((await list(student, '?page=abc')).meta.page).toBe(1)
    expect((await list(student, '?page=0')).meta.page).toBe(1)
    await t.db.query('update questions set is_active = false where id = any($1::bigint[])', [made])
  })

  it('hydrates only the page slice: 23 sets, page 1 asks the bank for 20 ids, page 2 for 3, and the total stays 23', async () => {
    const made: string[] = []
    for (let i = 0; i < 20; i++) {
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
      expect(sizes).toEqual([20, 3])
      expect(p1.meta.totalItems).toBe(23)
      expect(p2.meta.totalItems).toBe(23)
    } finally {
      repo.getMany = original
      await t.db.query('update questions set is_active = false where id = any($1::bigint[])', [made])
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
    await t.db.query(`update question_versions set status = 'published', archive_reason = null where question_id = $1`, [anyn])
    expect((await list(student)).data.map((c) => c.id)).toContain(anyn)
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
  const long = 'Jawapan yang cukup panjang untuk markah penuh.'
  const subs = (id: string) => [`${id}-(a).(i).(A)`, `${id}-(a).(i).(B)`, `${id}-(a).(ii)`, `${id}-(b)`]
  const post = (c: Client, body: unknown, id = tree) => c.post(`/api/practice/structured/${id}/attempts`, body)

  it('marks per sub-question with the placeholder rule, stores the attempt and returns the model answers', async () => {
    const [a, b, c, d] = subs(tree) as [string, string, string, string]
    const res = await post(student, {
      answers: [
        { subQuestionId: a, text: long },
        { subQuestionId: b, text: 'terlalu pendek' },
        { subQuestionId: c, text: 'x'.repeat(MARK_MIN_CHARS) },
        { subQuestionId: d, text: `   ${'y'.repeat(MARK_MIN_CHARS - 1)}   ` },
      ],
      scope: 'spm',
      track: null,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const out = Attempt.parse(res.body).data
    expect(out).toMatchObject({ userId: student.userId, structuredQuestionId: tree, scope: 'spm', track: null, totalAwarded: 1 + 3, totalMax: 7 })
    expect(out.submittedAt).toBe(toMytTimestamp(t.clock.now()))
    const byId = new Map(out.marks.map((m) => [m.subQuestionId, m]))
    expect(byId.get(a)).toEqual({ subQuestionId: a, awarded: 1, max: 1 })
    expect(byId.get(b)).toEqual({ subQuestionId: b, awarded: 0, max: 1 })
    expect(byId.get(c)).toEqual({ subQuestionId: c, awarded: 3, max: 3 })
    expect(byId.get(d)).toEqual({ subQuestionId: d, awarded: 0, max: 2 })
    // One mark entry per sub-question of the set, branches included (max 0), in the detail order.
    const detail = Detail.parse((await student.get(`/api/practice/structured/${tree}`)).body).data
    expect(out.marks.map((m) => m.subQuestionId)).toEqual(detail.subQuestions.map((s) => s.id))
    expect(out.totalMax).toBe(out.marks.reduce((n, m) => n + m.max, 0))
    expect(out.modelAnswers.map((m) => m.subQuestionId)).toEqual(detail.subQuestions.map((s) => s.id))
    expect(out.modelAnswers.find((m) => m.subQuestionId === a)?.text).toBe('3')
    expect(out.modelAnswers.find((m) => m.subQuestionId === d)?.text).toBe('-1')
    expect(out.answers).toEqual([
      { subQuestionId: a, text: long },
      { subQuestionId: b, text: 'terlalu pendek' },
      { subQuestionId: c, text: 'x'.repeat(MARK_MIN_CHARS) },
      { subQuestionId: d, text: `   ${'y'.repeat(MARK_MIN_CHARS - 1)}   ` },
    ])
    // The row: question id + live version number, own user, scope, not a test row.
    const row = (await attemptRows(student.userId)).find((r) => r.id === out.id)
    expect(row).toMatchObject({ question_id: tree, question_version_no: 1, scope: 'spm', track: null, total_awarded: 4, total_max: 7, is_test: false })
    expect(row?.marks).toEqual(out.marks)
  })

  it('stores scope spm + track bahasa; missing answers score 0; scope and track default to null; each call stores a new row', async () => {
    const c = await loginAs(t, 'student2')
    const r1 = Attempt.parse((await post(c, { answers: [], scope: 'spm', track: 'bahasa' })).body).data
    expect(r1).toMatchObject({ scope: 'spm', track: 'bahasa', totalAwarded: 0, totalMax: 7, answers: [] })
    const r2 = Attempt.parse((await post(c, { answers: [] })).body).data
    expect(r2).toMatchObject({ scope: null, track: null })
    expect(r2.id).not.toBe(r1.id)
    expect(await attemptRows(c.userId)).toHaveLength(2)
  })

  it('the pure rule gives full marks from 20 characters (trimmed), else 0', () => {
    const got = markStructured(
      [{ id: 'a', marks: 2 }, { id: 'b', marks: 3 }, { id: 'c', marks: 0 }],
      new Map([['a', 'x'.repeat(20)], ['b', ` ${'x'.repeat(19)} `]]),
    )
    expect(got).toEqual([
      { subQuestionId: 'a', awarded: 2, max: 2 },
      { subQuestionId: 'b', awarded: 0, max: 3 },
      { subQuestionId: 'c', awarded: 0, max: 0 },
    ])
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
    expect(await attemptRows(c.userId)).toHaveLength(0)
  })

  it('is 404 for an unknown, non-numeric, objective or inactive set', async () => {
    const c = await loginAs(t, 'teacher')
    const mcq = await seededQuestion(t.db, 'SEED-MCQ-MATH-T4')
    for (const id of ['999999999', 'abc', mcq]) expectError(await post(c, { answers: [] }, id), 'NOT_FOUND')
    await t.db.query('update questions set is_active = false where id = $1', [anyn])
    expectError(await post(c, { answers: [] }, anyn), 'NOT_FOUND')
    await t.db.query('update questions set is_active = true where id = $1', [anyn])
    expect(await attemptRows(c.userId)).toHaveLength(0)
  })

  it('AC4: attempts are the caller own; the body cannot name another user', async () => {
    const a = await loginAs(t, 'student')
    const b = await loginAs(t, 'student2')
    const before = (await attemptRows(b.userId)).length
    const out = Attempt.parse((await post(a, { answers: [], userId: b.userId })).body).data
    expect(out.userId).toBe(a.userId)
    expect(await attemptRows(b.userId)).toHaveLength(before)
    expect((await attemptRows(a.userId)).every((r) => r.id !== undefined)).toBe(true)
  })

  it('AC9: without the CSRF token it is 403 CSRF_INVALID and nothing is stored', async () => {
    const c = await loginAs(t, 'teacher')
    expectCsrfInvalid(await c.noCsrf.post(`/api/practice/structured/${tree}/attempts`, { answers: [] }))
    expect(await attemptRows(c.userId)).toHaveLength(0)
  })

  it('an attempt made in Mod Pelajar is stored with is_test, and still returned to its owner', async () => {
    const pelajar = await loginModPelajar(t, 'admin@demo.test')
    const out = Attempt.parse((await post(pelajar, { answers: [] })).body).data
    const rows = await attemptRows(pelajar.userId)
    expect(rows.map((r) => [r.id, r.is_test])).toEqual([[out.id, true]])
    // No other user's attempt is touched or flagged.
    const others = await t.db.query<{ n: string }>('select count(*)::text n from structured_attempts where user_id <> $1 and is_test', [pelajar.userId])
    expect(others[0]?.n).toBe('0')
  })

  it('a new live version is the version recorded; sub-question ids stay addressable while labels stay', async () => {
    const id = await publishStructured(t, 'SEED-MCQ-SCI-T4', { stem: 'Versi', parts: [{ label: '(a)', prompt: { ms: 'Bahagian' }, children: [leaf('(i)', 2)] }] as never })
    const c = await loginAs(t, 'student2')
    const out = Attempt.parse((await post(c, { answers: [{ subQuestionId: `${id}-(a).(i)`, text: long }] }, id)).body).data
    expect(out).toMatchObject({ totalAwarded: 2, totalMax: 2 })
    expect((await attemptRows(c.userId)).find((r) => r.id === out.id)?.question_version_no).toBe(1)
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
