import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ANON_EXIT, runAnonymiseCli } from '../../../src/migration/anonymise/cli'
import { TABLES } from '../../../src/migration/ddl/spec'
import { writeFixture } from '../../../src/migration/fixtures/cli'
import {
  type AnomalyManifest,
  UNKNOWN_COIN_TYPE,
  UNKNOWN_MODE,
  UNKNOWN_ROLE,
} from '../../../src/migration/fixtures/generate'
import { collectProfile, type ProfileReport } from '../../../src/migration/profile'
import { runStagingCli, STAGING_EXIT } from '../../../src/migration/staging/cli'
import { loadStaging } from '../../../src/migration/staging/load'
import { DirReader } from '../../../src/migration/staging/readers'
import { scratch, TEST_KEY } from '../anonymise/helpers'
import { capture, createStagingDb, stagingEnv, type StagingDb } from '../staging/helpers'

/**
 * AC5 and "one shape": the generated `small` fixture AND its anonymised copy load into staging_cloud with
 * `staging:load`, and the BE-27 profiler reports the planted anomalies with counts equal to the manifest.
 * Each full load creates 127 tables, so the file shares two loads.
 */
const FULL = 180_000
const work = scratch()
let env: StagingDb
let okEnv: Record<string, string>
let anomalies: AnomalyManifest
let fixtureDir: string
let anonDir: string

beforeAll(async () => {
  env = await createStagingDb()
  okEnv = stagingEnv(env.db)
  fixtureDir = work.out('small')
  writeFixture('small', 7, fixtureDir)
  anomalies = JSON.parse(readFileSync(join(fixtureDir, 'anomalies.json'), 'utf8')) as AnomalyManifest
  anonDir = work.out('small-anon')
  const log = capture()
  const code = await runAnonymiseCli(['anonymise:run', '--source', fixtureDir, '--out', anonDir], {
    env: { ANON_HMAC_KEY: TEST_KEY },
    out: log.out,
    err: log.err,
  })
  if (code !== ANON_EXIT.ok) throw new Error(`anonymise failed: ${log.text()}`)
}, FULL)

afterAll(async () => {
  await env?.close()
  work.cleanup()
})

const orphansOf = (report: ProfileReport): Record<string, number> =>
  Object.fromEntries(report.tables.flatMap((t) => t.orphans.filter((o) => o.orphans > 0).map((o) => [`${t.table}.${o.column}`, o.orphans])))
const table = (report: ProfileReport, name: string) => report.tables.find((t) => t.table === name)!
const enumCount = (report: ProfileReport, tableName: string, column: string, value: string): number =>
  table(report, tableName).enums.find((e) => e.column === column)?.values.find((v) => v.value === value)?.count ?? 0
/**
 * M2: after anonymising, accounts whose role is not pelajar/guru/ibu_bapa hold the unusable value (class "(other)"),
 * the others keep the class of their original hash (bcrypt, argon2id) or become "(other)" for plain text.
 */
