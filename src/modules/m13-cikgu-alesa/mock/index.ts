/**
 * M13 mock plugin (M13-T1; SRS M13 v1.1 §6, §7; overview §6.7, D11/D12). Owner of the chat threads
 * and messages, RPHs, essay markings, PBD tags and the test-hook state (small seeded stores, not D11
 * datasets: §6.8.1). The AI is simulated with canned replies (D4).
 *
 * PUBLIC exports (the only M13 mock code other modules may import, `@/modules/m13-cikgu-alesa/mock`):
 * the `cikgu` repository (`send`, `turnsUsed`, `rphList/rphGet/rphCreate`, `essayList/essayGet`,
 * `pbdQueue`, `rollup`, `approve`, `exportCsv`, …) and the row types.
 *
 * Routes: §7 #1–#10 (`handlers/`); #11 and #12 are M10's `GET /api/guru/classes` and M03's
 * `GET /api/subjects`. Hooks (§6.9): `hooks/`. Test controls: `config.set('m13.aiLatencyMs', ms)`
 * (default 1,500, BR-M13-22). Screens and client functions: `../api`, the later M13 tasks.
 *
 * Bump `version` whenever the seed, a canned text or a table changes (overview §6.9, §14 rule 4b).
 */

import { defineMockModule } from '@/mock/define'

import { m13Routes } from './handlers'
import { m13Hooks } from './hooks'
import { cikguRepo } from './repository/cikgu'
import { seedCikgu } from './seeds/seed'
import { M13_TABLES } from './tables/tables'

const plugin = defineMockModule({
  id: 'M13',
  dependsOn: ['core', 'M01', 'M02', 'M03', 'M05', 'M10'],
  version: 1,
  tables: M13_TABLES,
  repositories: { cikgu: cikguRepo },
  seed: seedCikgu,
  routes: m13Routes,
  hooks: m13Hooks,
})

export default plugin

export const { cikgu } = plugin.repositories

export { AI_LATENCY_KEY } from './handlers'
export type * from './repository/types'
