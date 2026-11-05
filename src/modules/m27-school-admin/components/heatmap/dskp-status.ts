/**
 * S2 tile and legend labels by status (R1-AS-47: band names of OPT-HEATBAND; colours of the M08 SP map,
 * FR-M08-52). Copied here: the M08 module exports no public entry for them.
 */

import type { DskpStatus, HeatmapSp } from '../../api/school-admin'

/** The band names of OPT-HEATBAND (AC-AS-47-6): the tooltip and the legend use the same words. */
export const BAND_LABEL: Readonly<Record<DskpStatus, string>> = {
  mahir: 'Mahir (75%+)',
  sederhana: 'Sederhana (50-74%)',
  lemah: 'Lemah (<50%)',
  belum: 'Belum Cuba',
}

/** The one legend, on one line (AC-AS-47-3), in this order. */
export const LEGEND: readonly { status: DskpStatus; label: string }[] = (
  ['mahir', 'sederhana', 'lemah', 'belum'] as const
).map((status) => ({ status, label: BAND_LABEL[status] }))

/** AC-AS-47-1: "{kod SP}: {tajuk} — {band} ({n} jawapan)". */
export function tileTitle(sp: HeatmapSp): string {
  return `${sp.code}: ${sp.title} — ${BAND_LABEL[sp.status]} (${String(sp.answered)} jawapan)`
}
