import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { backfillDifficultyLevel } from '../../scripts/uat-ops/difficulty-level-backfill'
import { createTestDatabase, type TestDatabase } from '../support/db'

/** S1-T02 UAT-ops scripts: U-OP-19 backfill (DM-47) and the read-only DM-19 tag-integrity pack. */
describe('uat-ops scripts of S1-T02', () => {
  let db: TestDatabase
  let client: pg.Client
  let n = 0

  beforeAll(async () => {
    db = await createTestDatabase()
    client = new pg.Client({ connectionString: db.url })
    await client.connect()
  })
  afterAll(async () => {
    await client.end()
    await db.drop()
  })

  const version = async (level: number | null, tp: number | null): Promise<string> => {
    const q = (await db.query<{ id: string }>(`insert into questions (source_type, latest_version_no) values ('manual', 1) returning id::text`))[0]!.id
    await db.query(`insert into question_versions (question_id, version_no, status, type, stem_ms, difficulty_level, difficulty_tp) values ($1::bigint, 1, 'draft', 'mcq', $2, $3, $4)`, [q, `x${String(++n)}`, level, tp])
    return q
  }
  const levelOf = async (q: string) => (await db.query<{ difficulty_level: number | null; difficulty_tp: number | null }>(`select difficulty_level, difficulty_tp from question_versions where question_id = $1::bigint`, [q]))[0]!

  it('backfill: a dry run only counts; apply writes least(5, tp) where the level is null and TP is 1..6, in batches, and a second run writes nothing', async () => {
    const rows = {
      tp1: await version(null, 1),
      tp4: await version(null, 4),
      tp6: await version(null, 6),
      noTp: await version(null, null),
      typed: await version(2, 6), // a typed value is never overwritten
    }
    const dry = await backfillDifficultyLevel(client, { dryRun: true, batchSize: 2 })
    expect(dry).toEqual({ dryRun: true, rows: 3, batches: 2 })
    expect((await levelOf(rows.tp1)).difficulty_level).toBeNull()

    const lines: string[] = []
    const applied = await backfillDifficultyLevel(client, { dryRun: false, batchSize: 2, log: (l) => lines.push(l) })
    expect(applied).toEqual({ dryRun: false, rows: 3, batches: 2 })
    expect(lines.some((l) => l.startsWith('batch 1'))).toBe(true)
    expect(await levelOf(rows.tp1)).toEqual({ difficulty_level: 1, difficulty_tp: 1 })
    expect(await levelOf(rows.tp4)).toEqual({ difficulty_level: 4, difficulty_tp: 4 })
    expect(await levelOf(rows.tp6)).toEqual({ difficulty_level: 5, difficulty_tp: 6 }) // TP 6 gives 5, TP untouched
    expect(await levelOf(rows.noTp)).toEqual({ difficulty_level: null, difficulty_tp: null })
    expect(await levelOf(rows.typed)).toEqual({ difficulty_level: 2, difficulty_tp: 6 })

    expect(await backfillDifficultyLevel(client, { dryRun: false })).toEqual({ dryRun: false, rows: 0, batches: 0 })
    expect(await backfillDifficultyLevel(client, { dryRun: true })).toEqual({ dryRun: true, rows: 0, batches: 0 })
  })

  it('tag-integrity.sql is read-only and every section runs against the real schema', async () => {
    const file = readFileSync(fileURLToPath(new URL('../../scripts/uat-ops/tag-integrity.sql', import.meta.url)), 'utf8')
    expect(file).toMatch(/^BEGIN READ ONLY;$/m)
    expect(file).toMatch(/^ROLLBACK;$/m)
    expect(file).not.toMatch(/\b(insert|update|delete|drop|alter|truncate)\b\s/i)
    // Run each statement (the psql meta commands and comments are removed; `:'since'` becomes a literal).
    const statements = file
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('\\') && !l.startsWith('--'))
      .join('\n')
      .replaceAll(":'since'", "'2026-11-01'")
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.startsWith('SELECT'))
    expect(statements).toHaveLength(7)
    for (const sql of statements) await expect(client.query(sql), sql.slice(0, 80)).resolves.toBeDefined()
  })
})
