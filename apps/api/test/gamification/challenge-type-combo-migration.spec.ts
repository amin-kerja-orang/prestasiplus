import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { DEFAULT_METRIC_BY_TYPE } from '../../src/modules/gamification/gamification.constants'
import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S7-T04, DM-81, migration 0232: `ck_challenges_challenge_type` gains `combo` and `ck_challenges_metric` gains `best_combo`
 * (ruling 4 on #500). The test database already ran every migration, so the existing-rows case runs the file again on real rows.
 */
const MIGRATION_0232 = readFileSync(fileURLToPath(new URL('../../prisma/migrations/0232_s7_challenge_type_combo/migration.sql', import.meta.url)), 'utf8')
const OLD_TYPES = ['quiz_count', 'accuracy', 'topic_variety', 'streak', 'time_spent']
const OLD_METRICS = ['sessions', 'correct', 'best_accuracy', 'best_correct_in_session', 'chapters', 'minutes', 'streak']

describe('migration 0232 challenge type combo', () => {
  let db: TestDatabase

  const challenge = (challengeType: string, metric: string | null) =>
    db.query(`insert into challenges (title, challenge_type, metric, target_value) values ('Cabaran Contoh', $1, $2, 10)`, [challengeType, metric])
  const rejects = async (run: () => Promise<unknown>): Promise<string> => {
    try {
      await run()
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error('Expected the statement to be rejected')
  }

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('accepts type combo with metric best_combo', async () => {
    await challenge('combo', 'best_combo')
    expect(await db.query(`select 1 from challenges where challenge_type = 'combo' and metric = 'best_combo'`)).toHaveLength(1)
  })

  it('keeps every older type and metric, and a null metric (OD-25)', async () => {
    for (const type of OLD_TYPES) await challenge(type, null)
    for (const metric of OLD_METRICS) await challenge('quiz_count', metric)
  })

  it('still refuses any other value, in the same two named checks', async () => {
    expect(await rejects(() => challenge('kombo', null))).toMatch(/ck_challenges_challenge_type/)
    expect(await rejects(() => challenge('combo', 'combo'))).toMatch(/ck_challenges_metric/)
    expect(await rejects(() => challenge('quiz_count', 'bestCombo'))).toMatch(/ck_challenges_metric/)
  })

  it('applies on a table that already holds rows, which stay as they were', async () => {
    const before = await db.query(`select id, challenge_type, metric from challenges order by id`)
    expect(before.length).toBeGreaterThan(0)
    await db.query(MIGRATION_0232)
    expect(await db.query(`select id, challenge_type, metric from challenges order by id`)).toEqual(before)
    expect(await rejects(() => challenge('kombo', null))).toMatch(/ck_challenges_challenge_type/)
  })

  it('selects nothing yet: admin writes read this map, so combo stays closed until its evaluator (DM-81)', () => {
    expect(Object.keys(DEFAULT_METRIC_BY_TYPE)).toEqual(OLD_TYPES)
  })
})
