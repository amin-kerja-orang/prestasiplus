/**
 * Repository framework and ownership rules (F-10; D12, ADR-0014, overview §6.7).
 *
 * - `defineRepository` — the owner's contract for a shared store: domain methods, named-query
 *   methods (`count('Q-ELIGIBLE', …)`), seed-phase `contributeAnchors`, and a runtime guard that
 *   refuses writes from outside the owner's repository.
 * - `repositoryRegistry` — unique repository names (duplicate → boot error).
 * - `assertRepositoryConventions` — the plugin `repositories` export convention.
 * - `finaliseRepositories` — compile the datasets (closes contributions) in tests.
 * - `withZeroCounts` — `groupCount` omits zero groups; fill them from a key list.
 *
 * Static lint rules (eslint.config.ts, boundary section) keep another module's `mock/tables`,
 * `mock/datasets`, `mock/seeds` and `mock/repository` out of reach: other modules import only
 * `@/modules/<owner>/mock`.
 */
export {
  defineRepository,
  finaliseRepositories,
  isRepository,
  repositoryInfo,
  repositoryStores,
  RESERVED_REPOSITORY_KEYS,
  type ContributeMethods,
  type Contributor,
  type NamedQueryMethods,
  type NamedQuerySet,
  type QueryArgs,
  type Repository,
  type RepositoryContext,
  type RepositoryDef,
  type RepositoryStore,
  type RowOf,
} from './define'
export {
  assertRepositoryConventions,
  checkRepositoryConventions,
  type RepositoryPluginShape,
} from './conventions'
export { RepositoryError, type RepositoryErrorCode } from './errors'
export { currentOwner, storeGuard, type StoreGuard } from './guard'
export { withZeroCounts } from './helpers'
export {
  createRepositoryRegistry,
  repositoryRegistry,
  type RepositoryInfo,
  type RepositoryRegistry,
} from './registry'
