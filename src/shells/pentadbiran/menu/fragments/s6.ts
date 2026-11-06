/**
 * Menu rows owned by sector S6 (rows whose target route lives in S6 code; unbuilt rows with no route are S0).
 * Group order and icons stay in `../../menu.ts` (S0). New rows come via a one-line cross-sector PR to S0.
 */
import type { Row } from '../row'

export const S6_ROWS: readonly Row[] = [
  ['PS-01', 'Senarai Pengguna', '/admin/users'],
  ['PS-02', 'Sekolah', '/admin/schools'],
  ['KW-05', 'Langganan Sekolah', '/admin/school-subscriptions'],
  ['PS-04', 'Import Pelajar', '/admin/import-students'],
  ['PS-06', 'Pelajar Komplimen', '/admin/comp-students'],
  ['PS-05', 'Import Pengguna', '/admin/users/bulk-import'],
]
