/**
 * `GET/PUT /api/structured-questions/:id/rubric` (V2 Panel "Skema & Rubrik"): the wire shape of the API, the admin guard, 404 before 422,
 * the contract's 422 codes and BM messages, and the save persisting in the mock store.
 */

import { STRUCTURED_RUBRIC_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import type { StructuredRubric } from '../../api/structured-rubric'
import { structured } from '../../mock'
import { RUBRIC_BODY_MESSAGE } from '../../mock/handlers/structured-rubric'
import { ADMIN, bootM04, callAs, GURU, PELAJAR, type Call, type ErrorBody } from './workflow-helpers'

let runtime: MockRuntime
let call: Call

beforeAll(async () => {
  runtime = await bootM04()
  call = callAs(runtime)
})
afterAll(async () => {
  await runtime.reset()
})

const URL_3698 = '/api/structured-questions/3698/rubric'

const get = (id: number | string) => call<{ data: StructuredRubric }>('GET', `/api/structured-questions/${String(id)}/rubric`, ADMIN)

describe('GET /api/structured-questions/:id/rubric', () => {
  it('serves the anchor 3698 in the wire shape: three editable leaves with their Skema and points', async () => {
    const res = await get(3698)
    expect(res.status).toBe(200)
    const { question, subs } = res.body.data
    expect(question).toEqual({
      id: '3698',
      stimulus: 'Baca sumber berikut dengan teliti dan jawab soalan-soalan yang berikutnya.',
      subject: expect.any(String),
      level: expect.any(String),
      status: 'approved',
      totalMarks: 10,
    })
    expect(subs.map((s) => [s.id, s.number, s.marks, s.editable])).toEqual([
      ['a', 'a', 2, true],
      ['b', 'b', 4, true],
      ['c', 'c', 4, true],
    ])
    expect(subs[0]).toEqual({
      id: 'a',
      number: 'a',
      body: 'Nyatakan dua ciri negara berdaulat.',
      marks: 2,
      editable: true,
      scheme: expect.any(String),
      points: [{ id: 'p1', code: expect.any(String), text: expect.any(String), marks: 2 }],
    })
  })

  it('serves the anchor 4454 (one part of 8 marks)', async () => {
    const res = await get(4454)
    expect(res.status).toBe(200)
    expect(res.body.data.question.id).toBe('4454')
    expect(res.body.data.question.totalMarks).toBe(8)
    expect(res.body.data.subs).toHaveLength(1)
  })

  it('is admin only, and 404 for an unknown or malformed id', async () => {
    expect((await call('GET', URL_3698, null)).status).toBe(401)
    expect((await call('GET', URL_3698, PELAJAR)).status).toBe(403)
    expect((await call('GET', URL_3698, GURU)).status).toBe(403)
    expect((await get(99_999_999)).status).toBe(404)
    expect((await get('abc')).status).toBe(404)
  })
})

describe('PUT /api/structured-questions/:id/rubric', () => {
  const put = (id: number | string, body: unknown, as: number | null = ADMIN) =>
    call<{ data: StructuredRubric; status: string }>('PUT', `/api/structured-questions/${String(id)}/rubric`, as, body)

  it('is admin only', async () => {
    const body = { subs: [{ id: 'a', scheme: 'x' }] }
    expect((await put(3698, body, null)).status).toBe(401)
    expect((await put(3698, body, GURU)).status).toBe(403)
  })

  it('is 404 for an unknown id before the body is checked', async () => {
    expect((await put(99_999_999, { subs: [] })).status).toBe(404)
  })

  it('refuses a body that is not an object, with the API message', async () => {
    const res = await call<ErrorBody>('PUT', URL_3698, ADMIN, [])
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.fields).toEqual({ _: RUBRIC_BODY_MESSAGE })
  })

  it('refuses an empty subs list, an over-long Skema and a bad mark, keyed like the API', async () => {
    const empty = await call<ErrorBody>('PUT', URL_3698, ADMIN, { subs: [] })
    expect(empty.status).toBe(422)
    expect(Object.keys(empty.body.error.fields ?? {})).toEqual(['subs'])

    const res = await call<ErrorBody>('PUT', URL_3698, ADMIN, {
      subs: [
        { id: 'a', scheme: 'x'.repeat(4001), points: [{ text: 'isi', marks: 21 }, { text: 'isi', marks: 0 }, { text: 'y'.repeat(501), marks: 1 }] },
      ],
    })
    expect(res.status).toBe(422)
    expect(res.body.error.fields).toEqual({
      'subs.0.scheme': STRUCTURED_RUBRIC_MESSAGES.scheme,
      'subs.0.points.0.marks': STRUCTURED_RUBRIC_MESSAGES.marks,
      'subs.0.points.1.marks': STRUCTURED_RUBRIC_MESSAGES.marks,
      'subs.0.points.2.text': STRUCTURED_RUBRIC_MESSAGES.text,
    })
  })

  it('refuses a rubric with no non-blank point as subs.<i>.points and leaves the store untouched', async () => {
    const before = structured.get(3698)?.subQuestions.map((s) => s.rubrics)
    const res = await call<ErrorBody>('PUT', URL_3698, ADMIN, {
      subs: [{ id: 'a', scheme: 'x', points: [{ text: '   ', marks: 1 }] }],
    })
    expect(res.status).toBe(422)
    expect(res.body.error.fields).toEqual({ 'subs.0.points': STRUCTURED_RUBRIC_MESSAGES.noPoints })
    expect(structured.get(3698)?.subQuestions.map((s) => s.rubrics)).toEqual(before)
  })

  it('saves the sent leaf (Skema and points), keeps the other leaves, and the next GET shows it', async () => {
    const res = await put(3698, {
      subs: [
        {
          id: 'b',
          scheme: '  Perlembagaan menjamin hak rakyat.  ',
          points: [
            { text: 'A1 hak rakyat', marks: 2 },
            { text: '   ', marks: 1 },
            { text: 'A2 keluhuran undang-undang', marks: 2 },
          ],
        },
        { id: 'zzz', scheme: 'not a leaf of this question' },
      ],
    })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe(STRUCTURED_RUBRIC_MESSAGES.saved)
    const b = res.body.data.subs.find((s) => s.id === 'b')
    expect(b?.scheme).toBe('Perlembagaan menjamin hak rakyat.')
    expect(b?.points.map((p) => [p.text, p.marks])).toEqual([
      ['A1 hak rakyat', 2],
      ['A2 keluhuran undang-undang', 2],
    ])

    const again = (await get(3698)).body.data
    expect(again.subs.find((s) => s.id === 'b')).toEqual(b)
    // The other leaves are untouched, and so is the question's total.
    expect(again.subs.map((s) => s.marks)).toEqual([2, 4, 4])
    expect(again.question.totalMarks).toBe(10)
    expect(again.subs.find((s) => s.id === 'a')?.points).toHaveLength(1)
  })

  it('a sent leaf without `points` changes only its Skema, and a blank Skema is removed', async () => {
    const res = await put(3698, { subs: [{ id: 'a', scheme: '' }] })
    expect(res.status).toBe(200)
    const a = res.body.data.subs.find((s) => s.id === 'a')
    expect(a?.scheme).toBeNull()
    expect(a?.points).toHaveLength(1)
  })
})
