import { describe, expect, it } from 'vitest'

import { AccountDataRepository } from '../../src/modules/account/account-data.repository'
import { StatsService } from '../../src/modules/account/settings.service'
import type { PrismaService } from '../../src/db/prisma.service'

/**
 * S4-T05 (FR-X3-1, FR-X3-2, API-AUTH-13): the public "Tahap" counter counts only active levels that are
 * not primary. The fixture is in memory, not a seed row: the 11 active levels of the UAT clone (D1-D6
 * and T1-T5 all active, before U-OP-03) cannot exist in a migrated database any more (DM-13 check).
 */
interface LevelRow {
  code: string
  stage: 'primary' | 'lower_secondary' | 'upper_secondary'
  isActive: boolean
}

const UAT_TODAY: LevelRow[] = [
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ code: `D${String(n)}`, stage: 'primary' as const, isActive: true })),
  ...[1, 2, 3].map((n) => ({ code: `T${String(n)}`, stage: 'lower_secondary' as const, isActive: true })),
  ...[4, 5].map((n) => ({ code: `T${String(n)}`, stage: 'upper_secondary' as const, isActive: true })),
]

/** A stand-in for the Prisma client: answers the catalogue read and evaluates the level count on the fixture. */
function fakePrisma(levels: LevelRow[]): PrismaService {
  const columns = [
    { table_name: 'education_levels', column_name: 'is_active' },
    { table_name: 'education_levels', column_name: 'stage' },
  ]
  // Called both as a tagged template (`$queryRaw\`...\``: a string array) and with a `Prisma.sql` statement (`.sql`).
  const queryRaw = (statement: readonly string[] | { sql: string }): Promise<unknown[]> => {
    const raw = Array.isArray(statement) ? statement.join('?') : (statement as { sql: string }).sql
    const sql = raw.replace(/\s+/g, ' ')
    if (sql.includes('information_schema.columns')) return Promise.resolve(columns)
    if (sql.includes('FROM education_levels')) {
      const secondaryOnly = sql.includes("stage <> 'primary'")
      const n = levels.filter((l) => l.isActive && (!secondaryOnly || l.stage !== 'primary')).length
      return Promise.resolve([{ c: BigInt(n) }])
    }
    throw new Error(`unexpected statement in the fixture: ${sql}`)
  }
  return { client: { $queryRaw: queryRaw } } as unknown as PrismaService
}

describe('public stats "Tahap" (S4-T05)', () => {
  it('counts 5 on the 11-level UAT shape (Darjah still active): only Tingkatan 1-5', async () => {
    expect(UAT_TODAY.filter((l) => l.isActive)).toHaveLength(11)
    const stats = await new StatsService(new AccountDataRepository(fakePrisma(UAT_TODAY))).get()
    expect(stats.levelCount).toBe(5)
  })

  it('counts 5 after U-OP-03 (Darjah inactive) and drops an inactive Tingkatan', async () => {
    const afterFix = UAT_TODAY.map((l) => (l.stage === 'primary' ? { ...l, isActive: false } : l))
    expect((await new StatsService(new AccountDataRepository(fakePrisma(afterFix))).get()).levelCount).toBe(5)
    const t5Off = afterFix.map((l) => (l.code === 'T5' ? { ...l, isActive: false } : l))
    expect((await new StatsService(new AccountDataRepository(fakePrisma(t5Off))).get()).levelCount).toBe(4)
  })
})
