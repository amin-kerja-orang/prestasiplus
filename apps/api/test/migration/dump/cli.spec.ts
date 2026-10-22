import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CoverageError, LeakScanError } from '../../../src/migration/anonymise/errors'
import { DEFAULT_CONFIG_PATH, loadConfigFile } from '../../../src/migration/anonymise/cli'
import { DUMP_EXIT, runDumpCli, type DumpCliDeps } from '../../../src/migration/dump/cli'
import { DirReader } from '../../../src/migration/staging/readers'
import { capture, DB_HOST, DB_USER, fixture, PASSWORD, PII, scratch, sourceTable, TEST_KEY, type Fixture, type Scenario } from './helpers'

const work = scratch()
afterAll(() => work.cleanup())

let fx: Fixture
beforeEach(() => {
  fx = fixture({ tables: {} })
})
afterEach(() => fx.cleanup())

const SCHOOL_ROWS = [JSON.stringify({ id: 1, name: PII.schoolName, code: 'ZRB1234', type: 'smk', state: 'negeri_a', district: 'daerah_a1', join_code: 'JOINZRB1', is_active: 1, created_at: '2026-01-01T00:00:00.000000Z', updated_at: null })]
const USER_ROWS = [
  JSON.stringify({ id: 1, name: PII.name1, email: PII.email1, phone: PII.phone1, ic: PII.ic1, username: PII.username1, password: PII.bcryptHash1, remember_token: null, role: 'pelajar', school_id: 1, is_active: 1, bio: 'Saya suka bola sepak', created_at: '2026-01-01T00:00:00.000000Z' }),
  JSON.stringify({ id: 2, name: PII.name2, email: PII.email2, phone: PII.phone2, ic: PII.ic2, username: PII.username2, password: PII.bcryptHash2, remember_token: null, role: 'guru', school_id: 1, is_active: 1, created_at: '2026-01-02T00:00:00.000000Z' }),
]

function scenario(extra: Partial<Scenario> = {}): Scenario {
  return {
    tables: {
      schools: sourceTable('schools', SCHOOL_ROWS, { types: { created_at: 'datetime', updated_at: 'datetime' } }),
      users: sourceTable('users', USER_ROWS, { extra: [['legacy_national_id', 'varchar']], drop: ['teaching_qualification'] }),
      ...(extra.tables ?? {}),
    },
    ...extra,
  }
}

interface Run {
  code: number
  text: string
}

async function cli(args: string[], deps: Partial<DumpCliDeps> = {}, env: Record<string, string | undefined> = fx.env): Promise<Run> {
  const log = capture()
  const code = await runDumpCli(args, { env, out: log.out, err: log.err, ...deps })
  return { code, text: log.text() }
}

/** No secret of the option file may appear in what the tool prints. */
function expectNoSecrets(text: string): void {
  for (const secret of [PASSWORD, DB_USER, DB_HOST]) expect(text).not.toContain(secret)
}

function keyFile(): string {
  const path = work.outside('anon.key')
  writeFileSync(path, TEST_KEY, { mode: 0o600 })
  chmodSync(path, 0o600)
  return path
}

