import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

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
import { DirReader } from '../../../src/migration/staging/readers'
import { loadStaging } from '../../../src/migration/staging/load'
import { capture, createStagingDb, FIXTURE_DIR, tempDir, type StagingDb } from './helpers'

vi.setConfig({ testTimeout: 120_000 })

let env: StagingDb
let report: ProfileReport
const NOW = new Date('2026-10-19T08:00:00Z')

beforeAll(async () => {
  env = await createStagingDb()
  await loadStaging(env.pool, new DirReader(FIXTURE_DIR))
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
  })

  it('lists distinct enum values with counts, including values the new system does not know', () => {
    const role = table('users').enums.find((e) => e.column === 'role')
    expect(role?.distinct).toBe(7)
    expect(role?.truncated).toBe(false)
    expect(role?.values[0]).toEqual({ value: 'pelajar', count: 6 })
    expect(role?.values.map((v) => v.value)).toContain('super_guru')
    const state = table('schools').enums.find((e) => e.column === 'state')
    expect(Object.fromEntries(state?.values.map((v) => [v.value, v.count]) ?? [])).toEqual({ 'Negeri B': 2, 'negeri b': 1 })
  })

  it('computes null ratios', () => {
    expect(table('users').nullRatios.email).toBeCloseTo(1 / 13, 3)
    expect(table('users').nullRatios.id).toBe(0)
    expect(table('subjects').nullRatios.color).toBe(1)
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
    expect(hist).toEqual({ '$2y$': 8, '$2b$': 1, '$argon2id$': 1, '(other)': 1, '(empty)': 1, '(null)': 1 })
  })
})

describe('enum cap and masking', () => {
  it('caps the distinct values at 50 and says so', async () => {
    await env.pool.query(`insert into staging_cloud.battles (id, mode) select 1000 + g, 'mode_' || lpad(g::text, 3, '0') from generate_series(1, 60) g`)
    try {
      const mode = (await collectProfile(env.pool, NOW)).tables.find((t) => t.table === 'battles')?.enums.find((e) => e.column === 'mode')
      expect(mode?.distinct).toBe(62)
      expect(mode?.truncated).toBe(true)
      expect(mode?.values).toHaveLength(ENUM_CAP)
    } finally {
      await env.pool.query(`delete from staging_cloud.battles where id > 1000`)
    }
  })

  it('masks an enum value that looks personal', async () => {
    await env.pool.query(`insert into staging_cloud.settings (id, "group") values (900, 'someone@contoh.invalid'), (901, '${'1'.repeat(10)}')`)
    try {
      const text = JSON.stringify(await collectProfile(env.pool, NOW))
      expect(text).not.toContain('someone@contoh.invalid')
      expect(text).not.toContain('1111111111')
      expect(text).toContain('[masked]')
    } finally {
      await env.pool.query(`delete from staging_cloud.settings where id >= 900`)
    }
    expect(maskEnumValue('aktif')).toBe('aktif')
    expect(maskEnumValue('a'.repeat(41))).toBe('[masked]')
  })
})

describe('no personal value in the report (AC3 grep test)', () => {
  const personalValues = (): string[] => {
    const values = new Set<string>()
    for (const spec of TABLES) {
      const file = join(FIXTURE_DIR, `${spec.name}.ndjson`)
      if (!existsSync(file)) continue
      const enumCols = new Set(spec.columns.filter((c) => c.enum).map((c) => c.name))
      for (const line of readFileSync(file, 'utf8').trim().split('\n')) {
        for (const [col, v] of Object.entries(JSON.parse(line) as Record<string, unknown>)) {
          if (typeof v === 'string' && !enumCols.has(col) && v.length >= 6) values.add(v)
        }
      }
    }
    return [...values]
  }

  it('finds none of the fixture names, e-mails, phones, IC numbers or usernames in the md or json', () => {
    const dir = tempDir()
    try {
      const files = writeProfile(report, join(dir.path, '.migration-out'))
      const texts = [readFileSync(files.md, 'utf8'), readFileSync(files.json, 'utf8')]
      const values = personalValues()
      expect(values.length).toBeGreaterThan(40)
      for (const needle of ['Murid Contoh', 'Guru Contoh', 'contoh.invalid', 'Sekolah Contoh', '0000000001', '000000000001', 'contoh001', ...values]) {
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

  it('refuses an output directory outside .migration-out', () => {
    const dir = tempDir()
    try {
      expect(() => writeProfile(report, join(dir.path, 'reports'))).toThrow(ProfileOutputError)
    } finally {
      dir.cleanup()
    }
  })
})

describe('staging:profile command', () => {
  it('writes the report under the given .migration-out folder and returns 0', async () => {
    const dir = tempDir()
    try {
      const io = capture()
      const out = join(dir.path, '.migration-out')
      const code = await runStagingCli(['staging:profile', '--out', out], { env: {}, pool: env.pool, out: io.out, err: io.err, now: NOW })
      expect(code).toBe(STAGING_EXIT.ok)
      expect(existsSync(join(out, 'profile-2026-10-19.md'))).toBe(true)
      expect(existsSync(join(out, 'profile-2026-10-19.json'))).toBe(true)
      const bad = await runStagingCli(['staging:profile', '--out', join(dir.path, 'plain')], { env: {}, pool: env.pool, out: io.out, err: io.err, now: NOW })
      expect(bad).toBe(STAGING_EXIT.failed)
    } finally {
      dir.cleanup()
    }
  })
})
