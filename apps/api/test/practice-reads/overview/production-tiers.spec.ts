import { PracticeReadDashboardSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seedModules } from '../../../prisma/seed'
import { identitySeed } from '../../../prisma/seed/core/identity'
import { contentSeed } from '../../../prisma/seed/content'
import { curriculumSeed } from '../../../prisma/seed/curriculum'
import type { CurriculumTestApp } from '../../curriculum/helpers'
import { bootOverviewApp, loginAs } from './helpers'

/**
 * P11-B1: `GET /api/dashboard` reads the wallet summary, which throws "M14: no tier is defined" while `tiers` is empty.
 * A production database has only the REFERENCE seed, so the dashboard of a student with no wallet must answer 200 with
 * that set alone (the identity, curriculum and content seeds stand in for the real users and catalogue of production).
 */
const Dashboard = envelopeOf(PracticeReadDashboardSchema)
const REFERENCE_ONLY = seedModules.filter((m) => m.kind === 'reference')

describe('GET /api/dashboard on a database with only the reference tiers (P11-B1)', () => {
  let t: CurriculumTestApp
  beforeAll(async () => {
    t = await bootOverviewApp({ seeds: [identitySeed, curriculumSeed, contentSeed, ...REFERENCE_ONLY] })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('answers 200 for a student without a wallet row (zero coins, level 1)', async () => {
    expect((await t.db.query<{ n: string }>(`select count(*)::text n from wallets`))[0]?.n).toBe('0')
    const res = await (await loginAs(t, 'pelajar@demo.test')).get('/api/dashboard')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(Dashboard.parse(res.body).data.wallet.coins).toBe(0)
  })
})
