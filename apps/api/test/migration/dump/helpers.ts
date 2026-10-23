import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { TABLES } from '../../../src/migration/ddl/spec'

export { capture, PII, scratch, TEST_KEY } from '../anonymise/helpers'

/** A fake password for the option file. Never a real one. */
export const PASSWORD = 'x'.repeat(24)
export const DB_USER = 'cloud_reader'
export const DB_HOST = 'db.example.test'

export interface FakeTable {
  columns: [string, string][]
  /** Data lines exactly as the server would print them (one JSON object each). */
  rows: string[]
  /** Table type in information_schema (default BASE TABLE). */
  type?: string
  /** Storage engine in information_schema (default InnoDB). */
  engine?: string
  /** Counts printed for COUNT(*) instead of rows.length (to simulate a mismatch). */
  countOverride?: number
  /** Non-NULL values that are not valid JSON, per text column the spec calls j. */
  badJson?: Record<string, number>
}

export interface Scenario {
  version?: string
  /** `NULL` simulates no default database. */
  database?: string
  grants?: string[]
  /** Value of the global variable mandatory_roles (default empty). */
  mandatoryRoles?: string
  /** What CURRENT_ROLE() prints (default NONE on MySQL 8, NULL on MariaDB). */
  currentRole?: string
  tables: Record<string, FakeTable>
  /** Print stderr and exit with this code after the output. */
  fail?: { code: number; stderr: string; onlyDump?: boolean; onlyRole?: boolean }
  /** Cut the dump output after this many lines (a dying client that exits 0). */
  truncateDumpAt?: number
  /** Extra line inserted after the first data line of the dump (to test a bad stream). */
  garbageAfterFirstRow?: string
  /** The dump session answers only after this many milliseconds (interrupt tests). */
  delayMs?: number
}

export const READ_ONLY_GRANTS = ['GRANT USAGE ON *.* TO `reader`@`%`', 'GRANT SELECT, SHOW VIEW ON `pp`.* TO `reader`@`%`']

/** The fake mysql client: a Node script. It reads the SQL from stdin and prints canned output per statement. */
const FAKE_CLIENT = `
const fs = require('fs')
const sc = JSON.parse(fs.readFileSync(SCENARIO, 'utf8'))
let sql = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c) => { sql += c })
process.stdin.on('end', () => {
  fs.appendFileSync(LOG, JSON.stringify({ args: process.argv.slice(2), sql, env: Object.keys(process.env) }) + '\\n')
  const isDump = sql.includes('START TRANSACTION')
  const out = []
  let last = ''
  let table = ''
  let bad = ''
  let firstRow = true
  for (const line of sql.split('\\n')) {
    let m
    if ((m = /^SELECT '(#PP-[A-Z]+)(?: (.*))?';$/.exec(line))) {
      out.push(m[2] ? m[1] + ' ' + m[2] : m[1])
      last = m[1]
      if (m[1] === '#PP-TABLE') table = m[2]
      if (m[1] === '#PP-JSONBAD') bad = m[2]
    } else if (line === 'SELECT VERSION();') out.push(sc.version || '8.0.36')
    else if (line === 'SELECT DATABASE();') out.push(sc.database || 'pp')
    else if (line.startsWith('SELECT @@session.time_zone')) out.push('SYSTEM\\tSYSTEM\\tUTC')
    else if (line === 'SHOW GRANTS FOR CURRENT_USER();') for (const g of sc.grants) out.push(g)
    else if (line.startsWith('SHOW GLOBAL VARIABLES')) { if (sc.mandatoryRoles !== undefined) out.push('mandatory_roles\\t' + sc.mandatoryRoles) }
    else if (line === 'SELECT CURRENT_ROLE();') out.push(sc.currentRole !== undefined ? sc.currentRole : (/mariadb/i.test(sc.version || '') ? 'NULL' : 'NONE'))
    else if (line.includes('FROM information_schema.tables')) for (const [t, d] of Object.entries(sc.tables)) out.push(t + '\\t' + (d.type || 'BASE TABLE') + '\\t' + (d.engine || 'InnoDB'))
    else if (line.includes('FROM information_schema.columns')) for (const [t, d] of Object.entries(sc.tables)) for (const [c, ty] of d.columns) out.push(t + '\\t' + c + '\\t' + ty)
    else if (line.startsWith('SELECT COUNT(*)')) {
      if (last === '#PP-JSONBAD') out.push(String((sc.tables[table].badJson || {})[bad] || 0))
      else { const d = sc.tables[table]; out.push(String(d.countOverride !== undefined ? d.countOverride : d.rows.length)) }
    } else if (line.startsWith('SELECT JSON_OBJECT(')) {
      for (const r of sc.tables[table].rows) {
        out.push(r)
        if (firstRow && sc.garbageAfterFirstRow !== undefined) out.push(sc.garbageAfterFirstRow)
        firstRow = false
      }
    }
  }
  const lines = isDump && sc.truncateDumpAt !== undefined ? out.slice(0, sc.truncateDumpAt) : out
  const finish = () => {
    process.stdout.write(lines.join('\\n') + '\\n')
    if (sc.fail && (!sc.fail.onlyDump || isDump) && (!sc.fail.onlyRole || sql.includes('CURRENT_ROLE'))) {
      process.stderr.write(sc.fail.stderr)
      process.exitCode = sc.fail.code
    }
  }
  if (isDump && sc.delayMs) setTimeout(finish, sc.delayMs)
  else finish()
})
`

