/** The mock Kandungan reads agree with each other: hub card total = lane rows, subjects come with the lane response (REQ-B-047, REQ-A-016). */
import { SERVABILITY_REASON_MS } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { api as appApi } from '@/api'
import { issueSession } from '@/mock/core-data'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04, { structured } from '@/modules/m04-question-bank/mock'

import { createMockKandungan } from '../admin/kandungan/local-kandungan'
import { bijakAdminServer } from '../server/client'

let runtime: MockRuntime
// The Subjektif lane and its hub card read M04's structured store, so the M04 mock is booted.
beforeAll(async () => {
  runtime = await bootMock({ mode: 'test', plugins: [m01, m02, m03, m04], latencyMs: 0, onWarn: null })
  // The lane is read through the app transport, as an admin (user 1).
  const token = issueSession(users.get(1) as never, false, Date.now()).token
  appApi.configure({ transport: runtime.transport, getToken: () => token })
}, 180_000)
afterAll(async () => {
  await runtime.reset()
})

describe('mock Kandungan reads', () => {
  it('each hub card total equals the rows of its lane, and attention equals the rows with a reason', async () => {
    const api = createMockKandungan()
    const [overview, databank, papers, subjektif] = await Promise.all([
      api.overview(),
      api.databankLane({ page: 1, pageSize: 100000 }),
      api.paperLane({ page: 1, pageSize: 100000 }),
      api.subjektifLane({ page: 1, pageSize: 25 }),
    ])
    const card = (lane: string) => overview.cards.find((c) => c.lane === lane)
    expect(card('databank')?.total).toBe(databank.total)
    expect(card('databank')?.attention).toBe(databank.rows.filter((r) => r.attention.length > 0).length)
    expect(card('subjektif')?.total).toBe(subjektif.total)
    expect(card('subjektif')?.total).toBeGreaterThan(0)
    expect(card('subjektif')?.attention).toBe(0)
    expect(card('bijak-spm')?.total).toBe(papers.total)
    expect(card('bijak-spm')?.attention).toBe(papers.rows.filter((r) => r.attention.length > 0).length)
  })

  it('one failing card does not take the hub down: Subjektif is the API failed card, the others stay (SR-3)', async () => {
    const api = createMockKandungan()
    const healthy = await api.overview()
    const real = appApi.request.bind(appApi)
    const spy = vi.spyOn(appApi, 'request').mockImplementation((method, path, ...rest) =>
      path.includes('/servability/lanes/subjektif') ? Promise.reject(new Error('M04 mock not booted')) : real(method, path, ...rest))
    try {
      const overview = await api.overview()
      expect(overview.cards.map((c) => c.lane)).toEqual(healthy.cards.map((c) => c.lane))
      const subjektif = overview.cards.find((c) => c.lane === 'subjektif')
      expect(subjektif).toMatchObject({ failed: true, total: 0, attention: 0, attentionLines: [] })
      const { title, description, attentionLabel } = healthy.cards.find((c) => c.lane === 'subjektif')!
      expect(subjektif).toMatchObject({ title, description, attentionLabel })
      for (const c of overview.cards.filter((x) => x.lane !== 'subjektif')) {
        expect(c.failed).toBeUndefined()
        expect(c).toEqual(healthy.cards.find((h) => h.lane === c.lane))
      }
    } finally {
      spy.mockRestore()
    }
  })

  it('a failing Tracking A read is the API failed card too; the other cards stay (SR-3)', async () => {
    const api = createMockKandungan()
    const lane = await api.trackingLane({ page: 1, pageSize: 5 })
    const subjectId = lane.setSubjects.find((s) => s.id === 'MAT')?.id ?? lane.setSubjects[0]?.id ?? ''
    await api.createTrackingSet({ subjectId, year: 2026, setNo: 1 })
    const healthy = await api.overview()
    const admin = bijakAdminServer()
    const real = admin.listBank.bind(admin)
    // The overview reads the bank first (a plain read, rejects like the API); the Tracking A card reads it again for its units.
    let calls = 0
    const spy = vi.spyOn(admin, 'listBank').mockImplementation((...args) => (++calls === 1 ? real(...args) : Promise.reject(new Error('tracking read failed'))))
    try {
      const overview = await api.overview()
      expect(overview.cards.find((c) => c.lane === 'tracking-a')).toMatchObject({ failed: true, total: 0, attention: 0, attentionLines: [] })
      for (const c of overview.cards.filter((x) => x.lane !== 'tracking-a')) {
        expect(c.failed).toBeUndefined()
        expect(c).toEqual(healthy.cards.find((h) => h.lane === c.lane))
      }
    } finally {
      spy.mockRestore()
    }
  })

  it('lane responses carry the Subjek options, independent of the filters', async () => {
    const api = createMockKandungan()
    const all = await api.paperLane({ page: 1, pageSize: 25 })
    expect(all.subjects.length).toBeGreaterThan(0)
    const filtered = await api.paperLane({ subjectId: all.subjects[0]!.id, page: 1, pageSize: 25 })
    expect(filtered.subjects).toEqual(all.subjects)
    expect((await api.databankLane({ page: 1, pageSize: 25 })).subjects.length).toBeGreaterThan(0)
  })

  it('the contract has the question_missing sentence', () => {
    expect(SERVABILITY_REASON_MS.question_missing).toBe(
      'Soalan pada kertas ini tiada dalam bank soalan — kertas tidak boleh dimulakan; gantikan atau buang soalan itu.',
    )
  })
})

