/**
 * `defineRepository` (D12, ADR-0014, overview §6.7): the only public doorway to a shared store.
 *
 * ```ts
 * // src/modules/m04-question-bank/mock/repository/questions.ts (owner module)
 * export const questionsRepo = defineRepository({
 *   name: 'questions',
 *   owner: 'M04',
 *   store: questions,                          // the dataset/table, private to M04
 *   queries: defineNamedQueries(questions, {   // M04 §4.1 named count queries
 *     'Q-ELIGIBLE': { where: (subjectId: number) => ({ subjectId, status: 'approved', isActive: true }) },
 *   }),
 *   validateAnchor: (row) => (row.subjectId > 0 ? undefined : 'subjectId is required'),
 *   methods: ({ store, transaction }) => ({
 *     get: (id: number) => store.get(id),
 *     deactivate: (id: number, cause: string) => transaction(() => store.update(id, { isActive: false, cause })),
 *   }),
 * })
 *
 * // src/modules/m04-question-bank/mock/index.ts
 * const plugin = defineMockModule({ id: 'M04', datasets: { questions }, repositories: { questions: questionsRepo }, … })
 * export const { questions } = plugin.repositories      // what other modules import
 *
 * // another module (M05): only the owner's contract
 * import { questions } from '@/modules/m04-question-bank/mock'
 * questions.count('Q-ELIGIBLE', 3)
 * questions.contributeAnchors(ctx, practiceFixtureQuestions)   // in seed(ctx) only
 * ```
 *
 * What the framework guarantees:
 * - **One owner per store.** The repository guards its stores (`./guard.ts`): only code running
 *   inside a repository method of the owner can write them; any other write throws `OWNERSHIP`.
 *   A store cannot be guarded for two owners, and repository names are unique (`./registry.ts`).
 * - **Domain methods only.** `methods(ctx)` returns the contract. Every method runs in the owner's
 *   scope. The raw store is never on the repository object.
 * - **Named queries** (`queries`, from `defineNamedQueries`) are exposed as
 *   `count(id, …args)`, `groupCount(id, field, …args)`, `query(id, options, …args)`,
 *   `sample(id, n, rng, …args)` and `where(id, …args)`. `groupCount` omits groups with a zero
 *   count (it aggregates non-empty cells); use `withZeroCounts` when a screen lists every group.
 * - **Anchor contributions** (virtual datasets only): `contributeAnchors(ctxOrModule, rows)` is
 *   seed-phase only. Rows are validated by the owner (`validateAnchor`) and count within the
 *   owner's totals (D11). Contributions close when the dataset compiles at finalise; reads before
 *   that throw `PHASE`, so no read can close the window early.
 * - **Provisional stores** (`provisional: true`, owner not built yet) keep the same contract; the
 *   owner's build task moves the definition unchanged.
 * - **Transactions:** `ctx.transaction(fn)` groups the writes of a method in one db transaction.
 *   Define the repository at module load (as above), before boot registers its stores with the db:
 *   the guard learns the db from `attach`, and a store registered earlier runs `fn` untracked.
 */

import type {
  DbPhase,
  QueryOptions,
  QueryResult,
  StoreId,
  TransactionalStore,
  Where,
} from '../db/store'
import type { Prng } from '../determinism/prng'
import type { MockPluginId, SeedContext } from '../server/plugin'
import { RepositoryError } from './errors'
import {
  guardStore,
  isVirtualStore,
  runAsOwner,
  type ContributableStore,
  type GuardableStore,
  type StoreGuard,
} from './guard'
import { repositoryRegistry, type RepositoryInfo, type RepositoryRegistry } from './registry'

/** A store a repository can own: a `defineTable` table or a `defineVirtualDataset` dataset. */
export type RepositoryStore = GuardableStore &
  TransactionalStore & {
    get(id: never): unknown
  }

/** The row type of a store. */
export type RowOf<S> = S extends { get(id: never): infer R } ? Exclude<R, undefined> : never

/** What `defineNamedQueries` returns, structurally (one entry per query id). */
export type NamedQuerySet = Readonly<
  Record<string, { readonly id: string; count(...args: never): number }>
>

/** The parameters of a named query. */
export type QueryArgs<N> = N extends { count(...args: infer A): number } ? A : never

