import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, expectError, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, type Refs } from './http-helpers'

const rich = (ms: string) => ({ ms })
const pt = (id: string, marks: number, extra: object = {}) => ({ id, code: 'M', label: id, marks, ...extra })
const leaf = (label: string, mode: string, marks: number, key: object, extra: object = {}) =>
  ({ label, prompt: rich(`Soalan ${label}`), mode, marks, cognitiveLevel: 'mengaplikasi', kbat: 'mengaplikasi', key, ...extra })

const pointsKey = (marks: number): object => ({
  kind: 'points',
  scheme_v: 2,
  marks,
  points: [pt('p1', 1), pt('p2', 1), pt('p3', 1), pt('p4', 1)],
  groups: [{ id: 'g1', anyN: 3, eachMarks: 1, pointIds: ['p1', 'p2', 'p3', 'p4'] }],
  deductions: [{ code: 'spelling', amount: 1, cap: 1, scope: 'part' }],
})
const rubricKey = (marks: number): object => ({
  kind: 'rubric',
  scheme_v: 2,
  marks,
  scoring: 'overall',
  criteria: [{ id: 'c1', name: 'Isi' }],
  bands: [{ name: 'Baik', range: [4, 5] }, { name: 'Sederhana', range: [1, 3] }],
})

/** S1-T09a part 5, task A: the write path takes scheme v2 keys and modeConfig; v1 is unchanged. */
describe('S1-T09a v2 write path (create and update)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  const body = (parts: unknown[], over: Record<string, unknown> = {}) =>
    mcqBody(refs, { questionType: 'essay', questionText: 'Soalan skema v2 untuk ujian.', options: undefined, correctAnswer: undefined, parts, ...over })
  const create = async (parts: unknown[]) => {
    const res = await admin.post('/api/questions', body(parts))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return (res.body as { data: { id: string } }).data.id
  }
  /** Raw stored parts (the contract parse of the test client would strip unknown v2 fields). */
  const partsOf = async (id: string): Promise<unknown> => {
    const res = await admin.get(`/api/questions/${id}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return (res.body as { data: { parts: unknown } }).data.parts
  }

  it('round-trips a v2 points key with modeConfig through create, read and update', async () => {
    const first = leaf('a', 'working', 3, pointsKey(3), { modeConfig: { answerSpace: 'long' } })
    const parts = [first, leaf('b', 'short_text', 0, { kind: 'accepted', values: ['contoh'] }, { modeConfig: { example: { answer: 'Contoh jawapan' } } })]
    const id = await create(parts)
    expect(await partsOf(id)).toEqual(JSON.parse(JSON.stringify(parts)))

    const changed = [leaf('a', 'working', 4, { ...pointsKey(4), points: [pt('p1', 2), pt('p2', 2)], groups: undefined, deductions: undefined })]
    const res = await admin.put(`/api/questions/${id}`, body(changed))
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await partsOf(id)).toEqual(JSON.parse(JSON.stringify(changed)))
  })

  it('round-trips a v2 rubric key on an essay and keeps it unchanged when only the stem is edited', async () => {
    const parts = [leaf('a', 'essay', 5, rubricKey(5), { modeConfig: { maxWords: 120, answerSpace: 'long' } })]
    const id = await create(parts)
    expect(await partsOf(id)).toEqual(JSON.parse(JSON.stringify(parts)))
    // Unchanged part: lenient read rules, nothing stripped.
    const res = await admin.put(`/api/questions/${id}`, body(await partsOf(id) as unknown[], { questionText: 'Soalan skema v2, teks disunting.' }))
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await partsOf(id)).toEqual(JSON.parse(JSON.stringify(parts)))
  })

  it('round-trips an mcq_multi leaf (options key, multi flag)', async () => {
    const options = ['A', 'B', 'C', 'D'].map((label) => ({ label, body: rich(`Pilihan ${label}`) }))
    const parts = [leaf('a', 'mcq', 2, { kind: 'options', correctOptionIds: ['A', 'C'] }, { options, modeConfig: { multi: true } })]
    const id = await create(parts)
    expect(await partsOf(id)).toEqual(JSON.parse(JSON.stringify(parts)))
  })

  it.each([
    ['an unknown field inside a point (v1 spelling impliedOk)', { ...(pointsKey(1) as object), points: [pt('p1', 1, { impliedOk: true })], groups: undefined, deductions: undefined }, 'working', 1, 'parts.0.key.points.0', 'Unrecognized key: "impliedOk"'],
    ['an unknown top-level field (v1 spelling final)', { ...(pointsKey(1) as object), points: [pt('p1', 1)], groups: undefined, deductions: undefined, final: { display: '1', accept: ['1'] } }, 'working', 1, 'parts.0.key', 'Unrecognized key: "final"'],
    ['a perCriterion rubric without criterion max', { ...(rubricKey(5) as object), scoring: 'perCriterion' }, 'essay', 5, 'parts.0.key.criteria', 'CRITERION_MAX_REQUIRED'],
    ['a band range that runs backwards', { ...(rubricKey(5) as object), bands: [{ name: 'Baik', range: [5, 1] }] }, 'essay', 5, 'parts.0.key.bands.0.range', 'BAND_RANGE_INVALID'],
  ])('422 names the key field and the schema message for %s', async (_name, key, mode, marks, path, text) => {
    const res = await admin.post('/api/questions', body([leaf('a', mode, marks, key)]))
    const error = expectError(res, 'VALIDATION_ERROR')
    expect(error.fields).toEqual({ [path]: text })
  })

  it('an unsupported scheme_v (3) is SCHEME_VERSION_MISMATCH', async () => {
    const key = { kind: 'points', scheme_v: 3, marks: 1, points: [pt('p1', 1)] }
    const error = expectError(await admin.post('/api/questions', body([leaf('a', 'working', 1, key)])), 'VALIDATION_ERROR')
    expect(Object.values(error.fields ?? {})).toContain('SCHEME_VERSION_MISMATCH')
  })

  it('v1 keys are unchanged: a v1 points key round-trips and a v1 rule still fails (marks 0 without example)', async () => {
    const v1 = { kind: 'points', marks: 2, points: [{ id: 'a', code: 'K', label: 'Kaedah', marks: 2 }] }
    const parts = [leaf('a', 'working', 2, v1)]
    const id = await create(parts)
    expect(await partsOf(id)).toEqual(JSON.parse(JSON.stringify(parts)))
    const bad = expectError(await admin.post('/api/questions', body([leaf('a', 'working', 0, v1)])), 'VALIDATION_ERROR')
    expect(Object.keys(bad.fields ?? {}).some((k) => k.startsWith('parts.0'))).toBe(true)
  })

  it('a v2 key whose scheme sum is wrong is saved as a draft (the sum runs at publish, as for v1)', async () => {
    const parts = [leaf('a', 'working', 3, { ...(pointsKey(3) as object), groups: undefined, deductions: undefined, points: [pt('p1', 1)] })]
    const id = await create(parts)
    expect(id).toMatch(/^\d+$/)
  })
})
