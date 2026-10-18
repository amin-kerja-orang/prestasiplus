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
