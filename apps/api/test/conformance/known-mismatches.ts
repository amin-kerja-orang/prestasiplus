import type { KnownMismatch } from '@pp/contract-tests'

/**
 * Differences between the API and the shared scenarios that are understood and tracked (BE-31).
 * Each entry names the row of `docs/architecture/v2-backend-deviations.md` that explains it; an entry
 * without a row is not allowed. The runner reports them apart from failures, and an entry that no
 * longer occurs is reported as stale and fails the run, so the list can only shrink.
 */
export const API_KNOWN_MISMATCHES: KnownMismatch[] = []
