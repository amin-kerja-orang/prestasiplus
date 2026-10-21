/**
 * Seed registry and runner (BE-02). Each lane adds ONE import and ONE array entry for its seed
 * module (append-only; never reorder: the array order is the execution order).
 *
 * Rules (ADR-0006, plan section 14.9): seeds are deterministic and idempotent (upsert by natural
 * key, never truncate), use fictitious data only, take randomness from `ctx.prng(name)` and time
 * from `ctx.clock`. `Math.random`, `Date.now` and `new Date()` are forbidden in this folder (a
 * test scans it). Run with `npm run be:db:seed -- --profile=<name>` (default `poc`).
 */
import { pathToFileURL } from 'node:url'

import { FixedClock, SEED_NOW, type Clock } from '../../src/db/clock'
import { createPrismaClient, type PrismaClient } from '../../src/db/client'
import { DEFAULT_SEED_BASE, type Prng, prngStream } from '../../src/db/prng'
import { identitySeed } from './core/identity'
import { populationSeed } from './core/population'
import { schoolPackagesSeed } from './core/school-packages'
import { schoolsSeed } from './core/schools'
import { curriculumSeed } from './curriculum'
import { examSeed } from './exam'
import { examDemoBlueprintsSeed } from './exam-demo-blueprints'
import { practiceSeed } from './practice'
import { questionsSeed } from './questions'
import { bijakSittingsSeed } from './poc/bijak-sittings'
import { classesSeed } from './poc/classes'
import { assertSeedAllowed } from './guard'
import { walletSeed } from './wallet'
import { contentSeed } from './content'
import { gamificationSeed } from './gamification'
import { cikguSeed } from './cikgu'
import { performanceSeed } from './poc/performance'
import { battleSeed } from './battle'
import { spmSeed } from './spm'
import { spmSubjectConfigsSeed } from './spm-subject-configs'

export { assertSeedAllowed }

export const DEFAULT_PROFILE = 'poc'

export interface SeedContext {
  profile: string
  /** Fixed at the ADR-0006 anchor; never the real time. */
  clock: Clock
  /** Independent seeded stream per name; call once per generator. */
  prng(name: string): Prng
  /** Throws when the run was started without a database (unit tests of the runner). */
  readonly prisma: PrismaClient
}

export interface SeedModule {
  /** Domain name, e.g. `core`, `curriculum`. */
  name: string
  /**
   * `reference`: structural data the system needs (catalogues); runs in EVERY environment, production included.
   * `demo` (default): fictitious accounts and sample data; refused in production unless ALLOW_DEMO_SEED.
   */
  kind?: 'reference' | 'demo'
  /** Profiles this entry runs in. Omitted: runs in every profile. */
  profiles?: readonly string[]
  /** Idempotent and deterministic; fictitious data only. */
  run(ctx: SeedContext): Promise<void>
}

/**
 * THE REFERENCE SET. Modules with `kind: 'reference'` run in EVERY environment, production included.
 * The set is minimal and explicit: today it contains the school_packages catalogue (`core-school-packages`) and the
 * 19 SPM subject configuration rows (`spm-subject-configs`, BE-41; LEAD to confirm, it extends the BE-25 set),
 * pinned by test/subscriptions/seed-production.spec.ts.
 * Adding a reference module needs LEAD approval first, because demo data must never reach production.
 * A reference seed must be idempotent and deterministic, carry no `legacy_*` values and contain no
 * personal data. Everything else is demo (the default kind) and is refused in production unless
 * ALLOW_DEMO_SEED.
 */
export const seedModules: SeedModule[] = [identitySeed, schoolsSeed, schoolPackagesSeed, populationSeed, curriculumSeed, questionsSeed, walletSeed, contentSeed, examSeed, examDemoBlueprintsSeed, classesSeed, bijakSittingsSeed, battleSeed, cikguSeed, performanceSeed, spmSubjectConfigsSeed, spmSeed, practiceSeed, gamificationSeed]

export interface RunSeedsOptions {
  /** Environment read by the demo guard (default `process.env`). */
  env?: Record<string, string | undefined>
  profile?: string
  prisma?: PrismaClient
  seedBase?: number
}

/**
 * Runs the modules selected by the profile in declared order; returns the names that ran. In production
 * without ALLOW_DEMO_SEED only `reference` modules run (the demo guard skips the demo ones), so
 * `be:db:seed` in production loads reference data and nothing else.
 */
export async function runSeeds(
  modules: SeedModule[] = seedModules,
  options: RunSeedsOptions = {},
): Promise<string[]> {
  const env = options.env ?? process.env
  // Demo modules are skipped (never loaded by mistake) when the demo guard refuses; reference modules always run.
  let demoAllowed = true
  try {
    assertSeedAllowed(env)
  } catch {
    demoAllowed = false
  }
  const profile = options.profile ?? DEFAULT_PROFILE
  const { prisma, seedBase = DEFAULT_SEED_BASE } = options
  const ctx: SeedContext = {
    profile,
    clock: new FixedClock(SEED_NOW),
    prng: (name) => prngStream(name, seedBase),
    get prisma(): PrismaClient {
      if (!prisma) throw new Error('This seed run has no database connection.')
      return prisma
    },
  }
  const done: string[] = []
  const skipped: string[] = []
  for (const m of modules) {
    if (m.profiles && !m.profiles.includes(profile)) continue
    if ((m.kind ?? 'demo') === 'demo' && !demoAllowed) {
      skipped.push(m.name)
      continue
    }
    await m.run(ctx)
    done.push(m.name)
  }
  // Say so loudly: an operator must see that demo data was refused, not silently absent (BE-03 H2).
  if (skipped.length > 0) {
    console.warn(
      `seed: demo modules skipped in production (set ALLOW_DEMO_SEED=1 to load them): ${skipped.join(', ')}`,
    )
  }
  return done
}

export function parseProfile(argv: readonly string[]): string {
  const arg = argv.find((a) => a.startsWith('--profile='))
  const value = arg ? arg.slice('--profile='.length) : DEFAULT_PROFILE
  if (!/^[a-z][a-z0-9-]*$/.test(value)) throw new Error(`Invalid --profile value.`)
  return value
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set.')
  const profile = parseProfile(process.argv.slice(2))
  const prisma = createPrismaClient(url)
  try {
    const done = await runSeeds(seedModules, { profile, prisma })
    console.log(`seed: profile=${profile}, ${done.length} module(s): ${done.join(', ') || '(none)'}`)
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
