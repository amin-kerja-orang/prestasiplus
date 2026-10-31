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

describe('Bab card and Soalan by Chapter tile count what the chapter draw can serve (D91, V2 section 2.3)', () => {
  const COUNT_DRAWABLE = `select count(*)::text c from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
    where v.chapter_id = $1::bigint and q.is_active and v.status = 'approved' and v.type = 'mcq' and q.group_id is null`

  it('a chaptered grouped MCQ is not counted: Bab count = drawable (ungrouped) count; unchaptered ones never count', async () => {
    const bm = await subjectId('BM')
    const chapters = await db.query<{ id: string; education_level_id: string }>(
      `select c.id::text id, c.education_level_id::text education_level_id from chapters c where c.subject_id = $1 order by c.id`, [bm])
    expect(chapters.length).toBeGreaterThan(0)
    const chapterId = (chapters[0] as { id: string }).id
    const repo = new OverviewRepository({ client: db.prisma } as never)
    expect((await repo.chapterQuestionCounts([chapterId])).get(chapterId)).toBeUndefined() // the demo seed has no chaptered question

    // Chapter the 3 SEED-GRP-PASAR members (grouped) and 2 ungrouped approved BM MCQs of the same level.
    const level = (await db.query<{ education_level_id: string }>(
      `select v.education_level_id::text education_level_id from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
        where q.group_id is not null and v.subject_id = $1 and v.status = 'approved' and v.type = 'mcq' limit 1`, [bm]))[0]
    expect(level).toBeDefined()
    const set = async (grouped: boolean, limit: number) =>
      db.query<{ id: string }>(
        `update question_versions v set chapter_id = $1::bigint from (
            select q.id, q.live_version_no from questions q join question_versions w on w.question_id = q.id and w.version_no = q.live_version_no
             where q.is_active and w.status = 'approved' and w.type = 'mcq' and w.subject_id = $2 and w.education_level_id = $3::bigint
               and (q.group_id is not null) = $4::boolean order by q.id limit $5
          ) t where v.question_id = t.id and v.version_no = t.live_version_no returning t.id::text id`,
        [chapterId, bm, (level as { education_level_id: string }).education_level_id, grouped, limit],
      )
    expect((await set(true, 3)).length).toBe(3)
    expect((await set(false, 2)).length).toBe(2)

    const drawable = Number((await db.query<{ c: string }>(COUNT_DRAWABLE, [chapterId]))[0]?.c)
    const grouped = Number((await db.query<{ c: string }>(COUNT_DRAWABLE.replace('q.group_id is null', 'q.group_id is not null'), [chapterId]))[0]?.c)
    expect(grouped).toBe(3)
    expect(drawable).toBe(2)
    const counts = await repo.chapterQuestionCounts([chapterId])
    expect(counts.get(chapterId)).toBe(drawable) // 2, not 5
    // The tile sums these per-chapter counts (OverviewService.chapterSubjects), so tile = chapter-drawable, never the subject total.
    const subjectTotal = bank.practice(bm, offeredIds)
    expect(subjectTotal).toBeGreaterThan(drawable)
  })
})
