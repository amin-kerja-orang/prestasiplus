/**
 * E2E trial fixture (e2e-trial.ts): behind the same guards as the e2e seed, one dedicated unsubscribed pupil with one trial answer left.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { e2eSeed } from '../../prisma/seed/e2e'
import { examSeed } from '../../prisma/seed/exam'
import { examDemoBlueprintsSeed } from '../../prisma/seed/exam-demo-blueprints'
import { examLaunchBlueprintsSeed } from '../../prisma/seed/exam-launch-blueprints'
import { E2E_TRIAL_PUPILS, E2E_TRIAL_PUPIL_EMAIL, E2E_TRIAL_USED } from '../../prisma/seed/e2e-trial'
import { TRIAL_LIMIT } from '../../src/modules/subscriptions'
import { createTestDatabase, type TestDatabase } from '../support/db'

// the e2e seed also verifies the launch blueprint, so it needs the same base seeds as e2e.spec.ts
const BASE = [identitySeed, curriculumSeed, examSeed, examDemoBlueprintsSeed, examLaunchBlueprintsSeed]
const FLAGGED = { ...process.env, E2E_SEED: '1' }
const PUPIL = `select u.grade, u.name, u.trial_questions_used used, s.code school, array(select role from user_roles r where r.user_id = u.id) roles
                 from users u join schools s on s.id = u.school_id where u.email = $1`

describe('e2e trial fixture', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds(BASE, { prisma: db.prisma })
  }, 180_000)
  afterAll(async () => db.drop())

  it('is one short of the limit', () => {
    expect(E2E_TRIAL_USED).toBe(TRIAL_LIMIT - 1)
    expect(E2E_TRIAL_PUPILS).toHaveLength(3)
    for (const p of E2E_TRIAL_PUPILS) expect(p.email).toMatch(/@example\.test$/)
  })

  it('creates nothing without E2E_SEED (default off)', async () => {
    await runSeeds([e2eSeed], { prisma: db.prisma, profile: 'e2e', env: { ...process.env, E2E_SEED: undefined } })
    expect(await db.query(`select 1 from users where email = $1`, [E2E_TRIAL_PUPIL_EMAIL])).toHaveLength(0)
  })

  it('refuses a run that counts as production before creating the pupil', async () => {
    await expect(runSeeds([e2eSeed], { prisma: db.prisma, profile: 'e2e', env: { NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true', E2E_SEED: '1' } })).rejects.toThrow(/counts as production/)
    expect(await db.query(`select 1 from users where email = $1`, [E2E_TRIAL_PUPIL_EMAIL])).toHaveLength(0)
  })

  it('creates three unsubscribed Tingkatan 4 pupils at DEMO001 with 49 of 50 trial answers used; a re-run resets the counters', async () => {
    await runSeeds([e2eSeed], { prisma: db.prisma, profile: 'e2e', env: FLAGGED })
    for (const p of E2E_TRIAL_PUPILS) {
      expect((await db.query(PUPIL, [p.email]))[0]).toMatchObject({ grade: 10, school: 'DEMO001', roles: ['student'], used: 49, name: p.name })
      // neither the school nor the pupil has a subscription or a complimentary package: the trial applies
      expect(await db.query(`select 1 from school_subscriptions s join users u on u.school_id = s.school_id where u.email = $1`, [p.email])).toHaveLength(0)
      expect(await db.query(`select 1 from comp_students c join users u on u.id = c.user_id where u.email = $1`, [p.email])).toHaveLength(0)
    }

    await db.query(`update users set trial_questions_used = 50 where email like 'murid.trial%.e2e@example.test'`)
    await runSeeds([e2eSeed], { prisma: db.prisma, profile: 'e2e', env: FLAGGED })
    expect(await db.query(`select 1 from users where email like 'murid.trial%.e2e@example.test'`)).toHaveLength(3)
    for (const p of E2E_TRIAL_PUPILS) expect((await db.query<{ used: number }>(PUPIL, [p.email]))[0]?.used).toBe(49)
  }, 240_000)
})
