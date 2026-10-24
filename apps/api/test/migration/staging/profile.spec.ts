import { existsSync, mkdirSync, readFileSync, rmdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { findTable, TABLES } from '../../../src/migration/ddl/spec'
import {
  collectProfile,
  ENUM_CAP,
  maskEnumValue,
  ProfileOutputError,
  renderMarkdown,
  writeProfile,
  type ProfileReport,
} from '../../../src/migration/profile'
import { runStagingCli, STAGING_EXIT } from '../../../src/migration/staging/cli'
import { loadStaging } from '../../../src/migration/staging/load'
import { DirReader } from '../../../src/migration/staging/readers'
import { capture, createStagingDb, FIXTURE_DIR, stagingEnv, tempDir, type StagingDb } from './helpers'

let env: StagingDb
let report: ProfileReport
const NOW = new Date('2026-10-19T08:00:00Z')

// One full load for the whole file; the tests that change data use a table filter and clean up.
beforeAll(async () => {
  env = await createStagingDb()
  await loadStaging(env.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(env.db) })
  report = await collectProfile(env.pool, NOW)
})
afterAll(async () => {
  await env.close()
})

const table = (name: string) => {
  const t = report.tables.find((x) => x.table === name)
  if (!t) throw new Error(`no profile for ${name}`)
  return t
}

describe('profile content (AC3)', () => {
  it('profiles every table with the manifest row count', () => {
    const manifest = JSON.parse(readFileSync(join(FIXTURE_DIR, 'manifest.json'), 'utf8')) as { tables: Record<string, { rows: number }> }
    expect(report.tablesProfiled).toBe(TABLES.length)
    expect(report.tablesMissing).toEqual([])
    for (const t of report.tables) expect(t.rowCount, t.table).toBe(manifest.tables[t.table]?.rows)
    // report order follows the spec, whatever the concurrency
    expect(report.tables.map((t) => t.table)).toEqual(TABLES.map((t) => t.name))
  })

  it('lists distinct enum values with counts, including values the new system does not know', () => {
    const role = table('users').enums.find((e) => e.column === 'role')
    expect(role?.distinct).toBe(9)
    expect(role?.truncated).toBe(false)
    expect(role?.values[0]).toEqual({ value: 'pelajar', count: 6 })
    expect(role?.values.map((v) => v.value)).toContain('super_guru')
    const state = table('schools').enums.find((e) => e.column === 'state')
    // multi-word values do not match the allow-pattern (M3), so both spellings are masked, not listed
    expect(state?.values).toEqual([
      { value: '[masked]', count: 2 },
      { value: '[masked]', count: 1 },
    ])
  })

  it('computes null ratios', () => {
    expect(table('users').nullRatios.email).toBeCloseTo(1 / 15, 3)
    expect(table('users').nullRatios.id).toBe(0)
    expect(table('subjects').nullRatios.color).toBe(1)
    expect(table('users').nullRatios.remember_token).toBe(1) // redacted at load (M4)
  })

  it('counts orphans for each declared foreign key', () => {
    const orphan = (t: string, c: string) => table(t).orphans.find((o) => o.column === c)?.orphans
    expect(orphan('users', 'school_id')).toBe(1)
    expect(orphan('users', 'referred_by')).toBe(1)
    expect(orphan('chapters', 'subject_id')).toBe(1)
    expect(orphan('topics', 'chapter_id')).toBe(1)
    expect(orphan('classroom_student', 'classroom_id')).toBe(1)
    expect(orphan('classroom_student', 'student_id')).toBe(1)
    expect(orphan('parent_student', 'student_id')).toBe(1)
    expect(orphan('question_attempts', 'practice_session_id')).toBe(1)
    expect(orphan('question_attempts', 'question_id')).toBe(1)
    expect(orphan('question_options', 'question_id')).toBe(1)
    expect(orphan('classrooms', 'school_id')).toBe(0)
    // one entry per declared fk
    for (const spec of TABLES) {
      const declared = spec.columns.filter((c) => c.fk).map((c) => c.name)
      expect(table(spec.name).orphans.map((o) => o.column), spec.name).toEqual(declared)
    }
  })

  it('counts duplicates for users.email and (school_id, username)', () => {
    const dups = Object.fromEntries(table('users').duplicates.map((d) => [d.check, d]))
    expect(dups['users.email']).toMatchObject({ duplicateGroups: 1, rowsInDuplicateGroups: 2 })
    expect(dups['users.(school_id, username)']).toMatchObject({ duplicateGroups: 1, rowsInDuplicateGroups: 2 })
  })

  it('builds a histogram of password hash prefixes', () => {
    const hist = Object.fromEntries(table('users').hashPrefixes[0]?.prefixes.map((p) => [p.prefix, p.count]) ?? [])
    expect(hist).toEqual({ $2y$: 10, $2b$: 1, $argon2id$: 1, '(other)': 1, '(empty)': 1, '(null)': 1 })
  })
})

