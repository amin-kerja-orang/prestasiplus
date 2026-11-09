/**
 * Accent of each Pentadbiran group: the coloured icon chip in the sidebar and the title chip in
 * the top bar. Full class literals (Tailwind and the class allowlist must see them); tokens only.
 */
const CHIP = {
  action: 'bg-gradient-primary text-primary-on',
  violet: 'bg-friend text-primary-on',
  orange: 'bg-heat text-primary-on',
  lime: 'bg-highlight text-on-highlight',
  amber: 'bg-trial text-on-highlight',
} as const

export type GroupAccent = keyof typeof CHIP

const BY_GROUP: Record<string, GroupAccent> = {
  'papan-pemuka': 'action',
  pemantauan: 'action',
  'bank-soalan': 'violet',
  'kertas-spm': 'orange',
  'kurikulum-kandungan': 'lime',
  'pengguna-sekolah': 'orange',
  penglibatan: 'amber',
  kewangan: 'lime',
  sistem: 'violet',
}

export function groupChipClass(key: string | undefined): string {
  return CHIP[(key && BY_GROUP[key]) || 'action']
}

/** Soft-tinted chip (tint + glyph colour) per group, a different categorical accent each. */
const TINT: Record<string, string> = {
  'bg-cat-1/15 text-cat-1': 'bg-cat-1/15 text-cat-1',
  'bg-cat-2/15 text-cat-2': 'bg-cat-2/15 text-cat-2',
  'bg-cat-3/15 text-cat-3': 'bg-cat-3/15 text-cat-3',
  'bg-cat-4/15 text-cat-4': 'bg-cat-4/15 text-cat-4',
  'bg-cat-5/15 text-cat-5': 'bg-cat-5/15 text-cat-5',
  'bg-cat-6/15 text-cat-6': 'bg-cat-6/15 text-cat-6',
  'bg-cat-7/15 text-cat-7': 'bg-cat-7/15 text-cat-7',
  'bg-cat-8/15 text-cat-8': 'bg-cat-8/15 text-cat-8',
}
/** Current Pentadbiran group keys (menu.ts); neighbouring groups get different hues. */
const TINT_BY_GROUP: Record<string, string> = {
  pintasan: 'bg-cat-1/15 text-cat-1',
  harian: 'bg-cat-4/15 text-cat-4',
  analitik: 'bg-cat-2/15 text-cat-2',
  kurikulum: 'bg-cat-8/15 text-cat-8',
  soalan: 'bg-cat-7/15 text-cat-7',
  pengguna: 'bg-cat-3/15 text-cat-3',
  spm: 'bg-cat-6/15 text-cat-6',
  premium: 'bg-cat-5/15 text-cat-5',
  'kawalan-ciri': 'bg-cat-1/15 text-cat-1',
  gamifikasi: 'bg-cat-4/15 text-cat-4',
  'battle-permainan': 'bg-cat-2/15 text-cat-2',
  marketplace: 'bg-cat-3/15 text-cat-3',
  kandungan: 'bg-cat-8/15 text-cat-8',
  sistem: 'bg-cat-7/15 text-cat-7',
  ditangguh: 'bg-cat-6/15 text-cat-6',
}

export function groupTintClass(key: string | undefined): string {
  return TINT[(key && TINT_BY_GROUP[key]) || 'bg-cat-1/15 text-cat-1'] ?? ''
}
