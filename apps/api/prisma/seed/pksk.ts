/**
 * PKSK demo seed (BE-42, M07): the observed access grants, one demo student's two T1 exam attempts and seven T1
 * mastery values. Demo kind: refused in production unless ALLOW_DEMO_SEED. Fictitious data only.
 *
 * The 15 domains and the 3 packages are REFERENCE data and ship in migration 0028_pksk (insert on conflict do
 * nothing), not here: production needs them on day one and the reference-seed set is pinned by test.
 *
 * Source of every value: the mock (`src/modules/m07-pksk/mock/data/designed.ts`, SRS M07 section 6.8).
 *  - access: the 3 observed rows are all Kombo, no granter, no expiry; mock accounts 2 (`pelajar@demo.test`) and 4
 *    (`pelajarmaju@demo.test`) map to seeded accounts. The row of mock account 6 has no counterpart in the identity
 *    seed and is NOT seeded (nothing is invented);
 *  - attempts: Pelajar Demo, T1, scores 46.0 (D) and 64.0 (C); the Bahagian A and C percentages are the mock's designed values;
 *  - mastery: Pelajar Demo, T1, domains 1 to 6 and 15 (every other domain is absent = 0).
 *
 * PKSK questions are NOT seeded here: they are tagged questions of the question bank (BE-09) and arrive with the
 * questions adapter (cross-lane request, see the BE-42 report).
 *
 * Idempotent: a grant, attempt or mastery row is written only when the user has none of that kind yet (mastery is
 * upserted by its natural key). `legacy_*` is never set.
 */
import { assertSeedAllowed } from './guard'
import type { SeedModule } from './index'

const GRANTS: readonly { email: string; packageName: string; grantedAt: string }[] = [
  { email: 'pelajar@demo.test', packageName: 'PKSK Kombo (T1 + T4)', grantedAt: '2026-02-28T00:00:00+08:00' },
  { email: 'pelajarmaju@demo.test', packageName: 'PKSK Kombo (T1 + T4)', grantedAt: '2026-04-22T00:00:00+08:00' },
]

const STUDENT = 'pelajar@demo.test'

const ATTEMPTS = [
  { completedAt: '2026-09-10T20:00:00+08:00', score: 46.0, a: 46.6, b: 52.4, c: 0, grade: 'D' },
  { completedAt: '2026-09-20T20:00:00+08:00', score: 64.0, a: 80, b: 67.0, c: 11, grade: 'C' },
] as const

/** Fixed instant for the mastery rows (after the last seeded attempt), so two seeded databases are identical (AC1). */
const MASTERY_AT = '2026-09-20T20:00:00+08:00'

/** Mock domain ids 1 to 6 and 15 = the migration's insertion order; looked up by code so the ids never matter. */
const MASTERY: readonly (readonly [string, number])[] = [
  ['PKSK_INSANIAH', 60],
  ['PKSK_MATH', 70],
  ['PKSK_SCI', 55],
  ['PKSK_ENG', 80],
  ['PKSK_SEJ', 40],
  ['PKSK_GEO', 65],
  ['PKSK_ESSAY', 50],
]

export const pkskSeed: SeedModule = {
  name: 'pksk',
  kind: 'demo',
  async run(ctx) {
    assertSeedAllowed()
    const { prisma } = ctx

    for (const g of GRANTS) {
      const user = await prisma.user.findFirst({ where: { email: { equals: g.email, mode: 'insensitive' } } })
      const pkg = await prisma.pkskPackage.findFirst({ where: { name: g.packageName } })
      if (!user || !pkg) continue
      if ((await prisma.pkskAccess.count({ where: { userId: user.id } })) > 0) continue
      const at = new Date(g.grantedAt)
      await prisma.pkskAccess.create({
        data: { userId: user.id, packageId: pkg.id, grantedById: null, grantedAt: at, expiresAt: null, status: 'active', createdAt: at, updatedAt: at },
      })
    }

    const student = await prisma.user.findFirst({ where: { email: { equals: STUDENT, mode: 'insensitive' } } })
    if (!student) return
    if ((await prisma.pkskExamAttempt.count({ where: { userId: student.id } })) === 0) {
      for (const a of ATTEMPTS) {
        const at = new Date(a.completedAt)
        await prisma.pkskExamAttempt.create({
          data: {
            userId: student.id,
            level: 'T1',
            completedAt: at,
            scorePct: a.score,
            bahagianAPct: a.a,
            bahagianBPct: a.b,
            bahagianCPct: a.c,
            grade: a.grade,
            createdAt: at,
          },
        })
      }
    }
    for (const [code, pct] of MASTERY) {
      const domain = await prisma.pkskDomain.findUnique({ where: { code } })
      if (!domain) continue
      const key = { userId: student.id, level: 'T1', domainId: domain.id }
      await prisma.pkskMastery.upsert({
        where: { userId_level_domainId: key },
        create: { ...key, masteryPct: pct, createdAt: new Date(MASTERY_AT), updatedAt: new Date(MASTERY_AT) },
        update: {},
      })
    }
  },
}