describe('enum cap and masking', () => {
  it('caps the distinct values at 50 and says so', async () => {
    await env.pool.query(`insert into staging_cloud.battles (id, mode) select 1000 + g, 'mode_' || lpad(g::text, 3, '0') from generate_series(1, 60) g`)
    try {
      const mode = (await collectProfile(env.pool, NOW, { tables: ['battles'] })).tables[0]?.enums.find((e) => e.column === 'mode')
      expect(mode?.distinct).toBe(62)
      expect(mode?.truncated).toBe(true)
      expect(mode?.values).toHaveLength(ENUM_CAP)
    } finally {
      await env.pool.query(`delete from staging_cloud.battles where id > 1000`)
    }
  })

  it('shows an enum value only if it matches the allow-pattern, else [masked] (M3)', async () => {
    const personal = ['900101-14-5678', '012-345 6789', 'Ahmad Contoh', 'someone@contoh.invalid', '1'.repeat(10), 'a'.repeat(41), 'abcde12345']
    const safe = ['aktif', 'pelajar', 'v1.2:beta/x-y_z', '2026', 'ab1234']
    await env.pool.query(
      `insert into staging_cloud.settings (id, "group") select 900 + i, v from unnest($1::text[]) with ordinality as t(v, i)`,
      [[...personal, ...safe]],
    )
    try {
      const rep = await collectProfile(env.pool, NOW, { tables: ['settings'] })
      const group = rep.tables[0]?.enums.find((e) => e.column === 'group')
      const shown = new Set(group?.values.map((v) => v.value))
      const text = JSON.stringify(rep) + renderMarkdown(rep)
      for (const v of personal) {
        expect(shown.has(v), v).toBe(false)
        expect(text, v).not.toContain(v)
      }
      for (const v of safe) expect(shown.has(v), v).toBe(true)
      expect(group?.values.filter((v) => v.value === '[masked]').reduce((s, v) => s + v.count, 0)).toBe(personal.length)
    } finally {
      await env.pool.query(`delete from staging_cloud.settings where id >= 900`)
    }
    expect(maskEnumValue('aktif')).toBe('aktif')
    expect(maskEnumValue('Ahmad Contoh')).toBe('[masked]') // a two-word name
    expect(maskEnumValue('900101-14-5678')).toBe('[masked]')
    expect(maskEnumValue('012-345 6789')).toBe('[masked]')
    expect(maskEnumValue('a1b2c3d4e5')).toBe('[masked]') // five digits
    expect(maskEnumValue('a1b2c3d4')).toBe('a1b2c3d4') // four digits
    expect(maskEnumValue('')).toBe('[masked]')
  })

  it('gives the same result at concurrency 1 and 4, in spec order', async () => {
    const tables = ['users', 'schools', 'battles']
    const one = await collectProfile(env.pool, NOW, { tables, concurrency: 1 })
    const four = await collectProfile(env.pool, NOW, { tables, concurrency: 4 })
    expect(four).toEqual(one)
    expect(four.tables.map((t) => t.table)).toEqual(TABLES.map((t) => t.name).filter((n) => tables.includes(n)))
  })
})

describe('profile options', () => {
  it('falls back to the default concurrency for a value that is not a positive integer', async () => {
    const tables = ['users', 'schools']
    const base = await collectProfile(env.pool, NOW, { tables })
    for (const concurrency of [0, -3, 1.5, Number.NaN, Infinity]) {
      expect(await collectProfile(env.pool, NOW, { tables, concurrency }), String(concurrency)).toEqual(base)
    }
  })

  it('rejects --tables with a duplicate or unknown table as a usage error', async () => {
    for (const tables of ['users,users', 'users,nope']) {
      const io = capture()
      const code = await runStagingCli(['staging:profile', '--tables', tables], { env: {}, pool: env.pool, out: io.out, err: io.err, now: NOW })
      expect(code, tables).toBe(STAGING_EXIT.usage)
    }
  })
})

