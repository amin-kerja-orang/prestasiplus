import type { DsAccent } from '@/ds'

/** Accent of a topic card chip, stable per subject so the catalogue is varied (design language 2026-10-18). */
const ACCENTS: readonly DsAccent[] = ['action', 'win', 'heat', 'friend', 'trial']

export function topicAccent(subject: string): DsAccent {
  let h = 0
  for (const ch of subject) h = (h * 31 + ch.charCodeAt(0)) % 997
  return ACCENTS[h % ACCENTS.length] ?? 'action'
}

/** Phosphor glyph of a topic's subject code (keyword match, books fallback). Full class names for the icon bundler. */
export function topicGlyph(subject: string): string {
  const s = subject.toLowerCase()
  if (/mat|add/.test(s)) return 'i-ph-calculator-duotone'
  if (/sains|bio|kimia|fizik/.test(s)) return 'i-ph-flask-duotone'
  if (/bahasa|bm|bi|inggeris|arab|cina/.test(s)) return 'i-ph-translate-duotone'
  if (/sejarah|geografi/.test(s)) return 'i-ph-scroll-duotone'
  return 'i-ph-books-duotone'
}