export interface NamedQueryMethods<Row, Q> {
  /** The count of a named query (O(cells) for facet-only queries). */
  count<I extends keyof Q & string>(query: I, ...args: QueryArgs<Q[I]>): number
  /**
   * Counts per value of `field` for a named query. **Groups with a zero count are omitted** (the
   * dataset aggregates non-empty cells). Use `withZeroCounts(map, keys)` to list every group.
   */
  groupCount<I extends keyof Q & string, G extends keyof Row>(
    query: I,
    field: G,
    ...args: QueryArgs<Q[I]>
  ): Map<Row[G], number>
  /** Rows of a named query (sort, paging; `where` comes from the query). */
  query<I extends keyof Q & string>(
    query: I,
    options: Omit<QueryOptions<Row>, 'where'>,
    ...args: QueryArgs<Q[I]>
  ): QueryResult<Row>
  /** `n` distinct rows of a named query, drawn with `rng`. */
  sample<I extends keyof Q & string>(
    query: I,
    n: number,
    rng: Prng,
    ...args: QueryArgs<Q[I]>
  ): Row[]
  /** The condition of a named query (to combine in owner methods). */
  where<I extends keyof Q & string>(query: I, ...args: QueryArgs<Q[I]>): Where<Row>
}

/** Who contributes: the contributor's `SeedContext` (preferred) or its plugin id. */
export type Contributor = MockPluginId | Pick<SeedContext, 'module' | 'db'>

export interface ContributeMethods<Row> {
  /**
   * Seed phase only (`seed(ctx)`): adds `rows` as anchors of the owner's dataset. They are
   * validated by the owner and count within the owner's totals (D11). Throws `PHASE` after the
   * dataset is compiled (finalise) and `CONTRACT` for invalid rows.
   */
  contributeAnchors(contributor: Contributor, rows: readonly Row[]): void
}

export type Repository<
  S extends RepositoryStore,
  M extends object = Record<never, never>,
  Q extends object = Record<never, never>,
> = Readonly<M> &
  NamedQueryMethods<RowOf<S>, Q> &
  (S extends { readonly kind: 'virtual' } ? ContributeMethods<RowOf<S>> : unknown)

export interface RepositoryContext<S extends RepositoryStore, X extends object> {
  /** Owner module id. */
  readonly owner: MockPluginId
  /** Repository (contract) name. */
  readonly name: string
  /** The primary store (writes allowed: methods run in the owner's scope). */
  readonly store: S
  /** Additional stores this repository owns (e.g. practice answers, queue, mastery). */
  readonly stores: X
  /** The db phase of the primary store (`null` before it is registered with a db). */
  readonly phase: () => DbPhase | null
  /**
   * Runs `fn` in one db transaction: every write of every store rolls back together if `fn`
   * throws; an open transaction is joined. Synchronous, like `db.transaction`.
   */
  readonly transaction: <T>(fn: () => T) => T
}

export interface RepositoryDef<
  S extends RepositoryStore,
  M extends object,
  Q extends object,
  X extends object,
> {
  /** Owner module (D12). For a provisional store, the future owner (e.g. `'M14'`). */
  owner: MockPluginId
  /** The owner is not built yet; a consumer module hosts this definition (same contract). */
  provisional?: boolean
  /** Contract name, the key in the plugin's `repositories`. Default: `store.name`. */
  name?: string
  /** The primary store: named queries and contributions apply to it. */
  store: S
  /** Additional owned stores (materialised tables of the same owner). */
  stores?: X
  /** Named queries of the primary store (`defineNamedQueries(store, {...})`). */
  queries?: Q
  /**
   * Owner schema check of a contributed anchor. Return a message (or several) to reject it.
   * The framework already rejects non-objects, rows without an id and duplicate ids.
   */
  validateAnchor?: (
    row: RowOf<S>,
    contributor: MockPluginId,
  ) => string | readonly string[] | undefined | void
  /** The domain methods (the contract). Each runs in the owner's scope. */
  methods?: (ctx: RepositoryContext<S, X>) => M
  /** Registry for duplicate-name checks. Default: the app-wide `repositoryRegistry`. */
  registry?: RepositoryRegistry
}

/** Names the framework adds to every repository; domain methods may not reuse them. */
export const RESERVED_REPOSITORY_KEYS: readonly string[] = [
  'count',
  'groupCount',
  'query',
  'sample',
  'where',
  'contributeAnchors',
]

const PLUGIN_ID_RE = /^(?:core|M\d{2})$/

interface Internal {
  info: RepositoryInfo
  stores: readonly RepositoryStore[]
  guard: StoreGuard
}

const internals = new WeakMap<object, Internal>()

export function isRepository(value: unknown): boolean {
  return typeof value === 'object' && value !== null && internals.has(value)
}

/** Owner, provisional flag, stores and named queries of a repository. */
export function repositoryInfo(repo: object): RepositoryInfo {
  const internal = internals.get(repo)
  if (!internal) throw new RepositoryError('CONTRACT', 'repositoryInfo: not a repository')
  return internal.info
}

