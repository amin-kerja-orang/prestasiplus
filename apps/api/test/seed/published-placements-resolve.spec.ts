import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { examSeed } from '../../prisma/seed/exam'
import { POC_BANK } from '../../prisma/seed/poc/export'
import { questionsSeed } from '../../prisma/seed/questions'
import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * R1-B07 / REQ-B-029 / T36 follow-up: after the default seed run no PUBLISHED paper (the ones a pupil can list) holds a placement whose
 * question has no `questions` row. The seeded PoC papers carry 25 such placements by design (their questions are loaded into no table
 * outside tests); `exam-retire-poc` withdraws them, so every dangling placement of a runtime seed sits on a withdrawn paper.
 * The harness that seeds `examSeed` alone (the integration tests) keeps them published on purpose: they plug the PoC double.
 */
const DANGLING = `select p.id::text id, p.status, count(*)::int n
  from papers p join paper_sections ps on ps.paper_id = p.id join paper_placements pl on pl.paper_section_id = ps.id
  left join questions q on q.id = pl.question_id where q.id is null group by p.id, p.status order by p.id`

describe('seeded papers: placements resolve to a question row', () => {
  let full: TestDatabase
  let pocOnly: TestDatabase
  beforeAll(async () => {
    full = await createTestDatabase()
    await runSeeds(seedModules, { prisma: full.prisma })
    pocOnly = await createTestDatabase()
    await runSeeds([identitySeed, curriculumSeed, questionsSeed, examSeed], { prisma: pocOnly.prisma })
  }, 300_000)
  afterAll(async () => {
    await full?.drop()
    await pocOnly?.drop()
  })

  it('the default seed run leaves no published paper with a dangling placement', async () => {
    const rows = await full.query<{ id: string; status: string; n: number }>(DANGLING)
    expect(rows.filter((r) => r.status === 'published')).toEqual([])
    expect((await full.query(`select 1 from papers where status = 'published'`)).length).toBeGreaterThan(0) // the bank demo paper stays
  })

  it('the 25 dangling placements are exactly those of the four PoC papers, all withdrawn (nothing deleted)', async () => {
    const rows = await full.query<{ id: string; status: string; n: number }>(DANGLING)
    expect(rows.map((r) => r.status)).toEqual(rows.map(() => 'withdrawn'))
    expect(rows.reduce((n, r) => n + r.n, 0)).toBe(POC_BANK.papers.reduce((n, p) => n + p.sections.reduce((m, s) => m + s.questionIds.length, 0), 0))
    expect(rows.reduce((n, r) => n + r.n, 0)).toBe(25)
  })

  it('without the retire step (examSeed alone, the test harness) the same 25 placements are on published papers', async () => {
    const rows = await pocOnly.query<{ status: string; n: number }>(DANGLING)
    expect(rows.every((r) => r.status === 'published')).toBe(true)
    expect(rows.reduce((n, r) => n + r.n, 0)).toBe(25)
  })
})
