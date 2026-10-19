import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { DDL_FILE } from '../../../src/migration/ddl/generate'
import { renderDdl } from '../../../src/migration/ddl/render'
import { findTable, TABLES } from '../../../src/migration/ddl/spec'
import { generateTinyFixture } from '../fixtures/generate-tiny'
import { FIXTURE_DIR } from './helpers'

/** A Windows checkout may convert line endings (autocrlf); the content is what matters. */
const lf = (text: string): string => text.split(String.fromCharCode(13, 10)).join(String.fromCharCode(10))

describe('staging_cloud.sql', () => {
  it('is the exact output of the spec renderer (run npm run staging:ddl after editing the spec)', () => {
    expect(lf(readFileSync(DDL_FILE, 'utf8'))).toBe(renderDdl())
  })

  it('has 83 migrated or staged tables and 35 archived question tables, with the final paper table names', () => {
    expect(TABLES.filter((t) => t.group === 'staging')).toHaveLength(83)
    expect(TABLES.filter((t) => t.group === 'archive')).toHaveLength(35)
    expect(findTable('exam_papers')?.group).toBe('archive')
    expect(findTable('teacher_reference_papers')?.group).toBe('archive')
    expect(findTable('question_sets')?.group).toBe('staging')
    // framework, lookup and derived tables are not mirrored
    for (const name of ['cache', 'jobs', 'personal_access_tokens', 'answer_modes', 'exam_boards', 'school_battle_rankings']) {
      expect(findTable(name), name).toBeUndefined()
    }
  })

  it('declares only foreign keys that point at a spec table, and enum columns are text', () => {
    for (const t of TABLES) {
      for (const c of t.columns) {
        if (c.fk) expect(findTable(c.fk), `${t.name}.${c.name} -> ${c.fk}`).toBeDefined()
        if (c.enum) expect(c.type, `${t.name}.${c.name}`).toBe('t')
      }
    }
  })

  it('creates both schemas with a repeatable drop-and-create and keeps only the primary key constraint', () => {
    const sql = readFileSync(DDL_FILE, 'utf8')
    expect(sql).toContain('drop schema if exists "staging_cloud" cascade;')
    expect(sql).toContain('drop schema if exists "archive_cloud" cascade;')
    expect(sql).not.toMatch(/\b(foreign key|references|unique|check|not null)\b/i)
    expect(sql.match(/primary key/g)).toHaveLength(TABLES.filter((t) => t.pk).length)
  })
})

describe('synthetic fixture (apps/api/test/migration/fixtures/cloud-tiny)', () => {
  it('is exactly what the generator produces (deterministic)', () => {
    const expected = generateTinyFixture()
    expect(readdirSync(FIXTURE_DIR).sort()).toEqual([...expected.keys()].sort())
    for (const [name, content] of expected) expect(lf(readFileSync(join(FIXTURE_DIR, name), 'utf8'))).toBe(content)
  })

  it('keeps every file under 1 MB', () => {
    for (const name of readdirSync(FIXTURE_DIR)) expect(statSync(join(FIXTURE_DIR, name)).size).toBeLessThan(1024 * 1024)
  })

  it('holds only obviously fictitious personal data', () => {
    const lines = readFileSync(join(FIXTURE_DIR, 'users.ndjson'), 'utf8').trim().split('\n')
    expect(lines.length).toBeGreaterThan(5)
    for (const line of lines) {
      const u = JSON.parse(line) as Record<string, string | null>
      if (u.email) expect(u.email.toLowerCase()).toMatch(/@contoh\.invalid$/)
      expect(u.name).toMatch(/Contoh \d+$/)
      expect(u.phone).toMatch(/^0{7}\d{3}$/)
      expect(u.ic).toMatch(/^0{10}\d{2}$/)
    }
  })
})
