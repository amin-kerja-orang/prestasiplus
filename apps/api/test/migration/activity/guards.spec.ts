/**
 * `migrate:activity` guards against a real PostgreSQL (Testcontainers) on the BE-35 synthetic fixture:
 * apply needs its switch, production needs the right database, apply needs a passing dry-run on the same input,
 * the BE-28 preflight, and the source database variable is never read.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runCli } from '../../../src/migration/cli'
import { ApplyGuardError, ApplyRefusedError } from '../../../src/migration/kit'
import { SyntheticDataRefusedError } from '../../../src/migration/load'
import '../../../src/migration/load/activity/command'
import { PreflightError } from '../../../src/migration/load/activity'
import { activityInputHash, tableFingerprints } from '../../../src/migration/load/activity/preflight'
import { capture, testOutDir } from '../staging/helpers'
import { bootActivity, PROBE_TABLE, type ActivityHarness } from './helpers'

let h: ActivityHarness
let bare: ActivityHarness

beforeAll(async () => {
  h = await bootActivity()
  bare = await bootActivity({ core: false })
}, 300_000)
afterAll(async () => {
  await h?.close()
  await bare?.close()
})

/** An environment that fails the test the moment anything reads CLOUD_SOURCE_URL (or lists it). */
function guardedEnv(base: Record<string, string>): Record<string, string | undefined> {
  const reads: string[] = []
  const env = new Proxy(base as Record<string, string | undefined>, {
    get(target, prop) {
      if (prop === 'CLOUD_SOURCE_URL') {
        reads.push('get')
        throw new Error('CLOUD_SOURCE_URL was read')
      }
      return target[prop as string]
    },
    has(target, prop) {
      if (prop === 'CLOUD_SOURCE_URL') reads.push('has')
      return prop in target
    },
  })
  Object.defineProperty(env, '__reads', { value: reads, enumerable: false })
  return env
}

describe('apply guards', () => {
  it('refuses --apply without PP_ALLOW_MIGRATE_APPLY, before any work', async () => {
    await expect(h.run('apply', { env: { ...h.runEnv, PP_ALLOW_MIGRATE_APPLY: '0' } })).rejects.toBeInstanceOf(ApplyGuardError)
    expect(await h.count(PROBE_TABLE)).toBe(0)
    expect(await h.count('etl_runs', `mode = 'apply' and entity_set @> array['act_probe_wallets']::text[]`)).toBe(0)
  })

  it('refuses --apply in production when PP_MIGRATE_TARGET_DB is not this database', async () => {
    const env = { ...h.runEnv, NODE_ENV: 'production', PP_MIGRATE_TARGET_DB: 'some_other_database' }
    await expect(h.run('apply', { env })).rejects.toBeInstanceOf(ApplyGuardError)
    await expect(h.run('apply', { env: { ...env, PP_MIGRATE_TARGET_DB: undefined as unknown as string } })).rejects.toBeInstanceOf(ApplyGuardError)
    expect(await h.count(PROBE_TABLE)).toBe(0)
  })

  it('passes the database guard with the right target, then still refuses synthetic data in production', async () => {
    const env = { ...h.runEnv, NODE_ENV: 'production', PP_MIGRATE_TARGET_DB: h.env.db.name }
    // A staged BE-35 dummy password marker: the second guard must refuse it (same setup as the BE-28 spec).
    const original = (await h.q<{ password: string }>('select password from staging_cloud.users where id = 1'))[0]?.password as string
    await h.q(`update staging_cloud.users set password = 'not-a-hash-anonymised' where id = 1`)
    try {
      await expect(h.run('apply', { env })).rejects.toBeInstanceOf(SyntheticDataRefusedError)
      await expect(h.run('dry-run', { env })).rejects.toBeInstanceOf(SyntheticDataRefusedError)
    } finally {
      await h.q('update staging_cloud.users set password = $1 where id = 1', [original])
    }
    expect(await h.count(PROBE_TABLE)).toBe(0)
  })

  it('refuses --apply without a passing dry-run on the same input', async () => {
    await expect(h.run('apply')).rejects.toBeInstanceOf(ApplyRefusedError)
    expect(await h.count(PROBE_TABLE)).toBe(0)
    // A dry-run on another --as-of is another input: it does not authorise this apply.
    const dry = await h.run('dry-run', { asOf: '2026-07-01' })
    expect(dry.report.status).toBe('succeeded')
    await expect(h.run('apply')).rejects.toBeInstanceOf(ApplyRefusedError)
    expect(await h.count(PROBE_TABLE)).toBe(0)
  })

  it('maps the guard and the refusal to the kit exit codes through the CLI', async () => {
    const out = capture()
    const noSwitch = await runCli(['migrate:activity', '--apply', '--as-of=2026-06-01', '--core-as-of=2026-06-01'], {
      pool: h.env.pool, env: { ...h.runEnv, PP_ALLOW_MIGRATE_APPLY: '0' }, out: out.out, err: out.err,
    })
    expect(noSwitch).toBe(2)
    const noDry = await runCli(['migrate:activity', '--apply', '--as-of=2026-06-02', '--core-as-of=2026-06-01'], {
      pool: h.env.pool, env: h.runEnv, out: out.out, err: out.err,
    })
    expect(noDry).toBe(3)
  })
})