describe('dump:check', () => {
  it('writes the schema report and reads no data rows', async () => {
    fx.setScenario(scenario())
    const out = work.out('check-ok')
    const r = await cli(['dump:check', '--out', out])
    expect(r.code, r.text).toBe(DUMP_EXIT.ok)
    expectNoSecrets(r.text)
    const report = JSON.parse(readFileSync(join(out, 'schema-report.json'), 'utf8'))
    expect(report.server).toEqual({ version: '8.0.36', flavor: 'mysql' })
    expect(report.grants.read_only).toBe(true)
    expect(report.time_zone).toEqual({ session: 'SYSTEM', global: 'SYSTEM', system: 'UTC' })
    const users = report.tables.find((t: { table: string }) => t.table === 'users')
    expect(users).toMatchObject({ present: true, row_count: 2, spec_columns_missing_in_source: ['teaching_qualification'], columns_redacted: ['remember_token', 'parent_invite_token'] })
    expect(users.source_columns_not_in_spec).toEqual({ count: 1, names: ['legacy_national_id'] })
    expect(report.tables.find((t: { table: string }) => t.table === 'payments')).toMatchObject({ present: false, not_present_reason: 'absent' })
    expect(report.spec_tables_absent_in_source).toContain('payments')
    expect(report.totals.rows).toBe(3)
    expect(readFileSync(join(out, 'schema-report.md'), 'utf8')).toMatch(/\| users \| yes \| 2 \|/)
    for (const f of ['schema-report.json', 'schema-report.md']) expect(statSync(join(out, f)).mode & 0o777).toBe(0o600)
    // No row value anywhere, and no data SELECT was sent.
    const all = readFileSync(join(out, 'schema-report.json'), 'utf8') + readFileSync(join(out, 'schema-report.md'), 'utf8')
    expect(all).not.toContain(PII.name1)
    expect(all).not.toContain(PII.schoolName)
    const sent = fx.calls().map((c) => c.sql).join('\n')
    expect(sent).not.toContain('JSON_OBJECT')
    expect(sent).not.toContain('START TRANSACTION')
  })

  it('invokes the client with --defaults-file first, the SQL on stdin and no secret in the arguments', async () => {
    fx.setScenario(scenario())
    await cli(['dump:check', '--out', work.out('check-args')])
    const calls = fx.calls()
    expect(calls.length).toBe(2)
    for (const c of calls) {
      expect(c.args[0]).toBe(`--defaults-file=${fx.optionFile}`)
      expect(c.args).toEqual(expect.arrayContaining(['--batch', '--raw', '--skip-column-names', '--quick', '--default-character-set=utf8mb4', '--no-auto-rehash']))
      expect(c.args.join(' ')).not.toContain(PASSWORD)
      expect(c.sql.length).toBeGreaterThan(20)
    }
  })

  it('exits 3 for an account that can write, still reports, and reads no counts', async () => {
    fx.setScenario(scenario({ grants: ['GRANT SELECT, INSERT, UPDATE ON `pp`.* TO `u`@`%`'] }))
    const out = work.out('check-rw')
    const r = await cli(['dump:check', '--out', out])
    expect(r.code).toBe(DUMP_EXIT.notReadOnly)
    expect(r.text).toMatch(/not read-only.*INSERT, UPDATE/)
    expect(fx.calls().length).toBe(1)
    const report = JSON.parse(readFileSync(join(out, 'schema-report.json'), 'utf8'))
    expect(report.grants).toMatchObject({ read_only: false, refused: ['INSERT', 'UPDATE'] })
    expect(report.totals.rows).toBeNull()
    expect(JSON.stringify(report)).not.toContain('GRANT ')
  })

  it('exits 2 when the connection has no default database', async () => {
    fx.setScenario(scenario({ database: 'NULL' }))
    const r = await cli(['dump:check', '--out', work.out('check-nodb')])
    expect(r.code).toBe(DUMP_EXIT.usage)
    expect(r.text).toMatch(/DATABASE\(\) is NULL/)
  })
})

