/**
 * S5-T01 (AC-X3-1, CI half): the e2e seed creates a Tingkatan 1 pupil (grade 7) and a Tingkatan 5 pupil (grade 11) in DEMO001, each with at least 5
 * approved, ungrouped, non-PKSK MCQs in one subject; the T1 questions are linked to a T1 chapter; a re-run changes nothing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { e2eSeed } from '../../prisma/seed/e2e'
import { assertT1Fixture, E2E_T1_LABEL_PREFIX } from '../../prisma/seed/e2e-t1'
import { examSeed } from '../../prisma/seed/exam'
import { examDemoBlueprintsSeed } from '../../prisma/seed/exam-demo-blueprints'
import { examLaunchBlueprintsSeed } from '../../prisma/seed/exam-launch-blueprints'
import { questionPoolSeed } from '../../prisma/seed/questions/pool'
import { createTestDatabase, type TestDatabase } from '../support/db'

const BASE = [identitySeed, curriculumSeed, examSeed, examDemoBlueprintsSeed, examLaunchBlueprintsSeed, questionPoolSeed]
const FLAGGED = { ...process.env, E2E_SEED: '1' }

describe('e2e seed: Tingkatan 1 and Tingkatan 5 pupils with servable MCQs (S5-T01)', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds(BASE, { prisma: db.prisma })
    await runSeeds([questionPoolSeed, e2eSeed], { prisma: db.prisma, profile: 'e2e', env: FLAGGED })
  }, 300_000)
  afterAll(async () => {
    await db.drop()
  })

  it('the fixture definition is valid', () => {
    expect(() => assertT1Fixture()).not.toThrow()
  })

  it('creates the T1 (grade 7) and T5 (grade 11) pupils in DEMO001', async () => {
    const rows = await db.query<{ email: string; username: string; grade: number; code: string; role: string }>(
      `select u.email, u.username, u.grade, s.code, r.role from users u join schools s on s.id = u.school_id join user_roles r on r.user_id = u.id
        where u.email in ('murid.t1.e2e@example.test', 'murid.t5.e2e@example.test') order by u.grade`,
    )
    expect(rows.map((r) => [r.email, r.username, r.grade, r.code, r.role])).toEqual([
      ['murid.t1.e2e@example.test', 'murid-t1-e2e', 7, 'DEMO001', 'student'],
      ['murid.t5.e2e@example.test', 'murid-t5-e2e', 11, 'DEMO001', 'student'],
    ])
  })

  it.each([['T1'], ['T5']])('%s has at least 5 servable MCQs in one subject', async (level) => {
    const rows = await db.query<{ subject_id: string; n: string }>(
      `select v.subject_id::text, count(*)::text as n
         from question_versions v join questions q on q.id = v.question_id and v.version_no = q.live_version_no
         join education_levels l on l.id = v.education_level_id
        where l.code = $1 and v.status = 'approved' and v.type = 'mcq' and q.is_active and q.group_id is null
          and not exists (select 1 from question_tags pt where pt.question_id = q.id and pt.kind = 'pksk_domain')
        group by 1 order by count(*) desc`,
      [level],
    )
    expect(Number(rows[0]?.n ?? 0)).toBeGreaterThanOrEqual(5)
  })

  it('links the T1 fixture to a T1 chapter of the same subject', async () => {
    const rows = await db.query<{ n: string }>(
      `select count(*)::text as n from question_versions v join chapters c on c.id = v.chapter_id
        where v.number_label like $1 and c.subject_id = v.subject_id and c.education_level_id = v.education_level_id and c.in_tree and c.is_active`,
      [`${E2E_T1_LABEL_PREFIX}%`],
    )
    expect(Number(rows[0]?.n)).toBe(5)
  })

  it('is idempotent: a second run adds no question and no pupil', async () => {
    const count = async () => (await db.query<{ q: string; u: string }>(`select (select count(*) from question_versions)::text q, (select count(*) from users)::text u`))[0]
    const before = await count()
    await runSeeds([e2eSeed], { prisma: db.prisma, profile: 'e2e', env: FLAGGED })
    expect(await count()).toEqual(before)
  })
})
