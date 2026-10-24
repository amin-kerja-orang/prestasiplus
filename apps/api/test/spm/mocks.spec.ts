import {
  SpmMockCreatedSchema,
  SpmMockExamViewSchema,
  SpmMockListItemSchema,
  SpmMockResultSchema,
  type SpmMockExamView,
  type SpmMockResult,
} from '@pp/contract'
import type { Response } from 'supertest'
import { z } from 'zod'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { fnv1a32, mulberry32 } from '../../src/db/prng'
import {
  addPool,
  addQuestion,
  bootSpmApp,
  countRows,
  expectError,
  keyPaths,
  loginAs,
  loginModPelajar,
  parseData,
  type Client,
  type SpmTestApp,
} from './helpers'

let t: SpmTestApp
let student: Client
let student2: Client

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SECRET = /^(modelAnswer|studentAnswer|marks|feedback|topic|questionId)$/
/** Tables a mock must never touch (practice, mastery, revision queue, wallet). */
const OTHER_TABLES = ['practice_sessions', 'practice_answers', 'practice_checks', 'revision_queue', 'mastery', 'subject_usage', 'practice_attempt_aggregates', 'coin_ledger', 'streaks']

beforeAll(async () => {
  t = await bootSpmApp()
  await t.db.query('delete from questions')
  await t.db.query('delete from spm_tracking_sets')
  // MATH: 45 pool questions over three chapters (topics), 8 structured; SEJ: only 3 pool questions; the rest: none.
  for (const ch of [1, 2, 3]) await addPool(t.db, 'MATH', 15, { level: 'D1', chapterNumber: ch })
  for (let i = 0; i < 8; i++) await addQuestion(t.db, { subject: 'MATH', type: 'structured', pool: false })
  await addQuestion(t.db, { subject: 'MATH', type: 'structured', pool: false, status: 'draft' })
  await addPool(t.db, 'SEJ', 3)
  student = await loginAs(t, 'student')
  student2 = await loginAs(t, 'student2')
}, 240_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  t.clock.set('2026-10-19T09:00:00+08:00')
})

/** A module error: exact status, code and message (the code is not a generic one). */
function expectModuleError(res: Response, status: number, code: string, message: string): void {
  expect(res.status, JSON.stringify(res.body)).toBe(status)
  expect(res.body.error.code).toBe(code)
  expect(res.body.error.message).toBe(message)
}

const create = async (c: Client, subject: string, paperNumber?: unknown) => {
  const res = await c.post('/api/spm-mocks', paperNumber === undefined ? { subject } : { subject, paperNumber })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return parseData(res, SpmMockCreatedSchema).id
}
const view = async (c: Client, id: string) => parseData(await c.get(`/api/spm-mocks/${id}`), SpmMockExamViewSchema)
const keysOf = async (id: string) => await t.db.query<{ item_no: number; model_answer: string; topic: string; question_id: string }>('select item_no, model_answer, topic, question_id::text from spm_mock_exam_items where mock_exam_id = $1 order by item_no', [id])
const snapshot = async () => Object.fromEntries(await Promise.all(OTHER_TABLES.map(async (n) => [n, await countRows(t.db, n)] as const)))

