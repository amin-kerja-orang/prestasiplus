/**
 * M07 test hooks (`window.__mock`; SRS M07 v1.7 §6.9). Hook names are global, so they are the ones
 * the SRS names:
 *
 * | Hook | Effect |
 * |---|---|
 * | `seedPkskAccessEdgeCases()` | adds the provisional fixture rows 4 (expired T1) and 5 (revoked T4) of Pelajar Dua Demo (E2E-M07-39 only; labels UNVERIFIED, L-7); a second call is refused |
 *
 * `mock.reset()` and `mock.setNow(iso)` are shared hooks; `mock.lastRequest(path)` too.
 */

import { EDGE_CASE_ACCESS } from './data/designed'
import { pkskAccessRepo } from './repository/stores'

export const m07Hooks = {
  seedPkskAccessEdgeCases(): number {
    const existing = pkskAccessRepo.forUser(EDGE_CASE_ACCESS[0]?.userId ?? 0)
    if (existing.some((r) => EDGE_CASE_ACCESS.some((e) => e.id === r.id))) {
      throw new Error('seedPkskAccessEdgeCases: the edge-case rows are already present')
    }
    pkskAccessRepo.seed(EDGE_CASE_ACCESS)
    return EDGE_CASE_ACCESS.length
  },
}