describe('input hash', () => {
  const hashOf = (contentOwnerUserId?: string) =>
    activityInputHash({ pool: h.env.pool, source: 'cloud', asOf: '2026-06-01', stepNames: ['tiers'], contentOwnerUserId })

  it('depends on --content-owner: a dry-run without an owner does not authorise an apply with one', async () => {
    const none = await hashOf()
    expect(await hashOf()).toBe(none)
    expect(await hashOf('  ')).toBe(none)
    const a = await hashOf('7')
    expect(a).not.toBe(none)
    expect(await hashOf('8')).not.toBe(a)
    expect(await hashOf(' 7 ')).toBe(a)
  })

  it('depends on the sanitiser origins (PUBLIC_ORIGINS): other origins differ, the same set in another order or form does not', async () => {
    const withOrigins = (publicOrigins?: string) =>
      activityInputHash({ pool: h.env.pool, source: 'cloud', asOf: '2026-06-01', stepNames: ['tiers'], publicOrigins })
    const none = await withOrigins()
    expect(await withOrigins('')).toBe(none)
    expect(await withOrigins(' , ')).toBe(none)
    const ab = await withOrigins('https://a.example.test,https://b.example.test')
    expect(ab).not.toBe(none)
    expect(await withOrigins('https://a.example.test')).not.toBe(ab)
    expect(await withOrigins('https://c.example.test,https://b.example.test')).not.toBe(ab)
    expect(await withOrigins(' https://b.example.test/path , https://a.example.test,https://a.example.test ')).toBe(ab)
  })

  it('fingerprints a table in constant memory: count plus a digest that is deterministic and order independent', async () => {
    const first = await tableFingerprints(h.env.pool, ['users', 'archive_cloud.questions'])
    expect(await tableFingerprints(h.env.pool, ['archive_cloud.questions', 'users', 'users'])).toEqual(first)
    const users = first.find((p) => p.startsWith('users='))
    expect(users).toMatch(/^users=\d+:\d+$/)
    // The digest is the sum of the per-row digests: it is the same whatever order the rows are read in, and it changes with the rows.
    const sumOfRows = (await h.q<{ h: string }>(
      `select sum(('x' || substr(md5(coalesce("_row_hash", '')), 1, 15))::bit(60)::bigint::numeric)::text as h from staging_cloud.users`,
    ))[0]?.h
    expect(users?.split(':')[1]).toBe(sumOfRows)
    await h.q(`update staging_cloud.users set "_row_hash" = "_row_hash" || 'x' where id = (select min(id) from staging_cloud.users)`)
    try {
      expect(await tableFingerprints(h.env.pool, ['users'])).not.toEqual([users])
    } finally {
      await h.q(`update staging_cloud.users set "_row_hash" = left("_row_hash", length("_row_hash") - 1) where id = (select min(id) from staging_cloud.users)`)
    }
    expect(await tableFingerprints(h.env.pool, ['users'])).toEqual([users])
  })
})

describe('preflight (BE-28 first)', () => {
  it('refuses to start when migrate:core never ran: no mapped users', async () => {
    await expect(bare.run('dry-run')).rejects.toBeInstanceOf(PreflightError)
    await expect(bare.run('dry-run')).rejects.toThrow(/migrate:core --apply/)
    await expect(bare.run('apply')).rejects.toBeInstanceOf(PreflightError)
  })

  it('refuses after a BE-28 dry-run alone (no succeeded apply)', async () => {
    const { runCore } = await import('../../../src/migration/load')
    const dry = await runCore({ pool: bare.env.pool, env: bare.runEnv, source: 'cloud', asOf: '2026-06-01', mode: 'dry-run', batchSize: 2 })
    expect(dry.report.status).toBe('succeeded')
    await expect(bare.run('dry-run')).rejects.toThrow(/migrate:core --apply/)
  })

  it('refuses when the staged data changed after migrate:core --apply', async () => {
    const before = await h.run('dry-run') // passes now
    expect(before.report.status).toBe('succeeded')
    await h.q(`delete from staging_cloud.parent_student where parent_id = (select min(parent_id) from staging_cloud.parent_student)`)
    await expect(h.run('dry-run')).rejects.toBeInstanceOf(PreflightError)
  })
})

describe('the source database is never touched', () => {
  it('does not read CLOUD_SOURCE_URL in a dry-run, an apply or the CLI', async () => {
    // Fresh data for this test: re-stage the rows the previous test deleted by using the second harness.
    const env = guardedEnv({ ...bare.runEnv, CLOUD_SOURCE_URL: 'postgresql://never:read@127.0.0.1:1/none' })
    const { runCore } = await import('../../../src/migration/load')
    await runCore({ pool: bare.env.pool, env: bare.runEnv, source: 'cloud', asOf: '2026-06-01', mode: 'apply', batchSize: 2, outDir: testOutDir() })
    const dry = await bare.run('dry-run', { env })
    expect(dry.report.status).toBe('succeeded')
    const out = capture()
    const code = await runCli(['migrate:activity', '--as-of=2026-06-01', '--core-as-of=2026-06-01'], {
      pool: bare.env.pool, env, out: out.out, err: out.err,
    })
    expect(code).toBe(0)
    expect((env as unknown as { __reads: string[] }).__reads).toEqual([])
  })
})
