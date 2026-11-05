/**
 * S6-T17 API-GUR-26 mock: teacher read mount of the structured questions (20 per page, approved only,
 * `status=review` empty, the detail without admin fields).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import type { GuruStructuredDetail, GuruStructuredRow } from '../../api/structured-guru'
import { structured } from '../../mock'
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

  it('serves 20 per page, numbered, with the total equal to the visible dataset', async () => {
    const r = await call<Page>('GET', '/api/guru/structured-questions', GURU)
    expect(r.status).toBe(200)
    expect(r.body.data).toHaveLength(20)
    expect(r.body.meta.pageSize).toBe(20)
    expect(r.body.meta.totalItems).toBe(structured.visible({ pageSize: 1 }).total)
    expect(r.body.data.map((x) => x.number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    expect(new Set(r.body.data.map((x) => x.status))).toEqual(new Set(['approved']))
    const p2 = await call<Page>('GET', '/api/guru/structured-questions?page=2', GURU)
    expect(p2.body.data[0]?.number).toBe(21)
    expect(p2.body.meta.from).toBe(21)
  })

  it('status=review is an empty page; a subject filter count equals the dataset', async () => {
    const review = await call<Page>('GET', '/api/guru/structured-questions?status=review', GURU)
    expect(review.body.data).toEqual([])
    expect(review.body.meta.totalItems).toBe(0)
    const first = (await call<Page>('GET', '/api/guru/structured-questions', GURU)).body.data[0]!
    const subjectId = structured.get(first.id)!.subjectId
    const f = await call<Page>(
      'GET',
      `/api/guru/structured-questions?subjectId=${String(subjectId)}`,
      ADMIN,
    )
    expect(f.body.meta.totalItems).toBe(structured.visible({ subjectId, pageSize: 1 }).total)
  })
})

describe('GET /api/guru/structured-questions/:id', () => {
  it('returns the stimulus once with the sub-questions and no admin fields', async () => {
    const first = (await call<Page>('GET', '/api/guru/structured-questions', GURU)).body.data[0]!
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
})
