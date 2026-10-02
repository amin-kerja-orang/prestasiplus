/**
 * Seed composer and seed version (overview §6.9, ADR-0006).
 *
 * Seeding runs in three phases:
 * 1. **core** (`defineMockCore`: canonical accounts 1–11, sessions);
 * 2. every registry module's `seed(ctx)` in **registry order** (the `dependsOn` check ran at load,
 *    `checkModuleOrder`);
 * 3. **finalise**: compile every virtual dataset (core first, then modules), run each plugin's
 *    `finalise(ctx)`, then `db.baseline()` (the seed becomes the baseline; tracking starts). F-07
 *    applies the persisted diff after this.
 *
 * **Seed streams are fixed.** Seeds get their own PRNG registry, always at seed base
 * `SEED_PRNG_BASE` (1). `setRandomSeed(n)` moves only the *sampling* registry (`ctx.prng` in
 * handlers), so it never changes generated seed data, and a persisted diff always matches the seed
 * it was taken against.
 *
 * **Overrides** (`reset(overrides)`, `__MOCK_INIT__.overrides`) are keyed by the override names that
 * plugins declare. Each plugin's seed sees only its own keys. An unknown key throws (typo guard).
 *
 * **Seed version** = FNV-1a 32 over: the format, the registry order, each plugin's `version`, its
 * store names, each dataset's `specHash()`, and a hash of each declared fixture. A persisted diff
 * with another version is discarded (F-07).
 */

import type { Clock } from '@/lib/time'

import type { Db } from '../db/transaction'
import { fnv1a32 } from '../determinism/hash'
import type { PrngRegistry } from '../determinism/prng'
import type { MockConfig } from './config'
import {
  assertDatasetLike,
  overrideOwners,
  type MockPlugin,
  type MockPluginId,
  type SeedContext,
} from './plugin'

/** Bump when the composer itself changes what it produces. */
export const SEED_FORMAT = 1
/** Seed base of the seed streams (never changed by `setRandomSeed`). */
export const SEED_PRNG_BASE = 1

function hex(n: number): string {
  return n.toString(16).padStart(8, '0')
}

function hashValue(value: unknown): string {
  let text: string
  try {
    text = JSON.stringify(value) ?? 'undefined'
  } catch {
    throw new Error('seed version: a fixture is not JSON-serialisable')
  }
  return hex(fnv1a32(text))
}

/** The seed version of `plugins` (core first, then registry order). */
export function computeSeedVersion(plugins: readonly MockPlugin<object>[]): string {
  const parts = [`format:${String(SEED_FORMAT)}`, `seedBase:${String(SEED_PRNG_BASE)}`]
  for (const p of plugins) {
    parts.push(`plugin:${p.id}@${p.version}`)
    for (const [key, table] of Object.entries(p.tables)) parts.push(`table:${key}=${table.name}`)
    for (const [key, ds] of Object.entries(p.datasets)) {
      assertDatasetLike(p.id, key, ds)
      parts.push(`dataset:${key}=${ds.name}#${ds.specHash()}`)
    }
    for (const [key, data] of Object.entries(p.fixtures))
      parts.push(`fixture:${key}=${hashValue(data)}`)
  }
  return hex(fnv1a32(parts.join('\n')))
}

/** Registers every table and dataset of `plugins` with `db` (once per db, seed phase). */
export function registerStores(db: Db, plugins: readonly MockPlugin<object>[]): void {
  for (const p of plugins) {
    for (const store of Object.values(p.tables)) db.register(store)
    for (const store of Object.values(p.datasets)) db.register(store)
  }
}

/** Splits flat overrides by owning plugin; throws on unknown keys when `strict`. */
export function splitOverrides(
  plugins: readonly MockPlugin<object>[],
  overrides: Readonly<Record<string, unknown>>,
  strict: boolean,
): Map<MockPluginId, Record<string, unknown>> {
  const owners = overrideOwners(plugins)
  const out = new Map<MockPluginId, Record<string, unknown>>()
  const unknown: string[] = []
  for (const [key, value] of Object.entries(overrides)) {
    const owner = owners.get(key)
    if (!owner) {
      unknown.push(key)
      continue
    }
    const bucket = out.get(owner) ?? {}
    bucket[key] = value
    out.set(owner, bucket)
  }
  if (strict && unknown.length > 0) {
    const known = [...owners.keys()].sort()
    throw new Error(
      `mock overrides: unknown key(s) ${unknown.map((k) => `'${k}'`).join(', ')}. Known: ${
        known.length > 0 ? known.join(', ') : '(none)'
      }`,
    )
  }
  return out
}

export interface ComposeOptions {
  db: Db
  /** Core first, then registry modules in order. */
  plugins: readonly MockPlugin<object>[]
  seedPrng: PrngRegistry
  clock: Clock
  config: MockConfig
  overrides?: Readonly<Record<string, unknown>>
  /** Throw on unknown override keys (dev/e2e). Default `true`. */
  strictOverrides?: boolean
}

export interface ComposeResult {
  /** What ran, in order, e.g. `['seed:core', 'seed:M01', 'compile:M04.questions', 'finalise:M04', 'baseline']`. */
  steps: string[]
}

export async function composeSeeds(options: ComposeOptions): Promise<ComposeResult> {
  const { db, plugins, seedPrng, clock, config } = options
  if (db.phase !== 'seed') throw new Error('composeSeeds: the db must be in the seed phase')
  const [first] = plugins
  if (!first || first.id !== 'core') throw new Error('composeSeeds: the core must come first')

  const byPlugin = splitOverrides(plugins, options.overrides ?? {}, options.strictOverrides ?? true)
  // Fresh seed streams at the fixed base: re-seeding (reset) reproduces the same data.
  seedPrng.setSeedBase(SEED_PRNG_BASE)

  const ctxFor = (p: MockPlugin<object>): SeedContext =>
    Object.freeze({
      module: p.id,
      db,
      prng: seedPrng,
      clock,
      config,
      overrides: Object.freeze({ ...byPlugin.get(p.id) }),
    })

  const steps: string[] = []
  for (const p of plugins) {
    steps.push(`seed:${p.id}`)
    if (p.seed) await p.seed(ctxFor(p))
  }
  for (const p of plugins) {
    for (const [key, ds] of Object.entries(p.datasets)) {
      steps.push(`compile:${p.id}.${key}`)
      ds.compile?.()
    }
  }
  for (const p of plugins) {
    if (!p.finalise) continue
    steps.push(`finalise:${p.id}`)
    await p.finalise(ctxFor(p))
  }
  db.baseline()
  steps.push('baseline')
  return { steps }
}
