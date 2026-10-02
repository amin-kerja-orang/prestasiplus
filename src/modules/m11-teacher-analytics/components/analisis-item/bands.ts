import type { ItemAnalysisRow } from '../../api/types'

/** FN-M11-5.1.3 legend dots / BR-M11-28 bands. */
export const BAND_DOT: Record<ItemAnalysisRow['band'], string> = {
  mudah: 'bg-emerald-500',
  sederhana: 'bg-amber-400',
  sukar: 'bg-red-500',
}

/** The question text cut to 80 characters (FN-M11-5.1.5). */
export function clip80(text: string): string {
  const chars = [...text.trim()]
  return chars.length > 80 ? `${chars.slice(0, 80).join('')}…` : chars.join('')
}

/** "% betul" with a trailing ".0" dropped (BR-M11-11): 75 → "75%", 12.5 → "12.5%". */
export const pctLabel = (p: number): string => `${Number(p.toFixed(1))}%`

/** 2 decimals; "-" when it cannot be computed. */
export const discLabel = (d: number | null): string => (d === null ? '-' : d.toFixed(2))

/** "baik" when > 0.3, "semak semula" when < 0 (FN-M11-5.1.5); otherwise none. */
export function discNote(d: number | null): 'baik' | 'semak semula' | null {
  if (d === null) return null
  return d > 0.3 ? 'baik' : d < 0 ? 'semak semula' : null
}
