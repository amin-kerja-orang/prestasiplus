import type { QuestionPart } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'
import { adminActor, apiError, mcqInput, rich, tagOf, type Tag } from './fixtures'

type Point = Record<string, unknown>

const point = (id: string, code: string, marks: number, extra: Point = {}): Point => ({ id, code, label: `Titik ${id}`, marks, ...extra })

const working = (marks: number, key: Record<string, unknown>): QuestionPart =>
  ({ label: 'a', prompt: rich('Tunjukkan pengiraan anda.'), mode: 'working', marks, key: { kind: 'points', marks, ...key } }) as unknown as QuestionPart

/** AC 3: one validation/round-trip case per mark-point feature. Storage only; no marking logic here. */
describe('mark points (structured keys round-trip through the jsonb answer key)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>
  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await adminActor(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  async function roundTrip(parts: QuestionPart[]): Promise<QuestionPart[]> {
    const created = await svc.create(mcqInput(tag, { questionType: 'essay', options: undefined, correctAnswer: undefined, parts }), admin)
    const stored = await repo.get(created.id, 'latest')
    return stored!.version.parts
  }

  const keyOf = (parts: QuestionPart[]): unknown => (parts[0] as unknown as { key: unknown }).key

  it('code letters K N P B M F C and per-point marks', async () => {
    const points = ['K', 'N', 'P', 'B', 'M', 'F', 'C'].map((c, i) => point(`p${String(i)}`, c, 1))
    const part = working(7, { points })
    const back = await roundTrip([part])
    expect(keyOf(back)).toEqual((part as unknown as { key: unknown }).key)
  })

  it('accepted equivalents on a point and on the final answer', async () => {
    const part = working(3, {
      points: [point('p1', 'N', 2, { accept: ['x = 4', 'x=4', '4'] }), point('p2', 'B', 1)],
      final: { display: 'x = 4', accept: ['4', 'x = 4'], unit: 'cm' },
    })
    const back = await roundTrip([part])
    expect(keyOf(back)).toEqual((part as unknown as { key: unknown }).key)
  })

  it('"any N of M" groups', async () => {
    const part = working(4, {
      points: [point('p1', 'N', 2), point('p2', 'N', 2), point('p3', 'N', 2)],
      groups: [{ id: 'g1', anyN: 2, eachMarks: 2, pointIds: ['p1', 'p2', 'p3'] }],
    })
    const back = await roundTrip([part])
    expect((keyOf(back) as { groups: unknown[] }).groups).toEqual([{ id: 'g1', anyN: 2, eachMarks: 2, pointIds: ['p1', 'p2', 'p3'] }])
  })

  it('alternative paths', async () => {
    const part = working(3, {
      points: [point('a1', 'M', 1), point('a2', 'N', 2), point('b1', 'M', 1), point('b2', 'N', 2)],
      paths: [
        { id: 'A', pointIds: ['a1', 'a2'] },
        { id: 'B', pointIds: ['b1', 'b2'] },
      ],
    })
    const back = await roundTrip([part])
    expect((keyOf(back) as { paths: unknown[] }).paths).toHaveLength(2)
    expect(keyOf(back)).toEqual((part as unknown as { key: unknown }).key)
  })

  it('error carried forward (ECF) rule on a point', async () => {
    const part = working(2, {
      points: [point('p1', 'F', 2, { ecf: { fromPart: 'a', rule: { op: 'sub_from', k: 10 } }, requires: [] })],
    })
    const back = await roundTrip([part])
    expect(((keyOf(back) as { points: Point[] }).points[0] as Point).ecf).toEqual({ fromPart: 'a', rule: { op: 'sub_from', k: 10 } })
  })

  it('tolerance, units, significant figures and decimals on a point', async () => {
    const part = working(2, {
      points: [
        point('p1', 'N', 2, {
          tolerance: { kind: 'rel', value: 0.02 },
          unit: { value: 'm/s', alt: ['ms-1'], mandatory: true },
          sigFigs: 3,
          decimals: 2,
        }),
      ],
      deductions: [{ code: 'unit', amount: 1, cap: 1 }],
    })
    const back = await roundTrip([part])
    expect(keyOf(back)).toEqual((part as unknown as { key: unknown }).key)
  })

  it('marks sit on leaves only and a numeric key keeps its tolerance and unit alternatives', async () => {
    const parts = [
      {
        label: 'a',
        prompt: rich('Bahagian a'),
        children: [
          { label: 'i', prompt: rich('i'), mode: 'numeric', marks: 2, key: { kind: 'accepted', values: [{ v: 9.81, tol: 0.05, tolKind: 'abs', unit: 'm/s2', unitAlt: ['m s-2'] }] } },
        ],
      },
    ] as unknown as QuestionPart[]
    const back = await roundTrip(parts)
    const branch = back[0] as unknown as { children: { marks: number; key: unknown }[]; marks?: number }
    expect(branch.marks).toBeUndefined()
    expect(branch.children[0]?.marks).toBe(2)
    expect(branch.children[0]?.key).toEqual({ kind: 'accepted', values: [{ v: 9.81, tol: 0.05, tolKind: 'abs', unit: 'm/s2', unitAlt: ['m s-2'] }] })
  })

  it('rejects an unknown code letter and a key of the wrong kind for the mode with the part path in fields', async () => {
    const badCode = working(1, { points: [point('p1', 'Z', 1)] })
    const e1 = await apiError(() => roundTrip([badCode]))
    expect(e1.getStatus()).toBe(422)
    expect(Object.keys(e1.fields ?? {})[0]).toMatch(/^parts\./)
    const wrongKind = { label: 'a', prompt: rich('x'), mode: 'mcq', marks: 1, options: [{ label: 'A', body: rich('a') }, { label: 'B', body: rich('b') }, { label: 'C', body: rich('c') }], key: { kind: 'rubric', marks: 1, criteria: [{ id: 'c', name: 'c' }], bands: [{ name: 'b', range: [0, 1] }] } } as unknown as QuestionPart
    const e2 = await apiError(() => roundTrip([wrongKind]))
    expect(e2.getStatus()).toBe(422)
    expect(Object.keys(e2.fields ?? {}).some((k) => k.startsWith('parts.0.key'))).toBe(true)
  })

  it('a branch with marks is refused', async () => {
    const branchWithMarks = { label: 'a', prompt: rich('x'), marks: 2, children: [working(1, { points: [point('p', 'K', 1)] })] } as unknown as QuestionPart
    const err = await apiError(() => roundTrip([branchWithMarks]))
    expect(err.getStatus()).toBe(422)
    expect(err.code).toBe('VALIDATION_ERROR')
  })
})
