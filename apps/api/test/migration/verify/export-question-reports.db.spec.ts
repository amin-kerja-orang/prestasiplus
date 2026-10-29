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
  [9, 2, 2, 'baru', 'hubungi ali@contoh.invalid atau 012-3456789, IC 010203-04-0506'],
  [4, 999, 4, 'menunggu', 'Soalan "tiada", jawapan\nbaris baru, koma'],
  [5, 1, 5, null, 'tiada status'],
  [6, 2, 3, 'ditolak', 'ditolak sebab lain'],
  [7, 1, 2, 'pending', '+60 salah; -ulang; @sebut'],
  [8, 3, 4, 'selesai', null],
  [10, 2, 5, 'ali_baba', 'status that is not in the known set'],
]

/** Teacher submissions: metadata only exists in the staged spec. */
const SUBMISSIONS: [id: number, user: number, status: string | null][] = [
  [1, 1, 'menunggu'],
  [2, 2, 'diluluskan'],
  [3, 3, ' Baru'],
  [4, 4, null],
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
  // The canonical question points straight at its source paper (exam_questions.source_paper_id), not through a pivot.
  await env.pool.query(`insert into archive_cloud.exam_questions (id, source_paper_id, exam_paper_id, status_id, number_label) values (1, 1, 1, 1, '3')`)
  for (const [id, q, u, status, reason] of REPORTS) {
    await env.pool.query(
      `insert into archive_cloud.question_reports (id, question_id, reporter_id, status, report_type, description, created_at, updated_at)
       values ($1, $2, $3, $4, 'lain_lain', $5, '2026-03-01T17:15:00Z', '2026-03-02T00:00:00Z')`,
      [id, q, u, status, reason],
    )
  }
  for (const [id, u, status] of SUBMISSIONS) {
    await env.pool.query(
      `insert into archive_cloud.question_submissions (id, teacher_id, status, created_at, updated_at)
       values ($1, $2, $3, '2026-03-01T17:15:00Z', '2026-03-02T00:00:00Z')`,
      [id, u, status],
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
    expect(csvCell('2026-03-02')).toBe('2026-03-02')
    // Leading blanks (space, NBSP, LF) do not hide a formula.
    expect(csvCell(' =1+1')).toBe("' =1+1")
    expect(csvCell('\u00a0@x')).toBe("'\u00a0@x")
    expect(csvCell('\n=1')).toBe("\"'\n=1\"")
    expect(csvCell('  - x')).toBe("'  - x")
    expect(csvCell('a=b')).toBe('a=b')
  })
})

