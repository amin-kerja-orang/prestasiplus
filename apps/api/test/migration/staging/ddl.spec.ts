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

  it('has 89 migrated or staged tables and 38 archived question tables, with the final paper table names', () => {
    expect(TABLES.filter((t) => t.group === 'staging')).toHaveLength(89)
    expect(TABLES.filter((t) => t.group === 'archive')).toHaveLength(38)
    expect(TABLES).toHaveLength(127)
    expect(findTable('exam_papers')?.group).toBe('archive')
    expect(findTable('teacher_reference_papers')?.group).toBe('archive')
    expect(findTable('question_sets')?.group).toBe('staging')
    // framework, derived and backup tables are not mirrored (`_dedup_map` is pending the half AM answer)
    for (const name of ['cache', 'jobs', 'migrations', 'personal_access_tokens', 'school_battle_rankings', '_dedup_map', 'question_options_prefix_bak_20260819']) {
      expect(findTable(name), name).toBeUndefined()
    }
  })

  it('mirrors the 9 lookup tables (id and slug only, no timestamps) for id to slug joins', () => {
    const staged = ['attempt_statuses', 'paper_statuses', 'question_statuses', 'answer_modes', 'answer_key_kinds', 'stimulus_kinds']
    const archived = ['exam_boards', 'exam_types', 'selection_rules']
    for (const [names, group] of [[staged, 'staging'], [archived, 'archive']] as const) {
      for (const name of names) {
        const t = findTable(name)
        expect(t?.group, name).toBe(group)
        expect(t?.columns.map((c) => c.name), name).toEqual(['id', 'slug'])
      }
    }
  })

  it('uses the real .cloud column names for the renamed columns', () => {
    const cols = (name: string) => findTable(name)?.columns.map((c) => c.name) ?? []
    expect(cols('subjects')).toEqual(expect.arrayContaining(['name_bm', 'name_en']))
    expect(cols('subjects')).not.toContain('name')
    expect(cols('exam_attempts')).toContain('status_id')
    expect(findTable('exam_attempts')?.columns.find((c) => c.name === 'status_id')?.fk).toBe('attempt_statuses')
    expect(cols('questions')).toContain('type')
    expect(cols('source_papers')).toEqual(expect.arrayContaining(['file_hash', 'exam_board_id', 'exam_type_id']))
    expect(cols('exam_questions')).toEqual(expect.arrayContaining(['source_paper_id', 'exam_paper_id', 'paper_section_id', 'status_id']))
    expect(cols('exam_paper_questions')).not.toContain('exam_paper_id')
    const pivot = findTable('spm_set_question')
    expect(pivot?.pk).toBeNull()
    expect(pivot?.columns.map((c) => c.name)).toEqual(['spm_set_id', 'question_id', 'position'])
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
