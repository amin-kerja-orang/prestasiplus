/**
 * M12 display constants (ADR-0013 `DISPLAY_CONSTANT`, SRS M12 v1.6 §6.7 DATA-M12-06): observed figures that no
 * dataset definition reproduces. Each appears only on its own card and never next to a contradicting computed
 * figure. Registered here with their DV ids so `listDisplayConstants()` lists them.
 *
 * - DC-M12-01 `41` ("41 rekod · {year}", S5 GPS card, DV-M12-22);
 * - DC-M12-02 `4378` ("GPS Sekolah · 4378 rekod headcount" on S1, "Rekod Headcount" on S5, DV-M12-22; active since
 *   v1.4 because M08 hosts no count of OTR records, XL3-34);
 * - DC-M12-03 the correlation bands and r (S6 T4 card, table, "Kesimpulan ALESA", DV-M12-23).
 */

import { defineDisplayConstant } from '@/mock/dataset'

export const DC_M12_01 = defineDisplayConstant({
  module: 'M12',
  name: 'gpsRecordsLabel',
  value: 41,
  dv: 'DV-M12-22',
  shownOn: ['S5'],
  note: 'DC-M12-01: "41 rekod · {year}" is unchanged between platform (2025) and 8080 (2026).',
}).value

export const DC_M12_02 = defineDisplayConstant({
  module: 'M12',
  name: 'headcountRecords',
  value: 4378,
  dv: 'DV-M12-22',
  shownOn: ['S1', 'S5'],
  note: 'DC-M12-02: M08 cannot hold 4,378 OTR records without changing its own observed figures (XL3-34).',
}).value

/** DC-M12-03: r (S6 T4 card and "Kesimpulan ALESA"). */
export const DC_M12_03_R = defineDisplayConstant({
  module: 'M12',
  name: 'correlationR',
  value: 0.1298,
  dv: 'DV-M12-23',
  shownOn: ['S6'],
  note: 'DC-M12-03: 149 + 348 = 497 differs from Champion 513; no per-student count reproduces both.',
}).value

/** The three correlation bands of DC-M12-03 (the constant is registered as the string below). */
export const CORRELATION_BANDS = Object.freeze([
  Object.freeze({ label: '1-20 soalan', n: 215, acc: 59.7 }),
  Object.freeze({ label: '51-100 soalan', n: 149, acc: 68.7 }),
  Object.freeze({ label: '100+ soalan', n: 348, acc: 75.2 }),
])

defineDisplayConstant({
  module: 'M12',
  name: 'correlationBands',
  value: CORRELATION_BANDS.map((b) => `${b.label}:${String(b.n)}:${String(b.acc)}`).join('|'),
  dv: 'DV-M12-23',
  shownOn: ['S6'],
  note: 'DC-M12-03 bands: label : n : accuracy (primitive form of the frozen CORRELATION_BANDS).',
})
