import { PerformanceRankingSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../../../prisma/seed'
import { curriculumSeed } from '../../../../prisma/seed/curriculum'
import { XsQueries } from '../../../../src/modules/school-admin/xs-queries'
import { KedudukanRepository } from '../../../../src/modules/reports/performance/adapters'
import { RankingService } from '../../../../src/modules/reports/performance/services'
import { createAnswers, createClass, enrol } from '../../../command-center/helpers'
import { createTestDatabase, type TestDatabase } from '../../../support/db'
import { ctxOf } from '../fakes/fixtures'

/**
 * Kedudukan on the real SQL (R1-MUR-18, API-RPT-13): the pool, the wallet balance, the order chain and "Sekitar anda" over a
 * migrated database with fictitious pupils only. Needs a database (`TEST_DATABASE_URL` or Docker).
 *
 * School A (Negeri Satu): a1 50 syiling, a2 40 (2 of 4 correct), a3 40 (3 of 4 correct), a4 30, a5 no wallet (0), a6 0 syiling
 * but suspended (not in any pool). School B (Negeri Dua): b1 100. School C has no state: c1 10. "x" has no school: 5.
 * Class K holds a1, a2, a4. A teacher account and a wallet that only holds test credits are not in any pool.
 */
let db: TestDatabase
let svc: RankingService
const id: Record<string, string> = {}

async function pupil(key: string, schoolId: string | null, o: { syiling?: number | null; grade?: number | null; suspended?: boolean; role?: string } = {}): Promise<void> {
  const rows = await db.query<{ id: string }>(
    `insert into users (name, email, password_hash, is_active, is_suspended, school_id, grade, created_at, updated_at)
     values ($1, $2, 'x', true, $3, $4::bigint, $5::int, now(), now()) returning id::text`,
    [`${key.toUpperCase()} Penuh Nama`, `${key}@kedudukan.test`, o.suspended ?? false, schoolId, o.grade === undefined ? 10 : o.grade],
  )
  const uid = rows[0]?.id as string
  id[key] = uid
  await db.query(`insert into user_roles (user_id, role, created_at) values ($1::bigint, $2, now())`, [uid, o.role ?? 'student'])
  if (o.syiling !== undefined && o.syiling !== null) {
    await db.query(`insert into wallets (user_id, current_syiling, total_syiling_earned) values ($1::bigint, $2, $2)`, [uid, o.syiling])
  }
}

async function answers(key: string, answered: number, correct: number): Promise<void> {
  await createAnswers(db, { userId: id[key] as string, at: '2026-10-19T08:00:00+08:00', count: answered, correct })
}

beforeAll(async () => {
  db = await createTestDatabase()
  await runSeeds([curriculumSeed], { prisma: db.prisma })
  const school = async (name: string, state: string | null): Promise<string> =>
    (await db.query<{ id: string }>(`insert into schools (name, state) values ($1, $2) returning id::text`, [name, state]))[0]?.id as string
  const A = await school('Sekolah Kedudukan A', 'Negeri Satu')
  const B = await school('Sekolah Kedudukan B', 'Negeri Dua')
  const C = await school('Sekolah Kedudukan C', null)
  await pupil('a1', A, { syiling: 50 })
  await pupil('a2', A, { syiling: 40 })
  await pupil('a3', A, { syiling: 40 })
  await pupil('a4', A, { syiling: 30 })
  await pupil('a5', A)
  await pupil('a6', A, { syiling: 0, suspended: true })
  await pupil('b1', B, { syiling: 100 })
  await pupil('c1', C, { syiling: 10 })
  await pupil('x', null, { syiling: 5 })
  await pupil('t1', A, { syiling: 999, role: 'teacher', grade: null })
  await answers('a2', 4, 2)
  await answers('a3', 4, 3)
  const teacher = id.t1 as string
  const klass = await createClass(db, { teacherId: teacher, schoolId: A })
  for (const k of ['a1', 'a2', 'a4']) await enrol(db, klass, id[k] as string)
  const prisma = { client: db.prisma } as never
  svc = new RankingService(new KedudukanRepository(prisma, new XsQueries(prisma)))
}, 400_000)

afterAll(async () => {
  await db?.drop()
}, 120_000)

const as = (k: string) => ctxOf('student', id[k] as string)
const scope = (r: Awaited<ReturnType<RankingService['rankings']>>, s: string) => r.scopes.find((x) => x.scope === s)

describe('Kedudukan on SQL', () => {
  it('ranks by the wallet balance; equal syiling is broken by accuracy; the card figures follow the pool', async () => {
    const r = await svc.rankings(as('a2'))
    PerformanceRankingSchema.parse(r)
    expect(r.syiling).toBe(40)
    expect(r.scopes.map((s) => s.scope)).toEqual(['kelas', 'sekolah', 'negeri', 'kebangsaan'])
    expect(scope(r, 'kelas')).toMatchObject({ rank: 2, total: 3, percentile: 67 })
    // school A: a1 50, a3 40 (75 %), a2 40 (50 %), a4 30, a5 0; the suspended pupil and the teacher are outside
    expect(scope(r, 'sekolah')).toMatchObject({ rank: 3, total: 5, percentile: 60 })
    expect(scope(r, 'negeri')).toMatchObject({ rank: 3, total: 5 })
    expect(scope(r, 'kebangsaan')?.rank).toBe(4) // b1 100, a1 50, a3 40 are ahead
    const a3 = scope(await svc.rankings(as('a3')), 'sekolah')
    expect(a3).toMatchObject({ rank: 2, total: 5 })
  })

  it('Sekitar anda: the pupils around the own row (1 above, 2 below here), ranks consecutive; first names only', async () => {
    const s = scope(await svc.rankings(as('a3')), 'sekolah')
    expect(s?.nearby.map((n) => [n.rank, n.syiling, n.me, n.name])).toEqual([
      [1, 50, false, 'A1'],
      [2, 40, true, 'A3 Penuh Nama'],
      [3, 40, false, 'A2'],
      [4, 30, false, 'A4'],
    ])
  })

  it('the top pupil has 3 rows, the last pupil has the own row and 2 above', async () => {
    const top = scope(await svc.rankings(as('a1')), 'sekolah')
    expect(top?.nearby.map((n) => [n.rank, n.me])).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ])
    const last = scope(await svc.rankings(as('a5')), 'sekolah')
    expect(last).toMatchObject({ rank: 5, total: 5, percentile: 100 })
    expect(last?.nearby.map((n) => [n.rank, n.me])).toEqual([
      [3, false],
      [4, false],
      [5, true],
    ])
  })

  it('a pupil without a wallet is 0 syiling; no class: no class card', async () => {
    const r = await svc.rankings(as('a5'))
    expect(r.syiling).toBe(0)
    expect(r.scopes.map((s) => s.scope)).toEqual(['sekolah', 'negeri', 'kebangsaan'])
  })

  it('a school without a state: the negeri card is all null; no school: no school card', async () => {
    const c = await svc.rankings(as('c1'))
    expect(scope(c, 'negeri')).toEqual({ scope: 'negeri', rank: null, total: null, percentile: null, nearby: [] })
    expect(scope(c, 'sekolah')).toMatchObject({ rank: 1, total: 1, percentile: 100 })
    const x = await svc.rankings(as('x'))
    expect(x.scopes.map((s) => s.scope)).toEqual(['negeri', 'kebangsaan'])
  })

  it('a teacher has no standing', async () => {
    expect(await svc.rankings(ctxOf('teacher', id.t1 as string))).toEqual({ syiling: 0, scopes: [] })
  })

  it('a wallet that only holds test credits (Mod Pelajar) is left out of the pool', async () => {
    await pupil('tst', (await db.query<{ id: string }>(`select school_id::text as id from users where email = 'a1@kedudukan.test'`))[0]?.id as string, { syiling: 500 })
    await db.query(
      `insert into coin_ledger (user_id, type, source, amount, balance_after, description, is_test) values ($1::bigint, 'earn', 'admin', 500, 500, 'ujian', true)`,
      [id.tst],
    )
    const r = scope(await svc.rankings(as('a1')), 'sekolah')
    expect(r).toMatchObject({ rank: 1, total: 5 })
  })
})
