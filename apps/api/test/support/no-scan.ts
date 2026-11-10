import { VirusScanService } from '../../src/modules/files/virus-scan'

/**
 * Test double for suites that exercise the teacher intake paths but not the virus scan (backlog #78): scanning reported as not
 * required, so uploads pass as before. The scan itself is covered by test/files/virus-scan.spec.ts and test/intake-files/virus-scan.spec.ts.
 */
export const NO_SCAN = { required: false, scan: () => Promise.reject(new Error('NO_SCAN: not required')), health: () => Promise.resolve('disabled' as const) }
export { VirusScanService }
