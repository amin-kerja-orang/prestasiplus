/**
 * S1 "Ringkasan:" sentence of the comparison box (C-54). Built on the client from the deltas the page already has,
 * in the V2 wording and order (admin/kirkpatrick/overview.blade.php:244-247): the four clauses are always present;
 * only the direction words follow the sign. "Januari" is a literal in V2. Counts are raw integers (V2 prints
 * `{{ $deltaActive }}`), the answers change carries thousands separators (V2 `$fmt`), accuracy is a whole number on
 * screen (R1-START-HERE section 11), where V2 printed one decimal.
 */
import type { Comparison } from '../../../api/types'
import { accuracyPct, count } from '../common'

type Delta = NonNullable<Comparison['delta']>

export function ringkasanText(delta: Delta): string {
  const acc = delta.accuracy >= 0 ? 'meningkat' : 'menurun'
  const ans = delta.answers >= 0 ? 'bertambah' : 'berkurang'
  return [
    `${String(delta.active)} pelajar baru mula aktif berbanding Januari.`,
    `Ketepatan jawapan ${acc} ${accuracyPct(Math.abs(delta.accuracy))}.`,
    `Jumlah jawapan ${ans} ${count(Math.abs(delta.answers))}.`,
    `${String(delta.champions)} pelajar naik ke tahap Champion.`,
  ].join(' ')
}
