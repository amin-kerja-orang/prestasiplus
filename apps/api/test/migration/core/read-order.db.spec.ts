/**
 * Regression for the keyset-paged staging readers (MIG-07 rehearsal blocker): every reader selects its columns as
 * text and used to `ORDER BY "id"`, which Postgres bound to the TEXT output alias ("10" < "9") while the page
 * predicate is numeric, so a table with more rows than one page lost rows at the digit boundaries.
 *
 * Each reader is fed ids that cross digit boundaries (8..1205, and 1..25) with a small page size and must return every
 * row exactly once, in numeric order, and continue correctly from a mid-table key. Fictitious ids only.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { readExamAttempts } from '../../../src/migration/load/activity/exam-steps'
import { readExpanded } from '../../../src/migration/load/activity/catalogue-steps'
import { readCompletionRows, readUnlockRows, type PairRow } from '../../../src/migration/load/activity/gamification-steps'
import { readById, readDistinctPairs, readPairTable, type StagedRow } from '../../../src/migration/load/source'
import { loadStaging } from '../../../src/migration/staging/load'
import { DirReader } from '../../../src/migration/staging/readers'
import { createStagingDb, FIXTURE_DIR, stagingEnv, type StagingDb } from '../staging/helpers'

let env: StagingDb

const q = async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> =>
  (await env.pool.query(sql, params)).rows as T[]

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const x of it) out.push(x)
  return out
}

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i)
const ids = (rows: StagedRow[]): number[] => rows.map((r) => Number(r.id))

beforeAll(async () => {
  env = await createStagingDb()
  await loadStaging(env.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(env.db) })
}, 300_000)
afterAll(async () => {
  await env?.close()
})

describe('readById', () => {
  it.each([
    [8, 1205, 7],
    [1, 25, 3],
    [1, 25, 5],
    [1, 25, 10],
  ])('ids %i..%i with page size %i: every row once, in numeric order', async (from, to, page) => {
    await q('truncate staging_cloud.subjects')
    await q('insert into staging_cloud.subjects (id) select g from generate_series($1::int, $2::int) g order by random()', [from, to])
    const rows = await collect(readById(env.pool, 'subjects', null, page))
    expect(ids(rows)).toEqual(range(from, to))
  })

  it('resumes after a mid key (numeric, not lexicographic)', async () => {
    await q('truncate staging_cloud.subjects')
    await q('insert into staging_cloud.subjects (id) select g from generate_series(1, 25) g')
    expect(ids(await collect(readById(env.pool, 'subjects', '9', 3)))).toEqual(range(10, 25))
    expect(ids(await collect(readById(env.pool, 'subjects', '19', 4)))).toEqual(range(20, 25))
    expect(ids(await collect(readById(env.pool, 'subjects', '25', 4)))).toEqual([])
  })
})

describe('readExamAttempts', () => {
  it('ids 1..25 with page size 4: every row once, in numeric order, and resumes from a mid key', async () => {
    await q('truncate staging_cloud.exam_attempts')
    await q('insert into staging_cloud.exam_attempts (id) select g from generate_series(1, 25) g')
    expect(ids(await collect(readExamAttempts(env.pool, null, 4)))).toEqual(range(1, 25))
    expect(ids(await collect(readExamAttempts(env.pool, '9', 4)))).toEqual(range(10, 25))
  })
})

describe('readExpanded', () => {
  const expand = (row: StagedRow): string[] => [`${row.id}a`, `${row.id}b`]

  it('ids 8..130 with page size 4: every source row and position once, in numeric order', async () => {
    await q('truncate staging_cloud.users')
    await q(`insert into staging_cloud.users (id, referral_code) select g, 'R' || g from generate_series(8, 130) g order by random()`)
    const out = await collect(readExpanded(env.pool, { table: 'users', columns: ['referral_code'], where: 'referral_code IS NOT NULL' }, null, 4, expand))
    const want = range(8, 130).flatMap((n) => [`${n}:0`, `${n}:1`])
    expect(out.map((e) => e.key)).toEqual(want)
    expect(out.map((e) => e.entry)).toEqual(range(8, 130).flatMap((n) => [`${n}a`, `${n}b`]))
  })

  it('resumes inside a source row and across a digit boundary', async () => {
    const opts = { table: 'users', columns: ['referral_code'], where: 'referral_code IS NOT NULL' }
    const mid = await collect(readExpanded(env.pool, opts, '9:0', 3, expand))
    expect(mid.slice(0, 3).map((e) => e.key)).toEqual(['9:1', '10:0', '10:1'])
    expect(mid).toHaveLength(2 * 121 + 1)
    const edge = await collect(readExpanded(env.pool, opts, '99:1', 3, expand))
    expect(edge.slice(0, 2).map((e) => e.key)).toEqual(['100:0', '100:1'])
  })
})

describe('readPairTable', () => {
  const A = [8, 9, 10, 11, 99, 100]
  const B = [9, 10, 99, 100, 1000]
  type Key = [number, number]
  const keyOf = (r: StagedRow): Key => [r.classroom_id === null ? -1 : Number(r.classroom_id), r.student_id === null ? -1 : Number(r.student_id)]
  const cmp = (x: Key, y: Key): number => x[0] - y[0] || x[1] - y[1]
  let all: Key[]

  beforeAll(async () => {
    await q('truncate staging_cloud.classroom_student')
    for (const a of A) for (const b of B) await q('insert into staging_cloud.classroom_student (classroom_id, student_id) values ($1, $2)', [a, b])
    // A repeated pair, and a row with each column empty (sorts as -1, first).
    await q('insert into staging_cloud.classroom_student (classroom_id, student_id) values (10, 99), (10, 99), (null, 9), (9, null)')
    all = A.flatMap((a): Key[] => B.map((b): Key => [a, b])).concat([[10, 99], [10, 99], [-1, 9], [9, -1]]).sort(cmp)
  })

  it.each([3, 4, 7])('page size %i: every row once, in numeric (a, b) order', async (page) => {
    const rows = await collect(readPairTable(env.pool, 'classroom_student', 'classroom_id', 'student_id', null, page))
    expect(rows.map(keyOf)).toEqual(all)
  })

  it('resumes after a mid key (numeric order, `x` for an empty half)', async () => {
    const rows = await collect(readPairTable(env.pool, 'classroom_student', 'classroom_id', 'student_id', '10:99', 3))
    expect(rows.map(keyOf)).toEqual(all.filter((k) => cmp(k, [10, 99]) > 0))
    const fromNull = await collect(readPairTable(env.pool, 'classroom_student', 'classroom_id', 'student_id', 'x:9', 3))
    expect(fromNull.map(keyOf)).toEqual(all.filter((k) => cmp(k, [-1, 9]) > 0))
  })
})

describe('readDistinctPairs', () => {
  it('chapter pairs across digit boundaries: each distinct pair once, numeric order, resumable', async () => {
    await q('truncate staging_cloud.chapters')
    const pairs: [number, number][] = []
    for (const a of [8, 9, 10, 11, 99, 100]) for (const b of [9, 10, 100]) pairs.push([a, b])
    let id = 1
    for (const [a, b] of pairs) {
      // Every pair twice (distinct chapter ids), plus a row with an empty half that must be skipped.
      await q('insert into staging_cloud.chapters (id, subject_id, education_level_id) values ($1, $2, $3), ($4, $2, $3)', [id++, a, b, id++])
    }
    await q('insert into staging_cloud.chapters (id, subject_id, education_level_id) values (500, null, 9), (501, 9, null)')
    const want = [...pairs].sort((x, y) => x[0] - y[0] || x[1] - y[1])
    const key = (r: StagedRow): [number, number] => [Number(r.subject_id), Number(r.education_level_id)]
    for (const page of [2, 3, 5]) {
      const rows = await collect(readDistinctPairs(env.pool, 'chapters', 'subject_id', 'education_level_id', null, page))
      expect(rows.map(key), `page ${page}`).toEqual(want)
    }
    const rest = await collect(readDistinctPairs(env.pool, 'chapters', 'subject_id', 'education_level_id', '9:100', 3))
    expect(rest.map(key)).toEqual(want.filter(([a, b]) => a > 9 || (a === 9 && b > 100)))
  })
})

describe('readPairKeyed (achievement_user, challenge_user)', () => {
  const A = [8, 9, 10, 99, 100]
  const U = [9, 10, 99, 100]

  const keyOf = (r: PairRow): number[] => r.key.split('|').map(Number)
  const lex = (x: number[], y: number[]): number => {
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return (x[i] as number) - (y[i] as number)
    return 0
  }

  it('unlocks: every row once in numeric order for each page size, and resumes from a mid key', async () => {
    await q('truncate staging_cloud.achievement_user')
    for (const a of A) for (const u of U) await q(`insert into staging_cloud.achievement_user (achievement_id, user_id, unlocked_at) values ($1, $2, '2026-01-01 00:00:00')`, [a, u])
    // (10, 99) repeats twice more: ordinals 2 and 3.
    await q(`insert into staging_cloud.achievement_user (achievement_id, user_id, unlocked_at) values (10, 99, '2026-02-01 00:00:00'), (10, 99, '2026-03-01 00:00:00')`)
    const want = A.flatMap((a) => U.flatMap((u) => (a === 10 && u === 99 ? [[a, u, 1, 1], [a, u, 1, 2], [a, u, 1, 3]] : [[a, u, 1, 1]]))).sort(lex)
    for (const page of [1, 3, 7]) {
      const rows = await collect(readUnlockRows(env.pool, null, page))
      expect(rows.map(keyOf), `page ${page}`).toEqual(want)
    }
    // Resume in the middle of a pair, then at a digit boundary.
    const mid = await collect(readUnlockRows(env.pool, '10|99|1|1', 3))
    expect(mid.map(keyOf)).toEqual(want.filter((k) => lex(k, [10, 99, 1, 1]) > 0))
    const edge = await collect(readUnlockRows(env.pool, '9|99|1|1', 2))
    expect(edge.map(keyOf)).toEqual(want.filter((k) => lex(k, [9, 99, 1, 1]) > 0))
  })

  it('completions: one row per claimed day, every row once in numeric order, resumable', async () => {
    await q('truncate staging_cloud.challenge_user')
    for (const a of A) {
      for (const u of U) {
        await q(`insert into staging_cloud.challenge_user (challenge_id, user_id, progress, completed_at, claimed_on) values ($1, $2, 1, null, '2026-01-01'), ($1, $2, 1, null, '2026-01-02')`, [a, u])
      }
    }
    const want = A.flatMap((a) => U.flatMap((u) => [[a, u, 1, 1], [a, u, 2, 1]])).sort(lex)
    for (const page of [1, 3, 7]) {
      const rows = await collect(readCompletionRows(env.pool, null, page))
      expect(rows.map(keyOf), `page ${page}`).toEqual(want)
    }
    const mid = await collect(readCompletionRows(env.pool, '10|99|1|1', 4))
    expect(mid.map(keyOf)).toEqual(want.filter((k) => lex(k, [10, 99, 1, 1]) > 0))
  })
})
