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
 * question has no version to serve. The seeded PoC papers carry 25 such placements by design (their questions are loaded into no table
 * outside tests; DM-11: each has an empty `questions` row for the foreign key); `exam-retire-poc` withdraws them, so every dangling placement of a runtime seed sits on a withdrawn paper.
 * The harness that seeds `examSeed` alone (the integration tests) keeps them published on purpose: they plug the PoC double.
 */
const DANGLING = `select p.id::text id, p.title, p.status, count(*)::int n
  from papers p join paper_sections ps on ps.paper_id = p.id join paper_placements pl on pl.paper_section_id = ps.id
  where not exists (select 1 from question_versions v where v.question_id = pl.question_id) group by p.id, p.status order by p.id`

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
    const rows = await full.query<{ id: string; title: string; status: string; n: number }>(DANGLING)
    expect(rows.filter((r) => r.status === 'published')).toEqual([])
    expect((await full.query(`select 1 from papers where status = 'published'`)).length).toBeGreaterThan(0) // the bank demo paper stays
  })

  it('the 25 dangling placements are exactly those of the four PoC papers, all withdrawn (nothing deleted)', async () => {
    const rows = await full.query<{ id: string; title: string; status: string; n: number }>(DANGLING)
    const expected = POC_BANK.papers.map((p) => ({ title: p.title, n: p.sections.reduce((m, sec) => m + sec.questionIds.length, 0) })).sort((x, y) => x.title.localeCompare(y.title))
    // the same papers (by title) with the same number of placements each, every one withdrawn
    expect(rows.map((r) => ({ title: r.title, n: r.n })).sort((x, y) => x.title.localeCompare(y.title))).toEqual(expected)
    expect(rows.map((r) => r.status)).toEqual(rows.map(() => 'withdrawn'))
    expect(rows.reduce((n, r) => n + r.n, 0)).toBe(25)
    // nothing deleted: every PoC paper row still exists with its placements
    const kept = await full.query<{ title: string }>(`select title from papers where title = any($1::text[])`, [POC_BANK.papers.map((p) => p.title)])
    expect(kept.map((r) => r.title).sort()).toEqual(POC_BANK.papers.map((p) => p.title).sort())
  })

  it('without the retire step (examSeed alone, the test harness) the same 25 placements are on published papers', async () => {
    const rows = await pocOnly.query<{ status: string; n: number }>(DANGLING)
    expect(rows.every((r) => r.status === 'published')).toBe(true)
    expect(rows.reduce((n, r) => n + r.n, 0)).toBe(25)
  })
})
