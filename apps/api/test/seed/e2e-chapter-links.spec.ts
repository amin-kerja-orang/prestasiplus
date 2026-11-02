/**
 * REQ-B-109 e2e fixture: with `E2E_SEED=1` the e2e seed links the first approved MCQs of each subject and offered level (T4, T5) to a chapter
 * of the same subject and level, so "Soalan by Chapter" has a chapter with questions. Idempotent, and it never changes an existing link.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { e2eSeed } from '../../prisma/seed/e2e'
import { E2E_CHAPTER_LINKS_PER_LEVEL } from '../../prisma/seed/e2e-chapter'
import { examSeed } from '../../prisma/seed/exam'
import { examDemoBlueprintsSeed } from '../../prisma/seed/exam-demo-blueprints'
import { examLaunchBlueprintsSeed } from '../../prisma/seed/exam-launch-blueprints'
import { questionPoolSeed } from '../../prisma/seed/questions/pool'
import { createTestDatabase, type TestDatabase } from '../support/db'

const BASE = [identitySeed, curriculumSeed, examSeed, examDemoBlueprintsSeed, examLaunchBlueprintsSeed, questionPoolSeed]
const FLAGGED = { ...process.env, E2E_SEED: '1' }

describe('e2e seed links practice questions to chapters (REQ-B-109)', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds(BASE, { prisma: db.prisma })
    await runSeeds([questionPoolSeed, e2eSeed], { prisma: db.prisma, profile: 'e2e', env: FLAGGED })
  }, 300_000)
  afterAll(async () => {
    await db.drop()
  })

  const linked = () =>
    db.query<{ id: string; chapter_id: string }>(`select id::text, chapter_id::text from question_versions where chapter_id is not null order by id`)

  it('links at most 10 questions per subject and level, each to a chapter of the same subject and level', async () => {
    const rows = await linked()
    expect(rows.length).toBeGreaterThan(0)
    const bad = await db.query(
      `select 1 from question_versions v join chapters c on c.id = v.chapter_id
        where c.subject_id <> v.subject_id or c.education_level_id <> v.education_level_id or not c.in_tree or not c.is_active`,
    )
    expect(bad).toHaveLength(0)
    const over = await db.query(
      `select subject_id, education_level_id from question_versions where chapter_id is not null group by 1, 2 having count(*) > $1`,
      [E2E_CHAPTER_LINKS_PER_LEVEL],
    )
    expect(over).toHaveLength(0)
  })

  it('is idempotent: a second run links the same questions', async () => {
    const before = await linked()
    await runSeeds([e2eSeed], { prisma: db.prisma, profile: 'e2e', env: FLAGGED })
    expect(await linked()).toEqual(before)
  })
})
