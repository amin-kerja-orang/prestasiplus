/**
 * Wallet tier catalogue (P11-B1): the 4 tiers of M14 (bronze, silver, gold, platinum). This is REFERENCE data, not
 * demo data: `WalletService.summary` (`GET /api/gamification/wallet`, `GET /api/dashboard`) and the token conversion
 * throw "M14: no tier is defined" for EVERY student while `tiers` is empty, and migration 0010 only creates the table.
 * The values are the mock catalogue (`WALLET_TIERS` and `TIER_REWARDS` in `../wallet.ts`, reused, never duplicated).
 * Idempotent (upsert by the unique natural key `tier_name`; an existing row is left as it is, so an economy edit made
 * through the admin screen survives a re-run), deterministic (the creation time is the fixed seed clock), no personal
 * data and `legacy_*` is never set. The demo `walletSeed` upserts the same rows by the same key, so the two never conflict.
 * LEAD approval: pending (P11-B1, #113).
 */
import type { SeedModule } from '../index'
import { TIER_REWARDS, WALLET_TIERS } from '../wallet'

export const walletTiersSeed: SeedModule = {
  name: 'core-wallet-tiers',
  kind: 'reference',
  async run(ctx) {
    const seededAt = ctx.clock.now()
    for (const t of WALLET_TIERS) {
      await ctx.prisma.tier.upsert({
        where: { tierName: t.tierName },
        create: { ...t, perks: [...t.perks], ...TIER_REWARDS, isActive: true, createdAt: seededAt, updatedAt: seededAt },
        update: {},
      })
    }
  },
}
