/**
 * `migrate:export-question-reports` (BE-30, Q9 A) against a real PostgreSQL on the BE-35 synthetic fixture (`cloud-tiny`):
 * staging and archive loaded, a few synthetic reports added (fictitious text only), nothing else.
 *   only the open reports are exported; the reporter is never selected; the question is found again by the snapshot
 *   identifiers; CSV quoting and formula-injection prefix; files 0600 under `.migration-out`; symlink refused;
 *   summary = counts per status; no table is written.
 */
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runCli } from '../../../src/migration/cli'
import { CSV_COLUMNS, csvCell, exportOpenQuestionReports } from '../../../src/migration/export/question-reports'
import { ProfileOutputError } from '../../../src/migration/profile'
import { loadStaging } from '../../../src/migration/staging/load'
import { DirReader } from '../../../src/migration/staging/readers'
import { capture, createStagingDb, FIXTURE_DIR, REPO_ROOT, stagingEnv, type StagingDb } from '../staging/helpers'
import '../../../src/migration/orchestrate'

const NOW = new Date('2026-10-29T17:30:00.000Z')
const STAMP = '20261029T173000Z'
const outRoot = join(REPO_ROOT, '.migration-out', `q9-export-${process.pid}`)
let env: StagingDb
let n = 0

/** Fictitious reports. Reporters are fixture users 1..5 (their values are scanned for in the files). */
const REPORTS: [id: number, question: number, user: number, status: string | null, reason: string | null][] = [
  [1, 1, 1, 'baru', 'Jawapan salah'],
  [2, 2, 2, ' Baru ', '=HYPERLINK("http://contoh.invalid","klik")'],
  [3, 3, 1, 'selesai', 'sudah dibaiki'],
  [4, 999, 4, 'menunggu', 'Soalan "tiada", jawapan\nbaris baru, koma'],
  [5, 1, 5, null, 'tiada status'],
  [6, 2, 3, 'ditolak', 'ditolak sebab lain'],
  [7, 1, 2, 'pending', '+60 salah; -ulang; @sebut'],
  [8, 3, 4, 'selesai', null],
]

const fresh = (): string => join(outRoot, `run-${++n}`)

