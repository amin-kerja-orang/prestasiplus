import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { createExamSeed, examSeed, questionTableExists } from '../../prisma/seed/exam'
import { POC_BANK, POC_QUESTION_ID_BASE, pocQuestionId, pocQuestionMarks } from '../../src/modules/bijak/papers/poc'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { count } from './helpers'

describe('exam seed (BE-15)', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('needs the curriculum seed: without the subjects it stops with a clear message and writes nothing', async () => {
    await expect(runSeeds([examSeed], { prisma: db.prisma })).rejects.toThrow(/curriculum seed first/)
    expect(await count(db, `select count(*) n from papers`)).toBe(0)
    expect(await count(db, `select count(*) n from blueprints`)).toBe(0)
  })

  it('seeds the PoC blueprints and papers, section by section and placement by placement', async () => {
    await runSeeds([identitySeed, curriculumSeed, examSeed], { prisma: db.prisma })
    expect(await count(db, `select count(*) n from blueprints`)).toBe(POC_BANK.blueprints.length)
    expect(await count(db, `select count(*) n from blueprints where status = 'active'`)).toBe(POC_BANK.blueprints.length)
    expect(await count(db, `select count(*) n from papers`)).toBe(POC_BANK.papers.length)
    expect(await count(db, `select count(*) n from papers where kind = 'pilihan' and status = 'published' and version = 1 and generated_for_user_id is null`)).toBe(POC_BANK.papers.length)
    expect(await count(db, `select count(*) n from papers where blueprint_id is not null`)).toBe(3) // Sejarah has no Kontrak
    for (const paper of POC_BANK.papers) {
      const sections = await db.query<{ label: string; rule_type: string; rule_n: number | null; question_count: number; mark_budget: number; instruction: string | null; n: string }>(
        `select s.label, s.rule_type, s.rule_n, s.question_count, s.mark_budget, s.instruction, (select count(*) from paper_placements pl where pl.paper_section_id = s.id) n
           from paper_sections s join papers p on p.id = s.paper_id where p.title = $1 order by s.position`,
        [paper.title],
      )
      expect(sections.map((s) => [s.label, s.rule_type, s.rule_n, s.question_count, s.mark_budget, s.instruction, Number(s.n)])).toEqual(
        paper.sections.map((s) => [s.label, s.rule.type, s.rule.type === 'choose' ? s.rule.n : null, s.questionCount, s.markBudget, s.instruction ?? null, s.questionIds.length]),
      )
      const ids = await db.query<{ question_id: string }>(
        `select pl.question_id::text from paper_placements pl join paper_sections s on s.id = pl.paper_section_id join papers p on p.id = s.paper_id
          where p.title = $1 order by s.position, pl.position`,
        [paper.title],
      )
      expect(ids.map((r) => r.question_id)).toEqual(paper.sections.flatMap((s) => s.questionIds.map((k) => pocQuestionId(k).toString())))
    }
  }, 120_000)

  it('the printed budget of every seeded section agrees with the marks derived from the PoC questions', () => {
    const marks = new Map(POC_BANK.questions.map((q) => [q.id, pocQuestionMarks(q)]))
    for (const paper of POC_BANK.papers) {
      for (const s of paper.sections) {
        const each = s.questionIds.map((k) => marks.get(k) ?? 0)
        const effective = s.rule.type === 'all' ? each.reduce((a, b) => a + b, 0) : [...each].sort((a, b) => b - a).slice(0, s.rule.n).reduce((a, b) => a + b, 0)
        expect(effective, `${paper.id} ${s.label}`).toBe(s.markBudget)
      }
    }
  })

  it('placements use the reserved PoC question id block', () => {
    const ids = POC_BANK.questions.map((q) => pocQuestionId(q.id))
    expect(new Set(ids).size).toBe(POC_BANK.questions.length)
    expect(ids.every((id) => id > POC_QUESTION_ID_BASE)).toBe(true)
  })

  it('is idempotent: a second run adds nothing and an admin edit of a seeded row survives', async () => {
    await db.query(`update papers set title = title, year = 2024 where title like '%Sejarah%'`)
    const before = [await count(db, `select count(*) n from papers`), await count(db, `select count(*) n from paper_placements`), await count(db, `select count(*) n from blueprint_sections`)]
    await runSeeds([examSeed], { prisma: db.prisma })
    expect([await count(db, `select count(*) n from papers`), await count(db, `select count(*) n from paper_placements`), await count(db, `select count(*) n from blueprint_sections`)]).toEqual(before)
    expect(await count(db, `select count(*) n from papers where title like '%Sejarah%' and year = 2024`)).toBe(1)
  })

  it('does not clobber an active blueprint made by an admin for the same subject and kertas', async () => {
    await db.query(`delete from papers`)
    await db.query(`update blueprints set status = 'retired' where code = '1449/2'`)
    await db.query(`insert into blueprints (subject_id, kertas, code, version, status, duration_min) select subject_id, 2, 'ADMIN/2', 1, 'active', 99 from blueprints where code = '1449/2'`)
    await runSeeds([examSeed], { prisma: db.prisma })
    expect(await count(db, `select count(*) n from blueprints where code = '1449/2' and version = 1`)).toBe(1) // the retired one: not re-inserted
    expect(await count(db, `select count(*) n from blueprints where subject_id = (select subject_id from blueprints where code = 'ADMIN/2') and kertas = 2 and status = 'active'`)).toBe(1)
  })

  describe('question step (BE-09 wire-up)', () => {
    // Both cases must hold with and without BE-09 (migration 0011 creates the real `questions` table).
    it('does not run while the questions table does not exist', async () => {
      if (await questionTableExists(db.prisma)) return // BE-09 is merged: the "no table" case cannot occur
      const loader = vi.fn()
      await runSeeds([createExamSeed({ questionLoader: loader })], { prisma: db.prisma })
      expect(loader).not.toHaveBeenCalled()
    })

    it('hands the PoC bank and the reserved ids to the loader once the questions table exists; says so when none is wired', async () => {
      // Create a stub table only when BE-09's real one is absent, and drop only the table this test created.
      const preexisting = await questionTableExists(db.prisma)
      if (!preexisting) await db.query(`create table questions (id bigint generated always as identity primary key)`)
      try {
        expect(await questionTableExists(db.prisma)).toBe(true)
        const loader = vi.fn().mockResolvedValue(undefined)
        await runSeeds([createExamSeed({ questionLoader: loader })], { prisma: db.prisma })
        expect(loader).toHaveBeenCalledTimes(1)
        const [, bank, idOf] = loader.mock.calls[0] as [unknown, typeof POC_BANK, (k: string) => bigint]
        expect(bank.questions).toHaveLength(POC_BANK.questions.length)
        expect(idOf('mat1-pecahan-v1')).toBe(pocQuestionId('mat1-pecahan-v1'))

        const info = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        await runSeeds([examSeed], { prisma: db.prisma })
        expect(info).toHaveBeenCalledWith(expect.stringContaining('no PocQuestionLoader is wired'))
        info.mockRestore()
      } finally {
        if (!preexisting) await db.query(`drop table questions`)
      }
    })
  })
})
