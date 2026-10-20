import { afterAll, beforeAll } from 'vitest'

import { PerformancePorts } from '../../../../src/modules/reports/performance'
import type {
  LeaderboardQuery,
  LeaderboardResult,
  PracticeReadPort,
  PracticeScopeQuery,
  PracticeUserTotals,
  RankingQuery,
  RankingResult,
} from '../../../../src/modules/reports/performance/ports'
import { bootIntegrationApp, type IntegrationApp } from '../../../bijak-integration/helpers'
import { describePracticeReadPort, type PracticeSeed } from './practice-read.contract'

/**
 * Runs the PracticeReadPort contract against the REAL adapter (`PerformancePracticeReadAdapter`, bound by
 * `PracticeReadsModule` into `PerformancePorts`) on a migrated, seeded test database. Needs a database:
 * `npm run be:test -- test/reports/performance/port-contract/practice-read.prisma.spec.ts`.
 *
 * The contract speaks in made-up ids; `translating` creates real rows for a seed, then wraps the real port so
 * ids go in as seed ids and come out as seed ids again. Nothing else is rewritten.
 */
let t: IntegrationApp
let real: PracticeReadPort
let counter = 0
let subjects: string[] = []
let levels: Record<string, string> = {}

beforeAll(async () => {
  t = await bootIntegrationApp()
  real = t.app.get(PerformancePorts).practice
  subjects = (await t.db.query<{ id: string }>(`select id::text from subjects order by id limit 2`)).map((r) => r.id)
  const lv = await t.db.query<{ id: string; code: string }>(`select id::text, code from education_levels where code in ('T4','T5')`)
  levels = Object.fromEntries(lv.map((l) => [l.code.toLowerCase(), l.id]))
})
afterAll(async () => {
  await t.close()
})

const byNumber = (a: string, b: string): number => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)

async function translating(seed: PracticeSeed): Promise<PracticeReadPort> {
  counter += 1
  await t.db.query('delete from practice_answers')
  await t.db.query('delete from practice_sessions')
  const schoolOf = new Map<string, string>()
  for (const s of [...new Set(seed.pupils.map((p) => p.schoolId))].sort(byNumber)) {
    const p = seed.pupils.find((x) => x.schoolId === s)!
    const [row] = await t.db.query<{ id: string }>(
      `insert into schools (name, code, state, district) values ($1, $2, $3, $4) returning id::text`,
      [`${p.schoolName} ${counter}`, `PR${counter}${s}`.toUpperCase(), p.state, p.district],
    )
    schoolOf.set(s, row!.id)
  }
  const userOf = new Map<string, string>()
  for (const p of [...seed.pupils].sort((a, b) => byNumber(a.id, b.id))) {
    const [row] = await t.db.query<{ id: string }>(
      `insert into users (name, email, school_id, is_active) values ($1, $2, $3::bigint, $4) returning id::text`,
      [p.name, `pr${counter}u${p.id}@demo.test`, schoolOf.get(p.schoolId)!, p.isActive !== false],
    )
    userOf.set(p.id, row!.id)
  }
  for (const s of seed.sessions) {
    await t.db.query(
      `insert into practice_sessions (user_id, mode, question_count, status, correct_count, coins_earned, started_at, completed_at, is_test)
       values ($1::bigint, 'random', $2, 'completed', $3, $4, $5::timestamptz, $5::timestamptz, $6)`,
      [userOf.get(s.userId)!, s.questionCount, s.correctCount, s.coins, s.completedAt.toISOString(), s.isTest === true],
    )
  }
  for (const a of seed.answers) {
    for (let i = 0; i < a.n; i++) {
      await t.db.query(
        `insert into practice_answers (user_id, subject_id, education_level_id, is_correct, answered_at, is_test)
         values ($1::bigint, $2::bigint, $3::bigint, $4, now(), $5)`,
        [userOf.get(a.userId)!, subjects[Number(a.subjectId ?? '1') - 1]!, levels[a.levelCode ?? 't4']!, i < a.correct, a.isTest === true],
      )
    }
  }
  const back = new Map([...userOf].map(([seedId, realId]) => [realId, seedId]))
  const toReal = (u: string): string => userOf.get(u) ?? '0'
  const scope = <T extends PracticeScopeQuery>(q: T): T => ({
    ...q,
    ...(q.userIds ? { userIds: q.userIds.map(toReal) } : {}),
    ...(q.subjectId !== undefined ? { subjectId: subjects[Number(q.subjectId) - 1] ?? '0' } : {}),
  })
  return {
    userTotals: async (q: PracticeScopeQuery): Promise<PracticeUserTotals[]> =>
      (await real.userTotals(scope(q))).map((r) => ({ ...r, userId: back.get(r.userId)! })).sort((a, b) => byNumber(a.userId, b.userId)),
    practiceDays: (u: string) => real.practiceDays(toReal(u)),
    rankingRows: async (q: RankingQuery): Promise<RankingResult> => {
      const r = await real.rankingRows(scope(q))
      return { ...r, rows: r.rows.map((x) => ({ ...x, userId: back.get(x.userId)!, name: x.name })) }
    },
    leaderboard: async (q: LeaderboardQuery): Promise<LeaderboardResult> => {
      const r = await real.leaderboard({ ...q, viewerId: toReal(q.viewerId) })
      return {
        rows: r.rows.map((x) => ({ ...x, userId: back.get(x.userId)! })),
        me: r.me ? { ...r.me, userId: back.get(r.me.userId)! } : null,
      }
    },
  }
}

describePracticeReadPort('PerformancePracticeReadAdapter (Prisma)', translating)