/** Minimal RFC 4180 reader for the test. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\r' && text[i + 1] === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      i++
    } else cell += c
  }
  return rows
}

async function allCounts(pool: pg.Pool): Promise<Record<string, number>> {
  const tables = await pool.query<{ table_schema: string; table_name: string }>(
    `SELECT table_schema, table_name FROM information_schema.tables
     WHERE table_type = 'BASE TABLE' AND table_schema IN ('public', 'staging_cloud', 'archive_cloud') ORDER BY 1, 2`,
  )
  const out: Record<string, number> = {}
  for (const t of tables.rows) {
    const r = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM "${t.table_schema}"."${t.table_name}"`)
    out[`${t.table_schema}.${t.table_name}`] = Number(r.rows[0]?.n)
  }
  return out
}

beforeAll(async () => {
  mkdirSync(outRoot, { recursive: true })
  env = await createStagingDb()
  await loadStaging(env.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(env.db) })
  // The canonical bridge of legacy question 1 (the fixture has the map row and one paper, but no canonical questions).
  await env.pool.query(`insert into archive_cloud.exam_questions (id, status, number_label) values (1, 'diterbitkan', '3')`)
  await env.pool.query(`insert into archive_cloud.exam_paper_questions (id, exam_paper_id, exam_question_id) values (1, 1, 1)`)
  for (const [id, q, u, status, reason] of REPORTS) {
    await env.pool.query(
      `insert into archive_cloud.question_reports (id, question_id, user_id, status, reason, created_at, updated_at)
       values ($1, $2, $3, $4, $5, '2026-03-01T08:15:00Z', '2026-03-02T00:00:00Z')`,
      [id, q, u, status, reason],
    )
  }
}, 300_000)
afterAll(async () => {
  await env?.close()
  rmSync(outRoot, { recursive: true, force: true })
})

describe('csvCell', () => {
  it('quotes per RFC 4180 and neutralises spreadsheet formulas', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell(null)).toBe('')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"')
    for (const lead of ['=', '+', '-', '@', '\t', '\r']) expect(csvCell(`${lead}x`)).toMatch(/^"?'/)
    expect(csvCell('=1+1')).toBe("'=1+1")
    expect(csvCell('2026-03-01T08:15:00Z')).toBe('2026-03-01T08:15:00Z')
  })
})

describe('exportOpenQuestionReports', () => {
  it('exports only the open reports, with the identifiers of the question and no reporter', async () => {
    const dir = fresh()
    const r = await exportOpenQuestionReports({ pool: env.pool, outDir: dir, now: () => NOW, pageSize: 2 })
    expect(r.csv).toBe(join(dir, `question-reports-open-${STAMP}.csv`))
    expect(r.summary).toBe(join(dir, `question-reports-open-${STAMP}.summary.json`))
    expect(r.exported).toBe(4)
    expect(r.total).toBe(8)

    const rows = parseCsv(readFileSync(r.csv, 'utf8'))
    expect(rows[0]).toEqual([...CSV_COLUMNS])
    expect(CSV_COLUMNS.some((c) => /user|name|email|school/i.test(c))).toBe(false)
    const col = (row: string[], name: (typeof CSV_COLUMNS)[number]) => row[CSV_COLUMNS.indexOf(name)]
    const body = rows.slice(1)
    expect(body.map((x) => col(x, 'legacy_report_id'))).toEqual(['1', '2', '4', '7'])

    const first = body[0] as string[]
    expect(first).toEqual(['1', '1', 'contoh-2025-1', '3', 'MP1', '1', '1', 'baru', 'Jawapan salah', '2026-03-01T08:15:00Z'])
    // No canonical bridge for question 2 and question 999 is not in the archive: identifiers are empty, the id stays.
    expect(body[1]?.slice(2, 7)).toEqual(['', '', 'MP1', '1', '1'])
    expect(body[2]?.slice(0, 7)).toEqual(['4', '999', '', '', '', '', ''])
    expect(col(body[1] as string[], 'status')).toBe(' Baru ')
  })

  it('escapes quotes, commas and line breaks and prefixes formula starts', async () => {
    const r = await exportOpenQuestionReports({ pool: env.pool, outDir: fresh(), now: () => NOW })
    const text = readFileSync(r.csv, 'utf8')
    expect(text.endsWith('\r\n')).toBe(true)
    const body = parseCsv(text).slice(1)
    const reason = (id: string) => body.find((x) => x[0] === id)?.[CSV_COLUMNS.indexOf('reason')]
    expect(reason('2')).toBe(`'=HYPERLINK("http://contoh.invalid","klik")`)
    expect(reason('4')).toBe('Soalan "tiada", jawapan\nbaris baru, koma')
    expect(reason('7')).toBe("'+60 salah; -ulang; @sebut")
    expect(text).toContain('"Soalan ""tiada"", jawapan\nbaris baru, koma"')
    // No data cell begins with a formula character.
    for (const row of body) for (const cell of row) expect(cell).not.toMatch(/^[=+\-@\t\r]/)
  })

  it('never writes the reporter: no user value appears in the files', async () => {
    const r = await exportOpenQuestionReports({ pool: env.pool, outDir: fresh(), now: () => NOW })
    const text = `${readFileSync(r.csv, 'utf8')}\n${readFileSync(r.summary, 'utf8')}`
    const users = await env.pool.query<Record<string, string | null>>(
      `select name, email, phone, ic, username from staging_cloud.users where id <= 5`,
    )
    const schools = await env.pool.query<{ name: string | null }>(`select name from staging_cloud.schools`)
    const values = [...users.rows.flatMap((u) => Object.values(u)), ...schools.rows.map((s) => s.name)].filter((v): v is string => !!v && v.length >= 4)
    expect(values.length).toBeGreaterThan(10)
    for (const v of values) expect(text.toLowerCase(), v).not.toContain(v.toLowerCase())
  })

  it('writes mode-0600 files under .migration-out and a summary of counts per status only', async () => {
    const dir = fresh()
    const r = await exportOpenQuestionReports({ pool: env.pool, outDir: dir, now: () => NOW })
    for (const f of [r.csv, r.summary]) expect(statSync(f).mode & 0o777, f).toBe(0o600)
    expect(readdirSync(dir).sort()).toEqual([`question-reports-open-${STAMP}.csv`, `question-reports-open-${STAMP}.summary.json`])
    const s = JSON.parse(readFileSync(r.summary, 'utf8')) as {
      total: number
      exported: number
      byStatus: { status: string; count: number; exported: boolean }[]
      openStatuses: string[]
    }
    expect(s.total).toBe(8)
    expect(s.exported).toBe(4)
    expect(s.byStatus).toEqual([
      { status: '(null)', count: 1, exported: false },
      { status: 'baru', count: 2, exported: true },
      { status: 'ditolak', count: 1, exported: false },
      { status: 'menunggu', count: 1, exported: true },
      { status: 'pending', count: 1, exported: true },
      { status: 'selesai', count: 2, exported: false },
    ])
    expect(s.openStatuses).toContain('baru')
    expect(JSON.stringify(s)).not.toMatch(/Jawapan|HYPERLINK/)
  })

  it('refuses a folder outside .migration-out and a symbolic link, and replaces an old file', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'q9-outside-'))
    try {
      await expect(exportOpenQuestionReports({ pool: env.pool, outDir: outside, now: () => NOW })).rejects.toBeInstanceOf(ProfileOutputError)
      expect(readdirSync(outside)).toEqual([])
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }

    const dir = fresh()
    mkdirSync(dir, { recursive: true })
    const victim = join(dir, 'victim.txt')
    writeFileSync(victim, 'keep')
    const csv = join(dir, `question-reports-open-${STAMP}.csv`)
    symlinkSync(victim, csv)
    await expect(exportOpenQuestionReports({ pool: env.pool, outDir: dir, now: () => NOW })).rejects.toThrow(/symbolic link/)
    expect(readFileSync(victim, 'utf8')).toBe('keep')
    expect(lstatSync(csv).isSymbolicLink()).toBe(true)

    const dir2 = fresh()
    mkdirSync(dir2, { recursive: true })
    writeFileSync(join(dir2, `question-reports-open-${STAMP}.csv`), 'old', { mode: 0o644 })
    const r = await exportOpenQuestionReports({ pool: env.pool, outDir: dir2, now: () => NOW })
    expect(readFileSync(r.csv, 'utf8')).toContain('legacy_report_id')
    expect(statSync(r.csv).mode & 0o777).toBe(0o600)
  })

  it('only reads: every statement is a read and no table changes', async () => {
    const before = await allCounts(env.pool)
    const seen: string[] = []
    const original = pg.Client.prototype.query
    pg.Client.prototype.query = function patched(this: unknown, ...args: unknown[]) {
      const first = args[0]
      if (typeof first === 'string') seen.push(first)
      else if (first && typeof first === 'object' && typeof (first as { text?: unknown }).text === 'string') seen.push((first as { text: string }).text)
      return (original as (...a: unknown[]) => unknown).apply(this, args)
    } as typeof original
    try {
      await exportOpenQuestionReports({ pool: env.pool, outDir: fresh(), now: () => NOW })
    } finally {
      pg.Client.prototype.query = original
    }
    expect(seen.length).toBeGreaterThan(2)
    expect(seen.some((s) => /^\s*BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/i.test(s))).toBe(true)
    for (const s of seen) expect(s.trim(), s.slice(0, 40)).toMatch(/^(BEGIN|COMMIT|ROLLBACK|SELECT)\b/i)
    expect(seen.some((s) => /\b(users|schools)\b/i.test(s))).toBe(false)
    expect(await allCounts(env.pool)).toEqual(before)
  })

  it('an empty set still writes the header and a zero summary', async () => {
    const own = await createStagingDb()
    try {
      await loadStaging(own.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(own.db) })
      const r = await exportOpenQuestionReports({ pool: own.pool, outDir: fresh(), now: () => NOW })
      expect(r.exported).toBe(0)
      expect(parseCsv(readFileSync(r.csv, 'utf8'))).toEqual([[...CSV_COLUMNS]])
      expect(r.byStatus).toEqual([])
    } finally {
      await own.close()
    }
  }, 120_000)
})

describe('migrate:export-question-reports (CLI)', () => {
  const run = async (argv: string[]) => {
    const log = capture()
    const code = await runCli(argv, { pool: env.pool, env: { NODE_ENV: 'test', PP_ALLOW_MIGRATE_APPLY: '1' }, out: log.out, err: log.err })
    return { code, text: log.text() }
  }

  it('prints counts and paths, never a row', async () => {
    const dir = fresh()
    const r = await run(['migrate:export-question-reports', `--out-dir=${dir}`])
    expect(r.code).toBe(0)
    expect(r.text).toMatch(/4 open report\(s\) exported of 8/)
    expect(r.text).toMatch(/baru \| 2 \| yes/)
    expect(r.text).toMatch(/selesai \| 2 \| no/)
    expect(r.text).toContain(dir)
    expect(r.text).not.toMatch(/Jawapan|HYPERLINK|Soalan "tiada"|contoh\.invalid/)
    expect(readdirSync(dir)).toHaveLength(2)
  })

  it('refuses --apply (read-only command) and an out-dir outside .migration-out', async () => {
    const apply = await run(['migrate:export-question-reports', '--apply', `--out-dir=${fresh()}`])
    expect(apply.code).toBe(2)
    expect(apply.text).toMatch(/read-only/)
    const bad = await run(['migrate:export-question-reports', `--out-dir=${tmpdir()}`])
    expect(bad.code).toBe(2)
    expect(bad.text).toMatch(/--out-dir/)
  })
})
