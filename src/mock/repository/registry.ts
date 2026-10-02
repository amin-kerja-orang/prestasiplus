/**
 * The registry of repositories (D12, ADR-0014 §5). Every `defineRepository` call registers its
 * repository here by name, so a second repository with the same name fails as soon as the module
 * that defines it is loaded, which is at mock boot (the registry loads every plugin). This is the
 * "two plugins declare one store" boot error; the db adds `DUPLICATE_STORE` for two stores with
 * one store name.
 */

import { RepositoryError } from './errors'

export interface RepositoryInfo {
  /** Contract name, e.g. `'questions'` (the key in the plugin's `repositories`). */
  readonly name: string
  /** Owner module (D12), e.g. `'M04'`; `'M14'` for the provisional wallet. */
  readonly owner: string
  /** `true` while the owner module is not built and a consumer module hosts the definition. */
  readonly provisional: boolean
  /** Name of the primary store (`store.name`). */
  readonly store: string
  /** Names of every store the repository owns (primary first). */
  readonly stores: readonly string[]
  /** `'virtual'` (D11 dataset) or `'table'` (materialised). */
  readonly kind: 'virtual' | 'table'
  /** Named query ids exposed through `count(id, …)` etc. */
  readonly namedQueries: readonly string[]
}

export interface RepositoryRegistry {
  /** Throws `DUPLICATE_REPOSITORY` when the name is taken. */
  register(info: RepositoryInfo): void
  get(name: string): RepositoryInfo | undefined
  list(): readonly RepositoryInfo[]
  /** Forget every entry (test helper). */
  clear(): void
}

function describe(info: RepositoryInfo): string {
  return info.provisional ? `${info.owner} (provisional)` : info.owner
}

export function createRepositoryRegistry(
  options: { allowRedefine?: boolean } = {},
): RepositoryRegistry {
  const entries = new Map<string, RepositoryInfo>()
  return {
    register(info) {
      const prev = entries.get(info.name)
      if (prev) {
        // Dev HMR re-evaluates the defining module: the same definition may replace itself.
        const same = prev.owner === info.owner && prev.provisional === info.provisional
        if (!(options.allowRedefine && same)) {
          throw new RepositoryError(
            'DUPLICATE_REPOSITORY',
            `Repository '${info.name}' is defined twice: by ${describe(prev)} and by ${describe(info)}. A shared store has exactly one owner (D12); when the owner module is built, move the provisional definition instead of copying it.`,
          )
        }
      }
      entries.set(info.name, info)
    },
    get: (name) => entries.get(name),
    list: () => [...entries.values()],
    clear: () => entries.clear(),
  }
}

/** The app-wide registry used by `defineRepository` unless a test passes its own. */
export const repositoryRegistry: RepositoryRegistry = createRepositoryRegistry({
  allowRedefine: import.meta.hot !== undefined,
})
