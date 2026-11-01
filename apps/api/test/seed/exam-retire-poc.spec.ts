import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { examRetirePocSeed, examSeed } from '../../prisma/seed/exam'
import { POC_BANK } from '../../prisma/seed/poc/export'
import { questionsSeed } from '../../prisma/seed/questions'
import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * R1-B07 / REQ-B-029: on a runtime database the seeded PoC papers are withdrawn (their questions are in no table, the API serves the
 * bank only), so pupils are not offered papers that show "0 markah" and refuse to start. Papers with any bank question stay as they are.
 */
let db: TestDatabase

const statusOf = async (title: string): Promise<string | undefined> => (await db.query<{ status: string }>(`select status from papers where title = $1`, [title]))[0]?.status

beforeAll(async () => {
  db = await createTestDatabase()
  await runSeeds([identitySeed, curriculumSeed, questionsSeed, examSeed], { prisma: db.prisma })
}, 120_000)
afterAll(async () => {
  await db?.drop()
})

/** A published paper with the given placements (question ids), for the guard cases. */
async function paper(title: string, questionIds: string[]): Promise<void> {
  const subject = (await db.query<{ id: string }>(`select id::text id from subjects where code = 'MATH'`))[0]!.id
  const p = (await db.query<{ id: string }>(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, published_at) values ('pilihan', $1, $2, 1, 60, 'published', now()) returning id::text id`, [title, subject]))[0]!.id
  const sec = (await db.query<{ id: string }>(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', $2, 0) returning id::text id`, [p, questionIds.length]))[0]!.id
  for (const [i, q] of questionIds.entries()) await db.query(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, $3)`, [sec, q, i + 1])
}

describe('examRetirePocSeed', () => {
  it('the exam seed still seeds the PoC papers as published (the tests plug their double on them)', async () => {
    for (const p of POC_BANK.papers) expect(await statusOf(p.title), p.title).toBe('published')
  })

  it('withdraws every seeded PoC paper, and a second run changes nothing', async () => {
    const bankQuestion = (await db.query<{ id: string }>(`select id::text id from questions order by id limit 1`))[0]!.id
    await paper('Kertas bank sahaja', [bankQuestion])
    await paper('Kertas campuran', [bankQuestion, '9000000001'])
    await paper('Kertas kosong', [])

    await runSeeds([examRetirePocSeed], { prisma: db.prisma })
    for (const p of POC_BANK.papers) expect(await statusOf(p.title), p.title).toBe('withdrawn')
    expect(await db.query(`select 1 from papers where status = 'published' and title in (${POC_BANK.papers.map((_p, i) => `$${String(i + 1)}`).join(',')})`, POC_BANK.papers.map((p) => p.title))).toEqual([])
    // Guard: a paper with a bank question, a mixed paper and one without placements are not touched.
    expect(await statusOf('Kertas bank sahaja')).toBe('published')
    expect(await statusOf('Kertas campuran')).toBe('published')
    expect(await statusOf('Kertas kosong')).toBe('published')
    const before = await db.query(`select id::text, status, published_at, updated_at from papers order by id`)
    await runSeeds([examRetirePocSeed], { prisma: db.prisma })
    expect(await db.query(`select id::text, status, published_at, updated_at from papers order by id`)).toEqual(before)
  })

  it('a pupil is not offered a withdrawn PoC paper (published papers only)', async () => {
    const listed = await db.query<{ title: string }>(`select title from papers where status = 'published' and kind = 'pilihan'`)
    for (const p of POC_BANK.papers) expect(listed.map((r) => r.title)).not.toContain(p.title)
  })
})
