/**
 * The plugin `repositories` export convention (D12, ADR-0014 §5, overview §6.10), checked at boot:
 *
 * 1. every value in a plugin's `repositories` is a `defineRepository` result, under its own name;
 * 2. a plugin exports only repositories it owns, or **provisional** repositories whose owner is not
 *    built yet (then the owner must be another module); a provisional repository in its own
 *    owner's plugin must drop the flag;
 * 3. every store of an exported repository is registered by the same plugin (`tables` /
 *    `datasets`), so it is seeded, compiled, persisted and reset with that plugin;
 * 4. a plugin does not register a store owned by another module (no second copy of a shared store);
 * 5. repository names are unique across plugins, and a repository is exported by one plugin only
 *    (consumers import it from `@/modules/<owner>/mock`, they never re-export it in their plugin).
 */

import type { MockPlugin } from '../server/plugin'
import { repositoryInfo, repositoryStores, isRepository } from './define'
import { RepositoryError } from './errors'
import { storeGuard } from './guard'

export type RepositoryPluginShape = Pick<
  MockPlugin<object>,
  'id' | 'tables' | 'datasets' | 'repositories'
>

/** Problems with the convention (empty when all is well). */
export function checkRepositoryConventions(plugins: readonly RepositoryPluginShape[]): string[] {
  const issues: string[] = []
  const exportedBy = new Map<object, string>()
  const names = new Map<string, string>()

  for (const p of plugins) {
    const registered = new Set<object>([...Object.values(p.tables), ...Object.values(p.datasets)])
    const hostedOwners = new Set<string>([p.id])

    for (const [key, repo] of Object.entries(p.repositories as Record<string, unknown>)) {
      if (!isRepository(repo)) {
        issues.push(`${p.id}: repositories.${key} is not a defineRepository result`)
        continue
      }
      const r = repo as object
      const info = repositoryInfo(r)
      if (key !== info.name) {
        issues.push(
          `${p.id}: repositories.${key} holds repository '${info.name}'; use its name as the key`,
        )
      }
      const prevPlugin = exportedBy.get(r)
      if (prevPlugin) {
        issues.push(
          `${p.id}: re-exports repository '${info.name}' of ${prevPlugin}; import it from the owner's mock entry instead`,
        )
        continue
      }
      exportedBy.set(r, p.id)
      const prevName = names.get(info.name)
      if (prevName) issues.push(`repository '${info.name}' is exported by ${prevName} and ${p.id}`)
      names.set(info.name, p.id)

      if (info.provisional) {
        if (info.owner === p.id) {
          issues.push(
            `${p.id}: repository '${info.name}' is provisional in its own owner; drop the flag`,
          )
        } else {
          hostedOwners.add(info.owner)
        }
      } else if (info.owner !== p.id) {
        issues.push(
          `${p.id}: exports repository '${info.name}' owned by ${info.owner}; only the owner (or a provisional host) exports it`,
        )
      }
      for (const s of repositoryStores(r)) {
        if (!registered.has(s)) {
          issues.push(
            `${p.id}: store '${s.name}' of repository '${info.name}' is not in the plugin's tables/datasets`,
          )
        }
      }
    }

    for (const s of registered) {
      const guard = storeGuard(s)
      if (guard && !hostedOwners.has(guard.owner)) {
        issues.push(
          `${p.id}: registers store '${(s as { name: string }).name}' owned by ${guard.owner}; use the ${guard.owner} repository`,
        )
      }
    }
  }
  return issues
}

/** Throws `RepositoryError('CONVENTION')` listing every problem. Call at boot, after loading. */
export function assertRepositoryConventions(plugins: readonly RepositoryPluginShape[]): void {
  const issues = checkRepositoryConventions(plugins)
  if (issues.length > 0) {
    throw new RepositoryError(
      'CONVENTION',
      'mock plugins break the repository convention (D12)',
      issues,
    )
  }
}
