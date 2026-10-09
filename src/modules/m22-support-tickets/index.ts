import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

export * from './api/tickets'
export * from './api/types'

/** M22 public entry (ADR-0009): support tickets S1 `/pusat-tuisyen/tiket` and S2 `/admin/tiket`. */
export const manifest: ModuleManifest = {
  id: 'M22',
  slug: 'm22-support-tickets',
  routes,
}
