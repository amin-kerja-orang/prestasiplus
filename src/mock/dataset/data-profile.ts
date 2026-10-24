/**
 * Data profile of the virtual datasets (TRACKER D45: the v2 prototype is a fast proof of concept
 * with small data).
 *
 * - `full`: every dataset reports its observed live totals (Vitest, e2e, `VITE_DATA_PROFILE=full`).
 * - `poc`: every dataset is scaled down at compile time (`scaleCellsForPoc`), keeping every anchor
 *   (demo accounts, observed fixture records), so the mock boots in a fraction of the time.
 *
 * ONE switch, applied in `defineVirtualDataset` (no module is edited). Resolution: an explicit
 * `VITE_DATA_PROFILE` (`full` | `poc`) wins; otherwise `poc` while the prototype scope is on
 * (demo, artifact and local dev), `full` when `VITE_PROTOTYPE_SCOPE=off`. Vitest and the e2e build
 * set `VITE_DATA_PROFILE=full` explicitly, so tests that stub the scope on still see full data.
 */

import { cellKey, type CellSpec } from './spec'

export type DataProfile = 'full' | 'poc'

/**
 * Fraction of each cell's observed count kept in the `poc` profile, by dataset name (anchors are
 * always kept). Only the datasets that dominate the boot time are scaled. The others (users,
 * schools, wallets, videos, ...) stay complete: the modules derive classes, rosters and fixtures
 * from them at seed time and are cheap to compile. Pools that other modules sample from at seed
 * time (e.g. M05 draws 40 SPM questions of one subject for the canonical accounts) keep a larger
 * share, or the seed would throw.
 */
export const POC_SCALE_BY_DATASET: Readonly<Record<string, number>> = {
  questions: 0.03,
  jutawanQuestions: 0.03,
  structuredQuestions: 0.03,
  'practice.answers': 0.05,
  'practice.sessions': 0.05,
  coinLedger: 0.05,
}

export function dataProfile(): DataProfile {
  const explicit = import.meta.env.VITE_DATA_PROFILE
  if (explicit === 'full' || explicit === 'poc') return explicit
  return import.meta.env.VITE_PROTOTYPE_SCOPE === 'off' ? 'full' : 'poc'
}

/**
 * Whether the build-time documented-figure checks run (live totals, "schools with users = 61"…).
 * They compare computed counts with observed live figures, so they only apply to the full profile.
 */
export function buildChecksEnabled(): boolean {
  return dataProfile() === 'full'
}

/**
 * Scales the cells of a distribution: `max(anchors in the cell, round(count * POC_SCALE))`.
 * A cell never drops below its anchor count, and a cell that already has fewer rows than anchors
 * is left as is (the original spec check then reports it, exactly as in the full profile).
 * `cellScale` (optional) lets a dataset keep a larger fraction of chosen cells (never a smaller one
 * than `scale`), e.g. M04 keeps enough chapter questions per Tingkatan 4/5 chapter (D54).
 */
export function scaleCellsForPoc<F extends Record<string, unknown>>(
  cells: readonly CellSpec<F>[],
  facetNames: readonly string[],
  anchorFacets: readonly Readonly<Record<string, unknown>>[],
  scale: number,
  cellScale?: (facets: Readonly<F>) => number | undefined,
): CellSpec<F>[] {
  const anchored = new Map<string, number>()
  for (const f of anchorFacets) {
    const k = cellKey(f, facetNames)
    anchored.set(k, (anchored.get(k) ?? 0) + 1)
  }
  return cells.map((c) => {
    const k = cellKey(c.facets, facetNames)
    const anchors = anchored.get(k) ?? 0
    if (c.count <= anchors) return { facets: c.facets, count: c.count }
    // A dataset may keep a larger share of some cells (`VirtualDatasetDef.pocScale`), never less.
    const own = cellScale?.(c.facets)
    const cellFraction = own === undefined ? scale : Math.min(1, Math.max(scale, own))
    return { facets: c.facets, count: Math.max(anchors, Math.round(c.count * cellFraction)) }
  })
}
