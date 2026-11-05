/**
 * Menu rows owned by sector S7 (rows whose target route lives in S7 code; unbuilt rows with no route are S0).
 * Group order and icons stay in `../../menu.ts` (S0). New rows come via a one-line cross-sector PR to S0.
 */
import type { Row } from '../row'

export const S7_ROWS: readonly Row[] = [
  ['PG-22', 'Tiket Bantuan', '/admin/tiket'],
]
