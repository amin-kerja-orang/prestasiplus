/** The mock Kandungan reads agree with each other: hub card total = lane rows, subjects come with the lane response (REQ-B-047, REQ-A-016). */
import { SERVABILITY_REASON_MS } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { createMockKandungan } from '../admin/kandungan/local-kandungan'

describe('mock Kandungan reads', () => {
  it('each hub card total equals the rows of its lane, and attention equals the rows with a reason', async () => {
    const api = createMockKandungan()
    const [overview, databank, papers] = await Promise.all([
      api.overview(),
      api.databankLane({ page: 1, pageSize: 100000 }),
      api.paperLane({ page: 1, pageSize: 100000 }),
    ])
    const card = (lane: string) => overview.cards.find((c) => c.lane === lane)
    expect(card('databank')?.total).toBe(databank.total)
    expect(card('databank')?.attention).toBe(databank.rows.filter((r) => r.attention.length > 0).length)
    expect(card('bijak-spm')?.total).toBe(papers.total)
    expect(card('bijak-spm')?.attention).toBe(papers.rows.filter((r) => r.attention.length > 0).length)
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
