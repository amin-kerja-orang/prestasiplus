/**
 * S6-T17 API-GUR-26 mock: teacher read mount of the structured questions (20 per page; approved questions
 * plus the caller's own `review` submissions, ruling B on #493; the detail without admin fields).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { MockRuntime } from '@/mock/index'

import type { GuruStructuredDetail, GuruStructuredRow } from '../../api/structured-guru'
import { guruSubmissions, structured } from '../../mock'
import { bootM04, callAs, GURU, PELAJAR, ADMIN, type Call } from './workflow-helpers'

interface Page {
  data: GuruStructuredRow[]
  meta: {
    page: number
    pageSize: number
    totalItems: number
    from: number | null
    to: number | null
  }
}

/**
 * Mirror of packages/contract/src/questions/schema.ts (GuruStructuredRow, GuruStructuredSub,
 * GuruStructuredDetail, API-GUR-26). Keep in step with the contract.
 */
const Ref = z.object({ id: z.number().int(), name: z.string() }).nullable()
const Status = z.enum(['approved', 'review'])
const Source = z.enum(['question', 'submission'])
const RowSchema = z.strictObject({
  id: z.union([z.number().int(), z.string().regex(/^g\d+$/)]),
  number: z.number().int().min(1),
  textExcerpt: z.string(),
  level: Ref,
  subject: Ref,
  kbat: z.string(),
  subCount: z.number().int().min(0),
  marks: z.number().int().min(0),
  status: Status,
  source: Source,
  editable: z.boolean(),
})
const FormSchema = z.strictObject({
  subjectId: z.union([z.number().int(), z.string()]),
  educationLevelId: z.union([z.number().int(), z.string()]),
  chapterId: z.union([z.number().int(), z.string()]).nullable(),
  spIds: z.array(z.union([z.number().int(), z.string()])),
  tp: z.number().int().min(1).max(6).nullable(),
  cognitiveLevel: z
    .enum(['mengingat', 'memahami', 'mengaplikasi', 'menganalisis', 'menilai', 'mencipta'])
    .nullable(),
  difficultyLevel: z.number().int().min(1).max(5),
  stimulusImageId: z.string().nullable(),
  rejectionReason: z.string().nullable(),
})
const SubSchema = z.strictObject({
  partLabel: z.string(),
  questionText: z.string(),
  marks: z.number().int().min(0),
  cognitiveLevel: z
    .enum(['mengingat', 'memahami', 'mengaplikasi', 'menganalisis', 'menilai', 'mencipta'])
    .nullable(),
  modelAnswer: z.string(),
  depth: z.number().int().min(0),
})
const DetailSchema = z.strictObject({
  id: z.union([z.number().int(), z.string().regex(/^g\d+$/)]),
  subject: Ref,
  level: Ref,
  kbat: z.string(),
  status: Status,
  stimulus: z.string(),
  stimulusImage: z.string().nullable(),
  totalMarks: z.number().int().min(0),
  subCount: z.number().int().min(0),
  subQuestions: z.array(SubSchema),
  createdAt: z.iso.datetime({ offset: true }).regex(/\+08:00$/),
  source: Source,
  editable: z.boolean(),
  form: FormSchema.nullable(),
})

let runtime: MockRuntime
let call: Call

beforeAll(async () => {
  runtime = await bootM04()
  call = callAs(runtime)
}, 180_000)

afterAll(async () => {
  await runtime.reset()
})