describe('AC9 create (M06-09) validation', () => {
  it('a missing, unknown or padded subject is 422 fields.subject "Sila pilih subjek."', async () => {
    for (const body of [{ paperNumber: 1 }, { subject: 'Fizik ', paperNumber: 1 }, { subject: 'Muzik' }, { subject: 5 }, {}]) {
      const e = expectError(await student.post('/api/spm-mocks', body), 'VALIDATION_ERROR')
      expect(e.fields?.subject, JSON.stringify(body)).toBe('Sila pilih subjek.')
      expect(e.message).toBe('Sila pilih subjek.')
    }
  })

  it('a paperNumber other than 1 or 2 is 422 fields.paperNumber "Paper mesti 1 atau 2."; absent, null and "2" are accepted', async () => {
    for (const paperNumber of [3, 0, 'x', 1.5, 'abc']) {
      const e = expectError(await student.post('/api/spm-mocks', { subject: 'Matematik', paperNumber }), 'VALIDATION_ERROR')
      expect(e.fields?.paperNumber).toBe('Paper mesti 1 atau 2.')
    }
    expect(await view(student, await create(student, 'Matematik', null))).toMatchObject({ paperNumber: 1 })
    expect(await view(student, await create(student, 'Matematik', '2'))).toMatchObject({ paperNumber: 2 })
    expect(await view(student, await create(student, 'Matematik'))).toMatchObject({ paperNumber: 1 })
  })

  it('a validation error stores nothing', async () => {
    const before = await countRows(t.db, 'spm_mock_exams')
    await student.post('/api/spm-mocks', { subject: 'Muzik' })
    expect(await countRows(t.db, 'spm_mock_exams')).toBe(before)
  })

  it('a subject with no questions to draw is 422 NOT_ENOUGH_QUESTIONS and stores nothing', async () => {
    const before = await countRows(t.db, 'spm_mock_exams')
    expectModuleError(await student.post('/api/spm-mocks', { subject: 'Kimia' }), 422, 'NOT_ENOUGH_QUESTIONS', 'Soalan tidak mencukupi.')
    expect(await countRows(t.db, 'spm_mock_exams')).toBe(before)
  })
})

