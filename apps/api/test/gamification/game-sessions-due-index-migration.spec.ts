import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S7-T01, migration 0235: DM-89. Each case runs the reversal written in the file's own comment and then the file again. */
const MIGRATION = readFileSync(fileURLToPath(new URL('../../prisma/migrations/0235_s7_game_sessions_due_index/migration.sql', import.meta.url)), 'utf8')
const REVERSE = MIGRATION.split('\n')
  .filter((line) => /^-- Reversible: DROP INDEX /.test(line))
  .map((line) => line.replace('-- Reversible: ', ''))
  .join('\n')

describe('migration 0235 game sessions due index', () => {
  let db: TestDatabase

  const indexdef = async (): Promise<string | undefined> =>
    (await db.query<{ indexdef: string }>(`select indexdef from pg_indexes where tablename = 'game_sessions' and indexname = 'ix_game_sessions_jutawan_due'`))[0]?.indexdef

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })
  beforeEach(async () => {
    await db.query(REVERSE)
    await db.query(MIGRATION)
  })

  it('is a partial index on created_at with the predicate of the sweep', async () => {
    const def = (await indexdef()) ?? ''
    expect(def).toContain('(created_at)')
    expect(def).toContain(`game = 'jutawan'`)
    expect(def).toContain('NOT jutawan_over')
    expect(def).toContain('submitted_at IS NULL')
    expect(def).toContain('closed_at IS NULL')
  })

  it('is reversible: the written DROP INDEX removes it and the file creates it again', async () => {
    expect(REVERSE).toMatch(/^DROP INDEX "ix_game_sessions_jutawan_due";$/)
    await db.query(REVERSE)
    expect(await indexdef()).toBeUndefined()
    await db.query(MIGRATION)
    expect(await indexdef()).toBeDefined()
  })

  it('can serve the sweep query (sequential scans off, so the plan shows whether the predicate is implied)', async () => {
    // The pool has one connection, so the setting holds for the next statement and is reset in the finally.
    await db.query('set enable_seqscan = off')
    try {
      const plan = await db.query<{ 'QUERY PLAN': string }>(
        `explain select s.id from game_sessions s
          where s.game = 'jutawan' and not s.jutawan_over and s.submitted_at is null and s.closed_at is null and s.created_at <= now()
          order by s.created_at limit 100`,
      )
      expect(plan.map((r) => r['QUERY PLAN']).join('\n')).toContain('ix_game_sessions_jutawan_due')
    } finally {
      await db.query('reset enable_seqscan')
    }
  })
})
