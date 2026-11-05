import { QuestionDetailSchema, QuestionSchemeValidateResultSchema, mutationEnvelopeOf, QuestionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { adminActor, mcqInput, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, expectError, loginAs, parseData, type Client, type QuestionsTestApp } from './helpers'

const rich = (ms: string) => ({ ms })
const pt = (id: string, marks: number, extra: object = {}) => ({ id, code: 'M', label: id, marks, ...extra })
const points = (n: number, marks = 1) => Array.from({ length: n }, (_, i) => pt(`p${String(i + 1)}`, marks))
const pointsKey = (marks: number, rest: object) => ({ kind: 'points', scheme_v: 2, marks, ...rest })
const leaf = (label: string, mode: string, marks: number, key: object, extra: object = {}) =>
  ({ label, prompt: rich(`Soalan ${label}`), mode, marks, cognitiveLevel: 'mengaplikasi', key, ...extra })

const SUM_MESSAGE = (n: number, m: number) => `Jumlah skema (${String(n)}) mesti sama dengan markah bahagian (${String(m)}).`
const url = (id: string, partId: string) => `/api/questions/${id}/parts/${encodeURIComponent(partId)}/scheme/validate`

/** S1-T09a part 4, API-Q-30: validate a scheme v2 body against a stored leaf. Read-only; issues, never a 400 for a bad body. */
describe('S1-T09a API-Q-30 POST /questions/:id/parts/:partId/scheme/validate', () => {
  let t: QuestionsTestApp
  let tag: Tag
  let admin: Client
  let teacher: Client
  let student: Client
  let id: string

  beforeAll(async () => {
    t = await bootQuestionsApp()
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    const svc = t.app.get(QuestionsService)
    const actor = await adminActor(t.db)
    // The route only reads the stored leaf marks and modeConfig; the stored keys stay v1 (the write path takes v2 keys in a later part of S1-T09a).
    const stored = { kind: 'accepted', values: ['a'] }
    const parts = [
      leaf('(a)', 'short_text', 3, stored),
      leaf('(b)', 'short_text', 2, stored, { modeConfig: { dependsOnPart: '(a)' } }),
      leaf('(c)', 'short_text', 5, stored),
      leaf('(d)', 'short_text', 0, stored, { modeConfig: { example: { answer: 'Contoh jawapan' } } }),
    ]
    const created = await svc.create(mcqInput(tag, { questionType: 'short_answer', options: undefined, correctAnswer: undefined, questionText: 'Soalan ujian skema v2.', parts: parts as never }), actor)
    id = created.id
    admin = await loginAs(t, 'admin')
    teacher = await loginAs(t, 'teacher')
    student = await loginAs(t, 'student')
  })
  afterAll(async () => {
    await t.close()
  })

  const validate = async (partId: string, body: unknown) => {
    const res = await admin.post(url(id, partId), body)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return parseData(res, QuestionSchemeValidateResultSchema)
  }

  it('a valid 45 section 7.1 (b) scheme (any 3 of 4 facts) is ok with no issues', async () => {
    const body = pointsKey(3, { points: points(4), groups: [{ id: 'g1', anyN: 3, eachMarks: 1, pointIds: ['p1', 'p2', 'p3', 'p4'] }] })
    expect(await validate('(a)', body)).toEqual({ ok: true, issues: [] })
  })

  it('a valid rubric with bands 1 to 5 is ok', async () => {
    const body = { kind: 'rubric', scheme_v: 2, marks: 5, scoring: 'overall', criteria: [{ id: 'k', name: 'Kandungan' }], bands: [{ name: 'Aras 1', range: [1, 2] }, { name: 'Aras 2', range: [3, 5] }] }
    expect(await validate('(c)', body)).toEqual({ ok: true, issues: [] })
  })

  it('a sum mismatch is SCHEME_SUM with the 45 text, the stored leaf marks and step 4', async () => {
    const out = await validate('(a)', pointsKey(2, { points: points(2) }))
    expect(out.ok).toBe(false)
    expect(out.issues).toEqual([{ path: 'parts.(a).key.marks', code: 'SCHEME_SUM', message: SUM_MESSAGE(2, 3), step: 4 }])
  })

  it('the points total, not only the declared marks, is checked (best reachable marks)', async () => {
    const out = await validate('(a)', pointsKey(3, { points: points(2, 1) }))
    expect(out.issues.map((i) => [i.code, i.message])).toEqual([['SCHEME_SUM', SUM_MESSAGE(2, 3)]])
  })

  it('a point that requires a missing id is SCHEME_DEPENDS', async () => {
    const out = await validate('(a)', pointsKey(3, { points: [pt('p1', 1), pt('p2', 1, { requires: ['zz'] }), pt('p3', 1)] }))
    expect(out.ok).toBe(false)
    expect(out.issues).toContainEqual({ path: 'parts.(a).key.points.1', code: 'SCHEME_DEPENDS', message: 'Mata p2 bergantung pada mata yang tiada.', step: 4 })
  })

  it('a rubric whose bands leave a gap is BAND_RANGE', async () => {
    const body = { kind: 'rubric', scheme_v: 2, marks: 5, scoring: 'overall', criteria: [{ id: 'k', name: 'Kandungan' }], bands: [{ name: 'Aras 1', range: [1, 2] }, { name: 'Aras 3', range: [4, 5] }] }
    const out = await validate('(c)', body)
    expect(out.issues).toEqual([{ path: 'parts.(c).key', code: 'BAND_RANGE', message: 'Julat band tidak meliputi 0 hingga 5.', step: 4 }])
  })

  it('an example leaf (modeConfig.example, marks 0) is exempt from SCHEME_SUM', async () => {
    expect(await validate('(d)', pointsKey(3, { points: points(3) }))).toEqual({ ok: true, issues: [] })
  })

  it('a malformed body is reported as issues (200), one per problem, not a 400', async () => {
    const out = await validate('(a)', pointsKey(3, { points: [{ id: 'p1' }], surprise: true }))
    expect(out.ok).toBe(false)
    expect(out.issues.length).toBeGreaterThanOrEqual(2)
    for (const i of out.issues) {
      expect(i.step).toBe(4)
      expect(i.path.startsWith('parts.(a).key')).toBe(true)
      expect(i.code).toBe('SCHEME_INVALID')
    }
    expect(out.issues.some((i) => i.path === 'parts.(a).key.points.0.label')).toBe(true)
  })

  it('a contract code in the schema message is kept as the issue code', async () => {
    const body = { kind: 'rubric', scheme_v: 2, marks: 5, scoring: 'overall', criteria: [{ id: 'k', name: 'K' }], bands: [{ name: 'A', range: [4, 2] }] }
    const out = await validate('(c)', body)
    expect(out.issues.map((i) => i.code)).toContain('BAND_RANGE_INVALID')
  })

  it.each([[{}], [[]], [null], ['x'], [{ kind: 'option' }]])('a body without a points or rubric kind (%j) is one SCHEME_INVALID issue', async (body) => {
    const out = await validate('(a)', body)
    expect(out.ok).toBe(false)
    expect(out.issues).toHaveLength(1)
    expect(out.issues[0]).toMatchObject({ path: 'parts.(a).key.kind', code: 'SCHEME_INVALID', step: 4 })
  })

  it('an unknown part is 404', async () => {
    expectError(await admin.post(url(id, '(z)'), pointsKey(3, { points: points(3) })), 'NOT_FOUND')
  })

  it('an unknown question is 404', async () => {
    expectError(await admin.post(url('99999999', '(a)'), pointsKey(3, { points: points(3) })), 'NOT_FOUND')
  })

  it('a teacher, a pupil and a school admin are 403; no session is 401', async () => {
    const body = pointsKey(3, { points: points(3) })
    expectError(await teacher.post(url(id, '(a)'), body), 'FORBIDDEN')
    expectError(await student.post(url(id, '(a)'), body), 'FORBIDDEN')
    expectError(await loginAs(t, 'schoolAdmin').then((c) => c.post(url(id, '(a)'), body)), 'FORBIDDEN')
    expectError(await t.http().post(url(id, '(a)')).send(body), 'UNAUTHORIZED')
  })

  it('persists nothing: the version rows, keys and updated_at are unchanged after valid and invalid calls', async () => {
    const snapshot = async () => ({
      versions: await t.db.query(`select id, version_no, status, updated_at, scheme_rules from question_versions order by id`),
      parts: await t.db.query(`select id, label, marks, mode_config from question_parts order by id`),
      keys: await t.db.query(`select id, part_id, kind, content from answer_keys order by id`),
      questions: await t.db.query(`select id, latest_version_no, updated_at from questions order by id`),
      audit: await t.db.query(`select count(*)::int n from audit_events`),
    })
    const before = await snapshot()
    await validate('(a)', pointsKey(2, { points: points(2) }))
    await validate('(a)', pointsKey(3, { points: points(3) }))
    await validate('(a)', { kind: 'points' })
    expect(await snapshot()).toEqual(before)
  })

  it('scheme_rules round trip: a PUT with schemeRules stores it and the detail returns it; a later PUT without it keeps it; null clears it', async () => {
    const rules = { deductions: [{ code: 'unit', amount: 1, scope: 'question' }], zeroIf: [{ code: 'copy', label: 'Salin soalan' }] }
    const base = { subjectId: tag.subjectId, educationLevelId: tag.levelId, difficultyLevel: 3, questionText: 'Soalan ujian skema v2 dengan peraturan.' }
    const created = mutationEnvelopeOf(QuestionSchema).parse((await admin.post('/api/questions', { ...base, questionType: 'short_answer', correctAnswerText: 'a', schemeRules: rules })).body).data
    expect(created.schemeRules).toEqual(rules)
    expect((await t.db.query<{ scheme_rules: unknown }>(`select scheme_rules from question_versions where question_id = $1`, [created.id]))[0]?.scheme_rules).toEqual(rules)
    expect(parseData(await admin.get(`/api/questions/${created.id}`), QuestionDetailSchema).schemeRules).toEqual(rules)
    await admin.put(`/api/questions/${created.id}`, { ...base, questionText: 'Soalan ujian skema v2 diubah suai.' })
    expect(parseData(await admin.get(`/api/questions/${created.id}`), QuestionDetailSchema).schemeRules).toEqual(rules)
    await admin.put(`/api/questions/${created.id}`, { ...base, schemeRules: null })
    expect(parseData(await admin.get(`/api/questions/${created.id}`), QuestionDetailSchema).schemeRules).toBeNull()
    const bad = await admin.post('/api/questions', { ...base, questionType: 'short_answer', correctAnswerText: 'a', schemeRules: { deductions: [{ code: 'nope', amount: 1, scope: 'part' }] } })
    expect(bad.status).toBe(422)
  })
})