describe('AC9 Paper 1: 30 pool items', () => {
  it('draws 30 distinct pool questions with a seeded stream, 1 mark each; the paper has no keys', async () => {
    const before = await snapshot()
    const id = await create(student, 'Matematik', 1)
    expect(id).toMatch(UUID)
    const v = await view(student, id)
    expect(v).toMatchObject({ id, subject: 'Matematik', paperNumber: 1, status: 'in_progress' })
    expect(v.createdAt).toBe('2026-10-19T09:00:00.000+08:00')
    expect(v.items).toHaveLength(30)
    for (const it of v.items) {
      expect(Object.keys(it).sort()).toEqual(['maxMarks', 'no', 'options', 'text'])
      expect(it.options).toHaveLength(4)
      expect(it.maxMarks).toBe(1)
    }
    expect(v.items.map((i) => i.no)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1))
    expect(keyPaths(v, SECRET)).toEqual([])
    const rows = await keysOf(id)
    expect(new Set(rows.map((r) => r.question_id)).size).toBe(30)
    expect((await t.db.query<{ max_score: number }>('select max_score from spm_mock_exams where id = $1', [id]))[0]?.max_score).toBe(30)
    // Same stream, same draw: the seed is the first `int(0, 0xffffffff)` of mulberry32(fnv1a32("m06.mock:<id>")) and the draw is
    // the pool ordered by hashtextextended(id, seed), id (SQL, LIMIT): checked here with an independent query over the whole pool.
    const seed = mulberry32(fnv1a32(`m06.mock:${id}`)).int(0, 0xffffffff)
    const expected = (
      await t.db.query<{ id: string }>(
        `select q.id::text from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no join subjects s on s.id = v.subject_id
          where s.code = 'MATH' and v.type = 'mcq' and q.is_active and v.status = 'published'
            and exists (select 1 from question_tags t where t.question_id = q.id and t.kind = 'pool')
          order by hashtextextended(q.id::text, $1::bigint), q.id limit 30`,
        [seed],
      )
    ).map((r) => r.id)
    expect(expected).toHaveLength(30)
    expect(rows.map((r) => r.question_id)).toEqual(expected)
    expect(
      (await t.db.query<{ n: number }>(`select count(*)::int as n from questions q join question_versions v on v.question_id = q.id join subjects s on s.id = v.subject_id where s.code = 'MATH' and v.type = 'mcq' and q.is_active and v.status = 'published'`))[0]?.n,
    ).toBe(45)
    // Creating a mock writes nothing to practice, mastery, the revision queue or the wallet.
    expect(await snapshot()).toEqual(before)
  })

  it('a later edit of the bank cannot change a mock that was generated (snapshot)', async () => {
    const id = await create(student, 'Matematik', 1)
    const first = await view(student, id)
    const qids = (await keysOf(id)).map((k) => k.question_id)
    await t.db.query(`update question_parts set prompt_ms = 'DIUBAH' where question_version_id in (select id from question_versions where question_id = any($1::bigint[]))`, [qids])
    await t.db.query(`update question_versions set stem_ms = 'DIUBAH' where question_id = any($1::bigint[])`, [qids])
    await t.db.query(`update part_options set body_ms = 'DIUBAH' where part_id in (select p.id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = any($1::bigint[]))`, [qids])
    expect(await view(student, id)).toEqual(first)
    expect(first.items.every((i) => i.text !== 'DIUBAH')).toBe(true)
  })

  it('fewer pool questions than 30 give a shorter paper', async () => {
    const id = await create(student, 'Sejarah')
    const v = await view(student, id)
    expect(v.items).toHaveLength(3)
    const list = parseData(await student.get('/api/spm-mocks'), z.array(SpmMockListItemSchema))
    expect(list.find((m) => m.id === id)?.maxScore).toBe(3)
  })

  it('submit grades the answers: trimmed, case-insensitive letter; blanks are unanswered; the result matches GET result', async () => {
    const before = await snapshot()
    const id = await create(student, 'Matematik', 1)
    const keys = await keysOf(id)
    const wrong = (letter: string) => (letter === 'A' ? 'C' : 'A')
    const answers = keys.map((k) => {
      if (k.item_no <= 12) return { no: k.item_no, answer: k.item_no === 1 ? `  ${k.model_answer.toLowerCase()} ` : k.model_answer }
      if (k.item_no <= 18) return { no: k.item_no, answer: wrong(k.model_answer) }
      return k.item_no % 2 === 0 ? { no: k.item_no, answer: '   ' } : { no: k.item_no }
    })
    const res = await student.post(`/api/spm-mocks/${id}/submit`, { answers })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const r = parseData(res, SpmMockResultSchema)
    expect(r).toMatchObject({ id, subject: 'Matematik', paperNumber: 1, score: 12, maxScore: 30, percent: 40, grade: 'E', heroClass: 'mid' })
    expect(r.items).toHaveLength(30)
    expect(r.items[0]).toMatchObject({ no: 1, studentAnswer: keys[0]?.model_answer.toLowerCase(), marks: 1, maxMarks: 1, feedback: 'Tahniah, jawapan anda betul.' })
    expect(r.items[0]?.modelAnswer).toBe(keys[0]?.model_answer)
    expect(r.items[12]).toMatchObject({ studentAnswer: wrong(keys[12]?.model_answer as string), marks: 0, feedback: `Jawapan yang betul ialah ${keys[12]?.model_answer}.` })
    expect(r.items[20]).toMatchObject({ studentAnswer: null, marks: 0 })
    expect(r.items.filter((i) => i.marks === 1)).toHaveLength(12)
    // Weak topics: the 18 wrong items by chapter, count descending then name.
    expect(r.weakTopics.reduce((n, x) => n + x.wrongCount, 0)).toBe(18)
    const sorted = [...r.weakTopics].sort((a, b) => b.wrongCount - a.wrongCount || a.topic.localeCompare(b.topic, 'ms'))
    expect(r.weakTopics).toEqual(sorted)
    const chapterNames = (await t.db.query<{ name: string }>(`select c.name from chapters c join subjects s on s.id = c.subject_id join education_levels l on l.id = c.education_level_id where s.code = 'MATH' and l.code = 'D1' and c.chapter_number in (1,2,3)`)).map((x) => x.name)
    expect(r.weakTopics.every((x) => chapterNames.includes(x.topic))).toBe(true)

    // The result route returns the same body; the list carries the figures.
    expect(parseData(await student.get(`/api/spm-mocks/${id}/result`), SpmMockResultSchema)).toEqual(r)
    const row = parseData(await student.get('/api/spm-mocks'), z.array(SpmMockListItemSchema)).find((m) => m.id === id)
    expect(row).toMatchObject({ status: 'submitted', score: 12, maxScore: 30, percent: 40, grade: 'E' })
    // The paper can still be opened and still carries no keys.
    expect(keyPaths(await view(student, id), SECRET)).toEqual([])
    // Only the two mock tables were written.
    expect(await snapshot()).toEqual(before)
    const stored = (await t.db.query<{ status: string; grade: string; percent: string; submitted_at: Date | null }>('select status, grade, percent::text, submitted_at from spm_mock_exams where id = $1', [id]))[0]
    expect(stored).toMatchObject({ status: 'submitted', grade: 'E', percent: '40.00' })
    expect(stored?.submitted_at?.toISOString()).toBe('2026-10-19T01:00:00.000Z')
  })

  it('a second submit is 409 CONFLICT "Mock ini sudah dihantar." and changes nothing', async () => {
    const id = await create(student, 'Sejarah')
    const keys = await keysOf(id)
    const body = { answers: keys.map((k) => ({ no: k.item_no, answer: k.model_answer })) }
    expect((await student.post(`/api/spm-mocks/${id}/submit`, body)).status).toBe(200)
    expectError(await student.post(`/api/spm-mocks/${id}/submit`, { answers: [] }), 'CONFLICT', 'Mock ini sudah dihantar.')
    expect(parseData(await student.get(`/api/spm-mocks/${id}/result`), SpmMockResultSchema)).toMatchObject({ score: 3, percent: 100, grade: 'A+', heroClass: 'good', weakTopics: [] })
    // The 409 comes before the body is looked at.
    expectError(await student.post(`/api/spm-mocks/${id}/submit`, { answers: 'x' }), 'CONFLICT')
  })

  it('two submits at once: exactly one wins, the other is 409', async () => {
    const id = await create(student, 'Sejarah')
    const body = { answers: [{ no: 1, answer: 'A' }] }
    const [a, b] = await Promise.all([student.post(`/api/spm-mocks/${id}/submit`, body), student.post(`/api/spm-mocks/${id}/submit`, body)])
    expect([a.status, b.status].sort()).toEqual([200, 409])
  })

  it('a grade of 100 percent: every key right', async () => {
    const id = await create(student, 'Sejarah')
    const keys = await keysOf(id)
    const r = parseData(await student.post(`/api/spm-mocks/${id}/submit`, { answers: keys.map((k) => ({ no: k.item_no, answer: k.model_answer })) }), SpmMockResultSchema)
    expect(r).toMatchObject({ score: 3, maxScore: 3, percent: 100, grade: 'A+' })
  })
})

