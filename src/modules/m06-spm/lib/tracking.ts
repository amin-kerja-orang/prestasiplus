/**
 * Tracking A (S5/S6/Q3) and Subjektif (S8) helpers (SRS M06 FR-M06-35…53, 54…57; BR-M06-08…11).
 * Pure functions: copy, labels and query parsing only.
 */

import type { SetStatus, SubjektifOverview, TargetType, TrackingASetCard, WireId } from '../api'
import { targetName } from './latih-tubi'

/** Badge text and colour of a set status (BR-M06-08; "Belum Cukup" is the locked card). */
export const SET_STATUS: Record<SetStatus, { label: string; color: 'success' | 'info' | 'warning' }> = {
  bersih: { label: 'Set Bersih', color: 'success' },
  bank_besar: { label: 'Ready Bank Besar', color: 'info' },
  belum_cukup: { label: 'Belum Cukup', color: 'warning' },
}

export const isStartable = (status: SetStatus): boolean => status !== 'belum_cukup'

/** "DSKP: {a}/{b} ({p}%)". */
export function dskpLine(set: Pick<TrackingASetCard, 'dskpTagged' | 'dskpTotal'>): string {
  const pct = set.dskpTotal > 0 ? Math.round((set.dskpTagged / set.dskpTotal) * 100) : 0
  return `DSKP: ${String(set.dskpTagged)}/${String(set.dskpTotal)} (${String(pct)}%)`
}

/** The size a set must reach: the subject's target, else 40 (BR-M06-08). */
export const setSize = (targetSize: number | null): number => targetSize ?? 40

/** "Target {SPM|Latihan}: {n}" (S5 open card). */
export function targetChip(type: TargetType, size: number): string {
  return `Target ${targetName(type)}: ${String(size)}`
}

/** "{CODE} · Target set: {n} soalan" (readiness tile). */
export const tileTarget = (code: string, size: number): string =>
  `${code} · Target set: ${String(size)} soalan`

/** "{tahun} Set {n} · {ready}/{target}" (locked chip of a readiness tile). */
export const lockChip = (set: { year: number; setNo: number; readyCount: number; target: number }): string =>
  `${String(set.year)} Set ${String(set.setNo)} · ${String(set.readyCount)}/${String(set.target)}`

/** Link that starts a ready set (Q3). */
export const setHref = (code: string, year: number, setNo: number): string =>
  `/spm/ramalan/${encodeURIComponent(code)}?year=${String(year)}&set=${String(setNo)}`

/** "{tahun} · Set {n}": the row of a set (46 section 4.5). */
export const setRowTitle = (set: Pick<TrackingASetCard, 'year' | 'setNo'>): string =>
  `${String(set.year)} · Set ${String(set.setNo)}`

/** The empty text of the hub when no objective set is ready (46 section 4.5, AC-MUR-13-11). */
export const TRACKING_EMPTY_TEXT =
  'Tiada set objektif Tracking A yang bersedia lagi. Set sedang dibina — semua set semasa masih dalam proses pengisian. Semak semula tidak lama lagi!'

/** The server order (year descending, then set number) as one group per year (D-14). */
export function setsByYear<T extends { year: number }>(sets: readonly T[]): { year: number; sets: T[] }[] {
  const out: { year: number; sets: T[] }[] = []
  for (const s of sets) {
    const last = out.at(-1)
    if (last?.year === s.year) last.sets.push(s)
    else out.push({ year: s.year, sets: [s] })
  }
  return out
}

/** Link of a Tracking A Bahasa card (S5 → S7). */
export const bahasaHref = (subjectId: WireId): string =>
  `/latihan-berstruktur?subject_id=${String(subjectId)}&scope=spm&track=bahasa`

/** Link of an S8 subject card (S8 → S9). */
export const subjektifHref = (subjectId: WireId): string =>
  `/latihan-berstruktur?subject_id=${String(subjectId)}&scope=spm`

const toInt = (v: unknown): number | null => {
  const raw = Array.isArray(v) ? v[0] : v
  if (typeof raw !== 'string' || !/^\d{1,9}$/.test(raw)) return null
  return Number.parseInt(raw, 10)
}

/** `?year=&set=` of `/spm/ramalan/:code`: both present → the set quiz (Q3), else the set list (S6). */
export function parseSetQuery(
  query: Record<string, unknown>,
): { year: number; setNo: number } | null {
  const year = toInt(query.year)
  const setNo = toInt(query.set)
  return year !== null && setNo !== null ? { year, setNo } : null
}

export type SubjektifTab = 'all' | 'teras' | 'elektif'

/** Subject cards of a tab (the server order is Teras A–Z then Elektif A–Z, FR-M06-57). */
export function tabSubjects(
  subjects: SubjektifOverview['subjects'],
  tab: SubjektifTab,
): SubjektifOverview['subjects'] {
  return tab === 'all' ? subjects : subjects.filter((s) => s.group === tab)
}

/** "Skor Terbaik": "{p}%" or "Belum Ada". */
export const bestScoreLabel = (best: number | null): string =>
  best === null ? 'Belum Ada' : `${String(best)}%`
