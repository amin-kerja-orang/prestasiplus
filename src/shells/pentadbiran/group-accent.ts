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
const TINT_BY_GROUP: Record<string, string> = {
  'papan-pemuka': 'bg-cat-1/15 text-cat-1',
  pemantauan: 'bg-cat-4/15 text-cat-4',
  'bank-soalan': 'bg-cat-7/15 text-cat-7',
  'kertas-spm': 'bg-cat-6/15 text-cat-6',
  'kurikulum-kandungan': 'bg-cat-8/15 text-cat-8',
  'pengguna-sekolah': 'bg-cat-2/15 text-cat-2',
  penglibatan: 'bg-cat-5/15 text-cat-5',
  kewangan: 'bg-cat-3/15 text-cat-3',
  sistem: 'bg-cat-1/15 text-cat-1',
}

export function groupTintClass(key: string | undefined): string {
  return TINT[(key && TINT_BY_GROUP[key]) || 'bg-cat-1/15 text-cat-1'] ?? ''
}