describe('AC9 Paper 2: 6 structured items of 10 marks', () => {
  it('draws 6 of the visible structured questions; the item is the first leaf prompt with the joined model texts', async () => {
    const before = await snapshot()
    const id = await create(student, 'Matematik', 2)
    const v = await view(student, id)
    expect(v.paperNumber).toBe(2)
    expect(v.items).toHaveLength(6)
    for (const it of v.items) {
      expect(it.maxMarks).toBe(10)
      expect(it.options).toBeUndefined()
      expect(Object.keys(it).sort()).toEqual(['maxMarks', 'no', 'text'])
      expect(it.text).toMatch(/^Bahagian a soalan \d+$/)
    }
    expect(keyPaths(v, SECRET)).toEqual([])
    const drawn = await t.db.query<{ question_id: string; model_answer: string; max_marks: number }>('select question_id::text, model_answer, max_marks from spm_mock_exam_items where mock_exam_id = $1 order by item_no', [id])
    expect(new Set(drawn.map((d) => d.question_id)).size).toBe(6)
    // Only published structured MATH questions: the draft and the MCQs never come.
    const ok = await t.db.query<{ id: string }>(`select q.id::text from questions q join question_versions v on v.question_id = q.id where v.subject_id = (select id from subjects where code = 'MATH') and v.type = 'structured' and v.status = 'published'`)
    expect(drawn.every((d) => ok.some((o) => o.id === d.question_id))).toBe(true)
    expect(drawn[0]?.model_answer).toMatch(/^Model jawapan a \d+\nModel jawapan b \d+$/)
    expect((await t.db.query<{ max_score: number }>('select max_score from spm_mock_exams where id = $1', [id]))[0]?.max_score).toBe(60)
    expect(await snapshot()).toEqual(before)
  })

  it('the simulated marker: 0 for empty, round(10 x min(1, words / 60)); answers are trimmed and cut to 5000 characters', async () => {
    const id = await create(student2, 'Matematik', 2)
    const words = (n: number) => Array(n).fill('isi').join(' ')
    const res = await student2.post(`/api/spm-mocks/${id}/submit`, {
      answers: [{ no: 1, answer: words(60) }, { no: 2, answer: ` ${words(30)} ` }, { no: 3, answer: 'pendek' }, { no: 4, answer: '   ' }, { no: 5, answer: 'x'.repeat(6000) }],
    })
    const r = parseData(res, SpmMockResultSchema)
    expect(r.items.map((i) => i.marks)).toEqual([10, 5, 0, 0, 1, 0].map((n, i) => (i === 4 ? Math.round(10 * Math.min(1, 1 / 60)) : n)))
    expect(r).toMatchObject({ score: 15, maxScore: 60, percent: 25, grade: 'G', heroClass: 'bad' })
    expect(r.items[1]?.feedback).toBe('Jawapan anda merangkumi 5 daripada 10 markah. Rujuk skema.')
    expect(r.items[1]?.studentAnswer).toBe(words(30))
    expect(r.items[4]?.studentAnswer).toHaveLength(5000)
    expect(r.items[3]?.studentAnswer).toBeNull()
    expect(r.items.every((i) => i.options === undefined)).toBe(true)
    expect(r.items[0]?.modelAnswer).toMatch(/^Model jawapan a/)
  })
})

