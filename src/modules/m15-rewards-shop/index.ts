import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

/**
 * M15 public entry (ADR-0009). Other modules import this module only from here. The api client
 * (SRS M15 §7 #1–#16) is exported for the M15 screens (T2–T4) and any consumer.
 */
export * from './api'

export const manifest: ModuleManifest = {
  id: 'M15',
  slug: 'm15-rewards-shop',
  routes,
}
