import 'reflect-metadata'

import { ConfigService } from '@nestjs/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { PracticeAggregateService, type BijakAttemptAggregateInput } from '../../src/modules/practice/aggregate'
import { createTestDatabase, type TestDatabase } from '../support/db'

let n = 0
const uuid = (): string => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`

function input(over: Partial<BijakAttemptAggregateInput> = {}): BijakAttemptAggregateInput {
  return {
    attemptId: uuid(),
    userId: '0',
    isTest: false,
    paperId: '77',
    subject: 'MAT',
    kertas: 1,
    mode: 'exam',
    status: 'submitted',
    score: 5,
    max: 8,
    provisional: false,
    regraded: false,
    questions: [
      { questionId: 'q1', marks: 3, awarded: 3, attempted: true, counted: true },
      { questionId: 'q2', marks: 5, awarded: 2, attempted: true, counted: true },
      { questionId: 'q3', marks: 2, awarded: 0, attempted: false, counted: false },
    ],
    ...over,
  }
}

describe('PracticeAggregateService', () => {
  let db: TestDatabase
  let prisma: PrismaService
  let svc: PracticeAggregateService
  let u1: string
  let u2: string

  const user = async (): Promise<string> =>
    String((await db.query<{ id: string }>(`insert into users (name) values ('Murid Contoh') returning id`))[0]!.id)
  const aggs = (where = 'true') => db.query<Record<string, unknown>>(`select * from practice_attempt_aggregates where ${where} order by id`)
  const items = (id: string) =>
    db.query<Record<string, unknown>>(`select i.* from practice_attempt_aggregate_items i join practice_attempt_aggregates a on a.id = i.aggregate_id where a.attempt_id = $1 order by position`, [id])

  beforeAll(async () => {
    db = await createTestDatabase()
    prisma = new PrismaService(new ConfigService({ DATABASE_URL: db.url }) as never)
    svc = new PracticeAggregateService(prisma)
    u1 = await user()
    u2 = await user()
  })
  afterAll(async () => {
    await prisma.onModuleDestroy()
    await db.drop()
  })

  it('accepts the exact BE-16 shape (compile-time) and writes one row with every field and its items', async () => {
    const be16: BijakAttemptAggregateInput = {
      attemptId: uuid(), userId: u1, isTest: false, paperId: null, subject: 'SEJ', kertas: 2, mode: 'latihan',
      status: 'auto_submitted', score: 1.5, max: 4, provisional: true, regraded: false,
      questions: [{ questionId: 'a', marks: 4, awarded: 1.5, attempted: true, counted: true }],
    }
    await svc.recordGraded(be16)
    const [row] = await aggs(`attempt_id = '${be16.attemptId}'`)
    expect(row).toMatchObject({
      source: 'bijak', paper_id: null, start_type: null,
      subject_code: 'SEJ', kertas: 2, mode: 'latihan', status: 'auto_submitted', duration_sec: null,
      provisional: true, regrade_count: 0, is_test: false,
    })
    expect(Number(row!.units_awarded)).toBe(1.5)
    expect(Number(row!.units_max)).toBe(4)
    const its = await items(be16.attemptId)
    expect(its).toHaveLength(1)
    expect(its[0]).toMatchObject({ position: 0, question_id: 'a', attempted: true, counted: true, is_test: false })
  })

  it('stores duration and start type when given, clamps negative duration', async () => {
    const a = input({ userId: u1, paperKind: 'jana', startedAt: new Date('2026-10-19T01:00:00Z'), submittedAt: new Date('2026-10-19T01:30:00.400Z') })
    const b = input({ userId: u1, startedAt: new Date('2026-10-19T02:00:00Z'), submittedAt: new Date('2026-10-19T01:00:00Z') })
    await svc.recordGraded(a)
    await svc.recordGraded(b)
    const [ra] = await aggs(`attempt_id = '${a.attemptId}'`)
    const [rb] = await aggs(`attempt_id = '${b.attemptId}'`)
    expect(ra).toMatchObject({ duration_sec: 1800, start_type: 'jana' })
    expect(rb).toMatchObject({ duration_sec: 0, start_type: null })
  })

  it('replay and 5 parallel calls leave one unchanged row', async () => {
    const a = input({ userId: u1 })
    await svc.recordGraded(a)
    const before = await aggs(`attempt_id = '${a.attemptId}'`)
    await svc.recordGraded(a)
    await svc.recordGraded({ ...a, score: 1 })
    expect(await aggs(`attempt_id = '${a.attemptId}'`)).toEqual(before)
    const p = input({ userId: u2 })
    await Promise.all([1, 2, 3, 4, 5].map(() => svc.recordGraded(p)))
    expect(await aggs(`attempt_id = '${p.attemptId}'`)).toHaveLength(1)
    expect(await items(p.attemptId)).toHaveLength(3)
  })

  it('a regrade updates the same row and replaces items; a later stale call does not overwrite', async () => {
    const a = input({ userId: u1 })
    await svc.recordGraded(a)
    const regrade = {
      ...a, regraded: true, score: 7, status: 'auto_submitted' as const, provisional: true,
      questions: [{ questionId: 'z', marks: 8, awarded: 7, attempted: true, counted: true }],
    }
    await svc.recordGraded(regrade)
    await svc.recordGraded(a) // delayed first-close call
    const rows = await aggs(`attempt_id = '${a.attemptId}'`)
    expect(rows).toHaveLength(1)
    expect(Number(rows[0]!.units_awarded)).toBe(7)
    expect(rows[0]).toMatchObject({ regrade_count: 1, status: 'auto_submitted', provisional: true })
    const its = await items(a.attemptId)
    expect(its.map((i) => i.question_id)).toEqual(['z'])
  })

  it('a regrade with no prior row inserts it with regrade_count 1', async () => {
    const a = input({ userId: u1, regraded: true })
    await svc.recordGraded(a)
    expect((await aggs(`attempt_id = '${a.attemptId}'`))[0]).toMatchObject({ regrade_count: 1 })
  })

  it('rejects a user or is_test mismatch on an existing aggregate', async () => {
    const a = input({ userId: u1 })
    await svc.recordGraded(a)
    await expect(svc.recordGraded({ ...a, userId: u2 })).rejects.toBeInstanceOf(RangeError)
    await expect(svc.recordGraded({ ...a, isTest: true, regraded: true })).rejects.toBeInstanceOf(RangeError)
    expect((await aggs(`attempt_id = '${a.attemptId}'`))[0]).toMatchObject({ is_test: false })
  })

  it('validation rejections write nothing', async () => {
    const before = (await aggs()).length
    const ok = input({ userId: u1 })
    const q = ok.questions[0]!
    const cases: Partial<BijakAttemptAggregateInput>[] = [
      { attemptId: 'nope' }, { userId: '-1' }, { userId: 'abc' }, { subject: '' }, { subject: 'x'.repeat(33) },
      { kertas: 0 }, { kertas: 1.5 }, { mode: 'x' as never }, { status: 'x' as never }, { paperKind: 'x' as never },
      { score: Number.NaN }, { score: -1 }, { max: 100000 }, { score: 9, max: 8 }, { paperId: '1.5' },
      { startedAt: new Date('x') }, { submittedAt: 'x' as never },
      { questions: Array.from({ length: 501 }, () => q) },
      { questions: [{ ...q, questionId: '' }] }, { questions: [{ ...q, questionId: 'x'.repeat(65) }] },
      { questions: [{ ...q, marks: -1 }] }, { questions: [{ ...q, awarded: 9, marks: 3 }] },
    ]
    for (const c of cases) await expect(svc.recordGraded({ ...ok, ...c })).rejects.toBeInstanceOf(RangeError)
    expect((await aggs()).length).toBe(before)
  })

  it('stores is_test on both tables and excludes it from every read except ownHistory', async () => {
    const t = await user()
    const real = input({ userId: t, subject: 'TST' })
    const test = input({ userId: t, subject: 'TST', isTest: true })
    await svc.recordGraded(real)
    await svc.recordGraded(test)
    expect((await aggs(`attempt_id = '${test.attemptId}'`))[0]).toMatchObject({ is_test: true })
    expect((await items(test.attemptId)).every((i) => i.is_test === true)).toBe(true)

    const list = await svc.forStudents({ userIds: [t] })
    expect(list.map((r) => r.attemptId)).toEqual([real.attemptId])
    expect(list[0]).toMatchObject({ userId: t, paperId: '77', subjectCode: 'TST', unitsAwarded: 5, unitsMax: 8, startType: null })
    expect(await svc.subjectSummary({ userIds: [t] })).toEqual([
      { userId: t, subjectCode: 'TST', sittings: 1, unitsAwarded: 5, unitsMax: 8, percent: 62.5 },
    ])
    const stats = await svc.itemStats({ userIds: [t], subjectCode: 'TST', paperId: '77', kertas: 1 })
    expect(stats).toEqual([
      { questionId: 'q1', sittings: 1, attempted: 1, awarded: 3, marks: 3, facilityPercent: 100 },
      { questionId: 'q2', sittings: 1, attempted: 1, awarded: 2, marks: 5, facilityPercent: 40 },
    ])
    expect((await svc.ownHistory(t)).map((r) => r.attemptId).sort()).toEqual([real.attemptId, test.attemptId].sort())
    // a test-only student has no rows in any shared read
    const t2 = await user()
    await svc.recordGraded(input({ userId: t2, isTest: true }))
    expect(await svc.forStudents({ userIds: [t2] })).toEqual([])
    expect(await svc.subjectSummary({ userIds: [t2] })).toEqual([])
    expect(await svc.itemStats({ userIds: [t2] })).toEqual([])
  })

  it('orders newest first, honours filters and limit', async () => {
    const s = await user()
    const mk = (d: string | null, over: Partial<BijakAttemptAggregateInput> = {}) =>
      input({ userId: s, subject: 'ORD', submittedAt: d ? new Date(d) : null, ...over })
    const a = mk('2026-01-01T00:00:00Z')
    const b = mk('2026-02-01T00:00:00Z', { kertas: 2 })
    const c = mk(null)
    for (const x of [a, b, c]) await svc.recordGraded(x)
    expect((await svc.forStudents({ userIds: [s] })).map((r) => r.attemptId)).toEqual([b.attemptId, a.attemptId, c.attemptId])
    expect((await svc.forStudents({ userIds: [s], kertas: 2 })).map((r) => r.attemptId)).toEqual([b.attemptId])
    expect((await svc.forStudents({ userIds: [s], limit: 1 })).length).toBe(1)
    expect((await svc.forStudents({ userIds: [s], from: new Date('2026-01-15T00:00:00Z') })).map((r) => r.attemptId)).toEqual([b.attemptId])
    await expect(svc.forStudents({ userIds: [s], limit: 1001 })).rejects.toBeInstanceOf(RangeError)
  })

  it('bounds read inputs', async () => {
    expect(await svc.forStudents({ userIds: [] })).toEqual([])
    expect(await svc.subjectSummary({ userIds: [] })).toEqual([])
    expect(await svc.itemStats({ userIds: [] })).toEqual([])
    const many = Array.from({ length: 5001 }, (_, i) => String(i + 1))
    await expect(svc.forStudents({ userIds: many })).rejects.toBeInstanceOf(RangeError)
    await expect(svc.subjectSummary({ userIds: many })).rejects.toBeInstanceOf(RangeError)
    await expect(svc.itemStats({ userIds: many })).rejects.toBeInstanceOf(RangeError)
    await expect(svc.forStudents({ userIds: ['1; drop'] })).rejects.toBeInstanceOf(RangeError)
    await expect(svc.ownHistory('x')).rejects.toBeInstanceOf(RangeError)
    expect(await svc.forStudents({ userIds: Array.from({ length: 5000 }, (_, i) => String(i + 1)) })).toBeInstanceOf(Array)
  })

  it('deleting the user cascades to aggregates and items', async () => {
    const d = await user()
    const a = input({ userId: d })
    await svc.recordGraded(a)
    await db.query('delete from users where id = $1', [d])
    expect(await aggs(`attempt_id = '${a.attemptId}'`)).toEqual([])
    expect(await items(a.attemptId)).toEqual([])
  })
})
