import type { Art3DName } from '@/ds'

/**
 * v2 learner look of a hub card: the 3D art on the card (no gradient banner). The old per-card palette in
 * `HUB_THEME` / `badgeClass` (hub-cards.ts) is kept as data for the live-fidelity tests but is no
 * longer painted.
 */
export const HUB_ART: Readonly<Record<string, Art3DName>> = {
  'papan-bijak': 'rocket',
  battle: 'fire',
  'perang-fakta': 'bolt',
  'benteng-ilmu': 'cap',
  'perlumbaan-matematik': 'rocket',
  'kuiz-relay': 'party',
  'teka-silang-kata': 'books',
  'betul-salah': 'cap',
  'roda-nasib': 'coin',
  pertandingan: 'trophy',
  'peta-pengembaraan': 'rocket',
  'uji-minda': 'books',
  'cabaran-kilat': 'bolt',
  jutawan: 'coin',
  'susun-jawapan': 'books',
  'tembak-jawapan': 'fire',
  'sambung-kata': 'party',
  'kad-memori': 'cap',
}
