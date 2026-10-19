/**
 * Pure helpers of the M06 mock-exam screens (SRS M06 §2.11-§2.13, BR-M06-24/25/29, DV-M06-06/08).
 */

import type { MockGrade, MockItem } from '../api/types'

/** The 10 S11 subject options (values = labels). */
export const MOCK_SUBJECT_OPTIONS = [
  'Bahasa Melayu',
  'English',
  'Matematik',
  'Matematik Tambahan',
  'Fizik',
  'Kimia',
  'Biologi',
  'Sains',
  'Sejarah',
  'Pendidikan Islam',
] as const

/** The 15 S13 subject options (values = labels). */
export const WALKTHROUGH_SUBJECT_OPTIONS = [
  ...MOCK_SUBJECT_OPTIONS,
  'Pendidikan Moral',
  'Geografi',
  'Ekonomi',
  'Perdagangan',
  'Prinsip Akaun',
] as const

/** Colour of the grade badge (DV-M06-06: A+/A success, B+/B info, C warning, D/E/G error, pending neutral). */
export const GRADE_COLOR: Record<
  MockGrade | 'pending',
  'success' | 'info' | 'warning' | 'error' | 'neutral'
> = {
  'A+': 'success',
  A: 'success',
  'B+': 'info',
  B: 'info',
  C: 'warning',
  D: 'error',
  E: 'error',
  G: 'error',
  pending: 'neutral',
}


/** "Score: {a}/{b} ({p}%)" with two decimals (FR-M06-70). */
export function scoreLabel(score: number, max: number, percent: number): string {
  return `Score: ${String(score)}/${String(max)} (${percent.toFixed(2)}%)`
}

/** "{p}%" with two decimals (S12 hero). */
export function percentLabel(percent: number): string {
  return `${percent.toFixed(2)}%`
}

/** An item is correct when it earned its full marks. */
export function isCorrect(item: Pick<MockItem, 'marks' | 'maxMarks'>): boolean {
  return item.marks !== null && item.marks >= item.maxMarks
}

/** "Soalan {n} · {m}/{max} markah" (upper-cased by CSS). */
export function itemHeader(item: Pick<MockItem, 'no' | 'marks' | 'maxMarks'>): string {
  return `Soalan ${String(item.no)} · ${String(item.marks ?? 0)}/${String(item.maxMarks)} markah`
}

/** "{n} soalan tersilap". */
export function wrongLabel(count: number): string {
  return `${String(count)} soalan tersilap`
}

/** Letter of an option index (0 -> A). */
export const optionLetter = (index: number): string => String.fromCharCode(65 + index)

/** Elapsed time `mm:ss` (or `h:mm:ss`) since `createdIso`, never negative (Q4 timer placeholder). */
export function elapsedLabel(createdIso: string, nowMs: number): string {
  const total = Math.max(0, Math.floor((nowMs - Date.parse(createdIso)) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${String(h)}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`
}