describe('AC11 submit validation and AC12 result state', () => {
  it('answers must be an array of { no: integer within the item count, answer?: string | null } (422 fields.answers)', async () => {
    const id = await create(student, 'Sejarah')
    const url = `/api/spm-mocks/${id}/submit`
    for (const body of [{}, { answers: 'x' }, { answers: [{ no: 99, answer: 'A' }] }, { answers: [{ no: 0 }] }, { answers: [{ no: 1.5 }] }, { answers: [{ no: '1' }] }, { answers: [{ no: 1, answer: 5 }] }, { answers: [null] }]) {
      const e = expectError(await student.post(url, body), 'VALIDATION_ERROR')
      expect(e.fields?.answers, JSON.stringify(body)).toBe('Jawapan tidak sah.')
      expect(e.message).toBe('Jawapan tidak sah.')
    }
    // Nothing was graded.
    expect((await t.db.query<{ status: string }>('select status from spm_mock_exams where id = $1', [id]))[0]?.status).toBe('in_progress')
    expect((await student.post(url, { answers: [] })).status).toBe(200)
  })

  it('the result of an in-progress mock is 409 NOT_SUBMITTED "Mock belum dihantar."', async () => {
    const id = await create(student, 'Sejarah')
    expectModuleError(await student.get(`/api/spm-mocks/${id}/result`), 409, 'NOT_SUBMITTED', 'Mock belum dihantar.')
  })

  it('the list holds only the caller\'s mocks, newest first, with null figures while in progress', async () => {
    const c = await loginAs(t, 'studentMaju')
    expect(parseData(await c.get('/api/spm-mocks'), z.array(SpmMockListItemSchema))).toEqual([])
    t.clock.set('2026-10-19T09:10:00+08:00')
    const a = await create(c, 'Sejarah')
    t.clock.set('2026-10-19T09:20:00+08:00')
    const b = await create(c, 'Matematik', 2)
    const list = parseData(await c.get('/api/spm-mocks'), z.array(SpmMockListItemSchema))
    expect(list.map((m) => m.id)).toEqual([b, a])
    expect(list[0]).toMatchObject({ subject: 'Matematik', paperNumber: 2, status: 'in_progress', score: null, percent: null, grade: null, maxScore: 60, createdAt: '2026-10-19T09:20:00.000+08:00' })
    // Someone else's list never shows them; the response has no meta.
    const othersRes = await student.get('/api/spm-mocks')
    expect(othersRes.status, JSON.stringify(othersRes.body)).toBe(200)
    const others = othersRes.body
    expect(others.meta).toBeUndefined()
    expect(others.data.some((m: { id: string }) => m.id === a || m.id === b)).toBe(false)
  })
})

