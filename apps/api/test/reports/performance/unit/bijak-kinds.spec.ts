/**
 * S10-T01 (D113): Kertas Subjektif and Soalan Berstruktur sittings feed the performance reports like every other
 * Bijak sitting; a result with a null score is a sitting but never part of the accuracy base.
 */
import { describe, expect, it } from 'vitest'

import { PrismaBijakAggregate } from '../../../../src/modules/bijak/integration/performance-bijak-aggregate'
import { accuracyOf } from '../../../../src/modules/reports/performance/domain/rules'
import { figuresOf, reduceFacts } from '../../../../src/modules/reports/performance/domain/reduce'
import { sitting } from '../fakes/fixtures'

const row = (over: Record<string, unknown>) => ({
  attempt_id: '1',
  user_id: '7',
  school_id: '3',
  subject: 'MAT',
  subject_name: 'Matematik',
  paper_kind: 'pilihan',
  mode: 'latihan',
  status: 'submitted',
  score: 8,
  max_score: 10,
  answered_count: 5,
  provisional: false,
  pending_review: 0,
  duration_seconds: 600,
  started_at: new Date('2026-09-20T02:00:00Z'),
  submitted_at: new Date('2026-09-20T02:10:00Z'),
  ...over,
})

const adapterOver = (rows: unknown[]) => {
  const prisma = { client: { $queryRaw: async () => rows } }
  return new PrismaBijakAggregate(prisma as never, {} as never, {} as never)
}

describe('adapter: every paper_kind is read', () => {
  it('returns pilihan, jana, subjektif and structured sittings with their kind', async () => {
    const rows = ['pilihan', 'jana', 'subjektif', 'structured'].map((k, i) => row({ attempt_id: String(i + 1), paper_kind: k }))
    const out = await adapterOver(rows).sittings({ userIds: ['7'] })
    expect(out.map((s) => s.paperKind).sort()).toEqual(['jana', 'pilihan', 'structured', 'subjektif'])
    expect(out.every((s) => s.score === 8 && !s.provisional)).toBe(true)
  })

  it('a null score becomes a provisional sitting of 0 marks, kept in the list (never read as a real 0)', async () => {
    const out = await adapterOver([
      row({ attempt_id: '1', paper_kind: 'subjektif', score: null, provisional: false }),
      row({ attempt_id: '2', paper_kind: 'structured', score: null, provisional: true }),
    ]).sittings({ userIds: ['7'] })
    expect(out).toHaveLength(2)
    expect(out.map((s) => [s.score, s.provisional])).toEqual([
      [0, true],
      [0, true],
    ])
  })
})

describe('reducers: subjektif and structured count, a null score is skipped for accuracy', () => {
  it('subjektif and structured graded sittings enter sittings AND accuracy', () => {
    const f = figuresOf([
      sitting({ userId: '7', paperKind: 'subjektif', score: 6, maxScore: 10 }),
      sitting({ userId: '7', paperKind: 'structured', score: 4, maxScore: 10 }),
    ])
    expect(f.sittings).toBe(2)
    expect(accuracyOf(f.gradedScore, f.gradedMax)).toBe(50)
  })

  it('an unmarked sitting adds to sittings, seconds and answered but not to accuracy (not counted as 0)', async () => {
    const unmarked = (await adapterOver([row({ paper_kind: 'subjektif', score: null })]).sittings({ userIds: ['7'] }))[0]!
    const f = figuresOf([sitting({ userId: '7', score: 8, maxScore: 10 }), unmarked])
    expect(f.sittings).toBe(2)
    expect(f.seconds).toBe(1200)
    expect(f.gradedScore).toBe(8)
    expect(f.gradedMax).toBe(10)
    expect(accuracyOf(f.gradedScore, f.gradedMax)).toBe(80)
  })

  it('pilihan and jana behave as before', () => {
    const rows = reduceFacts(
      [sitting({ userId: '7', paperKind: 'pilihan', score: 9, maxScore: 10 }), sitting({ userId: '7', paperKind: 'jana', score: 7, maxScore: 10, provisional: true })],
      'user',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ sittings: 2, score: 16, max: 20, gradedScore: 9, gradedMax: 10 })
  })
})
