/** S8 / S9 constants (SRS BR-M04-28, FN-M04-4.1.4, FN-M04-4.2.2). */

/** S8 KBAT filter (live admin scale: 2 to 5 only). */
export const KBAT_FILTER_OPTIONS = [
  { value: 2, label: 'Memahami (L2)' },
  { value: 3, label: 'Mengaplikasi (L3)' },
  { value: 4, label: 'Menganalisis (L4)' },
  { value: 5, label: 'Menilai/Mencipta (L5)' },
] as const

/** S9 label; 1 "Mengingat" and 6 "Mencipta" are INFERRED from the student scale (BR-M04-28). */
const KBAT_NAMES: Record<number, string> = {
  1: 'Mengingat',
  2: 'Memahami',
  3: 'Mengaplikasi',
  4: 'Menganalisis',
  5: 'Menilai/Mencipta',
  6: 'Mencipta',
}

export function kbatLabel(level: number): string {
  const name = KBAT_NAMES[level]
  return name ? `${name} (L${String(level)})` : `L${String(level)}`
}

/**
 * S9 part label as observed (FN-M04-4.2.5): "3(A)" for a numbered question, "A" when unnumbered. The
 * store keeps the bare letter ("a", DATA-M04-03 `partLabel`); a label that already carries a number is
 * shown as stored.
 */
export function partLabelText(questionNumber: number | null, partLabel: string): string {
  if (partLabel.includes('(')) return partLabel
  const letter = partLabel.toUpperCase()
  return questionNumber === null ? letter : `${String(questionNumber)}(${letter})`
}
