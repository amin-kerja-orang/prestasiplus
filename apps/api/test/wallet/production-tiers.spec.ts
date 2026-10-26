import { WalletSummarySchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seedModules } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { STUDENT, STUDENT_EMPTY, apiOf, bootWalletApp, login, type WalletTestApp } from './helpers'

/**
 * P11-B1: on a production database only the REFERENCE seed runs, so the tier catalogue must be part of it, or
 * `GET /api/gamification/wallet` answers 500 ("M14: no tier is defined") for every student. The login accounts come
 * from the identity seed (demo kind: a production database has real users instead); no demo wallet is loaded, so a
 * student reads the BR-M14-02 defaults on the first tier.
 */
const REFERENCE_ONLY = seedModules.filter((m) => m.kind === 'reference')

describe('GET /api/gamification/wallet on a database with only the reference seed (P11-B1)', () => {
  let t: WalletTestApp
  beforeAll(async () => {
    t = await bootWalletApp({ seeds: [identitySeed, ...REFERENCE_ONLY] })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('has no wallet row at all, only the reference tiers', async () => {
    expect((await t.db.query<{ n: string }>(`select count(*)::text n from wallets`))[0]?.n).toBe('0')
    expect((await t.db.query<{ tier_name: string }>(`select tier_name from tiers order by sort_order`)).map((r) => r.tier_name)).toEqual(['bronze', 'silver', 'gold', 'platinum'])
  })

  it('answers 200 with the bronze defaults and silver as the next tier for a student without a wallet', async () => {
    for (const email of [STUDENT, STUDENT_EMPTY]) {
      const res = await apiOf(await login(t, email)).get('/gamification/wallet')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const w = WalletSummarySchema.parse((res.body as { data: unknown }).data)
      expect(w.currentSyiling).toBe(0)
      expect(w.tier.key).toBe('bronze')
      expect(w.nextTier?.key).toBe('silver')
    }
  })
})

describe('control: the same route with the tiers table empty (the bug P11-B1 fixes)', () => {
  let t: WalletTestApp
  beforeAll(async () => {
    t = await bootWalletApp({ seeds: [identitySeed] })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('answers 500, so the 200 above really depends on the reference tiers', async () => {
    expect((await t.db.query<{ n: string }>(`select count(*)::text n from tiers`))[0]?.n).toBe('0')
    const res = await apiOf(await login(t, STUDENT)).get('/gamification/wallet')
    expect(res.status).toBe(500)
  })
})
