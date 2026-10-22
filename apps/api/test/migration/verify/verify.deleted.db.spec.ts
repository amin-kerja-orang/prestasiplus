/**
 * Rows deleted at the source (MIG-07 rehearsal): after a delta on a re-staged dump the v2 rows stay (source deletes are not
 * propagated), so `migrate:verify` must tell them apart from a real mismatch. On the `cloud-tiny` fixture after a full apply
 * one pupil with their sessions, answers and links is deleted from staging; the delta (core + activity,
 * dry-run then apply) and the real reconciliation must pass, with the rows REPORTED as `deleted_at_source:<entity>` and
 * their ids in the json only. A v2 row that still has its source row and goes missing still fails.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACTIVITY_GROUPS } from '../../../src/migration/load/activity'
import { runAll, runDelta } from '../../../src/migration/orchestrate'
import { runVerify, writeVerifyReport, type VerifyReport } from '../../../src/migration/verify'
import { AS_OF, type ActivityHarness } from '../activity/helpers'
import { bootActivity, PROBE_GROUP, tempOutDir } from './helpers-verify'

let h: ActivityHarness
const out = tempOutDir()
let goneUser = ''
let feedbackOfGone = 0
let report: VerifyReport

const opts = () => ({ pool: h.env.pool, env: h.runEnv, mode: 'apply' as const, asOf: AS_OF, batchSize: 2, outDir: out.path })

beforeAll(async () => {
  h = await bootActivity({ core: false })
  const probe = ACTIVITY_GROUPS.indexOf(PROBE_GROUP)
  if (probe >= 0) ACTIVITY_GROUPS.splice(probe, 1)
  // The loader derives a class level from the pupils in the class, so a pupil who is going to leave must not be in one:
  // take the class rows of the pupils with answers out before the baseline load.
  await h.q(`delete from staging_cloud.classroom_student where student_id in (select user_id from staging_cloud.question_attempts)`)
  // A platform challenge, and for every pupil with answers a claim of it and an SPM target (so a deleted pupil leaves both behind).
  const subject = (await h.q<{ id: string }>(`select min(id)::text as id from staging_cloud.subjects`))[0]?.id as string
  await h.q(`insert into staging_cloud.challenges (id, created_by, classroom_id, type, title, criteria) values (91, null, null, 'quiz_count', 'Cabaran Ujian', '{"target": 3}')`)
  await h.q(
    `insert into staging_cloud.challenge_user (challenge_id, user_id, progress, completed_at, claimed_on)
     select distinct 91, user_id, 3, '2026-01-01T00:00:00Z'::timestamptz, '2026-01-02'::date from staging_cloud.question_attempts`,
  )
  await h.q(
    `update staging_cloud.users set spm_targets = $1 where id in (select user_id from staging_cloud.question_attempts)`,
    [JSON.stringify({ [subject]: 'A' })],
  )
  // A feedback row for every pupil with answers (synthetic): the one of the pupil deleted below is left in staging.
  await h.q(
    `insert into staging_cloud.feedback (id, user_id, score, satisfaction, usability, relevance, comment, created_at, updated_at)
     select 9000 + row_number() over (order by user_id), user_id, 5, 4, 4, 4, 'Komen ujian.', now(), now()
     from (select distinct user_id from staging_cloud.question_attempts) d`,
  )
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
  // `feedback` is left out: staging has no cascade, so those rows stay behind (BE-29 rejects them as orphans).
  for (const c of cols.filter((x) => x.table_name !== 'feedback')) await h.q(`delete from staging_cloud."${c.table_name}" where "${c.column_name}" = $1`, [goneUser])
  await h.q(`delete from staging_cloud.users where id = $1`, [goneUser])
  feedbackOfGone = await h.count('feedback', `legacy_source = 'cloud' and user_id = (select id from users where legacy_source = 'cloud' and legacy_id = '${goneUser}')`)

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
    // Claims and SPM targets carry no key of their own: they are deleted at the source with their user.
    for (const entity of ['challenge_completions', 'spm_targets']) {
      const e = report.entities.find((x) => x.entity === entity)
      expect(e?.loaded, `${entity}: the planted rows must be loaded`).toBeGreaterThan(0)
      expect(e?.deletedAtSource, entity).toBe(1)
      expect(report.checks.find((x) => x.name === `deleted_at_source:${entity}`)?.status).toBe('reported')
    }

    // A feedback row of a user deleted at source is deleted at source too, although its own staging row remains.
    expect(feedbackOfGone, 'the deleted pupil must have loaded feedback').toBeGreaterThan(0)
    const fb = report.entities.find((x) => x.entity === 'feedback')
    expect({ status: fb?.status, deleted: fb?.deletedAtSource }).toEqual({ status: 'ok', deleted: feedbackOfGone })
    expect(report.checks.find((x) => x.name === 'deleted_at_source:feedback')?.actual).toBe(feedbackOfGone)

    const c = report.checks.find((x) => x.name === 'deleted_at_source:users')
    expect({ kind: c?.kind, status: c?.status, actual: c?.actual }).toEqual({ kind: 'counts', status: 'reported', actual: 1 })
    expect(c?.detail).toContain('not propagated by the delta')
    expect(report.checks.some((x) => x.name === 'deleted_at_source:schools')).toBe(false)
  })

  it('keeps the ids out of the recon files and puts them in a separate 0600 file', () => {
    const files = report.files as { json: string; md: string; deletedIds?: string }
    expect(files.deletedIds).toMatch(/deleted-at-source-\d{14}-[0-9a-f]{8}\.json$/)
    const recon = readFileSync(files.json, 'utf8')
    expect(recon).not.toContain('deletedAtSourceIds')
    expect(JSON.parse(recon).files.deletedIds).toBe(files.deletedIds)
    expect(readFileSync(files.md, 'utf8')).toContain('Deleted at source')
    expect(readFileSync(files.md, 'utf8')).not.toContain('deletedAtSourceIds')
    expect(statSync(files.deletedIds as string).mode & 0o777).toBe(0o600)

    const ids = JSON.parse(readFileSync(files.deletedIds as string, 'utf8')) as { deletedAtSourceIds: Record<string, string[]> }
    expect(ids.deletedAtSourceIds.users).toEqual([goneUser])
    expect(Object.keys(ids.deletedAtSourceIds)).toEqual(
      expect.arrayContaining(['users', 'practice_answers', 'practice_sessions', 'challenge_completions', 'spm_targets']),
    )
  })

  it('writes a second report without touching the first (a random name for the id file)', async () => {
    const again = await runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud', now: new Date(Date.now() + 60_000) })
    const files = writeVerifyReport(again, out.path)
    expect(files.deletedIds).not.toBe(report.files?.deletedIds)
    expect(readdirSync(out.path).filter((f) => f.startsWith('deleted-at-source-'))).toHaveLength(2)
  })

  it('a ceiling on the deleted rows fails the run (a truncated re-stage would otherwise pass)', async () => {
    const strict = await runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud', maxDeletedRatio: 0, maxDeletedRows: 0 })
    expect(strict.status).toBe('fail')
    const failing = strict.checks.filter((c) => c.name.startsWith('deleted_at_source_ratio:'))
    expect(failing.map((c) => c.status)).toEqual(failing.map(() => 'mismatch'))
    expect(failing.map((c) => c.name)).toContain('deleted_at_source_ratio:users')
    // Over the ratio but not over the row ceiling, and over the row ceiling but not the ratio: both must hold to fail.
    const rowsOnly = await runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud', maxDeletedRatio: 0, maxDeletedRows: 100 })
    expect(rowsOnly.status).toBe('pass')
    const ratioOnly = await runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud', maxDeletedRatio: 1, maxDeletedRows: 0 })
    expect(ratioOnly.status).toBe('pass')
    const defaults = await runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud' })
    expect(defaults.checks.some((c) => c.name.startsWith('deleted_at_source_ratio:'))).toBe(false)
  })

  it('a second run with the same report is unchanged (the deleted rows stay in v2)', async () => {
    const again = await runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud' })
    expect(again.status).toBe('pass')
    expect(again.entities.find((e) => e.entity === 'users')?.deletedAtSource).toBe(1)
  })

  it('an answer whose session is deleted at source and whose question is not in the archive keeps its subject in the distribution', async () => {
    const name = 'practice answers per subject (loaded answers)'
    const pick = (await h.q<{ id: string; session: string; subject: string }>(
      `select qa.id::text as id, qa.practice_session_id::text as session, pa.subject_id::text as subject
       from staging_cloud.question_attempts qa join practice_answers pa on pa.legacy_source = 'cloud' and pa.legacy_id = qa.id::text
       where pa.subject_id is not null order by qa.id limit 1`,
    ))[0]
    expect(pick, 'the fixture must give a loaded answer').toBeTruthy()
    const qid = (await h.q<{ q: string }>(`select question_id::text as q from staging_cloud.question_attempts where id = $1`, [pick?.id]))[0]?.q
    await h.q(`delete from archive_cloud.questions where id = $1`, [qid])
    await h.q(`delete from staging_cloud.practice_sessions where id = $1`, [pick?.session])
    const ok = await runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud' })
    expect(ok.checks.find((c) => c.name === name)?.status).toBe('ok')
    // A genuinely wrong subject on the loaded answer still fails.
    const other = (await h.q<{ id: string }>(`select id::text from subjects where id <> $1 order by id limit 1`, [pick?.subject]))[0]?.id
    expect(other, 'a second subject must exist').toBeTruthy()
    await h.q(`update practice_answers set subject_id = $2 where legacy_source = 'cloud' and legacy_id = $1`, [pick?.id, other])
    const bad = await runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud' })
    expect(bad.checks.find((c) => c.name === name)?.status).toBe('mismatch')
    await h.q(`update practice_answers set subject_id = $2 where legacy_source = 'cloud' and legacy_id = $1`, [pick?.id, pick?.subject])
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