describe('no personal value in the report (AC3 grep test)', () => {
  const personalValues = (): string[] => {
    const values = new Set<string>()
    for (const spec of TABLES) {
      const file = join(FIXTURE_DIR, `${spec.name}.ndjson`)
      if (!existsSync(file)) continue
      // Lookup tables (id, slug) hold vocabulary codes such as `published`, not personal values.
      if (spec.columns.length === 2 && spec.columns[1]?.name === 'slug') continue
      const enumCols = new Set(spec.columns.filter((c) => c.enum).map((c) => c.name))
      for (const line of readFileSync(file, 'utf8').trim().split('\n')) {
        for (const [col, v] of Object.entries(JSON.parse(line) as Record<string, unknown>)) {
          if (typeof v === 'string' && !enumCols.has(col) && v.length >= 6) values.add(v)
        }
      }
    }
    return [...values]
  }

  it('finds none of the fixture names, e-mails, phones, IC numbers, usernames or tokens in the md or json', () => {
    const dir = tempDir()
    try {
      const files = writeProfile(report, join(dir.path, '.migration-out'), [dir.path])
      const texts = [readFileSync(files.md, 'utf8'), readFileSync(files.json, 'utf8')]
      const values = personalValues()
      expect(values.length).toBeGreaterThan(40)
      for (const needle of ['Murid Contoh', 'Guru Contoh', 'contoh.invalid', 'Sekolah Contoh', '0000000001', '000000000001', 'contoh001', 'fixture-', ...values]) {
        for (const text of texts) expect(text.toLowerCase(), needle).not.toContain(needle.toLowerCase())
      }
      for (const text of texts) {
        expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/) // e-mail
        expect(text).not.toMatch(/(?<![\d.])0\d{9,}/) // phone
        expect(text).not.toMatch(/(?<![\d.])\d{12}(?![\d.])/) // IC
      }
      expect(files.md).toMatch(/profile-2026-10-19\.md$/)
      expect(files.json).toMatch(/profile-2026-10-19\.json$/)
    } finally {
      dir.cleanup()
    }
  })

  it('only ever prints enum values for columns the spec marks as enum-like', () => {
    const md = renderMarkdown(report)
    for (const t of report.tables) {
      const spec = findTable(t.table)
      expect(t.enums.map((e) => e.column), t.table).toEqual(spec?.columns.filter((c) => c.enum).map((c) => c.name))
    }
    expect(md).toContain('## Password hash prefixes')
    expect(md).not.toMatch(/\$2y\$10\$/) // never a full hash
  })
})

describe('report output guard (L3)', () => {
  it('refuses an output directory outside .migration-out or outside the allowed roots, creating nothing', () => {
    const dir = tempDir()
    const other = tempDir()
    try {
      expect(() => writeProfile(report, join(dir.path, 'reports'), [dir.path])).toThrow(ProfileOutputError)
      expect(existsSync(join(dir.path, 'reports'))).toBe(false)
      expect(() => writeProfile(report, join(other.path, '.migration-out'), [dir.path])).toThrow(/working directory or the repository root/)
      expect(existsSync(join(other.path, '.migration-out'))).toBe(false)
    } finally {
      dir.cleanup()
      other.cleanup()
    }
  })

  it.runIf(process.platform !== 'win32')('writes the files with mode 0600 in a 0700 directory', () => {
    const dir = tempDir()
    try {
      const files = writeProfile(report, join(dir.path, '.migration-out'), [dir.path])
      expect(statSync(files.md).mode & 0o777).toBe(0o600)
      expect(statSync(files.json).mode & 0o777).toBe(0o600)
      expect(statSync(join(dir.path, '.migration-out')).mode & 0o777).toBe(0o700)
    } finally {
      dir.cleanup()
    }
  })

  it('refuses to write through a symbolic link, and a link that escapes the allowed roots', () => {
    const dir = tempDir()
    const outside = tempDir()
    try {
      const out = join(dir.path, '.migration-out')
      mkdirSync(out)
      writeFileSync(join(outside.path, 'target.md'), 'keep')
      try {
        symlinkSync(join(outside.path, 'target.md'), join(out, 'profile-2026-10-19.md'))
      } catch {
        return // symbolic links are not permitted here (Windows without privilege)
      }
      expect(() => writeProfile(report, out, [dir.path])).toThrow(/symbolic link/)
      expect(readFileSync(join(outside.path, 'target.md'), 'utf8')).toBe('keep')
      // a .migration-out that is itself a link to a folder outside the roots
      mkdirSync(join(dir.path, 'linked'))
      mkdirSync(join(outside.path, '.migration-out'))
      const linked = join(dir.path, 'linked', '.migration-out')
      symlinkSync(join(outside.path, '.migration-out'), linked, 'dir')
      expect(() => writeProfile(report, linked, [dir.path])).toThrow(/working directory or the repository root/)
    } finally {
      dir.cleanup()
      outside.cleanup()
    }
  })
})

describe('staging:profile command', () => {
  it('writes the report under a .migration-out folder in the working directory and returns 0', async () => {
    const base = join(process.cwd(), '.migration-out', `test-${process.pid}`)
    const badDir = tempDir()
    try {
      const io = capture()
      const code = await runStagingCli(['staging:profile', '--tables', 'users,schools', '--out', base], { env: {}, pool: env.pool, out: io.out, err: io.err, now: NOW })
      expect(code).toBe(STAGING_EXIT.ok)
      expect(existsSync(join(base, 'profile-2026-10-19.md'))).toBe(true)
      const json = JSON.parse(readFileSync(join(base, 'profile-2026-10-19.json'), 'utf8')) as ProfileReport
      expect(json.tables.map((t) => t.table)).toEqual(['users', 'schools'])
      const bad = await runStagingCli(['staging:profile', '--tables', 'users', '--out', join(badDir.path, 'plain')], { env: {}, pool: env.pool, out: io.out, err: io.err, now: NOW })
      expect(bad).toBe(STAGING_EXIT.failed)
    } finally {
      rmSync(base, { recursive: true, force: true })
      badDir.cleanup()
      try {
        rmdirSync(join(process.cwd(), '.migration-out')) // only succeeds when empty; leave other users' reports alone
      } catch {
        // not empty or already gone
      }
    }
  })
})
