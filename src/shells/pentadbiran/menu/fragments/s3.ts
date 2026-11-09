/**
 * Menu rows owned by sector S3 (rows whose target route lives in S3 code; unbuilt rows with no route are S0).
 * Group order and icons stay in `../../menu.ts` (S0). New rows come via a one-line cross-sector PR to S0.
 */
import type { Row } from '../row'

export const S3_ROWS: readonly Row[] = [
  ['KS-01', 'SPM', '/admin/spm'],
  ['BS-02', 'Import & Semakan', '/admin/spm/soalan/ekstrak'],
  ['KS-17', 'Set Builder', '/admin/studio/sets'],
  ['KS-07', 'Kertas Subjektif', '/admin/kertas-subjektif'],
]
