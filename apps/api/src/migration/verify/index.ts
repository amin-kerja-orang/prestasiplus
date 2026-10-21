/**
 * BE-30 `migrate:verify`: the reconciliation report and go/no-go gate (plan 14.6). STUB: Part B implements it.
 */
import type { VerifyOptions, VerifyReport } from './types'

export * from './types'

export async function runVerify(_options: VerifyOptions): Promise<VerifyReport> {
  throw new Error('runVerify: not implemented yet (BE-30 Part B).')
}

/** Writes `recon-<stamp>.json` and `.md` into the `.migration-out` folder and returns their paths. */
export function writeVerifyReport(_report: VerifyReport, _outDir?: string): { json: string; md: string } {
  throw new Error('writeVerifyReport: not implemented yet (BE-30 Part B).')
}

export { rollbackLegacy } from './rollback'