function anonymisedPrefixes(): Record<string, number> {
  const rows = readFileSync(join(fixtureDir, 'users.ndjson'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>)
  const out: Record<string, number> = {}
  for (const u of rows) {
    const p = u.password
    const role = typeof u.role === 'string' ? u.role.trim().toLowerCase() : ''
    let key: string
    if (p === null || p === undefined) key = '(null)'
    else if (p === '') key = '(empty)'
    else if (!['pelajar', 'guru', 'ibu_bapa'].includes(role)) key = '(other)'
    else key = /^\$[0-9A-Za-z]{1,10}\$/.exec(String(p))?.[0] ?? '(other)'
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}
const nullRatio = (n: number, total: number) => Math.round((1 - (total - n) / total) * 10000) / 10000

function expectPlanted(report: ProfileReport, opts: { anonymised: boolean }) {
  const expectedPrefixes = opts.anonymised ? anonymisedPrefixes() : anomalies.scanned.passwordPrefixes
  const { planted } = anomalies
  // row counts of every table equal the manifest
  expect(Object.fromEntries(report.tables.map((t) => [t.table, t.rowCount]))).toEqual(anomalies.rows)
  // orphans, per declared foreign key
  expect(orphansOf(report)).toEqual(planted.orphans)
  // duplicates
  const dups = Object.fromEntries(table(report, 'users').duplicates.map((d) => [d.check, d]))
  expect(dups['users.email']).toMatchObject({ duplicateGroups: planted.duplicateEmail.groups, rowsInDuplicateGroups: planted.duplicateEmail.rows })
  expect(dups['users.(school_id, username)']).toMatchObject({
    duplicateGroups: planted.duplicateSchoolUsername.groups,
    rowsInDuplicateGroups: planted.duplicateSchoolUsername.rows,
  })
  // password hash prefixes
  const prefixes = Object.fromEntries((table(report, 'users').hashPrefixes[0]?.prefixes ?? []).map((p) => [p.prefix, p.count]))
  expect(prefixes).toEqual(expectedPrefixes)
  // unknown enum values
  expect(enumCount(report, 'users', 'role', UNKNOWN_ROLE)).toBe(planted.unknownEnums['users.role']?.[UNKNOWN_ROLE])
  expect(enumCount(report, 'coin_transactions', 'type', UNKNOWN_COIN_TYPE)).toBe(planted.unknownEnums['coin_transactions.type']?.[UNKNOWN_COIN_TYPE])
  expect(enumCount(report, 'practice_sessions', 'mode', UNKNOWN_MODE)).toBe(planted.unknownEnums['practice_sessions.mode']?.[UNKNOWN_MODE])
  // roster users without e-mail (null ratio of users.email)
  const users = table(report, 'users')
  expect(users.nullRatios.email).toBe(nullRatio(planted.rosterNoEmail, users.rowCount))
  // data minimisation: the loader writes NULL for both secrets, whatever the dump carried
  expect(users.nullRatios.remember_token).toBe(1)
  expect(users.nullRatios.parent_invite_token).toBe(1)
  expect(opts.anonymised || planted.redactedSecrets['users.remember_token']).toBeTruthy()
}

describe('the generated small fixture loads and the profiler agrees with the manifest (AC5)', () => {
  let report: ProfileReport

  it('staging:load takes the fixture directory as it is, with every row', async () => {
    const result = await loadStaging(env.pool, new DirReader(fixtureDir), { env: okEnv })
    expect(result.tables).toHaveLength(TABLES.length)
    expect(result.totalRows).toBe(Object.values(anomalies.rows).reduce((a, b) => a + b, 0))
    expect(result.tables.every((t) => t.extraColumns.length === 0)).toBe(true)
    report = await collectProfile(env.pool)
  }, FULL)

  it('the profile reports the planted anomalies with the counts of the manifest', () => {
    expectPlanted(report, { anonymised: false })
  })

  it('what the profiler cannot see: shared default hashes, date-only edges and cycles, checked in SQL', async () => {
    const { planted } = anomalies
    const shared = await env.pool.query<{ n: string }>(
      `select coalesce(sum(n), 0)::text as n from (select count(*) as n from staging_cloud.users where password is not null and password <> '' group by password having count(*) > 1) g`,
    )
    expect(Number(shared.rows[0]?.n)).toBe(planted.sharedDefaultHash)
    const edges = await env.pool.query<{ n: string }>(
      `select count(*)::text as n from staging_cloud.mood_checkins where checked_in_on <> (created_at at time zone 'Asia/Kuala_Lumpur')::date`,
    )
    expect(Number(edges.rows[0]?.n)).toBe(planted.dateOnlyEdges.mood_checkins)
    const claimed = await env.pool.query<{ n: string }>(
      `select count(*)::text as n from staging_cloud.challenge_user where claimed_on <> (completed_at at time zone 'Asia/Kuala_Lumpur')::date`,
    )
    expect(Number(claimed.rows[0]?.n)).toBe(planted.dateOnlyEdges.challenge_user)
    const pairs = await env.pool.query<{ n: string }>(
      `select count(*)::text as n from staging_cloud.users a join staging_cloud.users b on a.referred_by = b.id and b.referred_by = a.id and a.id < b.id`,
    )
    expect(Number(pairs.rows[0]?.n)).toBe(planted.referralCycles.pairs)
    const selfRefs = await env.pool.query<{ n: string }>(`select count(*)::text as n from staging_cloud.users where referred_by = id`)
    expect(Number(selfRefs.rows[0]?.n)).toBe(planted.referralCycles.selfReferences)
    const dupPivot = await env.pool.query<{ n: string }>(
      `select (count(*) - count(distinct (classroom_id, student_id)))::text as n from staging_cloud.classroom_student`,
    )
    expect(Number(dupPivot.rows[0]?.n)).toBe(planted.duplicatePivotRows.classroom_student)
  })
})

describe('the anonymised copy has the same shape (plan 14.8 "one shape")', () => {
  let report: ProfileReport

  it('staging:load takes the anonymised directory and the row counts are unchanged', async () => {
    const result = await loadStaging(env.pool, new DirReader(anonDir), { env: okEnv })
    expect(result.totalRows).toBe(Object.values(anomalies.rows).reduce((a, b) => a + b, 0))
    report = await collectProfile(env.pool)
  }, FULL)

  it('orphans, duplicates (case variants included), hash classes, unknown enums and null ratios survive anonymisation', () => {
    expectPlanted(report, { anonymised: true })
  })

  it('no .invalid address, fictitious name or fixture hash is left; every user is an Nama Anon', async () => {
    const res = await env.pool.query<{ bad: string }>(
      `select count(*)::text as bad from staging_cloud.users
        where name !~ '^Nama Anon ' or email ~* 'contoh' or phone !~ '^00' or ic !~ '^[0-9]{2}00[0-9]{2}00[0-9]{4}$' or password ~ 'FFFFFFFFFF' or password ~ 'DDDDDDDDDD'`,
    )
    expect(Number(res.rows[0]?.bad)).toBe(0)
  })

  it('the date-only edges are kept (timestamps and dates are structure, not identity)', async () => {
    const edges = await env.pool.query<{ n: string }>(
      `select count(*)::text as n from staging_cloud.mood_checkins where checked_in_on <> (created_at at time zone 'Asia/Kuala_Lumpur')::date`,
    )
    expect(Number(edges.rows[0]?.n)).toBe(anomalies.planted.dateOnlyEdges.mood_checkins)
  })
})

describe('staging:profile on the loaded copy', () => {
  it('runs through the CLI and writes under .migration-out (same guard as the anonymiser)', async () => {
    const log = capture()
    const code = await runStagingCli(['staging:profile', '--out', work.out('profile')], { env: okEnv, pool: env.pool, out: log.out, err: log.err })
    expect(code, log.text()).toBe(STAGING_EXIT.ok)
  })
})
