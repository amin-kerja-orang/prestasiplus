/**
 * Module mock plugins (overview §6.10, ADR-0009) and the registry loader.
 *
 * ```ts
 * // src/modules/m04-question-bank/mock/index.ts
 * const plugin = defineMockModule({
 *   id: 'M04', dependsOn: ['core', 'M03'],
 *   tables: { reports }, datasets: { questions },
 *   repositories: { questions: questionsRepo },
 *   seed(ctx) { … },
 *   routes: [...questionRoutes],
 *   hooks: {}, overrides: ['importRuns'],
 * })
 * export default plugin
 * export const { questions } = plugin.repositories
 * ```
 *
 * `src/mock/registry.ts` (F-01) lists lazy loaders typed structurally as `{ default: { id } }`; a
 * `MockModule` satisfies that, so the registry is never edited. Modules that still export the F-01
 * stub (`{ id }` only) load as empty plugins.
 *
 * The **mock core** (canonical accounts, sessions, `GET /api/me`; F-11 in `src/mock/core-data`) is
 * defined the same way with `defineMockCore(...)` (id `'core'`); it also supplies the session
 * resolver used by the auth middleware.
 */

import type { SessionResolver } from '../auth/middleware'
import type { Db } from '../db/transaction'
import type { TransactionalStore } from '../db/store'
import type { PrngRegistry } from '../determinism/prng'
import type { Clock } from '@/lib/time'
import type { MockConfig } from './config'
import type { RouteDef } from './router'
import type { MockParams } from './types'

export type MockModuleId = `M${number}`
export type MockPluginId = MockModuleId | 'core'

/**
 * What the composer needs from a virtual dataset (F-09, `defineVirtualDataset`). Structural, so this
 * file does not depend on the dataset primitive.
 */
export interface MockDatasetLike extends TransactionalStore {
  /** Finalise phase: compile cells, slots and anchors (after every seed has contributed). */
  compile?(): void
  /**
   * **Required.** A stable text (or hash) of the dataset definition (distribution spec, id ranges,
   * facets, literal anchors). It is part of the seed version, so a changed distribution discards
   * stale persisted overlays. It must work before seeding (without compiling) and must not include
   * test-only overrides. A dataset without it is rejected when the plugin is defined.
   */
  specHash(): string
}

/** Throws when a dataset cannot take part in the seed version (no `specHash()`). */
export function assertDatasetLike(owner: string, key: string, ds: unknown): void {
  const specHash = (ds as { specHash?: unknown } | null)?.specHash
  if (typeof specHash !== 'function') {
    throw new Error(
      `${owner}: dataset '${key}' has no specHash(); the seed version needs it (overview §6.9)`,
    )
  }
}

/** A hook for `window.__mock` (F-08 registers them; names are global). */
export type MockHook = (...args: never[]) => unknown

export interface SeedContext {
  /** The plugin being seeded. */
  readonly module: MockPluginId
  readonly db: Db
  /** Seed streams: always seed base 1, independent of `setRandomSeed` (ADR-0006). */
  readonly prng: PrngRegistry
  readonly clock: Clock
  readonly config: MockConfig
  /** This plugin's own override values (keys it declared in `overrides`). */
  readonly overrides: Readonly<Record<string, unknown>>
}

interface PluginShape<R extends object> {
  /** Bump when the seed output changes without a fixture/spec change (part of the seed version). */
  version?: string | number
  tables?: Readonly<Record<string, TransactionalStore>>
  datasets?: Readonly<Record<string, MockDatasetLike>>
  /** Public repositories (D12): the only contract other modules import. */
  repositories?: R
  /** Seed phase: write own tables, provisional tables, and anchors via owners' repositories. */
  seed?: (ctx: SeedContext) => void | Promise<void>
  /** Finalise phase, after every dataset is compiled. Rarely needed. */
  finalise?: (ctx: SeedContext) => void | Promise<void>
  routes?: readonly RouteDef<MockParams>[]
  hooks?: Readonly<Record<string, MockHook>>
  /** Override keys accepted by `reset(overrides)` / `__MOCK_INIT__.overrides` for this plugin. */
  overrides?: readonly string[]
  /** Fixture data (`data/*.json` imports) whose content is hashed into the seed version. */
  fixtures?: Readonly<Record<string, unknown>>
}

export interface MockModuleDef<R extends object = Record<never, never>> extends PluginShape<R> {
  id: MockModuleId
  /** `'core'` and/or earlier modules. Checked against the registry order at load. */
  dependsOn?: readonly MockPluginId[]
}

export interface MockCoreDef<R extends object = Record<never, never>> extends PluginShape<R> {
  /** Resolves Bearer tokens to sessions for the auth middleware (F-11). */
  resolveSession?: SessionResolver
}

const PLUGIN = Symbol.for('pp.mock.plugin')

export interface MockPlugin<R extends object = Record<never, never>> {
  readonly [PLUGIN]: true
  readonly id: MockPluginId
  readonly dependsOn: readonly MockPluginId[]
  readonly version: string
  readonly tables: Readonly<Record<string, TransactionalStore>>
  readonly datasets: Readonly<Record<string, MockDatasetLike>>
  readonly repositories: R
  readonly seed: ((ctx: SeedContext) => void | Promise<void>) | null
  readonly finalise: ((ctx: SeedContext) => void | Promise<void>) | null
  readonly routes: readonly RouteDef<MockParams>[]
  readonly hooks: Readonly<Record<string, MockHook>>
  readonly overrides: readonly string[]
  readonly fixtures: Readonly<Record<string, unknown>>
}

