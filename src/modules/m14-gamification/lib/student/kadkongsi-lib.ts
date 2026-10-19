/**
 * S18 `/gamification/kad-kongsi` helpers (SRS M14 FR-M14-52..55, FN-M14-6.2.*): tabs, copy, the
 * percent format, the card WhatsApp texts and the card file names.
 */

import { formatNumber } from '@/lib/number'

export type KadTab = 'profil' | 'kombo' | 'penguasaan' | 'ranking'

export interface KadTabDef {
  id: KadTab
  label: string
  /** Lucide icon name for `fa-id-card`, `fa-fire`, `fa-brain`, `fa-trophy` (design-system §6). */
  icon: 'IdCard' | 'Flame' | 'Brain' | 'Trophy'
  /** Active tab colour (live: purple, orange, emerald, blue). */
  active: string
}

export const KAD_TABS: readonly KadTabDef[] = [
  { id: 'profil', label: 'Profil', icon: 'IdCard', active: 'border-violet-600 bg-violet-600' },
  { id: 'kombo', label: 'Kombo', icon: 'Flame', active: 'border-orange-600 bg-orange-600' },
  {
    id: 'penguasaan',
    label: 'Penguasaan',
    icon: 'Brain',
    active: 'border-emerald-600 bg-emerald-600',
  },
  { id: 'ranking', label: 'Kedudukan', icon: 'Trophy', active: 'border-blue-600 bg-blue-600' },
]

export const KAD_COPY = {
  profilTitle: 'Kad Profil Pelajar',
  komboTitle: 'Kad Kombo',
  penguasaanTitle: 'Kad Penguasaan Subjek',
  rankingTitle: 'Kad Kedudukan',
  brand: 'PRESTASIPLUS',
  site: '🎓 PRESTASIPLUS.MY',
  soalan: 'Soalan',
  ketepatan: 'Ketepatan',
  sesi: 'Sesi',
  hariBerturut: 'Hari Berturut-turut!',
  rekodTerbaik: 'Rekod Terbaik',
  pengganda: 'Pengganda',
  penguasaanLabel: 'Penguasaan Subjek',
  betul: 'Betul',
  rankingLabel: 'Kedudukan Terkini',
  download: 'Muat Turun',
  whatsapp: 'WhatsApp',
  kongsi: 'Kongsi',
  loadError: 'Maaf, berlaku ralat. Sila cuba semula.',
  retry: 'Cuba Semula',
} as const

/** "38.7", "35" (1 decimal, a trailing ".0" dropped). */
export const pct1 = (value: number): string =>
  formatNumber(value, { decimals: 1, dropZeroFraction: true })

/** "Bronze" from the tier key (English key capitalised, as live). */
export const tierName = (key: string): string => key.charAt(0).toUpperCase() + key.slice(1)

export const profilText = (accuracy: number, answered: number): string =>
  `Lihat profil saya di PRESTASIPLUS! ${pct1(accuracy)}% ketepatan dengan ${String(answered)} soalan dijawab.`

export const komboText = (current: number, best: number): string =>
  `🔥 Kombo ${String(current)} hari berturut-turut di PRESTASIPLUS! Rekod terbaik: ${String(best)} hari. Jom cabaran!`

export const masteryText = (
  level: number,
  stage: string,
  subject: string,
  accuracy: number,
): string =>
  `🧠 Saya sudah capai Level ${String(level)} (${stage}) dalam ${subject} di PRESTASIPLUS! Ketepatan ${pct1(accuracy)}%. Jom bersaing!`

/** DV-M14-03: the live text leaves the value empty; the card's value is inserted. */
export const rankingText = (accuracy: number): string =>
  `🏆 Kedudukan saya di PRESTASIPLUS: ${pct1(accuracy)}%! Jom latih tubi!`

/** `prestasiplus-{card}.png`, card = `profil`, `kombo`, `penguasaan-{i}`, `kedudukan` (FN-M14-6.2.6). */
export const kadFileName = (card: string): string => `prestasiplus-${card}.png`

/**
 * Mastery card colour by level. OBSERVED: L1 grey, L2 blue (screenshots). INFERRED for the other
 * levels (not observed on live): L0 grey, L3 emerald, L4 violet, L5 and above amber.
 */
export function masteryGradient(level: number): string {
  if (level <= 1) return 'bg-linear-to-br from-gray-400 to-gray-600'
  if (level === 2) return 'bg-linear-to-br from-blue-400 to-blue-500'
  if (level === 3) return 'bg-linear-to-br from-emerald-400 to-emerald-600'
  if (level === 4) return 'bg-linear-to-br from-violet-400 to-violet-600'
  return 'bg-linear-to-br from-amber-400 to-amber-600'
}
