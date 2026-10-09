import type { RouteDef } from '@/mock/define'

import { amaranRoutes } from './amaran'

/** M18 routes. L07: §7 #21, #22, #24 and #30 (the Amaran school family); the rest of §7 is M18's own task. */
export const m18Routes: readonly RouteDef[] = [...amaranRoutes]

export { amaranExportAudit, resetAmaranExportAudit } from './amaran'
export type { ExportAuditEntry } from './amaran'
