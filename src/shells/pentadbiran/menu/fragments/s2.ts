/**
 * Menu rows owned by sector S2 (rows whose target route lives in S2 code; unbuilt rows with no route are S0).
 * Group order and icons stay in `../../menu.ts` (S0). New rows come via a one-line cross-sector PR to S0.
 */
import type { Row } from '../row'

export const S2_ROWS: readonly Row[] = [
  ['BS-08', 'Bank Soalan (Studio)', '/admin/studio'],
  ['BS-09', 'Audit Rajah', '/admin/soalan-gambar'],
  ['BS-04', 'Kualiti Soalan', '/admin/questions/quality'],
  ['BS-05', 'Laporan Soalan', '/admin/question-reports'],
  ['BS-11', 'Perlu Dikumpulkan Semula', '/admin/questions/regroup'],
]
