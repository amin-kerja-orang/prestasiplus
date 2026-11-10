/**
 * The practice and streak checks of `migrate:verify`, with computed expectations (UAT rebuild 4: 5,922 versus 4,851 correct, 29 streaks):
 *  - the correct answer rows loaded equal the correct attempts staged for the loaded sessions (a silent loss fails);
 *  - the stored session counter is compared only for sessions that have answer rows in V2 (a V2 session without any has nothing to compare);
 *  - a stored streak above 0 against a recomputed 0 is the lapse since the dump (expected drift); any other difference is listed as unexplained.
 * Core and activity applied from the `cloud-tiny` fixture, then synthetic rows on top. Mismatch cases come last: they change the data.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runVerify, type VerifyReport } from '../../../src/migration/verify'
import { bootActivity, migrateAll } from './helpers-verify'
import type { ActivityHarness } from '../activity/helpers'

let h: ActivityHarness

const SUMS = 'SUM(practice_sessions.correct) versus correct answer rows'
const LOSS = 'correct answer rows versus staged correct attempts (loaded sessions)'
const STREAK = 'streak: stored streak_days versus recomputed current streak'

beforeAll(async () => {
  h = await bootActivity({ core: false })
  await migrateAll(h)
}, 300_000)
afterAll(async () => {
  await h?.close()
})

const verify = (): Promise<VerifyReport> => runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud' })
const check = (r: VerifyReport, name: string) => r.checks.find((c) => c.name === name)
const num = async (sql: string): Promise<number> => Number((await h.q<{ n: string }>(sql))[0]?.n)

describe('correct answers: computed expectations', () => {
  it('equals the staged correct attempts of the loaded sessions, and compares the counter only where V2 has answer rows', async () => {
    const r = await verify()
    const stagedCorrect = await num(
      `select count(*)::text as n from staging_cloud.question_attempts a
        where lower(btrim(a.is_correct)) in ('1', 'true', 't', 'yes', 'y', 'ya')
          and exists (select 1 from practice_sessions ps where ps.legacy_source = 'cloud' and ps.legacy_id = a.practice_session_id::text)`,
    )
    const loaded = await num(`select count(*)::text as n from practice_answers where legacy_source = 'cloud' and is_correct`)
    expect(stagedCorrect).toBeGreaterThan(0)
    expect(check(r, LOSS)).toMatchObject({ status: 'ok', kind: 'sums' })
    expect(Number(check(r, LOSS)?.expected)).toBe(stagedCorrect)
    expect(Number(check(r, LOSS)?.actual)).toBe(loaded)
    // The counter side: the sum over loaded sessions that have staged attempts, never the sum over every loaded session.
    const withRows = await num(
      `select coalesce(sum(ps.correct_count), 0)::text as n from practice_sessions ps
        where ps.legacy_source = 'cloud' and exists (select 1 from staging_cloud.question_attempts a where a.practice_session_id::text = ps.legacy_id)`,
    )
    expect(Number(check(r, SUMS)?.expected)).toBe(withRows)
    expect(check(r, SUMS)?.detail).toMatch(/loaded sessions have answer rows \(counter sum \d+\); \d+ loaded sessions have none in V2/)
  })

  it('a V2 session without answer rows carries its counter apart and does not enter the expectation', async () => {
    const before = check(await verify(), SUMS)
    // A loaded session that has staged answers: without them its counter (whatever it is) is no longer comparable.
    const some = await h.q<{ legacy_id: string }>(
      `select ps.legacy_id from practice_sessions ps where ps.legacy_source = 'cloud' and exists (select 1 from staging_cloud.question_attempts a where a.practice_session_id::text = ps.legacy_id) order by ps.legacy_id::bigint limit 1`,
    )
    expect(some.length).toBe(1)
    const legacy = some[0]?.legacy_id as string
    const counter = await num(`select correct_count::text as n from practice_sessions where legacy_source = 'cloud' and legacy_id = '${legacy}'`)
    const moved = await h.q(`select * from staging_cloud.question_attempts where practice_session_id::text = $1`, [legacy])
    await h.q(`delete from staging_cloud.question_attempts where practice_session_id::text = $1`, [legacy])
    try {
      const after = check(await verify(), SUMS)
      expect(moved.length).toBeGreaterThan(0)
      expect(Number(after?.expected)).toBe(Number(before?.expected) - counter)
      expect(after?.detail).toContain('have none in V2')
    } finally {
      for (const row of moved) {
        await h.q(
          `insert into staging_cloud.question_attempts (id, user_id, practice_session_id, question_id, selected_option, is_correct, time_seconds, created_at, updated_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [row.id, row.user_id, row.practice_session_id, row.question_id, row.selected_option, row.is_correct, row.time_seconds, row.created_at, row.updated_at],
        )
      }
    }
  })
})

describe('streak: computed expectation', () => {
  it('explains a stored streak above 0 against a recomputed 0 as the lapse, and lists any other difference as unexplained', async () => {
    const pupils = await h.q<{ legacy_id: string; current: number }>(`select legacy_id, "current" from streaks where legacy_source = 'cloud' order by legacy_id::bigint limit 2`)
    expect(pupils.length).toBe(2)
    const [a, b] = pupils as [{ legacy_id: string; current: number }, { legacy_id: string; current: number }]
    await h.q(`update streaks set "current" = 0 where legacy_source = 'cloud' and legacy_id = $1`, [a.legacy_id])
    await h.q(`update staging_cloud.student_wallets set streak_days = 5 where id::text = $1`, [a.legacy_id])
    const lapsed = check(await verify(), STREAK)
    expect(lapsed?.kind).toBe('accepted-drift')
    expect(Number(lapsed?.expected)).toBeGreaterThanOrEqual(1)
    expect(Number(lapsed?.actual)).toBe(Number(lapsed?.expected) + Number(/(\d+) unexplained/.exec(lapsed?.detail ?? '')?.[1]))
    expect(lapsed?.detail).toContain('lapsed by the load day')

    // A recomputed streak above 0 that differs from the stored one has no explanation.
    await h.q(`update streaks set "current" = 2 where legacy_source = 'cloud' and legacy_id = $1`, [b.legacy_id])
    await h.q(`update staging_cloud.student_wallets set streak_days = 7 where id::text = $1`, [b.legacy_id])
    const unexplained = check(await verify(), STREAK)
    expect(unexplained?.status).toBe('reported')
    expect(Number(unexplained?.actual) - Number(unexplained?.expected)).toBeGreaterThanOrEqual(1)
    expect(unexplained?.detail).toMatch(/[1-9]\d* unexplained/)
  })

  it('a stored NULL is no drift (the loader does not count it either)', async () => {
    await h.q(`update staging_cloud.student_wallets set streak_days = null`)
    await h.q(`update streaks set "current" = 0 where legacy_source = 'cloud'`)
    const r = check(await verify(), STREAK)
    expect(r).toMatchObject({ status: 'ok', expected: 0, actual: 0 })
  })
})

describe('correct answers: a silent loss fails', () => {
  it('fails when a staged correct attempt of a loaded session is not loaded', async () => {
    const victim = (await h.q<{ id: string }>(`select id::text from practice_answers where legacy_source = 'cloud' and is_correct limit 1`))[0]?.id
    expect(victim).toBeTruthy()
    await h.q(`delete from practice_answers where id = $1::bigint`, [victim])
    const r = await verify()
    const loss = check(r, LOSS)
    expect(loss?.status).toBe('mismatch')
    expect(Number(loss?.expected) - Number(loss?.actual)).toBe(1)
    expect(r.status).toBe('fail')
  })
})
