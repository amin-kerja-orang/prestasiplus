import { defineMockModule } from '@/mock/define'

import { m27Routes } from './handlers'

/**
 * M27 mock plugin (SRS M27 v1.3 §6, §7). M27 owns no store (D12): every figure is read at request time from
 * the owners' contracts (M01 users, M02 schools and subscriptions, M08 performance, M09 perutusan, M10
 * classes), so only M01 and M02 are `dependsOn` (the registry loads the rest, as for M17).
 *
 * Routes (`handlers/`): §7 #1 `GET /api/admin-sekolah/dashboard` (S0).
 */
const plugin = defineMockModule({
  id: 'M27',
  dependsOn: ['core', 'M01', 'M02'],
  version: 1,
  routes: m27Routes,
})

export default plugin
