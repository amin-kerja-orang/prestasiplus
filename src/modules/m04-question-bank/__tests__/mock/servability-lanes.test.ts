/** `GET /api/admin/servability/lanes/subjektif` (C-60): the Subjektif lane lists M04's structured questions by numeric id. */

import { SERVABILITY_HUB_CARDS, type ServabilityLaneRow } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import { structured } from '../../mock'
import { ADMIN, bootM04, callAs, GURU, PELAJAR, type Call, type ErrorBody } from './workflow-helpers'

interface LaneBody {
  data: ServabilityLaneRow[]
  meta: { page: number; pageSize: number; totalItems: number }
  subjects: { id: string; name: string }[]
  count: number
  attention: { count: number; text: string }[]
}

let runtime: MockRuntime
let call: Call
const URL = '/api/admin/servability/lanes/subjektif'

beforeAll(async () => {
  runtime = await bootM04()
  call = callAs(runtime)
}, 180_000)
afterAll(async () => {
  await runtime.reset()
})

describe('Subjektif lane', () => {
  it('is admin only', async () => {
    expect((await call('GET', URL, null)).status).toBe(401)
    expect((await call('GET', URL, PELAJAR)).status).toBe(403)
    expect((await call('GET', URL, GURU)).status).toBe(403)
  })

  it('serves the contract lane shape: numeric ids, href-ready, newest first, with subjects, count and attention', async () => {
    const res = await call<LaneBody>('GET', `${URL}?page=1&pageSize=25`, ADMIN)
    expect(res.status).toBe(200)
    const body = res.body
    expect(body.data).toHaveLength(25)
    expect(body.meta).toMatchObject({ page: 1, pageSize: 25 })
    expect(body.count).toBe(body.meta.totalItems)
    expect(body.subjects.length).toBeGreaterThan(0)
    expect(body.attention).toEqual([])
    for (const row of body.data) {
      expect(`/admin/spm/subjektif/${row.id}/sunting`).toMatch(/^\/admin\/spm\/subjektif\/\d+\/sunting$/)
      expect(structured.get(Number(row.id))).not.toBeNull()
      expect(Object.keys(row).sort()).toEqual(['actions', 'attention', 'id', 'meta', 'status', 'title'])
    }
    const ids = body.data.map((r) => Number(r.id))
    expect(ids).toEqual([...ids].sort((a, b) => b - a))
  })

  it('refuses a bad query with the contract messages', async () => {
    const res = await call<ErrorBody>('GET', `${URL}?page=0`, ADMIN)
    expect(res.status).toBe(422)
    expect(Object.keys(res.body.error.fields ?? {})).toEqual(['page'])
    const long = await call<ErrorBody>('GET', `${URL}?search=${'x'.repeat(101)}`, ADMIN)
    expect(long.body.error.fields?.search).toBe('Carian tidak boleh melebihi 100 aksara.')
  })

  it('matches nothing for review, archived, an unknown status or a non-numeric subject', async () => {
    for (const q of ['status=review', 'status=archived', 'status=zzz', 'subjectId=abc']) {
      expect((await call<LaneBody>('GET', `${URL}?${q}`, ADMIN)).body.meta.totalItems).toBe(0)
    }
  })

  it('shows the hub no_scheme line when a served question has a leaf part with no rubric', async () => {
    const row = structured.get(4454)!
    const subs = row.subQuestions.map((s, i) => ({
      partLabel: s.partLabel,
      questionText: s.questionText,
      marks: s.marks,
      rubrics: i === 0 ? [] : s.rubrics,
      modelAnswer: s.modelAnswer,
    }))
    structured.update(4454, { subQuestions: subs }, Date.now())
    const res = await call<LaneBody>('GET', `${URL}?search=${encodeURIComponent('Baca situasi perniagaan')}`, ADMIN)
    const hit = res.body.data.find((r) => r.id === '4454')
    expect(hit?.attention).toHaveLength(1)
    expect(res.body.attention).toEqual([{ count: 1, text: `1 ${SERVABILITY_HUB_CARDS.subjektif.attentionLabel}` }])
  })
})