export interface Fixture {
  /** Directory outside the repository. */
  dir: string
  clientPath: string
  optionFile: string
  scenarioPath: string
  logPath: string
  /** Environment for runDumpCli. */
  env: Record<string, string>
  setScenario(s: Scenario): void
  /** Every invocation of the fake client (args + SQL). */
  calls(): { args: string[]; sql: string; env: string[] }[]
  cleanup(): void
}

export function fixture(initial: Scenario): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'pp-am10-'))
  const clientPath = join(dir, 'fake-mysql')
  const scenarioPath = join(dir, 'scenario.json')
  const logPath = join(dir, 'calls.log')
  // The scenario and log paths are baked in: the client is started with an allow-listed environment.
  writeFileSync(clientPath, `#!${process.execPath}\nconst SCENARIO = ${JSON.stringify(scenarioPath)}\nconst LOG = ${JSON.stringify(logPath)}\n${FAKE_CLIENT}`)
  chmodSync(clientPath, 0o755)
  const optionFile = join(dir, 'client.cnf')
  writeFileSync(optionFile, `[client]\nhost=${DB_HOST}\nport=3306\nuser=${DB_USER}\npassword=${PASSWORD}\ndatabase=pp\nssl-mode=VERIFY_IDENTITY\n`, { mode: 0o600 })
  chmodSync(optionFile, 0o600)
  const fx: Fixture = {
    dir,
    clientPath,
    optionFile,
    scenarioPath,
    logPath,
    env: {
      CLOUD_MYSQL_DEFAULTS_FILE: optionFile,
      CLOUD_MYSQL_CLIENT: clientPath,
    },
    setScenario: (s) => writeFileSync(scenarioPath, JSON.stringify({ grants: READ_ONLY_GRANTS, ...s })),
    calls: () => (existsSync(logPath) ? readFileSync(logPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { args: string[]; sql: string; env: string[] }) : []),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
  fx.setScenario(initial)
  return fx
}

const SOURCE_TYPE: Record<string, string> = { id: 'bigint', i: 'int', t: 'varchar', n: 'decimal', ts: 'timestamp', d: 'date', j: 'json' }

/** A source table with the spec's columns (spec types mapped to MySQL types), plus overrides and extras. */
export function sourceTable(name: string, rows: string[], opts: { types?: Record<string, string>; extra?: [string, string][]; drop?: string[] } = {}): FakeTable {
  const spec = TABLES.find((t) => t.name === name)
  if (!spec) throw new Error(`no spec table ${name}`)
  const columns: [string, string][] = spec.columns
    .filter((c) => !(opts.drop ?? []).includes(c.name))
    .map((c) => [c.name, opts.types?.[c.name] ?? SOURCE_TYPE[c.type] ?? 'varchar'])
  return { columns: [...columns, ...(opts.extra ?? [])], rows }
}

export function newDir(base: string, name: string): string {
  const d = join(base, name)
  mkdirSync(d, { recursive: true })
  return d
}