/** The stores a repository owns (framework use: conventions check, finalise). */
export function repositoryStores(repo: object): readonly RepositoryStore[] {
  const internal = internals.get(repo)
  if (!internal) throw new RepositoryError('CONTRACT', 'repositoryStores: not a repository')
  return internal.stores
}

function assertStore(value: unknown, label: string): asserts value is RepositoryStore {
  const s = value as Partial<Record<string, unknown>> | null
  const ok =
    typeof s === 'object' &&
    s !== null &&
    typeof s.name === 'string' &&
    s.name !== '' &&
    ['get', 'insert', 'update', 'remove', 'attach', 'beginTx'].every(
      (m) => typeof s[m] === 'function',
    )
  if (!ok) {
    throw new RepositoryError(
      'CONTRACT',
      `${label}: expected a store (defineTable / defineVirtualDataset)`,
    )
  }
}

function idText(id: unknown): string {
  return typeof id === 'string' || typeof id === 'number' ? String(id) : JSON.stringify(id)
}

function contributorId(contributor: Contributor, label: string): MockPluginId {
  const id = typeof contributor === 'string' ? contributor : contributor.module
  if (typeof id !== 'string' || !PLUGIN_ID_RE.test(id)) {
    throw new RepositoryError('CONTRACT', `${label}: invalid contributor ${JSON.stringify(id)}`)
  }
  return id
}

export function defineRepository<
  S extends RepositoryStore,
  M extends object = Record<never, never>,
  Q extends object = Record<never, never>,
  X extends object = Record<never, never>,