describe('AC10 ownership', () => {
  it('a mock of another user, an unknown uuid and a non-uuid id are 404 "Not Found." on the paper, the submit and the result', async () => {
    const mine = await create(student, 'Sejarah')
    for (const id of [mine, '11111111-1111-4111-8111-111111111111', 'abc', '0']) {
      const as = id === mine ? student2 : student
      expectError(await as.get(`/api/spm-mocks/${id}`), 'NOT_FOUND', 'Not Found.')
      expectError(await as.post(`/api/spm-mocks/${id}/submit`, { answers: [] }), 'NOT_FOUND', 'Not Found.')
      expectError(await as.get(`/api/spm-mocks/${id}/result`), 'NOT_FOUND', 'Not Found.')
    }
    // The owner's mock is untouched by the foreign attempts.
    expect((await t.db.query<{ status: string }>('select status from spm_mock_exams where id = $1', [mine]))[0]?.status).toBe('in_progress')
  })

  it('the ownership check comes before the validation of the body', async () => {
    const mine = await create(student, 'Sejarah')
    expectError(await student2.post(`/api/spm-mocks/${mine}/submit`, { answers: 'x' }), 'NOT_FOUND', 'Not Found.')
  })

  it('no key reaches the client before submit: the paper and the list carry none', async () => {
    const id = await create(student, 'Matematik', 1)
    expect(keyPaths(await view(student, id), SECRET)).toEqual([])
    expect(keyPaths((await student.get('/api/spm-mocks')).body, SECRET)).toEqual([])
  })
})

describe('Mod Pelajar (G-07)', () => {
  it('a mock created in Mod Pelajar is stamped is_test and shows only in Mod Pelajar', async () => {
    const mod = await loginModPelajar(t, 'admin')
    const plain = await loginAs(t, 'admin')
    const testId = await create(mod, 'Sejarah')
    const realId = await create(plain, 'Sejarah')
    const flags = await t.db.query<{ id: string; is_test: boolean }>('select id::text, is_test from spm_mock_exams where id = any($1::uuid[])', [[testId, realId]])
    expect(flags.find((f) => f.id === testId)?.is_test).toBe(true)
    expect(flags.find((f) => f.id === realId)?.is_test).toBe(false)
    const ids = async (c: Client) => parseData(await c.get('/api/spm-mocks'), z.array(SpmMockListItemSchema)).map((m) => m.id)
    expect(await ids(plain)).toContain(realId)
    expect(await ids(plain)).not.toContain(testId)
    expect(await ids(mod)).toEqual(expect.arrayContaining([realId, testId]))
    // The owner can still sit the test mock.
    expect((await mod.post(`/api/spm-mocks/${testId}/submit`, { answers: [] })).status).toBe(200)
  })
})

describe('AC16 contract', () => {
  it('create answers 201 { data: { id } } with a uuid; the paper, list and result parse their schemas', async () => {
    const res = await student.post('/api/spm-mocks', { subject: 'Sejarah' })
    expect(res.status).toBe(201)
    expect(Object.keys(res.body)).toEqual(['data'])
    expect(SpmMockCreatedSchema.parse(res.body.data).id).toMatch(UUID)
    const id = res.body.data.id as string
    SpmMockExamViewSchema.parse((await student.get(`/api/spm-mocks/${id}`)).body.data satisfies SpmMockExamView | undefined)
    const sub = await student.post(`/api/spm-mocks/${id}/submit`, { answers: [] })
    expect(sub.status).toBe(200)
    SpmMockResultSchema.parse(sub.body.data satisfies SpmMockResult | undefined)
  })
})
