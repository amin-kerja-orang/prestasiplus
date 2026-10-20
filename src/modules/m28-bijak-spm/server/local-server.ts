/** Mock side of the server selection (kept apart so the http build never bundles it). */
import { BijakServer } from './store'
import type { KeyValueStore } from './storage'

export function createMockBijakServer(storage: KeyValueStore): BijakServer {
  return new BijakServer({ storage, latencyMs: import.meta.env.MODE === 'test' ? 0 : 120 })
}