describe('exportOpenQuestionReports', () => {
  it('exports only the open reports, with the identifiers of the question and no reporter', async () => {
    const dir = fresh()
    const r = await exportOpenQuestionReports({ pool: env.pool, outDir: dir, now: () => NOW, pageSize: 2 })
    expect(r.csv).toBe(join(dir, `question-reports-open-${STAMP}.csv`))
    expect(r.summary).toBe(join(dir, `question-reports-open-${STAMP}.summary.json`))
    expect(r.exported).toBe(5)
    expect(r.total).toBe(10)

    const rows = parseCsv(readFileSync(r.csv, 'utf8'))
    expect(rows[0]).toEqual([...CSV_COLUMNS])
    expect(CSV_COLUMNS.some((c) => /user|name|email|school/i.test(c))).toBe(false)
    const col = (row: string[], name: (typeof CSV_COLUMNS)[number]) => row[CSV_COLUMNS.indexOf(name)]
    const body = rows.slice(1)
    expect(body.map((x) => col(x, 'legacy_report_id'))).toEqual(['1', '2', '4', '7', '9'])

    const first = body[0] as string[]
    expect(first).toEqual(['1', '1', 'contoh-2025-1', '3', 'MP1', '1', '1', 'baru', 'lain_lain', 'Jawapan salah', '2026-03-02'])
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
    // E-mail, phone and IC in the free text are redacted before the file is written.
    expect(reason('9')).toBe('hubungi [dihapus] atau [dihapus], IC [dihapus]')
    expect(text).not.toMatch(/ali@|3456789|0506/)
    expect(text).toContain('"Soalan ""tiada"", jawapan\nbaris baru, koma"')
    // No data cell begins with a formula character.
    for (const row of body) for (const cell of row) expect(cell).not.toMatch(/^[=+\-@\t\r]/)
  })

  it('never writes the reporter: no user value appears in the files', async () => {
    const r = await exportOpenQuestionReports({ pool: env.pool, outDir: fresh(), now: () => NOW })
    const text = `${readFileSync(r.csv, 'utf8')}\n${readFileSync(r.submissions.csv, 'utf8')}\n${readFileSync(r.summary, 'utf8')}`
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
    expect(readdirSync(dir).sort()).toEqual([
      `question-reports-open-${STAMP}.csv`,
      `question-reports-open-${STAMP}.summary.json`,
      `question-submissions-open-${STAMP}.csv`,
    ])
    expect(statSync(r.submissions.csv).mode & 0o777).toBe(0o600)
    const s = JSON.parse(readFileSync(r.summary, 'utf8')) as {
      total: number
      exported: number
      byStatus: { status: string; count: number; exported: boolean }[]
      openStatuses: string[]
      submissions: unknown
    }
    expect(s.total).toBe(10)
    expect(s.exported).toBe(5)
    // Only the documented known statuses are named; every other value (also a code-shaped one) is "(other)".
    expect(s.byStatus).toEqual([
      { status: '(null)', count: 1, exported: false },
      { status: '(other)', count: 2, exported: false },
      { status: 'baru', count: 3, exported: true },
      { status: 'menunggu', count: 1, exported: true },
      { status: 'pending', count: 1, exported: true },
      { status: 'selesai', count: 2, exported: false },
    ])
    expect(s.submissions).toEqual({
      total: 4,
      exported: 2,
      csvFile: `question-submissions-open-${STAMP}.csv`,
      byStatus: [
        { status: '(null)', count: 1, exported: false },
        { status: '(other)', count: 1, exported: false },
        { status: 'baru', count: 1, exported: true },
        { status: 'menunggu', count: 1, exported: true },
      ],
    })
    expect(JSON.stringify(s)).not.toMatch(/ali_baba|diluluskan|ditolak/)
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

    // The summary cannot be written (a link sits at its path): the CSV is removed too, and the link target is untouched.
    const dir3 = fresh()
    mkdirSync(dir3, { recursive: true })
    const victim3 = join(dir3, 'victim3.txt')
    writeFileSync(victim3, 'keep')
    symlinkSync(victim3, join(dir3, `question-reports-open-${STAMP}.summary.json`))
    await expect(exportOpenQuestionReports({ pool: env.pool, outDir: dir3, now: () => NOW })).rejects.toThrow(/symbolic link/)
    expect(readdirSync(dir3).sort()).toEqual([`question-reports-open-${STAMP}.summary.json`, 'victim3.txt'])
    expect(readFileSync(victim3, 'utf8')).toBe('keep')

    // An existing file with the same stamp is never replaced: the run fails and leaves it as it was.
    const dir2 = fresh()
    mkdirSync(dir2, { recursive: true })
    const old = join(dir2, `question-reports-open-${STAMP}.csv`)
    writeFileSync(old, 'old', { mode: 0o644 })
    await expect(exportOpenQuestionReports({ pool: env.pool, outDir: dir2, now: () => NOW })).rejects.toThrow(/already exists/)
    expect(readFileSync(old, 'utf8')).toBe('old')
    expect(readdirSync(dir2)).toEqual([`question-reports-open-${STAMP}.csv`])

    // The second CSV exists already: the reports CSV this run created is removed, the old file stays.
    const dir4 = fresh()
    mkdirSync(dir4, { recursive: true })
    const oldSub = join(dir4, `question-submissions-open-${STAMP}.csv`)
    writeFileSync(oldSub, 'old-sub')
    await expect(exportOpenQuestionReports({ pool: env.pool, outDir: dir4, now: () => NOW })).rejects.toThrow(/already exists/)
    expect(readdirSync(dir4)).toEqual([`question-submissions-open-${STAMP}.csv`])
    expect(readFileSync(oldSub, 'utf8')).toBe('old-sub')

    // A second run in a later second works and leaves the first pair alone.
    const dir5 = fresh()
    await exportOpenQuestionReports({ pool: env.pool, outDir: dir5, now: () => NOW })
    await exportOpenQuestionReports({ pool: env.pool, outDir: dir5, now: () => new Date(NOW.getTime() + 1000) })
    expect(readdirSync(dir5)).toHaveLength(6)
  })

  it('exports open submissions as metadata only (id, status, Malaysia date), never the user', async () => {
    const r = await exportOpenQuestionReports({ pool: env.pool, outDir: fresh(), now: () => NOW })
    expect(r.submissions.csv).toMatch(/question-submissions-open-20261029T173000Z\.csv$/)
    expect(r.submissions.exported).toBe(2)
    expect(r.submissions.total).toBe(4)
    const rows = parseCsv(readFileSync(r.submissions.csv, 'utf8'))
    expect(rows).toEqual([
      ['legacy_submission_id', 'status', 'created_date'],
      ['1', 'menunggu', '2026-03-02'],
      ['3', ' Baru', '2026-03-02'],
    ])
    expect(statSync(r.submissions.csv).mode & 0o777).toBe(0o600)
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
    expect(r.text).toMatch(/5 open report\(s\) exported of 10; 2 open submission\(s\) of 4/)
    expect(r.text).toMatch(/baru \| 3 \| yes/)
    expect(r.text).toMatch(/selesai \| 2 \| no/)
    expect(r.text).toMatch(/\(other\) \| 2 \| no/)
    expect(r.text).not.toMatch(/ali_baba|diluluskan|ditolak/)
    expect(r.text).toContain('submissions csv (metadata only)')
    expect(r.text).toContain(dir)
    expect(r.text).not.toMatch(/Jawapan|HYPERLINK|Soalan "tiada"|contoh\.invalid/)
    expect(readdirSync(dir)).toHaveLength(3)
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