>(def: RepositoryDef<S, M, Q, X>): Repository<S, M, Q> {
  const { owner, store } = def
  const provisional = def.provisional ?? false
  if (typeof owner !== 'string' || !PLUGIN_ID_RE.test(owner)) {
    throw new RepositoryError(
      'CONTRACT',
      `defineRepository: invalid owner ${JSON.stringify(owner)}`,
    )
  }
  assertStore(store, 'defineRepository.store')
  const name = def.name ?? store.name
  if (!name) throw new RepositoryError('CONTRACT', 'defineRepository: name is required')
  const label = `repository '${name}' (${owner})`

  const extra = (def.stores ?? {}) as Record<string, unknown>
  const extraStores: RepositoryStore[] = []
  for (const [key, s] of Object.entries(extra)) {
    assertStore(s, `${label}: stores.${key}`)
    if (s === store || extraStores.includes(s)) {
      throw new RepositoryError('CONTRACT', `${label}: store '${s.name}' is listed twice`)
    }
    extraStores.push(s)
  }
  const allStores = [store, ...extraStores]

  // Named queries: validate the shape before anything is registered or guarded.
  const queries = (def.queries ?? {}) as Record<string, unknown>
  for (const [id, q] of Object.entries(queries)) {
    const nq = q as Partial<Record<string, unknown>> | null
    if (
      typeof nq !== 'object' ||
      nq === null ||
      !['count', 'groupCount', 'query', 'sample', 'where'].every((m) => typeof nq[m] === 'function')
    ) {
      throw new RepositoryError(
        'CONTRACT',
        `${label}: named query '${id}' is not a defineNamedQueries entry`,
      )
    }
  }

  const info: RepositoryInfo = Object.freeze({
    name,
    owner,
    provisional,
    store: store.name,
    stores: Object.freeze(allStores.map((s) => s.name)),
    kind: isVirtualStore(store) ? ('virtual' as const) : ('table' as const),
    namedQueries: Object.freeze(Object.keys(queries)),
  })

  // Guard first (a store owned by another module fails before the name is taken).
  const guards = allStores.map((s) => guardStore(s, owner, name))
  ;(def.registry ?? repositoryRegistry).register(info)
  const guard = guards[0] as StoreGuard

  const ctx: RepositoryContext<S, X> = Object.freeze({
    owner,
    name,
    store,
    stores: Object.freeze({ ...(def.stores ?? {}) }) as X,
    phase: () => guard.host?.phase ?? null,
    transaction<T>(fn: () => T): T {
      const host = guard.host
      // `host.write` joins an open transaction, or opens one in the live phase (overview §6.5).
      return host ? host.write(store, fn) : fn()
    },
  })

  const repo: Record<string, unknown> = {}

  // Domain methods, each in the owner's scope.
  const methods = (def.methods ? runAsOwner(owner, () => def.methods?.(ctx)) : {}) as Record<
    string,
    unknown
  >
  if (typeof methods !== 'object' || methods === null) {
    throw new RepositoryError('CONTRACT', `${label}: methods(ctx) must return an object`)
  }
  for (const [key, fn] of Object.entries(methods)) {
    if (RESERVED_REPOSITORY_KEYS.includes(key)) {
      throw new RepositoryError(
        'CONTRACT',
        `${label}: method '${key}' clashes with the framework's named-query/contribution API`,
      )
    }
    if (typeof fn !== 'function') {
      throw new RepositoryError(
        'CONTRACT',
        `${label}: '${key}' is not a function; a repository exposes domain methods only (no raw stores or tables)`,
      )
    }
    const method = fn as (...args: unknown[]) => unknown
    repo[key] = (...args: unknown[]) => runAsOwner(owner, () => method(...args))
  }

  // Named-query methods.
  type AnyQuery = {
    count(...a: unknown[]): number
    groupCount(field: unknown, ...a: unknown[]): unknown
    query(options: unknown, ...a: unknown[]): unknown
    sample(n: number, rng: Prng, ...a: unknown[]): unknown
    where(...a: unknown[]): unknown
  }
  const named = (id: unknown): AnyQuery => {
    const q = typeof id === 'string' ? queries[id] : undefined
    if (!q) {
      const known = Object.keys(queries)
      throw new RepositoryError(
        'CONTRACT',
        `${label}: unknown named query ${JSON.stringify(id)}. Known: ${known.length > 0 ? known.join(', ') : '(none)'}`,
      )
    }
    return q as AnyQuery
  }
  const scoped =
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): R =>
      runAsOwner(owner, () => fn(...args))
  repo.count = scoped((id: unknown, ...args: unknown[]) => named(id).count(...args))
  repo.groupCount = scoped((id: unknown, field: unknown, ...args: unknown[]) =>
    named(id).groupCount(field, ...args),
  )
  repo.query = scoped((id: unknown, options: unknown, ...args: unknown[]) =>
    named(id).query(options ?? {}, ...args),
  )
  repo.sample = scoped((id: unknown, n: number, rng: Prng, ...args: unknown[]) =>
    named(id).sample(n, rng, ...args),
  )
  repo.where = scoped((id: unknown, ...args: unknown[]) => named(id).where(...args))

  // Anchor contributions (virtual datasets).
  if (isVirtualStore(store)) {
    const dataset: ContributableStore = store
    repo.contributeAnchors = (contributor: Contributor, rows: readonly { id: StoreId }[]) => {
      const who = contributorId(contributor, `${name}.contributeAnchors`)
      const where = `${name}.contributeAnchors(${who})`
      const phaseOf = typeof contributor === 'string' ? null : contributor.db.phase
      const hostPhase = guard.host?.phase ?? null
      if (dataset.compiled || phaseOf === 'live' || hostPhase === 'live') {
        throw new RepositoryError(
          'PHASE',
          `${where}: contributions are seed-phase only and close when '${store.name}' compiles at finalise. Call it from the plugin's seed(ctx), not finalise() or a handler.`,
        )
      }
      if (!Array.isArray(rows)) {
        throw new RepositoryError('CONTRACT', `${where}: rows must be an array`)
      }
      const issues: string[] = []
      const seen = new Set<unknown>()
      rows.forEach((row: unknown, i) => {
        if (typeof row !== 'object' || row === null) {
          issues.push(`row ${String(i)}: not an object`)
          return
        }
        const id = (row as { id?: unknown }).id
        if (id === undefined || id === null) {
          issues.push(`row ${String(i)}: id is required (anchors carry their live or reserved id)`)
          return
        }
        if (seen.has(id)) issues.push(`row ${String(i)}: duplicate id ${idText(id)}`)
        seen.add(id)
        const verdict = def.validateAnchor?.(row as RowOf<S>, who)
        const messages =
          verdict === undefined ? [] : typeof verdict === 'string' ? [verdict] : verdict
        for (const m of messages) issues.push(`id ${idText(id)}: ${m}`)
      })
      if (issues.length > 0) {
        throw new RepositoryError(
          'CONTRACT',
          `${where}: ${String(issues.length)} anchor(s) rejected by the ${owner} schema`,
          issues,
        )
      }
      runAsOwner(owner, () => dataset.addAnchors(rows, who))
    }
  }

  Object.freeze(repo)
  internals.set(repo, { info, stores: Object.freeze(allStores), guard })
  return repo as Repository<S, M, Q>
}

/**
 * Compiles every virtual dataset of `repos` (closes the contribute phase). The seed composer does
 * this for every plugin dataset at finalise; call it in unit tests that seed without the composer.
 */
export function finaliseRepositories(repos: readonly object[]): void {
  for (const repo of repos) {
    for (const s of repositoryStores(repo)) {
      if (isVirtualStore(s)) s.compile()
    }
  }
}
