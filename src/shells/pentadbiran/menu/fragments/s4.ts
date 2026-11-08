/**
 * Menu rows owned by sector S4 (rows whose target route lives in S4 code; unbuilt rows with no route are S0).
 * Group order and icons stay in `../../menu.ts` (S0). New rows come via a one-line cross-sector PR to S0.
 */
import type { Row } from '../row'

export const S4_ROWS: readonly Row[] = [
  ['KK-01', 'Kurikulum', '/admin/curriculum'],
  ['KK-02', 'Subjek', '/admin/subjects'],
  ['KK-04', 'Tahap Pendidikan', '/admin/education-levels'],
]
