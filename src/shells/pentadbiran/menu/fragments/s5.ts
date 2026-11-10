/**
 * Menu rows owned by sector S5 (rows whose target route lives in S5 code; unbuilt rows with no route are S0).
 * Group order and icons stay in `../../menu.ts` (S0). New rows come via a one-line cross-sector PR to S0.
 */
import type { Row } from '../row'

export const S5_ROWS: readonly Row[] = [
  ['BS-07', 'Audio KBAT', '/admin/audio-kbat'],
  ['BS-06', 'PKSK Soalan', '/admin/pksk/questions'],
  ['KW-06', 'PKSK Akses', '/admin/pksk/access'],
  ['KK-06', 'Artikel', '/admin/articles'],
  ['KK-05', 'Banner', '/admin/banners'],
  ['KK-07', 'Nota', '/admin/notes'],
  ['SY-05', 'Upload Screenshot', '/admin/tools/screenshots'],
  ['KK-08', 'Video', '/admin/videos'],
]
