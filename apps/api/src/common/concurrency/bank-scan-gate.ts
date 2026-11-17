import { Bulkhead } from './bulkhead'

/** Bank-wide statements that may run at the same time in one API process (the pool of 10 keeps the rest for short transactions). */
export const DEFAULT_BANK_SCAN_CONCURRENCY = 3

/** `BANK_SCAN_CONCURRENCY` (a positive integer); unset, blank or invalid means the default. Read per acquisition. */
export function bankScanConcurrency(raw: string | undefined = process.env.BANK_SCAN_CONCURRENCY): number {
  const n = Number.parseInt((raw ?? '').trim(), 10)
  return Number.isInteger(n) && n >= 1 ? n : DEFAULT_BANK_SCAN_CONCURRENCY
}

/**
 * The one gate of the bank-wide reads: `sampleIds` scans, `eligibleIdsPage`, `unitCountsByLevelTp`, the dashboard's `bankMatrix` and
 * `newestIdsOf` windows. Wrap only the statement itself, never a job that waits for another gated job (no nesting, so no deadlock).
 */
export const bankScanGate = new Bulkhead(() => bankScanConcurrency())