describe('dump:cloud', () => {
  it('writes a raw pp-staging-dump/1 directory that DirReader accepts, with no anonymised or synthetic marker', async () => {
    fx.setScenario(scenario())
    const out = work.out('cloud-ok')
    const r = await cli(['dump:cloud', '--out', out, '--tables', 'users,schools', '--datetime-offset', '+07:30'])
    expect(r.code, r.text).toBe(DUMP_EXIT.ok)
    expectNoSecrets(r.text)
    expect(r.text).not.toContain(PII.name1)
    expect(readdirSync(out).sort()).toEqual(['manifest.json', 'schema-report.json', 'schema-report.md', 'schools.ndjson', 'users.ndjson'])
    expect(existsSync(`${out}.partial`)).toBe(false)
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'))
    expect(manifest).toMatchObject({ format: 'pp-staging-dump/1', source: 'cloud', raw: true, datetime_offset: '+07:30' })
    expect(manifest.tables).toEqual({ users: { rows: 2, file: 'users.ndjson' }, schools: { rows: 1, file: 'schools.ndjson' } })
    expect('anonymised' in manifest || 'synthetic' in manifest).toBe(false)
    expect(typeof manifest.exported_at).toBe('string')
    const reader = new DirReader(out)
    expect(reader.syntheticMarker()).toBe(false)
    expect(readFileSync(join(out, 'users.ndjson'), 'utf8')).toBe(`${USER_ROWS.join('\n')}\n`)
    for (const f of readdirSync(out)) expect(statSync(join(out, f)).mode & 0o777).toBe(0o600)

    // The export session: one client call after the schema read, a read-only snapshot, only spec columns.
    const calls = fx.calls()
    expect(calls.length).toBe(2)
    const sql = (calls[1] as { sql: string }).sql
    expect(sql).toMatch(/^SET SESSION time_zone = '\+00:00';\nSET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;\nSTART TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY;/)
    expect(sql).not.toContain('legacy_national_id')
    expect(sql).toContain("'remember_token', NULL")
    expect(sql).toContain('.%f+07:30')
    expect(sql).toContain(".%fZ')") // users keep TIMESTAMP columns: UTC
    expect(sql).not.toContain('`payments`')
    expect(JSON.parse(readFileSync(join(out, 'schema-report.json'), 'utf8')).datetime_offset).toBe('+07:30')
  })

  it('DT-1: DATETIME is written with the explicit default offset +08:00, TIMESTAMP with Z', async () => {
    fx.setScenario(scenario())
    const out = work.out('cloud-dt1')
    const r = await cli(['dump:cloud', '--out', out, '--tables', 'schools,users'])
    expect(r.code, r.text).toBe(DUMP_EXIT.ok)
    const sql = (fx.calls()[1] as { sql: string }).sql
    // schools.created_at/updated_at are DATETIME in the scenario, users.* are TIMESTAMP
    expect(sql).toContain("DATE_FORMAT(`created_at`, '%Y-%m-%dT%H:%i:%s.%f+08:00')")
    expect(sql).toContain("DATE_FORMAT(`last_login_at`, '%Y-%m-%dT%H:%i:%s.%fZ')")
    expect(JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')).datetime_offset).toBe('+08:00')
  })

  it('keeps integers of 2^53 or more verbatim, warns, and records them in the manifest and the report', async () => {
    const big = '{"id":9007199254740993,"name":"x","created_at":null}'
    fx.setScenario(scenario({ tables: { schools: sourceTable('schools', [big, '{"id":2,"name":"y"}']) } }))
    const out = work.out('cloud-bigint')
    const r = await cli(['dump:cloud', '--out', out, '--tables', 'schools'])
    expect(r.code, r.text).toBe(DUMP_EXIT.ok)
    expect(r.text).toMatch(/Table schools: integer value\(s\) of 2\^53 or more in id/)
    expect(readFileSync(join(out, 'schools.ndjson'), 'utf8')).toContain('"id":9007199254740993')
    expect(JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')).large_integers).toEqual({ schools: { id: 1 } })
    const report = JSON.parse(readFileSync(join(out, 'schema-report.json'), 'utf8')) as { tables: { table: string; large_integers?: Record<string, number> }[] }
    expect(report.tables.find((t) => t.table === 'schools')?.large_integers).toEqual({ id: 1 })
    expect(new DirReader(out).expectedRows('schools')).toBe(2)
  })

  it('exits 3 when the account can write: nothing is read and nothing is written', async () => {
    fx.setScenario(scenario({ grants: ['GRANT ALL PRIVILEGES ON `pp`.* TO `u`@`%`'] }))
    const out = work.out('cloud-rw')
    const r = await cli(['dump:cloud', '--out', out])
    expect(r.code).toBe(DUMP_EXIT.notReadOnly)
    expect(r.text).toMatch(/ALL PRIVILEGES/)
    expect(fx.calls().length).toBe(1)
    expect(fx.calls().some((c) => c.sql.includes('JSON_OBJECT'))).toBe(false)
    expect(existsSync(out)).toBe(false)
    expect(existsSync(`${out}.partial`)).toBe(false)
  })

  it('exits 6 on a row-count mismatch and deletes the partial output', async () => {
    fx.setScenario(scenario({ tables: { schools: { ...sourceTable('schools', SCHOOL_ROWS), countOverride: 5 } } }))
    const out = work.out('cloud-mismatch')
    const r = await cli(['dump:cloud', '--out', out, '--tables', 'schools'])
    expect(r.code).toBe(DUMP_EXIT.stream)
    expect(r.text).toMatch(/counted 5 rows but 1 were exported/)
    expect(existsSync(out)).toBe(false)
    expect(existsSync(`${out}.partial`)).toBe(false)
  })

  it('exits 6 on an invalid JSON line (without echoing it) and on a truncated stream', async () => {
    fx.setScenario(scenario({ garbageAfterFirstRow: `not json ${PII.name3}` }))
    const a = work.out('cloud-badjson')
    const r = await cli(['dump:cloud', '--out', a, '--tables', 'users'])
    expect(r.code).toBe(DUMP_EXIT.stream)
    expect(r.text).not.toContain(PII.name3)
    expect(existsSync(a) || existsSync(`${a}.partial`)).toBe(false)

    fx.setScenario(scenario({ truncateDumpAt: 4 }))
    const b = work.out('cloud-cut')
    const r2 = await cli(['dump:cloud', '--out', b, '--tables', 'users'])
    expect(r2.code).toBe(DUMP_EXIT.stream)
    expect(existsSync(b) || existsSync(`${b}.partial`)).toBe(false)
  })

  it('exits 1 on a client failure, prints error numbers only, and scrubs the option-file secrets', async () => {
    fx.setScenario(scenario({ fail: { code: 1, onlyDump: true, stderr: `ERROR 1045 (28000): Access denied for user '${DB_USER}'@'${DB_HOST}' (using password: YES) ${PASSWORD}\n` } }))
    const out = work.out('cloud-fail')
    const r = await cli(['dump:cloud', '--out', out, '--tables', 'schools'])
    expect(r.code).toBe(DUMP_EXIT.failed)
    expect(r.text).toMatch(/ERROR 1045 \(28000\)/)
    expectNoSecrets(r.text)
    expect(existsSync(out) || existsSync(`${out}.partial`)).toBe(false)
  })

  it('is interrupted cleanly: the client is stopped and the partial output deleted', async () => {
    fx.setScenario(scenario({ delayMs: 5000 }))
    const out = work.out('cloud-abort')
    const abort = new AbortController()
    setTimeout(() => abort.abort(), 600)
    const started = Date.now()
    const r = await cli(['dump:cloud', '--out', out, '--tables', 'schools'], { signal: abort.signal })
    expect(r.code).toBe(DUMP_EXIT.failed)
    expect(r.text).toMatch(/Interrupted/)
    expect(Date.now() - started).toBeLessThan(4500)
    expect(existsSync(out) || existsSync(`${out}.partial`)).toBe(false)
  })

  it.each([
    ['dump:cloud', '--out'],
    ['dump:check', '--out'],
    ['dump:produce', '--work'],
  ])('%s refuses an output location outside .migration-out, not empty, or with a stale .partial BEFORE any client is started', async (command, flag) => {
    fx.setScenario(scenario())
    const extra = command === 'dump:produce' ? ['--tables', 'schools'] : []
    const env = command === 'dump:produce' ? { ...fx.env, ANON_HMAC_KEY_FILE: keyFile() } : fx.env
    const outside = await cli([command, flag, work.outside('x'), ...extra], {}, env)
    expect(outside.code, outside.text).toBe(DUMP_EXIT.usage)
    expect(outside.text).toMatch(/\.migration-out/)

    const full = work.out(`full-${command.replace(':', '-')}`)
    mkdirSync(full, { recursive: true })
    writeFileSync(join(full, 'old.txt'), 'old')
    const notEmpty = await cli([command, flag, full, ...extra], {}, env)
    expect(notEmpty.code, notEmpty.text).toBe(DUMP_EXIT.usage)
    expect(notEmpty.text).toMatch(/not empty/)
    expect(readFileSync(join(full, 'old.txt'), 'utf8')).toBe('old')

    if (command !== 'dump:produce') {
      const stale = work.out(`stale-${command.replace(':', '-')}`)
      writeFileSync(`${stale}.partial`, '')
      const r = await cli([command, flag, stale, ...extra], {}, env)
      expect(r.code, r.text).toBe(DUMP_EXIT.usage)
      expect(r.text).toMatch(/\.partial/)
    }
    // Not one client process was ever started.
    expect(fx.calls().length).toBe(0)
  })

  it('refuses a remote host without verified TLS (exit 2) before the client starts', async () => {
    fx.setScenario(scenario())
    writeFileSync(fx.optionFile, `[client]\nhost=${DB_HOST}\nuser=${DB_USER}\npassword=${PASSWORD}\ndatabase=pp\nssl-mode=REQUIRED\n`, { mode: 0o600 })
    const r = await cli(['dump:check', '--out', work.out('tls-refused')])
    expect(r.code).toBe(DUMP_EXIT.usage)
    expect(r.text).toMatch(/VERIFY_IDENTITY or an SSH tunnel to 127\.0\.0\.1/)
    expectNoSecrets(r.text)
    expect(fx.calls().length).toBe(0)
  })

  it('passes the client an allow-listed environment: no key, no MYSQL_PWD, no CLOUD_* variable', async () => {
    fx.setScenario(scenario())
    const env = { ...fx.env, PATH: '/usr/bin', HOME: '/home/nobody', LANG: 'C', ANON_HMAC_KEY: TEST_KEY, ANON_HMAC_KEY_FILE: '/x/k', MYSQL_PWD: PASSWORD, SECRET_TOKEN: 'abc' }
    const r = await cli(['dump:check', '--out', work.out('env-check')], {}, env)
    expect(r.code, r.text).toBe(DUMP_EXIT.ok)
    const names = fx.calls().flatMap((c) => c.env)
    expect(names.length).toBeGreaterThan(0)
    for (const forbidden of ['HOME', 'ANON_HMAC_KEY', 'ANON_HMAC_KEY_FILE', 'MYSQL_PWD', 'SECRET_TOKEN', 'CLOUD_MYSQL_DEFAULTS_FILE', 'CLOUD_MYSQL_CLIENT']) {
      expect(names, forbidden).not.toContain(forbidden)
    }
    expect(names).toEqual(expect.arrayContaining(['PATH', 'LANG', 'MYSQL_TEST_LOGIN_FILE']))
  })

  it('exits 2 when the client binary is missing', async () => {
    fx.setScenario(scenario())
    const r1 = await cli(['dump:check', '--out', work.out('nobin-1')], {}, { ...fx.env, CLOUD_MYSQL_CLIENT: join(fx.dir, 'does-not-exist') })
    expect(r1.code).toBe(DUMP_EXIT.usage)
    const r2 = await cli(['dump:check', '--out', work.out('nobin-2')], {}, { CLOUD_MYSQL_DEFAULTS_FILE: fx.optionFile, PATH: join(fx.dir, 'empty') })
    expect(r2.code).toBe(DUMP_EXIT.usage)
    expect(r2.text).toMatch(/client binary was not found/)
    // A client inside the repository is refused (a planted file must not get the credentials).
    const planted = work.out('planted-mysql')
    writeFileSync(planted, readFileSync(fx.clientPath), { mode: 0o755 })
    chmodSync(planted, 0o755)
    const r3 = await cli(['dump:check', '--out', work.out('nobin-3')], {}, { ...fx.env, CLOUD_MYSQL_CLIENT: planted })
    expect(r3.code).toBe(DUMP_EXIT.usage)
    expect(r3.text).toMatch(/inside the repository or the working directory/)
    expect(fx.calls().length).toBe(0)
  })
})

describe('dump:grants', () => {
  it('prints the script with no option file, no client and no connection', async () => {
    const r = await cli(['dump:grants', '--database', 'pp_cloud', '--account', "'pp_dump'@'127.0.0.1'"], {}, {})
    expect(r.code, r.text).toBe(DUMP_EXIT.ok)
    expect(r.text).toContain("CREATE USER IF NOT EXISTS 'pp_dump'@'127.0.0.1' IDENTIFIED BY <<SET-A-STRONG-PASSWORD>> REQUIRE SSL;")
    expect(r.text).toContain("GRANT SELECT (`id`, `name`, `email`")
    expect(r.text).toMatch(/-- SELECT table_name, column_name, data_type FROM information_schema\.columns WHERE table_schema = 'pp_cloud'/)
    expect(r.text).not.toContain('remember_token')
    expect(fx.calls().length).toBe(0)
  })

  it.each([
    ['no flags', ['dump:grants']],
    ['no account', ['dump:grants', '--database', 'pp']],
    ['bad database', ['dump:grants', '--database', 'pp;drop', '--account', "'u'@'h'"]],
    ['unquoted account', ['dump:grants', '--database', 'pp', '--account', 'u@h']],
    ['quote inside the account', ['dump:grants', '--database', 'pp', '--account', "'u'x'@'h'"]],
    ['unknown flag', ['dump:grants', '--database', 'pp', '--account', "'u'@'h'", '--out', 'x']],
  ])('%s -> exit 2', async (_n, args) => {
    const r = await cli(args, {}, {})
    expect(r.code, r.text).toBe(DUMP_EXIT.usage)
  })
})

describe('usage errors', () => {
  it.each([
    ['unknown command', ['dump:nope']],
    ['no command', []],
    ['extra positional', ['dump:check', 'extra', '--out', 'x']],
    ['unknown flag', ['dump:check', '--out', 'x', '--verbose', '1']],
    ['host flag', ['dump:cloud', '--out', 'x', '--host', 'db.example.test']],
    ['password flag', ['dump:cloud', '--out', 'x', '--password', 'hunter2']],
    ['flag without value', ['dump:check', '--out']],
    ['missing --out', ['dump:cloud']],
    ['missing --work', ['dump:produce']],
    ['missing --dir', ['dump:wipe']],
    ['connection string as value', ['dump:cloud', '--out', 'mysql://user:pw@db.example.test/pp']],
    ['bad offset', ['dump:cloud', '--out', 'x', '--datetime-offset', '8']],
    ['unknown table', ['dump:cloud', '--out', 'x', '--tables', 'users,not_a_table']],
    ['hostile table', ['dump:cloud', '--out', 'x', '--tables', 'users;drop']],
    ['flag of another command', ['dump:wipe', '--dir', 'x', '--out', 'y']],
  ])('%s -> exit 2 and the client is never started', async (_n, args) => {
    fx.setScenario(scenario())
    const r = await cli(args)
    expect(r.code, r.text).toBe(DUMP_EXIT.usage)
    expect(fx.calls().length).toBe(0)
    expect(r.text).not.toContain('hunter2')
    expect(r.text).not.toContain('pw@')
  })

  it('exits 2 without CLOUD_MYSQL_DEFAULTS_FILE and for an option file that is inside the repository or too open', async () => {
    fx.setScenario(scenario())
    expect((await cli(['dump:check', '--out', work.out('o1')], {}, { CLOUD_MYSQL_CLIENT: fx.clientPath })).code).toBe(DUMP_EXIT.usage)
    const inRepo = work.out('inrepo.cnf')
    writeFileSync(inRepo, `[client]\npassword=${PASSWORD}\n`, { mode: 0o600 })
    const a = await cli(['dump:check', '--out', work.out('o2')], {}, { ...fx.env, CLOUD_MYSQL_DEFAULTS_FILE: inRepo })
    expect(a.code).toBe(DUMP_EXIT.usage)
    expect(a.text).toMatch(/inside the repository/)
    chmodSync(fx.optionFile, 0o644)
    const b = await cli(['dump:check', '--out', work.out('o3')])
    expect(b.code).toBe(DUMP_EXIT.usage)
    expect(b.text).toMatch(/chmod 600/)
    expectNoSecrets(a.text + b.text)
    expect(fx.calls().length).toBe(0)
  })
})

describe('dump:produce', () => {
  const produceEnv = () => ({ ...fx.env, ANON_HMAC_KEY_FILE: keyFile() })

  it('dumps, anonymises, leak-scans and wipes the raw directory; prints aggregates only', async () => {
    fx.setScenario(scenario())
    const work1 = work.out('produce-ok')
    const r = await cli(['dump:produce', '--work', work1, '--tables', 'users,schools'], {}, produceEnv())
    expect(r.code, r.text).toBe(DUMP_EXIT.ok)
    expectNoSecrets(r.text)
    expect(r.text).not.toContain(TEST_KEY)
    for (const v of [PII.name1, PII.email1, PII.phone1, PII.ic1, PII.schoolName, PII.bcryptHash1]) expect(r.text).not.toContain(v)

    expect(existsSync(join(work1, 'raw'))).toBe(false)
    expect(existsSync(join(work1, 'raw.partial'))).toBe(false)
    expect(readdirSync(work1).sort()).toEqual(['anon', 'schema-report.json', 'schema-report.md'])

    const anon = join(work1, 'anon')
    const manifest = JSON.parse(readFileSync(join(anon, 'manifest.json'), 'utf8'))
    expect(manifest).toMatchObject({ format: 'pp-staging-dump/1', source: 'cloud', anonymised: true })
    const reader = new DirReader(anon)
    expect(reader.syntheticMarker()).toBe(true)
    expect(reader.expectedRows('users')).toBe(2)
    expect(reader.expectedRows('schools')).toBe(1)
    const text = readdirSync(anon).map((f) => readFileSync(join(anon, f), 'utf8')).join('\n')
    for (const v of [PII.name1, PII.name2, PII.email1, PII.phone1, PII.ic1, PII.username1, PII.schoolName, PII.bcryptHash1]) expect(text).not.toContain(v)

    // Aggregates: rows, bytes, sha256 of the anonymised manifest, elapsed time.
    expect(r.text).toMatch(/users: 2 rows, \d[\d,]* bytes/)
    expect(r.text).toContain(`sha256 of anon/manifest.json: ${createHash('sha256').update(readFileSync(join(anon, 'manifest.json'))).digest('hex')}`)
    expect(r.text).toMatch(/Elapsed: \d+\.\d s/)
    expect(r.text).toMatch(/Raw dump deleted/)
  })

  it('refuses without a key (exit 2) before any connection', async () => {
    fx.setScenario(scenario())
    const r = await cli(['dump:produce', '--work', work.out('produce-nokey'), '--tables', 'users'])
    expect(r.code).toBe(DUMP_EXIT.usage)
    expect(r.text).toMatch(/no pseudonymisation key/)
    expect(fx.calls().length).toBe(0)
    const short = await cli(['dump:produce', '--work', work.out('produce-shortkey')], {}, { ...fx.env, ANON_HMAC_KEY: 'short' })
    expect(short.code).toBe(DUMP_EXIT.usage)
    expect(fx.calls().length).toBe(0)
  })

  it('exits 4 on an anonymiser coverage gap, before any data is fetched, and names the columns', async () => {
    fx.setScenario(scenario())
    const config = loadConfigFile(DEFAULT_CONFIG_PATH)
    delete config.tables.users?.bio
    const w = work.out('produce-coverage')
    const r = await cli(['dump:produce', '--work', w, '--tables', 'users'], { config }, produceEnv())
    expect(r.code).toBe(DUMP_EXIT.coverage)
    expect(r.text).toMatch(/users\.bio/)
    expect(fx.calls().length).toBe(0)
    expect(existsSync(join(w, 'raw'))).toBe(false)
  })

  it.each([
    ['a coverage failure inside the anonymiser', () => new CoverageError('Refusing to run (default deny): no rule for column(s): users.bio. Nothing was read.', ['users.bio'], []), DUMP_EXIT.coverage],
    ['a leak scan hit', () => new LeakScanError([{ table: 'users', column: 'bio', kind: 'email', count: 1 }], true), DUMP_EXIT.leak],
    ['an unexpected failure', () => new Error(`boom ${PII.name1}`), DUMP_EXIT.failed],
  ])('wipes the raw directory after %s', async (_n, make, expected) => {
    fx.setScenario(scenario())
    const w = work.out(`produce-fail-${expected}`)
    let rawSeen = false
    const r = await cli(
      ['dump:produce', '--work', w, '--tables', 'users,schools'],
      {
        runAnonymise: async (opts) => {
          rawSeen = existsSync(join(w, 'raw', 'users.ndjson'))
          void opts
          throw make()
        },
      },
      produceEnv(),
    )
    expect(rawSeen).toBe(true) // the raw dump existed while the anonymiser ran...
    expect(r.code).toBe(expected)
    expect(existsSync(join(w, 'raw'))).toBe(false) // ...and is gone afterwards
    expect(existsSync(join(w, 'anon'))).toBe(false)
    expect(r.text).not.toContain(PII.name1)
    expect(r.text).toMatch(/Raw dump deleted/)
  })

  it('refuses a writable account (exit 3): no row SQL is sent and nothing is left in the work directory', async () => {
    fx.setScenario(scenario({ grants: ['GRANT SELECT, INSERT ON `pp`.* TO `u`@`%`'] }))
    const w = work.out('produce-rw')
    const r = await cli(['dump:produce', '--work', w, '--tables', 'users'], {}, produceEnv())
    expect(r.code, r.text).toBe(DUMP_EXIT.notReadOnly)
    expect(fx.calls().length).toBe(1)
    expect(fx.calls().some((c) => c.sql.includes('JSON_OBJECT') || c.sql.includes('COUNT(*)'))).toBe(false)
    expect(existsSync(join(w, 'raw'))).toBe(false)
    expect(existsSync(join(w, 'anon'))).toBe(false)
  })

  it('a real leak-scan hit (planted in a column that is kept) exits 5; anon and raw are both really deleted', async () => {
    const leaky = USER_ROWS.map((r) => JSON.stringify({ ...JSON.parse(r), kelas: 'hubungi planted.leak@leak-check.invalid' }))
    fx.setScenario(scenario({ tables: { users: sourceTable('users', leaky) } }))
    const w = work.out('produce-leak')
    const r = await cli(['dump:produce', '--work', w, '--tables', 'users,schools'], {}, produceEnv())
    expect(r.code, r.text).toBe(DUMP_EXIT.leak)
    expect(r.text).toMatch(/users\.kelas \(email\)/)
    expect(r.text).not.toContain('planted.leak')
    expect(existsSync(join(w, 'anon'))).toBe(false)
    expect(existsSync(join(w, 'anon.partial'))).toBe(false)
    expect(existsSync(join(w, 'raw'))).toBe(false)
    expect(readdirSync(w).sort()).toEqual(['schema-report.json', 'schema-report.md'])
  })

  it('an interrupt during the dump exits 1 and leaves no raw and no anon', async () => {
    fx.setScenario(scenario({ delayMs: 5000 }))
    const w = work.out('produce-abort-dump')
    const abort = new AbortController()
    setTimeout(() => abort.abort(), 600)
    const r = await cli(['dump:produce', '--work', w, '--tables', 'schools'], { signal: abort.signal }, produceEnv())
    expect(r.code, r.text).toBe(DUMP_EXIT.failed)
    expect(r.text).toMatch(/Interrupted/)
    expect(readdirSync(w)).toEqual([])
  })

  it('an interrupt that arrives while the anonymiser runs stops it early (signal passed down), wipes raw, removes anon and exits 1', async () => {
    fx.setScenario(scenario())
    const w = work.out('produce-abort-anon')
    const abort = new AbortController()
    const real = (await import('../../../src/migration/anonymise/run')).runAnonymise
    let opened: string[] = []
    let sawSignal = false
    const r = await cli(
      ['dump:produce', '--work', w, '--tables', 'users,schools'],
      {
        signal: abort.signal,
        runAnonymise: async (opts) => {
          sawSignal = opts.signal === abort.signal
          opened = []
          const inner = opts.reader
          const reader = {
            kind: inner.kind,
            expectedRows: (t: string) => inner.expectedRows(t),
            has: (t: string) => inner.has(t),
            inputHash: () => inner.inputHash(),
            close: () => inner.close(),
            read: async function* (table: string, size: number) {
              opened.push(table)
              for await (const batch of inner.read(table, size)) {
                yield batch
                abort.abort() // the signal lands in the middle of the first table
              }
            },
          }
          return real({ ...opts, reader })
        },
      },
      produceEnv(),
    )
    expect(r.code, r.text).toBe(DUMP_EXIT.failed)
    expect(sawSignal).toBe(true)
    expect(opened).toEqual(['users']) // schools was never read: the run stopped early
    expect(existsSync(join(w, 'anon'))).toBe(false)
    expect(existsSync(join(w, 'anon.partial'))).toBe(false)
    expect(existsSync(join(w, 'raw'))).toBe(false)
    expect(r.text).toMatch(/Raw dump deleted/)
  })

  it('refuses to anonymise a dump with integers of 2^53 or more (exit 6), names the table and still wipes raw', async () => {
    const big = JSON.stringify({ id: 1, name: 'x' }).replace('"id":1', '"id":9007199254740993')
    fx.setScenario(scenario({ tables: { schools: { ...sourceTable('schools', [big]) } } }))
    const w = work.out('produce-bigint')
    let ran = false
    const r = await cli(['dump:produce', '--work', w, '--tables', 'schools'], { runAnonymise: async () => { ran = true; throw new Error('must not run') } }, produceEnv())
    expect(r.code, r.text).toBe(DUMP_EXIT.stream)
    expect(r.text).toContain('integers of 2^53 or more would lose precision in the anonymiser; table schools')
    expect(ran).toBe(false)
    expect(existsSync(join(w, 'raw'))).toBe(false)
    expect(existsSync(join(w, 'anon'))).toBe(false)
  })

  it('an interrupt that arrives right after the dump skips the anonymiser', async () => {
    fx.setScenario(scenario())
    const w = work.out('produce-abort-between')
    const abort = new AbortController()
    let ran = false
    const r = await cli(
      ['dump:produce', '--work', w, '--tables', 'schools'],
      {
        signal: abort.signal,
        // the report is written right after the dump; aborting from the log sink models a signal in that window
        runAnonymise: async () => {
          ran = true
          throw new Error('must not run')
        },
        out: (line: string) => {
          if (line.startsWith('Done:')) abort.abort()
        },
      },
      produceEnv(),
    )
    expect(ran).toBe(false)
    expect(r.code).toBe(DUMP_EXIT.failed)
    expect(readdirSync(w).filter((f) => f === 'raw' || f === 'anon')).toEqual([])
  })

  it('falls back to removal when the zero-overwrite fails, and still reports failure (exit 1)', async () => {
    fx.setScenario(scenario())
    const w = work.out('produce-wipe-fails')
    const log = capture()
    const code = await runDumpCli(['dump:produce', '--work', w, '--tables', 'schools'], { env: produceEnv(), out: log.out, err: log.err, wipe: async () => { throw new Error('disk says no') } })
    expect(code).toBe(DUMP_EXIT.failed)
    expect(log.text()).toMatch(/removed without overwriting/)
    expect(existsSync(join(w, 'raw'))).toBe(false)
    expect(existsSync(join(w, 'anon'))).toBe(true)
  })

  it('wipes the raw directory when the dump itself fails (row-count mismatch, exit 6)', async () => {
    fx.setScenario(scenario({ tables: { schools: { ...sourceTable('schools', SCHOOL_ROWS), countOverride: 2 } } }))
    const w = work.out('produce-mismatch')
    const r = await cli(['dump:produce', '--work', w, '--tables', 'schools'], {}, produceEnv())
    expect(r.code).toBe(DUMP_EXIT.stream)
    expect(readdirSync(w)).toEqual([])
  })
})

describe('dump:wipe', () => {
  it('wipes a dump directory and prints the SSD note', async () => {
    fx.setScenario(scenario())
    const out = work.out('wipe-cli')
    await cli(['dump:cloud', '--out', out, '--tables', 'schools'])
    const r = await cli(['dump:wipe', '--dir', out])
    expect(r.code, r.text).toBe(DUMP_EXIT.ok)
    expect(r.text).toMatch(/4 file\(s\) overwritten with zeros and removed .*0 file\(s\) unlinked only/)
    expect(r.text).toMatch(/full-disk encryption is the real guard/)
    expect(existsSync(out)).toBe(false)
  })

  it('refuses a directory outside .migration-out with exit 2', async () => {
    const outside = work.outside('wipe-outside')
    writeFileSync(outside, '')
    const r = await cli(['dump:wipe', '--dir', outside])
    expect(r.code).toBe(DUMP_EXIT.usage)
    expect(existsSync(outside)).toBe(true)
  })
})
