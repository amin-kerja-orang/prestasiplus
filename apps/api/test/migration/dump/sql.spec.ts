import { chmodSync, existsSync, linkSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import type { ColumnSpec, ColumnType, TableSpec } from '../../../src/migration/ddl/spec'
import { DumpUsageError, ExportStreamError, WipeRefusedError } from '../../../src/migration/dump/errors'
import {
  assertDatetimeOffset,
  assertIdentifier,
  buildCountSql,
  buildDumpSql,
  buildMetaSql,
  buildPlan,
  parseCounts,
  parseMeta,
  type SchemaInfo,
  type SourceColumn,
} from '../../../src/migration/dump/export-sql'
import { evaluateGrants } from '../../../src/migration/dump/grants'
import { loadOptionFile, parseOptionText } from '../../../src/migration/dump/option-file'
import { splitExport } from '../../../src/migration/dump/split'
import { wipeDir } from '../../../src/migration/dump/wipe'
import { PASSWORD, scratch } from './helpers'

const work = scratch()
afterAll(() => work.cleanup())

const col = (name: string, type: ColumnType, redact = false): ColumnSpec => ({ name, type, enum: false, fk: null, redact })
const spec = (name: string, columns: ColumnSpec[], pk: string | null = 'id'): TableSpec => ({ name, group: 'staging', pk, columns })

function schemaOf(tables: Record<string, [string, string][]>, flavor: 'mysql' | 'mariadb' = 'mysql'): SchemaInfo {
  return {
    version: flavor === 'mariadb' ? '10.11.6-MariaDB' : '8.0.36',
    flavor,
    hasDatabase: true,
    timeZone: { session: 'SYSTEM', global: 'SYSTEM', system: 'UTC' },
    grantLines: [],
    tables: new Map(Object.entries(tables).map(([t, cols]) => [t, { type: 'BASE TABLE', columns: cols.map(([name, type]): SourceColumn => ({ name, type })) }])),
    unprintableTables: 0,
  }
}

describe('SQL generation', () => {
  const things = spec('things', [
    col('id', 'id'),
    col('name', 't'),
    col('flag', 't'),
    col('born', 'd'),
    col('seen_at', 'ts'),
    col('made_at', 'ts'),
    col('details', 'j'),
    col('legacy_details', 'j'),
    col('blob_col', 't'),
    col('remember_token', 't', true),
    col('not_in_source', 't'),
  ])
  const source = schemaOf({
    things: [
      ['id', 'bigint'],
      ['name', 'varchar'],
      ['flag', 'tinyint'],
      ['born', 'date'],
      ['seen_at', 'datetime'],
      ['made_at', 'timestamp'],
      ['details', 'json'],
      ['legacy_details', 'longtext'],
      ['blob_col', 'longblob'],
      ['remember_token', 'varchar'],
      ['national_id_secret', 'varchar'],
    ],
  })

  it('quotes identifiers, emits the documented expressions and never selects a source-only column', () => {
    const [plan] = buildPlan(source, [things], { datetimeOffset: '+08:00' })
    const sql = buildDumpSql([plan as never])
    expect(sql).toContain("SET SESSION time_zone = '+00:00';")
    expect(sql).toContain('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;')
    expect(sql).toContain('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY;')
    expect(sql.trimEnd().endsWith("COMMIT;\nSELECT '#PP-END';")).toBe(true)
    expect(sql).toContain("SELECT '#PP-TABLE things';")
    expect(sql).toContain('SELECT COUNT(*) FROM `things`;')
    expect(sql).toContain("'seen_at', IF(YEAR(`seen_at`) = 0 OR MONTH(`seen_at`) = 0 OR DAY(`seen_at`) = 0, NULL, DATE_FORMAT(`seen_at`, '%Y-%m-%dT%H:%i:%s.%f+08:00'))")
    expect(sql).toContain("DATE_FORMAT(`made_at`, '%Y-%m-%dT%H:%i:%s.%fZ')")
    expect(sql).toContain("DATE_FORMAT(`born`, '%Y-%m-%d')")
    expect(sql).toContain("'details', `details`")
    expect(sql).toContain("'legacy_details', CAST(IF(JSON_VALID(`legacy_details`), `legacy_details`, NULL) AS JSON)")
    expect(sql).toContain("'blob_col', REPLACE(TO_BASE64(`blob_col`), CHAR(10 USING utf8mb4), '')")
    expect(sql).toContain("'flag', `flag`")
    expect(sql).toContain("'remember_token', NULL")
    expect(sql).not.toContain('`remember_token`')
    expect(sql).toContain("SELECT '#PP-JSONBAD legacy_details';")
    expect(sql).toContain('ORDER BY `id`;')
    // PDPA minimisation: a source-only column is never in the SQL, a spec-only one is reported.
    expect(sql).not.toContain('national_id_secret')
    expect(sql).not.toContain('not_in_source')
    expect(plan?.sourceOnly).toEqual(['national_id_secret'])
    expect(plan?.missingInSource).toEqual(['not_in_source'])
    expect(plan?.redacted).toEqual(['remember_token'])
    expect(plan?.notes.join('\n')).toMatch(/longblob column exported as base64/i)
    expect(plan?.notes.join('\n')).toMatch(/DATETIME has no time zone/)
  })

  it('uses the given datetime offset, and JSON_COMPACT on MariaDB', () => {
    const [plan] = buildPlan(schemaOf({ things: [['id', 'bigint'], ['seen_at', 'datetime'], ['legacy_details', 'longtext']] }, 'mariadb'), [things], { datetimeOffset: '-05:30' })
    const sql = buildDumpSql([plan as never])
    expect(sql).toContain('.%f-05:30')
    expect(sql).toContain('IF(JSON_VALID(`legacy_details`), JSON_COMPACT(`legacy_details`), NULL)')
    expect(sql).not.toContain('AS JSON')
  })

  it('reports absent tables and views, and honours --tables', () => {
    const other = spec('other', [col('id', 'id'), col('x', 't')])
    const s = schemaOf({ things: [['id', 'bigint']] })
    s.tables.set('other', { type: 'VIEW', columns: [{ name: 'id', type: 'bigint' }] })
    const plans = buildPlan(s, [things, other, spec('gone', [col('id', 'id')])], { datetimeOffset: '+08:00' })
    expect(plans.map((p) => [p.name, p.present, p.absentReason])).toEqual([['things', true, undefined], ['other', false, 'view'], ['gone', false, 'absent']])
    expect(buildPlan(s, [things, other], { datetimeOffset: '+08:00', only: ['other'] }).map((p) => p.name)).toEqual(['other'])
    expect(buildDumpSql(plans)).not.toContain('`other`')
  })

  it('refuses a hostile identifier or offset and builds no SQL from it', () => {
    expect(() => assertIdentifier('users`; DROP TABLE users; --')).toThrow(DumpUsageError)
    expect(() => buildPlan(schemaOf({ evil: [['id', 'bigint']] }), [spec('evil`x', [col('id', 'id')])], { datetimeOffset: '+08:00' })).toThrow(DumpUsageError)
    expect(() => buildPlan(schemaOf({ t: [['id', 'bigint']] }), [spec('t', [col("id'); DROP", 'id')])], { datetimeOffset: '+08:00' })).toThrow(DumpUsageError)
    for (const bad of ['08:00', '+8:00', "+08:00'; --", '+15:00', '+08:60', '', 'Z']) expect(() => assertDatetimeOffset(bad), bad).toThrow(DumpUsageError)
    for (const ok of ['+08:00', '-05:30', '+00:00', '+14:00']) expect(assertDatetimeOffset(ok)).toBe(ok)
  })

  it('does not select a hostile source column name (it is skipped when the metadata is parsed)', () => {
    const lines = [
      '#PP-VERSION', '8.0.36', '#PP-DATABASE', 'pp', '#PP-TZ', 'SYSTEM\tSYSTEM\tUTC', '#PP-GRANTS', 'GRANT USAGE ON *.* TO `r`@`%`',
      '#PP-TABLES', 'things\tBASE TABLE', 'evil`; DROP\tBASE TABLE',
      '#PP-COLUMNS', 'things\tid\tbigint', 'things\tx`; DROP TABLE things; --\tvarchar', '#PP-END',
    ]
    const s = parseMeta(lines)
    expect(s.unprintableTables).toBe(1)
    expect([...s.tables.keys()]).toEqual(['things'])
    expect(s.tables.get('things')?.columns).toEqual([{ name: 'id', type: 'bigint' }])
  })

  it('parses the metadata and counts, and refuses a cut-off stream', () => {
    expect(buildMetaSql()).toContain('SHOW GRANTS FOR CURRENT_USER();')
    expect(buildMetaSql()).not.toMatch(/FROM `?(users|things)/)
    const lines = ['#PP-VERSION', '10.6.12-MariaDB', '#PP-DATABASE', 'NULL', '#PP-TZ', '+00:00\tSYSTEM\tUTC', '#PP-GRANTS', '#PP-TABLES', '#PP-COLUMNS', '#PP-END']
    const s = parseMeta(lines)
    expect(s.flavor).toBe('mariadb')
    expect(s.hasDatabase).toBe(false)
    expect(s.timeZone).toEqual({ session: '+00:00', global: 'SYSTEM', system: 'UTC' })
    expect(() => parseMeta(lines.slice(0, -1))).toThrow(DumpUsageError)
    expect(parseCounts(['#PP-COUNTS', '#PP-TABLE a', '12', '#PP-TABLE b', '0', '#PP-END'])).toEqual(new Map([['a', 12], ['b', 0]]))
    expect(() => parseCounts(['#PP-COUNTS', '#PP-TABLE a', '12'])).toThrow(DumpUsageError)
    expect(buildCountSql(buildPlan(source, [things], { datetimeOffset: '+08:00' }))).toContain('SELECT COUNT(*) FROM `things`;')
  })
})

describe('grant check', () => {
  const ok = (lines: string[]) => evaluateGrants(lines)

  it('accepts read-only accounts in the MySQL 8, MySQL 5.7 and MariaDB formats', () => {
    expect(ok(['GRANT USAGE ON *.* TO `reader`@`%`', 'GRANT SELECT, SHOW VIEW ON `pp`.* TO `reader`@`%`']).readOnly).toBe(true)
    expect(ok(["GRANT USAGE ON *.* TO 'reader'@'%' IDENTIFIED BY PASSWORD '*0123456789ABCDEF0123456789ABCDEF01234567'", "GRANT SELECT ON `pp`.* TO 'reader'@'%'"]).readOnly).toBe(true)
    expect(ok(['GRANT SHOW DATABASES, PROCESS, REPLICATION CLIENT ON *.* TO `reader`@`%`', 'GRANT SELECT ON `pp`.* TO `reader`@`%`']).readOnly).toBe(true)
    expect(ok(['GRANT BINLOG MONITOR ON *.* TO `reader`@`%` IDENTIFIED BY PASSWORD \'*00\'', 'GRANT SELECT ON `pp`.`users` TO `reader`@`%`']).readOnly).toBe(true)
    // column-level SELECT and table names that contain the word ON
    expect(ok(['GRANT SELECT (`id`, `name on x`) ON `pp`.`users` TO `reader`@`%`']).readOnly).toBe(true)
    // a partial revoke only narrows the account
    expect(ok(['GRANT SELECT ON *.* TO `reader`@`%`', "REVOKE SELECT ON `mysql`.* FROM `reader`@`%`"]).readOnly).toBe(true)
    expect(ok(['GRANT SELECT ON `pp`.* TO `reader`@`%`']).privileges).toEqual(['SELECT'])
  })

  it.each([
    ['ALL PRIVILEGES', ['GRANT ALL PRIVILEGES ON `pp`.* TO `u`@`%`'], 'ALL PRIVILEGES'],
    ['ALL', ['GRANT ALL ON *.* TO `u`@`%`'], 'ALL PRIVILEGES'],
    ['INSERT next to SELECT', ['GRANT SELECT, INSERT ON `pp`.* TO `u`@`%`'], 'INSERT'],
    ['UPDATE', ['GRANT SELECT, UPDATE ON `pp`.* TO `u`@`%`'], 'UPDATE'],
    ['DELETE', ['GRANT DELETE ON `pp`.* TO `u`@`%`'], 'DELETE'],
    ['DDL', ['GRANT CREATE, DROP, ALTER, INDEX ON `pp`.* TO `u`@`%`'], 'ALTER'],
    ['REFERENCES', ['GRANT REFERENCES ON `pp`.* TO `u`@`%`'], 'REFERENCES'],
    ['EXECUTE and routines', ['GRANT EXECUTE, CREATE ROUTINE, ALTER ROUTINE ON `pp`.* TO `u`@`%`'], 'EXECUTE'],
    ['TRIGGER, EVENT', ['GRANT TRIGGER, EVENT ON `pp`.* TO `u`@`%`'], 'TRIGGER'],
    ['FILE', ['GRANT FILE ON *.* TO `u`@`%`'], 'FILE'],
    ['SUPER', ['GRANT SUPER ON *.* TO `u`@`%`'], 'SUPER'],
    ['CREATE USER, RELOAD, SHUTDOWN', ['GRANT CREATE USER, RELOAD, SHUTDOWN ON *.* TO `u`@`%`'], 'SHUTDOWN'],
    ['temporary tables', ['GRANT CREATE TEMPORARY TABLES ON `pp`.* TO `u`@`%`'], 'CREATE TEMPORARY TABLES'],
    ['LOCK TABLES', ['GRANT SELECT, LOCK TABLES ON `pp`.* TO `u`@`%`'], 'LOCK TABLES'],
    ['dynamic privilege', ['GRANT SELECT, BINLOG_ADMIN ON *.* TO `u`@`%`'], 'BINLOG_ADMIN'],
    ['GRANT OPTION (MySQL 8)', ['GRANT SELECT ON `pp`.* TO `u`@`%` WITH GRANT OPTION'], 'GRANT OPTION'],
    ['GRANT OPTION (MariaDB)', ["GRANT USAGE ON *.* TO `u`@`%` IDENTIFIED BY PASSWORD '*00' WITH GRANT OPTION", 'GRANT SELECT ON `pp`.* TO `u`@`%`'], 'GRANT OPTION'],
    ['column-level write', ['GRANT SELECT (`id`), UPDATE (`name`) ON `pp`.`users` TO `u`@`%`'], 'UPDATE'],
    ['PROXY', ["GRANT PROXY ON ''@'' TO 'u'@'%'"], 'PROXY'],
  ])('refuses %s', (_name, lines, privilege) => {
    const v = ok(lines)
    expect(v.readOnly).toBe(false)
    expect(v.refused).toContain(privilege)
  })

  it('refuses a role grant, unknown lines and an empty list (unverifiable)', () => {
    expect(ok(['GRANT SELECT ON `pp`.* TO `u`@`%`', 'GRANT `analyst`@`%` TO `u`@`%`'])).toMatchObject({ readOnly: false, unverifiable: 1 })
    expect(ok(['GRANT SELECT ON `pp`.* TO `u`@`%`', 'something unexpected'])).toMatchObject({ readOnly: false, unverifiable: 1 })
    expect(ok([])).toMatchObject({ readOnly: false, unverifiable: 1 })
  })
})

describe('option file', () => {
  const env = (file?: string) => ({ CLOUD_MYSQL_DEFAULTS_FILE: file })
  const write = (path: string, text: string, mode = 0o600) => {
    writeFileSync(path, text, { mode })
    chmodSync(path, mode)
    return path
  }
  const GOOD = `[client]\nhost=db.example.test\nuser=cloud_reader\npassword=${PASSWORD}\ndatabase=pp\nssl-mode=VERIFY_IDENTITY\n`

  it('accepts a 600 file outside the repository and collects the secrets', () => {
    const f = write(work.outside('ok.cnf'), GOOD)
    const o = loadOptionFile(env(f), 'linux')
    expect(o.path).toBe(f)
    expect(o.secrets).toContain(PASSWORD)
    expect(o.secrets).toContain('cloud_reader')
    expect(o.warnings).toEqual([])
  })

  it('refuses: not set, missing, inside the repository, group/other readable, !include', () => {
    expect(() => loadOptionFile(env(), 'linux')).toThrow(/not set/)
    expect(() => loadOptionFile(env(work.outside('nope.cnf')), 'linux')).toThrow(/readable file/)
    expect(() => loadOptionFile(env(write(work.out('in-repo.cnf'), GOOD)), 'linux')).toThrow(/inside the repository/)
    expect(() => loadOptionFile(env(write(work.outside('loose.cnf'), GOOD, 0o644)), 'linux')).toThrow(/chmod 600/)
    expect(() => loadOptionFile(env(write(work.outside('inc.cnf'), `${GOOD}!include /etc/other.cnf\n`)), 'linux')).toThrow(/!include/)
  })

  it('on Windows the mode is not checked but a warning is given; a remote host without ssl-mode warns', () => {
    const f = write(work.outside('win.cnf'), '[client]\nhost=db.example.test\npassword=abc\n', 0o644)
    const o = loadOptionFile(env(f), 'win32')
    expect(o.warnings.join('\n')).toMatch(/not enforced on Windows/)
    expect(o.warnings.join('\n')).toMatch(/ssl-mode/)
  })

  it('parses quotes, comments and groups', () => {
    const { values } = parseOptionText('# c\n[mysqld]\npassword=nope\n[client]\nuser = "a b"\npassword = \'p#w\'\nssl_mode=REQUIRED\n')
    expect(values.get('user')).toBe('a b')
    expect(values.get('password')).toBe('p#w')
    expect(values.get('ssl-mode')).toBe('REQUIRED')
  })
})

describe('splitter', () => {
  const things = spec('things', [col('id', 'id'), col('name', 't')])
  const others = spec('others', [col('id', 'id')])
  const plans = buildPlan(schemaOf({ things: [['id', 'bigint'], ['name', 'varchar']], others: [['id', 'bigint']] }), [things, others], { datetimeOffset: '+08:00' })
  async function* lines(...l: string[]) {
    for (const x of l) yield x
  }
  const fresh = (name: string) => {
    const d = work.out(name)
    mkdirSync(d, { recursive: true })
    return d
  }

  it('writes each line verbatim (bigint precision kept) when the counts match', async () => {
    const dir = fresh('split-ok')
    const big = '{"id":9007199254740993,"name":"a\\nb"}'
    const r = await splitExport(lines('#PP-TABLE things', '2', big, '{"id":2,"name":null}', '#PP-TABLE others', '0', '#PP-END'), plans, dir)
    expect(r.tables).toEqual([
      { table: 'things', rows: 2, file: 'things.ndjson', bytes: expect.any(Number) },
      { table: 'others', rows: 0, bytes: 0 },
    ])
    expect(readFileSync(join(dir, 'things.ndjson'), 'utf8')).toBe(`${big}\n{"id":2,"name":null}\n`)
    expect(existsSync(join(dir, 'others.ndjson'))).toBe(false)
    expect(statSync(join(dir, 'things.ndjson')).mode & 0o777).toBe(0o600)
  })

  it('records the invalid-JSON counts', async () => {
    const dir = fresh('split-bad')
    const r = await splitExport(lines('#PP-TABLE things', '1', '#PP-JSONBAD name', '4', '{"id":1,"name":null}', '#PP-TABLE others', '0', '#PP-END'), plans, dir)
    expect(r.invalidJson).toEqual({ things: { name: 4 } })
  })

  it('fails on a row-count mismatch', async () => {
    const dir = fresh('split-count')
    await expect(splitExport(lines('#PP-TABLE things', '3', '{"id":1}', '#PP-TABLE others', '0', '#PP-END'), plans, dir)).rejects.toThrow(/counted 3 rows but 1 were exported/)
  })

  it('fails on a line that is not a JSON object, without echoing it', async () => {
    const secret = 'PERSONAL-VALUE-123'
    for (const bad of [`{"id":1,"name":"${secret}`, 'NULL', '[1,2]', '12', '']) {
      const e = await splitExport(lines('#PP-TABLE things', '1', bad, '#PP-TABLE others', '0', '#PP-END'), plans, fresh(`split-json-${bad.length}`)).catch((x: unknown) => x)
      expect(e).toBeInstanceOf(ExportStreamError)
      expect(String((e as Error).message)).not.toContain(secret)
    }
  })

  it('fails on a truncated stream, an unexpected table, text before the first marker and a non-numeric count', async () => {
    const run = (...l: string[]) => splitExport(lines(...l), plans, fresh(`split-x-${Math.random().toString(16).slice(2)}`))
    await expect(run('#PP-TABLE things', '1', '{"id":1}')).rejects.toThrow(/before its end marker/)
    await expect(run('#PP-TABLE others', '0', '#PP-END')).rejects.toThrow(/not asked for/)
    await expect(run('{"id":1}')).rejects.toThrow(/before the first table marker/)
    await expect(run('#PP-TABLE things', 'x', '#PP-END')).rejects.toThrow(/row count was expected/)
    await expect(run('#PP-TABLE things', '0', '#PP-END')).rejects.toThrow(/covered 1 of 2/)
    await expect(run('#PP-TABLE things', '0', '#PP-TABLE others', '0', '#PP-END', '{"id":1}')).rejects.toThrow(/after its end marker/)
  })
})

describe('wipe', () => {
  it('overwrites with zeros (seen through a hard link), unlinks and removes the directories', async () => {
    const dir = work.out('wipe-ok')
    mkdirSync(join(dir, 'sub'), { recursive: true })
    writeFileSync(join(dir, 'a.ndjson'), 'x'.repeat(3 * 1024 * 1024 + 7))
    writeFileSync(join(dir, 'sub', 'b.txt'), 'secret')
    const keep = work.out('wipe-keep')
    linkSync(join(dir, 'a.ndjson'), keep)
    const r = await wipeDir(dir)
    expect(r).toMatchObject({ files: 2, dirs: 2 })
    expect(existsSync(dir)).toBe(false)
    const left = readFileSync(keep)
    expect(left.length).toBe(3 * 1024 * 1024 + 7)
    expect(left.every((b) => b === 0)).toBe(true)
  })

  it('refuses a symlink target, a symlink inside (deleting nothing), a path outside .migration-out and the folder itself', async () => {
    const real = work.out('wipe-real')
    mkdirSync(real, { recursive: true })
    writeFileSync(join(real, 'f.txt'), 'data')
    const link = work.out('wipe-link')
    symlinkSync(real, link)
    await expect(wipeDir(link)).rejects.toThrow(WipeRefusedError)

    const dir = work.out('wipe-inner-link')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'first.txt'), 'data')
    symlinkSync(join(real, 'f.txt'), join(dir, 'zz-link'))
    await expect(wipeDir(dir)).rejects.toThrow(/symbolic link/)
    expect(readFileSync(join(dir, 'first.txt'), 'utf8')).toBe('data')
    expect(readFileSync(join(real, 'f.txt'), 'utf8')).toBe('data')

    const outside = work.outside('not-migration-out')
    mkdirSync(outside)
    await expect(wipeDir(outside)).rejects.toThrow(/strictly inside/)
    const root = work.out('.')
    await expect(wipeDir(join(root, '..'))).rejects.toThrow(WipeRefusedError)
    await expect(wipeDir(work.out('missing'))).rejects.toThrow(/does not exist/)
    await expect(wipeDir(work.out('missing'), { missingOk: true })).resolves.toEqual({ files: 0, bytes: 0, dirs: 0 })
  })
})
