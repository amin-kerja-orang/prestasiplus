/**
 * Unified accent palette (2026-11-09): the Pentadbiran sidebar chip, and every screen area that wants a
 * colour for the same area (dashboard tiles), take their accent from ONE map, `GROUP_ACCENT`, keyed by
 * the menu group key. The accents are the five meaning accents of `accent.ts` (action = brand blue,
 * friend = violet, heat = orange, win = lime, trial = amber), the same hues as the login gradient.
 *
 * Chip = 20% tint of the accent's AA ink slot with the glyph in that ink (`--ds-cat-*`, the darkened
 * lime/amber in light mode, the lifted blue/violet in dark mode). Measured on white, muted and the dark
 * cards the glyph is 3.7:1 or better in every mode (WCAG icons need 3:1). The lime and amber fills
 * themselves are too light to carry a glyph, which is why the ink slots are used for tints.
 * Full class literals (Tailwind and the class allowlist must see them).
 */
import type { DsAccent } from './types'

/** Tint + glyph of each accent. cat-1 blue, cat-2 lime, cat-5 amber, cat-6 orange, cat-7 violet. */
const ACCENT_TINT: Record<DsAccent, string> = {
  action: 'bg-cat-1/20 text-cat-1',
  win: 'bg-cat-2/20 text-cat-2',
  trial: 'bg-cat-5/20 text-cat-5',
  heat: 'bg-cat-6/20 text-cat-6',
  friend: 'bg-cat-7/20 text-cat-7',
}

/**
 * Accent per Pentadbiran group (menu.ts keys). Neighbouring groups always differ. Screens of an area
 * reuse the accent: Pengguna = action, Soalan = friend, Kurikulum = heat, Battle = heat, Sistem = trial.
 */
const GROUP_ACCENT: Record<string, DsAccent> = {
  pintasan: 'action',
  harian: 'heat',
  analitik: 'trial',
  kurikulum: 'heat',
  soalan: 'friend',
  pengguna: 'action',
  premium: 'trial',
  'kawalan-ciri': 'friend',
  gamifikasi: 'win',
  'battle-permainan': 'heat',
  marketplace: 'friend',
  kandungan: 'action',
  sistem: 'trial',
  ditangguh: 'win',
}

export function groupAccent(key: string | undefined): DsAccent {
  return (key && GROUP_ACCENT[key]) || 'action'
}

export function groupTintClass(key: string | undefined): string {
  return ACCENT_TINT[groupAccent(key)]
}