describe('GET /api/guru/structured-questions', () => {
  it('401 without a session, 403 for a student', async () => {
    expect((await call('GET', '/api/guru/structured-questions', null)).status).toBe(401)
    expect((await call('GET', '/api/guru/structured-questions', PELAJAR)).status).toBe(403)
  })

  it('serves 20 per page, numbered, own submissions first, with the total of the union', async () => {
    const r = await call<Page>('GET', '/api/guru/structured-questions', GURU)
    expect(r.status).toBe(200)
    expect(r.body.data).toHaveLength(20)
    expect(r.body.meta.pageSize).toBe(20)
    expect(r.body.meta.totalItems).toBe(structured.visible({ pageSize: 1 }).total + 2)
    expect(r.body.data.map((x) => x.number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    expect(r.body.data.slice(0, 2).map((x) => x.source)).toEqual(['submission', 'submission'])
    expect(r.body.data[2]?.source).toBe('question')
    const p2 = await call<Page>('GET', '/api/guru/structured-questions?page=2', GURU)
    expect(p2.body.data[0]?.number).toBe(21)
    expect(p2.body.data[0]?.source).toBe('question')
    expect(p2.body.meta.from).toBe(21)
    // The window across the own/approved boundary does not skip or repeat an approved question.
    const approvedIds = [...r.body.data, ...p2.body.data]
      .filter((x) => x.source === 'question')
      .map((x) => x.id)
    expect(new Set(approvedIds).size).toBe(approvedIds.length)
    expect(approvedIds.slice(0, 20)).toEqual(
      structured.visible({ pageSize: 20 }).rows.map((q) => q.id),
    )
  })

  it('status=approved is approved only; a teacher without submissions sees only questions', async () => {
    const approved = await call<Page>('GET', '/api/guru/structured-questions?status=approved', GURU)
    expect(new Set(approved.body.data.map((x) => x.status))).toEqual(new Set(['approved']))
    expect(approved.body.meta.totalItems).toBe(structured.visible({ pageSize: 1 }).total)
    const other = await call<Page>('GET', '/api/guru/structured-questions', ADMIN)
    expect(other.body.data.every((x) => x.source === 'question')).toBe(true)
    expect(other.body.meta.totalItems).toBe(structured.visible({ pageSize: 1 }).total)
  })

  it('status=review returns only the own submissions, editable, with the status chip data', async () => {
    const review = await call<Page>('GET', '/api/guru/structured-questions?status=review', GURU)
    expect(review.body.meta.totalItems).toBe(2)
    expect(review.body.data.map((x) => x.id)).toEqual(['g2', 'g1'])
    expect(review.body.data.every((x) => x.status === 'review' && x.editable)).toBe(true)
    expect(review.body.data[0]).toMatchObject({ subCount: 2, marks: 7, number: 1 })
    const none = await call<Page>('GET', '/api/guru/structured-questions?status=review', ADMIN)
    expect(none.body.data).toEqual([])
  })

  it('a subject filter count equals the dataset (own submissions of the subject included)', async () => {
    const first = (await call<Page>('GET', '/api/guru/structured-questions?status=approved', GURU))
      .body.data[0]!
    const subjectId = structured.get(Number(first.id))!.subjectId
    const f = await call<Page>(
      'GET',
      `/api/guru/structured-questions?subjectId=${String(subjectId)}&status=approved`,
      ADMIN,
    )
    expect(f.body.meta.totalItems).toBe(structured.visible({ subjectId, pageSize: 1 }).total)
  })
})

describe('contract shape (mirrored zod schemas)', () => {
  it('a list page and a detail parse strictly', async () => {
    const list = await call<Page>('GET', '/api/guru/structured-questions', GURU)
    for (const row of list.body.data) expect(() => RowSchema.parse(row)).not.toThrow()
    const id = list.body.data.find((r) => r.source === 'question')!.id
    const d = await call<{ data: unknown }>(
      'GET',
      `/api/guru/structured-questions/${String(id)}`,
      GURU,
    )
    expect(() => DetailSchema.parse(d.body.data)).not.toThrow()
  })
})

describe('GET /api/guru/structured-questions/:id', () => {
  it('returns the stimulus once with the sub-questions and no admin fields', async () => {
    const first = (await call<Page>('GET', '/api/guru/structured-questions?status=approved', GURU))
      .body.data[0]!
    const r = await call<{ data: GuruStructuredDetail }>(
      'GET',
      `/api/guru/structured-questions/${String(first.id)}`,
      GURU,
    )
    expect(r.status).toBe(200)
    const d = r.body.data
    expect(d.stimulus.length).toBeGreaterThan(0)
    expect(d.subQuestions.length).toBe(first.subCount)
    expect(d.totalMarks).toBe(first.marks)
    for (const k of [
      'createdBy',
      'isActive',
      'needsDiagram',
      'sourceFile',
      'complianceStatus',
      'visibility',
    ])
      expect(k in d).toBe(false)
  })

  it('404 for an unknown id', async () => {
    expect((await call('GET', '/api/guru/structured-questions/99999999', GURU)).status).toBe(404)
  })

  it('an own submission carries the stored form and the rejection reason; AC-GUR-44b-6 another teacher gets 404', async () => {
    const r = await call<{ data: GuruStructuredDetail }>(
      'GET',
      '/api/guru/structured-questions/g1',
      GURU,
    )
    expect(r.status).toBe(200)
    expect(() => DetailSchema.parse(r.body.data)).not.toThrow()
    expect(r.body.data).toMatchObject({ source: 'submission', status: 'review', editable: true })
    expect(r.body.data.form?.rejectionReason).toBe('Skema jawapan bahagian (a) tidak lengkap.')
    const g2 = await call<{ data: GuruStructuredDetail }>(
      'GET',
      '/api/guru/structured-questions/g2',
      GURU,
    )
    expect(g2.body.data.form?.rejectionReason).toBeNull()
    expect(g2.body.data.subQuestions.map((s) => s.partLabel)).toEqual(['a', 'b'])
    expect(g2.body.data.totalMarks).toBe(7)
    // Another teacher (the admin account here) and an unknown g-id.
    expect((await call('GET', '/api/guru/structured-questions/g1', ADMIN)).status).toBe(404)
    expect((await call('GET', '/api/guru/structured-questions/g99', GURU)).status).toBe(404)
  })
})

describe('review fixes (S6-T17)', () => {
  it('m8: an unknown status is a 422 on status, like the BE enum', async () => {
    const r = await call<{ error: { fields?: Record<string, string> } }>(
      'GET',
      '/api/guru/structured-questions?status=draft',
      GURU,
    )
    expect(r.status).toBe(422)
    expect(Object.keys(r.body.error.fields ?? {})).toEqual(['status'])
  })

  it('m4: a blob:mock/ stimulus image is not served as a URL; a real token is', async () => {
    const base = {
      subjectId: 1,
      educationLevelId: 1,
      chapterId: null,
      spIds: [],
      tp: null,
      cognitiveLevel: null,
      difficultyLevel: 3,
      stimulus: 'Petikan.',
      parts: [{ text: 'S?', marks: 2, scheme: 'J', cognitiveLevel: null }],
    }
    const blob = guruSubmissions.add(GURU, { ...base, stimulusImageId: 'blob:mock/r.png' }, 1)
    const real = guruSubmissions.add(
      GURU,
      { ...base, stimulusImageId: 'AbCdEfGhIjKlMnOpQrStUv' },
      2,
    )
    const a = await call<{ data: GuruStructuredDetail }>(
      'GET',
      `/api/guru/structured-questions/${blob.id}`,
      GURU,
    )
    const b = await call<{ data: GuruStructuredDetail }>(
      'GET',
      `/api/guru/structured-questions/${real.id}`,
      GURU,
    )
    expect(a.body.data.stimulusImage).toBeNull()
    expect(b.body.data.stimulusImage).toBe('/api/files/AbCdEfGhIjKlMnOpQrStUv')
    guruSubmissions.remove(blob)
    guruSubmissions.remove(real)
  })

  it('m10: createdAt of a submission is the +08:00 stamp the BE emits (toMytTimestamp)', async () => {
    const d = await call<{ data: GuruStructuredDetail }>(
      'GET',
      '/api/guru/structured-questions/g1',
      GURU,
    )
    expect(d.body.data.createdAt).toMatch(/\+08:00$/)
  })
})
