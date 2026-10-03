import type { RepositoryRegistry } from '@/mock/repository'

/** Options of the provisional repository factories (F-33). */
export interface ProvisionalOptions {
  /**
   * `true` while M17 hosts the store (default). The owner's build task moves the definition with
   * `provisional: false` (overview §6.7.2).
   */
  provisional?: boolean
  /** Registry for the duplicate-name check; default the app-wide one (tests pass their own). */
  registry?: RepositoryRegistry
}
