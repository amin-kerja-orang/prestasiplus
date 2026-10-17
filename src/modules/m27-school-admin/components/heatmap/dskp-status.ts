/**
 * S2 tile and legend styles and labels by status (SRS M27 FR-M27-61…63; colours of the M08 SP map,
 * FR-M08-52). Copied here: the M08 module exports no public entry for them.
 */

import type { DskpStatus, HeatmapSp } from '../../api/school-admin'

/** Status word of the tile `title` (FR-M27-63). */
export const STATUS_LABEL: Readonly<Record<DskpStatus, string>> = {
  mahir: 'Mahir',
  sederhana: 'Sederhana',
  lemah: 'Lemah',
  belum: 'Belum cuba',
}

/** FR-M27-62, in this order. */
export const LEGEND: readonly { status: DskpStatus; label: string }[] = [
  { status: 'mahir', label: 'Mahir (75%+)' },
  { status: 'sederhana', label: 'Sederhana (50-74%)' },
  { status: 'lemah', label: 'Lemah (<50%)' },
  { status: 'belum', label: 'Belum Cuba' },
]

/** FR-M27-63: "{code}: {title} — {status}" plus " · {n} cuba · {p}% betul" when answered. */
export function tileTitle(sp: HeatmapSp): string {
  const base = `${sp.code}: ${sp.title} — ${STATUS_LABEL[sp.status]}`
  return sp.pct === null ? base : `${base} · ${String(sp.answered)} cuba · ${String(sp.pct)}% betul`
}
