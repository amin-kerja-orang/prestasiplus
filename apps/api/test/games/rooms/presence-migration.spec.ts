import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../../support/db'

/** S7-T01 R3, migration 0236: DM-90. The global setup has applied it to the template; these cases run its own reversal and the file again. */
const MIGRATION = readFileSync(fileURLToPath(new URL('../../../prisma/migrations/0236_s7_game_room_presence/migration.sql', import.meta.url)), 'utf8')
const REVERSE = MIGRATION.split('\n')
  .filter((line) => /^--\s+ALTER TABLE "game_room_players" DROP COLUMN/.test(line))
  .map((line) => line.replace(/^--\s+/, ''))
  .join('\n')

describe('migration 0236 game room presence', () => {
  let db: TestDatabase

  const columns = () =>
    db.query<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(
      `select column_name, data_type, is_nullable, column_default from information_schema.columns
        where table_name = 'game_room_players' and column_name in ('last_polled_at', 'consecutive_timeouts') order by column_name`,
    )

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('the template has last_polled_at (timestamptz, nullable) and consecutive_timeouts (int, not null, default 0)', async () => {
    expect(await columns()).toEqual([
      { column_name: 'consecutive_timeouts', data_type: 'integer', is_nullable: 'NO', column_default: '0' },
      { column_name: 'last_polled_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
    ])
  })

  it('is idempotent: running the file again changes nothing', async () => {
    await db.query(MIGRATION)
    expect(await columns()).toHaveLength(2)
  })

  it('is reversible: the written DROP COLUMN lines remove both, and the file adds them back with the defaults', async () => {
    expect(REVERSE.split('\n')).toHaveLength(2)
    await db.query(REVERSE)
    expect(await columns()).toHaveLength(0)
    await db.query(MIGRATION)
    expect(await columns()).toHaveLength(2)
  })
})
