/** S10 category chips (BR-M15-27): key, link label (emoji + text) in chip order. */
export interface DigitalChip {
  key: string
  label: string
}

export const DIGITAL_CHIPS: readonly DigitalChip[] = [
  { key: 'all', label: '🌟 Semua' },
  { key: 'flagship', label: '🏆 Mahkota' },
  { key: 'ewallet', label: '💳 Dompet Digital' },
  { key: 'telco', label: '📱 Telekomunikasi' },
  { key: 'gaming', label: '🎮 Permainan' },
  { key: 'streaming', label: '🎬 Penstriman' },
  { key: 'food_beverage', label: '🍔 Makan & Minum' },
  { key: 'ecommerce', label: '🛒 Beli-belah' },
  { key: 'education', label: '📚 Pembelajaran' },
  { key: 'entertainment', label: '🎭 Hiburan' },
]

/**
 * The active chip key for a `cat` query value (BR-M15-27): absent or `all` -> `all`; a known key ->
 * that key; an unknown, repeated or empty value -> `null` (no chip active, the page is still shown).
 */
export function activeChipKey(cat: unknown): string | null {
  if (cat === undefined) return 'all'
  if (typeof cat !== 'string') return null
  return DIGITAL_CHIPS.some((c) => c.key === cat) ? cat : null
}