describe('mock Subjektif lane reads the M04 structured store (C-60)', () => {
  it('every row id is numeric, its Sunting href matches the editor route and resolves to a structuredRepo row', async () => {
    const api = createMockKandungan()
    const lane = await api.subjektifLane({ page: 1, pageSize: 25 })
    expect(lane.rows).toHaveLength(25)
    for (const row of lane.rows) {
      const href = `/admin/spm/subjektif/${row.id}/sunting`
      expect(href).toMatch(/^\/admin\/spm\/subjektif\/\d+\/sunting$/)
      expect(structured.get(Number(row.id))).not.toBeNull()
      expect(row.actions).toEqual(['preview', 'edit'])
      expect(row.meta.startsWith(`#${row.id} · `)).toBe(true)
      expect(row.title.length).toBeLessThanOrEqual(120)
      expect(['approved', 'draft']).toContain(row.status)
    }
  })

  it('is newest id first and pages like the API', async () => {
    const api = createMockKandungan()
    const p1 = await api.subjektifLane({ page: 1, pageSize: 25 })
    const p2 = await api.subjektifLane({ page: 2, pageSize: 25 })
    const ids = [...p1.rows, ...p2.rows].map((r) => Number(r.id))
    expect(ids).toEqual([...ids].sort((a, b) => b - a))
    expect(new Set(ids).size).toBe(50)
    expect(p1.page).toBe(1)
    expect(p2.page).toBe(2)
    expect(p1.pageSize).toBe(25)
    expect(p2.total).toBe(p1.total)
    expect(p1.count).toBe(p1.total)
  })

  it('filters by subject id, status and search, and offers the active subjects', async () => {
    const api = createMockKandungan()
    const first = await api.subjektifLane({ page: 1, pageSize: 25 })
    expect(first.subjects.length).toBeGreaterThan(1)
    const subject = first.subjects[0]!
    const bySubject = await api.subjektifLane({ subjectId: subject.id, page: 1, pageSize: 25 })
    expect(bySubject.total).toBeGreaterThan(0)
    expect(bySubject.total).toBeLessThan(first.total)
    for (const row of bySubject.rows) expect(row.meta).toContain(subject.name)
    expect(bySubject.subjects).toEqual(first.subjects)

    const approved = await api.subjektifLane({ status: 'approved', page: 1, pageSize: 25 })
    expect(approved.rows.every((r) => r.status === 'approved')).toBe(true)
    // The store holds approved and draft only: review and archived match nothing.
    expect((await api.subjektifLane({ status: 'review', page: 1, pageSize: 25 })).total).toBe(0)
    expect((await api.subjektifLane({ status: 'archived', page: 1, pageSize: 25 })).total).toBe(0)

    const stem = structured.get(Number(first.rows[0]!.id))!.stimulus.slice(0, 20)
    const found = await api.subjektifLane({ search: stem.toUpperCase(), page: 1, pageSize: 25 })
    expect(found.rows.map((r) => r.id)).toContain(first.rows[0]!.id)
    expect((await api.subjektifLane({ search: 'zzzz-tiada-padanan', page: 1, pageSize: 25 })).total).toBe(0)
    expect((await api.subjektifLane({ subjectId: 'abc', page: 1, pageSize: 25 })).total).toBe(0)
  })

  it('lists the observed anchors 4454 and 3698 with numeric Sunting hrefs', async () => {
    const api = createMockKandungan()
    const lane = await api.subjektifLane({ search: 'Baca situasi perniagaan', page: 1, pageSize: 25 })
    expect(lane.rows.map((r) => r.id)).toContain('4454')
    expect(structured.get(3698)).not.toBeNull()
  })
})
