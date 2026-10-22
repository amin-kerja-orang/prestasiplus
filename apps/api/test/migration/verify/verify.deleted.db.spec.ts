/**
 * Rows deleted at the source (MIG-07 rehearsal): after a delta on a re-staged dump the v2 rows stay (source deletes are not
 * propagated), so `migrate:verify` must tell them apart from a real mismatch. On the `cloud-tiny` fixture after a full apply
 * one pupil with their sessions, answers and links is deleted from staging; the delta (core + activity,
 * dry-run then apply) and the real reconciliation must pass, with the rows REPORTED as `deleted_at_source:<entity>` and
 * their ids in the json only. A v2 row that still has its source row and goes missing still fails.
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACTIVITY_GROUPS } from '../../../src/migration/load/activity'
import { runAll, runDelta } from '../../../src/migration/orchestrate'
import { runVerify, type VerifyReport } from '../../../src/migration/verify'
import { AS_OF, type ActivityHarness } from '../activity/helpers'
import { bootActivity, PROBE_GROUP, tempOutDir } from './helpers-verify'

let h: ActivityHarness
const out = tempOutDir()
let goneUser = ''
let report: VerifyReport

const opts = () => ({ pool: h.env.pool, env: h.runEnv, mode: 'apply' as const, asOf: AS_OF, batchSize: 2, outDir: out.path })

beforeAll(async () => {
  h = await bootActivity({ core: false })
  const probe = ACTIVITY_GROUPS.indexOf(PROBE_GROUP)
  if (probe >= 0) ACTIVITY_GROUPS.splice(probe, 1)
  // The loader derives a class level from the pupils in the class, so a pupil who is going to leave must not be in one:
  // take the class rows of the pupils with answers out before the baseline load.
  await h.q(`delete from staging_cloud.classroom_student where student_id in (select user_id from staging_cloud.question_attempts)`)
  const first = await runAll(opts())
  expect(first.verify?.status, 'the baseline load must verify').toBe('pass')

  // A migrated pupil who has loaded answers.
  goneUser = (await h.q<{ legacy_id: string }>(
    `select u.legacy_id from users u join practice_answers a on a.user_id = u.id
     join user_roles r on r.user_id = u.id and r.role = 'student'
     where u.legacy_source = 'cloud' and a.legacy_source = 'cloud'
     order by u.id limit 1`,
  ))[0]?.legacy_id as string
  expect(goneUser, 'the fixture must give a user with answers').toBeTruthy()

  // Delete at the source the way a cascading foreign key would: the user and every row that belongs to the user.
  const cols = await h.q<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns
     where table_schema = 'staging_cloud' and column_name in ('user_id', 'student_id', 'parent_id')`,
  )
  for (const c of cols) await h.q(`delete from staging_cloud."${c.table_name}" where "${c.column_name}" = $1`, [goneUser])
  await h.q(`delete from staging_cloud.users where id = $1`, [goneUser])

  const delta = await runDelta({ ...opts(), since: '2026-01-01T00:00:00Z' })
  expect(delta.stages.slice(0, 4).map((s) => [s.name, s.mode, s.status])).toEqual([
    ['core', 'dry-run', 'succeeded'], ['core', 'apply', 'succeeded'],
    ['activity', 'dry-run', 'succeeded'], ['activity', 'apply', 'succeeded'],
  ])
  expect(delta.stages[4]).toMatchObject({ name: 'verify', status: 'succeeded' })
  report = delta.verify as VerifyReport
}, 300_000)
afterAll(async () => {
  out.cleanup()
  await h?.close()
})

describe('after a delta in which source rows were deleted', () => {
  it('verify passes and the extra rows are only reported', () => {
    const bad = report.entities.filter((e) => e.status !== 'ok').map((e) => `${e.entity}: ${e.note ?? ''}`)
    const badChecks = report.checks.filter((c) => c.status === 'mismatch').map((c) => `${c.name}: ${c.detail ?? ''}`)
    expect({ bad, badChecks }).toEqual({ bad: [], badChecks: [] })
    expect(report.status).toBe('pass')

    const users = report.entities.find((e) => e.entity === 'users')
    expect(users?.deletedAtSource).toBe(1)
    expect((users?.targetCount ?? 0) - 1).toBe(users?.loaded)
    expect(report.entities.find((e) => e.entity === 'parent_links')?.deletedAtSource).toBe(1)
    expect(report.entities.find((e) => e.entity === 'practice_sessions')?.deletedAtSource).toBeGreaterThanOrEqual(1)
    expect(report.entities.find((e) => e.entity === 'practice_answers')?.deletedAtSource).toBeGreaterThanOrEqual(1)
    expect(report.entities.find((e) => e.entity === 'schools')?.deletedAtSource).toBe(0)

    const c = report.checks.find((x) => x.name === 'deleted_at_source:users')
    expect({ kind: c?.kind, status: c?.status, actual: c?.actual }).toEqual({ kind: 'counts', status: 'reported', actual: 1 })
    expect(c?.detail).toContain('not propagated by the delta')
    expect(report.checks.some((x) => x.name === 'deleted_at_source:schools')).toBe(false)
  })

  it('lists the surrogate ids in the json report only', () => {
    const files = report.files as { json: string; md: string }
    const json = JSON.parse(readFileSync(files.json, 'utf8')) as VerifyReport
    expect(json.deletedAtSourceIds?.users).toEqual([goneUser])
    expect(Object.keys(json.deletedAtSourceIds ?? {})).toEqual(expect.arrayContaining(['users', 'practice_answers', 'practice_sessions']))
    expect((json.deletedAtSourceIds?.practice_answers ?? []).length).toBeGreaterThan(0)
    expect(readFileSync(files.md, 'utf8')).not.toContain('deletedAtSourceIds')
    expect(readFileSync(files.md, 'utf8')).toContain('Deleted at source')
  })

  it('a second run with the same report is unchanged (the deleted rows stay in v2)', async () => {
    const again = await runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud' })
    expect(again.status).toBe('pass')
    expect(again.entities.find((e) => e.entity === 'users')?.deletedAtSource).toBe(1)
  })

  it('a v2 row whose source row still exists and goes missing still fails', async () => {
    expect(await h.count('school_subscriptions', `legacy_source = 'cloud'`), 'a subscription must remain').toBeGreaterThan(0)
    await h.q(`delete from school_subscriptions where id = (select min(id) from school_subscriptions where legacy_source = 'cloud')`)
    const failing = await runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud' })
    expect(failing.status).toBe('fail')
    expect(failing.entities.find((e) => e.entity === 'school_subscriptions')?.status).toBe('mismatch')
    expect(failing.entities.filter((e) => e.status === 'mismatch').map((e) => e.entity)).toEqual(['school_subscriptions'])
  })
})
