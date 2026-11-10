import { StructuredRubricSchema, STRUCTURED_RUBRIC_MESSAGES, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { bootQuestionsApp, expectCsrfInvalid, expectError, loginAs, questionIdOf, type Client, type QuestionsTestApp } from './helpers'

const Saved = z.object({ data: StructuredRubricSchema, status: z.string() })

/** V2 Panel Subjektif Sunting: `GET/PUT /api/structured-questions/:id/rubric` (Skema = modelText, Poin Rubrik = points of a leaf). */
describe('structured rubric editor (admin)', () => {
  let t: QuestionsTestApp
  let admin: Client
  beforeAll(async () => {
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
  })
  afterAll(async () => {
    await t.close()
  })

  const load = async (id: string) => {
    const res = await admin.get(`/api/structured-questions/${id}/rubric`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return envelopeOf(StructuredRubricSchema).parse(res.body).data
  }
  const versions = (id: string) =>
    t.db.query<{ version_no: number; status: string }>(`select version_no, status from question_versions where question_id = $1 order by version_no`, [id])

  it('loads every leaf as a sub-question; only a leaf with a points key is editable', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-TREE')
    const out = await load(id)
    expect(out.question).toMatchObject({ id, status: 'approved' })
    expect(out.subs.map((s) => s.id)).toEqual(['(a).(i).(A)', '(a).(i).(B)', '(a).(ii)', '(b)'])
    const working = out.subs.find((s) => s.id === '(a).(ii)')!
    expect(working.editable).toBe(true)
    expect(working.marks).toBe(3)
    expect(working.points.map((p) => p.text)).toEqual(['Memfaktorkan atau menggunakan rumus', 'x = 1', 'x = 3'])
    expect(out.subs.filter((s) => s.editable).map((s) => s.id)).toEqual(['(a).(ii)'])
    expect(out.question.totalMarks).toBe(out.subs.reduce((n, s) => n + s.marks, 0))
  })

  it('saves the scheme and points; the approved version stays and the edit is the next draft', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-ANYN')
    const res = await admin.put(`/api/structured-questions/${id}/rubric`, {
      subs: [{ id: '(a)', scheme: 'Mana-mana tiga langkah keselamatan.', points: [{ text: 'Memakai kot makmal', marks: 1 }, { text: 'Memakai gogal keselamatan', marks: 1 }, { text: '  ', marks: 1 }, { text: 'Membasuh tangan', marks: 2 }] }],
    })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const body = Saved.parse(res.body)
    expect(body.status).toBe(STRUCTURED_RUBRIC_MESSAGES.saved)
    expect(body.data.question.status).toBe('draft')
    const sub = body.data.subs[0]!
    expect(sub.scheme).toBe('Mana-mana tiga langkah keselamatan.')
    expect(sub.points.map((p) => [p.text, p.marks])).toEqual([['Memakai kot makmal', 1], ['Memakai gogal keselamatan', 1], ['Membasuh tangan', 2]])
    // The first two rows keep their id and code (by position); the blank row is removed and the new one gets a fresh id.
    expect(sub.points[0]).toMatchObject({ id: 'p1', code: 'P' })
    expect(sub.points[1]).toMatchObject({ id: 'p2', code: 'P' })
    expect(sub.points[2]!.id).not.toBe('p3')
    expect((await versions(id)).map((v) => [v.version_no, v.status])).toEqual([[1, 'approved'], [2, 'draft']])
    expect(await load(id)).toMatchObject({ subs: [{ scheme: 'Mana-mana tiga langkah keselamatan.' }] })
  })

  it('a blank scheme clears modelText; a new row gets a fresh id', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-ECF')
    const before = await load(id)
    const pts = before.subs.find((s) => s.id === '(b)')!.points
    const res = await admin.put(`/api/structured-questions/${id}/rubric`, {
      subs: [{ id: '(b)', scheme: '', points: [...pts.map((p) => ({ text: p.text, marks: p.marks })), { text: 'Unit cm', marks: 1 }] }],
    })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const sub = Saved.parse(res.body).data.subs.find((s) => s.id === '(b)')!
    expect(sub.scheme).toBeNull()
    expect(sub.points).toHaveLength(pts.length + 1)
    expect(new Set(sub.points.map((p) => p.id)).size).toBe(sub.points.length)
  })

  it('refuses a bad body with field messages and writes nothing', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-TREE')
    const n = (await versions(id)).length
    const res = await admin.put(`/api/structured-questions/${id}/rubric`, {
      subs: [{ id: '(a).(ii)', scheme: 'x'.repeat(4001), points: [{ text: 'a', marks: 0 }, { text: 'b'.repeat(501), marks: 21 }] }],
    })
    const fields = expectError(res, 'VALIDATION_ERROR').fields!
    expect(fields['subs.0.scheme']).toBe(STRUCTURED_RUBRIC_MESSAGES.scheme)
    expect(fields['subs.0.points.0.marks']).toBe(STRUCTURED_RUBRIC_MESSAGES.marks)
    expect(fields['subs.0.points.1.text']).toBe(STRUCTURED_RUBRIC_MESSAGES.text)
    expect(await versions(id)).toHaveLength(n)
  })

  it('refuses a rubric with no point; skips ids that are not editable leaves of this question', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-TREE')
    const n = (await versions(id)).length
    const empty = await admin.put(`/api/structured-questions/${id}/rubric`, { subs: [{ id: '(a).(ii)', points: [{ text: '', marks: 1 }] }] })
    expect(expectError(empty, 'VALIDATION_ERROR').fields!['subs.0.points']).toBe(STRUCTURED_RUBRIC_MESSAGES.noPoints)
    expect(await versions(id)).toHaveLength(n)
    const ok = await admin.put(`/api/structured-questions/${id}/rubric`, { subs: [{ id: '(b)', scheme: 'ignored', points: [{ text: 'z', marks: 1 }] }, { id: 'nope', scheme: 'ignored' }] })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    expect((await load(id)).subs.every((s) => s.scheme !== 'ignored')).toBe(true)
  })

  it('404 for an objective or unknown id, 422 for an empty list', async () => {
    const mcq = await questionIdOf(t.db, 'SEED-MCQ-MATH-T4')
    expectError(await admin.get(`/api/structured-questions/${mcq}/rubric`), 'NOT_FOUND')
    expectError(await admin.put(`/api/structured-questions/${mcq}/rubric`, { subs: [{ id: '(a)' }] }), 'NOT_FOUND')
    expectError(await admin.get('/api/structured-questions/999999999/rubric'), 'NOT_FOUND')
    const id = await questionIdOf(t.db, 'SEED-STR-TREE')
    expectError(await admin.put(`/api/structured-questions/${id}/rubric`, { subs: [] }), 'VALIDATION_ERROR')
  })

  it('is admin only: 401 without a session, 403 for student, teacher and school admin, CSRF required on the write', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-TREE')
    const url = `/api/structured-questions/${id}/rubric`
    expectError(await t.http().get(url), 'UNAUTHORIZED')
    expectError(await t.http().put(url).send({}), 'UNAUTHORIZED')
    for (const who of ['student', 'teacher', 'schoolAdmin'] as const) {
      const c = await loginAs(t, who)
      expectError(await c.get(url), 'FORBIDDEN')
      expectError(await c.put(url, { subs: [{ id: '(a).(ii)', points: [{ text: 'x', marks: 1 }] }] }), 'FORBIDDEN')
    }
    expectCsrfInvalid(await admin.noCsrf.put(url, { subs: [{ id: '(a).(ii)' }] }))
  })
})
