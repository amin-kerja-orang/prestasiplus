/**
 * The `poc` profile (BE-26, demo): the last entry of the seed registry. It COMPOSES the earlier seed modules and adds
 * the cross-domain consistency check; it does not rewrite or duplicate them and adds no data of its own (seeds mirror
 * observation, one owner per store: ADR-0014 / D12). Cross-domain fixtures, if ever needed, go in `./fixtures/` and
 * must go through the owner's seed module or service contract.
 *
 * Execution order (the order of `seedModules` in ../index.ts; append-only, never reorder). Each module is
 * deterministic (ctx.prng, ctx.clock) and idempotent (upsert by natural key), so the whole run can be repeated:
 *
 *   1. core-identity          demo schools and the canonical demo accounts (docs/AKAUN-DEMO.md)
 *   2. core-schools           extra fictitious schools
 *   3. core-school-packages   REFERENCE: the 4 package catalogue rows (the only module that runs in production)
 *   4. core-population        generated pupils, teachers and officers (example.test) and the out-of-scope demo accounts
 *   5. curriculum             levels, subjects, chapters, topics, DSKP nodes
 *   6. questions              the question bank (versions, parts, keys, stimuli)
 *   7. wallet                 tiers, wallets and the coin ledger of the demo accounts
 *   8. content                articles, banners, videos, support
 *   9. exam                   blueprints, papers and placements
 *  10. exam-demo-blueprints   extra demo blueprints
 *  11. poc-classes            classes and rosters over the population
 *  12. poc-bijak-sittings     submitted Bijak SPM sittings, results and aggregates
 *  13. poc-cikgu              Cikgu Alesa demo rows
 *  14. poc-performance        headcount configs and entries, timeline posts (BE-19)
 *  15. practice               practice sessions and answers of the demo accounts
 *  16. gamification           achievements, challenges, rewards, draws
 *  17. poc-profile            THIS module: runs the consistency checks and fails the run when one is violated
 *
 * Production: refused unless the operator opts in with ALLOW_DEMO_SEED=true; the `--force-demo` flag of the seed
 * command is accepted there only together with it (two keys, see `applyForceDemo` in ../index.ts). The runner skips demo modules in production without the opt-in and
 * says so; calling this module directly in that case throws.
 */
import { assertSeedAllowed } from '../guard'
import type { SeedModule } from '../index'
import { formatFailures, verifyPocProfile, type Queryable } from './verify'

/** Names of the modules that make up the profile, in execution order (pinned by test/seed/poc.spec.ts). */
export const POC_PROFILE_ORDER = [
  'core-identity',
  'core-schools',
  'core-school-packages',
  'core-population',
  'curriculum',
  'questions',
  'wallet',
  'content',
  'exam',
  'exam-demo-blueprints',
  'poc-classes',
  'poc-bijak-sittings',
  'poc-cikgu',
  'poc-performance',
  'practice',
  'gamification',
  'poc-profile',
] as const

export const pocProfileSeed: SeedModule = {
  name: 'poc-profile',
  kind: 'demo',
  profiles: ['poc'],
  async run(ctx) {
    assertSeedAllowed()
    const { prisma } = ctx
    const db: Queryable = { query: <T>(sql: string) => prisma.$queryRawUnsafe<T[]>(sql) }
    const failures = await verifyPocProfile(db)
    if (failures.length > 0) throw new Error(`PoC profile is not coherent:\n${formatFailures(failures)}`)
  },
}
