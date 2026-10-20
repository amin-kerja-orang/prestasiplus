import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import type { PrismaService } from '../../src/db/prisma.service'
import { BijakAttemptProgress } from '../../src/modules/bijak/attempts/progress-source'
import { createTestDatabase, type TestDatabase } from '../support/db'

describe('BijakAttemptProgress (progress and served-question ports)', () => {
  let db: TestDatabase
  let source: BijakAttemptProgress
  let me: string
  let other: string

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed], { prisma: db.prisma })
    const users = await db.query<{ id: string }>(`select id::text from users order by id limit 2`)
    me = users[0]!.id
    other = users[1]!.id
    source = new BijakAttemptProgress({ client: db.prisma } as unknown as PrismaService)
  })
  afterAll(async () => {
    await db.drop()
  })

  let clock = 0
  /** Inserts an attempt (each one starts a minute after the previous insert) and optionally its result. */
  const add = async (opts: { user: string; paper: string | null; status?: string; result?: [number, number]; qids?: string[][]; isTest?: boolean; startedAt?: string }): Promise<string> => {
    clock += 1
    const composition = (opts.qids ?? []).map((questionIds, i) => ({ id: `s${i}`, label: `S${i}`, rule: { type: 'all' }, questionIds }))
    const rows = await db.query<{ id: string }>(
      `insert into exam_attempts (user_id, paper_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, status, started_at, duration_min, composition, is_test)
       values ($1, $2, 'pilihan', 't', 'MAT', 'Matematik', 1, '1449/1', 'exam', $3, coalesce($4::timestamptz, '2026-10-20T09:00:00Z'::timestamptz + ($5 || ' minutes')::interval), 60, $6::jsonb, $7) returning id::text`,
      [opts.user, opts.paper, opts.status ?? 'in_progress', opts.startedAt ?? null, String(clock), JSON.stringify(composition), opts.isTest ?? false],
    )
    const id = rows[0]!.id
    if (opts.result) {
      await db.query(`insert into attempt_results (attempt_id, score, max_score, graded) values ($1::uuid, $2, $3, '{}'::jsonb)`, [id, opts.result[0], opts.result[1]])
    }
    return id
  }

  it('empty input gives an empty map; a never started paper is absent', async () => {
    expect((await source.progressFor(me, [])).size).toBe(0)
    expect((await source.progressFor(me, ['4001'])).has('4001')).toBe(false)
  })

  it('invalid ids are skipped without a crash', async () => {
    const map = await source.progressFor(me, ['abc', '-1', '1.5', '99999999999999999999'])
    expect(map.size).toBe(0)
    expect((await source.progressFor('nope', ['1'])).size).toBe(0)
    expect((await source.servedQuestionIds('nope')).size).toBe(0)
  })

  it('an in_progress latest attempt gives attemptId and no lastScore', async () => {
    const id = await add({ user: me, paper: '4010' })
    expect((await source.progressFor(me, ['4010'])).get('4010')).toEqual({ attemptId: id })
  })

  it('a submitted latest attempt gives lastScore (decimal as number) and no attemptId', async () => {
    await add({ user: me, paper: '4020', status: 'submitted', result: [12.5, 20] })
    expect((await source.progressFor(me, ['4020'])).get('4020')).toEqual({ lastScore: { score: 12.5, max: 20 } })
  })

  it('latest in_progress over an earlier submitted attempt: attemptId plus the earlier lastScore; newest result wins', async () => {
    await add({ user: me, paper: '4030', status: 'submitted', result: [5, 20] })
    await add({ user: me, paper: '4030', status: 'auto_submitted', result: [9, 20] })
    const open = await add({ user: me, paper: '4030' })
    expect((await source.progressFor(me, ['4030'])).get('4030')).toEqual({ attemptId: open, lastScore: { score: 9, max: 20 } })
  })

  it('an abandoned latest attempt has no attemptId; the earlier result still gives lastScore', async () => {
    await add({ user: me, paper: '4035', status: 'submitted', result: [7, 10] })
    await add({ user: me, paper: '4035', status: 'abandoned' })
    expect((await source.progressFor(me, ['4035'])).get('4035')).toEqual({ lastScore: { score: 7, max: 10 } })
  })

  it('equal started_at breaks the tie by id desc', async () => {
    const at = '2026-11-01T00:00:00Z'
    const a = await add({ user: me, paper: '4036', startedAt: at })
    const b = await add({ user: me, paper: '4036', startedAt: at })
    const expected = a > b ? a : b
    expect((await source.progressFor(me, ['4036'])).get('4036')).toEqual({ attemptId: expected })
  })

  it('other users attempts never leak, and is_test attempts count for their owner', async () => {
    await add({ user: other, paper: '4040', result: [1, 2], status: 'submitted' })
    await add({ user: other, paper: '4041' })
    expect((await source.progressFor(me, ['4040', '4041'])).size).toBe(0)
    const mine = await add({ user: me, paper: '4042', isTest: true })
    expect((await source.progressFor(me, ['4042'])).get('4042')).toEqual({ attemptId: mine })
    expect((await source.progressFor(other, ['4042'])).size).toBe(0)
  })

  it('several papers in one call, duplicates in the input tolerated', async () => {
    const map = await source.progressFor(me, ['4010', '4020', '4020', '4030', '4777'])
    expect([...map.keys()].sort()).toEqual(['4010', '4020', '4030'])
  })

  it('attempts without a paper id are ignored by progressFor', async () => {
    await add({ user: me, paper: null })
    expect((await source.progressFor(me, ['4010'])).size).toBe(1)
  })

  it('servedQuestionIds is the deduplicated union over all attempts of the user, any status', async () => {
    await add({ user: me, paper: '5001', qids: [['q1', 'q2'], ['q3']] })
    await add({ user: me, paper: '5002', status: 'submitted', qids: [['q2', 'q4']] })
    await add({ user: me, paper: '5003', status: 'abandoned', qids: [] })
    await add({ user: other, paper: '5001', qids: [['q99']] })
    expect([...(await source.servedQuestionIds(me))].sort()).toEqual(['q1', 'q2', 'q3', 'q4'])
    expect([...(await source.servedQuestionIds(other))]).toEqual(['q99'])
  })
})
