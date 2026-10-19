/**
 * M25 mock plugin (M25-T1; SRS M25 v1.2 §6, §7). The heatmap is a derived read model: M25 has no
 * store, no seed and nothing to reset. It reads M05 `practice.answers` and M03 `curriculum`.
 *
 * PUBLIC exports (`@/modules/m25-ai-centre/mock`): the `heatmap` repository (`forUser`,
 * `hiddenForUser`). Route: §7 #1 (`handlers/`); #2 `GET /api/duta/recommendations` is M06's
 * provisional handler (owner M24). Hook: `loadFixture` (`hooks/`).
 */

import { defineMockModule } from '@/mock/define'

import { m25Routes } from './handlers'
import { m25Hooks } from './hooks'

const plugin = defineMockModule({
  id: 'M25',
  dependsOn: ['core', 'M01', 'M03', 'M04', 'M05'],
  version: 1,
  routes: m25Routes,
  hooks: m25Hooks,
})

export default plugin

export { heatmap } from './repository/heatmap'
export type { HeatmapRow, HiddenTotals } from './repository/heatmap'
