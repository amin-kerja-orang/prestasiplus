import { chmodSync, closeSync, existsSync, linkSync, mkdirSync, openSync, readFileSync, readSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { TABLES, type ColumnSpec, type ColumnType, type TableSpec } from '../../../src/migration/ddl/spec'
import { DumpUsageError, ExportStreamError, WipeRefusedError } from '../../../src/migration/dump/errors'
import {
  assertDatetimeOffset,
  assertIdentifier,
  buildCountSql,
  buildDumpSql,
  buildMetaSql,
  buildPlan,
  buildRoleSql,
  parseCounts,
  parseMeta,
  parseRoleActive,
  supportsRoles,
  type SchemaInfo,
  type SourceColumn,
} from '../../../src/migration/dump/export-sql'
import { childEnvironment, findOnPath, resolveClientBinary } from '../../../src/migration/dump/client'
import { emergencyWipeSync, installSignalHandlers, installStdioGuards, registerSensitive, sensitivePaths } from '../../../src/migration/dump/cleanup'
import { evaluateGrants } from '../../../src/migration/dump/grants'
import { buildGrantScript } from '../../../src/migration/dump/grants-sql'
import { loadOptionFile, parseOptionText } from '../../../src/migration/dump/option-file'
import { findLargeIntegers, splitExport } from '../../../src/migration/dump/split'
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
    mandatoryRoles: false,
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
      '#PP-VERSION', '8.0.36', '#PP-DATABASE', 'pp', '#PP-TZ', 'SYSTEM\tSYSTEM\tUTC', '#PP-GRANTS', 'GRANT USAGE ON *.* TO `r`@`%`', '#PP-ROLEVARS',
      '#PP-TABLES', 'things\tBASE TABLE\tInnoDB', 'evil`; DROP\tBASE TABLE\tInnoDB',
      '#PP-COLUMNS', 'things\tid\tbigint', 'things\tx`; DROP TABLE things; --\tvarchar', '#PP-END',
    ]
    const s = parseMeta(lines)
    expect(s.unprintableTables).toBe(1)
    expect([...s.tables.keys()]).toEqual(['things'])
    expect(s.tables.get('things')?.columns).toEqual([{ name: 'id', type: 'bigint' }])
  })

  it('parses the metadata and counts, and refuses a cut-off stream', () => {
    expect(buildMetaSql()).toContain('SHOW GRANTS FOR CURRENT_USER();')
    // portable on 5.7, 8 and MariaDB: no @@global.mandatory_roles and no CURRENT_ROLE() in the first call
    expect(buildMetaSql()).toContain("SHOW GLOBAL VARIABLES WHERE Variable_name IN ('mandatory_roles');")
    expect(buildMetaSql()).not.toMatch(/@@global\.mandatory_roles|CURRENT_ROLE/)
    expect(buildRoleSql()).toContain('SELECT CURRENT_ROLE();')
    expect([supportsRoles({ flavor: 'mysql', version: '5.7.44' }), supportsRoles({ flavor: 'mysql', version: '8.0.36' }), supportsRoles({ flavor: 'mariadb', version: '10.6.12-MariaDB' }), supportsRoles({ flavor: 'mysql', version: '5.5.5-10.11.6' })]).toEqual([false, true, true, true])
    expect(parseRoleActive(['#PP-ROLE', 'NONE', '#PP-END'])).toBe(false)
    expect(parseRoleActive(['#PP-ROLE', 'NULL', '#PP-END'])).toBe(false)
    expect(parseRoleActive(['#PP-ROLE', '`r`@`%`', '#PP-END'])).toBe(true)
    expect(() => parseRoleActive(['#PP-ROLE', 'NONE'])).toThrow(DumpUsageError)
    expect(buildMetaSql()).not.toMatch(/FROM `?(users|things)/)
    const lines = ['#PP-VERSION', '10.6.12-MariaDB', '#PP-DATABASE', 'NULL', '#PP-TZ', '+00:00\tSYSTEM\tUTC', '#PP-GRANTS', '#PP-ROLEVARS', 'mandatory_roles\t`r`@`%`', '#PP-TABLES', '#PP-COLUMNS', '#PP-END']
    const s = parseMeta(lines)
    expect(s.flavor).toBe('mariadb')
    expect(s.hasDatabase).toBe(false)
    expect(s.mandatoryRoles).toBe(true)
    expect(parseMeta(lines.map((l) => (l.startsWith('mandatory_roles') ? 'mandatory_roles\t' : l))).mandatoryRoles).toBe(false)
    expect(parseMeta(lines.filter((l) => !l.startsWith('mandatory_roles'))).mandatoryRoles).toBe(false)
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
    expect(ok(['GRANT SHOW DATABASES ON *.* TO `reader`@`%`', 'GRANT SELECT ON `pp`.* TO `reader`@`%`']).readOnly).toBe(true)
    expect(ok(["GRANT USAGE ON *.* TO `reader`@`%` IDENTIFIED BY PASSWORD '*00'", 'GRANT SELECT ON `pp`.`users` TO `reader`@`%`']).readOnly).toBe(true)
    // column-level SELECT and table names that contain the word ON
    expect(ok(['GRANT SELECT (`id`, `name on x`) ON `pp`.`users` TO `reader`@`%`']).readOnly).toBe(true)
    // a partial revoke only narrows the account
    expect(ok(['GRANT SELECT ON `pp`.* TO `reader`@`%`', "REVOKE SELECT ON `pp`.`secrets` FROM `reader`@`%`"]).readOnly).toBe(true)
    expect(ok(['GRANT SELECT ON `pp`.* TO `reader`@`%`']).privileges).toEqual(['SELECT'])
    // what dump:grants produces: column-level SELECT only, REQUIRE SSL on the USAGE line
    expect(ok(["GRANT USAGE ON *.* TO `c`@`127.0.0.1` IDENTIFIED BY PASSWORD '*00' REQUIRE SSL", 'GRANT SELECT (`id`, `name`) ON `pp`.`users` TO `c`@`127.0.0.1`', 'GRANT SELECT (`id`) ON `pp`.`schools` TO `c`@`127.0.0.1`'])).toMatchObject({ readOnly: true, privileges: ['SELECT', 'USAGE'] })
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
    ['PROCESS', ['GRANT SELECT, PROCESS ON *.* TO `u`@`%`'], 'PROCESS'],
    ['REPLICATION CLIENT', ['GRANT SELECT, REPLICATION CLIENT ON *.* TO `u`@`%`'], 'REPLICATION CLIENT'],
    ['BINLOG MONITOR', ['GRANT BINLOG MONITOR ON *.* TO `u`@`%`', 'GRANT SELECT ON `pp`.* TO `u`@`%`'], 'BINLOG MONITOR'],
  ])('refuses %s', (_name, lines, privilege) => {
    const v = ok(lines)
    expect(v.readOnly).toBe(false)
    expect(v.refused).toContain(privilege)
  })

  it('refuses a server-wide SELECT (MySQL and MariaDB formats), keeps database-level and table-level SELECT', () => {
    for (const line of ['GRANT SELECT ON *.* TO `u`@`%`', "GRANT SELECT ON *.* TO 'u'@'%' IDENTIFIED BY PASSWORD '*00'", 'GRANT SELECT, SHOW VIEW ON *.* TO `u`@`%`']) {
      expect(ok([line])).toMatchObject({ readOnly: false, refused: ['SELECT ON *.*'] })
    }
    expect(ok(['GRANT SELECT ON `pp`.* TO `u`@`%`']).readOnly).toBe(true)
    expect(ok(['GRANT SELECT ON `pp`.`users` TO `u`@`%`']).readOnly).toBe(true)
    expect(ok(['GRANT SELECT (`id`) ON `pp`.`users` TO `u`@`%`']).readOnly).toBe(true)
  })

  it('refuses a mandatory or active role that SHOW GRANTS does not list', () => {
    const lines = ['GRANT USAGE ON *.* TO `u`@`%`', 'GRANT SELECT ON `pp`.* TO `u`@`%`']
    expect(evaluateGrants(lines, { mandatoryRoles: true })).toMatchObject({ readOnly: false, rolesActive: true })
    expect(evaluateGrants(lines, { currentRoleActive: true })).toMatchObject({ readOnly: false, rolesActive: true })
    expect(evaluateGrants(lines, { mandatoryRoles: false, currentRoleActive: false })).toMatchObject({ readOnly: true, rolesActive: false })
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

  it('on Windows the mode is not checked but a warning is given', () => {
    const f = write(work.outside('win.cnf'), '[client]\nhost=127.0.0.1\npassword=abc\n', 0o644)
    const o = loadOptionFile(env(f), 'win32')
    expect(o.warnings.join('\n')).toMatch(/not enforced on Windows/)
  })

  it.each(['client-server', 'client-mariadb', 'mariadb-client', 'mariadb', 'mysqldump', 'mysqld', 'Client-Server'])('refuses a [%s] group and names only the group', (group) => {
    const f = write(work.outside(`grp-${group}.cnf`), `${GOOD}[${group}]\nport=1\nuser=other_secret_user\n`)
    let message = ''
    try {
      loadOptionFile(env(f), 'linux')
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toContain(`[${group.toLowerCase()}] group`)
    expect(message).not.toContain('other_secret_user')
    expect(message).not.toContain(PASSWORD)
  })

  it('shows only the line number for a bare line (a pasted password), never its text; a key=value line never shows the value', () => {
    const run = (text: string) => {
      try {
        loadOptionFile(env(write(work.outside(`bare-${Math.random()}.cnf`), text)), 'linux')
      } catch (e) {
        return (e as Error).message
      }
      return ''
    }
    const pasted = `x${'y'.repeat(20)}`
    const bare = run(`[client]\nhost=db.example.test\n${pasted}\n`)
    expect(bare).toContain('(key not allowed) at line 3')
    expect(bare).not.toContain(pasted)
    const keyed = run(`[client]\nhost=db.example.test\nbogus-key=${PASSWORD}\n`)
    expect(keyed).toContain('"bogus-key"')
    expect(keyed).not.toContain(PASSWORD)
    // a bare line that is an allowed flag stays accepted
    expect(run('[client]\nhost=127.0.0.1\nskip-ssl\n')).toBe('')
  })

  it('refuses !includedir and settings outside any group; accepts [client] alone', () => {
    expect(() => loadOptionFile(env(write(work.outside('incdir.cnf'), `${GOOD}!includedir /etc/mysql/conf.d\n`)), 'linux')).toThrow(/!include or !includedir/)
    expect(() => loadOptionFile(env(write(work.outside('nogroup.cnf'), `user=x\n${GOOD}`)), 'linux')).toThrow(/outside any \[group\]/)
    expect(() => loadOptionFile(env(write(work.outside('only-client.cnf'), GOOD)), 'linux')).not.toThrow()
  })

  it.each([
    ['init-command', 'init-command=SET GLOBAL x=1'],
    ['init-command', 'init_command=SET GLOBAL x=1'],
    ['execute', 'execute=select 1'],
    ['plugin-dir', 'plugin-dir=/tmp/plugins'],
    ['default-auth', 'default-auth=mysql_clear_password'],
    ['tee', 'tee=/tmp/out.log'],
    ['pager', 'pager=/tmp/x.sh'],
    ['loose-init-command', 'loose-init-command=select 1'],
    ['hos', 'hos=db.example.test'],
    ['ssl-mod', 'ssl-mod=DISABLED'],
    ['ssl-cipher', 'ssl-cipher=ALL'],
  ])('refuses the key %s (%s) and names the key only', (key, line) => {
    const f = write(work.outside(`key-${Math.random().toString(16).slice(2)}.cnf`), `[client]\nhost=127.0.0.1\nuser=u\npassword=${PASSWORD}\n${line}\n`)
    let message = ''
    try {
      loadOptionFile(env(f), 'linux')
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toContain(`the key "${key}"`)
    expect(message).not.toContain(PASSWORD)
    expect(message).not.toContain('SET GLOBAL')
  })

  it('treats ssl_mode as ssl-mode, and refuses the key in [mysql] too', () => {
    const remote = (body: string) => loadOptionFile(env(write(work.outside(`ssl-${Math.random().toString(16).slice(2)}.cnf`), body)), 'linux')
    expect(() => remote('[client]\nhost=db.example.test\nssl_mode=VERIFY_IDENTITY\n')).not.toThrow()
    expect(() => remote('[client]\nhost=db.example.test\nssl_mode=REQUIRED\n')).toThrow(/VERIFY_IDENTITY or an SSH tunnel/)
    expect(() => remote('[client]\nhost=127.0.0.1\n[mysql]\ninit-command=select 1\n')).toThrow(/the key "init-command"/)
  })

  it('applies [client] and [mysql] in FILE ORDER, the last one wins (as the real client does)', () => {
    const remote = (body: string) => loadOptionFile(env(write(work.outside(`prec-${Math.random().toString(16).slice(2)}.cnf`), body)), 'linux')
    const REFUSED = /VERIFY_IDENTITY or an SSH tunnel/
    // the failing scenario of the review: [mysql] looks safe, the later [client] lines win
    expect(() => remote('[mysql]\nssl-mode=VERIFY_IDENTITY\n[client]\nhost=db.remote\nssl-mode=DISABLED\n')).toThrow(REFUSED)
    // a local host in [mysql] is replaced by the later remote host in [client]
    expect(() => remote('[mysql]\nhost=127.0.0.1\n[client]\nhost=db.remote\n')).toThrow(REFUSED)
    // the later line wins in both directions
    expect(() => remote('[client]\nhost=db.example.test\nssl-mode=REQUIRED\n[mysql]\nssl-mode=VERIFY_CA\n')).not.toThrow()
    expect(() => remote('[client]\nhost=db.example.test\nssl-mode=VERIFY_CA\n[mysql]\nssl-mode=DISABLED\n')).toThrow(REFUSED)
    expect(() => remote('[mysql]\nssl-mode=DISABLED\n[client]\nhost=db.example.test\nssl-mode=VERIFY_IDENTITY\n')).not.toThrow()
    expect(() => remote('[client]\nhost=127.0.0.1\n[mysql]\nhost=db.example.test\n')).toThrow(REFUSED)
    expect(parseOptionText('[client]\nuser=a\n[mysql]\nuser=b\n').values.get('user')).toBe('b')
    expect(parseOptionText('[mysql]\nuser=b\n[client]\nuser=a\n').values.get('user')).toBe('a')
    expect(parseOptionText('[client]\nuser=a\n[mysql]\nuser=b\n[client]\nuser=c\n').values.get('user')).toBe('c')
  })

  describe('TLS rule', () => {
    const tls = (body: string) => loadOptionFile(env(write(work.outside(`tls-${Math.random().toString(16).slice(2)}.cnf`), `[client]\n${body}\npassword=abc\n`)), 'linux')
    it.each([
      ['VERIFY_IDENTITY', 'host=db.example.test\nssl-mode=VERIFY_IDENTITY'],
      ['VERIFY_CA, lower case', 'host=db.example.test\nssl-mode=verify_ca'],
      ['MariaDB ssl + ssl-verify-server-cert', 'host=db.example.test\nssl=1\nssl-verify-server-cert'],
      ['MariaDB bare ssl flags', 'host=db.example.test\nssl\nssl-verify-server-cert=1'],
      ['localhost without TLS (tunnel)', 'host=localhost\nssl-mode=DISABLED'],
      ['127.0.0.1 without TLS (tunnel)', 'host=127.0.0.1'],
      ['localhost with skip-ssl and ssl=0 (tunnel)', 'host=localhost\nskip-ssl\nssl=0'],
      ['skip-ssl=0 (explicitly off) with VERIFY_IDENTITY', 'host=db.example.test\nssl-mode=VERIFY_IDENTITY\nskip-ssl=0'],
      ['::1 without TLS', 'host=::1'],
      ['no host (socket)', 'socket=/var/run/mysqld/mysqld.sock'],
    ])('accepts %s', (_n, body) => {
      expect(() => tls(body)).not.toThrow()
    })
    it.each([
      ['no TLS setting on a remote host', 'host=db.example.test'],
      ['REQUIRED', 'host=db.example.test\nssl-mode=REQUIRED'],
      ['PREFERRED', 'host=db.example.test\nssl-mode=PREFERRED'],
      ['DISABLED', 'host=db.example.test\nssl-mode=DISABLED'],
      ['ssl=0', 'host=db.example.test\nssl=0'],
      ['ssl without verification', 'host=db.example.test\nssl=1'],
      ['verification without ssl', 'host=db.example.test\nssl-verify-server-cert'],
      ['ssl-verify-server-cert=0', 'host=db.example.test\nssl=1\nssl-verify-server-cert=0'],
      ['ssl-mode REQUIRED even with verify flags', 'host=db.example.test\nssl-mode=REQUIRED\nssl=1\nssl-verify-server-cert'],
      ['skip-ssl next to VERIFY_IDENTITY', 'host=db.example.test\nssl-mode=VERIFY_IDENTITY\nskip-ssl'],
      ['skip-ssl=1 next to VERIFY_CA', 'host=db.example.test\nssl-mode=VERIFY_CA\nskip-ssl=1'],
      ['skip-ssl next to the MariaDB flags', 'host=db.example.test\nssl=1\nssl-verify-server-cert\nskip-ssl'],
      ['ssl=0 next to VERIFY_IDENTITY', 'host=db.example.test\nssl-mode=VERIFY_IDENTITY\nssl=0'],
      ['ssl=false next to VERIFY_CA', 'host=db.example.test\nssl-mode=VERIFY_CA\nssl=false'],
      ['ssl=off next to VERIFY_IDENTITY', 'host=db.example.test\nssl-mode=VERIFY_IDENTITY\nssl=off'],
      ['a remote IP', 'host=203.0.113.9\nssl-mode=REQUIRED'],
    ])('refuses %s', (_n, body) => {
      expect(() => tls(body)).toThrow(/VERIFY_IDENTITY or an SSH tunnel to 127\.0\.0\.1/)
    })
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
  it('overwrites with zeros (seen through a descriptor opened before), unlinks and removes the directories', async () => {
    const dir = work.out('wipe-ok')
    mkdirSync(join(dir, 'sub'), { recursive: true })
    writeFileSync(join(dir, 'a.ndjson'), 'x'.repeat(3 * 1024 * 1024 + 7))
    writeFileSync(join(dir, 'sub', 'b.txt'), 'secret')
    const fd = openSync(join(dir, 'a.ndjson'), 'r') // keeps the inode readable after the unlink
    try {
      const r = await wipeDir(dir)
      expect(r).toMatchObject({ files: 2, dirs: 2, hardLinked: 0 })
      expect(existsSync(dir)).toBe(false)
      const left = Buffer.alloc(3 * 1024 * 1024 + 7)
      expect(readSync(fd, left, 0, left.length, 0)).toBe(left.length)
      expect(left.every((b) => b === 0)).toBe(true)
    } finally {
      closeSync(fd)
    }
  })

  it('only unlinks a file with several hard links and reports it (the other link keeps its data)', async () => {
    const dir = work.out('wipe-hard')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'a.txt'), 'precious')
    writeFileSync(join(dir, 'b.txt'), 'plain')
    const keep = work.out('wipe-hard-keep')
    linkSync(join(dir, 'a.txt'), keep)
    const r = await wipeDir(dir)
    expect(r).toMatchObject({ files: 1, hardLinked: 1, dirs: 1 })
    expect(existsSync(dir)).toBe(false)
    expect(readFileSync(keep, 'utf8')).toBe('precious')
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
    await expect(wipeDir(work.out('missing'), { missingOk: true })).resolves.toEqual({ files: 0, bytes: 0, dirs: 0, hardLinked: 0 })
  })
})

describe('client binary and child environment', () => {
  const bin = (dir: string, name: string) => {
    mkdirSync(dir, { recursive: true })
    const path = join(dir, name)
    writeFileSync(path, '#!/bin/sh\n', { mode: 0o755 })
    chmodSync(path, 0o755)
    return path
  }

  it('walks PATH itself: absolute entries only, never the working directory', () => {
    const a = work.outside('bin-a')
    const bDir = work.outside('bin-b')
    const b = bin(bDir, 'mysql')
    const env = { PATH: ['', '.', 'relative/dir', a, bDir].join(delimiter) }
    expect(findOnPath(['mysql'], env, 'linux')).toBe(b)
    expect(findOnPath(['mysql'], { PATH: ['', '.', 'relative/dir'].join(delimiter) }, 'linux')).toBeUndefined()
    expect(resolveClientBinary(env, 'linux', [])).toBe(b)
  })

  it('on Windows looks for mysql.exe and reads Path case-insensitively', () => {
    const dir = work.outside('bin-win')
    const exe = bin(dir, 'mysql.exe')
    expect(findOnPath(['mysql.exe', 'mysql'], { Path: dir }, 'win32')).toBe(exe)
  })

  it('refuses a binary inside the repository or the working directory (real path), and a missing one', () => {
    const inside = bin(work.out('bin-inside'), 'mysql')
    expect(() => resolveClientBinary({ CLOUD_MYSQL_CLIENT: inside }, 'linux')).toThrow(/inside the repository or the working directory/)
    expect(() => resolveClientBinary({ PATH: work.out('bin-inside') }, 'linux')).toThrow(/inside the repository or the working directory/)
    const outside = bin(work.outside('bin-outside'), 'mysql')
    const link = work.out('mysql-link')
    symlinkSync(outside, link)
    expect(() => resolveClientBinary({ CLOUD_MYSQL_CLIENT: link }, 'linux')).not.toThrow() // a link INTO the repo to an outside file resolves outside
    const planted = work.out('planted-target')
    writeFileSync(planted, '#!/bin/sh\n', { mode: 0o755 })
    const outsideLink = work.outside('mysql-link-out')
    symlinkSync(planted, outsideLink)
    expect(() => resolveClientBinary({ CLOUD_MYSQL_CLIENT: outsideLink }, 'linux')).toThrow(/inside the repository/)
    expect(() => resolveClientBinary({ CLOUD_MYSQL_CLIENT: join(work.outside('x'), 'nope') }, 'linux')).toThrow(/existing, executable file/)
    expect(() => resolveClientBinary({ PATH: work.outside('empty-path') }, 'linux')).toThrow(/not found/)
  })

  it('hands the child an allow-listed environment only', () => {
    const env = { PATH: '/usr/bin', HOME: '/home/x', LANG: 'C', LC_ALL: 'C', TZ: 'UTC', MYSQL_UNIX_PORT: '/s', ANON_HMAC_KEY: 'k'.repeat(40), ANON_HMAC_KEY_FILE: '/k', MYSQL_PWD: 'p', CLOUD_MYSQL_DEFAULTS_FILE: '/o', SystemRoot: 'C:\\Windows', TEMP: '/t', APPDATA: 'C:\\Users\\x\\AppData', MYSQL_TEST_LOGIN_FILE: '/home/x/.mylogin.cnf', NODE_OPTIONS: '--x' }
    expect(Object.keys(childEnvironment(env, 'linux')).sort()).toEqual(['LANG', 'LC_ALL', 'MYSQL_TEST_LOGIN_FILE', 'MYSQL_UNIX_PORT', 'PATH', 'TZ'])
    expect(Object.keys(childEnvironment(env, 'win32')).sort()).toEqual(['LANG', 'LC_ALL', 'MYSQL_TEST_LOGIN_FILE', 'MYSQL_UNIX_PORT', 'PATH', 'SystemRoot', 'TEMP', 'TZ'])
    expect(Object.keys(childEnvironment({ SYSTEMROOT: 'C:\\Windows', Path: 'x', ANON_HMAC_KEY: 'k' }, 'win32')).sort()).toEqual(['MYSQL_TEST_LOGIN_FILE', 'Path', 'SYSTEMROOT'])
  })

  it('points MYSQL_TEST_LOGIN_FILE at a file that does not exist, a different one each time (so .mylogin.cnf is never read)', () => {
    const a = childEnvironment({ PATH: '/usr/bin', MYSQL_TEST_LOGIN_FILE: '/home/x/.mylogin.cnf' }, 'linux').MYSQL_TEST_LOGIN_FILE as string
    const b = childEnvironment({}, 'linux').MYSQL_TEST_LOGIN_FILE as string
    expect(a).not.toBe(b)
    expect(a.startsWith(tmpdir())).toBe(true)
    expect(existsSync(a)).toBe(false)
  })
})

describe('interrupt handling', () => {
  class FakeProcess {
    handlers = new Map<string, () => void>()
    on(name: string, fn: () => void) {
      this.handlers.set(name, fn)
    }
  }

  it('registers SIGINT, SIGTERM and SIGHUP (SIGBREAK on Windows); the first aborts, the second wipes and exits 130', () => {
    for (const [platform, names] of [['linux', ['SIGHUP', 'SIGINT', 'SIGTERM']], ['win32', ['SIGBREAK', 'SIGHUP', 'SIGINT', 'SIGTERM']]] as const) {
      const target = new FakeProcess()
      const abort = new AbortController()
      const exits: number[] = []
      let wiped = 0
      const lines: string[] = []
      installSignalHandlers({ target, abort, platform, exit: (c) => void exits.push(c), err: (l) => void lines.push(l), wipe: () => void wiped++ })
      expect([...target.handlers.keys()].sort()).toEqual(names)
      target.handlers.get('SIGTERM')?.()
      expect(abort.signal.aborted).toBe(true)
      expect(wiped).toBe(0)
      expect(exits).toEqual([])
      target.handlers.get('SIGHUP')?.()
      expect(wiped).toBe(1)
      expect(exits).toEqual([130])
      expect(lines.length).toBe(2) // one message per signal
    }
  })

  it('a throwing err (closed terminal, EIO/EPIPE) never skips the abort, the wipe or the exit', () => {
    const target = new FakeProcess()
    const abort = new AbortController()
    const exits: number[] = []
    let wiped = 0
    installSignalHandlers({ target, abort, platform: 'linux', exit: (c) => void exits.push(c), err: () => { throw new Error('EIO') }, wipe: () => void wiped++ })
    expect(() => target.handlers.get('SIGHUP')?.()).not.toThrow()
    expect(abort.signal.aborted).toBe(true)
    expect(() => target.handlers.get('SIGHUP')?.()).not.toThrow()
    expect(wiped).toBe(1)
    expect(exits).toEqual([130])
    // and a wipe that throws still exits
    const t2 = new FakeProcess()
    const exits2: number[] = []
    installSignalHandlers({ target: t2, abort: new AbortController(), platform: 'linux', exit: (c) => void exits2.push(c), err: () => undefined, wipe: () => { throw new Error('boom') } })
    t2.handlers.get('SIGINT')?.()
    t2.handlers.get('SIGINT')?.()
    expect(exits2).toEqual([130])
  })

  it('stdio guards swallow stream errors (EPIPE from | head), which would otherwise be unhandled', () => {
    const stdout = new EventEmitter()
    const stderr = new EventEmitter()
    expect(() => stdout.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }))).toThrow() // unguarded: crashes
    installStdioGuards({ stdout, stderr })
    expect(() => stdout.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }))).not.toThrow()
    expect(() => stderr.emit('error', Object.assign(new Error('write EIO'), { code: 'EIO' }))).not.toThrow()
  })

  it('emergencyWipeSync zeroes and removes the registered directories, never following a symlink', () => {
    const dir = work.out('emergency')
    mkdirSync(join(dir, 'sub'), { recursive: true })
    writeFileSync(join(dir, 'sub', 'a.ndjson'), 'secret'.repeat(1000))
    const target = work.out('emergency-target')
    writeFileSync(target, 'keep me')
    symlinkSync(target, join(dir, 'link'))
    const fd = openSync(join(dir, 'sub', 'a.ndjson'), 'r')
    const unregister = registerSensitive(dir)
    expect(sensitivePaths()).toContain(dir)
    try {
      emergencyWipeSync()
      expect(existsSync(dir)).toBe(false)
      const buf = Buffer.alloc(6000)
      readSync(fd, buf, 0, 6000, 0)
      expect(buf.every((b) => b === 0)).toBe(true)
      expect(readFileSync(target, 'utf8')).toBe('keep me')
    } finally {
      closeSync(fd)
      unregister()
    }
    expect(sensitivePaths()).not.toContain(dir)
  })
})

describe('dump:grants script', () => {
  const ACCOUNT = "'pp_dump'@'10.0.0.%'"
  const small = [spec('things', [col('id', 'id'), col('name', 't'), col('secret', 't', true)]), spec('only_secret', [col('token', 't', true)], null)]

  it('prints the CREATE USER placeholder, one column-level GRANT per table without the redacted columns, and the metadata query', () => {
    const lines = buildGrantScript('pp_cloud', ACCOUNT, small)
    expect(lines).toContain(`CREATE USER IF NOT EXISTS ${ACCOUNT} IDENTIFIED BY <<SET-A-STRONG-PASSWORD>> REQUIRE SSL;`)
    expect(lines).toContain(`GRANT SELECT (\`id\`, \`name\`) ON \`pp_cloud\`.\`things\` TO ${ACCOUNT};`)
    expect(lines.filter((l) => l.startsWith('GRANT '))).toHaveLength(1) // a redact-only table gets no grant
    expect(lines.join('\n')).not.toContain('secret')
    expect(lines).toContain("-- SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'pp_cloud' ORDER BY table_name, ordinal_position;")
  })

  it('covers every spec table of the real spec and never grants a redact column', () => {
    const lines = buildGrantScript('pp_cloud', ACCOUNT, TABLES)
    expect(lines.filter((l) => l.startsWith('GRANT ')).length).toBe(TABLES.length)
    const users = lines.find((l) => l.includes('`pp_cloud`.`users`')) as string
    expect(users).toContain('`email`')
    expect(users).not.toContain('remember_token')
    expect(users).not.toContain('parent_invite_token')
    expect(lines.join('\n')).not.toMatch(/INSERT|UPDATE|DELETE|ALL PRIVILEGES|GRANT OPTION/)
  })

  it('grants the staged article text columns (D1, LEAD 29 Oct)', () => {
    const articles = buildGrantScript('pp_cloud', ACCOUNT, TABLES).find((l) => l.includes('`pp_cloud`.`articles`')) as string
    expect(articles).toContain('`excerpt`')
    expect(articles).toContain('`content`')
    expect(articles).toContain('`author_id`')
  })

  it('validates the database and the account strictly', () => {
    for (const bad of ['pp-cloud', 'pp cloud', 'pp`x', "pp'; DROP", '']) expect(() => buildGrantScript(bad, ACCOUNT, small), bad).toThrow(DumpUsageError)
    for (const bad of ['user@host', "'user'@host", "user@'host'", "'us'er'@'host'", "'user'@'ho\\st'", "'user'@'host' IDENTIFIED BY 'x'", "'user'@'host';--", "''@'host'", "'user'@''", "'a b'@'host'"]) {
      expect(() => buildGrantScript('pp', bad, small), bad).toThrow(DumpUsageError)
    }
    for (const ok of ["'pp_dump'@'localhost'", "'pp-dump.ro'@'127.0.0.1'", "'u'@'%'", "'u'@'db-1.example.test'", "'u'@'::1'"]) expect(() => buildGrantScript('pp', ok, small), ok).not.toThrow()
  })
})

describe('large integer detection', () => {
  it('finds integer literals of 2^53 or more per key, outside strings only', () => {
    expect(findLargeIntegers('{"id": 9007199254740993, "n": 1}')).toEqual(new Map([['id', 1]]))
    expect(findLargeIntegers('{"id":9007199254740992,"x":-9007199254740993}')).toEqual(new Map([['id', 1], ['x', 1]]))
    expect(findLargeIntegers('{"a":{"b":12345678901234567890,"c":12345678901234567890}}')).toEqual(new Map([['b', 1], ['c', 1]]))
    // below 2^53, in a string, a decimal fraction or an exponent: not reported
    expect(findLargeIntegers('{"id":9007199254740991}')).toBeUndefined()
    expect(findLargeIntegers('{"s":"9007199254740993","t":"x 12345678901234567890 y"}')).toBeUndefined()
    expect(findLargeIntegers('{"d":1234567890123456789.5,"e":12345678901234567e3}')).toBeUndefined()
    expect(findLargeIntegers('{"id":1,"name":"a\\"b 12345678901234567890"}')).toBeUndefined()
    expect(findLargeIntegers('{"id":1}')).toBeUndefined()
  })
})