/** A module plugin (the real type behind the registry's structural `{ id }`). */
export interface MockModule<R extends object = Record<never, never>> extends MockPlugin<R> {
  readonly id: MockModuleId
}

export interface MockCore<R extends object = Record<never, never>> extends MockPlugin<R> {
  readonly id: 'core'
  readonly resolveSession: SessionResolver | null
}

const MODULE_ID_RE = /^M\d{2}$/

function build<R extends object>(
  id: MockPluginId,
  def: PluginShape<R>,
  dependsOn: readonly MockPluginId[],
): MockPlugin<R> {
  for (const key of def.overrides ?? []) {
    if (typeof key !== 'string' || key === '') throw new Error(`${id}: invalid override key`)
  }
  if (new Set(def.overrides ?? []).size !== (def.overrides ?? []).length) {
    throw new Error(`${id}: duplicate override key`)
  }
  for (const [key, ds] of Object.entries(def.datasets ?? {})) assertDatasetLike(id, key, ds)
  return Object.freeze({
    [PLUGIN]: true as const,
    id,
    dependsOn: Object.freeze([...dependsOn]),
    version: def.version === undefined ? '0' : String(def.version),
    tables: Object.freeze({ ...def.tables }),
    datasets: Object.freeze({ ...def.datasets }),
    repositories: (def.repositories ?? {}) as R,
    seed: def.seed ?? null,
    finalise: def.finalise ?? null,
    routes: Object.freeze([...(def.routes ?? [])]),
    hooks: Object.freeze({ ...def.hooks }),
    overrides: Object.freeze([...(def.overrides ?? [])]),
    fixtures: Object.freeze({ ...def.fixtures }),
  })
}

export function defineMockModule<R extends object = Record<never, never>>(
  def: MockModuleDef<R>,
): MockModule<R> {
  if (!MODULE_ID_RE.test(def.id)) throw new Error(`defineMockModule: invalid id '${def.id}'`)
  const deps = def.dependsOn ?? []
  if (deps.includes(def.id)) throw new Error(`${def.id}: a module cannot depend on itself`)
  return build(def.id, def, deps) as MockModule<R>
}

export function defineMockCore<R extends object = Record<never, never>>(
  def: MockCoreDef<R>,
): MockCore<R> {
  const plugin = build('core', def, [])
  return Object.freeze({ ...plugin, resolveSession: def.resolveSession ?? null }) as MockCore<R>
}

/** An empty core, used until F-11 provides `src/mock/core-data`. */
export const EMPTY_CORE: MockCore = defineMockCore({})

export function isMockPlugin(value: unknown): value is MockPlugin<object> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[PLUGIN] === true
  )
}

/**
 * Accepts a registry export: a `defineMockModule` result, or the F-01 stub `{ id }` (loaded as an
 * empty module).
 */
export function toMockModule(value: unknown): MockModule<object> {
  if (isMockPlugin(value)) {
    if (value.id === 'core') throw new Error('mock registry: the core is not a registry module')
    return value as MockModule<object>
  }
  const id = (value as { id?: unknown } | null)?.id
  if (typeof id === 'string' && MODULE_ID_RE.test(id)) {
    return defineMockModule({ id: id as MockModuleId })
  }
  throw new Error(`mock registry: a module plugin must export { id }, got ${JSON.stringify(value)}`)
}

export type PluginLoader = () => Promise<{ default: unknown }>

/**
 * Loads the registry (in parallel, keeping its order) and checks it:
 * - ids are unique;
 * - every `dependsOn` entry is `'core'` or a module listed **earlier** (phase order);
 * - override keys are unique across the core and all modules.
 */
export async function loadMockModules(
  loaders: readonly PluginLoader[],
): Promise<MockModule<object>[]> {
  const loaded = await Promise.all(loaders.map((load) => load()))
  const modules = loaded.map((m) => toMockModule(m.default))
  checkModuleOrder(modules)
  return modules
}

export function checkModuleOrder(modules: readonly MockModule<object>[]): void {
  const seen = new Set<string>()
  const all = new Set(modules.map((m) => m.id))
  for (const m of modules) {
    if (seen.has(m.id)) throw new Error(`mock registry: duplicate module id ${m.id}`)
    for (const dep of m.dependsOn) {
      if (dep === 'core' || seen.has(dep)) continue
      if (all.has(dep)) {
        throw new Error(
          `mock registry: ${m.id} depends on ${dep}, which comes later in the registry`,
        )
      }
      throw new Error(`mock registry: ${m.id} depends on unknown module ${dep}`)
    }
    seen.add(m.id)
  }
}

/** Override key → owning plugin id. Throws on a key declared twice. */
export function overrideOwners(plugins: readonly MockPlugin<object>[]): Map<string, MockPluginId> {
  const owners = new Map<string, MockPluginId>()
  for (const p of plugins) {
    for (const key of p.overrides) {
      const prev = owners.get(key)
      if (prev) throw new Error(`mock overrides: key '${key}' is declared by ${prev} and ${p.id}`)
      owners.set(key, p.id)
    }
  }
  return owners
}
