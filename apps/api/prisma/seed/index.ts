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
  /** Profiles this entry runs in. Omitted: runs in every profile. */
  profiles?: readonly string[]
  /** Idempotent and deterministic; fictitious data only. */
  run(ctx: SeedContext): Promise<void>
}

export const seedModules: SeedModule[] = [identitySeed]

/**
 * The seeds create demo accounts with a published password. They must never run against production
 * unless the operator says so explicitly with `ALLOW_DEMO_SEED=1`.
 */
export function assertSeedAllowed(env: Record<string, string | undefined> = process.env): void {
  if (env.NODE_ENV === 'production' && env.ALLOW_DEMO_SEED !== '1') {
    throw new Error(
      'Refusing to seed demo data: NODE_ENV=production. Set ALLOW_DEMO_SEED=1 only if you really mean it. The database was not touched.',
    )
  }
}

export interface RunSeedsOptions {
  profile?: string
  prisma?: PrismaClient
  seedBase?: number
}

/** Runs the modules selected by the profile in declared order; returns the names that ran. */
export async function runSeeds(
  modules: SeedModule[] = seedModules,
  options: RunSeedsOptions = {},
): Promise<string[]> {
  assertSeedAllowed()
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
  for (const m of modules) {
    if (m.profiles && !m.profiles.includes(profile)) continue
    await m.run(ctx)
    done.push(m.name)
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
