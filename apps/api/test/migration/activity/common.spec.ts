/**
 * BE-29 shared infrastructure, no database: enum maps, the Malaysian-day SQL, the drift collector, step ordering,
 * the not-migrated list, the CLI flag rules and static scans of the activity sources (no CLOUD_SOURCE_URL, the
 * sensitive tables are named only in the not-migrated list).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type pg from 'pg'
import { describe, expect, it } from 'vitest'

import { ApplyGuardError } from '../../../src/migration/kit/apply-guard'
import type { AnyEntityStep } from '../../../src/migration/kit/runner'
import { FixedClock } from '../../../src/db/clock'
import { defaultAsOf, migrateActivity } from '../../../src/migration/load/activity/command'
import {
  ACTIVITY_GROUP_NAMES,
  ActivityContext,
  buildActivitySteps,
  DriftCollector,
  NOT_MIGRATED_ACTIVITY,
  notMigratedOf,
  type ActivityGroup,
} from '../../../src/migration/load/activity'
import { ACTIVITY_READ_TABLES } from '../../../src/migration/load/activity/preflight'
import { enumMapper, excludedResult, klDateSql, nonNegativeInt, sumBatch } from '../../../src/migration/transform/activity-common'
import { capture } from '../staging/helpers'

const API_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const REPO_ROOT = join(API_ROOT, '..', '..')

const ctxOf = () => new ActivityContext({ pool: {} as pg.Pool, env: {}, source: 'cloud', asOf: '2026-06-01' })
const step = (entity: string): AnyEntityStep => ({ entity, source: 'cloud', extract: () => [], keyOf: () => '1', load: async () => ({}) })
const group = (name: ActivityGroup['name'], entities: string[], notMigrated: ActivityGroup['notMigrated'] = []): ActivityGroup => ({
  name,
  steps: () => entities.map(step),
  notMigrated,
})

describe('migrate:activity default --as-of (OD-10 Q8)', () => {
  it('is the Malaysia calendar day, not the UTC day', () => {
    expect(defaultAsOf(new FixedClock('2026-10-21T17:00:00Z'))).toBe('2026-10-22')
    expect(defaultAsOf(new FixedClock('2026-10-21T15:59:59Z'))).toBe('2026-10-21')
    expect(defaultAsOf(new FixedClock('2026-10-21T16:00:00Z'))).toBe('2026-10-22')
  })
})

describe('enumMapper', () => {
  const map = enumMapper('status', { selesai: 'submitted', batal: 'abandoned' })
  it('maps after normalising case, spaces and dashes', () => {
    expect(map(' Selesai ')).toEqual({ ok: true, value: 'submitted' })
    expect(map('BATAL')).toEqual({ ok: true, value: 'abandoned' })
  })
  it('rejects an unknown value as UNKNOWN_ENUM with the known codes and never defaults', () => {
    expect(map('hantu')).toEqual({ ok: false, reject: { reason: 'UNKNOWN_ENUM', column: 'status', enumValue: 'hantu', allowedCodes: ['selesai', 'batal'] } })
  })
  it('rejects a blank value as INVALID_VALUE, or gives null when the column is optional', () => {
    expect(map('  ')).toEqual({ ok: false, reject: { reason: 'INVALID_VALUE', column: 'status' } })
    expect(map(null)).toMatchObject({ ok: false })
    expect(enumMapper('status', { a: 'x' }, { blankIsNull: true })(null)).toEqual({ ok: true, value: null })
  })
  it('does not treat inherited object keys as codes', () => {
    expect(map('constructor')).toMatchObject({ ok: false, reject: { reason: 'UNKNOWN_ENUM' } })
  })
})

describe('klDateSql and numbers', () => {
  it('wraps the expression in the Malaysian-day conversion', () => {
    expect(klDateSql('t.created_at')).toBe(`(t.created_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date`)
    expect(klDateSql('$1::timestamptz')).toBe(`($1::timestamptz AT TIME ZONE 'Asia/Kuala_Lumpur')::date`)
  })
  it('refuses an expression that is not a plain reference', () => {
    expect(() => klDateSql('x); drop table users; --')).toThrow(RangeError)
    expect(() => klDateSql('a; b')).toThrow(RangeError)
  })
  it('reads non-negative integers and flags the rest', () => {
    expect(nonNegativeInt('12')).toBe(12)
    expect(nonNegativeInt(' ')).toBeNull()
    expect(nonNegativeInt('-1')).toBe('invalid')
    expect(nonNegativeInt('1.5')).toBe('invalid')
  })
  it('sums batch results including the excluded counter', () => {
    expect(sumBatch({ inserted: 1 }, { updated: 2, excluded: 3 }, excludedResult(1))).toEqual({ inserted: 1, updated: 2, unchanged: 0, excluded: 4 })
  })
})

describe('DriftCollector', () => {
  it('keeps counts and surrogate ids and prints sorted lines', () => {
    const d = new DriftCollector()
    d.addId('wallet_ledger_mismatch', '42')
    d.addId('wallet_ledger_mismatch', '7')
    d.add('streak_drift', 3)
    expect(d.lines()).toEqual(['drift streak_drift: 3', 'drift wallet_ledger_mismatch: 2', 'drift ids wallet_ledger_mismatch: 42,7'])
    const out = capture()
    d.print(out.out)
    expect(out.lines).toHaveLength(3)
  })
  it('refuses an id that looks like personal data and a kind that is not a code', () => {
    const d = new DriftCollector()
    expect(() => d.addId('wallet_ledger_mismatch', 'someone@example.test')).toThrow(/personal data/)
    expect(() => d.addId('wallet_ledger_mismatch', '012-345 6789 01')).toThrow(/personal data/)
    expect(() => d.add('Ahmad bin Ali')).toThrow(RangeError)
  })
})

describe('buildActivitySteps', () => {
  const groups = [group('ops', ['feedback']), group('catalogue', ['tiers', 'achievements']), group('activity', ['practice_sessions'])]
  it('orders the groups catalogue, wallet, activity, content, ops whatever the registry order', () => {
    expect(ACTIVITY_GROUP_NAMES).toEqual(['catalogue', 'wallet', 'activity', 'content', 'ops'])
    expect(buildActivitySteps(ctxOf(), groups).map((s) => s.entity)).toEqual(['tiers', 'achievements', 'practice_sessions', 'feedback'])
  })
  it('keeps only the named entities and refuses an unknown name', () => {
    expect(buildActivitySteps(ctxOf(), groups, ['feedback', 'tiers']).map((s) => s.entity)).toEqual(['tiers', 'feedback'])
    expect(() => buildActivitySteps(ctxOf(), groups, ['nope'])).toThrow(/Unknown --table/)
  })
  it('refuses an entity registered twice', () => {
    expect(() => buildActivitySteps(ctxOf(), [group('wallet', ['x']), group('ops', ['x'])])).toThrow(/two steps/)
  })
  it('accepts an empty registry', () => {
    expect(buildActivitySteps(ctxOf(), [])).toEqual([])
  })
})

describe('not migrated list', () => {
  const tables = NOT_MIGRATED_ACTIVITY.map((n) => n.table).join(' | ')
  it('names the skipped, sensitive and unmerged tables with a reason each', () => {
    for (const t of ['gifts', 'gift_redemptions', 'lucky_draws', 'interventions', 'structured_attempts', 'mood_checkins', 'wellbeing_alerts',
      'psychometric_results', 'aspirations', 'foster_', 'pksk_', 'battles', 'game_', 'ai_usage_logs', 'notifications', 'headcounts', 'chatbot_',
      'teacher', 'review_schedules']) {
      expect(tables, t).toContain(t)
    }
    for (const n of NOT_MIGRATED_ACTIVITY) expect(n.reason.length, n.table).toBeGreaterThan(10)
  })
  it('merges the groups lists without repeating a table', () => {
    const merged = notMigratedOf([group('ops', [], [{ table: 'extra_table', reason: 'because' }, { table: 'gifts', reason: 'dup' }])])
    expect(merged.filter((n) => n.table === 'gifts')).toHaveLength(1)
    expect(merged.at(-1)).toEqual({ table: 'extra_table', reason: 'because' })
  })
})

describe('command flags', () => {
  const fakeCtx = () => ({ pool: {} as pg.Pool, env: {}, out: () => undefined, err: () => undefined })
  const args = (flags: Record<string, string | true>) => ({ mode: 'dry-run' as const, flags: new Map(Object.entries(flags)), positional: [] })

  it('refuses every storage flag: file migration is off (Q2)', async () => {
    for (const f of ['storage-dir', 'storage', 'files', 'copy-files']) {
      await expect(migrateActivity.run(args({ [f]: 'x' }), fakeCtx())).rejects.toThrow(/file migration is off \(Q2\)/)
    }
  })
  it('refuses a bad date, batch size, content owner and a report file outside .migration-out', async () => {
    await expect(migrateActivity.run(args({ 'as-of': '2026-13-45' }), fakeCtx())).rejects.toBeInstanceOf(ApplyGuardError)
    await expect(migrateActivity.run(args({ 'batch-size': '0' }), fakeCtx())).rejects.toBeInstanceOf(ApplyGuardError)
    await expect(migrateActivity.run(args({ 'content-owner': 'abc' }), fakeCtx())).rejects.toBeInstanceOf(ApplyGuardError)
    await expect(migrateActivity.run(args({ 'report-file': 'docs/report.txt' }), fakeCtx())).rejects.toThrow(/\.migration-out/)
    await expect(migrateActivity.run(args({ 'report-file': '../outside/.x/report.txt' }), fakeCtx())).rejects.toThrow()
  })
})

describe('static checks of the activity sources', () => {
  const walk = (dir: string): string[] =>
    existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])) : []
  const migration = join(API_ROOT, 'src', 'migration')
  const transformDir = join(migration, 'transform')
  const activityFiles = [
    ...walk(join(migration, 'load', 'activity')),
    ...walk(join(migration, 'snapshot-dims')),
    ...(existsSync(transformDir)
      ? readdirSync(transformDir)
          .filter((f) => /^(activity-common|practice|exam|wallet|gamification|content|support)\.ts$/.test(f))
          .map((f) => join(transformDir, f))
      : []),
  ]

  it('finds the BE-29 sources', () => {
    expect(activityFiles.length).toBeGreaterThanOrEqual(8)
  })

  it('never mentions CLOUD_SOURCE_URL or imports the cloud-source reader', () => {
    for (const f of activityFiles) {
      const text = readFileSync(f, 'utf8')
      expect(text, f).not.toMatch(/CLOUD_SOURCE_URL/)
      expect(text, f).not.toMatch(/cloud-source/)
    }
  })

  it('names the sensitive tables only in the not-migrated list', () => {
    const sensitive = /\b(mood_checkins|wellbeing_alerts|psychometric_results|aspirations|foster_applications|foster_sponsorships|interventions)\b/
    for (const f of activityFiles.filter((x) => !x.endsWith('not-migrated.ts'))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(sensitive)
    }
    for (const t of ACTIVITY_READ_TABLES) expect(t, t).not.toMatch(sensitive)
  })

  it('keeps .migration-out git-ignored (report files only go there)', () => {
    expect(readFileSync(join(REPO_ROOT, '.gitignore'), 'utf8')).toMatch(/^\.migration-out\/?$/m)
  })

  it('registers the npm script like migrate:core', () => {
    const scripts = (JSON.parse(readFileSync(join(API_ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts
    expect(scripts['migrate:activity']).toBe('tsx src/migration/load/activity/cli.ts')
    expect(scripts['migrate:core']).toBe('tsx src/migration/load/cli.ts')
  })
})
