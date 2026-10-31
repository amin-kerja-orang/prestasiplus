import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../../prisma/seed'
import { QUESTION_COUNT_SQL } from '../../../src/modules/account/account-data.repository'
import { BankFacts } from '../../../src/modules/practice/reads/overview/bank-facts'
import { OverviewRepository } from '../../../src/modules/practice/reads/overview/overview.repository'
import { OFFERED_LEVEL_CODES } from '../../../src/modules/practice/rules'
import { createTestDatabase, type TestDatabase } from '../../support/db'

/**
 * R1-B01 / D91: the practice card (`OverviewRepository.bankMatrix`) counts UNGROUPED servable questions only, the hub / draw rule, so
 * card = details = drawable. The login count (`QUESTION_COUNT_SQL`) keeps counting stimulus-group members.
 * Full demo seed: the BM card was 53 when it counted the 3 SEED-GRP-PASAR group MCQs, which practice never draws; it is 50 now.
 */
let db: TestDatabase
let bank: BankFacts
let offeredIds: string[]

const subjectId = async (code: string): Promise<string> => (await db.query<{ id: string }>(`select id::text id from subjects where code = $1`, [code]))[0]?.id as string

beforeAll(async () => {
  db = await createTestDatabase()
  await runSeeds(seedModules, { prisma: db.prisma })
  bank = new BankFacts(await new OverviewRepository({ client: db.prisma } as never).bankMatrix())
  offeredIds = (await db.query<{ id: string }>(`select id::text id from education_levels where code = any($1)`, [[...OFFERED_LEVEL_CODES]])).map((r) => r.id)
}, 600_000)

afterAll(async () => {
  await db?.drop()
})

describe('practice card counts ungrouped servable questions only (D91)', () => {
  it('BM practice card is 50: the 3 stimulus-group MCQs are not counted', async () => {
    const bm = await subjectId('BM')
    expect(bank.practice(bm, offeredIds)).toBe(50)
    const grouped = Number((await db.query<{ c: string }>(`${QUESTION_COUNT_SQL} AND v.subject_id = $1 AND q.group_id IS NOT NULL`, [bm]))[0]?.c)
    expect(grouped).toBe(3)
    const ungrouped = Number((await db.query<{ c: string }>(`${QUESTION_COUNT_SQL} AND v.subject_id = $1 AND q.group_id IS NULL`, [bm]))[0]?.c)
    expect(bank.practice(bm, offeredIds)).toBe(ungrouped)
  })

  it('the login count is unchanged: it still counts the grouped members (493)', async () => {
    const login = Number((await db.query<{ c: string }>(QUESTION_COUNT_SQL))[0]?.c)
    expect(login).toBe(493)
    const ungrouped = Number((await db.query<{ c: string }>(`${QUESTION_COUNT_SQL} AND q.group_id IS NULL`))[0]?.c)
    expect(login - ungrouped).toBe(3)
  })
})
