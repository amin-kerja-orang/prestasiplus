/**
 * The entity matrix must cover every step the BE-28 and BE-29 registries build (and nothing else), so a step added by a
 * later card without a matrix row fails here instead of at the rehearsal.
 */
import type pg from 'pg'
import { describe, expect, it } from 'vitest'

import { buildCoreSteps, CoreContext } from '../../../src/migration/load'
import { ActivityContext, ACTIVITY_GROUPS, buildActivitySteps } from '../../../src/migration/load/activity'
import { CLAIMABLE_TABLES, ENTITY_MATRIX, ETL_DERIVED_CHILDREN } from '../../../src/migration/verify'
import { existingLegacyTables, readMigratableList } from '../../../src/migration/verify/fk-graph'
import { PROBE_ENTITY } from '../activity/helpers'
import { createStagingDb, type StagingDb } from '../staging/helpers'

const pool = {} as unknown as pg.Pool
const env = { NODE_ENV: 'test', IC_HASH_KEY: 'x'.repeat(24) }

describe('entity matrix', () => {
  const core = buildCoreSteps(new CoreContext({ pool, env, source: 'cloud', asOf: '2026-06-01' }))
  const activity = buildActivitySteps(new ActivityContext({ pool, env, source: 'cloud', asOf: '2026-06-01' }), ACTIVITY_GROUPS)
  // `questions` is loaded by the standalone `migrate:questions` (QLOAD), after `migrate:all`: a matrix row, never registered here.
  const STANDALONE = ['questions']
  const registered = [...core, ...activity].map((s) => s.entity).filter((n) => n !== PROBE_ENTITY)
  const matrix = ENTITY_MATRIX.map((m) => m.entity)

  it('has a row for every registered entity, in load order, and no other row', () => {
    expect(registered.length).toBeGreaterThan(30)
    expect(matrix.filter((n) => !registered.includes(n) && !STANDALONE.includes(n))).toEqual([])
    expect(registered.filter((n) => !matrix.includes(n))).toEqual([])
    // core first, then the activity groups: the order of the report follows the load order
    expect(matrix.indexOf('users')).toBeLessThan(matrix.indexOf('wallets'))
    expect(new Set(matrix).size).toBe(matrix.length)
  })

  it('requires every registered entity and gives each a counting mode', () => {
    for (const m of ENTITY_MATRIX) {
      expect(m.required, m.entity).toBe(!STANDALONE.includes(m.entity))
      expect(['legacy', 'idmap', 'none']).toContain(m.count)
    }
    expect(ENTITY_MATRIX.filter((m) => m.count === 'none').map((m) => m.entity)).toEqual(['wallet_ledger_drift'])
  })

  it('the source of each step is the cloud', () => {
    for (const s of [...core, ...activity]) expect(s.source).toBe('cloud')
  })
})

describe('matrix against the schema', () => {
  let env2: StagingDb
  it('every target table exists, carries the legacy pair and is migratable', async () => {
    env2 = await createStagingDb()
    try {
      const migratable = new Set(await existingLegacyTables(env2.pool, readMigratableList()))
      for (const m of ENTITY_MATRIX.filter((x) => x.count === 'legacy')) expect(migratable.has(m.targetTable), m.targetTable).toBe(true)
      for (const t of CLAIMABLE_TABLES) expect(migratable.has(t), `claimable ${t}`).toBe(true)
      // The derived children have NO legacy pair (that is why they are listed) and exist.
      for (const d of ETL_DERIVED_CHILDREN) {
        expect(migratable.has(d.table), d.table).toBe(false)
        const r = await env2.pool.query(`select to_regclass($1) is not null as ok`, [d.table])
        expect(r.rows[0]?.ok, d.table).toBe(true)
      }
    } finally {
      await env2.close()
    }
  })
})
