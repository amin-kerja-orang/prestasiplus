/**
 * School package catalogue (BE-25): T4, T5, D1_D6 and T1_T3 with the values of the mock seed
 * (`mock/seeds/billing.ts` SEED_PACKAGES, BR-22). This is REFERENCE data, not demo data: the school
 * subscription and the school-admin package cards need these rows. Idempotent (upsert by `code`),
 * deterministic, and `legacy_*` is never set (the ETL may later set it on the same rows).
 */
import type { SeedModule } from '../index'

export const SCHOOL_PACKAGES = [
  { code: 'T4', name: 'Pakej SPM Tingkatan 4', slug: 'spm-t4', educationLevel: 'spm', formLevel: 't4', priceAnnual: '30.00', maxRenewals: 1, isActive: true },
  { code: 'T5', name: 'Pakej SPM Tingkatan 5', slug: 'spm-t5', educationLevel: 'spm', formLevel: 't5', priceAnnual: '30.00', maxRenewals: 0, isActive: true },
  { code: 'D1_D6', name: 'Pakej Rendah (Darjah 1-6)', slug: 'primary-d1-d6', educationLevel: 'primary', formLevel: 'd1_d6', priceAnnual: '30.00', maxRenewals: 5, isActive: true },
  { code: 'T1_T3', name: 'Pakej Menengah Rendah (Tingkatan 1-3)', slug: 'lower-sec-t1-t3', educationLevel: 'lower_secondary', formLevel: 't1_t3', priceAnnual: '30.00', maxRenewals: 2, isActive: true },
] as const

export const schoolPackagesSeed: SeedModule = {
  name: 'core-school-packages',
  async run(ctx) {
    const createdAt = ctx.clock.now()
    for (const p of SCHOOL_PACKAGES) {
      await ctx.prisma.schoolPackage.upsert({
        where: { code: p.code },
        create: { ...p, createdAt, updatedAt: createdAt },
        update: {},
      })
    }
  },
}
